import { BaseRepository } from './base.repository';
import { Env, D1Database } from '../../models/common.model';

/**
 * Interface for Inventory items
 */
export interface Inventory {
    id?: number;
    product_variant_id: number;
    quantity: number;
    reserved_quantity: number;
    reorder_level: number;
    reorder_quantity: number;
    updated_at?: number;
}

/**
 * Interface for filtering inventory items
 */
export interface InventoryFilter {
    lowStock?: boolean;
    productId?: number;
    limit?: number;
    page?: number;
}

/**
 * Repository for inventory operations
 */
export class InventoryRepository extends BaseRepository<Inventory> {
    constructor(env: Env) {
        super(env.DB, 'inventory');
    }
    /**
     * Get all inventory items with optional filtering
     * @param filter Filter options
     * @returns Array of inventory items
     */
    async getAllInventory(filter?: InventoryFilter): Promise<any[]> {
        try {
            let query = `
                SELECT i.*, pv.sku, pv.name as variant_name, p.name as product_name, p.id as product_id
                FROM inventory i
                JOIN product_variants pv ON i.product_variant_id = pv.id
                JOIN products p ON pv.product_id = p.id
            `;

            const conditions: string[] = [];
            const params: any[] = [];

            // Add filters
            if (filter?.lowStock) {
                conditions.push('i.quantity <= i.reorder_level');
            }

            if (filter?.productId !== undefined) {
                conditions.push('p.id = ?');
                params.push(filter.productId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY i.quantity ASC';

            // Add pagination
            if (filter?.limit !== undefined && filter?.page !== undefined) {
                const offset = (filter.page - 1) * filter.limit;
                query += ' LIMIT ? OFFSET ?';
                params.push(filter.limit, offset);
            }

            const result = await this.db.prepare(query).bind(...params).all<any>();
            return result.results || [];
        } catch (error) {
            console.error('Error getting inventory:', error);
            throw error;
        }
    }

    /**
     * Get inventory count with optional filtering
     * @param filter Filter options
     * @returns Total count of inventory items matching filter
     */
    async getInventoryCount(filter?: Omit<InventoryFilter, 'limit' | 'page'>): Promise<number> {
        try {
            let query = `
                SELECT COUNT(*) as count
                FROM inventory i
                JOIN product_variants pv ON i.product_variant_id = pv.id
                JOIN products p ON pv.product_id = p.id
            `;

            const conditions: string[] = [];
            const params: any[] = [];

            // Add filters
            if (filter?.lowStock) {
                conditions.push('i.quantity <= i.reorder_level');
            }

            if (filter?.productId !== undefined) {
                conditions.push('p.id = ?');
                params.push(filter.productId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();
            return result?.count || 0;
        } catch (error) {
            console.error('Error getting inventory count:', error);
            throw error;
        }
    }

    /**
     * Get inventory for a specific product variant
     * @param variantId Product variant ID
     * @returns Inventory item or null if not found
     */
    async getInventoryByVariantId(variantId: number): Promise<Inventory | null> {
        try {
            const query = `
                SELECT *
                FROM inventory
                WHERE product_variant_id = ?
            `;

            return await this.db.prepare(query).bind(variantId).first<Inventory>();
        } catch (error) {
            console.error(`Error getting inventory for variant ${variantId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new inventory record
     * @param inventory Inventory data
     * @returns Created inventory ID
     */
    async createInventory(inventory: Inventory): Promise<number> {
        try {
            const now = Date.now();

            const query = `
                INSERT INTO inventory (
                    product_variant_id, 
                    quantity, 
                    reserved_quantity, 
                    reorder_level, 
                    reorder_quantity, 
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
            `;

            const result = await this.db.prepare(query).bind(
                inventory.product_variant_id,
                inventory.quantity,
                inventory.reserved_quantity,
                inventory.reorder_level,
                inventory.reorder_quantity,
                now
            ).first<{ id: number }>();

            if (!result || !result.id) {
                throw new Error('Failed to create inventory record');
            }

            return result.id;
        } catch (error) {
            console.error('Error creating inventory:', error);
            throw error;
        }
    }

    /**
     * Update an inventory record
     * @param variantId Product variant ID
     * @param data Inventory data to update
     * @returns True if update was successful
     */
    async updateInventory(variantId: number, data: Partial<Inventory>): Promise<boolean> {
        try {
            const now = Date.now();

            let query = 'UPDATE inventory SET updated_at = ?';
            const params: any[] = [now];

            if (data.quantity !== undefined) {
                query += ', quantity = ?';
                params.push(data.quantity);
            }

            if (data.reserved_quantity !== undefined) {
                query += ', reserved_quantity = ?';
                params.push(data.reserved_quantity);
            }

            if (data.reorder_level !== undefined) {
                query += ', reorder_level = ?';
                params.push(data.reorder_level);
            }

            if (data.reorder_quantity !== undefined) {
                query += ', reorder_quantity = ?';
                params.push(data.reorder_quantity);
            }

            query += ' WHERE product_variant_id = ?';
            params.push(variantId);

            const result = await this.db.prepare(query).bind(...params).run();

            return result.success;
        } catch (error) {
            console.error(`Error updating inventory for variant ${variantId}:`, error);
            throw error;
        }
    }
}