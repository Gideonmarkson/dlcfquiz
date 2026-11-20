import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit numeric PIN (e.g. "482917")
 */
export function generateRoomPin(): string {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, '0');
}

/**
 * Generates a cryptographically secure 8-character uppercase recovery code (e.g. "K7M9P2X4")
 */
export function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes confusing characters O, 0, 1, I
  let result = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
