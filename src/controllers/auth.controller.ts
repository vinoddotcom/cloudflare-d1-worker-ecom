import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { UserRepository } from '../data/repositories/user.repository';
import { UserCreateInput, UserRole } from '../models/user.model';
import { successResponse, errorResponse } from '../utils/response';

interface TokenRequest {
    token: string;
}

/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
export class AuthController {
    private userRepository: UserRepository;

    constructor(env: Env) {
        this.userRepository = new UserRepository(env.DB);
    }

    async verifyToken(request: IRequest, env: Env): Promise<Response> {
        const data = await request.json() as TokenRequest;

        if (!data.token) {
            return errorResponse('Token is required', 400);
        }

        const firebaseAuthService = FirebaseAuthService.getInstance();
        firebaseAuthService.initialize(env);
        const decodedToken = await firebaseAuthService.verifyIdToken(data.token);
        
        // Find user by ID (which is Firebase UID)
        let user = await this.userRepository.findById(decodedToken.uid);

        if (!user) {
            // Create new user
            const newUser: UserCreateInput = {
                id: decodedToken.uid,
                email: decodedToken.email || '',
                first_name: decodedToken.name?.split(' ')[0] || '',
                last_name: decodedToken.name?.split(' ').slice(1).join(' ') || '',
                role: UserRole.CUSTOMER
            };
            
            // Use createUser method from UserRepository
            const userId = await this.userRepository.createUser(newUser);
            user = await this.userRepository.findById(userId);
        }

        return successResponse({
            message: 'Token verified successfully',
            user,
        });
    }
}
