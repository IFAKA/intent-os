function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function renderFragment(name, state = {}, { message = '', csrfToken = '' } = {}) {
  if (name === 'cart') {
    const items = (state.items ?? []).map((item) => `<li><span>${escapeHtml(item.name ?? item.productId)} × ${item.quantity}</span><form action="/_app/action/cart.update" method="post" data-action="cart.update"><input type="hidden" name="productId" value="${escapeHtml(item.productId)}"><input type="number" name="quantity" value="${item.quantity}" min="1" max="99"><input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}"><button type="submit">Update</button></form><form action="/_app/action/cart.remove" method="post" data-action="cart.remove"><input type="hidden" name="productId" value="${escapeHtml(item.productId)}"><input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}"><button type="submit">Remove</button></form></li>`).join('');
    return `<span data-fragment="cart-count">${state.count ?? 0}</span><strong data-fragment="cart-total">€${Number(state.total ?? 0).toFixed(2)}</strong><p data-fragment="cart-summary">${escapeHtml(state.summary ?? 'Empty cart')}</p><ul data-fragment="cart-items">${items || '<li>Empty cart</li>'}</ul><p data-fragment="toast" role="status" aria-live="polite">${escapeHtml(message)}</p>`;
  }
  if (name === 'order') return `<section data-fragment="order"><h2>Order draft ready</h2><p data-order-id>${escapeHtml(state.id)}</p><p data-order-total>€${(Number(state.total_minor ?? 0) / 100).toFixed(2)}</p><p data-order-status>${escapeHtml(state.status)}</p></section>`;
  if (name === 'error') return `<p data-fragment="form-error" role="alert">${escapeHtml(state.message ?? '')}</p><p data-fragment="toast" role="status" aria-live="polite">${escapeHtml(state.message ?? '')}</p>`;
  return '';
}
