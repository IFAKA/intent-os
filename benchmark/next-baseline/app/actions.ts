'use server';

import { cartSchema, loginSchema } from '@/lib/validation';
import { rotateSession } from '@/lib/session';

export async function addToCart(input: { productId: string; quantity: number }) {
  const parsed = cartSchema.parse(input);
  void parsed;
}
export async function createOrder(formData: FormData) { void formData; }
export async function createCheckout(formData: FormData) { const orderId = String(formData.get('orderId') || ''); if (!orderId) throw new Error('Order required'); }
export async function login(formData: FormData) { const { email } = loginSchema.parse({ email: formData.get('email') }); rotateSession('current-session', email); }
export async function logout() { rotateSession('current-session', null); }
