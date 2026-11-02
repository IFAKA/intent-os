import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate, createResourceRegistry, interpretListQuery } from '../framework/compiler.js';

const products = [
  { id: '1', slug: 'red-shoe', name: 'Red Shoe', description: 'Leather shoe', price: 79, category: 'shoes', active: true, createdAt: 3 },
  { id: '2', slug: 'blue-shirt', name: 'Blue Shirt', description: 'Cotton shirt', price: 42, category: 'shirts', active: true, createdAt: 2 },
  { id: '3', slug: 'hidden-item', name: 'Hidden Item', description: 'Not for sale', price: 10, category: 'shoes', active: false, createdAt: 1 },
  { id: '4', slug: 'black-shoe', name: 'Black Shoe', description: 'Everyday shoe', price: 89, category: 'shoes', active: true, createdAt: 0 },
];

const resources = createResourceRegistry({ Product: products });

test('compiles a product list into escaped, formatted HTML', () => {
  const source = `<section data-layout="grid"><x-list of="Product" as="p" page="2" sort="newest"><article><a href="/products/{{p.slug}}"><h2>{{p.name}}</h2></a><x-money value="{{p.price}}"></x-money><button data-action="cart.add({{p.id}})">Add</button></article></x-list></section>`;
  const html = compileTemplate(source, { resources, query: new URLSearchParams() });

  assert.match(html, /data-layout="grid"/);
  assert.match(html, /href="\/products\/red-shoe"/);
  assert.match(html, /<span data-money="EUR">€79\.00<\/span>/);
  assert.match(html, /data-action="cart.add" data-product-id="1"/);
  assert.doesNotMatch(html, /<x-(list|money)/);
  assert.doesNotMatch(html, /<\/x-money>/);
  assert.doesNotMatch(html, /Hidden Item/);
});

test('compiles a route-bound product record and handles missing paths safely', () => {
  const source = `<x-record of="Product" by="slug" as="p"><main data-layout="split"><h1>{{p.name}}</h1><p>{{p.missing}}</p></main></x-record>`;
  const html = compileTemplate(source, { resources, params: { slug: 'red-shoe' } });
  assert.match(html, /<h1>Red Shoe<\/h1>/);
  assert.match(html, /<p><\/p>/);
  assert.match(html, /data-layout="split"/);
});

test('supports scoped conditionals, loops, and HTML escaping without evaluating code', () => {
  const source = `<x-list of="Product" as="p" page="1"><x-if test="p.active"><article><h2>{{p.name}}</h2><x-each in="p.tags" as="tag"><span>{{tag}}</span></x-each></article></x-if></x-list>`;
  const taggedResources = createResourceRegistry({ Product: [{ ...products[0], name: '<unsafe>', tags: ['one', '<two>'] }] });
  const html = compileTemplate(source, { resources: taggedResources });
  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /<span>one<\/span>/);
  assert.match(html, /<span>&lt;two&gt;<\/span>/);
  assert.doesNotMatch(html, /<unsafe>/);
});

test('interprets allow-listed filters, sorting, and URL-addressable pagination', () => {
  const result = interpretListQuery(products, {
    filter: 'category',
    sort: 'sort',
    page: '1',
    pageSize: '1',
  }, new URLSearchParams('category=shoes&sort=price-desc'));
  assert.deepEqual(result.items.map((product) => product.id), ['4']);
  assert.equal(result.hasNext, true);
});
