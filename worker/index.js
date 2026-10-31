// Edge proxy: the browser only ever talks to /api/* on our own domain. The Supabase project URL and
// anon key live here (Worker var SUPABASE_URL, secret SUPABASE_ANON_KEY) and are never shipped to the page.
const PLACEHOLDER = 'eyJns-public-placeholder';
const ALLOWED = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/functions/v1/', '/realtime/v1/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });

    const path = url.pathname.slice(4);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !ALLOWED.some((p) => path.startsWith(p))) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers(request.headers);
    ['cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'x-forwarded-for', 'x-real-ip'].forEach((h) => headers.delete(h));
    if (headers.get('apikey') === PLACEHOLDER) headers.set('apikey', env.SUPABASE_ANON_KEY);
    const auth = headers.get('authorization');
    if (auth === `Bearer ${PLACEHOLDER}`) {
      // New-style publishable keys are not JWTs and must not be sent as a bearer token.
      if (env.SUPABASE_ANON_KEY.startsWith('eyJ')) headers.set('authorization', `Bearer ${env.SUPABASE_ANON_KEY}`);
      else headers.delete('authorization');
    }

    const target = env.SUPABASE_URL.replace(/\/$/, '') + path + url.search;
    const res = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual' });
    const out = new Response(res.body, res);
    out.headers.delete('server');
    out.headers.set('cache-control', 'private, no-store');
    return out;
  },
};
