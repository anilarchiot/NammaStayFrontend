const navToggle = document.getElementById('menu-toggle');
const nav = document.getElementById('site-nav');

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav?.classList.toggle('open', open);
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  navToggle?.setAttribute('aria-label', 'Open menu');
}));

document.querySelectorAll('.gallery-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    document.querySelectorAll('.gallery-filter').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.screen-card').forEach((card) => {
      card.hidden = filter !== 'all' && card.dataset.category !== filter;
    });
  });
});

const lightbox = document.getElementById('lightbox');
const lightboxImage = lightbox?.querySelector('img');
let caption = null;
let current = -1;
const shots = () => [...document.querySelectorAll('[data-lightbox]')].filter((a) => !a.closest('[hidden]'));

function showShot(index) {
  const list = shots();
  if (!list.length || !lightboxImage) return;
  current = (index + list.length) % list.length;
  const link = list[current];
  const label = link.querySelector('span:not(.preview-label)')?.textContent || '';
  lightboxImage.src = link.getAttribute('href');
  lightboxImage.alt = link.querySelector('img')?.alt || link.getAttribute('aria-label') || 'Product screenshot';
  if (caption) caption.textContent = label || lightboxImage.alt;
}

if (lightbox && lightboxImage) {
  caption = document.createElement('p');
  caption.className = 'lightbox-caption';
  lightbox.append(caption);
  ['prev', 'next'].forEach((dir) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lightbox-nav ' + dir;
    btn.setAttribute('aria-label', dir === 'prev' ? 'Previous screenshot' : 'Next screenshot');
    btn.textContent = dir === 'prev' ? '‹' : '›';
    btn.addEventListener('click', (event) => { event.stopPropagation(); showShot(current + (dir === 'prev' ? -1 : 1)); });
    lightbox.append(btn);
  });
}

document.querySelectorAll('[data-lightbox]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!lightbox || !lightboxImage || typeof lightbox.showModal !== 'function') return;
    event.preventDefault();
    showShot(shots().indexOf(link));
    lightbox.showModal();
  });
});

lightbox?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') showShot(current - 1);
  if (event.key === 'ArrowRight') showShot(current + 1);
});
lightbox?.querySelector('.lightbox-close')?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox?.addEventListener('close', () => {
  if (lightboxImage) lightboxImage.removeAttribute('src');
});

// Reveal sections and cards as they scroll into view.
const revealTargets = document.querySelectorAll('.section-heading, .journey-card, .screen-card, .search-callout, .split-feature, .owner-band, .final-cta, .gallery-toolbar');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { const el = entry.target; el.classList.add('in'); io.unobserve(el);
      setTimeout(() => { el.classList.remove('js-reveal', 'in'); el.style.removeProperty('--d'); }, 1000); }
  }), { threshold: 0.12 });
  revealTargets.forEach((el, i) => {
    el.classList.add('js-reveal');
    el.style.setProperty('--d', ((i % 4) * 0.07) + 's');
    io.observe(el);
  });
}
