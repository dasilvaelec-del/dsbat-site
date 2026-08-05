// =====================================================================
// js/moteur-revetements.js — Revêtements (sol souple/carrelé + faïence) — MIGRATION 016
// =====================================================================
// Déplacé VERBATIM depuis devis-configurateur.html (bloc « const _r2 … appliquerRevetements »).
// AUCUNE logique, quantité, surface, règle ou prix modifiés — simple déplacement de code.
// Fonctions PURES : aucun accès au DOM, aucun affichage.
// Dépendance résolue à l'APPEL : metiersActifs (global). Chargé comme <script src> (script
// classique) : les symboles restent globaux et accessibles depuis le script inline du HTML.
// =====================================================================

const _r2 = v => Math.round((v || 0) * 100) / 100;

const SOL_MATERIAUX = [
  { val:'carrelage',       label:'Carrelage (fourniture + pose)',      kind:'carrelage', code:'CAR_POSE_SOL' },
  { val:'carrelage_grand', label:'Carrelage grand format',             kind:'carrelage', code:'CAR_POSE_SOL_GRAND' },
  { val:'parq_flot',       label:'Parquet flottant (pose seule)',      kind:'souple' },
  { val:'stratifie',       label:'Sol stratifié (fourniture + pose)',  kind:'souple' },
  { val:'pvc',             label:'Sol PVC (fourniture + pose)',         kind:'souple' },
  { val:'moquette',        label:'Moquette (fourniture + pose)',        kind:'souple' },
  { val:'lino',            label:'Linoléum (fourniture + pose)',        kind:'souple' },
];
function solMateriauxDispo() {
  // Le carrelage n'est proposé que si le métier carrelage est actif.
  return SOL_MATERIAUX.filter(m => m.kind !== 'carrelage' || metiersActifs.includes('carrelage'));
}
function deriveSolMateriau(piece) {
  if (piece.solMateriau !== undefined && piece.solMateriau !== null) return piece.solMateriau;
  const carr = (piece.config && piece.config.carrelage) || {};
  if (carr.CAR_POSE_SOL_GRAND > 0) return 'carrelage_grand';
  if (carr.CAR_POSE_SOL > 0) return 'carrelage';
  return piece.solType || '';
}

// --- Faïence : dimensionnement automatique par type de pièce (hauteur ajustable) ---
const FAIENCE_PARAMS = {
  hauteurDefaut: { zone: 2.1, soubassement: 1.2, credence: 0.6 }, // m ; 'murs' = pleine hauteur (s.murs)
  zoneLongueur: 3.0 // ml : alcôve douche/bain 1,2 m + 2 retours 0,9 m
};
function faienceModeDefaut(id) {
  if (id === 'sdb' || id === 'sde') return 'zone';
  if (id === 'wc') return 'soubassement';
  if (id === 'cuisine') return 'credence';
  return 'non';
}
function faienceModesDispo(id) {
  const lbl = { zone:'Zone douche / bain (toute hauteur)', soubassement:'Soubassement', credence:'Crédence', murs:'Murs entiers', non:'Aucune faïence' };
  let modes;
  if (id === 'sdb' || id === 'sde') modes = ['zone','murs','non'];
  else if (id === 'wc') modes = ['soubassement','murs','non'];
  else if (id === 'cuisine') modes = ['credence','murs','non'];
  else modes = ['non','murs'];
  return modes.map(m => ({ val:m, label:lbl[m] }));
}
function faienceLongueur(piece, mode) {
  const d = piece.dims || {}; const l = d.l || 0, la = d.la || 0, por = d.portes || 0;
  if (mode === 'zone') return FAIENCE_PARAMS.zoneLongueur;
  if (mode === 'soubassement') return Math.max(0, 2 * (l + la) - 0.8 * por);
  if (mode === 'credence') return Math.max(l, la);
  return 0;
}
function faienceSurfaceBase(piece, mode, hauteur, surfMurs) {
  if (!mode || mode === 'non') return 0;
  if (mode === 'murs') return _r2(surfMurs || 0);
  const h = (hauteur != null && !isNaN(hauteur)) ? hauteur : (FAIENCE_PARAMS.hauteurDefaut[mode] || 1);
  return _r2(faienceLongueur(piece, mode) * h);
}
function deriveFaience(piece) {
  if (piece.faienceMode !== undefined && piece.faienceMode !== null) return;
  const carr = (piece.config && piece.config.carrelage) || {};
  if (carr.CAR_POSE_MUR > 0 || carr.CAR_POSE_MUR_PETIT > 0) {
    piece.faienceMode = 'murs';
    piece.faienceSurface = carr.CAR_POSE_MUR_PETIT > 0 ? carr.CAR_POSE_MUR_PETIT : carr.CAR_POSE_MUR;
    if (carr.CAR_POSE_MUR_PETIT > 0) piece.faienceFormat = 'mosaique';
  } else {
    piece.faienceMode = faienceModeDefaut(piece.id);
  }
}

// Alimente piece.solType + piece.config.carrelage à partir des choix de revêtement
// et des SURFACES déjà calculées. N'écrit QUE les codes de pose gérés ici ; les
// compléments ajoutés via les oublis (fourniture, colle, plinthes…) restent intacts.
function appliquerRevetements(piece, surfaces) {
  surfaces = surfaces || { sol:0, murs:0, plafond:0 };
  if (!piece.config.carrelage) piece.config.carrelage = {};
  const carr = piece.config.carrelage;

  // --- SOL ---
  const mat = deriveSolMateriau(piece); piece.solMateriau = mat;
  const def = SOL_MATERIAUX.find(m => m.val === mat);
  delete carr.CAR_POSE_SOL; delete carr.CAR_POSE_SOL_GRAND;
  if (def && def.kind === 'souple') { piece.solType = mat; }
  else if (def && def.kind === 'carrelage' && metiersActifs.includes('carrelage')) { piece.solType = ''; if (surfaces.sol > 0) carr[def.code] = _r2(surfaces.sol); }
  else { piece.solType = ''; }

  // --- FAÏENCE (mural) ---
  if (metiersActifs.includes('carrelage')) {
    deriveFaience(piece);
    const mode = piece.faienceMode;
    delete carr.CAR_POSE_MUR; delete carr.CAR_POSE_MUR_PETIT;
    if (mode && mode !== 'non') {
      const h = piece.faienceHauteur != null ? piece.faienceHauteur : FAIENCE_PARAMS.hauteurDefaut[mode];
      const base = faienceSurfaceBase(piece, mode, h, surfaces.murs);
      const ovr = piece.faienceSurface;
      const surf = (ovr != null && ovr !== '' && !isNaN(ovr)) ? Number(ovr) : base;
      const code = piece.faienceFormat === 'mosaique' ? 'CAR_POSE_MUR_PETIT' : 'CAR_POSE_MUR';
      if (surf > 0) carr[code] = _r2(surf);
    }
  }
  // Nettoyage : ne pas laisser un objet carrelage vide polluer le modèle
  if (Object.keys(carr).length === 0) delete piece.config.carrelage;
}

// Export Node (tests) + exposition navigateur (globaux déjà disponibles pour les scripts classiques).
if (typeof module !== 'undefined' && module.exports) module.exports = {
  _r2, SOL_MATERIAUX, solMateriauxDispo, deriveSolMateriau, FAIENCE_PARAMS,
  faienceModeDefaut, faienceModesDispo, faienceLongueur, faienceSurfaceBase, deriveFaience, appliquerRevetements
};
