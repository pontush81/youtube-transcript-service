/**
 * Environment variable validation.
 * Import the getter functions instead of accessing process.env directly
 * to get clear errors at call-time rather than cryptic runtime failures.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Returns STRIPE_SECRET_KEY or throws with a clear error */
export function getStripeSecretKey(): string {
  return requireEnv('STRIPE_SECRET_KEY');
}

/** Returns STRIPE_PRICE_PRO or throws with a clear error */
export function getStripePricePro(): string {
  return requireEnv('STRIPE_PRICE_PRO');
}

/** Returns OPENAI_API_KEY or throws with a clear error */
export function getOpenAIApiKey(): string {
  return requireEnv('OPENAI_API_KEY');
}
