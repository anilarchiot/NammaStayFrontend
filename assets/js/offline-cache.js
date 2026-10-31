const CACHE_NAMESPACE = 'offline_api';
const SAFE_READ_RPCS = new Set([
  'activities_list', 'activity_guests', 'admin_actions_list', 'admin_archivable_bookings', 'admin_blob_columns',
  'admin_coupons', 'admin_expired_id_files', 'admin_health', 'admin_invoice_settings', 'admin_mfa_info', 'admin_overview', 'admin_platform_invoices', 'admin_property',
  'admin_property_invites', 'admin_revenue', 'admin_reminders', 'admin_storage_usage', 'admin_subscriptions',
  'api_key_list', 'available_beds', 'bed_board', 'billing_info', 'biz_summary', 'branches_overview', 'business_health', 'calendar_range',
  'booking_detail', 'booking_guests_list', 'booking_status_counts',
  'check_coupon', 'dashboard_summary', 'day_visits_list', 'dayout_packages_list', 'formc_due_count', 'formc_list',
  'company_health', 'company_summary', 'guest_profile', 'group_get', 'groups_list', 'guide_for_token', 'guide_get',
  'hk_board', 'hk_counts', 'invest_summary', 'lead_counts',
  'legal_checklist_get', 'legal_docs_alerts', 'legal_docs_list', 'kitchen_list', 'list_bookings', 'list_deleted_bookings',
  'list_leads', 'list_members', 'list_payments', 'meal_plans_list', 'my_billing_details', 'my_memberships',
  'my_platform_invoices', 'occupancy_series', 'ota_overview', 'paylink_list', 'payment_summary', 'pg_dashboard',
  'pg_income', 'pg_mode', 'pg_payments', 'pg_report', 'pg_selfcheckin_info', 'pg_tenant', 'pg_tenants', 'profit_summary',
  'property_access', 'property_suspension', 'public_property_count', 'rate_preview', 'report_summary', 'resort_income',
  'resort_mode',
  'resort_mode', 'resort_settings_get', 'resort_today', 'search_guests', 'setup_progress', 'sp_get',
]);

export function createDesktopOfflineFetch(apiKey) {
  const desktop = window.NS_DESKTOP;
  if (!desktop?.localStore) return null;

  const store = desktop.localStore;
  const networkFetch = window.fetch.bind(window);

  async function cacheIdentity(request, body) {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').split('.')[1];
    if (!token) return null;
    try {
      const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
      if (!claims.sub) return null;
      const input = new TextEncoder().encode(`${claims.sub}\n${request.method}\n${request.url}\n${body}`);
      const digest = await crypto.subtle.digest('SHA-256', input);
      const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      return { userId: claims.sub, key };
    } catch { return null; }
  }

  function canCache(request) {
    const url = new URL(request.url);
    if (!url.pathname.includes('/rest/v1/')) return false;
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    if (request.method !== 'POST') return false;
    const match = /\/rest\/v1\/rpc\/([a-z0-9_]+)$/i.exec(url.pathname);
    return !!match && SAFE_READ_RPCS.has(match[1]);
  }

  async function saveResponse(identity, request, requestBody, response) {
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const body = await response.clone().text();
    if (new TextEncoder().encode(body).byteLength > 800 * 1024) return;
    const headers = {};
    response.headers.forEach((value, name) => {
      if (!['content-length', 'content-encoding', 'transfer-encoding', 'set-cookie'].includes(name.toLowerCase())) headers[name] = value;
    });
    const requestHeaders = {};
    request.headers.forEach((value, name) => {
      if (!['authorization', 'apikey', 'host', 'origin', 'content-length'].includes(name.toLowerCase())) requestHeaders[name] = value;
    });
    await store.set(CACHE_NAMESPACE, identity.key, {
      userId: identity.userId, url: request.url, method: request.method, requestBody,
      requestHeaders, status: response.status, statusText: response.statusText,
      responseHeaders: headers, responseBody: body, syncedAt: new Date().toISOString(),
    });
  }

  async function cachedFetch(input, init) {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    if (!canCache(request)) return networkFetch(request);
    const requestBody = ['GET', 'HEAD'].includes(request.method) ? '' : await request.clone().text();
    const identity = await cacheIdentity(request, requestBody);
    if (!identity) return networkFetch(request);

    try {
      const response = await networkFetch(request.clone());
      await saveResponse(identity, request, requestBody, response).catch(() => {});
      return response;
    } catch (error) {
      const cached = await store.get(CACHE_NAMESPACE, identity.key).catch(() => null);
      if (!cached || cached.userId !== identity.userId) throw error;
      window.dispatchEvent(new CustomEvent('ns:offline-cache-used', { detail: { syncedAt: cached.syncedAt } }));
      return new Response(cached.responseBody, { status: cached.status, statusText: cached.statusText, headers: cached.responseHeaders });
    }
  }

  let syncing = false;
  async function syncCachedReads(getSession) {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
      const session = await getSession();
      const userId = session?.user?.id;
      const token = session?.access_token;
      if (!userId || !token) return;
      const records = await store.list(CACHE_NAMESPACE);
      for (const { key, value } of records) {
        if (value.userId !== userId) continue;
        const headers = new Headers(value.requestHeaders);
        headers.set('apikey', apiKey);
        headers.set('authorization', `Bearer ${token}`);
        const response = await networkFetch(value.url, {
          method: value.method,
          headers,
          body: ['GET', 'HEAD'].includes(value.method) ? undefined : value.requestBody,
        }).catch(() => null);
        if (!response?.ok) continue;
        const request = new Request(value.url, { method: value.method, headers, body: ['GET', 'HEAD'].includes(value.method) ? undefined : value.requestBody });
        const identity = { key, userId };
        await saveResponse(identity, request, value.requestBody, response).catch(() => {});
      }
    } finally { syncing = false; }
  }

  return {
    fetch: cachedFetch,
    start(getSession) {
      const sync = () => syncCachedReads(getSession);
      sync();
      const timer = setInterval(sync, 30 * 60 * 1000);
      window.addEventListener('online', sync);
      return () => { clearInterval(timer); window.removeEventListener('online', sync); };
    },
  };
}
