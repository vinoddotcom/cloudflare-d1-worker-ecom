import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import {
    CloudflareImagesService,
    CloudflareImageMetadata
} from '../services/cloudflare-images.service';

/**
 * Controller for image-related operations
 */
export class ImageController {
    private cloudflareImagesService: CloudflareImagesService;

    constructor(private env: Env) {
        this.cloudflareImagesService = new CloudflareImagesService(env);
    }

    /**
     * Get a direct upload URL for Cloudflare Images
     * This allows for secure, direct browser-to-Cloudflare uploads
     */
    async getDirectUploadUrl(request: AuthRequest): Promise<Response> {
        try {
            // Add user ID to metadata
            const metadata: Record<string, string> = {
                userId: request.userId || '',
                uploadedAt: new Date().toISOString()
            };

            const uploadUrlData = await this.cloudflareImagesService.getDirectUploadUrl(metadata);

            return successResponse({
                uploadURL: uploadUrlData.uploadURL,
                id: uploadUrlData.id
            });
        } catch (error) {
            console.error('Error getting direct upload URL:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to get upload URL', 500);
        }
    }

    /**
     * Upload an image to Cloudflare Images from a multipart form request
     * Requires authentication
     */
    async uploadImage(request: AuthRequest): Promise<Response> {
        try {
            // Parse multipart form data
            const formData = await request.formData();

            if (!formData.has('file')) {
                return errorResponse('No image file provided', 400);
            }

            // Add metadata
            const metadata: Record<string, string> = {
                userId: request.userId || '',
                uploadedAt: new Date().toISOString()
            };

            if (formData.has('alt')) {
                metadata.alt = formData.get('alt') as string;
            }

            if (formData.has('type')) {
                metadata.type = formData.get('type') as string;
            }

            if (formData.has('entityId')) {
                metadata.entityId = formData.get('entityId') as string;
            }

            // Add metadata to FormData
            formData.append('metadata', JSON.stringify(metadata));

            // Upload the image
            const imageResult = await this.cloudflareImagesService.uploadImage(formData);

            // Generate variant URLs
            const variantUrls = this.cloudflareImagesService.getImageVariantUrls(imageResult.id);

            return successResponse({
                id: imageResult.id,
                filename: imageResult.filename,
                uploaded: imageResult.uploaded,
                variants: variantUrls
            });
        } catch (error) {
            console.error('Error uploading image:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to upload image', 500);
        }
    }

    /**
     * Get information about an image
     * No authentication required for public images
     */
    async getImage(request: IRequest): Promise<Response> {
        try {
            const imageId = request.params?.id;

            if (!imageId) {
                return errorResponse('Image ID is required', 400);
            }

            const image = await this.cloudflareImagesService.getImage(imageId);
            const variantUrls = this.cloudflareImagesService.getImageVariantUrls(image.id);

            return successResponse({
                id: image.id,
                filename: image.filename,
                uploaded: image.uploaded,
                variants: variantUrls
            });
        } catch (error) {
            console.error('Error getting image:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to get image', 500);
        }
    }

    /**
     * Delete an image
     * Requires authentication - user can only delete their own images
     */
    async deleteImage(request: AuthRequest): Promise<Response> {
        try {
            const imageId = request.params?.id;

            if (!imageId) {
                return errorResponse('Image ID is required', 400);
            }

            // In a production app, you should have a database table mapping images to users
            // Here, we're assuming only admins can delete images for simplicity
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized - only admins can delete images', 403);
            }

            await this.cloudflareImagesService.deleteImage(imageId);

            return successResponse({
                message: 'Image deleted successfully',
                id: imageId
            });
        } catch (error) {
            console.error('Error deleting image:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to delete image', 500);
        }
    }

    /**
     * Get image variant URL
     */
    async getImageVariant(request: IRequest): Promise<Response> {
        try {
            const { id, variant } = request.params || {};

            if (!id) {
                return errorResponse('Image ID is required', 400);
            }

            if (!variant) {
                return errorResponse('Variant is required', 400);
            }

            const url = this.cloudflareImagesService.getImageUrl(id, variant);

            // Return a redirect to the actual image URL
            return Response.redirect(url, 302);
        } catch (error) {
            console.error('Error getting image variant:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to get image variant', 500);
        }
    }

    /**
     * List images
     * Admin only - lists all images
     */
    async listImages(request: AuthRequest): Promise<Response> {
        try {
            // Admin only
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized - admin access required', 403);
            }

            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('perPage') || '100');

            const result = await this.cloudflareImagesService.listImages(page, perPage);

            // Enhance with variant URLs
            const images = result.images.map(image => ({
                id: image.id,
                filename: image.filename,
                uploaded: image.uploaded,
                variants: this.cloudflareImagesService.getImageVariantUrls(image.id)
            }));

            return successResponse({
                images,
                total: result.total,
                page,
                perPage
            });
        } catch (error) {
            console.error('Error listing images:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to list images', 500);
        }
    }
}