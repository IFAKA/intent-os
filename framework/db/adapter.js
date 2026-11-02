import { randomUUID } from 'node:crypto';

const RESOURCE_TABLES = {
  Product: 'products', Category: 'categories', Cart: 'carts', CartItem: 'cart_items', Customer: 'customers',
  ProductCategory: 'product_categories', Order: 'orders', OrderItem: 'order_items', Payment: 'payments', WebhookEvent: 'webhook_events', Session: 'sessions',
};
const IDENTIFIER = /^[a-z_]+$/;
const ORDER_TRANSITIONS = { draft: new Set(['checkout_pending', 'canceled']), checkout_pending: new Set(['paid', 'canceled']), paid: new Set(['fulfilled']) };

function tableFor(resource) {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new Error(`Unknown resource: ${resource}`);
  return table;
}

function productRow(row) {
  if (!row) return row;
  return { ...row, price: row.price_minor / 100, active: Boolean(row.active), createdAt: row.created_at };
}

export function createAdapter(driver) {
  const resource = (name) => ({
    find(filters = {}) {
      const table = tableFor(name);
      const key = Object.keys(filters)[0];
      if (!key || !IDENTIFIER.test(key)) throw new Error('A safe lookup field is required');
      const row = driver.get(`SELECT * FROM ${table} WHERE ${key} = ? LIMIT 1`, [filters[key]]);
      return name === 'Product' ? productRow(row) : row;
    },
    list(options = {}) {
      const table = tableFor(name);
      const clauses = [];
      const params = [];
      if (options.where?.active !== undefined) { clauses.push('active = ?'); params.push(options.where.active ? 1 : 0); }
      if (options.search) { clauses.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${options.search}%`, `%${options.search}%`); }
      if (options.category) { clauses.push('EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = products.id AND c.slug = ?)'); params.push(options.category); }
      const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 100);
      const order = options.order === 'price-asc' ? 'price_minor ASC, id ASC' : options.order === 'price-desc' ? 'price_minor DESC, id DESC' : 'created_at DESC, id DESC';
      if (options.after) { const [createdAt, id] = String(options.after).split(':'); clauses.push('(created_at < ? OR (created_at = ? AND id < ?))'); params.push(Number(createdAt), Number(createdAt), id); }
      const rows = driver.all(`SELECT * FROM ${table}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY ${order} LIMIT ?`, [...params, limit + 1]);
      const pageRows = rows.slice(0, limit);
      const items = pageRows.map((row) => name === 'Product' ? productRow(row) : row);
      const last = pageRows.at(-1);
      return { items, hasNext: rows.length > limit, nextCursor: rows.length > limit && last ? `${last.created_at}:${last.id}` : null };
    },
    create(values) {
      const table = tableFor(name);
      const entries = Object.entries(values).filter(([key]) => IDENTIFIER.test(key));
      driver.run(`INSERT INTO ${table} (${entries.map(([key]) => key).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`, entries.map(([, value]) => value));
    },
  });

  function cartForSession(sessionId) {
    return driver.get('SELECT * FROM carts WHERE session_id = ? AND status = ? LIMIT 1', [sessionId, 'open']);
  }

  function findOrCreateCustomer(email) {
    const existing = driver.get('SELECT * FROM customers WHERE email = ? LIMIT 1', [email]);
    if (existing) return existing;
    const customer = { id: `customer-${randomUUID()}`, email, created_at: Date.now() };
    driver.run('INSERT INTO customers (id, email, created_at) VALUES (?, ?, ?)', [customer.id, customer.email, customer.created_at]);
    return customer;
  }

  function getSession(id) {
    const row = driver.get('SELECT id, customer_id AS customerId, data, expires_at AS expiresAt FROM sessions WHERE id = ? AND expires_at > ? LIMIT 1', [id, Date.now()]);
    if (!row) return null;
    return { id: row.id, customerId: row.customerId, data: JSON.parse(row.data || '{}'), expiresAt: row.expiresAt };
  }

  function saveSession(session, expiresAt) {
    driver.run(`INSERT INTO sessions (id, customer_id, data, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, data = excluded.data, expires_at = excluded.expires_at`, [session.id, session.customerId, JSON.stringify(session.data || {}), expiresAt]);
  }

  function deleteSession(id) {
    driver.run('DELETE FROM sessions WHERE id = ?', [id]);
  }

  function cartSummary(sessionId) {
    const cart = cartForSession(sessionId);
    if (!cart) return { count: 0, total: 0, items: [], summary: 'Empty cart' };
    const items = driver.all(`SELECT ci.product_id AS productId, ci.quantity, ci.price_minor AS priceMinor, p.name
      FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ? ORDER BY p.created_at DESC, p.id DESC`, [cart.id]);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalMinor = items.reduce((sum, item) => sum + item.quantity * item.priceMinor, 0);
    return { count, total: totalMinor / 100, totalMinor, items, summary: items.length ? items.map((item) => `${item.name} × ${item.quantity}`).join(' · ') : 'Empty cart' };
  }

  function cartMutation(sessionId, mutation) {
    return driver.transaction(() => {
      let cart = cartForSession(sessionId);
      const now = Date.now();
      if (!cart) {
        cart = { id: `cart-${sessionId}`, session_id: sessionId };
        driver.run('INSERT INTO carts (id, session_id, created_at, updated_at) VALUES (?, ?, ?, ?)', [cart.id, sessionId, now, now]);
      }
      mutation(cart, now);
      return cartSummary(sessionId);
    });
  }

  function cartAdd({ sessionId, productId, quantity }) {
    return cartMutation(sessionId, (cart, now) => {
      const product = driver.get('SELECT id, price_minor FROM products WHERE id = ? AND active = 1 LIMIT 1', [productId]);
      if (!product) throw Object.assign(new Error('Unknown product'), { code: 'UNKNOWN_PRODUCT' });
      driver.run(`INSERT INTO cart_items (cart_id, product_id, quantity, price_minor) VALUES (?, ?, ?, ?)
        ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity, price_minor = excluded.price_minor`, [cart.id, product.id, quantity, product.price_minor]);
      driver.run('UPDATE carts SET updated_at = ? WHERE id = ?', [now, cart.id]);
    });
  }

  function cartUpdate({ sessionId, productId, quantity }) {
    return cartMutation(sessionId, (cart, now) => {
      const product = driver.get('SELECT id, price_minor FROM products WHERE id = ? AND active = 1 LIMIT 1', [productId]);
      if (!product) throw Object.assign(new Error('Unknown product'), { code: 'UNKNOWN_PRODUCT' });
      driver.run('UPDATE cart_items SET quantity = ?, price_minor = ? WHERE cart_id = ? AND product_id = ?', [quantity, product.price_minor, cart.id, product.id]);
      driver.run('UPDATE carts SET updated_at = ? WHERE id = ?', [now, cart.id]);
    });
  }

  function cartRemove({ sessionId, productId }) {
    return cartMutation(sessionId, (cart, now) => {
      driver.run('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, productId]);
      driver.run('UPDATE carts SET updated_at = ? WHERE id = ?', [now, cart.id]);
    });
  }

  function orderForOwner({ orderId, sessionId, customerId = null }) {
    return driver.get(`SELECT * FROM orders
      WHERE id = ? AND (session_id = ? OR (? IS NOT NULL AND customer_id = ?)) LIMIT 1`, [orderId, sessionId, customerId, customerId]);
  }

  function createOrderDraft({ sessionId, customerId = null }) {
    return driver.transaction(() => {
      const cart = cartForSession(sessionId);
      if (!cart) throw Object.assign(new Error('Your cart is empty.'), { code: 'EMPTY_CART' });
      const items = driver.all(`SELECT ci.product_id AS productId, ci.quantity, p.price_minor AS priceMinor, p.inventory_count AS inventoryCount
        FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`, [cart.id]);
      if (!items.length) throw Object.assign(new Error('Your cart is empty.'), { code: 'EMPTY_CART' });
      const orderId = `order-${randomUUID()}`;
      const totalMinor = items.reduce((sum, item) => sum + item.quantity * item.priceMinor, 0);
      for (const item of items) {
        const result = driver.run('UPDATE products SET inventory_count = inventory_count - ? WHERE id = ? AND inventory_count >= ?', [item.quantity, item.productId, item.quantity]);
        if (!result.changes) throw Object.assign(new Error('One or more items are no longer available in that quantity.'), { code: 'INVENTORY_CONFLICT' });
      }
      const now = Date.now();
      driver.run('INSERT INTO orders (id, session_id, customer_id, status, total_minor, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderId, sessionId, customerId, 'draft', totalMinor, 'EUR', now]);
      for (const item of items) driver.run('INSERT INTO order_items (order_id, product_id, quantity, price_minor) VALUES (?, ?, ?, ?)', [orderId, item.productId, item.quantity, item.priceMinor]);
      driver.run('UPDATE carts SET status = ?, updated_at = ? WHERE id = ?', ['converted', now, cart.id]);
      return orderState(orderId, sessionId, customerId);
    });
  }

  function orderState(orderId, sessionId, customerId = null) {
    const order = orderForOwner({ orderId, sessionId, customerId });
    if (!order) throw Object.assign(new Error('Order not found'), { code: 'NOT_FOUND' });
    const items = driver.all('SELECT product_id AS productId, quantity, price_minor AS priceMinor FROM order_items WHERE order_id = ? ORDER BY product_id', [orderId]);
    return { ...order, items, total: order.total_minor / 100 };
  }

  function transitionOrder({ orderId, sessionId, customerId = null, status }) {
    return driver.transaction(() => {
      const order = orderForOwner({ orderId, sessionId, customerId });
      if (!order) throw Object.assign(new Error('Order not found'), { code: 'NOT_FOUND' });
      if (!ORDER_TRANSITIONS[order.status]?.has(status)) throw Object.assign(new Error(`Cannot move an order from ${order.status} to ${status}.`), { code: 'INVALID_ORDER_STATE' });
      if (status === 'canceled') {
        const items = driver.all('SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) driver.run('UPDATE products SET inventory_count = inventory_count + ? WHERE id = ?', [item.quantity, item.productId]);
      }
      driver.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
      return orderState(orderId, sessionId, customerId);
    });
  }

  function paymentForOrder(orderId) {
    return driver.get('SELECT * FROM payments WHERE order_id = ? LIMIT 1', [orderId]);
  }

  function createPendingPayment({ orderId, provider = 'stripe', amountMinor }) {
    return driver.transaction(() => {
      const existing = paymentForOrder(orderId);
      if (existing) return existing;
      const payment = { id: `payment-${randomUUID()}`, order_id: orderId, provider, status: 'pending', amount_minor: amountMinor, created_at: Date.now() };
      driver.run('INSERT INTO payments (id, order_id, provider, status, amount_minor, created_at) VALUES (?, ?, ?, ?, ?, ?)', [payment.id, payment.order_id, payment.provider, payment.status, payment.amount_minor, payment.created_at]);
      return payment;
    });
  }

  function attachPaymentReference({ orderId, providerReference, checkoutUrl = null }) {
    driver.run('UPDATE payments SET provider_reference = ?, checkout_url = ? WHERE order_id = ?', [providerReference, checkoutUrl, orderId]);
    return paymentForOrder(orderId);
  }

  function processPaymentWebhook({ provider = 'stripe', eventId, payload }) {
    return driver.transaction(() => {
      const inserted = driver.run('INSERT OR IGNORE INTO webhook_events (id, provider, payload, received_at) VALUES (?, ?, ?, ?)', [eventId, provider, JSON.stringify(payload), Date.now()]);
      if (!inserted.changes) return { duplicate: true, eventId };
      const session = payload.data?.object;
      if (payload.type !== 'checkout.session.completed') return { duplicate: false, eventId, handled: false };
      const payment = driver.get('SELECT * FROM payments WHERE provider = ? AND provider_reference = ? LIMIT 1', [provider, session?.id]);
      if (!payment || Number(session.amount_total) !== payment.amount_minor || String(session.currency || '').toLowerCase() !== 'eur') throw Object.assign(new Error('Payment does not match the order.'), { code: 'PAYMENT_MISMATCH' });
      if (payment.status !== 'paid') {
        driver.run('UPDATE payments SET status = ? WHERE id = ?', ['paid', payment.id]);
        driver.run('UPDATE orders SET status = ? WHERE id = ? AND status = ?', ['paid', payment.order_id, 'checkout_pending']);
      }
      driver.run('UPDATE orders SET status = ? WHERE id = ? AND status = ?', ['fulfilled', payment.order_id, 'paid']);
      return { duplicate: false, eventId, handled: true, orderId: payment.order_id, status: 'fulfilled' };
    });
  }

  return {
    capabilities: { transactions: true, preparedQueries: true, cursorPagination: true, money: 'minor-units' },
    resource,
    transaction: (callback) => driver.transaction(() => callback({ resource })),
    cartAdd,
    cartUpdate,
    cartRemove,
    cartSummary,
    findOrCreateCustomer,
    getSession,
    saveSession,
    deleteSession,
    createOrderDraft,
    orderState,
    transitionOrder,
    paymentForOrder,
    createPendingPayment,
    attachPaymentReference,
    processPaymentWebhook,
  };
}
