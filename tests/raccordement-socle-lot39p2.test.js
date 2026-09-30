// tests/raccordement-socle-lot39p2.test.js — LOT39 PASSE 2 : raccordement du socle
// (Passe 1) au configurateur. Exécute la VRAIE fonction _appliquerSocleLot39 extraite
// du configurateur, branchée sur le modèle réel (ModeleProjetDSBAT), sur des pièces
// fabriquées à l'identique de la fabrique validerPieces(). Vérifie §9 + non-régression.
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const M = require(path.join(RACINE, 'js', 'modele-projet.js'));
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ===== Raccordement statique : le socle est branché aux 2 points d'écriture =====
A(/piecesSelectionnees = nouvelles;\s*\n\s*_appliquerSocleLot39\(piecesSelectionnees\)/.test(HTML),
  'raccordement : fabrique validerPieces appelle _appliquerSocleLot39 après piecesSelectionnees = nouvelles');
A(/piecesSelectionnees = Array\.isArray\(etat\.pieces\)[^\n]*\n\s*_appliquerSocleLot39\(piecesSelectionnees\)/.test(HTML),
  'raccordement : restauration de session appelle aussi _appliquerSocleLot39');

// ===== Source unique : aucune table id->catégorie dupliquée dans le configurateur =====
A(!/CATEGORIE_PAR_ID|function\s+categorieSurfacePiece/.test(HTML),
  'source unique : pas de table/fonction de catégorisation redéfinie dans le configurateur');
A(!/'logement'|'annexe'|'exterieur'|"logement"|"annexe"|"exterieur"/.test(HTML),
  'source unique : aucune catégorie de surface en dur dans le configurateur');
A(/ModeleProjetDSBAT\.normaliserPieceSocle/.test(HTML),
  'source unique : le configurateur délègue au modèle (ModeleProjetDSBAT.normaliserPieceSocle)');

// ===== Extraire et exécuter la VRAIE fonction _appliquerSocleLot39 =====
const fnMatch = HTML.match(/function _appliquerSocleLot39\(liste\)\s*\{[\s\S]*?\n\}/);
A(!!fnMatch, 'helper _appliquerSocleLot39 présent et extractible');
const sandbox = { ModeleProjetDSBAT: M };
vm.createContext(sandbox);
vm.runInContext(fnMatch[0] + '\nthis.__appliquer = _appliquerSocleLot39;', sandbox);
const appliquer = sandbox.__appliquer;
A(typeof appliquer === 'function', 'helper exécutable dans le sandbox');

// Fabrique fidèle à validerPieces() : branche "création" (else) et branche "existante".
function fabNeuve(id, numero) {
  return {
    id: id, nom: id, icon: 'x', numero: numero || 1,
    dims: Object.assign({ l: 0, la: 0, h: 2.5, fenetres: 1, portes: 1 }, { l: 5, la: 4 }),
    config: {}, chauffageFonctions: null,
    elecMethode: 'saignee', elecGamme: 'std', ploGamme: 'std'
  };
}

// Pièces réellement créables (PIECES_DEF) + catégorie attendue (table validée P1).
const ATTENDU = {
  salon: 'logement', salle_manger: 'logement', cuisine: 'logement', bureau: 'logement',
  chambre: 'logement', dressing: 'logement', sdb: 'logement', sde: 'logement', wc: 'logement',
  entree: 'logement', couloir: 'logement', escalier: 'logement',
  cave: 'annexe', garage: 'annexe',
  terrasse: 'exterieur', jardin: 'exterieur', facade: 'exterieur', carport: 'exterieur'
};
const CREABLES = Object.keys(ATTENDU).concat(['veranda']);

// ===== §9.1 une pièce créée par le configurateur reçoit le socle =====
const pTest = fabNeuve('chambre');
appliquer([pTest]);
A(pTest.projet !== undefined, '§9.1 pièce fabriquée reçoit piece.projet');
A('categorieSurface' in pTest, '§9.1 pièce fabriquée reçoit categorieSurface (déterminable)');

// ===== §9.2 categorieSurface correcte quand déterminable (toutes les pièces créables) =====
Object.keys(ATTENDU).forEach(id => {
  const p = fabNeuve(id);
  appliquer([p]);
  A(p.categorieSurface === ATTENDU[id], '§9.2 ' + id + ' -> ' + ATTENDU[id] + ' (obtenu: ' + p.categorieSurface + ')');
});

// ===== §9.3 véranda reste indéterminée =====
const pver = fabNeuve('veranda');
appliquer([pver]);
A(pver.categorieSurface === undefined, '§9.3 véranda : categorieSurface indéterminée (non forcée)');
A(pver.projet !== undefined, '§9.3 véranda : projet quand même posé');

// ===== §9.4 projet présent avec le contrat attendu =====
const pj = fabNeuve('salon');
appliquer([pj]);
A(pj.projet && pj.projet.existant === null && pj.projet.cible === null && pj.projet.transformation === null,
  '§9.4 projet = { existant:null, cible:null, transformation:null }');
A(Object.keys(pj.projet).sort().join(',') === 'cible,existant,transformation', '§9.4 projet minimal (rien de plus)');

// ===== §9.5 dims inchangé =====
const pd = fabNeuve('cuisine');
const dimsAvant = JSON.stringify(pd.dims);
appliquer([pd]);
A(JSON.stringify(pd.dims) === dimsAvant, '§9.5 dims inchangé par le raccordement');
A(pd.dims.l === 5 && pd.dims.la === 4 && pd.dims.h === 2.5 && pd.dims.fenetres === 1 && pd.dims.portes === 1,
  '§9.5 structure dims préservée');
A(!('surface' in pd), '§9.5 aucune propriété piece.surface créée');

// ===== §9.6 propriétés métier historiques inchangées =====
const pm = fabNeuve('salon');
appliquer([pm]);
A(pm.chauffageFonctions === null && pm.elecMethode === 'saignee' && pm.elecGamme === 'std'
  && pm.ploGamme === 'std' && JSON.stringify(pm.config) === '{}' && pm.icon === 'x' && pm.numero === 1,
  '§9.6 champs métier historiques (chauffage/elec/plo/config/icon/numero) inchangés');

// ===== §9.7 pièce ajoutée manuellement (même fabrique) reçoit aussi le socle =====
// Les ajouts manuels et transformations passent par validerPieces (compteurs -> fabrique).
const manuelle = fabNeuve('bureau', 2);
appliquer([manuelle]);
A(manuelle.categorieSurface === 'logement' && manuelle.projet && manuelle.projet.existant === null,
  '§9.7 pièce ajoutée manuellement (via la fabrique) reçoit le socle');
// branche "existante" (fusion) : une pièce déjà normalisée n'est pas cassée (idempotence)
const avant = JSON.stringify(manuelle);
appliquer([manuelle]);
A(JSON.stringify(manuelle) === avant, '§9.7 ré-application idempotente (fusion/revalidation)');

// ===== §9.8 aucune pièce avec une catégorie inventée =====
CREABLES.forEach(id => {
  const p = fabNeuve(id);
  appliquer([p]);
  const c = p.categorieSurface;
  A(c === undefined || M.categorieSurfaceValide(c), '§9.8 ' + id + ' : catégorie dans la liste autorisée ou absente (jamais inventée)');
});

// ===== Non-régression : le raccordement ne modifie pas d'autres champs, sur un lot mixte =====
const lot = Object.keys(ATTENDU).concat(['veranda']).map((id, i) => fabNeuve(id, i + 1));
const empreinteAvant = lot.map(p => JSON.stringify({ id: p.id, dims: p.dims, config: p.config, elecMethode: p.elecMethode }));
appliquer(lot);
const empreinteApres = lot.map(p => JSON.stringify({ id: p.id, dims: p.dims, config: p.config, elecMethode: p.elecMethode }));
A(JSON.stringify(empreinteAvant) === JSON.stringify(empreinteApres), 'non-régression : id/dims/config/elecMethode inchangés sur tout le lot');
A(lot.every(p => (p.categorieSurface === undefined) || M.categorieSurfaceValide(p.categorieSurface)), 'non-régression : catégories toutes valides ou absentes');

// ---- Bilan --------------------------------------------------------------
console.log('raccordement-socle-lot39p2 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
