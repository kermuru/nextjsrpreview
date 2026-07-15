import { apiRequest } from '@/lib/api';

export const TOKEN_KEY = 'rp_admin_token';
export const USER_KEY = 'rp_admin_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string) { try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ } }
export function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

type AuthUser = Record<string, unknown> | null;

export function setUser(user: AuthUser) {
  try { user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}
export function getUser(): AuthUser {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** Display name of the logged-in user (firstname + lastname), with sensible fallbacks. */
export function getUserName(): string {
  const u = getUser();
  if (!u) return '';
  const s = (k: string) => (typeof u[k] === 'string' ? (u[k] as string).trim() : '');
  const full = [s('firstname'), s('lastname')].filter(Boolean).join(' ').trim();
  return full || s('name1') || s('name') || s('fullname') || s('username');
}

/** Staff login against the core-system backend. Returns a token on success; throws ApiError on bad creds. */
export function login(username: string, password: string) {
  return apiRequest<{ token?: string; user?: Record<string, unknown>; success?: boolean; message?: string }>(
    `/v1/login`,
    { method: 'POST', body: JSON.stringify({ username, password }) },
  );
}

export function logout() {
  clearToken();
  setUser(null);
  if (typeof window !== 'undefined') window.location.reload();
}

/**
 * Routes reachable WITHOUT login — external, client-facing links (review / photo upload / slideshow
 * opened from an emailed or generated URL). Everything else in the admin app requires login.
 */
export const PUBLIC_PREFIXES = [
  '/intermentsReviewLink',
  '/intermentsUploadInterredPhotoLink_ForPost',
  '/photolinkupload',
  '/slideshow',
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
