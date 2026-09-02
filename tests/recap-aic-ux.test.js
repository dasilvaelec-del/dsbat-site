// =====================================================================
// tests/recap-aic-ux.test.js — M55-A : reformulation UX des intitulés du récap AIC
// =====================================================================
// Vérifie que renderRecapAIC() (devis-configurateur.html) reformule DEUX intitulés
// UNIQUEMENT pour l'affichage du récap client, SANS toucher au rendu partagé
// SyntheseAICUIDSBAT.rendre() (utilisé aussi par le PDF/e-mail AIC, hors périmètre),
// et sans reconstruire les données AIC. Exécute le source réel extrait du HTML.
// =====================================================================
const fs = require('fs');
const path = require('path');
const CONF = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');
const UI = fs.readFileSync(path.join(__dirname, '..', 'js', 'synthese-aic-ui.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

const OLD1 = 'À vérifier en visite', NEW1 = 'Points à confirmer lors de la visite';
const OLD2 = 'Prestations retenues', NEW2 = 'Travaux pris en compte dans l\'estimation';

// ---- Le renderer PARTAGÉ (source de vérité) reste INCHANGÉ ----------
A(UI.indexOf(OLD1) !== -1, 'renderer partagé (synthese-aic-ui.js) conserve « ' + OLD1 + ' » (PDF/e-mail intacts)');
A(UI.indexOf(OLD2) !== -1, 'renderer partagé conserve « ' + OLD2 + ' »');
A(UI.indexOf(NEW1) === -1 && UI.indexOf(NEW2) === -1, 'renderer partagé NON modifié (aucun nouvel intitulé M55-A)');

// ---- Transition présente, masquée par défaut, gérée en phase 3 -----
A(/id="recapTransition"[^>]*display:none/.test(CONF), 'transition présente et masquée par défaut');
A(/Cette estimation correspond aux éléments récapitulés ci-dessus\./.test(CONF), 'texte de transition exact présent');
A(/__transit\.style\.display = 'none'/.test(CONF) && /__transit\.style\.display = 'block'/.test(CONF), 'transition : masquée en maintenance, affichée avec le devis');

// ---- Exécution réelle de renderRecapAIC (récap-only) ---------------
const SRC = extraire(CONF, 'function renderRecapAIC()');
const HTML_RENDU = '<div class="aic-synthese"><h2>Synthèse de votre projet</h2>'
  + '<section><h3>🏠 Votre projet</h3>…</section>'
  + '<section><h3>💡 Ce que nous avons compris</h3>…</section>'
  + '<section><h3>✅ Ce que vous avez confirmé</h3>…</section>'
  + '<section><h3>🧩 Configuration retenue</h3>…</section>'
  + '<section><h3>🛠️ ' + OLD2 + '</h3>…</section>'
  + '<section><h3>📋 ' + OLD1 + '</h3>…</section></div>';

const cible = { innerHTML: '' };
const document = { getElementById: (id) => (id === 'recapAIC' ? cible : null) };
const SyntheseAICUIDSBAT = { rendre: () => HTML_RENDU };
const __construireAICCourant = () => ({}); // objet AIC truthy (données non reconstruites ici)
new Function('document', 'SyntheseAICUIDSBAT', '__construireAICCourant', SRC + ';renderRecapAIC();')(document, SyntheseAICUIDSBAT, __construireAICCourant);

// Récap : nouveaux intitulés
A(cible.innerHTML.indexOf(NEW1) !== -1, 'récap : « ' + OLD1 + ' » → « ' + NEW1 + ' »');
A(cible.innerHTML.indexOf(NEW2) !== -1, 'récap : « ' + OLD2 + ' » → « ' + NEW2 + ' »');
// Récap : anciens intitulés absents
A(cible.innerHTML.indexOf(OLD1) === -1, 'récap : ancien « ' + OLD1 + ' » retiré');
A(cible.innerHTML.indexOf(OLD2) === -1, 'récap : ancien « ' + OLD2 + ' » retiré');
// Les 4 sections distinctes conservées
['🏠 Votre projet', '💡 Ce que nous avons compris', '✅ Ce que vous avez confirmé', '🧩 Configuration retenue'].forEach(t =>
  A(cible.innerHTML.indexOf(t) !== -1, 'section conservée : ' + t));

// La chaîne source (celle que consomme le PDF/e-mail) n'est PAS altérée par le post-traitement
A(HTML_RENDU.indexOf(OLD1) !== -1 && HTML_RENDU.indexOf(OLD2) !== -1, 'chaîne rendre() d\'origine intacte (PDF/e-mail garderaient les anciens intitulés)');
// AIC absent → pas de crash, récap non écrasé
{ const c2 = { innerHTML: 'X' }; const doc2 = { getElementById: () => c2 };
  new Function('document', 'SyntheseAICUIDSBAT', '__construireAICCourant', SRC + ';renderRecapAIC();')(doc2, SyntheseAICUIDSBAT, () => null);
  A(c2.innerHTML === 'X', 'AIC absent (null) → return anticipé, aucun crash'); }

const total = ok + ko;
if (ko === 0) console.log('✅ Récap AIC UX (M55-A) : ' + ok + '/' + total + ' — 2 intitulés reformulés côté récap seul, renderer partagé intact, transition gérée');
else { console.error('❌ Récap AIC UX : ' + ok + '/' + total); process.exit(1); }
