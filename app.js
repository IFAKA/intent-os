const code = document.querySelector('#surfaceCode');
const copy = document.querySelector('#copyCode');

// The report's first proof, expressed as a tiny in-browser runtime. In production,
// this state and the fragment rendering would live behind the server boundary.
const products = [
  { id: '01', name: 'Field Notes', detail: 'uncoated / 96 pages', price: 18 },
  { id: '02', name: 'Signal Mug', detail: 'stoneware / 320ml', price: 24 },
  { id: '03', name: 'Quiet Cap', detail: 'organic cotton / navy', price: 32 },
];
const cart = new Map();
const productGrid = document.querySelector('[data-fragment="products"]');

const money = (value) => `€${value.toFixed(2)}`;

function renderProducts() {
  if (!productGrid) return;
  productGrid.innerHTML = products.map((product, index) => `
    <article class="demo-product" style="--product-index:${index}">
      <div class="product-art art-${index + 1}" aria-hidden="true"><span>${product.id}</span></div>
      <div class="product-meta"><div><h4>${product.name}</h4><p>${product.detail}</p></div><strong>${money(product.price)}</strong></div>
      <button class="add-button" data-action="cart.add(${product.id})">Add to cart <span>＋</span></button>
    </article>`).join('');
  productGrid.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.action.match(/\((.*?)\)/)[1], button));
  });
}

function renderCart() {
  const items = [...cart.entries()].map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }));
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  document.querySelector('[data-fragment="cart-count"] strong')?.replaceChildren(quantity);
  document.querySelector('[data-cart-total]')?.replaceChildren(total.toFixed(2));
  document.querySelector('[data-cart-summary]')?.replaceChildren(items.length ? items.map(({ product, quantity }) => `${quantity} × ${product.name}`).join('  ·  ') : 'Empty · waiting for cart.add');
}

function addToCart(id, button) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  const trace = document.querySelector('[data-fragment="trace"]');
  trace.innerHTML = `<div class="trace-step"><span>01</span><code>cart.add(${product.id})</code><b>received</b></div><div class="trace-step"><span>02</span><code>product.price</code><b>resolved server-side</b></div><div class="trace-step"><span>03</span><code>cart fragment</code><b>patched</b></div>`;
  document.querySelector('.trace-status').innerHTML = '<i></i> fragment fresh';
  button.classList.add('added');
  button.innerHTML = 'Added <span>✓</span>';
  setTimeout(() => { button.classList.remove('added'); button.innerHTML = 'Add to cart <span>＋</span>'; }, 1200);
}

renderProducts();
renderCart();

copy?.addEventListener('click', async () => {
  const plain = code.innerText;
  await navigator.clipboard?.writeText(plain);
  copy.textContent = 'Copied';
  setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
});

document.querySelectorAll('.concept').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.concept.active')?.classList.remove('active');
    button.classList.add('active');
    const panel = document.querySelector('.code-panel');
    panel.animate([{ transform: 'translateY(4px)', opacity: .65 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el) => {
  el.style.animationPlayState = 'paused';
  observer.observe(el);
});
