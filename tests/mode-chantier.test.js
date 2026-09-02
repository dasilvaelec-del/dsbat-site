// =====================================================================
// tests/mode-chantier.test.js — Choix « Chantier complet / partiel »
// =====================================================================
// Vérifie que :
//  • la typologie F1..F6 (compositionTypologie) est INCHANGÉE ;
//  • « complet » reproduit la composition automatique historique ;
//  • « partiel » repart d'une sélection vide (compteurs=0), le client choisit ;
//  • le périmètre = compteurs>0 (mécanisme existant), réversible complet↔partiel.
// On EXTRAIT le source réel depuis devis-configurateur.html et on l'EXÉCUTE avec
// des dépendances stubées. Aucun fichier de production modifié par ce test.
// =====================================================================
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

function extraire(src, sig) {
  const s = src.indexOf(sig);
  if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Statique : câblage minimal présent, typologie non modifiée ----
A(/if \(!etatRestaure\)/.test(HTML) && /if \(modeChantier === 'complet'\) appliquerTypologie\(\);/.test(HTML), 'init : typologie auto gatée sur modeChantier===complet (dans le bloc !etatRestaure)');
A(/mode: modeChantier/.test(HTML), 'saveEtat persiste le mode');
A(/if \(etat\.mode\) modeChantier = etat\.mode;/.test(HTML), 'restaurerEtat restaure le mode (non destructif)');
const SRC_COMPO = extraire(HTML, 'function compositionTypologie(nbPieces, surface)');
A(!/modeChantier/.test(SRC_COMPO), 'compositionTypologie NON modifiée (aucune référence à modeChantier)');

// ---- Exécution réelle ----------------------------------------------
const SRC =
  extraire(HTML, 'function compositionTypologie(nbPieces, surface)') + '\n' +
  extraire(HTML, 'function appliquerTypologie()') + '\n' +
  extraire(HTML, 'function majModeChantierUI()') + '\n' +
  extraire(HTML, 'function setModeChantier(mode)');

function fabrique(chantier) {
  const compteurs = {};
  const elStub = () => ({ textContent: '', classList: { add() {}, remove() {}, toggle() {} }, style: {} });
  const document = { getElementById: () => elStub() };
  const __toutesPiecesIds = () => Object.keys(compteurs);
  const renderDimBlocks = () => {};
  const afficherPropositionTypologie = () => {};
  const saveEtat = () => {};
  const api = new Function(
    'compteurs', 'chantier', 'document', '__toutesPiecesIds', 'renderDimBlocks', 'afficherPropositionTypologie', 'saveEtat',
    "let modeChantier='complet';" + SRC +
    ';return { compositionTypologie, appliquerTypologie, setModeChantier, getMode: function(){return modeChantier;}, compteurs };'
  )(compteurs, chantier, document, __toutesPiecesIds, renderDimBlocks, afficherPropositionTypologie, saveEtat);
  return { api, compteurs };
}

// Composition attendue (surface 60 → pas d'enrichissement surface)
const BASE = {
  '1': { salon:1, cuisine:1, sdb:1, wc:1, entree:1 },
  '2': { salon:1, chambre:1, cuisine:1, sdb:1, wc:1, entree:1 },
  '3': { salon:1, chambre:2, cuisine:1, sdb:1, wc:1, entree:1 },
  '4': { salon:1, chambre:3, cuisine:1, sdb:1, wc:1, entree:1, couloir:1 },
  '5': { salon:1, chambre:4, cuisine:1, sdb:1, sde:1, wc:1, entree:1, couloir:1 },
  '6': { salon:1, chambre:5, cuisine:1, sdb:1, sde:1, wc:1, entree:1, couloir:1 }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const positifs = (c) => Object.keys(c).filter(id => (c[id] || 0) > 0).sort();

// TEST 1-6 — compositionTypologie F1..F6 inchangée (typologie intacte)
{
  const { api } = fabrique({ pieces: '3', surface: 60 });
  ['1','2','3','4','5','6'].forEach((f, i) => {
    const r = api.compositionTypologie(f, 60);
    A(r && eq(r.compo, BASE[f]), 'TEST ' + (i+1) + ' — composition F' + f + ' inchangée');
  });
}

// TEST 11 — complet ≡ typologie (toutes les pièces de la compo)
{
  const { api, compteurs } = fabrique({ pieces: '3', surface: 60 });
  api.setModeChantier('complet');
  A(eq(positifs(compteurs), Object.keys(BASE['3']).sort()), 'TEST 11 — complet : compteurs = composition F3 (identique à l\'historique)');
  A(api.getMode() === 'complet', 'mode = complet');
}

// TEST 13 — partiel : repart d'une sélection vide (compteurs=0)
{
  const { api, compteurs } = fabrique({ pieces: '3', surface: 60 });
  api.setModeChantier('complet');           // d'abord composé
  api.setModeChantier('partiel');           // puis partiel → tout à 0
  A(positifs(compteurs).length === 0, 'TEST 13 — partiel : aucune pièce pré-sélectionnée (compteurs=0)');
  A(api.getMode() === 'partiel', 'mode = partiel');
}

// TEST 7/8/9 — partiel + sélection manuelle → seules les pièces cochées comptent
{
  const { api, compteurs } = fabrique({ pieces: '3', surface: 60 });
  api.setModeChantier('partiel');
  compteurs.sdb = 1;                         // 1 pièce
  A(positifs(compteurs).length === 1 && positifs(compteurs)[0] === 'sdb', 'TEST 7 — partiel 1 pièce → 1 sélectionnée (sdb)');
  compteurs.cuisine = 1;                     // 2 pièces
  A(eq(positifs(compteurs), ['cuisine','sdb']), 'TEST 8 — partiel 2 pièces → {sdb, cuisine}');
  compteurs.salon = 2;                       // 3 types
  A(positifs(compteurs).length === 3, 'TEST 9 — seules les pièces cochées sont incluses');
}

// TEST 12 — réversibilité partiel → complet → recompose sans corruption
{
  const { api, compteurs } = fabrique({ pieces: '2', surface: 60 });
  api.setModeChantier('partiel');
  compteurs.sdb = 1;
  api.setModeChantier('complet');           // retour complet
  A(eq(positifs(compteurs), Object.keys(BASE['2']).sort()), 'TEST 12 — partiel→complet : composition F2 restaurée (aucune corruption)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Mode chantier complet/partiel : ' + ok + '/' + total + ' — typologie F1..F6 intacte, périmètre par compteurs, réversible');
else { console.error('❌ Mode chantier : ' + ok + '/' + total); process.exit(1); }
