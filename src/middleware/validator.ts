import { IRequest } from 'itty-router';
import { z, ZodError, ZodSchema } from 'zod';
import { ApiError } from './error-handler';

/**
 * Request validation middleware
 * Validates request body, query parameters, or path parameters against a Zod schema
 * @param schema Zod schema to validate against
 * @param type Type of data to validate (body, query, or params)
 */
export const validateRequest = <T>(
    schema: ZodSchema<T>,
    type: 'body' | 'query' | 'params' = 'body'
) => {
    return async (request: IRequest): Promise<Response | void> => {
        try {
            let data: Record<string, unknown>;

            // Initialize data
            data = {};
            
            // Extract data based on type
            switch (type) {
                case 'body':
                    // Parse request body as JSON
                    if (request.method !== 'GET' && request.method !== 'HEAD') {
                        const contentType = request.headers.get('Content-Type');
                        if (contentType && contentType.includes('application/json')) {
                            try {
                                data = await request.json();
                            } catch (error) {
                                throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON in request body');
                            }
                        } else {
                            throw new ApiError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Request must have Content-Type: application/json');
                        }
                    }
                    break;

                case 'query': {
                    // Parse URL search params
                    const url = new URL(request.url);
                    url.searchParams.forEach((value, key) => {
                        // Handle array parameters (e.g., ?ids=1&ids=2&ids=3)
                        if (data[key]) {
                            if (Array.isArray(data[key])) {
                                data[key].push(value);
                            } else {
                                data[key] = [data[key], value];
                            }
                        } else {
                            data[key] = value;
                        }
                    });
                    break;
                }

                case 'params':
                    // Use params from request (added by itty-router)
                    data = request.params || {};
                    break;
            }

            // Validate data against schema
            const validatedData = schema.parse(data);

            // Attach validated data to request
            switch (type) {
                case 'body':
                    (request as IRequest & { validatedBody?: T }).validatedBody = validatedData;
                    break;
                case 'query':
                    (request as IRequest & { validatedQuery?: T }).validatedQuery = validatedData;
                    break;
                case 'params':
                    (request as IRequest & { validatedParams?: T }).validatedParams = validatedData;
                    break;
            }

            // Continue to the next middleware or handler
            return;
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message,
                }));

                return new Response(
                    JSON.stringify({
                        success: false,
                        error: {
                            status: 400,
                            code: 'VALIDATION_ERROR',
                            message: 'Request validation failed',
                            details: formattedErrors,
                        },
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }

            // Re-throw other errors to be handled by error middleware
            throw error;
        }
    };
};

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
    // Pagination schema for list endpoints
    pagination: z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20),
        sort_by: z.string().optional(),
        sort_direction: z.enum(['asc', 'desc']).optional().default('asc'),
    }),

    // ID parameter schema for retrieving single items
    id: z.object({
        id: z.string().or(z.coerce.number().int().positive()),
    }),
};