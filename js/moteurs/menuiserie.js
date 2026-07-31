// js/moteurs/menuiserie.js — Moteur métier « menuiserie » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getMenuiseriePourPiece(pieceId) {
  const base = [
    { code:'MEN_PORTE_INT', label:'Porte intérieure', unite:'U' },
    { code:'MEN_VOLET_ROULANT', label:'Volet roulant', unite:'U' },
    { code:'MEN_STORE', label:'Store', unite:'U' },
  ];
  // Fenêtres (catalogue existant) proposées dans les pièces à ouvertures
  const fenetres = [
    { code:'MEN_FEN_ALU_STD', label:'Fenêtre alu standard', unite:'U' },
    { code:'MEN_FEN_BOIS_STD', label:'Fenêtre bois standard', unite:'U' },
    { code:'MEN_FEN_BOIS_CINTRE', label:'Fenêtre bois cintrée', unite:'U' },
  ];
  if (['entree'].includes(pieceId)) return [
    ...base,
    { code:'MEN_PORTE_ENTREE_PVC', label:'Porte d\'entrée PVC', unite:'U' },
    { code:'MEN_PORTE_ENTREE_BOIS', label:'Porte d\'entrée bois', unite:'U' },
    { code:'MEN_PORTE_BLINDEE', label:'Porte blindée A2P', unite:'U' },
  ];
  if (['salon','salle_manger'].includes(pieceId)) return [
    ...base, ...fenetres,
    { code:'MEN_FEN_ALU_BAIE', label:'Baie vitrée coulissante', unite:'U' },
    { code:'MEN_VERRIERE', label:'Verrière intérieure', unite:'U' },
  ];
  if (['veranda','combles','grenier'].includes(pieceId)) return [
    ...base, ...fenetres,
    { code:'MEN_FEN_TOIT', label:'Fenêtre de toit (velux)', unite:'U' },
  ];
  if (['chambre','bureau','cuisine'].includes(pieceId)) return [...base, ...fenetres];
  if (['escalier'].includes(pieceId)) return [
    { code:'MEN_ESCALIER_BOIS', label:'Escalier bois', unite:'U' },
    { code:'MEN_GARDE_CORPS', label:'Garde-corps', unite:'ml' },
    { code:'MEN_BALUSTRADE', label:'Balustrade', unite:'ml' },
  ];
  return base;
}

function _menQtes(piece) {
  const men = (piece.config && piece.config.menuiserie) || {};
  const portesInt = men.MEN_PORTE_INT || 0;
  const portesEntree = (men.MEN_PORTE_ENTREE_PVC || 0) + (men.MEN_PORTE_ENTREE_BOIS || 0) + (men.MEN_PORTE_BLINDEE || 0);
  const fenetres = (men.MEN_FEN_ALU_BAIE || 0) + (men.MEN_FEN_BOIS_STD || 0) + (men.MEN_FEN_ALU_STD || 0) + (men.MEN_FEN_TOIT || 0);
  const occultation = (men.MEN_VOLET_ROULANT || 0) + (men.MEN_STORE || 0);
  const escalier = men.MEN_ESCALIER_BOIS || 0;
  const gardeCorps = (men.MEN_GARDE_CORPS || 0) + (men.MEN_BALUSTRADE || 0);
  return { men, portesInt, portesEntree, fenetres, occultation, escalier, gardeCorps };
}

function evaluationSupportMen(piece, ch) {
  const q = _menQtes(piece);
  const reco = [];
  // Escalier sans garde-corps -> sécurité
  if (q.escalier > 0 && q.gardeCorps <= 0) {
    reco.push('un garde-corps est obligatoire le long d\'un escalier (sécurité, hauteur de chute)');
  }
  // Fenêtre / baie sans occultation -> confort
  if (q.fenetres > 0 && q.occultation <= 0) {
    reco.push('pensez à l\'occultation des ' + q.fenetres + ' fenêtre(s) / baie(s) (volet roulant ou store)');
  }
  return reco;
}

function controlesOublisMen(piece) {
  const q = _menQtes(piece);
  const d = piece.dims || {};
  const ign = piece._oublisIgnoresMen || {};
  const list = [];
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || q.men[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };
  const pieceAFenetres = ['salon','salle_manger','chambre','bureau','cuisine','veranda','combles','grenier'].includes(piece.id);

  // === Auto-génération depuis les ouvertures déjà saisies (dims) ===
  // Fenêtres : nombre déclaré non encore équipé -> proposer une fenêtre alu standard par ouverture
  if (pieceAFenetres && q.fenetres <= 0 && (d.fenetres || 0) > 0) {
    add('MEN_FEN_ALU_STD', d.fenetres, (d.fenetres) + ' fenêtre(s) déclarée(s) sans menuiserie — ajouter des fenêtres alu standard (modifiable) ?', 'U');
  }
  // Portes intérieures : nombre déclaré non encore équipé
  if (q.portesInt <= 0 && (d.portes || 0) > 0 && !['entree','escalier'].includes(piece.id)) {
    add('MEN_PORTE_INT', d.portes, (d.portes) + ' porte(s) déclarée(s) sans menuiserie — ajouter des portes intérieures (modifiable) ?', 'U');
  }

  // Dépose des anciennes menuiseries en rénovation (références catalogue existantes)
  if (chantier && chantier.typeProjet === 'renov') {
    if (pieceAFenetres && (d.fenetres || 0) > 0) {
      add('MAC_DEMO_FENETRE', d.fenetres, 'Dépose des ' + d.fenetres + ' ancienne(s) fenêtre(s) (rénovation) — l\'ajouter ?', 'U');
    }
    if ((d.portes || 0) > 0 && !['escalier'].includes(piece.id)) {
      add('MAC_DEMO_PORTE', d.portes, 'Dépose des ' + d.portes + ' ancienne(s) porte(s) (rénovation) — l\'ajouter ?', 'U');
    }
  }

  if (q.portesInt + q.portesEntree + q.fenetres + q.escalier <= 0) return list; // le reste ne s'affiche qu'une fois une menuiserie posée
  // Habillage champlat pour les portes intérieures (finition du bâti)
  if (q.portesInt > 0) {
    add('MEN_HABILLAGE_CHAMPLAT', q.portesInt, 'Habillage / champlat des ' + q.portesInt + ' porte(s) intérieure(s) non prévu — l\'ajouter ?', 'U');
  }
  // Garde-corps si escalier sans garde-corps
  if (q.escalier > 0 && q.gardeCorps <= 0) {
    add('MEN_GARDE_CORPS', 3, 'Garde-corps d\'escalier non prévu (~3 ml, sécurité) — l\'ajouter ?', 'ml');
  }
  // Occultation si fenêtre / baie sans volet ni store
  if (q.fenetres > 0 && q.occultation <= 0) {
    add('MEN_VOLET_ROULANT', q.fenetres, 'Occultation des ' + q.fenetres + ' fenêtre(s) non prévue — ajouter un volet roulant par fenêtre ?', 'U');
  }
  // Serrure / verrou supplémentaire pour les portes d'entrée
  if (q.portesEntree > 0) {
    add('MEN_SERRURE', q.portesEntree, 'Serrure / verrou supplémentaire pour la porte d\'entrée non prévu — l\'ajouter ?', 'U');
  }
  return list;
}

function verifierMenuiserie(pieces, metiers) {
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  const alertes = [];
  if (!metiers.includes('menuiserie')) return alertes;
  const existe = code => { try { return getMoyenPrixFor(code, {}) > 0; } catch (e) { return false; } };
  const CODES_FEN = ['MEN_FEN_ALU_STD','MEN_FEN_BOIS_STD','MEN_FEN_BOIS_CINTRE','MEN_FEN_ALU_BAIE','MEN_FEN_TOIT'];
  (pieces || []).forEach(p => {
    const q = _menQtes(p);
    const d = p.dims || {};
    const pieceAFenetres = ['salon','salle_manger','chambre','bureau','cuisine','veranda','combles','grenier'].includes(p.id);
    // Ouverture déclarée sans menuiserie associée
    if (pieceAFenetres && (d.fenetres || 0) > 0 && q.fenetres <= 0) {
      alertes.push({ niveau:'info', texte: p.nom + ' : ' + d.fenetres + ' fenêtre(s) déclarée(s) sans menuiserie configurée (conservées ou à ajouter ?).' });
    }
    // Menuiserie fenêtre sans ouverture déclarée
    if (q.fenetres > 0 && (d.fenetres || 0) === 0) {
      alertes.push({ niveau:'info', texte: p.nom + ' : fenêtre(s) configurée(s) sans ouverture déclarée en dimensions — vérifiez la saisie.' });
    }
    // Incohérence de quantité (plus de menuiseries que d'ouvertures déclarées)
    if ((d.fenetres || 0) > 0 && q.fenetres > (d.fenetres || 0)) {
      alertes.push({ niveau:'info', texte: p.nom + ' : ' + q.fenetres + ' fenêtre(s) posée(s) pour ' + d.fenetres + ' déclarée(s) — quantité à confirmer.' });
    }
    // Référence catalogue absente
    Object.keys(q.men).forEach(code => { if ((q.men[code] || 0) > 0 && !existe(code)) alertes.push({ niveau:'attention', texte: p.nom + ' : référence menuiserie « ' + code + ' » absente du catalogue.' }); });
  });
  return alertes;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getMenuiseriePourPiece, _menQtes, evaluationSupportMen, controlesOublisMen, verifierMenuiserie };
