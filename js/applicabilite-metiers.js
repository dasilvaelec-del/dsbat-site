// =====================================================================
// js/applicabilite-metiers.js — LOT40 P1
// =====================================================================
// COUCHE D'APPLICABILITÉ MÉTIER (pure). Décide UNIQUEMENT si un métier est
// PROPOSÉ pour une pièce/zone dans son contexte. Chaîne cible :
//   PIÈCE/ZONE -> CONTEXTE -> APPLICABILITÉ (ici) -> MOTEUR MÉTIER -> PRESTATIONS
//
// CE MODULE :
//   • ne touche NI au DOM, NI au catalogue, NI aux prix ;
//   • ne connaît AUCUNE prestation ni règle technique (elles restent aux moteurs) ;
//   • n'ENCADRE PAS les moteurs : ils continuent de décider s'ils produisent
//     réellement des lignes (get<Metier>PourPiece(...).length > 0).
//
// SOURCE UNIQUE de la catégorie de surface = socle LOT39 :
//   piece.categorieSurface, sinon ModeleProjetDSBAT.categorieSurfacePiece(piece).
//   AUCUNE table de catégories n'est recopiée ici.
// =====================================================================
(function (global) {
  'use strict';

  // Vocabulaire FIGÉ : métiers existants uniquement (aucun nouveau métier).
  var METIERS = ['electricite', 'plomberie', 'peinture', 'sols', 'carrelage', 'isolation', 'menuiserie', 'vmc', 'chauffage'];

  // P1 : sur une surface EXTÉRIEURE, ces métiers n'ont pas de sens -> masqués
  // au niveau de la couche (les moteurs restent inchangés).
  var MASQUES_EXTERIEUR = ['peinture', 'sols', 'carrelage', 'vmc'];

  // Catégorie de surface d'une pièce — SANS dupliquer la table LOT39.
  function _categorie(piece) {
    var c = piece && piece.categorieSurface;
    if (c === undefined || c === null) {
      var M = (typeof ModeleProjetDSBAT !== 'undefined' && ModeleProjetDSBAT) ? ModeleProjetDSBAT : null;
      if (M && typeof M.categorieSurfacePiece === 'function') c = M.categorieSurfacePiece(piece);
    }
    return c;
  }

  // Un métier est-il applicable à une pièce dans son contexte ?
  // Défaut SÛR = applicable. En P1 : seul l'extérieur masque un sous-ensemble.
  //   logement / annexe / catégorie indéterminée -> comportement actuel conservé.
  // `chantier` fait partie du contrat (contexte) ; non exploité en P1.
  function estMetierApplicable(metier, piece, chantier) {
    if (_categorie(piece) === 'exterieur') {
      return MASQUES_EXTERIEUR.indexOf(metier) === -1;
    }
    return true;
  }

  // Sous-ensemble applicable d'une liste de métiers (ordre préservé).
  function metiersApplicables(piece, chantier, base) {
    var src = Array.isArray(base) ? base : METIERS;
    return src.filter(function (m) { return estMetierApplicable(m, piece, chantier); });
  }

  var API = {
    METIERS: METIERS,
    MASQUES_EXTERIEUR: MASQUES_EXTERIEUR,
    estMetierApplicable: estMetierApplicable,
    metiersApplicables: metiersApplicables
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ApplicabiliteMetiers = API; // exposition navigateur (non branchée à l'UI ici)
})(typeof globalThis !== 'undefined' ? globalThis : this);
