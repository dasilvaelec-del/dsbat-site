// =====================================================================
// js/choix-travaux-adapt.js — ADAPTATEUR : choix questionnaire -> sources canoniques — LOT33
// =====================================================================
// Projette chantier.choixTravaux vers les sources RÉELLEMENT consommées par les
// moteurs. Le questionnaire n'invente aucun calcul ; l'adaptateur écrit seulement
// des ÉTATS canoniques ; les moteurs calculent les quantités.
//
// IDEMPOTENCE : piece._choixTravauxApplique = trace des seuls ajouts ADDITIFS
//   (config électricité/plomberie/menuiserie). Retirés puis ré-appliqués à chaque
//   passage. Champs SET (solMateriau, faienceMode, chauffageFonctions, clés chantier)
//   = réécrits.
//
// CONSOMMATEURS VÉRIFIÉS :
//   • chantier.chauffage (electrique -> dimensionnementChauffage/fil pilote)
//   • piece.chauffageFonctions.solution.technologie (DESCRIPTIF, non chiffré)
//   • piece.config.electricite.ELEC_SECH_SERV / ELEC_RJ45 / ELEC_VOLET
//   • piece.config.plomberie.PLO_*  • piece.config.menuiserie.MEN_VOLET_ROULANT
//   • piece.solMateriau / piece.faienceMode (appliquerRevetements)
//   • chantier.intentionVentilation / solutionVentilation (projection VMC existante)
//
// DESCRIPTIF (aucun chiffrage automatique aujourd'hui — signalé) :
//   • chauffage au sol / émetteurs gaz-PAC-fioul ; double vasque ; lave-linge hors
//     cuisine/cave ; isolation (niveau/acoustique) ; BA13 (cloisons/faux plafond/acoustique).
// =====================================================================

(function (global) {
  'use strict';

  var RJ45_PIECES = ['salon', 'salle_manger', 'chambre', 'bureau'];
  var PIECES_EAU = ['sdb', 'sde'];
  var LL_CONSOMMEES = ['cuisine', 'cave'];

  function clePiece(p) { return String(p && p.id) + '#' + String(p && (p.numero != null ? p.numero : 1)); }
  function mapNiveauObjectif(n) { if (n === 'confort' || n === 'haut') return 'confort'; if (n === 'essentiel') return 'standard'; return null; }
  function cfg(p, m) { if (!p.config) p.config = {}; if (!p.config[m]) p.config[m] = {}; return p.config[m]; }
  function fenetres(p) { return (p.dims && p.dims.fenetres) || 0; }

  function appliquer(pieces, chantier, opts) {
    pieces = pieces || []; chantier = chantier || {}; opts = opts || {};
    var metiers = opts.metiersActifs || [];
    var choix = chantier.choixTravaux || {};
    var applique = [], nonBranche = [], descriptif = [];

    // 0) REVERT additifs précédents
    pieces.forEach(function (p) {
      var bag = p._choixTravauxApplique; if (!bag) return;
      ['electricite', 'plomberie', 'menuiserie'].forEach(function (m) {
        if (!bag[m]) return; var c = (p.config && p.config[m]) || {};
        Object.keys(bag[m]).forEach(function (code) { if (c[code] != null) { c[code] = Math.max(0, (c[code] || 0) - bag[m][code]); if (c[code] === 0) delete c[code]; } });
      });
      if (bag.chauffageSol && p.chauffageFonctions && p.chauffageFonctions.solution && p.chauffageFonctions.solution.technologie === 'plancher_chauffant') p.chauffageFonctions.solution.technologie = null;
      p._choixTravauxApplique = null;
    });
    pieces.forEach(function (p) { p._choixTravauxApplique = { electricite: {}, plomberie: {}, menuiserie: {}, chauffageSol: false }; });
    function addCfg(p, m, code, qty) { if (!qty) return; var c = cfg(p, m); c[code] = (c[code] || 0) + qty; var b = p._choixTravauxApplique[m]; b[code] = (b[code] || 0) + qty; }
    function pieceByCle(cle) { for (var i = 0; i < pieces.length; i++) if (clePiece(pieces[i]) === cle) return pieces[i]; return null; }

    // 1) ÉLECTRICITÉ (niveau -> objectifProjet ; réseau -> ELEC_RJ45)
    var objectif = null;
    if (metiers.indexOf('electricite') !== -1 && choix.electricite) {
      objectif = mapNiveauObjectif(choix.electricite.niveau);
      if (objectif) applique.push('électricité niveau « ' + choix.electricite.niveau + ' » → objectifProjet=' + objectif + ' (recoDSBAT)');
      if (choix.electricite.reseauMultimedia === 'oui') {
        var n = 0; pieces.forEach(function (p) { if (RJ45_PIECES.indexOf(p.id) !== -1) { addCfg(p, 'electricite', 'ELEC_RJ45', 1); n++; } });
        if (n) applique.push('réseau multimédia renforcé → +1 ELEC_RJ45 dans ' + n + ' pièce(s)');
      }
    }

    // 2) CHAUFFAGE (type -> chantier.chauffage ; solution -> descriptif ; sèche-serviette -> ELEC_SECH_SERV)
    if (metiers.indexOf('chauffage') !== -1 && choix.chauffage) {
      var t = choix.chauffage.type;
      if (t) { chantier.chauffage = t; applique.push('type de chauffage → chantier.chauffage=' + t + (t === 'electrique' ? ' (dimensionnement électrique réel)' : ' (émetteurs non chiffrés par le moteur navigateur)')); }
      var sol = choix.chauffage.solution;
      if (sol) {
        var tech = (sol === 'chauffage_sol') ? 'plancher_chauffant' : (t === 'electrique' ? 'radiateur_electrique' : 'autre');
        pieces.forEach(function (p) {
          if (!p.chauffageFonctions) p.chauffageFonctions = { existant: { present: null, type: null, energie: null, etat: null }, intention: { action: null, objectif: null }, solution: { technologie: null, systeme: null, statut: null }, etatLocal: null };
          if (!p.chauffageFonctions.solution) p.chauffageFonctions.solution = { technologie: null, systeme: null, statut: null };
          p.chauffageFonctions.solution.technologie = tech;
          if (sol === 'chauffage_sol' && p._choixTravauxApplique) p._choixTravauxApplique.chauffageSol = true;
        });
        if (t === 'electrique' && sol === 'radiateurs') applique.push('chauffage électrique + radiateurs → chiffré (dimensionnementChauffage + fil pilote)');
        else descriptif.push('chauffage « ' + t + ' / ' + sol + ' » → écrit dans piece.chauffageFonctions.solution (descriptif) — non chiffré par le moteur actuel');
      }
      if (choix.chauffage.secheServiette === 'oui') {
        var ns = 0; pieces.forEach(function (p) { if (PIECES_EAU.indexOf(p.id) !== -1) { addCfg(p, 'electricite', 'ELEC_SECH_SERV', 1); ns++; } });
        if (ns) applique.push('sèche-serviettes → +1 ELEC_SECH_SERV dans ' + ns + ' salle(s) d\'eau (réel)');
      }
    }

    // 3) PLOMBERIE
    if (metiers.indexOf('plomberie') !== -1 && choix.plomberie) {
      var raccord = {};
      Object.keys(choix.plomberie.sdb || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return; var rep = choix.plomberie.sdb[cle] || {}; var eq = rep.equipements || [];
        if (eq.indexOf('douche_ital') !== -1) addCfg(p, 'plomberie', 'PLO_DOUCHE_ITAL', 1);
        if (eq.indexOf('cabine') !== -1) addCfg(p, 'plomberie', 'PLO_DOUCHE_CABINE', 1);
        if (eq.indexOf('baignoire') !== -1) addCfg(p, 'plomberie', 'PLO_BAIGNOIRE', 1);
        if (rep.lavabo === 'simple' || rep.lavabo === 'double') { addCfg(p, 'plomberie', 'PLO_MEUBLE_LAV', 1); if (rep.lavabo === 'double') descriptif.push(p.nom + ' : « double vasque » non différencié (code unique PLO_MEUBLE_LAV)'); }
        if (eq.length || rep.lavabo) applique.push(p.nom + ' : équipements plomberie projetés');
      });
      Object.keys(choix.plomberie.wc || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return; var rep = choix.plomberie.wc[cle] || {};
        if (rep.type === 'sol') addCfg(p, 'plomberie', 'PLO_WC_SIMPLE', 1); else if (rep.type === 'suspendu') addCfg(p, 'plomberie', 'PLO_WC_SUSP', 1);
        if (rep.laveMains === 'oui') addCfg(p, 'plomberie', 'PLO_LAV_SIMPLE', 1);
        if (rep.type || rep.laveMains) applique.push(p.nom + ' : WC projeté');
      });
      Object.keys(choix.plomberie.cuisine || {}).forEach(function (cle) {
        var p = pieceByCle(cle); if (!p) return; var rep = choix.plomberie.cuisine[cle] || {};
        if (rep.evier === 'simple') addCfg(p, 'plomberie', 'PLO_EVIER', 1); else if (rep.evier === 'double') addCfg(p, 'plomberie', 'PLO_EVIER_DBL', 1);
        if (rep.laveVaisselle === 'oui') raccord[cle] = (raccord[cle] || 0) + 1;
        if (rep.evier || rep.laveVaisselle) applique.push(p.nom + ' : cuisine projetée');
      });
      var ll = (choix.plomberie.laveLinge && choix.plomberie.laveLinge.piece) || null;
      if (ll && ll !== 'aucun') {
        var pLL = pieceByCle(ll);
        if (pLL && LL_CONSOMMEES.indexOf(pLL.id) !== -1) { raccord[ll] = (raccord[ll] || 0) + 1; applique.push(pLL.nom + ' : lave-linge → PLO_RACCORD_LV (réel)'); }
        else if (pLL) descriptif.push((pLL.nom || ll) + ' : lave-linge — le moteur plomberie ne modélise pas cette pièce (choix conservé, non chiffré)');
      }
      Object.keys(raccord).forEach(function (cle) { var p = pieceByCle(cle); if (p) addCfg(p, 'plomberie', 'PLO_RACCORD_LV', raccord[cle]); });
    }

    // 4) VMC (neuf : intention = creer implicite ; sources canoniques)
    var projeterVmc = false;
    if (metiers.indexOf('vmc') !== -1 && choix.vmc) {
      var neuf = chantier.typeProjet === 'neuf' || chantier.typeProjet === 'extension';
      var intention = choix.vmc.intention || (neuf ? 'creer' : null);
      if (intention) { chantier.intentionVentilation = intention; projeterVmc = true; }
      if (choix.vmc.solution) { chantier.solutionVentilation = choix.vmc.solution; projeterVmc = true; }
      if (projeterVmc) applique.push('VMC → intentionVentilation=' + (intention || '—') + ', solutionVentilation=' + (choix.vmc.solution || '—') + ' (projection existante)');
    }

    // 5) REVÊTEMENTS + 6) FAÏENCE
    if ((metiers.indexOf('sols') !== -1 || metiers.indexOf('carrelage') !== -1) && choix.revetementsSol) {
      var rs = choix.revetementsSol; var uni = rs.uniforme === 'oui'; var nb = 0;
      pieces.forEach(function (p) { var mat = uni ? rs.global : (rs.parPiece && rs.parPiece[clePiece(p)]); if (mat) { p.solMateriau = mat; nb++; } });
      if (nb) applique.push('revêtements de sol → piece.solMateriau (' + nb + ' pièce(s), appliquerRevetements)');
    }
    if (metiers.indexOf('carrelage') !== -1 && choix.faience && choix.faience.parPiece) {
      var nf = 0; Object.keys(choix.faience.parPiece).forEach(function (cle) { var p = pieceByCle(cle); if (!p) return; if (choix.faience.parPiece[cle]) { p.faienceMode = choix.faience.parPiece[cle]; nf++; } });
      if (nf) applique.push('faïence → piece.faienceMode (' + nf + ' pièce(s), CAR_POSE_MUR)');
    }

    // 7) MENUISERIE (volets : MEN_VOLET_ROULANT ; motorisés : + ELEC_VOLET ; qty = nb fenêtres)
    if (metiers.indexOf('menuiserie') !== -1 && choix.menuiserie) {
      var v = choix.menuiserie.volets;
      if (v === 'manuel' || v === 'motorise') {
        var nv = 0, ne = 0;
        pieces.forEach(function (p) {
          var f = fenetres(p); if (f <= 0) return;
          addCfg(p, 'menuiserie', 'MEN_VOLET_ROULANT', f); nv += f;
          if (v === 'motorise' && metiers.indexOf('electricite') !== -1) { addCfg(p, 'electricite', 'ELEC_VOLET', f); ne += f; }
        });
        if (nv) applique.push('volets ' + (v === 'motorise' ? 'motorisés' : 'manuels') + ' → MEN_VOLET_ROULANT×' + nv + (ne ? ' + ELEC_VOLET×' + ne + ' (commande motorisation)' : ''));
      }
      if (choix.menuiserie.fenetres) applique.push('remplacement fenêtres : ' + choix.menuiserie.fenetres + ' (donnée conservée)');
    }

    // 8) ISOLATION + 9) BA13 (DESCRIPTIF : piece.config.isolation est m²-piloté, non auto-semé)
    if (metiers.indexOf('isolation') !== -1) {
      if (choix.isolation && (choix.isolation.niveau || choix.isolation.acoustique)) descriptif.push('isolation (niveau=' + (choix.isolation.niveau || '—') + ', acoustique=' + (choix.isolation.acoustique || '—') + ') : besoin conservé — le moteur isolation est piloté aux m² (ISO_LV_*/ISO_PHONIQUE), non auto-semé depuis le questionnaire (lot isolation futur)');
      if (choix.ba13 && (choix.ba13.cloisons === 'oui' || choix.ba13.fauxPlafond === 'oui' || choix.ba13.acoustique === 'oui')) descriptif.push('BA13 (cloisons=' + (choix.ba13.cloisons || '—') + ', faux plafond=' + (choix.ba13.fauxPlafond || '—') + ', acoustique=' + (choix.ba13.acoustique || '—') + ') : besoin conservé — codes moteur PLA_CLOISON_BA13 / PLA_BA13_PLAF_OSS / ISO_PHONIQUE pilotés aux m² (lot placo futur)');
    }

    return { applique: applique, nonBranche: nonBranche, descriptif: descriptif, objectif: objectif, projeterVmc: projeterVmc };
  }

  var API = { RJ45_PIECES: RJ45_PIECES, PIECES_EAU: PIECES_EAU, LL_CONSOMMEES: LL_CONSOMMEES, clePiece: clePiece, mapNiveauObjectif: mapNiveauObjectif, appliquer: appliquer };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ChoixTravauxAdaptDSBAT = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
