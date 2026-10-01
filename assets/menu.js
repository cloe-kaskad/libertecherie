(function () {
  function init() {
    var nav = document.querySelector('nav.top') || document.querySelector('nav');
    if (!nav) return;
    var links = nav.querySelector('.nav-links') || nav.querySelector('ul');
    if (!links || nav.querySelector('.nav-burger')) return;

    var css = '.nav-burger{display:none}' +
      '@media (max-width:820px){' +
      '.nav-burger{display:flex;flex-direction:column;justify-content:center;gap:5px;width:44px;height:44px;padding:0 11px;border:none;border-radius:999px;background:#fff;cursor:pointer;position:relative;z-index:1001;margin-left:10px;flex:0 0 auto}' +
      '.nav-burger span{display:block;height:2px;width:100%;background:#e6361d;border-radius:2px;transition:transform .25s,opacity .2s}' +
      'nav.menu-open .nav-burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}' +
      'nav.menu-open .nav-burger span:nth-child(2){opacity:0}' +
      'nav.menu-open .nav-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}' +
      'nav .nav-links{margin-left:auto}' +
      'nav.menu-open .nav-links{display:flex!important;position:fixed!important;inset:0!important;z-index:1000!important;background:#e6361d!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;gap:26px!important;margin:0!important;padding:90px 30px 40px!important;transform:none!important}' +
      'nav.menu-open .nav-links li{display:block!important}' +
      'nav.menu-open .nav-links a{font-size:15px!important;letter-spacing:.14em;color:#fff!important;opacity:1!important}' +
      'nav.menu-open .nav-links a.nav-pill{background:#fff!important;color:#e6361d!important;font-size:13px!important;margin-top:10px}' +
      'nav.menu-open .nav-logo{position:relative;z-index:1001}' +
      '}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
