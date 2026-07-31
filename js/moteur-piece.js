// =====================================================================
// js/moteur-piece.js — Calcul PUR par pièce (MISSION 047)
// =====================================================================
// calculerPiece(piece, chantier, metiers) : cœur du calcul « par pièce ».
//   • n'accède JAMAIS au DOM (aucun getElementById, aucune lecture/écriture HTML) ;
//   • ne lit que des données métier (piece, chantier, metiers) ;
//   • met à jour le MODÈLE (piece.surfaces, piece.config.peinture_auto/sols_auto,
//     piece.peintureQuantites, piece.tempsChantier/tempsParMetier, piece.totalHT) ;
//   • retourne un objet de résultats pour l'affichage.
// Logique déplacée VERBATIM depuis recalcPiece — aucune règle/calcul/prix modifié.
// Dépendances résolues à l'appel : getMoyenPrixFor, tempsUnitaire, detectionSousCouche,
// quantitesPeinture (prix.js), SOLS_PARAMS (prix.js). Les choix peinture/sols sont lus
// sur la pièce (piece.peintMur/peintPlaf/peintPapier/solType/solSousCouche/solPose),
// synchronisés depuis l'interface par recalcPiece AVANT l'appel.
// =====================================================================

function calculerPiece(piece, chantier, metiers) {
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);

  const d = piece.dims || {};
  const l = d.l || 0;
  const la = d.la || 0;
  const h = d.h || 2.5;
  const fen = d.fenetres || 0;
  const por = d.portes || 0;

  const surfSol = l * la;
  const surfPlaf = surfSol;
  const surfMursTotal = 2 * (l + la) * h;
  const surfOuvertures = (fen * 1.5) + (por * 2.0);
  const surfMursNette = Math.max(0, surfMursTotal - surfOuvertures);
  piece.surfaces = { sol: surfSol, murs: surfMursNette, plafond: surfPlaf };

  let totalPiece = 0;
  let tempsPiece = 0;
  const tempsParMetier = {};
  const addTemps = (metier, hh) => { if (hh > 0) { tempsPiece += hh; tempsParMetier[metier] = (tempsParMetier[metier] || 0) + hh; } };

  // ----- Peinture auto -----
  let peintureSousCouche = null, peintureSousCouchePrix = 0;
  if (metiers.includes('peinture')) {
    const murGamme = piece.peintMur;
    const plafGamme = piece.peintPlaf;
    const papier = piece.peintPapier;
    const CODES_PEINT_MUR = { less: 'PEINT_MUR_LESS', std: 'PEINT_MUR_STD', fort: 'PEINT_MUR_FORT' };
    const CODES_PEINT_PLAF = { less: 'PEINT_PLAF_LESS', std: 'PEINT_PLAF_STD' };
    const pMur = CODES_PEINT_MUR[murGamme] ? getMoyenPrixFor(CODES_PEINT_MUR[murGamme], piece) * surfMursNette : 0;
    const pPlaf = CODES_PEINT_PLAF[plafGamme] ? getMoyenPrixFor(CODES_PEINT_PLAF[plafGamme], piece) * surfPlaf : 0;
    const pPapier = papier === 'oui' ? getMoyenPrixFor('PREP_DCOL_PAP', piece) * surfMursNette : 0;

    const sc = detectionSousCouche(piece, chantier, surfMursNette, surfPlaf);
    const pSousCouche = sc ? getMoyenPrixFor('PEINT_SOUS_COUCHE', piece) * sc.surf : 0;
    peintureSousCouche = sc; peintureSousCouchePrix = pSousCouche;

    piece.peintureQuantites = (typeof quantitesPeinture === 'function' && (surfMursNette > 0 || surfPlaf > 0))
      ? quantitesPeinture(surfMursNette, surfPlaf, sc ? sc.surf : 0)
      : null;

    const totalPeinture = pMur + pPlaf + pPapier + pSousCouche;
    addTemps('peinture',
      (CODES_PEINT_MUR[murGamme] ? tempsUnitaire(CODES_PEINT_MUR[murGamme]) * surfMursNette : 0)
      + (CODES_PEINT_PLAF[plafGamme] ? tempsUnitaire(CODES_PEINT_PLAF[plafGamme]) * surfPlaf : 0)
      + (papier === 'oui' ? tempsUnitaire('PREP_DCOL_PAP') * surfMursNette : 0)
      + (sc ? tempsUnitaire('PEINT_SOUS_COUCHE') * sc.surf : 0));
    totalPiece += totalPeinture;
    piece.config['peinture_auto'] = totalPeinture;
  }

  // ----- Sols auto -----
  if (metiers.includes('sols')) {
    const CODES_SOL = { parq_flot:'SOL_PARQ_FLOT', stratifie:'SOL_STRATIFIE', pvc:'SOL_PVC', moquette:'SOL_MOQUETTE', lino:'SOL_LINO' };
    const CODES_SC = { std:'SOL_SOUSC', liege:'SOL_SOUSC_LIEGE' };
    const codeSol = CODES_SOL[piece.solType];
    const codeSC = CODES_SC[piece.solSousCouche];
    let perte = 0, frac = 1;
    if (typeof SOLS_PARAMS !== 'undefined') {
      perte = (SOLS_PARAMS.pertes[piece.solType] || 0);
      if (piece.solPose === 'diagonale') perte += (SOLS_PARAMS.perteDiagonale || 0);
      const f = SOLS_PARAMS.fournitureFraction[piece.solType];
      frac = (f === undefined) ? 1 : f;
    }
    const majoration = (1 - frac) + frac * (1 + perte);
    const pSol = codeSol ? getMoyenPrixFor(codeSol, piece) * surfSol * majoration : 0;
    const pSC = codeSC ? getMoyenPrixFor(codeSC, piece) * surfSol : 0;
    const totalSols = pSol + pSC;
    totalPiece += totalSols;
    piece.config['sols_auto'] = totalSols;
    addTemps('sols',
      (codeSol ? tempsUnitaire(codeSol) * surfSol : 0)
      + (codeSC ? tempsUnitaire(codeSC) * surfSol : 0));
  }

  // ----- Prestations manuelles (élec, plomberie, carrelage, isolation, menuiserie, vmc + extras) -----
  for (const [metier, prestations] of Object.entries(piece.config)) {
    if (metier === 'peinture_auto' || metier === 'sols_auto') continue;
    for (const [code, qty] of Object.entries(prestations)) {
      totalPiece += getMoyenPrixFor(code, piece) * qty;
      addTemps(metier, tempsUnitaire(code) * qty);
    }
  }

  piece.tempsChantier = Math.round(tempsPiece * 10) / 10;
  piece.tempsParMetier = Object.fromEntries(Object.entries(tempsParMetier).map(([m, hh]) => [m, Math.round(hh * 10) / 10]));
  piece.totalHT = totalPiece;

  return {
    surfaces: piece.surfaces,
    peinture: { sousCouche: peintureSousCouche, sousCouchePrix: peintureSousCouchePrix, quantites: piece.peintureQuantites },
    temps: { total: piece.tempsChantier, parMetier: piece.tempsParMetier },
    totalHT: totalPiece
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { calculerPiece };
