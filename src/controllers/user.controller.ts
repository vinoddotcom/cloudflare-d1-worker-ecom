import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { UserRepository } from '../data/repositories/user.repository';
import { Env } from '../models/common.model';
import { User, UserRole, Address } from '../models/user.model';
import { successResponse, createdResponse, noContentResponse, paginatedResponse, extractPaginationParams } from '../utils/formatter';
import { notFound, unauthorized, forbidden, badRequest } from '../utils/error';
import { ValidationSchemas } from '../middleware/validator';

/**
 * User Controller
 * Handles user management API endpoints
 */
export class UserController {
    private firebaseAuth: FirebaseAuthService;
    private userRepository: UserRepository;

    constructor(env: Env) {
        this.firebaseAuth = FirebaseAuthService.getInstance();
        this.firebaseAuth.initialize(env);
        this.userRepository = new UserRepository(env.DB);
    }

    /**
     * Get current authenticated user
     */
    async getCurrentUser(request: AuthRequest): Promise<Response> {
        if (!request.userId) {
            throw unauthorized();
        }

        const user = await this.userRepository.findById(request.userId);
        if (!user) {
            throw notFound('User', request.userId);
        }

        return successResponse(user);
    }

    /**
     * Get all users (admin only)
     */
    async getAllUsers(request: AuthRequest): Promise<Response> {
        if (request.userRole !== 'admin') {
            throw forbidden();
        }

        const { page, limit, sort_by, sort_direction } = extractPaginationParams(request.url);
        const { data, total } = await this.userRepository.findAll(
            page,
            limit,
            sort_by || 'created_at',
            sort_direction || 'desc'
        );

        return paginatedResponse<User>(data, total, page, limit);
    }

    /**
     * Get user by ID
     */
    async getUserById(request: AuthRequest): Promise<Response> {
        const userId = request.params?.id;
        if (!userId) {
            throw badRequest('User ID is required');
        }

        // Only admins can view other users, users can only view themselves
        if (request.userRole !== 'admin' && request.userId !== userId) {
            throw forbidden();
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw notFound('User', userId);
        }

        return successResponse(user);
    }

    /**
     * Update user
     */
    async updateUser(request: AuthRequest): Promise<Response> {
        const userId = request.params?.id;
        if (!userId) {
            throw badRequest('User ID is required');
        }

        // Only admins can update other users, users can only update themselves
        if (request.userRole !== 'admin' && request.userId !== userId) {
            throw forbidden();
        }

        const userData = await request.json();

        // Validate input
        const updateUserSchema = z.object({
            first_name: z.string().min(1).optional(),
            last_name: z.string().min(1).optional(),
            phone: z.string().optional().nullable(),
            role: z.enum(['admin', 'manager', 'customer']).optional(),
        });

        const validatedData = updateUserSchema.parse(userData);

        // Only admins can update roles
        if (validatedData.role && request.userRole !== 'admin') {
            throw forbidden('Only administrators can update user roles');
        }

        // Check if user exists
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw notFound('User', userId);
        }

        // Update user in database
        const success = await this.userRepository.updateUser(userId, {
            ...validatedData,
            phone: validatedData.phone || undefined
        });
        if (!success) {
            throw new Error('Failed to update user');
        }

        // If role was updated, update Firebase custom claims
        if (validatedData.role && request.userRole === 'admin') {
            await this.firebaseAuth.setUserRole(userId, validatedData.role as UserRole);
        }

        // Return updated user
        const updatedUser = await this.userRepository.findById(userId);
        return successResponse(updatedUser);
    }

    /**
     * Delete user
     */
    async deleteUser(request: AuthRequest): Promise<Response> {
        const userId = request.params?.id;
        if (!userId) {
            throw badRequest('User ID is required');
        }

        // Only admins can delete other users, users can only delete themselves
        if (request.userRole !== 'admin' && request.userId !== userId) {
            throw forbidden();
        }

        // Check if user exists
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw notFound('User', userId);
        }

        // Delete user from database
        const success = await this.userRepository.delete(userId);
        if (!success) {
            throw new Error('Failed to delete user from database');
        }

        // Delete user from Firebase
        await this.firebaseAuth.deleteUser(userId);

        return noContentResponse();
    }
}