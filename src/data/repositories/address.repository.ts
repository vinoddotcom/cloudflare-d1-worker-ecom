import { D1Database } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Address } from '../../models/user.model';

/**
 * Repository for address-related database operations
 */
export class AddressRepository extends BaseRepository<Address> {
    constructor(db: D1Database) {
        super(db, 'addresses');
    }

    /**
     * Get all addresses for a user
     */
    async getByUserId(userId: string): Promise<Address[]> {
        const query = `SELECT * FROM ${this.tableName} WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`;
        const { results } = await this.db.prepare(query).bind(userId).all<Address>();
        return results || [];
    }

    /**
     * Get a specific address by ID and user ID
     */
    async getByIdAndUserId(id: number, userId: string): Promise<Address | null> {
        const query = `SELECT * FROM ${this.tableName} WHERE id = ? AND user_id = ?`;
        return await this.db.prepare(query).bind(id, userId).first<Address>();
    }

    /**
     * Create a new address
     * Override from BaseRepository to handle specific address fields
     */
    async create(address: Omit<Address, 'id'>): Promise<number> {
        const now = new Date().toISOString();

        const result = await this.db.prepare(`
            INSERT INTO ${this.tableName} (
                user_id, 
                address_type, 
                is_default, 
                name,
                phone,
                address_line1, 
                address_line2, 
                landmark,
                city, 
                state, 
                postal_code, 
                country, 
                created_at, 
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            address.user_id,
            address.address_type,
            address.is_default || false,
            address.name || null,
            address.phone || null,
            address.address_line1,
            address.address_line2 || null,
            address.landmark || null,
            address.city,
            address.state,
            address.postal_code,
            address.country,
            now,
            now
        ).run();

        if (!result.success) {
            throw new Error('Failed to create address');
        }

        // Get the ID of the newly created address
        const newAddress = await this.db.prepare(`
            SELECT id FROM ${this.tableName} WHERE rowid = last_insert_rowid()
        `).first<{ id: number }>();

        return newAddress?.id || 0;
    }

    /**
     * Update an existing address
     * This is an extension of the base method, not an override
     */
    async updateForUser(id: number, userId: string, data: Partial<Address>): Promise<boolean> {
        const updateFields: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            // Skip id and user_id as they shouldn't be updated
            if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
                updateFields.push(`${key} = ?`);
                values.push(value);
            }
        });

        // Add updated timestamp
        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());

        // Add where clause params
        values.push(id);
        values.push(userId);

        const query = `UPDATE ${this.tableName} SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
        const result = await this.db.prepare(query).bind(...values).run();

        return result.success;
    }

    /**
     * Delete an address for a specific user
     * This is an extension of the base method, not an override
     */
    async deleteForUser(id: number, userId: string): Promise<boolean> {
        const query = `DELETE FROM ${this.tableName} WHERE id = ? AND user_id = ?`;
        const result = await this.db.prepare(query).bind(id, userId).run();
        return result.success;
    }

    /**
     * Update default address status
     * Sets is_default = false for all other addresses of the same type
     */
    async updateDefaultStatus(userId: string, addressType: string): Promise<void> {
        const now = new Date().toISOString();
        let query: string;

        if (addressType === 'both') {
            // Update all default addresses
            query = `
                UPDATE ${this.tableName} SET is_default = false, updated_at = ? 
                WHERE user_id = ? AND is_default = true
            `;
            await this.db.prepare(query).bind(now, userId).run();
        } else {
            // Update only addresses of the same type or 'both' type
            query = `
                UPDATE ${this.tableName} SET is_default = false, updated_at = ? 
                WHERE user_id = ? AND is_default = true 
                AND (address_type = ? OR address_type = 'both')
            `;
            await this.db.prepare(query).bind(now, userId, addressType).run();
        }
    }

    /**
     * Set an address as default
     */
    async setDefault(id: number, userId: string): Promise<boolean> {
        const now = new Date().toISOString();
        const query = `UPDATE ${this.tableName} SET is_default = true, updated_at = ? WHERE id = ? AND user_id = ?`;
        const result = await this.db.prepare(query).bind(now, id, userId).run();
        return result.success;
    }

    /**
     * Get the default address of a specific type for a user
     */
    async getDefaultByType(userId: string, addressType: string): Promise<Address | null> {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE user_id = ? AND is_default = true AND (address_type = ? OR address_type = 'both') 
            ORDER BY updated_at DESC 
            LIMIT 1
        `;
        return await this.db.prepare(query).bind(userId, addressType).first<Address>();
    }

    /**
     * Get the most recent address of a specific type for a user
     * (used as fallback when no default address exists)
     */
    async getMostRecentByType(userId: string, addressType: string): Promise<Address | null> {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE user_id = ? AND (address_type = ? OR address_type = 'both') 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        return await this.db.prepare(query).bind(userId, addressType).first<Address>();
    }

    /**
     * Count addresses for a user
     */
    async countByUserId(userId: string): Promise<number> {
        const result = await this.db.prepare(`
            SELECT COUNT(*) as count FROM ${this.tableName} WHERE user_id = ?
        `).bind(userId).first<{ count: number }>();

        return result?.count || 0;
    }
}