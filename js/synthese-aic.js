// =====================================================================
// js/synthese-aic.js — Objet AIC (vue dérivée du parcours) — AIC-001 / M8
// =====================================================================
// RÔLE : assembler une VUE DÉRIVÉE, en LECTURE SEULE, du parcours AIC
//   (questionnaire → descriptif → interprétation → confirmation → configuration
//   → prestations), plus une catégorie structurée « À vérifier en visite ».
//
// GARANTIES (impératives) :
//   • PUR / DÉTERMINISTE : n'écrit rien, ne mute pas l'entrée, aucun DOM, aucun
//     sessionStorage, aucune modification de piecesSelectionnees / piece.config.
//   • AUCUN prix, AUCUN appel Runtime, AUCUN moteur, AUCUNE application de config.
//   • PAS de 2ᵉ source de vérité : agrège des données EXISTANTES passées en entrée.
//   • Ne fabrique aucune donnée : ce qui n'est pas fourni reste vide.
//   • SÉPARATION STRICTE : declare ≠ interprete ≠ confirme ≠ configure ≠ prestations
//     ≠ aVerifierVisite (jamais fusionnés).
//   • `genereLe` INJECTABLE (options.now) pour rester déterministe (pas de Date.now()).
//
// ENTRÉE (toutes clés optionnelles, extraites par l'appelant depuis les sources réelles) :
//   { chantier, interpretation:{elementsDetectes,questionsAConfirmer},
//     confirmations:{confirmations:[]}|[], piecesSelectionnees:[], metiersActifs:[],
//     modifications:[] (configModifsV1), prestationsDecisions:{} (configPrestationsV1),
//     alertesCoherence:[{niveau,texte}], deposeNotes:[] (notes M7-A optionnelles) }
//   options : { now: string|function, resolveLabel: fn(code)->label }
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';
  var SURFACIQUES = ['peinture', 'sols', 'carrelage', 'isolation']; // métiers dont le chiffrage dépend des surfaces
  var TYPES_PRESTATION_JOURNAL = { prestation: 1, depose_a_verifier: 1, prestation_annulee: 1 }; // à exclure de configure.modifications

  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }
  function arr(x) { return Array.isArray(x) ? x : []; }

  function construireAIC(input, options) {
    input = input || {}; options = options || {};
    var ch = input.chantier || {};
    var interp = input.interpretation || {};
    var confObj = input.confirmations;
    var confirmations = Array.isArray(confObj) ? confObj : arr(confObj && confObj.confirmations);
    var pieces = arr(input.piecesSelectionnees);
    var metiers = arr(input.metiersActifs);
    var modifications = arr(input.modifications);
    var prestDec = input.prestationsDecisions || {};
    var alertes = arr(input.alertesCoherence);
    var deposeNotes = arr(input.deposeNotes);
    var resolveLabel = (typeof options.resolveLabel === 'function') ? options.resolveLabel : function () { return null; };
    var genereLe = (typeof options.now === 'function') ? options.now() : (typeof options.now === 'string' ? options.now : null);

    // ---------- DÉCLARÉ (client) ----------
    var declare = {
      chantier: clone(ch) || {},
      description: (ch.description != null ? String(ch.description) : (input.description != null ? String(input.description) : ''))
    };

    // ---------- INTERPRÉTÉ (M4) ----------
    var interprete = {
      elements: arr(interp.elementsDetectes).map(clone),
      questions: arr(interp.questionsAConfirmer).map(clone)
    };

    // ---------- CONFIRMÉ (M5/M5-B) ----------
    var confirme = { decisions: confirmations.map(clone) };

    // ---------- CONFIGURÉ (M6/M6-B) ----------
    var configure = {
      pieces: pieces.map(function (p) {
        var d = p.dims || {};
        return {
          ref: (p.id != null ? p.id : '') + '#' + (p.numero != null ? p.numero : ''),
          type: p.id || null, nom: p.nom || null,
          dims: { l: d.l || 0, la: d.la || 0, h: (d.h != null ? d.h : null), fenetres: (d.fenetres != null ? d.fenetres : null), portes: (d.portes != null ? d.portes : null) },
          gammes: { elecMethode: p.elecMethode || null, elecGamme: p.elecGamme || null, ploGamme: p.ploGamme || null },
          metiersConfigures: p.config ? Object.keys(p.config).filter(function (k) {
            var v = p.config[k]; return v && (typeof v === 'object' ? Object.keys(v).length > 0 : true);
          }) : []
        };
      }),
      metiers: metiers.slice(),
      modifications: modifications.filter(function (m) { return m && !TYPES_PRESTATION_JOURNAL[m.type]; }).map(clone)
    };

    // ---------- PRESTATIONS RETENUES (M7) ----------
    var retenues = [];
    var deposeAppliqueeAVerifier = [];
    Object.keys(prestDec).sort().forEach(function (k) {
      if (k.indexOf('inst|') === 0) return;         // clé de choix d'instance, pas une prestation
      var e = prestDec[k]; if (!e) return;
      if (e.decision === 'appliquee') {
        retenues.push({ pieceRef: e.pieceRef || null, metier: e.metier || null, code: e.code || null, label: resolveLabel(e.code) || null, quantite: (e.quantite != null ? e.quantite : null), role: e.role || 'pose' });
      } else if (e.decision === 'a_verifier') {
        deposeAppliqueeAVerifier.push(e);           // dépose marquée par le client → à vérifier en visite
      }
    });
    var prestations = { retenues: retenues };

    // ---------- À VÉRIFIER EN VISITE (4 catégories, jamais mélangées) ----------
    var aVerifierVisite = [];
    function av(categorie, element, pourquoi, pieceRef, metier, source, impactDevis) {
      aVerifierVisite.push({ categorie: categorie, element: element, pourquoi: pourquoi, pieceRef: pieceRef || null, metier: metier || null, source: source, impactDevis: impactDevis });
    }
    // 1) depose_non_couverte — déposes marquées par le client (M7) + notes M7-A éventuelles
    deposeAppliqueeAVerifier.forEach(function (e) {
      av('depose_non_couverte', (resolveLabel(e.code) || e.code || 'dépose'), 'Dépose demandée sans code de pose chiffrable retenu — à confirmer et relever en visite', e.pieceRef || null, e.metier || null, 'prestation', 'Poste de dépose/évacuation non chiffré à ce stade');
    });
    deposeNotes.forEach(function (n) {
      av('depose_non_couverte', (n.element || n.texte || 'dépose'), (n.pourquoi || 'Dépose évoquée sans code catalogue clair — à vérifier en visite'), n.pieceRef || null, n.metier || null, (n.source || 'descriptif'), 'Poste de dépose/évacuation non chiffré à ce stade');
    });
    // 2) info_technique_inconnue — depuis le questionnaire (valeurs réelles)
    if (ch.tableauExistant === 'inconnu') av('info_technique_inconnue', 'Tableau électrique', 'État du tableau électrique déclaré « inconnu »', null, 'electricite', 'questionnaire', 'Décision remplacement/mise aux normes du tableau à confirmer');
    if (ch.chauffage === 'autre') av('info_technique_inconnue', 'Chauffage existant', 'Type de chauffage « autre » non précisé', null, null, 'questionnaire', 'Postes chauffage/électricité à préciser');
    if (ch.eauChaude === 'autre') av('info_technique_inconnue', 'Eau chaude sanitaire', 'ECS « autre » non précisée', null, null, 'questionnaire', 'Poste ECS à préciser');
    if (ch.vmc === 'defaillante') av('info_technique_inconnue', 'VMC existante', 'VMC signalée « défaillante »', null, 'vmc', 'questionnaire', 'Remplacement/reprise VMC à évaluer');
    // 3) dimension_manquante — UNIQUEMENT si un métier surfacique est actif (sinon non pertinent)
    var surfaciqueActif = metiers.some(function (m) { return SURFACIQUES.indexOf(m) !== -1; });
    if (surfaciqueActif) {
      pieces.forEach(function (p) {
        var d = p.dims || {};
        if (!d.l || !d.la) av('dimension_manquante', 'Dimensions manquantes', 'Cotes non renseignées alors qu\'un métier surfacique est actif (surfaces comptées à 0)', (p.id || '') + '#' + (p.numero != null ? p.numero : ''), null, 'configuration', 'Surfaces peinture/sols/carrelage/isolation non chiffrées');
      });
    }
    // 4) ecart_coherence — alertes de cohérence réelles (non résolues à ce stade)
    alertes.forEach(function (a) {
      if (a && a.texte) av('ecart_coherence', a.texte, 'Contrôle de cohérence non résolu (' + (a.niveau || 'info') + ')', null, null, 'configuration', 'Peut fausser le métré / le devis (non bloquant)');
    });

    return {
      $vue: 'dsbat.aic', version: VERSION, genereLe: genereLe,
      declare: declare,
      interprete: interprete,
      confirme: confirme,
      configure: configure,
      prestations: prestations,
      aVerifierVisite: aVerifierVisite
    };
  }

  var API = { VERSION: VERSION, SURFACIQUES: SURFACIQUES, construireAIC: construireAIC };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.SyntheseAICDSBAT = API; // exposé, NON branché

})(typeof globalThis !== 'undefined' ? globalThis : this);
