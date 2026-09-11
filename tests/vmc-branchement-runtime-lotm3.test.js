// =====================================================================
// tests/vmc-branchement-runtime-lotm3.test.js — M3 : branchement site → Runtime
// =====================================================================
// Vérifie le branchement de l'étude VMC sur POST /v1/vmc/etude, SANS moteur physique
// dans le navigateur :
//   • runtime-client.etudeVmc : succès / erreur API / erreur HTTP / réseau-timeout ;
//   • payload conforme au contrat M1 { pieces, contexte, visite, options } ;
//   • AUCUN référentiel/coefficient/résultat envoyé par le client (même si fourni) ;
//   • les autres méthodes du client sont intactes ;
//   • la page ne charge plus vmc.js et n'appelle plus etudierVisiteVmc dans le parcours d'étude.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const RC = require(path.join(RACINE, 'js', 'runtime-client.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Fabrique une réponse fetch simulée.
function rep(status, corps, opts) {
  opts = opts || {};
  return Promise.resolve({
    status: status,
    json: opts.nonJson ? function () { return Promise.reject(new Error('non-json')); }
                       : function () { return Promise.resolve(corps); }
  });
}
const PAYLOAD = {
  pieces: [{ id: 'sdb', numero: 1 }],
  contexte: { solution: 'simple_flux', nbPiecesPrincipales: 3 },
  visite: { installation: { typeSysteme: 'simple_flux' }, reseaux: [] },
  options: { contexteEtude: 'existant' }
};

// ---- 1. Succès : renvoie corps.vmc, requête conforme au contrat M1 ---------------
(async () => {
  {
    let capt = null;
    const client = RC.creerClientRuntime({ base: 'https://api.dsbat.fr/', fetchImpl: function (url, o) { capt = { url: url, o: o }; return rep(200, { statut: 'ok', vmc: { statutEtude: 'incomplet', synthese: { reseaux: [] }, referentielVersion: '1.2.0' } }); } });
    const vmc = await client.etudeVmc(PAYLOAD);
    A(capt.url === 'https://api.dsbat.fr/v1/vmc/etude' && capt.o.method === 'POST', '1a. POST /v1/vmc/etude (base normalisée)');
    A(capt.o.headers['Content-Type'] === 'application/json', '1b. en-tête JSON');
    const body = JSON.parse(capt.o.body);
    A(Array.isArray(body.pieces) && body.contexte && body.visite && body.options && body.options.contexteEtude === 'existant', '1c. payload = { pieces, contexte, visite, options{contexteEtude} }');
    A(vmc && vmc.statutEtude === 'incomplet', '1d. renvoie uniquement corps.vmc (charge sanitaire)');
  }

  // ---- 2. AUCUN référentiel/coefficient/résultat envoyé par le client ------------
  {
    let capt = null;
    const client = RC.creerClientRuntime({ base: 'https://api.dsbat.fr', fetchImpl: function (url, o) { capt = { url: url, o: o }; return rep(200, { statut: 'ok', vmc: {} }); } });
    await client.etudeVmc({ pieces: PAYLOAD.pieces, contexte: PAYLOAD.contexte, visite: PAYLOAD.visite,
      options: { contexteEtude: 'existant', referentielProduction: { pirate: 1 }, referentielPertes: { x: 1 }, referentiel: { y: 1 } } });
    const body = JSON.parse(capt.o.body);
    A(!('referentielProduction' in body.options) && !('referentielPertes' in body.options) && !('referentiel' in body.options), '2a. le client retire tout référentiel des options avant envoi');
    A(body.options.contexteEtude === 'existant', '2b. les options légitimes sont conservées');
    A(!/coefficient|epsilon|rugosit|"R"/.test(capt.o.body), '2c. aucun coefficient/rugosité/table dans le corps envoyé');
  }

  // ---- 3. Erreur API (corps statut:erreur) → rejet avec code, sans détail interne -
  {
    const client = RC.creerClientRuntime({ base: 'x', fetchImpl: function () { return rep(400, { statut: 'erreur', erreur: { code: 'PAYLOAD_INVALIDE', message: 'détail interne' } }); } });
    let err = null; try { await client.etudeVmc(PAYLOAD); } catch (e) { err = e; }
    A(err && err.code === 'PAYLOAD_INVALIDE' && err.http === 400, '3a. erreur API → rejet {code, http}');
    A(err && !/détail interne/.test(String(err.message)), '3b. le message d\'erreur n\'expose pas le détail interne du Runtime');
  }

  // ---- 4. Corps illisible / vmc absent → erreur service (pas de faux succès) ------
  {
    const client1 = RC.creerClientRuntime({ base: 'x', fetchImpl: function () { return rep(200, null, { nonJson: true }); } });
    let e1 = null; try { await client1.etudeVmc(PAYLOAD); } catch (e) { e1 = e; }
    A(e1 != null, '4a. réponse non-JSON → rejet (jamais un faux succès)');
    const client2 = RC.creerClientRuntime({ base: 'x', fetchImpl: function () { return rep(200, { statut: 'ok' }); } }); // pas de vmc
    let e2 = null; try { await client2.etudeVmc(PAYLOAD); } catch (e) { e2 = e; }
    A(e2 != null, '4b. corps sans vmc → rejet');
  }

  // ---- 5. Réseau/timeout → rejet (fail-closed) -----------------------------------
  {
    const client = RC.creerClientRuntime({ base: 'x', fetchImpl: function () { return Promise.reject(new Error('network')); } });
    let err = null; try { await client.etudeVmc(PAYLOAD); } catch (e) { err = e; }
    A(err != null, '5. erreur réseau → rejet (aucun repli physique)');
  }

  // ---- 6. Méthodes existantes intactes -------------------------------------------
  {
    const client = RC.creerClientRuntime({ base: 'x', fetchImpl: function () { return rep(200, {}); } });
    A(typeof client.calculer === 'function' && typeof client.calculerPiece === 'function' && typeof client.sante === 'function' && typeof client.etudeVmc === 'function', '6. calculer/calculerPiece/sante inchangés + etudeVmc ajouté');
  }

  // ---- 7. Page : plus de vmc.js, plus d'etudierVisiteVmc, appel etudeVmc présent ---
  {
    const html = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
    A(!/<script[^>]+src=["']js\/moteurs\/vmc\.js["']/.test(html), '7a. la page ne charge PLUS js/moteurs/vmc.js');
    A(/<script[^>]+src=["']js\/moteurs\/vmc-public\.js["']/.test(html), '7b. la page charge js/moteurs/vmc-public.js');
    A(!/etudierVisiteVmc/.test(html), '7c. aucun appel à etudierVisiteVmc dans la page');
    A(/\.etudeVmc\s*\(/.test(html), '7d. la page appelle client.etudeVmc(...)');
    A(!/referentielProduction/.test(html), '7e. la page n\'envoie aucun referentielProduction');
  }

  const total = ok + ko;
  if (ko === 0) console.log('✅ Branchement VMC → Runtime (M3) : ' + ok + '/' + total + ' — etudeVmc succès/erreur/réseau, payload M1 conforme, aucun référentiel envoyé, page sans moteur physique (fail-closed)');
  else { console.error('❌ Branchement VMC → Runtime (M3) : ' + ok + '/' + total); process.exit(1); }
})();
