const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rotating hero phrase
const rot = document.getElementById('rot');
const words = ['Keep your guests.', 'Keep your commission.', 'Sync with NammaStay.', 'Get direct bookings.'];
if (rot && !calm) {
  let i = 0;
  setInterval(() => {
    rot.classList.add('out');
    setTimeout(() => { i = (i + 1) % words.length; rot.textContent = words[i]; rot.classList.remove('out'); }, 350);
  }, 2600);
}

// Scroll reveal
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => (calm ? el.classList.add('in') : io.observe(el)));
