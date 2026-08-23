// =====================================================================
// tests/synthese-aic-ui.test.js — Preuves M9-A (restitution écran de l'AIC)
// =====================================================================
// Le module UI (js/synthese-aic-ui.js) est testé sur des objets AIC RÉELS
// construits par js/synthese-aic.js (M8) — chaînage complet M8 → UI.
// Couvre A→P : rendu vide valide ; restitution des 6 sections ; 4 catégories
// « à vérifier » séparées et jamais présentées comme prestations ; échappement
// systématique ; aucune donnée inventée ; aucun prix produit ; aucun Runtime ;
// pureté (objet AIC non muté) ; section absente → pas d'écran cassé ; texte long.
// =====================================================================

const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'synthese-aic.js'));
const UI = require(path.join(__dirname, '..', 'js', 'synthese-aic-ui.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const NOW = '2026-01-01T00:00:00Z';

// ---- A : AIC vide → rendu valide, sans erreur, chaîne HTML ----
let hVide = UI.rendre(S.construireAIC({}, { now: NOW }));
A(typeof hVide === 'string' && hVide.indexOf('Synthèse de votre projet') !== -1, 'A: AIC vide → rendu HTML valide (titre présent)');
A(hVide.indexOf('undefined') === -1 && hVide.indexOf('NaN') === -1, 'A: AIC vide → aucun undefined/NaN');

// ---- Entrée réaliste (mêmes shapes que les sources réelles du configurateur) ----
const input = {
  chantier: { typeBien: 'maison', surface: 70, tableauExistant: 'inconnu', chauffage: 'autre', eauChaude: 'ballon', vmc: 'defaillante', description: "Refaire la SDB : douche à l'italienne\nrepeindre <les> murs & \"plafond\"." },
  interpretation: { elementsDetectes: [{ id: 'el_1', pieceId: 'sdb', metier: 'plomberie', action: 'installation', element: "douche à l'italienne", quantite: null, statut: 'a_confirmer' }], questionsAConfirmer: [{ id: 'q_1', type: 'gamme_a_clarifier', texte: 'Quelle <gamme> ?' }] },
  confirmations: { confirmations: [{ id: 'cf_1', refElement: 'el_1', statut: 'confirme', valeurConfirmee: "douche à l'italienne" }] },
  piecesSelectionnees: [
    { id: 'sdb', numero: 1, nom: 'Salle de bain', dims: { l: 2, la: 2, h: 2.5 }, config: { plomberie: { PLO_DOUCHE_ITAL: 1 } }, elecGamme: 'mosaic', ploGamme: 'standard' },
    { id: 'chambre', numero: 1, nom: 'Chambre 1', dims: { l: 0, la: 0, h: 2.5 }, config: {}, elecGamme: 'mosaic', ploGamme: 'standard' }
  ],
  metiersActifs: ['plomberie', 'peinture'],
  modifications: [
    { type: 'ajout_piece', cible: 'sdb', avant: 0, apres: 1, horodatage: NOW },
    { type: 'prestation', code: 'PLO_DOUCHE_ITAL', quantite: 1, horodatage: NOW }
  ],
  prestationsDecisions: {
    'el_1|PLO_DOUCHE_ITAL': { decision: 'appliquee', pieceRef: 'sdb#1', metier: 'plomberie', code: 'PLO_DOUCHE_ITAL', quantite: 1, role: 'pose', avant: null },
    'el_1|PLO_BAIGNOIRE': { decision: 'a_verifier', code: 'PLO_BAIGNOIRE', role: 'depose', pieceRef: 'sdb#1', metier: 'plomberie' },
    'inst|el_1': { ref: 'sdb#1' }
  },
  alertesCoherence: [{ niveau: 'attention', texte: 'Chambre 1 : dimensions non renseignées — comptées à 0 €.' }]
};
const resolveLabel = (c) => ({ PLO_DOUCHE_ITAL: "Douche à l'italienne", PLO_BAIGNOIRE: 'Baignoire' }[c] || null);
const aic = S.construireAIC(input, { now: NOW, resolveLabel });
const gel = JSON.stringify(aic);       // pour la preuve de non-mutation (M)
const H = UI.rendre(aic);

// ---- B : description restituée (et échappée, pas verbatim brut) ----
A(H.indexOf('Votre projet') !== -1 && H.indexOf('repeindre') !== -1, 'B: description restituée dans « Votre projet »');
A(H.indexOf('<les>') === -1 && H.indexOf('&lt;les&gt;') !== -1, 'B: description échappée (<les> → &lt;les&gt;)');

// ---- C : interprétation M4 (éléments + questions) ----
A(H.indexOf('Ce que nous avons compris') !== -1 && /douche.*italienne/i.test(H), 'C: élément M4 restitué');
A(H.indexOf('Quelle &lt;gamme&gt; ?') !== -1, 'C: question M4 restituée et échappée');
// C (UX M9-A) : action / élément / pièce / métier séparés visuellement
A(H.indexOf('Installer / poser') !== -1 && H.indexOf('Pièce : sdb') !== -1 && H.indexOf('Métier : Plomberie') !== -1, 'C(UX): action, pièce et métier séparés');

// ---- D : confirmations M5 (valeur + badge séparés) ----
A(H.indexOf('Ce que vous avez confirmé') !== -1, 'D: section confirmations présente');
A(H.indexOf('✓ Confirmé') !== -1 && H.indexOf("douche à l&#39;italienne") !== -1, 'D(UX): valeur confirmée + badge « ✓ Confirmé » distincts');

// ---- E : configuration M6 (pièces, cotes, métiers, modifications) ----
A(H.indexOf('Configuration retenue') !== -1 && H.indexOf('Salle de bain') !== -1, 'E: pièce configurée restituée');
A(/L 2 m/.test(H) && /Plomberie/.test(H), 'E: cotes + métiers restitués');
A(/ajout_piece/.test(H) && /0 → 1/.test(H), 'E: modification M6 restituée (delta avant→après)');
A(H.indexOf('prestation') === H.lastIndexOf('prestation') || !/>prestation</.test(H), 'E: entrée journal « prestation » exclue de la config (M8 déjà filtré)');
// E (UX M9-A) : dimensions incomplètes signalées, cotes manquantes nommées SANS invention
A(H.indexOf('⚠ Dimensions incomplètes') !== -1 && H.indexOf('À compléter : longueur, largeur') !== -1, 'E(UX): pièce à cotes manquantes → « Dimensions incomplètes » + cotes nommées');
A((H.match(/Dimensions incomplètes/g) || []).length === 1, 'E(UX): la SDB (cotes présentes) n\'est pas marquée incomplète (1 seule occurrence)');
A(H.indexOf('L 0 m') === -1 && H.indexOf('l 0 m') === -1, 'E(UX): aucune cote 0 affichée comme valeur (rien d\'inventé)');

// ---- F : prestations M7 (pièce, métier, label, quantité, rôle) ----
A(H.indexOf('Prestations retenues') !== -1, 'F: section prestations présente');
A(H.indexOf('sdb#1') !== -1 && H.indexOf("Douche à l&#39;italienne") !== -1 && /Pose/.test(H), 'F: pièce + label (échappé) + rôle Pose restitués');

// ---- G : les 4 catégories « à vérifier » séparées ----
A(H.indexOf('À vérifier en visite') !== -1, 'G: section « à vérifier » présente');
A(H.indexOf('Dépose non couverte') !== -1 && H.indexOf('Information technique à préciser') !== -1
  && H.indexOf('Dimension manquante') !== -1 && H.indexOf('Écart de cohérence') !== -1, 'G: les 4 catégories M8 sont des blocs distincts');

// ---- H : aucun élément « à vérifier » ne devient une prestation ----
// La dépose PLO_BAIGNOIRE (a_verifier) ne doit PAS apparaître dans la table Prestations retenues.
const idxPrest = H.indexOf('Prestations retenues');
const idxAV = H.indexOf('À vérifier en visite');
const blocPrest = H.slice(idxPrest, idxAV);
A(blocPrest.indexOf('Baignoire') === -1, 'H: la dépose « à vérifier » (Baignoire) n\'apparaît pas dans les prestations retenues');
A(H.slice(idxAV).indexOf('Baignoire') !== -1, 'H: la dépose « à vérifier » figure bien dans « à vérifier en visite »');

// ---- I : échappement complet (accents/apostrophes/balises/retours ligne/guillemets) ----
A(H.indexOf("l'italienne") === -1 || H.indexOf("l&#39;italienne") !== -1, 'I: apostrophes échappées (&#39;)');
A(H.indexOf('&quot;plafond&quot;') !== -1, 'I: guillemets échappés (&quot;)');
A(H.indexOf('&amp;') !== -1, 'I: & échappé (&amp;)');
A(/repeindre &lt;les&gt; murs &amp; &quot;plafond&quot;\.<br>/.test(H) || H.indexOf('<br>') !== -1, 'I: retour ligne → <br>');

// ---- J : aucune donnée inventée (sans resolver → pas de label fabriqué) ----
const aicNoLabel = S.construireAIC(input, { now: NOW });
const Hnl = UI.rendre(aicNoLabel);
A(Hnl.indexOf("Douche à l'italienne") === -1 && Hnl.indexOf('PLO_DOUCHE_ITAL') !== -1, 'J: sans resolver → code brut affiché, aucun label inventé');
A(Hnl.indexOf('Baignoire') === -1 && Hnl.indexOf('PLO_BAIGNOIRE') !== -1, 'J: dépose sans resolver → code brut, rien d\'inventé');

// ---- K : aucun prix calculé/ajouté par l'UI ----
A(!/totalht|getmoyenprix|prixtotal|\bttc\b|prix unitaire|montant/i.test(H), 'K: aucun champ/mot de prix produit par l\'UI');

// ---- L : aucun appel / référence Runtime ----
A(!/runtime|__obtenirdevis|127\.0\.0\.1|coefzone|calculerdevis/i.test(H), 'L: aucune référence Runtime dans la sortie');
A(/__obtenirDevis|Runtime|calculerDevis/.test(UI.rendre.toString()) === false, 'L: le code de rendre() n\'appelle aucun Runtime');

// ---- M : pureté — l'objet AIC fourni n'est pas muté ----
A(JSON.stringify(aic) === gel, 'M: objet AIC non muté par le rendu');

// ---- N : absence de sections → pas d'écran cassé ----
let partiel = S.construireAIC({ chantier: { description: 'Juste une phrase.' } }, { now: NOW });
let Hp = UI.rendre(partiel);
A(typeof Hp === 'string' && Hp.indexOf('Juste une phrase.') !== -1 && Hp.indexOf('Prestations retenues') === -1 && Hp.indexOf('À vérifier') === -1, 'N: sections vides omises proprement (pas d\'écran cassé)');

// ---- O : texte long → structure HTML valide (balises équilibrées grossièrement) ----
let longTxt = 'DÉTAIL '.repeat(400);
let aicLong = S.construireAIC({ chantier: { description: longTxt } }, { now: NOW });
let Hl = UI.rendre(aicLong);
const opens = (Hl.match(/<div/g) || []).length, closes = (Hl.match(/<\/div>/g) || []).length;
A(Hl.indexOf('DÉTAIL') !== -1 && opens === closes, 'O: texte long → <div> ouverts/fermés équilibrés');
A(/<div class="aic-synthese"[\s\S]*<\/div>\s*$/.test(Hl), 'O: conteneur racine correctement fermé');

// ---- P : le « € » d'un texte source est restitué, jamais fabriqué par M9 ----
A(H.indexOf('comptées à 0 €') !== -1, 'P: « € » du texte d\'alerte source restitué tel quel');
// Aucun « € » ailleurs que dans ce texte porté (pas de montant fabriqué)
const sansAlerte = H.split('comptées à 0 €').join('');
A(sansAlerte.indexOf('€') === -1, 'P: aucun autre « € » produit par l\'UI (aucun montant fabriqué)');

const total = ok + ko;
if (ko === 0) console.log('✅ Restitution AIC (M9-A) : ' + ok + '/' + total + ' — 6 sections + 4 catégories séparées, échappé, sans prix ni Runtime, pur');
else console.error('❌ M9-A : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
