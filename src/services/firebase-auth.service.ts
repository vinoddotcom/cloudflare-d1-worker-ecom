import * as admin from 'firebase-admin';
import { UserRole } from '../models/user.model';
import { Env } from '../models/common.model';

/**
 * Firebase Authentication Service
 * 
 * This service handles authentication and authorization using Firebase Admin SDK.
 * Note: In a Cloudflare Worker environment, we need to use Firebase Admin SDK with care,
 * as some features might not be fully compatible. We use a lightweight integration.
 */
export class FirebaseAuthService {
    private static instance: FirebaseAuthService;
    private initialized = false;
    private firebaseApp: admin.app.App | null = null;

    private constructor() { }

    /**
     * Get the singleton instance of the Firebase Auth Service
     */
    public static getInstance(): FirebaseAuthService {
        if (!FirebaseAuthService.instance) {
            FirebaseAuthService.instance = new FirebaseAuthService();
        }
        return FirebaseAuthService.instance;
    }

    /**
     * Initialize Firebase Admin SDK
     * @param env Environment variables
     */
    public initialize(env: Env): void {
        if (this.initialized) return;

        try {
            // In Cloudflare Workers, we need to supply credentials or use a workaround
            // This is a placeholder for actual implementation
            this.firebaseApp = admin.initializeApp({
                projectId: env.FIREBASE_PROJECT_ID,
                // You would need to set up credential securely
                // credential: admin.credential.cert({...})
            });
            this.initialized = true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw new Error('Failed to initialize Firebase Admin SDK');
        }
    }

    /**
     * Verify Firebase ID token
     * @param token ID token to verify
     * @returns Decoded token with user information
     */
    public async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
        if (!this.initialized || !this.firebaseApp) {
            throw new Error('Firebase Auth not initialized');
        }

        try {
            return await admin.auth().verifyIdToken(token);
        } catch (error) {
            console.error('Token verification error:', error);
            throw new Error('Invalid or expired authentication token');
        }
    }

    /**
     * Get user by ID
     * @param uid User ID
     * @returns Firebase user record
     */
    public async getUser(uid: string): Promise<admin.auth.UserRecord> {
        if (!this.initialized || !this.firebaseApp) {
            throw new Error('Firebase Auth not initialized');
        }

        try {
            return await admin.auth().getUser(uid);
        } catch (error) {
            console.error('Get user error:', error);
            throw new Error('User not found');
        }
    }

    /**
     * Create a new user in Firebase
     * @param email User email
     * @param password User password
     * @param displayName User display name
     * @returns Created user record
     */
    public async createUser(
        email: string,
        password: string,
        displayName: string
    ): Promise<admin.auth.UserRecord> {
        if (!this.initialized || !this.firebaseApp) {
            throw new Error('Firebase Auth not initialized');
        }

        try {
            return await admin.auth().createUser({
                email,
                password,
                displayName,
                emailVerified: false,
            });
        } catch (error) {
            console.error('Create user error:', error);
            throw new Error('Failed to create user');
        }
    }

    /**
     * Set custom user claims (for roles)
     * @param uid User ID
     * @param role User role
     */
    public async setUserRole(uid: string, role: UserRole): Promise<void> {
        if (!this.initialized || !this.firebaseApp) {
            throw new Error('Firebase Auth not initialized');
        }

        try {
            await admin.auth().setCustomUserClaims(uid, { role });
        } catch (error) {
            console.error('Set user role error:', error);
            throw new Error('Failed to set user role');
        }
    }

    /**
     * Delete a Firebase user
     * @param uid User ID
     */
    public async deleteUser(uid: string): Promise<void> {
        if (!this.initialized || !this.firebaseApp) {
            throw new Error('Firebase Auth not initialized');
        }

        try {
            await admin.auth().deleteUser(uid);
        } catch (error) {
            console.error('Delete user error:', error);
            throw new Error('Failed to delete user');
        }
    }

    /**
     * Get user role from decoded token
     * @param decodedToken Decoded ID token
     * @returns User role, defaults to 'customer' if not set
     */
    public getUserRole(decodedToken: admin.auth.DecodedIdToken): UserRole {
        const claims = decodedToken.claims || decodedToken;
        return (claims.role as UserRole) || 'customer';
    }
}