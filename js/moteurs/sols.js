// js/moteurs/sols.js — Moteur métier « sols » (par pièce). Extrait VERBATIM de
// devis-configurateur.html (MISSION 046). Aucune règle/calcul/prix modifié.
// Fonctions globales ; dépendances résolues à l'appel (chantier, piecesSelectionnees,
// metiersActifs, getMoyenPrixFor, PRIX, *_PARAMS, dimensionnement*).

function evaluationSupportSol(piece, ch) {
  ch = ch || {}; piece = piece || {};
  const raisons = [];
  if (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension') raisons.push('construction neuve / extension (chape à dresser avant pose)');
  if (ch.etatLieux === 'mauvais') raisons.push('état déclaré : mauvais (sol probablement irrégulier)');
  if (ch.ageBati === 'ancien' || ch.ageBati === 'tres_ancien') raisons.push('bâtiment ancien (support souvent inégal)');
  const type = piece.solType;
  if (type === 'pvc' || type === 'lino') raisons.push('revêtement souple (PVC / lino) : exige un support parfaitement lisse');
  else if (type === 'parq_flot' || type === 'stratifie') raisons.push('pose flottante : tolère mal les défauts de planéité');
  return { ragreageConseille: raisons.length > 0, raisons };
}

function controlesOublisSol(piece) {
  const d = piece.dims || {};
  const cfg = (piece.config && piece.config.sols) || {};
  const ign = piece._oublisIgnoresSol || {};
  const type = piece.solType;
  const list = [];
  if (!type) return list; // rien à suggérer tant qu'aucun revêtement n'est choisi
  const add = (code, qty, question, unite) => {
    qty = Math.round((qty || 0) * 10) / 10;
    if (qty <= 0 || cfg[code] || ign[code]) return;
    list.push({ code, qty, question, unite });
  };
  // Plinthes assorties au revêtement — périmètre moins les passages de portes
  if (d.l && d.la) {
    const per = 2 * (d.l + d.la) - 0.8 * (d.portes || 0);
    const codePlinthe = (type === 'parq_flot') ? 'SOL_PLINT_BOIS' : 'SOL_PLINT_STR';
    add(codePlinthe, Math.max(0, per),
        'Vous n\'avez pas prévu de plinthes (~' + Math.round(per) + ' ml). Souhaitez-vous les ajouter ?', 'ml');
  }
  // Barres de seuil — une par passage de porte
  add('SOL_SEUIL', d.portes || 0,
      'Barres de seuil aux ' + (d.portes || 0) + ' passage(s) de porte non prévues. Les ajouter ?', 'U');
  // Ragréage — si le support le justifie
  const ev = evaluationSupportSol(piece, chantier);
  if (ev.ragreageConseille && d.l && d.la) {
    add('SOL_RAGREAGE', d.l * d.la,
        'Ragréage du sol non prévu (support plan avant pose). L\'ajouter ?', 'm²');
  }
  // Dépose de l'ancien revêtement — proposée en rénovation
  if (chantier && chantier.typeProjet === 'renov' && d.l && d.la) {
    add('SOL_DEPOSE', d.l * d.la,
        'Dépose de l\'ancien revêtement non prévue (rénovation). L\'ajouter ?', 'm²');
  }
  // Joint à froid pour lino
  if (type === 'lino' && d.l && d.la) {
    add('SOL_JOINT_LINO', Math.max(d.l, d.la),
        'Joint à froid pour lino non prévu (~' + Math.round(Math.max(d.l, d.la)) + ' ml). L\'ajouter ?', 'ml');
  }
  return list;
}

function controlesInfoSol(piece) {
  const out = [];
  if (piece.solType && !((piece.surfaces || {}).sol > 0)) {
    out.push('Un revêtement est choisi mais le sol n\'est pas chiffré (dimensions manquantes). Est-ce volontaire ?');
  }
  return out;
}

function verifierSols(pieces, metiers) {
  metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : []);
  const alertes = [];
  if (!metiers.includes('sols')) return alertes;
  const CODES_SOL = { parq_flot:'SOL_PARQ_FLOT', stratifie:'SOL_STRATIFIE', pvc:'SOL_PVC', moquette:'SOL_MOQUETTE', lino:'SOL_LINO' };
  const existe = code => { try { return getMoyenPrixFor(code, {}) > 0; } catch (e) { return false; } };
  (pieces || []).forEach(p => {
    const type = p.solType;
    if (!type) return; // aucun revêtement -> rien à vérifier
    const d = p.dims || {};
    const surf = (d.l || 0) * (d.la || 0);
    const sols = (p.config && p.config.sols) || {};
    const car = (p.config && p.config.carrelage) || {};

    // 1. Surface manquante
    if (!(surf > 0)) alertes.push({ niveau:'attention', texte: p.nom + ' : revêtement choisi mais surface non calculée (dimensions manquantes) — sol compté à 0 €.' });
    // 2. Référence catalogue absente
    const code = CODES_SOL[type];
    if (code && !existe(code)) alertes.push({ niveau:'attention', texte: p.nom + ' : référence de revêtement « ' + code + ' » absente du catalogue.' });
    // 3. Dépose détectée mais non tarifable
    if ((sols.SOL_DEPOSE || 0) > 0 && !existe('SOL_DEPOSE')) alertes.push({ niveau:'attention', texte: p.nom + ' : dépose demandée mais non tarifable (référence catalogue manquante).' });
    // 4. Sous-couche recommandée mais refusée (avertissement simple)
    const flottant = (type === 'parq_flot' || type === 'stratifie');
    if (flottant && (!p.solSousCouche || p.solSousCouche === 'non')) alertes.push({ niveau:'info', texte: p.nom + ' : sous-couche recommandée sous un sol flottant mais non retenue — à confirmer.' });
    // 5. Incohérence / doublon inter-métier : un sol ne peut être à la fois revêtement sols ET carrelage sol
    if ((car.CAR_POSE_SOL || 0) > 0 || (car.CAR_POSE_SOL_GRAND || 0) > 0) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : un revêtement de sol ET un carrelage au sol sont configurés — un seul revêtement par sol, doublon probable.' });
    }
    // Ragréage compté à la fois côté sols et côté carrelage
    if ((sols.SOL_RAGREAGE || 0) > 0 && (car.CAR_RAGREAGE || 0) > 0) {
      alertes.push({ niveau:'info', texte: p.nom + ' : ragréage compté côté sols ET côté carrelage — vérifiez le doublon.' });
    }
  });
  return alertes;
}


if (typeof module !== "undefined" && module.exports) module.exports = { evaluationSupportSol, controlesOublisSol, controlesInfoSol, verifierSols };
