// tests/applicabilite-metiers-lot40p2.test.js — LOT40 P2 : matrice STATIQUE annexe × métier.
// Principe P2 : categorieSurface + piece.id -> applicabilité. Les « conditionnels » des
// annexes ne sont PAS masqués (documentaire seulement). Aucun accès à piece.projet.*.
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const A_ = require(path.join(RACINE, 'js', 'applicabilite-metiers.js'));
const M = require(path.join(RACINE, 'js', 'modele-projet.js'));
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'applicabilite-metiers.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, cat) => (cat === undefined ? { id: id } : { id: id, categorieSurface: cat });
const TOUS = A_.METIERS; // 9 métiers
const applTous = (piece) => TOUS.every(m => A_.estMetierApplicable(m, piece, { typeProjet: 'neuf' }));
const appl = (m, piece) => A_.estMetierApplicable(m, piece, { typeProjet: 'neuf' });

// ===== A. LOGEMENT : tous applicables (P1 inchangé) =====
A(applTous(P('salon', 'logement')), 'A. logement : tous les métiers applicables');
A(applTous(P('chambre', 'logement')), 'A. logement (chambre) : tous applicables');

// ===== B. EXTÉRIEUR : règles P1 inchangées =====
['peinture', 'sols', 'carrelage', 'vmc'].forEach(m =>
  A(appl(m, P('terrasse', 'exterieur')) === false, 'B. extérieur : ' + m + ' NON applicable (P1)'));
['electricite', 'plomberie', 'isolation', 'menuiserie', 'chauffage'].forEach(m =>
  A(appl(m, P('terrasse', 'exterieur')) === true, 'B. extérieur : ' + m + ' applicable (P1)'));

// ===== C. GARAGE : aucun métier masqué par P2 ; contexte reconnu =====
A(applTous(P('garage', 'annexe')), 'C. garage : aucun métier masqué (conditionnels conservés)');
A(M.categorieSurfacePiece('garage') === 'annexe', 'C. garage : contexte reconnu (annexe)');
// intention documentaire (matrice), sans effet sur les booléens
A(JSON.stringify(A_.MATRICE_ANNEXE.garage.pertinents) === JSON.stringify(['electricite', 'sols', 'menuiserie']),
  'C. garage : pertinents documentés = electricite/sols/menuiserie');
A(A_.MATRICE_ANNEXE.garage.conditionnels.every(m => appl(m, P('garage', 'annexe')) === true),
  'C. garage : les « conditionnels » restent applicables (non masqués)');

// ===== D. CAVE =====
A(applTous(P('cave', 'annexe')), 'D. cave : aucun métier masqué');
A(M.categorieSurfacePiece('cave') === 'annexe', 'D. cave : contexte reconnu (annexe)');
A(JSON.stringify(A_.MATRICE_ANNEXE.cave.pertinents) === JSON.stringify(['electricite', 'sols', 'vmc']),
  'D. cave : pertinents documentés = electricite/sols/vmc');
A(A_.MATRICE_ANNEXE.cave.conditionnels.every(m => appl(m, P('cave', 'annexe')) === true),
  'D. cave : conditionnels non masqués');

// ===== E. GRENIER =====
A(applTous(P('grenier', 'annexe')), 'E. grenier : aucun métier masqué');
A(M.categorieSurfacePiece('grenier') === 'annexe', 'E. grenier : contexte reconnu (annexe)');
A(JSON.stringify(A_.MATRICE_ANNEXE.grenier.pertinents) === JSON.stringify(['isolation', 'menuiserie']),
  'E. grenier : pertinents documentés = isolation/menuiserie');
A(A_.MATRICE_ANNEXE.grenier.conditionnels.every(m => appl(m, P('grenier', 'annexe')) === true),
  'E. grenier : conditionnels non masqués');

// ===== F. BUANDERIE : comportement LOGEMENT inchangé =====
A(M.categorieSurfacePiece('buanderie') === 'logement', 'F. buanderie : reste classée logement (LOT39 intact)');
A(applTous(P('buanderie', 'logement')), 'F. buanderie : comportement logement (tous applicables)');
A(applTous({ id: 'buanderie' }), 'F. buanderie sans champ : catégorie dérivée logement -> tous applicables');
A(A_.MATRICE_ANNEXE.buanderie === undefined, 'F. buanderie : absente de la matrice annexe (elle est logement)');

// ===== G. VÉRANDA : défaut sûr, tous applicables =====
A(M.categorieSurfacePiece('veranda') === null, 'G. véranda : catégorie indéterminée (LOT39 intact)');
A(applTous(P('veranda', null)) && applTous(P('veranda', undefined)) && applTous({ id: 'veranda' }),
  'G. véranda : défaut sûr, tous les métiers applicables');
A(!/veranda/.test(SRC), 'G. aucune heuristique spéciale « veranda » dans la couche');

// ===== H. ANNEXE INCONNUE : défaut sûr =====
A(applTous(P('annexe_mystere_zzz', 'annexe')), 'H. annexe inconnue : tous applicables (défaut sûr)');
A(A_.MATRICE_ANNEXE['annexe_mystere_zzz'] === undefined, 'H. annexe inconnue : pas d\'entrée obligatoire dans la matrice');

// ===== I. AUCUN accès/écriture à piece.projet.* =====
// code sans commentaires : la couche ne fait AUCUN accès de propriété .projet
const SRC_CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
A(!/\.projet/.test(SRC_CODE), 'I. la couche ne référence jamais piece.projet (hors commentaires)');
const pj = { id: 'garage', categorieSurface: 'annexe', projet: { existant: null, cible: null, transformation: null } };
const avant = JSON.stringify(pj);
TOUS.forEach(m => A_.estMetierApplicable(m, pj, { typeProjet: 'neuf' }));
A(JSON.stringify(pj) === avant, 'I. appel n\'écrit rien (piece.projet.* intact)');

// ===== J. AUCUN changement des moteurs métier (la couche ne les touche pas) =====
A(!/moteurs\/|getElecPourPiece|getPlombPourPiece|getVmcPourPiece|require\(/.test(SRC),
  'J. la couche ne référence aucun moteur métier');
A(!/CATEGORIE_PAR_ID|function\s+categorieSurfacePiece/.test(SRC), 'J. aucune table de catégories dupliquée');

// ===== K. INTÉGRATION réelle via getPrestationsPourPiece =====
function extraireFonction(nom) {
  const start = HTML.indexOf('function ' + nom + '(');
  const next = HTML.indexOf('\nfunction ', start + 1);
  return HTML.slice(start, next === -1 ? undefined : next);
}
const sandbox = {
  ApplicabiliteMetiers: A_,
  getElecPourPiece: () => [{ code: 'X' }], getPlombPourPiece: () => [{ code: 'X' }],
  getIsolationPourPiece: () => [{ code: 'X' }], getMenuiseriePourPiece: () => [{ code: 'X' }],
  getVmcPourPieceUI: () => [{ code: 'X' }]
};
vm.createContext(sandbox);
vm.runInContext(extraireFonction('getPrestationsPourPiece') + '\nthis.__get = getPrestationsPourPiece;', sandbox);
const getSections = sandbox.__get;
const ACTIFS = ['electricite', 'plomberie', 'peinture', 'sols', 'carrelage', 'isolation', 'menuiserie', 'vmc', 'chauffage'];
const ch = { typeProjet: 'neuf' };
const secOf = (piece) => getSections(piece, ACTIFS, ch).map(s => s.metier);

// annexe (garage/cave/grenier) : toutes les sections présentes (rien masqué en P2)
['garage', 'cave', 'grenier'].forEach(id => {
  const sec = secOf(P(id, 'annexe'));
  ['electricite', 'chauffage', 'plomberie', 'peinture', 'sols', 'isolation', 'menuiserie', 'vmc']
    .forEach(m => A(sec.indexOf(m) !== -1, 'K. ' + id + ' (annexe) : section « ' + m + ' » présente'));
});
// extérieur : peinture/sols/vmc absents (P1 conservé en intégration)
const secExt = secOf(P('terrasse', 'exterieur'));
A(['peinture', 'sols', 'vmc'].every(m => secExt.indexOf(m) === -1), 'K. extérieur : peinture/sols/vmc non créées');
A(['electricite', 'plomberie', 'isolation', 'menuiserie', 'chauffage'].every(m => secExt.indexOf(m) !== -1),
  'K. extérieur : électricité/plomberie/isolation/menuiserie/chauffage conservées');
// logement : non-régression (toutes les sections)
const secLog = secOf(P('salon', 'logement'));
A(['electricite', 'chauffage', 'plomberie', 'peinture', 'sols', 'isolation', 'menuiserie', 'vmc'].every(m => secLog.indexOf(m) !== -1),
  'K. logement : toutes les sections (non-régression)');

console.log('applicabilite-metiers-lot40p2 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
