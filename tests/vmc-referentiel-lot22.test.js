// =====================================================================
// tests/vmc-referentiel-lot22.test.js — M57 LOT22 : référentiel de pertes production
// =====================================================================
// Référentiel de pertes SOURCÉ / VERSIONNÉ / TRAÇABLE, à DOMAINE explicite, fourni au moteur
// LOT15-A. Aucune valeur inventée ; une fixture (statut/provenance 'test') ne peut jamais
// servir de production ; aucune donnée commerciale ; le compiler n'aplatit rien silencieusement
// (débit non discriminable → reporté ; conflit → aucune valeur) ; le moteur ne fait AUCUN
// fallback (hors domaine / coefficient absent → calcul incomplet honnête). SF/DF séparés.
// Hors money-path. Le référentiel PRODUCTION livré (V1) est VOLONTAIREMENT VIDE.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (valeur, statut) => V.creerChampValeur({ valeur: valeur, statut: statut || S.MESURE });
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, extra || {});

// Référentiel PRODUCTION bien formé (entrées de TEST STRUCTUREL — statut 'production' mais
// source non normative : sert à exercer compiler/moteur, PAS à documenter une vraie valeur).
function refProdOK(extraLin) {
  return V.creerReferentielProductionPertes({
    referentielId: 'test_struct', nom: 'struct', version: '9.9.9', datePublication: '2026-01-01',
    dateActivation: '2026-01-01', statut: 'production', provenance: 'referentiel', sourcePrincipale: 'STRUCT_TEST',
    masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'STRUCT_TEST' },
    methodes: [{ id: 'table_lineaire_pa_par_m', nom: 'R', unite: 'Pa/m', source: 'STRUCT_TEST', version: '9.9.9', domaine: 'resid' }],
    lineaires: [{ id: 'L125', typeConduit: 'souple', diametre: 125, uniteDiametre: 'mm', R: 1.0, unite: 'Pa/m', source: 'STRUCT_TEST', referenceExacte: 'struct.tab', versionSource: '1', domaine: 'resid', statut: 'production' }].concat(extraLin || []),
    singuliers: []
  });
}
const PIECES_SF = [{ id: 'sdb', numero: 1 }];
function visiteAntenne(diam) {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(diam), typeConduit: 'souple', debit: cv(30) });
  return dv;
}

// ---- 0. Exports -----------------------------------------------------------------
A(['creerReferentielProductionPertes', 'validerReferentielProduction', 'compilerReferentielPertes', 'chargerReferentielPertesDepuisJSON', 'traceReferentielPertes', 'creerEntreeLineairePertes', 'creerEntreeSinguliere'].every(n => typeof V[n] === 'function'), '0. couche LOT22 exportée');

// ---- 1-7. Métadonnées / version / source / statut / unité / coefficient ----------
{
  const r = refProdOK();
  const v = V.validerReferentielProduction(r);
  A(v.valide === true, '1. référentiel bien formé → valide');
  A(r.version === '9.9.9', '3. version présente');
  A(r.sourcePrincipale === 'STRUCT_TEST', '4. source présente');
  A(r.statut === 'production', '5. statut production');
  A(r.lineaires[0].unite === 'Pa/m', '6. unité R = Pa/m');
  A(typeof r.lineaires[0].R === 'number', '7. coefficient numérique');
  A(r.masseVolumiqueAir && r.masseVolumiqueAir.unite === 'kg/m3', '2/14. masse volumique renseignée (valeur/unité/source)');
}

// ---- 8/9/10/11. Rejets : négatif / NaN / domaine|source absents ------------------
{
  const neg = V.validerReferentielProduction(refProdOK([{ id: 'NEG', typeConduit: 'souple', diametre: 160, R: -0.5, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production' }]));
  A(neg.erreurs.includes('lineaire:NEG:R_negatif'), '8. coefficient négatif rejeté');
  const nan = V.validerReferentielProduction(refProdOK([{ id: 'NAN', typeConduit: 'souple', diametre: 160, R: Infinity, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production' }]));
  A(nan.erreurs.includes('lineaire:NAN:R_non_fini'), '9. Infinity/NaN rejeté');
  const noSrc = V.validerReferentielProduction(refProdOK([{ id: 'NOSRC', typeConduit: 'souple', diametre: 160, R: 0.5, unite: 'Pa/m', referenceExacte: 'r', domaine: 'd', statut: 'production' }]));
  A(noSrc.erreurs.includes('lineaire:NOSRC:source_absente'), '11. entrée sans source rejetée');
  const noDom = V.validerReferentielProduction(refProdOK([{ id: 'NODOM', typeConduit: 'souple', diametre: 160, R: 0.5, unite: 'Pa/m', source: 's', referenceExacte: 'r', statut: 'production' }]));
  A(noDom.erreurs.includes('lineaire:NODOM:domaine_absent'), '10. domaine absent rejeté');
}

// ---- 12/28/33. Fixture non utilisable en production (séparation stricte) ----------
{
  const REF_FIX = { methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test', masseVolumiqueAir: 1.2, lineaire: { souple: { 125: 1.0 } }, singulier: {} }; // fixture LOT15-A (forme moteur)
  A(!!REF_FIX, '28. fixture LOT15-A conservée pour les tests moteur');
  const fixProd = V.creerReferentielProductionPertes({ referentielId: 'fx', version: 't', datePublication: 'x', sourcePrincipale: 's', statut: 'test', provenance: 'test', masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 's' }, lineaires: [] });
  const vf = V.validerReferentielProduction(fixProd);
  A(vf.utilisableEnProduction === false && vf.erreurs.includes('fixture_non_utilisable_en_production'), '12/33. fixture (statut/provenance test) rejetée en production');
  const comp = V.compilerReferentielPertes(fixProd);
  A(comp.rapport.utilisable === false, '12b. fixture non compilable comme production');
}

// ---- 25/26/27. Aucune donnée commerciale / prix / sélection ----------------------
{
  const comm = V.validerReferentielProduction(refProdOK([{ id: 'COM', typeConduit: 'souple', diametre: 160, R: 0.5, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production', marque: 'ACME', prix: 42 }]));
  A(comm.erreurs.some(e => /COM:champ_commercial/.test(e)), '25/26. champ commercial (marque/prix) rejeté du référentiel');
}

// ---- 13/14(entrée). Entrée linéaire conditionnelle normalisée --------------------
{
  const e = V.creerEntreeLineairePertes({ typeConduit: 'souple', diametre: 125, uniteDiametre: 'mm', debitMin: 0, debitMax: 90, uniteDebit: 'm3/h', R: 1.0, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production' });
  A(e.diametre === 125 && e.debitMax === 90 && e.unite === 'Pa/m' && e.domaine === 'd', '13. entrée conditionnelle : diamètre + plage débit + domaine conservés');
  A(V.creerEntreeLineairePertes({}).R === null, '13b. valeur absente → null (jamais inventée)');
}

// ---- 14/15/29. Compilation → moteur, calcul avec référentiel de production --------
{
  const comp = V.compilerReferentielPertes(refProdOK());
  A(comp.rapport.utilisable === true && comp.referentiel.lineaire.souple[125] === 1.0, '14. correspondance diamètre compilée (souple/125 → 1.0)');
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteAntenne(125), { referentielPertes: comp.referentiel });
  A(r.etude.pertes.reseaux[0].perteTotale === 8 && r.statut === 'etude_calculable', '29. calcul possible via référentiel production compilé (8×1.0 = 8 Pa)');
  A(r.etude.pertes.methode && r.etude.pertes.methode.source === 'STRUCT_TEST' && r.etude.pertes.methode.version === '9.9.9', '15/33(trace). méthode/source/version du référentiel tracées dans l\'étude');
}

// ---- 16/18/31. Hors domaine : diamètre non couvert → pas de valeur voisine -------
{
  const comp = V.compilerReferentielPertes(refProdOK());        // couvre 125 uniquement
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteAntenne(160), { referentielPertes: comp.referentiel });
  A(r.etude.pertes.reseaux[0].statut === 'incomplet', '16/31. Ø160 hors table → perte non calculée (aucun voisin 125)');
  A(r.etude.pertes.donneesManquantes.some(d => /coefficient_lineaire:souple\/160/.test(d.champ)), '18. manque explicite « coefficient_lineaire:souple/160 » (hors domaine tracé)');
  A(r.statut !== 'etude_calculable', '16b. étude non déclarée calculable hors domaine');
}

// ---- 17/19/20/32. Coefficient absent → calcul incomplet, aucun fallback/zéro ------
{
  const comp = V.compilerReferentielPertes(refProdOK());
  const dv = visiteAntenne(125); // conduit 'rigide' non couvert → coefficient absent
  let dv2 = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv2 = V.ajouterReseauVisite(dv2, { id: 'RE', type: 'extraction' });
  dv2 = V.ajouterTronconVisite(dv2, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'rigide', debit: cv(30) });
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), dv2, { referentielPertes: comp.referentiel });
  A(r.etude.pertes.reseaux[0].perteTotale === null && r.etude.pertes.reseaux[0].statut === 'incomplet', '17/32. conduit non couvert → perte null (pas de zéro, pas de fallback)');
  A(r.etude.pertes.donneesManquantes.some(d => /coefficient_lineaire:rigide/.test(d.champ)), '19. coefficient manquant signalé (rigide)');
}

// ---- Compiler : débit non discriminable reporté (jamais aplati) + conflit --------
{
  const dbt = V.compilerReferentielPertes(refProdOK([{ id: 'DBT', typeConduit: 'souple', diametre: 160, debitMin: 0, debitMax: 100, uniteDebit: 'm3/h', R: 0.5, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production' }]));
  A(dbt.rapport.entreesNonCompilees.some(e => e.raison === 'condition_debit_non_supportee_v1') && dbt.referentiel.lineaire.souple[160] == null, 'X1. condition de débit → entrée reportée (jamais aplatie silencieusement)');
  const conf = V.compilerReferentielPertes(refProdOK([{ id: 'DUP', typeConduit: 'souple', diametre: 125, R: 2.0, unite: 'Pa/m', source: 's', referenceExacte: 'r', domaine: 'd', statut: 'production' }]));
  A(conf.rapport.conflits.length === 1 && conf.referentiel.lineaire.souple[125] == null, 'X2. conflit (même conduit/diamètre, R différents) → aucune valeur choisie');
}

// ---- 18(sing)/19(sing). Singularité documentée compile ; hors domaine → absente ---
{
  const withSing = V.creerReferentielProductionPertes(Object.assign(JSON.parse(JSON.stringify(refProdOK())), {
    singuliers: [{ id: 'C90', type: 'coude', geometrie: 'coude_90_rayon_court', angle: 90, diametre: 125, typeConduit: 'souple', coefficient: 0.3, unite: '', source: 'STRUCT_TEST', referenceExacte: 'struct.sing', domaine: 'resid', statut: 'production' }]
  }));
  const comp = V.compilerReferentielPertes(withSing);
  A(comp.referentiel.singulier.coude && comp.referentiel.singulier.coude['coude_90_rayon_court'].coefficient === 0.3, '18(sing). singularité documentée compilée par (type, géométrie)');
  A(comp.referentiel.singulier.coude['coude_90_rayon_inconnu'] === undefined, '19(sing). géométrie non documentée → absente (aucune valeur générique)');
}

// ---- 21/22/23/24. SF / DF : réseaux séparés, pertes jamais fusionnées ------------
{
  const comp = V.compilerReferentielPertes(refProdOK());
  // SF
  const rSF = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteAntenne(125), { referentielPertes: comp.referentiel });
  A(rSF.normalisation.donneesReseau.reseaux.length === 1 && rSF.normalisation.donneesReseau.reseaux[0].type === 'extraction', '21. SF : extraction seule');
  // DF
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'E1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'souple', debit: cv(30) });
  dv = V.ajouterTronconVisite(dv, 'RI', { id: 'I1', role: 'antenne', pieceRef: 'chambre#1', longueur: cv(6), diametre: cv(125), typeConduit: 'souple', debit: cv(30) });
  const rDF = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }, { id: 'chambre', numero: 1 }], CTX({ solution: 'double_flux' }), dv, { referentielPertes: comp.referentiel });
  const ext = rDF.etude.pertes.reseaux.filter(x => x.type === 'extraction')[0];
  const ins = rDF.etude.pertes.reseaux.filter(x => x.type === 'insufflation')[0];
  A(ext && ins && ext.perteTotale === 8 && ins.perteTotale === 6, '22/23. DF : pertes extraction (8) et insufflation (6) calculées séparément');
  A(!/perteTotaleGlobale|reseauFusionne/.test(JSON.stringify(rDF.etude.synthese)), '24. extraction/insufflation jamais fusionnées');
}

// ---- 30/34/35/36. Chaîne production V1 (VIDE) → calcul incomplet honnête ----------
{
  const prod = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.0.0.json'), 'utf8')));
  const vp = V.validerReferentielProduction(prod);
  A(vp.valide === true && vp.utilisableEnProduction === true, '30. référentiel PRODUCTION V1 : valide + statut production');
  A(vp.utilisablePourCalcul === false && vp.familles.lineaires === 0 && vp.familles.singuliers === 0, '27/38.1. V1 volontairement vide (aucune valeur inventée)');
  const comp = V.compilerReferentielPertes(prod);
  const r = V.etudierVisiteVmc(PIECES_SF, CTX({ solution: 'simple_flux' }), visiteAntenne(125), { referentielPertes: comp.referentiel });
  A(r.etude.pertes.reseaux[0].statut === 'incomplet' && r.etude.pertes.reseaux[0].perteTotale === null, '30b/34-36. V1 vide → pertes incomplètes honnêtes (aucune régression du moteur)');
  A(r.statut !== 'etude_calculable', '30c. jamais « calculable » avec un référentiel vide');
}

// ---- 31(version)/32(immuable)/37. Traçabilité + non-mutation ---------------------
{
  const prod = refProdOK();
  const snap = JSON.stringify(prod);
  const tr = V.traceReferentielPertes(prod);
  A(tr.referentielId === 'test_struct' && tr.version === '9.9.9' && tr.statut === 'production', '31. version/id/statut traçables');
  V.validerReferentielProduction(prod); V.compilerReferentielPertes(prod);
  A(JSON.stringify(prod) === snap, '37/32. référentiel non muté par validation/compilation (version immuable)');
}

// =====================================================================
// STATIQUE — money-path (§35)
// =====================================================================
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('M57 LOT22'), SRC.indexOf('if (typeof module'));
A(BLOC.length > 0, 'S0. bloc LOT22 localisé');
A(!/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|moteur-piece/.test(BLOC), 'S1. LOT22 : aucune écriture piece.config / moteur-devis');
A(!/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|VMC_BOUCHE|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), 'S2. LOT22 : aucun prix / catalogue / Runtime / DOM');
A(!/projeterVmcVersConfig/.test(BLOC), 'S3. LOT22 : aucune projection tarifaire');
// Aucun chemin de fichier codé en dur dans le moteur (référentiel injecté).
A(!/referentiel-pertes-vmc|\.json['"]/.test(BLOC), 'S4. aucun chemin de fichier JSON codé en dur (référentiel injecté)');

const total = ok + ko;
if (ko === 0) console.log('✅ Référentiel de pertes production (M57 LOT22) : ' + ok + '/' + total + ' — sourcé/versionné/tracé, V1 vide honnête, aucune valeur inventée, hors money-path');
else { console.error('❌ Référentiel de pertes production LOT22 : ' + ok + '/' + total); process.exit(1); }
