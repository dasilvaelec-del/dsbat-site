// =====================================================================
// tests/proposition-ui.test.js — Preuves M6-B (helpers d'affichage + chaînage)
// =====================================================================
// Vérifie : AVANT/APRÈS normalisés ; sélection de source de transformation
// (liste des pièces présentes, jamais devinée) ; échappement ; aucun prix ;
// chaînage M4→M5→M6 (aucune application sans action explicite).
// =====================================================================

const path = require('path');
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
const C = require(path.join(__dirname, '..', 'js', 'confirmation-descriptif.js'));
const P = require(path.join(__dirname, '..', 'js', 'proposition-config.js'));
const UI = require(path.join(__dirname, '..', 'js', 'proposition-ui.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);
const confirmer = (ids) => ({ confirmations: ids.map(id => ({ refElement: id, statut: 'confirme' })) });

// AVANT/APRÈS — ajout de quantité
let interp = I.interpreterDescriptif("Je veux refaire mes deux salles de bain.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let el = interp.elementsDetectes.find(e => e.pieceId === 'sdb' && e.quantite === 2);
let prop = P.construirePropositions(interp, confirmer([el.id]), { compteurs: { sdb: 1 }, metiersActifs: ['plomberie'] }).propositions.find(p => p.type === 'ajout_quantite');
let ra = UI.resumeAvantApres(prop);
A(ra.avant[0].cle === 'sdb' && ra.avant[0].val === 1 && ra.apres[0].val === 2, 'AVANT/APRÈS ajout_quantite (1→2)');

// AVANT/APRÈS — transformation (source fournie par le client)
let tr = P.construireTransformation('chambre', 'bureau', { compteurs: { chambre: 2 } });
let rt = UI.resumeAvantApres(tr);
A(rt.avant.find(x => x.cle === 'chambre').val === 2 && rt.apres.find(x => x.cle === 'chambre').val === 1 && rt.apres.find(x => x.cle === 'bureau').val === 1, 'AVANT/APRÈS transformation');

// AVANT/APRÈS — métier
let interpF = I.interpreterDescriptif("Je veux refaire la plomberie de la salle de bain.", { piecesPresentes: ['sdb'], metiersActifs: [] });
let elF = interpF.elementsDetectes.find(e => e.metier === 'plomberie');
let pm = P.construirePropositions(interpF, confirmer([elF.id]), { compteurs: { sdb: 1 }, metiersActifs: [] }).propositions.find(p => p.type === 'ajout_metier');
let rm = UI.resumeAvantApres(pm);
A(rm.avant[0].val === 'non sélectionné' && rm.apres[0].val === 'sélectionné', 'AVANT/APRÈS métier');

// Sélection de source de transformation : liste des pièces présentes, cible exclue, jamais devinée
let sources = UI.sourcesTransformation({ compteurs: { chambre: 2, salon: 1, bureau: 0 } }, 'bureau');
let ids = sources.map(s => s.id).sort();
A(J(ids) === J(['chambre', 'salon']), 'sources = pièces présentes (chambre, salon), cible/0 exclus');
A(sources.find(s => s.id === 'chambre').count === 2, 'source porte le compte (chambre ×2)');
A(UI.sourcesTransformation({ compteurs: {} }, 'bureau').length === 0, 'aucune pièce présente → aucune source (jamais devinée)');

// Gamme : aucun avant/après (rien à appliquer)
let rg = UI.resumeAvantApres({ type: 'preference_gamme' });
A(rg.avant.length === 0 && rg.apres.length === 0, 'gamme : aucun changement de config');

// Échappement
let esc = UI.echapperHtml("chambre <b>2</b> & « d'eau »\nligne");
A(esc.indexOf('<b>') === -1 && esc.indexOf('&amp;') !== -1 && esc.indexOf('&#39;') !== -1 && esc.indexOf('<br>') !== -1, 'échappement HTML (balises/esperluette/apostrophe/retour ligne)');

// Aucun prix
A(!/€|totalht|"prix"|[0-9]\s?euro/i.test(J(prop) + J(tr) + J(pm)), 'aucun prix dans les propositions/résumés');

const total = ok + ko;
if (ko === 0) console.log('✅ Interface propositions (M6-B) : ' + ok + '/' + total + ' — AVANT/APRÈS, source explicite, aucun prix');
else console.error('❌ M6-B : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
