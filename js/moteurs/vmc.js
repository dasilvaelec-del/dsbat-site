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


if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC, obligationsVmc, besoinVmc, debitsVmc };
