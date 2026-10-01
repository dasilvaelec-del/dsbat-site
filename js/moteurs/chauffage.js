// js/moteurs/chauffage.js — Moteur métier « chauffage » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function verifierChauffage(pieces, ch) {
  ch = ch || (typeof chantier !== 'undefined' ? chantier : {});
  const metiers = (typeof metiersActifs !== 'undefined') ? metiersActifs : [];
  const alertes = [];
  if (ch.chauffage !== 'electrique' || !metiers.includes('electricite') || typeof dimensionnementChauffage !== 'function') return alertes;
  const r = dimensionnementChauffage(pieces, ch);
  if (!r) {
    // chauffage électrique déclaré mais aucun radiateur dimensionné (pièces sans cotes ?)
    const aFilPilote = (pieces || []).some(p => { const e = (p.config && p.config.electricite) || {}; return (e.ELEC_SC20_FP || 0) + (e.ELEC_SC10_FP || 0) > 0; });
    if (aFilPilote) alertes.push({ niveau:'attention', texte: 'Chauffage électrique : des sorties fil pilote sont prévues mais aucun radiateur n\'a pu être dimensionné (dimensions de pièce manquantes ?).' });
    return alertes;
  }
  // Sorties fil pilote configurées insuffisantes par rapport aux radiateurs retenus
  if (r.sortiesConfigurees < r.nbSortiesFilPilote) {
    alertes.push({ niveau:'attention', texte: 'Chauffage : ' + r.nbRadiateurs + ' radiateur(s) retenu(s) mais ' + r.sortiesConfigurees + ' sortie(s) fil pilote configurée(s) — prévoir ' + r.nbSortiesFilPilote + ' raccordement(s) (1 par radiateur).' });
  }
  // Puissance installée nettement inférieure au besoin (sous-dimensionnement)
  if (r.puissanceInstallee < r.puissanceTotale * 0.95) {
    alertes.push({ niveau:'info', texte: 'Chauffage : puissance installée ' + r.puissanceInstallee + ' W pour un besoin de ' + r.puissanceTotale + ' W — vérifier le dimensionnement.' });
  }
  // Rappel cohérence circuits (info)
  if (r.nbCircuits > 0) {
    alertes.push({ niveau:'info', texte: 'Chauffage : ' + r.nbRadiateurs + ' radiateur(s) sur ' + r.nbCircuits + ' circuit(s) chauffage 20A du tableau (' + r.puissanceInstallee + ' W installés).' });
  }
  return alertes;
}


// LOT42 — Pont chauffage -> chiffrage (fonctions PURES : aucune écriture, aucun DOM, aucun prix).
// Source de vérité = piece.chauffageFonctions. Ne modifient ni la pièce ni chantier.chauffage.
function chauffageFonctionsUtilise(pieces) {
  return (pieces || []).some(function (p) {
    var f = p && p.chauffageFonctions;
    if (!f) return false;
    var act = f.intention && f.intention.action;
    var tech = f.solution && f.solution.technologie;
    return !!act || !!tech;
  });
}
// Ids des pièces chiffrables en V1 (radiateur électrique, travaux d'émetteur, non déjà devisées,
// dimensions exploitables). Sert à alimenter params.piecesChauffees du Runtime (prix.js inchangé).
function piecesChauffeesDepuisFonctions(pieces) {
  return (pieces || []).filter(function (p) {
    var f = p && p.chauffageFonctions;
    if (!f) return false;
    var s = f.solution || {}, i = f.intention || {}, d = p.dims || {};
    return s.technologie === 'radiateur_electrique'
      && (i.action === 'installer' || i.action === 'remplacer' || i.action === 'ajouter')
      && s.statut !== 'devis_existant'
      && (Number(d.l) > 0) && (Number(d.la) > 0);
  }).map(function (p) { return p.id; });
}

if (typeof module !== "undefined" && module.exports) module.exports = { verifierChauffage, chauffageFonctionsUtilise, piecesChauffeesDepuisFonctions };
