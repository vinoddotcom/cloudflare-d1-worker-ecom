import { Env } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Payment, PaymentStatus } from '../../models/order.model';
import { RazorpayService } from '../../services/razorpay.service';

/**
 * Repository for payment-related database operations
 */
export class PaymentRepository extends BaseRepository<Payment> {
    private razorpayService: RazorpayService;

    constructor(private env: Env) {
        super(env.DB, 'payments');
        this.razorpayService = new RazorpayService(env);
    }

    /**
     * Create a new payment for an order
     * @param data Payment data
     * @returns The created payment
     */
    async createPayment(data: {
        orderId: number;
        amount: number;
        paymentMethod: string;
        status?: PaymentStatus;
        transactionId?: string;
        paymentDetails?: string;
    }): Promise<Payment> {
        try {
            const now = new Date().toISOString();
            const {
                orderId,
                amount,
                paymentMethod,
                status = 'pending',
                transactionId,
                paymentDetails,
            } = data;

            // Check if payment already exists for this order
            const existingPayment = await this.db.prepare(`
        SELECT id FROM payments WHERE order_id = ?
      `).bind(orderId).first();

            if (existingPayment) {
                throw new Error(`Payment already exists for order ${orderId}`);
            }

            // Create payment
            const query = `
        INSERT INTO payments (
          order_id,
          amount,
          payment_method,
          status,
          transaction_id,
          payment_details,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const result = await this.db.prepare(query).bind(
                orderId,
                amount,
                paymentMethod,
                status,
                transactionId || null,
                paymentDetails || null,
                now,
                now
            ).run();

            if (!result.success) {
                throw new Error('Failed to create payment');
            }

            // If payment is completed, update order status
            if (status === 'completed') {
                await this.db.prepare(`
          UPDATE orders
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).bind('processing', now, orderId).run();

                // Add status history entry
                await this.db.prepare(`
          INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
                    orderId,
                    'processing',
                    'Payment completed',
                    'system',
                    now
                ).run();
            }

            // Return the created payment
            return this.getPaymentByOrderId(orderId);
        } catch (error) {
            console.error('Error creating payment:', error);
            throw error;
        }
    }

    /**
     * Get payment by order ID
     * @param orderId Order ID
     * @returns Payment information
     */
    async getPaymentByOrderId(orderId: number): Promise<Payment> {
        try {
            const payment = await this.db.prepare(`
        SELECT * FROM payments WHERE order_id = ?
      `).bind(orderId).first<Payment>();

            if (!payment) {
                throw new Error(`No payment found for order ${orderId}`);
            }

            return payment;
        } catch (error) {
            console.error('Error fetching payment:', error);
            throw error;
        }
    }

    /**
     * Update payment status
     * @param paymentId Payment ID
     * @param status New payment status
     * @param transactionId Optional transaction ID
     * @param paymentDetails Optional payment details
     * @returns Updated payment
     */
    async updatePaymentStatus(
        paymentId: number,
        status: PaymentStatus,
        transactionId?: string,
        paymentDetails?: string
    ): Promise<Payment> {
        try {
            const now = new Date().toISOString();

            // Build update query
            let query = `
        UPDATE payments
        SET status = ?, updated_at = ?
      `;
            const params = [status, now];

            // Add optional parameters if provided
            if (transactionId !== undefined) {
                query += `, transaction_id = ?`;
                params.push(transactionId);
            }

            if (paymentDetails !== undefined) {
                query += `, payment_details = ?`;
                params.push(paymentDetails);
            }

            query += ` WHERE id = ?`;
            params.push(paymentId.toString());

            // Execute update
            await this.db.prepare(query).bind(...params).run();

            // Get the updated payment
            const payment = await this.findById(paymentId);
            if (!payment) {
                throw new Error(`Payment with ID ${paymentId} not found`);
            }

            // If payment status is completed, update order status to processing
            if (status === 'completed') {
                // Get the order ID
                await this.db.prepare(`
          UPDATE orders
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).bind('processing', now, payment.order_id).run();

                // Add status history entry
                await this.db.prepare(`
          INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
                    payment.order_id,
                    'processing',
                    'Payment completed',
                    'system',
                    now
                ).run();
            }

            // If payment status is refunded, update order status to refunded
            else if (status === 'refunded') {
                await this.db.prepare(`
          UPDATE orders
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).bind('refunded', now, payment.order_id).run();

                // Add status history entry
                await this.db.prepare(`
          INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
                    payment.order_id,
                    'refunded',
                    'Payment refunded',
                    'system',
                    now
                ).run();
            }

            return payment;
        } catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }

    /**
     * Process payment through the Razorpay gateway
     * @param paymentId Payment ID in our system
     * @param paymentDetails Payment gateway-specific details
     * @returns Processing result
     */
    async processPayment(
        paymentId: number,
        paymentDetails: Record<string, any>
    ): Promise<{ success: boolean; transactionId?: string; error?: string; orderId?: string; paymentUrl?: string }> {
        try {
            // Get payment information
            const payment = await this.findById(paymentId.toString());
            if (!payment) {
                throw new Error(`Payment with ID ${paymentId} not found`);
            }

            // Get the order details for this payment
            const order = await this.db.prepare(`
                SELECT * FROM orders WHERE id = ?
            `).bind(payment.order_id).first<any>();

            if (!order) {
                throw new Error(`Order with ID ${payment.order_id} not found`);
            }

            // Check payment initiation type:
            // 1. Create new Razorpay order (initial request)
            // 2. Verify payment completion (callback from payment gateway)
            if (paymentDetails.action === 'create_order') {
                // Create a new order in Razorpay
                const razorpayOrderData = {
                    amount: Math.round(payment.amount * 100), // Convert to paise (smallest INR unit)
                    currency: 'INR', // Default currency is INR
                    receipt: `order_${payment.order_id}`,
                    notes: {
                        order_id: payment.order_id.toString(),
                        payment_id: paymentId.toString(),
                        customer_email: paymentDetails.email,
                        customer_name: paymentDetails.name
                    }
                };

                // Create Razorpay order
                const razorpayOrder = await this.razorpayService.createOrder(razorpayOrderData);

                // Update payment with Razorpay order ID
                await this.updatePaymentStatus(
                    paymentId,
                    'processing',
                    undefined,
                    JSON.stringify({
                        ...paymentDetails,
                        razorpay_order_id: razorpayOrder.id,
                        created_at: new Date().toISOString()
                    })
                );

                // Return payment initiation details for frontend
                return {
                    success: true,
                    orderId: razorpayOrder.id,
                    transactionId: razorpayOrder.id, // Use Razorpay order ID as transaction ID initially
                    paymentUrl: `https://api.razorpay.com/v1/checkout/embedded`,
                };
            }
            // Verify payment callback
            else if (
                paymentDetails.razorpay_payment_id &&
                paymentDetails.razorpay_order_id &&
                paymentDetails.razorpay_signature
            ) {
                // Verify the payment signature
                const isValid = await this.razorpayService.verifyPaymentSignature({
                    razorpay_payment_id: paymentDetails.razorpay_payment_id,
                    razorpay_order_id: paymentDetails.razorpay_order_id,
                    razorpay_signature: paymentDetails.razorpay_signature
                });

                if (!isValid) {
                    // Payment verification failed - update status
                    await this.updatePaymentStatus(
                        paymentId,
                        'failed',
                        undefined,
                        JSON.stringify({
                            ...paymentDetails,
                            error: 'Payment signature verification failed',
                            verified_at: new Date().toISOString()
                        })
                    );

                    return {
                        success: false,
                        error: 'Payment verification failed'
                    };
                }

                // Payment verification succeeded - fetch payment details from Razorpay
                const razorpayPayment = await this.razorpayService.fetchPayment(
                    paymentDetails.razorpay_payment_id
                );

                // Update payment with success status
                await this.updatePaymentStatus(
                    paymentId,
                    'completed',
                    paymentDetails.razorpay_payment_id,
                    JSON.stringify({
                        ...paymentDetails,
                        payment_details: razorpayPayment,
                        verified_at: new Date().toISOString()
                    })
                );

                return {
                    success: true,
                    transactionId: paymentDetails.razorpay_payment_id
                };
            }
            else {
                throw new Error('Invalid payment details provided');
            }
        } catch (error) {
            console.error('Error processing payment with Razorpay:', error);

            // Update payment status to failed
            try {
                await this.updatePaymentStatus(
                    paymentId,
                    'failed',
                    undefined,
                    JSON.stringify({
                        error: error instanceof Error ? error.message : 'Unknown payment error',
                        timestamp: new Date().toISOString()
                    })
                );
            } catch (updateError) {
                console.error('Error updating payment status:', updateError);
            }

            throw error;
        }
    }
}