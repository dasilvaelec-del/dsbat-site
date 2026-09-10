// =====================================================================
// tests/vmc-synthese-etude-lot34.test.js — M57 LOT34 : synthèse d'étude VMC consolidée
// =====================================================================
// syntheseEtudeVmc(perteChemin, margePression, options?) : agrégateur PUR (chemin→réseau→global)
// qui référence LOT32/LOT33 sans recalcul ni re-somme. Contrat vérifié :
//   • statuts réseau : calcule_certain | calcule_incertain | incomplet | indetermine | hors_domaine ;
//   • statut ⟂ garantie ; SF extraction / DF extraction / DF insufflation séparés, jamais fusionnés ;
//   • global = maillon le plus dégradé des réseaux nécessaires ; indépendance des réseaux préservée ;
//   • manques dédupliqués par identité stable + provenance ; raisons conservées ;
//   • aucune donnée recalculée/resommée ; LOT15-A/16 non fusionnée ; aucun verdict de conformité.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (val, st) => V.creerChampValeur({ valeur: val, statut: st || S.MESURE });
const ENUM = ['calcule_certain', 'calcule_incertain', 'incomplet', 'indetermine', 'hors_domaine'];

// --- Fabriques des sorties LOT32/LOT33 (LOT34 se teste sur leur CONTRAT) -------
function l32(reseaux) { return { disponible: true, methode: 'agregation_chemin_graphe_darcy', reseaux: reseaux }; }
function rc(type, o) {
  o = o || {};
  return {
    type: type, statut: o.statut || 'calcule', maximumCertain: (o.maxCertain !== false),
    cheminCritiqueCalcule: (o.crit === false ? null : { terminal: 'b1', troncons: ['T1'], perteMaximaleCalculee: { valeur: (o.perte != null ? o.perte : 80), unite: 'Pa', composantes: { lineaire: (o.perte != null ? o.perte : 80), singuliere: 0 } } }),
    chemins: (o.crit === false ? [{ terminal: 'b1', statut: 'incomplet' }] : [{ terminal: 'b1', statut: 'calcule' }]),
    coherenceDebits: { statut: o.incoh ? 'incoherences_signalees' : 'coherente', incoherences: o.incoh ? [{ noeud: 'nC' }] : [] },
    donneesManquantes: o.dm || [], pointsAVerifier: o.pv || []
  };
}
function l33(reseaux) { return { disponible: true, methode: 'marge_pression_chemin_reel', reseaux: reseaux }; }
function mr(type, o) {
  o = o || {};
  return { type: type, statut: o.statut || 'marge_calculee', margePa: (o.margePa !== undefined ? o.margePa : 10), debitCompatible: (o.debitCompatible !== undefined ? o.debitCompatible : true), natureCompatible: (o.nat !== undefined ? o.nat : true), regimeCompatible: (o.reg !== undefined ? o.reg : null), ambiguiteTerminal: !!o.amb, raison: (o.raison || o.statut || 'marge_calculee'), donneesManquantes: o.dm || [], pointsAVerifier: o.pv || [] };
}
const R0 = (s) => s.reseaux[0];
const byType = (s, t) => s.reseaux.filter(x => x.type === t)[0];

// ---- 0. Export --------------------------------------------------------------
A(typeof V.syntheseEtudeVmc === 'function', '0. LOT34 exporté (syntheseEtudeVmc)');

// ---- 1. SF certain → calcule_certain, garantie globale --------------------------
{
  const s = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction')]), { systeme: 'simple_flux' });
  A(s.disponible === true && s.statutEtude === 'calcule_certain' && s.garantieGlobale === true, '1a. SF tous certains → global calcule_certain, garantie globale');
  A(R0(s).statut === 'calcule_certain' && R0(s).garantie === true && s.reseaux.length === 1 && R0(s).type === 'extraction', '1b. réseau extraction certain (SF : un seul réseau)');
}

// ---- 2. Marge non garantie → calcule_incertain (statut ⟂ garantie) --------------
{
  const s = V.syntheseEtudeVmc(l32([rc('extraction', { maxCertain: false, statut: 'partiel' })]), l33([mr('extraction', { statut: 'marge_non_garantie' })]), { systeme: 'simple_flux' });
  A(R0(s).statut === 'calcule_incertain' && R0(s).garantie === false && R0(s).raisons.indexOf('maximum_non_certain') !== -1, '2. maximum non certain / marge non garantie → calcule_incertain (garantie false, raison conservée)');
}

// ---- 3. Pression insuffisante (LOT33) → calcul certain, LOT34 reste neutre -------
{
  const s = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction', { statut: 'pression_insuffisante', margePa: -40 })]), { systeme: 'simple_flux' });
  A(R0(s).statut === 'calcule_certain' && R0(s).garantie === true, '3a. insuffisance robuste (LOT33) → résultat certain (le calcul est certain)');
  A(R0(s).statut === 'calcule_certain' && s.statutEtude === 'calcule_certain' && ENUM.indexOf(R0(s).statut) !== -1 && R0(s).margePression.margePa === -40, '3b. LOT34 statut = enum neutre (calcule_certain) ; la marge négative reste une simple référence LOT33, aucun verdict propre');
}

// ---- 4-5. Chemin incomplet / indéterminé ---------------------------------------
{
  const inc = V.syntheseEtudeVmc(l32([rc('extraction', { crit: false, statut: 'incomplet' })]), l33([mr('extraction', { statut: 'incomplet', margePa: null })]), { systeme: 'simple_flux' });
  A(R0(inc).statut === 'incomplet', '4. chemin critique non calculé → incomplet');
  const ind = V.syntheseEtudeVmc(l32([rc('extraction', { crit: false, statut: 'indetermine' })]), l33([mr('extraction', { statut: 'incomplet', margePa: null })]), { systeme: 'simple_flux' });
  A(R0(ind).statut === 'indetermine', '5. chemin indéterminé (LOT32) → indetermine');
}

// ---- 6-8. hors_domaine : nature / régime incompatibles, incohérence débits ------
{
  const nat = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction', { statut: 'a_verifier', margePa: null, nat: false })]), { systeme: 'simple_flux' });
  A(R0(nat).statut === 'hors_domaine' && R0(nat).raisons.indexOf('nature_pression_incompatible') !== -1, '6. nature de pression incompatible → hors_domaine');
  const reg = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction', { statut: 'a_verifier', margePa: null, reg: false })]), { systeme: 'simple_flux' });
  A(R0(reg).statut === 'hors_domaine' && R0(reg).raisons.indexOf('regime_incompatible') !== -1, '7. régime incompatible → hors_domaine');
  const inc = V.syntheseEtudeVmc(l32([rc('extraction', { incoh: true })]), l33([mr('extraction')]), { systeme: 'simple_flux' });
  A(R0(inc).statut === 'hors_domaine' && R0(inc).raisons.indexOf('debits_incoherents_signales') !== -1, '8. incohérence de débits explicite → hors_domaine');
}

// ---- 9-11. DF : séparation, côté absent, indépendance ---------------------------
{
  const df = V.syntheseEtudeVmc(l32([rc('extraction'), rc('insufflation', { perte: 60 })]), l33([mr('extraction'), mr('insufflation')]), { systeme: 'double_flux' });
  A(df.reseaux.length === 2 && byType(df, 'extraction') !== byType(df, 'insufflation') && df.statutEtude === 'calcule_certain', '9. DF : extraction et insufflation séparés, global certain si les deux certains');
  const abs = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction')]), { systeme: 'double_flux' });
  const ins = byType(abs, 'insufflation');
  A(ins && ins.present === false && ins.statut === 'indetermine' && abs.statutEtude === 'indetermine' && abs.garantieGlobale === false && abs.reseaux.length === 2 && byType(abs, 'extraction').present === true, '10. DF côté insufflation absent → global indéterminé, garantie false, 2 réseaux conservés séparément (jamais fusionnés)');
  const mix = V.syntheseEtudeVmc(l32([rc('extraction'), rc('insufflation', { maxCertain: false, statut: 'partiel' })]), l33([mr('extraction'), mr('insufflation', { statut: 'marge_non_garantie' })]), { systeme: 'double_flux' });
  A(byType(mix, 'extraction').statut === 'calcule_certain' && byType(mix, 'insufflation').statut === 'calcule_incertain' && mix.statutEtude === 'calcule_incertain', '11. indépendance : l\'incertitude insufflation ne dégrade PAS le statut extraction ; global = plus dégradé');
}

// ---- 12. Global = plus dégradé des réseaux nécessaires --------------------------
{
  const s = V.syntheseEtudeVmc(l32([rc('extraction'), rc('insufflation', { incoh: true })]), l33([mr('extraction'), mr('insufflation')]), { systeme: 'double_flux' });
  A(s.statutEtude === 'hors_domaine' && byType(s, 'extraction').statut === 'calcule_certain', '12. global = maillon le plus dégradé (hors_domaine) sans altérer le réseau sain');
}

// ---- 13-14. Manques + points à vérifier dédupliqués, provenance conservée -------
{
  const champ = 'coefficient_singulier_absent:coude/coude_90';
  const s = V.syntheseEtudeVmc(
    l32([rc('extraction', { dm: [{ champ: champ, impact: 'perte_singuliere' }], pv: [{ type: 'x', description: 'verif_partagee' }] }), rc('insufflation', { dm: [{ champ: champ, impact: 'perte_singuliere' }], pv: [{ type: 'x', description: 'verif_partagee' }] })]),
    l33([mr('extraction'), mr('insufflation')]), { systeme: 'double_flux' });
  const m = s.donneesManquantes.filter(x => x.champ === champ);
  A(m.length === 1 && m[0].reseaux.indexOf('extraction') !== -1 && m[0].reseaux.indexOf('insufflation') !== -1 && m[0].impact === 'perte_singuliere', '13. manque dédupliqué une seule fois, provenance (extraction+insufflation) et impact conservés');
  const p = s.pointsAVerifier.filter(x => x.description === 'verif_partagee');
  A(p.length === 1 && p[0].reseaux.length === 2, '14. point à vérifier dédupliqué, provenance conservée');
}

// ---- 15-16. Références (pas de recalcul / pas de re-somme / frontière LOT32-33) --
{
  const l = l32([rc('extraction', { perte: 123 })]);
  const s = V.syntheseEtudeVmc(l, l33([mr('extraction', { margePa: 7 })]), { systeme: 'simple_flux' });
  const r = R0(s);
  A(r.perteChemin.origine === 'LOT32' && r.perteChemin.perteMaximaleCalculee === l.reseaux[0].cheminCritiqueCalcule.perteMaximaleCalculee && r.margePression.origine === 'LOT33' && r.margePression.margePa === 7, '15. références LOT32/LOT33 (même objet perteMaximaleCalculee, marge référencée) — aucun recalcul');
  // Frontière : LOT34 ne crée AUCUNE perte sommée propre (ni perteTotale, ni pertesNecessaires, ni ajout terminal).
  A(!('pertesNecessaires' in r) && !('perteTotale' in r) && !('perteSommee' in r) && !/perteTotaleSynthese|sommeSynthese/.test(JSON.stringify(r)), '16. aucune perte resommée ni terme terminal réintroduit par LOT34');
}

// ---- 17. Système non précisé → périmètre non vérifié (signalé, non supposé) ------
{
  const s = V.syntheseEtudeVmc(l32([rc('extraction')]), l33([mr('extraction')]), {});
  A(s.reseauxNecessaires === null && s.pointsAVerifier.some(x => /perimetre|non précisé|nécessaires/i.test(x.description)), '17. systeme non précisé → réseaux nécessaires non vérifiés (signalé)');
}

// ---- 18-19. Entrées absentes -----------------------------------------------------
{
  A(V.syntheseEtudeVmc({ disponible: false }, null, {}).disponible === false, '18. perte chemin indisponible → synthèse disponible:false');
  const s = V.syntheseEtudeVmc(l32([rc('extraction')]), null, { systeme: 'simple_flux' });
  A(R0(s).statut === 'calcule_incertain' && R0(s).garantie === false && R0(s).margePression.statut === 'non_evaluee', '19. margePression absente → réseau calcule_incertain (marge non évaluée, jamais supposée)');
}

// ---- 20. Non-mutation des entrées -----------------------------------------------
{
  const p = l32([rc('extraction')]); const m = l33([mr('extraction')]); const o = { systeme: 'simple_flux' };
  const snap = JSON.stringify([p, m, o]);
  V.syntheseEtudeVmc(p, m, o);
  A(JSON.stringify([p, m, o]) === snap, '20. LOT34 ne mute pas ses entrées');
}

// ---- 21. Hors money-path + LOT15-A non fusionnée (source LOT34) ------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const i0 = SRC.indexOf('M57 LOT34'); const i1 = SRC.indexOf('if (typeof module', i0);
  const BLOC = SRC.slice(i0, i1 > i0 ? i1 : SRC.length);
  A(BLOC.length > 0 && !/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|projeterVmcVersConfig|piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '21. LOT34 : hors money-path / Runtime / DOM / fichier');
  A(!/preEtude\.pertes|analysePressionVmc\(|\.pression\b|table_lineaire/.test(BLOC), '21b. LOT34 : ne consomme ni LOT15-A/16 ni LOT17-A (voie physique LOT32/33 seule)');
}

// ---- 22-23. Intégration RÉELLE : visite → LOT32 → LOT33 → LOT34 ------------------
{
  const REF = V.creerReferentielProductionPertes({
    referentielId: 'FIX34', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
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
  const lot32 = V.perteCheminDarcyVmc(etude.normalisation.donneesReseau, etude.darcy);
  const perte = lot32.reseaux[0].cheminCritiqueCalcule.perteMaximaleCalculee.valeur;
  const Q = etude.etude.preDimensionnement.reseaux.filter(x => x.type === 'extraction')[0].debitProjet;
  const lot33 = V.margePressionCheminVmc(lot32, { pressionDisponible: { extraction: { valeur: perte + 30, unite: 'Pa', nature: 'totale', debitReference: Q, source: 'FabX', provenance: 'constructeur' } } }, { debitProjet: { extraction: Q } });
  const s = V.syntheseEtudeVmc(lot32, lot33, { systeme: 'simple_flux' });
  A(s.disponible === true && ENUM.indexOf(R0(s).statut) !== -1 && R0(s).perteChemin.perteMaximaleCalculee.valeur === perte, '22. e2e : synthèse consolide la voie réelle (perte référencée = perte LOT32)');
  A(R0(s).margePression.origine === 'LOT33' && typeof R0(s).margePression.margePa === 'number' && s.reseauxNecessaires.join(',') === 'extraction', '23. e2e : marge LOT33 référencée, réseau nécessaire SF = extraction');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Synthèse d\'étude VMC consolidée (M57 LOT34) : ' + ok + '/' + total + ' — agrégateur pur chemin→réseau→global, références LOT32/33 sans recalcul, SF/DF séparés, plus faible maillon, manques dédupliqués+provenance, statut⟂garantie, aucune conformité');
else { console.error('❌ Synthèse d\'étude LOT34 : ' + ok + '/' + total); process.exit(1); }
