// =====================================================================
// js/vue-tarifaire.js — Vue tarifaire Runtime DSBAT (MISSION R08)
// =====================================================================
// RÔLE : produire, À PARTIR du catalogue complet (prix.js), une VUE TARIFAIRE
//   plate et minimale — uniquement les PRIX D'AFFICHAGE dont l'interface a besoin
//   — puis fournir des ACCESSEURS qui rejouent EXACTEMENT le comportement de
//   js/pricing.js (getPrixPrestFor / getMoyenPrixFor / tempsUnitaire /
//   findPrestLabel) SANS jamais toucher au catalogue.
//
// POURQUOI (protection du patrimoine) :
//   Aujourd'hui le navigateur charge prix.js (~1 190 lignes) pour AFFICHER des
//   prix. Il reçoit donc tout le savoir-faire : marges (COEF_FOURNITURE),
//   décomposition pose/appareillage (APPAREILLAGE), formules (prixElec,
//   prixPlomberie), dimensionnements, coefficients de zone… La VUE ne contient
//   QUE des montants d'affichage déjà résolus { min, max, temps, label }. Elle
//   suffit à l'écran et NE RÉVÈLE NI FORMULE NI MARGE. Le Runtime devient donc
//   l'unique détenteur du catalogue ; le client ne voit que des résultats.
//
// GARANTIES :
//   • PUR : aucun accès DOM, aucun effet de bord.
//   • Le builder est utilisé CÔTÉ RUNTIME (serveur) ; les accesseurs peuvent
//     tourner côté navigateur à partir de la seule vue (aucun prix.js requis).
//   • Aucune règle / aucun calcul / aucun prix modifié : on RELIT le catalogue
//     tel quel via les mêmes fonctions (prixElec / prixPlomberie).
//   • Parité prouvée par le Golden Master de la vue tarifaire (R08).
// =====================================================================

(function (global) {
  'use strict';

  // Domaines d'affichage bornés par l'interface (sélecteurs pièce) :
  //   méthode de pose élec, gamme appareillage élec, gamme sanitaire plomberie.
  var METHODES_ELEC = ['saillie', 'goulotte_enc', 'placo', 'saignee'];
  var GAMMES_ELEC   = ['dooxie', 'mosaic', 'celiane', 'etanche'];
  var GAMMES_PLO    = ['entree', 'standard', 'premium'];

  // Défauts EXACTS de js/pricing.js (getPrixPrestFor).
  var DEF_METHODE = 'saignee';
  var DEF_GAMME_ELEC = 'dooxie';
  var DEF_GAMME_PLO  = 'standard';

  function paire(p) { return p ? { min: p.min, max: p.max } : null; }

  // -------------------------------------------------------------------
  // construireVueTarifaire(catalogue)
  //   catalogue : { PRIX, prixElec, prixPlomberie } (issus de prix.js).
  //   → { version, genereLe, prestations: { CODE: entree } }
  //   entree (une seule forme selon la PRIORITÉ de getPrixPrestFor) :
  //     { label, unite, temps, type:'flat',       prix:{min,max}|null }
  //     { label, unite, temps, type:'elec',       elec:{ methode:{ gamme:{min,max}|null } } }
  //     { label, unite, temps, type:'plomberie',  plomberie:{ gamme:{min,max}|null } }
  //   La PRIORITÉ (renov > prix > pose+app > pose+four) est reproduite à
  //   l'identique pour que la classification soit rigoureusement la même.
  // -------------------------------------------------------------------
  function construireVueTarifaire(catalogue) {
    catalogue = catalogue || {};
    var PRIX = catalogue.PRIX || (global && global.PRIX);
    var prixElec = catalogue.prixElec || (global && global.prixElec);
    var prixPlomberie = catalogue.prixPlomberie || (global && global.prixPlomberie);
    if (!PRIX) throw new Error('vue-tarifaire : catalogue PRIX indisponible');

    var prestations = {};
    var cats = Object.keys(PRIX);
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = PRIX[cats[ci]];
      if (!Array.isArray(cat)) continue;
      for (var i = 0; i < cat.length; i++) {
        var f = cat[i];
        if (!f || typeof f !== 'object' || !f.code) continue;
        if (Object.prototype.hasOwnProperty.call(prestations, f.code)) continue; // premier gagnant

        var base = { label: (f.label != null ? f.label : f.code), unite: f.unite || null, temps: f.temps || 0 };

        // PRIORITÉ identique à getPrixPrestFor :
        if (f.renov) {
          base.type = 'flat'; base.prix = paire(f.renov);
        } else if (f.prix) {
          base.type = 'flat'; base.prix = paire(f.prix);
        } else if (f.pose && f.app && typeof prixElec === 'function') {
          base.type = 'elec'; base.elec = {};
          for (var m = 0; m < METHODES_ELEC.length; m++) {
            var met = METHODES_ELEC[m]; base.elec[met] = {};
            for (var g = 0; g < GAMMES_ELEC.length; g++) {
              var gm = GAMMES_ELEC[g];
              base.elec[met][gm] = paire(prixElec(f, met, gm));
            }
          }
        } else if (f.pose && f.four && typeof prixPlomberie === 'function') {
          base.type = 'plomberie'; base.plomberie = {};
          for (var gp = 0; gp < GAMMES_PLO.length; gp++) {
            var gpl = GAMMES_PLO[gp];
            base.plomberie[gpl] = paire(prixPlomberie(f, gpl));
          }
        } else {
          // Aucune source de prix exploitable → getPrixPrestFor renverrait null.
          base.type = 'flat'; base.prix = null;
        }

        prestations[f.code] = base;
      }
    }

    return {
      version: '1.0.0',
      genereLe: (catalogue.horloge && catalogue.horloge()) || null,
      domaine: { methodesElec: METHODES_ELEC.slice(), gammesElec: GAMMES_ELEC.slice(), gammesPlomberie: GAMMES_PLO.slice() },
      prestations: prestations
    };
  }

  // -------------------------------------------------------------------
  // creerAccesseursVue(vue)
  //   Rejoue, à partir de la SEULE vue, les 4 accesseurs de js/pricing.js.
  //   Signatures et valeurs IDENTIQUES — aucun accès au catalogue.
  // -------------------------------------------------------------------
  function creerAccesseursVue(vue) {
    var prest = (vue && vue.prestations) || {};

    function getPrixPrestFor(code, piece) {
      var e = prest[code];
      if (!e) return null;
      if (e.type === 'flat') return e.prix || null;
      if (e.type === 'elec') {
        var met = (piece && piece.elecMethode) || DEF_METHODE;
        var gm  = (piece && piece.elecGamme) || DEF_GAMME_ELEC;
        var parMet = e.elec && e.elec[met];
        return (parMet && parMet[gm]) ? parMet[gm] : null;
      }
      if (e.type === 'plomberie') {
        var gp = (piece && piece.ploGamme) || DEF_GAMME_PLO;
        return (e.plomberie && e.plomberie[gp]) ? e.plomberie[gp] : null;
      }
      return null;
    }

    function getMoyenPrixFor(code, piece) {
      var p = getPrixPrestFor(code, piece);
      return p ? (p.min + p.max) / 2 : 0;
    }

    function tempsUnitaire(code) {
      var e = prest[code];
      return e ? (e.temps || 0) : 0;
    }

    function findPrestLabel(code) {
      var e = prest[code];
      return e ? e.label : code;
    }

    return { getPrixPrestFor: getPrixPrestFor, getMoyenPrixFor: getMoyenPrixFor,
             tempsUnitaire: tempsUnitaire, findPrestLabel: findPrestLabel };
  }

  var NOMS_ACCESSEURS = ['getPrixPrestFor', 'getMoyenPrixFor', 'tempsUnitaire', 'findPrestLabel'];

  // -------------------------------------------------------------------
  // installerAccesseurs(cible, vue) — pose les 4 accesseurs de la VUE comme
  //   globales de `cible` (window en navigateur). Renvoie un SNAPSHOT des
  //   accesseurs précédents (pour restauration/retour arrière). C'est ce qui
  //   permet au navigateur de lire les prix SANS pricing.js ni catalogue.
  // -------------------------------------------------------------------
  function installerAccesseurs(cible, vue) {
    cible = cible || global;
    var acc = creerAccesseursVue(vue || {});
    var precedent = {};
    for (var i = 0; i < NOMS_ACCESSEURS.length; i++) {
      var n = NOMS_ACCESSEURS[i];
      precedent[n] = cible[n];
      cible[n] = acc[n];
    }
    return { accesseurs: acc, precedent: precedent };
  }

  // installerDepuisEmbarque(cible) — installe depuis la vue auto-hébergée
  //   (js/vue-tarifaire-data.js publie global.__VUE_TARIFAIRE_DSBAT__).
  //   Sans serveur : la vue est un actif statique du dépôt public (dérivé, non secret).
  function installerDepuisEmbarque(cible) {
    cible = cible || global;
    var vue = cible.__VUE_TARIFAIRE_DSBAT__ || (global && global.__VUE_TARIFAIRE_DSBAT__);
    if (!vue || !vue.prestations) return null;
    return installerAccesseurs(cible, vue);
  }

  var API = {
    construireVueTarifaire: construireVueTarifaire,
    creerAccesseursVue: creerAccesseursVue,
    installerAccesseurs: installerAccesseurs,
    installerDepuisEmbarque: installerDepuisEmbarque,
    NOMS_ACCESSEURS: NOMS_ACCESSEURS.slice(),
    METHODES_ELEC: METHODES_ELEC.slice(),
    GAMMES_ELEC: GAMMES_ELEC.slice(),
    GAMMES_PLO: GAMMES_PLO.slice()
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.VueTarifaireDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
