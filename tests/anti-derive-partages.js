// tests/anti-derive-partages.js — Garde-fou de publication (M10-A)
// Prouve que la liste blanche de publication = exactement les 12 modules
// partagés et qu'aucun chemin sensible (catalogue/baseline/runtime) ne peut
// être publié par erreur vers le dépôt public.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let ok = 0, ko = 0; const A = (c, m) => { c ? ok++ : (ko++, console.error('  ❌ ' + m)); };
const script = fs.readFileSync(path.join(ROOT, 'outils', 'publier-vers-public.sh'), 'utf8');
const attendus = ['js/modele-projet.js','js/moteur-devis.js','js/moteur-mode.js','js/moteur-piece.js','js/moteur-piece-complet.js','js/moteur-revetements.js','js/moteur-tva.js','js/moteurs/peinture.js','js/shadow.js','js/tarifs-mode.js','js/vue-tarifaire.js','js/vue-tarifaire-data.js'];
const i = script.indexOf('FICHIERS=('); const bloc = script.slice(i, script.indexOf(')', i));
const listes = (bloc.match(/js\/[A-Za-z0-9_\/-]+\.js/g) || []);
A(listes.length === attendus.length && attendus.every(f => listes.includes(f)), 'liste blanche = exactement les 12 modules partagés');
A(!/(prix\.js|pricing\.js|moteur-prive|reference|runtime\/)/.test(bloc), 'aucun chemin sensible dans la liste blanche');
A(/REFUS : chemin sensible/.test(script), 'garde-fou anti-secret présent');
attendus.forEach(f => A(fs.existsSync(path.join(ROOT, f)), 'source partagée présente: ' + f));
const total = ok + ko;
if (ko === 0) console.log('✅ Anti-dérive modules partagés (M10-A) : ' + ok + '/' + total + ' — publication limitée aux 12, catalogue impubliable');
else { console.error('❌ Anti-dérive : ' + ok + '/' + total); process.exit(1); }
