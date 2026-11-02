import { renderFragment } from './fragments.js';
import { cartInput, createSchema } from './validation.js';

const ACTION_PATTERN = /^(?:auth\.(login|logout)|cart\.(add|remove|update)|order\.(create|cancel)|checkout\.create)$/;
const emptyInput = createSchema({});

function loginInput(input) {
  return createSchema({ email: (value) => {
    const email = String(value ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new Error('Enter a valid email address.'), { code: 'VALIDATION_ERROR' });
    return email;
  } })(input).email;
}

export function createActionRegistry({ database, payments = null }) {
  const actions = new Map([
    ['auth.login', ({ input }) => database.findOrCreateCustomer(loginInput(input))],
    ['auth.logout', ({ input }) => { emptyInput(input); return { loggedOut: true }; }],
    ['cart.add', ({ sessionId, input }) => database.cartAdd({ sessionId, ...cartInput(input) })],
    ['cart.update', ({ sessionId, input }) => database.cartUpdate({ sessionId, ...cartInput(input) })],
    ['cart.remove', ({ sessionId, input }) => database.cartRemove({ sessionId, productId: cartInput({ ...input, quantity: 1 }).productId })],
    ['order.create', ({ sessionId, customerId, input }) => { emptyInput(input); return database.createOrderDraft({ sessionId, customerId }); }],
    ['order.cancel', ({ sessionId, customerId, input }) => { const parsed = createSchema({ orderId: (value) => { const id = String(value ?? ''); if (!/^order-[0-9a-f-]{36}$/.test(id)) throw new Error('Choose a valid order.'); return id; } })(input); return database.transitionOrder({ orderId: parsed.orderId, sessionId, customerId, status: 'canceled' }); }],
    ['checkout.create', async ({ sessionId, customerId, input }) => { if (!payments) throw Object.assign(new Error('Payments are not configured.'), { code: 'PAYMENTS_UNAVAILABLE' }); const parsed = createSchema({ orderId: (value) => { const id = String(value ?? ''); if (!/^order-[0-9a-f-]{36}$/.test(id)) throw new Error('Choose a valid order.'); return id; } })(input); return payments.createCheckout({ orderId: parsed.orderId, sessionId, customerId }); }],
  ]);
  return {
    async run(name, context) {
      if (!ACTION_PATTERN.test(name) || !actions.has(name)) throw Object.assign(new Error('Unknown action'), { code: 'UNKNOWN_ACTION' });
      return actions.get(name)(context);
    },
  };
}

export function actionResponse({ state, message }) {
  return renderFragment('cart', state, { message });
}

export function actionErrorResponse(message) {
  return renderFragment('error', { message });
}
