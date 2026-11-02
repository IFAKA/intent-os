const ATTRIBUTE_PATTERN = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const PATH_PATTERN = /^([\w-]+(?:\.[\w-]+)*)$/;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function createResourceRegistry(resources = {}) {
  return new Map(Object.entries(resources).map(([name, records]) => [name, Array.isArray(records) || records?.list || records?.find ? records : []]));
}

export function interpretListQuery(records, attributes = {}, query = new URLSearchParams()) {
  let items = records.filter((record) => record.active !== false);
  const category = attributes.filter === 'category' ? query.get('category') : null;
  const search = attributes.search === 'q:name,description' ? query.get('q')?.trim().toLowerCase() : null;
  if (category) items = items.filter((record) => record.category === category);
  if (search) items = items.filter((record) => [record.name, record.description].some((value) => String(value ?? '').toLowerCase().includes(search)));

  const sort = attributes.sort === 'sort' ? query.get('sort') || 'newest' : attributes.sort || 'newest';
  const sorted = [...items].sort((left, right) => {
    if (sort === 'price-asc') return Number(left.price) - Number(right.price);
    if (sort === 'price-desc') return Number(right.price) - Number(left.price);
    if (sort === 'name') return String(left.name).localeCompare(String(right.name));
    return Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0) || String(right.id).localeCompare(String(left.id));
  });

  const pageSize = Math.max(1, Number(attributes.page || 24) || 24);
  const cursor = Math.max(0, Number(query.get('cursor') || 0) || 0);
  const page = Math.max(1, Number(query.get('page') || 1) || 1);
  const offset = query.has('cursor') ? cursor : (page - 1) * pageSize;
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    hasNext: offset + pageSize < sorted.length,
    nextCursor: offset + pageSize < sorted.length ? String(offset + pageSize) : null,
  };
}

export function compileTemplate(source, { resources = createResourceRegistry(), params = {}, query = new URLSearchParams() } = {}) {
  let output = source;
  output = expandRecords(output, resources, params, query);
  output = expandLists(output, resources, query);
  return expandMoney(interpolate(output));
}

function expandLists(source, resources, query) {
  return source.replace(/<x-list\b([^>]*)>([\s\S]*?)<\/x-list>/gi, (_, rawAttributes, template) => {
    const attributes = parseAttributes(rawAttributes);
    const records = resources.get(attributes.of) ?? [];
    const result = records?.list
      ? records.list({ search: attributes.search === 'q:name,description' ? query.get('q') : undefined, category: attributes.filter === 'category' ? query.get('category') : undefined, order: attributes.sort === 'sort' ? query.get('sort') : attributes.sort, limit: Number(attributes.page) || 24, after: query.get('after') })
      : interpretListQuery(records, attributes, query);
    return result.items.map((record) => renderScopedTemplate(template, { [attributes.as || 'item']: record })).join('');
  });
}

function expandRecords(source, resources, params, query) {
  return source.replace(/<x-record\b([^>]*)>([\s\S]*?)<\/x-record>/gi, (_, rawAttributes, template) => {
    const attributes = parseAttributes(rawAttributes);
    const records = resources.get(attributes.of) ?? [];
    const key = attributes.by || 'id';
    const value = params[key];
    const record = records?.find && !Array.isArray(records)
      ? records.find({ [key]: value })
      : records.find((candidate) => String(candidate[key]) === String(value) && candidate.active !== false);
    return record ? renderScopedTemplate(template, { [attributes.as || 'item']: record }) : '';
  });
}

function expandMoney(source) {
  return source.replace(/<x-money\b([^>]*?)(?:\s*\/\s*>|>\s*<\/x-money\s*>)/gi, (_, rawAttributes) => {
    const attributes = parseAttributes(rawAttributes);
    const value = resolveLiteral(attributes.value);
    const currency = attributes.currency || 'EUR';
    const amount = Number(value);
    const formatted = Number.isFinite(amount) ? new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount) : '';
    return `<span data-money="${escapeHtml(currency)}">${escapeHtml(formatted)}</span>`;
  });
}

function interpolate(source) {
  return source.replace(/{{\s*([\w-]+(?:\.[\w-]+)*)\s*}}/g, (_, path) => {
    return '';
  });
}

function normalizeActions(source) {
  return source.replace(/data-action=(['"])cart\.add\(([^)]+)\)\1/gi, (_, quote, id) => `data-action=${quote}cart.add${quote} data-product-id=${quote}${escapeHtml(id)}${quote}`);
}

function renderScopedTemplate(template, scope) {
  let output = template.replace(/<x-if\b([^>]*)>([\s\S]*?)<\/x-if>/gi, (_, rawAttributes, content) => {
    const test = parseAttributes(rawAttributes).test;
    return resolvePath(test, scope) ? renderScopedTemplate(content, scope) : '';
  });
  output = output.replace(/<x-each\b([^>]*)>([\s\S]*?)<\/x-each>/gi, (_, rawAttributes, content) => {
    const attributes = parseAttributes(rawAttributes);
    const values = resolvePath(attributes.in, scope);
    return Array.isArray(values) ? values.map((value) => renderScopedTemplate(content, { ...scope, [attributes.as || 'item']: value })).join('') : '';
  });
  output = output.replace(/<x-money\b([^>]*?)(?:\s*\/\s*>|>\s*<\/x-money\s*>)/gi, (_, rawAttributes) => {
    const attributes = parseAttributes(rawAttributes);
    const value = resolveScopedValue(attributes.value, scope);
    const currency = attributes.currency || 'EUR';
    const amount = Number(value);
    const formatted = Number.isFinite(amount) ? new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount) : '';
    return `<span data-money="${escapeHtml(currency)}">${escapeHtml(formatted)}</span>`;
  });
  output = output.replace(/{{\s*([\w-]+(?:\.[\w-]+)*)\s*}}/g, (_, path) => escapeHtml(resolvePath(path, scope) ?? ''));
  return normalizeActions(output);
}

function parseAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) attributes[match[1]] = match[2] ?? match[3] ?? '';
  return attributes;
}

function resolvePath(path, scope) {
  if (!PATH_PATTERN.test(path)) return undefined;
  return path.split('.').reduce((value, key) => value == null ? undefined : value[key], scope);
}

function resolveLiteral(value) {
  const match = String(value ?? '').match(/^{{\s*([\w-]+(?:\.[\w-]+)*)\s*}}$/);
  return match ? match[1].split('.').at(-1) : value;
}

function resolveScopedValue(value, scope) {
  const match = String(value ?? '').match(/^{{\s*([\w-]+(?:\.[\w-]+)*)\s*}}$/);
  return match ? resolvePath(match[1], scope) : value;
}
