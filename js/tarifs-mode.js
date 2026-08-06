// =====================================================================
// js/tarifs-mode.js — Sélecteur de source tarifaire / Feature flag (R08)
// =====================================================================
// RÔLE : choisir la SOURCE des prix D'AFFICHAGE utilisée par l'interface, sans
//   toucher au rendu ni aux règles. C'est un ROUTEUR (comme moteur-mode.js pour
//   le calcul), appliqué aux 4 accesseurs de tarification :
//     getPrixPrestFor / getMoyenPrixFor / tempsUnitaire / findPrestLabel.
//
// MODES :
//   • 'catalogue' — accesseurs historiques (js/pricing.js sur prix.js). DÉFAUT.
//   • 'vue'       — accesseurs rejoués depuis la VUE TARIFAIRE Runtime (sans
//                   catalogue) ; REPLI automatique sur 'catalogue' à la moindre
//                   erreur (vue indisponible, réseau…).
//
// POURQUOI : préparer le retrait de prix.js du navigateur. En mode 'vue', l'écran
//   n'a plus besoin du catalogue pour AFFICHER — il lit des montants déjà résolus.
//   La bascule est le préalable réversible au débranchement de prix.js (R09).
//
// GARANTIES :
//   • INERTE au chargement : ne remplace RIEN tant qu'on n'active pas (défaut).
//   • RÉVERSIBILITÉ INSTANTANÉE : retourArriere() réinstalle les accesseurs
//     catalogue d'origine (aucun résultat périmé).
//   • Aucun calcul, aucune règle, aucun prix : simple aiguillage d'accesseurs.
//   • Portable navigateur / Node (pour les preuves).
// =====================================================================

(function (global) {
  'use strict';

  var MODES = ['catalogue', 'vue'];
  var NOMS = ['getPrixPrestFor', 'getMoyenPrixFor', 'tempsUnitaire', 'findPrestLabel'];

  function creerControleurTarifs(deps) {
    deps = deps || {};
    var cible = deps.cible || global;                 // portée où vivent les accesseurs globaux
    var fabrique = deps.creerAccesseursVue ||         // VueTarifaireDSBAT.creerAccesseursVue
      (global && global.VueTarifaireDSBAT && global.VueTarifaireDSBAT.creerAccesseursVue);
    var chargerVue = (typeof deps.chargerVue === 'function') ? deps.chargerVue : null; // () -> Promise<vue> | vue
    var onRepli = (typeof deps.onRepli === 'function') ? deps.onRepli : null;
    var onExecution = (typeof deps.onExecution === 'function') ? deps.onExecution : null;

    var mode = 'catalogue';
    var origine = null;   // snapshot des accesseurs catalogue (pour restauration)
    var stats = { activations: 0, replis: 0, erreurs: 0 };

    function snapshotOrigine() {
      if (origine) return;
      origine = {};
      for (var i = 0; i < NOMS.length; i++) origine[NOMS[i]] = cible[NOMS[i]];
    }
    function installer(acc) {
      for (var i = 0; i < NOMS.length; i++) if (typeof acc[NOMS[i]] === 'function') cible[NOMS[i]] = acc[NOMS[i]];
    }
    function restaurer() {
      if (!origine) return;
      for (var i = 0; i < NOMS.length; i++) cible[NOMS[i]] = origine[NOMS[i]];
    }
    function repli(raison) { stats.replis += 1; mode = 'catalogue'; restaurer(); if (onRepli) { try { onRepli(raison); } catch (e) {} } }
    function noter(source) { if (onExecution) { try { onExecution({ mode: mode, source: source }); } catch (e) {} } }

    // Active le mode 'vue' : installe les accesseurs de vue. Renvoie une Promise.
    function activer(vueFournie) {
      if (typeof fabrique !== 'function') { repli('fabrique d\'accesseurs vue indisponible'); return Promise.resolve(false); }
      snapshotOrigine();
      var source = (vueFournie != null) ? Promise.resolve(vueFournie)
        : (chargerVue ? Promise.resolve().then(chargerVue) : Promise.reject(new Error('aucune source de vue')));
      return source.then(function (vue) {
        if (!vue || !vue.prestations) throw new Error('vue tarifaire invalide');
        installer(fabrique(vue));
        mode = 'vue'; stats.activations += 1; noter('vue');
        return true;
      }).catch(function (e) { stats.erreurs += 1; repli('activation vue échouée : ' + (e && e.message)); return false; });
    }

    return {
      MODES: MODES.slice(),
      getMode: function () { return mode; },
      activer: activer,
      retourArriere: function () { mode = 'catalogue'; restaurer(); return mode; }, // ← réversibilité instantanée
      estVueActive: function () { return mode === 'vue'; },
      rapport: function () { return Object.assign({ mode: mode }, stats); }
    };
  }

  // Lit le mode souhaité depuis l'environnement (URL ?tarifs= / localStorage),
  // défaut 'catalogue'. Aucune activation implicite : l'appelant décide.
  function lireModeDepuisEnv(loc, stockage) {
    try {
      var params = new URLSearchParams((loc && loc.search) || '');
      var m = params.get('tarifs');
      if (!m && stockage) { try { m = stockage.getItem('dsbat_tarifs'); } catch (e) {} }
      if (MODES.indexOf(m) !== -1) return m;
    } catch (e) {}
    return 'catalogue';
  }

  // -------------------------------------------------------------------
  // creerAccesseursCatalogue(portee) — reconstruit les 4 accesseurs D'ORIGINE
  //   (identiques à js/pricing.js) à partir du CATALOGUE encore présent
  //   (portee.PRIX / prixElec / prixPlomberie). Sert de CHEMIN DE RETOUR ARRIÈRE
  //   pour le mode 'catalogue' APRÈS le retrait de pricing.js du navigateur (R09).
  //   Copie VERBATIM de la logique livrée — aucune règle / aucun prix modifié.
  // -------------------------------------------------------------------
  function creerAccesseursCatalogue(portee) {
    portee = portee || global;
    function P() { return portee.PRIX; }
    function getPrixPrestFor(code, piece) {
      var PRIX = P(); if (!PRIX) return null;
      for (var k in PRIX) {
        var cat = PRIX[k]; if (!Array.isArray(cat)) continue;
        for (var i = 0; i < cat.length; i++) {
          var f = cat[i];
          if (f && f.code === code) {
            if (f.renov) return f.renov;
            if (f.prix) return f.prix;
            if (f.pose && f.app && typeof portee.prixElec === 'function')
              return portee.prixElec(f, (piece && piece.elecMethode) || 'saignee', (piece && piece.elecGamme) || 'dooxie');
            if (f.pose && f.four && typeof portee.prixPlomberie === 'function')
              return portee.prixPlomberie(f, (piece && piece.ploGamme) || 'standard');
            return null;
          }
        }
      }
      return null;
    }
    function getMoyenPrixFor(code, piece) { var p = getPrixPrestFor(code, piece); return p ? (p.min + p.max) / 2 : 0; }
    function tempsUnitaire(code) {
      var PRIX = P(); if (!PRIX) return 0;
      for (var k in PRIX) { var cat = PRIX[k]; if (!Array.isArray(cat)) continue; for (var i = 0; i < cat.length; i++) if (cat[i] && cat[i].code === code) return cat[i].temps || 0; }
      return 0;
    }
    function findPrestLabel(code) {
      var PRIX = P(); if (!PRIX) return code;
      for (var k in PRIX) { var cat = PRIX[k]; if (!Array.isArray(cat)) continue; for (var i = 0; i < cat.length; i++) if (cat[i] && cat[i].code === code) return cat[i].label; }
      return code;
    }
    return { getPrixPrestFor: getPrixPrestFor, getMoyenPrixFor: getMoyenPrixFor, tempsUnitaire: tempsUnitaire, findPrestLabel: findPrestLabel };
  }

  var API = { creerControleurTarifs: creerControleurTarifs, lireModeDepuisEnv: lireModeDepuisEnv,
    creerAccesseursCatalogue: creerAccesseursCatalogue, MODES: MODES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.TarifsModeDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
