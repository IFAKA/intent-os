import { describe, expect, it } from 'vitest';
import { cartSchema, loginSchema } from '../lib/validation';

describe('baseline security contracts', () => {
  it('rejects client price fields and invalid quantities', () => {
    expect(() => cartSchema.parse({ productId: '01', quantity: 0, price: 0 })).toThrow();
  });
  it('validates account email', () => {
    expect(loginSchema.parse({ email: 'person@example.com' }).email).toBe('person@example.com');
  });
});
