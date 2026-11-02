import Link from 'next/link';

export default function Home() {
  return <main className="shell"><p>Next.js + Tailwind + shadcn baseline</p><h1>Intent commerce, assembled conventionally.</h1><p><Link href="/products">Products</Link> · <Link href="/cart">Cart</Link> · <Link href="/account">Account</Link></p></main>;
}
