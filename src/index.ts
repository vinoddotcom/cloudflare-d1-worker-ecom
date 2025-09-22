import { Env } from './models/common.model';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { setupApiRoutes } from './router';
import { Router } from 'itty-router';

// Cloudflare Workers ExecutionContext
interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
}

let router: Router<Request>;

/**
 * Worker fetch handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (!router) {
            router = setupApiRoutes(env);
            // Add the catch-all not found handler
            router.all('*', notFoundHandler());
        }

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