import { IRequest } from 'itty-router';
import { ErrorResponse } from '../models/common.model';

/**
 * Custom Error class for API errors
 */
export class ApiError extends Error {
    status: number;
    code: string;
    details?: any;

    constructor(status: number, code: string, message: string, details?: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }

    /**
     * Convert to ErrorResponse object
     */
    toErrorResponse(): ErrorResponse {
        return {
            status: this.status,
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

/**
 * Error handler middleware
 * Catches errors thrown by route handlers and returns appropriate responses
 */
export const errorHandler = () => {
    return async (request: IRequest, error: unknown): Promise<Response> => {
        console.error('Error handling request:', error);

        // Handle ApiError instances
        if (error instanceof ApiError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error.toErrorResponse(),
                }),
                {
                    status: error.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Handle standard Error instances
        if (error instanceof Error) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        status: 500,
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'An unexpected error occurred',
                        details: error.message,
                    },
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Handle unknown error types
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    status: 500,
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred',
                },
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    };
};

/**
 * Not found handler
 * Returns a 404 response for routes that don't match any handlers
 */
export const notFoundHandler = () => {
    return (): Response => {
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    status: 404,
                    code: 'NOT_FOUND',
                    message: 'The requested resource was not found',
                },
            }),
            {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    };
};