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

  // LOT40 P2 — MATRICE DOCUMENTAIRE annexe × métier (INTENTIONS, PAS des masques).
  // Elle décrit l'USAGE ACTUEL connu d'une annexe : quels métiers sont « pertinents »
  // et lesquels sont « conditionnels ». En P2, AUCUN conditionnel n'est masqué :
  // tant qu'aucune donnée fiable d'usage/état per-pièce n'existe (piece.projet.* est
  // dormant et toujours null), on n'exclut QUE les métiers manifestement hors contexte
  // — ce que fait déjà la règle extérieure. Cette table est donc purement indicative
  // et servira de base au futur enrichissement (quand un vrai état/usage existera).
  // NE PAS transformer ces « conditionnels » en false : l'API reste booléenne et sûre.
  var MATRICE_ANNEXE = {
    garage:  { pertinents: ['electricite', 'sols', 'menuiserie'],
               conditionnels: ['plomberie', 'peinture', 'carrelage', 'isolation', 'vmc', 'chauffage'] },
    cave:    { pertinents: ['electricite', 'sols', 'vmc'],
               conditionnels: ['plomberie', 'peinture', 'carrelage', 'isolation', 'menuiserie', 'chauffage'] },
    grenier: { pertinents: ['isolation', 'menuiserie'],
               conditionnels: ['electricite', 'plomberie', 'peinture', 'sols', 'carrelage', 'vmc', 'chauffage'] }
  };

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
  // Défaut SÛR = applicable. Seul l'EXTÉRIEUR masque un sous-ensemble (P1, inchangé).
  //   logement -> tous applicables ;
  //   annexe   -> tous applicables en P2 (la MATRICE_ANNEXE reste documentaire :
  //               aucun « conditionnel » n'est masqué faute de donnée d'usage fiable) ;
  //   catégorie indéterminée (ex. véranda = null) -> défaut sûr, tous applicables.
  // N'accède JAMAIS à piece.projet.* (dormant/null) ; ne simule aucune transformation.
  // `chantier` fait partie du contrat (contexte) ; non exploité ici.
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
    MATRICE_ANNEXE: MATRICE_ANNEXE, // documentaire (intentions métier) — n'altère pas les booléens
    estMetierApplicable: estMetierApplicable,
    metiersApplicables: metiersApplicables
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ApplicabiliteMetiers = API; // exposition navigateur (non branchée à l'UI ici)
})(typeof globalThis !== 'undefined' ? globalThis : this);
