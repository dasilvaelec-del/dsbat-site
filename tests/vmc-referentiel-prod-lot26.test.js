// =====================================================================
// tests/vmc-referentiel-prod-lot26.test.js — M57 LOT26 : première donnée de production sourcée
// =====================================================================
// v1.1.0 intègre UNE famille de rugosité absolue : acier galvanisé RIGIDE ε = 0,09 mm
// (ASHRAE Handbook—Fundamentals, Duct Design, Table 1 « Medium smooth » ; déterministe, sourcée).
// Contrôles : source/référence/version/unité/domaine/provenance ; provenance = 'referentiel'
// (JAMAIS 'reglementaire') ; domaine réel conservé (ASHRAE, non générique résidentiel) ;
// adaptateur LOT25 trouve la famille couverte et REFUSE toute famille non couverte (aucun
// fallback, aucune moyenne, aucune substitution) ; calcul Darcy LOT25 bout-en-bout ; v1.0.0
// (vide) reste IMMUABLE. Aucune table R (Pa/m). Aucune donnée commerciale. Hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const lire = (f) => JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', f), 'utf8'));

const J11 = lire('referentiel-pertes-vmc-v1.1.0.json');
const PROD = V.chargerReferentielPertesDepuisJSON(J11);

// ---- 1. Métadonnées de version ---------------------------------------------------
A(PROD.version === '1.1.0' && PROD.statut === 'production' && PROD.referentielId === 'vmc_pertes_fr', '1. v1.1.0 production identifiée');
A(PROD.datePublication != null && PROD.sourcePrincipale != null, '1b. datePublication + sourcePrincipale présentes');

// ---- 2. Une seule famille : acier galvanisé rigide -------------------------------
A(Array.isArray(PROD.rugosites) && PROD.rugosites.length === 1, '2. exactement UNE famille de rugosité (discipline « une seule bonne famille »)');
const e = PROD.rugosites[0];
A(e.typeConduit === 'acier_galvanise' && e.epsilon === 0.09 && e.uniteEpsilon === 'mm', '3. acier galvanisé ε = 0,09 mm');
A(typeof e.epsilon === 'number' && e.epsilon > 0, '4. ε valeur positive');
A(e.geometrie === 'conduit_rigide_circulaire', '5. géométrie rigide circulaire (aucun flexible)');

// ---- 3. Source / référence / version -------------------------------------------
A(/ASHRAE/i.test(e.source) && /Table 1|Duct Roughness/i.test(e.source), '6. source ASHRAE Table 1 explicite');
A(e.referenceExacte != null && /Medium smooth|0,09|0\.09|Griggs/i.test(e.referenceExacte), '7. référence exacte (catégorie/valeur/auteur)');
A(e.versionSource != null && e.datePublication != null, '8. version source + date présentes');
A(e.statut === 'production', '9. entrée statut production');

// ---- 4. Provenance : referentiel, JAMAIS reglementaire ---------------------------
A(PROD.provenance === 'referentiel', '10. provenance référentiel = « referentiel »');
A(PROD.provenance !== 'reglementaire' && !/["\x27]reglementaire["\x27]/.test(JSON.stringify(PROD).replace(/jamais .reglementaire./g, '')), '11. jamais présentée comme réglementaire française');

// ---- 5. Domaine réel conservé (non générique résidentiel) ------------------------
A(/galvanis|rigide|ASHRAE/i.test(e.domaine), '12. domaine conserve la nature réelle de la source (galvanisé rigide, ASHRAE)');
A(/non normative|à justifier|résidentiel|souple\/semi/i.test(e.domaine), '13. domaine explicite : application résidentielle à justifier (aucune généralisation cachée)');

// ---- 6. Propriétés de l'air sourcées (aucune constante cachée) -------------------
A(PROD.masseVolumiqueAir && typeof PROD.masseVolumiqueAir.valeur === 'number' && PROD.masseVolumiqueAir.source, '14. masse volumique air sourcée');
A(PROD.viscositeDynamiqueAir && PROD.viscositeDynamiqueAir.valeur > 0 && PROD.viscositeDynamiqueAir.unite === 'Pa.s' && /Sutherland|20 ?°C|physique/i.test(PROD.viscositeDynamiqueAir.source), '15. viscosité dynamique sourcée (Pa·s, propriété physique tracée)');

// ---- 7. Validation production ----------------------------------------------------
const vp = V.validerReferentielProduction(PROD);
A(vp.valide === true && vp.erreurs.length === 0, '16. référentiel valide (aucune erreur)');
A(vp.utilisableEnProduction === true, '17. utilisable en production');
A(vp.utilisablePourCalculDarcy === true && vp.familles.rugosites === 1, '18. utilisable pour le calcul Darcy (ε + ρ + μ présents)');
A(vp.utilisablePourCalcul === false, '19. voie R/ζ (LOT15-A) : non calculable (aucune table R — cohérent avec Darcy)');
A(PROD.lineaires.length === 0 && PROD.singuliers.length === 0, '20. aucune table R (Pa/m) ni coefficient ζ (LOT26 n\'est PAS LOT23)');

// ---- 8. Adaptateur LOT25 : famille couverte -------------------------------------
const aG = V.adaptateurReferentielPertesVmc({ typeConduit: 'acier_galvanise', debit: 90, longueur: 8, diametre: 160 }, PROD);
A(aG.exploitable === true && aG.entree.rugosite.valeur === 0.09 && aG.entree.rugosite.unite === 'mm', '21. adaptateur : famille couverte → ε récupéré');
A(aG.entree.air.masseVolumique.valeur === PROD.masseVolumiqueAir.valeur && aG.entree.air.viscositeDynamique.valeur === PROD.viscositeDynamiqueAir.valeur, '22. adaptateur : propriétés air transmises');
A(aG.methode.referentielId === 'vmc_pertes_fr' && aG.methode.version === '1.1.0' && aG.methode.provenance === 'referentiel' && aG.methode.rugositeReference === e.referenceExacte, '23. adaptateur : traçabilité (id/version/provenance/référence) conservée');

// ---- 9. Adaptateur : familles NON couvertes → aucun fallback --------------------
['souple', 'semi_rigide', 'pvc', 'aluminium', 'flexible', 'rigide'].forEach(function (fam) {
  const r = V.adaptateurReferentielPertesVmc({ typeConduit: fam, debit: 90, longueur: 8, diametre: 160 }, PROD);
  A(r.exploitable === false && r.entree === null && r.raisons.some(x => x === 'rugosite_absente_famille:' + fam), '24. famille non couverte « ' + fam + ' » → refus (aucun fallback/moyenne/substitution)');
});
A(V.adaptateurReferentielPertesVmc({ typeConduit: 'acier_galvanise', debit: 90, longueur: 8, diametre: 160 }, null).raisons.includes('referentiel_absent'), '25. référentiel absent → refus explicite');

// ---- 10. Calcul LOT25 bout-en-bout ----------------------------------------------
const calc = V.calculerPerteLineaireVmc(aG.entree, { methode: aG.methode });
A(calc.statut === 'calculable' && calc.perteLineaire.valeur > 0 && calc.regime === 'turbulent', '26. calcul Darcy calculable avec la donnée production');
A(calc.methode.version === '1.1.0' && calc.methode.provenance === 'referentiel' && calc.methode.referentielId === 'vmc_pertes_fr', '27. résultat tracé jusqu\'au référentiel/version');
A(Math.abs(calc.parametresUtilises.epsilon.valeur - 0.00009) < 1e-12, '28. ε converti en SI (0,09 mm → 9e-5 m) et tracé dans les paramètres utilisés');

// ---- 11. v1.0.0 IMMUABLE ---------------------------------------------------------
const J10 = lire('referentiel-pertes-vmc-v1.0.0.json');
A(J10.version === '1.0.0' && (J10.rugosites == null || J10.rugosites.length === 0) && J10.lineaires.length === 0 && J10.viscositeDynamiqueAir == null, '29. v1.0.0 (vide) inchangée / immuable');

// ---- 12. Aucune donnée commerciale ; aucune valeur inventée hors source ----------
A(!/marque|prix|referenceCommerciale|modele|fournisseur|catalogue/i.test(JSON.stringify(J11.rugosites)), '30. aucune donnée commerciale dans le référentiel');
A(V.adaptateurReferentielPertesVmc({ typeConduit: 'acier_galvanise', debit: 0, longueur: 8, diametre: 160 }, PROD).exploitable === true, '31. adaptateur ne juge pas le débit (laisse le moteur gérer débit nul)');

// ---- 13. Le moteur/référentiel ne se charge pas seul (chemin non codé en dur) ----
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
A(!/referentiel-pertes-vmc|\.json['"]/.test(SRC), '32. aucun chemin de fichier référentiel codé en dur dans le moteur (référentiel injecté)');
A(!/piece\.config|calculerPiece|moteur-devis|getMoyenPrixFor|prixTotal|projeterVmcVersConfig/.test(SRC.slice(SRC.indexOf('M57 LOT26 (additif) : voie LOT25'))), '33. bloc LOT26 : hors money-path');

const total = ok + ko;
if (ko === 0) console.log('✅ Première donnée production sourcée (M57 LOT26) : ' + ok + '/' + total + ' — galvanisé ε=0,09 mm (ASHRAE), domaine réel conservé, adaptateur sans fallback, v1.0.0 immuable');
else { console.error('❌ Donnée production LOT26 : ' + ok + '/' + total); process.exit(1); }
