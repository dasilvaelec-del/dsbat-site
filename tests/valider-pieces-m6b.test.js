// =====================================================================
// tests/valider-pieces-m6b.test.js — Correction navigation M6-B (option A)
// =====================================================================
// Exécute le VRAI validerPieces() + continuerApresPropositions() extraits de
// devis-configurateur.html, avec des stubs DOM, pour prouver :
//   1. M6-B ne passe plus par la phase 2 (allerPhase(2) jamais appelé) ;
//   2. reconstruction correcte après transformation (chambre-1 / bureau+1) ;
//   3. configurations/dimensions existantes conservées (pièces gardées) ;
//   4. nouvelle pièce avec dimensions vides ;
//   5. routage phase 1 (cotes manquantes) / phase 3 (sinon) ;
//   6. non-régression des appelants existants : validerPieces() sans callback → allerPhase(2).
// =====================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
const srcValider = html.match(/function validerPieces\(apres\) \{[\s\S]*?\n\}/)[0];
const srcContinuer = html.match(/function continuerApresPropositions\(\) \{[\s\S]*?\n\}/)[0];
const CUI = require(path.join(ROOT, 'js', 'confirmation-ui.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- Stubs d'environnement (globaux) ----
global.PIECES_DEF = {
  vie: [{ id: 'salon', icon: '🛋️', nom: 'Salon' }, { id: 'chambre', icon: '🛏️', nom: 'Chambre' }, { id: 'bureau', icon: '💻', nom: 'Bureau' }],
  sanitaires: [{ id: 'sdb', icon: '🛁', nom: 'Salle de bain' }], circulations: [], exterieur: []
};
global.chantier = {};
global.dimsParPiece = {};
global.dimKey = (id, n) => id + '#' + n;
global.poseParDefaut = () => 'saignee';
global.gammeElecParDefaut = () => 'mosaic';
global.gammePloParDefaut = () => 'standard';
global.normaliserGammesIP44 = () => {};
global.verifierCoherenceGlobale = () => [];   // cohérence testée ailleurs ; ici on cible navigation/fusion
global.afficherCoherence = () => {};
global.masquerCoherence = () => {};
global.appliquerNorme = () => {};
global.appliquerObjectif = () => {};
global.saveEtat = () => {};
global.ConfirmationUIDSBAT = CUI;
global.__coherenceAcquittee = true;
let allerPhaseCalls = [];
global.allerPhase = (n) => { allerPhaseCalls.push(n); };
let allerPrestationsCalls = 0;
global.allerPrestations = () => { allerPrestationsCalls++; }; // AIC-001/M7-B : routage après réconciliation
const dom = { style: {}, set innerHTML(v) {}, get innerHTML() { return ''; } };
global.document = { getElementById: () => dom };

// installe les fonctions réelles
eval(srcValider);
eval(srcContinuer);

function pieceExistante(id, numero, dims, config, elecGamme) {
  return { id: id, numero: numero, nom: id + ' ' + numero, icon: '', dims: dims, config: config, elecMethode: 'saignee', elecGamme: elecGamme, ploGamme: 'premium', normeMin: {} };
}

// ================= Scénario transformation : chambre 2→1, bureau 0→1 =================
function etatTransformation() {
  global.compteurs = { salon: 0, chambre: 1, bureau: 1, sdb: 1 }; // APRÈS changerCompteur(chambre,-1)+ (bureau,+1)
  global.piecesSelectionnees = [
    pieceExistante('sdb', 1, { l: 2, la: 2, h: 2.5, fenetres: 1, portes: 1 }, { plomberie: { PLO_EVIER: 1 } }, 'celiane'),
    pieceExistante('chambre', 1, { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 }, { electricite: { ELEC_PL_SA: 2 } }, 'mosaic'),
    pieceExistante('chambre', 2, { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 }, { electricite: { ELEC_PL_SA: 9 } }, 'dooxie')
  ];
}

// (1) M6-B via callback : allerPhase(2) jamais appelé ; callback exécuté
etatTransformation();
allerPhaseCalls = [];
let cbAppele = false;
let retour = validerPieces(function () { cbAppele = true; });
A(retour === true && cbAppele === true, '(1) callback exécuté, validerPieces renvoie true');
A(allerPhaseCalls.indexOf(2) === -1, '(1) aucun passage par la phase 2 depuis validerPieces');

// (2) reconstruction : chambre#1 + bureau#1 + sdb ; chambre#2 supprimée
const ids = piecesSelectionnees.map(p => p.id + '#' + p.numero).sort();
A(JSON.stringify(ids) === JSON.stringify(['bureau#1', 'chambre#1', 'sdb#1']), '(2) reconstruction = chambre#1, bureau#1, sdb#1 (chambre#2 supprimée)');

// (3) configurations/dimensions existantes conservées (objets gardés)
const ch1 = piecesSelectionnees.find(p => p.id === 'chambre' && p.numero === 1);
const sdb = piecesSelectionnees.find(p => p.id === 'sdb');
A(ch1 && ch1.config.electricite.ELEC_PL_SA === 2 && ch1.dims.l === 4 && ch1.elecGamme === 'mosaic', '(3) chambre#1 : config/dimensions/gamme préservées');
A(sdb && sdb.config.plomberie.PLO_EVIER === 1 && sdb.dims.l === 2 && sdb.elecGamme === 'celiane', '(3) sdb : config/dimensions/gamme préservées');

// (4) nouvelle pièce (bureau) : dimensions vides + gammes par défaut
const bureau = piecesSelectionnees.find(p => p.id === 'bureau');
A(bureau && !bureau.dims.l && !bureau.dims.la && JSON.stringify(bureau.config) === '{}', '(4) bureau#1 : dimensions vides, config vierge');

// (5a) routage : cotes manquantes (bureau) → phase 1, jamais phase 2, pas de M7-B
etatTransformation();
allerPhaseCalls = []; allerPrestationsCalls = 0;
continuerApresPropositions();
A(allerPhaseCalls.indexOf(2) === -1 && allerPhaseCalls[allerPhaseCalls.length - 1] === 1 && allerPrestationsCalls === 0, '(5a) cotes manquantes → phase 1, sans phase 2 ni M7-B');

// (5b) routage : toutes cotes présentes → M7-B (allerPrestations), jamais phase 2
global.compteurs = { salon: 0, chambre: 2, bureau: 0, sdb: 1 };
global.piecesSelectionnees = [
  pieceExistante('sdb', 1, { l: 2, la: 2, h: 2.5, fenetres: 1, portes: 1 }, {}, 'mosaic'),
  pieceExistante('chambre', 1, { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 }, {}, 'mosaic'),
  pieceExistante('chambre', 2, { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 }, {}, 'mosaic')
];
allerPhaseCalls = []; allerPrestationsCalls = 0;
continuerApresPropositions();
A(allerPhaseCalls.indexOf(2) === -1 && allerPrestationsCalls === 1, '(5b) toutes cotes présentes → M7-B (allerPrestations), sans phase 2');

// (6) non-régression : appelant historique sans callback → allerPhase(2)
etatTransformation();
allerPhaseCalls = [];
validerPieces();
A(allerPhaseCalls.length === 1 && allerPhaseCalls[0] === 2, '(6) validerPieces() sans callback → allerPhase(2) (comportement historique)');

const total = ok + ko;
if (ko === 0) console.log('✅ Navigation M6-B (validerPieces callback) : ' + ok + '/' + total + ' — pas de phase 2 parasite, fusion préservée');
else console.error('❌ Navigation M6-B : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
