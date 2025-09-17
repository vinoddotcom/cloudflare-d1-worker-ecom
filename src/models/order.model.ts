import { BaseModel } from './common.model';
import { Address } from './user.model';
import { ProductVariant } from './product.model';

/**
 * Order Status Types
 */
export type OrderStatus =
    | 'pending'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';

/**
 * Order Interface
 */
export interface Order extends BaseModel {
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
    notes?: string;
    items?: OrderItem[];
    shipping_address?: Address;
    billing_address?: Address;
    status_history?: OrderStatusHistory[];
    payment?: Payment;
    invoice?: Invoice;
}

/**
 * Order Create Input
 */
export interface OrderCreateInput {
    user_id: string;
    cart_id: string;
    shipping_address_id: number;
    billing_address_id: number;
    shipping_method: string;
    payment_method: string;
    notes?: string;
}

/**
 * Order Update Input
 */
export interface OrderUpdateInput {
    status?: OrderStatus;
    shipping_method?: string;
    payment_method?: string;
    notes?: string;
}

/**
 * Order Item Interface
 */
export interface OrderItem extends BaseModel {
    id: number;
    order_id: number;
    product_variant_id: number;
    quantity: number;
    price: number;
    product_name: string;
    variant_name: string;
    sku: string;
    product_variant?: ProductVariant;
}

/**
 * Order Status History Interface
 */
export interface OrderStatusHistory extends BaseModel {
    id: number;
    order_id: number;
    status: OrderStatus;
    notes?: string;
    created_by: string;
}

/**
 * Payment Status Types
 */
export type PaymentStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded';

/**
 * Payment Interface
 */
export interface Payment extends BaseModel {
    id: number;
    order_id: number;
    amount: number;
    payment_method: string;
    status: PaymentStatus;
    transaction_id?: string;
    payment_details?: string;
}

/**
 * Payment Create Input
 */
export interface PaymentCreateInput {
    order_id: number;
    amount: number;
    payment_method: string;
    transaction_id?: string;
    payment_details?: string;
}

/**
 * Payment Update Input
 */
export interface PaymentUpdateInput {
    status?: PaymentStatus;
    transaction_id?: string;
    payment_details?: string;
}

/**
 * Invoice Status Types
 */
export type InvoiceStatus =
    | 'issued'
    | 'paid'
    | 'cancelled'
    | 'refunded';

/**
 * Invoice Interface
 */
export interface Invoice extends BaseModel {
    id: number;
    invoice_number: string;
    order_id: number;
    issue_date: number;
    due_date: number;
    status: InvoiceStatus;
    amount: number;
    tax_amount: number;
    total_amount: number;
}

/**
 * Invoice Create Input
 */
export interface InvoiceCreateInput {
    order_id: number;
    issue_date: number;
    due_date: number;
}

/**
 * Invoice Update Input
 */
export interface InvoiceUpdateInput {
    status?: InvoiceStatus;
}

/**
 * Shipping Method Interface
 */
export interface ShippingMethod extends BaseModel {
    id: number;
    name: string;
    description?: string;
    base_price: number;
    is_active: boolean;
    estimated_days?: number;
}

/**
 * Shipping Method Create Input
 */
export interface ShippingMethodCreateInput {
    name: string;
    description?: string;
    base_price: number;
    is_active?: boolean;
    estimated_days?: number;
}

/**
 * Shipping Method Update Input
 */
export interface ShippingMethodUpdateInput {
    name?: string;
    description?: string;
    base_price?: number;
    is_active?: boolean;
    estimated_days?: number;
}

/**
 * Shipping Cost Calculation Input
 */
export interface ShippingCostCalculationInput {
    shipping_method_id: number;
    address_id: number;
    items: {
        product_variant_id: number;
        quantity: number;
    }[];
}