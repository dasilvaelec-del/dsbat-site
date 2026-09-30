// tests/applicabilite-metiers-lot40p1.test.js — LOT40 P1.
// Couche d'applicabilité métier + intégration réelle dans getPrestationsPourPiece.
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const A_ = require(path.join(RACINE, 'js', 'applicabilite-metiers.js'));
const M = require(path.join(RACINE, 'js', 'modele-projet.js')); // source unique catégorie
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const SH = fs.readFileSync(path.join(RACINE, 'outils', 'publier-vers-public.sh'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, cat) => (cat === undefined ? { id: id } : { id: id, categorieSurface: cat });
const appl = (m, p) => A_.estMetierApplicable(m, p, { typeProjet: 'neuf' });

// ===== A. LOGEMENT : tout applicable =====
['peinture', 'sols', 'vmc', 'electricite', 'carrelage', 'plomberie', 'isolation', 'menuiserie', 'chauffage']
  .forEach(m => A(appl(m, P('salon', 'logement')) === true, 'A. logement : ' + m + ' applicable'));

// ===== B. ANNEXE : aucun filtrage P1 =====
['peinture', 'sols', 'vmc', 'electricite', 'carrelage', 'plomberie', 'isolation', 'menuiserie', 'chauffage']
  .forEach(m => A(appl(m, P('cave', 'annexe')) === true, 'B. annexe : ' + m + ' applicable'));

// ===== C. EXTÉRIEUR : masquer peinture/sols/carrelage/vmc ; garder les autres =====
['peinture', 'sols', 'carrelage', 'vmc'].forEach(m =>
  A(appl(m, P('terrasse', 'exterieur')) === false, 'C. extérieur : ' + m + ' NON applicable'));
['electricite', 'plomberie', 'menuiserie', 'isolation', 'chauffage'].forEach(m =>
  A(appl(m, P('terrasse', 'exterieur')) === true, 'C. extérieur : ' + m + ' applicable'));

// ===== D. CATÉGORIE INCONNUE : défaut sûr = tout applicable =====
[P('veranda', null), P('veranda', undefined), P('mystere_zzz')].forEach(p =>
  ['peinture', 'sols', 'vmc', 'electricite', 'carrelage', 'plomberie', 'isolation', 'menuiserie', 'chauffage']
    .forEach(m => A(appl(m, p) === true, 'D. catégorie indéterminée (' + p.id + ') : ' + m + ' applicable')));

// catégorie dérivée du modèle si le champ n'est pas posé (source unique LOT39)
A(appl('peinture', { id: 'terrasse' }) === false, 'D. extérieur dérivé du modèle (terrasse sans champ) : peinture masquée');
A(appl('peinture', { id: 'salon' }) === true, 'D. logement dérivé du modèle (salon sans champ) : peinture applicable');

// metiersApplicables : filtrage de liste (ordre préservé)
A(JSON.stringify(A_.metiersApplicables(P('terrasse', 'exterieur'), {}, ['electricite', 'peinture', 'sols', 'vmc', 'menuiserie']))
  === JSON.stringify(['electricite', 'menuiserie']), 'metiersApplicables : extérieur filtré correctement');

// ===== Publication : module chargé + liste blanche à jour =====
A(/<script src="js\/applicabilite-metiers\.js"><\/script>/.test(HTML), 'module chargé par le configurateur (<script src>)');
A(/js\/applicabilite-metiers\.js/.test(SH), 'module ajouté à la liste blanche de publication');
A(!/CATEGORIE_PAR_ID|function\s+categorieSurfacePiece/.test(fs.readFileSync(path.join(RACINE, 'js', 'applicabilite-metiers.js'), 'utf8')),
  'aucune table de catégories dupliquée dans la couche (délègue au modèle)');

// ===== E & F. Intégration réelle dans getPrestationsPourPiece =====
function extraireFonction(nom) {
  const start = HTML.indexOf('function ' + nom + '(');
  const next = HTML.indexOf('\nfunction ', start + 1);
  return HTML.slice(start, next === -1 ? undefined : next);
}
const sandbox = {
  ApplicabiliteMetiers: A_,
  // stubs moteurs : renvoient une prestation -> la section serait poussée SI applicable
  getElecPourPiece: () => [{ code: 'X' }],
  getPlombPourPiece: () => [{ code: 'X' }],
  getIsolationPourPiece: () => [{ code: 'X' }],
  getMenuiseriePourPiece: () => [{ code: 'X' }],
  getVmcPourPieceUI: () => [{ code: 'X' }]
};
vm.createContext(sandbox);
vm.runInContext(extraireFonction('getPrestationsPourPiece') + '\nthis.__get = getPrestationsPourPiece;', sandbox);
const getSections = sandbox.__get;
const METIERS_ACTIFS = ['electricite', 'plomberie', 'peinture', 'sols', 'carrelage', 'isolation', 'menuiserie', 'vmc', 'chauffage'];
const ch = { typeProjet: 'neuf' };

// F. LOGEMENT : sections inchangées (toutes présentes)
const secLog = getSections(P('salon', 'logement'), METIERS_ACTIFS, ch).map(s => s.metier);
['electricite', 'chauffage', 'plomberie', 'peinture', 'sols', 'isolation', 'menuiserie', 'vmc']
  .forEach(m => A(secLog.indexOf(m) !== -1, 'F. logement : section « ' + m + ' » toujours affichée'));

// E. EXTÉRIEUR : peinture/sols/vmc NE sont plus créées ; les autres restent
const secExt = getSections(P('terrasse', 'exterieur'), METIERS_ACTIFS, ch).map(s => s.metier);
['peinture', 'sols', 'vmc'].forEach(m => A(secExt.indexOf(m) === -1, 'E. extérieur : section « ' + m + ' » NON créée'));
['electricite', 'plomberie', 'isolation', 'menuiserie', 'chauffage'].forEach(m =>
  A(secExt.indexOf(m) !== -1, 'E. extérieur : section « ' + m + ' » conservée'));

// E. ANNEXE : aucune section masquée en P1 (identique au logement)
const secAnx = getSections(P('cave', 'annexe'), METIERS_ACTIFS, ch).map(s => s.metier);
['electricite', 'chauffage', 'plomberie', 'peinture', 'sols', 'isolation', 'menuiserie', 'vmc']
  .forEach(m => A(secAnx.indexOf(m) !== -1, 'E. annexe : section « ' + m + ' » conservée'));

// E. Défaut sûr : module absent -> comportement d'origine (rien masqué)
delete sandbox.ApplicabiliteMetiers;
vm.runInContext('this.__get2 = getPrestationsPourPiece;', sandbox);
const secFallback = sandbox.__get2(P('terrasse', 'exterieur'), METIERS_ACTIFS, ch).map(s => s.metier);
A(secFallback.indexOf('peinture') !== -1 && secFallback.indexOf('sols') !== -1 && secFallback.indexOf('vmc') !== -1,
  'E. défaut sûr : sans la couche, aucune section masquée (comportement inchangé)');

console.log('applicabilite-metiers-lot40p1 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
