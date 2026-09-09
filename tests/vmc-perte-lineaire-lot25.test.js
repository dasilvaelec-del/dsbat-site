// =====================================================================
// tests/vmc-perte-lineaire-lot25.test.js — M57 LOT25 : moteur pertes linéaires débit-dépendant
// =====================================================================
// calculerPerteLineaireVmc : moteur MATHÉMATIQUE PUR (Darcy-Weisbach + Reynolds + Colebrook-White
// / laminaire 64/Re). Aucune constante physique cachée (ρ, μ, ε injectés), aucune lecture de
// fichier, aucun DOM, aucun money-path, aucun fallback. Zone de transition (2000≤Re<4000) NON
// calculée. adaptateurReferentielPertesVmc : frontière SÉPARÉE LOT22→LOT25 (aucune famille
// voisine, aucune moyenne). Vérifications INDÉPENDANTES (Swamee-Jain ≠ Colebrook) sur V/Re/f/Δp.
// Aucune valeur de fixture ne migre en production ; le référentiel production V1 reste vide.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const approx = (a, b, rel) => (a != null && b != null && Math.abs(a - b) <= Math.abs(b) * (rel == null ? 1e-9 : rel));

// Fixture air + géométrie de test (FIXTURE_TEST, provenance test — jamais production).
const AIR = { masseVolumique: { valeur: 1.2, unite: 'kg/m3' }, viscositeDynamique: { valeur: 1.8e-5, unite: 'Pa.s' } };
const OPT = { methode: { source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', referentielId: 'FIXTURE_TEST' } };
const mk = (o) => Object.assign({ geometrie: 'circulaire', debit: { valeur: 90, unite: 'm3/h' }, longueur: { valeur: 8, unite: 'm' }, diametreHydraulique: { valeur: 160, unite: 'mm' }, rugosite: { valeur: 0.09, unite: 'mm' }, air: AIR }, o || {});
const calc = (o, opt) => V.calculerPerteLineaireVmc(mk(o), opt || OPT);

A(typeof V.calculerPerteLineaireVmc === 'function' && typeof V.adaptateurReferentielPertesVmc === 'function', '0. moteur + adaptateur exportés');

// ============ VÉRIFICATION INDÉPENDANTE (turbulent) =================================
{
  const r = calc();
  // Calcul manuel indépendant
  const Q = 90 / 3600, D = 0.16, S = Math.PI * D * D / 4, Vv = Q / S, Re = 1.2 * Vv * D / 1.8e-5;
  const epsR = 0.00009 / D;
  const fSJ = 0.25 / Math.pow(Math.log10(epsR / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2); // Swamee-Jain (explicite ≠ Colebrook itératif)
  const dpSJ = fSJ * (8 / D) * (1.2 * Vv * Vv / 2);
  A(r.statut === 'calculable' && r.regime === 'turbulent', '1. cas turbulent calculable');
  A(approx(r.section.valeur, S, 1e-9), '2. section circulaire S = πD²/4 (indépendant)');
  A(approx(r.vitesse.valeur, Vv, 1e-9), '3. vitesse V = Q/S (indépendant, conversion m³/h→m³/s)');
  A(approx(r.reynolds.valeur, Re, 1e-9), '4. Reynolds Re = ρVD/μ (indépendant)');
  A(approx(r.facteurFrottement.valeur, fSJ, 0.02), '5. f Colebrook ≈ f Swamee-Jain (méthode indépendante, <2%)');
  A(approx(r.perteLineaire.valeur, dpSJ, 0.02), '6. Δp Darcy-Weisbach ≈ indépendant (<2%)');
  A(approx(r.perteParMetre.valeur, r.perteLineaire.valeur / 8, 1e-9), '7. perte par mètre = Δp/L');
  A(r.facteurFrottement.methode === 'colebrook_white' && r.facteurFrottement.convergence === true && r.facteurFrottement.iterations > 0, '8. traçabilité Colebrook (méthode/convergence/itérations)');
}

// ============ CONVERSIONS D'UNITÉS ===================================================
{
  // m³/s équivaut à m³/h ÷3600 ; mm→m ; résultat identique.
  const rH = calc({ debit: { valeur: 90, unite: 'm3/h' } });
  const rS = calc({ debit: { valeur: 90 / 3600, unite: 'm3/s' } });
  A(approx(rH.perteLineaire.valeur, rS.perteLineaire.valeur, 1e-9), '9. conversion m³/h ↔ m³/s cohérente');
  const rMM = calc({ diametreHydraulique: { valeur: 160, unite: 'mm' } });
  const rM = calc({ diametreHydraulique: { valeur: 0.16, unite: 'm' } });
  A(approx(rMM.perteLineaire.valeur, rM.perteLineaire.valeur, 1e-9), '10. conversion mm ↔ m cohérente (diamètre)');
  const rEmm = calc({ rugosite: { valeur: 0.09, unite: 'mm' } });
  const rEm = calc({ rugosite: { valeur: 0.00009, unite: 'm' } });
  A(approx(rEmm.facteurFrottement.valeur, rEm.facteurFrottement.valeur, 1e-9), '11. conversion mm ↔ m cohérente (rugosité)');
}

// ============ RÉGIME LAMINAIRE ======================================================
{
  const r = calc({ debit: { valeur: 1, unite: 'm3/h' }, diametreHydraulique: { valeur: 200, unite: 'mm' } });
  A(r.regime === 'laminaire' && r.reynolds.valeur < 2000, '12. régime laminaire (Re<2000)');
  A(approx(r.facteurFrottement.valeur, 64 / r.reynolds.valeur, 1e-12) && r.facteurFrottement.methode === 'laminaire_64_sur_Re', '13. f = 64/Re exact en laminaire');
  A(r.statut === 'calculable' && r.perteLineaire.valeur > 0, '14. laminaire calculable');
  // ε inutile en laminaire :
  const rSansEps = calc({ rugosite: null, debit: { valeur: 1, unite: 'm3/h' }, diametreHydraulique: { valeur: 200, unite: 'mm' } });
  A(rSansEps.statut === 'calculable', '15. laminaire calculable même sans rugosité (ε non requis)');
}

// ============ ZONE DE TRANSITION (2000 ≤ Re < 4000) =================================
{
  let trouve = null;
  for (let q = 5; q < 45; q += 0.25) { const r = calc({ debit: { valeur: q, unite: 'm3/h' }, diametreHydraulique: { valeur: 200, unite: 'mm' } }); if (r.regime === 'transition') { trouve = r; break; } }
  A(trouve && trouve.reynolds.valeur >= 2000 && trouve.reynolds.valeur < 4000, '16. zone de transition détectée (2000≤Re<4000)');
  A(trouve && trouve.statut === 'transition' && trouve.perteLineaire === null, '17. transition → perte NON calculée (jamais présentée comme établie)');
  A(trouve && trouve.pointsAVerifier.some(p => /transition/i.test(p.description)), '18. transition signalée en pointsAVerifier');
}

// ============ COLEBROOK : robustesse ================================================
{
  const r = calc();
  A(r.facteurFrottement.iterations <= 50 && r.facteurFrottement.convergence, '19. Colebrook borné et convergent');
  const nc = calc({}, { maxIterations: 1, methode: OPT.methode });
  A(nc.statut === 'calcul_non_converge' && nc.perteLineaire === null, '20. non-convergence (maxIter=1) → calcul_non_converge, perte null');
  A(nc.facteurFrottement && nc.facteurFrottement.convergence === false && /max_iterations/.test(nc.facteurFrottement.critere), '21. non-convergence tracée (critère explicite, aucune approximation silencieuse)');
}

// ============ CAS INCOMPLETS (donnée absente → null, jamais 0) ======================
{
  A(calc({ debit: null }).statut === 'incomplet' && calc({ debit: null }).donneesManquantes.some(d => d.champ === 'debit'), '22. débit absent → incomplet');
  A(calc({ longueur: null }).statut === 'incomplet', '23. longueur absente → incomplet');
  A(calc({ diametreHydraulique: null }).statut === 'incomplet', '24. diamètre absent → incomplet');
  A(calc({ air: { viscositeDynamique: AIR.viscositeDynamique } }).statut === 'incomplet', '25. masse volumique absente → incomplet');
  A(calc({ air: { masseVolumique: AIR.masseVolumique } }).statut === 'incomplet', '26. viscosité absente → incomplet');
  A(calc({ rugosite: null }).statut === 'incomplet' && calc({ rugosite: null }).donneesManquantes.some(d => d.champ === 'rugosite'), '27. rugosité absente (turbulent) → incomplet');
  const inc = calc({ debit: null });
  A(inc.perteLineaire === null, '28. incomplet → perte null (jamais 0)');
}

// ============ CAS INVALIDES / LIMITES ===============================================
{
  A(calc({ debit: { valeur: -5, unite: 'm3/h' } }).statut === 'invalide', '29. débit négatif → invalide');
  A(calc({ diametreHydraulique: { valeur: 0, unite: 'mm' } }).statut === 'invalide', '30. diamètre nul → invalide');
  A(calc({ diametreHydraulique: { valeur: -10, unite: 'mm' } }).statut === 'invalide', '31. diamètre négatif → invalide');
  A(calc({ rugosite: { valeur: -0.1, unite: 'mm' } }).statut === 'invalide', '32. rugosité négative → invalide');
  A(calc({ debit: { valeur: 'x', unite: 'm3/h' } }).statut === 'invalide', '33. valeur non numérique → invalide');
  A(calc({ debit: { valeur: 90, unite: 'cfm' } }).statut === 'invalide' && calc({ debit: { valeur: 90, unite: 'cfm' } }).erreurs.some(e => /unite_inconnue/.test(e)), '34. unité inconnue → invalide (détectée)');
  const dn = calc({ debit: { valeur: 0, unite: 'm3/h' } });
  A(dn.statut === 'debit_nul' && dn.perteLineaire.valeur === 0, '35. débit nul → Δp = 0 (justifié, pas de division par zéro)');
  const l0 = calc({ longueur: { valeur: 0, unite: 'm' } });
  A(l0.statut === 'calculable' && l0.perteLineaire.valeur === 0 && l0.perteParMetre === null, '36. longueur nulle → Δp = 0, perte/m null (comportement explicite)');
  A(calc({ geometrie: 'rectangulaire' }).statut === 'geometrie_non_supportee', '37. géométrie non circulaire → refusée proprement (aucun diamètre équivalent inventé)');
}

// ============ AUCUNE CONSTANTE PHYSIQUE CACHÉE ======================================
{
  // Sans air fourni → incomplet (le moteur n'injecte JAMAIS ρ=1.2 ni μ par défaut).
  const r = V.calculerPerteLineaireVmc({ geometrie: 'circulaire', debit: { valeur: 90, unite: 'm3/h' }, longueur: { valeur: 8, unite: 'm' }, diametreHydraulique: { valeur: 160, unite: 'mm' }, rugosite: { valeur: 0.09, unite: 'mm' } }, OPT);
  A(r.statut === 'incomplet' && r.donneesManquantes.some(d => /masse_volumique/.test(d.champ)) && r.donneesManquantes.some(d => /viscosite/.test(d.champ)), '38. aucune constante physique cachée : ρ/μ non fournis → incomplet');
}

// ============ TRAÇABILITÉ ===========================================================
{
  const r = calc();
  A(r.methode && r.methode.id === 'darcy_weisbach_colebrook_white', '39. méthode identifiée');
  A(r.methode.source === 'FIXTURE_TEST' && r.methode.version === 'test-0' && r.methode.provenance === 'test', '40. source/version/provenance conservées');
  A(r.parametresUtilises && approx(r.parametresUtilises.epsilon.valeur, 0.00009, 1e-12) && r.parametresUtilises.masseVolumique.valeur === 1.2 && r.parametresUtilises.viscositeDynamique.valeur === 1.8e-5, '41. paramètres effectivement utilisés (ε, ρ, μ) tracés → calcul reproductible');
}

// ============ NON-MUTATION ==========================================================
{
  const e = mk({});
  const snap = JSON.stringify(e);
  V.calculerPerteLineaireVmc(e, OPT);
  A(JSON.stringify(e) === snap, '42. le moteur ne mute pas son entrée');
}

// ============ ADAPTATEUR LOT22 (frontière séparée) ==================================
{
  const ref = V.creerReferentielProductionPertes({
    referentielId: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIXTURE_TEST',
    masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIXTURE_TEST' },
    viscositeDynamiqueAir: { valeur: 1.8e-5, unite: 'Pa.s', source: 'FIXTURE_TEST' },
    rugosites: [{ id: 'R1', typeConduit: 'souple', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 'test', source: 'FIXTURE_TEST', referenceExacte: 't', statut: 'test' }]
  });
  const a = V.adaptateurReferentielPertesVmc({ typeConduit: 'souple', debit: 90, longueur: 8, diametre: 160 }, ref);
  A(a.exploitable === true && a.entree.rugosite.valeur === 0.09 && a.entree.air.masseVolumique.valeur === 1.2, '43. adaptateur : ε + propriétés air récupérés de la famille compatible');
  A(a.methode.referentielId === 'FIXTURE_TEST' && a.methode.provenance === 'test' && a.methode.rugositeReference === 't', '44. adaptateur : source/version/provenance/référence conservées');
  const chain = V.calculerPerteLineaireVmc(a.entree, { methode: a.methode });
  A(chain.statut === 'calculable' && chain.methode.referentielId === 'FIXTURE_TEST', '45. chaîne adaptateur→moteur produit un résultat tracé');
  // Aucune sélection/fallback silencieux :
  const koFam = V.adaptateurReferentielPertesVmc({ typeConduit: 'rigide', debit: 90, longueur: 8, diametre: 160 }, ref);
  A(koFam.exploitable === false && koFam.entree === null && koFam.raisons.some(r => /rugosite_absente_famille:rigide/.test(r)), '46. famille absente → non exploitable (aucune famille voisine, aucune moyenne)');
  const koRef = V.adaptateurReferentielPertesVmc({ typeConduit: 'souple', debit: 90, longueur: 8, diametre: 160 }, null);
  A(koRef.exploitable === false && koRef.raisons.includes('referentiel_absent'), '47. référentiel absent → non exploitable');
  // Ambiguïté (2 entrées même famille) → refus, aucun choix silencieux :
  const ref2 = V.creerReferentielProductionPertes(Object.assign(JSON.parse(JSON.stringify(ref)), { rugosites: [ref.rugosites[0], Object.assign({}, ref.rugosites[0], { id: 'R2', epsilon: 0.15 })] }));
  const amb = V.adaptateurReferentielPertesVmc({ typeConduit: 'souple', debit: 90, longueur: 8, diametre: 160 }, ref2);
  A(amb.exploitable === false && amb.raisons.some(r => /ambigue/.test(r)), '48. familles ε ambiguës → refus (aucun choix silencieux)');
}

// ============ GAINE SOUPLE : aucune décision d'état inventée ========================
{
  // Le moteur calcule avec la rugosité fournie mais n'infère jamais « tendu/comprimé » ni ne
  // convertit une famille. Sans donnée d'état, l'adaptateur ne fabrique aucun facteur correctif.
  const ref = V.creerReferentielProductionPertes({ referentielId: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIXTURE_TEST', masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIXTURE_TEST' }, viscositeDynamiqueAir: { valeur: 1.8e-5, unite: 'Pa.s', source: 'FIXTURE_TEST' }, rugosites: [] });
  const a = V.adaptateurReferentielPertesVmc({ typeConduit: 'souple', debit: 90, longueur: 8, diametre: 160 }, ref);
  A(a.exploitable === false && a.raisons.some(r => /rugosite_absente_famille:souple/.test(r)), '49. gaine souple sans rugosité qualifiée → non exploitable (aucun état/correction inventé)');
}

// ============ RÉFÉRENTIEL PRODUCTION V1 TOUJOURS VIDE ================================
{
  const prod = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.0.0.json'), 'utf8')));
  A((prod.rugosites || []).length === 0 && prod.viscositeDynamiqueAir == null && (prod.lineaires || []).length === 0, '50. production V1 : aucune rugosité/viscosité/coefficient (toujours vide)');
  const a = V.adaptateurReferentielPertesVmc({ typeConduit: 'souple', debit: 90, longueur: 8, diametre: 160 }, prod);
  A(a.exploitable === false, '51. production V1 vide → aucune perte exploitable (honnête)');
}

// ============ STATIQUE — money-path / pas de constante cachée / pas de fichier =======
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const BLOC = SRC.slice(SRC.indexOf('M57 LOT25'), SRC.indexOf('if (typeof module'));
  A(BLOC.length > 0, '52. bloc LOT25 localisé');
  A(!/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|moteur-piece|getMoyenPrixFor|prixTotal|dimensionnementVMC/.test(BLOC), '53. LOT25 : aucun money-path');
  A(!/require\(|readFileSync\(|fetch\(|sessionStorage\.|localStorage\.|document\.|window\.|globalThis\./.test(BLOC), '54. LOT25 : aucune lecture fichier / DOM / storage / réseau (usage réel)');
  // Aucune constante physique en dur dans le moteur (ρ=1.2 / μ typique) hors bornes de régime documentées.
  A(!/rho\s*=\s*1\.2|masseVolumique\s*=\s*1\.2|1\.8e-5|viscosite\s*=\s*0\.0000/.test(BLOC), '55. LOT25 : aucune constante physique cachée (ρ/μ jamais posés)');
  A(!/projeterVmcVersConfig/.test(BLOC), '56. LOT25 : aucune projection tarifaire');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Moteur pertes linéaires débit-dépendant (M57 LOT25) : ' + ok + '/' + total + ' — Darcy/Colebrook pur, transition non calculée, adaptateur séparé, hors money-path, production vide');
else { console.error('❌ Moteur pertes linéaires LOT25 : ' + ok + '/' + total); process.exit(1); }
