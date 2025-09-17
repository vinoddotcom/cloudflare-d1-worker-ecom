import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { ProductVariantRepository } from '../data/repositories/product-variant.repository';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Controller for product variant operations
 */
export class ProductVariantController {
    private variantRepository: ProductVariantRepository;

    constructor(env: Env) {
        this.variantRepository = new ProductVariantRepository(env);
    }

    /**
     * Get all variants for a specific product
     * @param request Request object
     * @returns Response with product variants
     */
    async getProductVariants(request: AuthRequest): Promise<Response> {
        try {
            const productId = parseInt(request.params?.productId || '');
            if (isNaN(productId)) {
                return errorResponse('Invalid product ID', 400);
            }

            const variants = await this.variantRepository.findVariantsByProductId(productId);

            return successResponse({
                variants
            });
        } catch (error) {
            console.error('Error getting product variants:', error);
            return errorResponse('Failed to get product variants', 500);
        }
    }

    /**
     * Create a new product variant
     * @param request Request object
     * @returns Response with created variant
     */
    async createProductVariant(request: AuthRequest): Promise<Response> {
        try {
            const productId = parseInt(request.params?.productId || '');
            if (isNaN(productId)) {
                return errorResponse('Invalid product ID', 400);
            }

            const data = await request.json() as {
                sku: string;
                name: string;
                price: number;
                compare_at_price?: number;
                is_active?: boolean;
                attributes?: { attribute_id: number; value_id: number }[];
            };

            // Validate required fields
            if (!data.sku || !data.name || data.price === undefined) {
                return errorResponse('SKU, name, and price are required', 400);
            }

            // Check if SKU already exists
            const existingVariant = await this.variantRepository.findVariantBySku(data.sku);
            if (existingVariant) {
                return errorResponse('A variant with this SKU already exists', 409);
            }

            // Create the variant
            const variantId = await this.variantRepository.createVariant({
                product_id: productId,
                sku: data.sku,
                name: data.name,
                price: data.price,
                compare_at_price: data.compare_at_price,
                is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
                created_at: Date.now(),
                updated_at: Date.now()
            });

            // Add attributes if provided
            if (data.attributes && Array.isArray(data.attributes)) {
                await Promise.all(data.attributes.map(attr =>
                    this.variantRepository.addVariantAttribute(variantId, attr.value_id)
                ));
            }

            // Get the created variant with attributes
            const variant = await this.variantRepository.findVariantById(variantId);
            const attributes = await this.variantRepository.findVariantAttributes(variantId);

            return successResponse({
                message: 'Product variant created successfully',
                variant,
                attributes
            }, 201);
        } catch (error) {
            console.error('Error creating product variant:', error);
            return errorResponse('Failed to create product variant', 500);
        }
    }

    /**
     * Update a product variant
     * @param request Request object
     * @returns Response with updated variant
     */
    async updateProductVariant(request: AuthRequest): Promise<Response> {
        try {
            const productId = parseInt(request.params?.productId || '');
            const variantId = parseInt(request.params?.id || '');

            if (isNaN(productId) || isNaN(variantId)) {
                return errorResponse('Invalid product or variant ID', 400);
            }

            const data = await request.json() as {
                sku?: string;
                name?: string;
                price?: number;
                compare_at_price?: number;
                is_active?: boolean;
                addAttributes?: { attribute_id: number; value_id: number }[];
                removeAttributes?: number[]; // value IDs to remove
            };

            // Validate input
            if (Object.keys(data).length === 0) {
                return errorResponse('No update data provided', 400);
            }

            // Check if variant exists
            const variant = await this.variantRepository.findVariantById(variantId);
            if (!variant) {
                return errorResponse('Variant not found', 404);
            }

            // Check if variant belongs to the specified product
            if (variant.product_id !== productId) {
                return errorResponse('Variant does not belong to the specified product', 400);
            }

            // Check if SKU exists for another variant
            if (data.sku && data.sku !== variant.sku) {
                const existingVariant = await this.variantRepository.findVariantBySku(data.sku);
                if (existingVariant && existingVariant.id !== variantId) {
                    return errorResponse('A variant with this SKU already exists', 409);
                }
            }

            // Update variant
            const updateData: any = {
                updated_at: Date.now()
            };

            if (data.sku !== undefined) updateData.sku = data.sku;
            if (data.name !== undefined) updateData.name = data.name;
            if (data.price !== undefined) updateData.price = data.price;
            if (data.compare_at_price !== undefined) updateData.compare_at_price = data.compare_at_price;
            if (data.is_active !== undefined) updateData.is_active = data.is_active ? 1 : 0;

            await this.variantRepository.updateVariant(variantId, updateData);

            // Add new attributes if provided
            if (data.addAttributes && Array.isArray(data.addAttributes)) {
                await Promise.all(data.addAttributes.map(attr =>
                    this.variantRepository.addVariantAttribute(variantId, attr.value_id)
                ));
            }

            // Remove attributes if provided
            if (data.removeAttributes && Array.isArray(data.removeAttributes)) {
                await Promise.all(data.removeAttributes.map(valueId =>
                    this.variantRepository.removeVariantAttribute(variantId, valueId)
                ));
            }

            // Get updated variant with attributes
            const updatedVariant = await this.variantRepository.findVariantById(variantId);
            const attributes = await this.variantRepository.findVariantAttributes(variantId);

            return successResponse({
                message: 'Product variant updated successfully',
                variant: updatedVariant,
                attributes
            });
        } catch (error) {
            console.error('Error updating product variant:', error);
            return errorResponse('Failed to update product variant', 500);
        }
    }

    /**
     * Delete a product variant
     * @param request Request object
     * @returns Response with success message
     */
    async deleteProductVariant(request: AuthRequest): Promise<Response> {
        try {
            const productId = parseInt(request.params?.productId || '');
            const variantId = parseInt(request.params?.id || '');

            if (isNaN(productId) || isNaN(variantId)) {
                return errorResponse('Invalid product or variant ID', 400);
            }

            // Check if variant exists
            const variant = await this.variantRepository.findVariantById(variantId);
            if (!variant) {
                return errorResponse('Variant not found', 404);
            }

            // Check if variant belongs to the specified product
            if (variant.product_id !== productId) {
                return errorResponse('Variant does not belong to the specified product', 400);
            }

            // Delete variant
            await this.variantRepository.deleteVariant(variantId);

            return successResponse({
                message: 'Product variant deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting product variant:', error);
            return errorResponse('Failed to delete product variant', 500);
        }
    }
}