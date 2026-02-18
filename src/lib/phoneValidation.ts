/**
 * Validates Indian phone numbers
 * Format: 10 digits starting with 6, 7, 8, or 9
 * Examples: 9876543210, 8123456789, 7012345678, 6234567890
 */
export function validateIndianPhoneNumber(phone: string): {
    isValid: boolean;
    formatted?: string;
    error?: string;
} {
    if (!phone || phone.trim() === '') {
        return { isValid: true }; // Allow empty for optional fields
    }

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if it's exactly 10 digits
    if (cleaned.length !== 10) {
        return {
            isValid: false,
            error: 'Phone number must be exactly 10 digits'
        };
    }

    // Check if it starts with 6, 7, 8, or 9
    const firstDigit = cleaned[0];
    if (!['6', '7', '8', '9'].includes(firstDigit)) {
        return {
            isValid: false,
            error: 'Phone number must start with 6, 7, 8, or 9'
        };
    }

    return {
        isValid: true,
        formatted: cleaned
    };
}

/**
 * Real-time validation for phone input (while typing)
 * Returns validation state for UI feedback
 */
export function validatePhoneRealtime(phone: string): {
    state: 'empty' | 'typing' | 'valid' | 'invalid';
    message?: string;
    cleaned: string;
} {
    const cleaned = phone.replace(/\D/g, '');

    if (!phone || phone.trim() === '') {
        return { state: 'empty', cleaned: '' };
    }

    // Still typing
    if (cleaned.length < 10) {
        return {
            state: 'typing',
            message: `${cleaned.length}/10 digits`,
            cleaned
        };
    }

    // Exactly 10 digits - validate
    if (cleaned.length === 10) {
        const firstDigit = cleaned[0];
        if (!['6', '7', '8', '9'].includes(firstDigit)) {
            return {
                state: 'invalid',
                message: 'Must start with 6, 7, 8, or 9',
                cleaned
            };
        }
        return {
            state: 'valid',
            message: '✓ Valid',
            cleaned
        };
    }

    // More than 10 digits
    return {
        state: 'invalid',
        message: 'Too many digits',
        cleaned
    };
}

/**
 * Formats Indian phone number for display
 * Example: 9876543210 -> +91 98765 43210
 */
export function formatIndianPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }

    return phone;
}

/**
 * Validates and formats phone number for storage
 * Returns the cleaned 10-digit number or throws error
 */
export function validateAndFormatPhone(phone: string, fieldName: string = 'Phone number'): string {
    const result = validateIndianPhoneNumber(phone);

    if (!result.isValid) {
        throw new Error(`${fieldName}: ${result.error}`);
    }

    return result.formatted || '';
}

/**
 * Get CSS classes for phone input based on validation state
 */
export function getPhoneInputClasses(state: 'empty' | 'typing' | 'valid' | 'invalid'): string {
    switch (state) {
        case 'valid':
            return 'border-green-500 focus-visible:ring-green-500';
        case 'invalid':
            return 'border-destructive focus-visible:ring-destructive';
        case 'typing':
            return 'border-blue-400 focus-visible:ring-blue-400';
        default:
            return '';
    }
}
