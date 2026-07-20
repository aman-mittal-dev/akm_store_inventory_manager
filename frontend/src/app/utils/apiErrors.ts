/**
 * Turn raw API / network errors into short, user-facing copy.
 */
export function humanizeApiError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.trim() || fallback;

  if (/network|failed to fetch|load failed/i.test(msg)) {
    return "We could not reach the server. Check your connection and try again.";
  }
  if (/401|unauthorized|could not validate credentials|not authenticated/i.test(msg)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/403|forbidden/i.test(msg)) {
    return "You do not have permission to do that.";
  }
  if (/invalid email or password/i.test(msg)) {
    return "That email and password do not match. Try again or use Google.";
  }
  if (/google sign-in|continue with google/i.test(msg)) {
    return msg;
  }
  if (/email already registered/i.test(msg)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (/sku already exists/i.test(msg)) {
    return "That SKU is already used by another item. Pick a different SKU.";
  }
  if (/item not found/i.test(msg)) {
    return "That item could not be found. It may have been removed.";
  }
  if (/psycopg|undefinedcolumn|sqlalchemy|internal server/i.test(msg)) {
    return "Something went wrong on the server. Please try again in a moment.";
  }
  if (/image upload|not configured|aws_s3|s3 bucket|missing aws/i.test(msg)) {
    return msg.length < 280 ? msg : "Image upload is not set up on the server. Ask your admin to configure Amazon S3.";
  }

  if (msg.length > 220) {
    return fallback;
  }
  return msg;
}
