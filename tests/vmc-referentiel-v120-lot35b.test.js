// =====================================================================
// tests/vmc-referentiel-v120-lot35b.test.js — M57 LOT35-B : référentiel production v1.2.0
// =====================================================================
// v1.2.0 = v1.1.0 (rugosité galva + air + méthode Darcy) STRICTEMENT INCHANGÉE + UNE seule
// singularité admissible : décharge libre ζ=1 (bilan d'énergie / limite Borda-Carnot, domaine
// public). Aucune table propriétaire, aucune valeur inventée/moyennée/extrapolée, aucun fabricant.
// Vérifie : validation production, provenance/version/domaine/méthode/section, refus des données
// non qualifiées (absentes), absence de fallback, compatibilité LOT31, v1.0.0/v1.1.0 immuables.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const lire = (v) => JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-' + v + '.json'), 'utf8'));
const cv = (val) => V.creerChampValeur({ valeur: val, statut: V.STATUT_VISITE.MESURE });

const J120 = lire('v1.2.0');
const PROD = V.chargerReferentielPertesDepuisJSON(J120);

// ---- 1. v1.2.0 valide et utilisable en production ------------------------------
{
  const vp = V.validerReferentielProduction(PROD);
  A(vp.valide === true && vp.utilisableEnProduction === true, '1a. v1.2.0 valide et utilisable en production');
  A(vp.utilisablePourCalculDarcy === true && vp.familles.rugosites === 1 && vp.familles.singuliers === 1 && vp.familles.lineaires === 0, '1b. Darcy utilisable ; 1 rugosité (galva) + 1 singularité + 0 table R');
  A(vp.erreurs.length === 0, '1c. aucune erreur de validation');
}

// ---- 2. Provenance / version / domaine / méthode / section de référence --------
{
  const s = PROD.singuliers[0];
  A(PROD.version === '1.2.0' && PROD.statut === 'production' && PROD.provenance === 'referentiel', '2a. métadonnées référentiel (version 1.2.0, production, referentiel)');
  A(s.type === 'sortie' && s.geometrie === 'decharge_libre' && s.coefficient === 1 && s.unite === '', '2b. singularité sortie/décharge libre, ζ=1, sans dimension');
  A(s.sectionReference === 'amont' && s.methode === 'bilan_energie_decharge_libre' && s.domaine != null && s.conditionsApplication != null, '2c. section de référence (amont), méthode, domaine et conditions renseignés');
  A(s.source != null && s.referenceExacte != null && s.versionSource != null && s.datePublication != null && s.statut === 'production', '2d. source / référence exacte / version / date / statut complets');
}

// ---- 3. Qualification LOT35-A : scalarisable, non paramétrique -----------------
{
  const q = V.validerReferentielProduction(PROD).qualiteSinguliers[0];
  A(q.scalarisable === true && q.parametrique === false && q.raisons.length === 0, '3. entrée qualifiée scalarisable (géométrie + domaine + section fixes)');
}

// ---- 4. Compilation (type, géométrie) → coefficient ----------------------------
{
  const comp = V.compilerReferentielPertes(PROD);
  A(comp.rapport.utilisable === true && comp.referentiel.singulier.sortie && comp.referentiel.singulier.sortie['decharge_libre'].coefficient === 1, '4. compilation : singulier.sortie.decharge_libre = 1');
}

// ---- 5. Droit de réutilisation : bilan d'énergie, aucune table propriétaire -----
{
  const s = PROD.singuliers[0];
  A(/Borda-Carnot|bilan d'?.?nergie|domaine public/i.test(s.source) && !/ASHRAE|Idelchik|NF DTU|CSTB/i.test(s.source), '5a. source = bilan d\'énergie / domaine public (aucune table ASHRAE/Idelchik/NF DTU pour ζ)');
  A(/fabricant|grille|bouche|prise d'?air|chapeau/i.test(s.domaine) && /NON applicable|jamais/i.test(s.domaine), '5b. domaine exclut explicitement grilles/bouches/prises d\'air/rejets fabricants (→ LOT17-B)');
}

// ---- 6. Compatibilité LOT31 : décharge libre → perteSinguliere = ½ρV² (ζ=1) -----
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'collecteur', pieceRef: 'sdb#1', longueur: cv(4), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(90), singularites: [{ type: 'sortie', geometrie: 'decharge_libre', quantite: cv(1) }] });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, dv, { referentielProduction: PROD });
  const t = r.darcy.singulier.reseaux[0].troncons[0];
  const D = 0.125, S = Math.PI * D * D / 4, Vv = (90 / 3600) / S, attendu = Math.round((1 * 0.5 * 1.2 * Vv * Vv) * 1000) / 1000;
  A(t.statut === 'calculable' && t.perteSinguliere.valeur === attendu && t.singularites[0].coefficient === 1, '6. LOT31 consomme ζ=1 → perteSinguliere = ½ρV² (référence = vitesse du tronçon)');
}

// ---- 7. AUCUN fallback : géométrie/type non couverts → incomplet, jamais substitué
{
  const essai = (sing) => {
    let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
    dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
    dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'collecteur', pieceRef: 'sdb#1', longueur: cv(4), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(90), singularites: [sing] });
    const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, dv, { referentielProduction: PROD });
    return r.darcy.singulier.reseaux[0].troncons[0];
  };
  const coude = essai({ type: 'coude', geometrie: 'coude_90', quantite: cv(1) });
  A(coude.statut === 'incomplet' && coude.perteSinguliere === null, '7a. coude non couvert → incomplet, aucune valeur de substitution');
  const autreGeo = essai({ type: 'sortie', geometrie: 'decharge_avec_diffuseur', quantite: cv(1) });
  A(autreGeo.statut === 'incomplet' && autreGeo.perteSinguliere === null, '7b. sortie d\'une AUTRE géométrie (diffuseur) → incomplet (correspondance stricte, aucun repli sur décharge libre)');
}

// ---- 8. Aucune autre singularité intégrée (pas de bibliothèque « pour remplir ») -
{
  A(PROD.singuliers.length === 1 && PROD.singuliers[0].type === 'sortie', '8a. une SEULE singularité (décharge libre) — aucun coude/té/réduction/entrée intégré');
  const types = PROD.singuliers.map(s => s.type);
  A(types.indexOf('coude') === -1 && types.indexOf('te') === -1 && types.indexOf('reduction') === -1 && types.indexOf('elargissement') === -1 && types.indexOf('entree') === -1, '8b. aucune donnée non qualifiée / non consommable intégrée');
}

// ---- 9. Rugosités et méthode linéaire IDENTIQUES à v1.1.0 -----------------------
{
  const J110 = lire('v1.1.0');
  A(JSON.stringify(J120.rugosites) === JSON.stringify(J110.rugosites), '9a. rugosités v1.2.0 == v1.1.0 (ε galva 0,09 mm inchangé)');
  A(J120.lineaires.length === 0 && JSON.stringify(J120.masseVolumiqueAir) === JSON.stringify(J110.masseVolumiqueAir) && JSON.stringify(J120.viscositeDynamiqueAir) === JSON.stringify(J110.viscositeDynamiqueAir), '9b. aucune table R ; air ρ/μ inchangés');
}

// ---- 10. v1.0.0 et v1.1.0 STRICTEMENT immuables --------------------------------
{
  const J110 = lire('v1.1.0'); const J100 = lire('v1.0.0');
  A(J110.version === '1.1.0' && J110.singuliers.length === 0 && J110.lineaires.length === 0 && J110.rugosites.length === 1, '10a. v1.1.0 inchangée (singuliers vides — aucune donnée ajoutée)');
  A(J100.version === '1.0.0' && J100.singuliers.length === 0 && J100.lineaires.length === 0 && (J100.rugosites || []).length === 0, '10b. v1.0.0 inchangée (vide)');
}

// ---- 11. Darcy linéaire (galva) toujours calculable avec v1.2.0 -----------------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'collecteur', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, dv, { referentielProduction: PROD });
  A(r.darcy.reseaux[0].troncons[0].statut === 'calculable' && r.darcy.reseaux[0].troncons[0].perteLineaire.valeur > 0, '11. perte linéaire Darcy (galva) inchangée et calculable avec v1.2.0');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Référentiel production v1.2.0 (M57 LOT35-B) : ' + ok + '/' + total + ' — décharge libre ζ=1 (bilan d\'énergie, domaine public) intégrée, scalarisable/consommable LOT31, aucune autre donnée, aucun fallback, v1.0.0/v1.1.0 immuables');
else { console.error('❌ Référentiel v1.2.0 LOT35-B : ' + ok + '/' + total); process.exit(1); }
