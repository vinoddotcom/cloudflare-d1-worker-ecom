import { Env } from '../models/common.model';

/**
 * Interface for Razorpay Order Request
 */
export interface RazorpayOrderRequest {
    amount: number; // amount in smallest currency unit (paise for INR)
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
}

/**
 * Interface for Razorpay Order Response
 */
export interface RazorpayOrderResponse {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    status: string;
    attempts: number;
    notes: Record<string, string>;
    created_at: number;
}

/**
 * Interface for Payment Verification Request
 */
export interface PaymentVerificationRequest {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

/**
 * Service for Razorpay payment gateway integration
 */
export class RazorpayService {
    private baseUrl = 'https://api.razorpay.com/v1';
    private keyId: string;
    private keySecret: string;
    public isEnabled: boolean;

    // Utility function for handling Razorpay API errors
    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const errorData = await response.json() as {
                error?: { description?: string }
            };
            throw new Error(`Razorpay API error: ${errorData.error?.description || response.statusText}`);
        }
        const responseData = await response.json();
        return responseData as T;
    }

    constructor(env: Env) {
        this.keyId = env.RAZORPAY_KEY_ID;
        this.keySecret = env.RAZORPAY_KEY_SECRET;

        if (!this.keyId || !this.keySecret) {
            this.isEnabled = false;
            // console.error('Razorpay API keys are not configured properly');
        } else {
            this.isEnabled = true;
        }
    }

    /**
     * Create a new order in Razorpay
     * @param orderData Order data
     * @returns Created order from Razorpay
     */
    async createOrder(orderData: RazorpayOrderRequest): Promise<RazorpayOrderResponse> {
        if (!this.isEnabled) {
            return {
                id: 'mock_order_id',
                entity: 'order',
                amount: orderData.amount,
                amount_paid: 0,
                amount_due: orderData.amount,
                currency: orderData.currency,
                receipt: orderData.receipt,
                status: 'created',
                attempts: 0,
                notes: orderData.notes || {},
                created_at: Math.floor(Date.now() / 1000),
            };
        }
        try {
            const response = await fetch(`${this.baseUrl}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`
                },
                body: JSON.stringify(orderData)
            });

            return await this.handleResponse<RazorpayOrderResponse>(response);
        } catch (error) {
            console.error('Error creating Razorpay order:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to create Razorpay order');
        }
    }

    /**
     * Fetch order details from Razorpay
     * @param orderId Razorpay order ID
     * @returns Order details
     */
    async fetchOrder(orderId: string): Promise<RazorpayOrderResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`
                }
            });

            return await this.handleResponse<RazorpayOrderResponse>(response);
        } catch (error) {
            console.error('Error fetching Razorpay order:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to fetch Razorpay order');
        }
    }

    /**
     * Fetch payment details from Razorpay
     * @param paymentId Razorpay payment ID
     * @returns Payment details
     */
    async fetchPayment(paymentId: string): Promise<Record<string, any>> {
        try {
            const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`
                }
            });

            return await this.handleResponse<Record<string, any>>(response);
        } catch (error) {
            console.error('Error fetching Razorpay payment:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to fetch Razorpay payment');
        }
    }

    /**
     * Verify Razorpay payment signature
     * @param paymentData Payment verification data
     * @returns Boolean indicating if signature is valid
     */
    async verifyPaymentSignature(paymentData: PaymentVerificationRequest): Promise<boolean> {
        try {
            // Convert the key to a format that can be used with Web Crypto API
            const encoder = new TextEncoder();
            const keyData = encoder.encode(this.keySecret);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );

            // Create the data to sign (order_id|payment_id)
            const dataToSign = encoder.encode(
                `${paymentData.razorpay_order_id}|${paymentData.razorpay_payment_id}`
            );

            // Sign the data
            const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);

            // Convert the signature to hex
            const signatureArray = Array.from(new Uint8Array(signature));
            const generatedSignature = signatureArray
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            return generatedSignature === paymentData.razorpay_signature;
        } catch (error) {
            console.error('Error verifying Razorpay signature:', error);
            return false;
        }
    }

    /**
     * Initiate a refund for a payment
     * @param paymentId Razorpay payment ID
     * @param amount Amount to refund (in smallest currency unit)
     * @returns Refund details
     */
    async createRefund(paymentId: string, amount?: number): Promise<Record<string, any>> {
        try {
            const body = amount ? { amount } : {};

            const response = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`
                },
                body: JSON.stringify(body)
            });

            return await this.handleResponse<Record<string, any>>(response);
        } catch (error) {
            console.error('Error creating Razorpay refund:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to create Razorpay refund');
        }
    }

    /**
     * Fetch refund details
     * @param refundId Razorpay refund ID
     * @returns Refund details
     */
    async fetchRefund(refundId: string): Promise<Record<string, any>> {
        try {
            const response = await fetch(`${this.baseUrl}/refunds/${refundId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`
                }
            });

            return await this.handleResponse<Record<string, any>>(response);
        } catch (error) {
            console.error('Error fetching Razorpay refund:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to fetch Razorpay refund');
        }
    }

    /**
     * Get client-side configuration for Razorpay checkout
     * @returns Configuration object for front-end
     */
    getClientConfig(): { key_id: string } {
        return {
            key_id: this.keyId
        };
    }
}