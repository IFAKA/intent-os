import { sourceFiles } from '../data/products.js';

export function createRuntime({ products, store, state, render }) {
  function dispatch(action) {
    const product = products.find((item) => item.id === action.id);
    if (!product) return;
    store.add(product.id);
    state.trace = [
      { code: `cart.add(${product.id})`, label: 'received' },
      { code: 'product.price', label: 'resolved server-side' },
      { code: 'cart fragment', label: 'patched' },
    ];
    state.source = 'runtime';
    render();
  }

  return {
    dispatch,
    sourceFiles,
    reset() {
      store.reset();
      state.trace = [];
      state.source = 'surface';
      render();
    },
  };
}
