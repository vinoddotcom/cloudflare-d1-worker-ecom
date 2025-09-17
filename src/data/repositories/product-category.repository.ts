import { BaseRepository } from './base.repository';
import { Env } from '../../models/common.model';
import { ProductCategory } from '../../models/product.model';

/**
 * Interface for the database representation of product category
 */
interface DBProductCategory {
    id: number;
    name: string;
    description: string | null;
    parent_id: number | null;
    image_url: string | null;
    is_active: number;
    created_at: number;
    updated_at: number;
}

/**
 * Repository for product category operations
 */
export class ProductCategoryRepository extends BaseRepository<ProductCategory> {
    constructor(env: Env) {
        super(env.DB, 'product_categories');
    }

    /**
     * Find all product categories
     * @returns List of all product categories
     */
    async findAllCategories(): Promise<ProductCategory[]> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_categories
                ORDER BY name ASC
            `).all<DBProductCategory>();

            return (result.results || []).map(this.mapDBCategoryToCategory);
        } catch (error) {
            console.error('Error finding all categories:', error);
            throw error;
        }
    }

    /**
     * Find a product category by ID
     * @param id Category ID
     * @returns Product category or null if not found
     */
    override async findById(id: string | number): Promise<ProductCategory | null> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_categories
                WHERE id = ?
            `).bind(id).first<DBProductCategory>();

            return result ? this.mapDBCategoryToCategory(result) : null;
        } catch (error) {
            console.error(`Error finding category with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Find a product category by ID (alias for backward compatibility)
     * @param id Category ID
     * @returns Product category or null if not found
     */
    async findCategoryById(id: number): Promise<ProductCategory | null> {
        return this.findById(id);
    }

    /**
     * Find a product category by name
     * @param name Category name
     * @returns Product category or null if not found
     */
    async findCategoryByName(name: string): Promise<ProductCategory | null> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_categories
                WHERE name = ?
            `).bind(name).first<DBProductCategory>();

            return result ? this.mapDBCategoryToCategory(result) : null;
        } catch (error) {
            console.error(`Error finding category with name ${name}:`, error);
            throw error;
        }
    }

    /**
     * Find child categories for a parent category
     * @param parentId Parent category ID
     * @returns List of child categories
     */
    async findChildCategories(parentId: number): Promise<ProductCategory[]> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_categories
                WHERE parent_id = ?
                ORDER BY name ASC
            `).bind(parentId).all<DBProductCategory>();

            return (result.results || []).map(this.mapDBCategoryToCategory);
        } catch (error) {
            console.error(`Error finding child categories for parent ${parentId}:`, error);
            throw error;
        }
    }

    /**
     * Find products that belong to a category
     * @param categoryId Category ID
     * @returns List of product IDs in this category
     */
    async findProductsByCategoryId(categoryId: number): Promise<number[]> {
        try {
            const result = await this.db.prepare(`
                SELECT id FROM products
                WHERE category_id = ?
            `).bind(categoryId).all<{ id: number }>();

            return (result.results || []).map(row => row.id);
        } catch (error) {
            console.error(`Error finding products for category ${categoryId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new product category
     * @param category Category data
     * @returns ID of created category
     */
    override async create(data: Omit<ProductCategory, 'id'>): Promise<number> {
        try {
            const now = Date.now();

            const result = await this.db.prepare(`
                INSERT INTO product_categories (
                    name, description, parent_id, image_url, 
                    is_active, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `).bind(
                data.name,
                data.description || null,
                data.parent_id || null,
                data.image_url || null,
                data.is_active ? 1 : 0,
                now,
                now
            ).first<{ id: number }>();

            if (!result || !result.id) {
                throw new Error('Failed to create product category');
            }

            return result.id;
        } catch (error) {
            console.error(`Error creating category ${data.name}:`, error);
            throw error;
        }
    }

    /**
     * Create a new product category (alias for backward compatibility)
     * @param category Category data
     * @returns ID of created category
     */
    async createCategory(category: ProductCategory): Promise<number> {
        return this.create(category);
    }

    /**
     * Update a product category
     * @param id Category ID
     * @param data Data to update
     * @returns True if update was successful
     */
    override async update(id: string | number, data: Partial<ProductCategory>): Promise<boolean> {
        try {
            const updateFields: string[] = [];
            const params: any[] = [];
            const now = Date.now();

            if (data.name !== undefined) {
                updateFields.push('name = ?');
                params.push(data.name);
            }

            if (data.description !== undefined) {
                updateFields.push('description = ?');
                params.push(data.description);
            }

            if (data.parent_id !== undefined) {
                updateFields.push('parent_id = ?');
                params.push(data.parent_id);
            }

            if (data.image_url !== undefined) {
                updateFields.push('image_url = ?');
                params.push(data.image_url);
            }

            if (data.is_active !== undefined) {
                updateFields.push('is_active = ?');
                params.push(data.is_active ? 1 : 0);
            }

            // Always update the updated_at field
            updateFields.push('updated_at = ?');
            params.push(now);

            // Add the ID parameter
            params.push(id);

            const query = `
                UPDATE product_categories
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;

            const result = await this.db.prepare(query).bind(...params).run();
            return result.success;
        } catch (error) {
            console.error(`Error updating category with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update a category (alias for backward compatibility)
     * @param category Category data with ID
     * @returns true if successful
     */
    async updateCategory(category: ProductCategory): Promise<boolean> {
        if (!category.id) {
            throw new Error('Category ID is required for update');
        }
        return this.update(category.id, category);
    }

    /**
     * Delete a product category
     * @param id Category ID
     * @returns True if deletion was successful
     */
    override async delete(id: string | number): Promise<boolean> {
        try {
            const result = await this.db.prepare(`
                DELETE FROM product_categories
                WHERE id = ?
            `).bind(id).run();

            return result.success;
        } catch (error) {
            console.error(`Error deleting category with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a category by ID (alias for backward compatibility)
     * @param id Category ID
     * @returns True if deletion was successful
     */
    async deleteCategory(id: number): Promise<boolean> {
        return this.delete(id);
    }

    /**
     * Map a database category to a model category
     * @param dbCategory Database category
     * @returns Model category
     */
    private mapDBCategoryToCategory(dbCategory: DBProductCategory): ProductCategory {
        return {
            id: dbCategory.id,
            name: dbCategory.name,
            description: dbCategory.description || undefined,
            parent_id: dbCategory.parent_id || undefined,
            image_url: dbCategory.image_url || undefined,
            is_active: Boolean(dbCategory.is_active),
            created_at: dbCategory.created_at,
            updated_at: dbCategory.updated_at
        };
    }
}