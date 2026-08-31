// js/moteurs/plomberie.js — Moteur métier « plomberie » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getPlombPourPiece(pieceId) {
  if (['sdb'].includes(pieceId)) return [
    { code:'PLO_BAIGNOIRE', label:'Baignoire', unite:'U' },
    { code:'PLO_DOUCHE_ITAL', label:'Douche à l\'italienne', unite:'U' },
    { code:'PLO_DOUCHE_CABINE', label:'Cabine de douche', unite:'U' },
    { code:'PLO_MEUBLE_LAV', label:'Meuble vasque', unite:'U' },
    { code:'PLO_WC_SUSP', label:'WC suspendu', unite:'U' },
    { code:'PLO_BALLON_100', label:'Ballon eau chaude 100L', unite:'U' },
  ];
  if (['sde'].includes(pieceId)) return [
    { code:'PLO_DOUCHE_ITAL', label:'Douche à l\'italienne', unite:'U' },
    { code:'PLO_DOUCHE_CABINE', label:'Cabine de douche', unite:'U' },
    { code:'PLO_MEUBLE_LAV', label:'Meuble vasque', unite:'U' },
  ];
  if (['wc'].includes(pieceId)) return [
    { code:'PLO_WC_SIMPLE', label:'WC simple', unite:'U' },
    { code:'PLO_WC_SUSP', label:'WC suspendu bâti', unite:'U' },
    { code:'PLO_LAV_SIMPLE', label:'Lave-mains', unite:'U' },
  ];
  if (['cuisine'].includes(pieceId)) return [
    { code:'PLO_EVIER', label:'Évier 1 bac', unite:'U' },
    { code:'PLO_EVIER_DBL', label:'Évier double bac', unite:'U' },
    { code:'PLO_RACCORD_LV', label:'Raccordement lave-vaisselle', unite:'U' },
    { code:'PLO_ADOUCISSEUR', label:'Adoucisseur d\'eau', unite:'U' },
  ];
  if (['cave'].includes(pieceId)) return [
    { code:'PLO_RACCORD_LV', label:'Raccordement lave-linge', unite:'U' },
    { code:'PLO_BALLON_200', label:'Ballon eau chaude 200L', unite:'U' },
  ];
  return [];
}

function _ploQtes(piece) {
  const plo = (piece.config && piece.config.plomberie) || {};
  const douches = (plo.PLO_DOUCHE_ITAL || 0) + (plo.PLO_DOUCHE_CABINE || 0);
  const ballons = (plo.PLO_BALLON_50 || 0) + (plo.PLO_BALLON_100 || 0) + (plo.PLO_BALLON_200 || 0);
  const adoucisseurs = (plo.PLO_ADOUCISSEUR || 0);
  const ensembleDouche = (plo.PLO_DOUCHE_ENS || 0);
  const paroi = (plo.PLO_PAROI_DOUCHE || 0) + (plo.PLO_PAROI_DBL || 0);
  const groupeSecu = (plo.PLO_GROUPE_SECU || 0);
  const disconnecteur = (plo.PLO_DISCONNECTEUR || 0);
  const sanitaires = douches + (plo.PLO_BAIGNOIRE || 0) + (plo.PLO_MEUBLE_LAV || 0) + (plo.PLO_LAV_SIMPLE || 0)
                   + (plo.PLO_WC_SIMPLE || 0) + (plo.PLO_WC_SUSP || 0) + (plo.PLO_EVIER || 0) + (plo.PLO_EVIER_DBL || 0);
  return { plo, douches, ballons, adoucisseurs, ensembleDouche, paroi, groupeSecu, disconnecteur, sanitaires };
}

function evaluationSupportPlo(piece, ch) {
  const q = _ploQtes(piece);
  const reco = [];
  // Ballon d'eau chaude sans groupe de sécurité (obligatoire)
  if (q.ballons > 0 && q.groupeSecu <= 0) {
    reco.push('un groupe de sécurité est obligatoire sur un chauffe-eau (ballon)');
  }
  // Douche sans ensemble (colonne / mitigeur)
  if (q.douches > 0 && q.ensembleDouche <= 0) {
    reco.push('un ensemble de douche (colonne, mitigeur) complète la douche');
  }
  // Douche à l'italienne : étanchéité + receveur/caniveau
  if ((q.plo.PLO_DOUCHE_ITAL || 0) > 0) {
    reco.push('douche à l\'italienne : prévoyez l\'étanchéité (SPEC) et un caniveau / receveur à carreler');
  }
  // Adoucisseur sans disconnecteur
  if (q.adoucisseurs > 0 && q.disconnecteur <= 0) {
    reco.push('un disconnecteur protège le réseau en amont d\'un adoucisseur');
  }
  return reco;
}

function controlesOublisPlo(piece) {
  const q = _ploQtes(piece);
  const ign = piece._oublisIgnoresPlo || {};
  const list = [];
  if (q.sanitaires <= 0 && q.ballons <= 0) return list; // rien tant qu'aucune pose
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || q.plo[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };
  // Ensemble douche (colonne, mitigeur) si douche sans ensemble
  if (q.douches > 0 && q.ensembleDouche <= 0) {
    add('PLO_DOUCHE_ENS', q.douches, 'Ensemble de douche (colonne, mitigeur) non prévu — l\'ajouter ?', 'U');
  }
  // Paroi de douche si douche sans paroi
  if (q.douches > 0 && q.paroi <= 0) {
    add('PLO_PAROI_DOUCHE', q.douches, 'Paroi de douche non prévue — l\'ajouter ?', 'U');
  }
  // Groupe de sécurité sur le ballon
  if (q.ballons > 0 && q.groupeSecu <= 0) {
    add('PLO_GROUPE_SECU', q.ballons, 'Groupe de sécurité du ballon (obligatoire) non prévu — l\'ajouter ?', 'U');
  }
  // Disconnecteur sur l'adoucisseur
  if (q.adoucisseurs > 0 && q.disconnecteur <= 0) {
    add('PLO_DISCONNECTEUR', q.adoucisseurs, 'Disconnecteur (protection réseau, adoucisseur) non prévu — l\'ajouter ?', 'U');
  }
  // Dépose des anciens sanitaires en rénovation (codes catalogue existants ; opt-in,
  // même mécanisme add()/anti-doublon que les recos ci-dessus). Codes canoniques PLO_*.
  if (chantier && chantier.typeProjet === 'renov') {
    const nbWC = (q.plo.PLO_WC_SIMPLE || 0) + (q.plo.PLO_WC_SUSP || 0);
    const nbBaig = (q.plo.PLO_BAIGNOIRE || 0);
    const nbLav = (q.plo.PLO_LAV_SIMPLE || 0) + (q.plo.PLO_MEUBLE_LAV || 0);
    if (nbWC > 0) add('PLO_DEPOSE_WC', nbWC, 'Dépose de l\'ancien WC avant la pose du nouveau (rénovation). L\'ajouter ?', 'U');
    if (nbBaig > 0) add('PLO_DEPOSE_BAIG', nbBaig, 'Dépose de l\'ancienne baignoire avant la pose (rénovation). L\'ajouter ?', 'U');
    if (nbLav > 0) add('PLO_DEPOSE_LAV', nbLav, 'Dépose de l\'ancien lavabo / meuble vasque avant la pose (rénovation). L\'ajouter ?', 'U');
  }
  return list;
}

function verifierPlomberie(pieces, metiers) {
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  const alertes = [];
  if (!metiers.includes('plomberie')) return alertes;
  let totalAppareils = 0;
  (pieces || []).forEach(p => {
    const pl = (p.config && p.config.plomberie) || {};
    const car = (p.config && p.config.carrelage) || {};
    const italienne = pl.PLO_DOUCHE_ITAL || 0;
    const cabine = pl.PLO_DOUCHE_CABINE || 0;
    const douches = italienne + cabine;
    const ballons = (pl.PLO_BALLON_50 || 0) + (pl.PLO_BALLON_100 || 0) + (pl.PLO_BALLON_200 || 0);
    const adoucisseurs = pl.PLO_ADOUCISSEUR || 0;
    const receveurs = (pl.PLO_RECEV_PRET || 0) + (pl.PLO_RECEV_90 || 0) + (pl.PLO_RECEV_120PC || 0);
    totalAppareils += (pl.PLO_WC_SIMPLE || 0) + (pl.PLO_WC_SUSP || 0) + (pl.PLO_MEUBLE_LAV || 0) + (pl.PLO_LAV_SIMPLE || 0)
                    + douches + (pl.PLO_BAIGNOIRE || 0) + (pl.PLO_EVIER || 0) + (pl.PLO_EVIER_DBL || 0) + (pl.PLO_RACCORD_LV || 0);

    // DOUBLON — étanchéité déjà comprise dans la douche à l'italienne « complet »
    if (italienne > 0 && (car.CAR_ETANCHEITE || 0) > 0) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : l\'étanchéité est déjà comprise dans la douche à l\'italienne (complet) — la ligne « Étanchéité » du carrelage fait doublon.' });
    }
    // DOUBLON — la cabine de douche inclut déjà son receveur
    if (cabine > 0 && receveurs > 0) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : la cabine de douche inclut déjà son receveur — le receveur séparé fait doublon.' });
    }
    // INCOHÉRENCES / accessoires orphelins
    if ((pl.PLO_DOUCHE_ENS || 0) > 0 && douches <= 0) alertes.push({ niveau:'info', texte: p.nom + ' : ensemble de douche sans douche configurée.' });
    if (((pl.PLO_PAROI_DOUCHE || 0) + (pl.PLO_PAROI_DBL || 0)) > 0 && douches <= 0) alertes.push({ niveau:'info', texte: p.nom + ' : paroi de douche sans douche configurée.' });
    if ((pl.PLO_GROUPE_SECU || 0) > 0 && ballons <= 0) alertes.push({ niveau:'info', texte: p.nom + ' : groupe de sécurité sans ballon d\'eau chaude.' });
    if ((pl.PLO_DISCONNECTEUR || 0) > 0 && adoucisseurs <= 0) alertes.push({ niveau:'info', texte: p.nom + ' : disconnecteur sans adoucisseur.' });
    if (receveurs > 0 && italienne <= 0 && cabine <= 0) alertes.push({ niveau:'info', texte: p.nom + ' : receveur sans douche configurée.' });
  });

  // ÉQUIPEMENT ORPHELIN — des appareils existent mais le réseau EF/ECS/évacuation
  // n'a pas été généré (ne doit jamais arriver : le réseau est auto-dimensionné).
  if (totalAppareils > 0 && typeof window !== 'undefined' && window.__plomberieAuto === null) {
    alertes.push({ niveau:'attention', texte: 'Des appareils sanitaires sont configurés mais aucun réseau EF/ECS/évacuation n\'a été généré — vérifiez que le lot plomberie est bien actif.' });
  }
  return alertes;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getPlombPourPiece, _ploQtes, evaluationSupportPlo, controlesOublisPlo, verifierPlomberie };
