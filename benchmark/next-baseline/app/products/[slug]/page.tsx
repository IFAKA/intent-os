import { notFound } from 'next/navigation';
import { products } from '@/lib/products';
import { AddToCartButton } from '@/components/add-to-cart-button';

export default async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();
  return <main className="shell"><article className="card"><h1>{product.name}</h1><p>{product.description}</p><p>€{product.price.toFixed(2)}</p><AddToCartButton productId={product.id} /></article></main>;
}
