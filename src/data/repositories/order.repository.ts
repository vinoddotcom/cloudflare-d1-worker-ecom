import { Env } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Order, OrderItem, OrderStatus, OrderStatusHistory, Payment, Invoice } from '../../models/order.model';
import { Address } from '../../models/user.model';

/**
 * Repository for order-related database operations
 */
export class OrderRepository extends BaseRepository<Order> {
    constructor(env: Env) {
        super(env.DB, 'orders');
    }

    /**
     * Generate a unique order number
     * Format: ORD-YYYYMMDD-XXXXX (where XXXXX is a random 5-digit number)
     */
    private generateOrderNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
        return `ORD-${year}${month}${day}-${random}`;
    }

    /**
     * Create a new order from cart
     * @param data Order creation data
     * @returns The created order
     */
    async createFromCart(data: {
        userId: string;
        cartId: string;
        shippingAddressId: number;
        billingAddressId: number;
        shippingMethod: string;
        paymentMethod: string;
        notes?: string;
    }): Promise<Order> {
        const {
            userId,
            cartId,
            shippingAddressId,
            billingAddressId,
            shippingMethod,
            paymentMethod,
            notes,
        } = data;

        // Start a transaction
        const orderNumber = this.generateOrderNumber();
        const now = new Date().toISOString();

        try {
            // Get cart with items
            const cartQuery = `
        SELECT 
          c.id as cart_id,
          ci.id as cart_item_id,
          ci.product_variant_id,
          ci.quantity,
          ci.price,
          p.name as product_name,
          pv.name as variant_name,
          pv.sku
        FROM carts c
        JOIN cart_items ci ON c.id = ci.cart_id
        JOIN product_variants pv ON ci.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE c.id = ? AND c.user_id = ?
      `;

            interface CartItem {
                cart_id: string;
                cart_item_id: number;
                product_variant_id: number;
                quantity: number;
                price: number;
                product_name: string;
                variant_name: string;
                sku: string;
            }

            const cartItems = await this.db.prepare(cartQuery)
                .bind(cartId, userId)
                .all<CartItem>();

            if (!cartItems.results || cartItems.results.length === 0) {
                throw new Error('Cart is empty');
            }

            // Calculate order totals
            const items = cartItems.results;
            const subtotal = items.reduce((sum: number, item) => {
                return sum + (item.price * item.quantity);
            }, 0);

            // Get shipping method cost
            const shippingMethodQuery = `
        SELECT base_price FROM shipping_methods WHERE name = ?
      `;
            const shippingResult = await this.db.prepare(shippingMethodQuery)
                .bind(shippingMethod)
                .first<{ base_price: number }>();

            if (!shippingResult) {
                throw new Error('Invalid shipping method');
            }

            const shippingFee = shippingResult.base_price;

            // Calculate tax (for enterprise applications, this would typically use a tax service API)
            // Here we use a simplified calculation of 10% of subtotal
            const taxRate = 0.10;
            const taxAmount = subtotal * taxRate;

            // Calculate total
            const totalAmount = subtotal + shippingFee + taxAmount;

            // Create the order
            const orderQuery = `
        INSERT INTO orders (
          order_number,
          user_id,
          status,
          subtotal,
          shipping_fee,
          tax_amount,
          total_amount,
          shipping_address_id,
          billing_address_id,
          shipping_method,
          payment_method,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const orderResult = await this.db.prepare(orderQuery).bind(
                orderNumber,
                userId,
                'pending', // Initial status
                subtotal,
                shippingFee,
                taxAmount,
                totalAmount,
                shippingAddressId,
                billingAddressId,
                shippingMethod,
                paymentMethod,
                notes || null,
                now,
                now
            ).run();

            if (!orderResult.success) {
                throw new Error('Failed to create order');
            }

            // Cast to D1ExecResult to access lastRowId
            const orderId = (orderResult as unknown as { lastRowId: number }).lastRowId;

            // Insert order items
            for (const item of items) {
                const orderItemQuery = `
          INSERT INTO order_items (
            order_id,
            product_variant_id,
            quantity,
            price,
            product_name,
            variant_name,
            sku,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

                await this.db.prepare(orderItemQuery).bind(
                    orderId,
                    item.product_variant_id,
                    item.quantity,
                    item.price,
                    item.product_name,
                    item.variant_name,
                    item.sku,
                    now
                ).run();

                // Update inventory (reduce stock)
                const inventoryQuery = `
          UPDATE inventory
          SET quantity = quantity - ?,
              updated_at = ?
          WHERE product_variant_id = ? AND quantity >= ?
        `;

                const inventoryResult = await this.db.prepare(inventoryQuery).bind(
                    item.quantity,
                    now,
                    item.product_variant_id,
                    item.quantity
                ).run();

                // Cast to D1ExecResult to access changes property
                if ((inventoryResult as unknown as { changes: number }).changes === 0) {
                    throw new Error(`Insufficient inventory for product variant ${item.product_variant_id}`);
                }
            }

            // Add initial status history
            const statusHistoryQuery = `
        INSERT INTO order_status_history (
          order_id,
          status,
          notes,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;

            await this.db.prepare(statusHistoryQuery).bind(
                orderId,
                'pending',
                'Order created',
                userId,
                now
            ).run();

            // Clear the cart
            const clearCartQuery = `
        DELETE FROM cart_items WHERE cart_id = ?
      `;

            await this.db.prepare(clearCartQuery).bind(cartId).run();

            // Return the created order
            return this.getOrderById(orderId as number);
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    /**
     * Get order by ID with all related data
     * @param orderId Order ID
     * @returns Complete order with items, addresses, and status history
     */
    async getOrderById(orderId: number): Promise<Order> {
        try {
            // Get order details
            const orderQuery = `
        SELECT 
          o.*,
          sa.address_line1 as shipping_address_line1,
          sa.address_line2 as shipping_address_line2,
          sa.city as shipping_city,
          sa.state as shipping_state,
          sa.postal_code as shipping_postal_code,
          sa.country as shipping_country,
          ba.address_line1 as billing_address_line1,
          ba.address_line2 as billing_address_line2,
          ba.city as billing_city,
          ba.state as billing_state,
          ba.postal_code as billing_postal_code,
          ba.country as billing_country
        FROM orders o
        JOIN addresses sa ON o.shipping_address_id = sa.id
        JOIN addresses ba ON o.billing_address_id = ba.id
        WHERE o.id = ?
      `;

            const order = await this.db.prepare(orderQuery).bind(orderId).first<{
                id: number;
                order_number: string;
                user_id: string;
                status: OrderStatus;
                subtotal: number;
                shipping_fee: number;
                tax_amount: number;
                total_amount: number;
                shipping_address_id: number;
                billing_address_id: number;
                shipping_method: string;
                payment_method: string;
                notes: string | null;
                created_at: number;
                updated_at: number;
                shipping_address_line1: string;
                shipping_address_line2: string | null;
                shipping_city: string;
                shipping_state: string;
                shipping_postal_code: string;
                shipping_country: string;
                billing_address_line1: string;
                billing_address_line2: string | null;
                billing_city: string;
                billing_state: string;
                billing_postal_code: string;
                billing_country: string;
            }>();

            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }

            // Get order items
            const itemsQuery = `
        SELECT * FROM order_items WHERE order_id = ?
      `;

            const itemsResult = await this.db.prepare(itemsQuery).bind(orderId).all<OrderItem>();
            const items = itemsResult.results || [];

            // Get order status history
            const historyQuery = `
        SELECT * FROM order_status_history 
        WHERE order_id = ? 
        ORDER BY created_at DESC
      `;

            const historyResult = await this.db.prepare(historyQuery).bind(orderId).all<OrderStatusHistory>();
            const statusHistory = historyResult.results || [];

            // Get payment information
            const paymentQuery = `
        SELECT * FROM payments WHERE order_id = ?
      `;

            const paymentResult = await this.db.prepare(paymentQuery).bind(orderId).all<Payment>();
            const payments = paymentResult.results || [];

            // Get invoice information
            const invoiceQuery = `
        SELECT * FROM invoices WHERE order_id = ?
      `;

            const invoiceResult = await this.db.prepare(invoiceQuery).bind(orderId).all<Invoice>();
            const invoices = invoiceResult.results || [];

            // Construct shipping address
            const shippingAddress: Address = {
                id: order.shipping_address_id,
                user_id: order.user_id, // Add required field
                address_type: 'shipping', // Add required field
                is_default: false, // Add required field
                created_at: order.created_at, // Add required field
                address_line1: order.shipping_address_line1,
                address_line2: order.shipping_address_line2 || undefined,
                city: order.shipping_city,
                state: order.shipping_state,
                postal_code: order.shipping_postal_code,
                country: order.shipping_country,
            };

            // Construct billing address
            const billingAddress: Address = {
                id: order.billing_address_id,
                user_id: order.user_id, // Add required field
                address_type: 'billing', // Add required field
                is_default: false, // Add required field
                created_at: order.created_at, // Add required field
                address_line1: order.billing_address_line1,
                address_line2: order.billing_address_line2 || undefined,
                city: order.billing_city,
                state: order.billing_state,
                postal_code: order.billing_postal_code,
                country: order.billing_country,
            };

            // Combine everything into the order object
            const orderObj: Order = {
                id: order.id,
                order_number: order.order_number,
                user_id: order.user_id,
                status: order.status,
                subtotal: order.subtotal,
                shipping_fee: order.shipping_fee,
                tax_amount: order.tax_amount,
                total_amount: order.total_amount,
                shipping_address_id: order.shipping_address_id,
                billing_address_id: order.billing_address_id,
                shipping_method: order.shipping_method,
                payment_method: order.payment_method,
                notes: order.notes === null ? undefined : order.notes,
                created_at: order.created_at,
                updated_at: order.updated_at,
                items: items,
                shipping_address: shippingAddress,
                billing_address: billingAddress,
                status_history: statusHistory,
                payment: payments.length > 0 ? payments[0] : undefined,
                invoice: invoices.length > 0 ? invoices[0] : undefined
            };

            return orderObj;
        } catch (error) {
            console.error('Error fetching order:', error);
            throw error;
        }
    }

    /**
     * Get orders for a specific user with pagination
     * @param userId User ID
     * @param page Page number
     * @param limit Items per page
     * @returns Paginated orders
     */
    async getUserOrders(
        userId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
        try {
            const offset = (page - 1) * limit;

            // Get orders
            const ordersQuery = `
        SELECT 
          o.*,
          p.status as payment_status,
          i.invoice_number
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id
        LEFT JOIN invoices i ON o.id = i.order_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;

            type OrderQueryResult = {
                id: number;
                order_number: string;
                user_id: string;
                status: OrderStatus;
                subtotal: number;
                shipping_fee: number;
                tax_amount: number;
                total_amount: number;
                shipping_address_id: number;
                billing_address_id: number;
                shipping_method: string;
                payment_method: string;
                notes: string | null;
                created_at: number;
                updated_at: number;
                payment_status?: string;
                invoice_number?: string;
            };

            const ordersResult = await this.db.prepare(ordersQuery)
                .bind(userId, limit, offset)
                .all<OrderQueryResult>();

            // Get total count
            const countQuery = `
        SELECT COUNT(*) as total FROM orders WHERE user_id = ?
      `;

            const countResult = await this.db.prepare(countQuery)
                .bind(userId)
                .first<{ total: number }>();

            const orders = await Promise.all((ordersResult.results || []).map(async (order) => {
                // Get order items
                const itemsQuery = `
          SELECT * FROM order_items WHERE order_id = ?
        `;

                const itemsResult = await this.db.prepare(itemsQuery).bind(order.id).all<OrderItem>();

                return {
                    ...order,
                    items: itemsResult.results || [],
                    notes: order.notes === null ? undefined : order.notes
                };
            }));

            return {
                orders: orders as Order[],
                total: countResult ? countResult.total : 0,
                page,
                limit
            };
        } catch (error) {
            console.error('Error fetching user orders:', error);
            throw error;
        }
    }

    /**
     * Update order status and add to status history
     * @param orderId Order ID
     * @param status New status
     * @param userId User making the change
     * @param notes Optional notes about the status change
     * @returns Updated order
     */
    async updateOrderStatus(
        orderId: number,
        status: OrderStatus,
        userId: string,
        notes?: string
    ): Promise<Order> {
        try {
            const now = new Date().toISOString();

            // Update order status
            const updateQuery = `
        UPDATE orders
        SET status = ?, updated_at = ?
        WHERE id = ?
      `;

            await this.db.prepare(updateQuery).bind(status, now, orderId).run();

            // Add to status history
            const historyQuery = `
        INSERT INTO order_status_history (
          order_id,
          status,
          notes,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `;

            await this.db.prepare(historyQuery).bind(
                orderId,
                status,
                notes || null,
                userId,
                now
            ).run();

            // Special handling for certain statuses
            if (status === 'cancelled') {
                // Return items to inventory
                const itemsQuery = `
          SELECT product_variant_id, quantity FROM order_items WHERE order_id = ?
        `;

                interface OrderItemInventory {
                    product_variant_id: number;
                    quantity: number;
                }

                const itemsResult = await this.db.prepare(itemsQuery).bind(orderId).all<OrderItemInventory>();
                const items = itemsResult.results || [];

                for (const item of items) {
                    // Update inventory (increase stock)
                    const inventoryQuery = `
            UPDATE inventory
            SET quantity = quantity + ?, updated_at = ?
            WHERE product_variant_id = ?
          `;

                    await this.db.prepare(inventoryQuery).bind(
                        item.quantity,
                        now,
                        item.product_variant_id
                    ).run();
                }
            }

            // Return updated order
            return this.getOrderById(orderId);
        } catch (error) {
            console.error('Error updating order status:', error);
            throw error;
        }
    }

    /**
     * Get all orders with filtering and pagination (admin only)
     * @param options Filtering and pagination options
     * @returns Paginated orders
     */
    async getAllOrders(options: {
        page?: number;
        limit?: number;
        status?: OrderStatus;
        fromDate?: string;
        toDate?: string;
        search?: string;
    }): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
        const {
            page = 1,
            limit = 20,
            status,
            fromDate,
            toDate,
            search,
        } = options;

        const offset = (page - 1) * limit;
        const params: any[] = [];

        // Build query with filters
        let query = `
      SELECT 
        o.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;

        // Add status filter
        if (status) {
            query += ` AND o.status = ?`;
            params.push(status);
        }

        // Add date range filter
        if (fromDate) {
            query += ` AND o.created_at >= ?`;
            params.push(fromDate);
        }

        if (toDate) {
            query += ` AND o.created_at <= ?`;
            params.push(toDate);
        }

        // Add search filter
        if (search) {
            query += ` AND (o.order_number LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add sorting
        query += ` ORDER BY o.created_at DESC`;

        // Add pagination
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Build count query with the same filters
        let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;

        const countParams: any[] = [];

        // Add the same filters to count query
        if (status) {
            countQuery += ` AND o.status = ?`;
            countParams.push(status);
        }

        if (fromDate) {
            countQuery += ` AND o.created_at >= ?`;
            countParams.push(fromDate);
        }

        if (toDate) {
            countQuery += ` AND o.created_at <= ?`;
            countParams.push(toDate);
        }

        if (search) {
            countQuery += ` AND (o.order_number LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`;
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        interface OrderQueryResult {
            id: number;
            order_number: string;
            user_id: string;
            status: OrderStatus;
            subtotal: number;
            shipping_fee: number;
            tax_amount: number;
            total_amount: number;
            shipping_address_id: number;
            billing_address_id: number;
            shipping_method: string;
            payment_method: string;
            notes: string | null;
            created_at: number;
            updated_at: number;
            user_email: string;
            user_first_name: string;
            user_last_name: string;
        }

        try {
            // Execute queries
            const ordersResult = await this.db.prepare(query).bind(...params).all<OrderQueryResult>();
            const countResult = await this.db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

            // Get order items for each order
            const orders = await Promise.all((ordersResult.results || []).map(async (order) => {
                const itemsQuery = `SELECT * FROM order_items WHERE order_id = ?`;
                const itemsResult = await this.db.prepare(itemsQuery).bind(order.id).all<OrderItem>();

                return {
                    ...order,
                    items: itemsResult.results || [],
                    notes: order.notes === null ? undefined : order.notes,
                    user: {
                        id: order.user_id,
                        email: order.user_email,
                        first_name: order.user_first_name,
                        last_name: order.user_last_name,
                    }
                };
            }));

            return {
                orders: orders as unknown as Order[],  // Type assertion since we're adding user object
                total: countResult?.total || 0,
                page,
                limit
            };
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    }
}