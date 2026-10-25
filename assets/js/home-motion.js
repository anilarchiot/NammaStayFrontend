(function () {
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealSelector = [
    '.strip li',
    '.pains .pain',
    '.features .feature',
    '.deep',
    '.trust > div',
    '.steps .step',
    '.who > div',
    '.story',
    '.wrap > .kicker',
    '.wrap > .h2',
    '.wrap > h2',
    '.wrap > .sub',
    '.price-tabs',
    '.price-grid .price-card',
    '.price-incl li',
    '.lead-wrap > *',
    '.faq details',
    '.cta-box',
    'footer .wrap > *'
  ].join(',');

  function revealWithin(root) {
    var targets = [];
    if (root.nodeType === 1 && root.matches(revealSelector)) targets.push(root);
    if (root.querySelectorAll) targets = targets.concat(Array.prototype.slice.call(root.querySelectorAll(revealSelector)));
    targets.forEach(function (el) {
      if (el.parentElement && el.parentElement.closest('.reveal')) return;
      el.classList.add('reveal');
      if (!observer) {
        el.classList.add('in');
        return;
      }
      observer.observe(el);
    });
  }

  var observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' })
    : null;

  document.querySelectorAll('.reveal').forEach(function (el) {
    if (observer) observer.observe(el);
    else el.classList.add('in');
  });

  if (reduceMotion) return;

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

  revealWithin(document);
  document.querySelectorAll('.nav-links a,.nav-cta > *').forEach(function (el, i) {
    el.classList.add('motion-enter');
    el.style.animationDelay = (i * 70) + 'ms';
  });

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

  document.querySelectorAll('.strip ul,.pains,.features,.trust,.steps,.who,.price-grid,.price-incl,.faq').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (el, i) {
      el.style.setProperty('--ns-reveal-delay', Math.min(i, 5) * 75 + 'ms');
      el.addEventListener('transitionend', function clearRevealDelay() {
        if (el.classList.contains('in')) {
          el.style.removeProperty('--ns-reveal-delay');
          el.removeEventListener('transitionend', clearRevealDelay);
        }
      });
    });
  });

  var priceGrid = document.getElementById('price-grid');
  if (priceGrid && 'MutationObserver' in window) {
    new MutationObserver(function () { revealWithin(priceGrid); }).observe(priceGrid, { childList: true });
  }
})();
