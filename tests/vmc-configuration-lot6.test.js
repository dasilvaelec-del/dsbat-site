// =====================================================================
// tests/vmc-configuration-lot6.test.js — M57 LOT6 : configuration VMC contrôlée
// =====================================================================
// LOT6 = SOLUTION déclarative → CONFIGURATION GÉNÉRALE déclarative.
// Nouvelle structure `chantier.ventilationDeclaree` (au niveau chantier, HORS piece.config) :
//   { general: { priseAirNeuf, rejet, insufflation }, fonctionsParPiece: {} }
// Purement déclaratif : n'alimente NI le calcul, NI dimensionnementVMC, NI le catalogue, NI le Runtime.
// Règles clés vérifiées :
//   • piece.config (VMC_BOUCHE / VMC_ENTREE_AIR) TOTALEMENT inchangé ;
//   • capacité insufflation représentée au niveau général (déclaratif) ;
//   • config générale visible UNIQUEMENT si solutionVentilation='double_flux' ;
//   • double_flux reste déclaratif : aucun calcul DF introduit ;
//   • solutionVentilation non transformée ; `inconnue` → aucune inférence ;
//   • aucune dépose automatique ; aucun impact prix/catalogue/Runtime ;
//   • fonctionsParPiece présent mais INERTE (aucune UI par pièce dans ce lot).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CTX = fs.readFileSync(path.join(RACINE, 'js', 'contexte-projet.js'), 'utf8');
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const VMCJS = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const INTERP = fs.readFileSync(path.join(RACINE, 'js', 'interpretation-descriptif.js'), 'utf8');

let ok = 0, ko = 0, skip = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}
function selectBloc(id) {
  const s = DEVIS.indexOf('<select id="' + id + '"');
  if (s < 0) return '';
  const e = DEVIS.indexOf('</select>', s);
  return e < 0 ? '' : DEVIS.slice(s, e + 9);
}

// ---- 1. Nouvelle structure déclarative + collecte --------------------
A(/ventilationDeclaree:\s*\{/.test(DEVIS), 'devis.html : chantier.ventilationDeclaree collecté');
A(/general:\s*\{/.test(DEVIS) && /fonctionsParPiece:\s*\{\}/.test(DEVIS), 'structure { general, fonctionsParPiece:{} }');
A(/priseAirNeuf: \(document\.getElementById\('vdfPriseAirNeuf'\)/.test(DEVIS), 'general.priseAirNeuf collecté (repli inconnu)');
A(/rejet: \(document\.getElementById\('vdfRejet'\)/.test(DEVIS), 'general.rejet collecté (repli inconnu)');
A(/insufflation: \(document\.getElementById\('vdfInsufflation'\)/.test(DEVIS), 'general.insufflation collecté (repli inconnu)');
A(/: 'inconnu'\)/.test(selectBloc('vdfPriseAirNeuf') ? DEVIS : ''), 'repli déclaratif = inconnu');

// ---- 2. Valeurs des 3 sélecteurs généraux ----------------------------
A(/<option value="oui">/.test(selectBloc('vdfPriseAirNeuf')) && /<option value="non">/.test(selectBloc('vdfPriseAirNeuf')) && /<option value="inconnu" selected>/.test(selectBloc('vdfPriseAirNeuf')), 'prise d\'air neuf : oui/non/inconnu (défaut inconnu)');
A(/<option value="toiture">/.test(selectBloc('vdfRejet')) && /<option value="facade">/.test(selectBloc('vdfRejet')) && /<option value="inconnu" selected>/.test(selectBloc('vdfRejet')), 'rejet : toiture/facade/inconnu (défaut inconnu)');
A(/<option value="oui">/.test(selectBloc('vdfInsufflation')) && /<option value="inconnu" selected>/.test(selectBloc('vdfInsufflation')), 'insufflation : oui/non/inconnu (défaut inconnu)');

// ---- 3. Provenance déclarée ------------------------------------------
A(/ventilationDeclaree: ch\.ventilationDeclaree \|\| null/.test(CTX), 'contexte-projet : écho déclaré ventilationDeclaree');

// ---- 4. Gating : visible UNIQUEMENT si solution=double_flux ----------
A(/onchange="majVentilationDF\(\)"/.test(DEVIS), 'solutionVentilation : onchange majVentilationDF branché');
const SRC = extraire(DEVIS, 'function majVentilationDF()');
function runGating(sol) {
  const els = {
    solutionVentilation: { value: sol },
    blocVdfPriseAir: { style: {} }, blocVdfRejet: { style: {} }, blocVdfInsuff: { style: {} }
  };
  const document = { getElementById: (id) => els[id] || null };
  new Function('document', SRC + ';majVentilationDF();')(document);
  return [els.blocVdfPriseAir.style.display, els.blocVdfRejet.style.display, els.blocVdfInsuff.style.display];
}
A(runGating('double_flux').every(d => d === ''), 'double_flux → 3 blocs visibles');
['simple_flux', 'hygro', 'inconnue', ''].forEach(sol =>
  A(runGating(sol).every(d => d === 'none'), 'solution « ' + (sol || 'vide') + ' » → 3 blocs masqués'));

// ---- 5. piece.config INCHANGÉ (VMC_BOUCHE / VMC_ENTREE_AIR) ----------
A(/getVmcPourPiece/.test(VMCJS) && /VMC_BOUCHE/.test(VMCJS) && /VMC_ENTREE_AIR/.test(VMCJS), 'vmc.js : getVmcPourPiece + VMC_BOUCHE/VMC_ENTREE_AIR intacts');
A(!/ventilationDeclaree/.test(VMCJS), 'vmc.js n\'utilise PAS ventilationDeclaree');
A(!/ventilationDeclaree/.test(CONFIG), 'devis-configurateur.html non modifié pour ventilationDeclaree (aucune UI par pièce)');
A(/piece\.config\.vmc\[code\] = qty/.test(CONFIG), 'configurateur : écriture piece.config.vmc historique intacte');

// ---- 6. AUCUN impact calcul / DF -------------------------------------
A(!/ventilationDeclaree/.test(MOTEUR), 'moteur-devis n\'utilise PAS ventilationDeclaree');
['plomberie', 'vmc', 'electricite', 'carrelage', 'peinture', 'sols', 'isolation', 'menuiserie', 'chauffage'].forEach(m => {
  const src = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', m + '.js'), 'utf8');
  A(!/ventilationDeclaree/.test(src), 'moteur ' + m + ' n\'utilise PAS ventilationDeclaree');
});
A(/dimensionnementVMC\(\{ bouches, entreesAir, debitTotal \}\)/.test(MOTEUR), 'moteur-devis : appel dimensionnementVMC inchangé (pas de doubleFlux)');
A(!/doubleFlux/.test(MOTEUR), 'moteur-devis : aucun doubleFlux introduit (DF reste inerte)');
(function () {
  const cands = [process.env.DSBAT_CATALOGUE_DIR, path.join(RACINE, '..', '..', 'dsbat-runtime'), path.join(RACINE, '..', '..', '..', 'dsbat-runtime')].filter(Boolean);
  let prixSrc = null;
  for (const base of cands) { try { prixSrc = fs.readFileSync(path.join(base, 'runtime', 'moteur-prive', 'prix.js'), 'utf8'); break; } catch (e) {} }
  if (prixSrc == null) { skip++; console.log('  ⏭️  SKIP : prix.js Runtime non monté.'); }
  else A(!/ventilationDeclaree/.test(prixSrc), 'prix.js (Runtime) n\'utilise PAS ventilationDeclaree');
})();

// ---- 7. Pas d'inférence / pas de dépose / solution non transformée ---
A(!/solutionVentilation'\)\.value\s*=/.test(DEVIS), 'aucune transformation automatique de solutionVentilation');
A(!/ventilationDeclaree[\s\S]{0,120}depose/i.test(DEVIS) && !/depose[\s\S]{0,120}ventilationDeclaree/i.test(DEVIS), 'aucune dépose automatique liée à ventilationDeclaree');
A(!/ventilationDeclaree/.test(INTERP), 'interpretation-descriptif n\'écrit PAS ventilationDeclaree (pas d\'inférence NLP)');
// gating ne modifie jamais les valeurs (bascule d'affichage seule)
A(!/vdfPriseAirNeuf'\)\.value\s*=|vdfRejet'\)\.value\s*=|vdfInsufflation'\)\.value\s*=/.test(DEVIS), 'majVentilationDF : aucune écriture de valeur (affichage seulement)');

// ---- 8. Compatibilité LOT2/4/5 ---------------------------------------
A(/typeVentilationExistante: ch\.typeVentilationExistante \|\| null/.test(CTX), 'compat : écho typeVentilationExistante (LOT2)');
A(/intentionVentilation: ch\.intentionVentilation \|\| null/.test(CTX), 'compat : écho intentionVentilation (LOT4)');
A(/solutionVentilation: ch\.solutionVentilation \|\| null/.test(CTX), 'compat : écho solutionVentilation (LOT5)');
A(/chantier\.vmc && chantier\.vmc !== 'non'/.test(MOTEUR), 'compat : mapping b.vmc (LOT1) intact');

// ---- 9. fonctionsParPiece inerte + coherence.js inchangé -------------
A(/fonctionsParPiece:\s*\{\}/.test(DEVIS), 'fonctionsParPiece présent mais vide (inerte, aucune UI par pièce)');
const COH = fs.readFileSync(path.join(RACINE, 'js', 'coherence.js'), 'utf8');
A(!/ventilationDeclaree/.test(COH), 'coherence.js : aucune règle ajoutée sur ventilationDeclaree');

const total = ok + ko;
if (ko === 0) console.log('✅ Configuration VMC (M57 LOT6) : ' + ok + '/' + total + (skip ? ' · ' + skip + ' SKIP' : '') + ' — config générale déclarative, piece.config intact, DF inerte');
else { console.error('❌ Configuration VMC LOT6 : ' + ok + '/' + total); process.exit(1); }
