// =====================================================================
// tests/vmc-constructeur-lot17b.test.js — M57 LOT17-B
// =====================================================================
// Contrats groupe/terminal constructeur + evaluerCourbeVmc (exact / interpolé / hors_courbe /
// absent, AUCUNE extrapolation) + adapterDonneesConstructeurPourPression → LOT17-A.
// Aucune sélection produit, aucune valeur inventée, hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const approx = (a, b, e) => a != null && Math.abs(a - b) <= (e || 0.01);
const P = (id, n) => ({ id, numero: n });
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, extra || {});

const COURBE = [{ debit: 100, pression: 200 }, { debit: 200, pression: 100 }]; // linéaire décroissante
const META = { fabricant: 'ACME', reference: 'G1', source: 'FICHE', version: 'v1', provenance: VMC.PROVENANCE_VMC.CONSTRUCTEUR };

A(typeof VMC.evaluerCourbeVmc === 'function' && typeof VMC.creerGroupeVmc === 'function', '0. LOT17-B exporté');

// ---- 1/2. Courbe valide + point exact -------------------------------------------
{
  const e = VMC.evaluerCourbeVmc(COURBE, 100, META);
  A(e.statut === 'donnee_exacte' && e.pression === 200 && e.methode === 'point_constructeur', '2. point exact');
  A(e.provenance === 'constructeur' && e.fabricant === 'ACME', '1/8/9. provenance + fabricant conservés');
}

// ---- 3. Interpolation entre deux points -----------------------------------------
{
  const e = VMC.evaluerCourbeVmc(COURBE, 150, META); // milieu → 150 Pa
  A(e.statut === 'interpolee' && approx(e.pression, 150) && e.methode === 'interpolation_lineaire_constructeur', '3. interpolation linéaire (150 Pa)');
  A(e.pointsSource.length === 2 && e.pointsSource[0].debit === 100 && e.pointsSource[1].debit === 200, '3/5. deux points source conservés');
}

// ---- 4/5. Débit inférieur / supérieur → hors_courbe (pas d'extrapolation) --------
{
  A(VMC.evaluerCourbeVmc(COURBE, 50, META).statut === 'hors_courbe' && VMC.evaluerCourbeVmc(COURBE, 50, META).pression === null, '4. débit inférieur → hors_courbe (null)');
  A(VMC.evaluerCourbeVmc(COURBE, 300, META).statut === 'hors_courbe' && VMC.evaluerCourbeVmc(COURBE, 300, META).pression === null, '5. débit supérieur → hors_courbe (null)');
}

// ---- 6. Courbe vide → donnee_absente --------------------------------------------
{
  A(VMC.evaluerCourbeVmc([], 120, META).statut === 'donnee_absente' && VMC.evaluerCourbeVmc([], 120, META).pression === null, '6. courbe vide → donnee_absente');
}

// ---- 7. Un seul point + débit différent → aucune interpolation ------------------
{
  const e = VMC.evaluerCourbeVmc([{ debit: 150, pression: 120 }], 180, META);
  A(e.statut === 'hors_courbe' && e.pression === null, '7. un seul point, débit différent → aucune pression inventée');
  A(VMC.evaluerCourbeVmc([{ debit: 150, pression: 120 }], 150, META).statut === 'donnee_exacte', '7bis. un seul point, débit exact → exact');
}

// ---- 10/11/12. Version + provenance test non-production -------------------------
{
  const g = VMC.creerGroupeVmc({ id: 'G', type: 'SF', fabricant: 'ACME', reference: 'R', source: 'S', version: 'V2', provenance: VMC.PROVENANCE_VMC.TEST, courbe: COURBE });
  A(g.version === 'V2', '10. version conservée');
  A(g.provenance === 'test', '11. provenance test');
  A(VMC.PROVENANCE_VMC.TEST === 'test', '12. « test » identifiable (jamais production)');
}

// ---- 13/14. Plage de fonctionnement / absence ------------------------------------
{
  A(VMC.positionDebitPlage({ debitMin: 100, debitMax: 200 }, 150) === 'dans_plage', '13. dans la plage');
  A(VMC.positionDebitPlage({ debitMin: 100, debitMax: 200 }, 80) === 'inferieur', '13. inférieur');
  A(VMC.positionDebitPlage({ debitMin: 100, debitMax: 200 }, 250) === 'superieur', '13. supérieur');
  A(VMC.positionDebitPlage(null, 150) === 'plage_absente', '14. plage absente');
}

// ---- Pipeline preEtude pour disposer des débits ---------------------------------
const REF = VMC.creerReferentielPertes({ id: 'R', methode: 'm', source: 'F', version: 't', provenance: VMC.PROVENANCE_VMC.TEST, dateValidation: 'd', masseVolumiqueAir: { valeur: 1.2 }, lineaire: { souple: { 125: 1.0, 160: 0.5 } }, singulier: {} });
const drE = { type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }, { role: 'collecteur', longueur: 4, diametre: 160, typeConduit: 'souple', singularites: [] }] };
const drI = { type: 'insufflation', troncons: [{ role: 'antenne', pieceRef: 'chambre#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }, { role: 'collecteur', longueur: 4, diametre: 160, typeConduit: 'souple', singularites: [] }] };
function preEtude(pieces, solution, reseaux) {
  return VMC.preEtudeVmc(pieces, CTX({ solution }), { donneesReseau: VMC.creerDonneesReseau({ reseaux }), referentielPertes: REF });
}
// courbe couvrant Q=30 (points 0 et 100)
const COURBE30 = [{ debit: 0, pression: 90 }, { debit: 100, pression: 40 }]; // à 30 → 90 - 50×0.3 = 75

// ---- 15/16/17/18/19. SF & DF courbes distinctes, jamais fusionnées --------------
{
  const peSF = preEtude([P('sdb', 1)], 'simple_flux', [drE]);
  const dcSF = { groupes: { extraction: [VMC.creerGroupeVmc({ type: 'SF', fabricant: 'A', reference: 'GSF', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30 })] } };
  const adSF = VMC.adapterDonneesConstructeurPourPression(dcSF, peSF);
  A(approx(adSF.pressionDisponible.extraction.valeur, 75), '15. SF : pression disponible interpolée à Q=30 (75 Pa)');

  const peDF = preEtude([P('sdb', 1), P('chambre', 1)], 'double_flux', [drE, drI]);
  const dcDF = { groupes: {
    extraction: [VMC.creerGroupeVmc({ type: 'DF', fabricant: 'A', reference: 'EXT', source: 'F', version: 'v', provenance: 'constructeur', courbe: [{ debit: 0, pression: 120 }, { debit: 100, pression: 20 }] })], // à 30 → 90
    insufflation: [VMC.creerGroupeVmc({ type: 'DF', fabricant: 'A', reference: 'INS', source: 'F', version: 'v', provenance: 'constructeur', courbe: [{ debit: 0, pression: 150 }, { debit: 100, pression: 50 }] })]  // à 30 → 120
  } };
  const adDF = VMC.adapterDonneesConstructeurPourPression(dcDF, peDF);
  A(approx(adDF.pressionDisponible.extraction.valeur, 90), '16. DF extraction : courbe extraction (90)');
  A(approx(adDF.pressionDisponible.insufflation.valeur, 120), '17. DF insufflation : courbe insufflation (120)');
  A(adDF.pressionDisponible.extraction.valeur !== adDF.pressionDisponible.insufflation.valeur, '18/19. DF : courbes distinctes, jamais fusionnées');
}

// ---- 20-24. Pertes internes filtre/échangeur/batterie (documentées vs absentes) --
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drE]);
  const g = VMC.creerGroupeVmc({ type: 'SF', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30,
    pertesInternes: { filtre: { valeur: 20, provenance: 'constructeur' }, echangeur: { valeur: 0, provenance: 'constructeur' } /* batterie absente */ } });
  const ad = VMC.adapterDonneesConstructeurPourPression({ groupes: { extraction: [g] } }, pe);
  const comps = ad.composants.extraction || [];
  A(comps.some(c => c.composant === 'filtre' && c.valeur === 20), '20. perte filtre connue → composant');
  A(comps.some(c => c.composant === 'echangeur' && c.valeur === 0), '22. perte échangeur documentée à 0 → conservée');
  A(!comps.some(c => c.composant === 'batterie'), '21/23. perte batterie absente → non inventée (pas de 0)');
  const gVide = VMC.creerGroupeVmc({ type: 'SF', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30 });
  A(gVide.pertesInternes.filtre === null && gVide.pertesInternes.batterie === null, '21/23. pertes internes absentes → null');
}

// ---- 25/26/27/28. Terminal courbe / interpolation / hors courbe / absence --------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drE]); // Q extraction = 30
  const t = VMC.creerTerminalVmc({ id: 'T', fabricant: 'B', reference: 'BEP', type: 'bouche', source: 'F', version: 'v', provenance: 'constructeur', courbe: [{ debit: 0, pression: 0 }, { debit: 60, pression: 30 }] }); // à 30 → 15
  const ad = VMC.adapterDonneesConstructeurPourPression({ terminaux: { extraction: [t] } }, pe);
  A(ad.terminaux.extraction && approx(ad.terminaux.extraction.valeur, 15), '25/26. terminal interpolé à Q=30 (15 Pa)');
  const tHors = VMC.creerTerminalVmc({ source: 'F', version: 'v', provenance: 'constructeur', courbe: [{ debit: 100, pression: 40 }, { debit: 200, pression: 80 }] }); // 30 hors
  const adH = VMC.adapterDonneesConstructeurPourPression({ terminaux: { extraction: [tHors] } }, pe);
  A(!adH.terminaux.extraction, '27. terminal hors courbe → pas de perte utilisable');
  const adN = VMC.adapterDonneesConstructeurPourPression({}, pe);
  A(!adN.terminaux.extraction, '28. absence terminal → inconnu (rien inventé)');
}

// ---- 29/30/31. Aucune extrapolation / valeur par défaut / marge automatique ------
{
  A(VMC.evaluerCourbeVmc(COURBE, 500, META).pression === null, '29. aucune extrapolation');
  const g = VMC.creerGroupeVmc({ type: 'SF', courbe: [] });
  A(g.courbe.length === 0 && g.pertesInternes.filtre === null, '30. aucune valeur par défaut');
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drE]);
  const ad = VMC.adapterDonneesConstructeurPourPression({ groupes: { extraction: [VMC.creerGroupeVmc({ type: 'SF', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30 })] } }, pe);
  A(!/marge|securite|conforme/i.test(JSON.stringify(ad)), '31. aucune marge automatique / conformité');
}

// ---- 12b. Aucune sélection produit (plusieurs groupes) --------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drE]);
  const g1 = VMC.creerGroupeVmc({ type: 'SF', reference: 'A', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30 });
  const g2 = VMC.creerGroupeVmc({ type: 'SF', reference: 'B', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30 });
  const ad = VMC.adapterDonneesConstructeurPourPression({ groupes: { extraction: [g1, g2] } }, pe);
  A(!ad.pressionDisponible.extraction && ad.notes.some(n => /plusieurs_groupes_non_departages/.test(n.champ)), '38. plusieurs groupes → aucune sélection');
}

// ---- 32. Transmission à LOT17-A → comparaison possible ---------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drE]); // pertes réseau = 6, Q=30
  const dc = { groupes: { extraction: [VMC.creerGroupeVmc({ type: 'SF', source: 'F', version: 'v', provenance: 'constructeur', courbe: COURBE30, pertesInternes: { filtre: { valeur: 0 }, echangeur: { valeur: 0 }, batterie: { valeur: 0 } } })] },
    terminaux: { extraction: [VMC.creerTerminalVmc({ source: 'F', version: 'v', provenance: 'constructeur', courbe: [{ debit: 0, pression: 0 }, { debit: 100, pression: 0 }] })] } };
  const dt = VMC.adapterDonneesConstructeurPourPression(dc, pe);
  const r = VMC.analysePressionVmc([], {}, pe, dt);
  A(r.reseaux[0].pressionDisponible.valeur === 75 && r.reseaux[0].statut === 'comparaison_possible', '32. transmission LOT17-A → comparaison (dispo 75 vs nécessaire 6)');
  A(r.reseaux[0].margePa === 75 - 6, '32. marge = 75 − 6 = 69');
}

// ---- 33/34. Non-mutation + déterminisme -----------------------------------------
{
  const spec = { type: 'SF', courbe: [{ debit: 0, pression: 90 }, { debit: 100, pression: 40 }] };
  const snap = JSON.stringify(spec);
  const a = VMC.creerGroupeVmc(spec), b = VMC.creerGroupeVmc(spec);
  A(JSON.stringify(spec) === snap, '33. spec non mutée');
  A(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(VMC.evaluerCourbeVmc(COURBE, 150, META)) === JSON.stringify(VMC.evaluerCourbeVmc(COURBE, 150, META)), '34. déterministe');
}

// ---- 35/36/37. Aucun pricing/Runtime/catalogue (statique) -----------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
['function creerGroupeVmc(', 'function evaluerCourbeVmc(', 'function adapterDonneesConstructeurPourPression('].forEach(sig => {
  const s0 = SRC.indexOf(sig); const rest = SRC.slice(s0); const s1 = rest.indexOf('\nfunction ', 1);
  const bloc = s1 > 0 ? rest.slice(0, s1) : rest;
  A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal/.test(bloc), '35/36/37. ' + sig.slice(9, 28) + '… hors money-path');
});

const total = ok + ko;
if (ko === 0) console.log('✅ Constructeur / courbes VMC (M57 LOT17-B) : ' + ok + '/' + total + ' — interpolation stricte, aucune extrapolation, SF/DF séparés, aucune sélection');
else { console.error('❌ Constructeur / courbes VMC LOT17-B : ' + ok + '/' + total); process.exit(1); }
