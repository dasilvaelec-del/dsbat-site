// =====================================================================
// tests/vmc-etude-visite-lot21.test.js — M5 : invariant SITE du branchement étude VMC
// =====================================================================
// La PHYSIQUE de l'étude (LOT21 : chaînage visite → étude, etudierVisiteVmc) a été déplacée
// vers dsbat-runtime (tests/vmc-etude-visite-lot21 côté Runtime, sur moteur-prive/vmc-moteur.js).
// Côté SITE, on conserve UNIQUEMENT l'invariant public : l'UI d'analyse délègue au Runtime
// (POST /v1/vmc/etude via etudeVmc) et n'appelle PLUS aucun moteur physique local, sans money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const CONF = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
A(/onclick="visiteAnalyser\(\)"/.test(CONF), '30. UI : bouton « Analyser la visite » présent');
const iUI = CONF.indexOf('M57 LOT20 — UI VISITE VMC');
A(iUI > 0, '30a. script UI visite présent');
const UI = CONF.slice(CONF.indexOf('<script>', iUI), CONF.indexOf('</script>', CONF.indexOf('<script>', iUI)));
A(/\.etudeVmc\(/.test(UI) && !/etudierVisiteVmc\(/.test(UI), '30b. UI délègue au Runtime (etudeVmc) et n\'appelle plus etudierVisiteVmc (M3)');
A(!/piece\.config|getMoyenPrixFor|prixTotal|projeterVmcVersConfig|calculerPiece/.test(UI), '30c. UI d\'analyse : aucun money-path / projection tarifaire');
// Aucun moteur physique VMC chargé par la page (M5) — vmc-public.js uniquement.
A(!/<script[^>]+src=["']js\/moteurs\/vmc\.js["']/.test(CONF) && /<script[^>]+src=["']js\/moteurs\/vmc-public\.js["']/.test(CONF), '30d. page charge vmc-public.js, jamais le moteur physique vmc.js');

const total = ok + ko;
if (ko === 0) console.log('✅ Invariant SITE branchement étude VMC (M5) : ' + ok + '/' + total + ' — UI délègue au Runtime, aucun moteur physique local');
else { console.error('❌ Invariant SITE étude VMC : ' + ok + '/' + total); process.exit(1); }
