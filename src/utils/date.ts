/**
 * Date utility functions
 */

/**
 * Get current timestamp in milliseconds
 * @returns Current timestamp
 */
export function getCurrentTimestamp(): number {
    return Date.now();
}

/**
 * Format timestamp to ISO string
 * @param timestamp Timestamp in milliseconds
 * @returns ISO formatted date string
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Format timestamp to localized date string
 * @param timestamp Timestamp in milliseconds
 * @param locale Locale string (default: 'en-US')
 * @param options Date format options
 * @returns Formatted date string
 */
export function formatDate(
    timestamp: number,
    locale: string = 'en-US',
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }
): string {
    return new Date(timestamp).toLocaleDateString(locale, options);
}

/**
 * Format timestamp to localized time string
 * @param timestamp Timestamp in milliseconds
 * @param locale Locale string (default: 'en-US')
 * @param options Time format options
 * @returns Formatted time string
 */
export function formatTime(
    timestamp: number,
    locale: string = 'en-US',
    options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }
): string {
    return new Date(timestamp).toLocaleTimeString(locale, options);
}

/**
 * Format timestamp to localized date and time string
 * @param timestamp Timestamp in milliseconds
 * @param locale Locale string (default: 'en-US')
 * @param options DateTime format options
 * @returns Formatted date and time string
 */
export function formatDateTime(
    timestamp: number,
    locale: string = 'en-US',
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }
): string {
    return new Date(timestamp).toLocaleDateString(locale, options);
}

/**
 * Add days to a timestamp
 * @param timestamp Timestamp in milliseconds
 * @param days Number of days to add
 * @returns New timestamp
 */
export function addDays(timestamp: number, days: number): number {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + days);
    return date.getTime();
}

/**
 * Calculate difference in days between two timestamps
 * @param timestamp1 First timestamp
 * @param timestamp2 Second timestamp
 * @returns Number of days difference
 */
export function daysDifference(timestamp1: number, timestamp2: number): number {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const diffDays = Math.round(Math.abs((timestamp1 - timestamp2) / oneDay));
    return diffDays;
}