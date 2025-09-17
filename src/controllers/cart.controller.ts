import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { validateRequest } from '../middleware/validator';
import { z } from 'zod';
import { CartRepository } from '../data/repositories/cart.repository';

/**
 * Controller for cart-related operations
 */
export class CartController {
    private cartRepository: CartRepository;

    constructor(private env: Env) {
        this.cartRepository = new CartRepository(env);
    }

    /**
     * Get the current user's cart
     */
    async getCart(request: AuthRequest): Promise<Response> {
        try {
            // Get user ID from authenticated request
            const userId = request.userId;

            // Fetch the user's cart
            const cart = await this.cartRepository.getCartByUserId(userId);

            return successResponse(cart);
        } catch (error) {
            console.error('Error fetching cart:', error);
            return errorResponse('Failed to fetch cart', 500);
        }
    }

    /**
     * Add an item to the cart
     */
    async addToCart(request: AuthRequest): Promise<Response> {
        // Define validation schema
        const addToCartSchema = z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
            attributes: z.record(z.string(), z.string()).optional(),
        });

        try {
            // Validate request body
            const validationResult = await validateRequest(addToCartSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            // Get the user ID from authenticated request
            const userId = request.userId;

            // Parse the request body
            const { productId, quantity, attributes } = await request.json();

            // Add the product to the cart
            const updatedCart = await this.cartRepository.addItem(userId, {
                productId,
                quantity,
                attributes,
            });

            return successResponse(updatedCart, 201);
        } catch (error) {
            console.error('Error adding to cart:', error);
            return errorResponse('Failed to add item to cart', 500);
        }
    }

    /**
     * Update a cart item's quantity
     */
    async updateCartItem(request: AuthRequest): Promise<Response> {
        // Define validation schema
        const updateCartItemSchema = z.object({
            quantity: z.number().int().positive(),
        });

        try {
            // Get the cart item ID from the request params
            const cartItemId = request.params?.id;

            if (!cartItemId) {
                return errorResponse('Cart item ID is required', 400);
            }

            // Validate request body
            const validationResult = await validateRequest(updateCartItemSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            // Get the user ID from authenticated request
            const userId = request.userId;

            // Parse the request body
            const { quantity } = await request.json();

            // Update the cart item
            const updatedCart = await this.cartRepository.updateItemQuantity(
                userId,
                cartItemId,
                quantity
            );

            return successResponse(updatedCart);
        } catch (error) {
            console.error('Error updating cart item:', error);
            return errorResponse('Failed to update cart item', 500);
        }
    }

    /**
     * Remove an item from the cart
     */
    async removeCartItem(request: AuthRequest): Promise<Response> {
        try {
            // Get the cart item ID from the request params
            const cartItemId = request.params?.id;

            if (!cartItemId) {
                return errorResponse('Cart item ID is required', 400);
            }

            // Get the user ID from authenticated request
            const userId = request.userId;

            // Remove the item from the cart
            const updatedCart = await this.cartRepository.removeItem(userId, cartItemId);

            return successResponse(updatedCart);
        } catch (error) {
            console.error('Error removing cart item:', error);
            return errorResponse('Failed to remove item from cart', 500);
        }
    }

    /**
     * Clear the entire cart
     */
    async clearCart(request: AuthRequest): Promise<Response> {
        try {
            // Get the user ID from authenticated request
            const userId = request.userId;

            // Clear the cart
            await this.cartRepository.clearCart(userId);

            return successResponse({ message: 'Cart cleared successfully' });
        } catch (error) {
            console.error('Error clearing cart:', error);
            return errorResponse('Failed to clear cart', 500);
        }
    }

    /**
     * Apply a coupon code to the cart
     */
    async applyCoupon(request: AuthRequest): Promise<Response> {
        // Define validation schema
        const applyCouponSchema = z.object({
            couponCode: z.string().min(3).max(50),
        });

        try {
            // Validate request body
            const validationResult = await validateRequest(applyCouponSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            // Get the user ID from authenticated request
            const userId = request.userId;

            // Parse the request body
            const { couponCode } = await request.json();

            // Apply the coupon to the cart
            const updatedCart = await this.cartRepository.applyCoupon(userId, couponCode);

            return successResponse(updatedCart);
        } catch (error) {
            console.error('Error applying coupon:', error);
            return errorResponse('Failed to apply coupon', 500);
        }
    }
}