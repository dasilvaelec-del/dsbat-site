// tests/projet-socle-lot42p1.test.js — LOT42 P1.
// Socle « état existant -> état cible -> transformation » (conteneur piece.projet).
// Le socle STOCKE les états ; aucune règle de compatibilité d'usage, aucun moteur touché.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const M = require(path.join(RACINE, 'js', 'modele-projet.js'));
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'modele-projet.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ===== Vocabulaire exposé =====
const USAGES_ATTENDUS = ['sejour', 'salle_manger', 'cuisine', 'chambre', 'bureau', 'dressing',
  'sdb', 'sde', 'wc', 'entree', 'couloir', 'escalier', 'buanderie', 'cellier', 'garage', 'cave',
  'grenier', 'remise', 'terrasse', 'jardin', 'allee', 'carport', 'facade', 'veranda'];
A(Array.isArray(M.USAGES_PROJET) && M.USAGES_PROJET.length === USAGES_ATTENDUS.length
  && USAGES_ATTENDUS.every(u => M.USAGES_PROJET.indexOf(u) !== -1), 'USAGES_PROJET = vocabulaire attendu (24)');
A(JSON.stringify(M.TRANSFORMATIONS_PROJET) === JSON.stringify(['conserver', 'vers_logement', 'vers_annexe', 'demolition', 'creation']),
  'TRANSFORMATIONS_PROJET = conserver/vers_logement/vers_annexe/demolition/creation');

// ===== Projet vierge =====
const v = M.projetPieceVierge();
A(v.existant && v.existant.usage === null && v.existant.categorieSurface === null, 'vierge : existant = {usage:null, categorieSurface:null}');
A(v.cible && v.cible.usage === null && v.cible.categorieSurface === null, 'vierge : cible = {usage:null, categorieSurface:null}');
A(v.transformation === null, 'vierge : transformation = null');
A(Object.keys(v).sort().join(',') === 'cible,existant,transformation', 'vierge : exactement {existant, cible, transformation}');
A(Object.keys(v.existant).sort().join(',') === 'categorieSurface,usage', 'vierge : existant limité à {usage, categorieSurface}');
// deux appels -> objets indépendants (pas de référence partagée)
const v2 = M.projetPieceVierge(); v2.existant.usage = 'cave';
A(M.projetPieceVierge().existant.usage === null, 'vierge : chaque appel renvoie un objet neuf (pas d\'état partagé)');

// ===== Validation usage =====
['chambre', 'garage', 'cave', 'grenier', 'buanderie', 'veranda', 'sejour', 'allee'].forEach(u =>
  A(M.usageProjetValide(u) === true, 'usage valide : ' + u));
['salon', 'xxx', '', null, undefined, 'CHAMBRE', 'logement'].forEach(u =>
  A(M.usageProjetValide(u) === false, 'usage invalide refusé : ' + String(u)));

// ===== Validation transformation =====
['conserver', 'vers_logement', 'vers_annexe', 'demolition', 'creation'].forEach(t =>
  A(M.transformationProjetValide(t) === true, 'transformation valide : ' + t));
['vers_exterieur', 'foo', '', null, undefined, 'Conserver'].forEach(t =>
  A(M.transformationProjetValide(t) === false, 'transformation invalide refusée : ' + String(t)));

// ===== categorieSurface : réutilise l'API LOT39 (pas de doublon) =====
A(typeof M.categorieSurfaceValide === 'function' && M.categorieSurfaceValide('logement') && M.categorieSurfaceValide('annexe')
  && M.categorieSurfaceValide('exterieur') && !M.categorieSurfaceValide('xxx'),
  'categorieSurface validée via l\'API LOT39 existante');
A((SRC.match(/CATEGORIES_SURFACE\s*=/g) || []).length === 1, 'pas de doublon de la table des catégories (une seule définition)');

// ===== Conservation LOT39 : categorieSurface, dims, config =====
const piece = { id: 'chambre', nom: 'Chambre 1', icon: '🛏️', numero: 1,
  dims: { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: { peinture: { PEINT_MUR_STD: 10 } },
  categorieSurface: 'logement', elecMethode: 'saignee' };
const snap = JSON.stringify(piece);
M.normaliserPieceSocle(piece);
A(piece.categorieSurface === 'logement', 'LOT39 : categorieSurface conservée (non remplacée)');
A(piece.dims.l === 4 && piece.dims.la === 3 && piece.dims.h === 2.5 && piece.dims.fenetres === 1 && piece.dims.portes === 1, 'dims conservées');
A(JSON.stringify(piece.config) === '{"peinture":{"PEINT_MUR_STD":10}}', 'config conservée à l\'identique');
A(piece.id === 'chambre' && piece.nom === 'Chambre 1' && piece.elecMethode === 'saignee', 'id/nom/champs métier conservés');
A(!('surface' in piece), 'aucune propriété piece.surface créée');
// additif : seules categorieSurface(déjà là) + projet ajoutés
const avantKeys = JSON.parse(snap); // objet d'origine
A(Object.keys(piece).filter(k => Object.keys(avantKeys).indexOf(k) === -1).sort().join(',') === 'projet', 'normalisation : seul « projet » ajouté');

// ===== Rétrocompatibilité : pièce sans projet =====
const legacy = { id: 'cuisine', dims: { l: 3, la: 3 }, config: {} };
A(legacy.projet === undefined, 'pré-condition : pièce legacy sans projet');
M.normaliserPieceSocle(legacy);
A(legacy.projet && legacy.projet.existant.usage === null && legacy.projet.transformation === null, 'rétrocompat : projet vierge posé sur une pièce sans projet');
A(legacy.categorieSurface === 'logement', 'rétrocompat : categorieSurface dérivée (cuisine -> logement)');

// ===== Normalisation d'une pièce existante : idempotence + non-écrasement =====
const avant = JSON.stringify(legacy);
M.normaliserPieceSocle(legacy);
A(JSON.stringify(legacy) === avant, 'normalisation idempotente (2e passage sans effet)');
// un projet déjà présent (même forme libre) n'est jamais écrasé
const dejaP = { id: 'salon', dims: {}, config: {}, projet: { existant: { usage: 'garage', categorieSurface: 'annexe' }, cible: { usage: 'chambre', categorieSurface: 'logement' }, transformation: 'vers_logement' } };
M.normaliserPieceSocle(dejaP);
A(dejaP.projet.existant.usage === 'garage' && dejaP.projet.cible.usage === 'chambre' && dejaP.projet.transformation === 'vers_logement',
  'projet déjà renseigné NON écrasé (le socle stocke, n\'arbitre pas)');

// ===== Aucune règle de compatibilité d'usage (stockage pur) =====
// garage -> chambre (incohérent métier) est STOCKABLE sans erreur : le socle ne juge pas.
const libre = M.projetPieceVierge();
libre.existant.usage = 'garage'; libre.cible.usage = 'chambre'; libre.transformation = 'vers_logement';
A(M.usageProjetValide(libre.existant.usage) && M.usageProjetValide(libre.cible.usage) && M.transformationProjetValide(libre.transformation),
  'aucune règle de compatibilité : garage->chambre stocké tel quel (valeurs valides)');
A(typeof M.usageCompatible === 'undefined' && typeof M.transformationAutorisee === 'undefined'
  && typeof M.compatibiliteUsage === 'undefined',
  'aucune API de compatibilité d\'usage exposée (le socle stocke, n\'arbitre pas)');

// ===== Aucun changement de comportement métier (pas de moteur référencé) =====
A(!/moteurs\/|getElecPourPiece|getPrestationsPourPiece|appliquerRevetements/.test(SRC), 'le modèle ne référence aucun moteur métier');

console.log('projet-socle-lot42p1 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
