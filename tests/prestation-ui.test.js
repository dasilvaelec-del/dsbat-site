// =====================================================================
// tests/prestation-ui.test.js — Preuves M7-B (helpers + chaînage catalogue)
// =====================================================================
// Vérifie : instances explicites ; détection de doublon ; résolution
// Remplacer/Additionner/Conserver ; chaînage M4→M7-A avec catalogue RÉEL ;
// aucun code hors catalogue ; quantité manquante non inventée ; pureté ;
// aucun prix ; aucune écriture de config par les helpers.
// =====================================================================

const path = require('path');
const UI = require(path.join(__dirname, '..', 'js', 'prestation-ui.js'));
const M = require(path.join(__dirname, '..', 'js', 'prestation-mapping.js'));
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);

// Catalogue RÉEL sdb (extrait de js/moteurs/plomberie.js)
const CATA_SDB = [
  { code: 'PLO_BAIGNOIRE', label: 'Baignoire', unite: 'U' },
  { code: 'PLO_DOUCHE_ITAL', label: "Douche à l'italienne", unite: 'U' },
  { code: 'PLO_MEUBLE_LAV', label: 'Meuble vasque', unite: 'U' }
];

// ---- Instances explicites ----
const pieces = [
  { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {} },
  { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {} },
  { id: 'chambre', numero: 2, nom: 'Chambre 2', config: { plomberie: {} } }
];
let insCh = UI.instancesDePiece('chambre', pieces);
A(insCh.length === 2 && insCh[0].ref === 'chambre#1' && insCh[1].ref === 'chambre#2' && insCh[1].index === 2, 'instancesDePiece : 2 chambres avec ref + index');
A(UI.instancesDePiece('sdb', pieces).length === 1, 'instancesDePiece : 1 salle de bain');
A(UI.instancesDePiece('garage', pieces).length === 0, 'instancesDePiece : type absent → 0');

// ---- Détection de doublon ----
let pieceAvecDouche = { id: 'sdb', numero: 1, config: { plomberie: { PLO_DOUCHE_ITAL: 1 } } };
let d = UI.etatDoublon(pieceAvecDouche, 'plomberie', 'PLO_DOUCHE_ITAL');
A(d.existe === true && d.quantiteActuelle === 1, 'etatDoublon : code déjà présent (×1)');
A(UI.etatDoublon(pieceAvecDouche, 'plomberie', 'PLO_BAIGNOIRE').existe === false, 'etatDoublon : code absent → existe=false');

// ---- Résolution du doublon (3 choix) ----
A(UI.resoudreDoublon('remplacer', 1, 2) === 2, 'doublon Remplacer → 2');
A(UI.resoudreDoublon('additionner', 1, 2) === 3, 'doublon Additionner → 3');
A(UI.resoudreDoublon('conserver', 1, 2) === 1, 'doublon Conserver → 1');

// ---- Chaînage M4 → M7-A avec catalogue réel : aucun code hors catalogue ----
let interp = I.interpreterDescriptif("Je veux remplacer ma baignoire par une douche à l'italienne.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let el = interp.elementsDetectes.find(e => /douche/i.test(e.element));
let prop = M.proposerPrestations(el, 'sdb', CATA_SDB);
const codesCata = CATA_SDB.map(p => p.code);
A(prop.candidats.length > 0 && prop.candidats.every(c => codesCata.indexOf(c.code) !== -1), 'chaînage : candidats ∈ catalogue réel uniquement');
A(prop.candidats.some(c => c.code === 'PLO_DOUCHE_ITAL'), 'chaînage : douche à l\'italienne proposée');
A(prop.candidats.every(c => c.qteParDefaut === null), 'quantité absente non inventée (qteParDefaut null)');
A(prop.aVerifierVisite.length >= 1, 'dépose non couverte par le catalogue → à vérifier en visite');

// ---- Pureté : les helpers ne mutent pas leurs entrées ----
let gel = J(pieces) + '|' + J(pieceAvecDouche);
UI.instancesDePiece('chambre', pieces); UI.etatDoublon(pieceAvecDouche, 'plomberie', 'PLO_DOUCHE_ITAL');
A(J(pieces) + '|' + J(pieceAvecDouche) === gel, 'pureté : entrées non mutées');

// ---- Aucun prix, aucune écriture de config par les helpers ----
let blob = J(insCh) + J(d) + J(prop);
A(!/€|totalht|"prix"|getmoyenprix/i.test(blob), 'aucun prix dans les sorties helpers/mapping');
A(J(pieceAvecDouche.config) === J({ plomberie: { PLO_DOUCHE_ITAL: 1 } }), 'aucune écriture de config par les helpers');

const total = ok + ko;
if (ko === 0) console.log('✅ Interface prestations (M7-B) : ' + ok + '/' + total + ' — catalogue réel, instances explicites, doublon 3 choix, aucun prix');
else console.error('❌ M7-B : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
