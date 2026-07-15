'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isApiError } from '@/lib/api';
import { getToken, setToken, setUser, isPublicPath, login } from '@/lib/auth';

function Spinner() {
  return (
    <span
      style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--muted)', borderRadius: '50%', animation: 'ag-spin 0.7s linear infinite' }}
    />
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true); setError('');
    try {
      const res = await login(username.trim(), password);
      if (res.token) { setToken(res.token); setUser(res.user ?? null); onSuccess(); }
      else setError(res.message ?? 'Login failed.');
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 380 }}>
        <div className="hero-logo"><img src="/logo.png" alt="Renaissance Park logo" /></div>
        <div className="page-card">
          <h1 style={{ margin: '0 0 2px', fontSize: '1.2rem', color: 'var(--accent)' }}>Admin Login</h1>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--muted)' }}>Sign in to continue.</p>
          <form onSubmit={submit}>
            <label style={labelStyle}>Username</label>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} style={inputStyle} autoComplete="username" />
            <label style={{ ...labelStyle, marginTop: 12 }}>Password</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} style={inputStyle} autoComplete="current-password" />
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...primaryBtn, width: '100%', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {busy && <Spinner />}{busy ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes ag-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** App-wide auth gate: public client-link routes pass through; everything else needs login. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => { setAuthed(!!getToken()); }, []);

  if (isPublicPath(pathname)) return <>{children}</>;   // external client links — no login
  if (authed === null) return null;                     // decide on the client to avoid a flash
  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;
  return <>{children}</>;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: '0.88rem', background: '#fff' };
const errorStyle: React.CSSProperties = { marginTop: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 11px', fontSize: '0.8rem' };
const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
