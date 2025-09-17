import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { PaymentRepository } from '../data/repositories/payment.repository';
import { OrderRepository } from '../data/repositories/order.repository';
import { RazorpayService } from '../services/razorpay.service';
import { PaymentStatus } from '../models/order.model';

/**
 * Controller for payment-related operations
 */
export class PaymentController {
    private paymentRepository: PaymentRepository;
    private orderRepository: OrderRepository;
    private razorpayService: RazorpayService;

    constructor(private env: Env) {
        this.paymentRepository = new PaymentRepository(env);
        this.orderRepository = new OrderRepository(env);
        this.razorpayService = new RazorpayService(env);
    }

    /**
     * Process a payment for an order using Razorpay
     */
    async processPayment(request: AuthRequest): Promise<Response> {
        try {
            const data = await request.json() as {
                orderId: number;
                paymentDetails: Record<string, any>;
            };
            const { orderId, paymentDetails } = data;

            if (!orderId || !paymentDetails) {
                return errorResponse('Order ID and payment details are required', 400);
            }

            // Get the order to check access and status
            const order = await this.orderRepository.getOrderById(orderId);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Check if there's already a completed payment
            if (order.payment && order.payment.status === 'completed') {
                return errorResponse('Payment has already been processed', 400);
            }

            // Get or create the payment record
            let payment;
            try {
                payment = await this.paymentRepository.getPaymentByOrderId(orderId);
            } catch (error) {
                // If no payment record exists, create one
                payment = await this.paymentRepository.createPayment({
                    orderId,
                    amount: order.total_amount,
                    paymentMethod: order.payment_method || 'razorpay',
                    status: 'pending',
                });
            }

            // Get user details for payment
            const userQuery = await this.env.DB.prepare(`
                SELECT first_name, last_name, email, phone FROM users WHERE id = ?
            `).bind(order.user_id).first<{ first_name: string, last_name: string, email: string, phone?: string }>();

            if (!userQuery) {
                return errorResponse('User not found', 404);
            }

            // Get billing address details
            const billingAddress = order.billing_address ||
                await this.env.DB.prepare(`
                    SELECT * FROM addresses WHERE id = ? AND user_id = ?
                `).bind(order.billing_address_id, order.user_id).first();

            if (!billingAddress) {
                return errorResponse('Billing address not found', 404);
            }

            // Add user information to payment details
            const enhancedPaymentDetails = {
                ...paymentDetails,
                email: userQuery.email,
                name: `${userQuery.first_name} ${userQuery.last_name}`,
                phone: userQuery.phone,
                address: `${billingAddress.address_line1}, ${billingAddress.city}, ${billingAddress.state}, ${billingAddress.country}`,
            };

            // Handle Razorpay payment flow
            if (paymentDetails.action === 'create_order') {
                // Initial payment - create Razorpay order
                const result = await this.paymentRepository.processPayment(
                    payment.id,
                    {
                        ...enhancedPaymentDetails,
                        action: 'create_order'
                    }
                );

                if (result.success) {
                    // Get Razorpay client config
                    const razorpayConfig = this.razorpayService.getClientConfig();

                    return successResponse({
                        success: true,
                        payment: {
                            id: payment.id,
                            orderId: orderId,
                            amount: payment.amount,
                            status: 'processing'
                        },
                        razorpay: {
                            key_id: razorpayConfig.key_id,
                            order_id: result.orderId,
                            amount: Math.round(payment.amount * 100), // in paise
                            currency: 'INR',
                            name: 'Your E-Commerce Store',
                            description: `Payment for Order #${order.order_number}`,
                            prefill: {
                                name: enhancedPaymentDetails.name,
                                email: enhancedPaymentDetails.email,
                                contact: enhancedPaymentDetails.phone
                            },
                            notes: {
                                order_id: orderId.toString(),
                                order_number: order.order_number
                            }
                        },
                        message: 'Payment initiated successfully',
                    });
                } else {
                    return errorResponse(result.error || 'Payment initiation failed', 400);
                }
            }
            // Handle payment verification callback
            else if (
                paymentDetails.razorpay_payment_id &&
                paymentDetails.razorpay_order_id &&
                paymentDetails.razorpay_signature
            ) {
                // Verify payment
                const result = await this.paymentRepository.processPayment(
                    payment.id,
                    paymentDetails
                );

                if (result.success) {
                    // Get the updated payment details
                    const updatedPayment = await this.paymentRepository.getPaymentByOrderId(orderId);

                    return successResponse({
                        success: true,
                        payment: updatedPayment,
                        transactionId: result.transactionId,
                        message: 'Payment verified successfully',
                    });
                } else {
                    return errorResponse(result.error || 'Payment verification failed', 400);
                }
            } else {
                return errorResponse('Invalid payment details format', 400);
            }
        } catch (error) {
            console.error('Error processing payment:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to process payment', 500);
        }
    }

    /**
     * Get payment details by order ID
     */
    async getPaymentByOrderId(request: AuthRequest): Promise<Response> {
        try {
            const orderId = request.params?.orderId;
            if (!orderId) {
                return errorResponse('Order ID is required', 400);
            }

            const orderIdNumber = parseInt(orderId);
            if (isNaN(orderIdNumber)) {
                return errorResponse('Invalid order ID', 400);
            }

            // Get the order to check access
            const order = await this.orderRepository.getOrderById(orderIdNumber);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Get payment details
            const payment = await this.paymentRepository.getPaymentByOrderId(orderIdNumber);

            return successResponse(payment);
        } catch (error) {
            console.error('Error fetching payment:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch payment', 500);
        }
    }

    /**
     * Refund a payment (admin only) using Razorpay
     */
    async refundPayment(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Payment ID is required', 400);
            }

            const paymentId = parseInt(id);
            if (isNaN(paymentId)) {
                return errorResponse('Invalid payment ID', 400);
            }

            const data = await request.json() as {
                amount?: number;
                reason?: string;
            };
            const { amount, reason } = data;
            const refundReason = reason || 'Refund requested by admin';

            // Get the payment
            const payment = await this.paymentRepository.findById(paymentId.toString());
            if (!payment) {
                return errorResponse('Payment not found', 404);
            }

            // Only completed payments can be refunded
            if (payment.status !== 'completed') {
                return errorResponse(`Cannot refund payment with status '${payment.status}'`, 400);
            }

            // Parse payment details to get razorpay payment ID
            let razorpayPaymentId: string | undefined;

            try {
                if (payment.payment_details) {
                    const paymentDetails = JSON.parse(payment.payment_details);
                    razorpayPaymentId = paymentDetails.razorpay_payment_id;
                }
            } catch (error) {
                console.error('Error parsing payment details:', error);
            }

            if (!razorpayPaymentId) {
                return errorResponse('No Razorpay payment ID found for this payment', 400);
            }

            // Create refund in Razorpay
            const refundResult = await this.razorpayService.createRefund(
                razorpayPaymentId,
                amount ? Math.round(amount * 100) : undefined // Convert to paise if amount is specified
            );

            // Update payment status to refunded
            await this.paymentRepository.updatePaymentStatus(
                paymentId,
                'refunded',
                undefined,
                JSON.stringify({
                    refundReason,
                    refundedAt: new Date().toISOString(),
                    refundedBy: request.userId,
                    razorpay_refund_id: refundResult.id,
                    razorpay_refund: refundResult
                })
            );

            // Get the updated payment
            const updatedPayment = await this.paymentRepository.findById(paymentId.toString());

            return successResponse({
                success: true,
                payment: updatedPayment,
                refund: {
                    id: refundResult.id,
                    amount: refundResult.amount / 100, // Convert from paise to currency units
                    status: refundResult.status,
                    created_at: new Date(refundResult.created_at * 1000).toISOString()
                },
                message: 'Payment refunded successfully',
            });
        } catch (error) {
            console.error('Error refunding payment:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to refund payment', 500);
        }
    }

    /**
     * Update payment details (admin only)
     */
    async updatePaymentStatus(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Payment ID is required', 400);
            }

            const paymentId = parseInt(id);
            if (isNaN(paymentId)) {
                return errorResponse('Invalid payment ID', 400);
            }

            const data = await request.json() as {
                status: PaymentStatus;
                transactionId?: string;
                paymentDetails?: string;
            };
            const { status, transactionId, paymentDetails } = data;

            if (!status || !['pending', 'processing', 'completed', 'failed', 'refunded'].includes(status)) {
                return errorResponse('Invalid status. Must be one of: pending, processing, completed, failed, refunded', 400);
            }

            // Update payment status
            await this.paymentRepository.updatePaymentStatus(
                paymentId,
                status,
                transactionId,
                paymentDetails
            );

            // Get the updated payment
            const updatedPayment = await this.paymentRepository.findById(paymentId.toString());

            return successResponse(updatedPayment);
        } catch (error) {
            console.error('Error updating payment status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update payment status', 500);
        }
    }
}