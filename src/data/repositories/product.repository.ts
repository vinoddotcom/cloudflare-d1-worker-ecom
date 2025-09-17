import { Env, D1Database } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Product, ProductCategory } from '../../models/product.model';

/**
 * Repository for product-related database operations
 */
export class ProductRepository extends BaseRepository<Product> {
    constructor(env: Env) {
        super(env.DB, 'products');
    }

    /**
     * Find all products with pagination, filtering, and sorting
     */
    async findAll(options: {
        page?: number;
        limit?: number;
        category?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
        const {
            page = 1,
            limit = 10,
            category,
            search,
            sortBy = 'createdAt',
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
        p.sku, 
        p.stock_quantity as stockQuantity,
        p.images,
        p.attributes,
        p.is_active as isActive,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        c.id as categoryId,
        c.name as categoryName
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.is_active = 1
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
        const params = [];
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
      WHERE p.is_active = 1
    `;

        if (category) {
            countQuery += ` AND c.id = ?`;
        }

        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
        }

        // Build the count parameters
        const countParams = [];
        if (category) countParams.push(category);
        if (search) {
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        try {
            // Execute the queries
            const productsResult = await this.db.prepare(query).bind(...params).all();
            const countResult = await this.db.prepare(countQuery).bind(...countParams).first();

            // Parse the results
            const products = productsResult.results.map((row: any) => {
                // Parse JSON fields
                const images = row.images ? JSON.parse(row.images) : [];
                const attributes = row.attributes ? JSON.parse(row.attributes) : {};

                return {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    price: row.price,
                    sku: row.sku,
                    stockQuantity: row.stockQuantity,
                    images,
                    attributes,
                    isActive: Boolean(row.isActive),
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                    category: {
                        id: row.categoryId,
                        name: row.categoryName,
                    },
                };
            });

            return {
                products,
                total: countResult.total,
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
    async findById(id: string): Promise<Product | null> {
        const query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.sku, 
        p.stock_quantity as stockQuantity,
        p.images,
        p.attributes,
        p.is_active as isActive,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        c.id as categoryId,
        c.name as categoryName
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_active = 1
    `;

        try {
            const result = await this.db.prepare(query).bind(id).first();

            if (!result) {
                return null;
            }

            // Parse JSON fields
            const images = result.images ? JSON.parse(result.images) : [];
            const attributes = result.attributes ? JSON.parse(result.attributes) : {};

            return {
                id: result.id,
                name: result.name,
                description: result.description,
                price: result.price,
                sku: result.sku,
                stockQuantity: result.stockQuantity,
                images,
                attributes,
                isActive: Boolean(result.isActive),
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                category: {
                    id: result.categoryId,
                    name: result.categoryName,
                },
            };
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
        created_at as createdAt,
        updated_at as updatedAt
      FROM product_categories
      ORDER BY name ASC
    `;

        try {
            const result = await this.db.prepare(query).all();

            return result.results.map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            }));
        } catch (error) {
            console.error('Error finding product categories:', error);
            throw new Error('Failed to fetch product categories');
        }
    }

    /**
     * Create a new product
     */
    async create(data: Partial<Product> & { createdBy: string }): Promise<Product> {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        const query = `
      INSERT INTO products (
        id, 
        name, 
        description, 
        price, 
        category_id,
        sku, 
        stock_quantity,
        images,
        attributes,
        is_active,
        created_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        // Serialize JSON fields
        const images = data.images ? JSON.stringify(data.images) : '[]';
        const attributes = data.attributes ? JSON.stringify(data.attributes) : '{}';

        try {
            await this.db.prepare(query).bind(
                id,
                data.name,
                data.description,
                data.price,
                data.category?.id,
                data.sku,
                data.stockQuantity,
                images,
                attributes,
                1, // isActive = true
                data.createdBy,
                now,
                now
            ).run();

            // Fetch the newly created product to return
            const newProduct = await this.findById(id);

            if (!newProduct) {
                throw new Error('Failed to create product');
            }

            return newProduct;
        } catch (error) {
            console.error('Error creating product:', error);
            throw new Error('Failed to create product');
        }
    }

    /**
     * Update an existing product
     */
    async update(id: string, data: Partial<Product> & { updatedBy: string }): Promise<Product> {
        // First, check if the product exists
        const existingProduct = await this.findById(id);

        if (!existingProduct) {
            throw new Error(`Product with ID ${id} not found`);
        }

        // Build the update query dynamically
        const updateFields = [];
        const params = [];

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

        if (data.category?.id !== undefined) {
            updateFields.push('category_id = ?');
            params.push(data.category.id);
        }

        if (data.sku !== undefined) {
            updateFields.push('sku = ?');
            params.push(data.sku);
        }

        if (data.stockQuantity !== undefined) {
            updateFields.push('stock_quantity = ?');
            params.push(data.stockQuantity);
        }

        if (data.images !== undefined) {
            updateFields.push('images = ?');
            params.push(JSON.stringify(data.images));
        }

        if (data.attributes !== undefined) {
            updateFields.push('attributes = ?');
            params.push(JSON.stringify(data.attributes));
        }

        if (data.isActive !== undefined) {
            updateFields.push('is_active = ?');
            params.push(data.isActive ? 1 : 0);
        }

        // Add common update fields
        updateFields.push('updated_by = ?');
        params.push(data.updatedBy);

        updateFields.push('updated_at = ?');
        const now = new Date().toISOString();
        params.push(now);

        // Add product ID to params
        params.push(id);

        const query = `
      UPDATE products
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

        try {
            await this.db.prepare(query).bind(...params).run();

            // Fetch the updated product to return
            const updatedProduct = await this.findById(id);

            if (!updatedProduct) {
                throw new Error('Failed to update product');
            }

            return updatedProduct;
        } catch (error) {
            console.error('Error updating product:', error);
            throw new Error(`Failed to update product with ID ${id}`);
        }
    }

    /**
     * Delete a product (soft delete)
     */
    async delete(id: string): Promise<void> {
        // Soft delete by setting is_active = 0
        const query = `
      UPDATE products
      SET is_active = 0, updated_at = ?
      WHERE id = ?
    `;

        const now = new Date().toISOString();

        try {
            await this.db.prepare(query).bind(now, id).run();
        } catch (error) {
            console.error('Error deleting product:', error);
            throw new Error(`Failed to delete product with ID ${id}`);
        }
    }

    /**
     * Sanitize a column name to prevent SQL injection
     * Only allows alphanumeric characters and underscores
     */
    private sanitizeColumn(column: string): string {
        // White list of allowed columns
        const allowedColumns = [
            'id', 'name', 'price', 'sku', 'stock_quantity',
            'created_at', 'updated_at', 'category_id'
        ];

        // Default to createdAt if column is not in the whitelist
        return allowedColumns.includes(column) ? column : 'created_at';
    }
}