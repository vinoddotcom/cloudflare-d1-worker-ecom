import { BaseRepository } from './base.repository';
import { User, UserCreateInput, UserUpdateInput } from '../../models/user.model';
import { D1Database } from '../../models/common.model';

/**
 * User Repository for managing user data
 */
export class UserRepository extends BaseRepository<User> {
    constructor(db: D1Database) {
        super(db, 'users');
    }

    /**
     * Find a user by email
     * @param email User email
     * @returns Promise with user or null
     */
    async findByEmail(email: string): Promise<User | null> {
        return await this.db
            .prepare('SELECT * FROM users WHERE email = ?')
            .bind(email)
            .first<User>();
    }

    /**
     * Create a new user
     * @param userData User data
     * @returns Promise with created user ID
     */
    async createUser(userData: UserCreateInput): Promise<string> {
        const now = Date.now();

        const result = await this.db
            .prepare(
                `INSERT INTO users (id, email, first_name, last_name, phone, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
                userData.id,
                userData.email,
                userData.first_name,
                userData.last_name,
                userData.phone || null,
                userData.role || 'customer',
                now,
                now
            )
            .run();

        if (!result.success) {
            throw new Error(`Failed to create user: ${result.error}`);
        }

        return userData.id;
    }

    /**
     * Update user data
     * @param id User ID
     * @param userData Data to update
     * @returns Promise with success status
     */
    async updateUser(id: string, userData: UserUpdateInput): Promise<boolean> {
        // Prepare update fields
        const updates: Record<string, any> = {
            ...userData,
            updated_at: Date.now()
        };

        const fields = Object.keys(updates);
        const sets = fields.map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        const result = await this.db
            .prepare(
                `UPDATE users
         SET ${sets}
         WHERE id = ?`
            )
            .bind(...values)
            .run();

        return result.success;
    }
}