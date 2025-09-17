declare module 'itty-router' {
    export interface IRequest extends Request {
        params?: Record<string, string>;
        query?: Record<string, string>;
        [key: string]: any;
    }

    export interface IRouterRequest extends Request {
        route?: string;
    }

    export type RouteHandler<TRequest = IRouterRequest> = (
        request: TRequest,
        ...args: any[]
    ) => any;

    export interface RouterOptions {
        base?: string;
    }

    export type Router<TRequest = IRouterRequest> = {
        all: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        delete: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        get: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        options: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        patch: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        post: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        put: (route: string, ...handlers: RouteHandler<TRequest>[]) => Router<TRequest>;
        handle: (request: Request, ...args: any[]) => Promise<any>;
        routes: () => RouteHandler[];
    };

    export function Router<TRequest = IRouterRequest>(
        options?: RouterOptions
    ): Router<TRequest>;
}