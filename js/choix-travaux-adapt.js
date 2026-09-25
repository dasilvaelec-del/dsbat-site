// =====================================================================
// js/choix-travaux-adapt.js — ADAPTATEUR : choix questionnaire -> sources canoniques
// =====================================================================
// RÔLE : projeter les réponses de chantier.choixTravaux (v2) vers les sources
//   RÉELLEMENT consommées par les moteurs existants, à la sortie du questionnaire.
//   Le questionnaire n'invente aucun calcul : l'adaptateur écrit seulement des
//   ÉTATS canoniques ; ce sont les moteurs existants qui calculent les quantités.
//
// IDEMPOTENCE : piece._choixTravauxApplique = TRACE technique (garde anti-doublon)
//   des seuls ajouts ADDITIFS (config électricité/plomberie). À chaque passage :
//   on retire d'abord ces ajouts, puis on ré-applique -> revenir/valider N fois ne
//   double jamais. Les champs SET (solMateriau, faienceMode, VMC) sont réécrits.
//
// SOURCES CANONIQUES CIBLÉES (consommateur vérifié) :
//   • objectifProjet (via callback setObjectif) — recoDSBAT (électricité niveau)
//   • piece.config.electricite.ELEC_RJ45 — getElecPourPiece / prix (réseau multimédia)
//   • piece.config.plomberie.PLO_* — getPlombPourPiece / _ploQtes
//   • piece.solMateriau / piece.faienceMode — appliquerRevetements (sols/carrelage)
//   • chantier.intentionVentilation / chantier.solutionVentilation — projection VMC existante
//
// NON BRANCHÉ (déclaré, aucun moteur de chiffrage aujourd'hui — signalé) :
//   • chauffage au sol -> piece.chauffageFonctions.solution.technologie (descriptif)
//   • lave-linge en buanderie -> plomberie ne modélise pas la buanderie
//   • double vasque -> pas de code produit distinct (meuble vasque unique)
// =====================================================================

(function (global) {
  'use strict';

  // Électricité : pièces où le catalogue propose ELEC_RJ45 (miroir de getElecPourPiece).
  var RJ45_PIECES = ['salon', 'salle_manger', 'chambre', 'bureau'];

  function clePiece(p) { return String(p && p.id) + '#' + String(p && (p.numero != null ? p.numero : 1)); }

  function mapNiveauObjectif(niveau) {
    if (niveau === 'confort' || niveau === 'haut') return 'confort';
    if (niveau === 'essentiel') return 'standard';
    return null; // pas de choix -> ne pas toucher objectifProjet
  }

  function cfg(piece, metier) {
    if (!piece.config) piece.config = {};
    if (!piece.config[metier]) piece.config[metier] = {};
    return piece.config[metier];
  }

  // ------------------------------------------------------------------
  // appliquer(pieces, chantier, opts) -> rapport
  //   opts : { metiersActifs:[...] }
  //   Renvoie { applique:[...], nonBranche:[...], objectif:('confort'|'standard'|null), projeterVmc:bool }
  //   Effets : écrit directement dans pieces / chantier (sources canoniques).
  // ------------------------------------------------------------------
  function appliquer(pieces, chantier, opts) {
    pieces = pieces || []; chantier = chantier || {}; opts = opts || {};
    var metiers = opts.metiersActifs || [];
    var choix = chantier.choixTravaux || {};
    var applique = [], nonBranche = [];

    // ---------- 0) REVERT des ajouts additifs précédents (idempotence) ----------
    pieces.forEach(function (p) {
      var bag = p._choixTravauxApplique;
      if (!bag) return;
      ['electricite', 'plomberie'].forEach(function (m) {
        if (!bag[m]) return;
        var c = (p.config && p.config[m]) || {};
        Object.keys(bag[m]).forEach(function (code) {
          if (c[code] != null) { c[code] = Math.max(0, (c[code] || 0) - bag[m][code]); if (c[code] === 0) delete c[code]; }
        });
      });
      // chauffage au sol : retirer plancher_chauffant que NOUS avions posé
      if (bag.chauffageSol && p.chauffageFonctions && p.chauffageFonctions.solution &&
          p.chauffageFonctions.solution.technologie === 'plancher_chauffant') {
        p.chauffageFonctions.solution.technologie = null;
      }
      p._choixTravauxApplique = null;
    });

    // sac neuf par pièce
    pieces.forEach(function (p) { p._choixTravauxApplique = { electricite: {}, plomberie: {}, chauffageSol: false }; });
    function addCfg(p, metier, code, qty) {
      if (!qty) return;
      var c = cfg(p, metier); c[code] = (c[code] || 0) + qty;
      var bag = p._choixTravauxApplique[metier]; bag[code] = (bag[code] || 0) + qty;
    }
    function pieceByCle(cle) { for (var i = 0; i < pieces.length; i++) if (clePiece(pieces[i]) === cle) return pieces[i]; return null; }

    // ---------- 1) ÉLECTRICITÉ ----------
    var objectif = null;
    if (metiers.indexOf('electricite') !== -1 && choix.electricite) {
      objectif = mapNiveauObjectif(choix.electricite.niveau);
      if (objectif) applique.push('électricité niveau « ' + choix.electricite.niveau + ' » → objectifProjet=' + objectif + ' (recoDSBAT)');
      if (choix.electricite.reseauMultimedia === 'oui') {
        var n = 0;
        pieces.forEach(function (p) { if (RJ45_PIECES.indexOf(p.id) !== -1) { addCfg(p, 'electricite', 'ELEC_RJ45', 1); n++; } });
        if (n) applique.push('réseau multimédia renforcé → +1 ELEC_RJ45 dans ' + n + ' pièce(s)');
      }
    }

    // ---------- 2) PLOMBERIE ----------
    if (metiers.indexOf('plomberie') !== -1 && choix.plomberie) {
      var raccordParCle = {}; // PLO_RACCORD_LV cumulé (lave-vaisselle + lave-linge, même code moteur)
      // SDB / SDE
      Object.keys(choix.plomberie.sdb || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return;
        var rep = choix.plomberie.sdb[cle] || {};
        var eq = rep.equipements || [];
        if (eq.indexOf('douche_ital') !== -1) addCfg(p, 'plomberie', 'PLO_DOUCHE_ITAL', 1);
        if (eq.indexOf('cabine') !== -1) addCfg(p, 'plomberie', 'PLO_DOUCHE_CABINE', 1);
        if (eq.indexOf('baignoire') !== -1) addCfg(p, 'plomberie', 'PLO_BAIGNOIRE', 1);
        if (rep.lavabo === 'simple' || rep.lavabo === 'double') {
          addCfg(p, 'plomberie', 'PLO_MEUBLE_LAV', 1); // meuble vasque : seul code existant
          if (rep.lavabo === 'double') nonBranche.push(p.nom + ' : « double vasque » non différencié (code unique PLO_MEUBLE_LAV) — évolution future');
        }
        if (eq.length || rep.lavabo) applique.push(p.nom + ' : équipements plomberie projetés (' + [].concat(eq, rep.lavabo ? ['lavabo'] : []).join(', ') + ')');
      });
      // WC
      Object.keys(choix.plomberie.wc || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return;
        var rep = choix.plomberie.wc[cle] || {};
        if (rep.type === 'sol') addCfg(p, 'plomberie', 'PLO_WC_SIMPLE', 1);
        else if (rep.type === 'suspendu') addCfg(p, 'plomberie', 'PLO_WC_SUSP', 1);
        if (rep.laveMains === 'oui') addCfg(p, 'plomberie', 'PLO_LAV_SIMPLE', 1);
        if (rep.type || rep.laveMains) applique.push(p.nom + ' : WC (' + (rep.type || '?') + (rep.laveMains === 'oui' ? ' + lave-mains' : '') + ')');
      });
      // CUISINE
      Object.keys(choix.plomberie.cuisine || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return;
        var rep = choix.plomberie.cuisine[cle] || {};
        if (rep.evier === 'simple') addCfg(p, 'plomberie', 'PLO_EVIER', 1);
        else if (rep.evier === 'double') addCfg(p, 'plomberie', 'PLO_EVIER_DBL', 1);
        if (rep.laveVaisselle === 'oui') raccordParCle[cle] = (raccordParCle[cle] || 0) + 1;
        if (rep.evier || rep.laveVaisselle) applique.push(p.nom + ' : cuisine (évier ' + (rep.evier || '?') + (rep.laveVaisselle === 'oui' ? ' + lave-vaisselle' : '') + ')');
      });
      // LAVE-LINGE (pièce choisie ; PLO_RACCORD_LV, même code que lave-vaisselle -> cumul)
      var ll = (choix.plomberie.laveLinge && choix.plomberie.laveLinge.piece) || null;
      if (ll && ll !== 'aucun') {
        var pLL = pieceByCle(ll);
        if (pLL && (pLL.id === 'cuisine' || pLL.id === 'cave')) { raccordParCle[ll] = (raccordParCle[ll] || 0) + 1; applique.push(pLL.nom + ' : arrivée/évacuation lave-linge (PLO_RACCORD_LV)'); }
        else if (pLL) nonBranche.push((pLL.nom || ll) + ' : lave-linge non modélisé par le moteur plomberie dans cette pièce — évolution future');
      }
      Object.keys(raccordParCle).forEach(function (cle) { var p = pieceByCle(cle); if (p) addCfg(p, 'plomberie', 'PLO_RACCORD_LV', raccordParCle[cle]); });
    }

    // ---------- 3) CHAUFFAGE AU SOL (canonique mais NON chiffré) ----------
    if (metiers.indexOf('chauffage') !== -1 && choix.chauffage && choix.chauffage.chauffageAuSol === 'oui') {
      pieces.forEach(function (p) {
        if (!p.chauffageFonctions) p.chauffageFonctions = { existant: { present: null, type: null, energie: null, etat: null }, intention: { action: null, objectif: null }, solution: { technologie: null, systeme: null, statut: null }, etatLocal: null };
        if (!p.chauffageFonctions.solution) p.chauffageFonctions.solution = { technologie: null, systeme: null, statut: null };
        p.chauffageFonctions.solution.technologie = 'plancher_chauffant';
        if (p._choixTravauxApplique) p._choixTravauxApplique.chauffageSol = true;
      });
      nonBranche.push('chauffage au sol : écrit dans piece.chauffageFonctions.solution (plancher_chauffant) mais AUCUN moteur ne le chiffre — lot chauffage futur');
    }

    // ---------- 4) VMC (écrit les sources canoniques ; projection faite par l'appelant) ----------
    var projeterVmc = false;
    if (metiers.indexOf('vmc') !== -1 && choix.vmc) {
      if (choix.vmc.intention) { chantier.intentionVentilation = choix.vmc.intention; projeterVmc = true; }
      if (choix.vmc.solution) { chantier.solutionVentilation = choix.vmc.solution; projeterVmc = true; }
      if (projeterVmc) applique.push('VMC → chantier.intentionVentilation=' + (choix.vmc.intention || '—') + ', solutionVentilation=' + (choix.vmc.solution || '—') + ' (projection VMC existante)');
    }

    // ---------- 5) REVÊTEMENTS DE SOL (set : piece.solMateriau) ----------
    if ((metiers.indexOf('sols') !== -1 || metiers.indexOf('carrelage') !== -1) && choix.revetementsSol) {
      var rs = choix.revetementsSol;
      var uniforme = rs.uniforme === 'oui';
      var nb = 0;
      pieces.forEach(function (p) {
        var mat = uniforme ? rs.global : (rs.parPiece && rs.parPiece[clePiece(p)]);
        if (mat) { p.solMateriau = mat; nb++; }
      });
      if (nb) applique.push('revêtements de sol → piece.solMateriau projeté sur ' + nb + ' pièce(s) (appliquerRevetements)');
    }

    // ---------- 6) FAÏENCE (set : piece.faienceMode) ----------
    if (metiers.indexOf('carrelage') !== -1 && choix.faience && choix.faience.parPiece) {
      var nf = 0;
      Object.keys(choix.faience.parPiece).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return;
        var mode = choix.faience.parPiece[cle];
        if (mode) { p.faienceMode = mode; nf++; }
      });
      if (nf) applique.push('faïence → piece.faienceMode projeté sur ' + nf + ' pièce(s) (CAR_POSE_MUR)');
    }

    // ---------- 7) MENUISERIE (volets / motorisation / fenêtres) ----------
    if (metiers.indexOf('menuiserie') !== -1 && choix.menuiserie) {
      var mz = choix.menuiserie;
      if (mz.volets === 'oui') {
        // Le produit volet roulant (MEN_VOLET_ROULANT) et sa commande (ELEC_VOLET) sont
        // dimensionnés PAR LE MOTEUR selon le nombre de fenêtres (recoDSBAT / oublis
        // menuiserie). On exprime seulement l'intention ; pas de quantité inventée ici.
        applique.push('volets roulants souhaités : dimensionnés par le moteur (fenêtres)' + (mz.motoriser === 'oui' ? ' + motorisation (ELEC_VOLET)' : ''));
        if (mz.motoriser !== 'oui') nonBranche.push('volets NON motorisés : le choix est conservé mais le moteur propose la motorisation en conseil (retirable) — pas de désactivation dédiée');
      }
      if (mz.fenetres) applique.push('remplacement fenêtres : ' + mz.fenetres + ' (donnée conservée)');
    }

    return { applique: applique, nonBranche: nonBranche, objectif: objectif, projeterVmc: projeterVmc };
  }

  var API = { RJ45_PIECES: RJ45_PIECES, clePiece: clePiece, mapNiveauObjectif: mapNiveauObjectif, appliquer: appliquer };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ChoixTravauxAdaptDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
