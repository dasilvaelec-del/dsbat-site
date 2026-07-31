// js/moteurs/peinture.js — Moteur métier « peinture » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function detectionSousCouche(piece, ch, surfMurs, surfPlaf) {
  const iso = (piece.config && piece.config.isolation) || {};
  const m2Murs = (iso.PLA_BA13_MUR_COL||0) + (iso.PLA_BA13_MUR_OSS||0) + (iso.PLA_CLOISON_BA13||0) + (iso.ISO_LV_200_COMPLEX||0);
  const m2Plaf = (iso.PLA_BA13_PLAF_OSS||0);
  if (m2Murs + m2Plaf > 0) {
    const surf = Math.min(m2Murs, surfMurs || m2Murs) + Math.min(m2Plaf, surfPlaf || m2Plaf);
    return { surf, raison: 'du BA13 / placo neuf est posé dans cette pièce (' + (m2Murs + m2Plaf).toFixed(0) + ' m²) — le plâtre nu boit la peinture, une impression est indispensable pour la finition' };
  }
  if (ch && (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension')) {
    const surf = (surfMurs || 0) + (surfPlaf || 0);
    if (surf > 0) return { surf, raison: 'construction neuve / extension : supports neufs jamais peints, sous-couche d\'impression nécessaire sur murs et plafond' };
  }
  return null;
}

function evaluationSupport(piece, ch) {
  ch = ch || {};
  piece = piece || {};
  const raisons = [];
  let rang = 0; // on retient le niveau le plus exigeant justifié

  // Support neuf (BA13 posé dans la pièce ou projet neuf/extension) -> standard suffit (plâtre sain)
  const iso = (piece.config && piece.config.isolation) || {};
  const placoNeuf = ((iso.PLA_BA13_MUR_COL||0)+(iso.PLA_BA13_MUR_OSS||0)+(iso.PLA_CLOISON_BA13||0)+(iso.PLA_BA13_PLAF_OSS||0)+(iso.ISO_LV_200_COMPLEX||0)) > 0;
  const projetNeuf = (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension');
  if (placoNeuf || projetNeuf) {
    rang = Math.max(rang, 1);
    raisons.push(placoNeuf ? 'placo neuf dans la pièce (support sain, mais impression + finition soignée nécessaires)' : 'construction neuve / extension (supports neufs à préparer)');
  }

  // État déclaré des lieux
  if (ch.etatLieux === 'bon') raisons.push('état déclaré : bon');
  else if (ch.etatLieux === 'moyen') { rang = Math.max(rang, 1); raisons.push('état déclaré : moyen'); }
  else if (ch.etatLieux === 'mauvais') { rang = Math.max(rang, 2); raisons.push('état déclaré : mauvais / à rénover'); }

  // Âge du bâti : ancien / très ancien -> supports souvent dégradés
  if (ch.ageBati === 'ancien') { rang = Math.max(rang, 1); raisons.push('bâtiment ancien (30–50 ans)'); }
  else if (ch.ageBati === 'tres_ancien') { rang = Math.max(rang, 2); raisons.push('bâtiment très ancien (+ de 50 ans)'); }

  // Papier peint présent -> au minimum préparation standard après décollage
  if (piece.peintPapier === 'oui') { rang = Math.max(rang, 1); raisons.push('papier peint à décoller (support à reprendre)'); }

  // Bien locatif / préparation à la vente -> le rafraîchissement suffit souvent (usage locatif)
  if ((ch.typeLogement === 'locatif' || ch.typeLogement === 'vente') && rang < 2) {
    raisons.push('usage ' + (ch.typeLogement === 'locatif' ? 'locatif' : 'mise en vente') + ' (rafraîchissement souvent suffisant)');
  }

  const niveau = ['less','std','fort'][rang];
  return { niveau, raisons };
}

function controlesOublisPeinture(piece) {
  const d = piece.dims || {};
  const cfg = (piece.config && piece.config.peinture) || {};
  const ign = piece._oublisIgnores || {};
  const projetNeuf = chantier && (chantier.typeProjet === 'neuf' || chantier.typeProjet === 'extension');
  const list = [];
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || cfg[code] || ign[code]) return; // déjà ajouté ou déjà refusé
    list.push({ code, qty, question, unite });
  };
  // Portes intérieures (2 faces) — d'après le nombre de portes de la pièce
  add(projetNeuf ? 'PEINT_PORTE_NEUVE' : 'PEINT_PORTE_EXIST', d.portes || 0,
      'Vous n\'avez pas prévu de peindre les ' + (d.portes || 0) + ' porte(s) intérieure(s). Souhaitez-vous les ajouter ?', 'U');
  // Plinthes — périmètre de la pièce moins les passages de portes
  if (d.l && d.la) {
    const per = 2 * (d.l + d.la) - 0.8 * (d.portes || 0);
    add('PEINT_PLINTHE', Math.max(0, per),
        'Vous n\'avez pas prévu de peindre les plinthes (~' + Math.round(per) + ' ml). Souhaitez-vous les ajouter ?', 'ml');
  }
  // Coffres de volets roulants — d'après le nombre de fenêtres
  add('PEINT_COFFRE_VR', d.fenetres || 0,
      'Coffres de volets roulants (' + (d.fenetres || 0) + ') non prévus. Les peindre ?', 'U');
  // Radiateurs — pièces de vie chauffées (hors SDB à sèche-serviette)
  if (['salon','salle_manger','chambre','bureau','couloir','entree'].includes(piece.id)) {
    add('PEINT_RAD', 1, 'Un radiateur à peindre dans cette pièce ? (à ajuster)', 'U');
  }
  // Tuyaux / canalisations apparents — pièces humides et techniques
  if (['sdb','sde','wc','cuisine','cave','garage'].includes(piece.id)) {
    add('PEINT_TUYAU', 2, 'Tuyaux apparents à peindre ? (~2 ml, à ajuster)', 'ml');
  }
  // Boiseries diverses — pièces de réception
  if (['salon','salle_manger','entree'].includes(piece.id)) {
    add('PEINT_BOISERIE', 1, 'Boiseries diverses à peindre (moulures, habillages) ?', 'm²');
  }
  return list;
}

function controlesInfoPeinture(piece) {
  const s = piece.surfaces || {};
  const out = [];
  if (!(s.murs > 0)) out.push('Les murs de cette pièce ne sont pas chiffrés (dimensions manquantes). Est-ce volontaire ?');
  if (!(s.plafond > 0)) out.push('Le plafond de cette pièce n\'est pas chiffré (dimensions manquantes). Est-ce volontaire ?');
  return out;
}


if (typeof module !== "undefined" && module.exports) module.exports = { detectionSousCouche, evaluationSupport, controlesOublisPeinture, controlesInfoPeinture };
