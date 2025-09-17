import { BaseRepository } from './base.repository';
import { Env, D1Database } from '../../models/common.model';

/**
 * Interface for Product Variant
 */
export interface ProductVariant {
    id: number;
    product_id: number;
    sku: string;
    name: string;
    price: number;
    compare_at_price?: number;
    is_active: number;
    created_at: number;
    updated_at: number;
}

/**
 * Interface for Product Variant Attribute
 */
export interface ProductVariantAttribute {
    variant_id: number;
    attribute_value_id: number;
    attribute_id: number;
    attribute_name: string;
    value: string;
}

/**
 * Repository for product variant operations
 */
export class ProductVariantRepository extends BaseRepository<ProductVariant> {
    constructor(env: Env) {
        super(env.DB, 'product_variants');
    }

    /**
     * Find all variants for a specific product
     * @param productId Product ID
     * @returns List of product variants
     */
    async findVariantsByProductId(productId: number): Promise<ProductVariant[]> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_variants
                WHERE product_id = ?
                ORDER BY name ASC
            `).bind(productId).all<ProductVariant>();

            return result.results || [];
        } catch (error) {
            console.error(`Error finding variants for product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Find a product variant by ID
     * @param id Variant ID
     * @returns Product variant or null if not found
     */
    async findVariantById(id: number): Promise<ProductVariant | null> {
        try {
            return await this.db.prepare(`
                SELECT * FROM product_variants
                WHERE id = ?
            `).bind(id).first<ProductVariant>();
        } catch (error) {
            console.error(`Error finding variant with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Find a product variant by SKU
     * @param sku Variant SKU
     * @returns Product variant or null if not found
     */
    async findVariantBySku(sku: string): Promise<ProductVariant | null> {
        try {
            return await this.db.prepare(`
                SELECT * FROM product_variants
                WHERE sku = ?
            `).bind(sku).first<ProductVariant>();
        } catch (error) {
            console.error(`Error finding variant with SKU ${sku}:`, error);
            throw error;
        }
    }

    /**
     * Find attributes for a specific variant
     * @param variantId Variant ID
     * @returns List of variant attributes
     */
    async findVariantAttributes(variantId: number): Promise<ProductVariantAttribute[]> {
        try {
            const result = await this.db.prepare(`
                SELECT 
                    pva.variant_id,
                    pva.attribute_value_id,
                    pav.attribute_id,
                    pa.name as attribute_name,
                    pav.value
                FROM product_variant_attributes pva
                JOIN product_attribute_values pav ON pva.attribute_value_id = pav.id
                JOIN product_attributes pa ON pav.attribute_id = pa.id
                WHERE pva.variant_id = ?
                ORDER BY pa.name, pav.value
            `).bind(variantId).all<ProductVariantAttribute>();

            return result.results || [];
        } catch (error) {
            console.error(`Error finding attributes for variant ${variantId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new product variant
     * @param variant Variant data
     * @returns ID of created variant
     */
    async createVariant(variant: Omit<ProductVariant, 'id'>): Promise<number> {
        try {
            const result = await this.db.prepare(`
                INSERT INTO product_variants (
                    product_id, sku, name, price, compare_at_price, 
                    is_active, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `).bind(
                variant.product_id,
                variant.sku,
                variant.name,
                variant.price,
                variant.compare_at_price || null,
                variant.is_active,
                variant.created_at,
                variant.updated_at
            ).first<{ id: number }>();

            if (!result || !result.id) {
                throw new Error('Failed to create product variant');
            }

            return result.id;
        } catch (error) {
            console.error('Error creating product variant:', error);
            throw error;
        }
    }

    /**
     * Update a product variant
     * @param id Variant ID
     * @param data Data to update
     * @returns True if update was successful
     */
    async updateVariant(id: number, data: Partial<ProductVariant>): Promise<boolean> {
        try {
            const fields = Object.keys(data);
            const values = Object.values(data);

            const setClause = fields.map(field => `${field} = ?`).join(', ');

            const result = await this.db.prepare(`
                UPDATE product_variants
                SET ${setClause}
                WHERE id = ?
            `).bind(...values, id).run();

            return result.success;
        } catch (error) {
            console.error(`Error updating variant with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a product variant
     * @param id Variant ID
     * @returns True if deletion was successful
     */
    async deleteVariant(id: number): Promise<boolean> {
        try {
            const result = await this.db.prepare(`
                DELETE FROM product_variants
                WHERE id = ?
            `).bind(id).run();

            return result.success;
        } catch (error) {
            console.error(`Error deleting variant with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Add an attribute to a variant
     * @param variantId Variant ID
     * @param attributeValueId Attribute value ID
     * @returns True if addition was successful
     */
    async addVariantAttribute(variantId: number, attributeValueId: number): Promise<boolean> {
        try {
            const now = Date.now();

            const result = await this.db.prepare(`
                INSERT OR IGNORE INTO product_variant_attributes (
                    variant_id, attribute_value_id, created_at
                )
                VALUES (?, ?, ?)
            `).bind(variantId, attributeValueId, now).run();

            return result.success;
        } catch (error) {
            console.error(`Error adding attribute to variant ${variantId}:`, error);
            throw error;
        }
    }

    /**
     * Remove an attribute from a variant
     * @param variantId Variant ID
     * @param attributeValueId Attribute value ID
     * @returns True if removal was successful
     */
    async removeVariantAttribute(variantId: number, attributeValueId: number): Promise<boolean> {
        try {
            const result = await this.db.prepare(`
                DELETE FROM product_variant_attributes
                WHERE variant_id = ? AND attribute_value_id = ?
            `).bind(variantId, attributeValueId).run();

            return result.success;
        } catch (error) {
            console.error(`Error removing attribute from variant ${variantId}:`, error);
            throw error;
        }
    }
}