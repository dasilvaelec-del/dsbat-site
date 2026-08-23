// =====================================================================
// js/interpretation-descriptif.js — Interprétation du descriptif libre (AIC-001 / M4)
// =====================================================================
// RÔLE : LIRE le texte libre du client (chantier.description / contexte.declare.description)
//   et le STRUCTURER en INTENTIONS À CONFIRMER. Rien de plus.
//
// SÉPARATION STRICTE DES 4 NIVEAUX (jamais confondus) :
//   1. DÉCLARÉ    : le texte du client (source, jamais modifié)
//   2. INTERPRÉTÉ : ce que DSBAT comprend   → statut 'a_confirmer' / 'incertain'
//   3. CONFIRMÉ   : validé par le client     → `confirmations` (TOUJOURS vide en M4)
//   4. CHIFFRABLE : hors M4
//
// INTERDICTIONS (M4) : aucun prix, aucune quantité de devis, aucune prestation,
//   aucune pièce ajoutée/supprimée, aucun métier activé, aucune gamme appliquée,
//   aucun moteur/Runtime touché. Module PUR, DÉTERMINISTE, SANS IA, NON BRANCHÉ.
//
// EXTENSIBILITÉ IA : le détecteur est injectable (options.detecteur). Par défaut =
//   détecteur par RÈGLES (dictionnaires). Un détecteur IA pourra être fourni plus
//   tard SANS changer le contrat de sortie. Aucun service externe branché ici.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  // ------------------------------------------------------------------
  // Normalisation : minuscules, sans accents, apostrophes → espaces
  // ------------------------------------------------------------------
  function sansAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function normFull(s) {
    return sansAccents(String(s == null ? '' : s).toLowerCase())
      .replace(/[’‘']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Présence d'un mot/expression avec frontières (évite les faux positifs type "porte" dans "important")
  function contient(hay, needle) {
    var esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)').test(hay);
  }

  // ------------------------------------------------------------------
  // Dictionnaires (aiguillage lexical — pas de règle de prix)
  // Besoins : needles normalisés (sans accent, apostrophes = espaces)
  // ------------------------------------------------------------------
  var PIECES = [
    { id: 'sdb', label: 'salle de bain', mots: ['salle de bain', 'salles de bain', 'sdb'] },
    { id: 'sde', label: "salle d'eau", mots: ['salle d eau', 'salles d eau'] },
    { id: 'wc', label: 'WC', mots: ['wc', 'toilette', 'toilettes'] },
    { id: 'cuisine', label: 'cuisine', mots: ['cuisine', 'cuisines'] },
    { id: 'salon', label: 'salon / séjour', mots: ['salon', 'sejour', 'salle a manger', 'piece de vie'] },
    { id: 'chambre', label: 'chambre', mots: ['chambre', 'chambres'] },
    { id: 'bureau', label: 'bureau', mots: ['bureau'] },
    { id: 'dressing', label: 'dressing', mots: ['dressing'] },
    { id: 'entree', label: 'entrée', mots: ['entree', 'hall'] },
    { id: 'couloir', label: 'couloir', mots: ['couloir', 'degagement'] },
    { id: 'escalier', label: 'escalier', mots: ['escalier'] },
    { id: 'cave', label: 'cave / buanderie', mots: ['cave', 'buanderie'] },
    { id: 'veranda', label: 'véranda', mots: ['veranda'] },
    { id: 'garage', label: 'garage', mots: ['garage'] },
    { id: 'terrasse', label: 'terrasse', mots: ['terrasse'] },
    { id: 'jardin', label: 'jardin / allée', mots: ['jardin', 'allee'] },
    { id: 'facade', label: 'façade', mots: ['facade'] },
    { id: 'carport', label: 'carport', mots: ['carport'] }
  ];

  var METIERS = [
    { id: 'electricite', label: 'électricité', mots: ['electricite', 'elec', 'tableau electrique', 'prise', 'prises', 'interrupteur', 'va et vient'] },
    { id: 'plomberie', label: 'plomberie', mots: ['plomberie', 'plombier', 'sanitaire', 'sanitaires', 'robinet', 'robinetterie', 'evier', 'lavabo', 'vasque', 'baignoire', 'douche', 'chauffe eau'] },
    { id: 'vmc', label: 'VMC', mots: ['vmc', 'ventilation', 'extraction'] },
    { id: 'peinture', label: 'peinture', mots: ['peinture', 'peindre', 'repeindre', 'repeint', 'enduit'] },
    { id: 'sols', label: 'revêtement de sol', mots: ['parquet', 'stratifie', 'vinyle', 'moquette', 'lino', 'sol souple'] },
    { id: 'carrelage', label: 'carrelage / faïence', mots: ['carrelage', 'faience', 'carreaux'] },
    { id: 'menuiserie', label: 'menuiserie', mots: ['menuiserie', 'porte', 'portes', 'fenetre', 'fenetres', 'placard', 'baie'] },
    { id: 'isolation', label: 'isolation / plâtrerie', mots: ['isolation', 'placo', 'ba13', 'cloison', 'platrerie', 'doublage'] }
  ];

  var ACTIONS = [
    { id: 'remplacement', mots: ['remplacer', 'remplace', 'remplacement', 'changer', 'change'] },
    { id: 'depose', mots: ['enlever', 'enleve', 'retirer', 'retire', 'deposer', 'depose', 'oter', 'demonter'] },
    { id: 'suppression', mots: ['supprimer', 'supprime'] },
    { id: 'demolition', mots: ['casser', 'demolir', 'abattre', 'demolition'] },
    { id: 'installation', mots: ['installer', 'poser', 'mettre', 'ajouter', 'creer', 'monter', 'equiper'] },
    { id: 'renovation', mots: ['renover', 'refaire', 'refait', 'renovation', 'renove'] },
    { id: 'deplacement', mots: ['deplacer', 'bouger'] },
    { id: 'conservation', mots: ['conserver', 'garder', 'laisser'] },
    { id: 'modification', mots: ['modifier', 'modifie', 'transformer', 'transforme'] }
  ];

  var EQUIPEMENTS = [
    { mot: 'douche a l italienne', label: "douche à l'italienne", metier: 'plomberie' },
    { mot: 'douche italienne', label: "douche à l'italienne", metier: 'plomberie' },
    { mot: 'baignoire', label: 'baignoire', metier: 'plomberie' },
    { mot: 'douche', label: 'douche', metier: 'plomberie' },
    { mot: 'lavabo', label: 'lavabo', metier: 'plomberie' },
    { mot: 'vasque', label: 'vasque', metier: 'plomberie' },
    { mot: 'evier', label: 'évier', metier: 'plomberie' },
    { mot: 'wc', label: 'WC', metier: 'plomberie' },
    { mot: 'chaudiere', label: 'chaudière', metier: null, chauffage: true },
    { mot: 'chauffe eau', label: 'chauffe-eau', metier: 'plomberie', chauffage: true },
    { mot: 'ballon', label: "ballon d'eau chaude", metier: 'plomberie', chauffage: true },
    { mot: 'radiateur', label: 'radiateur', metier: null, chauffage: true },
    { mot: 'carrelage', label: 'carrelage', metier: 'carrelage' },
    { mot: 'faience', label: 'faïence', metier: 'carrelage' },
    { mot: 'parquet', label: 'parquet', metier: 'sols' },
    { mot: 'tableau electrique', label: 'tableau électrique', metier: 'electricite' }
  ];

  var GAMMES = [
    { id: 'premium', label: 'haut de gamme', mots: ['haut de gamme', 'premium', 'luxe', 'luxueux'] },
    { id: 'standard', label: 'standard', mots: ['standard', 'basique', 'entree de gamme', 'milieu de gamme'] },
    { id: 'eco', label: 'économique', mots: ['economique', 'pas cher', 'premier prix'] }
  ];
  var GAMME_GLOBAL = ['partout', 'tout', 'toute la maison', 'dans tout', 'en general'];

  var NB_MOTS = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 };
  var AMBIGU = ['peut etre', 'je pense', 'plus tard', 'eventuellement', 'si possible', 'probablement', 'envisage', 'envisager', 'a voir', 'pourquoi pas', 'reflechis'];

  // ------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------
  function detecterQuantite(n) {
    for (var w in NB_MOTS) { if (contient(n, w)) return NB_MOTS[w]; }
    var m = n.match(/(^|[^0-9])([2-9])([^0-9]|$)/); // 1 (un/une) ignoré : article, non significatif
    return m ? parseInt(m[2], 10) : null;
  }
  function trouver(dico, n, champMots) {
    var out = [];
    for (var i = 0; i < dico.length; i++) {
      var mots = dico[i][champMots || 'mots'];
      for (var j = 0; j < mots.length; j++) { if (contient(n, mots[j])) { out.push(dico[i]); break; } }
    }
    return out;
  }
  function trouverEquip(n) {
    var out = [];
    for (var i = 0; i < EQUIPEMENTS.length; i++) { if (contient(n, EQUIPEMENTS[i].mot)) out.push(EQUIPEMENTS[i]); }
    // retire les labels inclus dans un autre (ex. « douche » si « douche à l'italienne » présent)
    return out.filter(function (e) {
      return !out.some(function (o) { return o !== e && o.label.indexOf(e.label) !== -1 && o.label !== e.label; });
    });
  }
  function decouper(t) {
    // phrases → propositions (sur « et » et « , »)
    var phrases = String(t).split(/[.;!?\n]+/);
    var res = [];
    phrases.forEach(function (ph) {
      ph.split(/\s+et\s+|,/i).forEach(function (c) { var s = c.trim(); if (s) res.push(s); });
    });
    return res;
  }

  // ------------------------------------------------------------------
  // Détecteur par RÈGLES (par défaut). Signature stable pour un futur détecteur IA.
  // ------------------------------------------------------------------
  function detecteurRegles(texteOriginal, ctx) {
    var piecesPresentes = ctx.piecesPresentes || []; // tableau d'ids (une entrée par instance)
    var metiersActifs = ctx.metiersActifs || [];
    var clauses = decouper(texteOriginal);

    var elements = [], seq = 0;
    var dernierePiece = null, dernierMetier = null, dernierEquip = null; // héritage intra-texte

    clauses.forEach(function (clause) {
      var n = normFull(clause);
      var amb = AMBIGU.some(function (a) { return contient(n, a); });
      var pieces = trouver(PIECES, n);
      var metiersMots = trouver(METIERS, n);
      var actions = trouver(ACTIONS, n);
      var equips = trouverEquip(n);
      var gammes = trouver(GAMMES, n);
      var q = detecterQuantite(n);

      // héritage : si une proposition n'a pas de pièce/équipement mais suit une qui en avait
      var piece = pieces.length ? pieces[0] : (equips.length || actions.length ? dernierePiece : null);
      var metier = metiersMots.length ? metiersMots[0]
        : (equips.length && equips[0].metier ? { id: equips[0].metier } : (actions.length ? dernierMetier : null));
      var equipsEff = equips.length ? equips : ((actions.length && dernierEquip) ? [dernierEquip] : []);

      if (pieces.length) dernierePiece = pieces[0];
      if (metiersMots.length) dernierMetier = metiersMots[0];
      else if (equips.length && equips[0].metier) dernierMetier = { id: equips[0].metier };
      if (equips.length) dernierEquip = equips[0];

      var aDuSens = actions.length || equips.length || metiersMots.length || gammes.length || (pieces.length && q);
      if (!aDuSens) return;

      var equipLabels = equipsEff.map(function (e) { return e.label; });
      var neuf = contient(n, 'nouveau') || contient(n, 'neuf') || contient(n, 'nouvelle');
      var actionId = actions.length ? actions[0].id : null;
      var elementTxt;
      if (actionId === 'remplacement' && equipLabels.length >= 2) elementTxt = equipLabels[0] + ' → ' + equipLabels.slice(1).join(', ');
      else if (equipLabels.length) elementTxt = (neuf ? 'nouveau ' : '') + equipLabels.join(', ');
      else if (pieces.length) elementTxt = 'travaux : ' + pieces.map(function (p) { return p.label; }).join(', ');
      else elementTxt = clause.trim();

      elements.push({
        id: 'el_' + (++seq),
        source: { type: 'description_client', texte: texteOriginal, extrait: clause.trim() },
        piece: piece ? (piece.label || null) : null,
        pieceId: piece ? (piece.id || null) : null,
        metier: metier ? metier.id : null,
        action: actionId,
        element: elementTxt,
        quantite: (q != null ? q : null),          // jamais inventé : null si absent
        statut: amb ? 'incertain' : 'a_confirmer',  // JAMAIS 'confirme'
        confiance: amb ? 'faible' : (actions.length && (equips.length || pieces.length) ? 'haute' : 'moyenne'),
        _gammes: gammes.map(function (g) { return g.id; }),
        _chauffage: equipsEff.some(function (e) { return e.chauffage; }),
        _actions: actions.map(function (a) { return a.id; })
      });
    });

    // ---------- Questions à confirmer (jamais d'action automatique) ----------
    var questions = [], qseq = 0;
    function pushQ(type, texte, ref) { questions.push({ id: 'q_' + (++qseq), type: type, texte: texte, ref: ref || null }); }

    // §4 métier détecté mais non sélectionné
    var metiersDetectes = uniq(elements.map(function (e) { return e.metier; }).filter(Boolean));
    metiersDetectes.forEach(function (mid) {
      if (metiersActifs.indexOf(mid) === -1) {
        var lbl = (labelMetier(mid) || mid);
        pushQ('metier_non_selectionne', 'Le descriptif mentionne « ' + lbl + ' » alors que ce corps de métier n\'a pas été sélectionné. Souhaitez-vous le prendre en compte ?');
      }
    });
    // §5 pièce mentionnée absente de la configuration
    var piecesDetectees = uniq(elements.map(function (e) { return e.pieceId; }).filter(Boolean));
    piecesDetectees.forEach(function (pid) {
      if (piecesPresentes.indexOf(pid) === -1) {
        pushQ('piece_absente', 'Le descriptif mentionne « ' + labelPiece(pid) + ' », non présent(e) dans la configuration. Souhaitez-vous l\'ajouter / la configurer ?');
      }
    });
    // §6 quantité détectée > quantité configurée
    elements.forEach(function (e) {
      if (e.quantite && e.pieceId) {
        var nbConfig = piecesPresentes.filter(function (x) { return x === e.pieceId; }).length;
        if (nbConfig < e.quantite) {
          pushQ('quantite_divergente', 'Le descriptif évoque ' + e.quantite + ' « ' + (e.piece || labelPiece(e.pieceId)) + ' » ; la configuration en contient ' + nbConfig + '. Confirmer la quantité ?', e.id);
        }
      }
    });
    // §9 préférence de gamme (globale) → à clarifier par poste
    var nAll = normFull(texteOriginal);
    var gammeGlob = elements.some(function (e) { return e._gammes.length; }) && GAMME_GLOBAL.some(function (g) { return contient(nAll, g); });
    if (gammeGlob) {
      var gid = (elements.find(function (e) { return e._gammes.length; }) || {})._gammes[0];
      pushQ('gamme_a_clarifier', 'Préférence « ' + (labelGamme(gid) || 'gamme') + ' » exprimée globalement : à préciser par poste (électricité, plomberie, carrelage…). Les gammes sont choisies par métier.');
    }
    // §10 équipement de chauffage à remplacer/installer → question complémentaire (sans logique métier)
    if (elements.some(function (e) { return e._chauffage && (e._actions.indexOf('remplacement') !== -1 || e._actions.indexOf('installation') !== -1); })) {
      pushQ('info_complementaire', 'Remplacement / installation d\'un équipement de chauffage détecté : quel type de chauffage souhaitez-vous ? (à préciser — traité par le futur moteur métier)');
    }
    // §8 dépose / démolition détectée → évacuation potentielle (aucune quantité, aucun prix)
    if (elements.some(function (e) { return ['depose', 'demolition', 'suppression'].some(function (a) { return e._actions.indexOf(a) !== -1; }); })) {
      pushQ('depose_evacuation', 'Une dépose / évacuation sera peut-être nécessaire (à confirmer ; ni quantité ni prix calculés à ce stade).');
    }

    // ---------- Hypothèses (détections incertaines) ----------
    var hypotheses = elements.filter(function (e) { return e.statut === 'incertain'; })
      .map(function (e) { return { ref: e.id, texte: 'Intention incertaine : ' + e.element, confiance: e.confiance }; });

    // ---------- Demandes (regroupement lisible par pièce + métier) ----------
    var demandes = [];
    elements.forEach(function (e) {
      var cle = (e.pieceId || '-') + '|' + (e.metier || '-');
      var d = demandes.find(function (x) { return x._cle === cle; });
      if (!d) { d = { _cle: cle, piece: e.piece, metier: e.metier, resume: [], statut: e.statut }; demandes.push(d); }
      d.resume.push(e.element);
      if (e.statut === 'a_confirmer') d.statut = 'a_confirmer';
    });
    demandes.forEach(function (d) { d.resume = d.resume.join(' ; '); delete d._cle; });

    // nettoyage des champs internes des éléments
    elements.forEach(function (e) { delete e._gammes; delete e._chauffage; delete e._actions; });

    return {
      $vue: 'dsbat.interpretation',
      version: VERSION,
      source: { type: 'description_client', texte: texteOriginal },
      demandes: demandes,
      elementsDetectes: elements,
      questionsAConfirmer: questions,
      hypotheses: hypotheses,
      confirmations: [] // TOUJOURS vide en M4 (rempli par le futur parcours de confirmation client)
    };
  }

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function labelMetier(id) { var m = METIERS.find(function (x) { return x.id === id; }); return m ? m.label : id; }
  function labelPiece(id) { var p = PIECES.find(function (x) { return x.id === id; }); return p ? p.label : id; }
  function labelGamme(id) { var g = GAMMES.find(function (x) { return x.id === id; }); return g ? g.label : id; }

  // ------------------------------------------------------------------
  // Point d'entrée : interpréterDescriptif(texte, ctx, options)
  //   texte   : chaîne libre (ou contexte.declare.description)
  //   ctx     : { piecesPresentes:[ids], metiersActifs:[ids] } (lecture seule)
  //   options : { detecteur } — injection d'un détecteur alternatif (ex. IA, plus tard)
  // Ne modifie JAMAIS ctx ni la source. Aucun prix, aucune prestation.
  // ------------------------------------------------------------------
  function interpreterDescriptif(texte, ctx, options) {
    ctx = ctx || {}; options = options || {};
    var texteOriginal = (texte == null ? '' : String(texte));
    var base = {
      $vue: 'dsbat.interpretation', version: VERSION,
      source: { type: 'description_client', texte: texteOriginal },
      demandes: [], elementsDetectes: [], questionsAConfirmer: [], hypotheses: [], confirmations: []
    };
    if (!texteOriginal.trim()) return base; // texte vide → aucune interprétation, aucune erreur
    var detecteur = (typeof options.detecteur === 'function') ? options.detecteur : detecteurRegles;
    return detecteur(texteOriginal, {
      piecesPresentes: (ctx.piecesPresentes || []).slice(),
      metiersActifs: (ctx.metiersActifs || []).slice()
    });
  }

  var API = {
    VERSION: VERSION,
    interpreterDescriptif: interpreterDescriptif,
    detecteurRegles: detecteurRegles,
    // dictionnaires exposés en lecture (tests / futur réglage), non modifiés à l'exécution
    PIECES: PIECES, METIERS: METIERS, ACTIONS: ACTIONS, EQUIPEMENTS: EQUIPEMENTS, GAMMES: GAMMES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.InterpretationDescriptifDSBAT = API; // exposé, NON branché à l'UI

})(typeof globalThis !== 'undefined' ? globalThis : this);
