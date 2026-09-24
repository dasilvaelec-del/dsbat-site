// =====================================================================
// tests/coherence-niveau-m64.test.js — M64 : contrôles de cohérence au bon niveau de parcours
// =====================================================================
// Le MÊME moteur (js/coherence.js) est réutilisé. Chaque alerte porte désormais une PORTÉE :
//   'logement' (surface globale/écart, dimensions, typologie, VMC déclaré) -> affichable dès la
//               validation de la composition (Mes pièces) ;
//   'piece'    (points d'eau, menuiseries, VMC détaillée… = config.métier) -> différé au récap.
// Au gate validerPieces, on filtre portee!=='piece'. Au récap, on affiche tout. Aucun message,
// niveau ni calcul modifié — seule la PRÉSENTATION change.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CFG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const COH = fs.readFileSync(path.join(RACINE, 'js', 'coherence.js'), 'utf8');
const C = require(path.join(RACINE, 'js', 'coherence.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const gate = arr => arr.filter(a => a.portee !== 'piece');           // reproduit le filtre du gate validerPieces
const has = (arr, re) => arr.some(a => re.test(a.texte || ''));
const find = (arr, re) => arr.find(a => re.test(a.texte || ''));

// ===== 1. Surface globale = portée LOGEMENT (reste visible au gate) =====
{
  global.metiersActifs = ['electricite', 'plomberie'];
  const pieces = [{ id: 'salon', nom: 'Salon', dims: { l: 10, la: 9.8, h: 2.5, fenetres: 1, portes: 1 }, config: {} }];
  const all = C.verifierCoherenceGlobale(pieces, { surface: '100' });
  const surf = find(all, /déclarés.*configurés.*écart/);
  A(!!surf, '1a. contrôle de surface globale produit (100 déclarés / 98 configurés)');
  A(surf && surf.portee === 'logement', '1b. surface globale = portée logement');
  A(has(gate(pieces && all), /déclarés.*configurés.*écart/), '1c. surface globale VISIBLE au gate (non filtrée)');
}

// ===== 2. « aucun point d'eau » = portée PIÈCE (différé, pas au gate) =====
{
  global.metiersActifs = ['electricite', 'plomberie'];
  const cuisine = [{ id: 'cuisine', nom: 'Cuisine', dims: { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: { electricite: { ELEC_PL_SA: 1 } } }];
  const all = C.verifierCoherenceGlobale(cuisine, { surface: '9' });
  const pe = find(all, /aucun point d'eau/);
  A(!!pe, '2a. « aucun point d\'eau » produit (cuisine configurée élec, plomberie vide)');
  A(pe && pe.portee === 'piece', '2b. « aucun point d\'eau » = portée pièce');
  A(pe && pe.niveau === 'info', '2c. niveau inchangé (info)');
  A(!has(gate(all), /aucun point d'eau/), '2d. « aucun point d\'eau » NON affiché au gate (différé)');
}

// ===== 3. « fenêtre sans menuiserie » (verifier métier) = portée PIÈCE =====
{
  global.metiersActifs = ['menuiserie'];
  global.verifierMenuiserie = () => [{ niveau: 'attention', texte: 'Salon : 2 fenêtre(s) déclarée(s) sans menuiserie configurée' }];
  const pieces = [{ id: 'salon', nom: 'Salon', dims: { l: 4, la: 4, h: 2.5, fenetres: 2, portes: 1 }, config: {} }];
  const all = C.verifierCoherenceGlobale(pieces, { surface: '16' });
  const men = find(all, /sans menuiserie configurée/);
  A(!!men, '3a. contrôle « fenêtre sans menuiserie » produit (via verifierMenuiserie)');
  A(men && men.portee === 'piece', '3b. alerte métier menuiserie = portée pièce');
  A(!has(gate(all), /sans menuiserie configurée/), '3c. « fenêtre sans menuiserie » NON affiché au gate');
  delete global.verifierMenuiserie;
}

// ===== 4. Les contrôles détaillés RÉAPPARAISSENT quand les données existent (récap = liste complète) =====
{
  global.metiersActifs = ['electricite', 'plomberie'];
  const cuisine = [{ id: 'cuisine', nom: 'Cuisine', dims: { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: { electricite: { ELEC_PL_SA: 1 } } }];
  const all = C.verifierCoherenceGlobale(cuisine, { surface: '9' });   // récap = pas de filtre
  A(has(all, /aucun point d'eau/), '4. au récap (liste complète) le contrôle détaillé est de nouveau présent');
}

// ===== 5. Moteur/messages/niveaux inchangés (tag additif seulement) =====
{
  global.metiersActifs = ['electricite', 'plomberie'];
  // point d'eau : message exact conservé
  const c = C.verifierCoherenceGlobale([{ id: 'cuisine', nom: 'Cuisine', dims: { l: 3, la: 3 }, config: { electricite: { ELEC_PL_SA: 1 } } }], { surface: '9' });
  A(has(c, /^Cuisine : aucun point d'eau \(évier\) prévu — est-ce volontaire \?$/), '5a. message « point d\'eau » identique (aucun texte modifié)');
  // écart surface : format exact conservé
  const s = C.verifierCoherenceGlobale([{ id: 'salon', nom: 'Salon', dims: { l: 10, la: 9.8 }, config: {} }], { surface: '100' });
  A(has(s, /100 m² déclarés · 98 m² configurés · écart 2 m² \(2 %\)/), '5b. message « écart surface » identique');
  // toutes les alertes portent une portée ∈ {logement, piece}
  const tous = C.verifierCoherenceGlobale([{ id: 'cuisine', nom: 'Cuisine', dims: { l: 3, la: 3 }, config: { electricite: { ELEC_PL_SA: 1 } } }], { surface: '9' });
  A(tous.every(a => a.portee === 'logement' || a.portee === 'piece'), '5c. chaque alerte porte une portée définie');
}

// ===== 6. Branchement : gate filtré, récap NON filtré =====
{
  A(/verifierCoherenceGlobale\(piecesSelectionnees, chantier\)\.filter\(a => a\.portee !== 'piece'\)/.test(CFG), '6a. gate validerPieces filtre portee!==piece');
  // Les deux appels de récap restent en liste complète (pas de filtre portee)
  const recapCalls = (CFG.match(/verifierCoherenceGlobale\(piecesSelectionnees, chantier\)(?!\.filter\(a => a\.portee)/g) || []).length;
  A(recapCalls >= 2, '6b. récap (≥2 appels) conserve la liste complète (aucun filtre de portée)');
  // coherence.js : les alertes métier verifier* sont taguées 'piece'
  A(/\.forEach\(a => \{ a\.portee = a\.portee \|\| 'piece'; alertes\.push\(a\); \}\)/.test(COH), '6c. coherence.js tague les alertes métier verifier* en portée pièce');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Cohérence au bon niveau (M64) : ' + ok + '/' + total + ' — surface globale au gate, contrôles pièce/prestation différés au récap, moteur/messages/niveaux inchangés');
else { console.error('❌ M64 : ' + ok + '/' + total); process.exit(1); }
