// Protected app routes. Public marketing/legal pages remain static documents.
export const ROUTES = Object.freeze([
  { key: 'dashboard', path: 'dashboard.html', title: 'Dashboard', module: './pages/dashboard.js' },
  { key: 'bookings', path: 'bookings.html', title: 'Bookings', module: './pages/bookings.js' },
  { key: 'calendar', path: 'calendar.html', title: 'Calendar', module: './pages/calendar.js' },
  { key: 'rooms', path: 'rooms.html', title: 'Rooms', module: './pages/rooms.js' },
  { key: 'ota', path: 'ota.html', title: 'OTA sync', module: './pages/ota.js', roles: ['owner', 'manager'] },
  { key: 'payments', path: 'payments.html', title: 'Payments', module: './pages/payments.js' },
  { key: null, path: 'booking-detail.html', title: 'Booking details', module: './pages/booking-detail.js' },
  { key: 'guests', path: 'guest-profile.html', title: 'Guests', module: './pages/guest-profile.js', roles: ['owner', 'manager', 'front_desk'] },
  { key: 'checkin', path: 'check-in.html', title: 'Check-in', module: './pages/check-in.js', roles: ['owner', 'manager', 'front_desk'] },
  { key: 'branches', path: 'branches.html', title: 'Branches', module: './pages/branches.js' },
  { key: 'formc', path: 'formc.html', title: 'Form C', module: './pages/formc.js', roles: ['owner', 'manager', 'front_desk'] },
  { key: 'housekeeping', path: 'housekeeping.html', title: 'Housekeeping', module: './pages/housekeeping.js', roles: ['owner', 'manager', 'front_desk'] },
  { key: 'setup', path: 'setup.html', title: 'Setup', module: './pages/setup.js', roles: ['owner', 'manager'] },
  { key: 'expenses', path: 'expenses.html', title: 'Expenses', module: './pages/expenses.js', roles: ['owner', 'manager', 'accountant'] },
  { key: 'investment', path: 'investment.html', title: 'My business', module: './pages/investment.js', roles: ['owner'] },
  { key: 'health', path: 'health.html', title: 'Business health', module: './pages/health.js', roles: ['owner', 'manager'] },
  { key: 'tenants', path: 'tenants.html', title: 'Tenants & rent', module: './pages/tenants.js', roles: ['owner', 'manager', 'front_desk', 'accountant'] },
  { key: 'activities', path: 'activities.html', title: 'Activities', module: './pages/activities.js', roles: ['owner', 'manager', 'front_desk', 'accountant'] },
  { key: 'dayvisits', path: 'day-visitors.html', title: 'Day visitors', module: './pages/day-visitors.js', roles: ['owner', 'manager', 'front_desk', 'accountant'] },
  { key: 'groups', path: 'groups.html', title: 'Groups', module: './pages/groups.js', roles: ['owner', 'manager', 'front_desk', 'accountant'] },
  { key: 'pgpayments', path: 'pg-payments.html', title: 'PG payments', module: './pages/pg-payments.js', roles: ['owner', 'manager', 'front_desk', 'accountant'] },
  { key: 'pgreport', path: 'pg-report.html', title: 'PG report', module: './pages/pg-report.js', roles: ['owner', 'manager', 'accountant'] },
  { key: 'reports', path: 'reports.html', title: 'Reports', module: './pages/reports.js', roles: ['owner', 'manager', 'accountant'] },
  { key: 'settings', path: 'settings.html', title: 'Settings', module: './pages/settings.js', roles: ['owner', 'manager'] },
]);

export const ROUTE_BY_KEY = new Map(ROUTES.map((route) => [route.key, route]));
export const ROUTE_BY_PATH = new Map(ROUTES.map((route) => [route.path, route]));
export const PAGE_ROLES = Object.freeze(Object.fromEntries(ROUTES.filter(({ key, roles }) => key && roles).map(({ key, roles }) => [key, roles])));
export const NAV_KEY = Object.freeze(Object.fromEntries(ROUTES.filter(({ key }) => key).map(({ key, path }) => [path, key])));

export function resolveRoute(pathname = location.pathname) {
  const path = pathname.split('/').filter(Boolean).pop() || 'dashboard.html';
  return ROUTE_BY_PATH.get(path) || null;
}

export function routeUrl(key, query = {}) {
  const route = ROUTE_BY_KEY.get(key);
  if (!route) throw new Error(`Unknown route: ${key}`);
  const url = new URL(route.path, location.href);
  Object.entries(query).forEach(([name, value]) => {
    if (value === null || value === undefined || value === '') url.searchParams.delete(name);
    else url.searchParams.set(name, String(value));
  });
  return url;
}

export function navigate(key, query = {}, { replace = false } = {}) {
  const url = routeUrl(key, query);
  if (replace) location.replace(url.href);
  else location.assign(url.href);
}
