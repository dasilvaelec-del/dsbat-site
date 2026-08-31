// =====================================================================
// tests/metier-gate-electricite.test.js — Correctif « électricité hors métier »
// =====================================================================
// Vérifie que appliquerNorme() et appliquerObjectif() (dans devis-configurateur.html)
// N'INJECTENT PLUS piece.config.electricite lorsque 'electricite' n'est pas dans
// metiersActifs, tout en conservant le comportement quand il l'est.
//
// Méthode : on EXTRAIT le source réel des deux fonctions depuis le HTML et on les
// EXÉCUTE (new Function) avec des dépendances stubées minimales. Aucun fichier de
// production n'est modifié. Aucun prix, aucun catalogue impliqué.
// =====================================================================
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Extrait `function NOM(...) { ... }` par équilibrage d'accolades.
function extraireFonction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error('signature introuvable: ' + signature);
  let i = src.indexOf('{', start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const SRC_OBJ  = extraireFonction(HTML, 'function appliquerObjectif(piece)');
const SRC_NORM = extraireFonction(HTML, 'function appliquerNorme(index)');

// ---- Vérification statique : la garde métier précède toute création de config.electricite
function gardeAvantCreation(src) {
  const iGarde = src.indexOf("metiersActifs.includes('electricite')");
  const iCreate = src.indexOf('config.electricite');
  return iGarde !== -1 && iCreate !== -1 && iGarde < iCreate;
}
A(gardeAvantCreation(SRC_OBJ),  'appliquerObjectif : garde métier AVANT toute création de config.electricite');
A(gardeAvantCreation(SRC_NORM), 'appliquerNorme : garde métier AVANT toute création de config.electricite');
A(/return\s*;/.test(SRC_OBJ.slice(0, SRC_OBJ.indexOf('config.electricite'))),  'appliquerObjectif : early-return présent avant création');
A(/return\s*;/.test(SRC_NORM.slice(0, SRC_NORM.indexOf('config.electricite'))), 'appliquerNorme : early-return présent avant création');

// ---- Exécution réelle (stubs minimaux) ------------------------------
// appliquerObjectif : en mode 'normes', si la garde passe, il crée config.electricite
// puis `if (objectifProjet==='normes') return;` (aucune dépendance recoDSBAT sollicitée).
function fabriquerObjectif(metiersActifs, objectifProjet) {
  return new Function('metiersActifs', 'objectifProjet',
    SRC_OBJ + '\n;return appliquerObjectif;')(metiersActifs, objectifProjet);
}
// appliquerNorme : normeMin stubé → {} ; piecesSelectionnees fourni.
function fabriquerNorme(metiersActifs, piecesSelectionnees) {
  const normeMin = () => ({});
  return new Function('metiersActifs', 'piecesSelectionnees', 'normeMin',
    SRC_NORM + '\n;return appliquerNorme;')(metiersActifs, piecesSelectionnees, normeMin);
}
const pieceNeuve = () => ({ id: 'sdb', dims: { l: 2, la: 2, portes: 1 }, config: {}, normeMin: {} });

// TEST 1 — plomberie seule → aucune création de config.electricite
{
  const p1 = pieceNeuve();
  fabriquerObjectif(['plomberie'], 'normes')(p1);
  const p2 = pieceNeuve();
  fabriquerNorme(['plomberie'], [p2])(0);
  A(p1.config.electricite === undefined, 'TEST 1 — plomberie seule : appliquerObjectif ne crée PAS config.electricite');
  A(p2.config.electricite === undefined, 'TEST 1 — plomberie seule : appliquerNorme ne crée PAS config.electricite');
}

// TEST 2 — électricité seule → comportement conservé (config.electricite créé)
{
  const p1 = pieceNeuve();
  fabriquerObjectif(['electricite'], 'normes')(p1);
  const p2 = pieceNeuve();
  fabriquerNorme(['electricite'], [p2])(0);
  A(p1.config.electricite !== undefined, 'TEST 2 — électricité seule : appliquerObjectif crée config.electricite');
  A(p2.config.electricite !== undefined, 'TEST 2 — électricité seule : appliquerNorme crée config.electricite');
}

// TEST 3 — plomberie + électricité → électricité toujours active
{
  const p1 = pieceNeuve();
  fabriquerObjectif(['plomberie', 'electricite'], 'normes')(p1);
  const p2 = pieceNeuve();
  fabriquerNorme(['plomberie', 'electricite'], [p2])(0);
  A(p1.config.electricite !== undefined, 'TEST 3 — plomberie+électricité : appliquerObjectif crée config.electricite');
  A(p2.config.electricite !== undefined, 'TEST 3 — plomberie+électricité : appliquerNorme crée config.electricite');
}

// TEST 4 — non-régression : metiersActifs absent (undefined) → garde défensive, pas de crash
{
  let crash = false, cfg;
  try { const p = pieceNeuve(); fabriquerNorme(undefined, [p])(0); cfg = p.config.electricite; }
  catch (e) { crash = true; }
  A(!crash && cfg === undefined, 'TEST 4 — metiersActifs indéfini : garde défensive, aucun crash, aucune injection');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Garde métier électricité : ' + ok + '/' + total + ' — plomberie seule sans élec, élec conservée quand active');
else { console.error('❌ Garde métier électricité : ' + ok + '/' + total); process.exit(1); }
