import { Env } from '../models/common.model';

/**
 * Cloudflare Images Upload Response
 */
export interface CloudflareImageUploadResponse {
  result: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
  result_info: any;
  success: boolean;
  errors: string[];
  messages: string[];
}

/**
 * Cloudflare Image Metadata
 */
export interface CloudflareImageMetadata {
  id: string;
  filename: string;
  uploaded: string;
  requireSignedURLs: boolean;
  variants: string[];
}

/**
 * Cloudflare Images Service
 * 
 * A service to interact with the Cloudflare Images API
 */
export class CloudflareImagesService {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;
  private deliveryBaseUrl: string;
  private defaultVariants: string[] = ['public', 'thumbnail', 'product', 'gallery'];

  /**
   * Helper method to handle Cloudflare API responses
   * @param response The response from Cloudflare API
   * @returns Typed response data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json() as {
        errors: Array<{ message?: string }>
      };
      throw new Error(`Cloudflare Images error: ${errorData.errors[0]?.message || 'Unknown error'}`);
    }
    const responseData = await response.json();
    return responseData as T;
  }

  constructor(env: Env) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
    this.deliveryBaseUrl = `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_HASH}`;
  }

  /**
   * Get a direct upload URL that allows users to upload images directly to Cloudflare Images
   * 
   * @param metadata Optional metadata to associate with the image
   * @param requireSignedURLs Whether the image requires signed URLs for access
   * @returns Upload URL and one-time token
   */
  async getDirectUploadUrl(metadata?: Record<string, string>, requireSignedURLs: boolean = false): Promise<{ uploadURL: string; id: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/direct_upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requireSignedURLs,
          metadata
        })
      });

      const data = await this.handleResponse<{
        result: { uploadURL: string; id: string };
      }>(response);

      return {
        uploadURL: data.result.uploadURL,
        id: data.result.id
      };
    } catch (error) {
      console.error('Error getting direct upload URL:', error);
      throw new Error(error instanceof Error ? error.message : 'Error getting direct upload URL');
    }
  }

  /**
   * Upload an image to Cloudflare Images
   * 
   * @param file The file to upload (FormData with the image)
   * @param metadata Optional metadata to associate with the image
   * @returns The uploaded image metadata
   */
  async uploadImage(file: FormData | File | Blob, metadata?: Record<string, string>): Promise<CloudflareImageMetadata> {
    try {
      let formData: FormData;

      if (file instanceof FormData) {
        formData = file;
      } else {
        formData = new FormData();
        formData.append('file', file);
      }

      // Add metadata if provided
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      });

      const data = await this.handleResponse<CloudflareImageUploadResponse>(response);
      return data.result;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(error instanceof Error ? error.message : 'Error uploading image');
    }
  }

  /**
   * Get an image by its ID
   * 
   * @param imageId The ID of the image
   * @returns The image metadata
   */
  async getImage(imageId: string): Promise<CloudflareImageMetadata> {
    try {
      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      const data = await this.handleResponse<{ result: CloudflareImageMetadata }>(response);
      return data.result;
    } catch (error) {
      console.error(`Error getting image ${imageId}:`, error);
      throw new Error(error instanceof Error ? error.message : `Error getting image ${imageId}`);
    }
  }

  /**
   * Delete an image by its ID
   * 
   * @param imageId The ID of the image
   * @returns True if deletion was successful
   */
  async deleteImage(imageId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      await this.handleResponse<{ result: { id: string } }>(response);
      return true;
    } catch (error) {
      console.error(`Error deleting image ${imageId}:`, error);
      throw new Error(error instanceof Error ? error.message : `Error deleting image ${imageId}`);
    }
  }

  /**
   * Get the URL for an image variant
   * 
   * @param imageId The ID of the image
   * @param variant The variant of the image (public, thumbnail, product, etc.)
   * @returns The URL of the image variant
   */
  getImageUrl(imageId: string, variant: string = 'public'): string {
    return `${this.deliveryBaseUrl}/${imageId}/${variant}`;
  }

  /**
   * Get URLs for all variants of an image
   * 
   * @param imageId The ID of the image
   * @param variants The variants to get URLs for (defaults to all standard variants)
   * @returns An object with variant names as keys and URLs as values
   */
  getImageVariantUrls(imageId: string, variants: string[] = this.defaultVariants): Record<string, string> {
    const urls: Record<string, string> = {};

    for (const variant of variants) {
      urls[variant] = this.getImageUrl(imageId, variant);
    }

    return urls;
  }

  /**
   * List images with pagination
   * 
   * @param page The page number (1-based)
   * @param perPage The number of images per page
   * @returns The list of images
   */
  async listImages(page: number = 1, perPage: number = 100): Promise<{ images: CloudflareImageMetadata[]; total: number }> {
    try {
      const response = await fetch(`${this.baseUrl}?page=${page}&per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      type ImagesListResponse = {
        result: { images: CloudflareImageMetadata[] };
        result_info: { total_count: number };
      };

      const data = await this.handleResponse<ImagesListResponse>(response);

      return {
        images: data.result.images,
        total: data.result_info.total_count
      };
    } catch (error) {
      console.error('Error listing images:', error);
      throw new Error(error instanceof Error ? error.message : 'Error listing images');
    }
  }
}