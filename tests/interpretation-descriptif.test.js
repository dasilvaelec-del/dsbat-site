// =====================================================================
// tests/interpretation-descriptif.test.js — Preuves M4 (interprétation)
// =====================================================================
// Vérifie que interpreterDescriptif() transforme le texte libre en INTENTIONS
// À CONFIRMER, sans jamais : prix, quantité de devis, prestation, modification
// de métier/pièce/gamme. Statut toujours a_confirmer/incertain (jamais confirme).
// Hors ligne, in-process. N'importe aucun moteur.
// =====================================================================

const path = require('path');
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);
const has = (r, sub) => J(r).toLowerCase().indexOf(sub.toLowerCase()) !== -1;
const el = (r, pred) => r.elementsDetectes.some(pred);
const q = (r, type) => r.questionsAConfirmer.some(x => x.type === type);
// « aucun prix » = aucune VALEUR monétaire calculée (€, totalHT, montant chiffré).
// NB : le mot « prix » peut apparaître dans une phrase de garde (« ni quantité ni prix calculés ») — ce n'est pas un prix.
const aucunPrix = (r) => !/€|totalht|prixtotal|[0-9]\s?(eur|euro)/i.test(J(r));
const aucunConfirme = (r) => r.elementsDetectes.every(e => e.statut === 'a_confirmer' || e.statut === 'incertain') && r.confirmations.length === 0;

// TEST 1
let r = I.interpreterDescriptif("Je veux refaire ma salle de bain et remplacer la baignoire par une douche à l'italienne.",
  { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
A(el(r, e => e.pieceId === 'sdb'), 'T1 salle de bain détectée');
A(el(r, e => e.action === 'renovation'), 'T1 action rénovation (refaire)');
A(has(r, 'baignoire'), 'T1 baignoire détectée');
A(el(r, e => e.action === 'remplacement'), 'T1 remplacement détecté');
A(has(r, 'douche'), 'T1 douche détectée');
A(aucunConfirme(r), 'T1 tout en a_confirmer/incertain (rien de confirmé)');
A(aucunPrix(r), 'T1 aucun prix');

// TEST 2
r = I.interpreterDescriptif("Je veux refaire toute l'électricité de la maison.", { piecesPresentes: [], metiersActifs: ['electricite'] });
A(el(r, e => e.metier === 'electricite'), 'T2 électricité détectée');
A(el(r, e => e.action === 'renovation'), 'T2 action rénovation');
A(!q(r, 'metier_non_selectionne'), 'T2 aucun conflit (élec déjà sélectionnée) → pas de question métier');
A(aucunPrix(r), 'T2 aucun prix');
// métier non sélectionné → question (et non activation)
let r2b = I.interpreterDescriptif("refaire toute l'électricité", { piecesPresentes: [], metiersActifs: [] });
A(q(r2b, 'metier_non_selectionne'), 'T2b métier non sélectionné → question (pas d\'activation auto)');

// TEST 3
r = I.interpreterDescriptif("Je voudrais enlever le vieux carrelage de la cuisine et en mettre un nouveau.",
  { piecesPresentes: ['cuisine'], metiersActifs: ['carrelage'] });
A(el(r, e => e.pieceId === 'cuisine'), 'T3 cuisine détectée');
A(el(r, e => e.action === 'depose' && has({ elementsDetectes: [e] }, 'carrelage')), 'T3 dépose carrelage');
A(el(r, e => e.action === 'installation'), 'T3 pose nouveau (mettre)');
A(has(r, 'nouveau'), 'T3 « nouveau » carrelage détecté');
A(q(r, 'depose_evacuation'), 'T3 dépose/évacuation potentielle → question');
A(aucunPrix(r), 'T3 aucun prix');

// TEST 4
r = I.interpreterDescriptif("Je veux refaire les deux salles de bain.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
A(el(r, e => e.quantite === 2 && e.pieceId === 'sdb'), 'T4 quantité 2 détectée sur salle de bain');
A(q(r, 'quantite_divergente'), 'T4 1 configurée vs 2 → question de confirmation');
A(aucunPrix(r), 'T4 aucune modification / aucun prix');

// TEST 5
r = I.interpreterDescriptif("Je veux quelque chose de haut de gamme partout.", { piecesPresentes: [], metiersActifs: [] });
A(has(r, 'haut de gamme') || r.questionsAConfirmer.some(x => x.type === 'gamme_a_clarifier'), 'T5 préférence haut de gamme détectée');
A(q(r, 'gamme_a_clarifier'), 'T5 clarification par poste requise (aucune gamme appliquée)');
A(aucunPrix(r), 'T5 aucun prix / aucune gamme appliquée');

// TEST 6
r = I.interpreterDescriptif("Peut-être refaire la cuisine plus tard.", { piecesPresentes: ['cuisine'], metiersActifs: [] });
A(el(r, e => e.pieceId === 'cuisine'), 'T6 intention cuisine détectée');
A(el(r, e => e.statut === 'incertain'), 'T6 statut incertain (ambigu)');
A(r.hypotheses.length > 0, 'T6 versée dans hypotheses');
A(r.confirmations.length === 0, 'T6 aucune prestation / rien de confirmé');

// TEST 7
r = I.interpreterDescriptif("", { piecesPresentes: [], metiersActifs: [] });
A(r.elementsDetectes.length === 0 && r.questionsAConfirmer.length === 0 && r.demandes.length === 0, 'T7 texte vide → aucune interprétation');

// Pureté : ctx non muté, aucune prestation/quantité de devis écrite nulle part
const ctx = { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] };
const gel = J(ctx);
I.interpreterDescriptif("remplacer la baignoire", ctx);
A(J(ctx) === gel, 'PURETÉ : ctx (pièces/métiers) non modifié');

const total = ok + ko;
if (ko === 0) console.log('✅ Interprétation descriptif (M4) : ' + ok + '/' + total + ' — intentions à confirmer, aucun prix, rien de confirmé');
else console.error('❌ Interprétation (M4) : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
