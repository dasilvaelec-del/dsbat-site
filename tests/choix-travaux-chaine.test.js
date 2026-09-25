// tests/choix-travaux-chaine.test.js — Chaîne réelle réponse -> moteur -> prestation — LOT33
// Scénario MAISON NEUVE T2 : salon, chambre, cuisine, 1 salle de bain, 1 WC.
const path = require('path');
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));
const PLO = require(path.join(__dirname, '..', 'js', 'moteurs', 'plomberie.js'));
const ELEC = require(path.join(__dirname, '..', 'js', 'moteurs', 'electricite.js'));
const MEN = require(path.join(__dirname, '..', 'js', 'moteurs', 'menuiserie.js'));
const REV = require(path.join(__dirname, '..', 'js', 'moteur-revetements.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const has = (arr, code) => arr.some(x => x.code === code);

global.metiersActifs = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie', 'isolation'];
const pieces = [
  { id: 'salon', numero: 1, nom: 'Salon', config: {}, dims: { l: 5, la: 4, h: 2.5, fenetres: 2, portes: 1 } },
  { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {}, dims: { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {}, dims: { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {}, dims: { l: 2.5, la: 2, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'wc', numero: 1, nom: 'WC', config: {}, dims: { l: 1.5, la: 1, h: 2.5, fenetres: 0, portes: 1 } }
];
const chantier = { typeProjet: 'neuf', chauffage: 'gaz', domotique: 'non', borneVE: 'non', pv: 'non', choixTravaux: {
  version: 2,
  electricite: { niveau: 'confort', reseauMultimedia: 'oui' },
  plomberie: { sdb: { 'sdb#1': { equipements: ['baignoire', 'douche_ital'], lavabo: 'simple' } }, wc: { 'wc#1': { type: 'suspendu', laveMains: 'oui' } }, cuisine: { 'cuisine#1': { evier: 'double', laveVaisselle: 'oui' } }, laveLinge: { piece: 'cuisine#1' } },
  chauffage: { type: 'electrique', solution: 'radiateurs', secheServiette: 'oui' },
  vmc: { intention: null, solution: 'double_flux' },
  revetementsSol: { uniforme: 'non', global: null, parPiece: { 'salon#1': 'parq_flot', 'sdb#1': 'carrelage' } },
  faience: { parPiece: { 'sdb#1': 'zone' } },
  menuiserie: { volets: 'motorise', fenetres: 'oui' },
  isolation: { niveau: 'renforce', acoustique: 'oui' }, ba13: { cloisons: 'oui', fauxPlafond: 'non', acoustique: 'non' }
} };
global.chantier = chantier;
const P = id => pieces.find(p => p.id === id);
const rep = AD.appliquer(pieces, chantier, { metiersActifs: global.metiersActifs });

// CHAUFFAGE : type electrique canonique (chiffrage réel radiateurs) + sèche-serviette réel
A(chantier.chauffage === 'electrique', 'chauffage électrique -> chantier.chauffage (consommé par dimensionnementChauffage)');
A(P('sdb').config.electricite.ELEC_SECH_SERV === 1 && has(ELEC.getElecPourPiece('sdb'), 'ELEC_SECH_SERV'), 'sèche-serviette = prestation catalogue réelle (sdb)');

// PLOMBERIE : vraies prestations catalogue
A(P('sdb').config.plomberie.PLO_BAIGNOIRE === 1 && has(PLO.getPlombPourPiece('sdb'), 'PLO_BAIGNOIRE'), 'sdb baignoire = prestation réelle');
A(P('wc').config.plomberie.PLO_WC_SUSP === 1 && has(PLO.getPlombPourPiece('wc'), 'PLO_WC_SUSP'), 'wc suspendu = prestation réelle');
A(P('cuisine').config.plomberie.PLO_RACCORD_LV === 2 && has(PLO.getPlombPourPiece('cuisine'), 'PLO_RACCORD_LV'), 'cuisine LV+LL = 2 raccords (réel)');
const q = PLO._ploQtes(P('sdb'));
A(q.douches >= 1 && (q.plo.PLO_BAIGNOIRE || 0) === 1, '_ploQtes agrège douche + baignoire');

// ÉLECTRICITÉ
A(rep.objectif === 'confort', 'niveau confort -> objectifProjet');
A(P('salon').config.electricite.ELEC_RJ45 >= 1 && has(ELEC.getElecPourPiece('salon'), 'ELEC_RJ45'), 'RJ45 réseau = prestation réelle (salon)');

// MENUISERIE volets motorisés : MEN_VOLET_ROULANT (réel) + ELEC_VOLET (réel)
A(P('salon').config.menuiserie.MEN_VOLET_ROULANT === 2 && has(MEN.getMenuiseriePourPiece('salon'), 'MEN_VOLET_ROULANT'), 'volets motorisés -> MEN_VOLET_ROULANT (prestation réelle, 2 fenêtres)');
A(P('salon').config.electricite.ELEC_VOLET === 2 && has(ELEC.getElecPourPiece('salon'), 'ELEC_VOLET'), 'motorisation -> ELEC_VOLET (prestation réelle)');

// REVÊTEMENTS via moteur
REV.appliquerRevetements(P('salon'), { sol: 20, murs: 45, plafond: 20 }, global.metiersActifs);
A(P('salon').solType === 'parq_flot', 'salon : parquet flottant -> solType (consommé moteur-piece)');
REV.appliquerRevetements(P('sdb'), { sol: 5, murs: 20, plafond: 5 }, global.metiersActifs);
A((P('sdb').config.carrelage.CAR_POSE_SOL || 0) > 0 && (P('sdb').config.carrelage.CAR_POSE_MUR || 0) > 0, 'sdb : carrelage sol + faïence -> m² moteur');

// VMC neuf
A(chantier.intentionVentilation === 'creer' && chantier.solutionVentilation === 'double_flux' && rep.projeterVmc, 'VMC neuf : sources canoniques + projection');

// DESCRIPTIF (non chiffré) : isolation/BA13
A(rep.descriptif.some(x => /isolation/i.test(x)) && rep.descriptif.some(x => /BA13/i.test(x)), 'isolation + BA13 rapportés descriptifs (non chiffrés)');

const total = ok + ko;
if (ko === 0) console.log('✅ Chaîne réelle LOT33 (T2 neuf) : ' + ok + '/' + total);
else { console.error('❌ Chaîne réelle LOT33 : ' + ok + '/' + total); process.exit(1); }
