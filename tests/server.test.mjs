import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../framework/server.js';

test('filesystem routes render full documents and fragments', async () => {
  const server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /^<!doctype html>/);

    const docs = await fetch(`${baseUrl}/docs`);
    assert.equal(docs.status, 200);
    const docsMarkup = await docs.text();
    assert.match(docsMarkup, /<title>Developer Portal<\/title>/);
    assert.match(docsMarkup, /From zero to a working app in three moves/);
    assert.match(docsMarkup, /Local-ready is not the same as public-ready/);

    const guide = await fetch(`${baseUrl}/docs/guide`);
    assert.equal(guide.status, 200);
    const guideMarkup = await guide.text();
    assert.match(guideMarkup, /Build by intent/);
    assert.match(guideMarkup, /Pages, routes, and syntax/);
    assert.match(guideMarkup, /Deployment checklist/);

    const theme = await fetch(`${baseUrl}/theme.css`);
    assert.equal(theme.status, 200);
    assert.match(theme.headers.get('content-type'), /^text\/css/);
    assert.match(await theme.text(), /color-scheme: light/);

    const product = await fetch(`${baseUrl}/products/field-notes`);
    assert.equal(product.status, 200);
    const productMarkup = await product.text();
    assert.match(productMarkup, /Field Notes/);
    assert.match(productMarkup, /data-money="EUR">€18\.00/);
    assert.match(productMarkup, /data-action="cart\.add" data-product-id="01"/);
    assert.doesNotMatch(productMarkup, /<x-(list|record|money)|<\/x-(list|record|money)>/);

    const filteredProducts = await fetch(`${baseUrl}/products?category=home`);
    assert.equal(filteredProducts.status, 200);
    const filteredMarkup = await filteredProducts.text();
    assert.match(filteredMarkup, /Signal Mug/);
    assert.doesNotMatch(filteredMarkup, /Field Notes/);

    const detail = await fetch(`${baseUrl}/products/field-notes`);
    assert.equal(detail.status, 200);
    const detailMarkup = await detail.text();
    assert.match(detailMarkup, /data-layout="split"/);
    assert.match(detailMarkup, /Uncoated paper for ideas worth keeping/);

    const fragment = await fetch(`${baseUrl}/cart`, { headers: { 'X-App-Request': 'fragment' } });
    assert.equal(fragment.status, 200);
    const fragmentMarkup = await fragment.text();
    assert.doesNotMatch(fragmentMarkup, /^<!doctype html>/);
    assert.match(fragmentMarkup, /data-fragment="cart-summary"/);
    assert.match(fragmentMarkup, /data-fragment-status/);

    const targetedFragment = await fetch(`${baseUrl}/cart`, {
      headers: { 'X-App-Request': 'fragment', 'X-App-Fragment': 'cart-summary' },
    });
    assert.equal(targetedFragment.status, 200);
    const targetedMarkup = await targetedFragment.text();
    assert.match(targetedMarkup, /^<p data-fragment="cart-summary">/);
    assert.doesNotMatch(targetedMarkup, /<main>/);

    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
