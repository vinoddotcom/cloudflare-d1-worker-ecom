import { IRequest } from 'itty-router';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { Env } from '../models/common.model';
import { UserRole } from '../models/user.model';

/**
 * Extended Request Interface with auth information
 */
export interface AuthRequest extends IRequest {
    userId?: string;
    userRole?: UserRole;
    userEmail?: string;
}

/**
 * Authentication middleware
 * Verifies the Firebase ID token in the request headers
 * and adds the user information to the request object
 */
export const authenticate = (env: Env) => {
    return async (request: IRequest): Promise<Response | undefined> => {
        const authRequest = request as AuthRequest;

        try {
            // Get the Authorization header
            const authHeader = request.headers.get('Authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: {
                            status: 401,
                            code: 'UNAUTHORIZED',
                            message: 'Authentication required'
                        }
                    }),
                    {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            // Extract the token
            const token = authHeader.split('Bearer ')[1];

            // Initialize Firebase Auth service if needed
            const firebaseAuth = FirebaseAuthService.getInstance();
            firebaseAuth.initialize(env);

            // Verify the token
            const decodedToken = await firebaseAuth.verifyIdToken(token);

            // Add user information to the request
            authRequest.userId = decodedToken.uid;
            authRequest.userEmail = decodedToken.email;
            authRequest.userRole = firebaseAuth.getUserRole(decodedToken);

            // Continue to the next middleware or handler
            return;
        } catch (error) {
            console.error('Authentication error:', error);

            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        status: 401,
                        code: 'UNAUTHORIZED',
                        message: 'Invalid or expired authentication token'
                    }
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    };
};

/**
 * Authorization middleware
 * Checks if the authenticated user has the required role
 * @param allowedRoles Array of roles that are allowed to access the resource
 */
export const authorize = (allowedRoles: UserRole[]) => {
    return (request: IRequest): Response | undefined => {
        const authRequest = request as AuthRequest;

        // Check if the user is authenticated
        if (!authRequest.userId || !authRequest.userRole) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        status: 401,
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Check if the user has the required role
        const hasAllowedRole = allowedRoles.some(role => role === authRequest.userRole);
        
        if (!hasAllowedRole) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        status: 403,
                        code: 'FORBIDDEN',
                        message: 'You do not have permission to access this resource'
                    }
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Continue to the next middleware or handler
        return;
    };
};