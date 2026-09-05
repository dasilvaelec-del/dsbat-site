// =====================================================================
// tests/vmc-obligations-lot7a.test.js — M57 LOT7-A : socle des règles VMC
// =====================================================================
// Verrouille obligationsVmc(pieceId, contexte) : fonction PURE (modèle normeMin),
// détermine les FONCTIONS d'aération obligatoires (SORTIE_AIR / ADMISSION_AIR /
// INSUFFLATION) SANS décider de prestation ni de prix (hors money-path).
//   statut ∈ obligatoire | recommande | a_verifier | libre
//   origine ∈ reglementaire | fonctionnel | dsbat
// Anti-durcissement : « du neuf » seulement si reprise (creer|remplacer) + périmètre
// déterminé + pièce en scope ; sinon a_verifier. « conserver » ≠ conforme.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0, skip = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Contextes de référence — clés NEUTRES (découplées des champs chantier) :
//   intention ← chantier.intentionVentilation · solution ← chantier.solutionVentilation
//   perimetre ← perimetreTravaux/modeChantier · pieceEnScope calculé par le caller (LOT7-B).
const SCOPE_CREER = { intention: 'creer', perimetre: 'complet', pieceEnScope: true };
const applicable = (extra) => Object.assign({}, SCOPE_CREER, extra || {});

// ---- 0. Export + type ------------------------------------------------
A(typeof VMC.obligationsVmc === 'function', 'obligationsVmc exporté (fonction)');

// ---- 1. Pureté / déterminisme ---------------------------------------
{
  const ctx = applicable();
  const r1 = VMC.obligationsVmc('sdb', ctx);
  const r2 = VMC.obligationsVmc('sdb', ctx);
  A(eq(r1, r2), 'pureté : même entrée → même sortie');
  const snap = JSON.stringify(ctx);
  VMC.obligationsVmc('sdb', ctx);
  A(JSON.stringify(ctx) === snap, 'pureté : le contexte n\'est pas muté');
}

// ---- 2. Pièce principale applicable → ADMISSION_AIR obligatoire ------
['salon', 'salle_manger', 'chambre', 'bureau'].forEach(id => {
  const r = VMC.obligationsVmc(id, applicable());
  A(r.ADMISSION_AIR && r.ADMISSION_AIR.statut === 'obligatoire' && r.ADMISSION_AIR.origine === 'reglementaire',
    id + ' (principale, applicable) → ADMISSION_AIR obligatoire/reglementaire');
  A(!r.SORTIE_AIR && !r.INSUFFLATION, id + ' : pas de SORTIE_AIR ni INSUFFLATION (hors double flux)');
});

// ---- 3. Pièce de service applicable → SORTIE_AIR obligatoire ---------
['sdb', 'sde', 'wc', 'cuisine', 'cave'].forEach(id => {
  const r = VMC.obligationsVmc(id, applicable());
  A(r.SORTIE_AIR && r.SORTIE_AIR.statut === 'obligatoire' && r.SORTIE_AIR.origine === 'reglementaire',
    id + ' (service, applicable) → SORTIE_AIR obligatoire/reglementaire');
  A(!r.ADMISSION_AIR && !r.INSUFFLATION, id + ' : pas d\'ADMISSION_AIR ni INSUFFLATION');
});

// ---- 4. Conservation → jamais le minimum du neuf → a_verifier --------
{
  const r = VMC.obligationsVmc('sdb', applicable({ intention: 'conserver' }));
  A(r.SORTIE_AIR && r.SORTIE_AIR.statut === 'a_verifier', 'conserver → SORTIE_AIR a_verifier (jamais obligatoire)');
  const rp = VMC.obligationsVmc('chambre', applicable({ intention: 'conserver' }));
  A(rp.ADMISSION_AIR && rp.ADMISSION_AIR.statut === 'a_verifier', 'conserver → ADMISSION_AIR a_verifier');
}
// intention inconnu → a_verifier également
A(VMC.obligationsVmc('sdb', applicable({ intention: 'inconnu' })).SORTIE_AIR.statut === 'a_verifier',
  'inconnu → a_verifier');

// ---- 5. Partiel / hors scope : pas d'obligation silencieuse ----------
{
  // pièce NON en scope (pieceEnScope false) même en remplacer → a_verifier
  const r = VMC.obligationsVmc('sdb', { intention: 'remplacer', perimetre: 'partiel', pieceEnScope: false });
  A(r.SORTIE_AIR.statut === 'a_verifier', 'remplacer + partiel + hors scope → a_verifier (pas d\'obligation silencieuse)');
  // pièce EN scope en partiel + remplacer → obligatoire (scope réel)
  const r2 = VMC.obligationsVmc('sdb', { intention: 'remplacer', perimetre: 'partiel', pieceEnScope: true });
  A(r2.SORTIE_AIR.statut === 'obligatoire', 'remplacer + partiel + en scope → obligatoire (pièce réellement concernée)');
  // périmètre indécis → a_verifier même en scope
  const r3 = VMC.obligationsVmc('sdb', { intention: 'creer', perimetre: 'indecis', pieceEnScope: true });
  A(r3.SORTIE_AIR.statut === 'a_verifier', 'périmètre indécis → a_verifier');
  // pieceEnScope non fourni → prudent : a_verifier
  A(VMC.obligationsVmc('sdb', { intention: 'creer', perimetre: 'complet' }).SORTIE_AIR.statut === 'a_verifier',
    'pieceEnScope absent → a_verifier (défaut prudent)');
}

// ---- 6. Double flux + pièce principale → INSUFFLATION obligatoire ----
{
  const r = VMC.obligationsVmc('chambre', applicable({ solution: 'double_flux' }));
  A(r.INSUFFLATION && r.INSUFFLATION.statut === 'obligatoire' && r.INSUFFLATION.origine === 'fonctionnel',
    'double_flux + principale → INSUFFLATION obligatoire/fonctionnel');
  A(!r.ADMISSION_AIR, 'double_flux + principale → PAS d\'ADMISSION_AIR (air par insufflation)');
}

// ---- 7. Double flux + pièce de service → SORTIE_AIR obligatoire ------
{
  const r = VMC.obligationsVmc('cuisine', applicable({ solution: 'double_flux' }));
  A(r.SORTIE_AIR && r.SORTIE_AIR.statut === 'obligatoire', 'double_flux + service → SORTIE_AIR obligatoire');
  A(!r.INSUFFLATION, 'double_flux + service → pas d\'INSUFFLATION');
}

// ---- 8. Aucune inférence tarifaire : sortie = fonctions, pas de codes -
{
  const r = VMC.obligationsVmc('sdb', applicable());
  const clefs = Object.keys(r).concat(Object.keys(r.SORTIE_AIR || {}));
  A(!/VMC_BOUCHE|VMC_ENTREE_AIR|prix|prixTotal|code/i.test(JSON.stringify(r)), 'sortie sans code catalogue ni prix (règle ≠ prestation)');
  A(r.SORTIE_AIR && Object.keys(r.SORTIE_AIR).sort().join(',') === 'origine,statut', 'attributs limités à { statut, origine }');
  ['confiance', 'statutGlobal', 'conformiteConnue', 'versionReglementaire', 'preuve', 'historique', 'validation'].forEach(k =>
    A(JSON.stringify(r).indexOf(k) === -1, 'pas de sur-modélisation « ' + k + ' »'));
}

// ---- 9. Pièces sans rôle VMC → aucune fonction -----------------------
['entree', 'terrasse', 'jardin', 'facade'].forEach(id =>
  A(eq(VMC.obligationsVmc(id, applicable()), {}), id + ' (sans rôle VMC) → {} (aucune obligation)'));

// ---- 10. Gate métier optionnel ---------------------------------------
A(eq(VMC.obligationsVmc('sdb', applicable({ metiersActifs: ['electricite'] })), {}), 'metiersActifs sans vmc → {} (gate métier)');
A(VMC.obligationsVmc('sdb', applicable({ metiersActifs: ['vmc', 'electricite'] })).SORTIE_AIR.statut === 'obligatoire', 'metiersActifs avec vmc → règle appliquée');

// ---- 11. LOT7-A ne touche pas le money-path (statique) ----------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
A(!/piece\.config|config\.vmc|VMC_BOUCHE\s*=|VMC_ENTREE_AIR\s*=/.test(SRC.slice(SRC.indexOf('function obligationsVmc'))),
  'obligationsVmc n\'écrit jamais dans piece.config / codes tarifaires');
A(!/getMoyenPrixFor|dimensionnementVMC|prixTotal/.test(SRC.slice(SRC.indexOf('function obligationsVmc'))),
  'obligationsVmc ne référence aucun prix / dimensionnement');
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
A(!/obligationsVmc/.test(MOTEUR), 'moteur-devis n\'appelle PAS obligationsVmc (aucun impact calcul)');

const total = ok + ko;
if (ko === 0) console.log('✅ Obligations VMC (M57 LOT7-A) : ' + ok + '/' + total + (skip ? ' · ' + skip + ' SKIP' : '') + ' — règle fonctionnelle pure, hors money-path');
else { console.error('❌ Obligations VMC LOT7-A : ' + ok + '/' + total); process.exit(1); }
