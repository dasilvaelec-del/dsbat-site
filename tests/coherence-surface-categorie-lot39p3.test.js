// tests/coherence-surface-categorie-lot39p3.test.js — LOT39 PASSE 3.
// La cohérence de surface LOGEMENT ne compte QUE les pièces 'logement'.
// Annexes / extérieurs / catégories indéterminées (véranda) : exclues du contrôle,
// mais conservées dans le projet. Couvre CAS 1..10.
const path = require('path');
const RACINE = path.join(__dirname, '..');
const M = require(path.join(RACINE, 'js', 'modele-projet.js')); // définit global.ModeleProjetDSBAT (source unique)
const C = require(path.join(RACINE, 'js', 'coherence.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

global.metiersActifs = [];
function P(id, l, la) {
  const p = { id: id, nom: id, dims: { l: l, la: la, h: 2.5, fenetres: 1, portes: 1 }, config: {} };
  M.normaliserPieceSocle(p); // pièce vivante = telle que fabriquée en P2
  return p;
}
const ecartLogement = (pieces, surface) =>
  C.verifierCoherenceGlobale(pieces, { surface: String(surface) })
    .find(a => /déclarés.*configurés.*écart/.test(a.texte || ''));

// salon 85 m² (10 × 8.5) = surface logement de référence
const SALON85 = () => P('salon', 10, 8.5);

// ===== CAS 1 : 85 logement + garage 9 -> aucune anomalie liée au garage =====
A(C.surfaceLogement([SALON85(), P('garage', 3, 3)]) === 85, 'CAS1 surfaceLogement = 85 (garage 9 exclu)');
A(!ecartLogement([SALON85(), P('garage', 3, 3)], 85), 'CAS1 aucune alerte écart logement (garage 9 m² non comptés)');

// ===== CAS 2 : 85 logement + cave 20 -> aucune anomalie liée à la cave =====
A(C.surfaceLogement([SALON85(), P('cave', 4, 5)]) === 85, 'CAS2 surfaceLogement = 85 (cave 20 exclue)');
A(!ecartLogement([SALON85(), P('cave', 4, 5)], 85), 'CAS2 aucune alerte écart logement (cave 20 m²)');

// ===== CAS 3 : 85 logement + grenier 20 -> aucune anomalie =====
A(M.categorieSurfacePiece('grenier') === 'annexe', 'CAS3 grenier = annexe');
A(C.surfaceLogement([SALON85(), P('grenier', 4, 5)]) === 85, 'CAS3 surfaceLogement = 85 (grenier exclu)');
A(!ecartLogement([SALON85(), P('grenier', 4, 5)], 85), 'CAS3 aucune alerte écart logement (grenier)');

// ===== CAS 4 : 85 logement + terrasse 25 -> aucune anomalie =====
A(C.surfaceLogement([SALON85(), P('terrasse', 5, 5)]) === 85, 'CAS4 surfaceLogement = 85 (terrasse 25 exclue)');
A(!ecartLogement([SALON85(), P('terrasse', 5, 5)], 85), 'CAS4 aucune alerte écart logement (terrasse 25 m²)');

// ===== CAS 5 : 85 logement + garage + cave + terrasse -> seul le logement compte =====
const mix = [SALON85(), P('garage', 3, 3), P('cave', 4, 5), P('terrasse', 5, 5)];
A(C.surfaceLogement(mix) === 85, 'CAS5 surfaceLogement = 85 (annexes + extérieur exclus)');
A(!ecartLogement(mix, 85), 'CAS5 aucune alerte écart logement malgré garage+cave+terrasse');
// écart réel calculé sur le seul logement : 85 déclarés vs 70 logement -> alerte présente
const mixSous = [P('salon', 10, 7), P('garage', 3, 3), P('terrasse', 5, 5)]; // logement 70
A(!!ecartLogement(mixSous, 85), 'CAS5bis écart logement réel détecté (70 vs 85) — indépendant des annexes/extérieur');

// ===== CAS 6 : véranda non catégorisée -> pas ajoutée à la surface logement =====
const ver = P('veranda', 4, 4);
A(ver.categorieSurface === undefined, 'CAS6 véranda : categorieSurface indéterminée (non tranchée)');
A(C.surfaceLogement([SALON85(), ver]) === 85, 'CAS6 surfaceLogement = 85 (véranda 16 non ajoutée)');
A(!ecartLogement([SALON85(), ver], 85), 'CAS6 aucune alerte écart logement liée à la véranda');

// ===== CAS 7 : plusieurs pièces logement -> somme correcte =====
A(C.surfaceLogement([P('chambre', 4, 3), P('chambre', 3, 3), P('cuisine', 3, 4)]) === (12 + 9 + 12),
  'CAS7 somme des pièces logement correcte (12+9+12 = 33)');
const troisLog = [P('salon', 5, 5), P('chambre', 4, 3), P('cuisine', 3, 4)]; // 25+12+12 = 49
A(C.surfaceLogement(troisLog) === 49, 'CAS7bis somme logement = 49');
A(!!ecartLogement(troisLog, 85), 'CAS7ter écart détecté (49 logement vs 85 déclarés)');

// ===== CAS 8 : pièce annexe avec dimensions -> reste dans le projet =====
const cave = P('cave', 4, 5);
A(cave.dims.l === 4 && cave.dims.la === 5, 'CAS8 annexe conserve ses dimensions');
A(M.surfacePiece(cave) === 20, 'CAS8 surface géométrique de l\'annexe toujours connue (20 m²)');
A(C.surfaceLogement([cave]) === 0, 'CAS8 annexe exclue du logement mais NON supprimée (surface propre accessible)');

// ===== CAS 9 : pièce extérieure avec dimensions -> reste dans le projet =====
const terr = P('terrasse', 5, 5);
A(terr.dims.l === 5 && terr.dims.la === 5 && M.surfacePiece(terr) === 25, 'CAS9 extérieur conserve dimensions + surface (25 m²)');
A(C.surfaceLogement([terr]) === 0, 'CAS9 extérieur exclu du logement mais NON supprimé');

// ===== CAS 10 : Golden Master neuf — logement pur inchangé =====
// Ancien comportement : toutes les pièces étaient du logement -> somme = total.
const gm = [P('salon', 10, 9.8)]; // 98
const a10 = ecartLogement(gm, 100);
A(!!a10 && /100 m² déclarés · 98 m² configurés · écart 2 m² \(2 %\)/.test(a10.texte),
  'CAS10 Golden Master : message écart surface identique (100/98, 2 %)');
A(C.surfaceLogement(gm) === 98, 'CAS10 logement pur : somme inchangée');

// ===== Robustesse : repli si le modèle est absent (comportement historique) =====
// (le modèle EST chargé ici ; on vérifie juste que la catégorie dérive bien sans champ posé)
const bare = { id: 'salon', nom: 'Salon', dims: { l: 10, la: 8.5 }, config: {} }; // pas de categorieSurface
A(C.surfaceLogement([bare]) === 85, 'robustesse : catégorie dérivée du modèle si le champ n\'est pas posé');
const bareGarage = { id: 'garage', nom: 'Garage', dims: { l: 3, la: 3 }, config: {} };
A(C.surfaceLogement([bare, bareGarage]) === 85, 'robustesse : garage sans champ catégorie -> dérivé annexe -> exclu');

console.log('coherence-surface-categorie-lot39p3 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
