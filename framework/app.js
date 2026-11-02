import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderDocument, renderFragmentTarget, renderPage } from './renderer.js';
import { createResourceRegistry } from './compiler.js';
import { products } from '../src/data/products.js';
import { createActionRegistry, actionResponse, actionErrorResponse } from './actions.js';
import { renderFragment } from './fragments.js';
import { createCsrfSecret, createCsrfToken, verifyCsrfToken } from './csrf.js';
import { createRateLimiter, createSessionManager } from './auth.js';
import { createStripeClient, createPaymentService } from './payments/stripe.js';

export function createApp({ router, publicDirectory, resources = createResourceRegistry({ Product: products }), database = null, config = {}, sessionSecret = process.env.INTENT_OS_SESSION_SECRET || createCsrfSecret(), secureCookies = config.secureCookies ?? process.env.NODE_ENV === 'production', stripeClient = null, stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET, stripeSuccessUrl = config.stripeSuccessUrl || 'http://localhost:3000/checkout/success', stripeCancelUrl = config.stripeCancelUrl || 'http://localhost:3000/checkout' } = {}) {
  const payments = database && config.payments !== 'none' && (stripeClient || process.env.STRIPE_SECRET_KEY) ? createPaymentService({ database, stripeClient: stripeClient || createStripeClient({ secretKey: process.env.STRIPE_SECRET_KEY }), webhookSecret: stripeWebhookSecret, successUrl: stripeSuccessUrl, cancelUrl: stripeCancelUrl }) : null;
  const actions = database ? createActionRegistry({ database, payments }) : null;
  const sessions = createSessionManager({ secure: secureCookies, store: database });
  const actionLimiter = createRateLimiter();
  return async function app(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/app.js' || url.pathname === '/theme.css' || url.pathname.startsWith('/public/')) return servePublic(url.pathname, publicDirectory, response);
    if (url.pathname === '/_app/webhooks/stripe') return handleStripeWebhook(request, response, payments);
    if (url.pathname.startsWith('/_app/action/')) return handleAction(request, response, actions, url.pathname.slice('/_app/action/'.length), { sessionSecret, sessions, actionLimiter });
    const route = router.resolve(url.pathname);
    if (!route) {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderDocument('<main><h1>404 — Not found</h1><a href="/">Return home</a></main>', { title: 'Not found' }));
      return;
    }
    try {
      const session = sessions.get(readSession(request.headers.cookie)) || sessions.newSession();
      let body = await renderPage(route, { query: url.searchParams, resources });
      body = injectCsrfFields(body, createCsrfToken(session.id, sessionSecret));
      if (url.pathname === '/account') body = applyAccountState(body, session);
      if (database && url.pathname === '/cart') body = applyCartState(body, database.cartSummary(session.id), createCsrfToken(session.id, sessionSecret));
      if (database && url.pathname === '/checkout' && url.searchParams.get('order')) {
        try {
          const orderId = url.searchParams.get('order');
          body = body.replace(/<section\b[^>]*data-fragment=["']order["'][^>]*>[\s\S]*?<\/section>/i, renderFragment('order', database.orderState(orderId, session.id)));
          body = body.replace(/name=["']orderId["'][^>]*value=["'][^"']*["']/i, `name="orderId" value="${orderId.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
        } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
      }
      const isFragment = request.headers['x-app-request'] === 'fragment';
      const fragmentTarget = request.headers['x-app-fragment'];
      const fragment = isFragment && fragmentTarget ? renderFragmentTarget(body, fragmentTarget) : body;
      if (isFragment && fragmentTarget && !fragment) {
        response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<p data-fragment-status>Fragment not found</p>');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-app-route': route.filePath, 'set-cookie': sessions.cookie(session.id), ...securityHeaders() });
      response.end(isFragment ? fragment : renderDocument(body, { title: route.params.title || (route.params.slug ? `${route.params.slug} · Intent OS` : 'Intent OS') }));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(error);
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Unable to render page');
    }
  };
}

async function handleAction(request, response, actions, actionName, { sessionSecret, sessions, actionLimiter }) {
    if (!actions || request.method !== 'POST') { response.writeHead(404); response.end('Not found'); return; }
  const sessionId = readSession(request.headers.cookie) || sessions.newSession().id;
  const session = sessions.get(sessionId) || sessions.newSession();
  try {
    const body = await readBody(request);
    const input = Object.fromEntries(new URLSearchParams(body));
    if (!actionLimiter.check(sessionId)) throw Object.assign(new Error('Too many requests. Try again shortly.'), { code: 'RATE_LIMITED' });
    const csrfToken = input.csrfToken || request.headers['x-csrf-token'];
    if (!verifyCsrfToken(csrfToken, sessionId, sessionSecret)) throw Object.assign(new Error('Invalid CSRF token.'), { code: 'CSRF_INVALID' });
    delete input.csrfToken;
    const state = await actions.run(actionName, { sessionId, customerId: session.customerId, input });
    const headers = { 'content-type': 'text/html; charset=utf-8', 'set-cookie': sessions.cookie(sessionId), ...securityHeaders() };
    if (actionName === 'auth.login') {
      const rotated = sessions.login(sessions.get(sessionId) || { id: sessionId }, state.id);
      headers['set-cookie'] = sessions.cookie(rotated.id);
      response.writeHead(303, { ...headers, location: '/account' });
      response.end();
      return;
    }
    if (actionName === 'auth.logout') {
      const rotated = sessions.rotate(sessions.get(sessionId) || { id: sessionId });
      headers['set-cookie'] = sessions.cookie(rotated.id);
      response.writeHead(303, { ...headers, location: '/account' });
      response.end();
      return;
    }
    if (request.headers['x-app-request'] !== 'fragment') {
      const location = actionName === 'order.create' ? `/checkout?order=${encodeURIComponent(state.id)}` : actionName === 'checkout.create' ? state.url : '/cart';
      response.writeHead(303, { ...headers, location });
      response.end();
      return;
    }
    response.writeHead(200, headers);
    response.end(actionName.startsWith('order.') ? renderFragment('order', state) : actionResponse({ state, message: actionName === 'cart.add' ? 'Added to cart.' : 'Cart updated.', csrfToken: createCsrfToken(sessionId, sessionSecret) }));
  } catch (error) {
    const status = ['VALIDATION_ERROR', 'UNKNOWN_PRODUCT', 'UNKNOWN_ACTION', 'CSRF_INVALID', 'RATE_LIMITED', 'EMPTY_CART', 'INVENTORY_CONFLICT', 'INVALID_ORDER_STATE', 'PAYMENTS_UNAVAILABLE'].includes(error.code) ? (error.code === 'RATE_LIMITED' ? 429 : 400) : 500;
    response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...securityHeaders() });
    const errorMarkup = actionErrorResponse(error.message || 'Could not update the cart.');
    response.end(request.headers['x-app-request'] === 'fragment'
      ? errorMarkup
      : renderDocument(`<main><h1>Could not complete that request</h1>${errorMarkup}<p><a href="/cart">Return to cart</a></p></main>`, { title: 'Request error' }));
  }
}

async function handleStripeWebhook(request, response, payments) {
  if (!payments || request.method !== 'POST') { response.writeHead(404); response.end('Not found'); return; }
  try {
    const rawBody = await readBody(request);
    const result = payments.handleWebhook(rawBody, request.headers['stripe-signature']);
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', ...securityHeaders() });
    response.end(JSON.stringify({ received: true, ...result }));
  } catch (error) {
    const status = ['WEBHOOK_INVALID', 'PAYMENT_MISMATCH'].includes(error.code) ? 400 : 500;
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...securityHeaders() });
    response.end(JSON.stringify({ error: error.message }));
  }
}

function applyCartState(body, state, csrfToken) {
  const fragments = renderFragment('cart', state, { csrfToken });
  return body.replace(/<([a-z][\w-]*)\b[^>]*data-fragment=["'](?:cart-count|cart-total|cart-summary)["'][^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const target = match.match(/data-fragment=["']([^"']+)["']/i)?.[1];
    return fragments.match(new RegExp(`<[^>]+data-fragment=["']${target}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'i'))?.[0] ?? match;
  });
}

function applyAccountState(body, session) {
  const status = session.customerId ? 'Signed in' : 'Not signed in';
  return body.replace(/data-account-status[^>]*>[\s\S]*?<\/p>/i, `data-account-status role="status" aria-live="polite">${status}</p>`)
    .replace(/<form\b[^>]*data-account-login[^>]*>[\s\S]*?<\/form>/i, session.customerId ? '' : '$&')
    .replace(/<form\b[^>]*data-account-logout[^>]*>[\s\S]*?<\/form>/i, session.customerId ? '$&' : '');
}

function readSession(cookie = '') {
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('intent_session='));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match.slice('intent_session='.length));
    return /^[0-9a-f-]{36}$/.test(value) ? value : null;
  } catch { return null; }
}

function injectCsrfFields(body, token) {
  return body.replace(/<form\b([^>]*)>/gi, (match, attributes) => {
    if (!/\bmethod=["']post["']/i.test(attributes) || /name=["']csrfToken["']/i.test(match)) return match;
    return `${match}<input type="hidden" name="csrfToken" value="${token}">`;
  });
}

function securityHeaders() {
  return { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; if (body.length > 10_000) reject(Object.assign(new Error('Request too large'), { code: 'VALIDATION_ERROR' })); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function servePublic(urlPath, publicDirectory, response) {
  const relativePath = urlPath === '/app.js' ? 'app.js' : urlPath === '/theme.css' ? '../theme.css' : urlPath.slice('/public/'.length);
  const publicRoot = path.resolve(publicDirectory);
  const filePath = path.resolve(publicRoot, relativePath);
  const allowedRoot = urlPath === '/theme.css' ? path.dirname(publicRoot) : publicRoot;
  if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const contentType = urlPath === '/theme.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
    response.writeHead(200, { 'content-type': contentType });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}
