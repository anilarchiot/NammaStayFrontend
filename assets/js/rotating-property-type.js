const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion) {
  document.querySelectorAll('[data-rotating-type]').forEach((word) => {
    const types = (word.dataset.rotatingType || '').split('|').filter(Boolean);
    if (types.length < 2) return;

    let index = Math.max(0, types.indexOf(word.textContent.trim()));
    window.setInterval(() => {
      word.classList.add('is-changing');
      window.setTimeout(() => {
        index = (index + 1) % types.length;
        word.textContent = types[index];
        word.classList.remove('is-changing');
      }, 180);
    }, 3000);
  });
}
