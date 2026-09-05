// =====================================================================
// tests/vmc-topologie-lot12.test.js — M57 LOT12 : topologie fonctionnelle VMC
// =====================================================================
// topologieVmc(pieces, contexte, besoin, debits) : vue PURE DÉRIVÉE (LOT10+LOT11).
// Flux séparés extraction / insufflation (DF) / admission_passive (SF-hygro). Centrale
// minimale, sourceAirNeuf extensible (défaut inconnu), rejet déclaratif. Hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, numero, vf) => ({ id: id, numero: numero, ventilationFonctions: vf });
function topo(pieces, ctx) {
  const c = Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, ctx || {});
  const besoin = VMC.besoinVmc(pieces, c);
  const debits = VMC.debitsVmc(pieces, c, besoin);
  return VMC.topologieVmc(pieces, c, besoin, debits);
}
const refs = (arr) => arr.map(p => p.pieceRef);

A(typeof VMC.topologieVmc === 'function', '0. topologieVmc exporté');

// ---- 1. Simple flux --------------------------------------------------------------
{
  const t = topo([P('cuisine', 1), P('sdb', 1), P('chambre', 1)], { solution: 'simple_flux' });
  A(t.systeme === 'simple_flux' && t.indetermine === false, '1. systeme=simple_flux, déterminé');
  A(refs(t.flux.extraction.points).sort().join(',') === 'cuisine#1,sdb#1', '1. extraction = pièces de service');
  A(refs(t.flux.admission_passive.points).join(',') === 'chambre#1', '1. admission passive = pièce principale');
  A(t.flux.insufflation.points.length === 0, '1. SF : aucune insufflation');
  A(t.centrale && t.centrale.type === 'SF', '1. centrale SF');
  A(!t.sourceAirNeuf, '1. SF : pas de source air neuf');
}

// ---- 2. Hygro : même séparation fonctionnelle -----------------------------------
{
  const t = topo([P('wc', 1), P('salon', 1)], { solution: 'hygro' });
  A(refs(t.flux.extraction.points).join(',') === 'wc#1', '2. hygro : extraction wc');
  A(refs(t.flux.admission_passive.points).join(',') === 'salon#1', '2. hygro : admission passive salon');
  A(t.flux.insufflation.points.length === 0, '2. hygro : aucune insufflation');
  A(t.centrale.type === 'SF', '2. hygro : centrale type SF');
}

// ---- 3. Double flux : deux réseaux distincts + centrale + source + rejet ---------
{
  const t = topo([P('sdb', 1), P('chambre', 1)], { solution: 'double_flux', rejet: 'toiture' });
  A(refs(t.flux.extraction.points).join(',') === 'sdb#1', '3. DF : extraction (service)');
  A(refs(t.flux.insufflation.points).join(',') === 'chambre#1', '3. DF : insufflation (principale)');
  A(t.flux.admission_passive.points.length === 0, '3. DF : aucune admission SF transformée en insufflation');
  A(t.centrale && t.centrale.type === 'DF', '3. DF : centrale DF');
  A(t.sourceAirNeuf && typeof t.sourceAirNeuf.type === 'string', '3. DF : sourceAirNeuf présente');
  A(t.rejet && t.rejet.placement === 'toiture', '3. DF : rejet réutilise le déclaratif (toiture)');
  // extraction et insufflation jamais mélangées
  A(!t.flux.extraction.points.some(p => p.role === 'insufflation') && !t.flux.insufflation.points.some(p => p.role === 'extraction'), '3. flux jamais mélangés');
}

// ---- 4. Inconnue : pas de conversion en SF --------------------------------------
{
  const t = topo([P('cuisine', 1), P('chambre', 1)], { solution: 'inconnue' });
  A(t.systeme === 'inconnue' && t.indetermine === true, '4. inconnue → indéterminé');
  A(t.centrale === null, '4. inconnue → aucune centrale (pas de conversion SF)');
  A(t.flux.insufflation.points.length === 0, '4. inconnue → aucune insufflation inventée');
  A(!/simple_flux|"SF"|"DF"/.test(JSON.stringify({ s: t.systeme, c: t.centrale })), '4. inconnue → pas de type système inventé');
}

// ---- 5. Pièce hors scope exclue --------------------------------------------------
{
  const hs = { id: 'sdb', numero: 2, enScope: false };
  const t = topo([P('cuisine', 1), hs], { solution: 'simple_flux' });
  A(!refs(t.flux.extraction.points).includes('sdb#2'), '5. pièce hors scope exclue de la topologie');
}

// ---- 6. Fonction non retenue absente --------------------------------------------
{
  // conserver → SORTIE_AIR a_verifier, retenue=false → point absent
  const t = topo([P('sdb', 1)], { solution: 'simple_flux', intention: 'conserver' });
  A(t.flux.extraction.points.length === 0, '6. fonction non retenue (a_verifier) → absente de la topologie');
}

// ---- 7. Débit repris de LOT11 (aucun recalcul local) ----------------------------
{
  const pieces = [P('cuisine', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'simple_flux', nbPiecesPrincipales: 4 };
  const besoin = VMC.besoinVmc(pieces, c);
  const debits = VMC.debitsVmc(pieces, c, besoin);
  const t = VMC.topologieVmc(pieces, c, besoin, debits);
  const pt = t.flux.extraction.points.find(p => p.pieceRef === 'cuisine#1');
  A(pt.debit === 120, '7. débit du point = débit de référence LOT11 (cuisine 4p = 120)');
  // si aucun débit LOT11 (insufflation) → null, pas d'invention
  const tDF = topo([P('chambre', 1)], { solution: 'double_flux' });
  A(tDF.flux.insufflation.points[0].debit == null, '7. insufflation : débit null (non recalculé)');
}

// ---- 8. Source air neuf inconnue : ne pas inventer "direct" ----------------------
{
  const t = topo([P('chambre', 1)], { solution: 'double_flux' }); // aucun sourceAirNeuf fourni
  A(t.sourceAirNeuf.type === 'inconnu', '8. sourceAirNeuf par défaut = inconnu (jamais direct)');
}

// ---- 9. Puits canadien futur : types acceptés sans refonte ----------------------
{
  A(topo([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: 'puits_horizontal' }).sourceAirNeuf.type === 'puits_horizontal', '9. puits_horizontal accepté');
  A(topo([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: 'puits_vertical' }).sourceAirNeuf.type === 'puits_vertical', '9. puits_vertical accepté');
  A(topo([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: 'direct' }).sourceAirNeuf.type === 'direct', '9. direct accepté (si fourni explicitement)');
  A(topo([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: 'n_importe_quoi' }).sourceAirNeuf.type === 'inconnu', '9. valeur inconnue → inconnu (pas d\'invention)');
}

// ---- 10. Anti-régression : hors money-path + non-mutation ------------------------
{
  const pieces = [P('cuisine', 1), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'double_flux', nbPiecesPrincipales: 4 };
  const besoin = VMC.besoinVmc(pieces, c);
  const debits = VMC.debitsVmc(pieces, c, besoin);
  const snap = JSON.stringify({ pieces, besoin, debits });
  VMC.topologieVmc(pieces, c, besoin, debits);
  A(JSON.stringify({ pieces, besoin, debits }) === snap, '10. entrées (pieces/besoin/debits) non mutées');
  A(!('config' in pieces[0]), '10. aucune création de piece.config');
}
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function topologieVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|prixTotal|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '10. topologieVmc : aucun prix/Runtime/DOM/global');
A(!/piece\.config\s*=|config\.vmc\s*=|VMC_BOUCHE|VMC_ENTREE_AIR|VMC_CAISSON/.test(BLOC), '10. topologieVmc : aucun code catalogue / écriture config');

// ---- Déterminisme ----------------------------------------------------------------
{
  const pieces = [P('cuisine', 1), P('sdb', 1), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'double_flux', nbPiecesPrincipales: 4 };
  const b = VMC.besoinVmc(pieces, c), d = VMC.debitsVmc(pieces, c, b);
  A(JSON.stringify(VMC.topologieVmc(pieces, c, b, d)) === JSON.stringify(VMC.topologieVmc(pieces, c, b, d)), 'déterministe : même entrée → même sortie');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Topologie VMC (M57 LOT12) : ' + ok + '/' + total + ' — vue dérivée, flux séparés, DF 2 réseaux, source extensible, hors money-path');
else { console.error('❌ Topologie VMC LOT12 : ' + ok + '/' + total); process.exit(1); }
