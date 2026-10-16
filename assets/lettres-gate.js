/* Liberté, Chérie ! : aperçu des lettres pour les non-inscrites.
   La classe lc-locked est posée par l'edge function lettres-gate quand la visiteuse
   n'a pas (encore) d'accès. Chaque zone [data-lock] est alors coupée après un aperçu,
   avec un formulaire d'inscription. Une fois inscrite, la page se recharge en entier. */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('lc-locked')) return;

  var css = document.createElement('style');
  css.textContent =
    '[data-lock]{position:relative;max-height:var(--lc-preview,760px);overflow:hidden}' +
    '[data-lock]::after{content:"";position:absolute;left:0;right:0;bottom:0;height:320px;' +
      'background:linear-gradient(to bottom,rgba(250,245,242,0),var(--ivoire,#faf6f1) 85%);pointer-events:none}' +
    '.lc-gate{position:relative;z-index:2;max-width:560px;margin:-120px auto 72px;padding:34px 32px 28px;' +
      'background:var(--blanc,#fff);border-radius:12px;box-shadow:0 18px 50px rgba(81,0,4,.14);font-family:var(--fb);text-align:center}' +
    '.lc-gate .k{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--rouge);font-weight:600;margin-bottom:12px}' +
    '.lc-gate h2{font-family:var(--fs);font-style:italic;font-weight:400;font-size:26px;line-height:1.25;color:var(--bordeaux);margin-bottom:10px}' +
    '.lc-gate p{font-size:15.5px;line-height:1.55;color:var(--encre);margin-bottom:18px}' +
    '.lc-gate form{display:flex;gap:8px;margin-bottom:8px}' +
    '.lc-gate input{flex:1;min-width:0;font-family:var(--fb);font-size:16px;padding:13px 16px;border:1.5px solid var(--hairline);border-radius:999px;background:var(--ivoire)}' +
    '.lc-gate input:focus{outline:none;border-color:var(--rouge);box-shadow:0 0 0 3px rgba(230,54,29,.14)}' +
    '.lc-gate button{font-family:var(--fb);font-weight:600;font-size:15px;padding:13px 22px;border:0;border-radius:999px;background:var(--rouge);color:#fff;cursor:pointer}' +
    '.lc-gate button:disabled{opacity:.6;cursor:default}' +
    '.lc-gate .msg{font-size:14px;font-weight:600;color:var(--rouge);min-height:20px}' +
    '.lc-gate .fine{font-size:12.5px;color:var(--doux);margin:6px 0 0}' +
    '.lc-gate .fine a{color:var(--doux)}' +
    '@media (max-width:560px){.lc-gate{margin:-100px 16px 56px;padding:28px 20px 22px}.lc-gate form{flex-direction:column}.lc-gate button{width:100%}}';
  document.head.appendChild(css);

  var zones = document.querySelectorAll('[data-lock]');
  if (!zones.length) return;
  var zone = zones[0];
  var gate = document.createElement('div');
  gate.className = 'lc-gate';
  gate.innerHTML =
    '<div class="k">Réservé à la communauté</div>' +
    '<h2>La suite est réservée aux inscrites</h2>' +
    '<p>Laisse ton email pour rejoindre la newsletter : tout s’ouvre immédiatement, cette lettre, la toolbox et toutes les autres.</p>' +
    '<form><input type="email" placeholder="ton@email.fr" autocomplete="email" required aria-label="Adresse email">' +
    '<button type="submit">Lire la suite</button></form>' +
    '<div class="msg">&nbsp;</div>' +
    '<p class="fine">Déjà inscrite ? Mets ton adresse, tu retrouves ton accès. Deux lettres par mois, désinscription en un clic. <a href="/confidentialite">Confidentialité</a>.</p>';
  zone.parentNode.insertBefore(gate, zone.nextSibling);
  for (var i = 1; i < zones.length; i++) zones[i].style.display = 'none';

  var form = gate.querySelector('form'), input = gate.querySelector('input'),
      btn = gate.querySelector('button'), msg = gate.querySelector('.msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Adresse email invalide.'; return; }
    btn.disabled = true; btn.textContent = 'Un instant…';
    fetch('/api/subscribe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (r) {
      if (!r.ok) throw new Error();
      msg.textContent = 'C’est ouvert !';
      setTimeout(function () { location.reload(); }, 500);
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Lire la suite';
      msg.textContent = 'Oups, réessaie dans un instant.';
    });
  });
})();
