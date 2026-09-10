// =====================================================================
// tests/vmc-etude-darcy-lot27.test.js — M57 LOT27 : branchement Darcy/Colebrook dans l'étude
// =====================================================================
// Voie PARALLÈLE additive : etudierVisiteVmc expose une branche `darcy` (LOT25) SANS altérer la
// voie historique LOT15-A (etude.pertes) ni le contrat LOT21. Débit/longueur/diamètre viennent du
// réseau normalisé (relevé de visite) ; AUCUN fallback de famille ; extraction/insufflation JAMAIS
// additionnées ; existant/projet/mixte respectés ; singularités/composants/pression NON traités ;
// jamais « conforme »/« dimensionné ». Comparaison historique/Darcy OBSERVATIONNELLE (aucun
// arbitrage). Hors money-path.
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

// Référentiel PRODUCTION v1.1.0 réel (galva ε=0,09 + air).
const PROD = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.1.0.json'), 'utf8')));
// Référentiel PRODUCTION fixture SANS air (pour tester « air absent »).
const PROD_SANS_AIR = V.creerReferentielProductionPertes({ referentielId: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIXTURE_TEST', masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIXTURE_TEST' }, rugosites: [{ id: 'g', typeConduit: 'acier_galvanise', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 'test', source: 'FIXTURE_TEST', referenceExacte: 't', statut: 'test' }] });

function reseauGalva(troncons) {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  troncons.forEach(t => { dv = V.ajouterTronconVisite(dv, 'RE', t); });
  return dv;
}
// Tronçon galva « bien dimensionné » pour être turbulent calculable (D=125, Q=45).
const T_OK = { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45) };
const PIECES = [{ id: 'sdb', numero: 1 }];

A(typeof V.etudeDarcyVmc === 'function' && typeof V.comparerPerteLineaireVmc === 'function', '0. LOT27 exporté');

// ---- 1-4. Branchement additif : voie historique + voie Darcy coexistent -----------
{
  const dv = reseauGalva([T_OK]);
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielProduction: PROD });
  A(r.etude && r.pertes && r.pression, '1/2. voie historique (LOT15-A/16/17) toujours présente et intacte');
  A(r.darcy && r.darcy.disponible === true, '3. voie Darcy présente et disponible');
  A(r.contexteEtude === 'existant' && r.statut === r.etude.statutEtude, '4. contrat LOT21 conservé (contexteEtude + statut)');
  // Sans référentiel production → branche absente, étude intacte (additif).
  const r0 = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, {});
  A(r0.darcy.disponible === false && r0.etude && r0.statut === r.statut, '4b. sans référentiel production → Darcy absent, étude inchangée');
}

// ---- 5-8. Données complètes galva → calculable, propagé, tracé --------------------
{
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([T_OK]), { referentielProduction: PROD });
  const t = r.darcy.reseaux[0].troncons[0];
  A(t.statut === 'calculable' && t.perteLineaire.valeur > 0 && t.regime === 'turbulent', '5. tronçon galva calculable');
  A(r.darcy.reseaux[0].statut === 'lineaire_calculee' && r.darcy.reseaux[0].perteLineaireTotale.valeur > 0, '6. résultat LOT25 propagé au réseau (total linéaire)');
  A(t.methode.referentielId === 'vmc_pertes_fr' && t.methode.version === '1.1.0' && t.methode.provenance === 'referentiel', '7. traçabilité : référentiel/version/provenance conservés');
  A(r.darcy.referentiel.version === '1.1.0' && r.darcy.referentiel.referentielId === 'vmc_pertes_fr', '8. référentiel v1.1.0 tracé au niveau étude Darcy');
  A(/LIN[EÉ]AIRE seule|hors singularit/i.test(r.darcy.reseaux[0].note) && !/conforme|dimensionn/i.test(JSON.stringify(r.darcy)), '8b. jamais « conforme »/« dimensionné » (perte linéaire seule)');
}

// ---- 9-13. Données manquantes → incomplet, perte null (jamais 0) ------------------
{
  const mk = (t) => V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([Object.assign({}, T_OK, t)]), { referentielProduction: PROD }).darcy.reseaux[0].troncons[0];
  A(mk({ debit: undefined }).statut === 'incomplet' && mk({ debit: undefined }).perteLineaire === null, '9. débit absent → incomplet, perte null');
  A(mk({ longueur: undefined }).statut === 'incomplet', '10. longueur absente → incomplet');
  A(mk({ diametre: undefined }).statut === 'incomplet', '11. diamètre absent → incomplet');
  A(mk({ typeConduit: undefined }).statut === 'incomplet', '12. rugosité (famille) absente → incomplet');
  const airAbsent = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([T_OK]), { referentielProduction: PROD_SANS_AIR }).darcy.reseaux[0].troncons[0];
  A(airAbsent.statut === 'incomplet' && (airAbsent.donneesManquantes || []).some(x => /viscosite/.test(x)), '13. air (viscosité) absent du référentiel → incomplet');
}

// ---- 14-18. Familles : galva calculable ; autres → AUCUN fallback ----------------
{
  const fam = (tc) => V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([Object.assign({}, T_OK, { typeConduit: tc })]), { referentielProduction: PROD }).darcy.reseaux[0].troncons[0];
  A(fam('acier_galvanise').statut === 'calculable', '14. galva → calculable');
  ['souple', 'semi_rigide', 'pvc', 'materiau_inconnu'].forEach(function (tc, i) {
    const t = fam(tc);
    A(t.statut === 'incomplet' && t.perteLineaire === null && (t.donneesManquantes || []).some(x => x === 'rugosite_absente_famille:' + tc), '1' + (5 + i) + '. ' + tc + ' → pas de fallback (rugosite_absente_famille)');
  });
}

// ---- 19-24. Réseaux SF / DF : séparation, aucune addition ------------------------
{
  // SF : extraction seule ; admission passive n'est PAS un réseau.
  const rSF = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([T_OK]), { referentielProduction: PROD });
  A(rSF.darcy.reseaux.length === 1 && rSF.darcy.reseaux[0].type === 'extraction', '19/20. SF : réseau extraction seul (admission passive non modélisée en réseau)');
  // DF : extraction + insufflation séparés.
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'E1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45) });
  dv = V.ajouterTronconVisite(dv, 'RI', { id: 'I1', role: 'antenne', pieceRef: 'chambre#1', longueur: cv(6), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45) });
  const rDF = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }, { id: 'chambre', numero: 1 }], CTX({ solution: 'double_flux' }), dv, { referentielProduction: PROD });
  const ext = rDF.darcy.reseaux.filter(x => x.type === 'extraction')[0];
  const ins = rDF.darcy.reseaux.filter(x => x.type === 'insufflation')[0];
  A(rDF.darcy.reseaux.length === 2 && ext && ins, '21/22. DF : extraction et insufflation présents');
  A(ext.perteLineaireTotale && ins.perteLineaireTotale && ext !== ins, '23. DF : totaux séparés par réseau');
  A(!/perteLineaireGlobale|reseauFusionne|perteTotaleGlobale/.test(JSON.stringify(rDF.darcy)) && !rDF.darcy.perteLineaireTotale, '24. DF : aucune addition extraction+insufflation');
}

// ---- 25-30. existant / projet / mixte : diamètre réel ≠ projeté -------------------
{
  const tRP = { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), diametreProjet: V.creerChampValeur({ valeur: 160, statut: S.DOCUMENTE }), typeConduit: 'acier_galvanise', debit: cv(45) };
  const dv = reseauGalva([tRP]);
  const rex = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielProduction: PROD, contexteEtude: 'existant' });
  const rpr = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielProduction: PROD, contexteEtude: 'projet' });
  const rmi = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielProduction: PROD, contexteEtude: 'mixte' });
  A(rex.darcy.reseaux[0].troncons[0].diametre === 125, '25/28. existant → diamètre relevé (125) utilisé');
  A(rpr.darcy.reseaux[0].troncons[0].diametre === 160, '26/29. projet → diamètre projeté (160) utilisé');
  A(rex.darcy.reseaux[0].troncons[0].perteLineaire.valeur !== rpr.darcy.reseaux[0].troncons[0].perteLineaire.valeur, '27. existant ≠ projet (calcul distinct)');
  A(rex.normalisation.donneesReseau.reseaux[0].troncons[0].diametre === 125, '30. relevé (125) conservé intact (aucun écrasement silencieux)');
  A(rmi.darcy.disponible === true, '30b. mixte pris en charge');
}

// ---- 31-34. Cas limites : débit nul / transition / non-calculable / géométrie -----
{
  const t0 = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([Object.assign({}, T_OK, { debit: cv(0) })]), { referentielProduction: PROD }).darcy.reseaux[0].troncons[0];
  A(t0.statut === 'debit_nul' && t0.perteLineaire.valeur === 0, '31. débit nul → Δp=0 (justifié)');
  const tt = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), reseauGalva([{ id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(2), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(15) }]), { referentielProduction: PROD }).darcy.reseaux[0];
  A(tt.troncons[0].statut === 'transition' && tt.troncons[0].perteLineaire === null, '32. zone de transition → perte non calculée');
  A(tt.statut !== 'lineaire_calculee' && tt.perteLineaireTotale === null, '33. réseau à tronçon non calculable → total null (jamais un faux total)');
  // Géométrie : le modèle réseau normalisé est circulaire ; on vérifie qu'un tronçon calculable reste circulaire.
  A(V.calculerPerteLineaireVmc({ geometrie: 'rectangulaire', debit: { valeur: 45, unite: 'm3/h' }, longueur: { valeur: 8, unite: 'm' }, diametreHydraulique: { valeur: 125, unite: 'mm' }, rugosite: { valeur: 0.09, unite: 'mm' }, air: { masseVolumique: { valeur: 1.2, unite: 'kg/m3' }, viscositeDynamique: { valeur: 1.81e-5, unite: 'Pa.s' } } }).statut === 'geometrie_non_supportee', '34. géométrie non supportée refusée (moteur)');
}

// ---- 35-37. Comparaison historique/Darcy (observationnelle, aucun arbitrage) ------
{
  // Référentiel R (table) pour la voie historique + référentiel production pour Darcy, MÊME réseau.
  const REF_R = { methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', masseVolumiqueAir: 1.2, lineaire: { acier_galvanise: { 125: 0.8 } }, singulier: {} };
  const dv = reseauGalva([T_OK]);
  const r = V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielPertes: REF_R, referentielProduction: PROD });
  const cmp = r.darcy.comparaison.filter(c => c.ref === 'T1' || c.ref === 'sdb#1')[0];
  A(cmp && cmp.comparaison === 'possible' && typeof cmp.perteHistorique === 'number' && typeof cmp.perteDarcy === 'number' && typeof cmp.ecart === 'number', '35. même tronçon/entrées → comparaison possible (historique + Darcy exposés, écart, aucun arbitrage)');
  A(!/plus vrai|correct|arbitr|gagne/i.test(JSON.stringify(r.darcy.comparaison)), '35b. aucune décision « lequel est vrai »');
  // Débits différents entre les deux voies → impossible. On simule via comparaison directe.
  const darcyFake = { reseaux: [{ type: 'extraction', troncons: [{ ref: 'sdb#1', pieceRef: 'sdb#1', debit: 45, longueur: 8, diametre: 125, perteLineaire: { valeur: 1.0 } }] }] };
  const histFake = { reseaux: [{ type: 'extraction', troncons: [{ ref: 'sdb#1', debit: 30, longueur: 8, diametre: 125, pertesLineaires: 0.5 }] }] };
  const cmp2 = V.comparerPerteLineaireVmc(histFake, darcyFake)[0];
  A(cmp2.comparaison === 'impossible' && cmp2.raison === 'entrees_differentes', '36/37. tronçons/débits différents → comparaison impossible (raison explicite)');
}

// ---- 38-42. Architecture : hors money-path + non-mutation + Golden inchangé -------
{
  const dv = reseauGalva([T_OK]);
  const snap = JSON.stringify(dv);
  V.etudierVisiteVmc(PIECES, CTX({ solution: 'simple_flux' }), dv, { referentielProduction: PROD });
  A(JSON.stringify(dv) === snap, '38. voie Darcy ne mute pas la visite');
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const BLOC = SRC.slice(SRC.indexOf('M57 LOT27'), SRC.indexOf('if (typeof module'));
  A(BLOC.length > 0 && !/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|moteur-piece/.test(BLOC), '39/41. LOT27 : aucun piece.config / moteur-devis');
  A(!/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|projeterVmcVersConfig/.test(BLOC), '40. LOT27 : aucun prix / catalogue / Runtime / projection tarifaire');
  A(!/require\(|readFileSync\(|fetch\(|sessionStorage\.|localStorage\.|document\.|window\./.test(BLOC), '42. LOT27 : aucune lecture fichier / DOM / storage');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Branchement Darcy dans l\'étude (M57 LOT27) : ' + ok + '/' + total + ' — voie parallèle additive, débit relevé, aucun fallback, SF/DF séparés, comparaison sans arbitrage, hors money-path');
else { console.error('❌ Branchement Darcy LOT27 : ' + ok + '/' + total); process.exit(1); }
