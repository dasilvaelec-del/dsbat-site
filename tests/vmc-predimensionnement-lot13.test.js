// =====================================================================
// tests/vmc-predimensionnement-lot13.test.js — M57 LOT13
// =====================================================================
// preDimensionnementVmc(pieces, contexte, besoin, debits, topologie) : couche PURE dérivée
// (LOT10/11/12). Débits de projet (= réglementaires par défaut) + débit théorique à couvrir
// par réseau. AUCUN diamètre/longueur/perte de charge/sélection produit. Hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, numero, dims, vf) => ({ id: id, numero: numero, dims: dims, ventilationFonctions: vf });
function etude(pieces, ctx) {
  const c = Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, ctx || {});
  const besoin = VMC.besoinVmc(pieces, c);
  const debits = VMC.debitsVmc(pieces, c, besoin);
  const topo = VMC.topologieVmc(pieces, c, besoin, debits);
  return VMC.preDimensionnementVmc(pieces, c, besoin, debits, topo);
}
const res = (r, type) => r.reseaux.find(x => x.type === type);

A(typeof VMC.preDimensionnementVmc === 'function', '0. preDimensionnementVmc exporté');

// ---- 1. SF plusieurs pièces : total extraction + projet=réglementaire ------------
{
  const r = etude([P('cuisine', 1), P('sdb', 1), P('wc', 1)], { solution: 'simple_flux' });
  const ext = res(r, 'extraction');
  A(ext.debitReglementaire === 120 + 30 + 15, '1. total extraction = 165');
  A(ext.debitProjet === ext.debitReglementaire, '1. debitProjet = debitReglementaire');
  A(ext.debitTheoriqueACouvrir === 165, '1. debitTheoriqueACouvrir = 165');
}

// ---- 2. SF : admission passive, aucun réseau insufflation -----------------------
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'simple_flux' });
  A(r.admissionAir && r.admissionAir.type === 'passive' && r.admissionAir.statut === 'a_equilibrer', '2. admission passive a_equilibrer');
  A(!res(r, 'insufflation'), '2. SF : aucun réseau insufflation');
  A(r.centrale.type === 'SF', '2. centrale SF');
}

// ---- 3. Hygro : même séparation, aucune modulation ------------------------------
{
  const r = etude([P('cuisine', 1), P('salon', 1)], { solution: 'hygro' });
  A(res(r, 'extraction') && r.admissionAir.type === 'passive' && !res(r, 'insufflation'), '3. hygro : extraction + admission passive, pas d\'insufflation');
  A(!/taux|renouvellement|modulation|humidit/i.test(JSON.stringify(r)), '3. hygro : aucune modulation/taux automatique');
}

// ---- 4. DF : 2 réseaux, insufflation cible=extraction (hypothèse), pas de répartition
{
  const r = etude([P('sdb', 1), P('chambre', 1)], { solution: 'double_flux' });
  const ext = res(r, 'extraction'), ins = res(r, 'insufflation');
  A(ext && ins, '4. DF : réseaux extraction + insufflation distincts');
  A(ext.debitReglementaire === 30, '4. DF : extraction reprise (sdb 4p = 30)');
  A(ins.debitProjet === ext.debitProjet, '4. DF : insufflation cible globale = extraction');
  A(ins.debitReglementaire === null, '4. DF : pas de débit réglementaire d\'insufflation');
  A(ins.points.every(p => p.debitProjet == null && p.debitReglementaire == null), '4. DF : aucune répartition individuelle inventée');
  A(r.hypotheses.some(h => h.clef === 'equilibrage_df' && h.origine === 'regle_pro'), '4. DF : hypothèse d\'équilibrage explicite (regle_pro, pas obligation)');
  A(!/obligation r|obligatoire/i.test(JSON.stringify(r.hypotheses)), '4. DF : équilibrage jamais présenté comme obligation réglementaire');
}

// ---- 5. DF : centrale DF, débit à couvrir, aucune sélection produit --------------
{
  const r = etude([P('cuisine', 1), P('sdb', 1), P('chambre', 1)], { solution: 'double_flux' });
  A(r.centrale.type === 'DF', '5. centrale DF');
  A(r.centrale.debitTheoriqueACouvrir === (120 + 30), '5. debitTheoriqueACouvrir = max(extraction, insufflation) = 150');
  A(!/marque|modele|puissance|rendement|reference|VMC_CAISSON|caisson compatible|F7|G4/i.test(JSON.stringify(r)), '5. aucune sélection/caractéristique produit');
}

// ---- 6. Solution inconnue : aucune conversion ------------------------------------
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'inconnue' });
  A(r.systeme === 'inconnue' && r.indetermine === true && r.statut === 'indetermine', '6. inconnue → indéterminé');
  A(r.centrale === null && !res(r, 'insufflation'), '6. inconnue → aucune centrale/insufflation inventée');
}

// ---- 7. Volume dérivé de dims, aucun impact sur les débits -----------------------
{
  const r = etude([P('cuisine', 1, { l: 3, la: 4, h: 2.5 }), P('sdb', 1, { l: 2, la: 2, h: 2.5 })], { solution: 'simple_flux' });
  A(r.volumes.parPiece['cuisine#1'] === 30 && r.volumes.parPiece['sdb#1'] === 10, '7. volume par pièce dérivé (30, 10)');
  A(r.volumes.total === 40, '7. volumeTotal = 40');
  A(res(r, 'extraction').debitReglementaire === 120 + 30, '7. débits réglementaires inchangés par le volume');
  // dimension manquante → volume null + donnée manquante, pas d'invention
  const r2 = etude([P('cuisine', 1, { l: 3, la: 4 /* h manquant */ })], { solution: 'simple_flux' });
  A(r2.volumes.parPiece['cuisine#1'] === null && r2.donneesManquantes.some(d => /dimensions_piece/.test(d.champ)), '7. dimension manquante → volume null + signalé');
}

// ---- 8. Données manquantes : longueurs/réseau détectés, aucune valeur inventée ---
{
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux' });
  const champs = r.donneesManquantes.map(d => d.champ);
  A(champs.includes('longueurs_reseau') && champs.includes('diametres_sections') && champs.includes('donnees_pertes_de_charge'), '8. longueurs/diamètres/pertes de charge signalés manquants');
  A(!/(^|[^a-z])(\d+)\s*(m|ml|mm)\b/i.test(JSON.stringify(r.reseaux)), '8. aucune longueur/diamètre chiffré inventé');
}

// ---- 9. Source air neuf (DF) : valeurs + prudence -------------------------------
{
  ['direct', 'puits_horizontal', 'puits_vertical'].forEach(t =>
    A(etude([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: t }).sourceAirNeuf.type === t, '9. sourceAirNeuf ' + t));
  A(etude([P('chambre', 1)], { solution: 'double_flux' }).sourceAirNeuf.type === 'inconnu', '9. sourceAirNeuf défaut = inconnu');
  A(etude([P('chambre', 1)], { solution: 'double_flux', sourceAirNeuf: 'xxx' }).sourceAirNeuf.type === 'inconnu', '9. valeur non reconnue → inconnu (prudent)');
}

// ---- 10. Non-mutation des entrées ------------------------------------------------
{
  const pieces = [P('cuisine', 1, { l: 3, la: 4, h: 2.5 }), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'double_flux', nbPiecesPrincipales: 4 };
  const besoin = VMC.besoinVmc(pieces, c), debits = VMC.debitsVmc(pieces, c, besoin), topo = VMC.topologieVmc(pieces, c, besoin, debits);
  const snap = JSON.stringify({ pieces, c, besoin, debits, topo });
  VMC.preDimensionnementVmc(pieces, c, besoin, debits, topo);
  A(JSON.stringify({ pieces, c, besoin, debits, topo }) === snap, '10. entrées non mutées');
  A(!('config' in pieces[0]), '10. aucune création de piece.config');
}

// ---- 11/13. Anti-régression money-path + anti-dérive (statique) ------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function preDimensionnementVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|prixTotal|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '11. aucun prix/Runtime/DOM/global');
A(!/piece\.config\s*=|config\.vmc\s*=|VMC_BOUCHE|VMC_ENTREE_AIR|VMC_CAISSON/.test(BLOC), '11. aucun code catalogue / écriture config');
// 13. Anti-dérive : aucun diamètre/section/vitesse/pression CALCULÉ dans la sortie de calcul
// (les mêmes termes peuvent apparaître comme LIBELLÉS de données manquantes — comportement voulu).
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'double_flux' });
  const calc = JSON.stringify({ reseaux: r.reseaux, centrale: r.centrale, admissionAir: r.admissionAir });
  A(!/diametre|section|vitesse|perte.?de.?charge|pression/i.test(calc), '13. aucun diamètre/section/vitesse/perte de charge/pression dans la sortie de calcul');
  A(r.donneesManquantes.some(d => d.champ === 'diametres_sections') && r.donneesManquantes.some(d => d.champ === 'donnees_pertes_de_charge'), '13bis. diamètres/pertes de charge correctement signalés comme MANQUANTS');
}

// ---- 12. Déterminisme ------------------------------------------------------------
{
  const pieces = [P('cuisine', 1), P('sdb', 1), P('chambre', 1)];
  const c = { intention: 'creer', perimetre: 'complet', solution: 'double_flux', nbPiecesPrincipales: 4 };
  const b = VMC.besoinVmc(pieces, c), d = VMC.debitsVmc(pieces, c, b), t = VMC.topologieVmc(pieces, c, b, d);
  A(JSON.stringify(VMC.preDimensionnementVmc(pieces, c, b, d, t)) === JSON.stringify(VMC.preDimensionnementVmc(pieces, c, b, d, t)), '12. déterministe');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Pré-dimensionnement VMC (M57 LOT13) : ' + ok + '/' + total + ' — théorique, débit à couvrir, DF hypothèse d\'équilibrage, hors money-path');
else { console.error('❌ Pré-dimensionnement VMC LOT13 : ' + ok + '/' + total); process.exit(1); }
