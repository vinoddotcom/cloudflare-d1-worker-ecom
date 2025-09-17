import { Env, D1Database, D1Result } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Product, ProductCategory, ProductImage, ProductVariant, InventoryItem } from '../../models/product.model';

/**
 * Interface for the database representation of a product
 */
interface DBProduct {
    id: number;
    sku: string;
    name: string;
    description: string | null;
    price: number;
    compare_at_price: number | null;
    cost_price: number | null;
    weight: number | null;
    weight_unit: string | null;
    featured: number;
    is_active: number;
    category_id: number | null;
    images: string | null; // JSON string
    created_at: number;
    updated_at: number;
    // Joined fields
    categoryName?: string;
}

/**
 * Interface for product query options
 */
interface ProductQueryOptions {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Repository for product-related database operations
 */
export class ProductRepository extends BaseRepository<Product> {
    constructor(env: Env) {
        super(env.DB, 'products');
    }

    /**
     * Find all products with the standard BaseRepository interface
     * This implementation satisfies the contract of the base class
     */
    override async findAll(
        page: number = 1,
        limit: number = 20,
        orderBy: string = 'id',
        direction: 'asc' | 'desc' = 'asc'
    ): Promise<{ data: Product[]; total: number }> {
        try {
            const result = await this.findAllWithOptions({
                page,
                limit,
                sortBy: orderBy,
                sortOrder: direction
            });

            return {
                data: result.products,
                total: result.total
            };
        } catch (error) {
            console.error('Error in findAll:', error);
            throw new Error('Failed to fetch products');
        }
    }

    /**
     * Find all products with pagination, filtering, and sorting
     */
    async findAllWithOptions(options: ProductQueryOptions): Promise<{
        products: Product[];
        total: number;
        page: number;
        limit: number
    }> {
        const {
            page = 1,
            limit = 10,
            category,
            search,
            sortBy = 'created_at',
            sortOrder = 'desc',
        } = options;

        const offset = (page - 1) * limit;

        // Build the base query
        let query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.compare_at_price,
        p.cost_price,
        p.weight,
        p.weight_unit,
        p.sku, 
        p.featured,
        p.is_active,
        p.images,
        p.created_at,
        p.updated_at,
        c.id as category_id,
        c.name as categoryName
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE 1=1
    `;

        // Add category filter if provided
        if (category) {
            query += ` AND c.id = ?`;
        }

        // Add search filter if provided
        if (search) {
            query += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
        }

        // Add sorting
        query += ` ORDER BY p.${this.sanitizeColumn(sortBy)} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

        // Add pagination
        query += ` LIMIT ? OFFSET ?`;

        // Build the parameters array
        const params: any[] = [];
        if (category) params.push(category);
        if (search) {
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        params.push(limit, offset);

        // Count total matching products for pagination
        let countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE 1=1
    `;

        if (category) {
            countQuery += ` AND c.id = ?`;
        }

        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
        }

        // Build the count parameters
        const countParams: any[] = [];
        if (category) countParams.push(category);
        if (search) {
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        try {
            // Execute the queries
            const productsResult = await this.db.prepare(query).bind(...params).all<DBProduct>();
            const countResult = await this.db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

            // Transform database rows to Product objects
            const products = (productsResult.results || []).map(row => this.mapDBProductToProduct(row));

            return {
                products,
                total: countResult?.total || 0,
                page,
                limit,
            };
        } catch (error) {
            console.error('Error finding products:', error);
            throw new Error('Failed to fetch products');
        }
    }

    /**
     * Find a product by its ID
     */
    override async findById(id: string | number): Promise<Product | null> {
        const query = `
      SELECT 
        p.*,
        c.name as categoryName
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.id = ?
    `;

        try {
            const result = await this.db.prepare(query).bind(id).first<DBProduct>();

            if (!result) {
                return null;
            }

            return this.mapDBProductToProduct(result);
        } catch (error) {
            console.error('Error finding product by ID:', error);
            throw new Error(`Failed to fetch product with ID ${id}`);
        }
    }

    /**
     * Find all product categories
     */
    async findAllCategories(): Promise<ProductCategory[]> {
        const query = `
      SELECT 
        id, 
        name, 
        description,
        parent_id,
        image_url,
        is_active,
        created_at,
        updated_at
      FROM product_categories
      ORDER BY name ASC
    `;

        try {
            const result = await this.db.prepare(query).all<{
                id: number;
                name: string;
                description: string | null;
                parent_id: number | null;
                image_url: string | null;
                is_active: number;
                created_at: number;
                updated_at: number;
            }>();

            return (result.results || []).map(row => ({
                id: row.id,
                name: row.name,
                description: row.description || undefined,
                parent_id: row.parent_id || undefined,
                image_url: row.image_url || undefined,
                is_active: Boolean(row.is_active),
                created_at: row.created_at,
                updated_at: row.updated_at
            }));
        } catch (error) {
            console.error('Error finding product categories:', error);
            throw new Error('Failed to fetch product categories');
        }
    }

    /**
     * Create a new product
     */
    override async create(data: Omit<Product, 'id'>): Promise<number> {
        const now = Date.now();

        const query = `
      INSERT INTO products (
        name, 
        description, 
        price, 
        compare_at_price,
        cost_price,
        weight,
        weight_unit,
        category_id,
        sku, 
        featured,
        is_active,
        images,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        // Serialize images if present
        const images = data.images ? JSON.stringify(data.images) : null;

        try {
            const result = await this.db.prepare(query).bind(
                data.name,
                data.description || null,
                data.price,
                data.compare_at_price || null,
                data.cost_price || null,
                data.weight || null,
                data.weight_unit || null,
                data.categories && data.categories.length > 0 ? data.categories[0].id : null,
                data.sku,
                data.featured ? 1 : 0,
                data.is_active ? 1 : 0,
                images,
                now,
                now
            ).run();

            if (!result.success) {
                throw new Error('Failed to create product');
            }

            return (result as any).lastRowId;
        } catch (error) {
            console.error('Error creating product:', error);
            throw new Error('Failed to create product');
        }
    }

    /**
     * Update an existing product
     */
    override async update(id: string | number, data: Partial<Product>): Promise<boolean> {
        // First, check if the product exists
        const existingProduct = await this.findById(id);

        if (!existingProduct) {
            throw new Error(`Product with ID ${id} not found`);
        }

        // Build the update query dynamically
        const updateFields: string[] = [];
        const params: any[] = [];

        if (data.name !== undefined) {
            updateFields.push('name = ?');
            params.push(data.name);
        }

        if (data.description !== undefined) {
            updateFields.push('description = ?');
            params.push(data.description);
        }

        if (data.price !== undefined) {
            updateFields.push('price = ?');
            params.push(data.price);
        }

        if (data.compare_at_price !== undefined) {
            updateFields.push('compare_at_price = ?');
            params.push(data.compare_at_price);
        }

        if (data.cost_price !== undefined) {
            updateFields.push('cost_price = ?');
            params.push(data.cost_price);
        }

        if (data.weight !== undefined) {
            updateFields.push('weight = ?');
            params.push(data.weight);
        }

        if (data.weight_unit !== undefined) {
            updateFields.push('weight_unit = ?');
            params.push(data.weight_unit);
        }

        if (data.categories && data.categories.length > 0) {
            updateFields.push('category_id = ?');
            params.push(data.categories[0].id);
        }

        if (data.sku !== undefined) {
            updateFields.push('sku = ?');
            params.push(data.sku);
        }

        if (data.featured !== undefined) {
            updateFields.push('featured = ?');
            params.push(data.featured ? 1 : 0);
        }

        if (data.is_active !== undefined) {
            updateFields.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        if (data.images !== undefined) {
            updateFields.push('images = ?');
            params.push(JSON.stringify(data.images));
        }

        // Add common update field - updated_at
        updateFields.push('updated_at = ?');
        params.push(Date.now());

        // Add product ID to params
        params.push(id);

        const query = `
      UPDATE products
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

        try {
            const result = await this.db.prepare(query).bind(...params).run();
            return result.success;
        } catch (error) {
            console.error('Error updating product:', error);
            throw new Error(`Failed to update product with ID ${id}`);
        }
    }

    /**
     * Delete a product (soft delete)
     */
    override async delete(id: string | number): Promise<boolean> {
        // Soft delete by setting is_active = 0
        const query = `
      UPDATE products
      SET is_active = 0, updated_at = ?
      WHERE id = ?
    `;

        const now = Date.now();

        try {
            const result = await this.db.prepare(query).bind(now, id).run();
            return result.success;
        } catch (error) {
            console.error('Error deleting product:', error);
            throw new Error(`Failed to delete product with ID ${id}`);
        }
    }

    /**
     * Find a product by its ID (backward compatibility method)
     * @param id Product ID
     * @returns Product or null if not found
     */
    async findProductById(id: number): Promise<Product | null> {
        return this.findById(id);
    }

    /**
     * Create a new product (backward compatibility method)
     * @param product Product data
     * @returns ID of the created product
     */
    async createProduct(product: Omit<Product, 'id'>): Promise<number> {
        return this.create(product);
    }

    /**
     * Update an existing product (backward compatibility method)
     * @param product Product data with ID
     * @returns True if update was successful
     */
    async updateProduct(product: Product): Promise<boolean> {
        if (!product.id) {
            throw new Error('Product ID is required for update');
        }
        return this.update(product.id, product);
    }

    /**
     * Delete a product (backward compatibility method)
     * @param id Product ID
     * @returns True if deletion was successful
     */
    async deleteProduct(id: number): Promise<boolean> {
        return this.delete(id);
    }

    /**
     * Map a database product row to a Product object
     */
    private mapDBProductToProduct(row: DBProduct): Product {
        // Parse images from JSON if present
        let images: ProductImage[] = [];
        if (row.images) {
            try {
                const parsedImages = JSON.parse(row.images);
                if (Array.isArray(parsedImages)) {
                    images = parsedImages;
                }
            } catch (e) {
                console.error('Error parsing product images:', e);
            }
        }

        // Create and return a properly formatted Product object
        return {
            id: row.id,
            sku: row.sku,
            name: row.name,
            description: row.description || undefined,
            price: row.price,
            compare_at_price: row.compare_at_price || undefined,
            cost_price: row.cost_price || undefined,
            weight: row.weight || undefined,
            weight_unit: row.weight_unit || undefined,
            featured: Boolean(row.featured),
            is_active: Boolean(row.is_active),
            created_at: row.created_at,
            updated_at: row.updated_at,
            categories: row.category_id && row.categoryName ? [
                {
                    id: row.category_id,
                    name: row.categoryName,
                    is_active: true, // Assume active since it's joined
                    created_at: row.created_at, // Use product's created_at as fallback
                    updated_at: row.updated_at, // Use product's updated_at as fallback
                }
            ] : [],
            images: images,
        };
    }

    /**
     * Sanitize a column name to prevent SQL injection
     * Only allows alphanumeric characters and underscores
     */
    private sanitizeColumn(column: string): string {
        // White list of allowed columns
        const allowedColumns = [
            'id', 'name', 'price', 'sku', 'featured', 'is_active',
            'created_at', 'updated_at', 'category_id'
        ];

        // Default to created_at if column is not in the whitelist
        return allowedColumns.includes(column) ? column : 'created_at';
    }
}