import jwt from 'jsonwebtoken';
import { config } from '../config';

interface SessionClaims {
  sub: string; // user id
}

// Issue a session token for a verified user.
export function signSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies SessionClaims, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

// Returns the user id for a valid token, or null for missing/invalid/expired.
export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as SessionClaims;
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
}

// Pull a bearer token out of an Authorization header.
export function bearerFrom(header: string | undefined | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1]!.trim() : null;
}
