import { BaseRepository } from './base.repository';
import { Env } from '../../models/common.model';
import { ProductAttribute, ProductAttributeValue } from '../../models/product.model';

/**
 * Interface for database representation of a Product Attribute
 */
interface DBProductAttribute {
    id: number;
    name: string;
    created_at: number;
    updated_at: number;
}

/**
 * Interface for database representation of a Product Attribute Value
 */
interface DBProductAttributeValue {
    id: number;
    attribute_id: number;
    value: string;
    created_at: number;
    updated_at: number;
}

/**
 * Repository for product attribute operations
 */
export class ProductAttributeRepository extends BaseRepository<ProductAttribute> {
    constructor(env: Env) {
        super(env.DB, 'product_attributes');
    }

    /**
     * Find all product attributes
     * @returns List of all product attributes
     */
    async findAllAttributes(): Promise<ProductAttribute[]> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_attributes
                ORDER BY name ASC
            `).all<DBProductAttribute>();

            return (result.results || []).map(this.mapDBAttributeToAttribute);
        } catch (error) {
            console.error('Error finding all attributes:', error);
            throw error;
        }
    }

    /**
     * Find a product attribute by ID
     * @param id Attribute ID
     * @returns Product attribute or null if not found
     */
    override async findById(id: string | number): Promise<ProductAttribute | null> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_attributes
                WHERE id = ?
            `).bind(id).first<DBProductAttribute>();

            if (!result) {
                return null;
            }

            // Get attribute values
            const values = await this.findAttributeValues(Number(id));

            return {
                ...this.mapDBAttributeToAttribute(result),
                values
            };
        } catch (error) {
            console.error(`Error finding attribute with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Find a product attribute by name
     * @param name Attribute name
     * @returns Product attribute or null if not found
     */
    async findAttributeByName(name: string): Promise<ProductAttribute | null> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_attributes
                WHERE name = ?
            `).bind(name).first<DBProductAttribute>();

            return result ? this.mapDBAttributeToAttribute(result) : null;
        } catch (error) {
            console.error(`Error finding attribute with name ${name}:`, error);
            throw error;
        }
    }

    /**
     * Find a product attribute by ID
     * @param id Attribute ID
     * @returns Product attribute or null if not found
     * This method is an alias of findById to maintain compatibility with existing code
     */
    async findAttributeById(id: number): Promise<ProductAttribute | null> {
        return this.findById(id);
    }

    /**
     * Find attribute values for a specific attribute
     * @param attributeId Attribute ID
     * @returns List of attribute values
     */
    async findAttributeValues(attributeId: number): Promise<ProductAttributeValue[]> {
        try {
            const result = await this.db.prepare(`
                SELECT * FROM product_attribute_values
                WHERE attribute_id = ?
                ORDER BY value ASC
            `).bind(attributeId).all<DBProductAttributeValue>();

            return (result.results || []).map(this.mapDBAttributeValueToAttributeValue);
        } catch (error) {
            console.error(`Error finding attribute values for attribute ${attributeId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new product attribute
     * @param name Attribute name
     * @returns ID of created attribute
     */
    override async create(data: Omit<ProductAttribute, 'id'>): Promise<number> {
        try {
            const now = Date.now();

            const result = await this.db.prepare(`
                INSERT INTO product_attributes (name, created_at, updated_at)
                VALUES (?, ?, ?)
                RETURNING id
            `).bind(data.name, now, now).first<{ id: number }>();

            if (!result || !result.id) {
                throw new Error('Failed to create product attribute');
            }

            return result.id;
        } catch (error) {
            console.error(`Error creating attribute with name ${data.name}:`, error);
            throw error;
        }
    }

    /**
     * Create a new product attribute (alias method for backward compatibility)
     * @param name Attribute name
     * @returns ID of created attribute
     */
    async createAttribute(name: string): Promise<number> {
        return this.create({ name, created_at: Date.now() });
    }    /**
     * Create a new attribute value
     * @param attributeId Attribute ID
     * @param value Value text
     * @returns ID of created value
     */
    async createAttributeValue(attributeId: number, value: string): Promise<number> {
        try {
            const now = Date.now();

            const result = await this.db.prepare(`
                INSERT INTO product_attribute_values (attribute_id, value, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                RETURNING id
            `).bind(attributeId, value, now, now).first<{ id: number }>();

            if (!result || !result.id) {
                throw new Error('Failed to create attribute value');
            }

            return result.id;
        } catch (error) {
            console.error(`Error creating attribute value for attribute ${attributeId}:`, error);
            throw error;
        }
    }

    /**
     * Update a product attribute
     * @param id Attribute ID
     * @param data Data to update
     * @returns True if update was successful
     */
    override async update(id: string | number, data: Partial<ProductAttribute>): Promise<boolean> {
        try {
            const now = Date.now();
            const query = `
                UPDATE product_attributes
                SET name = ?, updated_at = ?
                WHERE id = ?
            `;

            const result = await this.db.prepare(query)
                .bind(data.name, now, id)
                .run();

            return result.success;
        } catch (error) {
            console.error(`Error updating attribute with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update a product attribute (alias method for backward compatibility)
     * @param id Attribute ID
     * @param name New attribute name
     * @returns True if update was successful
     */
    async updateAttribute(id: number, name: string): Promise<boolean> {
        return this.update(id, { name });
    }    /**
     * Delete a product attribute
     * @param id Attribute ID
     * @returns True if deletion was successful
     */
    override async delete(id: string | number): Promise<boolean> {
        try {
            const result = await this.db.prepare(`
                DELETE FROM product_attributes
                WHERE id = ?
            `).bind(id).run();

            return result.success;
        } catch (error) {
            console.error(`Error deleting attribute with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a product attribute (alias method for backward compatibility)
     * @param id Attribute ID
     * @returns True if deletion was successful
     */
    async deleteAttribute(id: number): Promise<boolean> {
        return this.delete(id);
    }

    /**
     * Delete an attribute value
     * @param id Value ID
     * @returns True if deletion was successful
     */
    async deleteAttributeValue(id: number): Promise<boolean> {
        try {
            const result = await this.db.prepare(`
                DELETE FROM product_attribute_values
                WHERE id = ?
            `).bind(id).run();

            return result.success;
        } catch (error) {
            console.error(`Error deleting attribute value with ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Map a database attribute to a model attribute
     * @param dbAttribute Database attribute
     * @returns Model attribute
     */
    private mapDBAttributeToAttribute(dbAttribute: DBProductAttribute): ProductAttribute {
        return {
            id: dbAttribute.id,
            name: dbAttribute.name,
            created_at: dbAttribute.created_at,
            updated_at: dbAttribute.updated_at
        };
    }

    /**
     * Map a database attribute value to a model attribute value
     * @param dbAttributeValue Database attribute value
     * @returns Model attribute value
     */
    private mapDBAttributeValueToAttributeValue(dbAttributeValue: DBProductAttributeValue): ProductAttributeValue {
        return {
            id: dbAttributeValue.id,
            attribute_id: dbAttributeValue.attribute_id,
            value: dbAttributeValue.value,
            created_at: dbAttributeValue.created_at,
            updated_at: dbAttributeValue.updated_at
        };
    }
}