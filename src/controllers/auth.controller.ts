import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { UserRepository } from '../data/repositories/user.repository';
import { Env } from '../models/common.model';
import { UserRole } from '../models/user.model';
import { successResponse, createdResponse } from '../utils/formatter';
import { badRequest, unauthorized, conflict } from '../utils/error';

/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
export class AuthController {
    private firebaseAuth: FirebaseAuthService;
    private userRepository: UserRepository;

    constructor(env: Env) {
        this.firebaseAuth = FirebaseAuthService.getInstance();
        this.firebaseAuth.initialize(env);
        this.userRepository = new UserRepository(env.DB);
    }

    /**
     * Register a new user
     * Note: In a Cloudflare Worker environment, we need to handle Firebase auth differently
     * This is a simplified example, in a real app Firebase auth would be handled client-side
     */
    async register(request: Request, env: Env): Promise<Response> {
        try {
            const data = await request.json();

            // Validate input
            const registerSchema = z.object({
                email: z.string().email('Invalid email address'),
                password: z.string().min(8, 'Password must be at least 8 characters'),
                first_name: z.string().min(1, 'First name is required'),
                last_name: z.string().min(1, 'Last name is required'),
                phone: z.string().optional(),
            });

            const validatedData = registerSchema.parse(data);

            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(validatedData.email);
            if (existingUser) {
                throw conflict('User with this email already exists');
            }

            // Create user in Firebase
            const firebaseUser = await this.firebaseAuth.createUser(
                validatedData.email,
                validatedData.password,
                `${validatedData.first_name} ${validatedData.last_name}`
            );

            // Set default role
            await this.firebaseAuth.setUserRole(firebaseUser.uid, 'customer');

            // Create user in our database
            const now = Date.now();
            await this.userRepository.createUser({
                id: firebaseUser.uid,
                email: validatedData.email,
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                phone: validatedData.phone,
                role: 'customer',
            });

            // Return success response (but not the user object for security)
            return createdResponse({
                message: 'User registered successfully',
                userId: firebaseUser.uid,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: {
                            status: 400,
                            code: 'VALIDATION_ERROR',
                            message: 'Validation failed',
                            details: error.errors,
                        },
                    }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Re-throw other errors to be caught by the global error handler
            throw error;
        }
    }

    /**
     * Login a user
     * Note: In a Cloudflare Worker environment, we need to handle Firebase auth differently
     * This is a simplified example, in a real app Firebase auth would be handled client-side
     */
    async login(request: Request): Promise<Response> {
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    status: 501,
                    code: 'NOT_IMPLEMENTED',
                    message: 'Firebase authentication should be handled client-side in a production app',
                },
            }),
            { status: 501, headers: { 'Content-Type': 'application/json' } }
        );
    }

    /**
     * Logout a user
     * Note: In a Cloudflare Worker environment, we need to handle Firebase auth differently
     * This is a simplified example, in a real app Firebase auth would be handled client-side
     */
    async logout(request: AuthRequest): Promise<Response> {
        if (!request.userId) {
            throw unauthorized();
        }

        return successResponse({
            message: 'Logout successful',
        });
    }
}