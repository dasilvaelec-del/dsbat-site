// =====================================================================
// js/confirmation-descriptif.js — Parcours de confirmation client (AIC-001 / M5, moteur)
// =====================================================================
// RÔLE : transformer les réponses du client (Oui / Non / Modifier) sur les
//   éléments interprétés par M4 en CONFIRMATIONS STRUCTURÉES. Rien de plus.
//
// SÉPARATION STRICTE (jamais confondue) :
//   DÉCLARÉ (contexte.declare)  ≠  INTERPRÉTÉ (M4)  ≠  CONFIRMÉ (ici)  ≠  CHIFFRABLE (hors M5)
//   M5 ne fait QUE : INTERPRÉTÉ → CONFIRMÉ.
//
// GARANTIES :
//   • L'interprétation M4 (entrée) n'est JAMAIS mutée ; chaque confirmation
//     embarque un SNAPSHOT IMMUABLE (`interpretationOriginale`, gelé).
//   • Une correction client est CONSERVÉE (interprétation + correction + valeur confirmée).
//   • AUCUN prix, AUCUNE quantité de devis, AUCUNE prestation, AUCUNE modification
//     de pièces / métiers / gammes / configuration. Module PUR, non branché.
//   • Statuts : 'confirme' | 'modifie' | 'refuse' (a_confirmer / incertain restent côté M4).
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }
  function figerProfond(o) {
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) { figerProfond(o[k]); });
      Object.freeze(o);
    }
    return o;
  }
  function normAction(a) { return String(a == null ? '' : a).toLowerCase().trim(); }

  // ------------------------------------------------------------------
  // construireConfirmations(interpretation, reponses, options)
  //   interpretation : sortie de M4 (elementsDetectes[], questionsAConfirmer[]) — LECTURE SEULE
  //   reponses       : { <id M4> : { action:'oui'|'non'|'modifier', texte? } }
  //   options        : { horodatage } (string) — injecté pour rester déterministe/testable
  // Retour : { $vue, version, confirmations[], enAttente[] }. Ne mute jamais l'entrée.
  // ------------------------------------------------------------------
  function construireConfirmations(interpretation, reponses, options) {
    options = options || {};
    reponses = reponses || {};
    var horodatage = (typeof options.horodatage === 'string') ? options.horodatage : null;

    var src = interpretation || {};
    var elements = Array.isArray(src.elementsDetectes) ? src.elementsDetectes : [];
    var questions = Array.isArray(src.questionsAConfirmer) ? src.questionsAConfirmer : [];

    // index par id, en distinguant élément / question (sans toucher aux objets d'origine)
    var parId = {};
    elements.forEach(function (e) { if (e && e.id) parId[e.id] = { type: 'element', obj: e }; });
    questions.forEach(function (qq) { if (qq && qq.id) parId[qq.id] = { type: 'question', obj: qq }; });

    var confirmations = [], seq = 0;

    Object.keys(reponses).forEach(function (refId) {
      var cible = parId[refId];
      if (!cible) return;                       // réponse orpheline (id inconnu) → ignorée
      var rep = reponses[refId] || {};
      var action = normAction(rep.action);

      // SNAPSHOT IMMUABLE de ce que M4 avait compris (jamais réécrit)
      var original = figerProfond(clone(cible.obj));

      var statut, reponseClient, valeurConfirmee;
      if (action === 'oui' || action === 'confirmer' || action === 'confirme') {
        statut = 'confirme';
        reponseClient = 'oui';
        // élément : la valeur confirmée = l'intention comprise ; question : prise en compte demandée
        valeurConfirmee = (cible.type === 'element')
          ? (original.element != null ? original.element : null)
          : { priseEnCompte: true, question: (original.texte != null ? original.texte : null) };
      } else if (action === 'non' || action === 'refuser' || action === 'refuse') {
        statut = 'refuse';
        reponseClient = 'non';
        valeurConfirmee = null;               // refusé → ne deviendra jamais une prestation
      } else if (action === 'modifier' || action === 'modifie') {
        statut = 'modifie';
        reponseClient = (rep.texte != null ? String(rep.texte) : '');
        valeurConfirmee = reponseClient;       // la correction devient la valeur confirmée
      } else {
        return;                                // action inconnue → aucune confirmation créée
      }

      confirmations.push({
        id: 'cf_' + (++seq),
        refElement: refId,
        type: cible.type,                      // 'element' | 'question'
        statut: statut,                        // 'confirme' | 'modifie' | 'refuse'
        interpretationOriginale: original,     // immuable (gelé)
        reponseClient: reponseClient,          // 'oui' | 'non' | texte de correction
        valeurConfirmee: valeurConfirmee,      // intention / correction / null
        horodatage: horodatage
      });
    });

    // Trace : éléments interprétés encore SANS réponse (restent a_confirmer / incertain côté M4)
    var enAttente = elements.filter(function (e) { return e && e.id && !reponses[e.id]; })
      .map(function (e) { return { ref: e.id, statut: e.statut, element: e.element }; });

    return {
      $vue: 'dsbat.confirmations',
      version: VERSION,
      confirmations: confirmations,
      enAttente: enAttente
      // NB : aucune donnée de configuration / prix / quantité de devis ici (hors M5).
    };
  }

  var API = { VERSION: VERSION, construireConfirmations: construireConfirmations };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ConfirmationDescriptifDSBAT = API; // exposé, NON branché à l'UI

})(typeof globalThis !== 'undefined' ? globalThis : this);
