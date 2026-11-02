import { createHmac, timingSafeEqual } from 'node:crypto';

export function createStripeClient({ secretKey, fetchImpl = fetch, apiBase = 'https://api.stripe.com' } = {}) {
  if (!secretKey) throw new Error('Stripe secret key is required.');
  return {
    async createCheckoutSession({ order, successUrl, cancelUrl, idempotencyKey }) {
      const body = new URLSearchParams({ mode: 'payment', success_url: successUrl, cancel_url: cancelUrl, 'line_items[0][price_data][currency]': order.currency.toLowerCase(), 'line_items[0][price_data][product_data][name]': `Intent OS order ${order.id}`, 'line_items[0][price_data][unit_amount]': String(order.total_minor), 'line_items[0][quantity]': '1', 'metadata[order_id]': order.id });
      const response = await fetchImpl(`${apiBase}/v1/checkout/sessions`, { method: 'POST', headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': idempotencyKey }, body });
      if (!response.ok) throw new Error('Stripe checkout session could not be created.');
      return response.json();
    },
  };
}

export function verifyStripeSignature(rawBody, signature, secret, { toleranceSeconds = 300, now = Date.now() } = {}) {
  const parts = Object.fromEntries(String(signature || '').split(',').map((part) => part.split('=').map((value) => value.trim())));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || Math.abs(now / 1000 - timestamp) > toleranceSeconds || !parts.v1) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const actual = Buffer.from(parts.v1, 'hex');
  return actual.length === expected.length / 2 && timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

export function createPaymentService({ database, stripeClient, webhookSecret, successUrl = 'http://localhost:3000/checkout/success', cancelUrl = 'http://localhost:3000/checkout' }) {
  return {
    async createCheckout({ orderId, sessionId, customerId = null }) {
      const order = database.orderState(orderId, sessionId, customerId);
      if (!['draft', 'checkout_pending'].includes(order.status)) throw Object.assign(new Error('This order is no longer payable.'), { code: 'INVALID_ORDER_STATE' });
      let payment = database.paymentForOrder(orderId) || database.createPendingPayment({ orderId, amountMinor: order.total_minor });
      const session = await stripeClient.createCheckoutSession({ order, successUrl: `${successUrl}?order=${encodeURIComponent(orderId)}`, cancelUrl: `${cancelUrl}?order=${encodeURIComponent(orderId)}`, idempotencyKey: `checkout-${orderId}` });
      payment = database.attachPaymentReference({ orderId, providerReference: session.id, checkoutUrl: session.url });
      if (order.status === 'draft') database.transitionOrder({ orderId, sessionId, customerId, status: 'checkout_pending' });
      return { ...payment, url: session.url, orderId };
    },
    handleWebhook(rawBody, signature) {
      if (!webhookSecret || !verifyStripeSignature(rawBody, signature, webhookSecret)) throw Object.assign(new Error('Invalid webhook signature.'), { code: 'WEBHOOK_INVALID' });
      let payload; try { payload = JSON.parse(rawBody); } catch { throw Object.assign(new Error('Invalid webhook payload.'), { code: 'WEBHOOK_INVALID' }); }
      if (!payload.id || typeof payload.id !== 'string') throw Object.assign(new Error('Webhook event id is required.'), { code: 'WEBHOOK_INVALID' });
      return database.processPaymentWebhook({ eventId: payload.id, payload });
    },
  };
}
