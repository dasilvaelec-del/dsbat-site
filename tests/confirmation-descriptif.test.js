// =====================================================================
// tests/confirmation-descriptif.test.js — Preuves M5 (moteur de confirmation)
// =====================================================================
// Pilote la VRAIE sortie M4 (interpretation) puis applique des réponses client.
// Vérifie : confirme/modifie/refuse ; interprétation originale IMMUABLE ;
// correction conservée ; aucune modif config/métier/quantité/gamme/prix.
// Hors ligne, in-process. N'importe aucun moteur métier.
// =====================================================================

const path = require('path');
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
const C = require(path.join(__dirname, '..', 'js', 'confirmation-descriptif.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);
const premierElement = (r) => r.elementsDetectes[0];
const questionType = (r, t) => r.questionsAConfirmer.find(q => q.type === t);
const aucunPrix = (r) => !/€|totalht|prixtotal|[0-9]\s?(eur|euro)/i.test(J(r));
const HORO = '2026-01-01T10:00:00Z';

// ---- TEST 1 : Oui → confirmation structurée ----
let interp = I.interpreterDescriptif("Je veux remplacer ma baignoire par une douche à l'italienne.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let el = premierElement(interp);
let r = C.construireConfirmations(interp, { [el.id]: { action: 'oui' } }, { horodatage: HORO });
let cf = r.confirmations[0];
A(cf && cf.statut === 'confirme', 'T1 statut = confirme');
A(cf.type === 'element' && cf.refElement === el.id, 'T1 référence à l\'élément M4');
A(cf.valeurConfirmee === el.element, 'T1 valeurConfirmee = intention comprise');
A(cf.horodatage === HORO, 'T1 horodatage injecté conservé');
A(aucunPrix(r), 'T1 aucun prix');

// ---- TEST 2 : Non → refus ----
r = C.construireConfirmations(interp, { [el.id]: { action: 'non' } });
cf = r.confirmations[0];
A(cf.statut === 'refuse' && cf.valeurConfirmee === null, 'T2 refus → valeurConfirmee null');

// ---- TEST 3 : Modifier → historique complet conservé ----
r = C.construireConfirmations(interp, { [el.id]: { action: 'modifier', texte: 'Je veux une douche classique.' } });
cf = r.confirmations[0];
A(cf.statut === 'modifie', 'T3 statut = modifie');
A(cf.interpretationOriginale.element === el.element, 'T3 interprétation ORIGINALE conservée (baignoire → douche italienne)');
A(cf.reponseClient === 'Je veux une douche classique.', 'T3 correction client conservée');
A(cf.valeurConfirmee === 'Je veux une douche classique.', 'T3 valeur confirmée = correction');
A(Object.isFrozen(cf.interpretationOriginale), 'T3 interprétation originale IMMUABLE (gelée)');

// ---- TEST 4 : « deux salles de bain » (config 1), Oui → confirmé, compteur inchangé ----
let interp4 = I.interpreterDescriptif("Je veux refaire les deux salles de bain.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let elQ = interp4.elementsDetectes.find(e => e.quantite === 2) || premierElement(interp4);
r = C.construireConfirmations(interp4, { [elQ.id]: { action: 'oui' } });
A(r.confirmations[0].statut === 'confirme', 'T4 intention 2 sdb confirmée');
A(!/piecesselectionnees|compteur/i.test(J(r)), 'T4 aucune modification du compteur de pièces');

// ---- TEST 5 : métier plomberie absent, Oui → demande confirmée, métier NON activé ----
let interp5 = I.interpreterDescriptif("refaire la plomberie de la salle de bain", { piecesPresentes: ['sdb'], metiersActifs: [] });
let qMet = questionType(interp5, 'metier_non_selectionne');
A(!!qMet, 'T5 M4 a bien produit la question métier non sélectionné');
r = C.construireConfirmations(interp5, { [qMet.id]: { action: 'oui' } });
cf = r.confirmations[0];
A(cf.statut === 'confirme' && cf.type === 'question', 'T5 demande confirmée (question)');
A(!/metiersactifs/i.test(J(r)), 'T5 aucun métier activé automatiquement');

// ---- TEST 6 : ambigu « peut-être… plus tard », Non → refus ----
let interp6 = I.interpreterDescriptif("Peut-être refaire la cuisine plus tard.", { piecesPresentes: ['cuisine'], metiersActifs: [] });
let elAmb = interp6.elementsDetectes.find(e => e.statut === 'incertain') || premierElement(interp6);
r = C.construireConfirmations(interp6, { [elAmb.id]: { action: 'non' } });
A(r.confirmations[0].statut === 'refuse', 'T6 intention incertaine refusée');

// ---- TEST 7 : « haut de gamme partout », confirmable, aucune gamme appliquée ----
let interp7 = I.interpreterDescriptif("Je veux quelque chose de haut de gamme partout.", { piecesPresentes: [], metiersActifs: [] });
let qG = questionType(interp7, 'gamme_a_clarifier');
A(!!qG, 'T7 M4 a bien produit la question gamme à clarifier');
r = C.construireConfirmations(interp7, { [qG.id]: { action: 'oui' } });
A(r.confirmations[0].statut === 'confirme', 'T7 préférence confirmable');
A(!/elecgamme|plogamme|qualitemateriaux|"gamme":/i.test(J(r)), 'T7 aucune gamme effectivement appliquée');

// ---- TEST 8 : aucune interprétation → aucun écran de confirmation ----
let interpVide = I.interpreterDescriptif("", { piecesPresentes: [], metiersActifs: [] });
r = C.construireConfirmations(interpVide, {});
A(r.confirmations.length === 0 && r.enAttente.length === 0, 'T8 aucune interprétation → aucune confirmation');

// ---- PURETÉ : l'entrée M4 n'est jamais mutée ----
const gel = J(interp);
C.construireConfirmations(interp, { [el.id]: { action: 'modifier', texte: 'autre chose' } });
A(J(interp) === gel, 'PURETÉ : interprétation M4 (entrée) non modifiée');

const total = ok + ko;
if (ko === 0) console.log('✅ Confirmation descriptif (M5) : ' + ok + '/' + total + ' — interprété→confirmé, original immuable, aucun prix/config');
else console.error('❌ Confirmation (M5) : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
