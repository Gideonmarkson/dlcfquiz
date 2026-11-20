import crypto from 'crypto';
import { cookies } from 'next/headers';

export const HOST_COOKIE_NAME = 'dlcf_host_secret';

/**
 * Generate a 256-bit cryptographically secure host secret hex token
 */
export function generateHostSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute SHA-256 hash of the host secret
 */
export function hashHostSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Constant-time comparison between stored SHA-256 hash and incoming secret
 */
export function verifyHostSecret(secret: string, expectedHash: string): boolean {
  try {
    const computedHash = hashHostSecret(secret);
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Extract host secret from cookies or request headers
 */
export async function getHostSecretFromRequest(req?: Request): Promise<{
  secret: string | null;
  recoveryCode: string | null;
}> {
  let secret: string | null = null;
  let recoveryCode: string | null = null;

  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(HOST_COOKIE_NAME)?.value;
    if (cookieVal) secret = cookieVal;
  } catch {
    // If running outside Next.js cookies context, check headers
  }

  if (req) {
    const headerSecret = req.headers.get('x-host-secret');
    if (headerSecret) secret = headerSecret;

    const headerRecovery = req.headers.get('x-host-recovery-key');
    if (headerRecovery) recoveryCode = headerRecovery.trim().toUpperCase();
  }

  return { secret, recoveryCode };
}
