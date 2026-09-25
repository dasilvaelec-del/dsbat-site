// tests/choix-travaux-ui.test.js — Câblage UI v2 du questionnaire — LOT33
const fs = require('fs'), path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');
const FUNNEL = fs.readFileSync(path.join(__dirname, '..', 'devis.html'), 'utf8');
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const bloc = HTML.slice(HTML.indexOf('// ===== QUESTIONNAIRE DE CHOIX DE TRAVAUX (entre'), HTML.indexOf('// ===== FIN QUESTIONNAIRE DE CHOIX DE TRAVAUX ====='));
const els = {};
function el(id){ if(!els[id]) els[id]={ id, style:{}, _h:'', get innerHTML(){return this._h;}, set innerHTML(v){this._h=v;} }; return els[id]; }
['phase1','phase2','phase3','phaseConfirmation','phaseProposition','phasePrestation','phaseChoixTravaux'].forEach(el);
global.document = { getElementById: id => el(id) };
const store = {}; global.sessionStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = { scrollTo(){} };
global.ChoixTravauxDSBAT = CT; global.ChoixTravauxAdaptDSBAT = AD;
global.phaseActuelle = null;
let calls = { allerPhase: [], setObjectif: [], projeterVmc: 0, recalc: 0 };
global.allerPhase = n => { calls.allerPhase.push(n); };
global.setObjectif = m => { calls.setObjectif.push(m); };
global.projeterVmcToutesPieces = () => { calls.projeterVmc++; };
global.recalcPiece = () => { calls.recalc++; };
global.saveEtat = () => {};
global.solMateriauxDispo = () => [{ val: 'carrelage', label: 'Carrelage' }, { val: 'parq_flot', label: 'Parquet' }];
global.faienceModesDispo = () => [{ val: 'non', label: 'Aucune' }, { val: 'zone', label: 'Zone douche' }];
global.chantier = { typeProjet: 'neuf', domotique: 'non', borneVE: 'non', pv: 'non' };
global.piecesSelectionnees = [
  { id: 'salon', numero: 1, nom: 'Salon', config: {}, dims: { fenetres: 2 } },
  { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {}, dims: { fenetres: 1 } },
  { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {}, dims: { fenetres: 1 } },
  { id: 'sde', numero: 1, nom: "Salle d'eau", config: {}, dims: { fenetres: 0 } },
  { id: 'wc', numero: 1, nom: 'WC', config: {}, dims: { fenetres: 0 } }
];
global.metiersActifs = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie', 'isolation'];

const W = new Function(bloc + '\n;return { ouvrirChoixTravaux, renderChoixTravaux, validerChoixTravaux, __ctPath, __ctEquip, __ctSetChantier, __ctChauffageType };')();

// (1) rendu v2 LOT33
W.ouvrirChoixTravaux();
const z = el('phaseChoixTravaux');
A(z.style.display === 'block', '(1) zone affichée');
A(/Quel type de chauffage/.test(z.innerHTML), '(1a) chauffage : question type présente');
A(/Ventilation \(VMC\)/.test(z.innerHTML) && !/Conserver/.test(z.innerHTML), '(1b) VMC neuf : choix direct, pas de conserver');
A(/salle d'eau|salle d’eau/i.test(z.innerHTML) || /Salle d'eau/.test(z.innerHTML), '(1c) salle d\'eau rendue distincte');
A(/Voulez-vous des volets/.test(z.innerHTML) && /motorisés/.test(z.innerHTML), '(1d) volets tri-état');
A(/Isolation/.test(z.innerHTML) && /BA13|placo/i.test(z.innerHTML), '(1e) isolation + BA13 présents');

// (2) chauffage type -> solution apparaît
W.__ctChauffageType('electrique');
A(/Solution/.test(el('phaseChoixTravaux').innerHTML) && /Radiateurs électriques/.test(el('phaseChoixTravaux').innerHTML), '(2) type électrique -> solutions affichées');
W.__ctPath(['chauffage', 'solution'], 'radiateurs');
W.__ctPath(['chauffage', 'secheServiette'], 'oui');

// (3) rappel domotique écrit chantier
W.__ctSetChantier('domotique', 'complet');
A(JSON.parse(store['chantier']).domotique === 'complet', '(3) rappel domotique -> chantier');

// (4) équipements sdb + volets + niveau
W.__ctEquip('sdb#1', 'baignoire', true);
W.__ctPath(['plomberie', 'wc', 'wc#1', 'type'], 'suspendu');
W.__ctPath(['menuiserie', 'volets'], 'motorise');
W.__ctPath(['electricite', 'niveau'], 'confort');

// (5) validation -> adaptateur (canonique) + hooks
W.validerChoixTravaux();
A(global.chantier.chauffage === 'electrique', '(5) chauffage type projeté -> chantier.chauffage');
A(piecesSelectionnees.find(p => p.id === 'sdb').config.electricite.ELEC_SECH_SERV === 1, '(5b) sèche-serviette -> ELEC_SECH_SERV');
A(piecesSelectionnees.find(p => p.id === 'sdb').config.plomberie.PLO_BAIGNOIRE === 1, '(5c) baignoire projetée');
A(piecesSelectionnees.find(p => p.id === 'salon').config.menuiserie.MEN_VOLET_ROULANT === 2, '(5d) volets -> MEN_VOLET_ROULANT');
A(calls.setObjectif.indexOf('confort') !== -1 && calls.projeterVmc >= 1 && calls.recalc >= 1 && calls.allerPhase[calls.allerPhase.length - 1] === 2, '(5e) setObjectif + projeterVmc + recalc + allerPhase(2)');

// (6) idempotence
W.validerChoixTravaux();
A(piecesSelectionnees.find(p => p.id === 'salon').config.menuiserie.MEN_VOLET_ROULANT === 2 && piecesSelectionnees.find(p => p.id === 'sdb').config.electricite.ELEC_SECH_SERV === 1, '(6) idempotent après 2e validation');

// (7) non-double VMC
A(FUNNEL.indexOf('id="intentionVentilation"') === -1 && FUNNEL.indexOf('id="solutionVentilation"') === -1, '(7) funnel : plus de question VMC');
A(HTML.indexOf('<select id="vmc_intention_projet"') === -1, '(7b) Configuration : plus de select VMC éditable (rappel lecture seule)');

const total = ok + ko;
if (ko === 0) console.log('✅ Câblage UI LOT33 : ' + ok + '/' + total);
else { console.error('❌ Câblage UI LOT33 : ' + ok + '/' + total); process.exit(1); }
