// =====================================================================
// tests/vmc-pression-lot17a.test.js — M57 LOT17-A : analyse pression / équilibre
// =====================================================================
// analysePressionVmc(pieces, contexte, preEtude, donneesTechnique?) : compare pression
// DISPONIBLE (externe fournie) vs pertes NÉCESSAIRES (LOT15/16) + composants/terminaux si
// fournis. margePa = dispo − nécessaire. Jamais « conforme », jamais de valeur inventée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, n) => ({ id, numero: n });
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, extra || {});

const REF = VMC.creerReferentielPertes({ id: 'R', methode: 'm', source: 'FIXTURE_TEST', version: 't', provenance: VMC.PROVENANCE_VMC.TEST, dateValidation: 'd', masseVolumiqueAir: { valeur: 1.2 }, lineaire: { souple: { 125: 1.0, 160: 0.5 } }, singulier: {} });
// donneesReseau extraction : antenne 4m Ø125 + collecteur 4m Ø160 → linéaire 4 + 2 = 6 Pa
const drExtraction = { type: 'extraction', troncons: [
  { role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] },
  { role: 'collecteur', longueur: 4, diametre: 160, typeConduit: 'souple', singularites: [] }
] };
const drInsufflation = { type: 'insufflation', troncons: [
  { role: 'antenne', pieceRef: 'chambre#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] },
  { role: 'collecteur', longueur: 4, diametre: 160, typeConduit: 'souple', singularites: [] }
] };
function preEtude(pieces, solution, reseaux) {
  const dr = VMC.creerDonneesReseau({ reseaux: reseaux });
  return VMC.preEtudeVmc(pieces, CTX({ solution }), { donneesReseau: dr, referentielPertes: REF });
}
const DISPO = (valeur, debitRef, prov) => ({ valeur, unite: 'Pa', debitReference: debitRef, source: 'CSTB', version: 'v1', provenance: prov || VMC.PROVENANCE_VMC.CONSTRUCTEUR });
const res = (r, type) => r.reseaux.find(x => x.type === type);

A(typeof VMC.analysePressionVmc === 'function', '0. analysePressionVmc exporté');

// ---- 1. SF pression dispo + pertes connues → comparaison_possible ----------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const dt = { pressionDisponible: { extraction: DISPO(180, 30) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0, debitReference: 30, source: 'C', version: 'v', provenance: 'constructeur' } } };
  const r = VMC.analysePressionVmc([], {}, pe, dt);
  const e = res(r, 'extraction');
  A(e.pertesNecessaires.valeur === 6, '1. pertes nécessaires = 6 Pa (réseau)');
  A(e.pressionDisponible.valeur === 180 && e.margePa === 174, '1. marge = 180 − 6 = 174');
  A(e.statut === 'comparaison_possible' && r.statut === 'comparaison_possible', '1. comparaison_possible (pas « conforme »)');
}

// ---- 2. SF pression disponible absente → incomplet -------------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const r = VMC.analysePressionVmc([], {}, pe, { composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } });
  A(res(r, 'extraction').pressionDisponible === null && res(r, 'extraction').statut === 'incomplet', '2. dispo absente → incomplet');
  A(r.donneesManquantes.some(d => d.champ === 'pression_disponible_groupe:extraction'), '2. pression_disponible_groupe signalée');
}

// ---- 3. SF pertes absentes (pas de référentiel dans preEtude) → incomplet --------
{
  const peSansPertes = VMC.preEtudeVmc([P('sdb', 1)], CTX({ solution: 'simple_flux' })); // pas d'options → pertes incomplètes
  const r = VMC.analysePressionVmc([], {}, peSansPertes, { pressionDisponible: { extraction: DISPO(180, 30) } });
  A(res(r, 'extraction').pertesNecessaires === null && res(r, 'extraction').statut === 'incomplet', '3. pertes absentes → incomplet');
}

// ---- 4. SF pertes partielles (composants/terminaux non documentés) → a_verifier --
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const r = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) } }); // ni composants ni terminaux
  A(res(r, 'extraction').statut === 'a_verifier', '4. termes non documentés → a_verifier');
  A(r.donneesManquantes.some(d => /pertes_internes_centrale_non_documentees/.test(d.champ)) && r.donneesManquantes.some(d => /pertes_terminaux_non_documentees/.test(d.champ)), '4. composants + terminaux signalés non documentés');
}

// ---- 5/6/7. DF : extraction et insufflation séparées + hypothèse équilibrage -----
{
  const pe = preEtude([P('sdb', 1), P('chambre', 1)], 'double_flux', [drExtraction, drInsufflation]);
  const dt = { pressionDisponible: { extraction: DISPO(180, 30), insufflation: DISPO(160, 30) }, composants: { extraction: [], insufflation: [] }, terminaux: { extraction: { valeur: 0 }, insufflation: { valeur: 0 } } };
  const r = VMC.analysePressionVmc([], {}, pe, dt);
  A(res(r, 'extraction') && res(r, 'insufflation') && res(r, 'extraction') !== res(r, 'insufflation'), '5/6. DF : deux réseaux distincts');
  A(res(r, 'insufflation').debitOrigine === 'hypothese', '7. insufflation : débit = hypothèse d\'équilibrage');
  A(r.hypotheses.some(h => h.clef === 'equilibrage_df' && h.origine === 'hypothese'), '7. hypothèse d\'équilibrage conservée (origine hypothese)');
  A(!/perteTotaleGlobale|reseauFusionne/.test(JSON.stringify(r.synthese)), '5. pertes DF jamais fusionnées');
}

// ---- 8/9. Provenance constructeur / visite conservée -----------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const dtC = { pressionDisponible: { extraction: DISPO(180, 30, VMC.PROVENANCE_VMC.CONSTRUCTEUR) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } };
  A(res(VMC.analysePressionVmc([], {}, pe, dtC), 'extraction').pressionDisponible.provenance === 'constructeur', '8. provenance constructeur conservée');
  const dtV = { pressionDisponible: { extraction: DISPO(180, 30, VMC.PROVENANCE_VMC.VISITE) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } };
  A(res(VMC.analysePressionVmc([], {}, pe, dtV), 'extraction').pressionDisponible.provenance === 'visite', '9. provenance visite conservée');
}

// ---- 10/11. Débit de référence identique vs différent ----------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const dtOk = { pressionDisponible: { extraction: DISPO(180, 30) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } };
  A(res(VMC.analysePressionVmc([], {}, pe, dtOk), 'extraction').margePa === 174, '10. débit référence identique → marge calculée');
  const dtKo = { pressionDisponible: { extraction: DISPO(180, 200) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } };
  const rKo = VMC.analysePressionVmc([], {}, pe, dtKo);
  A(res(rKo, 'extraction').statut === 'a_verifier' && res(rKo, 'extraction').margePa === null, '11. débit référence différent → a_verifier, pas de marge');
  A(rKo.donneesManquantes.some(d => /debit_reference_incompatible/.test(d.champ)), '11. debit_reference_incompatible signalé');
}

// ---- 14/15/16. Marge positive / nulle / négative ---------------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]); // pertes = 6
  const mk = (v) => ({ pressionDisponible: { extraction: DISPO(v, 30) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } });
  A(res(VMC.analysePressionVmc([], {}, pe, mk(10)), 'extraction').margePa === 4, '14. marge positive (+4)');
  A(res(VMC.analysePressionVmc([], {}, pe, mk(6)), 'extraction').margePa === 0 && res(VMC.analysePressionVmc([], {}, pe, mk(6)), 'extraction').statut === 'comparaison_possible', '15. marge nulle → comparaison_possible');
  const neg = VMC.analysePressionVmc([], {}, pe, mk(4));
  A(res(neg, 'extraction').margePa === -2 && res(neg, 'extraction').statut === 'pression_insuffisante', '16. marge négative → pression_insuffisante');
}

// ---- 17/18. Pertes internes centrale connues vs absentes -------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const rConnu = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) }, composants: { extraction: [{ composant: 'filtre', valeur: 20, unite: 'Pa', source: 'C', version: 'v', provenance: 'constructeur' }] }, terminaux: { extraction: { valeur: 0 } } });
  A(res(rConnu, 'extraction').pertesNecessaires.valeur === 6 + 20, '17. pertes internes connues → ajoutées (6+20=26)');
  const rAbs = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) }, terminaux: { extraction: { valeur: 0 } } });
  A(res(rAbs, 'extraction').pertesNecessaires.valeur === 6 && r_has(rAbs, 'pertes_internes_centrale_non_documentees'), '18. pertes internes absentes → non ajoutées (pas de 0 caché) + signalé');
}
function r_has(r, frag) { return r.donneesManquantes.some(d => d.champ.indexOf(frag) === 0); }

// ---- 19/20. Pertes terminal connues vs absentes ---------------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const rT = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 15, debitReference: 30, source: 'C', version: 'v', provenance: 'constructeur' } } });
  A(res(rT, 'extraction').pertesNecessaires.valeur === 6 + 15, '19. perte terminal connue → ajoutée (6+15=21)');
  const rNo = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) }, composants: { extraction: [] } });
  A(res(rNo, 'extraction').pertesNecessaires.valeur === 6 && r_has(rNo, 'pertes_terminaux_non_documentees'), '20. perte terminal absente → non inventée + signalée');
}

// ---- 21/22. Chemin défavorable disponible vs réseau physique absent --------------
{
  const drRamifie = { type: 'extraction', troncons: [
    { role: 'antenne', pieceRef: 'sdb#1', longueur: 8, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] },
    { role: 'antenne', pieceRef: 'wc#1', longueur: 2, diametre: 125, typeConduit: 'souple', debit: 15, singularites: [] },
    { role: 'collecteur', longueur: 4, diametre: 160, typeConduit: 'souple', singularites: [] }
  ] };
  const pe = preEtude([P('sdb', 1), P('wc', 1)], 'simple_flux', [drRamifie]);
  const r = VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 45) }, composants: { extraction: [] }, terminaux: { extraction: { valeur: 0 } } });
  A(res(r, 'extraction').cheminDefavorise && res(r, 'extraction').cheminDefavorise.destination === 'sdb#1', '21. chemin défavorable exploité (sdb#1)');
  const peSansGeo = VMC.preEtudeVmc([P('sdb', 1)], CTX({ solution: 'simple_flux' }), { referentielPertes: REF });
  const r2 = VMC.analysePressionVmc([], {}, peSansGeo, { pressionDisponible: { extraction: DISPO(180, 30) } });
  A(res(r2, 'extraction').cheminDefavorise === null && r2.donneesManquantes.some(d => d.champ === 'chemin_physique_non_decrit'), '22. réseau physique absent → chemin_physique_non_decrit');
}

// ---- 23. Existant vs projeté : base signalée -------------------------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  A(res(VMC.analysePressionVmc([], {}, pe, { pressionDisponible: { extraction: DISPO(180, 30) } }), 'extraction').base === 'projete', '23. analyse sur réseau projeté (base signalée)');
}

// ---- 24/25/26/27/28. Aucune invention / conformité / sélection -------------------
{
  const pe = preEtude([P('sdb', 1)], 'simple_flux', [drExtraction]);
  const r = VMC.analysePressionVmc([], {}, pe, {});
  A(res(r, 'extraction').pertesNecessaires.detail.composants === null && res(r, 'extraction').pertesNecessaires.detail.terminaux === null, '24. aucun 0 inventé (composants/terminaux null)');
  A(res(r, 'extraction').pressionDisponible === null, '25. aucune pression inventée');
  A(!/marge (suffisante|de securite)|conforme/i.test(JSON.stringify(r)), '26/27. aucune marge arbitraire / « conforme »');
  A(!/marque|modele|reference_fournisseur|caisson_selectionne|prix/i.test(JSON.stringify(r)), '28. aucune sélection produit');
}

// ---- 29/30/31. piece.config / non-mutation / déterminisme ------------------------
{
  const pieces = [P('sdb', 1)];
  const pe = preEtude(pieces, 'simple_flux', [drExtraction]);
  const dt = { pressionDisponible: { extraction: DISPO(180, 30) } };
  const snap = JSON.stringify({ pieces, pe, dt });
  const r1 = VMC.analysePressionVmc(pieces, {}, pe, dt);
  const r2 = VMC.analysePressionVmc(pieces, {}, pe, dt);
  A(JSON.stringify({ pieces, pe, dt }) === snap, '30. entrées non mutées');
  A(JSON.stringify(r1) === JSON.stringify(r2), '31. déterministe');
  A(!('config' in pieces[0]), '29. aucune création piece.config');
}

// ---- 32. Aucun money-path / Runtime / catalogue (statique) -----------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const _s0 = SRC.indexOf('function analysePressionVmc(');
const BLOC = SRC.slice(_s0);
A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal/.test(BLOC), '32. aucun money-path/Runtime/catalogue');

const total = ok + ko;
if (ko === 0) console.log('✅ Analyse pression VMC (M57 LOT17-A) : ' + ok + '/' + total + ' — dispo vs nécessaire, marge tracée, DF séparés, aucune invention');
else { console.error('❌ Analyse pression VMC LOT17-A : ' + ok + '/' + total); process.exit(1); }
