import { BaseModel } from './common.model';

/**
 * User Role Enum
 */
export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    CUSTOMER = 'customer'
}

/**
 * User Model Interface
 */
export interface User extends BaseModel {
    id: string; // Firebase UID
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: UserRole;
}

/**
 * User Create Input
 */
export interface UserCreateInput {
    id: string; // Firebase UID
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role?: UserRole;
}

/**
 * User Update Input
 */
export interface UserUpdateInput {
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: UserRole;
}

/**
 * User Address Interface
 */
export interface Address extends BaseModel {
    id: number;
    user_id: string;
    address_type: 'shipping' | 'billing' | 'both';
    is_default: boolean;
    name?: string;           // Contact person name
    phone?: string;          // Contact phone number
    address_line1: string;
    address_line2?: string;
    landmark?: string;       // Nearby landmark for easier delivery
    city: string;
    state: string;
    postal_code: string;
    country: string;
    street_address?: string; // Alternative for address_line1 (for delivery services)
    apartment_number?: string; // Alternative for address_line2
}

/**
 * Address Create Input
 */
export interface AddressCreateInput {
    user_id: string;
    address_type: 'shipping' | 'billing' | 'both';
    is_default?: boolean;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
}

/**
 * Address Update Input
 */
export interface AddressUpdateInput {
    address_type?: 'shipping' | 'billing' | 'both';
    is_default?: boolean;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}

/**
 * Auth Token Interface
 */
export interface AuthToken {
    uid: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}