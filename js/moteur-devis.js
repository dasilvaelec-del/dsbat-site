// =====================================================================
// js/moteur-devis.js — Moteur de calcul unifié du devis (MISSION 021)
// =====================================================================
// Extrait tel quel (verbatim) de devis-configurateur.html lors de la
// modularisation (MISSION 026). AUCUNE logique modifiée.
//
// RÔLE
//   Source UNIQUE de vérité pour Total HT / TVA / TTC / acomptes.
//   Consommée par renderPhase3 (écran) et genererPDFConfig (PDF).
//
// DÉPENDANCES (résolues à l'APPEL, via la portée globale partagée des
// scripts classiques — ce fichier est chargé comme <script src>, pas un module) :
//   • Données      : piecesSelectionnees, chantier, metiersActifs   (devis-configurateur.html)
//   • Catalogue    : PRIX                                           (prix.js)
//   • Sous-moteurs : dimensionnementTableau, dimensionnementVMC, coefZone (prix.js)
//   • Règles       : tauxTVA                                        (devis-configurateur.html)
//
// EFFETS DE BORD conservés : renseigne window.__besoinsTableau / __tableauAuto /
//   __ballon / __besoinsVMC / __vmcAuto / __forfaitAcces (moteurs d'explication).
//
// ⚠️ Ordre de chargement : ce fichier peut être chargé avant ou après le script
//    inline (les dépendances ne sont lues qu'au moment de l'appel, jamais au chargement).
// =====================================================================

function calculerDevis() {
  let totalGlobalHT = 0;
  piecesSelectionnees.forEach(p => { totalGlobalHT += p.totalHT || 0; });

  // ----- Tableau électrique auto (NF C 15-100) -----
  let tableau = null;
  if (metiersActifs.includes('electricite') && typeof dimensionnementTableau === 'function') {
    const b = { prises16:0, pointsLumineux:0, specialises20A:0, cuisson:0, chauffeEau:false, vmc:metiersActifs.includes('vmc'), circuitsVolets:0, circuitsChauffage:0, sonnerie:false, telerupteurs:0,
                surfaceLogement: parseFloat(chantier.surface) || 0 };
    let volets = 0, secheServ = 0, filPilote = 0;
    piecesSelectionnees.forEach(p => {
      const e = p.config.electricite || {};
      b.prises16 += (e.ELEC_PRISE10||0) + (e.ELEC_PRISED||0)*2 + (e.ELEC_PRISET||0)*3 + (e.ELEC_PRISECMD||0);
      b.pointsLumineux += (e.ELEC_PL_SA||0) + (e.ELEC_PL_VV||0) + (e.ELEC_PL_3BP||0) + (e.ELEC_PL_APP||0) + (e.ELEC_PL_APV||0) + (e.ELEC_PL_DBL||0)*2 + (e.ELEC_PL_SUP||0);
      b.telerupteurs += (e.ELEC_PL_3BP||0);
      b.specialises20A += (e.ELEC_PRISE20||0) + (e.ELEC_SC20||0);
      b.cuisson += (e.ELEC_PRISE32||0);
      if ((e.ELEC_SONETTE||0) > 0) b.sonnerie = true;
      volets += (e.ELEC_VOLET||0);
      secheServ += (e.ELEC_SECH_SERV||0);
      filPilote += (e.ELEC_SC20_FP||0) + (e.ELEC_SC10_FP||0);
      const pl = p.config.plomberie || {};
      if (((pl.PLO_BALLON_100||0) + (pl.PLO_BALLON_200||0)) > 0) b.chauffeEau = true;
    });
    b.circuitsVolets = volets > 0 ? Math.max(1, Math.ceil(volets/5)) : 0;
    b.circuitsChauffage = secheServ;
    if (chantier.borneVE === 'oui') b.irve = true;
    if (chantier.vmc && chantier.vmc !== 'non') b.vmc = true;
    if (chantier.eauChaude === 'ballon') b.chauffeEau = true;
    if (chantier.chauffage === 'electrique') {
      const nbP = parseInt(chantier.pieces) || 0;
      b.circuitsChauffage += filPilote > 0 ? Math.ceil(filPilote / 3) : Math.max(1, Math.ceil(nbP / 3));
    }
    if (chantier.tableauExistant === 'ancien' || chantier.tableauExistant === 'inexistant') b.parafoudre = true;
    const besoinTableau = (chantier.tableauExistant !== 'recent');
    if (besoinTableau && (b.prises16 + b.pointsLumineux + b.specialises20A) > 0) {
      tableau = dimensionnementTableau(b);
      totalGlobalHT += tableau.prixTotalHT;
    }
    window.__besoinsTableau = b;
  }
  window.__tableauAuto = tableau;

  // ----- Ballon d'eau chaude auto (garde anti-double facturation) -----
  const ballonDejaConfigure = piecesSelectionnees.some(p => {
    const pl = p.config.plomberie || {};
    return ((pl.PLO_BALLON_100||0) + (pl.PLO_BALLON_200||0) + (pl.PLO_BALLON_50||0)) > 0;
  });
  let ballon = null;
  if (!ballonDejaConfigure && chantier.eauChaude === 'ballon' && metiersActifs.includes('plomberie') && typeof PRIX !== 'undefined') {
    const codeB = (parseInt(chantier.pieces) || 0) >= 4 ? 'PLO_BALLON_200' : 'PLO_BALLON_100';
    const itB = (PRIX.plomberie_divers || []).find(x => x.code === codeB);
    if (itB) { ballon = { label: itB.label, prix: Math.round((itB.prix.min + itB.prix.max) / 2) }; totalGlobalHT += ballon.prix; }
  }
  window.__ballon = ballon;

  // ----- VMC : dimensionnement auto de la centrale (caisson + gaines + rejet toiture) -----
  // Les bouches / entrées d'air sont déjà chiffrées par pièce ; on ajoute ici les
  // éléments centraux manquants, comme le tableau électrique côté élec.
  let vmc = null;
  if (metiersActifs.includes('vmc') && typeof dimensionnementVMC === 'function') {
    let bouches = 0, entreesAir = 0;
    piecesSelectionnees.forEach(p => {
      const v = p.config.vmc || {};
      bouches += (v.VMC_BOUCHE || 0);
      entreesAir += (v.VMC_ENTREE_AIR || 0);
    });
    if (bouches > 0) {
      vmc = dimensionnementVMC({ bouches, entreesAir });
      totalGlobalHT += vmc.prixTotalHT;
    }
    window.__besoinsVMC = { bouches, entreesAir };
  }
  window.__vmcAuto = vmc;

  // ----- Forfait accès + majoration logement occupé + coefficient de zone -----
  let forfaitAcces = 0;
  if (chantier.accessibilite === 'moyen') forfaitAcces += 80;
  else if (chantier.accessibilite === 'difficile') forfaitAcces += 200;
  if (chantier.accessSup === 'voisins') forfaitAcces += 50;
  else if (chantier.accessSup === 'copro') forfaitAcces += 120;
  if (chantier.accessSup === 'occupé') totalGlobalHT = Math.round(totalGlobalHT * 1.088);
  totalGlobalHT += forfaitAcces;
  window.__forfaitAcces = forfaitAcces;

  const coefZ = (typeof coefZone === 'function') ? coefZone(chantier.codePostal) : 1;
  totalGlobalHT = Math.round(totalGlobalHT * coefZ);

  // ----- TVA / TTC / acomptes -----
  const taux = tauxTVA();
  const tva = totalGlobalHT * taux;
  const ttc = totalGlobalHT + tva;

  return {
    totalHT: totalGlobalHT, taux, tva, ttc,
    tableau, ballon, vmc, forfaitAcces, coefZ,
    besoinsTableau: window.__besoinsTableau,
    besoinsVMC: window.__besoinsVMC,
    acomptes: { a1: ttc * 0.40, a2: ttc * 0.30, a3: ttc * 0.30 }
  };
}

// Exposition explicite (redondante mais claire) : la déclaration de fonction est
// déjà globale pour les scripts classiques ; on la publie aussi sur window.
if (typeof window !== 'undefined') window.calculerDevis = calculerDevis;
// Export Node éventuel (tests) — sans effet dans le navigateur.
if (typeof module !== 'undefined' && module.exports) module.exports = { calculerDevis };
