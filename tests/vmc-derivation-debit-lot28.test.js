// =====================================================================
// tests/vmc-derivation-debit-lot28.test.js — M57 LOT28 : dérivation déterministe du débit de tronçon
// =====================================================================
// deriverDebitsTronconsVmc dérive le débit d'un tronçon UNIQUEMENT quand il est démontrable
// (arbre à 2 niveaux : antenne↔pièce + collecteur unique) à partir des débits terminaux relevés.
// AUCUNE invention : ambiguïté / terminal sans débit / topologie insuffisante / cycle → null +
// indéterminé + raison. Débit relevé PRIORITAIRE ; divergence relevé/dérivé signalée sans arbitrage.
// Extraction/insufflation SÉPARÉS ; admission passive exclue. Wiring LOT27 : dérivé utilisé
// seulement si le tronçon n'a pas de débit relevé. Non-mutant, hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const dr = (reseaux) => ({ reseaux: reseaux });
const ant = (o) => Object.assign({ role: 'antenne' }, o);
const term = (id, piece, debit, fonction) => ({ id: id, pieceRef: piece, fonction: (fonction || 'SORTIE_AIR'), debit: debit });
const troncon = (rz, id) => rz.troncons.filter(t => (t.tronconId === id || t.ref === id))[0];

A(typeof V.deriverDebitsTronconsVmc === 'function', '0. deriverDebitsTronconsVmc exporté');

// ---- 1. Un tronçon + un terminal --------------------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  const t = troncon(r.reseaux[0], 'A');
  A(t.debit === 30 && t.origine === 'derive' && t.methode === 'somme_debits_terminaux_piece', '1. antenne → Σ terminaux de la pièce (30)');
  A(JSON.stringify(t.terminauxContributeurs) === JSON.stringify(['t1']), '1b. contributeurs tracés');
}

// ---- 2/3/4. Chaîne / deux terminaux / branchement (collecteur + antennes) ---------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction',
    troncons: [{ id: 'COL', role: 'collecteur' }, ant({ id: 'A', pieceRef: 'sdb#1' }), ant({ id: 'B', pieceRef: 'wc#1' })],
    terminaux: [term('t1', 'sdb#1', 30), term('t2', 'wc#1', 15)] }]));
  A(troncon(r.reseaux[0], 'A').debit === 30 && troncon(r.reseaux[0], 'B').debit === 15, '3/4. deux antennes distinctes (30, 15)');
  A(troncon(r.reseaux[0], 'COL').debit === 45 && troncon(r.reseaux[0], 'COL').methode === 'somme_debits_antennes_aval', '2/4b. collecteur = Σ antennes (45)');
}

// ---- 5. Deux terminaux dans la MÊME pièce → somme ---------------------------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 15), term('t2', 'sdb#1', 15)] }]));
  A(troncon(r.reseaux[0], 'A').debit === 30, '5. deux terminaux même pièce → somme (30)');
}

// ---- 6. Collecteur seul (déterminé) ----------------------------------------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [{ id: 'COL', role: 'collecteur' }, ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  A(troncon(r.reseaux[0], 'COL').debit === 30, '6. collecteur unique + antenne déterminée');
}

// ---- 7. Terminal sans débit → indéterminé (jamais un total partiel) --------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction',
    troncons: [{ id: 'COL', role: 'collecteur' }, ant({ id: 'A', pieceRef: 'sdb#1' }), ant({ id: 'B', pieceRef: 'wc#1' })],
    terminaux: [term('t1', 'sdb#1', 30), { id: 't2', pieceRef: 'wc#1', fonction: 'SORTIE_AIR' /* sans débit */ }] }]));
  A(troncon(r.reseaux[0], 'B').statut === 'indetermine' && troncon(r.reseaux[0], 'B').raison === 'terminal_sans_debit', '7. terminal sans débit → antenne indéterminée');
  A(troncon(r.reseaux[0], 'COL').statut === 'indetermine' && troncon(r.reseaux[0], 'COL').debit === null, '7b. collecteur indéterminé (jamais 30 comme total)');
}

// ---- 8. Topologie insuffisante (rôle inconnu / antenne sans pièce) ---------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [{ id: 'X', role: 'inconnu' }, ant({ id: 'Y' /* sans pieceRef */ })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  A(troncon(r.reseaux[0], 'X').statut === 'indetermine' && troncon(r.reseaux[0], 'X').raison === 'topologie_insuffisante', '8. rôle inconnu → indéterminé');
  A(troncon(r.reseaux[0], 'Y').statut === 'indetermine' && troncon(r.reseaux[0], 'Y').raison === 'antenne_sans_pieceRef', '8b. antenne sans pièce → indéterminé');
}

// ---- 9. Cycle → indéterminé (jamais traité comme un arbre) -----------------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [
    { id: 'A', role: 'antenne', pieceRef: 'x', noeudAmont: 'n1', noeudAval: 'n2' },
    { id: 'B', role: 'antenne', pieceRef: 'y', noeudAmont: 'n2', noeudAval: 'n1' }], terminaux: [] }]));
  A(r.reseaux[0].statut === 'indetermine' && r.reseaux[0].raison === 'cycle_topologique', '9. cycle topologique → réseau indéterminé');
  A(r.reseaux[0].troncons.every(t => t.debit === null), '9b. aucun débit dérivé sur un cycle');
}

// ---- 10. Ambiguïté (une pièce servie par plusieurs antennes) ---------------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' }), ant({ id: 'A2', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  A(troncon(r.reseaux[0], 'A').raison === 'ambiguite_antenne_pieceRef' && troncon(r.reseaux[0], 'A').debit === null, '10. ambiguïté antenne/pièce → indéterminé (aucun choix)');
}

// ---- 11/12. Débit relevé prioritaire ; divergence relevé/dérivé signalée ----------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1', debit: 99 })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  const t = troncon(r.reseaux[0], 'A');
  A(t.debit === 99 && t.origine === 'releve', '11. débit relevé conservé (jamais remplacé par le dérivé)');
  A(t.debitDerive === 30 && r.pointsAVerifier.some(p => /releve_different_du_debit_derive/.test(p.description)), '12. relevé ≠ dérivé → signalé, aucun arbitrage');
}

// ---- 13/14/15/16. SF / DF / séparation / fonction cohérente ----------------------
{
  // SF extraction
  const rSF = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30)] }]));
  A(rSF.reseaux.length === 1 && troncon(rSF.reseaux[0], 'A').debit === 30, '13. SF extraction dérivé');
  // DF : extraction + insufflation séparés
  const rDF = V.deriverDebitsTronconsVmc(dr([
    { type: 'extraction', troncons: [ant({ id: 'E', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30, 'SORTIE_AIR')] },
    { type: 'insufflation', troncons: [ant({ id: 'I', pieceRef: 'chambre#1' })], terminaux: [term('t2', 'chambre#1', 40, 'INSUFFLATION')] }]));
  A(rDF.reseaux.length === 2 && troncon(rDF.reseaux[0], 'E').debit === 30 && troncon(rDF.reseaux[1], 'I').debit === 40, '14/15. DF extraction (30) et insufflation (40) dérivés séparément');
  // Fonction incohérente : terminal INSUFFLATION dans un réseau extraction → ignoré
  const rMix = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30, 'INSUFFLATION')] }]));
  A(troncon(rMix.reseaux[0], 'A').statut === 'indetermine' && troncon(rMix.reseaux[0], 'A').raison === 'aucun_terminal_pour_piece', '16. terminal de fonction incohérente non sommé (extraction ≠ insufflation)');
}

// ---- 17. Admission passive exclue ------------------------------------------------
{
  // Un terminal ADMISSION_AIR dans un réseau extraction ne contribue pas.
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30, 'ADMISSION_AIR')] }]));
  A(troncon(r.reseaux[0], 'A').statut === 'indetermine', '17. admission passive (ADMISSION_AIR) exclue de la sommation extraction');
}

// ---- 18/19. Absence totale de débit → indéterminé, aucun fallback ----------------
{
  const r = V.deriverDebitsTronconsVmc(dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [] }]));
  A(troncon(r.reseaux[0], 'A').debit === null && troncon(r.reseaux[0], 'A').raison === 'aucun_terminal_pour_piece', '18/19. aucun débit → indéterminé (aucun défaut, aucun fallback)');
  A(!/reglementaire|moyen|defaut|par_defaut/.test(JSON.stringify(r)), '19b. aucune trace de valeur inventée (réglementaire/moyenne/défaut)');
}

// ---- 20. Non-mutation ------------------------------------------------------------
{
  const d = dr([{ type: 'extraction', troncons: [ant({ id: 'A', pieceRef: 'sdb#1' })], terminaux: [term('t1', 'sdb#1', 30)] }]);
  const snap = JSON.stringify(d);
  V.deriverDebitsTronconsVmc(d);
  A(JSON.stringify(d) === snap, '20. entrée non mutée');
}

// ---- 21. Propagation du débit terminal dans la normalisation (additif) -----------
{
  const cv = (val) => V.creerChampValeur({ valeur: val, statut: V.STATUT_VISITE.MESURE });
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'tm1', reseauId: 'RE', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', debitDeclare: cv(45) });
  const norm = V.normaliserVisiteVersReseau(dv);
  A(norm.donneesReseau.reseaux[0].terminaux[0].debit === 45, '21. débitDeclare du terminal propagé (relevé) dans donneesReseau');
}

// ---- 22/23. Wiring LOT27 : dérivé utilisé SEULEMENT si tronçon sans relevé --------
{
  const cv = (val) => V.creerChampValeur({ valeur: val, statut: V.STATUT_VISITE.MESURE });
  const PROD = V.chargerReferentielPertesDepuisJSON(JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiels', 'vmc', 'referentiel-pertes-vmc-v1.1.0.json'), 'utf8')));
  const CTX = { intention: 'creer', perimetre: 'complet', solution: 'simple_flux', nbPiecesPrincipales: 4 };
  // Tronçon galva sans débit ; terminal 45 → Darcy calcule via dérivé
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'A', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise' });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'tm1', reseauId: 'RE', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', debitDeclare: cv(45) });
  const r = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX, dv, { referentielProduction: PROD });
  const t = r.darcy.reseaux[0].troncons[0];
  A(t.origineDebit === 'derive' && t.debit === 45 && t.statut === 'calculable', '22. LOT27 : débit dérivé (45) utilisé → Darcy calculable');
  A(t.debitDerivation && t.debitDerivation.methode === 'somme_debits_terminaux_piece', '22b. origine de la dérivation tracée dans la voie Darcy');
  // Tronçon avec débit relevé → dérivation NON utilisée
  let dv2 = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv2 = V.ajouterReseauVisite(dv2, { id: 'RE', type: 'extraction' });
  dv2 = V.ajouterTronconVisite(dv2, 'RE', { id: 'A', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(125), typeConduit: 'acier_galvanise', debit: cv(60) });
  dv2 = V.ajouterTerminalVisite(dv2, 'RE', { id: 'tm1', reseauId: 'RE', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', debitDeclare: cv(45) });
  const r2 = V.etudierVisiteVmc([{ id: 'sdb', numero: 1 }], CTX, dv2, { referentielProduction: PROD });
  A(r2.darcy.reseaux[0].troncons[0].origineDebit === 'releve' && r2.darcy.reseaux[0].troncons[0].debit === 60, '23. débit relevé (60) prioritaire : la dérivation ne l\'écrase pas');
}

// ---- 24. Money-path / architecture -----------------------------------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const BLOC = SRC.slice(SRC.indexOf('M57 LOT28'), SRC.indexOf('M57 LOT27 — BRANCHEMENT'));
  A(BLOC.length > 0 && !/piece\.config|config\.vmc\s*=|calculerPiece|moteur-devis|getMoyenPrixFor|prixTotal|dimensionnementVMC/.test(BLOC), '24. LOT28 : hors money-path');
  A(!/require\(|readFileSync\(|fetch\(|sessionStorage\.|localStorage\.|document\.|window\./.test(BLOC), '25. LOT28 : aucune lecture fichier / DOM / storage');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Dérivation déterministe du débit de tronçon (M57 LOT28) : ' + ok + '/' + total + ' — Σ démontrable uniquement, relevé prioritaire, aucun fallback, SF/DF séparés, hors money-path');
else { console.error('❌ Dérivation débit tronçon LOT28 : ' + ok + '/' + total); process.exit(1); }
