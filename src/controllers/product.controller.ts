import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { ProductRepository } from '../data/repositories/product.repository';
import { validateRequest } from '../middleware/validator';
import { z } from 'zod';
import { Product, ProductCreateInput, ProductUpdateInput } from '../models/product.model';

/**
 * Controller for product-related operations
 */
export class ProductController {
    private productRepository: ProductRepository;

    constructor(private env: Env) {
        this.productRepository = new ProductRepository(env);
    }

    /**
     * Get all products with pagination, filtering, and sorting
     */
    async getAllProducts(request: IRequest): Promise<Response> {
        try {
            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '10');
            const category = url.searchParams.get('category') || undefined;
            const search = url.searchParams.get('search') || undefined;
            const sortBy = url.searchParams.get('sortBy') || 'createdAt';
            const sortOrderParam = url.searchParams.get('sortOrder');
            const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';

            const products = await this.productRepository.findAllWithOptions({
                page,
                limit,
                category,
                search,
                sortBy,
                sortOrder,
            });

            return successResponse(products);
        } catch (error) {
            console.error('Error fetching products:', error);
            return errorResponse('Failed to fetch products', 500);
        }
    }

    /**
     * Get a product by its ID
     */
    async getProductById(request: IRequest): Promise<Response> {
        try {
            const productId = request.params?.id;

            if (!productId) {
                return errorResponse('Product ID is required', 400);
            }

            const product = await this.productRepository.findById(productId);

            if (!product) {
                return errorResponse('Product not found', 404);
            }

            return successResponse(product);
        } catch (error) {
            console.error('Error fetching product:', error);
            return errorResponse('Failed to fetch product', 500);
        }
    }

    /**
     * Get all product categories
     */
    async getProductCategories(request: IRequest): Promise<Response> {
        try {
            const categories = await this.productRepository.findAllCategories();
            return successResponse(categories);
        } catch (error) {
            console.error('Error fetching product categories:', error);
            return errorResponse('Failed to fetch product categories', 500);
        }
    }

    /**
     * Create a new product (admin only)
     */
    async createProduct(request: AuthRequest): Promise<Response> {
        const createProductSchema = z.object({
            name: z.string().min(3).max(100),
            description: z.string().min(10).max(1000),
            price: z.number().positive(),
            categoryId: z.string().uuid(),
            sku: z.string().min(3).max(50),
            stockQuantity: z.number().int().min(0),
            images: z.array(z.string().url()).optional(),
            attributes: z.record(z.string(), z.string()).optional(),
        });

        try {
            // Validate the request body
            const validationResult = await validateRequest(createProductSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            const productData = await request.json() as {
                sku: string;
                name: string;
                description?: string;
                price: number;
                compare_at_price?: number;
                cost_price?: number;
                weight?: number;
                weight_unit?: string;
                featured?: boolean;
                is_active?: boolean;
                category_ids?: number[];
            };

            if (!request.userId) {
                return errorResponse('User ID not found in request', 400);
            }

            // Create the product
            const productCreateData: ProductCreateInput = {
                ...productData
            };

            // Create the product using repository method - ensure required fields are present
            const productDataWithDefaults = {
                ...productCreateData,
                featured: productCreateData.featured ?? false,
                is_active: productCreateData.is_active ?? true
            } as Omit<Product, 'id'>;

            const productId = await this.productRepository.createProduct(productDataWithDefaults);

            // Get the newly created product
            const newProduct = await this.productRepository.findById(productId.toString());

            return successResponse(newProduct, 201);
        } catch (error) {
            console.error('Error creating product:', error);
            return errorResponse('Failed to create product', 500);
        }
    }

    /**
     * Update a product (admin only)
     */
    async updateProduct(request: AuthRequest): Promise<Response> {
        const updateProductSchema = z.object({
            name: z.string().min(3).max(100).optional(),
            description: z.string().min(10).max(1000).optional(),
            price: z.number().positive().optional(),
            categoryId: z.string().uuid().optional(),
            sku: z.string().min(3).max(50).optional(),
            stockQuantity: z.number().int().min(0).optional(),
            images: z.array(z.string().url()).optional(),
            attributes: z.record(z.string(), z.string()).optional(),
        });

        try {
            const productId = request.params?.id;

            if (!productId) {
                return errorResponse('Product ID is required', 400);
            }

            // Validate the request body
            const validationResult = await validateRequest(updateProductSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            const productData = await request.json() as {
                sku?: string;
                name?: string;
                description?: string;
                price?: number;
                compare_at_price?: number;
                cost_price?: number;
                weight?: number;
                weight_unit?: string;
                featured?: boolean;
                is_active?: boolean;
                category_ids?: number[];
            };

            // Check if the product exists
            const existingProduct = await this.productRepository.findById(productId);

            if (!existingProduct) {
                return errorResponse('Product not found', 404);
            }

            if (!request.userId) {
                return errorResponse('User ID not found in request', 400);
            }

            // Update the product
            const productUpdateData: ProductUpdateInput = {
                ...productData
            };

            // Perform the update
            await this.productRepository.update(productId, productUpdateData);

            // Get the updated product
            const updatedProduct = await this.productRepository.findById(productId);

            return successResponse(updatedProduct);
        } catch (error) {
            console.error('Error updating product:', error);
            return errorResponse('Failed to update product', 500);
        }
    }

    /**
     * Delete a product (admin only)
     */
    async deleteProduct(request: AuthRequest): Promise<Response> {
        try {
            const productId = request.params?.id;

            if (!productId) {
                return errorResponse('Product ID is required', 400);
            }

            // Check if the product exists
            const existingProduct = await this.productRepository.findById(productId);

            if (!existingProduct) {
                return errorResponse('Product not found', 404);
            }

            // Delete the product
            await this.productRepository.delete(productId);

            return successResponse({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error('Error deleting product:', error);
            return errorResponse('Failed to delete product', 500);
        }
    }
}