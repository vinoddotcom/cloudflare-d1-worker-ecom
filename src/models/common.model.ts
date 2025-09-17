/**
 * Types for Cloudflare D1 with Workers
 */
export interface D1Database {
    prepare: (query: string) => D1PreparedStatement;
    exec: (query: string) => Promise<D1ExecResult>;
    batch: (statements: D1PreparedStatement[]) => Promise<D1ExecResult[]>;
    dump: () => Promise<ArrayBuffer>;
}

export interface D1PreparedStatement {
    bind: (...values: any[]) => D1PreparedStatement;
    first: <T = unknown>(colName?: string) => Promise<T | null>;
    run: <T = unknown>() => Promise<D1Result<T>>;
    all: <T = unknown>() => Promise<D1Result<T>>;
    raw: <T = unknown>() => Promise<T[]>;
}

export interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta: object;
}

export interface D1ExecResult {
    count: number;
    duration: number;
    lastRowId: number | null;
    changes: number;
    error?: string;
}

/**
 * Request Environment Interface
 */
export interface Env {
    DB: D1Database;
    ENVIRONMENT: string;
    FIREBASE_PROJECT_ID: string;
    DELHIVERY_API_KEY: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    // Cloudflare Images configuration
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_IMAGES_HASH: string;
    // Add any other environment variables here
}

/**
 * Base model with common fields
 */
export interface BaseModel {
    id: string | number;
    created_at?: number | string; // Unix timestamp or ISO string
    updated_at?: number | string; // Unix timestamp or ISO string
}

/**
 * Error Response Interface
 */
export interface ErrorResponse {
    status: number;
    code: string;
    message: string;
    details?: any;
}

/**
 * Pagination Request Interface
 */
export interface PaginationRequest {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
}

/**
 * Pagination Response Interface
 */
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

/**
 * API Response Interface
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ErrorResponse;
}