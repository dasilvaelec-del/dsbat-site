// =====================================================================
// js/confirmation-ui.js — Helpers PURS d'affichage de l'étape de confirmation (AIC-001 / M5-B)
// =====================================================================
// Fonctions PURES (aucun DOM) utilisées par l'étape « Voici ce que nous avons compris » :
//   • construireVueConfirmation(interp) : REGROUPE visuellement les éléments M4 par pièce,
//     mais garde CHAQUE élément indépendant (son propre id → sa propre réponse).
//   • idsConfirmation(interp) : liste des ids (éléments + questions) à interroger.
//   • echapperHtml(s) : échappement sûr du texte client (accents/apostrophes/retours ligne).
//
// NE contient AUCUNE logique de confirmation (c'est M5 : js/confirmation-descriptif.js),
// AUCUN calcul, AUCUN prix. Regroupement UNIQUEMENT visuel : la structure M4 n'est pas modifiée.
// =====================================================================

(function (global) {
  'use strict';

  var ACTION_LABELS = {
    remplacement: 'Remplacer', depose: 'Déposer / enlever', suppression: 'Supprimer',
    demolition: 'Démolir', installation: 'Installer / poser', renovation: 'Rénover / refaire',
    deplacement: 'Déplacer', conservation: 'Conserver', modification: 'Modifier'
  };

  function echapperHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\r\n|\r|\n/g, '<br>');
  }

  // Regroupe par pièce (repli métier, puis « autres »). Chaque élément conserve SON id.
  function construireVueConfirmation(interp) {
    interp = interp || {};
    var els = Array.isArray(interp.elementsDetectes) ? interp.elementsDetectes : [];
    var questions = Array.isArray(interp.questionsAConfirmer) ? interp.questionsAConfirmer : [];

    var map = {}, ordre = [];
    els.forEach(function (e) {
      var cle = e.pieceId || (e.metier ? ('metier:' + e.metier) : 'autres');
      if (!map[cle]) {
        map[cle] = { cle: cle, pieceId: (e.pieceId || null), titre: (e.piece || (e.metier || 'Autres demandes')), elements: [] };
        ordre.push(cle);
      }
      var verbe = e.action ? (ACTION_LABELS[e.action] || '') : '';
      var texte = (verbe ? verbe + ' : ' : '') + (e.element || '');
      map[cle].elements.push({ id: e.id, texte: texte, incertain: (e.statut === 'incertain') });
    });

    var groupes = ordre.map(function (c) { return map[c]; });
    var qs = questions.map(function (q) { return { id: q.id, texte: q.texte, type: q.type }; });
    return { groupes: groupes, questions: qs, vide: (els.length + questions.length) === 0 };
  }

  function idsConfirmation(interp) {
    interp = interp || {};
    var a = [];
    (interp.elementsDetectes || []).forEach(function (e) { if (e && e.id) a.push(e.id); });
    (interp.questionsAConfirmer || []).forEach(function (q) { if (q && q.id) a.push(q.id); });
    return a;
  }

  var API = {
    ACTION_LABELS: ACTION_LABELS,
    echapperHtml: echapperHtml,
    construireVueConfirmation: construireVueConfirmation,
    idsConfirmation: idsConfirmation
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ConfirmationUIDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
