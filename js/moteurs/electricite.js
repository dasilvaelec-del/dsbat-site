// js/moteurs/electricite.js — Moteur métier « electricite » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function getElecPourPiece(pieceId) {
  const base = [
    { code:'ELEC_PL_SA', label:'Point lumineux simple', unite:'U' },
    { code:'ELEC_PL_VV', label:'Point lumineux va-et-vient (2 accès)', unite:'U' },
    { code:'ELEC_PL_3BP', label:'Point lumineux télérupteur (3+ accès)', unite:'U' },
    { code:'ELEC_PL_SUP', label:'Point lumineux supplémentaire (même interrupteur)', unite:'U' },
    { code:'ELEC_PRISE10', label:'Prise 2P+T simple', unite:'U' },
    { code:'ELEC_PRISED', label:'Prise double 2P+T', unite:'U' },
  ];
  const cuisine = [
    { code:'ELEC_PRISE20', label:'Prise spécialisée 20A (four, lave-vaisselle)', unite:'U' },
    { code:'ELEC_PRISE32', label:'Prise spécialisée 32A (plaque induction)', unite:'U' },
    { code:'ELEC_SC20', label:'Sortie de câble 20A (hotte)', unite:'U' },
  ];
  const sdb = [
    { code:'ELEC_PL_APP', label:'Applique au-dessus du lavabo (éclairage miroir)', unite:'U' },
    { code:'ELEC_SECH_SERV', label:'Sèche-serviette', unite:'U' },
    { code:'ELEC_LIAISON_EQUI', label:'Liaison équipotentielle SDB', unite:'U' },
  ];
  const salon = [
    { code:'ELEC_TV', label:'Prise TV', unite:'U' },
    { code:'ELEC_RJ45', label:'Prise RJ45 cat6', unite:'U' },
    { code:'ELEC_VOLET', label:'Commande volet roulant', unite:'U' },
    { code:'ELEC_THERMO', label:'Thermostat d\'ambiance', unite:'U' },
  ];
  const commun = [
    { code:'ELEC_SONETTE', label:'Sonnette / Interphone', unite:'U' },
    { code:'ELEC_VOLET', label:'Commande volet roulant', unite:'U' },
  ];
  // Buanderie / cave / garage : circuits spécialisés gros électroménager (NF C 15-100 : 1 circuit dédié par appareil)
  const buanderie = [
    { code:'ELEC_PRISE20', label:'Prise spécialisée 20A (lave-linge)', unite:'U' },
    { code:'ELEC_SC20', label:'Sortie de câble 20A (sèche-linge)', unite:'U' },
  ];

  let prests = [...base];
  if (['cuisine'].includes(pieceId)) prests = [...prests, ...cuisine];
  if (['cave','garage'].includes(pieceId)) prests = [...prests, ...buanderie];
  if (['sdb','sde'].includes(pieceId)) prests = [...prests, ...sdb];
  if (['salon','salle_manger'].includes(pieceId)) prests = [...prests, ...salon];
  if (['chambre'].includes(pieceId)) prests = [...prests, { code:'ELEC_TV', label:'Prise TV', unite:'U' }, { code:'ELEC_RJ45', label:'Prise RJ45 cat6', unite:'U' }, { code:'ELEC_VOLET', label:'Commande volet roulant', unite:'U' }];
  if (['bureau'].includes(pieceId)) prests = [...prests, { code:'ELEC_RJ45', label:'Prise RJ45 cat6', unite:'U' }, { code:'ELEC_VOLET', label:'Commande volet roulant', unite:'U' }];
  if (['entree'].includes(pieceId)) prests = [...prests, ...commun];
  if (chantier && chantier.chauffage === 'electrique' && ['salon','salle_manger','chambre','bureau'].includes(pieceId)) prests = [...prests, { code:'ELEC_SC20_FP', label:'Sortie de câble radiateur (fil pilote)', unite:'U' }];
  return prests;
}

function normeMin(pieceId, portes, surface) {
  portes = portes || 1;
  surface = surface || 0;
  // Commande d'éclairage : nb de portes = nb d'accès (approximation).
  // Pièces de passage (couloir, escalier) : minimum va-et-vient — on commande
  // aux deux extrémités même si une seule « porte » est saisie (escalier = haut + bas).
  const passage = (pieceId === 'couloir' || pieceId === 'escalier');
  const acces = Math.max(portes, passage ? 2 : 1);
  const light = acces >= 3 ? 'ELEC_PL_3BP' : (acces === 2 ? 'ELEC_PL_VV' : 'ELEC_PL_SA');
  const min = {};
  // 1 point lumineux minimum par pièce (NF C 15-100) — sauf jardin/allée :
  // aucun éclairage imposé par la norme en pleine parcelle (proposé en conseil, retirable).
  // Terrasse, façade, carport conservent leur point (éclairage des accès du bâti).
  if (pieceId !== 'jardin') min[light] = 1;
  if (pieceId === 'cuisine') { min.ELEC_PRISE10 = 6; min.ELEC_PRISE32 = 1; min.ELEC_PRISE20 = 2; }
  else if (pieceId === 'salon' || pieceId === 'salle_manger') { min.ELEC_PRISE10 = surface > 28 ? 7 : 5; min.ELEC_RJ45 = 1; min.ELEC_TV = 1; } // NF C 15-100 (A5) : 5 socles si séjour ≤ 28 m², 7 au-delà
  else if (pieceId === 'chambre') { min.ELEC_PRISE10 = 3; min.ELEC_RJ45 = 1; min.ELEC_TV = 1; }
  else if (pieceId === 'sdb') { min.ELEC_PRISE10 = 1; min.ELEC_LIAISON_EQUI = 1; } // sèche-serviette = conseil DS.BAT (non exigé par la norme)
  else if (pieceId === 'sde') { min.ELEC_PRISE10 = 1; }
  else if (pieceId === 'wc') { /* éclairage seul */ }
  else if (pieceId === 'entree') { min.ELEC_PRISE10 = 1; } // sonnette = conseil DS.BAT (non exigé par la norme)
  else if (pieceId === 'bureau') { min.ELEC_PRISE10 = 3; } // usage pièce principale : aligné sur la chambre (3 socles)
  else if (pieceId === 'terrasse' || pieceId === 'jardin' || pieceId === 'facade' || pieceId === 'carport') { /* extérieur : aucun socle imposé par la NF C 15-100 — prise étanche en option, jamais verrouillée */ }
  else { min.ELEC_PRISE10 = 1; } // autres locaux intérieurs (couloir, escalier, cave/buanderie, garage, dressing, véranda) : 1 socle
  // Chauffage électrique -> sortie de câble radiateur (fil pilote) dans les pièces de vie
  if (chantier && chantier.chauffage === 'electrique' && ['salon','salle_manger','chambre','bureau'].includes(pieceId)) min.ELEC_SC20_FP = 1;
  return min;
}

function recoDSBAT(pieceId, dims, ch, niveau) {
  dims = dims || {};
  niveau = niveau || 'standard';
  const surface = (dims.l || 0) * (dims.la || 0);
  const reco = {};

  // --- Conseils standard (expérience terrain) ---
  if ((pieceId === 'salon' || pieceId === 'salle_manger') && surface >= 20) {
    const nSup = surface >= 40 ? 2 : 1;
    reco.ELEC_PL_SA = { qte: nSup, raison: 'Séjour de ' + surface.toFixed(0) + ' m² : ' + (nSup > 1 ? nSup + ' points lumineux supplémentaires permettent' : 'un 2e point lumineux permet') + ' de zoner l\'éclairage' };
  }
  if (pieceId === 'cuisine' && surface >= 15) {
    reco.ELEC_PL_SUP = { qte: 1, raison: 'Grande cuisine / cuisine ouverte de ' + surface.toFixed(0) + ' m² : second point lumineux (zone repas ou plan de travail) sur la même commande' };
  }
  if (pieceId === 'couloir') {
    const longueur = Math.max(dims.l || 0, dims.la || 0);
    if (longueur >= 5) {
      const nSup = Math.min(3, Math.floor(longueur / 5));
      reco.ELEC_PL_SUP = { qte: nSup, raison: 'Couloir de ' + longueur + ' m : ' + nSup + ' point(s) lumineux supplémentaire(s) sur la même commande (un point tous les ~5 m)' };
    }
  }
  if (pieceId === 'escalier') {
    reco.ELEC_PL_SUP = { qte: 1, raison: 'Escalier : second point lumineux pour éclairer le haut et le bas sur la même commande' };
  }
  if (pieceId === 'jardin') {
    reco.ELEC_PL_SA = { qte: 1, raison: 'Éclairage de l\'allée / du jardin conseillé (non imposé par la norme)' };
  }
  if (pieceId === 'salon' && (dims.fenetres || 0) >= 2) {
    reco.ELEC_VOLET = { qte: dims.fenetres, raison: dims.fenetres + ' fenêtres : commandes de volets roulants recommandées' };
  }
  if (pieceId === 'chambre') {
    reco.ELEC_PRISED = { qte: 1, raison: 'Prise double supplémentaire côté lit (chevets, chargeurs)' };
  }
  if (pieceId === 'bureau') {
    reco.ELEC_PRISE10 = { qte: 2, raison: 'Télétravail : 2 prises supplémentaires au poste de travail' };
    reco.ELEC_RJ45 = { qte: 1, raison: 'Télétravail : liaison réseau filaire, plus stable que le Wi-Fi' };
  }
  if (pieceId === 'cuisine') {
    reco.ELEC_PRISED = { qte: 1, raison: 'Prise double supplémentaire sur le plan de travail (petit électroménager)' };
  }
  if (pieceId === 'sdb') {
    reco.ELEC_SECH_SERV = { qte: 1, raison: 'Sèche-serviette recommandé (confort salle de bain — non imposé par la norme)' };
  }
  if (pieceId === 'entree') {
    reco.ELEC_SONETTE = { qte: 1, raison: 'Sonnette / interphone recommandé à l\'entrée (non imposé par la norme)' };
  }
  if (pieceId === 'sdb' || pieceId === 'sde') {
    reco.ELEC_PL_APP = { qte: 1, raison: 'Double allumage conseillé : plafonnier (norme) + applique au-dessus du lavabo pour l\'éclairage du miroir' };
  }

  // --- Niveau confort : équipements d'usage et d'évolutivité ---
  if (niveau === 'confort') {
    const piecesDeVie = ['salon','salle_manger','chambre','bureau'];
    if (piecesDeVie.includes(pieceId)) {
      const cur = reco.ELEC_PRISED ? reco.ELEC_PRISED.qte : 0;
      reco.ELEC_PRISED = { qte: cur + 1, raison: (reco.ELEC_PRISED ? reco.ELEC_PRISED.raison + ' · ' : '') + 'Confort : prise double supplémentaire (évolutivité des usages)' };
    }
    if (piecesDeVie.includes(pieceId) && (dims.fenetres || 0) >= 1 && !reco.ELEC_VOLET) {
      reco.ELEC_VOLET = { qte: dims.fenetres, raison: 'Confort : motorisation des volets (' + dims.fenetres + ' fenêtre(s))' };
    }
    if (pieceId === 'salon') {
      reco.ELEC_RJ45 = { qte: 1, raison: 'Confort : RJ45 supplémentaire (TV connectée, box, console)' };
      if (ch && ch.chauffage === 'electrique') {
        reco.ELEC_THERMO = { qte: 1, raison: 'Confort : thermostat d\'ambiance pour piloter le chauffage électrique' };
      }
    }
  }

  return reco;
}


if (typeof module !== "undefined" && module.exports) module.exports = { getElecPourPiece, normeMin, recoDSBAT };
