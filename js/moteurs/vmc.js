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


// =====================================================================
// M57 LOT15-A — PERTES DE CHARGE VMC (évaluateur PUR, partiel et traçable)
// =====================================================================
// pertesDeChargeVmc(pieces, contexte, preCalcul, donneesReseau, referentielPertes) :
// fonction PURE qui calcule des pertes de charge UNIQUEMENT à partir de données fournies
// en entrée. Elle est un ÉVALUATEUR : **aucun coefficient n'est écrit dans ce code**
// (ni Pa/m, ni ζ, ni ρ, ni marge). Tous viennent du `referentielPertes` (sourcé/versionné)
// et la géométrie de `donneesReseau` (relevé fourni). Sans référentiel exploitable OU sans
// géométrie → statut 'incomplet' + donneesManquantes (aucune valeur par défaut silencieuse).
//
// Modèle minimal : RÉSEAU → COLLECTEUR → ANTENNES (pas de graphe physique). Antenne reliée
// à une pièce via pieceRef (id#numero). Débit par tronçon = débit propre (antenne = son
// terminal ; collecteur = somme des antennes). DF = deux réseaux SÉPARÉS (jamais additionnés).
// Ne calcule NI pression disponible, NI pertes centrale/filtre/échangeur (données fabricant),
// NI marge. Ne conclut JAMAIS « conforme ». Hors money-path, aucune persistance, aucun DOM.
//
// referentielPertes attendu (données, pas de valeurs inventées ici) :
//   { methode, source, version, provenance, masseVolumiqueAir,
//     lineaire: { <conduit>: { <diametre_mm>: R_Pa_par_m } },
//     singulier: { <type>: { <geometrie>: { coefficient, source, version } } } }
// donneesReseau : { extraction: {antennes:[{pieceRef,debit,longueur,diametre,conduit,singularites:[{type,geometrie}]}], collecteur:{...}, cheminDefavorable?:[ref] }, insufflation:{...} }
function pertesDeChargeVmc(pieces, contexte, preCalcul, donneesReseau, referentielPertes) {
  preCalcul = preCalcul || { systeme: 'inconnue', reseaux: [] };
  donneesReseau = donneesReseau || {};
  var systeme = preCalcul.systeme || 'inconnue';
  var hypotheses = [], donneesManquantes = [], pointsAVerifier = [];
  var dm = function (champ, impact) { if (!donneesManquantes.some(function (x) { return x.champ === champ; })) donneesManquantes.push({ champ: champ, impact: impact }); };
  var pv = function (type, description) { pointsAVerifier.push({ type: type, description: description }); };
  var round = function (v) { return v == null ? null : Math.round(v * 100) / 100; };

  var refOk = !!(referentielPertes && referentielPertes.methode);
  var methode = refOk ? { methode: referentielPertes.methode, source: referentielPertes.source || null, version: referentielPertes.version || null, provenance: referentielPertes.provenance || null } : null;
  if (!refOk) { dm('referentiel_pertes', 'pertes_de_charge'); pv('technique', 'Référentiel de pertes (Pa/m, ζ, ρ) absent ou non identifié : aucune perte calculée.'); }

  // Accès référentiel (jamais de valeur par défaut : renvoie null si absent).
  function rLineaire(conduit, diametre) {
    if (!refOk || !referentielPertes.lineaire || conduit == null || diametre == null) return null;
    var t = referentielPertes.lineaire[conduit]; if (!t) return null;
    var v = t[diametre]; return (typeof v === 'number') ? v : null;
  }
  function zeta(type, geometrie) {
    if (!refOk || !referentielPertes.singulier || !referentielPertes.singulier[type]) return null;
    var g = referentielPertes.singulier[type][geometrie];
    return (g && typeof g.coefficient === 'number') ? g.coefficient : null;
  }
  // M57 LOT15-B : tolère les deux formes de masse volumique — nombre (compat) OU
  // contrat versionné { valeur, unite, source, version }. Aucune valeur par défaut.
  var _mva = refOk ? referentielPertes.masseVolumiqueAir : null;
  var rho = (typeof _mva === 'number') ? _mva : ((_mva && typeof _mva.valeur === 'number') ? _mva.valeur : null);

  // Perte linéaire d'un tronçon = R × L (R du référentiel). null si donnée absente.
  function perteLineaireTroncon(t) {
    var R = rLineaire(t.conduit, t.diametre);
    if (R == null) { if (refOk) dm('coefficient_lineaire:' + (t.conduit || '?') + '/' + (t.diametre || '?'), 'perte_lineaire'); return null; }
    if (typeof t.longueur !== 'number') { dm('longueur:' + (t.ref || t.role), 'perte_lineaire'); return null; }
    return R * t.longueur;
  }
  // Perte singulière = Σ ζ × ½ρV². null si une singularité connue n'a pas de coefficient.
  function perteSinguliereTroncon(t) {
    var sing = t.singularites || [];
    if (!sing.length) return 0; // aucune singularité déclarée → 0 (pas une valeur inventée)
    if (rho == null) { dm('masse_volumique_air', 'perte_singuliere'); return null; }
    if (typeof t.debit !== 'number' || typeof t.diametre !== 'number') { dm('debit_ou_diametre:' + (t.ref || t.role), 'perte_singuliere'); return null; }
    var S = Math.PI * Math.pow(t.diametre / 1000, 2) / 4; // section (m²) à partir du diamètre (mm)
    if (!(S > 0)) return null;
    var V = (t.debit / 3600) / S; // m/s
    var pdyn = 0.5 * rho * V * V;
    var somme = 0, complet = true;
    sing.forEach(function (s) {
      var z = zeta(s.type, s.geometrie);
      if (z == null) { complet = false; dm('coefficient_singulier:' + (s.type || '?') + '/' + (s.geometrie || '?'), 'perte_singuliere'); return; }
      somme += z * pdyn;
    });
    return complet ? somme : null;
  }

  if (systeme === 'double_flux') hypotheses.push({ clef: 'equilibrage_df', valeur: 'insufflation ≈ extraction (cible globale)', origine: 'regle_pro' });

  var reseaux = [];
  (Array.isArray(preCalcul.reseaux) ? preCalcul.reseaux : []).forEach(function (pr) {
    var type = pr.type; // extraction | insufflation
    var dr = donneesReseau[type];
    var out = { type: type, troncons: [], pertesLineaires: null, pertesSingulieres: null, pertesTerminaux: null, perteTotale: null, pressionNecessaire: null, statut: 'incomplet' };
    if (!refOk || !dr) { if (!dr) dm('donnees_reseau:' + type, 'geometrie'); reseaux.push(out); return; }

    // Tronçons = antennes (débit propre) + collecteur (somme des antennes si non fourni).
    var troncons = [];
    (dr.antennes || []).forEach(function (a) { troncons.push({ role: 'antenne', ref: (a.pieceRef || null), debit: a.debit, longueur: a.longueur, diametre: a.diametre, conduit: a.conduit, singularites: a.singularites }); });
    if (dr.collecteur) {
      var c = dr.collecteur;
      var debitCol = (typeof c.debit === 'number') ? c.debit : (dr.antennes || []).reduce(function (s, a) { return s + (typeof a.debit === 'number' ? a.debit : 0); }, 0);
      troncons.push({ role: 'collecteur', ref: 'collecteur', debit: debitCol, longueur: c.longueur, diametre: c.diametre, conduit: c.conduit, singularites: c.singularites });
    }

    var lin = 0, sing = 0, linComplet = true, singComplet = true;
    troncons.forEach(function (t) {
      var pl = perteLineaireTroncon(t);
      var ps = perteSinguliereTroncon(t);
      if (pl == null) linComplet = false; else lin += pl;
      if (ps == null) singComplet = false; else sing += ps;
      out.troncons.push({ role: t.role, ref: t.ref, debit: (t.debit != null ? t.debit : null), longueur: (t.longueur != null ? t.longueur : null), diametre: (t.diametre != null ? t.diametre : null), conduit: (t.conduit || null), pertesLineaires: round(pl), pertesSingulieres: round(ps) });
    });
    out.pertesLineaires = linComplet ? round(lin) : null;
    out.pertesSingulieres = singComplet ? round(sing) : null;

    // Perte totale / pression nécessaire : uniquement si le chemin est entièrement décrit.
    var complet = linComplet && singComplet && troncons.length > 0;
    if (Array.isArray(dr.cheminDefavorable) && dr.cheminDefavorable.length) {
      // Somme sur le chemin défavorable explicitement fourni.
      var parRef = {}; out.troncons.forEach(function (o) { parRef[o.ref] = o; });
      var somme = 0, chemComplet = true;
      dr.cheminDefavorable.forEach(function (ref) {
        var o = parRef[ref];
        if (!o || o.pertesLineaires == null || o.pertesSingulieres == null) { chemComplet = false; return; }
        somme += o.pertesLineaires + o.pertesSingulieres;
      });
      if (chemComplet) { out.perteTotale = round(somme); out.pressionNecessaire = round(somme); out.statut = 'calcule'; }
      else { pv('technique', 'Chemin défavorable (' + type + ') incomplètement décrit : pression non calculée.'); }
    } else if (complet) {
      out.perteTotale = round(lin + sing); out.pressionNecessaire = round(lin + sing); out.statut = 'calcule';
      pv('technique', 'Chemin ' + type + ' pris = collecteur + antennes décrits (arbre à 2 niveaux) — chemin défavorable explicite à confirmer.');
    } // sinon statut reste 'incomplet'

    reseaux.push(out);
  });

  // Pertes centrale / composants (filtre, échangeur, batterie, dégivrage) : jamais inventées.
  if (systeme === 'double_flux') { dm('pertes_centrale_df', 'pression'); pv('technique', 'Pertes internes centrale DF (filtre/échangeur/batterie/dégivrage) : données fabricant requises, non calculées.'); }
  pv('technique', 'Pression disponible de la centrale (courbe constructeur) non fournie : marge non évaluée.');

  var statutGlobal;
  if (systeme !== 'simple_flux' && systeme !== 'hygro' && systeme !== 'double_flux') statutGlobal = 'indetermine';
  else if (reseaux.length && reseaux.every(function (r) { return r.statut === 'calcule'; })) statutGlobal = 'calcule';
  else statutGlobal = 'incomplet';

  return {
    statut: statutGlobal,
    systeme: systeme,
    methode: methode,
    reseaux: reseaux,
    hypotheses: hypotheses,
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier
  };
}


// =====================================================================
// M57 LOT16 — ORCHESTRATEUR de PRÉ-ÉTUDE VMC (fonction pure)
// =====================================================================
// preEtudeVmc(pieces, contexte, options?) : enchaîne les couches PURES existantes
// (besoinVmc → debitsVmc → topologieVmc → preDimensionnementVmc → preCalculSectionVmc →
// pertesDeChargeVmc) et produit une ANALYSE d'étude agrégée. Il NE DUPLIQUE aucune règle :
// il ne fait que consommer/synthétiser les sorties. Pur, déterministe, hors money-path,
// aucune persistance, aucun prix/catalogue/Runtime, aucune donnée inventée.
//
// options = { donneesReseau?, referentielPertes? } (transmis à LOT15 ; absents → pertes
// incomplètes mais l'étude amont reste produite). Ne bloque JAMAIS toute l'étude.
// Chemins aérauliques : construits UNIQUEMENT si LOT15 fournit des pertes par tronçon
// (géométrie décrite) ; sinon signalés 'chemin_physique_non_decrit' (jamais fabriqués).
// N'affirme jamais la conformité ni le dimensionnement : statut ∈ etude_indeterminee | etude_partielle
// | etude_sous_hypotheses | etude_calculable, avec la RAISON explicite.
function preEtudeVmc(pieces, contexte, options) {
  options = options || {};
  contexte = contexte || {};

  // M57 LOT15-B : accepter le CONTRAT riche de données réseau ({reseaux:[…]}) et l'adapter
  // à la forme consommée par pertesDeChargeVmc (LOT15-A) — adaptation PURE, aucune règle ajoutée.
  if (options.donneesReseau && Array.isArray(options.donneesReseau.reseaux)) {
    options = Object.assign({}, options, { donneesReseau: adapterDonneesReseauPourPertes(options.donneesReseau) });
  }

  // --- Chaîne (aucune règle recréée) ---
  var besoin = besoinVmc(pieces, contexte);
  var debits = debitsVmc(pieces, contexte, besoin);
  var topologie = topologieVmc(pieces, contexte, besoin, debits);
  var preDim = preDimensionnementVmc(pieces, contexte, besoin, debits, topologie);
  var sections = preCalculSectionVmc(pieces, contexte, besoin, debits, topologie, preDim);
  var pertes = pertesDeChargeVmc(pieces, contexte, sections, options.donneesReseau, options.referentielPertes);

  var systeme = besoin.systeme;
  var determine = (systeme === 'simple_flux' || systeme === 'hygro' || systeme === 'double_flux');

  // --- Agrégation traçable des manques / points à vérifier / hypothèses ---
  var donneesManquantes = [], pointsAVerifier = [], hypotheses = [];
  var dm = function (champ, impact) { if (champ && !donneesManquantes.some(function (x) { return x.champ === champ; })) donneesManquantes.push({ champ: champ, impact: impact || null }); };
  var pv = function (o) { if (o && !pointsAVerifier.some(function (x) { return x.description === o.description; })) pointsAVerifier.push(o); };
  var hy = function (o) { if (o && !hypotheses.some(function (x) { return x.clef === o.clef; })) hypotheses.push(o); };
  [preDim, sections, pertes].forEach(function (layer) {
    (layer.donneesManquantes || []).forEach(function (d) { dm(d.champ, d.impact); });
    (layer.pointsAVerifier || []).forEach(function (p) { pv(p); });
    (layer.hypotheses || []).forEach(function (h) { hy(h); });
  });
  // Terminaux : caractéristiques constructeur jamais disponibles ici (débit/plages de pression).
  dm('caracteristiques_aerauliques_terminaux', 'validation_dimensionnement');

  // --- Chemins aérauliques (uniquement si pertes par tronçon disponibles) ---
  var chemins = { favorise: [], defavorise: [] };
  var cheminsCalcules = [];
  (pertes.reseaux || []).forEach(function (r) {
    var troncons = r.troncons || [];
    if (!troncons.length) return;
    var collecteur = troncons.filter(function (t) { return t.role === 'collecteur'; })[0] || null;
    var perteT = function (t) { return (t && t.pertesLineaires != null && t.pertesSingulieres != null) ? (t.pertesLineaires + t.pertesSingulieres) : null; };
    var pc = collecteur ? perteT(collecteur) : 0; // 0 si pas de collecteur décrit
    troncons.filter(function (t) { return t.role === 'antenne'; }).forEach(function (a) {
      var pa = perteT(a);
      if (pa == null || (collecteur && pc == null)) return; // chemin non calculable → non fabriqué
      cheminsCalcules.push({
        id: r.type + ':' + (a.ref || '?'), reseau: r.type,
        origine: collecteur ? 'collecteur' : (r.type === 'insufflation' ? 'centrale' : 'centrale'),
        destination: a.ref, points: collecteur ? [a.ref, 'collecteur'] : [a.ref],
        debitProjet: (a.debit != null ? a.debit : null),
        perteCalculable: Math.round((pa + (collecteur ? pc : 0)) * 100) / 100, statut: 'calcule'
      });
    });
  });
  if (cheminsCalcules.length) {
    var tri = cheminsCalcules.slice().sort(function (x, y) { return x.perteCalculable - y.perteCalculable; });
    chemins.favorise = [tri[0]];
    chemins.defavorise = [tri[tri.length - 1]];
  } else if (determine) {
    dm('chemin_physique_non_decrit', 'analyse_chemins');
    pv({ type: 'technique', description: 'Topologie physique des réseaux non décrite : chemins aérauliques (favorable/défavorable) non calculables.' });
  }

  // --- Synthèse (dérivée, sans invention) ---
  var reseauExt = (preDim.reseaux || []).filter(function (x) { return x.type === 'extraction'; })[0] || null;
  var reseauIns = (preDim.reseaux || []).filter(function (x) { return x.type === 'insufflation'; })[0] || null;
  var pertesCalc = (pertes.reseaux || []).map(function (x) { return x.perteTotale; }).filter(function (v) { return typeof v === 'number'; });
  var pressionCalculable = (pertes.reseaux || []).some(function (x) { return x.pressionNecessaire != null; });
  var synthese = {
    debitExtraction: reseauExt ? reseauExt.debitProjet : null,
    debitInsufflation: reseauIns ? reseauIns.debitProjet : null,   // DF : cible d'équilibrage (hypothèse)
    sectionReseaux: (sections.reseaux || []).map(function (x) { return { type: x.type, sectionTheorique: x.sectionTheorique, diametreEquivalent: x.diametreEquivalent }; }),
    perteMaxCalculable: pertesCalc.length ? Math.max.apply(null, pertesCalc) : null,
    pressionNecessaireCalculable: pressionCalculable
  };

  // --- Statut d'étude + raison explicite ---
  var statutEtude, raisonStatut;
  if (!determine) { statutEtude = 'etude_indeterminee'; raisonStatut = 'Système de ventilation non déterminé (solution ' + systeme + ').'; }
  else if (!(sections.reseaux || []).length) { statutEtude = 'etude_partielle'; raisonStatut = 'Aucun réseau fonctionnel retenu (aucune fonction en périmètre).'; }
  else if (pertes.statut === 'calcule') { statutEtude = 'etude_calculable'; raisonStatut = 'Pertes de charge calculables sur les réseaux décrits (référentiel + géométrie fournis).'; }
  else if (synthese.sectionReseaux.some(function (s) { return s.sectionTheorique != null; })) { statutEtude = 'etude_sous_hypotheses'; raisonStatut = 'Sections théoriques obtenues sous hypothèse de vitesse ; pertes de charge non entièrement calculables (référentiel/relevé de visite manquants).'; }
  else { statutEtude = 'etude_partielle'; raisonStatut = 'Débits obtenus mais sections/pertes indisponibles.'; }

  // --- Données de visite à relever (liste structurée, PAS un formulaire) ---
  var donneesVisite = ['longueurs_troncons', 'diametres_sections_reels', 'type_conduit', 'etat_conduit_existant',
    'coudes', 'tes', 'reductions', 'localisation_caisson', 'localisation_rejet', 'localisation_prise_air_neuf',
    'caracteristiques_terminaux', 'caracteristiques_groupe', 'references_constructeur', 'obstacles_traversees'];
  if (systeme === 'double_flux') donneesVisite.push('elements_specifiques_df');

  // --- Limites explicites ---
  var limites = [
    'Sections issues d\'une hypothèse de vitesse (pré-calcul théorique), non d\'un dimensionnement réel.',
    'Pertes de charge dépendantes d\'un référentiel sourcé et d\'un relevé de visite (géométrie réelle).',
    'Pression disponible de la centrale (courbe constructeur) et pertes internes (filtre/échangeur/batterie) non évaluées.',
    'Aucune validation de conformité, aucune sélection produit, aucun équilibrage réel.',
    'Existant physique (réseaux conservés/à déposer) non modélisé.'
  ];

  return {
    systeme: systeme,
    statutEtude: statutEtude,
    raisonStatut: raisonStatut,
    indetermine: !determine,
    besoin: besoin,
    debits: debits,
    topologie: topologie,
    preDimensionnement: preDim,
    sections: sections,
    pertes: pertes,
    chemins: chemins,
    synthese: synthese,
    donneesVisite: donneesVisite,
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier,
    hypotheses: hypotheses,
    limites: limites
  };
}


// =====================================================================
// M57 LOT15-B — CONTRAT « données réseau » + « référentiel de pertes »
// =====================================================================
// Couche de MODÈLE/CONTRAT pure : construit et valide des structures déclaratives
// (données physiques relevées, référentiel sourcé) SANS calculer, SANS inventer de valeur,
// SANS persistance, SANS money-path, SANS UI. Une donnée absente reste null (jamais 0/défaut).
// LOT15-A/LOT16 les EXPLOITENT ; LOT15-B ne fait que les préparer/normaliser.

// Catégories de provenance (réutilisées dans toute la chaîne). 'test' = jamais production.
var PROVENANCE_VMC = { VISITE: 'visite', CONSTRUCTEUR: 'constructeur', REFERENTIEL: 'referentiel', CLIENT: 'client', HYPOTHESE_DSBAT: 'hypothese_dsbat', TEST: 'test' };

function _nombreOuNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
function _ouNull(v) { return (v == null) ? null : v; }

// Normalise un jeu de données réseau (contrat riche). Champs absents → null (aucun défaut).
// Distingue le RELEVÉ (diametre/section) du PROJETÉ (diametreProjet) — jamais écrasés l'un par l'autre.
function creerDonneesReseau(spec) {
  spec = spec || {};
  var out = { reseaux: [], centrale: null, priseAirNeuf: null, rejet: null };
  (Array.isArray(spec.reseaux) ? spec.reseaux : []).forEach(function (r) {
    if (!r || (r.type !== 'extraction' && r.type !== 'insufflation')) return; // type obligatoire, sinon ignoré (jamais deviné)
    // M57 LOT29 (additif) : liste des nœuds du réseau (arêtes du graphe). Vide si non décrite.
    var reseau = { id: _ouNull(r.id), type: r.type, noeuds: (Array.isArray(r.noeuds) ? r.noeuds.map(function (n) { return { id: _ouNull(n && n.id != null ? n.id : n), type: _ouNull(n && n.type) }; }) : []), troncons: [], terminaux: [] };
    (Array.isArray(r.troncons) ? r.troncons : []).forEach(function (t) {
      reseau.troncons.push({
        id: _ouNull(t.id), role: _ouNull(t.role), origine: _ouNull(t.origine), destination: _ouNull(t.destination), pieceRef: _ouNull(t.pieceRef),
        noeudAmont: _ouNull(t.noeudAmont), noeudAval: _ouNull(t.noeudAval), // M57 LOT29 (additif) : arête orientée du graphe
        donneesPose: _ouNull(t.donneesPose), // M57 LOT30-A (additif) : observation d'état de pose, conservée sans transformation
        longueur: _nombreOuNull(t.longueur), uniteLongueur: (t.longueur != null ? 'm' : null),
        debit: _nombreOuNull(t.debit),
        diametre: _nombreOuNull(t.diametre),          // RELEVÉ réel
        section: _nombreOuNull(t.section),            // RELEVÉ réel
        diametreProjet: _nombreOuNull(t.diametreProjet), // THÉORIQUE (LOT14), distinct du relevé
        typeConduit: _ouNull(t.typeConduit),
        singularites: (Array.isArray(t.singularites) ? t.singularites : []).map(function (s) {
          return { type: _ouNull(s.type), quantite: _nombreOuNull(s.quantite), geometrie: _ouNull(s.geometrie), reference: _ouNull(s.reference) };
        }),
        provenance: _ouNull(t.provenance)
      });
    });
    (Array.isArray(r.terminaux) ? r.terminaux : []).forEach(function (tm) {
      reseau.terminaux.push({ id: _ouNull(tm.id), pieceRef: _ouNull(tm.pieceRef), fonction: _ouNull(tm.fonction), reference: _ouNull(tm.reference), noeudId: _ouNull(tm.noeudId), debit: _nombreOuNull(tm.debit), provenance: _ouNull(tm.provenance) });
    });
    out.reseaux.push(reseau);
  });
  var interface3 = function (o) { return o ? { type: _ouNull(o.type), reference: _ouNull(o.reference), provenance: _ouNull(o.provenance) } : null; };
  if (spec.centrale) out.centrale = interface3(spec.centrale);
  if (spec.priseAirNeuf) out.priseAirNeuf = interface3(spec.priseAirNeuf);
  if (spec.rejet) out.rejet = interface3(spec.rejet);
  return out;
}

// Signale (sans inventer) les données physiques absentes d'un jeu de données réseau.
function validerDonneesReseau(donneesReseau) {
  var manques = [];
  var add = function (champ) { if (!manques.some(function (x) { return x.champ === champ; })) manques.push({ champ: champ, impact: 'pertes_de_charge' }); };
  var reseaux = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  if (!reseaux.length) add('donnees_reseau');
  reseaux.forEach(function (r) {
    (r.troncons || []).forEach(function (t) {
      var ref = (t.id || t.pieceRef || t.role || 'troncon');
      if (t.longueur == null) add('longueur:' + ref);
      if (t.diametre == null && t.section == null) add('diametre_ou_section:' + ref);
      if (t.typeConduit == null) add('type_conduit:' + ref);
      (t.singularites || []).forEach(function (s) { if (!s.geometrie) add('geometrie_singularite:' + (s.type || '?')); });
    });
  });
  return { valide: manques.length === 0, donneesManquantes: manques };
}

// Adapte le contrat riche → forme consommée par pertesDeChargeVmc (LOT15-A) : par type de
// réseau, { antennes:[…], collecteur }. Les quantités de singularités sont dépliées (LOT15-A
// somme une entrée par singularité). Extraction et insufflation restent SÉPARÉES.
function adapterDonneesReseauPourPertes(donneesReseau) {
  if (!donneesReseau || !Array.isArray(donneesReseau.reseaux)) return donneesReseau || {};
  var out = {};
  donneesReseau.reseaux.forEach(function (r) {
    var antennes = [], collecteur = null, chemin = null;
    (r.troncons || []).forEach(function (t) {
      var role = t.role || (t.pieceRef ? 'antenne' : 'collecteur');
      var sing = [];
      (t.singularites || []).forEach(function (s) { var n = Math.max(1, t == null ? 1 : (s.quantite || 1)); for (var i = 0; i < n; i++) sing.push({ type: s.type, geometrie: s.geometrie }); });
      var noeud = { pieceRef: t.pieceRef, debit: t.debit, longueur: t.longueur, diametre: t.diametre, conduit: t.typeConduit, singularites: sing };
      if (role === 'collecteur') collecteur = noeud; else antennes.push(noeud);
    });
    out[r.type] = { antennes: antennes, collecteur: collecteur };
    if (Array.isArray(r.cheminDefavorable)) out[r.type].cheminDefavorable = r.cheminDefavorable;
  });
  return out;
}

// Construit le CONTRAT du référentiel de pertes (versionné/sourcé). NE REMPLIT AUCUN
// coefficient : lineaire/singulier/composants restent tels que fournis (vides si non fournis).
// Aucune marge, aucun coefficient universel, aucune valeur par défaut cachée.
function creerReferentielPertes(spec) {
  spec = spec || {};
  var mva = spec.masseVolumiqueAir;
  return {
    id: _ouNull(spec.id), methode: _ouNull(spec.methode), source: _ouNull(spec.source), version: _ouNull(spec.version),
    provenance: _ouNull(spec.provenance), dateValidation: _ouNull(spec.dateValidation),
    masseVolumiqueAir: mva ? { valeur: _nombreOuNull(mva.valeur), unite: 'kg/m3', source: _ouNull(mva.source), version: _ouNull(mva.version) } : null,
    lineaire: (spec.lineaire && typeof spec.lineaire === 'object') ? spec.lineaire : {},   // vide → LOT15-A renverra incomplet
    singulier: (spec.singulier && typeof spec.singulier === 'object') ? spec.singulier : {},
    composants: (spec.composants && typeof spec.composants === 'object') ? spec.composants : {},
    domaines: _ouNull(spec.domaines)
  };
}

// Valide la présence des méta-données obligatoires du référentiel (sans juger les valeurs).
function validerReferentielPertes(ref) {
  var manques = [];
  var need = function (champ, ok) { if (!ok) manques.push({ champ: champ, impact: 'referentiel_pertes' }); };
  need('id', ref && ref.id != null);
  need('methode', ref && ref.methode != null);
  need('source', ref && ref.source != null);
  need('version', ref && ref.version != null);
  need('dateValidation', ref && ref.dateValidation != null);
  need('masseVolumiqueAir', ref && ref.masseVolumiqueAir && typeof ref.masseVolumiqueAir.valeur === 'number');
  var vide = !ref || ((!ref.lineaire || !Object.keys(ref.lineaire).length) && (!ref.singulier || !Object.keys(ref.singulier).length));
  if (vide) manques.push({ champ: 'coefficients_pertes', impact: 'referentiel_pertes' });
  return { valide: manques.length === 0, manques: manques, provenanceProduction: !!(ref && ref.provenance && ref.provenance !== PROVENANCE_VMC.TEST) };
}

// Liste structurée des champs à relever en visite (pas de formulaire, juste le modèle).
function champsReleveVisite(systeme) {
  var base = ['longueurs_troncons', 'diametres_sections_reels', 'type_conduit', 'etat_conduit_existant', 'coudes', 'tes', 'reductions',
    'terminaux', 'localisation_caisson', 'localisation_prise_air_neuf', 'localisation_rejet', 'reference_groupe', 'reference_terminaux', 'donnees_constructeur'];
  if (systeme === 'double_flux') base = base.concat(['elements_specifiques_df']);
  return base;
}


// =====================================================================
// M57 LOT17-A — ANALYSE PRESSION DISPONIBLE / ÉQUILIBRE AÉRAULIQUE VMC
// =====================================================================
// analysePressionVmc(pieces, contexte, preEtude, donneesTechnique?) : fonction PURE qui
// COMPARE, par réseau, la PRESSION DISPONIBLE (donnée EXTERNE fournie) aux PERTES NÉCESSAIRES
// (calculées en amont : LOT15/LOT16) + pertes composants/terminaux UNIQUEMENT si fournies.
// Ne sélectionne aucun produit, ne crée aucun prix, ne conclut jamais « conforme », n'invente
// aucune pression/perte/marge. « non renseigné » ≠ « 0 Pa ». Hors money-path, aucune persistance.
//
// donneesTechnique = {
//   pressionDisponible: { <type>: { valeur, unite:'Pa', debitReference, source, version, provenance } },
//   composants:        { <type>: [ { composant, valeur, unite:'Pa', source, version, provenance } ] }, // optionnel
//   terminaux:         { <type>: { valeur, unite:'Pa', debitReference, source, version, provenance } }  // optionnel
// }   avec <type> ∈ { extraction, insufflation }.
function analysePressionVmc(pieces, contexte, preEtude, donneesTechnique) {
  preEtude = preEtude || {};
  donneesTechnique = donneesTechnique || {};
  var systeme = preEtude.systeme || 'inconnue';
  var determine = (systeme === 'simple_flux' || systeme === 'hygro' || systeme === 'double_flux');
  var dispoIn = donneesTechnique.pressionDisponible || {};
  var compIn = donneesTechnique.composants || {};
  var termIn = donneesTechnique.terminaux || {};

  var donneesManquantes = [], pointsAVerifier = [], hypotheses = [], limites = [];
  var dm = function (champ, impact) { if (champ && !donneesManquantes.some(function (x) { return x.champ === champ; })) donneesManquantes.push({ champ: champ, impact: impact || null }); };
  var pv = function (o) { if (o && !pointsAVerifier.some(function (x) { return x.description === o.description; })) pointsAVerifier.push(o); };
  (preEtude.hypotheses || []).forEach(function (h) { if (h.clef === 'equilibrage_df') hypotheses.push({ clef: h.clef, valeur: h.valeur, origine: 'hypothese' }); });

  var num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : null; };
  var pertesReseauLot15 = (preEtude.pertes && Array.isArray(preEtude.pertes.reseaux)) ? preEtude.pertes.reseaux : [];
  var preDimReseaux = (preEtude.preDimensionnement && Array.isArray(preEtude.preDimensionnement.reseaux)) ? preEtude.preDimensionnement.reseaux : [];
  var cheminsPre = preEtude.chemins || { favorise: [], defavorise: [] };
  var debitPourType = function (type) { var r = preDimReseaux.filter(function (x) { return x.type === type; })[0]; return r ? num(r.debitProjet) : null; };
  var cheminType = function (arr, type) { var c = (arr || []).filter(function (x) { return x.reseau === type; })[0]; return c || null; };

  var reseaux = [];
  pertesReseauLot15.forEach(function (pr) {
    var type = pr.type; // extraction | insufflation
    var debitEtudie = debitPourType(type);
    var debitOrigine = (type === 'insufflation') ? 'hypothese' : 'projet'; // DF insufflation = cible d'équilibrage

    // Pertes réseau calculées (LOT15, chemin décrit). null → incomplet.
    var pReseau = num(pr.pressionNecessaire);

    // Composants centrale + terminaux : ajoutés SEULEMENT si fournis ; sinon signalés (jamais 0).
    var comps = Array.isArray(compIn[type]) ? compIn[type] : null;
    var somComp = null, compComplet = true;
    if (comps) { somComp = 0; comps.forEach(function (c) { var v = num(c.valeur); if (v == null) compComplet = false; else somComp += v; }); }
    else { dm('pertes_internes_centrale_non_documentees:' + type, 'pression_necessaire'); }
    var term = termIn[type] || null; var pTerm = term ? num(term.valeur) : null;
    if (!term) dm('pertes_terminaux_non_documentees:' + type, 'pression_necessaire');

    var pertesNecessaires = null, detail = null, complet = true;
    if (pReseau != null) {
      var total = pReseau + (somComp != null ? somComp : 0) + (pTerm != null ? pTerm : 0);
      detail = { reseau: pReseau, composants: (somComp != null ? Math.round(somComp * 100) / 100 : null), terminaux: pTerm };
      pertesNecessaires = { valeur: Math.round(total * 100) / 100, unite: 'Pa', detail: detail };
      if (!comps || !compComplet || !term) complet = false; // termes manquants → total = borne inférieure
    } else { dm('pertes_reseau_non_calculables:' + type, 'pression_necessaire'); }

    // Pression disponible (externe). Provenance conservée. Débit de référence vérifié.
    var dispoBrut = dispoIn[type] || null;
    var pressionDisponible = null, debitCompatible = null;
    if (dispoBrut && num(dispoBrut.valeur) != null) {
      pressionDisponible = { valeur: num(dispoBrut.valeur), unite: 'Pa', debitReference: num(dispoBrut.debitReference),
        source: (dispoBrut.source || null), version: (dispoBrut.version || null), provenance: (dispoBrut.provenance || null) };
      var dref = pressionDisponible.debitReference;
      debitCompatible = (dref != null && debitEtudie != null && dref === debitEtudie);
      if (!debitCompatible) { dm('debit_reference_incompatible:' + type, 'comparaison'); pv({ type: 'technique', description: 'Pression disponible ' + type + ' documentée à un débit différent du débit étudié : comparaison non applicable telle quelle.' }); }
    } else { dm('pression_disponible_groupe:' + type, 'comparaison'); }

    // Marge = disponible − nécessaire, UNIQUEMENT si les deux connues et débit compatible.
    var margePa = null, statut;
    if (!determine) statut = 'indetermine';
    else if (pertesNecessaires == null || pressionDisponible == null) statut = 'incomplet';
    else if (debitCompatible === false) statut = 'a_verifier';
    else {
      margePa = Math.round((pressionDisponible.valeur - pertesNecessaires.valeur) * 100) / 100;
      if (!complet) statut = 'a_verifier'; // pertes nécessaires incomplètes → marge = borne, à confirmer
      else if (margePa < 0) statut = 'pression_insuffisante';
      else statut = 'comparaison_possible';
    }

    reseaux.push({
      type: type, base: 'projete', // l'analyse porte sur la topologie projetée/étudiée (existant physique non modélisé)
      debitEtudie: debitEtudie, uniteDebit: 'm3/h', debitOrigine: debitOrigine,
      cheminFavorise: cheminType(cheminsPre.favorise, type),
      cheminDefavorise: cheminType(cheminsPre.defavorise, type),
      pressionDisponible: pressionDisponible,
      pertesNecessaires: pertesNecessaires,
      margePa: margePa,
      statut: statut
    });
  });

  if (!reseaux.length && determine) pv({ type: 'technique', description: 'Aucun réseau exploitable pour l\'analyse de pression.' });
  if (!cheminsPre.favorise.length && determine) dm('chemin_physique_non_decrit', 'analyse_chemins');

  // --- Synthèse ---
  var dispoConnues = reseaux.map(function (r) { return r.pressionDisponible ? r.pressionDisponible.valeur : null; }).filter(function (v) { return v != null; });
  var necConnues = reseaux.map(function (r) { return r.pertesNecessaires ? r.pertesNecessaires.valeur : null; }).filter(function (v) { return v != null; });
  var comparables = reseaux.filter(function (r) { return r.margePa != null; });
  var plusContraignant = null;
  comparables.forEach(function (r) { if (!plusContraignant || r.margePa < plusContraignant.margePa) plusContraignant = r; });
  var synthese = {
    comparaisonPossible: comparables.length > 0,
    reseauLePlusContraignant: plusContraignant ? plusContraignant.type : null,
    pressionDisponibleMaximaleConnue: dispoConnues.length ? Math.max.apply(null, dispoConnues) : null,
    pressionNecessaireMaximaleCalculable: necConnues.length ? Math.max.apply(null, necConnues) : null
  };

  // --- Statut global + raison ---
  var statutGlobal, raisonStatut;
  if (!determine) { statutGlobal = 'indetermine'; raisonStatut = 'Système non déterminé (' + systeme + ').'; }
  else if (reseaux.some(function (r) { return r.statut === 'pression_insuffisante'; })) { statutGlobal = 'pression_insuffisante'; raisonStatut = 'Au moins un réseau présente une marge négative sur les données fournies.'; }
  else if (comparables.length && comparables.every(function (r) { return r.statut === 'comparaison_possible'; })) { statutGlobal = 'comparaison_possible'; raisonStatut = 'Pression disponible et pertes nécessaires connues sur le(s) réseau(x), débit compatible.'; }
  else if (reseaux.some(function (r) { return r.statut === 'a_verifier'; })) { statutGlobal = 'a_verifier'; raisonStatut = 'Comparaison partielle : termes de perte non documentés ou débit de référence à confirmer.'; }
  else { statutGlobal = 'incomplet'; raisonStatut = 'Pression disponible et/ou pertes nécessaires manquantes.'; }

  limites = [
    'Comparaison sur une pression disponible ponctuelle fournie (pas de courbe débit/pression ; interpolation non réalisée).',
    'Pertes internes de centrale et pertes terminaux prises en compte uniquement si documentées (données constructeur).',
    'Analyse sur la topologie projetée/étudiée ; existant physique relevé non distingué.',
    'Aucune sélection produit, aucune conclusion de conformité, aucune marge de sécurité imposée.'
  ];

  return {
    systeme: systeme,
    statut: statutGlobal,
    raisonStatut: raisonStatut,
    reseaux: reseaux,
    synthese: synthese,
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier,
    hypotheses: hypotheses,
    limites: limites
  };
}


// =====================================================================
// M57 LOT17-B — DONNÉES CONSTRUCTEUR / COURBES DÉBIT-PRESSION VMC
// =====================================================================
// Couche de DONNÉES + ÉVALUATION PURE. Décrit des groupes/terminaux constructeur et
// fournit à LOT17-A une pression disponible AU DÉBIT ÉTUDIÉ (point exact ou interpolation
// entre deux points encadrants). AUCUNE extrapolation, AUCUNE valeur par défaut, AUCUNE
// sélection de produit, AUCUN prix/Runtime/catalogue, AUCUNE conformité. Provenance conservée.

function _num17(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
function _null17(v) { return (v == null) ? null : v; }

// Normalise un groupe VMC constructeur (contrat déclaratif). Points de courbe invalides écartés.
function creerGroupeVmc(spec) {
  spec = spec || {};
  var courbe = (Array.isArray(spec.courbe) ? spec.courbe : []).map(function (p) {
    return { debit: _num17(p && p.debit), uniteDebit: 'm3/h', pression: _num17(p && p.pression), unitePression: 'Pa' };
  }).filter(function (p) { return p.debit != null && p.pression != null; });
  var perte = function (o) { return o ? { valeur: _num17(o.valeur), unite: 'Pa', debitReference: _num17(o.debitReference), source: _null17(o.source), version: _null17(o.version), provenance: _null17(o.provenance) } : null; };
  var pi = spec.pertesInternes || {};
  return {
    id: _null17(spec.id), type: (spec.type === 'SF' || spec.type === 'DF') ? spec.type : null,
    fabricant: _null17(spec.fabricant), reference: _null17(spec.reference), source: _null17(spec.source), version: _null17(spec.version), provenance: _null17(spec.provenance),
    courbe: courbe,
    plageFonctionnement: spec.plageFonctionnement ? { debitMin: _num17(spec.plageFonctionnement.debitMin), debitMax: _num17(spec.plageFonctionnement.debitMax), pressionMin: _num17(spec.plageFonctionnement.pressionMin), pressionMax: _num17(spec.plageFonctionnement.pressionMax) } : null,
    pertesInternes: { filtre: perte(pi.filtre), echangeur: perte(pi.echangeur), batterie: perte(pi.batterie) }
  };
}

// Normalise un terminal constructeur.
function creerTerminalVmc(spec) {
  spec = spec || {};
  var courbe = (Array.isArray(spec.courbe) ? spec.courbe : []).map(function (p) {
    return { debit: _num17(p && p.debit), uniteDebit: 'm3/h', pression: _num17(p && p.pression), unitePression: 'Pa' };
  }).filter(function (p) { return p.debit != null && p.pression != null; });
  return {
    id: _null17(spec.id), fabricant: _null17(spec.fabricant), reference: _null17(spec.reference), type: _null17(spec.type),
    courbe: courbe,
    plageFonctionnement: spec.plageFonctionnement ? { debitMin: _num17(spec.plageFonctionnement.debitMin), debitMax: _num17(spec.plageFonctionnement.debitMax), pressionMin: _num17(spec.plageFonctionnement.pressionMin), pressionMax: _num17(spec.plageFonctionnement.pressionMax) } : null,
    source: _null17(spec.source), version: _null17(spec.version), provenance: _null17(spec.provenance)
  };
}

// Évalue une courbe débit/pression au débit étudié. Point exact OU interpolation linéaire
// entre deux points ENCADRANTS. Hors intervalle → 'hors_courbe' (extrapolation REFUSÉE).
// Courbe vide → 'donnee_absente'. Provenance conservée. Aucune pression inventée.
function evaluerCourbeVmc(courbe, debitEtudie, meta) {
  meta = meta || {};
  var base = { debitEtudie: _num17(debitEtudie), unitePression: 'Pa', pression: null, methode: null, pointsSource: null,
    fabricant: _null17(meta.fabricant), reference: _null17(meta.reference), source: _null17(meta.source), version: _null17(meta.version), provenance: _null17(meta.provenance) };
  var pts = (Array.isArray(courbe) ? courbe : []).filter(function (p) { return p && typeof p.debit === 'number' && typeof p.pression === 'number'; });
  if (!pts.length) { base.statut = 'donnee_absente'; base.raison = 'courbe vide ou sans point valide'; return base; }
  if (typeof debitEtudie !== 'number') { base.statut = 'a_verifier'; base.raison = 'débit étudié non fourni'; return base; }
  pts = pts.slice().sort(function (a, b) { return a.debit - b.debit; });
  var exact = pts.filter(function (p) { return p.debit === debitEtudie; })[0];
  if (exact) { base.statut = 'donnee_exacte'; base.pression = exact.pression; base.methode = 'point_constructeur'; base.pointsSource = [{ debit: exact.debit, pression: exact.pression }]; return base; }
  var bas = null, haut = null;
  for (var i = 0; i < pts.length; i++) { if (pts[i].debit < debitEtudie) bas = pts[i]; if (pts[i].debit > debitEtudie) { haut = pts[i]; break; } }
  if (bas && haut) {
    var p = bas.pression + (haut.pression - bas.pression) * (debitEtudie - bas.debit) / (haut.debit - bas.debit);
    base.statut = 'interpolee'; base.pression = Math.round(p * 100) / 100; base.methode = 'interpolation_lineaire_constructeur';
    base.pointsSource = [{ debit: bas.debit, pression: bas.pression }, { debit: haut.debit, pression: haut.pression }];
    return base;
  }
  base.statut = 'hors_courbe'; base.raison = 'débit hors de l\'intervalle des points constructeur (extrapolation refusée)';
  return base;
}

// Position d'un débit vis-à-vis d'une plage de fonctionnement (sans inventer de plage).
function positionDebitPlage(plage, debit) {
  if (!plage || typeof debit !== 'number') return 'plage_absente';
  var min = plage.debitMin, max = plage.debitMax;
  if (typeof min !== 'number' && typeof max !== 'number') return 'plage_absente';
  if (typeof min === 'number' && debit < min) return 'inferieur';
  if (typeof max === 'number' && debit > max) return 'superieur';
  return 'dans_plage';
}

// Adapte des données constructeur → contrat consommé par analysePressionVmc (LOT17-A).
// N'effectue AUCUNE sélection : s'il y a plusieurs groupes pour un réseau, il ne départage
// pas (aucune pression produite + note). SF/DF traités séparément (jamais fusionnés).
function adapterDonneesConstructeurPourPression(donneesConstructeur, preEtude) {
  donneesConstructeur = donneesConstructeur || {};
  var out = { pressionDisponible: {}, composants: {}, terminaux: {}, evaluations: {}, notes: [] };
  var preDim = (preEtude && preEtude.preDimensionnement && Array.isArray(preEtude.preDimensionnement.reseaux)) ? preEtude.preDimensionnement.reseaux : [];
  var debitType = function (type) { var r = preDim.filter(function (x) { return x.type === type; })[0]; return r ? _num17(r.debitProjet) : null; };

  ['extraction', 'insufflation'].forEach(function (type) {
    var Q = debitType(type);
    var groupes = (donneesConstructeur.groupes && Array.isArray(donneesConstructeur.groupes[type])) ? donneesConstructeur.groupes[type] : [];
    if (groupes.length > 1) { out.notes.push({ champ: 'plusieurs_groupes_non_departages:' + type, impact: 'aucune_selection' }); }
    else if (groupes.length === 1) {
      var g = groupes[0];
      var ev = evaluerCourbeVmc(g.courbe, Q, { fabricant: g.fabricant, reference: g.reference, source: g.source, version: g.version, provenance: g.provenance });
      out.evaluations[type] = { groupe: ev, positionPlage: positionDebitPlage(g.plageFonctionnement, Q) };
      if (ev.statut === 'donnee_exacte' || ev.statut === 'interpolee') {
        out.pressionDisponible[type] = { valeur: ev.pression, unite: 'Pa', debitReference: Q, source: g.source, version: g.version, provenance: g.provenance, methode: ev.methode };
      }
      // Pertes internes documentées → composants (aucune si absentes ; 0 documenté conservé).
      var comps = [];
      ['filtre', 'echangeur', 'batterie'].forEach(function (k) { var pk = g.pertesInternes ? g.pertesInternes[k] : null; if (pk && typeof pk.valeur === 'number') comps.push({ composant: k, valeur: pk.valeur, unite: 'Pa', debitReference: pk.debitReference, source: pk.source || g.source, version: pk.version || g.version, provenance: pk.provenance || g.provenance }); });
      if (comps.length) out.composants[type] = comps;
    }
    // Terminal (un seul évalué ; pas de sélection multiple).
    var terms = (donneesConstructeur.terminaux && Array.isArray(donneesConstructeur.terminaux[type])) ? donneesConstructeur.terminaux[type] : [];
    if (terms.length === 1) {
      var t = terms[0];
      var evt = evaluerCourbeVmc(t.courbe, Q, { fabricant: t.fabricant, reference: t.reference, source: t.source, version: t.version, provenance: t.provenance });
      out.evaluations[type] = out.evaluations[type] || {}; out.evaluations[type].terminal = evt;
      if (evt.statut === 'donnee_exacte' || evt.statut === 'interpolee') out.terminaux[type] = { valeur: evt.pression, unite: 'Pa', debitReference: Q, source: t.source, version: t.version, provenance: t.provenance, methode: evt.methode };
    } else if (terms.length > 1) { out.notes.push({ champ: 'plusieurs_terminaux_non_departages:' + type, impact: 'aucune_selection' }); }
  });
  return out;
}


// =====================================================================
// M57 LOT18 — MODÈLE DE VISITE TECHNIQUE VMC (source de vérité terrain)
// =====================================================================
// Couche de DONNÉES pure : constructeurs/validateurs de relevé de visite + normalisation
// vers le contrat donneesReseau (LOT15-B). AUCUN calcul (pertes/pression), AUCUNE sélection,
// AUCUN prix/Runtime/catalogue, AUCUNE conformité, AUCUN traitement image, AUCUNE 3D/BIM.
// « inconnu / non_mesure / inaccessible » ≠ 0 : jamais converti en valeur. Provenance ≠ statut.
// donneesVisite (vérité terrain) ≠ donneesReseau (projection pour les moteurs).

var STATUT_VISITE = { MESURE: 'mesure', ESTIME: 'estime', INCONNU: 'inconnu', NON_ACCESSIBLE: 'non_accessible', NON_MESURE: 'non_mesure', NON_APPLICABLE: 'non_applicable', A_VERIFIER: 'a_verifier', DOCUMENTE: 'documente', RELEVE_DECLARATIF: 'releve_declaratif' };
var PROVENANCE_VISITE = { CLIENT: 'client', TECHNICIEN: 'technicien', MESURE_INSTRUMENTEE: 'mesure_instrumentee', CONSTRUCTEUR: 'constructeur', DOCUMENT_EXISTANT: 'document_existant', CALCUL_DSBAT: 'calcul_dsbat', HYPOTHESE: 'hypothese', PHOTO_INTERPRETEE: 'photo_interpretee' };
var ACCESSIBILITE_VISITE = { VISIBLE: 'visible', CACHE: 'cache', INACCESSIBLE: 'inaccessible', PARTIELLE: 'partiellement_accessible', NON_VERIFIABLE: 'non_verifiable' };
var NATURE_VISITE = { EXISTANT_RELEVE: 'existant_releve', EXISTANT_DECLARE: 'existant_declare', PROJETE: 'projete', THEORIQUE_DSBAT: 'theorique_dsbat', CONSTRUCTEUR: 'constructeur', MESURE: 'mesure' };

function _o18(v) { return (v == null) ? null : v; }
// Champ physique = valeur + STATUT explicite (jamais un simple null pour représenter l'état).
function creerChampValeur(spec) {
  spec = spec || {};
  return { valeur: (spec.valeur != null ? spec.valeur : null), unite: _o18(spec.unite), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, provenance: _o18(spec.provenance), nature: _o18(spec.nature), source: _o18(spec.source) };
}
// Champ pouvant porter PLUSIEURS observations contradictoires + une valeur de référence tracée.
function creerChampObserve(observations, reference) {
  return {
    observations: (Array.isArray(observations) ? observations : []).map(creerChampValeur),
    reference: reference ? { valeur: (reference.valeur != null ? reference.valeur : null), unite: _o18(reference.unite), statut: _o18(reference.statut) || STATUT_VISITE.DOCUMENTE, provenance: _o18(reference.provenance), choisiePar: _o18(reference.choisiePar), raison: _o18(reference.raison) } : null
  };
}

function creerInstallationVisite(spec) {
  spec = spec || {};
  return { id: _o18(spec.id), typeSysteme: _o18(spec.typeSysteme), statutInstallation: _o18(spec.statutInstallation), contexte: _o18(spec.contexte), perimetreVisite: _o18(spec.perimetreVisite), dateVisite: _o18(spec.dateVisite), intervenant: _o18(spec.intervenant), niveauCompletude: _o18(spec.niveauCompletude) };
}
function creerNoeudVisite(spec) { spec = spec || {}; return { id: _o18(spec.id), type: _o18(spec.type), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, commentaire: _o18(spec.commentaire) }; }
function _champ(v) { return (v && (v.observations !== undefined || v.valeur !== undefined || v.statut !== undefined)) ? v : creerChampValeur(v && typeof v === 'object' ? v : { valeur: v }); }
function creerSingulariteVisite(spec) {
  spec = spec || {};
  return { id: _o18(spec.id), type: _o18(spec.type), tronconId: _o18(spec.tronconId), positionRelative: _o18(spec.positionRelative), geometrie: (spec.geometrie != null ? spec.geometrie : 'inconnu'), reference: _o18(spec.reference), quantite: (spec.quantite && spec.quantite.valeur !== undefined ? spec.quantite : _champ(spec.quantite)), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, commentaire: _o18(spec.commentaire) };
}
// M57 LOT30-A — États de pose QUALITATIFS (observation terrain, JAMAIS un coefficient).
var ETAT_POSE_VISITE = { ENTIEREMENT_DEPLOYE: 'entierement_deploye', PARTIELLEMENT_COMPRIME: 'partiellement_comprime', FORTEMENT_COMPRIME: 'fortement_comprime', AFFAISSE: 'affaisse', ECRASE: 'ecrase', INCONNU: 'inconnu', NON_APPLICABLE: 'non_applicable' };
// donneesPose : OBSERVATION de l'état de pose d'un conduit (surtout flexible). PUREMENT
// qualitative — aucune conversion en %/coefficient/rugosité/perte. Absence → null (compat).
// Une observation technicien N'EST PAS une mesure instrumentée (statut à préciser par l'appelant).
function creerDonneesPose(spec) {
  if (spec == null) return null; // conduit sans données de pose relevées (ancienne visite incluse)
  return {
    etatPose: _o18(spec.etatPose), compression: _o18(spec.compression), deformation: _o18(spec.deformation),
    courbure: _o18(spec.courbure), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU,
    commentaire: _o18(spec.commentaire)
  };
}
function creerTronconVisite(spec) {
  spec = spec || {};
  return {
    id: _o18(spec.id), role: _o18(spec.role), noeudAmont: _o18(spec.noeudAmont), noeudAval: _o18(spec.noeudAval), pieceRef: _o18(spec.pieceRef),
    longueur: _champ(spec.longueur), diametre: _champ(spec.diametre), section: _champ(spec.section),
    diametreProjet: _champ(spec.diametreProjet), sectionProjet: _champ(spec.sectionProjet), // THÉORIQUES, distincts du relevé
    typeConduit: _o18(spec.typeConduit), materiau: _o18(spec.materiau), etat: _o18(spec.etat), sensFlux: _o18(spec.sensFlux),
    donneesPose: creerDonneesPose(spec.donneesPose), // M57 LOT30-A (additif) : état de pose, observationnel
    debit: _champ(spec.debit),
    singularites: (Array.isArray(spec.singularites) ? spec.singularites : []).map(creerSingulariteVisite),
    provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, accessibilite: _o18(spec.accessibilite), commentaire: _o18(spec.commentaire)
  };
}
function creerReseauVisite(spec) {
  spec = spec || {};
  var TYPES = { extraction: 1, insufflation: 1, prise_air_neuf: 1, rejet: 1 };
  return { id: _o18(spec.id), type: TYPES[spec.type] ? spec.type : null,
    noeuds: (Array.isArray(spec.noeuds) ? spec.noeuds : []).map(creerNoeudVisite),
    troncons: (Array.isArray(spec.troncons) ? spec.troncons : []).map(creerTronconVisite),
    terminaux: (Array.isArray(spec.terminaux) ? spec.terminaux : []).map(creerTerminalVisite) };
}
function creerTerminalVisite(spec) {
  spec = spec || {};
  // M57 LOT29 (additif) : noeudId = nœud de raccordement physique du terminal (jamais déduit de
  // pieceRef). null si inconnu — aucune relation fabriquée.
  return { id: _o18(spec.id), pieceRef: _o18(spec.pieceRef), fonction: _o18(spec.fonction), reseauId: _o18(spec.reseauId), noeudId: _o18(spec.noeudId), type: _o18(spec.type), fabricant: _o18(spec.fabricant), reference: _o18(spec.reference), diametreRaccordement: _champ(spec.diametreRaccordement), debitDeclare: _champ(spec.debitDeclare), etat: _o18(spec.etat), accessibilite: _o18(spec.accessibilite), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, photos: (Array.isArray(spec.photos) ? spec.photos : []), mesures: (Array.isArray(spec.mesures) ? spec.mesures : []), commentaire: _o18(spec.commentaire) };
}
function creerCentraleVisite(spec) { spec = spec || {}; return { id: _o18(spec.id), type: _o18(spec.type), fabricant: _o18(spec.fabricant), reference: _o18(spec.reference), emplacement: _o18(spec.emplacement), accessibilite: _o18(spec.accessibilite), etat: _o18(spec.etat), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, commentaire: _o18(spec.commentaire), photos: (Array.isArray(spec.photos) ? spec.photos : []) }; }
function creerInterfaceVisite(spec) { spec = spec || {}; return { id: _o18(spec.id), type: _o18(spec.type), emplacement: _o18(spec.emplacement), accessibilite: _o18(spec.accessibilite), etat: _o18(spec.etat), provenance: _o18(spec.provenance), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, reference: _o18(spec.reference), commentaire: _o18(spec.commentaire), photos: (Array.isArray(spec.photos) ? spec.photos : []) }; }
function creerMesureVisite(spec) {
  spec = spec || {};
  // Une valeur SANS instrument n'est pas une mesure instrumentée (statut à préciser par l'appelant).
  var statut = _o18(spec.statut) || (spec.instrument ? STATUT_VISITE.MESURE : STATUT_VISITE.RELEVE_DECLARATIF);
  return { id: _o18(spec.id), pointId: _o18(spec.pointId), grandeur: _o18(spec.grandeur), valeur: (spec.valeur != null ? spec.valeur : null), unite: _o18(spec.unite), date: _o18(spec.date), instrument: _o18(spec.instrument), referenceInstrument: _o18(spec.referenceInstrument), modeFonctionnement: _o18(spec.modeFonctionnement), regime: _o18(spec.regime), conditions: _o18(spec.conditions), operateur: _o18(spec.operateur), methode: _o18(spec.methode), incertitude: _o18(spec.incertitude), provenance: _o18(spec.provenance) || (spec.instrument ? PROVENANCE_VISITE.MESURE_INSTRUMENTEE : PROVENANCE_VISITE.TECHNICIEN), statut: statut, photoRef: _o18(spec.photoRef), commentaire: _o18(spec.commentaire) };
}
function creerHypotheseVisite(spec) { spec = spec || {}; return { id: _o18(spec.id), objetId: _o18(spec.objetId), description: _o18(spec.description), valeur: (spec.valeur != null ? spec.valeur : null), statut: _o18(spec.statut) || STATUT_VISITE.A_VERIFIER, auteur: _o18(spec.auteur), date: _o18(spec.date), provenance: PROVENANCE_VISITE.HYPOTHESE }; }
function creerPhotoRef(spec) { spec = spec || {}; return { id: _o18(spec.id), objetType: _o18(spec.objetType), objetId: _o18(spec.objetId), provenance: _o18(spec.provenance), date: _o18(spec.date), commentaire: _o18(spec.commentaire) }; }

function creerDonneesVisite(spec) {
  spec = spec || {};
  return {
    installation: creerInstallationVisite(spec.installation),
    reseaux: (Array.isArray(spec.reseaux) ? spec.reseaux : []).map(creerReseauVisite),
    centrale: spec.centrale ? creerCentraleVisite(spec.centrale) : null,
    priseAirNeuf: spec.priseAirNeuf ? creerInterfaceVisite(Object.assign({ type: 'prise_air_neuf' }, spec.priseAirNeuf)) : null,
    rejet: spec.rejet ? creerInterfaceVisite(Object.assign({ type: 'rejet' }, spec.rejet)) : null,
    mesures: (Array.isArray(spec.mesures) ? spec.mesures : []).map(creerMesureVisite),
    hypotheses: (Array.isArray(spec.hypotheses) ? spec.hypotheses : []).map(creerHypotheseVisite),
    photos: (Array.isArray(spec.photos) ? spec.photos : []).map(creerPhotoRef)
  };
}

// Extrait la valeur RÉELLE d'un champ (mesure/documenté/estimé, ou référence si contradiction).
// Contradictions non arbitrées → null + incohérence (jamais de choix silencieux). inconnu → null.
function _valeurReelleChamp(champ, statutsOk, incoherences, ref) {
  if (!champ) return null;
  statutsOk = statutsOk || [STATUT_VISITE.MESURE, STATUT_VISITE.DOCUMENTE, STATUT_VISITE.ESTIME, STATUT_VISITE.RELEVE_DECLARATIF];
  if (champ.reference && champ.reference.valeur != null) return (typeof champ.reference.valeur === 'number' ? champ.reference.valeur : null);
  var obs = champ.observations ? champ.observations : [champ];
  var num = obs.filter(function (o) { return typeof o.valeur === 'number' && statutsOk.indexOf(o.statut) !== -1; }).map(function (o) { return o.valeur; });
  var distinctes = num.filter(function (v, i, a) { return a.indexOf(v) === i; });
  if (distinctes.length > 1) { if (incoherences) incoherences.push({ champ: ref || 'valeur', type: 'valeurs_contradictoires_non_arbitrees' }); return null; }
  return distinctes.length ? distinctes[0] : null;
}

// Normalise donneesVisite → donneesReseau (LOT15-B), en conservant provenance/statuts, en
// distinguant réel/projeté, en signalant incohérences et données insuffisantes. NE CALCULE RIEN.
function normaliserVisiteVersReseau(donneesVisite) {
  donneesVisite = donneesVisite || {};
  var incoherences = [], donneesManquantes = [];
  var dm = function (champ, impact) { if (!donneesManquantes.some(function (x) { return x.champ === champ; })) donneesManquantes.push({ champ: champ, impact: impact || 'donneesReseau' }); };
  var reseaux = (donneesVisite.reseaux || []).filter(function (r) { return r.type === 'extraction' || r.type === 'insufflation'; }).map(function (r) {
    var troncons = (r.troncons || []).map(function (t) {
      var ref = (t.id || t.pieceRef || t.role || 'troncon');
      var L = _valeurReelleChamp(t.longueur, null, incoherences, 'longueur:' + ref);
      var D = _valeurReelleChamp(t.diametre, null, incoherences, 'diametre:' + ref);
      var S = _valeurReelleChamp(t.section, null, incoherences, 'section:' + ref);
      if (L == null) dm('longueur:' + ref, 'pertes');
      if (D == null && S == null) dm('diametre_ou_section:' + ref, 'pertes');
      return {
        id: t.id, role: t.role, pieceRef: t.pieceRef,
        noeudAmont: t.noeudAmont, noeudAval: t.noeudAval, // M57 LOT29 : arêtes du graphe conservées (jamais recalculées)
        donneesPose: (t.donneesPose != null ? t.donneesPose : null), // M57 LOT30-A : état de pose conservé tel quel (aucune interprétation)
        longueur: L, diametre: D, section: S,
        diametreProjet: _valeurReelleChamp(t.diametreProjet, [NATURE_VISITE.PROJETE, STATUT_VISITE.DOCUMENTE, STATUT_VISITE.ESTIME], null, null),
        typeConduit: t.typeConduit,
        debit: _valeurReelleChamp(t.debit, null, incoherences, 'debit:' + ref),
        singularites: (t.singularites || []).map(function (s) { return { type: s.type, quantite: (s.quantite && s.quantite.valeur != null ? s.quantite.valeur : null), geometrie: (s.geometrie != null ? s.geometrie : 'inconnu'), reference: s.reference }; }),
        provenance: t.provenance
      };
    });
    return { id: r.id, type: r.type, noeuds: (r.noeuds || []).map(function (n) { return { id: n.id, type: n.type }; }), troncons: troncons, terminaux: (r.terminaux || []).map(function (tm) { return { id: tm.id, pieceRef: tm.pieceRef, fonction: tm.fonction, reference: tm.reference, noeudId: tm.noeudId, debit: _valeurReelleChamp(tm.debitDeclare, null, incoherences, 'debit_terminal:' + (tm.id || tm.pieceRef || '?')), provenance: tm.provenance }; }) };
  });
  var iface = function (o) { return o ? { type: o.type, reference: o.reference, provenance: o.provenance } : null; };
  var donneesReseau = creerDonneesReseau({ reseaux: reseaux, centrale: donneesVisite.centrale ? { type: donneesVisite.centrale.type, reference: donneesVisite.centrale.reference, provenance: donneesVisite.centrale.provenance } : null, priseAirNeuf: iface(donneesVisite.priseAirNeuf), rejet: iface(donneesVisite.rejet) });
  return { donneesReseau: donneesReseau, incoherences: incoherences, donneesManquantes: donneesManquantes };
}

// Valide un jeu de visite (structure + suffisance pour LOT15-A), sans rien inventer.
function validerDonneesVisite(donneesVisite) {
  var norm = normaliserVisiteVersReseau(donneesVisite);
  var v = validerDonneesReseau(norm.donneesReseau);
  return { valide: v.valide && norm.incoherences.length === 0, donneesManquantes: v.donneesManquantes.concat(norm.donneesManquantes.filter(function (d) { return !v.donneesManquantes.some(function (x) { return x.champ === d.champ; }); })), incoherences: norm.incoherences };
}


// =====================================================================
// M57 LOT19 — Collecte / persistance / reprise de VISITE VMC (couche pure)
// =====================================================================
// Couche de COLLECTE + PERSISTANCE de la visite terrain. Réutilise les contrats LOT18,
// NE recalcule RIEN (ni pertes/pression/débit/section), NE sélectionne aucun produit,
// N'écrit JAMAIS dans la configuration tarifaire, aucun prix/Runtime/catalogue. donneesVisite reste la
// SOURCE DE VÉRITÉ ; l'UI n'est qu'une projection reconstruite depuis elle.
// Actions IMMUABLES : chaque action renvoie une NOUVELLE visite (les entrées ne sont pas
// mutées) — un re-render ne recrée aucun ID, une restauration préserve tout.

function nouvelleVisiteVmc(spec) { return creerDonneesVisite(spec || {}); }
// Persistance : la visite est déjà un objet JSON-sérialisable ; sérialiser = cloner tel quel.
function serialiserVisiteVmc(donneesVisite) { return donneesVisite ? JSON.parse(JSON.stringify(donneesVisite)) : null; }
// Restauration : reconstruit via les contrats LOT18 (garantit la forme, préserve IDs/statuts/
// provenance/contradictions/valeurs réelles et projetées).
function restaurerVisiteVmc(obj) { return obj ? creerDonneesVisite(obj) : null; }
function _cloneVisite(dv) { return creerDonneesVisite(dv ? JSON.parse(JSON.stringify(dv)) : {}); }
function _reseauVisite(dv, reseauId) { return (dv.reseaux || []).filter(function (r) { return r.id === reseauId; })[0] || null; }

function ajouterReseauVisite(dv, spec) { var c = _cloneVisite(dv); c.reseaux.push(creerReseauVisite(spec)); return c; }
function ajouterNoeudVisite(dv, reseauId, spec) { var c = _cloneVisite(dv); var r = _reseauVisite(c, reseauId); if (r) r.noeuds.push(creerNoeudVisite(spec)); return c; }
function ajouterTronconVisite(dv, reseauId, spec) { var c = _cloneVisite(dv); var r = _reseauVisite(c, reseauId); if (r) r.troncons.push(creerTronconVisite(spec)); return c; }
function ajouterTerminalVisite(dv, reseauId, spec) { var c = _cloneVisite(dv); var r = _reseauVisite(c, reseauId); if (r) r.terminaux.push(creerTerminalVisite(spec)); return c; }
function ajouterMesureVisiteA(dv, spec) { var c = _cloneVisite(dv); c.mesures.push(creerMesureVisite(spec)); return c; }
function ajouterHypotheseVisiteA(dv, spec) { var c = _cloneVisite(dv); c.hypotheses.push(creerHypotheseVisite(spec)); return c; }
function ajouterPhotoVisiteA(dv, spec) { var c = _cloneVisite(dv); c.photos.push(creerPhotoRef(spec)); return c; }
function definirInstallationVisite(dv, spec) { var c = _cloneVisite(dv); c.installation = creerInstallationVisite(spec); return c; }
function definirCentraleVisite(dv, spec) { var c = _cloneVisite(dv); c.centrale = creerCentraleVisite(spec); return c; }
function definirInterfaceVisite(dv, quelle, spec) { var c = _cloneVisite(dv); if (quelle === 'priseAirNeuf') c.priseAirNeuf = creerInterfaceVisite(Object.assign({ type: 'prise_air_neuf' }, spec)); else if (quelle === 'rejet') c.rejet = creerInterfaceVisite(Object.assign({ type: 'rejet' }, spec)); return c; }

// Résumé pour l'UI (validation + normalisation), SANS calcul ni conclusion de conformité.
// statutVisite ∈ 'incomplet' | 'complet' — jamais « conforme »/« dimensionné »/« pression suffisante ».
function resumeVisiteVmc(donneesVisite) {
  var val = validerDonneesVisite(donneesVisite || {});
  var norm = normaliserVisiteVersReseau(donneesVisite || {});
  return {
    statutVisite: val.valide ? 'complet' : 'incomplet',
    donneesSuffisantes: val.valide,
    donneesManquantes: val.donneesManquantes,
    incoherences: val.incoherences,
    donneesReseau: norm.donneesReseau
  };
}


// =====================================================================
// M57 LOT20 — VUE-MODÈLE UI TERRAIN VMC (pur, sans DOM)
// =====================================================================
// Couche PURE fournissant à l'UI de collecte (DOM, dans le configurateur) des libellés
// terrain et une vue-modèle dérivée de donneesVisite. NE calcule RIEN, N'écrit RIEN, aucun
// prix/Runtime/catalogue/config tarifaire. L'UI n'est qu'un rendu de cette vue ; la vérité
// reste donneesVisite (les mutations passent par les actions immuables LOT19).

var _LIBELLES_STATUT_VISITE = { mesure: 'Mesuré', estime: 'Estimé', inconnu: 'Je ne sais pas', non_accessible: 'Non accessible', non_mesure: 'Non mesuré', non_applicable: 'Non applicable', a_verifier: 'À vérifier', documente: 'Documenté', releve_declaratif: 'Relevé déclaratif' };
var _LIBELLES_PROVENANCE_VISITE = { client: 'Déclaré client', technicien: 'Relevé technicien', mesure_instrumentee: 'Mesuré (instrument)', constructeur: 'Constructeur', document_existant: 'Document existant', calcul_dsbat: 'Calcul DS.BAT', hypothese: 'Hypothèse', photo_interpretee: 'Photo interprétée' };
var _LIBELLES_TYPE_RESEAU = { extraction: 'Extraction', insufflation: 'Insufflation', prise_air_neuf: 'Prise d\'air neuf', rejet: 'Rejet' };
function libelleStatutVisite(code) { return _LIBELLES_STATUT_VISITE[code] || (code || 'Je ne sais pas'); }
function libelleProvenanceVisite(code) { return _LIBELLES_PROVENANCE_VISITE[code] || (code || '—'); }
function libelleTypeReseauVisite(code) { return _LIBELLES_TYPE_RESEAU[code] || (code || '—'); }

// Vue-modèle dérivée (aucune mutation, aucun calcul métier) pour le rendu de l'UI terrain.
function construireVueVisite(donneesVisite) {
  var dv = donneesVisite || null;
  if (!dv) return { existe: false, resume: null, reseaux: [], compteurs: { reseaux: 0, noeuds: 0, troncons: 0, terminaux: 0, mesures: 0, photos: 0, hypotheses: 0 } };
  var reseaux = (dv.reseaux || []).map(function (r) {
    return { id: r.id, type: r.type, libelleType: libelleTypeReseauVisite(r.type),
      nbNoeuds: (r.noeuds || []).length, nbTroncons: (r.troncons || []).length, nbTerminaux: (r.terminaux || []).length,
      noeuds: r.noeuds || [], troncons: r.troncons || [], terminaux: r.terminaux || [] };
  });
  var compt = { reseaux: reseaux.length,
    noeuds: reseaux.reduce(function (s, r) { return s + r.nbNoeuds; }, 0),
    troncons: reseaux.reduce(function (s, r) { return s + r.nbTroncons; }, 0),
    terminaux: reseaux.reduce(function (s, r) { return s + r.nbTerminaux; }, 0),
    mesures: (dv.mesures || []).length, photos: (dv.photos || []).length, hypotheses: (dv.hypotheses || []).length };
  return {
    existe: true,
    installation: dv.installation || null,
    reseaux: reseaux,
    centrale: dv.centrale || null,
    priseAirNeuf: dv.priseAirNeuf || null,
    rejet: dv.rejet || null,
    mesures: dv.mesures || [],
    photos: dv.photos || [],
    hypotheses: dv.hypotheses || [],
    compteurs: compt,
    resume: resumeVisiteVmc(dv) // statut incomplet/complet + manques + incohérences (aucune conformité)
  };
}


// =====================================================================
// M57 LOT21 — CHAÎNAGE VISITE RÉELLE → ÉTUDE VMC (orchestrateur pur)
// =====================================================================
// etudierVisiteVmc(pieces, contexte, donneesVisite, options?) relie la VISITE terrain
// (source de vérité, LOT18/19) à l'ÉTUDE technique (LOT16 → LOT15-A → LOT17-A) via la SEULE
// frontière officielle normaliserVisiteVersReseau (LOT18) — aucune 2e conversion, aucun 2e
// format « donneesReseau ». Il NE calcule RIEN lui-même (ni perte, ni pression, ni section,
// ni diamètre) : il DÉLÈGUE aux moteurs existants. Il NE sélectionne aucun produit, NE
// compare aucun groupe, NE produit aucun prix, N'écrit JAMAIS la configuration tarifaire /
// Runtime / catalogue, et N'appelle PAS de projection tarifaire. Il NE mute pas la visite.
//
// RÉEL ≠ PROJETÉ : options.contexteEtude ∈ 'existant'(défaut) | 'projet' | 'mixte' rend
// EXPLICITE la source utilisée par l'étude. 'existant' = diamètres RELEVÉS ; 'projet' =
// diamètres PROJETÉS (théoriques, LOT14) ; 'mixte' = relevé sinon projeté, CHAQUE
// substitution tracée en pointsAVerifier. Jamais d'écrasement silencieux du relevé par le
// projeté. Donnée inconnue → reste null (jamais 0/valeur inventée). Une mesure locale
// (bouche/terminal) N'est PAS propagée au réseau : aucune propagation n'est introduite ici.
//
// options = { referentielPertes?, donneesTechnique?, contexteEtude? }

// Dérive PUREMENT les données réseau à étudier selon le contexte, SANS écraser le relevé
// (norm.donneesReseau reste intact). Retourne le contrat riche { reseaux:[…] } attendu par
// preEtudeVmc (LOT16). 'existant' = relevé tel quel. Une valeur absente reste null.
function _selectionnerDonneesEtude(donneesReseau, contexteEtude, pointsAVerifier) {
  if (!donneesReseau || !Array.isArray(donneesReseau.reseaux)) return donneesReseau || {};
  if (contexteEtude === 'existant') return donneesReseau; // relevé = comportement par défaut
  var reseaux = donneesReseau.reseaux.map(function (r) {
    return Object.assign({}, r, {
      troncons: (r.troncons || []).map(function (t) {
        var d = t.diametre;
        var ref = (t.id || t.pieceRef || t.role || 'troncon');
        if (contexteEtude === 'projet') {
          if (t.diametreProjet != null) d = t.diametreProjet;   // étude PROJET : valeur projetée explicite
        } else if (contexteEtude === 'mixte') {
          if (d == null && t.diametreProjet != null) {           // relevé absent → projeté, TRACÉ
            d = t.diametreProjet;
            if (pointsAVerifier) pointsAVerifier.push({ type: 'donnee', description: 'Diamètre projeté utilisé faute de relevé (' + ref + ').' });
          }
        }
        return Object.assign({}, t, { diametre: d }); // section relevée conservée telle quelle
      })
    });
  });
  return { reseaux: reseaux, centrale: donneesReseau.centrale, priseAirNeuf: donneesReseau.priseAirNeuf, rejet: donneesReseau.rejet };
}

function etudierVisiteVmc(pieces, contexte, donneesVisite, options) {
  options = options || {};
  contexte = contexte || {};
  var contexteEtude = (options.contexteEtude === 'projet' || options.contexteEtude === 'mixte') ? options.contexteEtude : 'existant';

  // 1. Frontière officielle UNIQUE : visite → donneesReseau (RELEVÉ). Ne mute pas la visite.
  var norm = normaliserVisiteVersReseau(donneesVisite || {});
  var pointsAVerifier = [];

  // 2. Choix EXPLICITE réel/projeté (dérivation pure ; norm.donneesReseau n'est pas modifié).
  var donneesReseauEtude = _selectionnerDonneesEtude(norm.donneesReseau, contexteEtude, pointsAVerifier);

  // 3. Étude DÉLÉGUÉE (LOT16 enchaîne L10→L15-A). Aucune règle recréée, aucun calcul ici.
  var etude = preEtudeVmc(pieces, contexte, { donneesReseau: donneesReseauEtude, referentielPertes: options.referentielPertes });

  // 4. Analyse pression DÉLÉGUÉE (LOT17-A) : ne consomme que des pertes réellement calculées
  //    + données techniques FOURNIES (constructeur, LOT17-B). Sans données → statut a_verifier
  //    selon le contrat LOT17-A (aucun 0 Pa implicite, aucune sélection de centrale ici).
  var pression = analysePressionVmc(pieces, contexte, etude, options.donneesTechnique || {});

  // 5. Agrégation des manques / points à vérifier (contrats existants, aucune nouvelle taxonomie).
  var donneesManquantes = [];
  var addDm = function (d) { if (d && d.champ && !donneesManquantes.some(function (x) { return x.champ === d.champ; })) donneesManquantes.push(d); };
  (norm.donneesManquantes || []).forEach(addDm);
  (etude.donneesManquantes || []).forEach(addDm);
  (pression.donneesManquantes || []).forEach(addDm);
  (etude.pointsAVerifier || []).forEach(function (p) { pointsAVerifier.push(p); });
  (pression.pointsAVerifier || []).forEach(function (p) { pointsAVerifier.push(p); });

  // 6. M57 LOT27 — VOIE PARALLÈLE Darcy/Colebrook (LOT25), ADDITIVE. N'altère PAS etude.pertes
  //    (voie historique LOT15-A intacte). Déclenchée seulement si un référentiel PRODUCTION
  //    (rugosités + air) est fourni. Débit/longueur/diamètre = réseau normalisé (relevé),
  //    aucune invention, aucun fallback de famille. Comparaison observationnelle (aucun arbitrage).
  var darcy = options.referentielProduction
    ? etudeDarcyVmc(donneesReseauEtude, options.referentielProduction, { contexteEtude: contexteEtude })
    : { disponible: false, raison: 'referentiel_production_non_fourni', reseaux: [] };
  if (darcy.disponible) darcy.comparaison = comparerPerteLineaireVmc(etude.pertes, darcy);

  return {
    contexteEtude: contexteEtude,
    visite: donneesVisite || null,   // source de vérité (référence, non mutée) : provenance/statuts restent consultables
    normalisation: { donneesReseau: norm.donneesReseau, incoherences: norm.incoherences, donneesManquantes: norm.donneesManquantes },
    etude: etude,               // sortie LOT16 complète (réutilisée, non dupliquée)
    pertes: etude.pertes,       // référence vers etude.pertes (pas de recalcul, pas de copie de logique)
    pression: pression,         // sortie LOT17-A complète
    darcy: darcy,               // M57 LOT27 : voie Darcy/Colebrook (additive), jamais fusionnée avec l'historique
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier,
    hypotheses: etude.hypotheses || [],
    statut: etude.statutEtude   // taxonomie LOT16 réutilisée : jamais « conforme » / « dimensionné »
  };
}


// =====================================================================
// M57 LOT22 — RÉFÉRENTIEL DE PERTES DE CHARGE VMC (production, sourcé, versionné)
// =====================================================================
// Couche de DONNÉES TECHNIQUES pure. Fournit au moteur LOT15-A un référentiel de pertes
// SOURCÉ, VERSIONNÉ, TRAÇABLE, à DOMAINE explicite. Ce N'EST PAS un catalogue commercial :
// aucune marque, aucun prix, aucune référence commerciale, aucune sélection de produit,
// aucune courbe constructeur (celles-ci restent dans LOT17-B). AUCUNE valeur inventée : une
// entrée sans source/référence exacte/unité/domaine est INUTILISABLE. Une fixture (statut/
// provenance 'test') ne peut JAMAIS servir de référentiel de production. Le moteur reste
// LOT15-A ; LOT22 ne calcule rien, ne touche ni la configuration tarifaire, ni prix, ni Runtime.
//
// Deux formes :
//   • FORME PRODUCTION (rich, ce fichier) : entrées CONDITIONNELLES documentées.
//   • FORME MOTEUR (LOT15-B) : maps { conduit:{ diametre:R } } / { type:{ geometrie:{coefficient} } }
//     produites par compilerReferentielPertes(). LOT15-A consomme la forme moteur INCHANGÉE.

var STATUT_REFERENTIEL = { PRODUCTION: 'production', PROVISOIRE: 'provisoire', TEST: 'test', RETIRE: 'retire' };
// Champs commerciaux INTERDITS dans un référentiel technique (contrôle de non-contamination).
var _CHAMPS_COMMERCIAUX = ['marque', 'prix', 'prixHT', 'prixTTC', 'referenceCommerciale', 'refCommerciale', 'modele', 'fournisseur', 'codeArticle', 'ean', 'catalogue'];
// Détecte, sur la spec BRUTE (avant normalisation), la présence d'un champ commercial.
function _detecterChampsCommerciaux(spec) {
  if (!spec || typeof spec !== 'object') return [];
  return _CHAMPS_COMMERCIAUX.filter(function (c) { return Object.prototype.hasOwnProperty.call(spec, c) && spec[c] != null; });
}

// Entrée linéaire CONDITIONNELLE : R (Pa/m) valable pour (typeConduit, diamètre|section,
// [débit min/max]) dans un domaine tracé. Valeur absente → null (jamais inventée).
function creerEntreeLineairePertes(spec) {
  spec = spec || {};
  return {
    id: _ouNull(spec.id), typeConduit: _ouNull(spec.typeConduit),
    diametre: _nombreOuNull(spec.diametre), uniteDiametre: _ouNull(spec.uniteDiametre),
    section: _nombreOuNull(spec.section), uniteSection: _ouNull(spec.uniteSection),
    debitMin: _nombreOuNull(spec.debitMin), debitMax: _nombreOuNull(spec.debitMax), uniteDebit: _ouNull(spec.uniteDebit),
    R: _nombreOuNull(spec.R), unite: _ouNull(spec.unite),
    geometrie: _ouNull(spec.geometrie), domaine: _ouNull(spec.domaine),
    methode: _ouNull(spec.methode), source: _ouNull(spec.source), referenceExacte: _ouNull(spec.referenceExacte),
    versionSource: _ouNull(spec.versionSource), datePublication: _ouNull(spec.datePublication),
    statut: _ouNull(spec.statut), _champsCommerciaux: _detecterChampsCommerciaux(spec)
  };
}
// Entrée singulière CONDITIONNELLE : ζ (sans unité) pour une géométrie/config identifiable.
function creerEntreeSinguliere(spec) {
  spec = spec || {};
  return {
    id: _ouNull(spec.id), type: _ouNull(spec.type), geometrie: _ouNull(spec.geometrie),
    angle: _nombreOuNull(spec.angle), diametre: _nombreOuNull(spec.diametre), section: _nombreOuNull(spec.section),
    typeConduit: _ouNull(spec.typeConduit), sensFlux: _ouNull(spec.sensFlux),
    rapportDebits: _nombreOuNull(spec.rapportDebits), rapportSections: _nombreOuNull(spec.rapportSections),
    coefficient: _nombreOuNull(spec.coefficient), unite: (spec.unite != null ? spec.unite : ''),
    domaine: _ouNull(spec.domaine), methode: _ouNull(spec.methode), source: _ouNull(spec.source),
    referenceExacte: _ouNull(spec.referenceExacte), versionSource: _ouNull(spec.versionSource),
    datePublication: _ouNull(spec.datePublication), statut: _ouNull(spec.statut), _champsCommerciaux: _detecterChampsCommerciaux(spec)
  };
}

// Entrée RUGOSITÉ absolue ε par famille de conduit (M57 LOT24/LOT25 : requise par la méthode
// Darcy-Weisbach). Sourcée/conditionnelle ; valeur absente → null (jamais inventée).
function creerEntreeRugosite(spec) {
  spec = spec || {};
  return {
    id: _ouNull(spec.id), typeConduit: _ouNull(spec.typeConduit), geometrie: _ouNull(spec.geometrie),
    epsilon: _nombreOuNull(spec.epsilon), uniteEpsilon: _ouNull(spec.uniteEpsilon),
    domaine: _ouNull(spec.domaine), etatPose: _ouNull(spec.etatPose),
    source: _ouNull(spec.source), referenceExacte: _ouNull(spec.referenceExacte), versionSource: _ouNull(spec.versionSource),
    datePublication: _ouNull(spec.datePublication), statut: _ouNull(spec.statut), _champsCommerciaux: _detecterChampsCommerciaux(spec)
  };
}

// Construit le référentiel PRODUCTION (rich). Familles éventuellement vides (V1 assumé
// incomplet plutôt que rempli de valeurs non vérifiées). Aucun champ commercial.
function creerReferentielProductionPertes(spec) {
  spec = spec || {};
  var mva = spec.masseVolumiqueAir;
  var mu = spec.viscositeDynamiqueAir;
  return {
    referentielId: _ouNull(spec.referentielId), nom: _ouNull(spec.nom), version: _ouNull(spec.version),
    datePublication: _ouNull(spec.datePublication), dateActivation: _ouNull(spec.dateActivation),
    statut: _ouNull(spec.statut), sourcePrincipale: _ouNull(spec.sourcePrincipale), provenance: _ouNull(spec.provenance),
    masseVolumiqueAir: mva ? { valeur: _nombreOuNull(mva.valeur), unite: _ouNull(mva.unite), source: _ouNull(mva.source), conditions: _ouNull(mva.conditions), version: _ouNull(mva.version) } : null,
    // M57 LOT25 (additif) : viscosité dynamique de l'air, requise par Reynolds. Non remplie en V1.
    viscositeDynamiqueAir: mu ? { valeur: _nombreOuNull(mu.valeur), unite: _ouNull(mu.unite), source: _ouNull(mu.source), conditions: _ouNull(mu.conditions), version: _ouNull(mu.version) } : null,
    methodes: (Array.isArray(spec.methodes) ? spec.methodes : []).map(function (m) { return { id: _ouNull(m.id), nom: _ouNull(m.nom), unite: _ouNull(m.unite), conditions: _ouNull(m.conditions), source: _ouNull(m.source), version: _ouNull(m.version), domaine: _ouNull(m.domaine) }; }),
    lineaires: (Array.isArray(spec.lineaires) ? spec.lineaires : []).map(creerEntreeLineairePertes),
    singuliers: (Array.isArray(spec.singuliers) ? spec.singuliers : []).map(creerEntreeSinguliere),
    // M57 LOT25 (additif) : rugosités ε par famille de conduit. Vide en V1 (aucune valeur non vérifiée).
    rugosites: (Array.isArray(spec.rugosites) ? spec.rugosites : []).map(creerEntreeRugosite),
    limites: (Array.isArray(spec.limites) ? spec.limites.slice() : [])
  };
}
// Reconstruit depuis un objet JSON parsé (contrat identique). Aucun chemin de fichier ici.
function chargerReferentielPertesDepuisJSON(obj) { return creerReferentielProductionPertes(obj || {}); }

function _contientChampCommercial(o) {
  if (!o || typeof o !== 'object') return false;
  if (Array.isArray(o._champsCommerciaux) && o._champsCommerciaux.length) return true; // détecté sur la spec brute
  return _CHAMPS_COMMERCIAUX.some(function (c) { return Object.prototype.hasOwnProperty.call(o, c) && o[c] != null; });
}

// Validation PRODUCTION (renforcée). Rejette : fixture/test, entrée sans source/référence/
// unité/domaine, R/ζ non finis ou négatifs, masse volumique non renseignée, champ commercial.
// Familles vides tolérées (référentiel valide mais non utilisable pour le calcul → honnête).
function validerReferentielProduction(ref) {
  var erreurs = [];
  var need = function (cond, code) { if (!cond) erreurs.push(code); };
  need(ref && ref.referentielId != null, 'referentielId_absent');
  need(ref && ref.version != null, 'version_absente');
  need(ref && ref.datePublication != null, 'datePublication_absente');
  need(ref && ref.sourcePrincipale != null, 'sourcePrincipale_absente');
  need(ref && ref.statut != null, 'statut_absent');
  var estProduction = !!(ref && ref.statut === STATUT_REFERENTIEL.PRODUCTION && ref.provenance !== 'test');
  if (ref && (ref.statut === STATUT_REFERENTIEL.TEST || ref.provenance === 'test')) erreurs.push('fixture_non_utilisable_en_production');
  var mva = ref && ref.masseVolumiqueAir;
  need(mva && typeof mva.valeur === 'number' && isFinite(mva.valeur) && mva.valeur > 0 && mva.unite && mva.source, 'masse_volumique_incomplete');

  var lineaires = (ref && Array.isArray(ref.lineaires)) ? ref.lineaires : [];
  var singuliers = (ref && Array.isArray(ref.singuliers)) ? ref.singuliers : [];
  var entreeErr = function (e, prefixe) {
    var pb = [];
    if (_contientChampCommercial(e)) pb.push('champ_commercial');
    if (e.source == null) pb.push('source_absente');
    if (e.referenceExacte == null) pb.push('reference_exacte_absente');
    if (e.domaine == null) pb.push('domaine_absent');
    if (e.statut == null) pb.push('statut_absent');
    return pb.map(function (p) { return prefixe + ':' + (e.id || '?') + ':' + p; });
  };
  lineaires.forEach(function (e) {
    if (e.unite !== 'Pa/m') erreurs.push('lineaire:' + (e.id || '?') + ':unite_invalide');
    if (!(typeof e.R === 'number' && isFinite(e.R))) erreurs.push('lineaire:' + (e.id || '?') + ':R_non_fini');
    else if (e.R < 0) erreurs.push('lineaire:' + (e.id || '?') + ':R_negatif');
    if (e.typeConduit == null) erreurs.push('lineaire:' + (e.id || '?') + ':type_conduit_absent');
    if (e.diametre == null && e.section == null) erreurs.push('lineaire:' + (e.id || '?') + ':diametre_ou_section_absent');
    Array.prototype.push.apply(erreurs, entreeErr(e, 'lineaire'));
  });
  singuliers.forEach(function (e) {
    if (e.unite !== '') erreurs.push('singulier:' + (e.id || '?') + ':unite_invalide');
    if (!(typeof e.coefficient === 'number' && isFinite(e.coefficient))) erreurs.push('singulier:' + (e.id || '?') + ':coefficient_non_fini');
    else if (e.coefficient < 0) erreurs.push('singulier:' + (e.id || '?') + ':coefficient_negatif');
    if (e.type == null) erreurs.push('singulier:' + (e.id || '?') + ':type_absent');
    if (e.geometrie == null) erreurs.push('singulier:' + (e.id || '?') + ':geometrie_absente');
    Array.prototype.push.apply(erreurs, entreeErr(e, 'singulier'));
  });
  // M57 LOT25 (additif) : rugosités ε (validées seulement si présentes → V1 vide reste valide).
  var rugosites = (ref && Array.isArray(ref.rugosites)) ? ref.rugosites : [];
  rugosites.forEach(function (e) {
    if (!(typeof e.epsilon === 'number' && isFinite(e.epsilon))) erreurs.push('rugosite:' + (e.id || '?') + ':epsilon_non_fini');
    else if (e.epsilon < 0) erreurs.push('rugosite:' + (e.id || '?') + ':epsilon_negatif');
    if (e.uniteEpsilon == null) erreurs.push('rugosite:' + (e.id || '?') + ':unite_absente');
    if (e.typeConduit == null) erreurs.push('rugosite:' + (e.id || '?') + ':type_conduit_absent');
    Array.prototype.push.apply(erreurs, entreeErr(e, 'rugosite'));
  });
  var visc = ref && ref.viscositeDynamiqueAir;
  if (visc) { if (!(typeof visc.valeur === 'number' && isFinite(visc.valeur) && visc.valeur > 0 && visc.unite && visc.source)) erreurs.push('viscosite_dynamique_incomplete'); }
  var valide = erreurs.length === 0;
  return {
    valide: valide,
    erreurs: erreurs,
    utilisableEnProduction: valide && estProduction,
    familles: { lineaires: lineaires.length, singuliers: singuliers.length, rugosites: rugosites.length },
    utilisablePourCalcul: valide && estProduction && (lineaires.length > 0 || singuliers.length > 0), // voie LOT15-A (table R/ζ) : vide = honnêtement non calculable
    // M57 LOT26 (additif) : voie LOT25 (Darcy-Weisbach) — calculable si ε(famille) + ρ + μ présents.
    utilisablePourCalculDarcy: valide && estProduction && rugosites.length > 0 && !!(ref && ref.masseVolumiqueAir && typeof ref.masseVolumiqueAir.valeur === 'number' && ref.viscositeDynamiqueAir && typeof ref.viscositeDynamiqueAir.valeur === 'number')
  };
}

// Compile le référentiel PRODUCTION (rich) → forme MOTEUR (LOT15-B) consommée par LOT15-A,
// SANS modifier le moteur. Ne compile PAS une entrée hors des capacités V1 du moteur (une
// condition de débit n'est pas discriminable côté moteur : entrée reportée, jamais aplatie
// silencieusement) ni un conflit (même conduit/diamètre, R différents → aucune valeur choisie).
function compilerReferentielPertes(ref) {
  var rapport = { entreesCompilees: [], entreesNonCompilees: [], conflits: [] };
  var lineaire = {}, singulier = {};
  var v = validerReferentielProduction(ref);
  if (!v.utilisableEnProduction) {
    // Référentiel non utilisable (fixture, invalide) → maps vides + raison. Aucun calcul possible.
    return { referentiel: creerReferentielPertes({ id: ref && ref.referentielId, methode: (ref && ref.methodes && ref.methodes[0] && ref.methodes[0].id) || null, source: ref && ref.sourcePrincipale, version: ref && ref.version, provenance: ref && ref.provenance, dateValidation: ref && ref.datePublication, masseVolumiqueAir: ref && ref.masseVolumiqueAir, lineaire: {}, singulier: {} }), rapport: Object.assign(rapport, { utilisable: false, raison: v.erreurs }) };
  }
  (ref.lineaires || []).forEach(function (e) {
    if (e.diametre == null) { rapport.entreesNonCompilees.push({ id: e.id, raison: 'diametre_requis_par_moteur_v1' }); return; }
    if (e.debitMin != null || e.debitMax != null) { rapport.entreesNonCompilees.push({ id: e.id, raison: 'condition_debit_non_supportee_v1' }); return; } // pas d'aplatissement silencieux
    lineaire[e.typeConduit] = lineaire[e.typeConduit] || {};
    if (lineaire[e.typeConduit][e.diametre] != null && lineaire[e.typeConduit][e.diametre] !== e.R) {
      rapport.conflits.push({ conduit: e.typeConduit, diametre: e.diametre }); delete lineaire[e.typeConduit][e.diametre]; return; // aucun choix silencieux
    }
    lineaire[e.typeConduit][e.diametre] = e.R; rapport.entreesCompilees.push({ type: 'lineaire', id: e.id });
  });
  (ref.singuliers || []).forEach(function (e) {
    if (e.geometrie == null) { rapport.entreesNonCompilees.push({ id: e.id, raison: 'geometrie_requise_par_moteur_v1' }); return; }
    singulier[e.type] = singulier[e.type] || {};
    singulier[e.type][e.geometrie] = { coefficient: e.coefficient }; rapport.entreesCompilees.push({ type: 'singulier', id: e.id });
  });
  var moteur = creerReferentielPertes({
    id: ref.referentielId, methode: (ref.methodes && ref.methodes[0] && ref.methodes[0].id) || 'table_lineaire_pa_par_m',
    source: ref.sourcePrincipale, version: ref.version, provenance: ref.provenance, dateValidation: ref.datePublication,
    masseVolumiqueAir: ref.masseVolumiqueAir, lineaire: lineaire, singulier: singulier
  });
  rapport.utilisable = true;
  return { referentiel: moteur, rapport: rapport };
}

// Trace minimale pour rendre une étude auditable : « quel référentiel / version a été utilisé ? »
function traceReferentielPertes(ref) {
  if (!ref) return null;
  return { referentielId: _ouNull(ref.referentielId), version: _ouNull(ref.version), statut: _ouNull(ref.statut), sourcePrincipale: _ouNull(ref.sourcePrincipale), datePublication: _ouNull(ref.datePublication) };
}


// =====================================================================
// M57 LOT25 — MOTEUR DE PERTES LINÉAIRES DÉBIT-DÉPENDANT VMC (Darcy-Weisbach)
// =====================================================================
// Moteur MATHÉMATIQUE PUR. Calcule une perte de charge LINÉAIRE par la méthode Darcy-Weisbach
//   Δp = f · (L/Dh) · (ρ·V²/2),  V = Q/S,  S = π·Dh²/4 (circulaire),  Re = ρ·V·Dh/μ
// avec fermeture du coefficient de frottement : f = 64/Re (laminaire, Re<2000) ; Colebrook-White
// résolue numériquement (turbulent). Réf. méthode : ASHRAE Handbook—Fundamentals, Duct Design
// (Darcy, éq. 19 ; Colebrook 1938-39, éq. 20). Le moteur NE fournit AUCUNE valeur : ρ, μ, ε
// viennent d'un référentiel INJECTÉ. Il ne lit aucun fichier, aucun stockage local, aucun rendu,
// ne touche ni configuration tarifaire, ni catalogue, ni prix, ni Runtime, ne fait AUCUN fallback.
// « donnée absente » → statut incomplet + null (jamais 0, jamais moyenne, jamais valeur prudente).
// LOT25 traite UNIQUEMENT le linéaire (les pertes singulières restent hors de ce moteur).

var METHODE_PERTE_LINEAIRE_VMC = 'darcy_weisbach_colebrook_white';
// Bornes de régime. La zone de TRANSITION (RE_LAMINAIRE_MAX ≤ Re < RE_TURBULENT_MIN) n'est
// couverte NI par f=64/Re NI par Colebrook : elle est signalée, jamais calculée comme établie.
var RE_LAMINAIRE_MAX = 2000;
var RE_TURBULENT_MIN = 4000;

// Conversion EXPLICITE vers SI. Retourne {ok, valeur} | {manquant} | {invalide, raison}.
function _versSI(champ, categorie) {
  if (champ == null || (typeof champ === 'object' && champ.valeur == null)) return { manquant: true };
  var v = (typeof champ === 'object') ? champ.valeur : champ;
  var u = (typeof champ === 'object') ? champ.unite : null;
  if (typeof v !== 'number' || !isFinite(v)) return { invalide: true, raison: 'valeur_non_numerique' };
  var f;
  if (categorie === 'debit') f = ({ 'm3/s': 1, 'm3/h': 1 / 3600, 'l/s': 1 / 1000, 'L/s': 1 / 1000 })[u];
  else if (categorie === 'longueur') f = ({ 'm': 1, 'cm': 0.01, 'mm': 0.001 })[u];
  else if (categorie === 'diametre' || categorie === 'rugosite') f = ({ 'm': 1, 'cm': 0.01, 'mm': 0.001 })[u];
  else if (categorie === 'masseVolumique') f = ({ 'kg/m3': 1, 'kg/m³': 1 })[u];
  else if (categorie === 'viscosite') f = ({ 'Pa.s': 1, 'Pa·s': 1, 'pa.s': 1 })[u];
  if (f == null) return { invalide: true, raison: 'unite_inconnue:' + (u == null ? 'absente' : u) };
  return { ok: true, valeur: v * f };
}

// Résolution numérique de Colebrook-White : 1/√f = -2·log10( εr/3.7 + 2.51/(Re·√f) ).
// Itération de point fixe déterministe et bornée. f0=0.02 (valeur initiale documentée, hors zone
// physique sensible) ; critère |f_{n+1}-f_n| ≤ tolérance ; maxIterations borne stricte.
function _resoudreColebrook(Re, epsilonRelatif, maxIterations, tolerance) {
  var f = 0.02, i = 0, conv = false, fNew;
  for (i = 0; i < maxIterations; i++) {
    var rhs = -2 * Math.log(epsilonRelatif / 3.7 + 2.51 / (Re * Math.sqrt(f))) / Math.LN10; // log10
    fNew = 1 / (rhs * rhs);
    if (!isFinite(fNew) || fNew <= 0) { return { f: null, iterations: i + 1, convergence: false, critere: 'valeur_non_physique' }; }
    if (Math.abs(fNew - f) <= tolerance) { return { f: fNew, iterations: i + 1, convergence: true, critere: '|Δf|<=' + tolerance }; }
    f = fNew;
  }
  return { f: null, iterations: i, convergence: false, critere: 'max_iterations_atteint' };
}

function calculerPerteLineaireVmc(entree, options) {
  entree = entree || {};
  options = options || {};
  var maxIter = (typeof options.maxIterations === 'number' && options.maxIterations > 0) ? options.maxIterations : 50;
  var tol = (typeof options.tolerance === 'number' && options.tolerance > 0) ? options.tolerance : 1e-8;
  var methode = Object.assign({ id: METHODE_PERTE_LINEAIRE_VMC, version: null, source: null, provenance: null, referentielId: null },
    options.methode || {});
  var donneesManquantes = [], pointsAVerifier = [], erreurs = [], hypotheses = [];
  var base = function (statut, extra) {
    return Object.assign({
      statut: statut, methode: methode,
      debit: null, section: null, vitesse: null, reynolds: null, regime: null,
      facteurFrottement: null, perteLineaire: null, perteParMetre: null,
      parametresUtilises: null, hypotheses: hypotheses, erreurs: erreurs,
      donneesManquantes: donneesManquantes, pointsAVerifier: pointsAVerifier
    }, extra || {});
  };

  // 0. Géométrie : V1 circulaire uniquement (aucun diamètre équivalent inventé).
  var geo = entree.geometrie || 'circulaire';
  if (geo !== 'circulaire') { pointsAVerifier.push({ type: 'technique', description: 'Géométrie « ' + geo +' » non supportée (V1 circulaire uniquement).' }); return base('geometrie_non_supportee'); }

  // 1. Conversion SI + validation de signe/plausibilité.
  var Q = _versSI(entree.debit, 'debit');
  var L = _versSI(entree.longueur, 'longueur');
  var D = _versSI(entree.diametreHydraulique, 'diametre');
  var EPS = _versSI(entree.rugosite, 'rugosite');
  var air = entree.air || {};
  var RHO = _versSI(air.masseVolumique, 'masseVolumique');
  var MU = _versSI(air.viscositeDynamique, 'viscosite');
  var inval = function (r, o) { if (o.invalide) erreurs.push(r + ':' + o.raison); };
  inval('debit', Q); inval('longueur', L); inval('diametre_hydraulique', D); inval('rugosite', EPS);
  inval('masse_volumique', RHO); inval('viscosite_dynamique', MU);
  if (Q.ok && Q.valeur < 0) erreurs.push('debit:valeur_negative');
  if (L.ok && L.valeur < 0) erreurs.push('longueur:valeur_negative');
  if (D.ok && D.valeur <= 0) erreurs.push('diametre_hydraulique:valeur_non_positive');
  if (EPS.ok && EPS.valeur < 0) erreurs.push('rugosite:valeur_negative');
  if (RHO.ok && RHO.valeur <= 0) erreurs.push('masse_volumique:valeur_non_positive');
  if (MU.ok && MU.valeur <= 0) erreurs.push('viscosite_dynamique:valeur_non_positive');
  if (erreurs.length) return base('invalide');

  // 2. Données indispensables à toute la chaîne géométrie/débit.
  if (D.manquant) donneesManquantes.push({ champ: 'diametre_hydraulique', impact: 'section_vitesse' });
  if (Q.manquant) donneesManquantes.push({ champ: 'debit', impact: 'vitesse' });
  if (L.manquant) donneesManquantes.push({ champ: 'longueur', impact: 'perte_lineaire' });
  if (donneesManquantes.length) return base('incomplet');

  var S = Math.PI * D.valeur * D.valeur / 4;                 // m²
  var champDebit = { valeur: Q.valeur, unite: 'm3/s' };
  var champSection = { valeur: S, unite: 'm2' };

  // 3. Débit nul : Δp = 0 (aucun écoulement → aucune perte). Justifié, pas une valeur inventée.
  if (Q.valeur === 0) {
    return base('debit_nul', { debit: champDebit, section: champSection, vitesse: { valeur: 0, unite: 'm/s' }, reynolds: { valeur: 0 }, regime: null,
      perteLineaire: { valeur: 0, unite: 'Pa' }, perteParMetre: (L.valeur > 0 ? { valeur: 0, unite: 'Pa/m' } : null) });
  }

  // 4. Reynolds nécessite ρ et μ.
  if (RHO.manquant) donneesManquantes.push({ champ: 'masse_volumique_air', impact: 'reynolds_perte' });
  if (MU.manquant) donneesManquantes.push({ champ: 'viscosite_dynamique_air', impact: 'reynolds' });
  if (donneesManquantes.length) return base('incomplet', { debit: champDebit, section: champSection });

  var V = Q.valeur / S;                                      // m/s
  var Re = RHO.valeur * V * D.valeur / MU.valeur;
  var champV = { valeur: V, unite: 'm/s' }, champRe = { valeur: Re };
  var regime = (Re < RE_LAMINAIRE_MAX) ? 'laminaire' : ((Re < RE_TURBULENT_MIN) ? 'transition' : 'turbulent');

  // 5. Coefficient de frottement.
  // Zone de TRANSITION (2000 ≤ Re < 4000) : la méthode retenue ne la couvre pas proprement
  // → perte NON calculée (jamais présentée comme établie), statut explicite.
  if (regime === 'transition') {
    pointsAVerifier.push({ type: 'technique', description: 'Reynolds en zone de transition (' + RE_LAMINAIRE_MAX + ' ≤ Re < ' + RE_TURBULENT_MIN + ') : perte non calculable par la méthode retenue (laminaire / Colebrook-White).' });
    return base('transition', { debit: champDebit, section: champSection, vitesse: champV, reynolds: champRe, regime: regime });
  }
  var ff;
  if (regime === 'laminaire') {
    ff = { valeur: 64 / Re, methode: 'laminaire_64_sur_Re', iterations: 0, convergence: true, critere: 'exact' };
  } else {
    if (EPS.manquant) { donneesManquantes.push({ champ: 'rugosite', impact: 'colebrook_turbulent' }); return base('incomplet', { debit: champDebit, section: champSection, vitesse: champV, reynolds: champRe, regime: regime }); }
    var col = _resoudreColebrook(Re, EPS.valeur / D.valeur, maxIter, tol);
    if (!col.convergence || col.f == null) {
      return base('calcul_non_converge', { debit: champDebit, section: champSection, vitesse: champV, reynolds: champRe, regime: regime,
        facteurFrottement: { valeur: null, methode: 'colebrook_white', iterations: col.iterations, convergence: false, critere: col.critere } });
    }
    ff = { valeur: col.f, methode: 'colebrook_white', iterations: col.iterations, convergence: true, critere: col.critere };
  }

  // 6. Darcy-Weisbach.
  var dP = ff.valeur * (L.valeur / D.valeur) * (RHO.valeur * V * V / 2); // Pa
  var parMetre = (L.valeur > 0) ? { valeur: dP / L.valeur, unite: 'Pa/m' } : null;

  return base('calculable', {
    debit: champDebit, section: champSection, vitesse: champV, reynolds: champRe, regime: regime,
    facteurFrottement: ff,
    perteLineaire: { valeur: dP, unite: 'Pa' },
    perteParMetre: parMetre,
    parametresUtilises: {
      epsilon: (EPS.ok ? { valeur: EPS.valeur, unite: 'm' } : null),
      masseVolumique: { valeur: RHO.valeur, unite: 'kg/m3' },
      viscositeDynamique: { valeur: MU.valeur, unite: 'Pa.s' },
      diametreHydraulique: { valeur: D.valeur, unite: 'm' }, longueur: { valeur: L.valeur, unite: 'm' }
    }
  });
}

// Adaptateur LOT22 → entrée LOT25. Frontière SÉPARÉE du moteur. Lit une entrée de référentiel
// DÉJÀ injectée (ne charge aucun fichier), récupère ε de la famille de conduit, ρ/μ de l'air et
// les métadonnées de méthode, refuse une donnée non exploitable. AUCUN fallback, AUCUN choix
// silencieux de famille/diamètre/produit. Ne calcule rien (délègue à calculerPerteLineaireVmc).
function adaptateurReferentielPertesVmc(troncon, referentiel, options) {
  troncon = troncon || {}; options = options || {};
  var raisons = [];
  if (!referentiel) return { exploitable: false, entree: null, raisons: ['referentiel_absent'], trace: null };
  // ε : recherche STRICTE par famille (+ géométrie si fournie). Aucune famille voisine, aucune moyenne.
  var rugs = Array.isArray(referentiel.rugosites) ? referentiel.rugosites : [];
  var famille = troncon.typeConduit || null;
  var candidat = rugs.filter(function (r) {
    return r.typeConduit === famille && (troncon.geometrieRugosite == null || r.geometrie === troncon.geometrieRugosite);
  });
  if (famille == null) raisons.push('type_conduit_absent_troncon');
  if (candidat.length === 0) raisons.push('rugosite_absente_famille:' + (famille || '?'));
  if (candidat.length > 1) raisons.push('rugosite_ambigue_famille:' + (famille || '?')); // aucun choix silencieux
  var eps = (candidat.length === 1) ? candidat[0] : null;
  var mva = referentiel.masseVolumiqueAir, mu = referentiel.viscositeDynamiqueAir;
  if (!(mva && typeof mva.valeur === 'number')) raisons.push('masse_volumique_absente_referentiel');
  if (!(mu && typeof mu.valeur === 'number')) raisons.push('viscosite_absente_referentiel');
  if (raisons.length) return { exploitable: false, entree: null, raisons: raisons, trace: traceReferentielPertes(referentiel) };

  var entree = {
    geometrie: 'circulaire',
    debit: (troncon.debit != null ? { valeur: troncon.debit, unite: troncon.uniteDebit || 'm3/h' } : null),
    longueur: (troncon.longueur != null ? { valeur: troncon.longueur, unite: troncon.uniteLongueur || 'm' } : null),
    diametreHydraulique: (troncon.diametre != null ? { valeur: troncon.diametre, unite: troncon.uniteDiametre || 'mm' } : null),
    rugosite: { valeur: eps.epsilon, unite: eps.uniteEpsilon },
    air: { masseVolumique: { valeur: mva.valeur, unite: mva.unite }, viscositeDynamique: { valeur: mu.valeur, unite: mu.unite } }
  };
  var methode = {
    id: METHODE_PERTE_LINEAIRE_VMC,
    version: referentiel.version || null, source: referentiel.sourcePrincipale || null,
    provenance: referentiel.provenance || null, referentielId: referentiel.referentielId || null,
    rugositeSource: eps.source || null, rugositeReference: eps.referenceExacte || null, rugositeDomaine: eps.domaine || null
  };
  return { exploitable: true, entree: entree, methode: methode, raisons: [], trace: traceReferentielPertes(referentiel) };
}


// =====================================================================
// M57 LOT29 — SOCLE DE GRAPHE AÉRAULIQUE VMC (topologie orientée, parcours, validation)
// =====================================================================
// Représente et parcourt réellement Terminal→nœud→tronçon→nœud→… Les arêtes orientées sont
// portées par les tronçons (noeudAmont→noeudAval) et le rattachement terminal par terminal.noeudId.
// PUR, non mutant, hors money-path, aucune règle réglementaire, aucun débit inventé. LOT29 fournit
// le SOCLE ; la dérivation de débit (LOT28) l'utilise quand le graphe est réellement décrit.

// Détecte un cycle dans les arêtes orientées noeudAmont→noeudAval (DFS coloration).
function _grapheCycle(troncons) {
  var adj = {}; (troncons || []).forEach(function (t) { if (t.noeudAmont != null && t.noeudAval != null) (adj[t.noeudAmont] = adj[t.noeudAmont] || []).push(t.noeudAval); });
  var etat = {};
  var dfs = function (n) { if (etat[n] === 0) return true; if (etat[n] === 1) return false; etat[n] = 0; var c = (adj[n] || []).some(dfs); etat[n] = 1; return c; };
  return Object.keys(adj).some(function (n) { return etat[n] === undefined && dfs(n); });
}

// Validation topologique PURE. INVALIDE = référence cassée (nœud/amont/aval inconnu, auto-
// référence, cycle). INCOMPLET = relation manquante (tronçon sans nœuds, terminal non raccordé).
function validerTopologieVmc(donneesReseau) {
  var reseauxIn = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  var reseaux = reseauxIn.map(function (r) {
    var noeuds = {}; (r.noeuds || []).forEach(function (n) { if (n && n.id != null) noeuds[n.id] = true; });
    var erreurs = [], incomplets = [], signals = [];
    (r.troncons || []).forEach(function (t) {
      var ref = t.id || t.role || 'troncon', a = t.noeudAmont, b = t.noeudAval;
      if (a == null && b == null) { incomplets.push({ code: 'troncon_sans_noeuds', troncon: ref }); return; }
      if (a != null && !noeuds[a]) erreurs.push({ code: 'troncon_amont_inconnu', troncon: ref, noeud: a });
      if (b != null && !noeuds[b]) erreurs.push({ code: 'troncon_aval_inconnu', troncon: ref, noeud: b });
      if (a != null && a === b) erreurs.push({ code: 'troncon_auto_reference', troncon: ref, noeud: a });
      if (a == null || b == null) incomplets.push({ code: 'troncon_extremite_manquante', troncon: ref });
    });
    (r.terminaux || []).forEach(function (tm) {
      if (tm.noeudId == null) { incomplets.push({ code: 'terminal_non_raccorde', terminal: (tm.id || tm.pieceRef) }); return; }
      if (!noeuds[tm.noeudId]) erreurs.push({ code: 'noeud_inconnu', terminal: (tm.id || tm.pieceRef), noeud: tm.noeudId });
    });
    if (_grapheCycle(r.troncons || [])) erreurs.push({ code: 'cycle_topologique' });
    var utilises = {};
    (r.troncons || []).forEach(function (t) { if (t.noeudAmont != null) utilises[t.noeudAmont] = 1; if (t.noeudAval != null) utilises[t.noeudAval] = 1; });
    (r.terminaux || []).forEach(function (tm) { if (tm.noeudId != null) utilises[tm.noeudId] = 1; });
    Object.keys(noeuds).forEach(function (id) { if (!utilises[id]) signals.push({ code: 'noeud_isole', noeud: id }); });
    return { type: r.type, valide: erreurs.length === 0, complet: incomplets.length === 0, erreurs: erreurs, incomplets: incomplets, signals: signals, cycle: _grapheCycle(r.troncons || []) };
  });
  return { valide: reseaux.every(function (x) { return x.valide; }), reseaux: reseaux };
}

// Parcours orienté PUR : index nœuds/tronçons, voisins amont/aval, degrés, terminaux par nœud,
// cycle. Aucun calcul hydraulique.
function parcourirGrapheVmc(donneesReseau) {
  var reseauxIn = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  var reseaux = reseauxIn.map(function (r) {
    var noeuds = (r.noeuds || []).map(function (n) { return n.id; }).filter(function (x) { return x != null; });
    var avalDe = {}, amontDe = {}, outDeg = {}, inDeg = {}, edges = [];
    noeuds.forEach(function (n) { avalDe[n] = []; amontDe[n] = []; outDeg[n] = 0; inDeg[n] = 0; });
    (r.troncons || []).forEach(function (t) {
      if (t.noeudAmont == null || t.noeudAval == null) return;
      edges.push({ id: t.id, amont: t.noeudAmont, aval: t.noeudAval });
      (avalDe[t.noeudAmont] = avalDe[t.noeudAmont] || []).push(t.noeudAval);
      (amontDe[t.noeudAval] = amontDe[t.noeudAval] || []).push(t.noeudAmont);
      outDeg[t.noeudAmont] = (outDeg[t.noeudAmont] || 0) + 1;
      inDeg[t.noeudAval] = (inDeg[t.noeudAval] || 0) + 1;
    });
    var terminauxParNoeud = {};
    (r.terminaux || []).forEach(function (tm) { if (tm.noeudId != null) (terminauxParNoeud[tm.noeudId] = terminauxParNoeud[tm.noeudId] || []).push({ id: tm.id, debit: (typeof tm.debit === 'number' ? tm.debit : null), fonction: tm.fonction }); });
    return { type: r.type, noeuds: noeuds, edges: edges, avalDe: avalDe, amontDe: amontDe, outDegree: outDeg, inDegree: inDeg, terminauxParNoeud: terminauxParNoeud, cycle: _grapheCycle(r.troncons || []) };
  });
  return { reseaux: reseaux };
}

// Tri topologique (Kahn) ; reverse=true → aval avant amont. Retourne un ordre partiel (les
// nœuds d'un cycle éventuel en sont exclus — mais le cycle est déjà refusé en amont).
function _topoOrder(noeuds, edges, reverse) {
  var indeg = {}, adj = {}; noeuds.forEach(function (n) { indeg[n] = 0; adj[n] = []; });
  edges.forEach(function (e) { var from = reverse ? e.aval : e.amont, to = reverse ? e.amont : e.aval; if (adj[from] === undefined) adj[from] = []; if (indeg[to] === undefined) indeg[to] = 0; adj[from].push(to); indeg[to]++; });
  var q = noeuds.filter(function (n) { return indeg[n] === 0; }), order = [];
  while (q.length) { var n = q.shift(); order.push(n); (adj[n] || []).forEach(function (m) { indeg[m]--; if (indeg[m] === 0) q.push(m); }); }
  return order;
}

// Dérive les débits de tronçon PAR GRAPHE pour un réseau. Extraction : flux amont→aval vers la
// centrale → un tronçon porte le débit ENTRANT de son nœud amont (déterministe si ce nœud a un
// seul tronçon sortant). Insufflation : flux vers les terminaux → un tronçon porte la somme des
// terminaux de son SOUS-ARBRE aval (déterministe si chaque nœud a un seul tronçon entrant).
// Cycle / référence cassée / ambiguïté (divergence) / terminal sans débit → indéterminé + raison.
// Un terminal NON raccordé (noeudId null) rend les totaux dérivés non garantis → tronçons dérivés
// indéterminés (le relevé, lui, reste prioritaire). Aucune invention.
function _deriverParGrapheReseau(r) {
  var pv = [], dm = [];
  var indetTous = function (raison) {
    return { troncons: (r.troncons || []).map(function (t) { var ref = (t.id || t.pieceRef || t.role || 'troncon'); if (typeof t.debit === 'number') return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: t.debit, unite: 'm3/h', origine: 'releve', statut: 'releve' }; dm.push({ champ: raison + ':' + ref, impact: 'debit_troncon' }); return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: null, unite: 'm3/h', origine: 'indetermine', statut: 'indetermine', raison: raison }; }), pointsAVerifier: pv, donneesManquantes: dm };
  };
  var val = validerTopologieVmc({ reseaux: [r] }).reseaux[0];
  if (val.cycle) return indetTous('cycle_topologique');
  if (!val.valide) return indetTous('topologie_invalide');

  var G = parcourirGrapheVmc({ reseaux: [r] }).reseaux[0];
  var fonctionAttendue = (r.type === 'extraction') ? 'SORTIE_AIR' : 'INSUFFLATION';
  var termSum = {}, termComplet = {}, termContrib = {};
  G.noeuds.forEach(function (n) { termSum[n] = 0; termComplet[n] = true; termContrib[n] = []; });
  var raccordeAvecDebit = 0, nonRaccordeCoherent = 0;
  (r.terminaux || []).forEach(function (tm) {
    if (tm.fonction != null && tm.fonction !== fonctionAttendue) return; // fonction incohérente → hors graphe mécanique
    if (tm.noeudId == null) { nonRaccordeCoherent++; return; }
    if (termSum[tm.noeudId] === undefined) { termSum[tm.noeudId] = 0; termComplet[tm.noeudId] = true; termContrib[tm.noeudId] = []; }
    termContrib[tm.noeudId].push(tm.id || tm.pieceRef);
    if (typeof tm.debit === 'number') { termSum[tm.noeudId] += tm.debit; raccordeAvecDebit++; } else termComplet[tm.noeudId] = false;
  });
  if (nonRaccordeCoherent > 0) { pv.push({ type: 'topologie', description: 'Terminal non raccordé (noeudId absent) dans le réseau ' + r.type + ' : totaux dérivés non garantis.' }); return indetTous('terminal_non_raccorde'); }

  var det = {}, complet = {}, valeur = {}, contrib = {};
  if (r.type === 'extraction') {
    var order = _topoOrder(G.noeuds, G.edges, false);
    order.forEach(function (n) {
      var d = true, c = termComplet[n], v = termSum[n], ct = (termContrib[n] || []).slice();
      (G.amontDe[n] || []).forEach(function (x) {
        if (!(det[x] && G.outDegree[x] === 1)) d = false;
        else { v += valeur[x]; if (!complet[x]) c = false; ct = ct.concat(contrib[x]); }
      });
      det[n] = d; complet[n] = c; valeur[n] = v; contrib[n] = ct;
    });
  } else {
    var order2 = _topoOrder(G.noeuds, G.edges, true);
    order2.forEach(function (n) {
      var d = (G.inDegree[n] <= 1), c = termComplet[n], v = termSum[n], ct = (termContrib[n] || []).slice();
      (G.avalDe[n] || []).forEach(function (y) {
        if (!det[y]) d = false;
        else { v += valeur[y]; if (!complet[y]) c = false; ct = ct.concat(contrib[y]); }
      });
      det[n] = d; complet[n] = c; valeur[n] = v; contrib[n] = ct;
    });
  }

  var troncons = (r.troncons || []).map(function (t) {
    var ref = (t.id || t.pieceRef || t.role || 'troncon');
    // Candidat dérivé par graphe.
    var cand = null;
    if (t.noeudAmont != null && t.noeudAval != null) {
      if (r.type === 'extraction') {
        var x = t.noeudAmont;
        if (G.outDegree[x] !== 1) cand = { raison: 'topologie_ambigue' };
        else if (!det[x]) cand = { raison: 'topologie_ambigue' };
        else if (!complet[x]) cand = { raison: 'terminal_sans_debit' };
        else cand = { ok: true, valeur: valeur[x], contrib: contrib[x] };
      } else {
        var y = t.noeudAval;
        if (!det[y]) cand = { raison: (G.inDegree[y] > 1 ? 'topologie_ambigue' : 'topologie_insuffisante') };
        else if (!complet[y]) cand = { raison: 'terminal_sans_debit' };
        else cand = { ok: true, valeur: valeur[y], contrib: contrib[y] };
      }
    } else cand = { raison: 'troncon_sans_noeuds' };
    // Relevé prioritaire.
    if (typeof t.debit === 'number') {
      var out = { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: t.debit, unite: 'm3/h', origine: 'releve', statut: 'releve' };
      if (cand && cand.ok && cand.valeur !== t.debit) { out.debitDerive = cand.valeur; pv.push({ type: 'coherence', description: 'debit_troncon_releve_different_du_debit_derive:' + ref + ' (relevé ' + t.debit + ' ≠ dérivé ' + cand.valeur + ')' }); }
      return out;
    }
    if (cand && cand.ok) return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: cand.valeur, unite: 'm3/h', origine: 'derive', methode: 'graphe_' + r.type, terminauxContributeurs: cand.contrib, statut: 'derive' };
    dm.push({ champ: (cand ? cand.raison : 'topologie_insuffisante') + ':' + ref, impact: 'debit_troncon' });
    return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: null, unite: 'm3/h', origine: 'indetermine', statut: 'indetermine', raison: (cand ? cand.raison : 'topologie_insuffisante') };
  });
  return { troncons: troncons, pointsAVerifier: pv, donneesManquantes: dm };
}


// =====================================================================
// M57 LOT28 — DÉRIVATION DÉTERMINISTE DU DÉBIT DE TRONÇON VMC
// =====================================================================
// deriverDebitsTronconsVmc(donneesReseau, options?) : DÉDUIT le débit d'un tronçon UNIQUEMENT
// quand il est DÉMONTRABLE par la topologie disponible + les débits des terminaux (relevés).
// Aucune invention : débit réglementaire/moyen/par défaut/estimé INTERDITS. Modèle réellement
// exploitable = arbre à 2 niveaux (antennes rattachées à une pièce + collecteur unique) :
//   • antenne (pieceRef)  → Σ débits terminaux de la pièce (fonction cohérente avec le réseau) ;
//   • collecteur (unique) → Σ débits des antennes, si TOUTES déterminées.
// Un débit RELEVÉ sur le tronçon reste PRIORITAIRE (jamais remplacé) ; un dérivé divergent est
// signalé sans arbitrage. Ambiguïté / terminal sans débit / topologie insuffisante / cycle →
// débit null + statut indéterminé + raison explicite. Extraction et insufflation SÉPARÉS.
// Pur, déterministe, non mutant, hors money-path. NE calcule ni perte, ni pression, ni diamètre.
function _cycleTopologique(troncons) {
  // Garde optionnelle : si des arêtes noeudAmont→noeudAval sont présentes, refuser un cycle.
  var edges = troncons.filter(function (t) { return t.noeudAmont != null && t.noeudAval != null; });
  if (!edges.length) return false;
  var adj = {}; edges.forEach(function (t) { (adj[t.noeudAmont] = adj[t.noeudAmont] || []).push(t.noeudAval); });
  var etat = {}; // 0=en cours, 1=fini
  var dfs = function (n) {
    if (etat[n] === 0) return true; if (etat[n] === 1) return false;
    etat[n] = 0; var ok = (adj[n] || []).some(dfs); etat[n] = 1; return ok;
  };
  return Object.keys(adj).some(function (n) { return etat[n] === undefined && dfs(n); });
}

function deriverDebitsTronconsVmc(donneesReseau, options) {
  options = options || {};
  var reseauxIn = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  var donneesManquantes = [], pointsAVerifier = [];
  var dm = function (c) { if (c && !donneesManquantes.some(function (x) { return x.champ === c; })) donneesManquantes.push({ champ: c, impact: 'debit_troncon' }); };
  var pv = function (o) { if (o) pointsAVerifier.push(o); };

  var reseaux = reseauxIn.map(function (r) {
    var indet = function (t, ref, raison) { dm(raison + ':' + ref); return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: null, unite: 'm3/h', origine: 'indetermine', statut: 'indetermine', raison: raison }; };
    // M57 LOT29 : si le GRAPHE est réellement décrit (arêtes + terminaux raccordés), dérivation
    // générale par parcours orienté. Sinon → repli sur l'arbre à 2 niveaux (pièce/collecteur, LOT28).
    var aGraphe = (r.troncons || []).some(function (t) { return t.noeudAmont != null && t.noeudAval != null; }) && (r.terminaux || []).some(function (tm) { return tm.noeudId != null; });
    if (aGraphe) {
      var g = _deriverParGrapheReseau(r);
      (g.donneesManquantes || []).forEach(function (d) { if (!donneesManquantes.some(function (x) { return x.champ === d.champ; })) donneesManquantes.push(d); });
      (g.pointsAVerifier || []).forEach(function (p) { pointsAVerifier.push(p); });
      return { type: r.type, statut: 'traite', mode: 'graphe', troncons: g.troncons };
    }
    // Cycle : ne jamais traiter comme un arbre.
    if (_cycleTopologique(r.troncons || [])) {
      return { type: r.type, statut: 'indetermine', raison: 'cycle_topologique', troncons: (r.troncons || []).map(function (t) { return indet(t, (t.id || t.pieceRef || t.role || 'troncon'), 'cycle_topologique'); }) };
    }
    // 1. Débits terminaux agrégés par pièce (fonction cohérente avec le type de réseau).
    var fonctionAttendue = (r.type === 'extraction') ? 'SORTIE_AIR' : 'INSUFFLATION';
    var parPiece = {};
    (r.terminaux || []).forEach(function (tm) {
      if (tm.pieceRef == null) { pv({ type: 'topologie', description: 'Terminal non rattaché à une pièce (réseau ' + r.type + ') : non pris en compte dans la dérivation.' }); return; }
      if (tm.fonction != null && tm.fonction !== fonctionAttendue) return; // fonction incohérente → ignoré
      var g = parPiece[tm.pieceRef] || (parPiece[tm.pieceRef] = { total: 0, complet: true, terminaux: [] });
      g.terminaux.push(tm.id || tm.pieceRef);
      if (typeof tm.debit === 'number') g.total += tm.debit; else g.complet = false;
    });
    // 2. Antennes / collecteurs.
    var troncons0 = r.troncons || [];
    var estAntenne = function (t) { return t.role === 'antenne' || (t.role == null && t.pieceRef != null); };
    var antennes = troncons0.filter(estAntenne);
    var collecteurs = troncons0.filter(function (t) { return t.role === 'collecteur'; });
    var comptePieceAntenne = {};
    antennes.forEach(function (t) { if (t.pieceRef != null) comptePieceAntenne[t.pieceRef] = (comptePieceAntenne[t.pieceRef] || 0) + 1; });

    // Débit dérivable d'une antenne (sans tenir compte d'un éventuel relevé) → pour comparaison.
    var deriveAntenne = function (t) {
      if (t.pieceRef == null) return { ok: false, raison: 'antenne_sans_pieceRef' };
      if (comptePieceAntenne[t.pieceRef] > 1) return { ok: false, raison: 'ambiguite_antenne_pieceRef' };
      var g = parPiece[t.pieceRef];
      if (!g || g.terminaux.length === 0) return { ok: false, raison: 'aucun_terminal_pour_piece' };
      if (!g.complet) return { ok: false, raison: 'terminal_sans_debit' };
      return { ok: true, valeur: g.total, contributeurs: g.terminaux.slice() };
    };
    var deriveCollecteur = function () {
      if (collecteurs.length > 1) return { ok: false, raison: 'plusieurs_collecteurs_topologie_ambigue' };
      if (antennes.length === 0) return { ok: false, raison: 'aucune_antenne' };
      var total = 0, contribs = [], complet = true;
      antennes.forEach(function (a) { var d = deriveAntenne(a); if (!d.ok) { complet = false; return; } total += d.valeur; contribs = contribs.concat(d.contributeurs); });
      if (!complet) return { ok: false, raison: 'antennes_non_determinees' };
      return { ok: true, valeur: total, contributeurs: contribs };
    };

    var troncons = troncons0.map(function (t) {
      var ref = (t.id || t.pieceRef || t.role || 'troncon');
      var cand = estAntenne(t) ? deriveAntenne(t) : (t.role === 'collecteur' ? deriveCollecteur() : { ok: false, raison: 'topologie_insuffisante' });
      // Débit RELEVÉ prioritaire.
      if (typeof t.debit === 'number') {
        var out = { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: t.debit, unite: 'm3/h', origine: 'releve', statut: 'releve' };
        if (cand.ok && cand.valeur !== t.debit) { out.debitDerive = cand.valeur; pv({ type: 'coherence', description: 'debit_troncon_releve_different_du_debit_derive:' + ref + ' (relevé ' + t.debit + ' ≠ dérivé ' + cand.valeur + ')' }); }
        return out;
      }
      if (cand.ok) {
        return { tronconId: (t.id || null), ref: ref, reseau: r.type, debit: cand.valeur, unite: 'm3/h', origine: 'derive', methode: (estAntenne(t) ? 'somme_debits_terminaux_piece' : 'somme_debits_antennes_aval'), terminauxContributeurs: cand.contributeurs, statut: 'derive' };
      }
      return indet(t, ref, cand.raison);
    });
    return { type: r.type, statut: 'traite', troncons: troncons };
  });

  return { reseaux: reseaux, donneesManquantes: donneesManquantes, pointsAVerifier: pointsAVerifier };
}


// =====================================================================
// M57 LOT27 — BRANCHEMENT Darcy/Colebrook (LOT25) dans l'ÉTUDE (voie parallèle)
// =====================================================================
// etudeDarcyVmc(donneesReseau, referentiel, options?) calcule, PAR TRONÇON et PAR RÉSEAU, la
// perte LINÉAIRE via l'adaptateur LOT22→LOT25 + calculerPerteLineaireVmc. VOIE PARALLÈLE : elle
// n'altère pas la voie historique LOT15-A (etude.pertes). Débit/longueur/diamètre proviennent du
// réseau NORMALISÉ (relevé de visite ; le choix existant/projet/mixte est déjà appliqué en amont)
// — AUCUNE invention, AUCUN fallback de famille, extraction et insufflation JAMAIS additionnées.
// Ne calcule NI singularités, NI composants, NI pression centrale, NI conformité. Hors money-path.
function etudeDarcyVmc(donneesReseau, referentiel, options) {
  options = options || {};
  if (!referentiel) return { disponible: false, raison: 'referentiel_production_absent', reseaux: [], donneesManquantes: [{ champ: 'referentiel_production', impact: 'darcy' }], pointsAVerifier: [] };
  var reseauxIn = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  var donneesManquantes = [], pointsAVerifier = [];
  var dm = function (c, i) { if (c && !donneesManquantes.some(function (x) { return x.champ === c; })) donneesManquantes.push({ champ: c, impact: i || 'darcy' }); };

  // M57 LOT28 : dérivation déterministe du débit de tronçon (utilisée SEULEMENT si le débit du
  // tronçon n'est pas déjà relevé). Aucune invention : un débit non démontrable reste null.
  var derivation = deriverDebitsTronconsVmc(donneesReseau);
  var debitDerivePour = function (type, tronconId) {
    var rr = (derivation.reseaux || []).filter(function (x) { return x.type === type; })[0];
    var td = rr ? (rr.troncons || []).filter(function (x) { return x.tronconId === tronconId; })[0] : null;
    return (td && td.origine === 'derive' && typeof td.debit === 'number') ? td : null;
  };

  var reseaux = reseauxIn.map(function (r) {
    var troncons = (r.troncons || []).map(function (t) {
      var ref = (t.id || t.pieceRef || t.role || 'troncon');
      // Débit : relevé prioritaire ; sinon dérivé déterministe (LOT28) ; sinon null (aucune invention).
      var der = (t.debit == null) ? debitDerivePour(r.type, (t.id || null)) : null;
      var debitUtilise = (t.debit != null) ? t.debit : (der ? der.debit : null);
      var origineDebit = (t.debit != null) ? 'releve' : (der ? 'derive' : 'absent');
      var tr = { tronconId: (t.id || null), ref: ref, pieceRef: (t.pieceRef || null), reseau: r.type, typeConduit: (t.typeConduit || null),
        debit: (debitUtilise != null ? debitUtilise : null), origineDebit: origineDebit,
        debitDerivation: (der ? { methode: der.methode, terminauxContributeurs: der.terminauxContributeurs } : null),
        longueur: (t.longueur != null ? t.longueur : null), diametre: (t.diametre != null ? t.diametre : null) };
      // Adaptateur : ε (famille RÉELLEMENT déclarée) + air + méthode. AUCUN fallback de famille.
      var a = adaptateurReferentielPertesVmc({ typeConduit: t.typeConduit, debit: debitUtilise, longueur: t.longueur, diametre: t.diametre }, referentiel);
      if (!a.exploitable) {
        (a.raisons || []).forEach(function (x) { dm(x, 'darcy'); });
        return Object.assign(tr, { statut: 'incomplet', perteLineaire: null, perteParMetre: null, calcul: null, donneesManquantes: (a.raisons || []) });
      }
      var c = calculerPerteLineaireVmc(a.entree, { methode: a.methode });
      (c.donneesManquantes || []).forEach(function (d) { dm(d.champ, 'darcy'); });
      return Object.assign(tr, {
        statut: c.statut, perteLineaire: c.perteLineaire, perteParMetre: c.perteParMetre,
        reynolds: c.reynolds, regime: c.regime, facteurFrottement: c.facteurFrottement,
        methode: c.methode, parametresUtilises: c.parametresUtilises, calcul: c
      });
    });
    var calc = troncons.filter(function (t) { return t.statut === 'calculable'; });
    var statutReseau = (troncons.length === 0) ? 'indetermine' : ((calc.length === troncons.length) ? 'lineaire_calculee' : (calc.length > 0 ? 'partiel' : 'incomplet'));
    // Somme linéaire UNIQUEMENT si TOUS les tronçons sont calculables (jamais un total partiel
    // présenté comme complet). Les pertes SINGULIÈRES / composants ne sont PAS incluses.
    var totalOk = (calc.length === troncons.length && troncons.length > 0);
    var perteTot = totalOk ? Math.round(calc.reduce(function (s, t) { return s + t.perteLineaire.valeur; }, 0) * 1000) / 1000 : null;
    return { type: r.type, statut: statutReseau, troncons: troncons,
      perteLineaireTotale: (perteTot == null ? null : { valeur: perteTot, unite: 'Pa' }),
      note: 'Perte LINÉAIRE seule (hors singularités / composants / centrale) — résultat technique, pas une validation.' };
  });

  // M57 LOT31 (additif) : enrichissement de la voie Darcy par la PERTE SINGULIÈRE (Σ ζ·½ρV²).
  // Voie PARALLÈLE : n'altère NI la voie historique LOT15-A (etude.pertes) NI le total linéaire
  // ci-dessus. ζ lus dans le référentiel de PRODUCTION (jamais inventés, aucun repli sur la
  // table LOT15-A). extraction / insufflation restent SÉPARÉS (jamais additionnés).
  var singulierEtude = etudeSinguliereVmc(donneesReseau, referentiel, options);
  (singulierEtude.donneesManquantes || []).forEach(function (d) { dm(d.champ, d.impact || 'darcy'); });
  reseaux.forEach(function (r) {
    var sr = (singulierEtude.reseaux || []).filter(function (x) { return x.type === r.type; })[0] || null;
    r.singulier = sr ? { statut: sr.statut, perteSinguliereTotale: sr.perteSinguliereTotale, troncons: sr.troncons, note: sr.note } : null;
    var lin = (r.perteLineaireTotale && r.perteLineaireTotale.valeur != null) ? r.perteLineaireTotale.valeur : null;
    var sng = (sr && sr.perteSinguliereTotale && sr.perteSinguliereTotale.valeur != null) ? sr.perteSinguliereTotale.valeur : null;
    // Perte totale Darcy PAR RÉSEAU = linéaire + singulière, UNIQUEMENT si les DEUX sont
    // entièrement calculées (jamais un total partiel). Aucune addition entre réseaux distincts.
    r.perteTotaleDarcy = (lin != null && sng != null)
      ? { valeur: Math.round((lin + sng) * 1000) / 1000, unite: 'Pa', composantes: { lineaire: lin, singuliere: sng } }
      : null;
  });

  if (reseaux.length === 0) dm('donnees_reseau', 'darcy');
  var tousLin = (reseaux.length > 0) && reseaux.every(function (r) { return r.statut === 'lineaire_calculee'; });
  var auMoinsUn = reseaux.some(function (r) { return r.statut === 'lineaire_calculee' || r.statut === 'partiel'; });
  var statutGlobal = (reseaux.length === 0) ? 'indetermine' : (tousLin ? 'lineaire_calculee' : (auMoinsUn ? 'partiel' : 'incomplet'));

  return {
    disponible: true,
    methode: METHODE_PERTE_LINEAIRE_VMC,
    referentiel: traceReferentielPertes(referentiel),
    statut: statutGlobal,
    reseaux: reseaux,                 // extraction / insufflation SÉPARÉS (jamais fusionnés)
    singulier: singulierEtude,        // M57 LOT31 : voie singulière additive (jamais fusionnée avec l'historique)
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier,
    limites: ['Perte LINÉAIRE (Darcy-Weisbach) et perte SINGULIÈRE (Σ ζ·½ρV², M57 LOT31) calculées EN VOIES SÉPARÉES ; composants et pression centrale NON traités ici.']
  };
}

// Comparaison OBSERVATIONNELLE historique (LOT15-A) vs Darcy (LOT25), par tronçon, UNIQUEMENT si
// même tronçon + mêmes débit/longueur/diamètre. Aucun arbitrage (« lequel est vrai »), aucune
// fusion, aucune décision. Sinon : comparaison 'impossible' + raison explicite.
function comparerPerteLineaireVmc(pertesHistorique, etudeDarcy) {
  var out = [];
  var hist = [];
  ((pertesHistorique && pertesHistorique.reseaux) || []).forEach(function (r) { (r.troncons || []).forEach(function (t) { hist.push(Object.assign({ reseau: r.type }, t)); }); });
  ((etudeDarcy && etudeDarcy.reseaux) || []).forEach(function (r) {
    (r.troncons || []).forEach(function (td) {
      var cle = (td.pieceRef || td.ref);
      var th = hist.filter(function (x) { return x.reseau === r.type && (x.ref === cle || x.ref === td.ref); })[0];
      if (!th) { out.push({ ref: td.ref, reseau: r.type, comparaison: 'impossible', raison: 'troncon_historique_absent' }); return; }
      if (!(th.debit === td.debit && th.longueur === td.longueur && th.diametre === td.diametre)) { out.push({ ref: td.ref, reseau: r.type, comparaison: 'impossible', raison: 'entrees_differentes' }); return; }
      var ph = (th.pertesLineaires != null ? th.pertesLineaires : null);
      var pd = (td.perteLineaire && td.perteLineaire.valeur != null ? td.perteLineaire.valeur : null);
      if (ph == null || pd == null) { out.push({ ref: td.ref, reseau: r.type, comparaison: 'impossible', raison: 'une_perte_non_calculee' }); return; }
      out.push({ ref: td.ref, reseau: r.type, comparaison: 'possible', perteHistorique: ph, perteDarcy: Math.round(pd * 1000) / 1000, ecart: Math.round((pd - ph) * 1000) / 1000 });
    });
  });
  return out;
}


// =====================================================================
// M57 LOT31 — PERTE SINGULIÈRE VMC (voie Darcy, additive, sans repli)
// =====================================================================
// etudeSinguliereVmc(donneesReseau, referentiel, options?) calcule, PAR TRONÇON et PAR RÉSEAU,
// la perte SINGULIÈRE = Σ ζ · ½·ρ·V²  (V = Q/S, S = π·D²/4). C'est un NOUVEAU calcul PUR et
// ADDITIF, jumeau singulier de la voie linéaire Darcy (LOT25/LOT27) : il n'altère NI la voie
// historique LOT15-A (etude.pertes), NI le total linéaire de LOT27.
//  • ρ et ζ viennent EXCLUSIVEMENT du référentiel de PRODUCTION injecté (referentiel.singuliers).
//    AUCUNE valeur écrite ici, AUCUN ζ inventé. Aucun repli sur la table compilée de LOT15-A.
//  • ζ résolu par correspondance STRICTE (type + géométrie) : 0 candidat → absent ; >1 → ambigu
//    (aucun choix silencieux). Un ζ absent/ambigu/non fini → tronçon 'incomplet' (perte null).
//  • Donnée absente (ρ, débit, diamètre) → 'incomplet' + null (jamais 0, jamais moyenne).
//    Un tronçon SANS singularité déclarée → 0 Pa (fait établi, pas une valeur inventée).
//  • extraction / insufflation traités SÉPARÉMENT (SF/DF), JAMAIS additionnés.
//  • Débit : relevé prioritaire ; sinon dérivé déterministe LOT28 ; sinon null. Hors money-path.
function etudeSinguliereVmc(donneesReseau, referentiel, options) {
  options = options || {};
  if (!referentiel) return { disponible: false, raison: 'referentiel_production_absent', reseaux: [], donneesManquantes: [{ champ: 'referentiel_production', impact: 'singulier' }], pointsAVerifier: [] };
  var reseauxIn = (donneesReseau && Array.isArray(donneesReseau.reseaux)) ? donneesReseau.reseaux : [];
  var donneesManquantes = [], pointsAVerifier = [];
  var dm = function (c, i) { if (c && !donneesManquantes.some(function (x) { return x.champ === c; })) donneesManquantes.push({ champ: c, impact: i || 'singulier' }); };
  var r3 = function (v) { return (v == null) ? null : Math.round(v * 1000) / 1000; };

  // ρ depuis le référentiel de PRODUCTION (même source que la voie linéaire LOT25/27). Jamais inventée.
  var RHO = _versSI(referentiel.masseVolumiqueAir, 'masseVolumique');

  // Débit dérivé (LOT28) — identique à la voie linéaire, pour rester cohérent quand le débit n'est
  // pas relevé sur le tronçon. Aucun débit inventé : un débit non démontrable reste null.
  var derivation = deriverDebitsTronconsVmc(donneesReseau);
  var debitDerivePour = function (type, tronconId) {
    var rr = (derivation.reseaux || []).filter(function (x) { return x.type === type; })[0];
    var td = rr ? (rr.troncons || []).filter(function (x) { return x.tronconId === tronconId; })[0] : null;
    return (td && td.origine === 'derive' && typeof td.debit === 'number') ? td : null;
  };

  // ζ : correspondance STRICTE (type + géométrie EXACTE) dans le référentiel de production. Aucun
  // choix silencieux (0 → absent, >1 → ambigu), et JAMAIS de wildcard : une géométrie non fournie
  // n'atteint pas ce lookup (rejetée en amont). Valeur non finie/négative → refusée (jamais corrigée).
  var zetaProd = function (type, geometrie) {
    var sing = Array.isArray(referentiel.singuliers) ? referentiel.singuliers : [];
    var cand = sing.filter(function (s) { return s.type === type && s.geometrie === geometrie; });
    var etiquette = (type || '?') + '/' + (geometrie || '?');
    if (cand.length === 0) return { ok: false, raison: 'coefficient_singulier_absent:' + etiquette };
    if (cand.length > 1) return { ok: false, raison: 'coefficient_singulier_ambigu:' + etiquette };
    var z = cand[0].coefficient;
    if (!(typeof z === 'number' && isFinite(z))) return { ok: false, raison: 'coefficient_singulier_non_fini:' + etiquette };
    if (z < 0) return { ok: false, raison: 'coefficient_singulier_negatif:' + etiquette };
    return { ok: true, coefficient: z, source: cand[0].source || null, referenceExacte: cand[0].referenceExacte || null, versionSource: cand[0].versionSource || null };
  };

  var reseaux = reseauxIn.map(function (r) {
    var troncons = (r.troncons || []).map(function (t) {
      var ref = (t.id || t.pieceRef || t.role || 'troncon');
      var der = (t.debit == null) ? debitDerivePour(r.type, (t.id || null)) : null;
      var debitUtilise = (t.debit != null) ? t.debit : (der ? der.debit : null);
      var origineDebit = (t.debit != null) ? 'releve' : (der ? 'derive' : 'absent');
      var sings = Array.isArray(t.singularites) ? t.singularites : [];
      var base = {
        tronconId: (t.id || null), ref: ref, pieceRef: (t.pieceRef || null), reseau: r.type,
        debit: (debitUtilise != null ? debitUtilise : null), origineDebit: origineDebit,
        diametre: (t.diametre != null ? t.diametre : null), nbSingularites: sings.length
      };
      // Aucune singularité déclarée sur ce tronçon → perte singulière = 0 (fait établi).
      if (sings.length === 0) return Object.assign(base, { statut: 'calculable', perteSinguliere: { valeur: 0, unite: 'Pa' }, pressionDynamique: null, vitesse: null, singularites: [] });

      // Données requises pour ½·ρ·V² : ρ (référentiel) + débit + diamètre (tronçon).
      var manque = [];
      if (!RHO.ok) manque.push('masse_volumique_air');
      var Q = _versSI((debitUtilise != null ? { valeur: debitUtilise, unite: (t.uniteDebit || 'm3/h') } : null), 'debit');
      var D = _versSI((t.diametre != null ? { valeur: t.diametre, unite: (t.uniteDiametre || 'mm') } : null), 'diametre');
      if (Q.manquant) manque.push('debit:' + ref);
      if (D.manquant) manque.push('diametre:' + ref);
      if (manque.length) {
        manque.forEach(function (c) { dm(c, 'perte_singuliere'); });
        return Object.assign(base, { statut: 'incomplet', perteSinguliere: null, pressionDynamique: null, vitesse: null, donneesManquantes: manque, singularites: sings.map(function (s) { return { type: s.type, geometrie: s.geometrie, quantite: (typeof s.quantite === 'number' ? s.quantite : null), coefficient: null, statut: 'incomplet' }; }) });
      }
      if (!(D.valeur > 0)) { dm('diametre_non_positif:' + ref, 'perte_singuliere'); return Object.assign(base, { statut: 'incomplet', perteSinguliere: null, pressionDynamique: null, vitesse: null }); }

      var S = Math.PI * D.valeur * D.valeur / 4;   // m²
      var V = Q.valeur / S;                         // m/s
      var pdyn = 0.5 * RHO.valeur * V * V;          // Pa (½·ρ·V²)
      var somme = 0, complet = true, detail = [];
      sings.forEach(function (s) {
        var geo = s.geometrie;
        // Géométrie ABSENTE ou INCONNUE ('inconnu' = sentinelle de normalisation) → incomplet.
        // JAMAIS de lookup wildcard : sans géométrie identifiée, aucun ζ ne peut être choisi.
        if (geo == null || geo === 'inconnu' || geo === '') {
          complet = false; dm('geometrie_singularite_absente:' + (s.type || '?'), 'perte_singuliere');
          detail.push({ type: s.type, geometrie: (geo != null ? geo : null), quantite: (typeof s.quantite === 'number' && isFinite(s.quantite) ? s.quantite : null), coefficient: null, statut: 'incomplet', raison: 'geometrie_absente' });
          return;
        }
        // Quantité ABSENTE ou INCONNUE (non nombre fini > 0) → incomplet. JAMAIS de défaut 1.
        if (!(typeof s.quantite === 'number' && isFinite(s.quantite) && s.quantite > 0)) {
          complet = false; dm('quantite_singularite_absente:' + (s.type || '?') + '/' + geo, 'perte_singuliere');
          detail.push({ type: s.type, geometrie: geo, quantite: null, coefficient: null, statut: 'incomplet', raison: 'quantite_absente' });
          return;
        }
        var q = s.quantite; // multiplicité RÉELLEMENT fournie (jamais inventée)
        var z = zetaProd(s.type, geo);
        if (!z.ok) { complet = false; dm(z.raison, 'perte_singuliere'); detail.push({ type: s.type, geometrie: geo, quantite: q, coefficient: null, statut: 'incomplet', raison: z.raison }); return; }
        var contrib = z.coefficient * q * pdyn;
        somme += contrib;
        detail.push({ type: s.type, geometrie: geo, quantite: q, coefficient: z.coefficient, perte: { valeur: r3(contrib), unite: 'Pa' }, source: z.source, referenceExacte: z.referenceExacte, statut: 'calculable' });
      });
      return Object.assign(base, {
        statut: complet ? 'calculable' : 'incomplet',
        vitesse: { valeur: V, unite: 'm/s' },
        pressionDynamique: { valeur: r3(pdyn), unite: 'Pa' },
        perteSinguliere: complet ? { valeur: r3(somme), unite: 'Pa' } : null,
        singularites: detail
      });
    });
    var calc = troncons.filter(function (t) { return t.statut === 'calculable'; });
    var statutReseau = (troncons.length === 0) ? 'indetermine' : ((calc.length === troncons.length) ? 'singuliere_calculee' : (calc.length > 0 ? 'partiel' : 'incomplet'));
    // Total singulier UNIQUEMENT si TOUS les tronçons sont calculables (jamais un total partiel).
    var totalOk = (calc.length === troncons.length && troncons.length > 0);
    var perteTot = totalOk ? r3(calc.reduce(function (s, t) { return s + t.perteSinguliere.valeur; }, 0)) : null;
    return {
      type: r.type, statut: statutReseau, troncons: troncons,
      perteSinguliereTotale: (perteTot == null ? null : { valeur: perteTot, unite: 'Pa' }),
      note: 'Perte SINGULIÈRE seule (Σ ζ·½ρV², ζ issus du référentiel de production) — hors linéaire / composants / centrale ; résultat technique.'
    };
  });

  if (reseaux.length === 0) dm('donnees_reseau', 'singulier');
  var tous = (reseaux.length > 0) && reseaux.every(function (r) { return r.statut === 'singuliere_calculee'; });
  var auMoinsUn = reseaux.some(function (r) { return r.statut === 'singuliere_calculee' || r.statut === 'partiel'; });
  var statutGlobal = (reseaux.length === 0) ? 'indetermine' : (tous ? 'singuliere_calculee' : (auMoinsUn ? 'partiel' : 'incomplet'));

  return {
    disponible: true,
    methode: 'perte_singuliere_zeta_pression_dynamique',
    referentiel: traceReferentielPertes(referentiel),
    statut: statutGlobal,
    reseaux: reseaux,                 // extraction / insufflation SÉPARÉS (jamais additionnés)
    donneesManquantes: donneesManquantes,
    pointsAVerifier: pointsAVerifier,
    limites: ['Perte SINGULIÈRE uniquement (Σ ζ·½ρV²). ζ lus dans le référentiel de production (aucun inventé, aucun repli sur la table LOT15-A). Linéaire / composants / pression centrale non traités ici.']
  };
}


if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC, obligationsVmc, besoinVmc, debitsVmc, topologieVmc, preDimensionnementVmc, preCalculSectionVmc, pertesDeChargeVmc, preEtudeVmc, PROVENANCE_VMC, creerDonneesReseau, validerDonneesReseau, adapterDonneesReseauPourPertes, creerReferentielPertes, validerReferentielPertes, champsReleveVisite, analysePressionVmc, creerGroupeVmc, creerTerminalVmc, evaluerCourbeVmc, positionDebitPlage, adapterDonneesConstructeurPourPression, STATUT_VISITE, PROVENANCE_VISITE, ACCESSIBILITE_VISITE, NATURE_VISITE, ETAT_POSE_VISITE, creerDonneesPose, creerChampValeur, creerChampObserve, creerInstallationVisite, creerNoeudVisite, creerTronconVisite, creerReseauVisite, creerSingulariteVisite, creerTerminalVisite, creerCentraleVisite, creerInterfaceVisite, creerMesureVisite, creerHypotheseVisite, creerPhotoRef, creerDonneesVisite, normaliserVisiteVersReseau, validerDonneesVisite, nouvelleVisiteVmc, serialiserVisiteVmc, restaurerVisiteVmc, ajouterReseauVisite, ajouterNoeudVisite, ajouterTronconVisite, ajouterTerminalVisite, ajouterMesureVisiteA, ajouterHypotheseVisiteA, ajouterPhotoVisiteA, definirInstallationVisite, definirCentraleVisite, definirInterfaceVisite, resumeVisiteVmc, libelleStatutVisite, libelleProvenanceVisite, libelleTypeReseauVisite, construireVueVisite, etudierVisiteVmc, STATUT_REFERENTIEL, creerEntreeLineairePertes, creerEntreeSinguliere, creerReferentielProductionPertes, chargerReferentielPertesDepuisJSON, validerReferentielProduction, compilerReferentielPertes, traceReferentielPertes, creerEntreeRugosite, calculerPerteLineaireVmc, adaptateurReferentielPertesVmc, METHODE_PERTE_LINEAIRE_VMC, RE_LAMINAIRE_MAX, RE_TURBULENT_MIN, etudeDarcyVmc, comparerPerteLineaireVmc, deriverDebitsTronconsVmc, validerTopologieVmc, parcourirGrapheVmc, etudeSinguliereVmc };
