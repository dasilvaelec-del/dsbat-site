// =====================================================================
// tests/vmc-debits-lot11.test.js — M57 LOT11 : débits VMC (référence)
// =====================================================================
// debitsVmc(pieces, contexte, besoin) : couche PURE associant aux fonctions du besoin
// (LOT10) un DÉBIT THÉORIQUE DE RÉFÉRENCE (arrêté 24 mars 1982, art. 3). Débit de
// conception, jamais mesuré/réglé/validé. Admission SF = 'a_equilibrer' (pas de débit
// individuel inventé) ; insufflation DF = 'a_dimensionner' (distincte). Hors money-path.
// Nb de pièces PRINCIPALES = celui du LOGEMENT (contexte.nbPiecesPrincipales), pas pieces.length.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, numero, vf) => ({ id: id, numero: numero, ventilationFonctions: vf });
// pipeline complet LOT7-A → LOT10 → LOT11
function etude(pieces, ctx) {
  const c = Object.assign({ intention: 'creer', perimetre: 'complet' }, ctx || {});
  return VMC.debitsVmc(pieces, c, VMC.besoinVmc(pieces, c));
}
const debitDe = (r, ref, fn) => {
  const p = r.pieces.find(x => x.pieceRef === ref); if (!p) return undefined;
  const f = p.fonctions.find(x => x.fonction === fn); return f ? f.debitReference : undefined;
};
const statutDe = (r, ref, fn) => {
  const p = r.pieces.find(x => x.pieceRef === ref); if (!p) return undefined;
  const f = p.fonctions.find(x => x.fonction === fn); return f ? f.statut : undefined;
};

A(typeof VMC.debitsVmc === 'function', '0. debitsVmc exporté');

// ---- 1-5. Table cuisine selon nb de pièces principales du logement ---------------
[[1, 75], [2, 90], [3, 105], [4, 120], [5, 135]].forEach(([n, attendu]) => {
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux', nbPiecesPrincipales: n });
  A(debitDe(r, 'cuisine#1', 'SORTIE_AIR') === attendu, n + ' pièce(s) principale(s) → cuisine = ' + attendu + ' m³/h');
});

// ---- 6-10. Pièces de service (nbPP=4 pour discriminer WC/SDB) ---------------------
{
  A(debitDe(etude([P('cuisine', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 }), 'cuisine#1', 'SORTIE_AIR') === 120, '6. cuisine (4p) = 120');
  A(debitDe(etude([P('sdb', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 }), 'sdb#1', 'SORTIE_AIR') === 30, '7. SDB (4p) = 30');
  A(debitDe(etude([P('sdb', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 2 }), 'sdb#1', 'SORTIE_AIR') === 15, '7bis. SDB (2p) = 15');
  A(debitDe(etude([P('sde', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 5 }), 'sde#1', 'SORTIE_AIR') === 15, '8. autre salle d\'eau = 15 (indépendant)');
  A(debitDe(etude([P('wc', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 }), 'wc#1', 'SORTIE_AIR') === 15, '9. WC unique (4p) = 15');
  const rWc = etude([P('wc', 1), P('wc', 2)], { solution: 'simple_flux', nbPiecesPrincipales: 4 });
  A(debitDe(rWc, 'wc#1', 'SORTIE_AIR') === 30 && debitDe(rWc, 'wc#2', 'SORTIE_AIR') === 30, '10. WC multiples (4p) = 30');
  A(debitDe(etude([P('wc', 1), P('wc', 2)], { solution: 'simple_flux', nbPiecesPrincipales: 3 }), 'wc#1', 'SORTIE_AIR') === 15, '10bis. WC multiples (3p) = 15');
}

// ---- 11. Total extraction --------------------------------------------------------
{
  const r = etude([P('cuisine', 1), P('sdb', 1), P('wc', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 });
  A(r.totalExtraction === 120 + 30 + 15, '11. total extraction = 120+30+15 = 165');
  A(r.unite === 'm3/h', '11. unité m3/h');
}

// ---- 12. SF / 13. hygro : extraction débitée, admission à équilibrer --------------
['simple_flux', 'hygro'].forEach(sol => {
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: sol, nbPiecesPrincipales: 3 });
  A(debitDe(r, 'cuisine#1', 'SORTIE_AIR') === 105, sol + ' : cuisine (3p) = 105');
  A(statutDe(r, 'chambre#1', 'ADMISSION_AIR') === 'a_equilibrer', sol + ' : admission → a_equilibrer (pas de débit inventé)');
  A(debitDe(r, 'chambre#1', 'ADMISSION_AIR') == null, sol + ' : admission sans débit individuel');
  A(r.besoinAdmission === true, sol + ' : besoinAdmission signalé');
});

// ---- 14-18. Double flux ----------------------------------------------------------
{
  const r = etude([P('sdb', 1), P('chambre', 1)], { solution: 'double_flux', nbPiecesPrincipales: 4 });
  A(debitDe(r, 'sdb#1', 'SORTIE_AIR') === 30, '15. DF : extraction sdb (4p) = 30');
  A(statutDe(r, 'chambre#1', 'INSUFFLATION') === 'a_dimensionner', '16. DF : insufflation distincte → a_dimensionner');
  A(debitDe(r, 'chambre#1', 'INSUFFLATION') == null, '16. DF : pas de débit réglementaire d\'insufflation inventé');
  A(!r.pieces.find(p => p.pieceRef === 'chambre#1').fonctions.some(f => f.fonction === 'ADMISSION_AIR'), '17. DF : aucune fausse admission SF');
  A(!/VMC_BOUCHE|VMC_ENTREE_AIR|VMC_CAISSON/.test(JSON.stringify(r)), '18. DF : aucune fausse bouche tarifaire / code catalogue');
  A(r.besoinInsufflation === true, 'DF : besoinInsufflation signalé');
}

// ---- 19-20. Solution inconnue ----------------------------------------------------
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'inconnue', nbPiecesPrincipales: 3 });
  A(r.systeme === 'inconnue' && r.indetermine === true, '19. inconnue → indéterminé');
  A(!/simple_flux|VMC simple flux/.test(JSON.stringify(r)), '20. inconnue → jamais convertie en simple flux');
  A(!r.pieces.find(p => p.pieceRef === 'chambre#1').fonctions.some(f => f.fonction === 'INSUFFLATION'), '20. inconnue : pas d\'insufflation (système non décidé)');
}

// ---- 21. Pièce hors périmètre ----------------------------------------------------
{
  const horsScope = { id: 'sdb', numero: 2, enScope: false };
  const r = etude([P('cuisine', 1), horsScope], { solution: 'simple_flux', nbPiecesPrincipales: 3 });
  A(!r.pieces.some(p => p.pieceRef === 'sdb#2'), '21. pièce hors périmètre → aucun débit');
}

// ---- 22. 4 pièces principales mais 2 pièces rénovées -----------------------------
{
  const r = etude([P('cuisine', 1), P('sdb', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 });
  A(r.nbPiecesPrincipales === 4, '22. table basée sur 4 pièces principales du logement');
  A(debitDe(r, 'cuisine#1', 'SORTIE_AIR') === 120 && debitDe(r, 'sdb#1', 'SORTIE_AIR') === 30, '22. débits 4p (120/30) malgré 2 pièces en travaux');
}

// ---- 23. Admission sans débit individuel arbitraire (déjà couvert 12) ------------
A(debitDe(etude([P('salon', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 5 }), 'salon#1', 'ADMISSION_AIR') == null, '23. admission jamais dotée d\'un débit inventé');

// ---- 24. Aucune mutation des entrées ---------------------------------------------
{
  const pieces = [P('cuisine', 1), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'simple_flux', nbPiecesPrincipales: 3 };
  const besoin = VMC.besoinVmc(pieces, c);
  const snapP = JSON.stringify(pieces), snapB = JSON.stringify(besoin);
  VMC.debitsVmc(pieces, c, besoin);
  A(JSON.stringify(pieces) === snapP && JSON.stringify(besoin) === snapB, '24. entrées (pieces, besoin) non mutées');
}

// ---- 25. Aucun accès money-path (statique) ---------------------------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function debitsVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|prixTotal|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '25. debitsVmc : aucun prix/Runtime/DOM/global');
A(!/piece\.config\s*=|config\.vmc\s*=/.test(BLOC), '25. debitsVmc : aucune écriture config');

// ---- 26. Données insuffisantes (nbPP absent) → résultat prudent ------------------
{
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux' }); // pas de nbPiecesPrincipales
  A(r.indetermine === true && r.nbPiecesPrincipales === null, '26. nbPP absent → indéterminé prudent');
  A(debitDe(r, 'cuisine#1', 'SORTIE_AIR') == null && statutDe(r, 'cuisine#1', 'SORTIE_AIR') === 'indetermine', '26. aucun débit inventé sans nb de pièces');
}
// pièce d'extraction hors table (cave) → prudent
A(statutDe(etude([P('cave', 1)], { solution: 'simple_flux', nbPiecesPrincipales: 4 }), 'cave#1', 'SORTIE_AIR') === 'indetermine', '26bis. cave (hors table) → indetermine');

// ---- 27/28. Idempotence / déterminisme -------------------------------------------
{
  const pieces = [P('cuisine', 1), P('sdb', 1), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'double_flux', nbPiecesPrincipales: 4 };
  const b = VMC.besoinVmc(pieces, c);
  const r1 = VMC.debitsVmc(pieces, c, b), r2 = VMC.debitsVmc(pieces, c, b);
  A(JSON.stringify(r1) === JSON.stringify(r2), '27/28. déterministe : même entrée → même sortie');
}

// ---- 30. Compatibilité LOT10 (consomme la sortie de besoinVmc) -------------------
{
  const pieces = [P('cuisine', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'simple_flux', nbPiecesPrincipales: 2 };
  const b = VMC.besoinVmc(pieces, c);
  const r = VMC.debitsVmc(pieces, c, b);
  A(r.pieces[0].pieceRef === b.pieces[0].pieceRef, '30. debitsVmc consomme le pieceRef de besoinVmc (compat LOT10)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Débits VMC (M57 LOT11) : ' + ok + '/' + total + ' — débits de référence (arrêté 1982), admission à équilibrer, DF distinct, hors money-path');
else { console.error('❌ Débits VMC LOT11 : ' + ok + '/' + total); process.exit(1); }
