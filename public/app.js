function replaceDocument(markup) {
  const nextDocument = new DOMParser().parseFromString(markup, 'text/html');
  document.documentElement.replaceWith(nextDocument.documentElement);
}

async function navigate(url, { push = true } = {}) {
  const response = await fetch(url, { headers: { 'X-App-Request': 'navigation' } });
  if (!response.ok) throw new Error(`Navigation failed with ${response.status}`);
  replaceDocument(await response.text());
  if (push) history.pushState({}, '', url);
}

async function replaceFragment(form) {
  const action = form.dataset.action || form.querySelector('[data-action]')?.dataset.action;
  const targetName = form.dataset.fragmentTarget || (action ? 'cart-summary' : null);
  const existing = targetName ? document.querySelector(`[data-fragment="${CSS.escape(targetName)}"]`) : null;
  const status = document.querySelector('[data-fragment-status]');
  if (!action && (!targetName || !existing)) return form.submit();

  const button = form.querySelector('button[type="submit"], input[type="submit"]');
  const originalLabel = button?.textContent;
  form.setAttribute('aria-busy', 'true');
  if (button) {
    button.disabled = true;
    if ('textContent' in button) button.textContent = 'Refreshing…';
  }
  if (status) status.textContent = 'Refreshing cart…';

  try {
    const response = await fetch(new URL(action ? `/_app/action/${action}` : form.action, location.href), {
      method: action ? 'POST' : 'GET',
      body: action ? new URLSearchParams(new FormData(form)) : undefined,
      headers: action ? { 'X-App-Request': 'fragment' } : { 'X-App-Request': 'fragment', 'X-App-Fragment': targetName },
    });
    if (!response.ok) throw new Error(`Fragment failed with ${response.status}`);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    const incoming = [...template.content.querySelectorAll('[data-fragment]')];
    if (!incoming.length) throw new Error('Fragment response was empty');
    for (const fragment of incoming) document.querySelector(`[data-fragment="${CSS.escape(fragment.dataset.fragment)}"]`)?.replaceWith(fragment);
    if (status) status.textContent = 'Cart summary updated.';
  } catch {
    if (status) status.textContent = 'Could not refresh the cart. Try again.';
  } finally {
    form.removeAttribute('aria-busy');
    delete form.dataset.pending;
    if (button) {
      button.disabled = false;
      if (originalLabel !== undefined) button.textContent = originalLabel;
    }
  }
}

document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[href]');
  if (!link || link.origin !== location.origin || link.target === '_blank') return;
  event.preventDefault();
  try {
    await navigate(link.href);
  } catch {
    location.assign(link.href);
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-fragment-target], form[data-action]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.pending === 'true') return;
  form.dataset.pending = 'true';
  replaceFragment(form);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.type === 'submit') return;
  event.preventDefault();
  if (button.dataset.pending === 'true') return;
  button.dataset.pending = 'true';
  const form = document.createElement('form');
  form.action = `/_app/action/${button.dataset.action}`;
  form.method = 'post';
  form.dataset.action = button.dataset.action;
  form.innerHTML = `<input name="productId" value="${button.dataset.productId ?? ''}"><input name="quantity" value="1">`;
  button.after(form);
  replaceFragment(form).finally(() => { button.dataset.pending = ''; form.remove(); });
});

window.addEventListener('popstate', () => {
  navigate(location.href, { push: false }).catch(() => location.reload());
});
