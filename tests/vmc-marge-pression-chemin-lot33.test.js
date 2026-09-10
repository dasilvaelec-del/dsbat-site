// =====================================================================
// tests/vmc-marge-pression-chemin-lot33.test.js — M57 LOT33 : marge de pression sur chemin réel
// =====================================================================
// margePressionCheminVmc(perteCheminDarcy, donneesTechnique, options?) : pression disponible
// (LOT17-A/B, Pa, provenance) − perte du chemin critique RÉEL (LOT32) = marge, par réseau.
// Contrat vérifié :
//   • consomme EXCLUSIVEMENT la sortie LOT32 (jamais preEtude.pertes / LOT15-A) ;
//   • SF extraction / DF extraction+insufflation SÉPARÉS, aucun mélange, aucun total global ;
//   • debitCompatible = (debitReference === options.debitProjet[type]) ; absent/incompatible → signalé ;
//   • composants/terminal ajoutés seulement si fournis+exploitables ; manque signalé, jamais 0 ;
//   • perte terminale JAMAIS comptée deux fois (ambiguïté LOT32/terminaux[type] signalée) ;
//   • maximumCertain=false OU terme manquant/ambigu → 'marge_non_garantie' (jamais OK) ;
//   • marge < 0 → 'pression_insuffisante' ; aucun fallback ; aucune donnée inventée ; hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (val, st) => V.creerChampValeur({ valeur: val, statut: st || S.MESURE });

// --- Fabrique une sortie LOT32 factice (LOT33 se teste sur le CONTRAT de sortie LOT32) ----
function lot32(reseaux) { return { disponible: true, methode: 'agregation_chemin_graphe_darcy', reseaux: reseaux }; }
function rese(type, perte, certain, opt) {
  opt = opt || {};
  return {
    type: type, statut: certain ? 'calcule' : 'partiel', maximumCertain: certain,
    cheminCritiqueCalcule: perte == null ? null : { terminal: 'b1', troncons: ['T1', 'T2'], perteMaximaleCalculee: { valeur: perte, unite: 'Pa', composantes: { lineaire: perte, singuliere: 0 } } },
    chemins: perte == null ? [] : [{ terminal: 'b1', statut: 'calcule', perteChemin: { valeur: perte, unite: 'Pa' }, perteTerminale: (opt.pterm != null ? { valeur: opt.pterm, unite: 'Pa' } : null), perteTerminaleManquante: opt.pterm == null }],
    coherenceDebits: { statut: 'coherente', incoherences: [] }, donneesManquantes: [], pointsAVerifier: []
  };
}
const dispo = (v, dref) => ({ valeur: v, unite: 'Pa', nature: 'totale', debitReference: dref, source: 'FabX', version: '2024', provenance: 'constructeur' });
const dispoSansNature = (v, dref) => ({ valeur: v, unite: 'Pa', debitReference: dref, source: 'FabX', provenance: 'constructeur' });
const RE = (r) => r.reseaux[0];
const champ = (r, t) => r.reseaux.filter(x => x.type === t)[0];

// ---- 0. Export --------------------------------------------------------------
A(typeof V.margePressionCheminVmc === 'function', '0. LOT33 exporté (margePressionCheminVmc)');

// ---- 1. SF marge positive certaine, tous termes fournis → marge_calculee -----
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.pertesNecessaires.valeur === 110 && e.pertesNecessaires.detail.reseau === 80 && e.pertesNecessaires.detail.composants === 20 && e.pertesNecessaires.detail.terminal === 10, '1a. pertes nécessaires = perte chemin + terminal + composants');
  A(e.margePa === 10 && e.statut === 'marge_calculee' && e.debitCompatible === true, '1b. marge = disponible − nécessaire = 10, statut marge_calculee, débit compatible');
}

// ---- 2. Marge négative → pression_insuffisante (robuste) ---------------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 200, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  A(RE(r).margePa === -110 && RE(r).statut === 'pression_insuffisante', '2. marge négative → pression_insuffisante');
}

// ---- 3. maximumCertain=false → marge_non_garantie même si ≥0 -----------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, false)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  A(RE(r).margePa === 10 && RE(r).statut === 'marge_non_garantie' && RE(r).maximumCertain === false, '3. maximum non certain → marge_non_garantie (jamais OK)');
}

// ---- 4. Composants absents → signalé, jamais 0, non garantie -----------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.pertesNecessaires.detail.composants === null && e.statut === 'marge_non_garantie' && e.donneesManquantes.some(x => x.champ === 'pertes_internes_centrale_non_documentees:extraction'), '4. composants absents → signalé (jamais 0), marge non garantie');
}

// ---- 5. Terminal absent → signalé, jamais 0 ----------------------------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.pertesNecessaires.detail.terminal === null && e.donneesManquantes.some(x => x.champ === 'pertes_terminaux_non_documentees:extraction'), '5. terminal absent → signalé (jamais 0)');
}

// ---- 6. Débit incompatible → a_verifier, pas de marge ------------------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 999) } }, { debitProjet: { extraction: 150 } });
  A(RE(r).margePa === null && RE(r).statut === 'a_verifier' && RE(r).debitCompatible === false && RE(r).donneesManquantes.some(x => x.champ === 'debit_reference_incompatible:extraction'), '6. débit incompatible → a_verifier, marge null');
}

// ---- 7. Débit projet absent → non vérifiable, jamais supposé -----------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) } }, {});
  A(RE(r).debitCompatible === null && RE(r).statut === 'a_verifier' && RE(r).donneesManquantes.some(x => x.champ === 'debit_projet_absent:extraction'), '7. débit projet absent → compatibilité non vérifiable (signalée, non supposée)');
}

// ---- 8. Pression disponible absente → incomplet ------------------------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]), {}, { debitProjet: { extraction: 150 } });
  A(RE(r).statut === 'incomplet' && RE(r).margePa === null && RE(r).donneesManquantes.some(x => x.champ === 'pression_disponible_groupe:extraction'), '8. pression disponible absente → incomplet');
}

// ---- 9. Chemin critique absent (LOT32 non calculé) → incomplet ---------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', null, false)]),
    { pressionDisponible: { extraction: dispo(120, 150) } }, { debitProjet: { extraction: 150 } });
  A(RE(r).statut === 'incomplet' && RE(r).pertesNecessaires === null && RE(r).donneesManquantes.some(x => x.champ === 'perte_chemin_non_calculee:extraction'), '9. chemin critique non calculé → incomplet (aucune perte inventée)');
}

// ---- 10. Double comptage terminal → ambiguïté, aucun additionné --------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true, { pterm: 15 })]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.ambiguiteTerminal === true && e.pertesNecessaires.detail.terminal === null && e.statut === 'marge_non_garantie' && e.donneesManquantes.some(x => x.champ === 'ambiguite_perte_terminale:extraction'), '10. terminal LOT32 + terminaux[type] → ambiguïté signalée, AUCUN compté deux fois');
}

// ---- 11-12. Terminal d'une seule source → utilisé ----------------------------
{
  const rL = V.margePressionCheminVmc(lot32([rese('extraction', 80, true, { pterm: 15 })]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] } }, { debitProjet: { extraction: 150 } });
  A(RE(rL).pertesNecessaires.detail.terminal === 15 && RE(rL).ambiguiteTerminal === false, '11. perte terminale LOT32 seule → utilisée');
  const rT = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 12, unite: 'Pa' } } }, { debitProjet: { extraction: 150 } });
  A(RE(rT).pertesNecessaires.detail.terminal === 12 && RE(rT).ambiguiteTerminal === false, '12. terminaux[type] seul → utilisé');
}

// ---- 13-14. Unités ≠ Pa : jamais converties ---------------------------------
{
  const rC = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 2, unite: 'mmCE' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } }, { debitProjet: { extraction: 150 } });
  A(RE(rC).pertesNecessaires.detail.composants === null && RE(rC).donneesManquantes.some(x => x.champ === 'pertes_composants_non_exploitables:extraction'), '13. composant en unité ≠ Pa → ignoré (jamais converti), signalé');
  const rP = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: { valeur: 12, unite: 'mmCE', debitReference: 150, provenance: 'x' } } }, { debitProjet: { extraction: 150 } });
  A(RE(rP).pressionDisponible === null && RE(rP).statut === 'incomplet' && RE(rP).donneesManquantes.some(x => x.champ === 'pression_disponible_unite_non_Pa:extraction'), '14. pression disponible en unité ≠ Pa → comparaison refusée (aucune conversion)');
}

// ---- 15. Provenance conservée -----------------------------------------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispo(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } }, { debitProjet: { extraction: 150 } });
  const pd = RE(r).pressionDisponible;
  A(pd.source === 'FabX' && pd.version === '2024' && pd.provenance === 'constructeur' && pd.unite === 'Pa', '15. provenance/version/source de la pression disponible conservées');
}

// ---- 16-17. DF extraction/insufflation séparées, aucun mélange ---------------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true), rese('insufflation', 60, true)]),
    { pressionDisponible: { extraction: dispo(120, 150), insufflation: dispo(100, 150) }, composants: { extraction: [{ composant: 'f', valeur: 20, unite: 'Pa' }], insufflation: [{ composant: 'f', valeur: 15, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' }, insufflation: { valeur: 8, unite: 'Pa' } } },
    { debitProjet: { extraction: 150, insufflation: 150 } });
  const ext = champ(r, 'extraction'), ins = champ(r, 'insufflation');
  A(r.reseaux.length === 2 && ext.margePa === 10 && ins.margePa === 17 && ext !== ins, '16. DF : extraction et insufflation → marges distinctes et séparées');
  A(!r.margePa && !r.pertesNecessaires && !/perteGlobale|reseauFusionne|margeGlobale/.test(JSON.stringify(r)) && r.synthese.reseauLePlusContraignant === 'extraction' && r.synthese.margeMinimaleConnue === 10, '17. aucun mélange : pas de total global, synthèse sans fusion (réseau le plus contraignant = extraction)');
}

// ---- 18. Aucun fallback LOT15-A : seule la sortie LOT32 est consommée ---------
{
  // Aucune pressionDisponible fournie → incomplet, MÊME si un preEtude.pertes existait (non passé ici).
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]), {}, { debitProjet: { extraction: 150 } });
  A(RE(r).statut === 'incomplet' && !/table_lineaire|pressionNecessaire|preEtude|pertesLineaires/.test(JSON.stringify(r)), '18. aucun repli LOT15-A (aucune trace de preEtude.pertes / table dans la sortie)');
}

// ---- 19. Sortie LOT32 absente/indisponible → disponible:false ----------------
{
  A(V.margePressionCheminVmc(null, {}, {}).disponible === false && V.margePressionCheminVmc({ disponible: false }, {}, {}).disponible === false, '19. perte chemin absente → disponible:false (aucune marge fabriquée)');
}

// ---- 20. Non-mutation des entrées -------------------------------------------
{
  const p = lot32([rese('extraction', 80, true)]);
  const dt = { pressionDisponible: { extraction: dispo(120, 150) }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } };
  const op = { debitProjet: { extraction: 150 } };
  const snap = JSON.stringify([p, dt, op]);
  V.margePressionCheminVmc(p, dt, op);
  A(JSON.stringify([p, dt, op]) === snap, '20. LOT33 ne mute pas ses entrées');
}

// ---- 21. Hors money-path + source LOT33 --------------------------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const i0 = SRC.indexOf('M57 LOT33'); const i1 = SRC.indexOf('if (typeof module', i0);
  const BLOC = SRC.slice(i0, i1 > i0 ? i1 : SRC.length);
  A(BLOC.length > 0 && !/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|projeterVmcVersConfig|piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '21. LOT33 : hors money-path / Runtime / DOM / fichier');
  A(!/preEtude\.pertes|pressionNecessaire|table_lineaire/.test(BLOC), '21b. LOT33 : ne lit jamais preEtude.pertes / LOT15-A dans le code');
}

// ---- 22-23. Intégration RÉELLE : visite → LOT32 → LOT33 ----------------------
{
  const REF = V.creerReferentielProductionPertes({
    referentielId: 'FIX33', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
    masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIX' }, viscositeDynamiqueAir: { valeur: 1.81e-5, unite: 'Pa.s', source: 'FIX' },
    rugosites: [{ id: 'g', typeConduit: 'acier_galvanise', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 't', source: 'FIX', referenceExacte: 't', statut: 'test' }],
    singuliers: [{ id: 'z', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, unite: '', domaine: 't', source: 'FIX', referenceExacte: 't', statut: 'test' }]
  });
  const sc = [{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }];
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  ['nA', 'nB', 'nC'].forEach(id => { dv = V.ajouterNoeudVisite(dv, 'RE', { id: id }); });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', noeudAmont: 'nA', noeudAval: 'nB', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: sc });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T2', role: 'collecteur', noeudAmont: 'nB', noeudAval: 'nC', longueur: cv(4), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: sc });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'b1', pieceRef: 'sdb#1', noeudId: 'nA', fonction: 'SORTIE_AIR', debit: cv(45) });
  const etude = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, dv, { referentielProduction: REF });
  const lot32res = V.perteCheminDarcyVmc(etude.normalisation.donneesReseau, etude.darcy);
  const perteReelle = lot32res.reseaux[0].cheminCritiqueCalcule.perteMaximaleCalculee.valeur;
  const Q = etude.etude.preDimensionnement.reseaux.filter(x => x.type === 'extraction')[0].debitProjet;
  const r = V.margePressionCheminVmc(lot32res, { pressionDisponible: { extraction: { valeur: perteReelle + 30, unite: 'Pa', nature: 'totale', debitReference: Q, source: 'FabX', provenance: 'constructeur' } } }, { debitProjet: { extraction: Q } });
  const e = RE(r);
  A(r.disponible === true && Math.abs(e.pertesNecessaires.detail.reseau - perteReelle) < 0.01 && e.debitCompatible === true, '22. e2e : la perte réseau LOT33 = perte du chemin critique LOT32 (raccordement réel)');
  A(e.margePa === 30 && (e.statut === 'marge_non_garantie' || e.statut === 'marge_calculee'), '23. e2e : marge = disponible − perte réelle = 30 (statut non-OK car composants/terminal non documentés)');
}

// ---- 24. Nature de pression NON déclarée → a_verifier (jamais comparaison silencieuse) ------
{
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: dispoSansNature(120, 150) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.natureCompatible === null && e.margePa === null && e.statut === 'a_verifier' && e.donneesManquantes.some(x => x.champ === 'nature_pression_non_declaree:extraction'), '24. nature de pression non déclarée → a_verifier, aucune comparaison (unité Pa ne suffit pas)');
}

// ---- 25. Nature de pression INCOMPATIBLE (statique vs totale) → a_verifier -------------------
{
  const d = dispo(120, 150); d.nature = 'statique';
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: d }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(e.natureCompatible === false && e.margePa === null && e.statut === 'a_verifier' && e.donneesManquantes.some(x => x.champ === 'nature_pression_incompatible:extraction'), '25. nature « statique » ≠ convention pertes « totale » → a_verifier (aucune conversion)');
}

// ---- 26. Régime déclaré incompatible → a_verifier (aucune correction) -----------------------
{
  const d = dispo(120, 150); d.regime = 'laminaire';
  const r = V.margePressionCheminVmc(lot32([rese('extraction', 80, true)]),
    { pressionDisponible: { extraction: d }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa' }] }, terminaux: { extraction: { valeur: 10, unite: 'Pa' } } },
    { debitProjet: { extraction: 150 }, regimeEtude: { extraction: 'turbulent' } });
  const e = RE(r);
  A(e.regimeCompatible === false && e.margePa === null && e.statut === 'a_verifier' && e.donneesManquantes.some(x => x.champ === 'regime_incompatible:extraction'), '26. régime déclaré incompatible → a_verifier (aucune correction/interpolation)');
}

// ---- 27. Chemins LOT32 CONSERVÉS dans la sortie LOT33 ----------------------------------------
{
  const l32 = lot32([rese('extraction', 80, true)]);
  const r = V.margePressionCheminVmc(l32, { pressionDisponible: { extraction: dispo(120, 150) } }, { debitProjet: { extraction: 150 } });
  const e = RE(r);
  A(Array.isArray(e.chemins) && e.chemins.length === l32.reseaux[0].chemins.length && e.chemins[0].terminal === 'b1', '27. chemins LOT32 conservés dans la sortie (traçabilité, dont incomplets)');
}


const total = ok + ko;
if (ko === 0) console.log('✅ Marge de pression sur chemin réel (M57 LOT33) : ' + ok + '/' + total + ' — marge = disponible − perte chemin LOT32, SF/DF séparés, débit vérifié, terminal jamais compté deux fois, marge non garantie si incertain, marge<0 → insuffisante, aucun repli LOT15-A');
else { console.error('❌ Marge de pression LOT33 : ' + ok + '/' + total); process.exit(1); }
