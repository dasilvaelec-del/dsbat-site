// =====================================================================
// tests/vmc-solution-lot5.test.js — M57 LOT5 : solution VMC envisagée
// =====================================================================
// Vérifie l'ajout de `chantier.solutionVentilation` (donnée DÉCLARÉE) : la solution
// de ventilation ENVISAGÉE / souhaitée par le client. Ce n'est PAS une solution
// validée / recommandée / configurée / chiffrée.
// Règles clés :
//   • 4 valeurs EXACTES : simple_flux | hygro | double_flux | inconnue ;
//   • valeurs hors périmètre absentes (aerateur, ventilation_naturelle, extraction,
//     insufflation, mixte, autre, aucune, reparer, adapter) ;
//   • défaut = inconnue ;
//   • AUCUN moteur ne consomme le champ (aucun calcul / prix / Runtime) ;
//   • `solutionVentilation=double_flux` NE déclenche AUCUN calcul double flux ;
//   • aucune inférence auto depuis vmc / typeVentilationExistante / intentionVentilation / texte ;
//   • les 4 combinaisons métier de référence ne provoquent ni mutation ni calcul.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CTX = fs.readFileSync(path.join(RACINE, 'js', 'contexte-projet.js'), 'utf8');
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
const INTERP = fs.readFileSync(path.join(RACINE, 'js', 'interpretation-descriptif.js'), 'utf8');

let ok = 0, ko = 0, skip = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

function selectBloc(id) {
  const s = DEVIS.indexOf('<select id="' + id + '"');
  if (s < 0) return '';
  const e = DEVIS.indexOf('</select>', s);
  return e < 0 ? '' : DEVIS.slice(s, e + 9);
}
const SEL = selectBloc('solutionVentilation');

// ---- 1. Nouvelle donnée : select + 4 valeurs EXACTES -----------------
A(SEL.length > 0, 'select#solutionVentilation présent');
['simple_flux', 'hygro', 'double_flux', 'inconnue'].forEach(v =>
  A(new RegExp('<option value="' + v + '"').test(SEL), 'solutionVentilation : valeur « ' + v + ' » présente'));
A(/<option value="inconnue" selected>/.test(SEL), 'défaut UI = inconnue (« Je ne sais pas encore »)');
A((SEL.match(/<option /g) || []).length === 4, 'solutionVentilation : exactement 4 options');

// ---- 2. Valeurs hors périmètre ABSENTES ------------------------------
['aerateur', 'ventilation_naturelle', 'extraction', 'insufflation', 'mixte', 'autre', 'aucune', 'reparer', 'adapter'].forEach(v =>
  A(!new RegExp('value="' + v + '"').test(SEL), 'solutionVentilation : valeur hors périmètre « ' + v + ' » absente'));

// ---- 3. Collecte + défaut inconnue -----------------------------------
A(/solutionVentilation: \(document\.getElementById\('solutionVentilation'\)/.test(DEVIS), 'chantier collecte solutionVentilation');
A(/getElementById\('solutionVentilation'\)\.value : 'inconnue'/.test(DEVIS), 'défaut de collecte = inconnue (si champ absent)');

// ---- 4. Provenance (déclarée) ----------------------------------------
A(/solutionVentilation: ch\.solutionVentilation \|\| null/.test(CTX), 'contexte-projet : écho déclaré (provenance) présent');

// ---- 5. AUCUN impact calcul : champ absent de tout moteur ------------
A(!/solutionVentilation/.test(MOTEUR), 'moteur-devis n\'utilise PAS solutionVentilation');
['plomberie', 'vmc', 'electricite', 'carrelage', 'peinture', 'sols', 'isolation', 'menuiserie', 'chauffage'].forEach(m => {
  const src = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', m + '.js'), 'utf8');
  A(!/solutionVentilation/.test(src), 'moteur ' + m + ' n\'utilise PAS solutionVentilation');
});
(function () {
  const cands = [process.env.DSBAT_CATALOGUE_DIR, path.join(RACINE, '..', '..', 'dsbat-runtime'), path.join(RACINE, '..', '..', '..', 'dsbat-runtime')].filter(Boolean);
  let prixSrc = null;
  for (const base of cands) { try { prixSrc = fs.readFileSync(path.join(base, 'runtime', 'moteur-prive', 'prix.js'), 'utf8'); break; } catch (e) {} }
  if (prixSrc == null) { skip++; console.log('  ⏭️  SKIP : prix.js Runtime non monté (vérif non-consommation catalogue).'); }
  else A(!/solutionVentilation/.test(prixSrc), 'prix.js (Runtime) n\'utilise PAS solutionVentilation');
})();

// ---- 6. double_flux ne déclenche AUCUN calcul DF ---------------------
// L'appel au dimensionnement reste identique (aucun doubleFlux passé), et rien ne
// relie solutionVentilation à doubleFlux/double_flux dans le moteur.
A(/dimensionnementVMC\(\{ bouches, entreesAir, debitTotal \}\)/.test(MOTEUR), 'moteur-devis : appel dimensionnementVMC inchangé (pas de doubleFlux passé)');
A(!/doubleFlux/.test(MOTEUR), 'moteur-devis : aucun doubleFlux introduit');
A(!/double_flux/.test(MOTEUR), 'moteur-devis : aucune référence à la valeur double_flux (pas de branchement solution→calcul)');

// ---- 7. Indépendance : aucune inférence / affectation automatique ----
A(!/solutionVentilation'\)\.value\s*=/.test(DEVIS), 'aucune affectation automatique de solutionVentilation.value');
A(!/solutionVentilation\s*=\s*['"](simple_flux|hygro|double_flux)['"]/.test(DEVIS), 'aucune inférence auto vers une solution');
A(!/defaillante[\s\S]{0,80}solutionVentilation/.test(DEVIS) && !/solutionVentilation[\s\S]{0,80}defaillante/.test(DEVIS), 'aucun couplage defaillante ↔ solutionVentilation');
A(!/solutionVentilation/.test(INTERP), 'interpretation-descriptif n\'écrit PAS solutionVentilation (pas d\'inférence NLP)');

// ---- 8. Compatibilité existant (LOT1 + LOT2 + LOT4 intacts) ----------
A(/<select id="vmc" onchange="majTypeVentilation\(\)">/.test(DEVIS), 'compat : select vmc historique intact');
A(/chantier\.vmc && chantier\.vmc !== 'non'/.test(MOTEUR), 'compat : mapping b.vmc = (vmc !== non) intact (LOT1)');
A(/typeVentilationExistante: ch\.typeVentilationExistante \|\| null/.test(CTX), 'compat : écho typeVentilationExistante (LOT2) conservé');
A(/intentionVentilation: ch\.intentionVentilation \|\| null/.test(CTX), 'compat : écho intentionVentilation (LOT4) conservé');

// ---- 9. Cas métier : données seules, ni mutation ni calcul.
// NB (M57 LOT9) : le contrat LOT5 « aucune alerte issue de la solution » reste vrai pour les
// solutions NON traitées par LOT9 (ex. simple_flux/hygro). Les solutions `double_flux` et
// `inconnue` sont désormais explicitement signalées par LOT9 (évolution volontaire du contrat).
const C = require(path.join(RACINE, 'js', 'coherence.js'));
[
  { typeVentilationExistante: 'vmc_motorisee', intentionVentilation: 'remplacer', solutionVentilation: 'inconnue' },
  { typeVentilationExistante: 'inconnu', intentionVentilation: 'remplacer', solutionVentilation: 'inconnue' },
  { typeVentilationExistante: 'ventilation_naturelle', intentionVentilation: 'remplacer', solutionVentilation: 'simple_flux' },
  { typeVentilationExistante: 'aucune', intentionVentilation: 'creer', solutionVentilation: 'double_flux' }
].forEach(ch => {
  const snap = JSON.stringify(ch);
  const r = C.verifierCoherenceGlobale([], ch);
  A(JSON.stringify(ch) === snap, 'cas ' + ch.solutionVentilation + ' : réponse client NON mutée');
  if (ch.solutionVentilation === 'double_flux') {
    // LOT9 : signal explicite « double flux non entièrement chiffrée » attendu.
    A(r.some(a => /pas encore entièrement chiffrée/i.test(a.texte || '')), 'cas double_flux : signal de cohérence LOT9 présent');
  } else if (ch.solutionVentilation === 'inconnue') {
    // LOT9 : signal explicite « solution non définie » attendu ; jamais transformée en simple flux.
    A(r.some(a => /pas encore définie/i.test(a.texte || '')), 'cas inconnue : signal de cohérence LOT9 présent');
    A(!r.some(a => /simple flux|VMC simple flux/i.test(a.texte || '')), 'cas inconnue : jamais transformée en simple flux');
  } else {
    // Contrat LOT5 conservé pour les solutions non traitées par LOT9.
    A(!r.some(a => a.texte && /simple flux|double flux|hygro|solution envisagée/i.test(a.texte)), 'cas ' + ch.solutionVentilation + ' : aucune alerte issue de la solution (contrat LOT5)');
  }
});

const total = ok + ko;
if (ko === 0) console.log('✅ Solution VMC (M57 LOT5) : ' + ok + '/' + total + (skip ? ' · ' + skip + ' SKIP' : '') + ' — solutionVentilation déclarée, aucun calcul, double_flux inerte');
else { console.error('❌ Solution VMC LOT5 : ' + ok + '/' + total); process.exit(1); }
