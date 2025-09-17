import { BaseModel } from './common.model';
import { ProductVariant } from './product.model';

/**
 * Cart Interface
 */
export interface Cart extends BaseModel {
    id: string;
    user_id?: string;
    guest_token?: string;
    items?: CartItem[];
    total?: number;
}

/**
 * Cart Create Input
 */
export interface CartCreateInput {
    user_id?: string;
    guest_token?: string;
}

/**
 * Cart Item Interface
 */
export interface CartItem extends BaseModel {
    id: number;
    cart_id: string;
    product_variant_id: number;
    quantity: number;
    price: number;
    product_variant?: ProductVariant;
}

/**
 * Cart Item Create Input
 */
export interface CartItemCreateInput {
    cart_id: string;
    product_variant_id: number;
    quantity: number;
    price: number;
}

/**
 * Cart Item Update Input
 */
export interface CartItemUpdateInput {
    quantity?: number;
}

/**
 * Cart Summary Interface
 */
export interface CartSummary {
    subtotal: number;
    total_items: number;
    cart_id: string;
}