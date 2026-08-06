// =====================================================================
// js/moteur-mode.js — Sélecteur de moteur / Feature flag Runtime (MISSION R04)
// =====================================================================
// RÔLE : choisir DYNAMIQUEMENT quel moteur sert le résultat, sans toucher aux
//   moteurs métier. C'est un ROUTEUR (feature flag), pas un calculateur : il
//   ne calcule ni ne décide rien — il aiguille vers une source et sait revenir
//   au moteur historique instantanément.
//
// MODES :
//   • 'historique' — le moteur actuel (référence). DÉFAUT.
//   • 'shadow'     — historique servi à l'utilisateur + comparaison Runtime en
//                    tâche de fond (R03). Le résultat servi reste l'historique.
//   • 'runtime'    — le Runtime sert le résultat (via l'Orchestrateur/API),
//                    avec REPLI automatique immédiat sur l'historique en cas
//                    d'échec.
//   • 'arret'      — coupe-circuit : force l'historique et neutralise le reste
//                    (retour arrière immédiat).
//
// GARANTIES (contraintes de mission) :
//   • Aucun changement des moteurs : les sources sont INJECTÉES.
//   • Aucun changement fonctionnel par défaut : mode 'historique' = passe-plat.
//   • Réversibilité instantanée : setMode('historique') / retourArriere() ou
//     repli automatique — sans redéploiement.
//   • L'Orchestrateur reste le point d'entrée du Runtime (source 'runtime*').
// =====================================================================

(function (global) {
  'use strict';

  var MODES = ['historique', 'shadow', 'runtime', 'arret'];

  function creerSelecteurMoteur(deps) {
    deps = deps || {};
    var historique = deps.historique;            // fn(etat) -> devis   (SYNC, obligatoire)
    var runtimeSync = deps.runtimeSync || null;  // fn(etat) -> devis   (SYNC, optionnel : Node/test)
    var runtimeAsync = deps.runtimeAsync || null;// fn(etat) -> Promise<devis> (optionnel : navigateur)
    var observer = deps.observer || null;        // fn(etat, devisLocal) : hook Shadow (mode 'shadow')
    var onRepli = (typeof deps.onRepli === 'function') ? deps.onRepli : null;

    var mode = validerMode(deps.mode) ? deps.mode : 'historique';
    var stats = neuf();
    function neuf() { return { appels: 0, parMode: { historique: 0, shadow: 0, runtime: 0, arret: 0 }, servisParRuntime: 0, replis: 0, erreurs: 0 }; }

    function validerMode(m) { return MODES.indexOf(m) !== -1; }
    function repli(raison) { stats.replis += 1; if (onRepli) { try { onRepli(raison); } catch (e) {} } }

    // ---- Chemin SYNCHRONE (utilisé par le rendu actuel : renderPhase3) ----
    // Renvoie TOUJOURS un résultat exploitable ; en cas de doute, l'historique.
    function calculer(etat) {
      stats.appels += 1;
      var m = mode;
      stats.parMode[m] = (stats.parMode[m] || 0) + 1;

      if (m === 'arret' || m === 'historique') return historique(etat);

      if (m === 'shadow') {
        var d = historique(etat);               // la RÉFÉRENCE reste l'historique
        if (observer) { try { observer(etat, d); } catch (e) {} }  // comparaison en tâche de fond
        return d;
      }

      if (m === 'runtime') {
        if (typeof runtimeSync === 'function') {
          try { var r = runtimeSync(etat); stats.servisParRuntime += 1; return r; }
          catch (e) { stats.erreurs += 1; repli('runtime sync a échoué : ' + (e && e.message)); return historique(etat); }
        }
        // Pas de source synchrone (cas navigateur) : le service synchrone ne peut
        // venir du Runtime → REPLI historique. Le service par Runtime passe par le
        // chemin asynchrone (calculerAsync), branché à la bascule R05.
        repli('runtime synchrone indisponible (chemin async requis — R05)');
        return historique(etat);
      }

      return historique(etat);
    }

    // ---- Chemin ASYNCHRONE (préparé pour R05) ----
    function calculerAsync(etat) {
      if (mode === 'runtime' && typeof runtimeAsync === 'function') {
        stats.appels += 1; stats.parMode.runtime += 1;
        return Promise.resolve().then(function () { return runtimeAsync(etat); })
          .then(function (r) { stats.servisParRuntime += 1; return r; })
          .catch(function (e) { stats.erreurs += 1; repli('runtime async a échoué : ' + (e && e.message)); return historique(etat); });
      }
      return Promise.resolve(calculer(etat));
    }

    return {
      MODES: MODES.slice(),
      getMode: function () { return mode; },
      setMode: function (m) { if (!validerMode(m)) throw new Error('Mode inconnu : ' + m); mode = m; return mode; },
      retourArriere: function () { mode = 'historique'; return mode; },   // ← réversibilité instantanée
      estRuntimeActif: function () { return mode === 'runtime'; },
      calculer: calculer,
      calculerAsync: calculerAsync,
      rapport: function () { return Object.assign({ mode: mode }, stats, { parMode: Object.assign({}, stats.parMode) }); },
      reinitialiser: function () { stats = neuf(); return this; }
    };
  }

  // Lit le mode souhaité depuis l'environnement (URL ?moteur= / localStorage),
  // avec repli sur 'historique'. Compatible ?shadow=1 (R03) comme alias 'shadow'.
  function lireModeDepuisEnv(loc, stockage) {
    try {
      var params = new URLSearchParams((loc && loc.search) || '');
      var m = params.get('moteur');
      if (!m && params.get('shadow') === '1') m = 'shadow';
      if (!m && stockage) { try { m = stockage.getItem('dsbat_moteur') || (stockage.getItem('dsbat_shadow') === '1' ? 'shadow' : null); } catch (e) {} }
      if (MODES.indexOf(m) !== -1) return m;
    } catch (e) {}
    return 'historique';
  }

  var API = { creerSelecteurMoteur: creerSelecteurMoteur, lireModeDepuisEnv: lireModeDepuisEnv, MODES: MODES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.MoteurModeDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
