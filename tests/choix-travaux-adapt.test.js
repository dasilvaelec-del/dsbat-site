// =====================================================================
// tests/choix-travaux-adapt.test.js — Adaptateur : choix -> sources canoniques
// =====================================================================
// Prouve la chaîne réponse -> source canonique consommée par les moteurs, et
// l'IDEMPOTENCE (revenir/valider N fois ne double pas). Vérifie aussi les
// éléments signalés « non branchés » (chauffage au sol, buanderie, double vasque).
// =====================================================================
const path = require('path');
const AD = require(path.join(__dirname, '..', 'js', 'choix-travaux-adapt.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

function mkPieces() {
  return [
    { id: 'salon', numero: 1, nom: 'Salon', config: {} },
    { id: 'chambre', numero: 1, nom: 'Chambre 1', config: {} },
    { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {} },
    { id: 'sdb', numero: 1, nom: 'Salle de bain', config: {} },
    { id: 'wc', numero: 1, nom: 'WC', config: {} }
  ];
}
const METIERS = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie'];
function mkChantier() {
  return {
    typeProjet: 'neuf', domotique: 'non', borneVE: 'non', pv: 'non',
    choixTravaux: {
      version: 2,
      electricite: { niveau: 'confort', reseauMultimedia: 'oui' },
      plomberie: {
        sdb: { 'sdb#1': { equipements: ['douche_ital', 'baignoire'], lavabo: 'double' } },
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
}

// ---------- passe 1 ----------
let pieces = mkPieces(); let ch = mkChantier();
let r1 = AD.appliquer(pieces, ch, { metiersActifs: METIERS });
const P = id => pieces.find(p => p.id === id);

// électricité
A(r1.objectif === 'confort', 'élec niveau confort -> objectif confort (à passer à setObjectif)');
A((P('salon').config.electricite.ELEC_RJ45 || 0) === 1 && (P('chambre').config.electricite.ELEC_RJ45 || 0) === 1, 'réseau multimédia -> +1 ELEC_RJ45 (salon, chambre)');
A(!P('cuisine').config.electricite || !P('cuisine').config.electricite.ELEC_RJ45, 'RJ45 non ajouté hors pièces catalogue (cuisine)');
// plomberie sdb
A(P('sdb').config.plomberie.PLO_DOUCHE_ITAL === 1 && P('sdb').config.plomberie.PLO_BAIGNOIRE === 1, 'sdb : douche italienne + baignoire (multi-choix)');
A(P('sdb').config.plomberie.PLO_MEUBLE_LAV === 1, 'sdb : meuble vasque projeté');
A(r1.nonBranche.some(x => /double vasque/i.test(x)), 'double vasque signalé non différencié');
// wc
A(P('wc').config.plomberie.PLO_WC_SUSP === 1 && P('wc').config.plomberie.PLO_LAV_SIMPLE === 1, 'wc suspendu + lave-mains');
A(!P('wc').config.plomberie.PLO_WC_SIMPLE, 'wc : pas de WC au sol quand suspendu choisi');
// cuisine : évier double + (lave-vaisselle + lave-linge) = PLO_RACCORD_LV cumulé à 2
A(P('cuisine').config.plomberie.PLO_EVIER_DBL === 1, 'cuisine : évier double');
A(P('cuisine').config.plomberie.PLO_RACCORD_LV === 2, 'cuisine : lave-vaisselle + lave-linge = 2 raccordements (même code)');
// chauffage au sol : canonique mais non chiffré
A(P('salon').chauffageFonctions.solution.technologie === 'plancher_chauffant', 'chauffage au sol -> chauffageFonctions (canonique)');
A(r1.nonBranche.some(x => /chauffage au sol/i.test(x) && /chiffr/i.test(x)), 'chauffage au sol signalé non chiffré');
// vmc
A(ch.intentionVentilation === 'creer' && ch.solutionVentilation === 'double_flux' && r1.projeterVmc === true, 'VMC -> sources canoniques + flag projection');
// revêtements + faïence
A(P('salon').solMateriau === 'parq_flot' && P('sdb').solMateriau === 'carrelage', 'revêtements -> piece.solMateriau');
A(P('sdb').faienceMode === 'zone', 'faïence -> piece.faienceMode');

// ---------- passe 2 : IDEMPOTENCE (revalider ne double rien) ----------
let r2 = AD.appliquer(pieces, ch, { metiersActifs: METIERS });
A((P('salon').config.electricite.ELEC_RJ45 || 0) === 1, 'idempotent : ELEC_RJ45 reste 1 après 2e passage');
A(P('cuisine').config.plomberie.PLO_RACCORD_LV === 2, 'idempotent : PLO_RACCORD_LV reste 2');
A(P('sdb').config.plomberie.PLO_DOUCHE_ITAL === 1, 'idempotent : douche italienne reste 1');

// ---------- passe 3 : un choix retiré est bien nettoyé ----------
ch.choixTravaux.plomberie.sdb['sdb#1'].equipements = ['douche_ital']; // baignoire retirée
ch.choixTravaux.electricite.reseauMultimedia = 'non';                 // réseau retiré
AD.appliquer(pieces, ch, { metiersActifs: METIERS });
A(!P('sdb').config.plomberie.PLO_BAIGNOIRE, 'baignoire retirée -> code nettoyé');
A(P('sdb').config.plomberie.PLO_DOUCHE_ITAL === 1, 'douche conservée');
A(!(P('salon').config.electricite && P('salon').config.electricite.ELEC_RJ45), 'réseau retiré -> ELEC_RJ45 nettoyé');

// ---------- préservation d'un ajout manuel (hors adaptateur) ----------
P('sdb').config.plomberie.PLO_MEUBLE_LAV = P('sdb').config.plomberie.PLO_MEUBLE_LAV; // déjà 1 par nous
P('cuisine').config.plomberie.PLO_ADOUCISSEUR = 1; // ajout manuel
AD.appliquer(pieces, ch, { metiersActifs: METIERS });
A(P('cuisine').config.plomberie.PLO_ADOUCISSEUR === 1, 'ajout manuel hors adaptateur préservé');

// ---------- buanderie non modélisée ----------
let p2 = [{ id: 'buanderie', numero: 1, nom: 'Buanderie', config: {} }, { id: 'cuisine', numero: 1, nom: 'Cuisine', config: {} }];
let ch2 = { typeProjet: 'neuf', choixTravaux: { version: 2, plomberie: { sdb: {}, wc: {}, cuisine: {}, laveLinge: { piece: 'buanderie#1' } } } };
let rb = AD.appliquer(p2, ch2, { metiersActifs: ['plomberie'] });
A(rb.nonBranche.some(x => /buanderie/i.test(x)), 'lave-linge buanderie signalé non modélisé');
A(!(p2[0].config.plomberie && p2[0].config.plomberie.PLO_RACCORD_LV), 'buanderie : aucun faux calcul');

const total = ok + ko;
if (ko === 0) console.log('✅ Adaptateur choix de travaux (chaîne + idempotence) : ' + ok + '/' + total);
else { console.error('❌ Adaptateur choix de travaux : ' + ok + '/' + total); process.exit(1); }
