(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var bar = document.createElement('div');
  bar.className = 'ns-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  function progress() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(scrollY / h, 1) : 0) + ')';
  }
  addEventListener('scroll', progress, { passive: true });
  progress();

  var hero = document.querySelector('.hero');
  if (hero) {
    ['a', 'b'].forEach(function (c) {
      var o = document.createElement('i');
      o.className = 'ns-orb ' + c;
      o.setAttribute('aria-hidden', 'true');
      hero.appendChild(o);
    });
    var shot = hero.querySelector('.shot-stack .browser');
    if (shot && matchMedia('(hover: hover)').matches) {
      hero.addEventListener('mousemove', function (e) {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        shot.style.transform = 'perspective(1200px) rotateY(' + (x * 5) + 'deg) rotateX(' + (-y * 4) + 'deg)';
      });
      hero.addEventListener('mouseleave', function () { shot.style.transform = ''; });
    }
  }

  // Stagger the existing .reveal cards inside each grid
  document.querySelectorAll('.features,.pains,.steps').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (el, i) { el.style.transitionDelay = (i * 80) + 'ms';
      el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
    });
  });
})();
