import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { validateRequest } from '../middleware/validator';
import { z } from 'zod';
import { OrderRepository } from '../data/repositories/order.repository';
import { PaymentRepository } from '../data/repositories/payment.repository';
import { InvoiceRepository } from '../data/repositories/invoice.repository';
import { OrderStatus } from '../models/order.model';

/**
 * Controller for order-related operations
 */
export class OrderController {
    private orderRepository: OrderRepository;
    private paymentRepository: PaymentRepository;
    private invoiceRepository: InvoiceRepository;

    constructor(private env: Env) {
        this.orderRepository = new OrderRepository(env);
        this.paymentRepository = new PaymentRepository(env);
        this.invoiceRepository = new InvoiceRepository(env);
    }

    /**
     * Create a new order from a cart
     */
    async createOrder(request: AuthRequest): Promise<Response> {
        const createOrderSchema = z.object({
            cartId: z.string(),
            shippingAddressId: z.number().int().positive(),
            billingAddressId: z.number().int().positive(),
            shippingMethod: z.string(),
            paymentMethod: z.string(),
            notes: z.string().optional(),
        });

        try {
            // Validate request body
            const validationResult = await validateRequest(createOrderSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            const data = await request.json() as unknown;
            const userId = request.userId;

            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            // Since validation passed, we can safely cast the body
            const typedData = data as {
                cartId: string;
                shippingAddressId: number;
                billingAddressId: number;
                shippingMethod: string;
                paymentMethod: string;
                notes?: string;
            };

            // Create order from cart
            const order = await this.orderRepository.createFromCart({
                userId,
                cartId: typedData.cartId,
                shippingAddressId: typedData.shippingAddressId,
                billingAddressId: typedData.billingAddressId,
                shippingMethod: typedData.shippingMethod,
                paymentMethod: typedData.paymentMethod,
                notes: typedData.notes,
            });

            // Create initial payment record
            await this.paymentRepository.createPayment({
                orderId: order.id,
                amount: order.total_amount,
                paymentMethod: typedData.paymentMethod,
                status: 'pending',
            });

            // Create invoice
            await this.invoiceRepository.createInvoice({
                orderId: order.id,
            });

            // Return the complete order with payment and invoice information
            const completeOrder = await this.orderRepository.getOrderById(order.id);

            return successResponse(completeOrder, 201);
        } catch (error) {
            console.error('Error creating order:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to create order', 500);
        }
    }

    /**
     * Get a specific order by ID
     */
    async getOrderById(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Order ID is required', 400);
            }

            const orderId = parseInt(id);
            if (isNaN(orderId)) {
                return errorResponse('Invalid order ID', 400);
            }

            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            const order = await this.orderRepository.getOrderById(orderId);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            return successResponse(order);
        } catch (error) {
            console.error('Error fetching order:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch order', 500);
        }
    }

    /**
     * Get all orders for the current user
     */
    async getUserOrders(request: AuthRequest): Promise<Response> {
        try {
            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '10');

            const result = await this.orderRepository.getUserOrders(userId, page, limit);

            return successResponse(result);
        } catch (error) {
            console.error('Error fetching user orders:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch orders', 500);
        }
    }

    /**
     * Get all orders (admin only)
     */
    async getAllOrders(request: AuthRequest): Promise<Response> {
        try {
            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const status = url.searchParams.get('status') as any; // Type as any to allow null
            const fromDate = url.searchParams.get('fromDate') || undefined;
            const toDate = url.searchParams.get('toDate') || undefined;
            const search = url.searchParams.get('search') || undefined;

            const result = await this.orderRepository.getAllOrders({
                page,
                limit,
                status,
                fromDate,
                toDate,
                search,
            });

            return successResponse(result);
        } catch (error) {
            console.error('Error fetching all orders:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch orders', 500);
        }
    }

    /**
     * Update order status (admin only)
     */
    async updateOrderStatus(request: AuthRequest): Promise<Response> {
        const updateStatusSchema = z.object({
            status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
            notes: z.string().optional(),
        });

        try {
            // Validate request body
            const validationResult = await validateRequest(updateStatusSchema)(request);
            if (validationResult instanceof Response) {
                return validationResult;
            }

            const id = request.params?.id;
            if (!id) {
                return errorResponse('Order ID is required', 400);
            }

            const orderId = parseInt(id);
            if (isNaN(orderId)) {
                return errorResponse('Invalid order ID', 400);
            }

            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            const data = await request.json() as unknown;

            // Since validation passed, we can safely cast the body
            const typedData = data as {
                status: OrderStatus;
                notes?: string;
            };

            const updatedOrder = await this.orderRepository.updateOrderStatus(
                orderId,
                typedData.status,
                userId,
                typedData.notes
            );

            return successResponse(updatedOrder);
        } catch (error) {
            console.error('Error updating order status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update order status', 500);
        }
    }

    /**
     * Cancel an order (customer or admin)
     */
    async cancelOrder(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Order ID is required', 400);
            }

            const orderId = parseInt(id);
            if (isNaN(orderId)) {
                return errorResponse('Invalid order ID', 400);
            }

            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            // Get the order to check if it can be cancelled
            const order = await this.orderRepository.getOrderById(orderId);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Only allow cancellation of orders in pending or processing status
            if (order.status !== 'pending' && order.status !== 'processing') {
                return errorResponse(`Cannot cancel order in '${order.status}' status`, 400);
            }

            // Cancel the order
            const updatedOrder = await this.orderRepository.updateOrderStatus(
                orderId,
                'cancelled' as OrderStatus,
                userId,
                'Order cancelled by ' + (request.userRole === 'admin' ? 'admin' : 'customer')
            );

            return successResponse(updatedOrder);
        } catch (error) {
            console.error('Error cancelling order:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to cancel order', 500);
        }
    }

    /**
     * Generate an invoice for an order
     */
    async generateInvoice(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Order ID is required', 400);
            }

            const orderId = parseInt(id);
            if (isNaN(orderId)) {
                return errorResponse('Invalid order ID', 400);
            }

            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID is required', 400);
            }

            // Get the order to check access
            const order = await this.orderRepository.getOrderById(orderId);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Get or create invoice
            let invoice;
            try {
                // Try to get existing invoice
                invoice = await this.invoiceRepository.getInvoiceByOrderId(orderId);
            } catch (error) {
                // If no invoice exists, create one
                invoice = await this.invoiceRepository.createInvoice({ orderId });
            }

            // Generate the invoice PDF (HTML in this implementation)
            const invoiceHtml = await this.invoiceRepository.generateInvoicePdf(invoice.id);

            // For real applications, we would return a PDF file
            // Here, we return the HTML as text
            return new Response(invoiceHtml, {
                headers: {
                    'Content-Type': 'text/html',
                },
            });
        } catch (error) {
            console.error('Error generating invoice:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to generate invoice', 500);
        }
    }
}