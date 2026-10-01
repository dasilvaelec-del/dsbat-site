// tests/envoyer-devis-no-whatsapp-auto.test.js — MICRO-LOT UX.
// Vérifie que envoyerDevis() n'ouvre plus automatiquement WhatsApp (message destiné
// à DS.BAT, pas au client), tout en conservant : mail FormSubmit, sauvegarde
// devisMetiers, redirection configurateur, et le bouton WhatsApp MANUEL du récap.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Isoler le corps de envoyerDevis() par équilibrage d'accolades.
function corpsFonction(src, sig) {
  const i = src.indexOf(sig);
  if (i === -1) return '';
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return src.slice(j, k);
}
const corps = corpsFonction(HTML, 'function envoyerDevis(');
A(corps.length > 0, 'envoyerDevis() localisée');

// 1. plus d'ouverture automatique vers wa.me dans envoyerDevis()
A(!/wa\.me/.test(corps), '1. envoyerDevis() ne contient plus de lien wa.me');
A(!/window\.open\s*\([^)]*wa\.me/.test(corps), '1b. aucune ouverture window.open(...wa.me...) automatique');
A(!/msgWA|encodeURIComponent\(\s*msgWA/.test(corps), '1c. message WhatsApp automatique (msgWA) supprimé');

// 2. mail FormSubmit toujours présent
A(/formsubmit\.co\/ajax\/contact@dsbat\.fr/.test(corps), '2. envoi mail FormSubmit conservé');
A(/_subject:\s*'🆕 Nouveau lead/.test(corps), '2b. contenu du mail (sujet lead) inchangé');

// 3. sauvegarde devisMetiers conservée
A(/sessionStorage\.setItem\('devisMetiers',\s*JSON\.stringify\(data\.metiers\)\)/.test(corps), '3. sessionStorage devisMetiers conservé');

// 4. redirection vers le configurateur conservée
A(/window\.location\.href\s*=\s*'devis-configurateur\.html'/.test(corps), '4. redirection vers devis-configurateur.html conservée');

// 5. bouton/lien WhatsApp MANUEL du récapitulatif toujours présent (hors envoyerDevis)
A(/<a[^>]*class="btn btn-whatsapp"[^>]*href="https:\/\/wa\.me\/33629556627"/.test(HTML), '5. bouton manuel « Contacter sur WhatsApp » conservé');
A(/💬 Contacter sur WhatsApp/.test(HTML), '5b. libellé du bouton manuel conservé');
A((HTML.match(/https:\/\/wa\.me\/33629556627/g) || []).length === 2, '5c. exactement 2 liens wa.me restants (bouton récap + flottant), aucun automatique');

console.log('envoyer-devis-no-whatsapp-auto : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
