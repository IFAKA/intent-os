export const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;

export const button = (label, className = '', attrs = '') => `<button class="button ${className}" ${attrs}>${label}</button>`;

export const icon = (name) => `<span class="icon icon-${name}" aria-hidden="true"></span>`;
