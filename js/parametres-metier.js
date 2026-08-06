// =====================================================================
// js/parametres-metier.js — Paramètres MÉTIER non-tarifaires (MISSION R10)
// =====================================================================
// Extrait VERBATIM de prix.js : uniquement les blocs « métré / quantités »
// explicitement SANS PRIX EN DUR (rendements peinture, pertes revêtements,
// épaisseurs & consommables BA13, formats carrelage, temps). Ces paramètres
// pilotent des CALCULS DE QUANTITÉS/SURFACES — jamais des prix.
//
// POURQUOI ce module PUBLIC : le calcul par pièce (moteur-piece / revêtements)
// et le récap isolation en ont besoin CÔTÉ NAVIGATEUR. En les isolant ici, le
// navigateur n'a plus besoin de charger le CATALOGUE (prix.js), désormais
// hébergé exclusivement côté Runtime privé (runtime/moteur-prive/prix.js).
//
// GARANTIE : contenu identique au bloc correspondant de prix.js (vérifié par
// tests/golden-master/parametres-drift-check.js). Aucune règle, aucun prix,
// aucun calcul modifié. Déclarations globales (script classique), comme prix.js.
// =====================================================================

const TEMPS_PARAMS = { heuresParJour: 7 };

const PEINTURE_PARAMS = {
  nbCouches: { finition: 2, sousCouche: 1 },
  rendement: {              // m²/L/couche — extensible par produit
    sousCouche: 8,          // impression placo
    murs: 10,               // acrylique murale
    plafond: 9              // peinture plafond
  },
  conditionnements: [1, 2.5, 5, 10, 15]
};

// Répartit un volume en pots (gros pots d'abord, complément au pot le plus juste)
function potsPourLitres(litres, conds) {
  if (!litres || litres <= 0) return [];
  const tailles = [...(conds || PEINTURE_PARAMS.conditionnements)].sort((a, b) => b - a);
  const pots = {};
  let restant = litres;
  for (const c of tailles) {
    while (restant >= c) { pots[c] = (pots[c] || 0) + 1; restant = Math.round((restant - c) * 100) / 100; }
  }
  if (restant > 0) {
    const c = tailles.filter(x => x >= restant).pop() || tailles[tailles.length - 1];
    pots[c] = (pots[c] || 0) + 1;
  }
  return Object.entries(pots).map(([taille, nb]) => ({ taille: parseFloat(taille), nb }))
    .sort((a, b) => b.taille - a.taille);
}

// Quantités de peinture d'une pièce (fonction pure).
// surfMurs / surfPlaf : surfaces de finition ; surfSousCouche : surface à imprimer.
function quantitesPeinture(surfMurs, surfPlaf, surfSousCouche) {
  const Q = PEINTURE_PARAMS;
  const calc = (surf, rendement, couches) => {
    const litres = surf > 0 ? Math.round((surf * couches / rendement) * 10) / 10 : 0;
    const pots = potsPourLitres(litres);
    return { surface: surf, couches, rendement, litres,
             pots, litresAchetes: Math.round(pots.reduce((s, p) => s + p.taille * p.nb, 0) * 100) / 100 };
  };
  return {
    surfaceTotale: Math.round(((surfMurs || 0) + (surfPlaf || 0)) * 10) / 10,
    murs: calc(surfMurs || 0, Q.rendement.murs, Q.nbCouches.finition),
    plafond: calc(surfPlaf || 0, Q.rendement.plafond, Q.nbCouches.finition),
    sousCouche: calc(surfSousCouche || 0, Q.rendement.sousCouche, Q.nbCouches.sousCouche)
  };
}

// Multiplicateurs de surface (pertes) + part fourniture — AUCUN prix en dur.
const SOLS_PARAMS = {
  pertes: {
    parq_flot: 0.08,  // parquet flottant : +8 %
    stratifie: 0.08,  // stratifié : +8 %
    pvc: 0.05,        // PVC : +5 %
    lino: 0.05,       // linoléum : +5 %
    moquette: 0.05    // moquette : +5 %
  },
  perteDiagonale: 0.05, // supplément si pose en diagonale (point d'entrée futur : piece.solPose === 'diagonale')
  // Part FOURNITURE du prix combiné €/m² (le reste = main-d'œuvre / pose).
  // Les pertes ne s'appliquent QU'À la fourniture, jamais à la main-d'œuvre (MISSION 033).
  // parq_flot = pose seule (fourniture client) -> fraction 0 : aucune perte sur notre prix.
  fournitureFraction: {
    parq_flot: 0,
    stratifie: 0.55,
    pvc: 0.55,
    lino: 0.55,
    moquette: 0.50
  }
};

// ISOLATION / BA13 — ratios de consommables + épaisseurs conseillées (informatif).
const ISOLATION_PARAMS = {
  surfacePlaque: 3,       // m² par plaque BA13 (1,20 × 2,50)
  perteBA13: 0.10,        // 10 % de chutes sur les plaques
  railML_parM2: 0.9,      // ml de rails (haut + bas) par m²
  montant_parM2: 0.9,     // montants par m² (entraxe ~60 cm)
  suspente_parM2: 1.2,    // suspentes par m² (plafond uniquement)
  bandeJoint_parM2: 1.2,  // ml de bande à joint par m²
  // Épaisseur d'isolant conseillée + code catalogue existant, par usage
  epaisseurs: {
    mur:     { mm: 120, code: 'ISO_LV_120' },
    plafond: { mm: 100, code: 'ISO_LV_100' },
    comble:  { mm: 300, code: 'ISO_LV_300_COMB' },
    rampant: { mm: 280, code: 'ISO_LV_280' }
  }
};

// Consommables d'un ouvrage BA13 (informatif). surface en m², plafond=true pour les suspentes.
function dimensionnementIsolation(surface, opts) {
  opts = opts || {};
  const P = ISOLATION_PARAMS;
  if (!(surface > 0)) return null;
  const plafond = !!opts.plafond;
  return {
    surface: Math.round(surface * 10) / 10,
    plaques: Math.ceil(surface * (1 + P.perteBA13) / P.surfacePlaque),
    railsML: Math.round(surface * P.railML_parM2 * 10) / 10,
    montants: Math.ceil(surface * P.montant_parM2),
    suspentes: plafond ? Math.ceil(surface * P.suspente_parM2) : 0,
    bandeJointML: Math.round(surface * P.bandeJoint_parM2 * 10) / 10
  };
}

function explicationsIsolation(r) {
  r = r || {};
  const ex = [];
  if (r.surface) ex.push(r.surface + ' m² de BA13 → ' + r.plaques + ' plaque(s) (1,20 × 2,50, +' + Math.round(ISOLATION_PARAMS.perteBA13 * 100) + ' % de chutes).');
  if (r.railsML) ex.push('Ossature : ~' + r.railsML + ' ml de rails, ' + r.montants + ' montant(s)' + (r.suspentes ? ', ' + r.suspentes + ' suspente(s)' : '') + '.');
  if (r.bandeJointML) ex.push('Traitement des joints : ~' + r.bandeJointML + ' ml de bande à joint + enduit.');
  ex.push('Consommables déjà compris dans le prix « fourniture + pose » — métré estimatif confirmé en visite.');
  return ex;
}

// CARRELAGE / FAÏENCE — pertes par format + architecture étanchéité. Aucun prix en dur.
const CARRELAGE_PARAMS = {
  pertes: {
    droite: 0.10,       // pose droite standard : +10 %
    diagonale: 0.15,    // pose diagonale : +15 % (point d'entrée futur : piece.carPose === 'diagonale')
    grandFormat: 0.12,  // grand format (>60×60) : +12 %
    mosaique: 0.15      // mosaïque / petit format : +15 %
  },
  // Type de perte selon le code de pose
  perteParPose: {
    CAR_POSE_SOL: 'droite',
    CAR_POSE_SOL_GRAND: 'grandFormat',
    CAR_POSE_MUR: 'droite',
    CAR_POSE_MUR_PETIT: 'mosaique'
  },
  // Étanchéité : forfait au catalogue aujourd'hui (CAR_ETANCHEITE).
  // Architecture prête pour un dimensionnement par surface si un code m² apparaît.
  etancheite: { mode: 'forfait', codeForfait: 'CAR_ETANCHEITE', codeSurface: null }
};

// =====================================================================
// SEUILS DE DIMENSIONNEMENT (sous-ensemble NON-TARIFAIRE) + EXPLICATIONS
// =====================================================================
// Le CHIFFRAGE des éléments centraux (tableau, VMC, plomberie, chauffage) est
// calculé par le Runtime privé. Les fonctions explications* ci-dessous ne font
// que DÉCRIRE en français le résultat déjà chiffré (aucun prix, aucun taux) :
// elles restent publiques pour préserver le récap/PDF à l'identique. Elles ne
// lisent que des SEUILS de dimensionnement (jamais les taux de main-d'œuvre ni
// les prix des modules), copiés ici en sous-ensemble.

// Sous-ensemble SIZING de TABLEAU_PARAMS (les taux MO moForfaitBase/moParModule
// restent PRIVÉS ; ils ne sont pas lus par explicationsTableau).
const TABLEAU_PARAMS = {
  maxPrisesParCircuit: 8,
  maxPointsLumineuxParCircuit: 8,
  maxCircuitsParDiff: 8,
  reserve: 0.20,
  modulesParRangee: 13
};

// Sous-ensemble de CHAUFFAGE_PARAMS lu par explicationsChauffage (tolérance).
const CHAUFFAGE_PARAMS = { tolerance: 0.10 };

function explicationsTableau(b, r) {
  b = b || {}; r = r || {};
  const P = TABLEAU_PARAMS;
  const ex = [];

  if (b.prises16) ex.push(b.prises16 + " prises réparties sur " + Math.ceil(b.prises16 / P.maxPrisesParCircuit) + " circuit(s) 16A — maximum " + P.maxPrisesParCircuit + " prises par circuit.");
  if (b.pointsLumineux) {
    let nEcl = Math.ceil(b.pointsLumineux / P.maxPointsLumineuxParCircuit);
    const minDeux = (b.surfaceLogement || 0) > 35 && nEcl < 2;
    if (minDeux) nEcl = 2;
    ex.push(b.pointsLumineux + " points lumineux sur " + nEcl + " circuit(s) d'éclairage — maximum " + P.maxPointsLumineuxParCircuit + " points par circuit" + (minDeux ? ", et 2 circuits minimum pour un logement de plus de 35 m²" : "") + " (NF C 15-100).");
  }
  if (b.circuitsVolets) ex.push(b.circuitsVolets + " circuit(s) dédié(s) aux volets roulants.");
  if (b.specialises20A) ex.push(b.specialises20A + " circuit(s) spécialisé(s) 20A : chaque gros électroménager dispose de son propre circuit (norme).");
  if (b.cuisson) {
    const nCuisson = (typeof b.cuisson === "number") ? b.cuisson : 1;
    ex.push(nCuisson > 1
      ? nCuisson + " circuits cuisson 32A dédiés (un par plaque), protégés par un différentiel type A (obligatoire)."
      : "Circuit cuisson 32A dédié à la plaque, protégé par un différentiel type A (obligatoire).");
  }
  if (b.chauffeEau) ex.push("Circuit chauffe-eau 20A avec contacteur jour/nuit (pilotage heures creuses).");
  if (b.circuitsChauffage) ex.push(b.circuitsChauffage + " circuit(s) chauffage 20A.");
  if (b.vmc) ex.push("Circuit VMC 2A dédié.");
  if (b.irve) ex.push("Borne de recharge véhicule : circuit IRVE 32A avec différentiel type A qui lui est réservé.");
  if (b.telerupteurs) ex.push(b.telerupteurs + " télérupteur(s) modulaire(s) pour les éclairages commandés depuis 3 accès ou plus.");

  if (r.differentiels) {
    ex.push(r.nbCircuits + " circuits protégés par " + r.differentiels.total + " interrupteur(s) différentiel(s) 30 mA — maximum " + P.maxCircuitsParDiff + " circuits par différentiel, minimum 2 par logement, dont " + r.differentiels.typeA + " de type A.");
  }
  if (r.calibreID === 63) {
    const charges = [b.cuisson ? "plaque de cuisson" : null, b.chauffeEau ? "chauffe-eau" : null, b.circuitsChauffage ? "chauffage électrique" : null].filter(Boolean).join(", ");
    ex.push("Différentiels en calibre 63A (et non 40A) car des charges importantes sont en aval : " + charges + ".");
  }
  if (b.parafoudre) ex.push("Parafoudre type 2 ajouté (tableau ancien ou inexistant) avec son disjoncteur de protection.");
  if (r.modulesUtiles) ex.push(r.modulesUtiles + " modules utiles + " + Math.round(P.reserve * 100) + " % de réserve obligatoire = " + r.modulesAvecReserve + " emplacements → coffret " + r.rangees + " rangée(s) de " + P.modulesParRangee + " modules.");
  if (r.debordement) ex.push("Capacité d'un coffret 4 rangées dépassée : second coffret ajouté et chiffré (implantation à confirmer en visite technique).");
  if (r.repartition && r.repartition.length) {
    const resume = r.repartition.map((g, i) => "ID" + (i + 1) + " type " + g.type + (g.dedie ? " (dédié)" : "") + " : " + g.circuits.length + " circuit(s)").join(" · ");
    ex.push("Répartition des circuits sur les différentiels : " + resume + ".");
  }

  return ex;
}

function explicationsVMC(b, r) {
  b = b || {}; r = r || {};
  const ex = [];
  if (r.bouches) ex.push(r.bouches + " bouche(s) d'extraction raccordée(s) à un caisson VMC " + (r.type || 'simple flux') + " par gaines flexibles isolées.");
  if (r.debitTotal) ex.push("Débit d'extraction total estimé ~" + r.debitTotal + " m³/h (dimensionnement du caisson, DTU 68.3).");
  ex.push("Rejet de l'air vicié en " + (r.rejet || 'toiture') + ".");
  if (b.entreesAir || r.entreesAir) ex.push((b.entreesAir || r.entreesAir) + " entrée(s) d'air hygroréglable(s) en pièces de vie pour le balayage (déjà comptée(s) par pièce).");
  return ex;
}

function explicationsPlomberie(b, r) {
  b = b || {}; r = r || {};
  const ex = [];
  if (r.efPoints) ex.push(r.efPoints + " point(s) d'eau froide et " + (r.ecsPoints || 0) + " point(s) d'eau chaude alimentés en PER.");
  if (r.evac40 || r.evac100) ex.push("Évacuations dimensionnées selon les bonnes pratiques (DTU 60.11) : " + (r.evac40 || 0) + " appareil(s) en Ø40" + (r.evac100 ? " et " + r.evac100 + " WC en Ø100" : "") + ".");
  const a = r.accessoires || {};
  if (a.nourrice) ex.push(a.nourrice + " nourrice(s) de distribution EF/ECS (plusieurs appareils alimentés).");
  if (a.robinets) ex.push(a.robinets + " robinet(s) d'arrêt : une coupure par ligne d'alimentation.");
  if (a.receveur) ex.push(a.receveur + " receveur(s) prêt(s) à carreler pour la/les douche(s) à l'italienne. (Bâti du WC suspendu déjà inclus dans le poste WC.)");
  ex.push("Métré estimatif des réseaux — confirmé lors de la visite technique.");
  return ex;
}

function explicationsChauffage(r) {
  r = r || {};
  const ex = [];
  const iso = { excellente: 'excellente isolation', bonne: 'bonne isolation', moyenne: 'isolation moyenne', faible: 'isolation faible (bâti ancien)' }[r.isoLevel] || r.isoLevel;
  if (r.nbRadiateurs) ex.push(r.nbPiecesChauffees + ' pièce(s) chauffée(s), ' + r.nbRadiateurs + ' radiateur(s), besoin ~' + r.puissanceTotale + ' W / installé ' + r.puissanceInstallee + ' W (' + iso + ', ' + r.wM2 + ' W/m²).');
  ex.push('Puissance calculée par pièce : surface × hauteur sous plafond × ' + r.wM2 + ' W/m² (tolérance ' + Math.round((CHAUFFAGE_PARAMS.tolerance || 0) * 100) + ' % pour éviter un radiateur en trop).');
  ex.push('Synchronisation tableau : ' + r.nbSortiesFilPilote + ' sortie(s) fil pilote et ' + r.nbCircuits + ' circuit(s) chauffage 20A dédié(s) (protection par disjoncteur 20A).');
  if (r.thermostat) ex.push('Thermostat / programmateur fil pilote inclus. Le sèche-serviette des salles de bain est géré à part (conseil SDB).');
  return ex;
}

// Export Node (tests / drift-check). Sans effet dans le navigateur (globales classiques).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEMPS_PARAMS, PEINTURE_PARAMS, potsPourLitres, quantitesPeinture,
    SOLS_PARAMS, ISOLATION_PARAMS, dimensionnementIsolation, explicationsIsolation,
    CARRELAGE_PARAMS, TABLEAU_PARAMS, CHAUFFAGE_PARAMS,
    explicationsTableau, explicationsVMC, explicationsPlomberie, explicationsChauffage
  };
}
