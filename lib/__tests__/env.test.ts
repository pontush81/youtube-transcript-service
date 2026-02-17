import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStripeSecretKey, getStripePricePro, getOpenAIApiKey } from '../env';

describe('env validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getStripeSecretKey', () => {
    it('returns key when set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
      expect(getStripeSecretKey()).toBe('sk_test_abc');
    });

    it('throws when missing', () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(() => getStripeSecretKey()).toThrow('Missing required environment variable: STRIPE_SECRET_KEY');
    });

    it('throws when empty string', () => {
      process.env.STRIPE_SECRET_KEY = '';
      expect(() => getStripeSecretKey()).toThrow('Missing required environment variable: STRIPE_SECRET_KEY');
    });
  });

  describe('getStripePricePro', () => {
    it('returns key when set', () => {
      process.env.STRIPE_PRICE_PRO = 'price_abc';
      expect(getStripePricePro()).toBe('price_abc');
    });

    it('throws when missing', () => {
      delete process.env.STRIPE_PRICE_PRO;
      expect(() => getStripePricePro()).toThrow('Missing required environment variable: STRIPE_PRICE_PRO');
    });
  });

  describe('getOpenAIApiKey', () => {
    it('returns key when set', () => {
      process.env.OPENAI_API_KEY = 'sk-abc123';
      expect(getOpenAIApiKey()).toBe('sk-abc123');
    });

    it('throws when missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => getOpenAIApiKey()).toThrow('Missing required environment variable: OPENAI_API_KEY');
    });
  });
});
