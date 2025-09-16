/**
 * Validates if a string is a valid email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is a valid Solana wallet address
 * Solana addresses are base58 encoded and typically 32-44 characters long
 */
export function isValidSolanaWallet(wallet: string): boolean {
  // Basic validation for Solana wallet address
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(wallet);
}

/**
 * Validates if a string is a valid phone number
 * Accepts various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it starts with + and has 10-15 digits, or just has 10-15 digits
  const phoneRegex = /^(\+\d{10,15}|\d{10,15})$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validates user input for the new user endpoint
 */
export interface UserValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateUserInput(data: {
  email: string;
  fullName: string;
  phoneNumber?: string;
  solanaWallet: string;
}): UserValidationResult {
  const errors: string[] = [];

  // Validate email
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email address is required');
  }

  // Validate full name
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  // Validate phone number (optional)
  if (data.phoneNumber && !isValidPhoneNumber(data.phoneNumber)) {
    errors.push('Invalid phone number format');
  }

  // Validate Solana wallet
  if (!data.solanaWallet || !isValidSolanaWallet(data.solanaWallet)) {
    errors.push('Valid Solana wallet address is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
