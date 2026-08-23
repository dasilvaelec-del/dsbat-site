// =====================================================================
// js/prestation-mapping.js — Intention confirmée → prestations candidates (AIC-001 / M7-A)
// =====================================================================
// RÔLE : à partir d'un ÉLÉMENT CONFIRMÉ (M4/M5) et de la liste RÉELLE des
//   prestations d'une pièce (prestationsDispo, issue de getXPourPiece), proposer
//   des CANDIDATS de prestation. Rien de plus.
//
// GARANTIES (impératives) :
//   • AUCUN code inventé : tout `code` proposé provient EXCLUSIVEMENT de prestationsDispo.
//   • Le code n'est « retenu » qu'après validation client (M7-B) — ici tout est `a_valider`.
//   • AUCUNE quantité inventée : qteParDefaut = quantité EXPLICITE si connue, sinon null.
//   • Dépose/évacuation : candidat si correspondance NETTE avec un code du catalogue ;
//     sinon `aVerifierVisite` (« à vérifier en visite »). Jamais d'invention.
//   • Élément ambigu → aucun candidat forcé (versé dans `aTraiter`).
//   • Aucun match → `aucuneCorrespondance`.
//   • PUR : n'altère JAMAIS l'entrée, ne touche NI au DOM, NI à piecesSelectionnees/config,
//     NI aux prix, NI aux moteurs existants. Déterministe, sans IA, non branché.
//   • Détecteur injectable (options.matcher) pour une IA future sans changer le contrat.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  var STOP = { 'a': 1, 'à': 1, 'l': 1, 'le': 1, 'la': 1, 'les': 1, 'de': 1, 'des': 1, 'du': 1, 'un': 1, 'une': 1, 'en': 1, 'ou': 1, 'et': 1, 'au': 1, 'aux': 1, 'par': 1, 'pour': 1, 'sur': 1, 'avec': 1, 'sous': 1 };
  var RE_DEPOSE = /(depose|deposer|demol|evac|gravats|enlever|retirer|oter)/;

  function sansAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function norm(s) { return sansAccents(String(s == null ? '' : s).toLowerCase()).replace(/[’‘']/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function motsSignificatifs(s) {
    return norm(s).split(' ').filter(function (m) { return m && !STOP[m] && m.length >= 2; });
  }
  function contientMot(hayNorm, mot) {
    return new RegExp('(^|[^a-z0-9])' + mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(hayNorm);
  }
  function estDepose(prest) { return RE_DEPOSE.test(norm((prest.code || '') + ' ' + (prest.label || ''))); }

  // Score de correspondance entre un texte (partie d'intention) et un libellé de prestation :
  // nombre de mots significatifs du LIBELLÉ présents comme mots entiers dans le texte.
  function score(texteNorm, prest) {
    var mots = motsSignificatifs(prest.label);
    var n = 0;
    for (var i = 0; i < mots.length; i++) { if (contientMot(texteNorm, mots[i])) n++; }
    return n;
  }

  var ACTIONS_RETRAIT = { remplacement: 1, depose: 1, suppression: 1, demolition: 1 };

  // Matcher par défaut (par règles). Signature stable pour un futur matcher IA.
  // NB : M4 ne code pas une direction « ancien → nouveau » fiable ; on ne DEVINE donc
  // pas le sens. On propose tous les codes du catalogue qui correspondent nettement au
  // texte de l'intention (install = codes non-dépose, dépose = codes de dépose).
  // Le rôle exact (poser / déposer) et la sélection finale reviennent au client en M7-B.
  function matcherRegles(element, prestationsDispo, ctx) {
    var candidats = [], aVerifierVisite = [], seq = 0;
    var texteNorm = norm(element && element.element);
    var qte = (element && typeof element.quantite === 'number' && element.quantite > 0) ? element.quantite : null; // jamais inventée
    var srcRef = (element && element.id) || null;
    var srcExtrait = (element && element.source && element.source.extrait) || null;

    function ajouter(prest, depose, sc) {
      candidats.push({
        id: 'ca_' + (++seq),
        code: prest.code, label: prest.label || null, unite: prest.unite || null,
        metier: (element && element.metier) || null,
        qteParDefaut: qte,                          // quantité EXPLICITE ou null (donnée manquante)
        depose: !!depose,
        statut: 'a_valider',                        // acquis SEULEMENT après validation client (M7-B)
        confiance: sc >= 2 ? 'haute' : 'moyenne',
        source: { refElement: srcRef, extrait: srcExtrait }
      });
    }

    if (!texteNorm) return { candidats: candidats, aVerifierVisite: aVerifierVisite };

    // POSE → codes NON-dépose du catalogue qui correspondent au texte
    prestationsDispo.forEach(function (p) {
      if (estDepose(p)) return;
      var sc = score(texteNorm, p);
      if (sc >= 1) ajouter(p, false, sc);
    });
    // DÉPOSE → codes de dépose du catalogue qui correspondent au texte
    var deposeMatchee = false;
    prestationsDispo.forEach(function (p) {
      if (!estDepose(p)) return;
      var sc = score(texteNorm, p);
      if (sc >= 1) { ajouter(p, true, sc); deposeMatchee = true; }
    });
    // Action de retrait mais aucun code de dépose net dans le catalogue → à vérifier en visite
    if (ACTIONS_RETRAIT[element && element.action] && !deposeMatchee) {
      aVerifierVisite.push({
        raison: 'depose_sans_code',
        texte: 'Dépose évoquée (« ' + ((element && element.element) || '') + ' ») sans code catalogue clair pour cette pièce — à vérifier lors de la visite.',
        source: { refElement: srcRef, extrait: srcExtrait }
      });
    }
    return { candidats: candidats, aVerifierVisite: aVerifierVisite };
  }

  // ------------------------------------------------------------------
  // Point d'entrée
  //   element         : élément M4/M5 { metier, action, element(texte), quantite, statut, id, source }
  //   pieceId         : type de pièce concerné
  //   prestationsDispo: [{ code, label, unite }] — catalogue RÉEL de la pièce (getXPourPiece)
  //   options         : { matcher } — matcher alternatif (ex. IA) plus tard
  // Ne mute jamais l'entrée. Aucune application, aucun prix.
  // ------------------------------------------------------------------
  function proposerPrestations(element, pieceId, prestationsDispo, options) {
    options = options || {};
    element = element || {};
    var dispo = Array.isArray(prestationsDispo) ? prestationsDispo.slice() : [];
    var base = {
      $vue: 'dsbat.prestations-proposees', version: VERSION, pieceId: pieceId || null,
      candidats: [], aVerifierVisite: [], aTraiter: [], aucuneCorrespondance: true
    };

    // Élément ambigu → aucun candidat forcé, on le conserve « à traiter »
    if (element.statut === 'incertain') {
      base.aTraiter = [{ refElement: element.id || null, texte: (element.element != null ? String(element.element) : ''), raison: 'element_incertain' }];
      base.aucuneCorrespondance = false;
      return base;
    }

    var matcher = (typeof options.matcher === 'function') ? options.matcher : matcherRegles;
    var res = matcher(element, dispo, { pieceId: pieceId }) || { candidats: [], aVerifierVisite: [] };
    base.candidats = res.candidats || [];
    base.aVerifierVisite = res.aVerifierVisite || [];
    base.aucuneCorrespondance = (base.candidats.length === 0 && base.aVerifierVisite.length === 0 && base.aTraiter.length === 0);
    return base;
  }

  var API = { VERSION: VERSION, proposerPrestations: proposerPrestations, matcherRegles: matcherRegles };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.PrestationMappingDSBAT = API; // exposé, NON branché

})(typeof globalThis !== 'undefined' ? globalThis : this);
