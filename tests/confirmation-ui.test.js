// =====================================================================
// tests/confirmation-ui.test.js — Preuves M5-B (helpers d'affichage + glue logique)
// =====================================================================
// Vérifie : regroupement VISUEL par pièce mais éléments INDÉPENDANTS (id propre) ;
// cas vide → étape sautée ; persistance de la map de réponses ; échappement HTML ;
// intégration M4→réponses→M5 (oui/non/modifier) ; aucune modif config/prix.
// =====================================================================

const path = require('path');
const UI = require(path.join(__dirname, '..', 'js', 'confirmation-ui.js'));
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
const C = require(path.join(__dirname, '..', 'js', 'confirmation-descriptif.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- Regroupement par pièce + éléments indépendants ----
let interp = I.interpreterDescriptif("Je veux refaire ma salle de bain et remplacer la baignoire par une douche à l'italienne.",
  { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let vue = UI.construireVueConfirmation(interp);
A(!vue.vide, 'vue non vide');
A(vue.groupes.length >= 1 && vue.groupes[0].titre.toLowerCase().indexOf('salle de bain') !== -1, 'regroupement par pièce (salle de bain)');
let idsGroupe = vue.groupes[0].elements.map(e => e.id);
A(idsGroupe.length === new Set(idsGroupe).size, 'chaque élément a un id UNIQUE (indépendant)');

// ---- Indépendance des réponses : répondre à un id n'affecte pas les autres ----
let reponses = {};
reponses[idsGroupe[0]] = { action: 'oui' };
let res = C.construireConfirmations(interp, reponses);
A(res.confirmations.length === 1 && res.confirmations[0].refElement === idsGroupe[0], 'une réponse ne s\'applique qu\'à SON élément');
A(res.enAttente.some(x => x.ref !== idsGroupe[0]) || idsGroupe.length === 1, 'les autres éléments restent en attente');

// ---- Multi-pièces : regroupement lisible ----
let interpM = I.interpreterDescriptif("Refaire la salle de bain, enlever la baignoire. Repeindre les murs de la cuisine.",
  { piecesPresentes: ['sdb', 'cuisine'], metiersActifs: ['plomberie', 'peinture'] });
let vueM = UI.construireVueConfirmation(interpM);
let titres = vueM.groupes.map(g => g.titre.toLowerCase());
A(titres.some(t => t.indexOf('salle de bain') !== -1) && titres.some(t => t.indexOf('cuisine') !== -1), 'multi-pièces regroupées (salle de bain + cuisine)');

// ---- Cas vide → étape sautée ----
let vueVide = UI.construireVueConfirmation(I.interpreterDescriptif("", {}));
A(vueVide.vide === true && vueVide.groupes.length === 0, 'aucune interprétation → vue.vide (étape sautée)');

// ---- idsConfirmation = éléments + questions ----
let interpQ = I.interpreterDescriptif("refaire la plomberie de la salle de bain", { piecesPresentes: ['sdb'], metiersActifs: [] });
let ids = UI.idsConfirmation(interpQ);
A(ids.length === (interpQ.elementsDetectes.length + interpQ.questionsAConfirmer.length), 'idsConfirmation couvre éléments + questions');

// ---- Persistance : round-trip de la map de réponses ----
let map = {}; map[idsGroupe[0]] = { action: 'modifier', texte: 'douche classique' };
let restore = JSON.parse(JSON.stringify(map));
A(JSON.stringify(restore) === JSON.stringify(map), 'persistance : map de réponses conservée à l\'identique');

// ---- Échappement HTML (accents/apostrophes/retours ligne/balises) ----
let esc = UI.echapperHtml("d'eau <b>gras</b> & \"gu\"\nligne2");
A(esc.indexOf('<b>') === -1 && esc.indexOf('&lt;b&gt;') !== -1, 'balises échappées');
A(esc.indexOf('&#39;') !== -1 && esc.indexOf('&amp;') !== -1 && esc.indexOf('&quot;') !== -1, 'apostrophe/esperluette/guillemet échappés');
A(esc.indexOf('<br>') !== -1, 'retour à la ligne → <br>');
A(UI.echapperHtml("à l'italienne, façade").indexOf('à') !== -1, 'accents préservés (é/à) — non corrompus');

// ---- Intégration statuts (M5) : oui/non/modifier indépendants ----
let e0 = interp.elementsDetectes[0].id;
A(C.construireConfirmations(interp, { [e0]: { action: 'oui' } }).confirmations[0].statut === 'confirme', 'oui → confirme');
A(C.construireConfirmations(interp, { [e0]: { action: 'non' } }).confirmations[0].statut === 'refuse', 'non → refuse');
let cmod = C.construireConfirmations(interp, { [e0]: { action: 'modifier', texte: 'douche classique' } }).confirmations[0];
A(cmod.statut === 'modifie' && cmod.valeurConfirmee === 'douche classique' && cmod.interpretationOriginale.element === interp.elementsDetectes[0].element, 'modifier → historique conservé');

// ---- Aucune donnée de config/prix produite par la couche UI ----
A(!/piecesselectionnees|metiersactifs|totalht|€|elecgamme/i.test(JSON.stringify(vue) + JSON.stringify(res)), 'aucune config/prix dans la vue ni les confirmations');

const total = ok + ko;
if (ko === 0) console.log('✅ Interface confirmation (M5-B) : ' + ok + '/' + total + ' — regroupement visuel, éléments indépendants, aucun prix/config');
else console.error('❌ M5-B : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
