/**
 * Base Repository class for database operations
 */
import { D1Database, D1Result } from '../../models/common.model';

export abstract class BaseRepository<T> {
    protected db: D1Database;
    protected tableName: string;

    constructor(db: D1Database, tableName: string) {
        this.db = db;
        this.tableName = tableName;
    }

    /**
     * Find all records with optional pagination
     * @param page Page number (1-indexed)
     * @param limit Items per page
     * @param orderBy Column to order by
     * @param direction Sort direction (asc/desc)
     * @returns Promise with array of records and total count
     */
    async findAll(
        page: number = 1,
        limit: number = 20,
        orderBy: string = 'id',
        direction: 'asc' | 'desc' = 'asc'
    ): Promise<{ data: T[]; total: number }> {
        const offset = (page - 1) * limit;

        // Get total count
        const countResult = await this.db
            .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
            .first<{ count: number }>();

        const total = countResult?.count || 0;

        // Get paginated results
        const result = await this.db
            .prepare(
                `SELECT * FROM ${this.tableName} 
         ORDER BY ${orderBy} ${direction.toUpperCase()}
         LIMIT ? OFFSET ?`
            )
            .bind(limit, offset)
            .all<T>();

        return {
            data: result.results || [],
            total
        };
    }

    /**
     * Find a record by ID
     * @param id Record ID
     * @returns Promise with record or null
     */
    async findById(id: string | number): Promise<T | null> {
        const result = await this.db
            .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
            .bind(id)
            .first<T>();

        return result;
    }

    /**
     * Find records by a specific field value
     * @param field Field name
     * @param value Field value
     * @returns Promise with array of matching records
     */
    async findByField(field: string, value: any): Promise<T[]> {
        const result = await this.db
            .prepare(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`)
            .bind(value)
            .all<T>();

        return result.results || [];
    }

    /**
     * Create a new record
     * @param data Record data
     * @returns Promise with created record ID
     */
    async create(data: Omit<T, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(data);

        const result = await this.db
            .prepare(
                `INSERT INTO ${this.tableName} (${fields.join(', ')})
         VALUES (${placeholders})
         RETURNING id`
            )
            .bind(...values)
            .first<{ id: number }>();

        if (!result) {
            throw new Error(`Failed to create record: No ID returned`);
        }

        return result.id;
    }

    /**
     * Update a record
     * @param id Record ID
     * @param data Data to update
     * @returns Promise with success status
     */
    async update(id: string | number, data: Partial<T>): Promise<boolean> {
        const fields = Object.keys(data);
        const sets = fields.map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(data), id];

        const result = await this.db
            .prepare(
                `UPDATE ${this.tableName}
         SET ${sets}
         WHERE id = ?`
            )
            .bind(...values)
            .run();

        return result.success;
    }

    /**
     * Delete a record
     * @param id Record ID
     * @returns Promise with success status
     */
    async delete(id: string | number): Promise<boolean> {
        const result = await this.db
            .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
            .bind(id)
            .run();

        return result.success;
    }

    /**
     * Execute custom SQL query
     * @param sql SQL query with ? placeholders
     * @param params Query parameters
     * @returns Promise with query results
     */
    async query<R = any>(sql: string, ...params: any[]): Promise<D1Result<R>> {
        const result = await this.db
            .prepare(sql)
            .bind(...params)
            .all<R>();

        return result;
    }
}