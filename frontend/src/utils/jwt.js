/**
 * Safely decode the payload of a JWT token without verification.
 * JWTs are base64url-encoded JSON, so this is just parsing.
 */
export function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode → base64 → string → JSON
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Get the number of milliseconds until the JWT expires.
 * Returns 0 if the token is invalid or already expired.
 */
export function getMsUntilExpiry(token) {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return 0;
  const expiryMs = decoded.exp * 1000; // exp is in seconds
  const remaining = expiryMs - Date.now();
  return Math.max(0, remaining);
}
