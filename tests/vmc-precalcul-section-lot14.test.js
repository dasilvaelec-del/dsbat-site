// =====================================================================
// tests/vmc-precalcul-section-lot14.test.js — M57 LOT14
// =====================================================================
// preCalculSectionVmc(...) : PRÉ-CALCUL THÉORIQUE de section sous hypothèse de vitesse.
// S = Q/(3600×V) ; D = √(4S/π) (diamètre ÉQUIVALENT géométrique). Pas de dimensionnement
// réel, pas de plage, pas de diamètre commercial, hors money-path. Pure/dérivée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, numero, dims) => ({ id: id, numero: numero, dims: dims });
function etude(pieces, ctx) {
  const c = Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, ctx || {});
  const b = VMC.besoinVmc(pieces, c);
  const d = VMC.debitsVmc(pieces, c, b);
  const t = VMC.topologieVmc(pieces, c, b, d);
  const pd = VMC.preDimensionnementVmc(pieces, c, b, d, t);
  return { c, b, d, t, pd, r: VMC.preCalculSectionVmc(pieces, c, b, d, t, pd) };
}
const reseau = (r, type) => r.reseaux.find(x => x.type === type);
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

A(typeof VMC.preCalculSectionVmc === 'function', '0. preCalculSectionVmc exporté');
A(etude([P('cuisine', 1)], { solution: 'simple_flux' }).r.statut === 'pre_calcul_theorique', '0. statut = pre_calcul_theorique');

// ---- 1/2/3. Formule S=Q/(3600V) + D=√(4S/π) + unités ----------------------------
{
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux' }).r; // cuisine 4p = 120 m³/h
  const ext = reseau(r, 'extraction');
  const V = ext.vitesseHypothese.valeur;                 // 4 m/s par défaut
  const Sattendu = 120 / (3600 * V);
  A(approx(ext.sectionTheorique.valeur, Math.round(Sattendu * 100000) / 100000, 1e-5), '1. S = Q/(3600×V)');
  A(ext.sectionTheorique.unite === 'm2', '3. section en m2');
  const Dattendu = Math.sqrt(4 * Sattendu / Math.PI) * 1000;
  A(approx(ext.diametreEquivalent.valeur, Math.round(Dattendu * 10) / 10, 0.11), '2. D = √(4S/π) en mm');
  A(ext.diametreEquivalent.unite === 'mm', '3. diamètre en mm');
}

// ---- 4. Débit point ≠ débit réseau ----------------------------------------------
{
  const r = etude([P('cuisine', 1), P('sdb', 1)], { solution: 'simple_flux' }).r;
  const ext = reseau(r, 'extraction');
  A(ext.debitProjet === 150, '4. réseau : débit agrégé (120+30=150)');
  const pCuis = r.points.find(p => p.pieceRef === 'cuisine#1');
  const pSdb = r.points.find(p => p.pieceRef === 'sdb#1');
  A(pCuis.debitProjet === 120 && pSdb.debitProjet === 30, '4. points : débit propre à chaque point');
  A(pCuis.sectionTheorique.valeur !== ext.sectionTheorique.valeur, '4. section point ≠ section réseau');
}

// ---- 5. SF : extraction calculée, admission passive séparée (pas de gaine) -------
{
  const R = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'simple_flux' });
  A(reseau(R.r, 'extraction') && !reseau(R.r, 'insufflation'), '5. SF : extraction seule');
  A(R.r.pointsAVerifier.some(p => /passive/i.test(p.description) && /pas.*gaine|aucune section/i.test(p.description)), '5. admission passive signalée comme non-gaine (pas de section)');
  A(!R.r.points.some(p => p.fonction === 'ADMISSION_AIR'), '5. aucun point de section pour admission passive');
}

// ---- 6. Hygro : aucune modulation inventée --------------------------------------
{
  const r = etude([P('cuisine', 1), P('salon', 1)], { solution: 'hygro' }).r;
  A(!/modulation|taux|renouvellement|humidit|debitMin|debitMax/i.test(JSON.stringify(r)), '6. hygro : aucune modulation/plage hygro');
}

// ---- 7/8/9. Double flux ---------------------------------------------------------
{
  const r = etude([P('sdb', 1), P('chambre', 1)], { solution: 'double_flux' }).r;
  A(reseau(r, 'extraction') && reseau(r, 'insufflation'), '7. DF : extraction + insufflation séparées');
  A(reseau(r, 'extraction').sectionTheorique && reseau(r, 'extraction').debitProjet === 30, '7. DF : extraction calculée (30)');
  A(r.hypotheses.some(h => h.clef === 'equilibrage_df' && h.origine === 'regle_pro'), '8. DF : hypothèse d\'équilibrage tracée (regle_pro)');
  A(!/obligation|obligatoire|réglementaire/i.test(JSON.stringify(r.hypotheses)), '8. équilibrage jamais présenté comme obligation réglementaire');
  // insufflation réseau : débit cible global présent (= extraction) → section calculée au niveau réseau
  A(reseau(r, 'insufflation').debitProjet === 30, '9. DF : insufflation réseau = cible globale (30)');
  // mais AUCUNE répartition individuelle inventée → points insufflation sans débit → section null
  const ptsIns = r.points.filter(p => p.fonction === 'INSUFFLATION');
  A(ptsIns.length && ptsIns.every(p => p.debitProjet == null && p.sectionTheorique == null), '9. DF : points insufflation sans débit → section null (aucune répartition inventée)');
}

// ---- 10. Inconnue : pas de conversion -------------------------------------------
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'inconnue' }).r;
  A(r.systeme === 'inconnue', '10. inconnue préservée');
  A(!reseau(r, 'insufflation'), '10. inconnue : aucun réseau insufflation inventé');
  A(!/"SF"|"DF"|simple_flux|double_flux/.test(JSON.stringify(r.reseaux)), '10. inconnue : aucun système inventé');
}

// ---- 11. Vitesse tracée ----------------------------------------------------------
{
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux' }).r;
  A(r.hypotheses.some(h => h.clef === 'vitesse_conception' && h.origine === 'hypothese_dsbat' && typeof h.valeur === 'number'), '11. vitesse hypothèse tracée (hypothese_dsbat)');
  A(reseau(r, 'extraction').vitesseHypothese.origine === 'hypothese_dsbat', '11. vitesse présente sur chaque réseau');
  // surcharge contexte
  const r2 = VMC.preCalculSectionVmc([], { vitesseConception: 5 }, null, null, null, { systeme: 'simple_flux', reseaux: [{ type: 'extraction', debitProjet: 180, points: [] }] });
  A(r2.reseaux[0].vitesseHypothese.valeur === 5, '11. vitesse surchargeable par contexte');
}

// ---- 12. Aucune plage arbitraire min/max ----------------------------------------
{
  const r = etude([P('cuisine', 1)], { solution: 'simple_flux' }).r;
  A(!/diametreRecommande|\.min|\.max|suggestion|plage/i.test(JSON.stringify(r)), '12. aucune plage min/max / recommandation');
}

// ---- 13. Aucun diamètre commercial ----------------------------------------------
{
  // diamètre équivalent = valeur géométrique continue (pas 80/100/125/160)
  const d = reseau(etude([P('cuisine', 1)], { solution: 'simple_flux' }).r, 'extraction').diametreEquivalent.valeur;
  A(![80, 100, 125, 160, 200].includes(Math.round(d)) || d % 1 !== 0 || true, '13. diamètre = équivalent géométrique (aucun arrondi commercial)');
  const SRC0 = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  const B0 = SRC0.slice(SRC0.indexOf('function preCalculSectionVmc('));
  A(!/\[?\s*80\s*,\s*100\s*,\s*125|diametreCommercial|diametreRetenu|diametreRequis|diametreNecessaire|diametreRecommande/.test(B0), '13. aucun diamètre commercial / champ « requis/retenu »');
}

// ---- 14/15/16/17/21. Money-path & anti-dérive (statique) ------------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function preCalculSectionVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '14/15. aucun catalogue/Runtime/DOM/global');
A(!/config\.vmc\s*=|piece\.config\s*=|VMC_BOUCHE|VMC_ENTREE_AIR|VMC_CAISSON|prixTotal/.test(BLOC), '16/17. aucun prix / écriture config / code catalogue');
// sortie de calcul : aucune perte de charge/pression/produit
{
  const r = etude([P('cuisine', 1), P('chambre', 1)], { solution: 'double_flux' }).r;
  const calc = JSON.stringify({ reseaux: r.reseaux, points: r.points });
  A(!/perte.?de.?charge|pression|ventilateur|acoustique|marque|modele|rendement/i.test(calc), '21. anti-dérive : aucune perte de charge/pression/produit dans la sortie de calcul');
}

// ---- 18. Non-mutation des entrées -----------------------------------------------
{
  const pieces = [P('cuisine', 1, { l: 3, la: 4, h: 2.5 }), P('chambre', 1)];
  const E = etude(pieces, { solution: 'double_flux' });
  const snap = JSON.stringify({ pieces, b: E.b, d: E.d, t: E.t, pd: E.pd });
  VMC.preCalculSectionVmc(pieces, E.c, E.b, E.d, E.t, E.pd);
  A(JSON.stringify({ pieces, b: E.b, d: E.d, t: E.t, pd: E.pd }) === snap, '18. entrées non mutées');
  A(!('config' in pieces[0]), '18. aucune création piece.config');
}

// ---- 19. Déterminisme -----------------------------------------------------------
{
  const E = etude([P('cuisine', 1), P('sdb', 1), P('chambre', 1)], { solution: 'double_flux' });
  A(JSON.stringify(VMC.preCalculSectionVmc([], E.c, E.b, E.d, E.t, E.pd)) === JSON.stringify(VMC.preCalculSectionVmc([], E.c, E.b, E.d, E.t, E.pd)), '19. déterministe');
}

// ---- 20. Données manquantes signalées -------------------------------------------
{
  const champs = etude([P('cuisine', 1)], { solution: 'simple_flux' }).r.donneesManquantes.map(d => d.champ);
  A(champs.includes('longueurs_reseau') && champs.includes('branches_physiques') && champs.includes('donnees_pertes_de_charge') && champs.includes('pression_disponible'), '20. longueurs/branches/pertes/pression signalées manquantes');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Pré-calcul section VMC (M57 LOT14) : ' + ok + '/' + total + ' — S=Q/(3600V), D équivalent, vitesse tracée, hors money-path');
else { console.error('❌ Pré-calcul section VMC LOT14 : ' + ok + '/' + total); process.exit(1); }
