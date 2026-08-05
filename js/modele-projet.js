// =====================================================================
// js/modele-projet.js — Modèle Projet / Dossier DSBAT (MISSION A08)
// =====================================================================
// RÔLE : matérialiser le CONTRAT officiel « dsbat.projet » (cf.
//   docs/Architecture/schema-projet-dsbat.schema.json). Un Projet DSBAT est
//   la SOURCE DE VÉRITÉ partagée par le configurateur, la future API, le
//   mobile, les franchisés, les sauvegardes et les imports/exports.
//
// CE QUE CE MODULE FAIT (uniquement) :
//   • ASSEMBLER un objet Projet conforme au contrat (structure + versions) ;
//   • le LIRE depuis l'app existante (projetDepuisApp) SANS rien modifier ;
//   • le SÉRIALISER / DÉSÉRIALISER de façon stable (sauvegarde, transport) ;
//   • calculer une EMPREINTE d'entrée pour la reproductibilité.
//
// CE QUE CE MODULE NE FAIT JAMAIS (Constitution P3, P6, P7, P16, P17) :
//   • calculer un prix ou une quantité (c'est le Moteur) ;
//   • décider l'application d'une règle (c'est le Moteur de Décision) ;
//   • modifier une connaissance (c'est le Référentiel via le Port) ;
//   • toucher au DOM, aux globales ou au devis (assemblage en lecture seule).
//
// ADDITIF & RÉVERSIBLE : ce fichier n'est branché nulle part dans le
//   configurateur. L'inclure ou non ne change AUCUN comportement. Il prépare
//   A09 (Orchestrateur) et A10 (API) en offrant un contenant standard.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION_CONTRAT = '1.0.0';

  // Versions par défaut des briques. Source unique : à terme lues du Port /
  // du Référentiel. Aujourd'hui le savoir V1.5 n'est pas versionné (Port : v0).
  var VERSIONS_DEFAUT = {
    contrat: VERSION_CONTRAT,
    referentiel: 'v0',      // aligné sur le Port (META_V15 : origine V1.5)
    moteur: 'V2-phase2',    // état de migration courant
    regles: 'v0',
    cataloguePrix: 'v0'     // identifiant de version, JAMAIS les prix (P3)
  };

  // ------------------------------------------------------------------
  // Utilitaires purs (aucun effet de bord)
  // ------------------------------------------------------------------
  function clone(x) {
    if (x === null || typeof x !== 'object') return x;
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; }
  }
  // Gel PROFOND : un projet validé est immuable à tous les niveaux (gouvernance).
  function figerProfond(o) {
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) { figerProfond(o[k]); });
      Object.freeze(o);
    }
    return o;
  }
  // Sérialisation STABLE : clés triées → sortie déterministe (sauvegarde/diff/empreinte).
  function trierProfond(v) {
    if (Array.isArray(v)) return v.map(trierProfond);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce(function (a, k) { a[k] = trierProfond(v[k]); return a; }, {});
    }
    return v;
  }
  // Empreinte déterministe simple (FNV-1a 32 bits, hex). Sans dépendance ;
  // suffit à détecter une divergence d'entrée. Remplaçable par SHA-256 côté API.
  function empreinte(obj) {
    var s = JSON.stringify(trierProfond(obj));
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // ------------------------------------------------------------------
  // Construction d'un Projet conforme au contrat
  // ------------------------------------------------------------------
  function creerProjetDSBAT(donnees) {
    donnees = donnees || {};
    var maintenant = (typeof donnees.horodatage === 'string') ? donnees.horodatage : null;
    var versions = Object.assign({}, VERSIONS_DEFAUT, donnees.versions || {});

    var chantier = clone(donnees.chantier) || {};
    var pieces = clone(donnees.pieces) || [];
    var metiers = clone(donnees.metiers) || [];

    var projet = {
      $contrat: 'dsbat.projet',
      versionContrat: VERSION_CONTRAT,
      identite: {
        id: donnees.id || null,
        reference: donnees.reference || null,
        statut: donnees.statut || 'brouillon',
        creeLe: (donnees.identite && donnees.identite.creeLe) || maintenant,
        modifieLe: (donnees.identite && donnees.identite.modifieLe) || null,
        valideLe: (donnees.identite && donnees.identite.valideLe) || null,
        auteur: (donnees.identite && donnees.identite.auteur) || null,
        franchise: donnees.franchise || (donnees.identite && donnees.identite.franchise) || null
      },
      client: clone(donnees.client) || null,
      chantier: chantier,
      metiers: metiers,
      pieces: pieces,
      decisions: clone(donnees.decisions) || null,
      resultats: clone(donnees.resultats) || null,
      journaux: clone(donnees.journaux) || [],
      references: clone(donnees.references) || null,
      versions: versions,
      metadonnees: clone(donnees.metadonnees) || { source: donnees.source || null, locale: 'fr-FR', devise: 'EUR', tags: [] },
      reproductibilite: null
    };

    // Bloc de reproductibilité : cliché de l'entrée + versions + empreinte.
    var entree = { chantier: clone(chantier), pieces: clone(pieces), metiers: clone(metiers) };
    projet.reproductibilite = {
      entree: entree,
      versions: clone(versions),
      empreinteEntree: empreinte({ entree: entree, versions: versions }),
      deterministe: true
    };
    return projet;
  }

  // ------------------------------------------------------------------
  // Lecture depuis l'app (adaptateur) — NE MODIFIE RIEN
  // ------------------------------------------------------------------
  // Lit les données du configurateur (globales) et retourne un Projet. Aucune
  // écriture, aucune globale touchée. `src` par défaut = portée globale.
  function projetDepuisApp(src) {
    src = src || global || {};
    function lire(f) { try { return f(); } catch (e) { return undefined; } }
    return creerProjetDSBAT({
      chantier: lire(function () { return src.chantier; }) || {},
      pieces: lire(function () { return src.piecesSelectionnees; }) || [],
      metiers: lire(function () { return src.metiersActifs; }) || [],
      source: 'configurateur-web'
    });
  }

  // Rattache des résultats déjà calculés (retour de calculerDevis) au Projet,
  // en RECOPIE — n'appelle aucun moteur, ne recalcule rien.
  function attacherResultats(projet, devis, parPiece, horodatage) {
    var p = clone(projet);
    p.resultats = {
      devis: clone(devis) || null,
      parPiece: clone(parPiece) || [],
      calculeLe: (typeof horodatage === 'string') ? horodatage : null,
      empreinte: empreinte({ devis: devis || null, parPiece: parPiece || [] }),
      fige: (p.identite && p.identite.statut === 'valide')
    };
    return p;
  }

  // ------------------------------------------------------------------
  // Gouvernance : validation (fige les résultats, immuables)
  // ------------------------------------------------------------------
  function validerProjet(projet, horodatage) {
    var p = clone(projet);
    p.identite.statut = 'valide';
    p.identite.valideLe = (typeof horodatage === 'string') ? horodatage : null;
    if (p.resultats) p.resultats.fige = true;
    return figerProfond(p);
  }

  // ------------------------------------------------------------------
  // Sérialisation / désérialisation stables (sauvegarde, transport)
  // ------------------------------------------------------------------
  function serialiser(projet) { return JSON.stringify(trierProfond(projet), null, 2); }
  function deserialiser(texte) {
    var o = (typeof texte === 'string') ? JSON.parse(texte) : texte;
    if (!o || o.$contrat !== 'dsbat.projet') throw new Error('Contrat invalide : $contrat attendu = "dsbat.projet".');
    return o;
  }

  // ------------------------------------------------------------------
  // Contrôle de conformité minimal (structure, pas de logique métier)
  // ------------------------------------------------------------------
  function conforme(projet) {
    var pb = [];
    if (!projet || typeof projet !== 'object') return { ok: false, problemes: ['projet absent'] };
    if (projet.$contrat !== 'dsbat.projet') pb.push('$contrat invalide');
    if (!/^\d+\.\d+\.\d+$/.test(projet.versionContrat || '')) pb.push('versionContrat non SemVer');
    if (!projet.identite || !projet.identite.statut) pb.push('identite.statut manquant');
    if (!Array.isArray(projet.metiers)) pb.push('metiers doit être un tableau');
    if (!Array.isArray(projet.pieces)) pb.push('pieces doit être un tableau');
    if (!projet.versions || !projet.versions.contrat) pb.push('versions.contrat manquant');
    return { ok: pb.length === 0, problemes: pb };
  }

  var API = {
    VERSION_CONTRAT: VERSION_CONTRAT,
    VERSIONS_DEFAUT: VERSIONS_DEFAUT,
    creerProjetDSBAT: creerProjetDSBAT,
    projetDepuisApp: projetDepuisApp,
    attacherResultats: attacherResultats,
    validerProjet: validerProjet,
    serialiser: serialiser,
    deserialiser: deserialiser,
    conforme: conforme,
    empreinte: empreinte
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  // Exposition navigateur (non branchée à l'UI ; disponible pour A09/A10).
  if (global) global.ModeleProjetDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
