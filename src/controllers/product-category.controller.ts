import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { ProductCategoryRepository } from '../data/repositories/product-category.repository';
import { successResponse, errorResponse } from '../utils/response';
import { ProductCategory, ProductCategoryCreateInput, ProductCategoryUpdateInput } from '../models/product.model';

/**
 * Controller for product category operations
 */
export class ProductCategoryController {
    private categoryRepository: ProductCategoryRepository;

    constructor(env: Env) {
        this.categoryRepository = new ProductCategoryRepository(env);
    }

    /**
     * Create a new product category
     * @param request Request object
     * @returns Response with created category
     */
    async createProductCategory(request: AuthRequest): Promise<Response> {
        try {
            const data = await request.json() as {
                name: string;
                description?: string;
                parent_id?: number;
                image_url?: string;
                is_active?: boolean;
            };

            // Validate input
            if (!data || !data.name) {
                return errorResponse('Category name is required', 400);
            }

            // Check if category already exists
            const existingCategory = await this.categoryRepository.findCategoryByName(data.name);
            if (existingCategory) {
                return errorResponse('A category with this name already exists', 409);
            }

            // Check parent category if provided
            if (data.parent_id) {
                const parentCategory = await this.categoryRepository.findById(data.parent_id);
                if (!parentCategory) {
                    return errorResponse('Parent category not found', 404);
                }
            }

            // Create category
            const now = Date.now();
            const createData: Omit<ProductCategory, 'id'> = {
                name: data.name,
                description: data.description || undefined,
                parent_id: data.parent_id || undefined,
                image_url: data.image_url || undefined,
                is_active: data.is_active ?? true,
                created_at: now,
                updated_at: now
            };

            const categoryId = await this.categoryRepository.create(createData);

            // Get created category
            const category = await this.categoryRepository.findById(categoryId);

            return successResponse({
                message: 'Category created successfully',
                category
            }, 201);
        } catch (error) {
            console.error('Error creating product category:', error);
            return errorResponse('Failed to create product category', 500);
        }
    }

    /**
     * Update a product category
     * @param request Request object
     * @returns Response with updated category
     */
    async updateProductCategory(request: AuthRequest): Promise<Response> {
        try {
            const categoryId = parseInt(request.params?.id || '');
            if (isNaN(categoryId)) {
                return errorResponse('Invalid category ID', 400);
            }

            const data = await request.json() as {
                name?: string;
                description?: string;
                parent_id?: number | null;
                image_url?: string;
                is_active?: boolean;
            };

            // Validate input
            if (!data || Object.keys(data).length === 0) {
                return errorResponse('No update data provided', 400);
            }

            // Check if category exists
            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                return errorResponse('Category not found', 404);
            }

            // Check if name already exists for another category
            if (data.name && data.name !== category.name) {
                const existingCategory = await this.categoryRepository.findCategoryByName(data.name);
                if (existingCategory && existingCategory.id !== categoryId) {
                    return errorResponse('Another category with this name already exists', 409);
                }
            }

            // Check parent category if provided
            if (data.parent_id) {
                // Prevent circular reference
                if (data.parent_id === categoryId) {
                    return errorResponse('A category cannot be its own parent', 400);
                }

                const parentCategory = await this.categoryRepository.findById(data.parent_id);
                if (!parentCategory) {
                    return errorResponse('Parent category not found', 404);
                }
            }

            // Update category
            const updateData: Partial<ProductCategory> = {
                updated_at: Date.now()
            };

            if (data.name !== undefined) updateData.name = data.name;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.parent_id !== undefined) updateData.parent_id = data.parent_id || undefined;
            if (data.image_url !== undefined) updateData.image_url = data.image_url;
            if (data.is_active !== undefined) updateData.is_active = data.is_active;

            await this.categoryRepository.update(categoryId, updateData);

            // Get updated category
            const updatedCategory = await this.categoryRepository.findById(categoryId);

            return successResponse({
                message: 'Category updated successfully',
                category: updatedCategory
            });
        } catch (error) {
            console.error('Error updating product category:', error);
            return errorResponse('Failed to update product category', 500);
        }
    }

    /**
     * Delete a product category
     * @param request Request object
     * @returns Response with success message
     */
    async deleteProductCategory(request: AuthRequest): Promise<Response> {
        try {
            const categoryId = parseInt(request.params?.id || '');
            if (isNaN(categoryId)) {
                return errorResponse('Invalid category ID', 400);
            }

            // Check if category exists
            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                return errorResponse('Category not found', 404);
            }

            // Check if category has children
            const children = await this.categoryRepository.findChildCategories(categoryId);
            if (children.length > 0) {
                return errorResponse('Cannot delete a category that has child categories', 400);
            }

            // Check if category is used by products
            const products = await this.categoryRepository.findProductsByCategoryId(categoryId);
            if (products.length > 0) {
                return errorResponse('Cannot delete a category that is used by products', 400);
            }

            // Delete category
            await this.categoryRepository.delete(categoryId);

            return successResponse({
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting product category:', error);
            return errorResponse('Failed to delete product category', 500);
        }
    }
}