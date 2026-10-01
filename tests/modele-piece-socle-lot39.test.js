// tests/modele-piece-socle-lot39.test.js — LOT39 PASSE 1 : socle du modèle métier des pièces.
// Vérifie §8 : propriétés existantes conservées, dims compatible, surface DÉRIVÉE,
// categorieSurface = valeurs autorisées seulement, pièce sans existant, bloc projet
// non destructif, contrats moteurs inchangés (socle additif non branché).
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const M = require(path.join(RACINE, 'js', 'modele-projet.js'));
const MP = require(path.join(RACINE, 'js', 'moteur-piece.js'));
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'modele-projet.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ===== 1. Une pièce existante conserve ses propriétés actuelles =========
const legacy = { id: 'chambre', nom: 'Chambre', icon: '🛏️', numero: 1,
  dims: { l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 }, config: { peinture: {} },
  chauffageFonctions: null, elecMethode: 'saignee' };
const snapshot = JSON.parse(JSON.stringify(legacy));
M.normaliserPieceSocle(legacy);
A(legacy.id === snapshot.id && legacy.nom === snapshot.nom && legacy.icon === snapshot.icon
  && legacy.numero === snapshot.numero && legacy.elecMethode === snapshot.elecMethode
  && legacy.chauffageFonctions === snapshot.chauffageFonctions,
  '1. propriétés d\'identité conservées (id/nom/icon/numero/elecMethode/chauffageFonctions)');
A(JSON.stringify(legacy.config) === JSON.stringify(snapshot.config), '1. config conservée à l\'identique');

// ===== 2. dims reste compatible ========================================
A(JSON.stringify(legacy.dims) === JSON.stringify(snapshot.dims),
  '2. dims inchangé (l/la/h/fenetres/portes)');
A(legacy.dims.l === 5 && legacy.dims.la === 4 && legacy.dims.h === 2.5
  && legacy.dims.fenetres === 1 && legacy.dims.portes === 1, '2. structure dims préservée');

// ===== 3. La surface reste DÉRIVÉE des dimensions ======================
A(M.surfacePiece(legacy) === 20, '3. surface dérivée = l × la (5×4 = 20)');
A(M.surfacePiece({ dims: { l: 6, la: 3 } }) === 18, '3. surface dérivée recalculée depuis dims (6×3 = 18)');
A(!('surface' in legacy), '3. AUCUNE propriété piece.surface persistée (pas de 2e source de vérité)');
A(!/piece\.surface\s*=/.test(SRC), '3. le socle n\'écrit jamais piece.surface');

// ===== 4. categorieSurface : uniquement les valeurs prévues ============
A(JSON.stringify(M.CATEGORIES_SURFACE) === JSON.stringify(['logement', 'annexe', 'exterieur']),
  '4. catégories autorisées = logement / annexe / exterieur (et rien d\'autre)');
['logement', 'annexe', 'exterieur'].forEach(v =>
  A(M.categorieSurfaceValide(v) === true, '4. valeur autorisée acceptée : ' + v));
['piece', 'habitable', 'garage_annexe', '', null, undefined, 'LOGEMENT'].forEach(v =>
  A(M.categorieSurfaceValide(v) === false, '4. valeur non prévue refusée : ' + String(v)));
A(M.categorieSurfacePiece('salon') === 'logement', '4. salon -> logement');
A(M.categorieSurfacePiece('garage') === 'annexe', '4. garage -> annexe');
A(M.categorieSurfacePiece('terrasse') === 'exterieur', '4. terrasse -> exterieur');
A(M.categorieSurfacePiece('wc') === 'logement' && M.categorieSurfacePiece('sdb') === 'logement', '4. sanitaires -> logement');
A(M.categorieSurfacePiece('cave') === 'annexe', '4. cave -> annexe');
// categorieSurfacePiece ne renvoie jamais une valeur hors liste
['salon', 'garage', 'terrasse', 'veranda', 'inconnu_xyz'].forEach(id => {
  const c = M.categorieSurfacePiece(id);
  A(c === null || M.categorieSurfaceValide(c), '4. categorieSurfacePiece(' + id + ') dans la liste ou null');
});
// normaliser ne pose categorieSurface que si déterminable
const pc = { id: 'cuisine', dims: { l: 3, la: 3 }, config: {} };
M.normaliserPieceSocle(pc);
A(pc.categorieSurface === 'logement', '4. normalisation pose categorieSurface déterminable (cuisine)');

// ===== §3 : cas ambigu (véranda / inconnu) = comportement sûr ==========
A(M.categorieSurfacePiece('veranda') === null, '§3 véranda = catégorie indéterminée (null), non forcée');
const pver = { id: 'veranda', dims: { l: 3, la: 3 }, config: {} };
M.normaliserPieceSocle(pver);
A(pver.categorieSurface === undefined, '§3 véranda : categorieSurface laissée indéterminée (sûr)');
A(!!pver.projet, '§3 véranda : bloc projet quand même posé');
const pinc = { id: 'piece_dynamique_x', dims: {}, config: {} };
M.normaliserPieceSocle(pinc);
A(pinc.categorieSurface === undefined, '§3 id inconnu : categorieSurface indéterminée (aucune règle inventée)');

// ===== 5. Le modèle supporte une pièce sans existant (neuf) ============
const vierge = M.projetPieceVierge();
A(vierge.existant && vierge.existant.usage === null && vierge.existant.categorieSurface === null, '5. projet.existant vierge (usage/categorieSurface null — aucun état inventé) [LOT42]');
A(vierge.cible && vierge.cible.usage === null && vierge.cible.categorieSurface === null && vierge.transformation === null, '5. cible vierge + transformation null [LOT42]');
A(Object.keys(vierge).sort().join(',') === 'cible,existant,transformation',
  '5. bloc projet minimal = { existant, cible, transformation } (rien de plus)');
// une pièce neuve normalisée reste exploitable sans existant réel
const neuve = { id: 'salon', dims: { l: 5, la: 4 }, config: {} };
M.normaliserPieceSocle(neuve);
A(neuve.projet.existant && neuve.projet.existant.usage === null, '5. pièce neuve : existant vierge (aucune supposition d\'existant) [LOT42]');

// ===== 6. Le bloc projet ne casse pas les pièces existantes ============
// additif : n'ajoute que categorieSurface + projet, ne retire/altère rien.
const keysAvant = Object.keys(snapshot);
const keysApres = Object.keys(legacy);
A(keysAvant.every(k => keysApres.indexOf(k) !== -1), '6. aucune propriété existante retirée');
const ajoutees = keysApres.filter(k => keysAvant.indexOf(k) === -1).sort();
A(JSON.stringify(ajoutees) === JSON.stringify(['categorieSurface', 'projet']),
  '6. seules categorieSurface et projet sont ajoutées');
// idempotence : re-normaliser ne modifie pas une pièce déjà normalisée
const avantRenorm = JSON.stringify(legacy);
M.normaliserPieceSocle(legacy);
A(JSON.stringify(legacy) === avantRenorm, '6. normalisation idempotente (2e passage sans effet)');
// ne pas écraser une categorieSurface déjà fixée
const fixe = { id: 'salon', categorieSurface: 'annexe', dims: { l: 2, la: 2 }, config: {} };
M.normaliserPieceSocle(fixe);
A(fixe.categorieSurface === 'annexe', '6. categorieSurface existante non écrasée');
// ne pas écraser un projet déjà présent
const dejaProjet = { id: 'salon', projet: { existant: { note: 'x' }, cible: null, transformation: null }, dims: {}, config: {} };
M.normaliserPieceSocle(dejaProjet);
A(dejaProjet.projet.existant && dejaProjet.projet.existant.note === 'x', '6. projet existant non écrasé');

// ===== 7. Les moteurs actuels reçoivent toujours les contrats attendus ==
// Socle NON branché : le configurateur et les moteurs ne sont pas modifiés.
const html = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
A(/ModeleProjetDSBAT\.normaliserPieceSocle/.test(html)
  && !/CATEGORIE_PAR_ID|function\s+categorieSurfacePiece/.test(html),
  '7. socle branché au configurateur via le modèle (LOT39 P2), sans table dupliquée');
// et une pièce normalisée reste consommable par le moteur de pièce (surfaces dérivées OK)
global.chantier = { typeProjet: 'neuf' };
const pm = { id: 'salon', nom: 'Salon', dims: { l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 }, config: {} };
M.normaliserPieceSocle(pm);
let calcOk = true;
try { MP.calculerPiece(pm, { typeProjet: 'neuf' }, []); } catch (e) { calcOk = false; console.error('    calcul: ' + e.message); }
A(calcOk, '7. calculerPiece accepte une pièce normalisée (aucune régression de contrat)');
A(pm.surfaces && pm.surfaces.sol === 20, '7. piece.surfaces toujours dérivée par le moteur (sol = 20)');
A(pm.id === 'salon' && pm.dims.l === 5, '7. moteur reçoit id + dims inchangés');

// ---- Bilan --------------------------------------------------------------
console.log('modele-piece-socle-lot39 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
