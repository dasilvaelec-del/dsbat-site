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


// =====================================================================
// M57 LOT7-A — Socle des règles VMC (FONCTIONS d'aération obligatoires)
// =====================================================================
// obligationsVmc(pieceId, contexte) : fonction PURE, sur le modèle conceptuel de
// normeMin() (électricité), MAIS adaptée à la nature FONCTIONNELLE de la VMC.
//
//   règle → FONCTION obligatoire (SORTIE_AIR / ADMISSION_AIR / INSUFFLATION)
//   ≠ prestation. Ne décide PAS le moyen (VMC_BOUCHE, entrée d'air, naturel…).
//
// GARANTIES (identiques à l'esprit de normeMin) :
//   • pure/déterministe : même entrée → même sortie ; aucun DOM, aucun prix,
//     aucun catalogue, aucun Runtime, AUCUNE écriture dans piece.config, aucun
//     sessionStorage, aucun état global ;
//   • ne borne AUCUNE quantité tarifaire (l'équivalent de Math.max viendra en
//     LOT7-B : « statut=obligatoire → fonction présente, suppression interdite »).
//
// Sortie : { FONCTION: { statut, origine } }
//   statut  ∈ obligatoire | recommande | a_verifier | libre
//   origine ∈ reglementaire | fonctionnel | dsbat
//
// PÉRIMÈTRE (anti « remplacer → tout obligatoire ») : une obligation « du neuf »
// n'est durcie que si la RÈGLE est APPLICABLE = pièce réellement en scope
// (pieceEnScope) + périmètre déterminé (complet|partiel) + intention de
// création/reprise (creer|remplacer). Sinon → a_verifier (jamais durci en
// silence). « conserver » n'est jamais assimilé à « conforme ».
function obligationsVmc(pieceId, contexte) {
  contexte = contexte || {};
  // Gate métier optionnel (si le contexte le fournit) : pas de règle VMC hors métier vmc.
  if (contexte.metiersActifs && contexte.metiersActifs.indexOf && contexte.metiersActifs.indexOf('vmc') === -1) {
    return {};
  }
  var role = _vmcRole(pieceId); // 'extraction' (pièce de service) | 'balayage' (pièce principale) | null
  if (!role) return {};         // pièces sans rôle VMC (entrée, extérieurs…) → aucune fonction

  // Contexte DÉCOUPLÉ des noms de champs chantier (le caller mappe chantier→contexte) :
  //   contexte.intention  ← intention de travaux VMC (LOT4)
  //   contexte.solution   ← solution envisagée (LOT5)
  //   contexte.perimetre  ← périmètre des travaux (LOT6/parcours) / mode chantier
  // Ce découplage garde les champs money-path absents des moteurs (gardes LOT2/4/5)
  // et rend la règle indépendante du transport des données.
  var intention = contexte.intention || 'inconnu';   // conserver | remplacer | creer | inconnu
  var solution  = contexte.solution  || 'inconnue';  // simple_flux | hygro | double_flux | inconnue
  var perimetre = contexte.perimetre || 'indecis';   // complet | partiel | indecis

  // Applicabilité de la règle « du neuf » — toutes les conditions doivent être réunies,
  // sinon on ne conclut pas (a_verifier). pieceEnScope doit être EXPLICITEMENT vrai
  // (défaut prudent : hors scope tant que non confirmé → jamais de durcissement silencieux).
  var reprise    = (intention === 'creer' || intention === 'remplacer');
  var perimOK    = (perimetre === 'complet' || perimetre === 'partiel');
  var enScope    = (contexte.pieceEnScope === true);
  var applicable = reprise && perimOK && enScope;
  var st = applicable ? 'obligatoire' : 'a_verifier';

  var out = {};
  if (role === 'extraction') {
    // Pièce de service (cuisine/SDB/SDE/WC/cave) → SORTIE d'air requise (réglementaire).
    // Vaut aussi sous double flux (extraction en pièces de service).
    out.SORTIE_AIR = { statut: st, origine: 'reglementaire' };
  } else if (role === 'balayage') {
    // Pièce principale (séjour/chambre/bureau) : en double flux, l'air neuf arrive par
    // INSUFFLATION (fonctionnel, lié au système) ; sinon ADMISSION d'air (réglementaire).
    if (solution === 'double_flux') {
      out.INSUFFLATION = { statut: st, origine: 'fonctionnel' };
    } else {
      out.ADMISSION_AIR = { statut: st, origine: 'reglementaire' };
    }
  }
  return out;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC, obligationsVmc };
