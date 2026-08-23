// =====================================================================
// tests/synthese-aic.test.js — Preuves M8 (objet AIC pur)
// =====================================================================
// Couvre A→R : sections déclaré/interprété/confirmé/configuré/prestations ;
// 4 catégories « à vérifier en visite » (jamais mélangées) ; aucune donnée
// inventée ; pureté complète ; aucun prix ; aucun Runtime ; texte verbatim ;
// déterminisme (genereLe injecté).
// =====================================================================

const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'synthese-aic.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);
const NOW = '2026-01-01T00:00:00Z';
const cat = (r, c) => r.aVerifierVisite.filter(x => x.categorie === c);

// ---- A : AIC vide mais valide ----
let vide = S.construireAIC({}, { now: NOW });
A(vide.$vue === 'dsbat.aic' && vide.genereLe === NOW, 'A: AIC vide valide ($vue + genereLe injecté)');
A(vide.declare && vide.interprete && vide.confirme && vide.configure && vide.prestations && Array.isArray(vide.aVerifierVisite), 'A: toutes les sections présentes');
A(vide.interprete.elements.length === 0 && vide.prestations.retenues.length === 0 && vide.aVerifierVisite.length === 0, 'A: sections vides (rien inventé)');

// ---- Entrée réaliste ----
const input = {
  chantier: { typeBien: 'maison', surface: 70, tableauExistant: 'inconnu', chauffage: 'autre', eauChaude: 'ballon', vmc: 'defaillante', description: "Refaire la SDB : d'eau, à l'italienne\nrepeindre." },
  interpretation: { elementsDetectes: [{ id: 'el_1', pieceId: 'sdb', metier: 'plomberie', action: 'installation', element: 'douche', quantite: null, statut: 'a_confirmer' }], questionsAConfirmer: [{ id: 'q_1', type: 'gamme_a_clarifier', texte: 'Gamme ?' }] },
  confirmations: { confirmations: [{ id: 'cf_1', refElement: 'el_1', statut: 'confirme', valeurConfirmee: 'douche' }] },
  piecesSelectionnees: [
    { id: 'sdb', numero: 1, nom: 'Salle de bain', dims: { l: 2, la: 2, h: 2.5 }, config: { plomberie: { PLO_DOUCHE_ITAL: 1 } }, elecGamme: 'mosaic', ploGamme: 'standard' },
    { id: 'chambre', numero: 1, nom: 'Chambre 1', dims: { l: 0, la: 0, h: 2.5 }, config: {}, elecGamme: 'mosaic', ploGamme: 'standard' } // cotes manquantes
  ],
  metiersActifs: ['plomberie', 'peinture'], // peinture = surfacique
  modifications: [
    { type: 'ajout_piece', cible: 'sdb', avant: 0, apres: 1, horodatage: NOW },
    { type: 'prestation', code: 'PLO_DOUCHE_ITAL', quantite: 1, horodatage: NOW } // doit être EXCLU de configure.modifications
  ],
  prestationsDecisions: {
    'el_1|PLO_DOUCHE_ITAL': { decision: 'appliquee', pieceRef: 'sdb#1', metier: 'plomberie', code: 'PLO_DOUCHE_ITAL', quantite: 1, role: 'pose', avant: null },
    'el_1|PLO_BAIGNOIRE': { decision: 'a_verifier', code: 'PLO_BAIGNOIRE', role: 'depose', pieceRef: 'sdb#1', metier: 'plomberie' },
    'inst|el_1': { ref: 'sdb#1' }
  },
  alertesCoherence: [{ niveau: 'attention', texte: 'Chambre 1 : dimensions non renseignées — comptées à 0 €.' }]
};
const gel = J(input);
let r = S.construireAIC(input, { now: NOW, resolveLabel: (c) => ({ PLO_DOUCHE_ITAL: "Douche à l'italienne", PLO_BAIGNOIRE: 'Baignoire' }[c] || null) });

// ---- B : descriptif restitué verbatim ----
A(r.declare.description === input.chantier.description, 'B: descriptif présent → restitué (verbatim)');

// ---- C : éléments M4 ----
A(r.interprete.elements.length === 1 && r.interprete.elements[0].id === 'el_1' && r.interprete.questions.length === 1, 'C: interprete = éléments + questions M4');

// ---- D : confirmations M5 ----
A(r.confirme.decisions.length === 1 && r.confirme.decisions[0].statut === 'confirme', 'D: confirme = décisions M5');

// ---- E : modifications M6 (prestation exclue) ----
A(r.configure.modifications.length === 1 && r.configure.modifications[0].type === 'ajout_piece', 'E: configure.modifications = M6 (entrée prestation exclue)');

// ---- F : pièces configurées (sans prix/config brute) ----
A(r.configure.pieces.length === 2 && r.configure.pieces[0].ref === 'sdb#1' && r.configure.pieces[0].type === 'sdb', 'F: configure.pieces (ref/type/dims)');
A(!/totalht|"config":|getmoyenprix/i.test(J(r.configure.pieces)), 'F: aucune config brute / aucun prix dans configure.pieces');

// ---- G : prestations retenues M7 ----
let pr = r.prestations.retenues;
A(pr.length === 1 && pr[0].code === 'PLO_DOUCHE_ITAL' && pr[0].quantite === 1 && pr[0].role === 'pose' && pr[0].label === "Douche à l'italienne", 'G: prestations.retenues (M7 appliquée, label résolu)');

// ---- H : dépose non couverte ----
let dep = cat(r, 'depose_non_couverte');
A(dep.length === 1 && dep[0].code === undefined && dep[0].source === 'prestation' && !/€|prix/i.test(J(dep[0])), 'H: depose_non_couverte (marquée client, sans prix)');

// ---- I : tableau électrique inconnu ----
let itk = cat(r, 'info_technique_inconnue');
A(itk.some(x => /tableau/i.test(x.element) && x.source === 'questionnaire'), 'I: tableau « inconnu » → info_technique_inconnue');
A(itk.some(x => /VMC/i.test(x.element)) && itk.some(x => /chauffage/i.test(x.element)), 'I: VMC défaillante + chauffage « autre » → info_technique_inconnue');

// ---- J : dimensions réellement manquantes (métier surfacique actif) ----
let dm = cat(r, 'dimension_manquante');
A(dm.length === 1 && dm[0].pieceRef === 'chambre#1' && dm[0].source === 'configuration', 'J: dimension_manquante (Chambre 1, peinture active)');
let sansSurf = S.construireAIC({ piecesSelectionnees: [{ id: 'chambre', numero: 1, dims: { l: 0, la: 0 }, config: {} }], metiersActifs: ['electricite'] }, { now: NOW });
A(cat(sansSurf, 'dimension_manquante').length === 0, 'J: aucune dimension_manquante si aucun métier surfacique (pas de faux positif)');

// ---- K : écart de cohérence ----
let ec = cat(r, 'ecart_coherence');
A(ec.length === 1 && /dimensions non renseignées/.test(ec[0].element) && ec[0].source === 'configuration', 'K: ecart_coherence depuis alertes réelles');

// ---- L : séparation stricte des catégories ----
A(r.aVerifierVisite.every(x => ['depose_non_couverte', 'info_technique_inconnue', 'dimension_manquante', 'ecart_coherence'].indexOf(x.categorie) !== -1), 'L: uniquement les 4 catégories, aucune fusion');
A(!J(r.interprete).includes('PLO_DOUCHE_ITAL') && !J(r.confirme).includes('a_verifier'), 'L: niveaux non fusionnés (interprété ≠ prestation ≠ confirmé)');

// ---- M : aucune donnée inventée ----
let sansResolver = S.construireAIC(input, { now: NOW });
A(sansResolver.prestations.retenues[0].label === null, 'M: label null si aucun resolver (rien inventé)');
A(sansResolver.prestations.retenues.every(x => x.code === 'PLO_DOUCHE_ITAL'), 'M: codes uniquement issus de l\'entrée');

// ---- N : pureté complète ----
A(J(input) === gel, 'N: entrée non mutée');
A(J(input.piecesSelectionnees) === J([
  { id: 'sdb', numero: 1, nom: 'Salle de bain', dims: { l: 2, la: 2, h: 2.5 }, config: { plomberie: { PLO_DOUCHE_ITAL: 1 } }, elecGamme: 'mosaic', ploGamme: 'standard' },
  { id: 'chambre', numero: 1, nom: 'Chambre 1', dims: { l: 0, la: 0, h: 2.5 }, config: {}, elecGamme: 'mosaic', ploGamme: 'standard' }
]), 'N: piecesSelectionnees & piece.config inchangés');

// ---- O : aucun prix PRODUIT par M8 (le « € » éventuel provient d'un texte d'alerte porté verbatim) ----
A(!/totalht|getmoyenprix|prixtotal|\bttc\b/i.test(J(r)), 'O: aucun champ de prix produit par M8');
A(r.aVerifierVisite.every(x => !/€|euro|[0-9]+\s?(eur|€)/i.test(x.impactDevis)), 'O: aucun montant dans impactDevis (généré par M8)');
A(J(r.prestations).indexOf('€') === -1 && J(r.configure).indexOf('€') === -1 && J(r.declare.chantier).indexOf('€') === -1, 'O: aucun € dans prestations/configuré/chantier (prix non calculé)');

// ---- P : aucun appel / référence Runtime ----
A(!/runtime|__obtenirDevis|127\.0\.0\.1|coefZone|calculerDevis/i.test(J(r)), 'P: aucune référence Runtime/calcul global');

// ---- Q : texte accentué / apostrophes / retours ligne préservés (pas d'échappement HTML) ----
A(r.declare.description.indexOf("d'eau") !== -1 && r.declare.description.indexOf('\n') !== -1 && r.declare.description.indexOf('&#39;') === -1 && r.declare.description.indexOf('&amp;') === -1, 'Q: accents/apostrophes/retours ligne verbatim (aucun échappement)');

// ---- R : déterminisme ----
let r2 = S.construireAIC(input, { now: NOW, resolveLabel: (c) => ({ PLO_DOUCHE_ITAL: "Douche à l'italienne", PLO_BAIGNOIRE: 'Baignoire' }[c] || null) });
A(J(r) === J(r2), 'R: même entrée + même now → même structure (déterministe)');

const total = ok + ko;
if (ko === 0) console.log('✅ Synthèse AIC (M8) : ' + ok + '/' + total + ' — vue dérivée pure, 4 catégories séparées, aucun prix/Runtime');
else console.error('❌ M8 : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
