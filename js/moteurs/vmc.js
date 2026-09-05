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


// =====================================================================
// M57 LOT10 — Socle de PRÉ-ÉTUDE VMC (couche BESOIN)
// =====================================================================
// besoinVmc(pieces, contexte) : fonction PURE qui dérive le BESOIN technique de
// ventilation (FONCTIONS par pièce) à partir de :
//   • les RÈGLES (obligationsVmc — non dupliquées, réutilisées) ;
//   • la CONFIGURATION retenue (choix client = piece.ventilationFonctions, LOT7-B) ;
//   • le CONTEXTE (intention / solution / périmètre) et le périmètre des pièces.
//
// Le besoin représente une FONCTION TECHNIQUE (SORTIE_AIR / ADMISSION_AIR / INSUFFLATION),
// PAS un produit tarifaire. Il n'émet AUCUN code catalogue, AUCUN prix, n'écrit RIEN
// (ni configuration tarifaire, ni variable globale, ni DOM) et produit une représentation
// même en l'absence de tarif.
//
// GARANTIES : pure/déterministe ; hors money-path ; « inconnue » n'est jamais convertie
// en simple flux (systeme reste 'inconnue', indetermine=true) ; l'insufflation (DF) n'est
// JAMAIS convertie en bouche/entrée d'air ; une pièce hors périmètre (piece.enScope===false)
// ne reçoit AUCUN besoin ; une obligation n'est jamais contournée par un choix client.
//
// contexte = { intention, solution, perimetre, metiersActifs }
// piece    = { id, numero?, ventilationFonctions?, enScope? }
// Sortie   = { systeme, indetermine, pieces:[ { pieceRef, roleP, fonctions:[
//              { fonction, cle, statut, origine, retenue, provenance } ] } ] }
function besoinVmc(pieces, contexte) {
  contexte = contexte || {};
  var systeme = contexte.solution || 'inconnue';
  var res = { systeme: systeme, indetermine: (systeme === 'inconnue'), pieces: [] };
  if (!Array.isArray(pieces)) return res;

  // Réconciliation règle ↔ choix client — MÊME contrat que fonctionsVmcRetenues (LOT7-B) ;
  // doit rester synchronisé avec lui (obligatoire→imposé ; recommande→proposé retirable ;
  // a_verifier→jamais imposé ; libre→choix client).
  var CLE = { SORTIE_AIR: 'extraction', ADMISSION_AIR: 'entree_air', INSUFFLATION: 'insufflation' };

  pieces.forEach(function (piece) {
    if (!piece || piece.enScope === false) return;              // hors périmètre → aucun besoin
    var enScope = (piece.enScope !== false);
    var ctxP = {
      intention: contexte.intention,
      solution: contexte.solution,
      perimetre: contexte.perimetre,
      pieceEnScope: enScope,
      metiersActifs: contexte.metiersActifs
    };
    var obl = obligationsVmc(piece.id, ctxP);
    var cles = Object.keys(obl);
    if (!cles.length) return;                                   // pièce sans rôle VMC → ignorée

    var choix = piece.ventilationFonctions || {};
    var fonctions = [];
    cles.forEach(function (key) {
      var cle = CLE[key];
      if (!cle) return;                                         // fonction inconnue → ignorée (aucune invention)
      var st = obl[key].statut, origine = obl[key].origine;
      var c = choix[cle];
      var retenue;
      if (st === 'obligatoire') retenue = true;
      else if (st === 'recommande') retenue = (c !== false);
      else if (st === 'a_verifier') retenue = false;
      else retenue = (c === true);
      var provenance = (st === 'obligatoire') ? 'regle' : ((c === true || c === false) ? 'client' : 'regle');
      fonctions.push({ fonction: key, cle: cle, statut: st, origine: origine, retenue: retenue, provenance: provenance });
    });

    res.pieces.push({
      pieceRef: (piece.numero != null ? piece.id + '#' + piece.numero : piece.id),
      roleP: _vmcRole(piece.id),                                // 'extraction' (service) | 'balayage' (principale)
      fonctions: fonctions
    });
  });

  return res;
}


// =====================================================================
// M57 LOT11 — DÉBITS VMC (débits théoriques de RÉFÉRENCE, pré-étude)
// =====================================================================
// debitsVmc(pieces, contexte, besoin) : fonction PURE qui associe aux fonctions du
// BESOIN (besoinVmc, LOT10) un DÉBIT THÉORIQUE DE RÉFÉRENCE, sans recalculer les règles.
//
// Socle : table de l'article 3 de l'arrêté du 24 mars 1982 (débits d'EXTRACTION de
// référence par pièce de service, selon le nombre de pièces PRINCIPALES du LOGEMENT).
// Ce débit est une RÉFÉRENCE DE CONCEPTION — jamais un débit mesuré, réglé, validé, ni
// une preuve de conformité. Les exceptions/réductions de l'arrêté (réglage, modulation)
// ne sont PAS implémentées ici.
//
// Bornes volontaires :
//   • ADMISSION_AIR (SF) : PAS de débit individuel inventé → statut 'a_equilibrer'
//     (l'admission se dimensionne à l'équilibre du système, lot ultérieur).
//   • INSUFFLATION (DF) : fonction DISTINCTE, PAS convertie en admission/bouche/entrée d'air,
//     aucune valeur réglementaire pièce par pièce inventée → statut 'a_dimensionner'.
//   • 'inconnue' n'est JAMAIS convertie en simple flux (indetermine=true).
//   • nombre de pièces principales inconnu / pièce d'extraction hors table (ex. cave) →
//     résultat prudent (débit null, statut 'indetermine'), aucune invention.
//   • Puits canadien / préconditionnement air neuf : NON modélisé ici ; l'architecture DF
//     reste compatible (l'insufflation reste 'a_dimensionner', la source d'air neuf est une
//     future sous-étude, pas figée comme prise extérieure directe).
//
// Hors money-path : aucun code catalogue, aucun prix, aucune écriture. Pure/déterministe.
//
// contexte = { ..., nbPiecesPrincipales }   // = nb de pièces principales DU LOGEMENT
//                                            //   (réutilise chantier.pieces déclaré, PAS pieces.length)
// besoin   = sortie de besoinVmc(...)
// Sortie   = { systeme, indetermine, nbPiecesPrincipales, unite, totalExtraction,
//              besoinAdmission, besoinInsufflation,
//              pieces:[ { pieceRef, fonctions:[
//                { fonction, debitReference, unite, origineDebit, statut } ] } ] }
function _tableArrete1982(nbPP) {
  var n = Math.max(1, parseInt(nbPP, 10) || 0);
  var cuisine = ({ 1: 75, 2: 90, 3: 105, 4: 120 })[n] || 135; // 5+ → 135
  return {
    cuisine: cuisine,
    sdb: (n <= 2) ? 15 : 30,      // salle de bains
    sde: 15,                      // autre salle d'eau (indépendant du nb de pièces)
    wcUnique: 15,                 // WC unique (indépendant du nb de pièces)
    wcMultiple: (n <= 3) ? 15 : 30 // WC multiples
  };
}
function debitsVmc(pieces, contexte, besoin) {
  contexte = contexte || {};
  besoin = besoin || { systeme: 'inconnue', indetermine: true, pieces: [] };
  var nbPP = parseInt(contexte.nbPiecesPrincipales, 10);
  var nbPPconnu = !isNaN(nbPP) && nbPP > 0;
  var tbl = nbPPconnu ? _tableArrete1982(nbPP) : null;

  var besoinPieces = Array.isArray(besoin.pieces) ? besoin.pieces : [];
  // WC unique vs multiples : dérivé des pièces étudiées (prudent, défaut = unique = valeur basse).
  var nbWc = besoinPieces.filter(function (p) { return String(p.pieceRef || '').split('#')[0] === 'wc'; }).length;

  var refExtraction = function (id) {
    if (!tbl) return null;
    if (id === 'cuisine') return tbl.cuisine;
    if (id === 'sdb') return tbl.sdb;
    if (id === 'sde') return tbl.sde;
    if (id === 'wc') return (nbWc >= 2) ? tbl.wcMultiple : tbl.wcUnique;
    return null; // cave / autre pièce d'extraction : hors table arrêté 1982 → prudent
  };

  var totalExtraction = 0, besoinAdmission = false, besoinInsufflation = false;
  var out = { systeme: besoin.systeme, indetermine: !!besoin.indetermine || !nbPPconnu,
    nbPiecesPrincipales: nbPPconnu ? nbPP : null, unite: 'm3/h',
    totalExtraction: 0, besoinAdmission: false, besoinInsufflation: false, pieces: [] };

  besoinPieces.forEach(function (p) {
    var id = String(p.pieceRef || '').split('#')[0];
    var fns = [];
    (p.fonctions || []).forEach(function (f) {
      var ligne = { fonction: f.fonction, debitReference: null, unite: 'm3/h', origineDebit: null, statut: 'indetermine' };
      if (f.fonction === 'SORTIE_AIR') {
        if (!f.retenue) { ligne.statut = 'a_verifier'; }
        else {
          var d = refExtraction(id);
          if (d != null) { ligne.debitReference = d; ligne.origineDebit = 'reglementaire'; ligne.statut = 'reference'; totalExtraction += d; }
          else { ligne.statut = 'indetermine'; } // nbPP inconnu ou pièce hors table
        }
      } else if (f.fonction === 'ADMISSION_AIR') {
        ligne.statut = f.retenue ? 'a_equilibrer' : 'a_verifier';   // pas de débit individuel inventé
        if (f.retenue) besoinAdmission = true;
      } else if (f.fonction === 'INSUFFLATION') {
        ligne.statut = f.retenue ? 'a_dimensionner' : 'a_verifier'; // fonction distincte, débit DF différé
        if (f.retenue) besoinInsufflation = true;
      }
      fns.push(ligne);
    });
    out.pieces.push({ pieceRef: p.pieceRef, fonctions: fns });
  });

  out.totalExtraction = totalExtraction;
  out.besoinAdmission = besoinAdmission;
  out.besoinInsufflation = besoinInsufflation;
  return out;
}


// =====================================================================
// M57 LOT12 — TOPOLOGIE FONCTIONNELLE VMC (vue dérivée)
// =====================================================================
// topologieVmc(pieces, contexte, besoin, debits) : fonction PURE qui DÉRIVE une topologie
// FONCTIONNELLE (pas aéraulique) à partir des couches LOT10/LOT11. Elle n'est PAS une
// source de vérité : elle recombine besoin (fonctions retenues) + debits (débits de
// référence) + contexte.solution. Aucune donnée nouvelle, aucune persistance, aucun DOM,
// aucun catalogue, aucun prix, aucun Runtime, aucune écriture. Pure/déterministe.
//
// Elle ne modélise AUCUN détail aéraulique : ni longueur, ni diamètre, ni section, ni
// branche/tronçon/coude/té, ni perte de charge, ni pression, ni produit (marque, échangeur,
// filtre G4/F7, débit machine, rendement).
//
// Séparation stricte des flux : extraction (SORTIE_AIR) et insufflation (INSUFFLATION,
// DF seulement) ne sont JAMAIS mélangés ; l'admission SF/hygro (ADMISSION_AIR) est un flux
// PASSIF (≠ insufflation mécanique). « inconnue » n'est jamais convertie en SF/hygro/DF.
//
// sourceAirNeuf (DF) est une interface EXTENSIBLE (direct | puits_horizontal | puits_vertical
// | inconnu) laissant possible un futur préconditionnement (puits canadien) SANS refonte ;
// défaut = 'inconnu' (jamais 'direct' inventé). rejet = interface extérieure (réutilise le
// déclaratif LOT6 via contexte.rejet ; sinon 'inconnu', aucune invention).
//
// contexte = { solution, rejet?, sourceAirNeuf? }   (rejet/sourceAirNeuf : déclaratifs LOT6, optionnels)
// besoin   = sortie besoinVmc(...) ; debits = sortie debitsVmc(...)
function topologieVmc(pieces, contexte, besoin, debits) {
  contexte = contexte || {};
  besoin = besoin || { systeme: 'inconnue', indetermine: true, pieces: [] };
  var systeme = contexte.solution || besoin.systeme || 'inconnue';
  var determine = (systeme === 'simple_flux' || systeme === 'hygro' || systeme === 'double_flux');

  // Index des débits de référence (LOT11) — repris tels quels, jamais recalculés ici.
  var debitIndex = {};
  var dp = (debits && Array.isArray(debits.pieces)) ? debits.pieces : [];
  dp.forEach(function (p) {
    (p.fonctions || []).forEach(function (f) {
      debitIndex[p.pieceRef + '|' + f.fonction] = (f.debitReference != null ? f.debitReference : null);
    });
  });

  var topo = {
    systeme: systeme,
    indetermine: !determine,
    flux: {
      extraction: { points: [] },
      insufflation: { points: [] },       // DF uniquement (vide sinon)
      admission_passive: { points: [] }   // SF/hygro (admission passive, ≠ mécanique)
    },
    centrale: null,
    sourceAirNeuf: null,
    rejet: null
  };

  (Array.isArray(besoin.pieces) ? besoin.pieces : []).forEach(function (p) {
    (p.fonctions || []).forEach(function (f) {
      if (f.retenue !== true) return;                       // fonction non retenue → absente de la topologie
      var debit = debitIndex.hasOwnProperty(p.pieceRef + '|' + f.fonction) ? debitIndex[p.pieceRef + '|' + f.fonction] : null;
      if (f.fonction === 'SORTIE_AIR') {
        topo.flux.extraction.points.push({ pieceRef: p.pieceRef, fonction: 'SORTIE_AIR', role: 'extraction', debit: debit });
      } else if (f.fonction === 'INSUFFLATION') {
        topo.flux.insufflation.points.push({ pieceRef: p.pieceRef, fonction: 'INSUFFLATION', role: 'insufflation', debit: debit });
      } else if (f.fonction === 'ADMISSION_AIR') {
        topo.flux.admission_passive.points.push({ pieceRef: p.pieceRef, fonction: 'ADMISSION_AIR', role: 'admission_passive', debit: debit });
      }
    });
  });

  // Centrale (minimale, fonctionnelle) uniquement si le système est déterminé.
  if (systeme === 'double_flux') {
    topo.centrale = { type: 'DF' };
    // Interface amont d'air neuf — extensible (préconditionnement/puits canadien futur).
    var srcTypes = { direct: 1, puits_horizontal: 1, puits_vertical: 1 };
    topo.sourceAirNeuf = { type: (contexte.sourceAirNeuf && srcTypes[contexte.sourceAirNeuf]) ? contexte.sourceAirNeuf : 'inconnu' };
    topo.rejet = { placement: (contexte.rejet === 'toiture' || contexte.rejet === 'facade') ? contexte.rejet : 'inconnu' };
  } else if (systeme === 'simple_flux' || systeme === 'hygro') {
    topo.centrale = { type: 'SF' };
    topo.rejet = { placement: (contexte.rejet === 'toiture' || contexte.rejet === 'facade') ? contexte.rejet : 'inconnu' };
  }
  // systeme 'inconnue' → centrale/sourceAirNeuf/rejet restent null (incertitude préservée).

  return topo;
}


// =====================================================================
// M57 LOT13 — PRÉ-DIMENSIONNEMENT AÉRAULIQUE VMC (V1, théorique)
// =====================================================================
// preDimensionnementVmc(pieces, contexte, besoin, debits, topologie) : fonction PURE,
// DÉRIVÉE de LOT10/11/12. Produit un premier niveau d'étude THÉORIQUE (débits de projet
// + débit théorique à couvrir par réseau) SANS dimensionnement physique.
//
// STRICTEMENT HORS V1 : diamètres, sections, vitesses, longueurs, cheminement, pertes de
// charge, pression, équilibrage réel, sélection produit, catalogue, prix, Runtime.
// Hors money-path : aucune écriture de configuration tarifaire, aucun code catalogue, aucun DOM/global.
//
// Débits : debitReglementaire = repris de LOT11 (jamais recalculé/diminué) ;
//   debitProjet = debitReglementaire par défaut (aucune majoration inventée, origine tracée) ;
//   debitTheoriqueACouvrir = débit que le futur système devra couvrir (≠ capacité d'un produit).
// DF : insufflation cible globale = débit de projet d'extraction, marquée « hypothèse
//   d'équilibrage double flux » (règle PRO, PAS une obligation réglementaire) ; AUCUNE
//   répartition individuelle inventée (débits par pièce d'insufflation restent null).
function preDimensionnementVmc(pieces, contexte, besoin, debits, topologie) {
  contexte = contexte || {};
  topologie = topologie || { systeme: 'inconnue', indetermine: true, flux: { extraction: { points: [] }, insufflation: { points: [] }, admission_passive: { points: [] } }, centrale: null, sourceAirNeuf: null, rejet: null };
  var systeme = topologie.systeme || contexte.solution || 'inconnue';
  var determine = (systeme === 'simple_flux' || systeme === 'hygro' || systeme === 'double_flux');

  var hypotheses = [], donneesManquantes = [], pointsAVerifier = [];
  var addDM = function (champ, impact) { donneesManquantes.push({ champ: champ, impact: impact }); };
  var addPV = function (type, description) { pointsAVerifier.push({ type: type, description: description }); };

  // --- Volumes dérivés (dims) — documentation / contrôle, aucun impact sur les débits ---
  var volMap = {};
  (Array.isArray(pieces) ? pieces : []).forEach(function (p) {
    if (!p) return;
    var ref = (p.numero != null ? p.id + '#' + p.numero : p.id);
    var d = p.dims || {};
    var l = +d.l || 0, la = +d.la || 0, h = +d.h || 0;
    volMap[ref] = (l > 0 && la > 0 && h > 0) ? Math.round(l * la * h * 10) / 10 : null;
  });
  var fluxRefs = {};
  ['extraction', 'insufflation', 'admission_passive'].forEach(function (k) {
    (((topologie.flux || {})[k] || {}).points || []).forEach(function (pt) { fluxRefs[pt.pieceRef] = true; });
  });
  var volumes = { total: 0, parPiece: {} };
  var totalConnu = true;
  Object.keys(fluxRefs).forEach(function (ref) {
    var v = volMap.hasOwnProperty(ref) ? volMap[ref] : null;
    volumes.parPiece[ref] = v;
    if (v == null) { totalConnu = false; addDM('dimensions_piece:' + ref, 'volume'); }
    else volumes.total += v;
  });
  volumes.total = totalConnu ? Math.round(volumes.total * 10) / 10 : null;

  // --- Réseaux (débits repris de LOT11 via la topologie ; projet = réglementaire par défaut) ---
  var reseaux = [];
  var sommeExtraction = 0, extractionComplet = true;
  var extractionPts = (((topologie.flux || {}).extraction || {}).points) || [];
  if (extractionPts.length) {
    var pts = extractionPts.map(function (pt) {
      var d = (pt.debit != null) ? pt.debit : null;
      if (d != null) sommeExtraction += d; else extractionComplet = false;
      return { pieceRef: pt.pieceRef, debitReglementaire: d, debitProjet: d };
    });
    if (!extractionComplet) addDM('debit_reference_extraction', 'debit_de_projet');
    reseaux.push({
      type: 'extraction',
      debitReglementaire: extractionComplet ? sommeExtraction : null,
      debitProjet: extractionComplet ? sommeExtraction : null,        // = réglementaire (défaut)
      debitTheoriqueACouvrir: extractionComplet ? sommeExtraction : null,
      points: pts,
      statut: extractionComplet ? 'theorique' : 'incomplet'
    });
  }

  var insufflationPts = (((topologie.flux || {}).insufflation || {}).points) || [];
  var cibleInsufflation = null;
  if (systeme === 'double_flux' && insufflationPts.length) {
    // Cible globale d'insufflation = débit de projet d'extraction (HYPOTHÈSE d'équilibrage).
    cibleInsufflation = extractionComplet ? sommeExtraction : null;
    hypotheses.push({ clef: 'equilibrage_df', valeur: 'insufflation ≈ extraction (cible globale)', origine: 'regle_pro' });
    addDM('repartition_insufflation', 'dimensionnement_aeraulique');
    addPV('technique', 'Répartition individuelle des débits d\'insufflation à définir en dimensionnement.');
    reseaux.push({
      type: 'insufflation',
      debitReglementaire: null,                                       // pas de débit réglementaire d'insufflation
      debitProjet: cibleInsufflation,                                 // cible globale (hypothèse d'équilibrage)
      debitTheoriqueACouvrir: cibleInsufflation,
      points: insufflationPts.map(function (pt) { return { pieceRef: pt.pieceRef, debitReglementaire: null, debitProjet: null }; }), // répartition non inventée
      statut: 'a_verifier'
    });
  }

  // --- Admission passive (SF/hygro) — besoin global compatible, jamais un réseau mécanique ---
  var admissionAir = null;
  var admPts = (((topologie.flux || {}).admission_passive || {}).points) || [];
  if ((systeme === 'simple_flux' || systeme === 'hygro') && admPts.length) {
    admissionAir = { type: 'passive', besoin: extractionComplet ? sommeExtraction : null, statut: 'a_equilibrer' };
  }

  // --- Centrale (débit théorique à couvrir, aucune sélection produit) ---
  var centrale = null;
  if (systeme === 'simple_flux' || systeme === 'hygro') {
    centrale = { type: 'SF', debitReglementaire: extractionComplet ? sommeExtraction : null,
      debitProjet: extractionComplet ? sommeExtraction : null, debitTheoriqueACouvrir: extractionComplet ? sommeExtraction : null };
  } else if (systeme === 'double_flux') {
    // À couvrir = max(extraction, insufflation) ; égales par hypothèse d'équilibrage.
    var couvrir = extractionComplet ? Math.max(sommeExtraction, cibleInsufflation || 0) : null;
    centrale = { type: 'DF', debitReglementaire: extractionComplet ? sommeExtraction : null,
      debitProjet: extractionComplet ? sommeExtraction : null, debitTheoriqueACouvrir: couvrir };
  }

  // --- Hypothèses & manques transverses ---
  if (determine) {
    hypotheses.push({ clef: 'debit_projet', valeur: '= débit réglementaire (aucun choix de conception spécifique)', origine: 'choix_dsbat' });
    ['longueurs_reseau', 'cheminement_reseau', 'diametres_sections', 'emplacement_centrale', 'donnees_pertes_de_charge']
      .forEach(function (c) { addDM(c, 'dimensionnement_aeraulique'); });
    addPV('chantier', 'Emplacement réel de la centrale et cheminement des réseaux à confirmer en visite.');
    addPV('technique', 'Diamètres, longueurs et pertes de charge relèvent du dimensionnement ultérieur.');
  } else {
    addPV('choix_client', 'Système de ventilation non déterminé : solution à préciser.');
  }

  // --- Statut global (synthétique, sans masquer les limites) ---
  var statut;
  if (!determine) statut = 'indetermine';
  else if (systeme === 'double_flux' || !extractionComplet) statut = 'incomplet';
  else statut = 'theorique';

  return {
    systeme: systeme,
    indetermine: !!topologie.indetermine || !determine,
    statut: statut,
    reseaux: reseaux,
    admissionAir: admissionAir,
    centrale: centrale,
    sourceAirNeuf: (topologie.sourceAirNeuf || null),
    rejet: (topologie.rejet || null),
    volumes: volumes,
    hypotheses: hypotheses,
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier
  };
}


// =====================================================================
// M57 LOT14 — PRÉ-CALCUL DE SECTION AÉRAULIQUE VMC (V1, théorique)
// =====================================================================
// preCalculSectionVmc(pieces, contexte, besoin, debits, topologie, preDim) : fonction PURE
// DÉRIVÉE (LOT10..13). Réalise UNIQUEMENT un pré-calcul THÉORIQUE de section sous
// HYPOTHÈSE de vitesse — PAS un dimensionnement réel de l'installation.
//
// Formule (et rien d'autre) : Q = V × S ⇒ S(m²) = Q(m³/h) / (3600 × V(m/s)).
// Diamètre ÉQUIVALENT géométrique (conversion, pas un choix) : D(mm) = √(4S/π) × 1000.
// Le diamètre équivalent N'EST PAS un diamètre retenu/requis/commercial/conforme : aucun
// arrondi vers un diamètre catalogue, aucune consultation catalogue.
//
// STRICTEMENT HORS V1 : pertes de charge, pression, équilibrage réel, sélection produit,
// réseau physique (branche/coude/té/segment/nœud/cheminement), plage min/max arbitraire,
// répartition d'insufflation inventée. Hors money-path : aucun code catalogue/prix/Runtime,
// aucune écriture (config tarifaire, pièces, persistance), aucun DOM. Pure/déterministe.
//
// Vitesse de conception : UNE hypothèse explicite tracée (origine 'hypothese_dsbat'),
// jamais présentée comme obligation réglementaire ; surchargée par contexte.vitesseConception
// si fournie (numérique > 0). Aucune vitesse par type/terminal.
var VITESSE_CONCEPTION_VMC = 4; // m/s — hypothèse DSBAT (plage professionnelle DTU 68.3, non réglementaire)
function preCalculSectionVmc(pieces, contexte, besoin, debits, topologie, preDim) {
  contexte = contexte || {};
  preDim = preDim || { systeme: 'inconnue', reseaux: [], admissionAir: null };
  var systeme = preDim.systeme || (topologie && topologie.systeme) || contexte.solution || 'inconnue';

  var vExt = (typeof contexte.vitesseConception === 'number' && contexte.vitesseConception > 0) ? contexte.vitesseConception : VITESSE_CONCEPTION_VMC;
  var vitesse = { valeur: vExt, unite: 'm/s', origine: 'hypothese_dsbat' };

  // S = Q/(3600·V) ; D = √(4S/π)·1000. Renvoie null si le débit n'est pas exploitable.
  function calc(debit) {
    if (typeof debit !== 'number' || !(debit > 0)) return { sectionTheorique: null, diametreEquivalent: null };
    var S = debit / (3600 * vExt);
    var Dmm = Math.sqrt(4 * S / Math.PI) * 1000;
    return {
      sectionTheorique: { valeur: Math.round(S * 100000) / 100000, unite: 'm2' },
      diametreEquivalent: { valeur: Math.round(Dmm * 10) / 10, unite: 'mm' }
    };
  }

  var FONCTION_PAR_TYPE = { extraction: 'SORTIE_AIR', insufflation: 'INSUFFLATION' };
  var reseaux = [], points = [], hypotheses = [], donneesManquantes = [], pointsAVerifier = [];
  hypotheses.push({ clef: 'vitesse_conception', valeur: vExt, unite: 'm/s', origine: 'hypothese_dsbat' });

  (Array.isArray(preDim.reseaux) ? preDim.reseaux : []).forEach(function (r) {
    // Niveau RÉSEAU : débit AGRÉGÉ propre au réseau (jamais appliqué aux points).
    var cr = calc(r.debitProjet);
    reseaux.push({
      type: r.type, debitProjet: (typeof r.debitProjet === 'number' ? r.debitProjet : null),
      vitesseHypothese: vitesse, sectionTheorique: cr.sectionTheorique, diametreEquivalent: cr.diametreEquivalent,
      statut: 'indicatif'
    });
    if (r.type === 'insufflation' && !(typeof r.debitProjet === 'number')) {
      addOnce(donneesManquantes, { champ: 'debit_insufflation', impact: 'section_insufflation' });
    }
    // Niveau POINT : débit PROPRE au point (≠ débit réseau). Insufflation sans débit → null.
    (Array.isArray(r.points) ? r.points : []).forEach(function (pt) {
      var dp = (typeof pt.debitProjet === 'number' ? pt.debitProjet : null);
      var cp = calc(dp);
      points.push({
        pieceRef: pt.pieceRef, fonction: (FONCTION_PAR_TYPE[r.type] || null),
        debitProjet: dp, vitesseHypothese: vitesse,
        sectionTheorique: cp.sectionTheorique, diametreEquivalent: cp.diametreEquivalent, statut: 'indicatif'
      });
      if (r.type === 'insufflation' && dp == null) {
        addPV(pointsAVerifier, 'technique', 'Débit individuel d\'insufflation non défini (' + pt.pieceRef + ') : section non calculable, à définir en dimensionnement.');
      }
    });
  });

  // Hypothèse d'équilibrage DF (reprise L13, jamais présentée comme obligation réglementaire).
  if (systeme === 'double_flux') {
    hypotheses.push({ clef: 'equilibrage_df', valeur: 'insufflation ≈ extraction (cible globale)', origine: 'regle_pro' });
  }

  // Admission passive (SF/hygro) : PAS de section mécanique (ce n'est pas une gaine).
  if (preDim.admissionAir && preDim.admissionAir.type === 'passive') {
    addPV(pointsAVerifier, 'technique', 'Admission d\'air PASSIVE (modules d\'entrée d\'air) : ce n\'est pas une gaine mécanique — aucune section de conduit calculée.');
  }

  // Limites du pré-calcul (empêchent d'aller au dimensionnement réel).
  ['longueurs_reseau', 'cheminement_reseau', 'branches_physiques', 'coudes', 'tes', 'reductions',
    'emplacement_centrale', 'caracteristiques_terminaux', 'donnees_pertes_de_charge',
    'pression_disponible', 'donnees_constructeur'].forEach(function (c) {
    addOnce(donneesManquantes, { champ: c, impact: 'dimensionnement_reel' });
  });
  addPV(pointsAVerifier, 'technique', 'Sections THÉORIQUES INDICATIVES sous hypothèse de vitesse — à confirmer par un dimensionnement réel (pertes de charge, pression, terminaux).');
  if (systeme !== 'simple_flux' && systeme !== 'hygro' && systeme !== 'double_flux') {
    addPV(pointsAVerifier, 'choix_client', 'Système de ventilation non déterminé : pré-calcul partiel.');
  }

  return {
    statut: 'pre_calcul_theorique',
    systeme: systeme,
    reseaux: reseaux,
    points: points,
    hypotheses: hypotheses,
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier
  };

  function addOnce(arr, obj) { if (!arr.some(function (x) { return x.champ === obj.champ; })) arr.push(obj); }
  function addPV(arr, type, description) { arr.push({ type: type, description: description }); }
}


if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC, obligationsVmc, besoinVmc, debitsVmc, topologieVmc, preDimensionnementVmc, preCalculSectionVmc };
