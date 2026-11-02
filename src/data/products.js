export const products = [
  { id: '01', slug: 'field-notes', name: 'Field Notes', detail: 'uncoated / 96 pages', description: 'Uncoated paper for ideas worth keeping.', price: 18, color: 'paper', category: 'stationery', active: true, createdAt: 3 },
  { id: '02', slug: 'signal-mug', name: 'Signal Mug', detail: 'stoneware / 320ml', description: 'A quiet stoneware mug for focused mornings.', price: 24, color: 'signal', category: 'home', active: true, createdAt: 2 },
  { id: '03', slug: 'quiet-cap', name: 'Quiet Cap', detail: 'organic cotton / navy', description: 'Organic cotton, soft structure, deep navy.', price: 32, color: 'night', category: 'apparel', active: true, createdAt: 1 },
];

export const sourceFiles = {
  surface: {
    label: 'components/product-card.js',
    title: 'Declarative product surface',
    explanation: 'A semantic product listing expresses the resource and the user intent without SQL, fetch code, or a client-side store.',
    code: `<x-list of="Product" as="p">\n  <article>\n    <h2>{{p.name}}</h2>\n    <x-money value="{{p.price}}" />\n    <button data-action="cart.add({{p.id}})">\n      Add to cart\n    </button>\n  </article>\n</x-list>`,
  },
  runtime: {
    label: 'runtime/intent-runtime.js',
    title: 'Intent → trusted execution',
    explanation: 'The local lab mirrors the future server boundary: resolve product truth, mutate cart state, then return the affected HTML.',
    code: `runtime.dispatch({\n  action: "cart.add",\n  resource: "Product",\n  id: product.id\n})\n\nconst truth = await db.products.find(id)\nconst cart = await session.cart.add(truth)\nreturn renderFragment("cart", cart)`,
  },
  fragment: {
    label: 'components/request-trace.js',
    title: 'Targeted HTML fragment',
    explanation: 'Named fragments let one action update only the cart regions that changed while keeping HTML as the response format.',
    code: `<template data-fragment="cart">\n  <strong>{{cart.total}}</strong>\n  <span>{{cart.summary}}</span>\n</template>\n\npatch(fragment)\nfocus.restore()\nhistory.sync()`,
  },
  variant: {
    label: 'playground/variants.js',
    title: 'A small explicit surface',
    explanation: 'Layout, density, and theme are explicit variants; changing presentation does not require changing product data or action logic.',
    code: `const variant = {\n  layout: "${'${layout}'}",\n  density: "${'${density}'}",\n  theme: "${'${theme}'}"\n}\n\n// no client store / no SQL / no fetch\nrender(ProductGrid, variant)`,
  },
};
