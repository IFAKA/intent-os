import Link from 'next/link';
import { createOrder } from '@/app/actions';

export default function Cart() {
  return <main className="shell"><p><Link href="/products">Products</Link> / Cart</p><h1>Cart</h1><section className="card"><p data-testid="cart-total">€0.00</p><form action={createOrder}><button type="submit">Create order draft</button></form></section></main>;
}
