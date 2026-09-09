// =====================================================================
// tests/vmc-reseau-referentiel-lot15b.test.js — M57 LOT15-B
// =====================================================================
// Contrat de données : creerDonneesReseau / validerDonneesReseau /
// adapterDonneesReseauPourPertes / creerReferentielPertes / validerReferentielPertes /
// PROVENANCE_VMC / champsReleveVisite. Modèle PUR, aucune valeur inventée, aucun défaut,
// transmission jusqu'à LOT15-A/LOT16, hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const approx = (a, b, e) => a != null && Math.abs(a - b) <= (e || 0.01);

// Référentiel FIXTURE (contrat versionné, provenance test) — valeurs sans prétention normative.
const REF = VMC.creerReferentielPertes({
  id: 'REF_TEST', methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0',
  provenance: VMC.PROVENANCE_VMC.TEST, dateValidation: '2024-01-01',
  masseVolumiqueAir: { valeur: 1.2, source: 'FIXTURE_TEST', version: 'test-0' },
  lineaire: { souple: { 125: 1.0, 160: 0.5 } },
  singulier: { coude: { '90deg': { coefficient: 0.4, source: 'FIXTURE_TEST', version: 'test-0' } } }
});

A(typeof VMC.creerDonneesReseau === 'function' && typeof VMC.creerReferentielPertes === 'function', '0. contrat LOT15-B exporté');

// ---- 1/2/3. Structures réseau extraction/insufflation, DF séparés ----------------
{
  const dr = VMC.creerDonneesReseau({ reseaux: [
    { type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }] },
    { type: 'insufflation', troncons: [{ role: 'antenne', pieceRef: 'chambre#1', longueur: 3, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }] }
  ] });
  A(dr.reseaux.length === 2 && dr.reseaux[0].type === 'extraction' && dr.reseaux[1].type === 'insufflation', '1/2. réseaux extraction + insufflation valides');
  A(dr.reseaux[0] !== dr.reseaux[1], '3. DF : deux réseaux séparés');
  // type invalide ignoré (jamais deviné)
  A(VMC.creerDonneesReseau({ reseaux: [{ type: 'admission' }] }).reseaux.length === 0, '3bis. type non {extraction,insufflation} → ignoré');
}

// ---- 4/5/6/7. Tronçon longueur/diamètre/section + singularité géométrie ----------
{
  const dr = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [
    { role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, section: 0.0123, typeConduit: 'rigide', debit: 30,
      singularites: [{ type: 'coude', quantite: 2, geometrie: '90deg', reference: 'C90' }] }
  ] }] });
  const t = dr.reseaux[0].troncons[0];
  A(t.longueur === 4 && t.uniteLongueur === 'm', '4. tronçon longueur (m)');
  A(t.diametre === 125, '5. diamètre relevé');
  A(t.section === 0.0123, '6. section relevée');
  A(t.singularites[0].geometrie === '90deg' && t.singularites[0].quantite === 2, '7. singularité géométrie + quantité');
}

// ---- 8/9/10/11. Terminal, centrale, prise d'air neuf, rejet ----------------------
{
  const dr = VMC.creerDonneesReseau({
    reseaux: [{ type: 'extraction', troncons: [], terminaux: [{ id: 'T1', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', reference: 'BEP', provenance: VMC.PROVENANCE_VMC.CONSTRUCTEUR }] }],
    centrale: { type: 'DF', reference: 'GRP-X', provenance: VMC.PROVENANCE_VMC.CONSTRUCTEUR },
    priseAirNeuf: { type: 'direct', reference: 'PA1', provenance: VMC.PROVENANCE_VMC.VISITE },
    rejet: { type: 'toiture', reference: 'RJ1', provenance: VMC.PROVENANCE_VMC.VISITE }
  });
  A(dr.reseaux[0].terminaux[0].pieceRef === 'sdb#1', '8. terminal avec pieceRef');
  A(dr.centrale.reference === 'GRP-X', '9. centrale avec référence constructeur');
  A(dr.priseAirNeuf.type === 'direct' && dr.rejet.type === 'toiture', '10/11. prise d\'air neuf + rejet');
}

// ---- 12/13/14/15. Provenance : visite/constructeur/référentiel + fixture test ----
{
  A(VMC.PROVENANCE_VMC.VISITE === 'visite' && VMC.PROVENANCE_VMC.CONSTRUCTEUR === 'constructeur' && VMC.PROVENANCE_VMC.REFERENTIEL === 'referentiel', '12/13/14. catégories de provenance');
  A(REF.provenance === 'test', '15. référentiel fixture identifiable (provenance test)');
  A(VMC.validerReferentielPertes(REF).provenanceProduction === false, '15. fixture test ≠ source de production');
}

// ---- 16/17. Donnée manquante signalée + aucune valeur par défaut -----------------
{
  const dr = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] /* longueur absente */ }] }] });
  A(dr.reseaux[0].troncons[0].longueur === null, '17. longueur absente → null (aucune valeur par défaut)');
  const v = VMC.validerDonneesReseau(dr);
  A(!v.valide && v.donneesManquantes.some(d => /longueur/.test(d.champ)), '16. donnée manquante explicitement signalée');
}

// ---- 18. Référentiel versionné ---------------------------------------------------
{
  A(REF.id === 'REF_TEST' && REF.version === 'test-0' && REF.source === 'FIXTURE_TEST' && REF.dateValidation === '2024-01-01', '18. référentiel versionné/sourcé/daté');
  A(REF.masseVolumiqueAir.valeur === 1.2 && REF.masseVolumiqueAir.unite === 'kg/m3', '18. masse volumique contractualisée');
}

// ---- 19. Référentiel sans coefficient → pas d'invention --------------------------
{
  const vide = VMC.creerReferentielPertes({ id: 'R2', methode: 'm', source: 's', version: 'v', dateValidation: 'd', masseVolumiqueAir: { valeur: 1.2 } });
  A(Object.keys(vide.lineaire).length === 0 && Object.keys(vide.singulier).length === 0, '19. référentiel sans coefficient → structures vides (rien inventé)');
  A(VMC.validerReferentielPertes(vide).manques.some(m => m.champ === 'coefficients_pertes'), '19. absence de coefficients signalée');
  // pertesDeChargeVmc avec référentiel sans coefficient → incomplet, aucune perte inventée
  const dr = VMC.adapterDonneesReseauPourPertes(VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }] }] }));
  const r = VMC.pertesDeChargeVmc([], {}, { systeme: 'simple_flux', reseaux: [{ type: 'extraction' }] }, dr, vide);
  A(r.reseaux[0].pertesLineaires === null && r.statut === 'incomplet', '19. sans coefficient → perte non calculée');
}

// ---- 20. Domaine d'application respecté (diamètre non déclaré → pas de valeur) ----
{
  const dr = VMC.adapterDonneesReseauPourPertes(VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 200 /* non dans REF */, typeConduit: 'souple', debit: 30, singularites: [] }] }] }));
  const r = VMC.pertesDeChargeVmc([], {}, { systeme: 'simple_flux', reseaux: [{ type: 'extraction' }] }, dr, REF);
  A(r.reseaux[0].troncons[0].pertesLineaires == null, '20. R non déclaré pour ce diamètre → non appliqué');
}

// ---- 21. SF : aucun faux réseau d'admission -------------------------------------
{
  const dr = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [] }] });
  A(!dr.reseaux.some(r => r.type === 'admission' || r.type === 'admission_passive'), '21. aucun réseau mécanique d\'admission créé');
}

// ---- 22/23. DF extraction/insufflation séparés + existant vs projeté ------------
{
  const dr = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', diametre: 125, diametreProjet: 160, longueur: 4, typeConduit: 'souple', debit: 30 }] }] });
  const t = dr.reseaux[0].troncons[0];
  A(t.diametre === 125 && t.diametreProjet === 160, '23. relevé (125) et projeté (160) distincts, non écrasés');
  const ad = VMC.adapterDonneesReseauPourPertes(VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [] }, { type: 'insufflation', troncons: [] }] }));
  A(ad.extraction && ad.insufflation && ad.extraction !== ad.insufflation, '22. adapter : extraction/insufflation séparés');
}

// ---- 24. Transmission donneesReseau (adaptée) → LOT15-A calcule ------------------
{
  const rich = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [
    { role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [{ type: 'coude', quantite: 2, geometrie: '90deg' }] },
    { role: 'collecteur', longueur: 6, diametre: 160, typeConduit: 'souple', singularites: [] }
  ] }] });
  const dr = VMC.adapterDonneesReseauPourPertes(rich);
  const r = VMC.pertesDeChargeVmc([], {}, { systeme: 'simple_flux', reseaux: [{ type: 'extraction' }] }, dr, REF);
  // linéaire = antenne(1.0×4=4) + collecteur(0.5×6=3) = 7 ; singulier antenne = 2 coudes × 0.4 × ½ρV²
  A(approx(r.reseaux[0].pertesLineaires, 7), '24. transmission → linéaires calculées (7 Pa)');
  A(r.reseaux[0].troncons.find(t => t.role === 'antenne').pertesSingulieres > 0, '24. singularités dépliées (quantité) calculées');
}

// ---- 25. Transmission via LOT16 (contrat riche auto-adapté) ----------------------
{
  const rich = VMC.creerDonneesReseau({ reseaux: [{ type: 'extraction', troncons: [
    { role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] },
    { role: 'collecteur', longueur: 2, diametre: 160, typeConduit: 'souple', singularites: [] }
  ] }] });
  const P = (id, n) => ({ id, numero: n });
  const r = VMC.preEtudeVmc([P('sdb', 1)], { intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4, solution: 'simple_flux' }, { donneesReseau: rich, referentielPertes: REF });
  A(r.pertes.reseaux[0].statut === 'calcule' && r.statutEtude === 'etude_calculable', '25. LOT16 adapte le contrat riche → pertes calculables');
}

// ---- 26/27. Non-mutation + déterminisme ------------------------------------------
{
  const spec = { reseaux: [{ type: 'extraction', troncons: [{ role: 'antenne', pieceRef: 'sdb#1', longueur: 4, diametre: 125, typeConduit: 'souple', debit: 30, singularites: [] }] }] };
  const snap = JSON.stringify(spec);
  const a = VMC.creerDonneesReseau(spec), b = VMC.creerDonneesReseau(spec);
  A(JSON.stringify(spec) === snap, '26. spec non mutée');
  A(JSON.stringify(a) === JSON.stringify(b), '27. déterministe');
}

// ---- 28/29. Aucun money-path / config / catalogue (statique) --------------------
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
['function creerDonneesReseau(', 'function adapterDonneesReseauPourPertes(', 'function creerReferentielPertes(', 'function validerReferentielPertes(', 'function champsReleveVisite('].forEach(sig => {
  const s0 = SRC.indexOf(sig); const rest = SRC.slice(s0);
  const s1 = rest.indexOf('\nfunction ', 1); const bloc = s1 > 0 ? rest.slice(0, s1) : rest;
  A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal/.test(bloc), '28/29. ' + sig.slice(9, 30) + '… : aucun money-path/config/catalogue');
});

// ---- champsReleveVisite -----------------------------------------------------------
{
  A(VMC.champsReleveVisite('simple_flux').includes('longueurs_troncons') && !VMC.champsReleveVisite('simple_flux').includes('elements_specifiques_df'), 'champsReleveVisite SF');
  A(VMC.champsReleveVisite('double_flux').includes('elements_specifiques_df'), 'champsReleveVisite DF : éléments spécifiques');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Données réseau + référentiel VMC (M57 LOT15-B) : ' + ok + '/' + total + ' — contrat pur, aucune valeur inventée, transmission LOT15-A/LOT16');
else { console.error('❌ Données réseau + référentiel VMC LOT15-B : ' + ok + '/' + total); process.exit(1); }
