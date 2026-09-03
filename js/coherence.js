// =====================================================================
// js/coherence.js — Moteur de cohérence (MISSION 048)
// =====================================================================
// Agrège les contrôles de cohérence generiques (par piece) et les verifier*
// des metiers (deja modularises en mission 046 : js/moteurs/*.js). PUR : aucun
// acces au DOM, aucun affichage. Retourne le tableau d'alertes/avertissements.
// verifierCoherenceGlobale() = point d'entree central appele par le HTML.
// Deplacement VERBATIM depuis devis-configurateur.html — aucune regle/message modifie.
// =====================================================================

const SEUILS_COHERENCE = {
  surfaceMin: { salon:9, salle_manger:7, chambre:7, cuisine:4, bureau:5, sdb:3, sde:2, wc:0.8, entree:1.5 },
  hauteurMin: 2.2,
  hauteurMax: 3.2,
  portesMax: 4,
  fenetresMax: 5,
  ratioAllonge: 5,           // longueur / largeur au-delà duquel on doute
  // AIC-001/M1-B : contrôle de surface progressif (bornes en % entier)
  ecartSurfaceJaune: 1,      // 1–4 %  : avertissement jaune
  ecartSurfaceRenforce: 5,   // 5–14 % : avertissement jaune renforcé
  ecartSurfaceRouge: 15,     // ≥15 %  : avertissement rouge
  grandeSurface: 150,        // m² à partir desquels on questionne un faible nb de chambres
  chambresMinGrandeSurface: 3
};

function controlesCoherence(pieces, ch) {
  const S = SEUILS_COHERENCE;
  const alertes = [];

  pieces.forEach(p => {
    const d = p.dims || {};
    if (!d.l || !d.la) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : dimensions non renseignées — peinture, sols et surfaces seront comptés à 0 € pour cette pièce.' });
      return; // sans cotes, les autres contrôles n'ont pas de sens
    }
    const surf = d.l * d.la;
    const smin = S.surfaceMin[p.id];
    if (smin && surf < smin) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : ' + surf.toFixed(1) + ' m² — inhabituel pour ce type de pièce (généralement ≥ ' + smin + ' m²). Vérifiez longueur et largeur.' });
    }
    if (d.h && (d.h < S.hauteurMin || d.h > S.hauteurMax)) {
      alertes.push({ niveau:'info', texte: p.nom + ' : hauteur de ' + d.h + ' m — atypique (habituellement entre ' + S.hauteurMin + ' et ' + S.hauteurMax + ' m).' });
    }
    if ((d.portes || 0) > S.portesMax) {
      alertes.push({ niveau:'info', texte: p.nom + ' : ' + d.portes + ' portes — nombre élevé, il conditionne le type de commande d\'éclairage (va-et-vient, télérupteur).' });
    }
    if ((d.fenetres || 0) > S.fenetresMax) {
      alertes.push({ niveau:'info', texte: p.nom + ' : ' + d.fenetres + ' fenêtres — vérifiez la saisie.' });
    }
    const ratio = Math.max(d.l, d.la) / Math.max(0.1, Math.min(d.l, d.la));
    if (ratio > S.ratioAllonge && p.id !== 'couloir') {
      alertes.push({ niveau:'info', texte: p.nom + ' : pièce très allongée (' + d.l + ' × ' + d.la + ' m) — longueur et largeur ne sont-elles pas inversées avec autre chose ?' });
    }
  });

  // ===== Contrôles de configuration (prises, éclairage, points d'eau, portes) =====
  // Ne s'exécutent que sur des pièces configurées (config.electricite initialisée
  // = norme appliquée) pour ne pas générer de faux positifs en phase 1.
  const EXT = ['terrasse','jardin','facade','carport'];
  pieces.forEach(p => {
    const d = p.dims || {};
    const cfg = p.config || {};
    const configuree = !!cfg.electricite;

    // Pièce avec 0 porte (hors extérieur) — conditionne la commande d'éclairage.
    // AIC-001/M1 : contrôle à coloration ÉLECTRIQUE → rattaché au métier électricité
    // (ne s'affiche plus si le client n'a pas sélectionné l'électricité). Règle inchangée.
    if ((d.portes || 0) === 0 && !EXT.includes(p.id)
        && typeof metiersActifs !== 'undefined' && metiersActifs.includes('electricite')) {
      alertes.push({ niveau:'info', texte: p.nom + ' : aucune porte indiquée — vérifiez la saisie (le nombre d\'accès détermine simple allumage / va-et-vient / télérupteur).' });
    }

    if (configuree && typeof metiersActifs !== 'undefined' && metiersActifs.includes('electricite')) {
      const e = cfg.electricite || {};
      const nbEcl = (e.ELEC_PL_SA||0)+(e.ELEC_PL_VV||0)+(e.ELEC_PL_3BP||0)+(e.ELEC_PL_APP||0)+(e.ELEC_PL_APV||0)+(e.ELEC_PL_DBL||0)+(e.ELEC_PL_SUP||0);
      const nbPrises = (e.ELEC_PRISE10||0)+(e.ELEC_PRISED||0)+(e.ELEC_PRISET||0)+(e.ELEC_PRISE20||0)+(e.ELEC_PRISE32||0)+(e.ELEC_PRISECMD||0);
      if (nbEcl === 0 && !EXT.includes(p.id)) {
        alertes.push({ niveau:'attention', texte: p.nom + ' : aucun point d\'éclairage prévu — inhabituel pour cette pièce.' });
      }
      // « Pièce sans prise » : uniquement là où une prise est attendue (le WC et l'extérieur en sont normalement dépourvus)
      if (nbPrises === 0 && ['salon','salle_manger','chambre','cuisine','bureau','sdb','sde','entree'].includes(p.id)) {
        alertes.push({ niveau:'attention', texte: p.nom + ' : aucune prise prévue — est-ce volontaire ?' });
      }
    }

    if (configuree && typeof metiersActifs !== 'undefined' && metiersActifs.includes('plomberie')) {
      const pl = cfg.plomberie || {};
      const points = Object.values(pl).reduce((s, q) => s + (q || 0), 0);
      if (p.id === 'cuisine' && points === 0) {
        alertes.push({ niveau:'info', texte: 'Cuisine : aucun point d\'eau (évier) prévu — est-ce volontaire ?' });
      }
      if ((p.id === 'sdb' || p.id === 'sde') && points === 0) {
        alertes.push({ niveau:'info', texte: p.nom + ' : aucun point d\'eau prévu (douche, baignoire, vasque) — est-ce volontaire ?' });
      }
    }

    // Peinture prévue sur une pièce sans dimensions exploitables (surfaces = 0)
    const aPeinture = !!cfg.peinture_auto || (cfg.peinture && Object.keys(cfg.peinture).length > 0);
    if (typeof metiersActifs !== 'undefined' && metiersActifs.includes('peinture') && aPeinture && !(d.l && d.la)) {
      alertes.push({ niveau:'attention', texte: p.nom + ' : peinture prévue mais dimensions manquantes — les surfaces seront comptées à 0 €.' });
    }
  });

  // Contrôles globaux
  const surfDeclaree = parseFloat(ch && ch.surface) || 0;
  const surfSaisie = pieces.reduce((s, p) => s + (((p.dims || {}).l || 0) * ((p.dims || {}).la || 0)), 0);
  if (surfDeclaree > 0 && surfSaisie > 0) {
    // AIC-001/M1-B : contrôle de surface PROGRESSIF (transversal, non bloquant).
    // Bascule calée sur le POURCENTAGE AFFICHÉ. 0 % → aucun message ici
    // (le 👍 vert est affiché au récapitulatif) ; 1–4 % jaune ; 5–14 % jaune renforcé ; ≥15 % rouge.
    const diff = surfSaisie - surfDeclaree;                 // signé
    const pct  = Math.round(Math.abs(diff) / surfDeclaree * 100);
    if (pct >= S.ecartSurfaceJaune) {
      const D = surfDeclaree, Sm = Math.round(surfSaisie), reste = Math.abs(Math.round(diff));
      const chiffres = D + ' m² déclarés · ' + Sm + ' m² configurés · écart ' + reste + ' m² (' + pct + ' %). ';
      const niveau = pct >= S.ecartSurfaceRouge ? 'critique' : 'attention';
      let phrase;
      if (diff < 0) {
        phrase = (pct >= S.ecartSurfaceRouge)
          ? 'Il reste environ ' + reste + ' m² à répartir — vérifiez vos métrés et la liste des pièces.'
          : 'Il reste environ ' + reste + ' m² à répartir — vérifiez que tous les espaces ont été renseignés.';
      } else {
        phrase = (pct >= S.ecartSurfaceRouge)
          ? 'Le métrage des pièces dépasse nettement la surface déclarée — vérifiez impérativement vos métrés.'
          : 'Le métrage des pièces dépasse la surface déclarée — vérifiez vos surfaces.';
      }
      alertes.push({ niveau: niveau, texte: chiffres + phrase });
    }
  }
  const nbChambres = pieces.filter(p => p.id === 'chambre').length;
  // AIC-001/M1 : contrôle TRANSVERSAL de vérification (non bloquant, vocabulaire neutre). Seuils inchangés.
  if (surfDeclaree >= S.grandeSurface && nbChambres > 0 && nbChambres < S.chambresMinGrandeSurface) {
    alertes.push({ niveau:'info', texte: 'Votre configuration comporte ' + nbChambres + ' chambre(s) pour ' + surfDeclaree + ' m². Vérifiez que toutes les pièces ont bien été renseignées.' });
  }

  // Contrôle final du moteur plomberie (doublons, incohérences, orphelins) — MISSION 030
  if (typeof verifierPlomberie === 'function') {
    verifierPlomberie(pieces).forEach(a => alertes.push(a));
  }
  // Contrôle final du moteur sols (surface, référence, dépose, sous-couche, doublons) — MISSION 033
  if (typeof verifierSols === 'function') {
    verifierSols(pieces).forEach(a => alertes.push(a));
  }
  // Contrôle final du moteur VMC (bouches, entrées d'air, cohérence caisson) — MISSION 040
  if (typeof verifierVMC === 'function') {
    verifierVMC(pieces).forEach(a => alertes.push(a));
  }
  // Contrôle final du moteur menuiserie (ouvertures ↔ menuiseries, quantités, références) — MISSION 042
  if (typeof verifierMenuiserie === 'function') {
    verifierMenuiserie(pieces).forEach(a => alertes.push(a));
  }
  // Contrôle final du moteur chauffage (radiateurs ↔ circuits/sorties fil pilote) — MISSION 043
  if (typeof verifierChauffage === 'function') {
    verifierChauffage(pieces, ch).forEach(a => alertes.push(a));
  }

  // M57 LOT4 : cohérence intention ↔ existant VMC (SIGNAL non bloquant — aucune correction,
  //   aucune modification de réponse client, aucune prestation créée).
  //   'remplacer' + existant 'aucune'  → contradiction à confirmer (on ne remplace pas ce qui n'existe pas).
  //   'remplacer' + existant 'inconnu' → autorisé mais à confirmer (existant non encore établi).
  if (ch && ch.intentionVentilation === 'remplacer') {
    if (ch.typeVentilationExistante === 'aucune') {
      alertes.push({ niveau:'info', texte: 'Votre réponse indique qu\'il n\'y a pas actuellement de système de ventilation, mais vous avez indiqué vouloir le remplacer. Ce point devra être confirmé.' });
    } else if (ch.typeVentilationExistante === 'inconnu') {
      alertes.push({ niveau:'info', texte: 'Vous souhaitez remplacer votre ventilation, mais le système existant n\'est pas encore établi. Ce point devra être confirmé lors de la visite.' });
    }
  }

  return alertes;
}

// Point d'entree central : agrege tous les controles, retourne les alertes/
// avertissements/recommandations, sans aucun affichage ni acces DOM.
function verifierCoherenceGlobale(pieces, ch) {
  return controlesCoherence(pieces, ch);
}

if (typeof module !== "undefined" && module.exports) module.exports = { SEUILS_COHERENCE, controlesCoherence, verifierCoherenceGlobale };
