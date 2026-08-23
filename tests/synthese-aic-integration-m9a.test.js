// =====================================================================
// tests/synthese-aic-integration-m9a.test.js — Ancrage M9-A dans le HTML réel
// =====================================================================
// Preuves structurelles (sur devis-configurateur.html tel quel) :
//   Q. phase 3 conserve son comportement Runtime (appel + écran de maintenance) ;
//   R. renderRecapAIC() est appelé AVANT le verrou Runtime dans renderPhase3() ;
//   S. Runtime null → l'écran de maintenance vise #recapGlobal, PAS #recapAIC
//      (donc #recapAIC reste visible) ;
//   T. #recapAIC est présent DANS #phase3, AU-DESSUS de #recapGlobal ;
//   + non-régression : la glue ne modifie ni prix, ni Runtime, ni stockage.
// =====================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- T : markup #recapAIC avant #recapGlobal, dans #phase3 ----
const iPhase3 = html.indexOf('<div id="phase3"');
const iRecapAIC = html.indexOf('<div id="recapAIC">');
const iRecapGlobal = html.indexOf('id="recapGlobal"');
A(iRecapAIC !== -1 && iRecapGlobal !== -1, 'T: #recapAIC et #recapGlobal présents');
A(iPhase3 !== -1 && iPhase3 < iRecapAIC && iRecapAIC < iRecapGlobal, 'T: #recapAIC dans #phase3 et AVANT #recapGlobal');

// ---- includes M8 + M9-A présents ----
A(/<script src="js\/synthese-aic\.js"><\/script>/.test(html), 'inclusion js/synthese-aic.js (M8)');
A(/<script src="js\/synthese-aic-ui\.js"><\/script>/.test(html), 'inclusion js/synthese-aic-ui.js (M9-A)');

// ---- Extraction de renderPhase3() et de renderRecapAIC() ----
const iRP3 = html.indexOf('async function renderPhase3()');
const rp3 = html.slice(iRP3, iRP3 + 1200);
const iRRA = html.indexOf('function renderRecapAIC()');
const rra = html.slice(iRRA, html.indexOf('// ===== PHASE 3', iRRA));

// ---- R : appel renderRecapAIC() AVANT le verrou Runtime ----
const iAppel = rp3.indexOf('renderRecapAIC()');
const iRuntime = rp3.indexOf('__obtenirDevisRuntime()');
const iGate = rp3.indexOf('if (!D)');
A(iAppel !== -1 && iRuntime !== -1 && iAppel < iRuntime, 'R: renderRecapAIC() appelé AVANT __obtenirDevisRuntime()');
A(iAppel < iGate, 'R: renderRecapAIC() appelé AVANT le verrou if(!D)/return');

// ---- Q : comportement Runtime inchangé (appel + transition sur null) ----
A(/const D = await window\.__obtenirDevisRuntime\(\);/.test(rp3), 'Q: renderPhase3 appelle toujours le Runtime');
A(/if \(!D\) \{[\s\S]*afficherTransitionMaintenance\(container\);[\s\S]*return;/.test(rp3), 'Q: Runtime null → afficherTransitionMaintenance + return conservés');

// ---- S : la maintenance vise #recapGlobal (= container), pas #recapAIC ----
A(/const container = document\.getElementById\('recapGlobal'\);/.test(rp3), 'S: container = #recapGlobal');
A(rra.indexOf("getElementById('recapAIC')") !== -1, 'S: renderRecapAIC écrit dans #recapAIC (séparé du devis)');
const iAfficheTrans = html.indexOf('function afficherTransitionMaintenance(container)');
const fnTrans = html.slice(iAfficheTrans, iAfficheTrans + 900);
A(fnTrans.indexOf('recapAIC') === -1, 'S: afficherTransitionMaintenance ne touche jamais #recapAIC');

// ---- Non-régression de la glue : aucune écriture de prix / Runtime / stockage ----
A(!/setItem|removeItem/.test(rra), 'glue: aucune écriture sessionStorage (lecture seule)');
A(!/getMoyenPrix|totalHT|calculerDevis|calculerPiece|recalcPiece/.test(rra), 'glue: aucun calcul de prix / recalcul');
A(rra.indexOf('__obtenirDevisRuntime') === -1, 'glue: aucun appel Runtime');
A(rra.indexOf('SyntheseAICDSBAT.construireAIC') !== -1 && rra.indexOf('SyntheseAICUIDSBAT.rendre') !== -1, 'glue: consomme construireAIC() (M8) puis rendre() (UI), pas de 2ᵉ source');

const total = ok + ko;
if (ko === 0) console.log('✅ Ancrage M9-A (HTML réel) : ' + ok + '/' + total + ' — rendu avant verrou Runtime, #recapAIC séparé, comportement phase 3 conservé');
else console.error('❌ M9-A intégration : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
