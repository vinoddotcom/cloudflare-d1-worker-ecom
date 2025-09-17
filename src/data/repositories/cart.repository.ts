import { Env, D1Database } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Cart, CartItem } from '../../models/cart.model';

/**
 * Repository for cart-related database operations
 */
export class CartRepository extends BaseRepository<Cart> {
    constructor(env: Env) {
        super(env.DB, 'carts');
    }

    /**
     * Get a user's cart with all items and their related products
     * @param userId User ID
     * @returns Cart object with items
     */
    async getCartByUserId(userId: string): Promise<Cart | null> {
        try {
            // First, check if the user has a cart
            const cartQuery = `
        SELECT id, user_id, coupon_code, discount_amount, created_at, updated_at
        FROM carts
        WHERE user_id = ?
      `;

            const cart = await this.db.prepare(cartQuery).bind(userId).first();

            // If no cart exists, create one
            if (!cart) {
                const cartId = crypto.randomUUID();
                const now = new Date().toISOString();

                const createCartQuery = `
          INSERT INTO carts (id, user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `;

                await this.db.prepare(createCartQuery).bind(cartId, userId, now, now).run();

                // Return new empty cart
                return {
                    id: cartId,
                    userId,
                    items: [],
                    subtotal: 0,
                    discount: 0,
                    total: 0,
                    createdAt: now,
                    updatedAt: now,
                };
            }

            // Fetch cart items with product information
            const itemsQuery = `
        SELECT 
          ci.id,
          ci.cart_id,
          ci.product_id,
          ci.quantity,
          ci.attributes,
          p.name as product_name,
          p.price as product_price,
          p.images as product_images,
          p.sku as product_sku
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ?
      `;

            const itemsResult = await this.db.prepare(itemsQuery).bind(cart.id).all();

            // Process cart items
            const items = itemsResult.results.map((item: any) => {
                const attributes = item.attributes ? JSON.parse(item.attributes) : {};
                const productImages = item.product_images ? JSON.parse(item.product_images) : [];
                const firstImage = productImages.length > 0 ? productImages[0] : null;

                return {
                    id: item.id,
                    productId: item.product_id,
                    productName: item.product_name,
                    productSku: item.product_sku,
                    productImage: firstImage,
                    price: item.product_price,
                    quantity: item.quantity,
                    attributes,
                    total: item.product_price * item.quantity,
                };
            });

            // Calculate cart totals
            const subtotal = items.reduce((sum: number, item: CartItem) => sum + item.total, 0);
            const discount = cart.discount_amount || 0;
            const total = subtotal - discount;

            // Construct the cart object
            return {
                id: cart.id,
                userId: cart.user_id,
                couponCode: cart.coupon_code,
                items,
                subtotal,
                discount,
                total,
                createdAt: cart.created_at,
                updatedAt: cart.updated_at,
            };
        } catch (error) {
            console.error('Error fetching cart:', error);
            throw new Error(`Failed to fetch cart for user ${userId}`);
        }
    }

    /**
     * Add an item to the user's cart
     * @param userId User ID
     * @param item Item to add to cart
     * @returns Updated cart
     */
    async addItem(
        userId: string,
        item: { productId: string; quantity: number; attributes?: Record<string, string> }
    ): Promise<Cart> {
        try {
            // Get or create the user's cart
            const cart = await this.getCartByUserId(userId);

            if (!cart) {
                throw new Error(`Failed to get or create cart for user ${userId}`);
            }

            const cartId = cart.id;
            const now = new Date().toISOString();

            // Check if the product exists
            const productQuery = `
        SELECT id, price FROM products WHERE id = ? AND is_active = 1
      `;

            const product = await this.db.prepare(productQuery).bind(item.productId).first();

            if (!product) {
                throw new Error(`Product ${item.productId} not found or inactive`);
            }

            // Check if this item is already in the cart
            const existingItemQuery = `
        SELECT id, quantity FROM cart_items 
        WHERE cart_id = ? AND product_id = ?
      `;

            const existingItem = await this.db.prepare(existingItemQuery)
                .bind(cartId, item.productId)
                .first();

            // If item exists, update quantity, otherwise create new item
            if (existingItem) {
                const newQuantity = existingItem.quantity + item.quantity;

                const updateItemQuery = `
          UPDATE cart_items
          SET quantity = ?, updated_at = ?
          WHERE id = ?
        `;

                await this.db.prepare(updateItemQuery)
                    .bind(newQuantity, now, existingItem.id)
                    .run();
            } else {
                const cartItemId = crypto.randomUUID();
                const attributes = item.attributes ? JSON.stringify(item.attributes) : null;

                const addItemQuery = `
          INSERT INTO cart_items (id, cart_id, product_id, quantity, attributes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

                await this.db.prepare(addItemQuery)
                    .bind(cartItemId, cartId, item.productId, item.quantity, attributes, now, now)
                    .run();
            }

            // Update cart's updated_at timestamp
            const updateCartQuery = `
        UPDATE carts SET updated_at = ? WHERE id = ?
      `;

            await this.db.prepare(updateCartQuery).bind(now, cartId).run();

            // Return updated cart
            return this.getCartByUserId(userId) as Promise<Cart>;
        } catch (error) {
            console.error('Error adding item to cart:', error);
            throw new Error(`Failed to add item to cart: ${error.message}`);
        }
    }

    /**
     * Update a cart item's quantity
     * @param userId User ID
     * @param cartItemId Cart item ID
     * @param quantity New quantity
     * @returns Updated cart
     */
    async updateItemQuantity(
        userId: string,
        cartItemId: string,
        quantity: number
    ): Promise<Cart> {
        try {
            // Verify the cart and item belong to the user
            const verifyQuery = `
        SELECT ci.id
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.id
        WHERE ci.id = ? AND c.user_id = ?
      `;

            const verifyResult = await this.db.prepare(verifyQuery)
                .bind(cartItemId, userId)
                .first();

            if (!verifyResult) {
                throw new Error('Cart item not found or does not belong to user');
            }

            // Update the cart item quantity
            const now = new Date().toISOString();

            const updateQuery = `
        UPDATE cart_items
        SET quantity = ?, updated_at = ?
        WHERE id = ?
      `;

            await this.db.prepare(updateQuery)
                .bind(quantity, now, cartItemId)
                .run();

            // Update cart's updated_at timestamp
            const cartQuery = `
        SELECT c.id
        FROM carts c
        JOIN cart_items ci ON c.id = ci.cart_id
        WHERE ci.id = ?
      `;

            const cartResult = await this.db.prepare(cartQuery).bind(cartItemId).first();

            if (cartResult) {
                const updateCartQuery = `
          UPDATE carts SET updated_at = ? WHERE id = ?
        `;

                await this.db.prepare(updateCartQuery).bind(now, cartResult.id).run();
            }

            // Return updated cart
            return this.getCartByUserId(userId) as Promise<Cart>;
        } catch (error) {
            console.error('Error updating cart item quantity:', error);
            throw new Error(`Failed to update cart item quantity: ${error.message}`);
        }
    }

    /**
     * Remove an item from the cart
     * @param userId User ID
     * @param cartItemId Cart item ID to remove
     * @returns Updated cart
     */
    async removeItem(userId: string, cartItemId: string): Promise<Cart> {
        try {
            // Verify the cart and item belong to the user
            const verifyQuery = `
        SELECT ci.id, ci.cart_id
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.id
        WHERE ci.id = ? AND c.user_id = ?
      `;

            const verifyResult = await this.db.prepare(verifyQuery)
                .bind(cartItemId, userId)
                .first();

            if (!verifyResult) {
                throw new Error('Cart item not found or does not belong to user');
            }

            // Remove the cart item
            const deleteQuery = `
        DELETE FROM cart_items WHERE id = ?
      `;

            await this.db.prepare(deleteQuery).bind(cartItemId).run();

            // Update cart's updated_at timestamp
            const now = new Date().toISOString();
            const updateCartQuery = `
        UPDATE carts SET updated_at = ? WHERE id = ?
      `;

            await this.db.prepare(updateCartQuery).bind(now, verifyResult.cart_id).run();

            // Return updated cart
            return this.getCartByUserId(userId) as Promise<Cart>;
        } catch (error) {
            console.error('Error removing cart item:', error);
            throw new Error(`Failed to remove cart item: ${error.message}`);
        }
    }

    /**
     * Clear all items from the user's cart
     * @param userId User ID
     */
    async clearCart(userId: string): Promise<void> {
        try {
            // Get the cart ID for this user
            const cartQuery = `
        SELECT id FROM carts WHERE user_id = ?
      `;

            const cart = await this.db.prepare(cartQuery).bind(userId).first();

            if (!cart) {
                // No cart exists, nothing to clear
                return;
            }

            // Delete all items from the cart
            const deleteItemsQuery = `
        DELETE FROM cart_items WHERE cart_id = ?
      `;

            await this.db.prepare(deleteItemsQuery).bind(cart.id).run();

            // Update cart's updated_at timestamp and clear coupon if any
            const now = new Date().toISOString();
            const updateCartQuery = `
        UPDATE carts 
        SET updated_at = ?, coupon_code = NULL, discount_amount = 0
        WHERE id = ?
      `;

            await this.db.prepare(updateCartQuery).bind(now, cart.id).run();
        } catch (error) {
            console.error('Error clearing cart:', error);
            throw new Error(`Failed to clear cart: ${error.message}`);
        }
    }

    /**
     * Apply a coupon code to the cart
     * @param userId User ID
     * @param couponCode Coupon code to apply
     * @returns Updated cart
     */
    async applyCoupon(userId: string, couponCode: string): Promise<Cart> {
        try {
            // Get the cart ID for this user
            const cartQuery = `
        SELECT id FROM carts WHERE user_id = ?
      `;

            const cart = await this.db.prepare(cartQuery).bind(userId).first();

            if (!cart) {
                throw new Error('Cart not found');
            }

            // Check if the coupon exists and is valid
            const couponQuery = `
        SELECT 
          id, 
          code, 
          discount_type, 
          discount_value,
          minimum_purchase,
          max_discount
        FROM coupons
        WHERE code = ? AND is_active = 1
          AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;

            const coupon = await this.db.prepare(couponQuery).bind(couponCode).first();

            if (!coupon) {
                throw new Error('Coupon not found or expired');
            }

            // Calculate the cart subtotal to determine discount
            const cart2 = await this.getCartByUserId(userId);

            if (!cart2) {
                throw new Error('Failed to fetch cart');
            }

            let discountAmount = 0;

            // Check if cart meets minimum purchase requirement
            if (coupon.minimum_purchase && cart2.subtotal < coupon.minimum_purchase) {
                throw new Error(`Cart subtotal must be at least ${coupon.minimum_purchase}`);
            }

            // Calculate discount based on type
            if (coupon.discount_type === 'percentage') {
                discountAmount = (cart2.subtotal * coupon.discount_value) / 100;
            } else if (coupon.discount_type === 'fixed') {
                discountAmount = coupon.discount_value;
            }

            // Apply maximum discount limit if set
            if (coupon.max_discount && discountAmount > coupon.max_discount) {
                discountAmount = coupon.max_discount;
            }

            // Update the cart with the coupon and discount
            const now = new Date().toISOString();
            const updateCartQuery = `
        UPDATE carts
        SET coupon_code = ?, discount_amount = ?, updated_at = ?
        WHERE id = ?
      `;

            await this.db.prepare(updateCartQuery)
                .bind(couponCode, discountAmount, now, cart.id)
                .run();

            // Return updated cart
            return this.getCartByUserId(userId) as Promise<Cart>;
        } catch (error) {
            console.error('Error applying coupon:', error);
            throw new Error(`Failed to apply coupon: ${error.message}`);
        }
    }
}