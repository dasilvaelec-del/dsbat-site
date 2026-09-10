// =====================================================================
// tests/vmc-etude-singuliere-lot31.test.js — M57 LOT31 : perte SINGULIÈRE (voie Darcy)
// =====================================================================
// Nouveau calcul PUR et ADDITIF : perte singulière par tronçon = Σ ζ · ½·ρ·V², jumeau singulier
// de la voie linéaire Darcy (LOT25/LOT27). Contrat vérifié :
//   • aucune ζ inventée : ζ (et ρ) viennent EXCLUSIVEMENT du référentiel de PRODUCTION injecté ;
//   • Darcy LOT27 enrichi SANS repli : ζ absent/ambigu → incomplet, jamais un fallback LOT15-A ;
//   • SF/DF SÉPARÉS : extraction et insufflation jamais additionnés ;
//   • résultat incomplet si une donnée/coefficient manque (jamais 0, jamais moyenne) ;
//   • voie historique LOT15-A (etude.pertes) et total linéaire LOT27 INCHANGÉS (additif) ;
//   • hors money-path, non mutant.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (val, st) => V.creerChampValeur({ valeur: val, statut: st || S.MESURE });
const CTX = (x) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, x || {});
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---- Physique de référence (recalcul indépendant pour vérifier le moteur) ----
const RHO = 1.2;
const pdyn = (debitM3h, diamMm) => { const S2 = Math.PI * Math.pow(diamMm / 1000, 2) / 4; const Vv = (debitM3h / 3600) / S2; return 0.5 * RHO * Vv * Vv; };

// ---- Référentiels PRODUCTION ------------------------------------------------
// Réel v1.1.0 : rugosité galva + air, MAIS singuliers = [] (aucune ζ en production).
const PROD = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.1.0.json'), 'utf8')));
// Fixture : air + rugosité galva (pour le linéaire) + ζ (coude 0.4, té 1.3).
const REF_SING = V.creerReferentielProductionPertes({
  referentielId: 'FIX_SING', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
  masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIX' },
  viscositeDynamiqueAir: { valeur: 1.81e-5, unite: 'Pa.s', source: 'FIX' },
  rugosites: [{ id: 'g', typeConduit: 'acier_galvanise', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 'test', source: 'FIX', referenceExacte: 't', statut: 'test' }],
  singuliers: [
    { id: 'z_coude', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, unite: '', domaine: 'test', source: 'ASHRAE-fixture', referenceExacte: 't', statut: 'test' },
    { id: 'z_te', type: 'te', geometrie: 'te_derivation', coefficient: 1.3, unite: '', domaine: 'test', source: 'ASHRAE-fixture', referenceExacte: 't', statut: 'test' }
  ]
});
// Fixture ζ SANS air (ρ absente).
const REF_SING_SANS_AIR = V.creerReferentielProductionPertes({
  referentielId: 'FIX_SING_SA', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
  singuliers: [{ id: 'z_coude', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, unite: '', domaine: 'test', source: 'FIX', referenceExacte: 't', statut: 'test' }]
});
// Fixture ζ AMBIGUË (deux entrées même type/géométrie) → aucun choix silencieux.
const REF_SING_AMBIGU = V.creerReferentielProductionPertes({
  referentielId: 'FIX_SING_AMB', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
  masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIX' },
  singuliers: [
    { id: 'z_c1', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, unite: '', domaine: 'test', source: 'FIX', referenceExacte: 't', statut: 'test' },
    { id: 'z_c2', type: 'coude', geometrie: 'coude_90', coefficient: 0.7, unite: '', domaine: 'test', source: 'FIX', referenceExacte: 't', statut: 'test' }
  ]
});
// Référentiel LOT15-A (table) qui, LUI, POSSÈDE la ζ — pour prouver l'absence de repli.
const REF_R_LOT15A = { methode: 'table_lineaire_pa_par_m', source: 'FIX', version: 't', provenance: 'test', masseVolumiqueAir: 1.2, lineaire: { acier_galvanise: { 125: 0.8 } }, singulier: { coude: { coude_90: { coefficient: 0.4 } } } };

function reseauSF(troncons, systeme) {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: systeme || 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  troncons.forEach(t => { dv = V.ajouterTronconVisite(dv, 'RE', t); });
  return dv;
}
const SING2 = [{ type: 'coude', geometrie: 'coude_90', quantite: cv(2) }, { type: 'te', geometrie: 'te_derivation', quantite: cv(1) }];
const T_OK = () => ({ id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: SING2.map(s => Object.assign({}, s)) });
const PIECES = [{ id: 'sdb', numero: 1 }];
const opt = (extra) => Object.assign({ referentielProduction: REF_SING }, extra || {});

// ---- 0. Export + enrichissement additif de la voie Darcy -------------------
A(typeof V.etudeSinguliereVmc === 'function', '0. LOT31 exporté (etudeSinguliereVmc)');

// ---- 1-4. Calcul singulier SF : Σ ζ·½ρV² exact -----------------------------
{
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([T_OK()]), opt());
  A(r.darcy && r.darcy.singulier && r.darcy.singulier.disponible === true, '1. voie singulière présente et disponible (enrichissement Darcy)');
  const t = r.darcy.singulier.reseaux[0].troncons[0];
  const attendu = r3((0.4 * 2 + 1.3 * 1) * pdyn(45, 125));
  A(t.statut === 'calculable' && t.perteSinguliere.valeur === attendu, '2. tronçon : Σ ζ·½ρV² exact = ' + attendu + ' Pa');
  A(r.darcy.singulier.reseaux[0].statut === 'singuliere_calculee' && r.darcy.singulier.reseaux[0].perteSinguliereTotale.valeur === attendu, '3. total réseau singulier propagé');
  // ζ tracée depuis la source production (jamais écrite dans le code)
  A(t.singularites[0].coefficient === 0.4 && /fixture|ASHRAE/i.test(String(t.singularites[0].source)), '4. ζ et source proviennent du référentiel de production (traçabilité)');
}

// ---- 5-6. perteTotaleDarcy PAR RÉSEAU = linéaire + singulière (deux complets) -
{
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([T_OK()]), opt());
  const res = r.darcy.reseaux[0];
  A(res.perteLineaireTotale && res.perteLineaireTotale.valeur > 0 && res.singulier.perteSinguliereTotale.valeur > 0, '5. linéaire ET singulier calculés sur galva');
  const somme = r3(res.perteLineaireTotale.valeur + res.singulier.perteSinguliereTotale.valeur);
  A(res.perteTotaleDarcy && res.perteTotaleDarcy.valeur === somme && res.perteTotaleDarcy.composantes.lineaire === res.perteLineaireTotale.valeur, '6. perteTotaleDarcy réseau = linéaire + singulière (composantes tracées)');
}

// ---- 7. Tronçon SANS singularité déclarée → 0 Pa (fait établi, pas inventé) --
{
  const t = { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45) };
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([t]), opt());
  const tr = r.darcy.singulier.reseaux[0].troncons[0];
  A(tr.statut === 'calculable' && tr.perteSinguliere.valeur === 0 && tr.nbSingularites === 0, '7. aucune singularité → 0 Pa (jamais null, jamais inventé)');
}

// ---- 8-10. Données/coefficient manquants → incomplet + null (jamais 0) -------
{
  // ρ absente (référentiel sans air) : le singulier passe par le linéaire → mais on cible le singulier.
  const rAir = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([T_OK()]), { referentielProduction: REF_SING_SANS_AIR });
  const tAir = rAir.darcy.singulier.reseaux[0].troncons[0];
  A(tAir.statut === 'incomplet' && tAir.perteSinguliere === null && (rAir.darcy.singulier.donneesManquantes || []).some(x => x.champ === 'masse_volumique_air'), '8. ρ absente → singulier incomplet + null');
  // débit absent
  const tt = T_OK(); delete tt.debit;
  const rQ = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tt]), opt());
  const trQ = rQ.darcy.singulier.reseaux[0].troncons[0];
  A(trQ.statut === 'incomplet' && trQ.perteSinguliere === null, '9. débit absent → singulier incomplet + null');
  // diamètre absent
  const td = T_OK(); delete td.diametre;
  const rD = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([td]), opt());
  A(rD.darcy.singulier.reseaux[0].troncons[0].statut === 'incomplet' && rD.darcy.singulier.reseaux[0].troncons[0].perteSinguliere === null, '10. diamètre absent → singulier incomplet + null');
}

// ---- 11-13. AUCUNE ζ inventée + AUCUN repli (Darcy LOT27 enrichi sans fallback)
{
  // Tronçon avec UNE seule singularité (coude), présente dans la table LOT15-A mais ABSENTE du
  // référentiel de PRODUCTION réel (singuliers = []). La voie Darcy doit rester INCOMPLÈTE.
  const tCoude = { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }] };
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tCoude]), { referentielProduction: PROD, referentielPertes: REF_R_LOT15A });
  const tr = r.darcy.singulier.reseaux[0].troncons[0];
  A(tr.statut === 'incomplet' && tr.perteSinguliere === null, '11. ζ absente en production → singulier incomplet (jamais 0)');
  A((r.darcy.singulier.donneesManquantes || []).some(x => /^coefficient_singulier_absent:/.test(x.champ)), '12. cause explicite : coefficient_singulier_absent (aucune ζ inventée)');
  // Preuve de non-repli : la voie historique LOT15-A, elle, A calculé la singulière (ζ dans sa table).
  A(r.pertes.reseaux[0].pertesSingulieres !== null && tr.perteSinguliere === null, '13. AUCUN repli : LOT15-A calcule la ζ, la voie Darcy reste incomplète (référentiels non mélangés)');
}

// ---- 14. ζ ambiguë (>1 candidat) → incomplet, aucun choix silencieux ---------
{
  const t = { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }] };
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([t]), { referentielProduction: REF_SING_AMBIGU });
  const tr = r.darcy.singulier.reseaux[0].troncons[0];
  A(tr.statut === 'incomplet' && tr.perteSinguliere === null && (r.darcy.singulier.donneesManquantes || []).some(x => /^coefficient_singulier_ambigu:/.test(x.champ)), '14. ζ ambiguë → incomplet (aucun choix silencieux)');
}

// ---- 15-18. SF / DF SÉPARÉS : jamais additionnés ----------------------------
{
  const rSF = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([T_OK()]), opt());
  A(rSF.darcy.singulier.reseaux.length === 1 && rSF.darcy.singulier.reseaux[0].type === 'extraction', '15. SF : un seul réseau singulier (extraction)');
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'E1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(2) }] });
  dv = V.ajouterTronconVisite(dv, 'RI', { id: 'I1', role: 'antenne', pieceRef: 'chambre#1', longueur: cv(6), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: [{ type: 'te', geometrie: 'te_derivation', quantite: cv(1) }] });
  const rDF = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }, { id: 'chambre', numero: 1 }], CTX({ solution: 'double_flux' }), dv, opt());
  const ext = rDF.darcy.singulier.reseaux.filter(x => x.type === 'extraction')[0];
  const ins = rDF.darcy.singulier.reseaux.filter(x => x.type === 'insufflation')[0];
  A(rDF.darcy.singulier.reseaux.length === 2 && ext && ins, '16. DF : extraction et insufflation présents (singulier)');
  A(ext.perteSinguliereTotale.valeur === r3(0.4 * 2 * pdyn(45, 125)) && ins.perteSinguliereTotale.valeur === r3(1.3 * 1 * pdyn(45, 125)) && ext !== ins, '17. DF : totaux singuliers séparés par réseau');
  A(!/perteSinguliereGlobale|reseauFusionne|perteTotaleGlobale/.test(JSON.stringify(rDF.darcy)) && !rDF.darcy.singulier.perteSinguliereTotale, '18. DF : aucune addition extraction+insufflation (aucun total global)');
}

// ---- 19-21. ADDITIVITÉ : LOT15-A et LOT27 linéaire strictement inchangés ------
{
  const dv = reseauSF([T_OK()]);
  // À référentiel LOT15-A CONSTANT : ajouter la voie production (LOT31) ne doit RIEN changer à etude.pertes.
  const base15 = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF_R_LOT15A });
  const both = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF_R_LOT15A, referentielProduction: REF_SING });
  A(JSON.stringify(base15.pertes) === JSON.stringify(both.pertes), '19. etude.pertes (LOT15-A) strictement identique avec/sans LOT31 (voie historique intacte)');
  A(base15.darcy.disponible === false && base15.statut === both.statut, '20. sans référentiel production → Darcy/singulier absents, statut d\'étude inchangé');
  // Le total LINÉAIRE Darcy (LOT27) ne dépend pas du singulier.
  const lin = both.darcy.reseaux[0].perteLineaireTotale.valeur;
  A(typeof lin === 'number' && lin > 0 && both.darcy.reseaux[0].statut === 'lineaire_calculee', '21. total linéaire LOT27 conservé (le singulier ne l\'altère pas)');
}

// ---- 22. Non-mutation de la visite ------------------------------------------
{
  const dv = reseauSF([T_OK()]);
  const snap = JSON.stringify(dv);
  V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, opt());
  A(JSON.stringify(dv) === snap, '22. la voie singulière ne mute pas la visite');
}

// ---- 23-25. Hors money-path + aucune ζ écrite dans le code -------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const i0 = SRC.indexOf('M57 LOT31'); const i1 = SRC.indexOf('if (typeof module', i0);
  const BLOC = SRC.slice(i0, i1 > i0 ? i1 : SRC.length);
  A(BLOC.length > 0 && !/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|moteur-piece/.test(BLOC), '23. LOT31 : aucune écriture piece.config / moteur-devis');
  A(!/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|projeterVmcVersConfig/.test(BLOC), '24. LOT31 : aucun prix / catalogue / Runtime / projection tarifaire');
  A(!/require\(|readFileSync\(|fetch\(|sessionStorage\.|localStorage\.|document\.|window\./.test(BLOC), '25. LOT31 : aucune lecture fichier / DOM / storage');
  // Aucune ζ (coefficient numérique de perte) écrite en dur : le seul 0.5 est le ½ de ½ρV².
  const nombresDurs = (BLOC.match(/[^.\w]0?\.\d+/g) || []).map(s => s.trim()).filter(s => s !== '0.5' && s !== '.5');
  A(nombresDurs.length === 0, '26. aucune ζ ni coefficient numérique écrit dans le code (seul ½ présent) — trouvés: ' + JSON.stringify(nombresDurs));
}

// ---- 27-31. CORRECTION : géométrie / quantité absente ou inconnue → incomplet -
{
  const tronconSing = (sing) => ({ id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: sing });
  const dm31 = (r) => (r.darcy.singulier.donneesManquantes || []);
  const trOf = (r) => r.darcy.singulier.reseaux[0].troncons[0];

  // (a) Géométrie ABSENTE (non fournie → 'inconnu' après normalisation). Le référentiel possède
  //     pourtant UNE entrée 'coude' : le résultat DOIT rester incomplet — JAMAIS de wildcard.
  const rGeoAbs = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tronconSing([{ type: 'coude', quantite: cv(1) }])]), opt());
  const tGeoAbs = trOf(rGeoAbs);
  A(tGeoAbs.statut === 'incomplet' && tGeoAbs.perteSinguliere === null, '27. géométrie absente → tronçon incomplet, perte null (aucun wildcard)');
  A(dm31(rGeoAbs).some(x => /^geometrie_singularite_absente:coude/.test(x.champ)) && (tGeoAbs.singularites[0] || {}).coefficient == null, '28. cause explicite : geometrie_singularite_absente, aucune ζ choisie');

  // (b) Géométrie explicitement INCONNUE ('inconnu') → incomplet (même règle).
  const rGeoInc = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tronconSing([{ type: 'coude', geometrie: 'inconnu', quantite: cv(1) }])]), opt());
  A(trOf(rGeoInc).statut === 'incomplet' && trOf(rGeoInc).perteSinguliere === null && dm31(rGeoInc).some(x => /^geometrie_singularite_absente:/.test(x.champ)), '29. géométrie « inconnu » → incomplet (aucun lookup)');

  // (c) Quantité ABSENTE (non fournie → null) → incomplet, JAMAIS de défaut 1.
  const rQteAbs = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tronconSing([{ type: 'coude', geometrie: 'coude_90' }])]), opt());
  const tQteAbs = trOf(rQteAbs);
  A(tQteAbs.statut === 'incomplet' && tQteAbs.perteSinguliere === null, '30. quantité absente → incomplet, perte null (aucun défaut 1)');
  A(dm31(rQteAbs).some(x => /^quantite_singularite_absente:coude\/coude_90/.test(x.champ)) && (tQteAbs.singularites[0] || {}).quantite == null, '31. cause explicite : quantite_singularite_absente (défaut 1 jamais appliqué)');

  // (d) Régression : géométrie + quantité RÉELLEMENT fournies → calculable (ζ = 0.4 × 1).
  const rOk = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauSF([tronconSing([{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }])]), opt());
  const tOk = trOf(rOk);
  A(tOk.statut === 'calculable' && tOk.perteSinguliere.valeur === r3(0.4 * 1 * pdyn(45, 125)), '32. géométrie + quantité fournies → calculable (contraste : la règle ne bloque que l\'absence)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Perte singulière VMC voie Darcy (M57 LOT31) : ' + ok + '/' + total + ' — Σ ζ·½ρV² additif, ζ du référentiel de production, aucun repli, géométrie/quantité absente → incomplet, SF/DF séparés, LOT15-A/LOT27 intacts, hors money-path');
else { console.error('❌ Perte singulière LOT31 : ' + ok + '/' + total); process.exit(1); }
