import { IRequest } from 'itty-router';

/**
 * Log levels
 */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

/**
 * Logger interface
 */
export interface Logger {
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: any): void;
}

/**
 * Simple logger implementation
 */
export class SimpleLogger implements Logger {
    private readonly minLevel: LogLevel;

    constructor(minLevel: LogLevel = LogLevel.INFO) {
        this.minLevel = minLevel;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        return levels.indexOf(level) >= levels.indexOf(this.minLevel);
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;

        if (data) {
            let dataStr: string;
            if (data instanceof Error) {
                dataStr = `${data.name}: ${data.message}\n${data.stack || ''}`;
            } else {
                try {
                    dataStr = JSON.stringify(data);
                } catch (error) {
                    dataStr = String(data);
                }
            }
            logMessage += ` - ${dataStr}`;
        }

        return logMessage;
    }

    debug(message: string, data?: any): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message, data));
        }
    }

    info(message: string, data?: any): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage(LogLevel.INFO, message, data));
        }
    }

    warn(message: string, data?: any): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message, data));
        }
    }

    error(message: string, error?: any): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage(LogLevel.ERROR, message, error));
        }
    }
}

// Create singleton logger instance
export const logger = new SimpleLogger(
    process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
);

/**
 * Request logging middleware
 * Logs request details and timing information
 */
export const requestLogger = () => {
    return async (request: IRequest): Promise<Response | void> => {
        // Generate a unique request ID
        const requestId = crypto.randomUUID();

        // Capture request start time
        const startTime = Date.now();

        // Log request details
        // Convert headers to an object without using .entries()
        const headersObj: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headersObj[key] = value;
        });

        logger.info(`[${requestId}] Request started`, {
            method: request.method,
            url: request.url,
            headers: headersObj,
        });

        // Attach requestId to the request object for use in other middleware/handlers
        (request as any).requestId = requestId;

        // Continue to the next middleware or handler
        // In a more complete implementation, we would also log the response
        // by wrapping it, but that requires additional complexity
        const response = undefined; // Let the request continue

        // Log request completion time - note this doesn't capture the actual response
        // which would require additional handling
        logger.info(`[${requestId}] Request processing time: ${Date.now() - startTime}ms`);

        return response;
    };
};