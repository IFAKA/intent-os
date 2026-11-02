'use client';

import { useTransition } from 'react';
import { addToCart } from '@/app/actions';

export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(() => addToCart({ productId, quantity: 1 }))}>{pending ? 'Adding…' : 'Add to cart'}</button>;
}
