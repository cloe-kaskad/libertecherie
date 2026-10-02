/* Bannière de consentement cookies - Liberté, Chérie ! (relié au Consent Mode de Google / GTM) */
(function () {
  var KEY = 'lc_consent';
  var dl = window.dataLayer = window.dataLayer || [];
  function gtag() { dl.push(arguments); }

  function apply(choice) {
    var v = choice === 'granted' ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });
    dl.push({ event: choice === 'granted' ? 'consent_granted' : 'consent_denied' });
  }

  function save(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) {}
    apply(choice);
    hide();
  }

  var css = '.lc-cookie{position:fixed;left:24px;bottom:24px;z-index:9000;max-width:400px;width:calc(100% - 48px);background:#faf6f1;border:1px solid rgba(81,0,4,.14);border-radius:6px;box-shadow:0 18px 50px rgba(81,0,4,.18);padding:26px 26px 24px;font-family:"DM Sans",system-ui,sans-serif;color:#510004;opacity:0;transform:translateY(16px);transition:opacity .35s,transform .35s}' +
    '.lc-cookie.is-in{opacity:1;transform:none}' +
    '.lc-cookie h2{font-family:"Libre Baskerville",Georgia,serif;font-style:italic;font-weight:400;font-size:21px;line-height:1.25;color:#e6361d;margin:0 0 10px}' +
    '.lc-cookie p{font-size:13.5px;line-height:1.5;margin:0 0 20px;color:#510004}' +
    '.lc-cookie-btns{display:flex;gap:10px}' +
    '.lc-cookie button{flex:1 1 0;font-family:inherit;font-size:15px;font-weight:500;padding:13px 16px;border-radius:999px;cursor:pointer;border:1.5px solid #510004;transition:background .2s,color .2s}' +
    '.lc-cookie .lc-yes{background:#510004;color:#fff}' +
    '.lc-cookie .lc-yes:hover{background:#e6361d;border-color:#e6361d}' +
    '.lc-cookie .lc-no{background:transparent;color:#510004}' +
    '.lc-cookie .lc-no:hover{background:#f7beca}' +
    '@media (max-width:520px){.lc-cookie{left:12px;right:12px;bottom:12px;width:auto;max-width:none;padding:22px 20px 20px}.lc-cookie h2{font-size:19px}}';

  var box;
  function show() {
    if (box) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    box = document.createElement('div');
    box.className = 'lc-cookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Préférences cookies');
    box.innerHTML = '<h2>Le consentement, un sujet qu\'on connaît 🙂</h2>' +
      '<p>Quelques cookies nous aident à savoir ce qui vous donne envie de venir, pour mieux choisir nos prochains sujets 🙏</p>' +
      '<div class="lc-cookie-btns"><button type="button" class="lc-yes">Avec plaisir</button><button type="button" class="lc-no">Non merci</button></div>';
    document.body.appendChild(box);
    box.querySelector('.lc-yes').addEventListener('click', function () { save('granted'); });
    box.querySelector('.lc-no').addEventListener('click', function () { save('denied'); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('is-in'); }); });
  }
  function hide() {
    if (!box) return;
    box.classList.remove('is-in');
    var b = box; box = null;
    setTimeout(function () { b.remove(); }, 350);
  }

  // Pour changer d'avis : lien "Gérer mes cookies" en pied de page
  window.lcCookies = function () { show(); };

  function init() {
    var fb = document.querySelector('.footer-bottom');
    if (fb && !fb.querySelector('.lc-manage')) {
      var a = document.createElement('a');
      a.href = '#'; a.className = 'lc-manage'; a.textContent = 'Gérer mes cookies';
      a.addEventListener('click', function (e) { e.preventDefault(); show(); });
      var spans = fb.querySelectorAll('span');
      var host = spans[spans.length - 1] || fb;
      if (host !== fb) host.appendChild(document.createTextNode(' · '));
      host.appendChild(a);
    }
    var c = null;
    try { c = localStorage.getItem(KEY); } catch (e) {}
    if (c === 'granted' || c === 'denied') apply(c);
    else setTimeout(show, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
