// tests/choix-travaux-adapt.test.js — Adaptateur choix -> sources canoniques — LOT33
const path = require('path');
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

function mkPieces() {
  return [
    { id: 'salon', numero: 1, nom: 'Salon', config: {}, dims: { fenetres: 2 } },
    { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {}, dims: { fenetres: 1 } },
    { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {}, dims: { fenetres: 1 } },
    { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {}, dims: { fenetres: 1 } },
    { id: 'sde', numero: 1, nom: "Salle d'eau", config: {}, dims: { fenetres: 0 } },
    { id: 'wc', numero: 1, nom: 'WC', config: {}, dims: { fenetres: 0 } },
    { id: 'buanderie', numero: 1, nom: 'Buanderie', config: {}, dims: { fenetres: 0 } }
  ];
}
const M = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie', 'isolation'];
function mkChantier() {
  return { typeProjet: 'neuf', domotique: 'non', borneVE: 'non', pv: 'non', choixTravaux: {
    version: 2,
    electricite: { niveau: 'confort', reseauMultimedia: 'oui' },
    plomberie: {
      sdb: { 'sdb#1': { equipements: ['baignoire', 'douche_ital'], lavabo: 'double' }, 'sde#1': { equipements: ['douche_ital'], lavabo: 'simple' } },
      wc: { 'wc#1': { type: 'suspendu', laveMains: 'oui' } },
      cuisine: { 'cuisine#1': { evier: 'double', laveVaisselle: 'oui' } },
      laveLinge: { piece: 'cuisine#1' }
    },
    chauffage: { type: 'electrique', solution: 'radiateurs', secheServiette: 'oui' },
    vmc: { intention: null, solution: 'double_flux' },
    revetementsSol: { uniforme: 'non', global: null, parPiece: { 'salon#1': 'parq_flot', 'sdb#1': 'carrelage' } },
    faience: { parPiece: { 'sdb#1': 'zone' } },
    menuiserie: { volets: 'motorise', fenetres: 'oui' },
    isolation: { niveau: 'renforce', acoustique: 'oui' },
    ba13: { cloisons: 'oui', fauxPlafond: 'non', acoustique: 'oui' }
  } };
}

let pieces = mkPieces(), ch = mkChantier();
let r = AD.appliquer(pieces, ch, { metiersActifs: M });
const P = id => pieces.find(p => p.id === id);

// CHAUFFAGE
A(ch.chauffage === 'electrique', 'chauffage type -> chantier.chauffage=electrique (canonique)');
A(P('salon').chauffageFonctions.solution.technologie === 'radiateur_electrique', 'solution radiateurs -> chauffageFonctions (descriptif)');
A(P('sdb').config.electricite.ELEC_SECH_SERV === 1 && P('sde').config.electricite.ELEC_SECH_SERV === 1, 'sèche-serviette -> ELEC_SECH_SERV en sdb + sde (réel)');
A(!P('salon').config.electricite || !P('salon').config.electricite.ELEC_SECH_SERV, 'sèche-serviette : pas en salon');
// chauffage au sol -> descriptif (report)
let pc = mkPieces(), cc = mkChantier(); cc.choixTravaux.chauffage = { type: 'gaz', solution: 'chauffage_sol', secheServiette: 'non' };
let rc = AD.appliquer(pc, cc, { metiersActifs: M });
A(cc.chauffage === 'gaz' && pc[0].chauffageFonctions.solution.technologie === 'plancher_chauffant', 'gaz + plancher -> chantier.chauffage + chauffageFonctions');
A(rc.descriptif.some(x => /chauffage/i.test(x)), 'chauffage gaz/plancher signalé descriptif (non chiffré)');

// PLOMBERIE sdb ≠ sde
A(P('sdb').config.plomberie.PLO_BAIGNOIRE === 1 && P('sdb').config.plomberie.PLO_DOUCHE_ITAL === 1, 'sdb : baignoire + douche italienne');
A(!P('sde').config.plomberie.PLO_BAIGNOIRE && P('sde').config.plomberie.PLO_DOUCHE_ITAL === 1, 'sde : douche sans baignoire');
A(P('cuisine').config.plomberie.PLO_EVIER_DBL === 1 && P('cuisine').config.plomberie.PLO_RACCORD_LV === 2, 'cuisine : évier double + LV + lave-linge = 2 raccords');
A(r.descriptif.some(x => /double vasque/i.test(x)), 'double vasque signalé descriptif');

// lave-linge hors cuisine/cave -> descriptif
let pl = mkPieces(), cl = mkChantier(); cl.choixTravaux.plomberie.laveLinge = { piece: 'buanderie#1' };
let rl = AD.appliquer(pl, cl, { metiersActifs: M });
A(rl.descriptif.some(x => /buanderie/i.test(x)) && !(pl.find(p => p.id === 'buanderie').config.plomberie && pl.find(p => p.id === 'buanderie').config.plomberie.PLO_RACCORD_LV), 'lave-linge buanderie : descriptif, aucun faux calcul');

// VMC neuf : intention forcée creer
A(ch.intentionVentilation === 'creer' && ch.solutionVentilation === 'double_flux' && r.projeterVmc, 'VMC neuf : intention=creer implicite + solution');

// MENUISERIE volets motorisés -> MEN_VOLET_ROULANT + ELEC_VOLET (= nb fenêtres)
A(P('salon').config.menuiserie.MEN_VOLET_ROULANT === 2 && P('salon').config.electricite.ELEC_VOLET === 2, 'volets motorisés salon (2 fenêtres) -> MEN_VOLET_ROULANT + ELEC_VOLET');
A(!(P('sde').config.menuiserie && P('sde').config.menuiserie.MEN_VOLET_ROULANT), 'aucun volet où 0 fenêtre');
// volets manuels : MEN sans ELEC
let pm = mkPieces(), cm = mkChantier(); cm.choixTravaux.menuiserie = { volets: 'manuel', fenetres: 'non' };
AD.appliquer(pm, cm, { metiersActifs: M });
A(pm.find(p => p.id === 'salon').config.menuiserie.MEN_VOLET_ROULANT === 2 && !(pm.find(p => p.id === 'salon').config.electricite && pm.find(p => p.id === 'salon').config.electricite.ELEC_VOLET), 'volets manuels : MEN_VOLET_ROULANT sans ELEC_VOLET');

// ISOLATION / BA13 : descriptif (aucun config.isolation écrit)
A(!P('salon').config.isolation, 'isolation : aucun code config écrit (m²-piloté)');
A(r.descriptif.some(x => /isolation/i.test(x)) && r.descriptif.some(x => /BA13/i.test(x)), 'isolation + BA13 signalés descriptifs');

// REVÊTEMENTS
A(P('salon').solMateriau === 'parq_flot' && P('sdb').solMateriau === 'carrelage' && P('sdb').faienceMode === 'zone', 'revêtements + faïence -> sources canoniques');

// IDEMPOTENCE
let r2 = AD.appliquer(pieces, ch, { metiersActifs: M });
A(P('salon').config.electricite.ELEC_RJ45 === 1 && P('salon').config.menuiserie.MEN_VOLET_ROULANT === 2 && P('cuisine').config.plomberie.PLO_RACCORD_LV === 2 && P('sdb').config.electricite.ELEC_SECH_SERV === 1, 'idempotent : aucun doublon après 2e passage');
// retrait d'un choix -> nettoyage
ch.choixTravaux.menuiserie.volets = 'non'; ch.choixTravaux.chauffage.secheServiette = 'non';
AD.appliquer(pieces, ch, { metiersActifs: M });
A(!(P('salon').config.menuiserie && P('salon').config.menuiserie.MEN_VOLET_ROULANT) && !(P('sdb').config.electricite && P('sdb').config.electricite.ELEC_SECH_SERV), 'retrait volets + sèche-serviette -> codes nettoyés');

const total = ok + ko;
if (ko === 0) console.log('✅ Adaptateur LOT33 (chaîne + idempotence) : ' + ok + '/' + total);
else { console.error('❌ Adaptateur LOT33 : ' + ok + '/' + total); process.exit(1); }
