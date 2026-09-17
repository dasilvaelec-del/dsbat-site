// =====================================================================
// tests/vmc-intention-lot4.test.js — M57 LOT4 : intention principale VMC
// =====================================================================
// Vérifie l'ajout de `chantier.intentionVentilation` (donnée DÉCLARÉE), orientation
// principale du projet VMC, DISTINCTE de l'existant (`typeVentilationExistante`) et
// du champ historique `vmc`.
// Règles clés :
//   • 4 valeurs EXACTES : conserver | remplacer | creer | inconnu ;
//   • valeurs volontairement écartées : reparer, adapter (absentes) ;
//   • concepts hors périmètre absents : objectifVentilation / etatSysteme / porteeIntention ;
//   • AUCUN moteur ne consomme le champ (aucun calcul / prix / Runtime) ;
//   • `vmc=defaillante` ne devient JAMAIS automatiquement `remplacer` ;
//   • cohérence `aucune + remplacer` et `inconnu + remplacer` = SIGNAL non bloquant,
//     sans correction ni mutation de la réponse client ;
//   • la description libre n'écrase pas la donnée structurée (pas de branchement NLP).
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

// M59 : le select intention est au niveau PROJET (Partie 3, questionsVmcProjetHtml), pas par pièce.
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
function selectBlocIn(src, id) {
  const s = src.indexOf('<select id="' + id);
  if (s < 0) return '';
  const e = src.indexOf('</select>', s);
  return e < 0 ? '' : src.slice(s, e + 9);
}
const INTENT_SELECT = selectBlocIn(CONFIG, 'vmc_intention_');

// ---- 1. Question intention dans le bloc VMC (Partie 3) + valeurs métier ------
A(INTENT_SELECT.length > 0, 'intention : select présent dans le bloc VMC (Partie 3)');
['conserver', 'remplacer', 'creer', 'inconnu'].forEach(v =>
  A(new RegExp('<option value="' + v + '"').test(INTENT_SELECT), 'intentionVentilation : valeur « ' + v + ' » présente'));
A(/onchange="majContexteVmcProjet\(/.test(INTENT_SELECT), 'intention : onchange majContexteVmcProjet branché (niveau projet)');
A(/id="vmc_intention_projet"/.test(CONFIG), 'intention : select au NIVEAU PROJET (id vmc_intention_projet)');
A(!/questionsVmcHtml\(pieceIndex\)/.test(CONFIG), 'intention : PLUS de question intention dans la config par pièce');
// M58bis : la question n'est PLUS en Partie 2 (devis.html)
// M59bis : select intention présenté à l'étape « Travaux » (devis.html), révélé au clic VMC (m_vmc).
A(/<select id="intentionVentilation"/.test(DEVIS), 'intention : select présent à l\'étape Travaux (devis.html)');
A(/id="vmcProjetBloc"[^>]*display:none/.test(DEVIS), 'intention : bloc VMC caché par défaut (révélé au clic VMC)');
A(/id="m_vmc"[^>]*onchange="majBlocVmcTravaux\(\)"/.test(DEVIS), 'intention : handler branché sur la case VMC (m_vmc)');

// ---- 2. Valeurs interdites ABSENTES (reparer désormais valide en M58bis) -----
['adapter', 'deposer', 'condamner'].forEach(v =>
  A(!new RegExp('value="' + v + '"').test(INTENT_SELECT), 'intentionVentilation : valeur écartée « ' + v + ' » absente'));
// concepts hors périmètre absents du projet (aucun champ créé)
['objectifVentilation', 'etatSysteme', 'porteeIntention'].forEach(c => {
  A(!new RegExp(c).test(DEVIS), 'concept hors périmètre « ' + c + ' » absent de devis.html');
  A(!new RegExp(c).test(CTX), 'concept hors périmètre « ' + c + ' » absent de contexte-projet.js');
});

// ---- 3. Collecte + provenance ----------------------------------------
A(/intentionVentilation: \(document\.getElementById\('intentionVentilation'\)/.test(DEVIS), 'chantier collecte intentionVentilation');
A(/intentionVentilation: ch\.intentionVentilation \|\| null/.test(CTX), 'contexte-projet : écho déclaré (provenance) présent');

// ---- 4. AUCUN impact calcul : le champ n'entre dans aucun moteur -----
A(!/intentionVentilation/.test(MOTEUR), 'moteur-devis n\'utilise PAS intentionVentilation (aucun calcul)');
['plomberie', 'vmc-public', 'electricite', 'carrelage', 'peinture', 'sols', 'isolation', 'menuiserie', 'chauffage'].forEach(m => {
  const src = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', m + '.js'), 'utf8');
  A(!/intentionVentilation/.test(src), 'moteur ' + m + ' n\'utilise PAS intentionVentilation');
});
// Runtime prix.js : champ jamais consommé (si monté)
(function () {
  const cands = [process.env.DSBAT_CATALOGUE_DIR, path.join(RACINE, '..', '..', 'dsbat-runtime'), path.join(RACINE, '..', '..', '..', 'dsbat-runtime')].filter(Boolean);
  let prixSrc = null;
  for (const base of cands) { try { prixSrc = fs.readFileSync(path.join(base, 'runtime', 'moteur-prive', 'prix.js'), 'utf8'); break; } catch (e) {} }
  if (prixSrc == null) { skip++; console.log('  ⏭️  SKIP : prix.js Runtime non monté (vérif non-consommation catalogue).'); }
  else A(!/intentionVentilation/.test(prixSrc), 'prix.js (Runtime) n\'utilise PAS intentionVentilation');
})();

// ---- 5. Compatibilité existant (LOT1 + LOT2 intacts) -----------------
A(/<select id="vmc" onchange="majTypeVentilation\(\)">/.test(DEVIS), 'compat : select vmc historique intact (LOT2)');
['oui', 'defaillante', 'non'].forEach(v => A(new RegExp('<option value="' + v + '">').test(DEVIS), 'compat : option vmc « ' + v + ' » intacte'));
A(/chantier\.vmc && chantier\.vmc !== 'non'/.test(MOTEUR), 'compat : mapping b.vmc = (vmc !== non) intact (LOT1)');
A(/typeVentilationExistante: ch\.typeVentilationExistante \|\| null/.test(CTX), 'compat : écho typeVentilationExistante (LOT2) conservé');

// ---- 6. defaillante ne devient JAMAIS remplacer automatiquement ------
// Aucune écriture programmatique de intentionVentilation (le champ est piloté par le client seul)
A(!/intentionVentilation'\)\.value\s*=/.test(DEVIS), 'aucune affectation automatique de intentionVentilation.value');
A(!/intentionVentilation\s*=\s*['"]remplacer['"]/.test(DEVIS), 'aucun mapping défaillante→remplacer (pas d\'affectation « remplacer »)');
A(!/defaillante[\s\S]{0,80}intentionVentilation/.test(DEVIS) && !/intentionVentilation[\s\S]{0,80}defaillante/.test(DEVIS),
  'aucun couplage textuel defaillante ↔ intentionVentilation');

// ---- 7. Description libre : pas de branchement qui écrase la donnée --
A(!/intentionVentilation/.test(INTERP), 'interpretation-descriptif n\'écrit PAS intentionVentilation (structuré non écrasé par le NLP)');

// ---- 8. Cohérence intention ↔ existant (SIGNAL, pas correction) ------
const C = require(path.join(RACINE, 'js', 'coherence.js'));
const has = (r, frag) => r.some(a => a.texte && a.texte.indexOf(frag) >= 0);
{
  // aucune + remplacer → contradiction signalée
  const ch = { intentionVentilation: 'remplacer', typeVentilationExistante: 'aucune' };
  const snap = JSON.stringify(ch);
  const r = C.verifierCoherenceGlobale([], ch);
  A(has(r, 'pas actuellement de système'), 'aucune + remplacer → signalé (non bloquant)');
  A(JSON.stringify(ch) === snap, 'aucune + remplacer → réponse client NON modifiée (aucune correction)');
}
{
  // inconnu + remplacer → autorisé, marqué à confirmer
  const r = C.verifierCoherenceGlobale([], { intentionVentilation: 'remplacer', typeVentilationExistante: 'inconnu' });
  A(has(r, 'pas encore établi'), 'inconnu + remplacer → autorisé mais « à confirmer »');
}
// combinaisons valides → aucun signal de contradiction VMC
[
  { typeVentilationExistante: 'vmc_motorisee', intentionVentilation: 'conserver' },
  { typeVentilationExistante: 'vmc_motorisee', intentionVentilation: 'remplacer' },
  { typeVentilationExistante: 'ventilation_naturelle', intentionVentilation: 'conserver' },
  { typeVentilationExistante: 'ventilation_naturelle', intentionVentilation: 'remplacer' },
  { typeVentilationExistante: 'aucune', intentionVentilation: 'creer' },
  { typeVentilationExistante: 'inconnu', intentionVentilation: 'creer' }
].forEach(ch => {
  const r = C.verifierCoherenceGlobale([], ch);
  A(!has(r, 'pas actuellement de système') && !has(r, 'pas encore établi'),
    'combinaison valide ' + ch.typeVentilationExistante + ' + ' + ch.intentionVentilation + ' → aucun signal de contradiction');
});

const total = ok + ko;
if (ko === 0) console.log('✅ Intention VMC (M57 LOT4) : ' + ok + '/' + total + (skip ? ' · ' + skip + ' SKIP' : '') + ' — intentionVentilation déclarée, vmc intact, aucun impact calcul');
else { console.error('❌ Intention VMC LOT4 : ' + ok + '/' + total); process.exit(1); }
