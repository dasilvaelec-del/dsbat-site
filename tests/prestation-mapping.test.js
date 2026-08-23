// =====================================================================
// tests/prestation-mapping.test.js — Preuves M7-A (intention → prestations candidates)
// =====================================================================
// Vérifie : correspondances issues EXCLUSIVEMENT du catalogue ; aucun code hors
// catalogue ; quantité explicite conservée / absente jamais inventée ; dépose
// claire vs à-vérifier-en-visite ; ambiguïté sans candidat forcé ; absence de
// correspondance ; pureté (entrée non mutée) ; aucun prix / aucune config.
// =====================================================================

const path = require('path');
const M = require(path.join(__dirname, '..', 'js', 'prestation-mapping.js'));
const I = require(path.join(__dirname, '..', 'js', 'interpretation-descriptif.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const J = (o) => JSON.stringify(o);

// Catalogue RÉEL sdb (extrait de js/moteurs/plomberie.js) — SANS code de dépose
const CATA_SDB = [
  { code: 'PLO_BAIGNOIRE', label: 'Baignoire', unite: 'U' },
  { code: 'PLO_DOUCHE_ITAL', label: "Douche à l'italienne", unite: 'U' },
  { code: 'PLO_DOUCHE_CABINE', label: 'Cabine de douche', unite: 'U' },
  { code: 'PLO_MEUBLE_LAV', label: 'Meuble vasque', unite: 'U' },
  { code: 'PLO_WC_SUSP', label: 'WC suspendu', unite: 'U' },
  { code: 'PLO_BALLON_100', label: 'Ballon eau chaude 100L', unite: 'U' }
];
// Même catalogue AVEC un code de dépose (cas où le caller fournit la dépose)
const CATA_SDB_DEPOSE = CATA_SDB.concat([{ code: 'PLO_DEPOSE_BAIGNOIRE', label: 'Dépose baignoire', unite: 'U' }]);
const CATA_ELEC = [
  { code: 'ELEC_PRISE10', label: 'Prise 2P+T simple', unite: 'U' },
  { code: 'ELEC_PL_SA', label: 'Point lumineux simple', unite: 'U' }
];
const codesDe = (c) => c.map(p => p.code);
const dansCatalogue = (r, cata) => r.candidats.every(x => codesDe(cata).indexOf(x.code) !== -1);

// ---- TEST 1 : équipement → code RÉELLEMENT présent (via vrai élément M4) ----
let interp = I.interpreterDescriptif("Je veux remplacer ma baignoire par une douche à l'italienne.", { piecesPresentes: ['sdb'], metiersActifs: ['plomberie'] });
let el = interp.elementsDetectes.find(e => /douche/i.test(e.element));
let r1 = M.proposerPrestations(el, 'sdb', CATA_SDB);
A(r1.candidats.some(c => c.code === 'PLO_DOUCHE_ITAL'), 'T1 douche à l\'italienne → PLO_DOUCHE_ITAL (candidat)');
A(r1.candidats.every(c => c.statut === 'a_valider'), 'T1 tous les candidats sont a_valider');

// ---- TEST 2 : aucun code hors catalogue (règle impérative) ----
A(dansCatalogue(r1, CATA_SDB), 'T2 aucun code proposé hors du catalogue fourni');
A(r1.candidats.length > 0 && r1.candidats.every(c => codesDe(CATA_SDB).indexOf(c.code) !== -1), 'T2 tous les candidats ∈ catalogue (rôle install/dépose tranché par le client en M7-B)');

// ---- TEST 3 : quantité explicite conservée ----
let elQ = { id: 'el_q', metier: 'electricite', action: 'installation', element: 'prise', quantite: 3, statut: 'a_confirmer' };
let r3 = M.proposerPrestations(elQ, 'salon', CATA_ELEC);
A(r3.candidats.some(c => c.code === 'ELEC_PRISE10' && c.qteParDefaut === 3), 'T3 quantité explicite (3) conservée');

// ---- TEST 4 : quantité absente jamais inventée ----
A(r1.candidats.every(c => c.qteParDefaut === null), 'T4 quantité absente → qteParDefaut null (jamais inventée)');

// ---- TEST 5 : dépose CLAIRE (code présent dans le catalogue) → candidat depose ----
let r5 = M.proposerPrestations(el, 'sdb', CATA_SDB_DEPOSE);
A(r5.candidats.some(c => c.code === 'PLO_DEPOSE_BAIGNOIRE' && c.depose === true), 'T5 dépose baignoire → candidat depose (code du catalogue)');
A(dansCatalogue(r5, CATA_SDB_DEPOSE), 'T5 dépose : toujours issue du catalogue');

// ---- TEST 6 : dépose INCERTAINE (aucun code dépose au catalogue) → à vérifier en visite ----
A(r1.aVerifierVisite.length >= 1 && /vérifier lors de la visite/i.test(r1.aVerifierVisite[0].texte), 'T6 dépose sans code → aVerifierVisite (aucune invention)');

// ---- TEST 7 : élément ambigu → aucun candidat forcé, conservé à traiter ----
let elAmb = { id: 'el_amb', metier: null, action: 'renovation', element: 'refaire la cuisine', quantite: null, statut: 'incertain' };
let r7 = M.proposerPrestations(elAmb, 'cuisine', CATA_SDB);
A(r7.candidats.length === 0 && r7.aTraiter.length === 1, 'T7 ambiguïté → aucun candidat, versé dans aTraiter');

// ---- TEST 8 : aucune correspondance ----
let elNo = { id: 'el_no', metier: null, action: 'installation', element: 'piscine', quantite: null, statut: 'a_confirmer' };
let r8 = M.proposerPrestations(elNo, 'sdb', CATA_SDB);
A(r8.candidats.length === 0 && r8.aVerifierVisite.length === 0 && r8.aucuneCorrespondance === true, 'T8 aucun match → aucuneCorrespondance');

// ---- TEST 9 : pureté (entrée non mutée) ----
let elGel = J(el), cataGel = J(CATA_SDB);
M.proposerPrestations(el, 'sdb', CATA_SDB);
A(J(el) === elGel && J(CATA_SDB) === cataGel, 'T9 pureté : élément et catalogue d\'entrée non mutés');

// ---- TEST 10 : aucun prix, aucune config ----
let blob = J(r1) + J(r3) + J(r5);
A(!/€|totalht|"prix"|[0-9]\s?euro|getmoyenprix/i.test(blob), 'T10 aucun prix dans la sortie');
A(!/piecesselectionnees|"config"|recalcpiece/i.test(blob), 'T10 aucune écriture/mention de config');

const total = ok + ko;
if (ko === 0) console.log('✅ Prestation mapping (M7-A) : ' + ok + '/' + total + ' — candidats du catalogue seul, aucun code/quantité inventé, aucun prix');
else console.error('❌ M7-A : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
