// =====================================================================
// js/moteur-revetements.js — Revêtements (sol souple/carrelé + faïence) — MIGRATION 016
// =====================================================================
// Déplacé VERBATIM depuis devis-configurateur.html (bloc « const _r2 … appliquerRevetements »).
// AUCUNE logique, quantité, surface, règle ou prix modifiés — simple déplacement de code.
// Fonctions PURES : aucun accès au DOM, aucun affichage.
// A05 (Phase 2) : `metiers` est désormais un PARAMÈTRE de solMateriauxDispo() et
// appliquerRevetements(), avec repli sur la globale `metiersActifs` (compat navigateur).
// Le module peut ainsi s'exécuter SANS état global si l'appelant fournit `metiers`.
// Chargé comme <script src> (script classique) : les symboles restent globaux.
// =====================================================================

const _r2 = v => Math.round((v || 0) * 100) / 100;

const SOL_MATERIAUX = [
  { val:'carrelage',       label:'Carrelage — fourniture + pose',       kind:'carrelage', code:'CAR_POSE_SOL' },
  { val:'carrelage_grand', label:'Carrelage grand format — fourniture + pose', kind:'carrelage', code:'CAR_POSE_SOL_GRAND' },
  { val:'parq_flot',       label:'Parquet flottant (pose seule)',      kind:'souple' },
  { val:'stratifie',       label:'Sol stratifié (fourniture + pose)',  kind:'souple' },
  { val:'pvc',             label:'Sol PVC (fourniture + pose)',         kind:'souple' },
  { val:'moquette',        label:'Moquette (fourniture + pose)',        kind:'souple' },
  { val:'lino',            label:'Linoléum (fourniture + pose)',        kind:'souple' },
];
function solMateriauxDispo(metiers) {
  // A05 : metiers reçu en paramètre ; repli sur la globale metiersActifs (compat navigateur).
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  // Le carrelage n'est proposé que si le métier carrelage est actif.
  return SOL_MATERIAUX.filter(m => m.kind !== 'carrelage' || metiers.includes('carrelage'));
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

// LOT38 : coefficient de pertes fourniture par pose (repli si CARRELAGE_PARAMS absent).
function _pertePose(code) {
  var dflt = { CAR_POSE_SOL: 0.10, CAR_POSE_SOL_GRAND: 0.12, CAR_POSE_MUR: 0.10, CAR_POSE_MUR_PETIT: 0.15 };
  if (typeof CARRELAGE_PARAMS === 'undefined') return dflt[code] || 0.10;
  var type = CARRELAGE_PARAMS.perteParPose[code];
  var pv = CARRELAGE_PARAMS.pertes[type];
  return (pv === undefined) ? (dflt[code] || 0.10) : pv;
}
// LOT38 : revêtement effectif d'une pièce (pour détecter un logement mono-revêtement).
function revetementEffectif(piece) {
  var c = (piece && piece.config && piece.config.carrelage) || {};
  if ((c.CAR_POSE_SOL || 0) > 0 || (c.CAR_POSE_SOL_GRAND || 0) > 0) return 'carrelage';
  if (piece && piece.solType) return piece.solType;
  if (piece && (piece.solMateriau === 'carrelage' || piece.solMateriau === 'carrelage_grand')) return 'carrelage';
  return (piece && piece.solMateriau) || '';
}
// LOT38 : vrai s'il n'existe aucune TRANSITION de revêtement dans le logement
// (0 ou 1 pièce revêtue, ou toutes revêtues du même matériau). Sans modèle de topologie :
// on ne peut pas localiser une transition précise, mais on supprime les faux seuils du cas
// mono-revêtement (cf. rapport). Aucune détection d'adjacence inventée.
function logementMonoRevetement(pieces) {
  var mats = (pieces || []).map(revetementEffectif).filter(Boolean);
  if (mats.length <= 1) return true;
  return mats.every(function (m) { return m === mats[0]; });
}

// Alimente piece.solType + piece.config.carrelage à partir des choix de revêtement
// et des SURFACES déjà calculées. N'écrit QUE les codes de pose gérés ici ; les
// compléments ajoutés via les oublis (fourniture, colle, plinthes…) restent intacts.
function appliquerRevetements(piece, surfaces, metiers) {
  surfaces = surfaces || { sol:0, murs:0, plafond:0 };
  // A05 : metiers reçu en paramètre ; repli sur la globale metiersActifs (compat navigateur).
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  if (!piece.config.carrelage) piece.config.carrelage = {};
  const carr = piece.config.carrelage;

  // --- SOL ---
  const mat = deriveSolMateriau(piece); piece.solMateriau = mat;
  const def = SOL_MATERIAUX.find(m => m.val === mat);
  delete carr.CAR_POSE_SOL; delete carr.CAR_POSE_SOL_GRAND;
  if (def && def.kind === 'souple') { piece.solType = mat; }
  else if (def && def.kind === 'carrelage' && metiers.includes('carrelage')) { piece.solType = ''; if (surfaces.sol > 0) carr[def.code] = _r2(surfaces.sol); }
  else { piece.solType = ''; }

  // --- FAÏENCE (mural) ---
  if (metiers.includes('carrelage')) {
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
  // LOT38 §1-3 : carrelage = prestation COMPLÈTE. La fourniture du carreau/faïence et le
  // mortier-colle + joint sont AUTOMATIQUEMENT associés à la pose (plus d'« oublis » à accepter).
  // Codes catalogue réels réutilisés (CAR_FOURN_CARREAU / CAR_FOURN_FAIENCE / CAR_MORTIER_COLLE),
  // quantités et pertes existantes conservées.
  delete carr.CAR_FOURN_CARREAU; delete carr.CAR_FOURN_FAIENCE; delete carr.CAR_MORTIER_COLLE;
  if (metiers.includes('carrelage')) {
    var solQ = (carr.CAR_POSE_SOL || 0) + (carr.CAR_POSE_SOL_GRAND || 0);
    var murQ = (carr.CAR_POSE_MUR || 0) + (carr.CAR_POSE_MUR_PETIT || 0);
    if (solQ > 0) carr.CAR_FOURN_CARREAU = _r2((carr.CAR_POSE_SOL || 0) * (1 + _pertePose('CAR_POSE_SOL')) + (carr.CAR_POSE_SOL_GRAND || 0) * (1 + _pertePose('CAR_POSE_SOL_GRAND')));
    if (murQ > 0) carr.CAR_FOURN_FAIENCE = _r2((carr.CAR_POSE_MUR || 0) * (1 + _pertePose('CAR_POSE_MUR')) + (carr.CAR_POSE_MUR_PETIT || 0) * (1 + _pertePose('CAR_POSE_MUR_PETIT')));
    if (solQ + murQ > 0) carr.CAR_MORTIER_COLLE = _r2(solQ + murQ);
  }

  // LOT38 §9 : plinthes = CHOIX du revêtement (piece.plinthesType), quantité AUTO = périmètre.
  //   Défaut = plinthe assortie au revêtement. Codes réels : CAR_PLINTHE / SOL_PLINT_BOIS / SOL_PLINT_STR.
  var _d = piece.dims || {};
  var _perim = (_d.l && _d.la) ? Math.max(0, 2 * (_d.l + _d.la) - 0.8 * (_d.portes || 0)) : 0;
  delete carr.CAR_PLINTHE;
  var _sols = piece.config.sols || {};
  delete _sols.SOL_PLINT_BOIS; delete _sols.SOL_PLINT_STR;
  var _matEff = ((carr.CAR_POSE_SOL || 0) + (carr.CAR_POSE_SOL_GRAND || 0) > 0) ? 'carrelage' : (piece.solType || '');
  var _pt = piece.plinthesType;
  if (_pt === undefined || _pt === null || _pt === '') {
    _pt = (_matEff === 'carrelage') ? 'carrelage' : (_matEff === 'parq_flot') ? 'bois' : (_matEff ? 'stratifiee' : 'aucune');
  }
  if (_perim > 0 && _pt !== 'aucune') {
    if (_pt === 'carrelage' && metiers.includes('carrelage')) carr.CAR_PLINTHE = _r2(_perim);
    else if (_pt === 'bois') { _sols.SOL_PLINT_BOIS = _r2(_perim); piece.config.sols = _sols; }
    else if (_pt === 'stratifiee') { _sols.SOL_PLINT_STR = _r2(_perim); piece.config.sols = _sols; }
  }

  // Nettoyage : ne pas laisser un objet carrelage vide polluer le modèle
  if (Object.keys(carr).length === 0) delete piece.config.carrelage;
}

// Export Node (tests) + exposition navigateur (globaux déjà disponibles pour les scripts classiques).
if (typeof module !== 'undefined' && module.exports) module.exports = {
  _r2, SOL_MATERIAUX, solMateriauxDispo, deriveSolMateriau, FAIENCE_PARAMS,
  faienceModeDefaut, faienceModesDispo, faienceLongueur, faienceSurfaceBase, deriveFaience, appliquerRevetements, revetementEffectif, logementMonoRevetement
};
