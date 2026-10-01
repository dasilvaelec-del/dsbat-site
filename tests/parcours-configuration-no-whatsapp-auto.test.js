// tests/parcours-configuration-no-whatsapp-auto.test.js
// Le parcours « ✅ Continuer vers la configuration des travaux → » ne doit déclencher
// AUCUNE ouverture automatique de WhatsApp — ni sur devis.html (envoyerDevis), ni sur
// devis-configurateur.html (envoyerNotifications, appelée à la génération du devis).
// Les liens WhatsApp MANUELS, le mail FormSubmit/email auto et devisMetiers sont conservés.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CONF = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// corps d'une fonction par équilibrage d'accolades
function corps(src, sig) {
  const i = src.indexOf(sig); if (i === -1) return '';
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) { k++; break; } } }
  return src.slice(j, k);
}

// ===== 1. Bouton « Continuer vers la configuration des travaux » -> envoyerDevis() =====
A(/onclick="envoyerDevis\(\)"[\s\S]{0,80}Continuer vers la configuration des travaux/.test(DEVIS)
  || /Continuer vers la configuration des travaux[\s\S]{0,80}/.test(DEVIS) && /onclick="envoyerDevis\(\)"/.test(DEVIS),
  '1. bouton « Continuer… » câblé sur envoyerDevis()');

// ===== 2. envoyerDevis() : aucune ouverture automatique WhatsApp =====
const cEnv = corps(DEVIS, 'function envoyerDevis(');
A(cEnv.length > 0, 'envoyerDevis() localisée');
A(!/wa\.me/.test(cEnv) && !/window\.open/.test(cEnv), '2. envoyerDevis() : aucune ouverture automatique WhatsApp');

// ===== 3. envoyerNotifications() (configurateur) : aucune ouverture automatique WhatsApp =====
const cNotif = corps(CONF, 'function envoyerNotifications(');
A(cNotif.length > 0, 'envoyerNotifications() localisée');
A(!/wa\.me/.test(cNotif) && !/window\.open/.test(cNotif), '3. envoyerNotifications() : aucune ouverture automatique WhatsApp');

// ===== 3b. AUCUN window.open subsistant dans tout le configurateur =====
A(!/window\.open/.test(CONF), '3b. aucun window.open automatique restant dans devis-configurateur.html');

// ===== 4. redirection vers le configurateur conservée =====
A(/window\.location\.href\s*=\s*'devis-configurateur\.html'/.test(cEnv), '4. redirection vers devis-configurateur.html conservée');

// ===== 5. envois automatiques (mail) conservés =====
A(/formsubmit\.co\/ajax\/contact@dsbat\.fr/.test(cEnv), '5. mail FormSubmit (lead) conservé dans envoyerDevis()');
A(/envoyerEmail\(/.test(cNotif), '5b. email automatique (avec PDF) conservé dans envoyerNotifications()');

// ===== 6. devisMetiers conservé =====
A(/sessionStorage\.setItem\('devisMetiers',\s*JSON\.stringify\(data\.metiers\)\)/.test(cEnv), '6. sessionStorage devisMetiers conservé');

// ===== 7. liens WhatsApp MANUELS conservés sur les deux pages =====
A(/class="btn btn-whatsapp"[^>]*href="https:\/\/wa\.me\/33629556627"/.test(DEVIS), '7. devis.html : bouton manuel « Contacter sur WhatsApp » conservé');
A((DEVIS.match(/https:\/\/wa\.me\/33629556627/g) || []).length === 2, '7b. devis.html : 2 liens wa.me manuels (bouton + flottant), aucun auto');
A(/💬 Envoyer sur WhatsApp/.test(CONF) && /href="https:\/\/wa\.me\/33629556627"/.test(CONF), '7c. configurateur : bouton manuel « Envoyer sur WhatsApp » conservé');
A((CONF.match(/https:\/\/wa\.me\/33629556627/g) || []).length === 2, '7d. configurateur : 2 liens wa.me manuels (bouton récap + flottant), aucun auto');

console.log('parcours-configuration-no-whatsapp-auto : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
