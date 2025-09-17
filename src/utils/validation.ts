/**
 * Validation utility functions
 */
import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Password validation schema
 * Requires at least 8 characters, one uppercase, one lowercase, one number
 */
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .refine(
        (password) => /[A-Z]/.test(password),
        'Password must contain at least one uppercase letter'
    )
    .refine(
        (password) => /[a-z]/.test(password),
        'Password must contain at least one lowercase letter'
    )
    .refine(
        (password) => /\d/.test(password),
        'Password must contain at least one number'
    );

/**
 * Phone number validation schema
 * Basic international phone format
 */
export const phoneSchema = z
    .string()
    .regex(
        /^\+?[1-9]\d{1,14}$/,
        'Invalid phone number. Please use international format (e.g., +1234567890)'
    )
    .optional()
    .nullable();

/**
 * URL validation schema
 */
export const urlSchema = z.string().url('Invalid URL');

/**
 * Postal code validation schema
 * Basic format, can be customized per country
 */
export const postalCodeSchema = z
    .string()
    .min(3, 'Postal code is too short')
    .max(10, 'Postal code is too long');

/**
 * Country code validation schema
 * ISO 3166-1 alpha-2 codes
 */
export const countryCodeSchema = z
    .string()
    .length(2, 'Country code must be 2 characters')
    .regex(/^[A-Z]{2}$/, 'Country code must be 2 uppercase letters');

/**
 * UUID validation schema
 */
export const uuidSchema = z
    .string()
    .uuid('Invalid UUID format');

/**
 * Price validation schema
 * Positive number with up to 2 decimal places
 */
export const priceSchema = z
    .number()
    .nonnegative('Price must be a non-negative number')
    .refine(
        (price) => {
            const str = price.toString();
            const decimal = str.includes('.') ? str.split('.')[1] : '';
            return decimal.length <= 2;
        },
        'Price must have at most 2 decimal places'
    );

/**
 * Slug validation schema
 * Lowercase letters, numbers, and hyphens
 */
export const slugSchema = z
    .string()
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must contain only lowercase letters, numbers, and hyphens'
    );

/**
 * Validate an email address
 * @param email Email to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
    const result = emailSchema.safeParse(email);
    return result.success;
}

/**
 * Validate a password
 * @param password Password to validate
 * @returns True if valid, false otherwise
 */
export function isValidPassword(password: string): boolean {
    const result = passwordSchema.safeParse(password);
    return result.success;
}

/**
 * Generate a slug from a string
 * @param text Text to convert to slug
 * @returns Slugified string
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word chars
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}