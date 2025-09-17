/**
 * Input validation helper for controllers
 */
export interface ValidationField {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean;
}

export interface ValidationResult {
    valid: boolean;
    message: string;
}

/**
 * Validates input data against defined field requirements
 */
export function validateInput(data: any, fields: ValidationField[]): ValidationResult {
    if (!data || typeof data !== 'object') {
        return {
            valid: false,
            message: 'Invalid input data'
        };
    }

    for (const field of fields) {
        // Check required fields
        if (field.required && (data[field.field] === undefined || data[field.field] === null)) {
            return {
                valid: false,
                message: `${field.field} is required`
            };
        }

        // Skip validation if field is not required and not provided
        if (!field.required && (data[field.field] === undefined || data[field.field] === null)) {
            continue;
        }

        // Type validation
        const value = data[field.field];

        switch (field.type) {
            case 'string':
                if (typeof value !== 'string') {
                    return {
                        valid: false,
                        message: `${field.field} must be a string`
                    };
                }

                // String specific validations
                if (field.minLength !== undefined && value.length < field.minLength) {
                    return {
                        valid: false,
                        message: `${field.field} must be at least ${field.minLength} characters long`
                    };
                }

                if (field.maxLength !== undefined && value.length > field.maxLength) {
                    return {
                        valid: false,
                        message: `${field.field} must be at most ${field.maxLength} characters long`
                    };
                }

                if (field.pattern && !field.pattern.test(value)) {
                    return {
                        valid: false,
                        message: `${field.field} has an invalid format`
                    };
                }
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return {
                        valid: false,
                        message: `${field.field} must be a number`
                    };
                }

                // Number specific validations
                if (field.minValue !== undefined && value < field.minValue) {
                    return {
                        valid: false,
                        message: `${field.field} must be at least ${field.minValue}`
                    };
                }

                if (field.maxValue !== undefined && value > field.maxValue) {
                    return {
                        valid: false,
                        message: `${field.field} must be at most ${field.maxValue}`
                    };
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    return {
                        valid: false,
                        message: `${field.field} must be a boolean`
                    };
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    return {
                        valid: false,
                        message: `${field.field} must be an array`
                    };
                }

                // Array specific validations
                if (field.minLength !== undefined && value.length < field.minLength) {
                    return {
                        valid: false,
                        message: `${field.field} must contain at least ${field.minLength} items`
                    };
                }

                if (field.maxLength !== undefined && value.length > field.maxLength) {
                    return {
                        valid: false,
                        message: `${field.field} must contain at most ${field.maxLength} items`
                    };
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                    return {
                        valid: false,
                        message: `${field.field} must be an object`
                    };
                }
                break;
        }

        // Custom validator if provided
        if (field.customValidator && !field.customValidator(value)) {
            return {
                valid: false,
                message: `${field.field} failed validation`
            };
        }
    }

    return { valid: true, message: 'Validation successful' };
}