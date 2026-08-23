// =====================================================================
// js/proposition-config.js — Confirmé → Proposition de configuration (AIC-001 / M6, moteur)
// =====================================================================
// RÔLE : transformer des CONFIRMATIONS client (M5) en PROPOSITIONS de modification
//   de la CONFIGURATION du projet (compteurs de pièces + métiers), avec un
//   diff AVANT/APRÈS. Ne fait QUE : CONFIRMÉ → (proposition) → CONFIGURÉ.
//
// SÉPARATION DES 4 NIVEAUX : déclaré ≠ interprété (M4) ≠ confirmé (M5) ≠ configuré (ici).
//
// INTERDICTIONS (M6) : aucun prix, aucune prestation, aucune quantité métier,
//   aucune gamme appliquée, aucun moteur métier, aucun Runtime, aucun accès DOM.
//   Module PUR, DÉTERMINISTE, NON BRANCHÉ.
//
// RÈGLES VALIDÉES :
//   • Aucune application automatique : chaque proposition est `statut:'a_valider'`.
//   • Transformations et réductions UNIQUEMENT pilotées par des paramètres fournis
//     par le client (source explicite) — AUCUNE heuristique, AUCUNE déduction de
//     pièce source.
//   • appliquerProposition() est PUR : il ne modifie AUCUNE donnée existante ;
//     il renvoie un NOUVEL état { compteurs, metiersActifs }.
//   • Dimensions jamais inventées : une pièce ajoutée porte `necessiteDimensions:true`.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }
  function ab(a, va, b, vb) { var o = {}; o[a] = va; o[b] = vb; return o; }

  // ------------------------------------------------------------------
  // construirePropositions(interpretation, confirmations, etat)
  //   interpretation : sortie M4 { elementsDetectes[], questionsAConfirmer[] }
  //   confirmations  : sortie M5 (objet {confirmations:[]}) ou tableau [{refElement,statut}]
  //   etat           : { compteurs:{id:n}, metiersActifs:[ids] } (LECTURE SEULE)
  // Renvoie { propositions[] } — auto-dérivables uniquement (quantité / pièce absente /
  //   métier absent / préférence gamme). Ni transformation ni réduction ici (pilotées client).
  // ------------------------------------------------------------------
  function construirePropositions(interpretation, confirmations, etat) {
    interpretation = interpretation || {}; etat = etat || {};
    var compteurs = etat.compteurs || {};
    var metiers = etat.metiersActifs || [];
    var elements = Array.isArray(interpretation.elementsDetectes) ? interpretation.elementsDetectes : [];
    var questions = Array.isArray(interpretation.questionsAConfirmer) ? interpretation.questionsAConfirmer : [];
    var liste = Array.isArray(confirmations) ? confirmations : ((confirmations && confirmations.confirmations) || []);

    var confirmes = {};
    liste.forEach(function (c) { if (c && c.statut === 'confirme' && c.refElement) confirmes[c.refElement] = true; });
    var qParRef = {};
    questions.forEach(function (q) { if (q && q.ref) qParRef[q.ref] = q; });
    function estConfirme(e) { if (confirmes[e.id]) return true; var q = qParRef[e.id]; return !!(q && confirmes[q.id]); }

    var props = [], seq = 0, parPiece = {}, metiersVus = {};

    elements.forEach(function (e) {
      if (!estConfirme(e)) return;
      // --- Pièces (quantité / ajout) ---
      var pid = e.pieceId;
      if (pid) {
        var cur = compteurs[pid] || 0;
        var Q = (typeof e.quantite === 'number' && e.quantite > 0) ? e.quantite : null;
        var prop = null;
        if (Q !== null && Q > cur) {
          prop = { type: 'ajout_quantite', cible: pid, avant: cur, apres: Q };
        } else if (cur === 0) {
          prop = { type: 'ajout_piece', cible: pid, avant: 0, apres: 1 };
        }
        if (prop) {
          var ex = parPiece[pid];
          if (!ex || prop.apres > ex.apres) {
            prop.id = 'pr_' + (++seq);
            prop.refConfirmation = e.id;
            prop.delta = prop.apres - prop.avant;
            prop.actions = [{ kind: 'compteur', id: pid, delta: prop.apres - prop.avant }];
            prop.necessiteDimensions = true; // nouvelle(s) instance(s) → cotes à saisir, jamais inventées
            prop.statut = 'a_valider';
            prop.source = { refElement: e.id, extrait: (e.source && e.source.extrait) || null };
            prop.texte = 'Votre configuration contient ' + prop.avant + ' « ' + pid + ' ». La demande confirmée en prévoit ' +
              prop.apres + '. Ajouter ' + prop.delta + ' « ' + pid + ' » ?';
            parPiece[pid] = prop;
          }
        }
      }
      // --- Métier absent ---
      if (e.metier && metiers.indexOf(e.metier) === -1 && !metiersVus[e.metier]) {
        metiersVus[e.metier] = true;
        props.push({
          id: 'pr_' + (++seq), type: 'ajout_metier', cible: e.metier, refConfirmation: e.id,
          avant: false, apres: true, delta: null,
          actions: [{ kind: 'metier', id: e.metier, op: 'add' }],
          necessiteDimensions: false, statut: 'a_valider',
          source: { refElement: e.id },
          texte: 'Le métier « ' + e.metier + ' » n\'est pas sélectionné. L\'ajouter au projet ? (aucun prix calculé à ce stade)'
        });
      }
    });
    Object.keys(parPiece).forEach(function (k) { props.push(parPiece[k]); });

    // --- Préférence de gamme (jamais appliquée : conservée pour plus tard) ---
    questions.forEach(function (q) {
      if (q && q.type === 'gamme_a_clarifier' && confirmes[q.id]) {
        props.push({
          id: 'pr_' + (++seq), type: 'preference_gamme', cible: null, refConfirmation: q.id,
          avant: null, apres: null, delta: null, actions: [], necessiteDimensions: false,
          statut: 'a_valider', source: { refElement: q.id },
          texte: 'Préférence de gamme conservée comme donnée du projet — à préciser par poste ultérieurement. Aucune gamme appliquée automatiquement.'
        });
      }
    });

    return { $vue: 'dsbat.propositions', version: VERSION, propositions: props };
  }

  // ------------------------------------------------------------------
  // Builders PILOTÉS CLIENT (source explicite, jamais devinée)
  // ------------------------------------------------------------------
  function construireTransformation(sourceId, cibleId, etat) {
    etat = etat || {}; var c = etat.compteurs || {};
    var s = c[sourceId] || 0, t = c[cibleId] || 0;
    var applicable = !!sourceId && !!cibleId && sourceId !== cibleId && s >= 1;
    return {
      id: 'tr_1', type: 'transformation', source: sourceId, cible: cibleId,
      avant: ab(sourceId, s, cibleId, t),
      apres: ab(sourceId, applicable ? s - 1 : s, cibleId, applicable ? t + 1 : t),
      actions: applicable ? [{ kind: 'compteur', id: sourceId, delta: -1 }, { kind: 'compteur', id: cibleId, delta: 1 }] : [],
      necessiteDimensions: true, applicable: applicable,
      raison: applicable ? null : 'aucune pièce source « ' + sourceId + ' » à transformer',
      statut: 'a_valider',
      texte: applicable
        ? ('Transformer 1 « ' + sourceId + ' » en « ' + cibleId + ' » : ' + sourceId + ' ' + s + '→' + (s - 1) + ', ' + cibleId + ' ' + t + '→' + (t + 1) + '.')
        : ('Transformation impossible : aucune « ' + sourceId + ' » à transformer.')
    };
  }

  function construireReduction(pieceId, nouvelleQte, etat) {
    etat = etat || {}; var c = etat.compteurs || {};
    var cur = c[pieceId] || 0;
    var nq = Math.max(0, parseInt(nouvelleQte, 10) || 0);
    var applicable = !!pieceId && nq < cur;
    return {
      id: 'rd_1', type: 'reduction_quantite', cible: pieceId,
      avant: cur, apres: applicable ? nq : cur, delta: applicable ? (nq - cur) : 0,
      actions: applicable ? [{ kind: 'compteur', id: pieceId, delta: nq - cur }] : [],
      necessiteDimensions: false, applicable: applicable,
      raison: applicable ? null : 'la nouvelle quantité doit être inférieure à l\'actuelle (' + cur + ')',
      statut: 'a_valider',
      texte: applicable ? ('Réduire « ' + pieceId + ' » de ' + cur + ' à ' + nq + '.') : ('Aucune réduction : quantité demandée ≥ actuelle.')
    };
  }

  // ------------------------------------------------------------------
  // appliquerProposition(proposition, etat) — PUR : renvoie un NOUVEL état.
  //   Ne modifie AUCUNE donnée existante (compteurs/metiersActifs clonés).
  //   Ne touche NI aux pièces (piecesSelectionnees), NI aux prix, NI au DOM.
  // ------------------------------------------------------------------
  function appliquerProposition(proposition, etat) {
    etat = etat || {};
    var compteurs = Object.assign({}, etat.compteurs || {});
    var metiers = (etat.metiersActifs || []).slice();
    var actions = (proposition && proposition.actions) || [];
    actions.forEach(function (a) {
      if (a.kind === 'compteur') { compteurs[a.id] = Math.max(0, (compteurs[a.id] || 0) + (a.delta || 0)); }
      else if (a.kind === 'metier') {
        if (a.op === 'add') { if (metiers.indexOf(a.id) === -1) metiers.push(a.id); }
        else if (a.op === 'remove') { metiers = metiers.filter(function (m) { return m !== a.id; }); }
      }
    });
    return { compteurs: compteurs, metiersActifs: metiers };
  }

  // Inverse d'une proposition (pour annulation symétrique des compteurs / métiers).
  function inverser(proposition) {
    var p = clone(proposition);
    p.actions = ((p && p.actions) || []).map(function (a) {
      if (a.kind === 'compteur') return { kind: 'compteur', id: a.id, delta: -(a.delta || 0) };
      if (a.kind === 'metier') return { kind: 'metier', id: a.id, op: (a.op === 'add' ? 'remove' : 'add') };
      return a;
    });
    return p;
  }

  // Entrée de journal (traçabilité) — pure, aucune persistance ici.
  function journaliser(proposition, decision, avantEtat, apresEtat, horodatage) {
    proposition = proposition || {};
    return {
      refConfirmation: proposition.refConfirmation || null,
      propositionId: proposition.id || null,
      type: proposition.type || null,
      decision: decision || null,
      avant: (avantEtat != null) ? clone(avantEtat) : null,
      apres: (apresEtat != null) ? clone(apresEtat) : null,
      horodatage: (typeof horodatage === 'string') ? horodatage : null
    };
  }

  var API = {
    VERSION: VERSION,
    construirePropositions: construirePropositions,
    construireTransformation: construireTransformation,
    construireReduction: construireReduction,
    appliquerProposition: appliquerProposition,
    inverser: inverser,
    journaliser: journaliser
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.PropositionConfigDSBAT = API; // exposé, NON branché à l'UI

})(typeof globalThis !== 'undefined' ? globalThis : this);
