// =====================================================================
// js/moteur-mode.js — Sélecteur de moteur / Feature flag Runtime (R04, étendu R05)
// =====================================================================
// RÔLE : choisir DYNAMIQUEMENT quel moteur sert le résultat, sans toucher aux
//   moteurs métier. C'est un ROUTEUR (feature flag), pas un calculateur : il
//   ne calcule ni ne décide rien — il aiguille vers une source et sait revenir
//   au moteur historique instantanément.
//
// MODES :
//   • 'historique' — le moteur actuel (référence). DÉFAUT.
//   • 'shadow'     — historique servi + comparaison Runtime en tâche de fond (R03).
//   • 'runtime'    — le Runtime sert le résultat (via l'Orchestrateur/API), avec
//                    REPLI automatique immédiat sur l'historique.
//   • 'arret'      — coupe-circuit : force l'historique (retour arrière immédiat).
//
// R05 — BASCULE RÉELLE SUR LE DEVIS, chemin synchrone/asynchrone concilié :
//   Le rendu appelle calculerDevis() de façon SYNCHRONE, or le Runtime navigateur
//   est ASYNCHRONE (fetch). On utilise donc un CACHE D'AMORÇAGE (« prime & serve »)
//   clé par EMPREINTE de l'entrée :
//     - amorcer(etat)  → calcule le devis Runtime en tâche de fond et le met en cache ;
//     - calculer(etat) → en mode runtime, SERT le devis Runtime si l'entrée est amorcée
//       (résultat réellement affiché), sinon REPLI historique + amorçage en arrière-plan.
//   Le cache est invalidé dès que l'entrée change (empreinte différente) : jamais de
//   résultat périmé. Une source Runtime SYNCHRONE (Node/test) est servie directement.
//
// GARANTIES : aucun moteur modifié (sources injectées) ; défaut = passe-plat ;
//   réversibilité instantanée ; l'Orchestrateur reste le point d'entrée du Runtime.
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
    var onExecution = (typeof deps.onExecution === 'function') ? deps.onExecution : null;
    var modele = deps.modele || (global && global.ModeleProjetDSBAT) || null;
    var empreinteFn = (typeof deps.empreinte === 'function') ? deps.empreinte : empreinteDefaut;
    var horlogeExec = (typeof deps.horloge === 'function') ? deps.horloge : function () { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : null; };

    var mode = validerMode(deps.mode) ? deps.mode : 'historique';
    var cache = {};              // empreinte -> { devis, ts }
    var stats = neuf();
    function neuf() { return { appels: 0, parMode: { historique: 0, shadow: 0, runtime: 0, arret: 0 },
      servisParHistorique: 0, servisParRuntime: 0, servisParRepli: 0, amorcages: 0, replis: 0, erreurs: 0, executions: [] }; }

    function validerMode(m) { return MODES.indexOf(m) !== -1; }
    function repli(raison) { stats.replis += 1; if (onRepli) { try { onRepli(raison); } catch (e) {} } }
    function empreinteDefaut(etat) {
      try {
        if (modele && typeof modele.empreinte === 'function') {
          return modele.empreinte({ chantier: etat.chantier, pieces: etat.pieces, metiers: etat.metiers });
        }
        return JSON.stringify([etat.chantier, etat.pieces, etat.metiers]);
      } catch (e) { return 'empreinte-indisponible'; }
    }
    // Journal des EXÉCUTIONS RÉELLES — SANS PRIX (P3) : mode, source, empreinte, horodatage.
    function noter(source, etat, extra) {
      if (source === 'historique') stats.servisParHistorique += 1;
      else if (source === 'runtime') stats.servisParRuntime += 1;
      else if (source === 'repli') stats.servisParRepli += 1;
      var evt = { mode: mode, source: source, empreinte: (etat ? empreinteFn(etat) : null), horodatage: horlogeExec() };
      if (extra) evt.detail = extra;
      if (stats.executions.length < 200) stats.executions.push(evt);
      if (onExecution) { try { onExecution(evt); } catch (e) {} }
    }

    // ---- Amorçage : calcule le devis Runtime et le met en cache (async) ----
    function amorcer(etat) {
      stats.amorcages += 1;
      var cle = empreinteFn(etat);
      var p;
      if (typeof runtimeAsync === 'function') p = Promise.resolve().then(function () { return runtimeAsync(etat); });
      else if (typeof runtimeSync === 'function') p = Promise.resolve().then(function () { return runtimeSync(etat); });
      else p = Promise.reject(new Error('aucune source Runtime'));
      return p.then(function (devis) { cache[cle] = { devis: devis, ts: horlogeExec() }; return devis; })
              .catch(function (e) { stats.erreurs += 1; repli('amorçage Runtime échoué : ' + (e && e.message)); return null; });
    }

    // ---- Chemin SYNCHRONE (utilisé par le rendu actuel : renderPhase3) ----
    function calculer(etat) {
      stats.appels += 1;
      var m = mode;
      stats.parMode[m] = (stats.parMode[m] || 0) + 1;

      if (m === 'arret' || m === 'historique') { var dh = historique(etat); noter('historique', etat); return dh; }

      if (m === 'shadow') {
        var d = historique(etat);               // la RÉFÉRENCE reste l'historique
        if (observer) { try { observer(etat, d); } catch (e) {} }
        noter('historique', etat);
        return d;
      }

      if (m === 'runtime') {
        // Source synchrone (Node/test) : le Runtime sert directement.
        if (typeof runtimeSync === 'function') {
          try { var r = runtimeSync(etat); noter('runtime', etat); return r; }
          catch (e) { stats.erreurs += 1; repli('runtime sync a échoué : ' + (e && e.message)); var f = historique(etat); noter('repli', etat, 'runtime sync KO'); return f; }
        }
        // Source asynchrone (navigateur) : SERVIR depuis le cache si amorcé.
        var cle = empreinteFn(etat);
        if (cache[cle]) { noter('runtime', etat); return cache[cle].devis; }
        // Cache froid : REPLI historique + amorçage en tâche de fond pour les prochains rendus.
        if (typeof runtimeAsync === 'function') planifier(function () { amorcer(etat); });
        repli('cache froid : amorçage Runtime planifié');
        var h = historique(etat); noter('repli', etat, 'cache froid');
        return h;
      }

      var dd = historique(etat); noter('historique', etat); return dd;
    }

    // ---- Chemin ASYNCHRONE (sert réellement le Runtime, avec repli) ----
    function calculerAsync(etat) {
      if (mode === 'runtime' && (typeof runtimeAsync === 'function' || typeof runtimeSync === 'function')) {
        return amorcer(etat).then(function (devis) {
          if (devis != null) { stats.appels += 1; stats.parMode.runtime += 1; noter('runtime', etat); return devis; }
          stats.appels += 1; stats.parMode.runtime += 1; var h = historique(etat); noter('repli', etat, 'async KO'); return h;
        });
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
      amorcer: amorcer,
      invaliderCache: function () { cache = {}; return this; },
      tailleCache: function () { return Object.keys(cache).length; },
      rapport: function () { var s = Object.assign({ mode: mode }, stats); s.parMode = Object.assign({}, stats.parMode); s.executions = stats.executions.slice(); return s; },
      reinitialiser: function () { stats = neuf(); cache = {}; return this; }
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

  // Ordonnanceur non bloquant, portable navigateur / Node.
  function planifier(fn) {
    if (typeof queueMicrotask === 'function') return queueMicrotask(fn);
    if (typeof setTimeout === 'function') return setTimeout(fn, 0);
    try { Promise.resolve().then(fn); } catch (e) {}
  }

  var API = { creerSelecteurMoteur: creerSelecteurMoteur, lireModeDepuisEnv: lireModeDepuisEnv, MODES: MODES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.MoteurModeDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
