/* NammaStay — connection settings.
 *
 * Fill in the two values from Supabase → Project Settings → API:
 *   • Project URL          → supabaseUrl
 *   • anon / public key    → supabaseAnonKey
 * The anon key is designed to be public. Your data is protected by the
 * Row Level Security rules in the backend repo (supabase/migrations).
 * NEVER put the service_role key here.
 * Empty keys → the app shows "Not connected yet" and nobody can sign in.
 */
window.NAMMASTAY_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteUrl: 'https://thenammastay.com',
  adminUrl: 'https://admin.thenammastay.com'
};

(function () {
  var c = window.NAMMASTAY_CONFIG;
  var h = document.documentElement;
  window.NS_INITIAL_HASH = location.hash;             // read before the auth client clears it
  h.classList.add('ns-booting', c.supabaseUrl && c.supabaseAnonKey ? 'ns-live' : 'ns-demo');
  // Safety net: never leave the page blank if a script fails to load
  setTimeout(function () { h.classList.remove('ns-booting'); }, 8000);
})();
