// tests/mes-pieces-cave-buanderie-grenier.test.js
// LOT « Mes pièces » : dissocier Cave / Buanderie et ajouter Grenier.
// Vérifie PIECES_DEF, catégories LOT39 (source unique = ModeleProjetDSBAT),
// création réelle par validerPieces(), dimensions, non-régression.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const M = require(path.join(RACINE, 'js', 'modele-projet.js')); // définit global.ModeleProjetDSBAT
const CUI = require(path.join(RACINE, 'js', 'confirmation-ui.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- Extraire le vrai PIECES_DEF du configurateur ----
const defSrc = HTML.match(/const PIECES_DEF = \{[\s\S]*?\n\};/)[0];
eval(defSrc.replace('const PIECES_DEF =', 'global.PIECES_DEF ='));
const tous = [].concat(PIECES_DEF.vie, PIECES_DEF.sanitaires, PIECES_DEF.circulations, PIECES_DEF.exterieur);
const byId = id => tous.find(p => p.id === id);

// ===== 1-3 : trois pièces indépendantes dans PIECES_DEF =====
A(!!byId('cave'), '1. cave présente comme pièce indépendante');
A(!!byId('buanderie'), '2. buanderie présente comme pièce indépendante');
A(!!byId('grenier'), '3. grenier présent comme pièce indépendante');
A(byId('cave') && byId('cave').nom === 'Cave', '1b. libellé cave = « Cave »');
A(byId('buanderie') && byId('buanderie').nom === 'Buanderie', '2b. libellé buanderie = « Buanderie »');
A(byId('grenier') && byId('grenier').nom === 'Grenier', '3b. libellé grenier = « Grenier »');

// ===== 4 : « Cave / Buanderie » n'est plus un libellé =====
A(!tous.some(p => /Cave\s*\/\s*Buanderie/i.test(p.nom || '')), '4. « Cave / Buanderie » n\'est plus le libellé d\'une pièce');
A(!/Cave \/ Buanderie/.test(HTML), '4b. plus aucune occurrence du libellé regroupé dans le configurateur');
// ids distincts, aucun doublon
const ids = tous.map(p => p.id);
A(new Set(ids).size === ids.length, 'ids uniques (aucun doublon)');
A(ids.filter(i => i === 'cave').length === 1 && ids.filter(i => i === 'buanderie').length === 1 && ids.filter(i => i === 'grenier').length === 1, 'cave/buanderie/grenier : exactement une entrée chacun');

// ===== 5-7 : catégories LOT39 (source unique ModeleProjetDSBAT) =====
A(M.categorieSurfacePiece('cave') === 'annexe', '5. cave -> annexe');
A(M.categorieSurfacePiece('buanderie') === 'logement', '6. buanderie -> logement');
A(M.categorieSurfacePiece('grenier') === 'annexe', '7. grenier -> annexe');

// ===== 12 : aucune table de catégorie dupliquée dans le configurateur =====
A(!/CATEGORIE_PAR_ID|function\s+categorieSurfacePiece/.test(HTML), '12. aucune table/fonction de catégorie recréée dans le configurateur');
A(!/'logement'|'annexe'|'exterieur'|"logement"|"annexe"|"exterieur"/.test(HTML), '12b. aucune catégorie en dur dans le configurateur (source = modèle)');
A(/ModeleProjetDSBAT\.normaliserPieceSocle/.test(HTML), '12c. le configurateur délègue la catégorisation au modèle');

// ===== 8-9 : création réelle par validerPieces() + dimensions conservées =====
function extraireFonction(nom) {
  const start = HTML.indexOf('function ' + nom + '(');
  const next = HTML.indexOf('\nfunction ', start + 1);
  return HTML.slice(start, next === -1 ? undefined : next);
}
// stubs d'environnement (repris du harnais validerPieces existant)
global.chantier = {};
global.dimsParPiece = {
  'cave#1': { l: 4, la: 5, h: 2.5, fenetres: 0, portes: 1 },
  'buanderie#1': { l: 2, la: 3, h: 2.5, fenetres: 1, portes: 1 },
  'grenier#1': { l: 6, la: 5, h: 2.5, fenetres: 1, portes: 1 },
  'salon#1': { l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 },
  'salon#2': { l: 4, la: 4, h: 2.5, fenetres: 1, portes: 1 }
};
global.dimKey = (id, n) => id + '#' + n;
global.poseParDefaut = () => 'saignee';
global.gammeElecParDefaut = () => 'mosaic';
global.gammePloParDefaut = () => 'standard';
global.normaliserGammesIP44 = () => {};
global.verifierCoherenceGlobale = () => [];
global.afficherCoherence = () => {};
global.masquerCoherence = () => {};
global.appliquerNorme = () => {};
global.appliquerObjectif = () => {};
global.saveEtat = () => {};
global.allerPhase = () => {};
global.allerPrestations = () => {};
global.ConfirmationUIDSBAT = CUI;
global.__coherenceAcquittee = true;
global.document = { getElementById: () => ({ style: {}, set innerHTML(v) {}, get innerHTML() { return ''; } }) };
global.piecesSelectionnees = [];
global.compteurs = { cave: 1, buanderie: 1, grenier: 1, salon: 2 };

// installer les vraies fonctions
eval(extraireFonction('_appliquerSocleLot39') + '\nglobal._appliquerSocleLot39 = _appliquerSocleLot39;');
eval(extraireFonction('validerPieces') + '\nglobal.validerPieces = validerPieces;');
validerPieces();

const trouve = id => piecesSelectionnees.filter(p => p.id === id);
A(trouve('cave').length === 1, '8a. cave créée par validerPieces()');
A(trouve('buanderie').length === 1, '8b. buanderie créée par validerPieces()');
A(trouve('grenier').length === 1, '8c. grenier créé par validerPieces()');

const cave = trouve('cave')[0], buan = trouve('buanderie')[0], gren = trouve('grenier')[0];
A(cave.dims.l === 4 && cave.dims.la === 5, '9a. dimensions cave conservées (4×5)');
A(buan.dims.l === 2 && buan.dims.la === 3, '9b. dimensions buanderie conservées (2×3)');
A(gren.dims.l === 6 && gren.dims.la === 5, '9c. dimensions grenier conservées (6×5)');

// catégories posées sur les pièces vivantes via le socle (raccordement P2)
A(cave.categorieSurface === 'annexe', '9d. cave vivante -> categorieSurface annexe');
A(buan.categorieSurface === 'logement', '9e. buanderie vivante -> categorieSurface logement');
A(gren.categorieSurface === 'annexe', '9f. grenier vivant -> categorieSurface annexe');
A(cave.projet && buan.projet && gren.projet, '9g. bloc projet posé sur les trois pièces');

// ===== 10 : non-régression des autres pièces (salon x2 répétable) =====
A(trouve('salon').length === 2, '10. autres pièces non régressées (salon ×2 créés)');
A(piecesSelectionnees.every(p => p.dims && typeof p.dims.h === 'number'), '10b. toutes les pièces ont des dims exploitables');
// une 2e cave fonctionne comme pièce répétable
global.piecesSelectionnees = [];
global.compteurs = { cave: 2 };
global.dimsParPiece = { 'cave#1': { l: 4, la: 5, h: 2.5 }, 'cave#2': { l: 3, la: 3, h: 2.5 } };
validerPieces();
A(piecesSelectionnees.filter(p => p.id === 'cave').length === 2, '10c. une 2e cave fonctionne (pièce répétable)');

// ===== 11 : références existantes à cave intactes (échantillon moteurs) =====
const ELEC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'electricite.js'), 'utf8');
const VMC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'), 'utf8');
const PEINT = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'peinture.js'), 'utf8');
A(/\['cave','garage'\]/.test(ELEC), '11a. électricité : règle cave/garage inchangée');
A(/'cave'/.test(VMC), '11b. VMC : cave conservée en pièce d\'extraction');
A(/'cave'/.test(PEINT), '11c. peinture : règle cave inchangée');

console.log('mes-pieces-cave-buanderie-grenier : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
