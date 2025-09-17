/**
 * Create a standardized success response
 * @param data The data to be returned in the response
 * @param status The HTTP status code (default: 200)
 */
export function successResponse(data: any, status: number = 200): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data,
        }),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * Create a standardized error response
 * @param message The error message
 * @param status The HTTP status code (default: 400)
 * @param code An optional error code
 */
export function errorResponse(
    message: string,
    status: number = 400,
    code?: string
): Response {
    return new Response(
        JSON.stringify({
            success: false,
            error: {
                message,
                status,
                code: code || getErrorCodeFromStatus(status),
            },
        }),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * Get a standardized error code from an HTTP status code
 * @param status The HTTP status code
 */
function getErrorCodeFromStatus(status: number): string {
    switch (status) {
        case 400:
            return 'BAD_REQUEST';
        case 401:
            return 'UNAUTHORIZED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 422:
            return 'VALIDATION_ERROR';
        case 500:
            return 'INTERNAL_SERVER_ERROR';
        default:
            return `ERROR_${status}`;
    }
}