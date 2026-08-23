// =====================================================================
// js/contexte-projet.js — Contexte Projet DSBAT (AIC-001 / M2)
// =====================================================================
// RÔLE : offrir une VUE DÉRIVÉE, en LECTURE SEULE, des données que le
//   configurateur possède déjà (chantier + pièces + métiers). Elle regroupe
//   et rend accessibles ces informations pour les futurs usages :
//   contrôles de cohérence, moteurs métier, assistants, IA, module démolition.
//
// PRINCIPES (non négociables) :
//   • VUE DÉRIVÉE, PAS une 2e source de vérité : rien n'est stocké, rien n'est
//     réécrit ; le contexte est reconstruit à la demande à partir des données
//     existantes (comme ModeleProjetDSBAT.projetDepuisApp).
//   • DISTINCTION STRICTE : `declare` (saisi par le client) ≠ `calcule` (dérivé
//     des pièces) ≠ `deduit` (classifications). Jamais confondus.
//   • AUCUN CALCUL DE PRIX / QUANTITÉ MÉTIER : ce module ne chiffre rien,
//     ne dimensionne rien, ne touche ni au DOM, ni aux globales, ni au devis.
//   • INERTE & RÉVERSIBLE : n'est branché à AUCUN consommateur. L'inclure ou
//     non ne change AUCUN comportement du configurateur.
//
// CE MODULE NE FAIT PAS (documenté comme points à traiter ensuite) :
//   • transporter le descriptif libre (`description`) — non disponible ici ;
//   • inventer les seuils des profils rénovation / logistique (non validés) ;
//   • alimenter incoherences / recommandations (branchement ultérieur) ;
//   • combler les autres données manquantes (année exacte, contraintes
//     cumulables, « pièce principale » explicite…). Cf. `_pointsAtraiter`.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION_VUE = '0.1.0';

  // Catégories de pièces — REFLET des catégories déjà présentes dans le code
  // (PIECES_DEF de devis-configurateur.html et rôles de js/moteurs/vmc.js).
  // Constantes de CLASSIFICATION (pas de prix, pas de règle métier). À terme,
  // à lire depuis une source unique (cf. _pointsAtraiter).
  var TYPES_PRINCIPALES = ['salon', 'salle_manger', 'chambre', 'bureau'];
  var TYPES_HUMIDES     = ['sdb', 'sde', 'wc', 'cuisine', 'cave'];
  var TYPES_EXTERIEUR   = ['terrasse', 'jardin', 'facade', 'carport'];

  // ------------------------------------------------------------------
  // Utilitaires purs
  // ------------------------------------------------------------------
  function nombre(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function surfaceSol(p) { var d = (p && p.dims) || {}; return nombre(d.l) * nombre(d.la); }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  // ------------------------------------------------------------------
  // Extraction des entrées — accepte :
  //   • { chantier, pieces, metiers }
  //   • un Projet dsbat.projet (utilise .chantier/.pieces/.metiers)
  //   • rien → lit la portée globale (chantier / piecesSelectionnees / metiersActifs)
  // NE MODIFIE JAMAIS la source. Renvoie des références de lecture.
  // ------------------------------------------------------------------
  function extraireEntree(entree) {
    var src = entree || {};
    if (src && src.$contrat === 'dsbat.projet') {
      return { chantier: src.chantier || {}, pieces: src.pieces || [], metiers: src.metiers || [] };
    }
    if (entree && (entree.chantier || entree.pieces || entree.metiers)) {
      return { chantier: entree.chantier || {}, pieces: entree.pieces || [], metiers: entree.metiers || [] };
    }
    function lire(f) { try { return f(); } catch (e) { return undefined; } }
    return {
      chantier: lire(function () { return global.chantier; }) || {},
      pieces: lire(function () { return global.piecesSelectionnees; }) || [],
      metiers: lire(function () { return global.metiersActifs; }) || []
    };
  }

  // ------------------------------------------------------------------
  // Construction du Contexte Projet (vue dérivée, lecture seule)
  // ------------------------------------------------------------------
  function construireContexte(entree, options) {
    options = options || {};
    var e = extraireEntree(entree);
    var ch = e.chantier || {};
    var pieces = Array.isArray(e.pieces) ? e.pieces : [];
    var metiers = Array.isArray(e.metiers) ? e.metiers : [];

    // ---------- DÉCLARÉ (saisi par le client — écho de référence, jamais recalculé) ----------
    var nbPiecesDeclare = parseInt(ch.pieces, 10);
    var declare = {
      typeBien: ch.typeBien || null,
      typeLogement: ch.typeLogement || null,
      typologie: (!isNaN(nbPiecesDeclare) && nbPiecesDeclare > 0) ? ('T' + nbPiecesDeclare) : null,
      nbPiecesPrincipalesDeclare: (!isNaN(nbPiecesDeclare)) ? nbPiecesDeclare : null,
      surfaceTotaleDeclaree: ch.surface != null && ch.surface !== '' ? nombre(ch.surface) : null,
      metiersActifs: metiers.slice(),
      // AIC-001/M3 : descriptif libre du client — DONNÉE DÉCLARÉE, conservée telle quelle
      // (jamais calculée / déduite / confirmée / recommandée ; aucune interprétation).
      description: (ch.description != null ? String(ch.description) : null),
      // échos bruts du questionnaire (référence — le futur Contexte les expose sans les recalculer)
      questionnaire: {
        ageBati: ch.ageBati || null, etatLieux: ch.etatLieux || null, typeProjet: ch.typeProjet || null,
        hauteurPlafond: ch.hauteurPlafond || null, accessibilite: ch.accessibilite || null,
        accessSup: ch.accessSup || null, chauffage: ch.chauffage || null, vmc: ch.vmc || null,
        eauChaude: ch.eauChaude || null, tableauExistant: ch.tableauExistant || null,
        borneVE: ch.borneVE || null, pv: ch.pv || null, domotique: ch.domotique || null,
        qualiteMateriaux: ch.qualiteMateriaux || null, codePostal: ch.codePostal || null, ville: ch.ville || null
      }
    };

    // ---------- CALCULÉ (dérivé mécanique des pièces — distinct du déclaré) ----------
    var nbParType = {};
    var piecesVue = pieces.map(function (p) {
      var id = p && p.id;
      nbParType[id] = (nbParType[id] || 0) + 1;
      return {
        id: id, numero: p && p.numero, nom: p && p.nom,
        surfaceSol: Math.round(surfaceSol(p) * 100) / 100,
        dims: (p && p.dims) || null,
        metiersConfigures: p && p.config ? Object.keys(p.config).filter(function (k) {
          var v = p.config[k]; return v && (typeof v === 'object' ? Object.keys(v).length > 0 : true);
        }) : []
      };
    });
    var surfaceConfiguree = Math.round(pieces.reduce(function (s, p) { return s + surfaceSol(p); }, 0) * 100) / 100;

    var ecartSurface = null;
    var D = declare.surfaceTotaleDeclaree;
    if (D && D > 0 && surfaceConfiguree > 0) {
      var diff = surfaceConfiguree - D;                 // signé (<0 sous, >0 sur)
      var pct = Math.round(Math.abs(diff) / D * 100);
      ecartSurface = {
        m2: Math.round(diff * 100) / 100,
        pourcentage: pct,
        sens: pct === 0 ? 'egal' : (diff < 0 ? 'sous' : 'sur')
      };
    }

    var calcule = {
      nbInstancesPieces: pieces.length,
      nbPiecesParType: nbParType,
      surfaceConfiguree: surfaceConfiguree,
      ecartSurface: ecartSurface,     // rappel : donnée CALCULÉE, distincte de la surface DÉCLARÉE
      pieces: piecesVue
    };

    // ---------- DÉDUIT (classifications mécaniques reflétant le code — pas de seuil métier) ----------
    var idsPresents = uniq(pieces.map(function (p) { return p && p.id; }));
    var deduit = {
      piecesPrincipalesPresentes: idsPresents.filter(function (id) { return TYPES_PRINCIPALES.indexOf(id) !== -1; }),
      piecesHumidesPresentes: idsPresents.filter(function (id) { return TYPES_HUMIDES.indexOf(id) !== -1; }),
      exterieursPresents: idsPresents.filter(function (id) { return TYPES_EXTERIEUR.indexOf(id) !== -1; }),
      aExterieur: idsPresents.some(function (id) { return TYPES_EXTERIEUR.indexOf(id) !== -1; }),
      // Profils à SEUILS NON VALIDÉS → null (documentés, jamais inventés ici)
      profilRenovation: null,
      profilLogistique: null
    };

    // ---------- Emplacements RÉSERVÉS (non branchés en M2 — alimentés par les consommateurs ensuite) ----------
    // Laissés vides volontairement : aucun consommateur n'est branché dans cette mission.
    var contexte = {
      $vue: 'dsbat.contexte',
      version: VERSION_VUE,
      genereLe: (typeof options.horodatage === 'string') ? options.horodatage : null,

      declare: declare,
      calcule: calcule,
      deduit: deduit,

      confirme: {},           // déductions validées par le client (à venir)
      incoherences: [],       // source future : verifierCoherenceGlobale (js/coherence.js)
      recommandations: [],    // source future : RecoEngine / contrôles « oublis »
      hypotheses: [],          // propositions non confirmées (chauffage/ECS/VMC/extérieurs…)
      aVerifierVisite: [],     // points « inconnu » / écarts à contrôler en visite
      confiance: {},           // niveau de confiance par bloc, quand pertinent

      // Données manquantes / à traiter dans de futures missions (NON traitées ici) :
      _pointsAtraiter: [
        'Descriptif libre (description) non transporté vers le configurateur (à re-transporter ultérieurement).',
        'Année exacte de construction absente (seul ageBati par tranches).',
        'Attribut « pièce principale » implicite : déduit ici par classification, pas porté par les données.',
        'Contraintes cumulables : accessSup est mono-valeur.',
        'Profils rénovation / logistique : seuils non validés → non calculés (null).',
        'Alignement préconfiguration T5/T6 (2 salles de bain/eau) à traiter.',
        'incoherences / recommandations : à brancher sur les moteurs existants (lecture seule) plus tard.',
        'Constantes de classification (principales/humides/extérieur) à unifier avec PIECES_DEF / vmc.js.'
      ]
    };

    return contexte;
  }

  var API = {
    VERSION_VUE: VERSION_VUE,
    TYPES_PRINCIPALES: TYPES_PRINCIPALES,
    TYPES_HUMIDES: TYPES_HUMIDES,
    TYPES_EXTERIEUR: TYPES_EXTERIEUR,
    construireContexte: construireContexte
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  // Exposition navigateur (NON branchée à l'UI ; disponible pour de futurs consommateurs).
  if (global) global.ContexteProjetDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
