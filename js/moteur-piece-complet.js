// =====================================================================
// js/moteur-piece-complet.js — Séquence complète de calcul par pièce (R06)
// =====================================================================
// RÔLE : nommer la SÉQUENCE de calcul par pièce déjà réalisée par recalcPiece,
//   pour qu'elle devienne un point d'aiguillage unique (historique / Runtime),
//   sur le modèle de calculerDevis en R05. Ce n'est PAS un moteur métier :
//   c'est une ORCHESTRATION de trois appels EXISTANTS, extraite VERBATIM de
//   recalcPiece — aucune règle, aucun calcul, aucun prix n'est modifié.
//
//   1) calculerPiece(piece, chantier, metiers)          → surfaces (1er passage)
//   2) si sols/carrelage : appliquerRevetements(...)     → quantités de revêtements
//   3) calculerPiece(piece, chantier, metiers)           → chiffrage final (retour R)
//
// La fonction MUTE la pièce (surfaces, config, totalHT, temps…) — exactement
//   comme aujourd'hui — et retourne l'objet de résultats R (pour l'affichage).
//
// Dépendances résolues à l'appel (portée globale partagée / injectées en Node) :
//   calculerPiece, appliquerRevetements, metiersActifs.
// =====================================================================

(function (global) {
  'use strict';

  function calculerPieceComplet(piece, chantier, metiers) {
    metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
    calculerPiece(piece, chantier, metiers);
    if (metiers.includes('sols') || metiers.includes('carrelage')) {
      appliquerRevetements(piece, piece.surfaces || { sol: 0, murs: 0, plafond: 0 }, metiers);
    }
    return calculerPiece(piece, chantier, metiers);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { calculerPieceComplet };
  if (global) global.calculerPieceComplet = calculerPieceComplet;

})(typeof globalThis !== 'undefined' ? globalThis : this);
