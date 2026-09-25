// =====================================================================
// tests/choix-travaux-ui.test.js — Câblage UI v2 du questionnaire de choix de travaux
// =====================================================================
// Exécute les VRAIES fonctions extraites de devis-configurateur.html sur un shim DOM.
// Vérifie : rendu dynamique v2, VMC dans le questionnaire (neuf: pas de "conserver"),
// rappel chantier éditable (écrit chantier, pas de copie), validerChoixTravaux ->
// adaptateur (sources canoniques) + setObjectif/projeterVmc + allerPhase(2),
// et NON-double VMC (plus de #intentionVentilation dans le funnel).
// =====================================================================
const fs = require('fs'), path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');
const FUNNEL = fs.readFileSync(path.join(__dirname, '..', 'devis.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const D = HTML.indexOf('// ===== QUESTIONNAIRE DE CHOIX DE TRAVAUX (entre');
const F = HTML.indexOf('// ===== FIN QUESTIONNAIRE DE CHOIX DE TRAVAUX =====');
const bloc = HTML.slice(D, F);

// shim DOM
const els = {};
function el(id){ if(!els[id]) els[id]={ id, style:{}, _h:'', get innerHTML(){return this._h;}, set innerHTML(v){this._h=v;} }; return els[id]; }
['phase1','phase2','phase3','phaseConfirmation','phaseProposition','phasePrestation','phaseChoixTravaux'].forEach(el);
global.document = { getElementById: id => el(id) };
const store = {};
global.sessionStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = { scrollTo(){} };
global.ChoixTravauxDSBAT = CT; global.ChoixTravauxAdaptDSBAT = AD;
global.phaseActuelle = null;
let calls = { allerPhase: [], setObjectif: [], projeterVmc: 0, recalc: 0 };
global.allerPhase = n => { calls.allerPhase.push(n); };
global.setObjectif = m => { calls.setObjectif.push(m); };
global.projeterVmcToutesPieces = () => { calls.projeterVmc++; };
global.recalcPiece = () => { calls.recalc++; };
global.saveEtat = () => {};
global.solMateriauxDispo = () => [{ val: 'carrelage', label: 'Carrelage' }, { val: 'parq_flot', label: 'Parquet flottant' }, { val: 'stratifie', label: 'Stratifié' }, { val: 'pvc', label: 'PVC' }];
global.faienceModesDispo = id => [{ val: 'non', label: 'Aucune' }, { val: 'zone', label: 'Zone douche' }, { val: 'murs', label: 'Murs' }];

global.chantier = { typeProjet: 'neuf', domotique: 'non', borneVE: 'non', pv: 'non' };
global.piecesSelectionnees = [
  { id: 'salon', numero: 1, nom: 'Salon', config: {} },
  { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {} },
  { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {} },
  { id: 'wc', numero: 1, nom: 'WC', config: {} }
];
global.metiersActifs = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie'];

const W = new Function(bloc + '\n;return { ouvrirChoixTravaux, renderChoixTravaux, validerChoixTravaux, retourChoixTravaux, __ctPath, __ctEquip, __ctSetChantier, __ctUniforme };')();

// (1) ouverture + rendu v2
W.ouvrirChoixTravaux();
const z = el('phaseChoixTravaux');
A(z.style.display === 'block' && global.phaseActuelle === 'choixTravaux', '(1) zone affichée');
A(/Déjà indiqué/.test(z.innerHTML), '(1b) rappel chantier présent');
A(/Ventilation \(VMC\)/.test(z.innerHTML), '(1c) section VMC dans le questionnaire');
A(/Salle de bain/.test(z.innerHTML) && /Douche à l/.test(z.innerHTML), '(1d) plomberie SDB rendue (multi-choix)');
A(!/Conserver l/.test(z.innerHTML), '(1e) neuf : pas de "conserver" en VMC');

// (2) neuf seed VMC = creer
A(store['chantier'] && JSON.parse(store['chantier']).choixTravaux.vmc.intention === 'creer', '(2) neuf : intention VMC pré-réglée à creer');

// (3) rappel éditable écrit chantier (pas de copie dans choixTravaux)
W.__ctSetChantier('domotique', 'complet');
let saved = JSON.parse(store['chantier']);
A(saved.domotique === 'complet', '(3) rappel domotique -> chantier.domotique');
A(!('domotique' in (saved.choixTravaux || {})), '(3b) pas de copie domotique dans choixTravaux');

// (4) équipements multi + persistance
W.__ctEquip('sdb#1', 'douche_ital', true);
W.__ctEquip('sdb#1', 'baignoire', true);
saved = JSON.parse(store['chantier']);
A(saved.choixTravaux.plomberie.sdb['sdb#1'].equipements.indexOf('douche_ital') !== -1 && saved.choixTravaux.plomberie.sdb['sdb#1'].equipements.indexOf('baignoire') !== -1, '(4) équipements SDB multi persistés');
W.__ctPath(['plomberie', 'wc', 'wc#1', 'type'], 'suspendu');
W.__ctPath(['electricite', 'niveau'], 'confort');

// (5) validation -> adaptateur (canonique) + hooks + phase 2
W.validerChoixTravaux();
A(global.piecesSelectionnees.find(p => p.id === 'sdb').config.plomberie.PLO_DOUCHE_ITAL === 1, '(5) adaptateur : douche italienne projetée en config canonique');
A(global.piecesSelectionnees.find(p => p.id === 'wc').config.plomberie.PLO_WC_SUSP === 1, '(5b) adaptateur : WC suspendu projeté');
A(calls.setObjectif.indexOf('confort') !== -1, '(5c) niveau confort -> setObjectif(confort)');
A(calls.projeterVmc >= 1, '(5d) VMC -> projeterVmcToutesPieces appelé');
A(calls.recalc >= 1, '(5e) recalcPiece appelé (prestations matérialisées)');
A(calls.allerPhase[calls.allerPhase.length - 1] === 2, '(5f) -> allerPhase(2)');

// (6) idempotence : re-valider ne double pas
W.validerChoixTravaux();
A(global.piecesSelectionnees.find(p => p.id === 'sdb').config.plomberie.PLO_DOUCHE_ITAL === 1, '(6) idempotent après 2e validation');

// (7) NON-double VMC : le funnel n'a plus les questions intention/solution
A(FUNNEL.indexOf('id="intentionVentilation"') === -1 && FUNNEL.indexOf('id="solutionVentilation"') === -1, '(7) funnel : plus de question VMC (pas de double)');
A(/Ventilation \(VMC\)/.test(z.innerHTML), '(7b) VMC désormais rendue dans le questionnaire du configurateur');

const total = ok + ko;
if (ko === 0) console.log('✅ Câblage UI v2 questionnaire : ' + ok + '/' + total);
else { console.error('❌ Câblage UI v2 : ' + ok + '/' + total); process.exit(1); }
