// =====================================================================
// tests/vmc-besoin-lot10.test.js — M57 LOT10 : socle de pré-étude VMC (besoin)
// =====================================================================
// besoinVmc(pieces, contexte) : couche PURE dérivant le BESOIN technique (fonctions par
// pièce) depuis obligationsVmc (règle) + piece.ventilationFonctions (choix) + contexte.
// Représente des FONCTIONS (SORTIE_AIR/ADMISSION_AIR/INSUFFLATION), jamais un produit
// tarifaire. Hors money-path : aucun code catalogue, aucun prix, aucune mutation.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet' }, extra || {});
// pièces de référence (en scope par défaut)
const P = (id, numero, vf) => ({ id: id, numero: numero, ventilationFonctions: vf });
const fnDe = (piece, key) => (piece.fonctions.find(f => f.fonction === key) || null);

// ---- 0. Export ------------------------------------------------------------------
A(typeof VMC.besoinVmc === 'function', 'besoinVmc exporté');

// ---- 1. Simple flux : extraction (service) + admission (principale) --------------
{
  const r = VMC.besoinVmc([P('sdb', 1), P('chambre', 1)], CTX({ solution: 'simple_flux' }));
  A(r.systeme === 'simple_flux' && r.indetermine === false, '1. systeme=simple_flux, non indéterminé');
  const sdb = r.pieces.find(p => p.pieceRef === 'sdb#1');
  const ch = r.pieces.find(p => p.pieceRef === 'chambre#1');
  A(sdb && fnDe(sdb, 'SORTIE_AIR') && fnDe(sdb, 'SORTIE_AIR').retenue === true, '1. sdb → SORTIE_AIR retenue');
  A(ch && fnDe(ch, 'ADMISSION_AIR') && fnDe(ch, 'ADMISSION_AIR').retenue === true, '1. chambre → ADMISSION_AIR retenue');
  A(!fnDe(ch, 'INSUFFLATION'), '1. SF : pas d\'insufflation en pièce principale');
}

// ---- 2. Hygro : même topologie que SF -------------------------------------------
{
  const r = VMC.besoinVmc([P('cuisine', 1), P('salon', 1)], CTX({ solution: 'hygro' }));
  A(fnDe(r.pieces.find(p => p.pieceRef === 'cuisine#1'), 'SORTIE_AIR'), '2. hygro : cuisine → SORTIE_AIR');
  A(fnDe(r.pieces.find(p => p.pieceRef === 'salon#1'), 'ADMISSION_AIR'), '2. hygro : salon → ADMISSION_AIR (pas insufflation)');
}

// ---- 3. Double flux : extraction + insufflation distinctes -----------------------
{
  const r = VMC.besoinVmc([P('sdb', 1), P('chambre', 1)], CTX({ solution: 'double_flux' }));
  A(fnDe(r.pieces.find(p => p.pieceRef === 'sdb#1'), 'SORTIE_AIR'), '3. DF : sdb → SORTIE_AIR (extraction)');
  const ch = r.pieces.find(p => p.pieceRef === 'chambre#1');
  A(fnDe(ch, 'INSUFFLATION') && fnDe(ch, 'INSUFFLATION').retenue === true, '3. DF : chambre → INSUFFLATION');
  A(!fnDe(ch, 'ADMISSION_AIR'), '3. DF : pas d\'ADMISSION_AIR en pièce principale');
}

// ---- 4. DF : aucune pseudo-bouche SF / aucun code tarifaire ----------------------
{
  const r = VMC.besoinVmc([P('sdb', 1), P('chambre', 1)], CTX({ solution: 'double_flux' }));
  const dump = JSON.stringify(r);
  A(!/VMC_BOUCHE|VMC_ENTREE_AIR|prix|prixTotal|VMC_CAISSON/.test(dump), '4. DF : aucun code catalogue / prix (fonction ≠ produit)');
  A(!/entree_air/.test(JSON.stringify(r.pieces.find(p => p.pieceRef === 'chambre#1').fonctions)), '4. DF principale : pas de fonction admission (entree_air)');
}

// ---- 5. Inconnue : jamais convertie en simple flux ------------------------------
{
  const r = VMC.besoinVmc([P('sdb', 1), P('chambre', 1)], CTX({ solution: 'inconnue' }));
  A(r.systeme === 'inconnue' && r.indetermine === true, '5. systeme reste inconnue, indéterminé');
  A(!/simple_flux|VMC simple flux/.test(JSON.stringify(r)), '5. inconnue → jamais « simple flux »');
  A(!fnDe(r.pieces.find(p => p.pieceRef === 'chambre#1'), 'INSUFFLATION'), '5. inconnue : pas d\'insufflation (système non décidé)');
}

// ---- 6. Pièce hors périmètre → aucun besoin -------------------------------------
{
  const horsScope = { id: 'sdb', numero: 2, enScope: false };
  const r = VMC.besoinVmc([P('sdb', 1), horsScope], CTX({ solution: 'simple_flux' }));
  A(r.pieces.some(p => p.pieceRef === 'sdb#1'), '6. pièce en scope → présente');
  A(!r.pieces.some(p => p.pieceRef === 'sdb#2'), '6. pièce hors périmètre (enScope=false) → exclue');
}

// ---- 7. Obligation conservée même si choix client faux --------------------------
{
  const r = VMC.besoinVmc([P('sdb', 1, { extraction: false })], CTX({ solution: 'simple_flux' }));
  const f = fnDe(r.pieces[0], 'SORTIE_AIR');
  A(f.retenue === true && f.statut === 'obligatoire', '7. choix false + obligatoire → retenue=true (non contournable)');
  A(f.provenance === 'regle', '7. provenance = regle (imposée)');
}

// ---- 9. a_verifier non imposée ---------------------------------------------------
{
  const r = VMC.besoinVmc([P('sdb', 1)], CTX({ solution: 'simple_flux', intention: 'conserver' }));
  const f = fnDe(r.pieces[0], 'SORTIE_AIR');
  A(f.statut === 'a_verifier' && f.retenue === false, '9. conserver → SORTIE_AIR a_verifier, non imposée');
}
// NB TEST 8 (recommandation refusée) : obligationsVmc (LOT7-A) n'émet aujourd'hui que
// obligatoire|a_verifier ; les branches recommande/libre de la réconciliation besoinVmc
// sont prêtes (même contrat que fonctionsVmcRetenues, couvert par le test LOT7-B) mais
// ne sont pas produites par les règles actuelles → non exerçables via besoinVmc ici.
A(VMC.besoinVmc([P('sdb', 1)], CTX({ solution: 'simple_flux' })).pieces[0].fonctions.every(f => ['obligatoire', 'a_verifier'].includes(f.statut)),
  '8. statuts réels actuels ∈ {obligatoire, a_verifier} (recommande/libre non émis par les règles)');

// ---- 10/11. Sans ventilationFonctions + aucune mutation piece.config ------------
{
  const piece = { id: 'sdb', numero: 1 }; // pas de ventilationFonctions, pas de config
  const snap = JSON.stringify(piece);
  const r = VMC.besoinVmc([piece], CTX({ solution: 'simple_flux' }));
  A(JSON.stringify(piece) === snap, '10/11. besoinVmc ne mute pas la pièce');
  A(!('config' in piece), '11. aucune création de piece.config');
  A(fnDe(r.pieces[0], 'SORTIE_AIR').retenue === true, '10. besoin dérivé des règles même sans ventilationFonctions');
}

// ---- 12. Aucun appel catalogue/prix/Runtime (statique) --------------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function besoinVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|PRIX\b|prixTotal|require\(|fetch\(/.test(BLOC), '12. besoinVmc : aucun prix / dimensionnement / Runtime');
A(!/piece\.config\s*=|config\.vmc\s*=|\.VMC_BOUCHE\s*=/.test(BLOC), '12. besoinVmc : aucune écriture piece.config');
A(!/document\.|window\.|globalThis\./.test(BLOC), '12. besoinVmc : aucun accès DOM/global');

// ---- 13. Idempotence / non-mutation des entrées ---------------------------------
{
  const pieces = [P('sdb', 1), P('chambre', 1)];
  const snap = JSON.stringify(pieces);
  const r1 = VMC.besoinVmc(pieces, CTX({ solution: 'double_flux' }));
  const r2 = VMC.besoinVmc(pieces, CTX({ solution: 'double_flux' }));
  A(JSON.stringify(r1) === JSON.stringify(r2), '13. déterministe : même entrée → même sortie');
  A(JSON.stringify(pieces) === snap, '13. entrées non mutées');
}

// ---- 14. Pièces sans rôle VMC ignorées (aucune invention) -----------------------
{
  const r = VMC.besoinVmc([P('entree', 1), P('terrasse', 1)], CTX({ solution: 'simple_flux' }));
  A(r.pieces.length === 0, '14. pièces sans rôle VMC → aucun besoin (ignorées)');
}

// ---- pieceRef : id#numero, ou id si numero absent -------------------------------
{
  A(VMC.besoinVmc([{ id: 'sdb', numero: 3 }], CTX({ solution: 'simple_flux' })).pieces[0].pieceRef === 'sdb#3', 'pieceRef = id#numero');
  A(VMC.besoinVmc([{ id: 'sdb' }], CTX({ solution: 'simple_flux' })).pieces[0].pieceRef === 'sdb', 'pieceRef = id si numero absent');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Besoin VMC (M57 LOT10) : ' + ok + '/' + total + ' — pré-étude pure, fonctions ≠ produit, hors money-path');
else { console.error('❌ Besoin VMC LOT10 : ' + ok + '/' + total); process.exit(1); }
