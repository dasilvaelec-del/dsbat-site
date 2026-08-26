// =====================================================================
// tests/interface-sans-catalogue.test.js — Preuve PUBLIQUE (M10-A)
// =====================================================================
// Garde-fou public : le navigateur (devis-configurateur.html) ne charge AUCUN
// catalogue privé, et le dépôt public ne contient aucun catalogue. Aucune
// dépendance aux prix/baselines → ce test vit dans le dépôt public. La parité
// de calcul (Golden Master pièce) reste dans le dépôt privé (dsbat-runtime).
// =====================================================================
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
A(!/<script[^>]+src=["']prix\.js/.test(html), 'devis-configurateur.html ne charge plus prix.js');
A(!/<script[^>]+src=["']js\/pricing\.js/.test(html), 'devis-configurateur.html ne charge plus js/pricing.js');
A(/vue-tarifaire-data\.js/.test(html), 'la vue auto-hébergée est chargée par le navigateur');
A(/parametres-metier\.js/.test(html), 'le module public de paramètres est chargé');
A(!fs.existsSync(path.join(ROOT, 'prix.js')), 'prix.js absent de la racine publique');
A(!fs.existsSync(path.join(ROOT, 'js', 'pricing.js')), 'js/pricing.js absent du dossier public js/');
A(!fs.existsSync(path.join(ROOT, 'runtime', 'moteur-prive', 'prix.js')), 'runtime/moteur-prive/prix.js absent du public');
A(!fs.existsSync(path.join(ROOT, 'runtime', 'moteur-prive', 'pricing.js')), 'runtime/moteur-prive/pricing.js absent du public');

const total = ok + ko;
if (ko === 0) console.log('✅ Interface sans catalogue (M10-A) : ' + ok + '/' + total + ' — aucun catalogue chargé ni présent au public');
else { console.error('❌ Interface sans catalogue : ' + ok + '/' + total); process.exit(1); }
