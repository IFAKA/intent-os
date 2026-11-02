import Link from 'next/link';
import { products } from '@/lib/products';
import { AddToCartButton } from '@/components/add-to-cart-button';

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; cursor?: string }> }) {
  const query = await searchParams;
  const visible = products.filter((product) => !query.q || `${product.name} ${product.description}`.toLowerCase().includes(query.q.toLowerCase())).filter((product) => !query.category || product.category === query.category);
  return <main className="shell"><p><Link href="/">Home</Link> / Products</p><h1>Products</h1><form><input name="q" defaultValue={query.q} placeholder="Search products" /><button type="submit">Search</button></form><section className="grid">{visible.map((product) => <article className="card" key={product.id}><Link href={`/products/${product.slug}`}><h2>{product.name}</h2><p>{product.description}</p><strong>€{product.price.toFixed(2)}</strong></Link><AddToCartButton productId={product.id} /></article>)}</section></main>;
}
