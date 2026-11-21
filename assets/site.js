/* Dark mode switch and gentle fade-in on scroll. */
(function () {
  var html = document.documentElement;

  // Theme toggle (the saved choice is applied early by the snippet in <head>)
  var btn = document.getElementById('theme-toggle');
  function label() {
    var dark = html.getAttribute('data-theme') === 'dark';
    if (btn) {
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('aria-pressed', String(dark));
    }
  }
  if (btn) {
    btn.addEventListener('click', function () {
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
  }
  label();

  // Fade-in on scroll
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
  function watch(scope) {
    (scope || document).querySelectorAll('main h2, .card, .pub, .news-item, .chips li, .contact').forEach(function (el) {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal'); io.observe(el);
    });
  }
  watch();
  // Publications are added after the data loads; watch for them too.
  var res = document.getElementById('pub-results');
  if (res && 'MutationObserver' in window) new MutationObserver(function () { watch(res); }).observe(res, { childList: true });
})();
