(function () {
  var previews = document.querySelectorAll('[data-tour]');
  if (!previews.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (!('IntersectionObserver' in window)) {
    previews.forEach(function (preview) { preview.classList.add('is-playing'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.target.classList.toggle('is-playing', entry.isIntersecting);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

  previews.forEach(function (preview) { observer.observe(preview); });
})();
