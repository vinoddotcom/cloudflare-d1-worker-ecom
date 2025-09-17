import { Env } from './models/common.model';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { setupApiRoutes } from './router';

/**
 * Worker fetch handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
        const router = setupApiRoutes(env);

        // Add the catch-all not found handler
        router.all('*', notFoundHandler());

        try {
            // Handle the request with the router
            const response = await router.handle(request, env, ctx);
            return response;
        } catch (error) {
            // Handle errors
            return errorHandler()(request, error);
        }
    },
};