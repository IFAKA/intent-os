import Link from 'next/link';
import { createCheckout } from '@/app/actions';

export default function Checkout() {
  return <main className="shell"><p><Link href="/cart">Cart</Link> / Checkout</p><h1>Checkout</h1><form action={createCheckout} className="card"><input type="hidden" name="orderId" /><button type="submit">Pay securely</button></form><p>Payment is provider-bound and server-authoritative.</p></main>;
}
