// =====================================================================
// tests/vmc-signalement-lot9.test.js — M57 LOT9
// =====================================================================
// Signalement d'une solution VMC non entièrement tarifable, via le canal de cohérence
// existant (controlesCoherence → alertes → boîte ambre du récap). Basé sur
// ch.solutionVentilation, non bloquant, sans nouvelle donnée ni nouveau statut.
//   double_flux → alerte « non entièrement chiffrée / visite »
//   inconnue    → alerte « solution non définie / visite » (jamais transformée en SF)
// Anti-doublon : l'alerte VMC historique « ne sera pas chiffrée » est retirée pour ces
// solutions (trompeuse), conservée pour les cas ordinaires (SF/hygro).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Chargement frais de coherence.js avec, au besoin, verifierVMC réel injecté en global.
function chargerCoherence(avecVerifierVmc, metiers) {
  delete require.cache[require.resolve(path.join(RACINE, 'js', 'coherence.js'))];
  if (avecVerifierVmc) {
    const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));
    globalThis.verifierVMC = VMC.verifierVMC;
    globalThis._vmcRole = VMC._vmcRole;
    globalThis.metiersActifs = metiers || ['vmc'];
  } else {
    delete globalThis.verifierVMC; delete globalThis._vmcRole;
    globalThis.metiersActifs = metiers || [];
  }
  return require(path.join(RACINE, 'js', 'coherence.js'));
}
const txt = (arr) => arr.map(a => a.texte).join(' || ');
const has = (arr, re) => arr.some(a => re.test(a.texte || ''));

// ---- 1/2. double_flux → alerte spécifique, non bloquante -------------------------
{
  const C = chargerCoherence(false);
  const r = C.verifierCoherenceGlobale([], { solutionVentilation: 'double_flux' });
  A(has(r, /double flux[\s\S]*n'est pas encore entièrement chiffrée|pas encore entièrement chiffrée/i), '1. double_flux → alerte spécifique présente');
  A(r.every(a => a.niveau !== 'bloquant' && a.niveau !== 'erreur'), '2. alerte non bloquante (aucun niveau bloquant/erreur)');
  A(!has(r, /conforme|validée|dimensionnée/i), '3bis. ne dit pas conforme/validée/dimensionnée');
}

// ---- 4/5. inconnue → alerte spécifique, jamais « simple flux » -------------------
{
  const C = chargerCoherence(false);
  const r = C.verifierCoherenceGlobale([], { solutionVentilation: 'inconnue' });
  A(has(r, /n'est pas encore définie|pas encore définie/i), '4. inconnue → alerte spécifique présente');
  A(!has(r, /simple flux|VMC simple flux|par défaut/i), '5. inconnue → jamais transformée en simple flux');
}

// ---- 6. distinction des deux messages --------------------------------------------
{
  const C = chargerCoherence(false);
  const df = C.verifierCoherenceGlobale([], { solutionVentilation: 'double_flux' }).filter(a => /flux|ventilation|définie|chiffr/i.test(a.texte));
  const inc = C.verifierCoherenceGlobale([], { solutionVentilation: 'inconnue' }).filter(a => /flux|ventilation|définie|chiffr/i.test(a.texte));
  A(df.length && inc.length && df[0].texte !== inc[0].texte, '6. message double_flux ≠ message inconnue');
}

// ---- 7/8. simple_flux / hygro → aucune alerte LOT9 -------------------------------
{
  const C = chargerCoherence(false);
  ['simple_flux', 'hygro'].forEach(sol => {
    const r = C.verifierCoherenceGlobale([], { solutionVentilation: sol });
    A(!has(r, /entièrement chiffrée|pas encore définie|double flux/i), sol + ' → aucune alerte LOT9 spécifique');
  });
  // absence de solution (ancien chantier) → aucune alerte LOT9
  A(!has(C.verifierCoherenceGlobale([], {}), /entièrement chiffrée|pas encore définie/i), 'solution absente → aucune alerte LOT9');
}

// ---- 9. cas VMC historique (SF, sans bouche) : « pas chiffrée » conservée --------
{
  const C = chargerCoherence(true, ['vmc']);
  const pieces = [{ id: 'sdb', nom: 'SDB', config: { vmc: {} } }];
  const r = C.verifierCoherenceGlobale(pieces, { solutionVentilation: 'simple_flux' });
  A(has(r, /ne sera pas chiffrée/), '9. SF sans bouche → alerte historique « ne sera pas chiffrée » conservée');
  A(!has(r, /entièrement chiffrée|double flux/i), '9. SF → pas d\'alerte LOT9');
}

// ---- 11. anti-doublon : double_flux sans bouche → une seule narration ------------
{
  const C = chargerCoherence(true, ['vmc']);
  const pieces = [{ id: 'sdb', nom: 'SDB', config: { vmc: {} } }];
  const r = C.verifierCoherenceGlobale(pieces, { solutionVentilation: 'double_flux' });
  A(!has(r, /ne sera pas chiffrée/), '11. double_flux → alerte « ne sera pas chiffrée » retirée (anti-doublon)');
  A(has(r, /pas encore entièrement chiffrée/i), '11. double_flux → message LOT9 présent à la place');
}

// ---- 10. metiersActifs sans vmc : signal LOT9 conservé ---------------------------
{
  const C = chargerCoherence(true, ['electricite']); // verifierVMC gaté → retourne []
  const r = C.verifierCoherenceGlobale([{ id: 'sdb', nom: 'SDB', config: {} }], { solutionVentilation: 'double_flux' });
  A(has(r, /pas encore entièrement chiffrée/i), '10. vmc inactif mais solution double_flux → signal LOT9 présent (basé sur ch)');
}

// ---- Vérifs statiques : aucune nouvelle donnée / aucun changement calcul ----------
const COH = fs.readFileSync(path.join(RACINE, 'js', 'coherence.js'), 'utf8');
A(/solutionVentilation === 'double_flux'/.test(COH) && /solutionVentilation === 'inconnue'/.test(COH), 'règle basée sur ch.solutionVentilation');
A(!/doubleFluxNonTarifable|aVerifierDoubleFlux|devis\.statut/.test(COH), 'aucune nouvelle donnée persistée / statut de devis');
A(!/piece\.config|VMC_BOUCHE\s*=|dimensionnementVMC|getMoyenPrixFor/.test(COH), 'coherence.js ne touche ni config ni calcul VMC');
// LOT8 intact
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
A(/function projeterVmcVersConfig/.test(CONFIG) && /ctx\.solution !== 'simple_flux' && ctx\.solution !== 'hygro'/.test(CONFIG), 'LOT8 projeterVmcVersConfig inchangé (gating SF/hygro préservé)');

// nettoyage globals
delete globalThis.verifierVMC; delete globalThis._vmcRole; delete globalThis.metiersActifs;

const total = ok + ko;
if (ko === 0) console.log('✅ Signalement VMC (M57 LOT9) : ' + ok + '/' + total + ' — DF/inconnue signalés (non bloquant), anti-doublon, cas ordinaires intacts');
else { console.error('❌ Signalement VMC LOT9 : ' + ok + '/' + total); process.exit(1); }
