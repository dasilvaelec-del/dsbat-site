// =====================================================================
// tests/vmc-visite-lot18.test.js — M57 LOT18 : modèle de visite technique VMC
// =====================================================================
// Constructeurs/validateurs purs + normalisation donneesVisite → donneesReseau (LOT15-B).
// Aucun calcul, aucune invention, statut≠provenance, réel≠projeté, contradictions conservées.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE, PR = V.PROVENANCE_VISITE;
const cv = (valeur, statut, prov) => V.creerChampValeur({ valeur, unite: 'm', statut, provenance: prov });

A(typeof V.creerDonneesVisite === 'function' && typeof V.normaliserVisiteVersReseau === 'function', '0. LOT18 exporté');

// ---- 1. Installation -------------------------------------------------------------
{
  const i = V.creerInstallationVisite({ id: 'I1', typeSysteme: 'double_flux', statutInstallation: 'existante', dateVisite: '2024-05-01', intervenant: 'T', niveauCompletude: 'partiel' });
  A(i.typeSysteme === 'double_flux' && i.niveauCompletude === 'partiel', '1. installation');
}

// ---- 2/3/4. Réseaux extraction / insufflation séparés (DF) -----------------------
{
  const dv = V.creerDonneesVisite({ reseaux: [{ id: 'RE', type: 'extraction' }, { id: 'RI', type: 'insufflation' }] });
  A(dv.reseaux[0].type === 'extraction' && dv.reseaux[1].type === 'insufflation', '2/3. réseaux extraction + insufflation');
  A(dv.reseaux[0] !== dv.reseaux[1], '4. DF : deux réseaux séparés');
  A(V.creerReseauVisite({ type: 'admission' }).type === null, '4bis. type inconnu → null (pas de faux réseau)');
}

// ---- 5/6. Nœud + connexion amont/aval -------------------------------------------
{
  const t = V.creerTronconVisite({ id: 'T1', noeudAmont: 'N1', noeudAval: 'N2', longueur: cv(5, S.MESURE) });
  A(t.noeudAmont === 'N1' && t.noeudAval === 'N2', '6. connexion amont/aval');
  A(V.creerNoeudVisite({ id: 'N1', type: 'collecteur' }).type === 'collecteur', '5. nœud');
}

// ---- 7-17. Tronçon : longueurs (mesurée/estimée/inconnue), Ø réel/projeté, etc. ---
{
  const t = V.creerTronconVisite({
    id: 'T', longueur: cv(5.2, S.MESURE, PR.TECHNICIEN),
    diametre: V.creerChampValeur({ valeur: 125, unite: 'mm', statut: S.MESURE, nature: V.NATURE_VISITE.EXISTANT_RELEVE }),
    diametreProjet: V.creerChampValeur({ valeur: 160, unite: 'mm', statut: S.DOCUMENTE, nature: V.NATURE_VISITE.PROJETE }),
    section: V.creerChampValeur({ valeur: 0.012, statut: S.MESURE }),
    sectionProjet: V.creerChampValeur({ valeur: 0.02, statut: V.NATURE_VISITE.THEORIQUE_DSBAT }),
    typeConduit: 'rigide', etat: 'bon', sensFlux: 'vers_centrale'
  });
  A(t.longueur.valeur === 5.2 && t.longueur.statut === 'mesure', '8. longueur mesurée');
  A(V.creerTronconVisite({ longueur: cv(4, S.ESTIME) }).longueur.statut === 'estime', '9. longueur estimée');
  A(V.creerTronconVisite({}).longueur.statut === 'inconnu' && V.creerTronconVisite({}).longueur.valeur === null, '10. longueur inconnue (statut, pas 0)');
  A(t.diametre.valeur === 125 && t.diametreProjet.valeur === 160 && t.diametre.valeur !== t.diametreProjet.valeur, '11/12. Ø réel (125) ≠ Ø projeté (160), non écrasés');
  A(t.section.valeur === 0.012 && t.sectionProjet.valeur === 0.02, '13/14. section réelle ≠ section théorique');
  A(t.typeConduit === 'rigide' && t.etat === 'bon', '15/16. type conduit + état');
  A(t.sensFlux === 'vers_centrale', '17. sens flux');
}

// ---- 18/19. Singularité (avec / sans géométrie) ---------------------------------
{
  const s = V.creerSingulariteVisite({ id: 'S1', type: 'coude', tronconId: 'T', geometrie: '90deg', quantite: 2, provenance: PR.TECHNICIEN });
  A(s.type === 'coude' && s.geometrie === '90deg', '18. singularité avec géométrie');
  A(V.creerSingulariteVisite({ type: 'te', tronconId: 'T' }).geometrie === 'inconnu', '19. singularité sans géométrie → inconnu (pas inventé)');
}

// ---- 20/21/22/23. Terminal / centrale / prise air neuf / rejet -------------------
{
  A(V.creerTerminalVisite({ id: 'TM', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', etat: 'bon' }).pieceRef === 'sdb#1', '20. terminal');
  A(V.creerTerminalVisite({}).reference === null, '20bis. référence non observée → null (pas déduite)');
  A(V.creerCentraleVisite({ id: 'C', fabricant: 'ACME', reference: 'G1', emplacement: 'combles' }).reference === 'G1', '21. centrale');
  A(V.creerInterfaceVisite({ id: 'PA', type: 'prise_air_neuf', emplacement: 'facade' }).type === 'prise_air_neuf', '22. prise air neuf (interface)');
  A(V.creerInterfaceVisite({ id: 'RJ', type: 'rejet', emplacement: 'toiture' }).type === 'rejet', '23. rejet (interface)');
}

// ---- 24/25/26/27. Mesures : débit / pression / provenance / mesure vs déclaratif -
{
  const md = V.creerMesureVisite({ id: 'M1', grandeur: 'debit', valeur: 28, unite: 'm3/h', instrument: 'anemo', referenceInstrument: 'AN-5', operateur: 'T' });
  A(md.grandeur === 'debit' && md.statut === 'mesure' && md.provenance === 'mesure_instrumentee', '24/26. mesure débit instrumentée');
  const mp = V.creerMesureVisite({ id: 'M2', grandeur: 'pression', valeur: 50, unite: 'Pa', instrument: 'micromano' });
  A(mp.grandeur === 'pression' && mp.statut === 'mesure', '25. mesure pression');
  const decl = V.creerMesureVisite({ id: 'M3', grandeur: 'debit', valeur: 30, unite: 'm3/h' }); // sans instrument
  A(decl.statut === 'releve_declaratif' && decl.provenance === 'technicien', '27. valeur sans instrument → releve_declaratif (jamais mesure instrumentée)');
}

// ---- 28. Hypothèse séparée des mesures -------------------------------------------
{
  const h = V.creerHypotheseVisite({ id: 'H1', objetId: 'T', description: 'longueur estimée', valeur: 6 });
  A(h.provenance === 'hypothese' && h.statut === 'a_verifier', '28. hypothèse ≠ mesure (provenance hypothese)');
}

// ---- 29/30/31. Inaccessible / non mesuré / non applicable → jamais 0 -------------
{
  const t = V.creerTronconVisite({ longueur: V.creerChampValeur({ statut: S.NON_ACCESSIBLE }), diametre: V.creerChampValeur({ statut: S.NON_MESURE }), section: V.creerChampValeur({ statut: S.NON_APPLICABLE }) });
  A(t.longueur.statut === 'non_accessible' && t.longueur.valeur === null, '29. inaccessible → valeur null (pas 0)');
  A(t.diametre.statut === 'non_mesure' && t.diametre.valeur === null, '30. non mesuré → null');
  A(t.section.statut === 'non_applicable', '31. non applicable');
  const norm = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [t] }] });
  A(norm.donneesReseau.reseaux[0].troncons[0].longueur === null && norm.donneesManquantes.some(d => /longueur/.test(d.champ)), '29/30. normalisation : inaccessible/non mesuré → null + signalé (jamais 0)');
}

// ---- 32/33. Contradiction conservée + provenance --------------------------------
{
  const diam = V.creerChampObserve(
    [{ valeur: 125, unite: 'mm', statut: S.RELEVE_DECLARATIF, provenance: PR.CLIENT }, { valeur: 100, unite: 'mm', statut: S.MESURE, provenance: PR.TECHNICIEN }],
    null
  );
  A(diam.observations.length === 2 && diam.observations[0].provenance === 'client' && diam.observations[1].provenance === 'technicien', '32/33. deux observations contradictoires conservées + provenance');
  // sans référence → normalisation ne tranche pas silencieusement
  const norm = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [V.creerTronconVisite({ id: 'T', longueur: cv(4, S.MESURE), diametre: diam })] }] });
  A(norm.donneesReseau.reseaux[0].troncons[0].diametre === null && norm.incoherences.some(i => i.type === 'valeurs_contradictoires_non_arbitrees'), '32. contradiction non arbitrée → null + incohérence signalée (pas de choix silencieux)');
  // avec référence tracée → valeur de référence retenue
  const diamRef = V.creerChampObserve(diam.observations, { valeur: 100, unite: 'mm', statut: S.MESURE, choisiePar: 'technicien', raison: 'mesuré sur site' });
  const norm2 = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [V.creerTronconVisite({ id: 'T', longueur: cv(4, S.MESURE), diametre: diamRef })] }] });
  A(norm2.donneesReseau.reseaux[0].troncons[0].diametre === 100, '32. référence tracée (choisiePar/raison) → valeur retenue');
}

// ---- 34. Photo rattachée ---------------------------------------------------------
{
  const p = V.creerPhotoRef({ id: 'P1', objetType: 'troncon', objetId: 'T1', provenance: PR.TECHNICIEN, date: '2024-05-01' });
  A(p.objetType === 'troncon' && p.objetId === 'T1', '34. photo rattachée à un objet');
}

// ---- 35/36. Normalisation vers donneesReseau + compatibilité LOT15-B/16 ----------
{
  const dv = V.creerDonneesVisite({
    installation: { typeSysteme: 'simple_flux' },
    reseaux: [{ type: 'extraction', troncons: [
      V.creerTronconVisite({ id: 'A1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(4, S.MESURE), diametre: V.creerChampValeur({ valeur: 125, statut: S.MESURE }), typeConduit: 'souple', debit: V.creerChampValeur({ valeur: 30, statut: S.MESURE }) }),
      V.creerTronconVisite({ id: 'C1', role: 'collecteur', longueur: cv(4, S.MESURE), diametre: V.creerChampValeur({ valeur: 160, statut: S.MESURE }), typeConduit: 'souple' })
    ] }]
  });
  const norm = V.normaliserVisiteVersReseau(dv);
  A(Array.isArray(norm.donneesReseau.reseaux) && norm.donneesReseau.reseaux[0].type === 'extraction', '35. normalisation → donneesReseau');
  // pipeline complet : LOT16 consomme via adapter + référentiel
  const REF = V.creerReferentielPertes({ id: 'R', methode: 'm', source: 'F', version: 't', provenance: V.PROVENANCE_VMC.TEST, dateValidation: 'd', masseVolumiqueAir: { valeur: 1.2 }, lineaire: { souple: { 125: 1.0, 160: 0.5 } }, singulier: {} });
  const pe = V.preEtudeVmc([{ id: 'sdb', numero: 1 }], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, { donneesReseau: norm.donneesReseau, referentielPertes: REF });
  A(pe.pertes.reseaux[0].statut === 'calcule', '36. compatibilité LOT15-B/16 : pertes calculables depuis la visite normalisée');
}

// ---- 37. Absence d'invention (normalisation vide) --------------------------------
{
  const norm = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [V.creerTronconVisite({ id: 'X', role: 'antenne' })] }] });
  const t = norm.donneesReseau.reseaux[0].troncons[0];
  A(t.longueur === null && t.diametre === null, '37. données absentes → null (aucune invention)');
}

// ---- 38/39. Non-mutation + déterminisme -----------------------------------------
{
  const spec = { reseaux: [{ type: 'extraction', troncons: [{ id: 'T', longueur: { valeur: 4, statut: 'mesure' } }] }] };
  const snap = JSON.stringify(spec);
  const a = V.creerDonneesVisite(spec), b = V.creerDonneesVisite(spec);
  A(JSON.stringify(spec) === snap, '38. spec non mutée');
  A(JSON.stringify(a) === JSON.stringify(b), '39. déterministe');
}

// ---- 40/41/42. Aucun money-path / Runtime / pricing (statique) -------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
['function creerDonneesVisite(', 'function normaliserVisiteVersReseau(', 'function creerTronconVisite(', 'function creerMesureVisite('].forEach(sig => {
  const s0 = SRC.indexOf(sig); const rest = SRC.slice(s0); const s1 = rest.indexOf('\nfunction ', 1);
  const bloc = s1 > 0 ? rest.slice(0, s1) : rest;
  A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal|perteDeCharge|pression|coefficient/i.test(bloc), '40/41/42. ' + sig.slice(9, 30) + '… : aucun money-path/Runtime/calcul');
});

const total = ok + ko;
if (ko === 0) console.log('✅ Visite technique VMC (M57 LOT18) : ' + ok + '/' + total + ' — modèle terrain pur, réel≠projeté, contradictions conservées, aucune invention');
else { console.error('❌ Visite technique VMC LOT18 : ' + ok + '/' + total); process.exit(1); }
