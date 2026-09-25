// =====================================================================
// js/choix-travaux.js — QUESTIONNAIRE DE CHOIX DE TRAVAUX (moteur, non branché)
// =====================================================================
// RÔLE : capturer les CHOIX / BESOINS du client entre « Mes pièces » et
//   « Configuration », dans une structure unique chantier.choixTravaux (v1).
//   Étape « déclaré/choisi » du parcours ; la « configuration » (compteurs
//   de prestations, gammes) et le calcul restent en aval, inchangés.
//
// INTERDICTIONS (contrat) : aucun prix, aucune quantité, aucune surface,
//   aucune longueur, aucun choix de produit, aucune règle normative, aucun
//   accès DOM, aucun moteur métier appelé. Module PUR, DÉTERMINISTE.
//
// SOURCE UNIQUE (règles verrouillées) :
//   • domotique / irve(=borneVE) / pv : source = chantier (saisis au funnel).
//     Le questionnaire les RÉFÉRENCE (lecture seule), il ne les re-saisit PAS.
//   • chauffageAuSol : source unique = choixTravaux.transverse (nouveau).
//   • volets motorisés : source unique = choixTravaux.transverse (nouveau).
//   • douche à l'italienne : besoin capté dans plomberie.parPiece ; le produit
//     (PLO_DOUCHE_ITAL) reste possédé par le moteur plomberie.
//   • acoustique : source unique = isolation.
//   • VMC : EXCLUE du questionnaire (contrat VMC figé, piloté à part).
//
// SÉPARATION : déclaré/choisi (ici) ≠ configuré (compteurs, gammes) ≠ calculé.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = 1;

  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }

  // ------------------------------------------------------------------
  // Adaptateur : étiquette « mission » -> code métier RÉEL du projet.
  // (Ce n'est PAS une seconde nomenclature : un seul code fait foi en aval.)
  // ------------------------------------------------------------------
  var ADAPTATEUR_METIER = {
    electricite: 'electricite',
    plomberie: 'plomberie',
    chauffage: 'chauffage',
    carrelageFaience: 'carrelage', // faïence = carrelage mural, même moteur
    sols: 'sols',
    peinture: 'peinture',
    menuiserie: 'menuiserie',
    isolation: 'isolation',
    placo: 'isolation'             // placo/cloisons/doublage : porté par isolation
  };

  // Métiers pilotés par le questionnaire (VMC volontairement absent).
  // chauffage EXCLU du questionnaire V1 : le besoin chauffage par pièce est déjà capté
  // canoniquement par piece.chauffageFonctions (existant/intention/solution) en phase 2,
  // et chauffage.js n'expose aucun « type d'émetteur ». Un champ ici serait sans consommateur
  // et ferait doublon. Le chauffage au sol (niveau logement) reste un transverse dédié.
  var METIERS_PILOTES = ['electricite', 'plomberie', 'carrelage', 'sols', 'peinture', 'menuiserie', 'isolation'];

  // Transverses RÉFÉRENCÉS (source = chantier, jamais re-saisis ici).
  var TRANSVERSE_REFERENCE = [
    { id: 'domotique', label: 'Domotique / Smart home', cleChantier: 'domotique' },
    { id: 'irve', label: 'Borne de recharge (IRVE)', cleChantier: 'borneVE' },
    { id: 'pv', label: 'Panneaux solaires', cleChantier: 'pv' }
  ];

  // Transverses NOUVEAUX (source unique = choixTravaux.transverse).
  var TRANSVERSE_NOUVEAU = [
    {
      id: 'chauffageAuSol', type: 'choix', label: 'Chauffage au sol ?',
      options: [{ v: 'non', l: 'Non' }, { v: 'partiel', l: 'Oui, certaines pièces' }, { v: 'complet', l: 'Oui, tout le logement' }]
    },
    // voletsMotorises : NOUVEAU. Aucune donnée canonique d'état de besoin n'existe pour la
    //   motorisation des volets — seulement des codes produit (ELEC_VOLET, MEN_VOLET_ROULANT) et
    //   des recommandations heuristiques. On capte donc ici le BESOIN déclaré ; les moteurs
    //   gardent les produits. (À l'inverse de domotique/irve/pv, qui sont RÉFÉRENCÉS.)
    {
      id: 'voletsMotorises', type: 'choix', label: 'Volets roulants motorisés ?',
      options: [{ v: 'non', l: 'Non' }, { v: 'partiel', l: 'Certaines pièces' }, { v: 'oui', l: 'Oui, partout' }]
    }
  ];

  // Ciblage UI (NON normatif) : pièces recevant les blocs « par pièce » d'eau.
  // Sert uniquement à savoir OÙ poser la question — pas à décider une réalité
  // technique (les moteurs restent seuls juges des quantités/produits).
  var PIECES_EAU = ['sdb', 'salle_bain', 'sde', 'salle_eau', 'wc', 'cuisine', 'buanderie', 'cellier'];
  var PIECES_CUISINE_BUANDERIE = ['cuisine', 'buanderie', 'cellier'];

  // ------------------------------------------------------------------
  // SPEC des questions par métier. Chaque entrée est un CHOIX/BESOIN,
  // jamais un produit ni une quantité. portee : 'metier' (une réponse pour
  // le lot) | 'piece' (une réponse par pièce éligible).
  // ------------------------------------------------------------------
  var oui_non = [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'a_voir', l: 'À voir' }];

  var SPEC_METIER = {
    electricite: {
      metier: [
        { id: 'niveauPrestation', type: 'choix', label: 'Niveau de prestation électrique souhaité', options: [{ v: 'essentiel', l: 'Essentiel' }, { v: 'confort', l: 'Confort' }, { v: 'haut', l: 'Haut de gamme' }] },
        { id: 'reseauVdi', type: 'choix', label: 'Réseau multimédia / VDI (RJ45) ?', options: oui_non }
      ]
    },
    plomberie: {
      parPiece: [
        { id: 'doucheItalienne', type: 'choix', label: 'Douche à l\'italienne ?', options: oui_non },
        { id: 'baignoire', type: 'choix', label: 'Baignoire ?', options: oui_non }
      ],
      // Bloc dédié cuisine / buanderie (parPiece ciblé cuisine/buanderie/cellier).
      cuisineBuanderie: [
        { id: 'evier', type: 'choix', label: 'Évier', options: [{ v: 'simple', l: '1 bac' }, { v: 'double', l: '2 bacs' }, { v: 'a_voir', l: 'À voir' }] },
        { id: 'laveLinge', type: 'choix', label: 'Arrivée / évacuation lave-linge ?', options: oui_non },
        { id: 'laveVaisselle', type: 'choix', label: 'Arrivée / évacuation lave-vaisselle ?', options: oui_non }
      ]
    },
    // chauffage : volontairement absent (voir METIERS_PILOTES). Source canonique = piece.chauffageFonctions.
    carrelage: {
      parPiece: [
        { id: 'sol', type: 'choix', label: 'Carrelage au sol ?', options: oui_non },
        { id: 'faience', type: 'choix', label: 'Faïence murale ?', options: oui_non }
      ]
    },
    sols: {
      parPiece: [
        { id: 'revetement', type: 'choix', label: 'Revêtement de sol souhaité', options: [{ v: 'parquet', l: 'Parquet' }, { v: 'stratifie', l: 'Stratifié' }, { v: 'souple', l: 'Sol souple' }, { v: 'a_voir', l: 'À voir' }] }
      ]
    },
    peinture: {
      metier: [
        { id: 'perimetre', type: 'choix', label: 'Périmètre peinture', options: [{ v: 'murs', l: 'Murs' }, { v: 'murs_plafonds', l: 'Murs + plafonds' }, { v: 'complet', l: 'Complet (murs, plafonds, boiseries)' }] }
      ]
    },
    menuiserie: {
      // NB : les volets motorisés sont TRANSVERSE (source unique) — absents ici.
      metier: [
        { id: 'fenetres', type: 'choix', label: 'Remplacement des fenêtres ?', options: oui_non },
        { id: 'portesInterieures', type: 'choix', label: 'Portes intérieures ?', options: oui_non }
      ]
    },
    isolation: {
      // isolation = aussi placo/cloisons + acoustique (source unique).
      metier: [
        { id: 'perimetre', type: 'choix', label: 'Isolation thermique', options: [{ v: 'murs', l: 'Murs' }, { v: 'combles', l: 'Combles' }, { v: 'sols', l: 'Sols' }, { v: 'complet', l: 'Complet' }, { v: 'non', l: 'Aucune' }] },
        { id: 'acoustique', type: 'choix', label: 'Isolation acoustique ?', options: oui_non },
        { id: 'cloisons', type: 'choix', label: 'Création / modification de cloisons (placo) ?', options: oui_non }
      ]
    }
  };

  // ------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------
  function clePiece(p) { return String(p && p.id) + '#' + String(p && (p.numero != null ? p.numero : 1)); }

  function codeMetier(x) { return ADAPTATEUR_METIER[x] || x; }

  function metiersRetenus(metiersActifs) {
    var actifs = Array.isArray(metiersActifs) ? metiersActifs : [];
    return METIERS_PILOTES.filter(function (m) { return actifs.indexOf(m) !== -1; });
  }

  function estPieceEau(p) { return PIECES_EAU.indexOf(String(p && p.id)) !== -1; }
  function estCuisineBuanderie(p) { return PIECES_CUISINE_BUANDERIE.indexOf(String(p && p.id)) !== -1; }

  // ------------------------------------------------------------------
  // choixTravauxVide() — squelette v1, toutes clés présentes, valeurs null.
  // ------------------------------------------------------------------
  function choixTravauxVide() {
    var t = {};
    TRANSVERSE_NOUVEAU.forEach(function (q) { t[q.id] = null; });
    return { version: VERSION, transverse: t, parMetier: {} };
  }

  // ------------------------------------------------------------------
  // initChoix(chantier, pieces, metiersActifs)
  //   Renvoie un choixTravaux complet (structure), en PRÉSERVANT les réponses
  //   déjà saisies dans chantier.choixTravaux (fusion non destructive).
  //   Ne saisit PAS domotique/irve/pv (référencés) ni la VMC.
  // ------------------------------------------------------------------
  function initChoix(chantier, pieces, metiersActifs) {
    var base = choixTravauxVide();
    var pcs = Array.isArray(pieces) ? pieces : [];
    var retenus = metiersRetenus(metiersActifs);

    retenus.forEach(function (m) {
      var spec = SPEC_METIER[m];
      if (!spec) return;
      var bloc = {};
      if (spec.metier) { bloc._metier = {}; spec.metier.forEach(function (q) { bloc._metier[q.id] = null; }); }
      if (spec.parPiece) {
        bloc.parPiece = {};
        pcs.forEach(function (p) {
          if (m === 'carrelage' || m === 'plomberie') { if (!estPieceEau(p)) return; }
          var k = clePiece(p); bloc.parPiece[k] = {};
          spec.parPiece.forEach(function (q) { bloc.parPiece[k][q.id] = null; });
        });
      }
      if (spec.cuisineBuanderie) {
        bloc.cuisineBuanderie = {};
        pcs.forEach(function (p) {
          if (!estCuisineBuanderie(p)) return;
          var k = clePiece(p); bloc.cuisineBuanderie[k] = {};
          spec.cuisineBuanderie.forEach(function (q) { bloc.cuisineBuanderie[k][q.id] = null; });
        });
      }
      base.parMetier[m] = bloc;
    });

    var existant = chantier && chantier.choixTravaux;
    return existant ? fusionner(base, existant) : base;
  }

  // ------------------------------------------------------------------
  // fusionner(base, patch) — fusion PURE, profonde, non destructive.
  //   Les valeurs non nulles de `patch` écrasent celles de `base` ; la
  //   version reste VERSION. Renvoie un NOUVEL objet.
  // ------------------------------------------------------------------
  function fusionner(base, patch) {
    var out = clone(base) || choixTravauxVide();
    if (!patch || typeof patch !== 'object') return out;
    out.version = VERSION;
    if (patch.transverse) {
      out.transverse = out.transverse || {};
      Object.keys(patch.transverse).forEach(function (k) {
        // On ne réintroduit JAMAIS un transverse référencé (domotique/irve/pv).
        if (TRANSVERSE_REFERENCE.some(function (r) { return r.id === k || r.cleChantier === k; })) return;
        var v = patch.transverse[k];
        if (v !== null && v !== undefined) out.transverse[k] = v;
      });
    }
    if (patch.parMetier) {
      out.parMetier = out.parMetier || {};
      Object.keys(patch.parMetier).forEach(function (m) {
        out.parMetier[m] = fusionProfonde(out.parMetier[m] || {}, patch.parMetier[m]);
      });
    }
    return out;
  }

  function fusionProfonde(a, b) {
    if (b === null || b === undefined) return a;
    if (typeof b !== 'object') return b;
    var out = (a && typeof a === 'object') ? clone(a) : {};
    Object.keys(b).forEach(function (k) {
      var vb = b[k];
      if (vb !== null && typeof vb === 'object' && !Array.isArray(vb)) out[k] = fusionProfonde(out[k] || {}, vb);
      else if (vb !== null && vb !== undefined) out[k] = vb;
    });
    return out;
  }

  // ------------------------------------------------------------------
  // construireQuestionnaire(chantier, pieces, metiersActifs)
  //   Description PURE de l'écran à rendre (l'UI ne décide rien). Dynamique
  //   selon métiers actifs + pièces réelles (piece.id). VMC exclue.
  // ------------------------------------------------------------------
  function construireQuestionnaire(chantier, pieces, metiersActifs) {
    var pcs = Array.isArray(pieces) ? pieces : [];
    var retenus = metiersRetenus(metiersActifs);

    var refs = TRANSVERSE_REFERENCE.map(function (r) {
      var val = chantier ? chantier[r.cleChantier] : null;
      return { id: r.id, label: r.label, source: 'chantier', cleChantier: r.cleChantier, valeur: (val == null ? null : val), lectureSeule: true };
    });

    var transverse = TRANSVERSE_NOUVEAU.map(function (q) {
      return { id: q.id, type: q.type, label: q.label, options: clone(q.options), source: 'choixTravaux', portee: 'logement' };
    });

    var metiers = retenus.map(function (m) {
      var spec = SPEC_METIER[m] || {};
      var section = { code: m, questions: [] };
      if (spec.metier) {
        spec.metier.forEach(function (q) {
          section.questions.push({ id: q.id, type: q.type, label: q.label, options: clone(q.options), portee: 'metier' });
        });
      }
      if (spec.parPiece) {
        var ciblePP = pcs.filter(function (p) { return (m === 'carrelage' || m === 'plomberie') ? estPieceEau(p) : true; });
        section.parPiece = { pieces: ciblePP.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id }; }), questions: spec.parPiece.map(function (q) { return { id: q.id, type: q.type, label: q.label, options: clone(q.options), portee: 'piece' }; }) };
      }
      if (spec.cuisineBuanderie) {
        var cibleCB = pcs.filter(estCuisineBuanderie);
        section.cuisineBuanderie = { pieces: cibleCB.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id }; }), questions: spec.cuisineBuanderie.map(function (q) { return { id: q.id, type: q.type, label: q.label, options: clone(q.options), portee: 'bloc' }; }) };
      }
      return section;
    });

    return { version: VERSION, referencesTransverse: refs, transverse: transverse, metiers: metiers };
  }

  // ------------------------------------------------------------------
  // projeter(chantier) — VUE normalisée LECTURE SEULE pour l'aval.
  //   Fusionne transverses nouveaux (choixTravaux) + référencés (chantier).
  //   NE CALCULE RIEN (ni quantité, ni produit, ni prix).
  // ------------------------------------------------------------------
  function projeter(chantier) {
    var ct = (chantier && chantier.choixTravaux) || choixTravauxVide();
    var transverse = {};
    TRANSVERSE_NOUVEAU.forEach(function (q) { transverse[q.id] = (ct.transverse && ct.transverse[q.id] != null) ? ct.transverse[q.id] : null; });
    TRANSVERSE_REFERENCE.forEach(function (r) { transverse[r.id] = (chantier && chantier[r.cleChantier] != null) ? chantier[r.cleChantier] : null; });
    return { version: VERSION, transverse: transverse, parMetier: clone(ct.parMetier) || {} };
  }

  // ------------------------------------------------------------------
  // verifierSourceUnique(chantier) — garde-fou : renvoie la liste des
  //   violations « seconde source ». [] = conforme. (Pour tests/garde-fou.)
  // ------------------------------------------------------------------
  function verifierSourceUnique(chantier) {
    var v = [];
    var ct = (chantier && chantier.choixTravaux) || null;
    if (!ct) return v;
    var t = ct.transverse || {};
    // Un transverse référencé ne doit JAMAIS être re-stocké dans choixTravaux.
    TRANSVERSE_REFERENCE.forEach(function (r) {
      if (Object.prototype.hasOwnProperty.call(t, r.id) || Object.prototype.hasOwnProperty.call(t, r.cleChantier)) {
        v.push('transverse « ' + r.id +' » dupliqué dans choixTravaux (source unique = chantier.' + r.cleChantier + ')');
      }
    });
    var pm = ct.parMetier || {};
    Object.keys(pm).forEach(function (m) {
      var s = JSON.stringify(pm[m] || {});
      // chauffageAuSol : source unique transverse.
      if (/chauffageAuSol/i.test(s)) v.push('« chauffageAuSol » présent dans parMetier.' + m + ' (source unique = transverse)');
      // acoustique : source unique isolation.
      if (m !== 'isolation' && /acoustique/i.test(s)) v.push('« acoustique » présent dans parMetier.' + m + ' (source unique = isolation)');
      // domotique/volets motorisés : jamais dans un métier.
      if (/domotique/i.test(s)) v.push('« domotique » présent dans parMetier.' + m + ' (source unique = chantier)');
      if (/voletsMotorises/i.test(s)) v.push('« voletsMotorises » présent dans parMetier.' + m + ' (source unique = transverse)');
      // douche italienne : uniquement plomberie.
      if (m !== 'plomberie' && /doucheItalienne/i.test(s)) v.push('« doucheItalienne » présent dans parMetier.' + m + ' (source = plomberie)');
    });
    return v;
  }

  var API = {
    VERSION: VERSION,
    ADAPTATEUR_METIER: ADAPTATEUR_METIER,
    METIERS_PILOTES: METIERS_PILOTES,
    TRANSVERSE_REFERENCE: TRANSVERSE_REFERENCE,
    TRANSVERSE_NOUVEAU: TRANSVERSE_NOUVEAU,
    choixTravauxVide: choixTravauxVide,
    clePiece: clePiece,
    codeMetier: codeMetier,
    initChoix: initChoix,
    fusionner: fusionner,
    construireQuestionnaire: construireQuestionnaire,
    projeter: projeter,
    verifierSourceUnique: verifierSourceUnique
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ChoixTravauxDSBAT = API; // exposé, NON branché à l'UI

})(typeof globalThis !== 'undefined' ? globalThis : this);
