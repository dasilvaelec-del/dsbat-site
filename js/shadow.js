// =====================================================================
// js/shadow.js — Mode Shadow du Runtime DSBAT (MISSION R03)
// =====================================================================
// RÔLE : exécuter le moteur en DOUBLE — le moteur HISTORIQUE (local, qui reste
//   la référence servie à l'utilisateur) ET le Runtime (observé) — puis
//   COMPARER automatiquement les deux résultats. Le résultat du Runtime n'est
//   JAMAIS utilisé pour l'utilisateur : il ne sert qu'à vérifier la parité.
//
// GARANTIES (contrainte de mission) :
//   • Additif & inerte par défaut : rien ne se passe tant que `actif` est faux.
//   • Ne perturbe JAMAIS le configurateur : l'observation est asynchrone,
//     « fire-and-forget », toute erreur est avalée (jamais propagée à l'UI).
//   • Aucun calcul ni décision ici : Shadow ne fait que COMPARER et RAPPORTER.
//   • Aucun prix journalisé (P3) : le comparateur signale même un prix qui
//     fuiterait dans un journal.
//
// TRANSPORT-AGNOSTIQUE : la source « Runtime » est injectée (`deps.runtime`),
//   une fonction `calculer(projet) -> { devis, parPiece, journaux }`. En
//   navigateur : un client fetch (js/runtime-client.js). En Node/test : l'API
//   composée en mémoire. Shadow ne connaît ni fetch ni http.
// =====================================================================

(function (global) {
  'use strict';

  // Clés « critiques » du devis : tout écart y est de gravité maximale.
  var CLES_CRITIQUES = ['totalHT', 'ttc', 'tva', 'taux', 'coefZ', 'forfaitAcces'];
  // Champs volatils légitimement différents (à ignorer dans la comparaison).
  var VOLATILS = ['horodatage', 'calculeLe', 'empreinte', 'requestId', 'sequence'];
  // Motif de détection d'un prix qui fuiterait dans un journal (P3).
  var MOTIF_PRIX = /prix|montant|"ttc"|"tva"|euro|€|totalht/i;

  function estVolatil(cle) { return VOLATILS.indexOf(cle) !== -1; }

  // Diff profond, déterministe, orienté « attendu (local) vs obtenu (runtime) ».
  function diff(local, runtime, chemin, out) {
    chemin = chemin || '';
    out = out || [];
    if (local === runtime) return out;

    var tl = typeisation(local), tr = typeisation(runtime);
    if (tl !== tr) { out.push({ chemin: chemin || '(racine)', type: 'type', attendu: tl, obtenu: tr }); return out; }

    if (tl === 'array') {
      if (local.length !== runtime.length) out.push({ chemin: chemin + '.length', type: 'valeur', attendu: local.length, obtenu: runtime.length });
      var n = Math.max(local.length, runtime.length);
      for (var i = 0; i < n; i++) diff(local[i], runtime[i], chemin + '[' + i + ']', out);
      return out;
    }
    if (tl === 'object') {
      var cles = {};
      Object.keys(local).forEach(function (k) { cles[k] = true; });
      Object.keys(runtime).forEach(function (k) { cles[k] = true; });
      Object.keys(cles).sort().forEach(function (k) {
        if (estVolatil(k)) return;
        var sousChemin = chemin ? chemin + '.' + k : k;
        var aL = Object.prototype.hasOwnProperty.call(local, k);
        var aR = Object.prototype.hasOwnProperty.call(runtime, k);
        // Une clé présente mais `undefined` équivaut à une clé absente : JSON
        // supprime les valeurs `undefined` (le Runtime renvoie du JSON), donc ce
        // n'est PAS un écart réel.
        if (aL && !aR) { if (local[k] === undefined) return; out.push({ chemin: sousChemin, type: 'cle_manquante', attendu: local[k], obtenu: undefined }); return; }
        if (!aL && aR) { if (runtime[k] === undefined) return; out.push({ chemin: sousChemin, type: 'cle_superflue', attendu: undefined, obtenu: runtime[k] }); return; }
        diff(local[k], runtime[k], sousChemin, out);
      });
      return out;
    }
    // Primitifs
    out.push({ chemin: chemin || '(racine)', type: 'valeur', attendu: local, obtenu: runtime });
    return out;
  }
  function typeisation(v) {
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    return typeof v === 'object' ? 'object' : (typeof v);
  }

  // Attribue une gravité à un écart selon son chemin et son type.
  function graviteDe(ecart) {
    var c = ecart.chemin || '';
    // Écart par pièce : MAJEUR (le devis global, lui, est CRITIQUE).
    if (/parPiece/.test(c)) return 'majeur';
    var dernier = c.split('.').pop().replace(/\[\d+\]$/, '');
    if (CLES_CRITIQUES.indexOf(dernier) !== -1) return 'critique';
    if (ecart.type === 'type' || ecart.type === 'cle_manquante' || ecart.type === 'cle_superflue') return 'majeur';
    if (/totalHT/.test(c)) return 'majeur';
    return 'mineur';
  }

  function creerShadow(deps) {
    deps = deps || {};
    var runtime = deps.runtime;                 // async calculer(projet) -> {devis, parPiece, journaux}
    var modele = deps.modele || (global && global.ModeleProjetDSBAT) ||
      ((typeof require === 'function') ? require('./modele-projet.js') : null);
    var maxExemples = deps.maxExemples || 20;
    var horloge = (typeof deps.horloge === 'function') ? deps.horloge : function () { return null; };
    var sortieEcart = (typeof deps.onEcart === 'function') ? deps.onEcart : null;

    var actif = !!deps.actif;
    var stats = neuf();
    function neuf() { return { comparaisons: 0, sansEcart: 0, avecEcart: 0, erreurs: 0, ecarts: 0,
      parType: {}, parGravite: { critique: 0, majeur: 0, mineur: 0 }, exemples: [] }; }

    // --- Comparateurs par niveau ---
    function comparerDevis(local, runtimeDevis) {
      return diff(local || {}, runtimeDevis || {}, 'devis').map(annoter);
    }
    function comparerParPiece(piecesLocales, parPieceRuntime) {
      var out = [];
      var mapR = {}; (parPieceRuntime || []).forEach(function (p) { mapR[p.id] = p; });
      (piecesLocales || []).forEach(function (p) {
        var r = mapR[p.id];
        if (!r) { out.push(annoter({ chemin: 'parPiece[' + p.id + ']', type: 'cle_manquante', attendu: p.totalHT, obtenu: undefined })); return; }
        if ((p.totalHT != null || r.totalHT != null) && p.totalHT !== r.totalHT) {
          out.push(annoter({ chemin: 'parPiece[' + p.id + '].totalHT', type: 'valeur', attendu: p.totalHT, obtenu: r.totalHT }));
        }
      });
      return out;
    }
    function verifierJournaux(journaux) {
      var out = [];
      if (!Array.isArray(journaux) || journaux.length === 0) {
        out.push(annoter({ chemin: 'journaux', type: 'valeur', attendu: '≥1 événement', obtenu: (journaux || []).length, _gravite: 'mineur' }));
        return out;
      }
      if (MOTIF_PRIX.test(JSON.stringify(journaux))) {
        out.push(annoter({ chemin: 'journaux', type: 'prix_dans_journal', attendu: 'aucun prix', obtenu: 'prix détecté', _gravite: 'critique' }));
      }
      return out;
    }
    function annoter(e) { e.gravite = e._gravite || graviteDe(e); delete e._gravite; return e; }

    // --- Enregistrement des écarts (uniquement les écarts) ---
    function journaliser(contexte, ecarts) {
      stats.comparaisons += 1;
      if (!ecarts.length) { stats.sansEcart += 1; return; }
      stats.avecEcart += 1;
      stats.ecarts += ecarts.length;
      ecarts.forEach(function (e) {
        stats.parType[e.type] = (stats.parType[e.type] || 0) + 1;
        stats.parGravite[e.gravite] = (stats.parGravite[e.gravite] || 0) + 1;
        if (stats.exemples.length < maxExemples) stats.exemples.push({ cas: contexte, chemin: e.chemin, type: e.type, gravite: e.gravite, attendu: e.attendu, obtenu: e.obtenu });
        if (sortieEcart) { try { sortieEcart(Object.assign({ cas: contexte, horodatage: horloge() }, e)); } catch (x) {} }
      });
    }

    // --- Observation d'une exécution locale (asynchrone, non bloquante) ---
    // etat : { chantier, pieces, metiers, devisLocal, contexte }
    function observer(etat) {
      if (!actif) return Promise.resolve(null);
      var contexte = (etat && etat.contexte) || 'devis';
      return Promise.resolve().then(function () {
        if (!modele || typeof modele.creerProjetDSBAT !== 'function') throw new Error('Modèle indisponible');
        if (typeof runtime !== 'function') throw new Error('Source Runtime indisponible');
        var projet = modele.creerProjetDSBAT({ chantier: etat.chantier, pieces: etat.pieces, metiers: etat.metiers, id: 'shadow' });
        return Promise.resolve(runtime(projet)).then(function (r) {
          r = r || {};
          var ecarts = []
            .concat(comparerDevis(etat.devisLocal, r.devis))
            .concat(comparerParPiece(etat.pieces, r.parPiece))
            .concat(verifierJournaux(r.journaux));
          journaliser(contexte, ecarts);
          return ecarts;
        });
      }).catch(function (e) {
        // Une panne du Shadow ne doit JAMAIS perturber l'utilisateur.
        stats.comparaisons += 1; stats.erreurs += 1;
        if (stats.exemples.length < maxExemples) stats.exemples.push({ cas: contexte, type: 'erreur_shadow', gravite: 'observation', message: String(e && e.message || e) });
        return null;
      });
    }

    // --- Enveloppe d'une fonction locale (ex. calculerDevis) ---
    // Retourne une fonction qui appelle l'originale, REND son résultat inchangé,
    // puis planifie une observation Shadow en tâche de fond.
    function envelopper(fnLocale, extraireEtat) {
      return function () {
        var resultat = fnLocale.apply(this, arguments);
        if (actif) {
          try {
            var etat = extraireEtat(resultat, arguments);
            planifier(function () { observer(etat); });
          } catch (x) { /* jamais bloquant */ }
        }
        return resultat;
      };
    }

    // --- Rapport de synthèse ---
    function rapport() {
      var total = stats.comparaisons;
      var parite = total ? Math.round(((stats.sansEcart) / total) * 10000) / 100 : 100;
      return {
        actif: actif,
        comparaisons: stats.comparaisons,
        sansEcart: stats.sansEcart,
        avecEcart: stats.avecEcart,
        erreurs: stats.erreurs,
        ecarts: stats.ecarts,
        pariteParfaitePct: parite,
        parType: Object.assign({}, stats.parType),
        parGravite: Object.assign({}, stats.parGravite),
        exemples: stats.exemples.slice()
      };
    }
    function texteRapport() {
      var r = rapport();
      return '[Shadow DSBAT] comparaisons=' + r.comparaisons + ' · sans écart=' + r.sansEcart +
        ' · avec écart=' + r.avecEcart + ' · erreurs=' + r.erreurs + ' · parité=' + r.pariteParfaitePct + '%' +
        ' · gravité{critique:' + r.parGravite.critique + ', majeur:' + r.parGravite.majeur + ', mineur:' + r.parGravite.mineur + '}';
    }

    return {
      activer: function () { actif = true; return this; },
      desactiver: function () { actif = false; return this; },
      estActif: function () { return actif; },
      reinitialiser: function () { stats = neuf(); return this; },
      comparerDevis: comparerDevis,
      comparerParPiece: comparerParPiece,
      verifierJournaux: verifierJournaux,
      observer: observer,
      envelopper: envelopper,
      rapport: rapport,
      texteRapport: texteRapport
    };
  }

  // Ordonnanceur non bloquant, portable navigateur / Node.
  function planifier(fn) {
    if (typeof queueMicrotask === 'function') return queueMicrotask(fn);
    if (typeof setTimeout === 'function') return setTimeout(fn, 0);
    try { Promise.resolve().then(fn); } catch (e) {}
  }

  var API = { creerShadow: creerShadow, _diff: diff, _graviteDe: graviteDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ShadowDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
