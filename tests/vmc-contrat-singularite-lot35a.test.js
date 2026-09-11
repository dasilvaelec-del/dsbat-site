// =====================================================================
// tests/vmc-contrat-singularite-lot35a.test.js — M57 LOT35-A : contrat ζ renforcé
// =====================================================================
// Renforcement du CONTRAT (creerEntreeSinguliere) et de sa VALIDATION
// (validerReferentielProduction) UNIQUEMENT. Aucune donnée physique, aucun calcul, aucune
// modification LOT25/26/27/31/32/33/34. Vérifie : qualification enrichie, obligations minimales
// SELON le type, scalaire admis seulement si géométrie+domaine fixes, signalement d'une dépendance
// à des paramètres non modélisés (sans inventer), section de référence non ambiguë, doublon,
// source/version/domaine, anti-invention, immuabilité v1.1.0, compatibilité LOT31 inchangée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Base d'un référentiel production valide (air + rugosité galva). On y injecte des singularités.
function refProd(singuliers) {
  return V.creerReferentielProductionPertes({
    referentielId: 'FIX35A', version: 'test-0', provenance: 'referentiel', statut: 'production', datePublication: '2026-01-01', sourcePrincipale: 'SRC',
    masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'SRC' }, viscositeDynamiqueAir: { valeur: 1.81e-5, unite: 'Pa.s', source: 'SRC' },
    rugosites: [{ id: 'g', typeConduit: 'acier_galvanise', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 'resid', source: 'SRC', referenceExacte: 'r', statut: 'production' }],
    singuliers: singuliers
  });
}
const META = { source: 'SRC', referenceExacte: 'ref.x', versionSource: 'v1', domaine: 'resid', statut: 'production' };
const S = (o) => Object.assign({}, META, o);
const errs = (ref) => V.validerReferentielProduction(ref).erreurs;
const hasErr = (ref, frag) => errs(ref).some(e => e.indexOf(frag) !== -1);

// ---- 0. Contrat enrichi : normalisation des nouveaux champs ---------------------
{
  const e = V.creerEntreeSinguliere({ typeSingularite: 'coude', geometrie: 'coude_90', uniteCoefficient: '', coefficient: 0.4, sectionReference: 'aval', rapportSections: 0.5, parametresRequis: ['x'] });
  A(e.type === 'coude' && e.typeSingularite === 'coude' && e.unite === '' && e.uniteCoefficient === '' && e.sectionReference === 'aval' && e.rapportSections === 0.5 && Array.isArray(e.parametresRequis) && e.parametresRequis[0] === 'x', '0. creerEntreeSinguliere normalise les champs enrichis (typeSingularite→type, uniteCoefficient→unite, sectionReference, parametresRequis)');
  const vide = V.creerEntreeSinguliere({ type: 'coude', geometrie: 'g', coefficient: 1 });
  A(Array.isArray(vide.parametresRequis) && vide.parametresRequis.length === 0 && vide.unite === '' && vide.sectionReference === null, '0b. valeurs par défaut sûres (parametresRequis [], unité ζ, sectionReference null)');
}

// ---- 1. Scalaire coude fixe (géométrie + domaine) → VALIDE / production ---------
{
  const ref = refProd([S({ id: 'C90', type: 'coude', geometrie: 'coude_90_rayon_court', angle: 90, coefficient: 0.3 })]);
  const vp = V.validerReferentielProduction(ref);
  A(vp.valide === true && vp.utilisableEnProduction === true, '1. coude scalaire (géométrie+domaine fixes) → référentiel valide en production');
  A(vp.qualiteSinguliers[0].scalarisable === true && vp.qualiteSinguliers[0].parametrique === false, '1b. qualification : entrée scalarisable');
}

// ---- 2. Famille section-sensible sans sectionReference → ambiguë (refusée) ------
{
  const red = refProd([S({ id: 'R1', type: 'reduction', geometrie: 'reduction_conique', coefficient: 0.2, rapportSections: 0.6 })]);
  A(V.validerReferentielProduction(red).valide === false && hasErr(red, 'singulier:R1:section_reference_ambigue'), '2. réduction sans référence de section (amont/aval) → section_reference_ambigue');
}

// ---- 3. Famille ratio-dépendante non pinnée → parametrage_non_precise -----------
{
  const te = refProd([S({ id: 'T1', type: 'te', geometrie: 'te_derivation', sectionReference: 'aval', coefficient: 1.3 })]);
  A(V.validerReferentielProduction(te).valide === false && hasErr(te, 'singulier:T1:parametrage_non_precise'), '3. té ratio-dépendant sans config pinnée (rapport/sections/conditions) → parametrage_non_precise');
}

// ---- 4. Ratio-dépendante PINNÉE (rapport OU sections OU conditions) → VALIDE ----
{
  const teRap = refProd([S({ id: 'T2', type: 'te', geometrie: 'te_derivation', sectionReference: 'aval', rapportDebits: 0.5, rapportSections: 0.5, coefficient: 1.3 })]);
  A(V.validerReferentielProduction(teRap).valide === true, '4a. té pinné par rapportSections + sectionReference → valide');
  const redSec = refProd([S({ id: 'R2', type: 'reduction', geometrie: 'reduction_conique', sectionReference: 'aval', diametreOuSectionAmont: 160, diametreOuSectionAval: 125, coefficient: 0.2 })]);
  A(V.validerReferentielProduction(redSec).valide === true, '4b. réduction pinnée par sections amont+aval + référence → valide');
  const redCond = refProd([S({ id: 'R3', type: 'reduction', geometrie: 'reduction_conique', sectionReference: 'aval', conditionsApplication: 'angle 30°, D160→D125', coefficient: 0.2 })]);
  A(V.validerReferentielProduction(redCond).valide === true, '4c. réduction pinnée par conditionsApplication + référence → valide');
}

// ---- 5. Entrée/sortie : référence de section requise ----------------------------
{
  const ent = refProd([S({ id: 'E1', type: 'entree', geometrie: 'prise_air_grille', coefficient: 0.5 })]);
  A(V.validerReferentielProduction(ent).valide === false && hasErr(ent, 'singulier:E1:section_reference_ambigue'), '5a. entrée sans référence de section → ambiguë');
  const entOk = refProd([S({ id: 'E2', type: 'entree', geometrie: 'prise_air_grille', sectionReference: 'aval', coefficient: 0.5 })]);
  A(V.validerReferentielProduction(entOk).valide === true, '5b. entrée avec référence de section (aval) → valide (non ratio-dépendante)');
}

// ---- 6. Dépendance à des paramètres non modélisés → non scalarisable (signalé) --
{
  const par = refProd([S({ id: 'P1', type: 'coude', geometrie: 'coude_variable', coefficient: 0.3, parametresRequis: ['angle', 'rayon_sur_diametre'] })]);
  const vp = V.validerReferentielProduction(par);
  A(vp.valide === false && hasErr(par, 'singulier:P1:parametrique_non_scalarise'), '6. parametresRequis non vide → parametrique_non_scalarise (dépendance signalée, jamais calculée)');
  A(vp.qualiteSinguliers[0].parametrique === true && vp.qualiteSinguliers[0].scalarisable === false && vp.qualiteSinguliers[0].raisons.indexOf('parametrique_non_scalarise') !== -1, '6b. qualification : entrée paramétrique, non scalarisable, raison conservée');
}

// ---- 7. Doublon silencieux sur une même définition → refusé ---------------------
{
  const dup = refProd([S({ id: 'D1', type: 'coude', geometrie: 'coude_90', coefficient: 0.3 }), S({ id: 'D2', type: 'coude', geometrie: 'coude_90', coefficient: 0.4 })]);
  A(V.validerReferentielProduction(dup).valide === false && hasErr(dup, 'singulier:D2:doublon:coude|coude_90||'), '7. deux entrées sur la même définition (type|géométrie|réf|sens) → doublon signalé');
  const distinct = refProd([S({ id: 'X1', type: 'reduction', geometrie: 'red', sectionReference: 'amont', rapportSections: 0.5, coefficient: 0.2 }), S({ id: 'X2', type: 'reduction', geometrie: 'red', sectionReference: 'aval', rapportSections: 0.5, coefficient: 0.3 })]);
  A(V.validerReferentielProduction(distinct).valide === true, '7b. même géométrie mais référence de section distincte → PAS un doublon (définitions différentes)');
}

// ---- 8. Source / référence / version / domaine ---------------------------------
{
  const noSrc = refProd([{ id: 'NS', type: 'coude', geometrie: 'g', coefficient: 0.3, unite: '', referenceExacte: 'r', domaine: 'd', statut: 'production' }]);
  A(hasErr(noSrc, 'singulier:NS:source_absente'), '8a. source absente → refusée');
  const noRef = refProd([{ id: 'NR', type: 'coude', geometrie: 'g', coefficient: 0.3, unite: '', source: 'SRC', domaine: 'd', statut: 'production' }]);
  A(hasErr(noRef, 'singulier:NR:reference_exacte_absente'), '8b. référence exacte absente → refusée');
  const noDom = refProd([{ id: 'ND', type: 'coude', geometrie: 'g', coefficient: 0.3, unite: '', source: 'SRC', referenceExacte: 'r', statut: 'production' }]);
  A(hasErr(noDom, 'singulier:ND:domaine_absent'), '8c. domaine absent → refusé');
}

// ---- 9. Anti-invention : coefficient non fini / négatif / unité incohérente -----
{
  const noCoef = refProd([S({ id: 'NC', type: 'coude', geometrie: 'g' })]); // pas de coefficient
  A(hasErr(noCoef, 'singulier:NC:coefficient_non_fini'), '9a. coefficient absent → coefficient_non_fini (aucun scalaire supposé)');
  const neg = refProd([S({ id: 'NG', type: 'coude', geometrie: 'g', coefficient: -0.1 })]);
  A(hasErr(neg, 'singulier:NG:coefficient_negatif'), '9b. coefficient négatif → refusé');
  const uni = refProd([S({ id: 'U1', type: 'coude', geometrie: 'g', coefficient: 0.3, unite: 'Pa' })]);
  A(hasErr(uni, 'singulier:U1:unite_invalide'), '9c. ζ avec unité ≠ « » → unite_invalide (ζ sans dimension)');
  const parSansCoef = refProd([S({ id: 'PN', type: 'coude', geometrie: 'g', parametresRequis: ['x'] })]);
  const vp = V.validerReferentielProduction(parSansCoef);
  A(hasErr(parSansCoef, 'singulier:PN:coefficient_non_fini') && hasErr(parSansCoef, 'singulier:PN:parametrique_non_scalarise'), '9d. donnée dépendante SANS scalaire → coefficient_non_fini + parametrique (jamais 0/valeur implicite)');
}

// ---- 10. Fixture/test jamais utilisable en production ---------------------------
{
  const fix = V.creerReferentielProductionPertes({ referentielId: 'F', version: 't', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'SRC', masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'SRC' }, singuliers: [S({ id: 'C', type: 'coude', geometrie: 'g', coefficient: 0.3 })] });
  const vp = V.validerReferentielProduction(fix);
  A(vp.utilisableEnProduction === false && vp.erreurs.indexOf('fixture_non_utilisable_en_production') !== -1, '10. référentiel fixture/test → jamais utilisable en production');
}

// ---- 11. Immuabilité v1.1.0 (aucune donnée ajoutée par LOT35-A) -----------------
{
  const j = JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.1.0.json'), 'utf8'));
  A(j.version === '1.1.0' && Array.isArray(j.singuliers) && j.singuliers.length === 0 && Array.isArray(j.lineaires) && j.lineaires.length === 0, '11. v1.1.0 inchangée (singuliers/lineaires toujours vides — aucune donnée introduite)');
}

// ---- 12. Compatibilité LOT31 : calcul inchangé pour une donnée déjà compatible --
{
  const REF = refProd([S({ id: 'z', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, statut: 'test', provenance: 'test' })]);
  const cv = (v) => V.creerChampValeur({ valeur: v, statut: V.STATUT_VISITE.MESURE });
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }] });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, dv, { referentielProduction: REF });
  const t = r.darcy.singulier.reseaux[0].troncons[0];
  const D = 0.125, Sm = Math.PI * D * D / 4, Vm = (45 / 3600) / Sm, attendu = Math.round((0.4 * 1 * 0.5 * 1.2 * Vm * Vm) * 1000) / 1000;
  A(t.statut === 'calculable' && t.perteSinguliere.valeur === attendu, '12. LOT31 : ζ coude compatible → calcul singulier INCHANGÉ (contrat enrichi rétro-compatible)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Contrat ζ singularité renforcé (M57 LOT35-A) : ' + ok + '/' + total + ' — qualification enrichie, obligations selon le type, scalaire pinné, dépendance signalée sans inventer, doublon/section/source validés, v1.1.0 immuable, LOT31 inchangé');
else { console.error('❌ Contrat ζ LOT35-A : ' + ok + '/' + total); process.exit(1); }
