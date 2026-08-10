import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_oil_mart_key_123!';

export function signToken(payload: object, expiresIn: string = '1d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as SignOptions['expiresIn'] });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
