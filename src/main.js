import { products, sourceFiles } from './data/products.js';
import { createCartStore } from './runtime/store.js';
import { createRuntime } from './runtime/intent-runtime.js';
import { playground } from './components/playground.js';

const app = document.querySelector('#app');
const store = createCartStore();
const state = { variant: { layout: 'cards', density: 'roomy', theme: 'paper' }, trace: [], source: 'surface' };
let focusTarget = null;

function cartSnapshot() {
  return store.entries().reduce((result, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    result.quantity += quantity;
    result.total += product.price * quantity;
    result.names.push(`${quantity} × ${product.name}`);
    return result;
  }, { quantity: 0, total: 0, names: [] });
}

function render() {
  app.innerHTML = playground({ products, variant: state.variant, trace: state.trace, source: state.source, cartIds: new Set(store.entries().map(([id]) => id)) });
  const snapshot = cartSnapshot();
  app.querySelector('[data-fragment="cart-count"]').textContent = snapshot.quantity;
  app.querySelector('[data-fragment="cart-total"]').textContent = snapshot.total.toFixed(2);
  app.querySelector('[data-fragment="cart-summary"]').textContent = snapshot.names.length ? snapshot.names.join('  ·  ') : 'Empty · waiting for cart.add';
  bind();
  if (focusTarget) {
    app.querySelector(`[data-action="${focusTarget}"]`)?.focus();
    focusTarget = null;
  }
}

const runtime = createRuntime({ products, store, state, render });

function bind() {
  app.querySelectorAll('[data-action]').forEach((element) => element.addEventListener('click', () => {
    focusTarget = element.dataset.action;
    const match = element.dataset.action.match(/^([^\(]+)\(([^\)]*)\)$/);
    if (!match) return;
    runtime.dispatch({ action: match[1], id: match[2] });
  }));
  app.querySelectorAll('input[type="radio"]').forEach((input) => input.addEventListener('change', () => {
    state.variant[input.name] = input.value;
    state.source = 'variant';
    render();
  }));
  app.querySelector('[data-reset]').addEventListener('click', runtime.reset);
  app.querySelectorAll('[data-source]').forEach((tab) => tab.addEventListener('click', () => { state.source = tab.dataset.source; render(); }));
  app.querySelector('[data-copy]').addEventListener('click', async (event) => {
    try {
      const code = sourceFiles[state.source].code;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('Copy command unavailable');
        textarea.remove();
      }
      event.currentTarget.textContent = 'Copied';
    } catch {
      event.currentTarget.textContent = 'Select code';
    }
    setTimeout(() => { event.currentTarget.textContent = 'Copy'; }, 1200);
  });
}

render();
