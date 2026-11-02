import { login, logout } from '@/app/actions';

export default function Account() {
  return <main className="shell"><section className="card"><p>Identity boundary</p><h1>Keep your intent attached.</h1><form action={login}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" /><button type="submit">Continue with email</button></form><form action={logout}><button type="submit">Sign out</button></form></section></main>;
}
