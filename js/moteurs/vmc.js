// js/moteurs/vmc.js — Moteur métier « vmc » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getVmcPourPiece(pieceId) {
  if (['sdb','sde','wc','cuisine','cave'].includes(pieceId)) return [
    { code:'VMC_BOUCHE', label:'Bouche d\'extraction', unite:'U' },
    { code:'VMC_ENTREE_AIR', label:'Entrée d\'air hygro', unite:'U' },
  ];
  if (['salon','salle_manger','chambre','bureau'].includes(pieceId)) return [
    { code:'VMC_ENTREE_AIR', label:'Entrée d\'air hygro', unite:'U' },
  ];
  return [];
}

function _vmcRole(pieceId) {
  if (['cuisine','sdb','sde','wc','cave'].includes(pieceId)) return 'extraction'; // pièces humides / de service
  if (['salon','salle_manger','chambre','bureau'].includes(pieceId)) return 'balayage'; // pièces principales
  return null;
}

function evaluationSupportVmc(piece, ch) {
  const v = (piece.config && piece.config.vmc) || {};
  const role = _vmcRole(piece.id);
  const reco = [];
  if (role === 'extraction' && !(v.VMC_BOUCHE > 0)) {
    reco.push('pièce humide : une bouche d\'extraction est nécessaire pour la VMC');
  }
  if (role === 'balayage' && !(v.VMC_ENTREE_AIR > 0)) {
    reco.push('pièce principale : une entrée d\'air assure le balayage (air neuf)');
  }
  if (piece.id === 'cuisine' && (v.VMC_BOUCHE > 0)) {
    reco.push('cuisine : bouche grand débit (temporisée) recommandée ; rejet en toiture par défaut, sortie façade possible');
  }
  return reco;
}

function controlesOublisVmc(piece) {
  const v = (piece.config && piece.config.vmc) || {};
  const ign = piece._oublisIgnoresVmc || {};
  const role = _vmcRole(piece.id);
  const list = [];
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || v[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };
  // Extraction : 1 bouche par pièce humide / de service (cuisine, SDB, SDE, WC, buanderie)
  if (role === 'extraction' && !(v.VMC_BOUCHE > 0)) {
    add('VMC_BOUCHE', 1, 'Bouche d\'extraction non prévue dans cette pièce — l\'ajouter ?', 'U');
  }
  // Balayage : 1 entrée d'air par pièce principale (séjour, chambres, bureau)
  if (role === 'balayage' && !(v.VMC_ENTREE_AIR > 0)) {
    add('VMC_ENTREE_AIR', 1, 'Entrée d\'air non prévue dans cette pièce principale — l\'ajouter ?', 'U');
  }
  return list;
}

function verifierVMC(pieces, metiers) {
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  const alertes = [];
  if (!metiers.includes('vmc')) return alertes;
  let totalBouches = 0;
  (pieces || []).forEach(p => {
    const v = (p.config && p.config.vmc) || {};
    const role = _vmcRole(p.id);
    totalBouches += (v.VMC_BOUCHE || 0);
    if (role === 'extraction' && !(v.VMC_BOUCHE > 0)) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : pièce humide sans bouche d\'extraction VMC.' });
    }
    if (role === 'balayage' && !(v.VMC_ENTREE_AIR > 0)) {
      alertes.push({ niveau:'info', texte: p.nom + ' : pièce principale sans entrée d\'air (balayage).' });
    }
  });
  if (totalBouches <= 0) {
    alertes.push({ niveau:'attention', texte: 'VMC sélectionnée mais aucune bouche d\'extraction configurée — la centrale ne sera pas chiffrée.' });
  }
  // Cohérence bouches / caisson : le caisson est dimensionné sur le nombre de bouches
  if (totalBouches > 8) {
    alertes.push({ niveau:'info', texte: totalBouches + ' bouches : vérifier le débit et la capacité du caisson (un caisson à fort débit peut être nécessaire).' });
  }
  return alertes;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC };
