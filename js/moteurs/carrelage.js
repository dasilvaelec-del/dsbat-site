// js/moteurs/carrelage.js — Moteur métier « carrelage » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getCarrelagePourPiece(pieceId) {
  const base = [
    { code:'CAR_POSE_SOL', label:'Carrelage sol (standard)', unite:'m²' },
    { code:'CAR_POSE_SOL_GRAND', label:'Carrelage sol grand format', unite:'m²' },
    { code:'CAR_RAGREAGE', label:'Ragréage', unite:'m²' },
  ];
  const mur = [
    { code:'CAR_POSE_MUR', label:'Faïence murale', unite:'m²' },
    { code:'CAR_POSE_MUR_PETIT', label:'Faïence mosaïque', unite:'m²' },
    { code:'CAR_ETANCHEITE', label:'Étanchéité (douche)', unite:'forfait' },
  ];
  if (['sdb','sde','wc','cuisine'].includes(pieceId)) return [...base, ...mur];
  return base;
}

function evaluationSupportCarr(piece, ch) {
  ch = ch || {}; piece = piece || {};
  const carr = (piece.config && piece.config.carrelage) || {};
  const reco = [];
  // Étanchéité en pièce humide si non prévue
  if (['sdb','sde'].includes(piece.id) && !(carr.CAR_ETANCHEITE > 0)) {
    reco.push({ code: 'CAR_ETANCHEITE', texte: 'étanchéité sous carrelage (SPEC) obligatoire sous la douche / en pièce humide — ligne « Étanchéité » ci-dessus' });
  }
  // Ragréage si support probablement inégal et non prévu
  const supportIrregulier = (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension' || ch.etatLieux === 'mauvais' || ch.ageBati === 'ancien' || ch.ageBati === 'tres_ancien');
  const solCarrele = (carr.CAR_POSE_SOL > 0) || (carr.CAR_POSE_SOL_GRAND > 0);
  if (supportIrregulier && solCarrele && !(carr.CAR_RAGREAGE > 0)) {
    reco.push({ code: 'CAR_RAGREAGE', texte: 'ragréage conseillé pour un support plan avant pose (chantier neuf / support ancien) — ligne « Ragréage » ci-dessus' });
  }
  return reco;
}

function controlesOublisCarr(piece) {
  const d = piece.dims || {};
  const s = piece.surfaces || {};
  const carr = (piece.config && piece.config.carrelage) || {};
  const ign = piece._oublisIgnoresCarr || {};
  const list = [];
  const pieceHumide = ['sdb','sde','wc','cuisine'].includes(piece.id);
  const solCarrele = (carr.CAR_POSE_SOL || 0) + (carr.CAR_POSE_SOL_GRAND || 0);
  const murCarrele = (carr.CAR_POSE_MUR || 0) + (carr.CAR_POSE_MUR_PETIT || 0);
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || carr[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };

  // === Surfaces automatiques : pré-calcul depuis les dimensions déjà connues ===
  if (solCarrele <= 0 && s.sol > 0) {
    add('CAR_POSE_SOL', s.sol, 'Carrelage de sol (~' + s.sol.toFixed(1) + ' m² calculés) — l\'ajouter ?', 'm²');
  }
  if (pieceHumide && murCarrele <= 0 && s.murs > 0) {
    add('CAR_POSE_MUR', s.murs, 'Faïence murale (~' + s.murs.toFixed(1) + ' m² calculés) — l\'ajouter ?', 'm²');
  }

  if (solCarrele + murCarrele <= 0) return list; // le reste ne s'affiche qu'une fois une pose saisie

  // Coefficient de pertes par format (CARRELAGE_PARAMS) — appliqué à la FOURNITURE seule
  const perte = (code, defaut) => {
    if (typeof CARRELAGE_PARAMS === 'undefined') return defaut;
    const type = CARRELAGE_PARAMS.perteParPose[code];
    const p = CARRELAGE_PARAMS.pertes[piece.carPose === 'diagonale' ? 'diagonale' : type];
    return (p === undefined) ? defaut : p;
  };
  // Fourniture carreau (pose sol) avec pertes selon le format
  const fournCarreau = (carr.CAR_POSE_SOL || 0) * (1 + perte('CAR_POSE_SOL', 0.10)) + (carr.CAR_POSE_SOL_GRAND || 0) * (1 + perte('CAR_POSE_SOL_GRAND', 0.12));
  if (solCarrele > 0 && !(carr.CAR_FOURN_CARREAU > 0)) {
    add('CAR_FOURN_CARREAU', fournCarreau, 'Fourniture du carreau (' + Math.round(fournCarreau) + ' m², chutes incluses) — l\'ajouter ?', 'm²');
  }
  // Fourniture faïence (pose murale) avec pertes selon le format
  const fournFaience = (carr.CAR_POSE_MUR || 0) * (1 + perte('CAR_POSE_MUR', 0.10)) + (carr.CAR_POSE_MUR_PETIT || 0) * (1 + perte('CAR_POSE_MUR_PETIT', 0.15));
  if (murCarrele > 0 && !(carr.CAR_FOURN_FAIENCE > 0)) {
    add('CAR_FOURN_FAIENCE', fournFaience, 'Fourniture de la faïence (' + Math.round(fournFaience) + ' m², chutes incluses) — l\'ajouter ?', 'm²');
  }

  // Consommables : primaire, mortier-colle + joint, préparation du support
  add('CAR_PRIMAIRE', solCarrele + murCarrele, 'Primaire d\'accrochage non prévu (' + (solCarrele + murCarrele) + ' m²) — l\'ajouter ?', 'm²');
  add('CAR_MORTIER_COLLE', solCarrele + murCarrele, 'Mortier-colle + joint non prévu (' + (solCarrele + murCarrele) + ' m²) — l\'ajouter ?', 'm²');
  add('CAR_PREP_MORTIER', solCarrele, 'Préparation du support au mortier (' + solCarrele + ' m²) — l\'ajouter ?', 'm²');

  // Plinthes carrelage (périmètre moins passages de portes) si sol carrelé
  if (solCarrele > 0 && d.l && d.la) {
    const per = 2 * (d.l + d.la) - 0.8 * (d.portes || 0);
    add('CAR_PLINTHE', Math.max(0, per), 'Plinthes carrelage non prévues (~' + Math.round(per) + ' ml) — les ajouter ?', 'ml');
  }
  // Seuils de transition aux passages de porte
  if (solCarrele > 0) {
    add('CAR_SEUIL', Math.round(0.8 * (d.portes || 0) * 10) / 10, 'Seuils de transition aux ' + (d.portes || 0) + ' passage(s) de porte non prévus — les ajouter ?', 'ml');
  }
  // Accessoires de finition (optionnels) : profilés d'arête si faïence
  if (murCarrele > 0) {
    add('CAR_PROFILE', Math.max(2, (d.portes || 0) + (d.fenetres || 0)), 'Profilés de finition (arêtes de faïence) — les ajouter ?', 'U');
  }
  return list;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getCarrelagePourPiece, evaluationSupportCarr, controlesOublisCarr };
