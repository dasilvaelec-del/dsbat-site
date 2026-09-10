// =====================================================================
// tests/vmc-graphe-lot29.test.js — M57 LOT29 : socle de graphe aéraulique VMC
// =====================================================================
// Terminal→nœud (terminal.noeudId) → tronçon→nœud (noeudAmont/noeudAval), conservés de la visite
// à donneesReseau. validerTopologieVmc distingue INVALIDE (référence cassée/cycle) et INCOMPLET
// (relation manquante). parcourirGrapheVmc = index/voisinage orientés. La dérivation LOT28 utilise
// le graphe quand il est décrit (propagation déterministe extraction/insufflation), sinon repli
// arbre 2 niveaux. Aucun débit inventé ; relevé prioritaire ; SF/DF séparés. Hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const cv = (val, st) => V.creerChampValeur({ valeur: val, statut: st || V.STATUT_VISITE.MESURE });
const tr = (rz, id) => rz.troncons.filter(t => (t.tronconId === id || t.ref === id))[0];
// Réseau graphe direct (donneesReseau-shaped).
const rz = (type, noeuds, troncons, terminaux) => ({ reseaux: [{ type: type, noeuds: noeuds.map(id => ({ id: id })), troncons: troncons, terminaux: terminaux }] });
const T = (id, noeudId, debit, fonction) => ({ id: id, noeudId: noeudId, fonction: (fonction || 'SORTIE_AIR'), debit: debit });
const E = (id, a, b) => ({ id: id, noeudAmont: a, noeudAval: b });

A(typeof V.validerTopologieVmc === 'function' && typeof V.parcourirGrapheVmc === 'function', '0. socle graphe exporté');

// ---- 1-5. Modèle : terminal.noeudId + tronçon.noeudAmont/aval conservés ----------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'e1', role: 'antenne', pieceRef: 'sdb#1', noeudAmont: 'N1', noeudAval: 'N2', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise' });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'tm1', reseauId: 'RE', pieceRef: 'sdb#1', noeudId: 'N1', fonction: 'SORTIE_AIR', debitDeclare: cv(30) });
  A(dv.reseaux[0].terminaux[0].noeudId === 'N1', '1. creerTerminalVisite porte noeudId');
  const norm = V.normaliserVisiteVersReseau(dv);
  const t = norm.donneesReseau.reseaux[0].troncons[0], tm = norm.donneesReseau.reseaux[0].terminaux[0];
  A(tm.noeudId === 'N1', '2. normalisation conserve terminal.noeudId');
  A(t.noeudAmont === 'N1' && t.noeudAval === 'N2', '4/5. normalisation conserve noeudAmont/noeudAval');
  // Persistence
  const rt = V.restaurerVisiteVmc(JSON.parse(JSON.stringify(V.serialiserVisiteVmc(dv))));
  A(rt.reseaux[0].terminaux[0].noeudId === 'N1' && rt.reseaux[0].troncons[0].noeudAmont === 'N1', '3. persistence save→restore conserve noeudId + arêtes');
  A(rt.reseaux[0].terminaux[0].id === 'tm1' && rt.reseaux[0].troncons[0].id === 'e1', '27. IDs stables après restauration');
}

// ---- 6. Chaîne simple : T→N1→(e)→N2 ----------------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', 30)]));
  A(tr(r.reseaux[0], 'e').debit === 30 && tr(r.reseaux[0], 'e').origine === 'derive' && tr(r.reseaux[0], 'e').methode === 'graphe_extraction', '6. chaîne simple → débit dérivé par graphe (30)');
}

// ---- 7/8. Branchement + convergence (§26) ----------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2', 'N3', 'N4'],
    [E('e1', 'N1', 'N3'), E('e2', 'N2', 'N3'), E('e3', 'N3', 'N4')],
    [T('T1', 'N1', 30), T('T2', 'N2', 15)]));
  A(tr(r.reseaux[0], 'e1').debit === 30 && tr(r.reseaux[0], 'e2').debit === 15, '7. deux branches distinctes (30, 15)');
  A(tr(r.reseaux[0], 'e3').debit === 45 && JSON.stringify(tr(r.reseaux[0], 'e3').terminauxContributeurs) === JSON.stringify(['T1', 'T2']), '8. convergence N3 → 45 (contributeurs tracés)');
}

// ---- 9. Plusieurs terminaux sur le même nœud -------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', 30), T('t2', 'N1', 15)]));
  A(tr(r.reseaux[0], 'e').debit === 45, '9. deux terminaux sur N1 → contribution 45');
}

// ---- 10. Nœud de passage (sans terminal) -----------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2', 'N3'], [E('e1', 'N1', 'N2'), E('e2', 'N2', 'N3')], [T('t1', 'N1', 30)]));
  A(tr(r.reseaux[0], 'e1').debit === 30 && tr(r.reseaux[0], 'e2').debit === 30, '10. nœud de passage N2 (pas une erreur) → 30 propagé');
}

// ---- 11/12/13/14/15. Validation : références cassées / cycles → INVALIDE ----------
{
  const noeudInconnu = rz('extraction', ['N1'], [E('e', 'N1', 'N2')], [T('t1', 'NZ', 30)]);
  const v = V.validerTopologieVmc(noeudInconnu).reseaux[0];
  A(v.valide === false && v.erreurs.some(e => e.code === 'troncon_aval_inconnu'), '12/13. tronçon aval inconnu → invalide');
  A(v.erreurs.some(e => e.code === 'noeud_inconnu'), '11. terminal → nœud inexistant → invalide');
  const auto = V.validerTopologieVmc(rz('extraction', ['N1'], [E('e', 'N1', 'N1')], [])).reseaux[0];
  A(auto.valide === false && auto.erreurs.some(e => e.code === 'troncon_auto_reference'), '14. auto-cycle A→A → invalide');
  const cycle = V.validerTopologieVmc(rz('extraction', ['A', 'B'], [E('e1', 'A', 'B'), E('e2', 'B', 'A')], [])).reseaux[0];
  A(cycle.valide === false && cycle.cycle === true, '15. cycle A→B→A → invalide');
  // Dérivation refuse un graphe invalide (aucun débit inventé)
  const rc = V.deriverDebitsTronconsVmc(rz('extraction', ['A', 'B'], [E('e1', 'A', 'B'), E('e2', 'B', 'A')], [T('t', 'A', 30)]));
  A(rc.reseaux[0].troncons.every(t => t.debit === null), '15b. dérivation sur graphe invalide/cyclique → aucun débit');
}

// ---- 16. Terminal non raccordé → INCOMPLET (≠ invalide) --------------------------
{
  const v = V.validerTopologieVmc(rz('extraction', ['N1'], [E('e', 'N1', 'N2')], [T('t1', null, 30)])).reseaux[0];
  A(v.erreurs.every(e => e.code !== 'terminal_non_raccorde') && v.incomplets.some(i => i.code === 'terminal_non_raccorde'), '16. terminal non raccordé → incomplet (pas invalide)');
}

// ---- 17. Plusieurs chemins (divergence) → ambiguïté, aucun choix ------------------
{
  // N1 (terminal) a DEUX sorties → attribution ambiguë.
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2', 'N3'], [E('e1', 'N1', 'N2'), E('e2', 'N1', 'N3')], [T('t1', 'N1', 30)]));
  A(tr(r.reseaux[0], 'e1').statut === 'indetermine' && tr(r.reseaux[0], 'e1').raison === 'topologie_ambigue', '17. plusieurs chemins → topologie_ambigue (aucun débit inventé)');
}

// ---- 18/19/20/21. SF / DF isolés, aucun mélange ----------------------------------
{
  const rSF = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', 30)]));
  A(rSF.reseaux.length === 1 && rSF.reseaux[0].type === 'extraction', '18. SF extraction isolé');
  const df = { reseaux: [
    { type: 'extraction', noeuds: [{ id: 'E1' }, { id: 'E2' }], troncons: [E('ee', 'E1', 'E2')], terminaux: [T('te', 'E1', 30, 'SORTIE_AIR')] },
    { type: 'insufflation', noeuds: [{ id: 'I1' }, { id: 'I2' }], troncons: [E('ii', 'I1', 'I2')], terminaux: [T('ti', 'I2', 40, 'INSUFFLATION')] }
  ] };
  const rDF = V.deriverDebitsTronconsVmc(df);
  A(rDF.reseaux.length === 2 && tr(rDF.reseaux[0], 'ee').debit === 30 && tr(rDF.reseaux[1], 'ii').debit === 40, '19/20. DF extraction (30) et insufflation (40) dérivés séparément');
  A(tr(rDF.reseaux[0], 'ee').reseau === 'extraction' && tr(rDF.reseaux[1], 'ii').reseau === 'insufflation', '21. aucun mélange SF/DF (réseaux étanches)');
}

// ---- 22/25. Débit terminal conservé ; aucun débit inventé ------------------------
{
  const r = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', 30)]));
  A(tr(r.reseaux[0], 'e').debit === 30, '22. débit terminal (30) conservé dans la dérivation');
  const r0 = V.deriverDebitsTronconsVmc(rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', undefined)]));
  A(tr(r0.reseaux[0], 'e').debit === null && !/reglementaire|moyen|defaut/.test(JSON.stringify(r0)), '25. terminal sans débit → indéterminé (aucun débit inventé)');
}

// ---- 23/24. Débit tronçon relevé prioritaire ; divergence signalée ---------------
{
  const d = rz('extraction', ['N1', 'N2'], [Object.assign(E('e', 'N1', 'N2'), { debit: 99 })], [T('t1', 'N1', 30)]);
  const r = V.deriverDebitsTronconsVmc(d);
  const t = tr(r.reseaux[0], 'e');
  A(t.debit === 99 && t.origine === 'releve', '23. débit tronçon relevé prioritaire (99, jamais remplacé)');
  A(t.debitDerive === 30 && r.pointsAVerifier.some(p => /releve_different_du_debit_derive/.test(p.description)), '24. divergence relevé/dérivé signalée (aucun arbitrage)');
}

// ---- 26. Non-mutation -------------------------------------------------------------
{
  const d = rz('extraction', ['N1', 'N2'], [E('e', 'N1', 'N2')], [T('t1', 'N1', 30)]);
  const snap = JSON.stringify(d);
  V.deriverDebitsTronconsVmc(d); V.validerTopologieVmc(d); V.parcourirGrapheVmc(d);
  A(JSON.stringify(d) === snap, '26. entrée non mutée (dérivation/validation/parcours)');
}

// ---- 28. Compatibilité ancienne donnée SANS graphe → repli LOT28 (pieceRef) ------
{
  // Aucun noeudId ni arête → repli sur l'arbre 2 niveaux pièce/collecteur (LOT28).
  const legacy = { reseaux: [{ type: 'extraction', troncons: [{ id: 'A', role: 'antenne', pieceRef: 'sdb#1' }], terminaux: [{ id: 't1', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', debit: 30 }] }] };
  const r = V.deriverDebitsTronconsVmc(legacy);
  A(tr(r.reseaux[0], 'A').debit === 30 && tr(r.reseaux[0], 'A').methode === 'somme_debits_terminaux_piece', '28. ancienne donnée sans graphe → repli LOT28 (pieceRef), toujours fonctionnel');
}

// ---- Parcours : index/degrés/terminaux par nœud ----------------------------------
{
  const g = V.parcourirGrapheVmc(rz('extraction', ['N1', 'N2', 'N3'], [E('e1', 'N1', 'N3'), E('e2', 'N2', 'N3')], [T('t1', 'N1', 30)])).reseaux[0];
  A(g.inDegree.N3 === 2 && g.outDegree.N1 === 1 && g.terminauxParNoeud.N1.length === 1 && g.cycle === false, 'P. parcours : degrés + terminaux par nœud + cycle=false');
}

// ---- Intégration LOT27/Darcy : débit issu du graphe consommé ---------------------
{
  const PROD = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.1.0.json'), 'utf8')));
  const CTX = { intention: 'creer', perimetre: 'complet', solution: 'simple_flux', nbPiecesPrincipales: 4 };
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N1' });
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N2' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'e1', role: 'antenne', pieceRef: 'sdb#1', noeudAmont: 'N1', noeudAval: 'N2', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise' }); // pas de débit tronçon
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'tm1', reseauId: 'RE', pieceRef: 'sdb#1', noeudId: 'N1', fonction: 'SORTIE_AIR', debitDeclare: cv(45) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX, dv, { referentielProduction: PROD });
  const t = r.darcy.reseaux[0].troncons[0];
  A(t.origineDebit === 'derive' && t.debit === 45 && t.statut === 'calculable', 'I. LOT27/Darcy consomme le débit dérivé par graphe (45) → calculable');
}

// ---- Money-path / architecture ---------------------------------------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const BLOC = SRC.slice(SRC.indexOf('M57 LOT29 — SOCLE DE GRAPHE'), SRC.indexOf('M57 LOT28 — DÉRIVATION'));
  A(BLOC.length > 0 && !/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|getMoyenPrixFor|prixTotal|dimensionnementVMC/.test(BLOC), 'M1. LOT29 : hors money-path');
  A(!/require\(|readFileSync\(|fetch\(|sessionStorage\.|localStorage\.|document\.|window\./.test(BLOC), 'M2. LOT29 : aucune lecture fichier / DOM / storage');
  A(!/\bconforme\b|non_conforme|dimensionn/i.test(BLOC), 'M3. LOT29 : aucun résultat de conformité/dimensionnement (moteur topologique)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Socle de graphe aéraulique (M57 LOT29) : ' + ok + '/' + total + ' — terminal→nœud→tronçon parcourable, dérivation graphe déterministe, invalide≠incomplet, compat héritée, hors money-path');
else { console.error('❌ Socle de graphe LOT29 : ' + ok + '/' + total); process.exit(1); }
