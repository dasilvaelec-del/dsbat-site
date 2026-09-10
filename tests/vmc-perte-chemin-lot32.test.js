// =====================================================================
// tests/vmc-perte-chemin-lot32.test.js — M57 LOT32 : perte de charge PAR CHEMIN (graphe LOT29)
// =====================================================================
// Agrégation PHYSIQUE par chemin terminal→source sur le graphe orienté réel (LOT29) des pertes
// DÉJÀ calculées de la voie Darcy : linéaire (LOT27) + singulière (LOT31). Contrat vérifié :
//   • graphe réel obligatoire (orientation, connexité, absence de cycle, terminaux raccordés) ;
//   • parcours selon l'orientation réelle (extraction amont→aval ; insufflation aval→amont) ;
//   • perteChemin = Σ (linéaire + singulière) des tronçons du chemin ;
//   • tronçon PARTAGÉ compté une fois PAR chemin ; branches parallèles JAMAIS additionnées (MAX) ;
//   • cohérence des débits relevés aux nœuds vérifiée et signalée, jamais corrigée ;
//   • chemin calculable seulement si toutes ses pertes le sont ; incomplets conservés/signalés ;
//   • pas de maximum « certain » si un chemin pertinent reste incomplet ;
//   • aucun fallback LOT15-A ; aucune donnée inventée ; perte terminale seulement si fournie ;
//   • SF extraction seule ; DF extraction/insufflation séparées ; aucun mélange de réseaux.
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

// Référentiel PRODUCTION fixture : air + rugosité galva (→ linéaire LOT27) + ζ coude (→ singulière LOT31).
const REF = V.creerReferentielProductionPertes({
  referentielId: 'FIX32', version: 'test-0', provenance: 'test', statut: 'test', datePublication: 'x', sourcePrincipale: 'FIX',
  masseVolumiqueAir: { valeur: 1.2, unite: 'kg/m3', source: 'FIX' },
  viscositeDynamiqueAir: { valeur: 1.81e-5, unite: 'Pa.s', source: 'FIX' },
  rugosites: [{ id: 'g', typeConduit: 'acier_galvanise', epsilon: 0.09, uniteEpsilon: 'mm', domaine: 't', source: 'FIX', referenceExacte: 't', statut: 'test' }],
  singuliers: [{ id: 'z', type: 'coude', geometrie: 'coude_90', coefficient: 0.4, unite: '', domaine: 't', source: 'FIX', referenceExacte: 't', statut: 'test' }]
});
// Référentiel LOT15-A (table) AVEC pertes — pour prouver l'absence de repli quand le graphe manque.
const REF_R_LOT15A = { methode: 'table_lineaire_pa_par_m', source: 'FIX', version: 't', provenance: 'test', masseVolumiqueAir: 1.2, lineaire: { acier_galvanise: { 125: 0.8 } }, singulier: { coude: { coude_90: { coefficient: 0.4 } } } };

const SC = () => [{ type: 'coude', geometrie: 'coude_90', quantite: cv(1) }];
const tr = (id, amont, aval, opt) => Object.assign({ id: id, role: (opt && opt.role) || 'antenne', noeudAmont: amont, noeudAval: aval, longueur: cv((opt && opt.L) != null ? opt.L : 8), diametre: cv(125), typeConduit: (opt && opt.conduit) || 'acier_galvanise', debit: cv((opt && opt.debit) != null ? opt.debit : 45), singularites: (opt && opt.noSing) ? [] : SC() }, (opt && opt.pieceRef) ? { pieceRef: opt.pieceRef } : {});
const term = (id, noeudId, fonction, debit) => ({ id: id, pieceRef: id, noeudId: noeudId, fonction: fonction, debit: (debit != null ? cv(debit) : undefined) });

function build(systeme, reseaux) {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: systeme } });
  reseaux.forEach(rs => {
    dv = V.ajouterReseauVisite(dv, { id: rs.id, type: rs.type });
    (rs.noeuds || []).forEach(id => { dv = V.ajouterNoeudVisite(dv, rs.id, { id: id }); });
    (rs.troncons || []).forEach(t => { dv = V.ajouterTronconVisite(dv, rs.id, t); });
    (rs.terminaux || []).forEach(tm => { dv = V.ajouterTerminalVisite(dv, rs.id, tm); });
  });
  return dv;
}
// Lance l'étude Darcy puis LOT32 sur les données normalisées réellement étudiées.
function run(dv, pieces, ctx, opts) {
  const r = V.etudierVisiteVmc(pieces || [{ id: 'sdb', numero: 1 }], ctx || CTX({ solution: 'simple_flux' }), dv, Object.assign({ referentielProduction: REF }, opts || {}));
  return { etude: r, res: V.perteCheminDarcyVmc(r.normalisation.donneesReseau, r.darcy) };
}
// Composantes BRUTES lin+sing d'un tronçon (lin non arrondie LOT27, sing arrondie LOT31) — sommées
// puis arrondies UNE fois comme le fait LOT32 (r3(Σlin + Σsing)), pour une comparaison exacte.
function comp(etude, type, id) {
  const rd = etude.darcy.reseaux.filter(x => x.type === type)[0];
  const lin = (rd.troncons.filter(t => t.tronconId === id)[0] || {}).perteLineaire;
  const sg = (rd.singulier.troncons.filter(t => t.tronconId === id)[0] || {}).perteSinguliere;
  return lin.valeur + sg.valeur;
}

// ---- 0. Export --------------------------------------------------------------
A(typeof V.perteCheminDarcyVmc === 'function', '0. LOT32 exporté (perteCheminDarcyVmc)');

// ---- 1-3. Graphe simple : chemin unique en série -----------------------------
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB', 'nC'],
    troncons: [tr('T1', 'nA', 'nB', { L: 8, pieceRef: 'sdb#1' }), tr('T2', 'nB', 'nC', { L: 4, role: 'collecteur', debit: 45 })],
    terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45)] }]);
  const { etude, res } = run(dv);
  const R = res.reseaux[0];
  A(res.disponible === true && R.statut === 'calcule' && R.chemins.length === 1, '1. graphe simple → réseau calculé, un chemin');
  const attendu = r3(comp(etude, 'extraction', 'T1') + comp(etude, 'extraction', 'T2'));
  A(R.chemins[0].statut === 'calcule' && R.chemins[0].troncons.join(',') === 'T1,T2' && R.chemins[0].perteChemin.valeur === attendu, '2. perteChemin = Σ (linéaire+singulière) des tronçons en série');
  A(R.cheminCritiqueCalcule.terminal === 'b1' && R.cheminCritiqueCalcule.perteMaximaleCalculee.valeur === attendu && R.maximumCertain === true, '3. chemin critique = ce chemin, maximum certain');
}

// ---- 4-7. Branchement : tronçons partagés, sélection du max, parallèle non additionné
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB', 'nC', 'nD'],
    troncons: [tr('T_A', 'nA', 'nC', { L: 12, pieceRef: 'sdb#1' }), tr('T_B', 'nB', 'nC', { L: 6, pieceRef: 'cuis#1' }), tr('T_trunk', 'nC', 'nD', { L: 4, role: 'collecteur', debit: 90 })],
    terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45), term('b2', 'nB', 'SORTIE_AIR', 45)] }]);
  const { etude, res } = run(dv, [{ id: 'sdb', numero: 1 }, { id: 'cuis', numero: 1 }]);
  const R = res.reseaux[0];
  const c1 = R.chemins.filter(c => c.terminal === 'b1')[0], c2 = R.chemins.filter(c => c.terminal === 'b2')[0];
  A(c1.troncons.join(',') === 'T_A,T_trunk' && c2.troncons.join(',') === 'T_B,T_trunk', '4. tronçon partagé (T_trunk) compté une fois DANS CHAQUE chemin');
  const pA = r3(comp(etude, 'extraction', 'T_A') + comp(etude, 'extraction', 'T_trunk'));
  const pB = r3(comp(etude, 'extraction', 'T_B') + comp(etude, 'extraction', 'T_trunk'));
  A(c1.perteChemin.valeur === pA && c2.perteChemin.valeur === pB, '5. chaque chemin = sa branche + le tronc partagé');
  A(R.cheminCritiqueCalcule.terminal === 'b1' && R.cheminCritiqueCalcule.perteMaximaleCalculee.valeur === Math.max(pA, pB), '6. sélection du MAXIMUM (chemin le plus défavorable)');
  const sommeTotaleFausse = r3(comp(etude, 'extraction', 'T_A') + comp(etude, 'extraction', 'T_B') + comp(etude, 'extraction', 'T_trunk'));
  A(R.cheminCritiqueCalcule.perteMaximaleCalculee.valeur !== sommeTotaleFausse && Math.max(pA, pB) < sommeTotaleFausse, '7. branches parallèles NON additionnées (≠ somme de tous les tronçons)');
}

// ---- 8-9. Graphe cyclique → indéterminé (aucun parcours) ---------------------
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['n1', 'n2', 'n3'],
    troncons: [tr('C1', 'n1', 'n2'), tr('C2', 'n2', 'n3'), tr('C3', 'n3', 'n1', { role: 'collecteur' })],
    terminaux: [term('b1', 'n1', 'SORTIE_AIR', 45)] }]);
  const { res } = run(dv);
  const R = res.reseaux[0];
  A(R.statut === 'indetermine' && R.cheminCritiqueCalcule === null && R.chemins.length === 0, '8. graphe cyclique → indéterminé, aucun chemin fabriqué');
  A((R.donneesManquantes || []).some(x => x.champ === 'cycle_topologique'), '9. cause explicite : cycle_topologique');
}

// ---- 10-11. Graphe incomplet / non connexe : terminal non raccordé -----------
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB'],
    troncons: [tr('T1', 'nA', 'nB', { role: 'collecteur' })],
    terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45), term('bX', null, 'SORTIE_AIR', 30)] }]);
  const { res } = run(dv);
  const R = res.reseaux[0];
  const cX = R.chemins.filter(c => c.terminal === 'bX')[0];
  A(cX && cX.statut === 'incomplet' && cX.perteChemin === null && cX.raisons.indexOf('terminal_non_raccorde') !== -1, '10. terminal non raccordé → chemin incomplet CONSERVÉ + signalé (jamais 0)');
  A(R.statut !== 'calcule' && R.maximumCertain === false, '11. graphe incomplet → jamais « calculé plein », maximum non certain');
}

// ---- 12-13. Perte manquante sur un tronçon d'un chemin ------------------------
{
  // Branche B en conduit « souple » : linéaire LOT27 non calculable (rugosité famille absente) → chemin incomplet.
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB', 'nC', 'nD'],
    troncons: [tr('T_A', 'nA', 'nC', { L: 6, pieceRef: 'sdb#1' }), tr('T_B', 'nB', 'nC', { L: 12, pieceRef: 'cuis#1', conduit: 'souple' }), tr('T_trunk', 'nC', 'nD', { role: 'collecteur', debit: 90 })],
    terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45), term('b2', 'nB', 'SORTIE_AIR', 45)] }]);
  const { res } = run(dv, [{ id: 'sdb', numero: 1 }, { id: 'cuis', numero: 1 }]);
  const R = res.reseaux[0];
  const c2 = R.chemins.filter(c => c.terminal === 'b2')[0];
  A(c2.statut === 'incomplet' && c2.perteChemin === null && c2.raisons.some(x => /^perte_troncon_incomplete:T_B/.test(x)), '12. perte de tronçon manquante → chemin incomplet conservé + signalé');
  A(R.statut === 'partiel' && R.cheminCritiqueCalcule !== null && R.maximumCertain === false, '13. maximum NON certain tant qu\'un chemin pertinent reste incomplet');
}

// ---- 14-15. Cohérence des débits relevés : signalée, jamais corrigée ---------
{
  // À nC : entrant T_A(45)+T_B(45)=90 ; sortant T_trunk=50 → incohérence relevée.
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB', 'nC', 'nD'],
    troncons: [tr('T_A', 'nA', 'nC', { pieceRef: 'sdb#1', debit: 45 }), tr('T_B', 'nB', 'nC', { pieceRef: 'cuis#1', debit: 45 }), tr('T_trunk', 'nC', 'nD', { role: 'collecteur', debit: 50 })],
    terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45), term('b2', 'nB', 'SORTIE_AIR', 45)] }]);
  const { etude, res } = run(dv, [{ id: 'sdb', numero: 1 }, { id: 'cuis', numero: 1 }]);
  const R = res.reseaux[0];
  A(R.coherenceDebits.statut === 'incoherences_signalees' && R.coherenceDebits.incoherences.some(i => i.noeud === 'nC' && i.entrant === 90 && i.sortant === 50), '14. débit incohérent au nœud → signalé (entrant 90 ≠ sortant 50)');
  // Les pertes restent calculées telles quelles (aucune correction du débit relevé).
  A(R.chemins.filter(c => c.terminal === 'b1')[0].statut === 'calcule' && R.chemins.filter(c => c.terminal === 'b1')[0].perteChemin.valeur === r3(comp(etude, 'extraction', 'T_A') + comp(etude, 'extraction', 'T_trunk')), '15. pertes non corrigées malgré l\'incohérence (débit relevé conservé)');
}

// ---- 16. SF : réseau extraction seul -----------------------------------------
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB'],
    troncons: [tr('T1', 'nA', 'nB', { role: 'collecteur' })], terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45)] }]);
  const { res } = run(dv);
  A(res.reseaux.length === 1 && res.reseaux[0].type === 'extraction', '16. SF → un seul réseau (extraction)');
}

// ---- 17-19. DF : extraction et insufflation SÉPARÉES --------------------------
{
  const dv = build('double_flux', [
    { id: 'RE', type: 'extraction', noeuds: ['eA', 'eB'], troncons: [tr('E1', 'eA', 'eB', { role: 'collecteur' })], terminaux: [term('be', 'eA', 'SORTIE_AIR', 45)] },
    { id: 'RI', type: 'insufflation', noeuds: ['iS', 'iT'], troncons: [tr('I1', 'iS', 'iT', { role: 'antenne' })], terminaux: [term('bi', 'iT', 'INSUFFLATION', 45)] }
  ]);
  const { etude, res } = run(dv, [{ id: 'sdb', numero: 1 }, { id: 'ch', numero: 1 }], CTX({ solution: 'double_flux' }));
  const ext = res.reseaux.filter(x => x.type === 'extraction')[0], ins = res.reseaux.filter(x => x.type === 'insufflation')[0];
  A(res.reseaux.length === 2 && ext && ins && ext !== ins, '17. DF → extraction et insufflation présents et distincts');
  // Insufflation : parcours aval→amont (terminal iT → source iS).
  A(ins.chemins[0].troncons.join(',') === 'I1' && ins.chemins[0].statut === 'calcule' && ins.chemins[0].perteChemin.valeur === r3(comp(etude, 'insufflation', 'I1')), '18. insufflation parcourue selon l\'orientation réelle (aval→amont), perte propre');
  A(ext.cheminCritiqueCalcule.terminal === 'be' && ins.cheminCritiqueCalcule.terminal === 'bi' && !res.reseaux.perteChemin && !/perteCheminGlobale|reseauFusionne/.test(JSON.stringify(res)), '19. aucun mélange entre réseaux (chemins/critiques séparés, aucun total global)');
}

// ---- 20-21. AUCUN fallback LOT15-A quand le graphe manque --------------------
{
  // Réseau SANS graphe (aucun nœud/arête), MAIS référentiel LOT15-A fourni avec pertes.
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(45), singularites: SC() });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX({ solution: 'simple_flux' }), dv, { referentielProduction: REF, referentielPertes: REF_R_LOT15A });
  const res = V.perteCheminDarcyVmc(r.normalisation.donneesReseau, r.darcy);
  const R = res.reseaux[0];
  A(R.statut === 'indetermine' && R.cheminCritiqueCalcule === null, '20. graphe absent → indéterminé (aucun chemin), malgré un référentiel LOT15-A disponible');
  // Preuve de non-repli : LOT15-A a bien des pertes, mais LOT32 ne les emprunte pas.
  A(!/table_lineaire_pa_par_m|pertesLineaires/.test(JSON.stringify(res)) && r.pertes && r.pertes.reseaux, '21. AUCUN repli LOT15-A (LOT32 ne lit que la voie Darcy)');
}

// ---- 22. Non-mutation + hors money-path (source LOT32) ------------------------
{
  const dv = build('simple_flux', [{ id: 'RE', type: 'extraction', noeuds: ['nA', 'nB'], troncons: [tr('T1', 'nA', 'nB', { role: 'collecteur' })], terminaux: [term('b1', 'nA', 'SORTIE_AIR', 45)] }]);
  const snap = JSON.stringify(dv);
  run(dv);
  A(JSON.stringify(dv) === snap, '22. LOT32 ne mute pas la visite');
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const i0 = SRC.indexOf('M57 LOT32'); const i1 = SRC.indexOf('if (typeof module', i0);
  const BLOC = SRC.slice(i0, i1 > i0 ? i1 : SRC.length);
  A(BLOC.length > 0 && !/getMoyenPrixFor|prixTotal|dimensionnementVMC|VMC_PARAMS|projeterVmcVersConfig|piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|require\(|fetch\(|document\.|window\./.test(BLOC), '23. LOT32 : hors money-path / Runtime / DOM / fichier');
  // Aucune donnée physique inventée : aucun littéral décimal (ni ζ, ni ε, ni ρ) dans le bloc.
  const nombresDurs = (BLOC.match(/[^.\w]0?\.\d+/g) || []).map(s => s.trim()).filter(s => s !== '');
  A(nombresDurs.length === 0, '24. aucun coefficient/donnée physique écrit en dur — trouvés: ' + JSON.stringify(nombresDurs));
}

const total = ok + ko;
if (ko === 0) console.log('✅ Perte de charge par chemin (M57 LOT32) : ' + ok + '/' + total + ' — agrégation graphe LOT29, Σ linéaire+singulière par chemin, max sans addition parallèle, cycle/incomplet refusés, débits incohérents signalés, SF/DF séparés, aucun repli LOT15-A');
else { console.error('❌ Perte de charge par chemin LOT32 : ' + ok + '/' + total); process.exit(1); }
