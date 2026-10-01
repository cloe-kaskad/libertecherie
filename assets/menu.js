(function () {
  var nav = document.querySelector('nav.top');
  if (!nav) return;
  var links = nav.querySelector('.nav-links');
  if (!links) return;
  var btn = document.createElement('button');
  btn.className = 'nav-burger';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Ouvrir le menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(btn);
  function close() {
    nav.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Ouvrir le menu');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', function () {
    var open = !nav.classList.contains('menu-open');
    nav.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 820) close(); });
})();
