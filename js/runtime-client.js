// =====================================================================
// js/runtime-client.js — Client d'accès au Runtime DSBAT (MISSION R03)
// =====================================================================
// RÔLE : parler à l'API du Runtime (A10) depuis un client (navigateur/mobile).
//   Construit un appel `POST /v1/projets/calcul` et renvoie, sous une forme
//   simple, ce dont le mode Shadow a besoin : { devis, parPiece, journaux }.
//
// GARANTIES :
//   • Aucun calcul, aucune décision, aucun prix ici : simple transport.
//   • Inerte au chargement : ne fait rien tant qu'on ne l'appelle pas.
//   • N'est utilisé, en R03, que par le mode Shadow (résultat JAMAIS montré à
//     l'utilisateur).
//
// TRANSPORT INJECTABLE : `fetchImpl` par défaut = fetch global (navigateur) ;
//   remplaçable pour les tests. Le client ne dépend pas d'un framework.
// =====================================================================

(function (global) {
  'use strict';

  function creerClientRuntime(options) {
    options = options || {};
    var base = (options.base || '').replace(/\/+$/, '');   // ex. http://127.0.0.1:8787
    var fetchImpl = options.fetchImpl || (global && global.fetch);
    var delaiMs = options.delaiMs || 4000;

    function calculer(projet) {
      if (typeof fetchImpl !== 'function') return Promise.reject(new Error('fetch indisponible'));
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      var minuteur = ctrl ? setTimeout(function () { ctrl.abort(); }, delaiMs) : null;
      return fetchImpl(base + '/v1/projets/calcul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projet),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (rep) {
        if (minuteur) clearTimeout(minuteur);
        return rep.json();
      }).then(function (corps) {
        if (!corps || corps.statut === 'erreur') {
          throw new Error('Runtime : ' + ((corps && corps.erreur && corps.erreur.code) || 'réponse inattendue'));
        }
        var res = (corps.projet && corps.projet.resultats) || {};
        return { devis: res.devis || null, parPiece: res.parPiece || [], journaux: corps.journal || [] };
      }).catch(function (e) { if (minuteur) clearTimeout(minuteur); throw e; });
    }

    function sante() {
      if (typeof fetchImpl !== 'function') return Promise.reject(new Error('fetch indisponible'));
      return fetchImpl(base + '/v1/sante').then(function (r) { return r.json(); });
    }

    return { calculer: calculer, sante: sante, base: base };
  }

  var API = { creerClientRuntime: creerClientRuntime };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.RuntimeClientDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
