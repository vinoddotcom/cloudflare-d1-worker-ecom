import { Router } from 'itty-router';
import { Env } from '../models/common.model';
import { ImageController } from '../controllers/image.controller';
import { authenticate } from '../middleware/auth';

/**
 * Initialize image routes
 * @param env Application environment variables
 * @returns Router instance
 */
export function initImageRoutes(env: Env): Router {
    const router = Router({ base: '/api/images' });
    const imageController = new ImageController(env);

    // Public routes
    router.get('/:id', (request) => imageController.getImage(request));
    router.get('/:id/:variant', (request) => imageController.getImageVariant(request));

    // Protected routes (require authentication)
    router.get('/upload-url', authenticate(env), (request) => imageController.getDirectUploadUrl(request));
    router.post('/upload', authenticate(env), (request) => imageController.uploadImage(request));
    router.delete('/:id', authenticate(env), (request) => imageController.deleteImage(request));

    // Admin-only routes
    router.get('/', authenticate(env), (request) => imageController.listImages(request));

    return router;
}