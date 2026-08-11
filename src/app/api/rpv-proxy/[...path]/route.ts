import { NextRequest, NextResponse } from 'next/server';

/**
 * n8n → frontend → backend proxy.
 *
 * The backend (api.rp-vespera.cloud) rejects requests that come directly from
 * n8n. This route lets n8n call the Next.js server instead: the server (not n8n)
 * forwards the request to the backend with a normal browser User-Agent, then
 * hands the backend's response straight back to n8n.
 *
 * Usage from n8n — call this route with the SAME backend path after the prefix:
 *   https://<frontend-domain>/api/rpv-proxy/api/lapidaDashboard
 *   https://<frontend-domain>/api/rpv-proxy/api/upload-photos/by-document/{doc}
 *   https://<frontend-domain>/api/rpv-proxy/api/intermentsUploadInterredPhotoLink_ForPost/{doc}
 *
 * → forwarded to  https://api.rp-vespera.cloud/api/...
 *
 * Override the target with RPV_PROXY_TARGET (e.g. staging) in the environment.
 */

const BACKEND_ORIGIN = (process.env.RPV_PROXY_TARGET || 'https://api.rp-vespera.cloud').replace(/\/+$/, '');

// A normal browser UA so the backend does not reject the call as coming from n8n.
const FORWARD_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const dynamic = 'force-dynamic'; // never cache a proxied call

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  const target = `${BACKEND_ORIGIN}/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers: Record<string, string> = {
    'User-Agent': FORWARD_UA,
    Accept: req.headers.get('accept') || 'application/json',
  };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await req.text() : undefined;

  try {
    const backendRes = await fetch(target, { method, headers, body, cache: 'no-store' });

    // Pass the backend response straight back to n8n (status + body + content-type).
    const buffer = await backendRes.arrayBuffer();
    const resContentType = backendRes.headers.get('content-type') || 'application/json';

    return new NextResponse(buffer, {
      status: backendRes.status,
      headers: {
        'Content-Type': resContentType,
        'X-Proxy-Target': target,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Proxy request to backend failed',
        target,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
