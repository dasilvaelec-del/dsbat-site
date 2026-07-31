// js/moteurs/isolation.js — Moteur métier « isolation » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getIsolationPourPiece(pieceId) {
  // Base : doublages murs + cloison + faux plafond (tous au catalogue)
  const base = [
    { code:'PLA_BA13_MUR_COL', label:'BA13 mur collé', unite:'m²' },
    { code:'PLA_BA13_MUR_OSS', label:'BA13 mur sur ossature', unite:'m²' },
    { code:'PLA_BA13_PLAF_OSS', label:'Faux plafond BA13 sur ossature', unite:'m²' },
    { code:'PLA_CLOISON_BA13', label:'Cloison BA13', unite:'m²' },
  ];
  // Isolant mural : gamme d'épaisseurs (catalogue existant)
  const isolantMur = [
    { code:'ISO_LV_100', label:'Isolation laine 100 mm', unite:'m²' },
    { code:'ISO_LV_120', label:'Isolation laine 120 mm', unite:'m²' },
    { code:'ISO_LV_140', label:'Isolation laine 140 mm', unite:'m²' },
  ];
  if (['cave','garage'].includes(pieceId)) return [...isolantMur, { code:'PLA_BA13_MUR_OSS', label:'BA13 sur ossature', unite:'m²' }, { code:'PLA_BA13_PLAF_OSS', label:'Faux plafond BA13', unite:'m²' }];
  // Pièces sous toiture : combles + rampants (codes catalogue existants)
  if (['veranda','combles','grenier'].includes(pieceId)) return [
    ...base,
    { code:'ISO_LV_300_COMB', label:'Isolation combles 300 mm', unite:'m²' },
    { code:'ISO_LV_280', label:'Isolation rampant 280 mm', unite:'m²' },
    { code:'ISO_LV_300_RAMP', label:'Isolation rampant 300 mm', unite:'m²' },
  ];
  return [...base, ...isolantMur];
}

function _isoQtes(piece) {
  const iso = (piece.config && piece.config.isolation) || {};
  const ba13Ossature = iso.PLA_BA13_MUR_OSS || 0;
  const ba13Mur = (iso.PLA_BA13_MUR_COL || 0) + (iso.PLA_BA13_MUR_OSS || 0) + (iso.PLA_CLOISON_BA13 || 0);
  const ba13Plafond = iso.PLA_BA13_PLAF_OSS || 0;
  const ba13Total = ba13Mur + ba13Plafond;
  const laine = (iso.ISO_LV_100 || 0) + (iso.ISO_LV_140 || 0) + (iso.ISO_LV_120 || 0) + (iso.ISO_LV_160 || 0)
              + (iso.ISO_LV_200_COMPLEX || 0) + (iso.ISO_ROCHE_100 || 0) + (iso.ISO_PHONIQUE || 0)
              + (iso.ISO_LV_300_COMB || 0) + (iso.ISO_LV_280 || 0) + (iso.ISO_LV_300_RAMP || 0);
  return { iso, ba13Ossature, ba13Mur, ba13Plafond, ba13Total, laine };
}

function evaluationSupportIso(piece, ch) {
  const q = _isoQtes(piece);
  const reco = [];
  // Doublage sur ossature sans isolant
  if (q.ba13Ossature > 0 && q.laine <= 0) {
    reco.push('un doublage sur ossature reçoit normalement un isolant (laine) — proposé ci-dessous');
  }
  // Pièce humide : plaque hydrofuge
  if (['sdb','sde','cuisine'].includes(piece.id) && q.ba13Total > 0 && !(q.iso.PLA_BA13_HYDRO > 0)) {
    reco.push('en pièce humide, une plaque hydrofuge (marine) est conseillée derrière le carrelage / la douche');
  }
  // Isolant sans pare-vapeur
  if (q.laine > 0 && !(q.iso.ISO_PARE_VAP > 0)) {
    reco.push('un pare-vapeur protège l\'isolant de l\'humidité et évite la condensation');
  }
  // Guidage d'épaisseur selon l'usage (RE2020 / bonnes pratiques)
  if (typeof ISOLATION_PARAMS !== 'undefined') {
    const E = ISOLATION_PARAMS.epaisseurs;
    if (['veranda','combles','grenier'].includes(piece.id)) {
      reco.push('sous toiture : privilégier ~' + E.comble.mm + ' mm en combles perdus et ~' + E.rampant.mm + ' mm en rampant (performance thermique)');
    } else if (q.ba13Ossature > 0 && q.laine <= 0) {
      reco.push('épaisseur d\'isolant conseillée en doublage de mur : ~' + E.mur.mm + ' mm');
    }
  }
  return reco;
}

function controlesOublisIso(piece) {
  const d = piece.dims || {};
  const q = _isoQtes(piece);
  const s = piece.surfaces || {};
  const ign = piece._oublisIgnoresIso || {};
  const list = [];
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || q.iso[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };

  // === Surfaces automatiques : pré-calcul depuis les dimensions déjà connues ===
  // Doublage BA13 des murs — quantité = surface murs nette calculée
  if (q.ba13Mur <= 0 && s.murs > 0) {
    add('PLA_BA13_MUR_OSS', s.murs, 'Doublage BA13 des murs sur ossature (~' + s.murs.toFixed(1) + ' m² calculés) — l\'ajouter ?', 'm²');
  }
  // Faux plafond BA13 — quantité = surface plafond calculée
  if (q.ba13Plafond <= 0 && s.plafond > 0) {
    add('PLA_BA13_PLAF_OSS', s.plafond, 'Faux plafond BA13 sur ossature (~' + s.plafond.toFixed(1) + ' m² calculés) — l\'ajouter ?', 'm²');
  }

  if (q.ba13Total + q.laine <= 0) return list; // le reste ne s'affiche qu'une fois une pose saisie
  // Isolant manquant derrière un doublage sur ossature — épaisseur conseillée (guidage)
  if (q.ba13Ossature > 0 && q.laine <= 0) {
    const eMur = (typeof ISOLATION_PARAMS !== 'undefined') ? ISOLATION_PARAMS.epaisseurs.mur : { mm: 120, code: 'ISO_LV_120' };
    add(eMur.code, q.ba13Ossature, 'Doublage sur ossature sans isolant — ajouter la laine ' + eMur.mm + ' mm (' + q.ba13Ossature + ' m²) ?', 'm²');
  }
  // Pare-vapeur sur l'isolant
  if (q.laine > 0) {
    add('ISO_PARE_VAP', q.laine, 'Pare-vapeur non prévu (' + q.laine + ' m²) — l\'ajouter ?', 'm²');
  }
  // Plaque hydrofuge en pièce humide
  if (['sdb','sde','cuisine'].includes(piece.id) && q.ba13Total > 0) {
    add('PLA_BA13_HYDRO', q.ba13Total, 'Plaque hydrofuge (pièce humide) non prévue (' + q.ba13Total + ' m²) — l\'ajouter ?', 'm²');
  }
  // Finition des plaques : bandes + enduit de ratissage
  if (q.ba13Total > 0) {
    add('PLA_ENDUIT_RATT', q.ba13Total, 'Finition des plaques (bandes + ratissage) non prévue (' + q.ba13Total + ' m²) — l\'ajouter ?', 'm²');
  }
  // Cornières d'angle (tableaux de portes / fenêtres)
  if (q.ba13Total > 0) {
    add('PLA_CORNIERE', Math.max(2, (d.portes || 0) + (d.fenetres || 0)), 'Cornières d\'angle non prévues — les ajouter ?', 'U');
  }
  return list;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getIsolationPourPiece, _isoQtes, evaluationSupportIso, controlesOublisIso };
