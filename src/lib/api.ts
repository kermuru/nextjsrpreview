// const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// live cred
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rp-vespera.cloud/api';

// const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://staging.rp-vespera.cloud/api';
//const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://springgreen-jellyfish-261481.hostingersite.com/api';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function getMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;
    const message = candidate.message || candidate.error || candidate.code;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});

  headers.set('Accept', 'application/json');

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  let payload: unknown = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text || null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, getMessage(payload, `Request failed with status ${response.status}`), payload);
  }

  return payload as T;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Absolute URL for an API path (e.g. for direct file downloads / links). */
export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Absolute URL for a `public`-disk storage path (e.g. an image's hd_path/ld_path).
 * Built from the API origin — NOT the backend's APP_URL — so images load wherever
 * the API is reachable, regardless of how APP_URL is configured.
 */
export function storageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}/storage/${path.replace(/^\/+/, '')}`;
}

export function formatDate(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
