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
  supabaseUrl: 'https://skcqpfyshbxcyyamsgtj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrY3FwZnlzaGJ4Y3l5YW1zZ3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODg3NTMsImV4cCI6MjEwNjI2NDc1M30.PgKY1xdxnie_F3wj55DTBr5MMvhVcdalf6wRJAgmLK0',
  siteUrl: 'https://app.thenammastay.com',            // this site — the hostel app (links in WhatsApp messages, invites)
  appUrl: 'https://app.thenammastay.com',             // the hostel app
  marketingUrl: 'https://thenammastay.com',        // the homepage
  adminUrl: 'https://admin.thenammastay.com'    // the admin website
};

(function () {
  var c = window.NAMMASTAY_CONFIG;
  var h = document.documentElement;
  window.NS_INITIAL_HASH = location.hash;             // read before the auth client clears it
  h.classList.add('ns-booting', c.supabaseUrl && c.supabaseAnonKey ? 'ns-live' : 'ns-demo');
  // Safety net: never leave the page blank if a script fails to load
  setTimeout(function () { h.classList.remove('ns-booting'); }, 8000);
})();
