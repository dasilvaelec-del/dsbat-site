// =====================================================================
// js/prestation-ui.js — Helpers PURS de l'étape « Prestations à retenir » (AIC-001 / M7-B)
// =====================================================================
// Fonctions PURES (aucun DOM, aucun prix, aucune écriture de config) :
//   • instancesDePiece(pieceId, pieces)  : instances RÉELLES d'un type de pièce
//     (pour le choix EXPLICITE de l'instance par le client) ;
//   • etatDoublon(piece, metier, code)   : le code existe-t-il déjà dans piece.config ?
//     (pour proposer Remplacer / Additionner / Conserver — jamais d'écrasement silencieux) ;
//   • resoudreDoublon(mode, actuelle, nouvelle) : quantité résultante selon le choix client ;
//   • echapperHtml(s).
//
// Ne calcule aucun prix, n'écrit rien, ne devine aucun rôle. La sélection (prestation,
// instance, quantité, pose/dépose) et l'application restent pilotées par le client (glue DOM).
// =====================================================================

(function (global) {
  'use strict';

  function echapperHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\r\n|\r|\n/g, '<br>');
  }

  // Instances présentes d'un type de pièce (pour la sélection explicite du client).
  function instancesDePiece(pieceId, pieces) {
    pieces = Array.isArray(pieces) ? pieces : [];
    var out = [];
    pieces.forEach(function (p, idx) {
      if (p && p.id === pieceId) out.push({ ref: p.id + '#' + p.numero, id: p.id, numero: p.numero, nom: p.nom || p.id, index: idx });
    });
    return out;
  }

  // Détection de doublon : le code est-il déjà présent (quantité > 0) dans piece.config[metier] ?
  function etatDoublon(piece, metier, code) {
    var cfg = (piece && piece.config && piece.config[metier]) || {};
    var q = cfg[code];
    return { existe: (typeof q === 'number' && q > 0), quantiteActuelle: (typeof q === 'number' ? q : 0) };
  }

  // Quantité résultante selon le choix du client (aucun défaut inventé).
  function resoudreDoublon(mode, actuelle, nouvelle) {
    actuelle = Number(actuelle) || 0;
    nouvelle = Number(nouvelle) || 0;
    if (mode === 'remplacer') return nouvelle;
    if (mode === 'additionner') return actuelle + nouvelle;
    if (mode === 'conserver') return actuelle;
    return null;
  }

  var API = { echapperHtml: echapperHtml, instancesDePiece: instancesDePiece, etatDoublon: etatDoublon, resoudreDoublon: resoudreDoublon };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.PrestationUIDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
