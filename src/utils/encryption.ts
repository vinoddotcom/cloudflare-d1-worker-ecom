/**
 * Encryption utility functions for secure data handling
 */

/**
 * Generate a random string of specified length
 * @param length Length of the string (default: 32)
 * @returns Random string
 */
export function generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const values = new Uint8Array(length);

    crypto.getRandomValues(values);

    for (let i = 0; i < length; i++) {
        result += chars.charAt(values[i] % chars.length);
    }

    return result;
}

/**
 * Hash data using SHA-256
 * @param data Data to hash
 * @returns Hex string of the hash
 */
export async function hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);

    // Convert to hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate an order number with prefix and random component
 * @param prefix Prefix for the order number (default: 'ORD')
 * @returns Order number string
 */
export function generateOrderNumber(prefix: string = 'ORD'): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate an invoice number with prefix and timestamp
 * @param prefix Prefix for the invoice number (default: 'INV')
 * @returns Invoice number string
 */
export function generateInvoiceNumber(prefix: string = 'INV'): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Mask sensitive data for logging
 * @param data Data to mask (e.g., email, credit card)
 * @param type Type of data to mask
 * @returns Masked string
 */
export function maskSensitiveData(
    data: string,
    type: 'email' | 'creditCard' | 'phone' | 'generic'
): string {
    if (!data) return '';

    switch (type) {
        case 'email':
            // Show first 2 chars and domain, mask the rest
            const [username, domain] = data.split('@');
            if (!domain) return data.substring(0, 2) + '***';
            return username.substring(0, 2) + '***@' + domain;

        case 'creditCard':
            // Show last 4 digits only
            return data.replace(/\s/g, '').slice(-4).padStart(data.length, '*');

        case 'phone':
            // Show last 4 digits only
            return data.replace(/\s/g, '').slice(-4).padStart(data.length, '*');

        case 'generic':
        default:
            // Mask middle portion
            if (data.length <= 4) return '****';
            return data.substring(0, 2) + '***' + data.substring(data.length - 2);
    }
}