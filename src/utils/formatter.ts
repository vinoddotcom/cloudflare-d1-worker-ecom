/**
 * Response formatting utilities
 */
import { ApiResponse, PaginatedResponse } from '../models/common.model';
import { HttpStatus } from './error';

/**
 * Create a success response
 * @param data Response data
 * @param status HTTP status code (default: 200)
 * @returns Formatted API response
 */
export function successResponse<T>(data: T, status: number = HttpStatus.OK): Response {
    const response: ApiResponse<T> = {
        success: true,
        data,
    };

    return new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Create a paginated success response
 * @param data Items array
 * @param total Total number of items
 * @param page Current page number
 * @param limit Items per page
 * @returns Formatted paginated API response
 */
export function paginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
): Response {
    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<PaginatedResponse<T>> = {
        success: true,
        data: {
            data,
            meta: {
                current_page: page,
                per_page: limit,
                total,
                total_pages: totalPages,
            },
        },
    };

    return new Response(JSON.stringify(response), {
        status: HttpStatus.OK,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Create a created response (201)
 * @param data Response data
 * @returns Formatted API response
 */
export function createdResponse<T>(data: T): Response {
    return successResponse(data, HttpStatus.CREATED);
}

/**
 * Create a no content response (204)
 * @returns Empty response with 204 status
 */
export function noContentResponse(): Response {
    return new Response(null, {
        status: HttpStatus.NO_CONTENT,
    });
}

/**
 * Extract pagination parameters from request URL
 * @param url Request URL
 * @returns Pagination parameters object
 */
export function extractPaginationParams(url: string): {
    page: number;
    limit: number;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
} {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const page = parseInt(params.get('page') || '1', 10);
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);
    const sort_by = params.get('sort_by') || undefined;
    const sort_direction = params.get('sort_direction') as 'asc' | 'desc' | undefined;

    return {
        page: isNaN(page) || page < 1 ? 1 : page,
        limit: isNaN(limit) || limit < 1 ? 20 : limit,
        sort_by,
        sort_direction: sort_direction === 'desc' ? 'desc' : 'asc',
    };
}