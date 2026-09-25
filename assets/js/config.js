/* NammaStay — connection settings.
 *
 * DEMO MODE (both values empty): the whole app runs in the browser with
 * sample data for Social Backpackers Hostel. Every screen and button works;
 * changes are saved only in that browser.
 *
 * LIVE MODE: fill in the two values from Supabase → Project Settings → API:
 *   • Project URL          → supabaseUrl
 *   • anon / public key    → supabaseAnonKey
 * The anon key is designed to be public. Your data is protected by the
 * Row Level Security rules in supabase/migrations/002_security.sql.
 * NEVER put the service_role key here.
 */
window.NAMMASTAY_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteUrl: 'https://thenammastay.in'
};

(function () {
  var c = window.NAMMASTAY_CONFIG;
  var h = document.documentElement;
  window.NS_INITIAL_HASH = location.hash;             // read before the auth client clears it
  h.classList.add('ns-booting', c.supabaseUrl && c.supabaseAnonKey ? 'ns-live' : 'ns-demo');
  // Safety net: never leave the page blank if a script fails to load
  setTimeout(function () { h.classList.remove('ns-booting'); }, 8000);
})();
