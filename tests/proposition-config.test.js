// =====================================================================
// tests/proposition-config.test.js — Preuves M6 (confirmé → proposition de config)
// =====================================================================
// Vérifie : propositions AVANT/APRÈS ; transformations/réductions PILOTÉES par
// paramètres client (aucune heuristique) ; appliquerProposition() PUR (n'altère
// rien) ; dimensions jamais inventées ; gamme jamais appliquée ; annulation ;
// aucun prix. Pilote la vraie sortie M4 + M5 pour les cas dérivables.
// =====================================================================

const path = require('path');
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
const C = require(path.join(__dirname, '..', 'js', 'confirmation-descriptif.js'));
const P = require(path.join(__dirname, '..', 'js', 'proposition-config.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);
const aucunPrix = (o) => !/€|totalht|prixtotal|[0-9]\s?(eur|euro)|"prix"/i.test(J(o));

// helper : confirme un élément/question par id
const confirmer = (ids) => ({ confirmations: ids.map(id => ({ refElement: id, statut: 'confirme' })) });
const propType = (r, t) => r.propositions.find(p => p.type === t);

// ---- TEST A : 1 salle de bain → demande confirmée de 2 → ajout_quantite ----
let interp = I.interpreterDescriptif("Je veux refaire mes deux salles de bain.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let elA = interp.elementsDetectes.find(e => e.pieceId === 'sdb' && e.quantite === 2);
A(!!elA, 'A: M4 détecte 2 salles de bain');
let rA = P.construirePropositions(interp, confirmer([elA.id]), { compteurs: { sdb: 1 }, metiersActifs: ['plomberie'] });
let pA = propType(rA, 'ajout_quantite');
A(pA && pA.cible === 'sdb' && pA.avant === 1 && pA.apres === 2 && pA.delta === 1, 'A: proposition ajout_quantite sdb 1→2');
A(pA.statut === 'a_valider' && pA.necessiteDimensions === true, 'A: à valider + dimensions requises');

// ---- TEST B : garage absent → demande confirmée → ajout_piece ----
let interpB = I.interpreterDescriptif("Je veux aussi refaire le garage.", { piecesPresentes: [], metiersActifs: [] });
let elB = interpB.elementsDetectes.find(e => e.pieceId === 'garage');
A(!!elB, 'B: M4 détecte le garage');
let rB = P.construirePropositions(interpB, confirmer([elB.id]), { compteurs: {}, metiersActifs: [] });
let pB = propType(rB, 'ajout_piece');
A(pB && pB.cible === 'garage' && pB.avant === 0 && pB.apres === 1, 'B: proposition ajout_piece garage 0→1');

// ---- TEST C : transformation 2 chambres → 1 chambre + 1 bureau (source fournie) ----
let pC = P.construireTransformation('chambre', 'bureau', { compteurs: { chambre: 2 } });
A(pC.applicable && pC.avant.chambre === 2 && pC.avant.bureau === 0 && pC.apres.chambre === 1 && pC.apres.bureau === 1, 'C: transformation 2ch→1ch+1bureau');
let etatC = P.appliquerProposition(pC, { compteurs: { chambre: 2 }, metiersActifs: [] });
A(etatC.compteurs.chambre === 1 && etatC.compteurs.bureau === 1, 'C: application → chambre 1, bureau 1');
// source jamais devinée : sans source valide → non applicable
let pC0 = P.construireTransformation('chambre', 'bureau', { compteurs: { chambre: 0 } });
A(pC0.applicable === false && pC0.actions.length === 0, 'C: aucune pièce source → non applicable (jamais deviné)');

// ---- TEST D : 2 chambres → 3 → ajout d'une chambre ----
let interpD = I.interpreterDescriptif("Je veux trois chambres.", { piecesPresentes: [], metiersActifs: [] });
let elD = interpD.elementsDetectes.find(e => e.pieceId === 'chambre' && e.quantite === 3);
A(!!elD, 'D: M4 détecte 3 chambres');
let rD = P.construirePropositions(interpD, confirmer([elD.id]), { compteurs: { chambre: 2 }, metiersActifs: [] });
let pD = propType(rD, 'ajout_quantite');
A(pD && pD.cible === 'chambre' && pD.avant === 2 && pD.apres === 3 && pD.delta === 1, 'D: ajout_quantite chambre 2→3');

// ---- TEST E : réduction 2 chambres → 1 (pilotée client) ----
let pE = P.construireReduction('chambre', 1, { compteurs: { chambre: 2 } });
A(pE.applicable && pE.avant === 2 && pE.apres === 1 && pE.delta === -1, 'E: réduction chambre 2→1');
let etatE = P.appliquerProposition(pE, { compteurs: { chambre: 2 }, metiersActifs: [] });
A(etatE.compteurs.chambre === 1, 'E: application → chambre 1');

// ---- TEST F : plomberie non sélectionnée → proposition d'ajout de métier ----
let interpF = I.interpreterDescriptif("Je veux refaire la plomberie de la salle de bain.", { piecesPresentes: ['sdb'], metiersActifs: [] });
let elF = interpF.elementsDetectes.find(e => e.metier === 'plomberie');
A(!!elF, 'F: M4 détecte le métier plomberie');
let rF = P.construirePropositions(interpF, confirmer([elF.id]), { compteurs: { sdb: 1 }, metiersActifs: [] });
let pF = propType(rF, 'ajout_metier');
A(pF && pF.cible === 'plomberie', 'F: proposition ajout_metier plomberie');
let etatF = P.appliquerProposition(pF, { compteurs: { sdb: 1 }, metiersActifs: [] });
A(etatF.metiersActifs.indexOf('plomberie') !== -1, 'F: application → plomberie ajoutée');

// ---- TEST G : pièce ajoutée → dimensions à renseigner, aucune inventée ----
A(pB.necessiteDimensions === true, 'G: ajout de pièce → dimensions requises');
A(!/dims|"l":|"la":|"h":/i.test(J(rB)), 'G: aucune dimension inventée dans la proposition');

// ---- TEST H : gamme haut de gamme → aucune application automatique ----
let interpH = I.interpreterDescriptif("Je veux quelque chose de haut de gamme partout.", { piecesPresentes: [], metiersActifs: [] });
let qH = interpH.questionsAConfirmer.find(q => q.type === 'gamme_a_clarifier');
let rH = P.construirePropositions(interpH, confirmer([qH.id]), { compteurs: {}, metiersActifs: [] });
let pH = propType(rH, 'preference_gamme');
A(pH && pH.actions.length === 0, 'H: préférence_gamme sans action (aucune gamme appliquée)');
let etatH = P.appliquerProposition(pH, { compteurs: { sdb: 1 }, metiersActifs: ['plomberie'] });
A(J(etatH.compteurs) === J({ sdb: 1 }) && J(etatH.metiersActifs) === J(['plomberie']), 'H: application gamme → configuration inchangée');

// ---- TEST I : annulation → configuration inchangée ----
let etat0 = { compteurs: { chambre: 2 }, metiersActifs: [] };
let apres = P.appliquerProposition(pC, etat0);
let retour = P.appliquerProposition(P.inverser(pC), apres);
A(retour.compteurs.chambre === etat0.compteurs.chambre && (retour.compteurs.bureau || 0) === 0, 'I: annulation (inverser) → compteurs restaurés');

// ---- TEST J : retour arrière → état précédent récupérable (snapshot) ----
let snap = P.journaliser(pC, 'appliquer', etat0, apres, '2026-01-01T00:00:00Z');
A(snap.avant.compteurs.chambre === 2 && snap.apres.compteurs.chambre === 1 && snap.type === 'transformation', 'J: journal conserve avant/après (traçabilité)');

// ---- TEST K : aucun prix nulle part ----
A(aucunPrix(rA) && aucunPrix(rB) && aucunPrix(pC) && aucunPrix(pE) && aucunPrix(rF) && aucunPrix(rH), 'K: aucun prix dans les propositions');

// ---- PURETÉ : appliquerProposition ne modifie pas l'état d'entrée ----
let etatIn = { compteurs: { chambre: 2 }, metiersActifs: ['peinture'] };
let gel = J(etatIn);
P.appliquerProposition(pC, etatIn);
P.appliquerProposition(pF, etatIn);
A(J(etatIn) === gel, 'PURETÉ : état d\'entrée non modifié par appliquerProposition');
// PURETÉ : construirePropositions ne modifie pas l'interprétation
let gelInterp = J(interp);
P.construirePropositions(interp, confirmer([elA.id]), { compteurs: { sdb: 1 }, metiersActifs: [] });
A(J(interp) === gelInterp, 'PURETÉ : interprétation M4 non modifiée');

const total = ok + ko;
if (ko === 0) console.log('✅ Proposition config (M6) : ' + ok + '/' + total + ' — confirmé→proposé, pilotage client, appliquer pur, aucun prix');
else console.error('❌ M6 : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
