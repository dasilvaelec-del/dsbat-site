// =====================================================================
// js/moteurs/vmc-public.js — Module PUBLIC VMC (M2-C, extraction de responsabilité)
// =====================================================================
// Sous-ensemble PUBLIC-SAFE extrait VERBATIM de js/moteurs/vmc.js : collecte /
// questionnaire, modèle de visite, DTO de données brutes, validation de FORME (UX),
// prévisualisation fonctionnelle, sérialisation, obligations réglementaires et aperçu
// qualitatif de topologie. NE CONTIENT AUCUNE PHYSIQUE : ni Darcy/Colebrook, ni pertes
// linéaires/singulières, ni graphe physique, ni pression, ni marges, ni synthèse, ni
// référentiel de calcul (ζ/ε/tables). Ces responsabilités restent PRIVÉES (Runtime,
// runtime/moteur-prive/vmc-moteur.js). Le site COLLECTE et DÉCRIT ; le Runtime CALCULE.
// Toute validation ici est de FORME/UX (contournable) : la validation métier/physique
// autoritaire appartient au Runtime. Aucune donnée client n'est transformée en vérité calculée.
// Extraction sans réécriture : code identique à vmc.js (parité vérifiée par test).
// =====================================================================

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

var PROVENANCE_VMC = { VISITE: 'visite', CONSTRUCTEUR: 'constructeur', REFERENTIEL: 'referentiel', CLIENT: 'client', HYPOTHESE_DSBAT: 'hypothese_dsbat', TEST: 'test' };

function _nombreOuNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

function _ouNull(v) { return (v == null) ? null : v; }

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

function champsReleveVisite(systeme) {
  var base = ['longueurs_troncons', 'diametres_sections_reels', 'type_conduit', 'etat_conduit_existant', 'coudes', 'tes', 'reductions',
    'terminaux', 'localisation_caisson', 'localisation_prise_air_neuf', 'localisation_rejet', 'reference_groupe', 'reference_terminaux', 'donnees_constructeur'];
  if (systeme === 'double_flux') base = base.concat(['elements_specifiques_df']);
  return base;
}

var STATUT_VISITE = { MESURE: 'mesure', ESTIME: 'estime', INCONNU: 'inconnu', NON_ACCESSIBLE: 'non_accessible', NON_MESURE: 'non_mesure', NON_APPLICABLE: 'non_applicable', A_VERIFIER: 'a_verifier', DOCUMENTE: 'documente', RELEVE_DECLARATIF: 'releve_declaratif' };

var PROVENANCE_VISITE = { CLIENT: 'client', TECHNICIEN: 'technicien', MESURE_INSTRUMENTEE: 'mesure_instrumentee', CONSTRUCTEUR: 'constructeur', DOCUMENT_EXISTANT: 'document_existant', CALCUL_DSBAT: 'calcul_dsbat', HYPOTHESE: 'hypothese', PHOTO_INTERPRETEE: 'photo_interpretee' };

var ACCESSIBILITE_VISITE = { VISIBLE: 'visible', CACHE: 'cache', INACCESSIBLE: 'inaccessible', PARTIELLE: 'partiellement_accessible', NON_VERIFIABLE: 'non_verifiable' };

var NATURE_VISITE = { EXISTANT_RELEVE: 'existant_releve', EXISTANT_DECLARE: 'existant_declare', PROJETE: 'projete', THEORIQUE_DSBAT: 'theorique_dsbat', CONSTRUCTEUR: 'constructeur', MESURE: 'mesure' };

function _o18(v) { return (v == null) ? null : v; }

function creerChampValeur(spec) {
  spec = spec || {};
  return { valeur: (spec.valeur != null ? spec.valeur : null), unite: _o18(spec.unite), statut: _o18(spec.statut) || STATUT_VISITE.INCONNU, provenance: _o18(spec.provenance), nature: _o18(spec.nature), source: _o18(spec.source) };
}

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

var ETAT_POSE_VISITE = { ENTIEREMENT_DEPLOYE: 'entierement_deploye', PARTIELLEMENT_COMPRIME: 'partiellement_comprime', FORTEMENT_COMPRIME: 'fortement_comprime', AFFAISSE: 'affaisse', ECRASE: 'ecrase', INCONNU: 'inconnu', NON_APPLICABLE: 'non_applicable' };

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

function validerDonneesVisite(donneesVisite) {
  var norm = normaliserVisiteVersReseau(donneesVisite);
  var v = validerDonneesReseau(norm.donneesReseau);
  return { valide: v.valide && norm.incoherences.length === 0, donneesManquantes: v.donneesManquantes.concat(norm.donneesManquantes.filter(function (d) { return !v.donneesManquantes.some(function (x) { return x.champ === d.champ; }); })), incoherences: norm.incoherences };
}

function nouvelleVisiteVmc(spec) { return creerDonneesVisite(spec || {}); }

function serialiserVisiteVmc(donneesVisite) { return donneesVisite ? JSON.parse(JSON.stringify(donneesVisite)) : null; }

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

var _LIBELLES_STATUT_VISITE = { mesure: 'Mesuré', estime: 'Estimé', inconnu: 'Je ne sais pas', non_accessible: 'Non accessible', non_mesure: 'Non mesuré', non_applicable: 'Non applicable', a_verifier: 'À vérifier', documente: 'Documenté', releve_declaratif: 'Relevé déclaratif' };

var _LIBELLES_PROVENANCE_VISITE = { client: 'Déclaré client', technicien: 'Relevé technicien', mesure_instrumentee: 'Mesuré (instrument)', constructeur: 'Constructeur', document_existant: 'Document existant', calcul_dsbat: 'Calcul DS.BAT', hypothese: 'Hypothèse', photo_interpretee: 'Photo interprétée' };

var _LIBELLES_TYPE_RESEAU = { extraction: 'Extraction', insufflation: 'Insufflation', prise_air_neuf: 'Prise d\'air neuf', rejet: 'Rejet' };

function libelleStatutVisite(code) { return _LIBELLES_STATUT_VISITE[code] || (code || 'Je ne sais pas'); }

function libelleProvenanceVisite(code) { return _LIBELLES_PROVENANCE_VISITE[code] || (code || '—'); }

function libelleTypeReseauVisite(code) { return _LIBELLES_TYPE_RESEAU[code] || (code || '—'); }

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

if (typeof module !== "undefined" && module.exports) module.exports = { getVmcPourPiece, _vmcRole, evaluationSupportVmc, controlesOublisVmc, verifierVMC, obligationsVmc, besoinVmc, debitsVmc, topologieVmc, PROVENANCE_VMC, creerDonneesReseau, validerDonneesReseau, champsReleveVisite, STATUT_VISITE, PROVENANCE_VISITE, ACCESSIBILITE_VISITE, NATURE_VISITE, creerChampValeur, creerChampObserve, creerInstallationVisite, creerNoeudVisite, creerSingulariteVisite, ETAT_POSE_VISITE, creerDonneesPose, creerTronconVisite, creerReseauVisite, creerTerminalVisite, creerCentraleVisite, creerInterfaceVisite, creerMesureVisite, creerHypotheseVisite, creerPhotoRef, creerDonneesVisite, normaliserVisiteVersReseau, validerDonneesVisite, nouvelleVisiteVmc, serialiserVisiteVmc, restaurerVisiteVmc, ajouterReseauVisite, ajouterNoeudVisite, ajouterTronconVisite, ajouterTerminalVisite, ajouterMesureVisiteA, ajouterHypotheseVisiteA, ajouterPhotoVisiteA, definirInstallationVisite, definirCentraleVisite, definirInterfaceVisite, resumeVisiteVmc, libelleStatutVisite, libelleProvenanceVisite, libelleTypeReseauVisite, construireVueVisite };
