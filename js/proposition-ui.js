// =====================================================================
// js/proposition-ui.js — Helpers PURS d'affichage des propositions M6 (AIC-001 / M6-B)
// =====================================================================
// Fonctions PURES (aucun DOM) pour l'étape « Modification proposée » :
//   • resumeAvantApres(prop) : normalise l'AVANT / APRÈS d'une proposition pour l'affichage ;
//   • sourcesTransformation(etat, cibleId) : liste des pièces présentes pouvant servir de
//     SOURCE de transformation (le client la choisit EXPLICITEMENT — aucune heuristique) ;
//   • echapperHtml(s) : échappement sûr du texte.
//
// Aucune logique de configuration (c'est M6 : js/proposition-config.js), aucun prix,
// aucune application. Affichage uniquement.
// =====================================================================

(function (global) {
  'use strict';

  function echapperHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\r\n|\r|\n/g, '<br>');
  }

  // Types de pièces présents (compteur > 0) pouvant être SOURCE d'une transformation.
  function sourcesTransformation(etat, cibleId) {
    var c = (etat && etat.compteurs) || {};
    return Object.keys(c)
      .filter(function (id) { return (c[id] || 0) > 0 && id !== cibleId; })
      .map(function (id) { return { id: id, count: c[id] }; });
  }

  // AVANT / APRÈS normalisés en tableaux [{cle, val}] pour un rendu uniforme.
  function resumeAvantApres(prop) {
    if (!prop) return { avant: [], apres: [] };
    if (prop.type === 'ajout_metier') {
      return { avant: [{ cle: prop.cible, val: 'non sélectionné' }], apres: [{ cle: prop.cible, val: 'sélectionné' }] };
    }
    if (prop.type === 'preference_gamme') {
      return { avant: [], apres: [] };
    }
    if (prop.type === 'transformation') {
      var av = [], ap = [];
      Object.keys(prop.avant || {}).forEach(function (k) { av.push({ cle: k, val: prop.avant[k] }); });
      Object.keys(prop.apres || {}).forEach(function (k) { ap.push({ cle: k, val: prop.apres[k] }); });
      return { avant: av, apres: ap };
    }
    // ajout_quantite / ajout_piece / reduction_quantite : avant/apres sont des nombres
    return { avant: [{ cle: prop.cible, val: prop.avant }], apres: [{ cle: prop.cible, val: prop.apres }] };
  }

  var API = { echapperHtml: echapperHtml, sourcesTransformation: sourcesTransformation, resumeAvantApres: resumeAvantApres };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.PropositionUIDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
