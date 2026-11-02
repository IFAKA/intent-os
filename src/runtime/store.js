export function createCartStore(items = []) {
  const cart = new Map(items);
  const listeners = new Set();

  const notify = (event) => listeners.forEach((listener) => listener({ cart, event }));

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(id) {
      cart.set(id, (cart.get(id) || 0) + 1);
      notify({ type: 'cart.add', id });
    },
    reset() {
      cart.clear();
      notify({ type: 'runtime.reset' });
    },
    entries() {
      return [...cart.entries()];
    },
  };
}
