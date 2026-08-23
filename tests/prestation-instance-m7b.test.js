// =====================================================================
// tests/prestation-instance-m7b.test.js — Correctif ciblage multi-instances (M7-B)
// =====================================================================
// Exécute la VRAIE glue M7-B (extraite du HTML) avec des stubs DOM, pour prouver :
//  • aucune instance choisie (multi) → application bloquée (aucune écriture) ;
//  • choix Chambre 2 → application → re-render → Chambre 2 toujours ciblée ;
//  • annulation après re-render → restauration exacte sur Chambre 2 ;
//  • Remplacer / Additionner sur Chambre 2 (bonne instance, bonne quantité) ;
//  • mono-instance → comportement conservé (pas de choix requis).
// =====================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
const s = html.indexOf('var __prestationsM7 = [];');
const e = html.indexOf('// ===== MISSION 024 — Capture des coordonnées en fin de parcours (parcours uniquement) =====');
const block = html.slice(s, e);

const CUI = require(path.join(ROOT, 'js', 'confirmation-ui.js'));
const PUI = require(path.join(ROOT, 'js', 'prestation-ui.js'));
require(path.join(ROOT, 'js', 'prestation-mapping.js'));
require(path.join(ROOT, 'js', 'confirmation-descriptif.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- Stubs DOM ----
global.sessionStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
let alertCount = 0;
global.alert = () => { alertCount++; };
const els = {};
function fakeEl() { return { value: '', style: {}, _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, scrollIntoView() {} }; }
global.document = { getElementById: (id) => { if (!els[id]) els[id] = fakeEl(); return els[id]; } };
global.window = { scrollTo() {} };
global.ConfirmationUIDSBAT = CUI;
global.PrestationUIDSBAT = PUI;
global.pieceDefById = (id) => ({ chambre: { icon: '🛏️', nom: 'Chambre' }, sdb: { icon: '🛁', nom: 'Salle de bain' } }[id] || { icon: '🏠', nom: id });
global.chantier = {}; global.metiersActifs = ['electricite', 'plomberie'];
global.calculerPieceComplet = (p) => p;   // recalcul neutralisé (le vrai moteur tourne dans l'app)
global.saveEtat = () => {};
global.__journalM6 = () => {};
global.__confReponses = () => ({});

eval(block); // installe __prestationsM7, __prestContexte, appliquerPrest, annulerPrest, renderPrestations, etc.

// ---- État : 2 chambres + 1 sdb ----
function reset() {
  global.piecesSelectionnees = [
    { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {} },
    { id: 'chambre', numero: 2, nom: 'Chambre 2', config: {} },
    { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {} }
  ];
  sessionStorage._d = {};
  __prestationsM7 = [{
    element: { id: 'el_1', source: {} }, pieceId: 'chambre', metier: 'electricite',
    instances: [{ ref: 'chambre#1', index: 0, nom: 'Chambre 1' }, { ref: 'chambre#2', index: 1, nom: 'Chambre 2' }],
    candidats: [{ id: 'ca_1', code: 'ELEC_PRISE10', label: 'Prise', metier: 'electricite', qteParDefaut: null }], aVerifierVisite: []
  }];
  els['prestQ_0_ELEC_PRISE10'] = fakeEl();
  els['prestInst_0'] = fakeEl();
}
const cfg = (idx) => (piecesSelectionnees[idx].config.electricite || {}).ELEC_PRISE10;

// ---- 1) aucune instance choisie (multi) → application bloquée ----
reset();
els['prestQ_0_ELEC_PRISE10'].value = '2';
alertCount = 0;
appliquerPrest(0, 'ELEC_PRISE10');
A(alertCount === 1 && cfg(0) === undefined && cfg(1) === undefined, '1) sans instance choisie → application bloquée (aucune écriture)');

// ---- 2) choix Chambre 2 → application → Chambre 2 ciblée, Chambre 1 intacte ----
els['prestInst_0'].value = 'chambre#2';
__prestChoisirInstance(0);
A(__prestInstanceRef(0) === 'chambre#2', '2) instance persistée = Chambre 2');
els['prestQ_0_ELEC_PRISE10'].value = '2';
appliquerPrest(0, 'ELEC_PRISE10');
A(cfg(1) === 2 && cfg(0) === undefined, '2) application → Chambre 2 = 2, Chambre 1 intacte');

// ---- 3) re-render → Chambre 2 toujours ciblée ; annulation → restaure exactement Chambre 2 ----
renderPrestations();
A(__prestInstanceRef(0) === 'chambre#2', '3) après re-render → Chambre 2 toujours ciblée');
annulerPrest(0, 'ELEC_PRISE10');
A(cfg(1) === undefined && cfg(0) === undefined, '3) annulation → Chambre 2 restaurée (0), Chambre 1 intacte');

// ---- 4a) Remplacer sur Chambre 2 (doublon) ----
reset();
els['prestInst_0'].value = 'chambre#2'; __prestChoisirInstance(0);
piecesSelectionnees[1].config.electricite = { ELEC_PRISE10: 1 };   // existant sur Chambre 2
__ecrirePrestation(0, 'ELEC_PRISE10', 3, 'remplacer');
A(cfg(1) === 3 && cfg(0) === undefined, '4a) Remplacer → Chambre 2 = 3, Chambre 1 intacte');
annulerPrest(0, 'ELEC_PRISE10');
A(cfg(1) === 1, '4a) annulation après Remplacer → restaure la valeur AVANT (1) sur Chambre 2');

// ---- 4b) Additionner sur Chambre 2 ----
reset();
els['prestInst_0'].value = 'chambre#2'; __prestChoisirInstance(0);
piecesSelectionnees[1].config.electricite = { ELEC_PRISE10: 1 };
__ecrirePrestation(0, 'ELEC_PRISE10', 2, 'additionner');
A(cfg(1) === 3 && cfg(0) === undefined, '4b) Additionner → Chambre 2 = 1+2 = 3, Chambre 1 intacte');

// ---- 5) mono-instance → comportement conservé (aucun choix requis) ----
reset();
__prestationsM7 = [{
  element: { id: 'el_2', source: {} }, pieceId: 'sdb', metier: 'plomberie',
  instances: [{ ref: 'sdb#1', index: 2, nom: 'Salle de bain' }],
  candidats: [{ id: 'ca_9', code: 'PLO_MEUBLE_LAV', label: 'Meuble vasque', metier: 'plomberie', qteParDefaut: null }], aVerifierVisite: []
}];
els['prestQ_0_PLO_MEUBLE_LAV'] = fakeEl(); els['prestQ_0_PLO_MEUBLE_LAV'].value = '1';
alertCount = 0;
appliquerPrest(0, 'PLO_MEUBLE_LAV');
A(alertCount === 0 && (piecesSelectionnees[2].config.plomberie || {}).PLO_MEUBLE_LAV === 1, '5) mono-instance → application directe (SDB), sans choix requis');

const total = ok + ko;
if (ko === 0) console.log('✅ Ciblage multi-instances M7-B : ' + ok + '/' + total + ' — bonne instance en apply/annul/Remplacer/Additionner, mono conservé');
else console.error('❌ M7-B instances : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
