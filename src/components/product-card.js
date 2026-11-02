import { button } from './atoms.js';

export function productCard(product, index, cartIds = new Set()) {
  const added = cartIds.has(product.id);
  return `<article class="product-card product-${product.color} ${added ? 'is-added' : ''}" style="--card-index:${index}">
    <div class="product-art" aria-hidden="true"><span>${product.id}</span><i></i></div>
    <div class="product-meta"><div><h3>${product.name}</h3><p>${product.detail}</p></div><strong>€${product.price.toFixed(2)}</strong></div>
    ${button(`${added ? 'Added' : 'Add to cart'} <span>${added ? '✓' : '＋'}</span>`, 'add-button', `data-action="cart.add(${product.id})" aria-label="${added ? 'Add another' : 'Add'} ${product.name} to cart"`)}
  </article>`;
}

export function productGrid(products, variant, cartIds = new Set()) {
  return `<div class="product-grid grid-${variant.layout} density-${variant.density}">${products.map((product, index) => productCard(product, index, cartIds)).join('')}</div>`;
}
