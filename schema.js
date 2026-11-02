const field = (type, options = {}) => ({ type, ...options });

export { generateSchemaSql } from './framework/db/schema-generator.js';

export const schema = {
  version: 3,
  tables: {
    products: {
      columns: {
        id: field('TEXT', { primaryKey: true }), slug: field('TEXT', { unique: true, notNull: true }),
        name: field('TEXT', { notNull: true }), description: field('TEXT'), image: field('TEXT'),
        price_minor: field('INTEGER', { notNull: true, check: 'price_minor >= 0' }), inventory_count: field('INTEGER', { notNull: true, default: '0', check: 'inventory_count >= 0' }),
        currency: field('TEXT', { notNull: true, default: "'EUR'" }), active: field('INTEGER', { notNull: true, default: '1' }),
        created_at: field('INTEGER', { notNull: true }),
      },
    },
    categories: {
      columns: { id: field('TEXT', { primaryKey: true }), slug: field('TEXT', { unique: true, notNull: true }), name: field('TEXT', { notNull: true }) },
    },
    product_categories: {
      columns: {
        product_id: field('TEXT', { notNull: true, references: 'products(id)' }),
        category_id: field('TEXT', { notNull: true, references: 'categories(id)' }),
      },
      primaryKey: ['product_id', 'category_id'],
    },
    carts: {
      columns: {
        id: field('TEXT', { primaryKey: true }), session_id: field('TEXT', { unique: true, notNull: true }),
        status: field('TEXT', { notNull: true, default: "'open'" }), currency: field('TEXT', { notNull: true, default: "'EUR'" }),
        created_at: field('INTEGER', { notNull: true }), updated_at: field('INTEGER', { notNull: true }),
      },
    },
    cart_items: {
      columns: {
        cart_id: field('TEXT', { notNull: true, references: 'carts(id) ON DELETE CASCADE' }),
        product_id: field('TEXT', { notNull: true, references: 'products(id)' }),
        quantity: field('INTEGER', { notNull: true, check: 'quantity > 0' }),
        price_minor: field('INTEGER', { notNull: true, check: 'price_minor >= 0' }),
      },
      primaryKey: ['cart_id', 'product_id'],
    },
    customers: {
      columns: { id: field('TEXT', { primaryKey: true }), email: field('TEXT', { unique: true, notNull: true }), created_at: field('INTEGER', { notNull: true }) },
    },
    orders: {
      columns: {
        id: field('TEXT', { primaryKey: true }), session_id: field('TEXT', { notNull: true }), customer_id: field('TEXT', { references: 'customers(id)' }),
        status: field('TEXT', { notNull: true, default: "'draft'" }), total_minor: field('INTEGER', { notNull: true, default: '0' }),
        currency: field('TEXT', { notNull: true, default: "'EUR'" }), created_at: field('INTEGER', { notNull: true }),
      },
    },
    order_items: {
      columns: {
        order_id: field('TEXT', { notNull: true, references: 'orders(id) ON DELETE CASCADE' }), product_id: field('TEXT', { references: 'products(id)' }),
        quantity: field('INTEGER', { notNull: true, check: 'quantity > 0' }), price_minor: field('INTEGER', { notNull: true, check: 'price_minor >= 0' }),
      },
      primaryKey: ['order_id', 'product_id'],
    },
    payments: {
      columns: {
        id: field('TEXT', { primaryKey: true }), order_id: field('TEXT', { unique: true, notNull: true, references: 'orders(id)' }),
        provider: field('TEXT', { notNull: true }), provider_reference: field('TEXT', { unique: true }), checkout_url: field('TEXT'), status: field('TEXT', { notNull: true }),
        amount_minor: field('INTEGER', { notNull: true }), created_at: field('INTEGER', { notNull: true }),
      },
    },
    webhook_events: {
      columns: { id: field('TEXT', { primaryKey: true }), provider: field('TEXT', { notNull: true }), payload: field('TEXT', { notNull: true }), received_at: field('INTEGER', { notNull: true }) },
    },
    sessions: {
      columns: { id: field('TEXT', { primaryKey: true }), customer_id: field('TEXT', { references: 'customers(id)' }), data: field('TEXT', { notNull: true, default: "'{}'" }), expires_at: field('INTEGER', { notNull: true }) },
    },
  },
};

export default schema;
