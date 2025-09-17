import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { errorResponse, successResponse } from '../utils/response';
import { PaymentRepository } from '../data/repositories/payment.repository';
import { OrderRepository } from '../data/repositories/order.repository';
import { RazorpayService } from '../services/razorpay.service';

/**
 * Controller for handling webhook events from payment providers
 */
export class WebhookController {
    private paymentRepository: PaymentRepository;
    private orderRepository: OrderRepository;
    private razorpayService: RazorpayService;

    constructor(private env: Env) {
        this.paymentRepository = new PaymentRepository(env);
        this.orderRepository = new OrderRepository(env);
        this.razorpayService = new RazorpayService(env);
    }

    /**
     * Handle Razorpay webhook events
     */
    async handleRazorpayWebhook(request: IRequest): Promise<Response> {
        try {
            // Get the event data
            const data = await request.json() as {
                event: string;
                payload: {
                    payment?: {
                        entity: {
                            id: string;
                            order_id: string;
                            notes?: Record<string, string>;
                            error_description?: string;
                        }
                    };
                    refund?: {
                        entity: {
                            id: string;
                            payment_id: string;
                        }
                    }
                }
            };
            console.log('Received Razorpay webhook:', data);

            // Verify webhook signature if provided
            const signature = request.headers.get('x-razorpay-signature');

            if (signature && this.env.RAZORPAY_WEBHOOK_SECRET) {
                // Convert the key to a format that can be used with Web Crypto API
                const encoder = new TextEncoder();
                const keyData = encoder.encode(this.env.RAZORPAY_WEBHOOK_SECRET);
                const cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    keyData,
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                );

                // Create the data to sign (the raw body)
                const rawBody = await request.text();
                const dataToSign = encoder.encode(rawBody);

                // Sign the data
                const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);

                // Convert the signature to hex
                const signatureArray = Array.from(new Uint8Array(signatureBuffer));
                const generatedSignature = signatureArray
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                if (generatedSignature !== signature) {
                    console.error('Invalid webhook signature');
                    return errorResponse('Invalid webhook signature', 401);
                }
            }

            // Process the event based on the event type
            const event = data.event;

            if ((event === 'payment.authorized' || event === 'payment.captured') && data.payload.payment) {
                // Handle successful payment
                const paymentId = data.payload.payment.entity.id;
                const orderId = data.payload.payment.entity.order_id;
                const notes = data.payload.payment.entity.notes || {};
                const ourOrderId = notes.order_id;
                const ourPaymentId = notes.payment_id;

                if (ourOrderId && ourPaymentId) {
                    try {
                        // Verify the payment
                        const paymentData = await this.razorpayService.fetchPayment(paymentId);

                        // Update our payment record
                        await this.paymentRepository.updatePaymentStatus(
                            parseInt(ourPaymentId),
                            'completed',
                            paymentId,
                            JSON.stringify({
                                razorpay_order_id: orderId,
                                razorpay_payment_id: paymentId,
                                payment_details: paymentData,
                                webhook_event: event,
                                webhook_received_at: new Date().toISOString()
                            })
                        );

                        console.log('Payment updated from webhook:', ourPaymentId);
                    } catch (error) {
                        console.error('Error processing webhook payment update:', error);
                    }
                }
            }
            else if (event === 'payment.failed' && data.payload.payment) {
                // Handle failed payment
                const paymentId = data.payload.payment.entity.id;
                const orderId = data.payload.payment.entity.order_id;
                const notes = data.payload.payment.entity.notes || {};
                const ourOrderId = notes.order_id;
                const ourPaymentId = notes.payment_id;

                if (ourOrderId && ourPaymentId) {
                    try {
                        // Update our payment record
                        await this.paymentRepository.updatePaymentStatus(
                            parseInt(ourPaymentId),
                            'failed',
                            paymentId,
                            JSON.stringify({
                                razorpay_order_id: orderId,
                                razorpay_payment_id: paymentId,
                                // No payment details for failed payments
                                error: data.payload.payment?.entity.error_description || 'Payment failed',
                                webhook_event: event,
                                webhook_received_at: new Date().toISOString()
                            })
                        );

                        console.log('Payment failure recorded from webhook:', ourPaymentId);
                    } catch (error) {
                        console.error('Error processing webhook payment failure:', error);
                    }
                }
            }
            else if (event === 'refund.processed' && data.payload.refund) {
                // Handle refund processing
                const refundId = data.payload.refund.entity.id;
                const paymentId = data.payload.refund.entity.payment_id;

                // Find our payment by Razorpay payment ID
                const paymentQuery = await this.env.DB.prepare(`
                    SELECT id FROM payments WHERE transaction_id = ?
                `).bind(paymentId).first<{ id: number }>();

                if (paymentQuery) {
                    try {
                        // Get refund details
                        const refundData = await this.razorpayService.fetchRefund(refundId);

                        // Update our payment record
                        await this.paymentRepository.updatePaymentStatus(
                            paymentQuery.id,
                            'refunded',
                            paymentId,
                            JSON.stringify({
                                razorpay_refund_id: refundId,
                                refund_details: refundData,
                                webhook_event: event,
                                webhook_received_at: new Date().toISOString()
                            })
                        );

                        console.log('Refund processed from webhook:', refundId);
                    } catch (error) {
                        console.error('Error processing webhook refund:', error);
                    }
                }
            }

            // Always return a 200 response to acknowledge receipt
            return successResponse({
                received: true,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error handling Razorpay webhook:', error);
            // Still return 200 to prevent retries
            return successResponse({
                received: true,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    }
}