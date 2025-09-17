/**
 * Error utilities
 */
import { ApiError } from '../middleware/error-handler';

// HTTP Status code constants
export const HttpStatus = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
};

// Error code constants
export const ErrorCodes = {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};

/**
 * Create a bad request error (400)
 * @param message Error message
 * @param details Additional error details
 * @returns ApiError
 */
export function badRequest(message: string, details?: any): ApiError {
    return new ApiError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
        message,
        details
    );
}

/**
 * Create an unauthorized error (401)
 * @param message Error message
 * @returns ApiError
 */
export function unauthorized(message: string = 'Authentication required'): ApiError {
    return new ApiError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        message
    );
}

/**
 * Create a forbidden error (403)
 * @param message Error message
 * @returns ApiError
 */
export function forbidden(message: string = 'Permission denied'): ApiError {
    return new ApiError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        message
    );
}

/**
 * Create a not found error (404)
 * @param resource Resource type (e.g., 'User', 'Product')
 * @param id Resource ID
 * @returns ApiError
 */
export function notFound(resource: string, id?: string | number): ApiError {
    const message = id
        ? `${resource} with ID ${id} not found`
        : `${resource} not found`;

    return new ApiError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        message
    );
}

/**
 * Create a conflict error (409)
 * @param message Error message
 * @param details Additional error details
 * @returns ApiError
 */
export function conflict(message: string, details?: any): ApiError {
    return new ApiError(
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
        message,
        details
    );
}

/**
 * Create a validation error (422)
 * @param message Error message
 * @param details Validation error details
 * @returns ApiError
 */
export function validationError(message: string, details: any): ApiError {
    return new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCodes.VALIDATION_ERROR,
        message,
        details
    );
}

/**
 * Create an internal server error (500)
 * @param message Error message
 * @param details Additional error details (for logging, not exposed)
 * @returns ApiError
 */
export function serverError(message: string = 'Internal server error', details?: any): ApiError {
    // Log the detailed error but don't expose it in the response
    console.error('Internal Server Error:', details);

    return new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        message
    );
}