// =====================================================================
// tests/vmc-etude-visite-lot21.test.js — M57 LOT21 : chaînage visite → étude
// =====================================================================
// etudierVisiteVmc(pieces, contexte, donneesVisite, options?) : relie la VISITE terrain
// (LOT18/19) à l'ÉTUDE (LOT16 → LOT15-A → LOT17-A) via l'UNIQUE frontière
// normaliserVisiteVersReseau. Il DÉLÈGUE (ne calcule rien), ne mute pas la visite, distingue
// réel/projeté de façon explicite, ne propage pas une mesure locale, sépare SF/DF, et reste
// hors money-path (aucun piece.config / prix / Runtime / projection tarifaire).
// « inconnu / inaccessible / contradiction » ne deviennent jamais une valeur inventée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (valeur, statut, prov) => V.creerChampValeur({ valeur: valeur, statut: statut || S.MESURE, provenance: prov });

// Référentiel FIXTURE (provenance 'test' — jamais production). cf. LOT15-A/LOT16.
const REF = { methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test',
  masseVolumiqueAir: 1.2, lineaire: { souple: { 125: 1.0, 160: 0.5 } }, singulier: {} };
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, extra || {});

// Visite SF « propre » : collecteur + antennes sdb/wc, diamètres relevés, sdb a un projeté 160.
function visiteSF() {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'COL', role: 'collecteur', longueur: cv(4), diametre: cv(160), typeConduit: 'souple', debit: cv(45), provenance: 'technicien' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: V.creerChampValeur({ valeur: 125, statut: S.MESURE, provenance: 'mesure_instrumentee' }), diametreProjet: V.creerChampValeur({ valeur: 160, statut: S.DOCUMENTE }), typeConduit: 'souple', debit: cv(30), provenance: 'technicien' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T2', role: 'antenne', pieceRef: 'wc#1', longueur: cv(2), diametre: cv(125), typeConduit: 'souple', debit: cv(15), provenance: 'technicien' });
  return dv;
}
const PIECES_SF = [{ id: 'sdb', numero: 1 }, { id: 'wc', numero: 1 }];

A(typeof V.etudierVisiteVmc === 'function', '0. etudierVisiteVmc exporté');

// ---- 1. Normalisation visite → réseau (via la frontière officielle) --------------
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  A(r.normalisation && r.normalisation.donneesReseau && r.normalisation.donneesReseau.reseaux.length === 1, '1. visite normalisée en donneesReseau (1 réseau extraction)');
  A(r.normalisation.donneesReseau.reseaux[0].troncons.length === 3, '1b. tronçons transmis (collecteur + 2 antennes)');
}

// ---- 2/3/18. Visite → LOT15-A → LOT16 : étude calculable si réellement possible --
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  A(r.etude && r.etude.pertes && typeof r.etude.pertes.reseaux[0].perteTotale === 'number', '2. pertes calculées par LOT15-A depuis la visite');
  A(r.statut === 'etude_calculable', '3/18. étude calculable quand données suffisantes');
  A(r.etude.pertes.reseaux[0].perteTotale === 12, '2b. perte totale = 12 Pa (8 + 2 + 2, relevé)');
}

// ---- 4/5/23. Réel conservé ; projeté explicite ; jamais d'écrasement silencieux ---
{
  const dv = visiteSF();
  const rExist = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF, contexteEtude: 'existant' });
  const rProj = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF, contexteEtude: 'projet' });
  A(rExist.normalisation.donneesReseau.reseaux[0].troncons[1].diametre === 125, '4. donnée réelle conservée (Ø sdb = 125 relevé)');
  A(rExist.contexteEtude === 'existant' && rProj.contexteEtude === 'projet', '5. contexte d\'étude explicite');
  A(rExist.etude.pertes.reseaux[0].perteTotale !== rProj.etude.pertes.reseaux[0].perteTotale, '5b. projeté ≠ existant (étude distincte)');
  A(rProj.etude.pertes.reseaux[0].perteTotale === 8, '23. projet : sdb utilise Ø160 (8×0.5) → perte 8 Pa');
  A(rProj.normalisation.donneesReseau.reseaux[0].troncons[1].diametre === 125, '23b. le relevé (125) reste intact même en contexte projet');
  A(V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv).contexteEtude === 'existant', '5c. contexte par défaut = existant (réel), jamais projeté silencieux');
}

// ---- 6. Donnée inconnue → null (jamais 0) + manque signalé ------------------------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', diametre: cv(125), typeConduit: 'souple' /* longueur inconnue */ });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  const t = r.normalisation.donneesReseau.reseaux[0].troncons[0];
  A(t.longueur === null, '6. longueur inconnue → null (jamais 0)');
  A(r.donneesManquantes.some(d => /longueur/.test(d.champ)), '6b. manque « longueur » signalé');
  A(r.statut !== 'etude_calculable', '6c. étude non déclarée calculable faute de données');
}

// ---- 7. Donnée inaccessible → non calculable + manque ----------------------------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(6), diametre: V.creerChampValeur({ statut: S.NON_ACCESSIBLE }), typeConduit: 'souple', debit: cv(30) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  const t = r.normalisation.donneesReseau.reseaux[0].troncons[0];
  A(t.diametre === null, '7. diamètre inaccessible → null');
  A(r.donneesManquantes.some(d => /diametre_ou_section/.test(d.champ)), '7b. manque diamètre/section signalé');
}

// ---- 8/21c. Contradiction non arbitrée → null + incohérence, étude ne choisit pas -
{
  const diam = V.creerChampObserve([{ valeur: 125, statut: S.RELEVE_DECLARATIF, provenance: 'client' }, { valeur: 160, statut: S.DOCUMENTE, provenance: 'document_existant' }], null);
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(6), diametre: diam, typeConduit: 'souple', debit: cv(30) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  A(r.normalisation.donneesReseau.reseaux[0].troncons[0].diametre === null, '8. contradiction non arbitrée → diamètre null (aucun choix silencieux)');
  A(r.normalisation.incoherences.length > 0, '8b. incohérence conservée et remontée');
  A(r.statut !== 'etude_calculable', '8c. étude non calculable sur une valeur contradictoire');
}

// ---- 9. Contradiction ARBITRÉE (référence tracée) → valeur utilisée ---------------
{
  const diamRef = V.creerChampObserve(
    [{ valeur: 125, statut: S.RELEVE_DECLARATIF, provenance: 'client' }, { valeur: 160, statut: S.DOCUMENTE, provenance: 'document_existant' }],
    { valeur: 125, statut: S.RELEVE_DECLARATIF, choisiePar: 'technicien', raison: 'mesure directe sur tronçon' });
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: diamRef, typeConduit: 'souple', debit: cv(30) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  A(r.normalisation.donneesReseau.reseaux[0].troncons[0].diametre === 125, '9. référence arbitrée → 125 utilisé');
  A(r.normalisation.incoherences.length === 0, '9b. valeur arbitrée → plus d\'incohérence bloquante');
  A(r.statut === 'etude_calculable', '9c. calcul possible sur la valeur arbitrée (8×1=8 Pa)');
}

// ---- 10. Provenance conservée dans la couche normalisée --------------------------
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  A(r.normalisation.donneesReseau.reseaux[0].troncons[1].provenance === 'technicien', '10. provenance du tronçon conservée dans donneesReseau');
  A(r.visite && r.visite.reseaux[0].troncons[1].diametre.provenance === 'mesure_instrumentee', '10b. provenance de la valeur reste consultable via la visite (source de vérité)');
}

// ---- 11/24. Mesure locale NON propagée au réseau ---------------------------------
{
  let dv = visiteSF();
  dv = V.ajouterMesureVisiteA(dv, { id: 'M1', pointId: 'TM_sdb', grandeur: 'debit', valeur: 90, unite: 'm3/h', instrument: 'anemo' });
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  A(r.etude.synthese.debitExtraction === 45, '11. mesure locale (90) NON propagée : débit réseau = 45 (réglementaire sdb+wc)');
  A(!r.normalisation.donneesReseau.reseaux[0].troncons.some(t => t.debit === 90), '24. aucune valeur 90 injectée dans les tronçons du réseau');
}

// ---- 12. SF : extraction seule (aucune insufflation inventée) --------------------
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  const types = r.normalisation.donneesReseau.reseaux.map(x => x.type);
  A(types.length === 1 && types[0] === 'extraction', '12. SF : un seul réseau mécanique (extraction)');
}

// ---- 13/14/25(DF). DF : deux réseaux séparés, pertes jamais additionnées ----------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'E1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'souple', debit: cv(30) });
  dv = V.ajouterTronconVisite(dv, 'RI', { id: 'I1', role: 'antenne', pieceRef: 'chambre#1', longueur: cv(5), diametre: cv(125), typeConduit: 'souple', debit: cv(30) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }, { id: 'chambre', numero: 1 }], CTX({ solution: 'double_flux' }), dv, { referentielPertes: REF });
  A(r.normalisation.donneesReseau.reseaux.length === 2, '13. DF : deux réseaux');
  const ext = r.etude.pertes.reseaux.filter(x => x.type === 'extraction')[0];
  const ins = r.etude.pertes.reseaux.filter(x => x.type === 'insufflation')[0];
  A(ext && ins && ext !== ins, '14. extraction et insufflation étudiées séparément');
  A(!/perteTotaleGlobale|reseauFusionne/.test(JSON.stringify(r.etude.synthese)), '25(DF). pertes DF jamais fusionnées');
}

// ---- 15. Chemins : dérivables (calculable) vs non décrits -------------------------
{
  const rOk = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  A(rOk.etude.chemins.favorise.length === 1 && rOk.etude.chemins.defavorise.length === 1, '15. chemins dérivés quand la topologie est décrite');
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', typeConduit: 'souple' /* pas de géométrie */ });
  const rNo = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  A(rNo.donneesManquantes.some(d => d.champ === 'chemin_physique_non_decrit') || rNo.etude.chemins.favorise.length === 0, '15b. topologie non décrite → chemin non fabriqué');
}

// ---- 16/17. Pertes partielles → étude partielle/sous hypothèses (pas calculable) --
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', diametre: cv(125), typeConduit: 'souple', debit: cv(30) /* longueur absente */ });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  A(r.etude.pertes.reseaux[0].statut === 'incomplet', '16. pertes partielles (longueur manquante)');
  A(r.statut === 'etude_sous_hypotheses' || r.statut === 'etude_partielle', '17. étude honnêtement partielle/sous hypothèses');
}

// ---- 19. Absence de référentiel → non calculable + manque signalé ----------------
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF()); // pas de referentielPertes
  A(r.etude.pertes.statut === 'incomplet', '19. sans référentiel → pertes incomplètes');
  A(r.donneesManquantes.some(d => d.champ === 'referentiel_pertes'), '19b. référentiel manquant signalé');
  A(r.statut !== 'etude_calculable', '19c. jamais « calculable » sans référentiel');
}

// ---- 20. Non-mutation de la visite ------------------------------------------------
{
  const dv = visiteSF();
  const snap = JSON.stringify(dv);
  V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF, contexteEtude: 'projet' });
  A(JSON.stringify(dv) === snap, '20. la visite n\'est jamais mutée par l\'étude');
}

// ---- 21. Persistance → restauration → étude : résultat stable --------------------
{
  const dv = visiteSF();
  const rt = V.restaurerVisiteVmc(JSON.parse(JSON.stringify(V.serialiserVisiteVmc(dv))));
  const r1 = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF });
  const r2 = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), rt, { referentielPertes: REF });
  A(JSON.stringify(r1.etude) === JSON.stringify(r2.etude), '21. restauration → étude identique (persistance neutre)');
}

// ---- Jamais de conclusion de conformité / dimensionnement ------------------------
{
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteSF(), { referentielPertes: REF });
  A(!/\bconforme\b|dimensionné|pression suffisante|installation valid/i.test(JSON.stringify({ s: r.statut, syn: r.etude.synthese, st: r.pression.statut })), 'X. aucune conformité/dimensionnement affirmé');
}

// =====================================================================
// STATIQUE — money-path (§22/23/24/25/28/29)
// =====================================================================
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function etudierVisiteVmc('), SRC.indexOf('M57 LOT22')); // borné avant LOT22
A(BLOC.length > 0, '22. bloc etudierVisiteVmc localisé');
A(!/piece\.config|config\.vmc\s*=/.test(BLOC), '22b. aucune écriture piece.config');
A(!/getMoyenPrixFor|prixTotal|moteur-devis|moteur-piece|VMC_BOUCHE|catalogue/.test(BLOC), '23. aucun prix / catalogue');
A(!/dimensionnementVMC|VMC_PARAMS|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '24. aucun Runtime / dimensionnement / DOM');
A(!/projeterVmcVersConfig/.test(BLOC), '25. aucune projection tarifaire (projeterVmcVersConfig)');
// Ne recalcule rien lui-même : délègue aux moteurs (présence des appels délégués).
A(/normaliserVisiteVersReseau\(/.test(BLOC) && /preEtudeVmc\(/.test(BLOC) && /analysePressionVmc\(/.test(BLOC), 'X2. délègue à normaliser + preEtudeVmc + analysePressionVmc');
A(!/function _selectionnerDonneesEtude[\s\S]*(\bR\s*\*\s*|0\.5\s*\*\s*rho|Math\.PI)/.test(BLOC), 'X3. la sélection réel/projeté ne contient aucune formule de perte/section');

// UI (§30) — bouton minimal, aucun tarif.
const CONF = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
A(/onclick="visiteAnalyser\(\)"/.test(CONF), '30. UI : bouton « Analyser la visite » présent');
const iUI = CONF.indexOf('M57 LOT20 — UI VISITE VMC');
const UI = CONF.slice(CONF.indexOf('<script>', iUI), CONF.indexOf('</script>', CONF.indexOf('<script>', iUI)));
A(/etudierVisiteVmc\(/.test(UI), '30b. UI délègue à etudierVisiteVmc');
A(!/piece\.config|getMoyenPrixFor|prixTotal|projeterVmcVersConfig|calculerPiece/.test(UI), '30c. UI d\'analyse : aucun money-path / projection tarifaire');

const total = ok + ko;
if (ko === 0) console.log('✅ Chaînage visite → étude VMC (M57 LOT21) : ' + ok + '/' + total + ' — délégation pure, réel/projeté explicite, hors money-path, incertitude préservée');
else { console.error('❌ Chaînage visite → étude LOT21 : ' + ok + '/' + total); process.exit(1); }
