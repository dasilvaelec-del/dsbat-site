// =====================================================================
// tests/choix-travaux-chaine.test.js — Chaîne réelle : réponse -> moteur -> prestation
// =====================================================================
// Scénario MAISON NEUVE T2 : 1 salle de bain, 1 WC, cuisine, salon, chambre.
// Prouve que les réponses du questionnaire, projetées par l'adaptateur, produisent
// des prestations RÉELLES reconnues par les moteurs existants (pas des données mortes).
// =====================================================================
const path = require('path');
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));
const PLO = require(path.join(__dirname, '..', 'js', 'moteurs', 'plomberie.js'));
const ELEC = require(path.join(__dirname, '..', 'js', 'moteurs', 'electricite.js'));
const REV = require(path.join(__dirname, '..', 'js', 'moteur-revetements.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const has = (arr, code) => arr.some(x => x.code === code);

global.chantier = { typeProjet: 'neuf', chauffage: 'electrique' };
global.metiersActifs = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie'];

const pieces = [
  { id: 'salon', numero: 1, nom: 'Salon', config: {}, dims: { l: 5, la: 4, h: 2.5, fenetres: 2, portes: 1 } },
  { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {}, dims: { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {}, dims: { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {}, dims: { l: 2.5, la: 2, h: 2.5, fenetres: 1, portes: 1 } },
  { id: 'wc', numero: 1, nom: 'WC', config: {}, dims: { l: 1.5, la: 1, h: 2.5, fenetres: 0, portes: 1 } }
];
const chantier = {
  typeProjet: 'neuf', chauffage: 'electrique', domotique: 'non', borneVE: 'non', pv: 'non',
  choixTravaux: {
    version: 2,
    electricite: { niveau: 'confort', reseauMultimedia: 'oui' },
    plomberie: {
      sdb: { 'sdb#1': { equipements: ['douche_ital', 'baignoire'], lavabo: 'simple' } },
      wc: { 'wc#1': { type: 'suspendu', laveMains: 'oui' } },
      cuisine: { 'cuisine#1': { evier: 'double', laveVaisselle: 'oui' } },
      laveLinge: { piece: 'cuisine#1' }
    },
    chauffage: { chauffageAuSol: 'oui' },
    vmc: { intention: 'creer', solution: 'double_flux' },
    revetementsSol: { uniforme: 'non', global: null, parPiece: { 'salon#1': 'parq_flot', 'sdb#1': 'carrelage' } },
    faience: { parPiece: { 'sdb#1': 'zone' } },
    menuiserie: { volets: 'oui', motoriser: 'oui', fenetres: 'oui' }
  }
};
global.chantier = chantier;
const P = id => pieces.find(p => p.id === id);

// ---------- projection ----------
const rep = AD.appliquer(pieces, chantier, { metiersActifs: global.metiersActifs });

// ===== PLOMBERIE : les codes projetés sont de VRAIES prestations du catalogue =====
const cataSdb = PLO.getPlombPourPiece('sdb');
A(P('sdb').config.plomberie.PLO_DOUCHE_ITAL === 1 && has(cataSdb, 'PLO_DOUCHE_ITAL'), 'sdb : douche italienne = prestation catalogue réelle');
A(P('sdb').config.plomberie.PLO_BAIGNOIRE === 1 && has(cataSdb, 'PLO_BAIGNOIRE'), 'sdb : baignoire = prestation catalogue réelle');
A(P('sdb').config.plomberie.PLO_MEUBLE_LAV === 1 && has(cataSdb, 'PLO_MEUBLE_LAV'), 'sdb : meuble vasque = prestation catalogue réelle');
const cataWc = PLO.getPlombPourPiece('wc');
A(P('wc').config.plomberie.PLO_WC_SUSP === 1 && has(cataWc, 'PLO_WC_SUSP'), 'wc : WC suspendu = prestation catalogue réelle');
A(P('wc').config.plomberie.PLO_LAV_SIMPLE === 1 && has(cataWc, 'PLO_LAV_SIMPLE'), 'wc : lave-mains = prestation catalogue réelle');
const cataCui = PLO.getPlombPourPiece('cuisine');
A(P('cuisine').config.plomberie.PLO_EVIER_DBL === 1 && has(cataCui, 'PLO_EVIER_DBL'), 'cuisine : évier double = prestation catalogue réelle');
A(P('cuisine').config.plomberie.PLO_RACCORD_LV === 2 && has(cataCui, 'PLO_RACCORD_LV'), 'cuisine : lave-vaisselle + lave-linge = 2 raccordements (code catalogue réel)');
// _ploQtes agrège bien ces prestations (moteur les consomme)
const q = PLO._ploQtes(P('sdb'));
A(q.douches >= 1 && (q.plo.PLO_BAIGNOIRE || 0) === 1, '_ploQtes agrège douche + baignoire de la sdb');

// ===== ÉLECTRICITÉ =====
A(rep.objectif === 'confort', 'élec niveau confort -> objectifProjet=confort (recoDSBAT)');
A(P('salon').config.electricite.ELEC_RJ45 >= 1 && has(ELEC.getElecPourPiece('salon'), 'ELEC_RJ45'), 'salon : RJ45 réseau = prestation catalogue réelle');

// ===== REVÊTEMENTS DE SOL (moteur appliquerRevetements consomme solMateriau) =====
REV.appliquerRevetements(P('salon'), { sol: 20, murs: 45, plafond: 20 }, global.metiersActifs);
A(P('salon').solType === 'parq_flot', 'salon : parquet flottant -> piece.solType (consommé par moteur-piece)');
REV.appliquerRevetements(P('sdb'), { sol: 5, murs: 20, plafond: 5 }, global.metiersActifs);
A((P('sdb').config.carrelage.CAR_POSE_SOL || 0) > 0, 'sdb : carrelage sol -> CAR_POSE_SOL (m² calculés par le moteur)');
A((P('sdb').config.carrelage.CAR_POSE_MUR || 0) > 0, 'sdb : faïence zone -> CAR_POSE_MUR (m² calculés par le moteur)');

// ===== VMC (sources canoniques ; projection déléguée) =====
A(chantier.intentionVentilation === 'creer' && chantier.solutionVentilation === 'double_flux' && rep.projeterVmc === true, 'VMC : sources canoniques écrites + projection à déclencher');

// ===== CHAUFFAGE AU SOL : canonique mais explicitement NON chiffré =====
A(P('salon').chauffageFonctions.solution.technologie === 'plancher_chauffant', 'chauffage au sol -> chauffageFonctions (canonique)');
A(rep.nonBranche.some(x => /chauffage au sol/i.test(x)), 'chauffage au sol RAPPORTÉ comme non chiffré');

const total = ok + ko;
if (ko === 0) console.log('✅ Chaîne réelle questionnaire→moteur→prestation (T2 neuf) : ' + ok + '/' + total);
else { console.error('❌ Chaîne réelle : ' + ok + '/' + total); process.exit(1); }
