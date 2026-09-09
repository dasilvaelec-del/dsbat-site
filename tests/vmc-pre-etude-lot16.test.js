// =====================================================================
// tests/vmc-pre-etude-lot16.test.js — M57 LOT16 : orchestrateur pré-étude VMC
// =====================================================================
// preEtudeVmc(pieces, contexte, options?) : enchaîne L10→L15 et agrège. Ne duplique aucune
// règle. Statuts sans « conforme »/« dimensionné ». Chemins seulement si réellement
// calculables. DF réseaux séparés. Hors money-path, aucune invention.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const P = (id, numero, dims, extra) => Object.assign({ id: id, numero: numero, dims: dims }, extra || {});
const CTX = (extra) => Object.assign({ intention: 'creer', perimetre: 'complet', nbPiecesPrincipales: 4 }, extra || {});

// Référentiel FIXTURE (provenance test) — cf. LOT15-A.
const REF = { methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test',
  masseVolumiqueAir: 1.2, lineaire: { souple: { 125: 1.0, 160: 0.5 } }, singulier: {} };

A(typeof VMC.preEtudeVmc === 'function', '0. preEtudeVmc exporté');

// ---- 1. SF calculable en amont (sans données réseau → sous hypothèses) -----------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1), P('sdb', 1), P('chambre', 1)], CTX({ solution: 'simple_flux' }));
  A(r.systeme === 'simple_flux', '1. systeme SF');
  A(r.synthese.debitExtraction === 120 + 30, '1. synthèse débit extraction (150)');
  A(r.statutEtude === 'etude_sous_hypotheses' && typeof r.raisonStatut === 'string', '1. statut sous hypothèses + raison');
  A(r.sections.reseaux.length >= 1 && r.besoin && r.debits && r.topologie && r.preDimensionnement, '1. toutes les couches présentes');
}

// ---- 2. SF sans référentiel pertes → étude partielle en aval, amont conservé -----
{
  const r = VMC.preEtudeVmc([P('cuisine', 1)], CTX({ solution: 'simple_flux' })); // pas d'options
  A(r.pertes.statut === 'incomplet', '2. pertes incomplètes sans référentiel');
  A(r.synthese.debitExtraction === 120 && r.sections.reseaux.length === 1, '2. amont (débits/sections) conservé');
  A(r.statutEtude !== 'etude_calculable', '2. statut non « calculable »');
  A(r.donneesManquantes.some(d => d.champ === 'referentiel_pertes'), '2. référentiel signalé manquant');
}

// ---- 3. SF avec pertes partielles (référentiel + géométrie incomplète) -----------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, /* longueur manquante */ diametre: 125, conduit: 'souple', singularites: [] }] } };
  const r = VMC.preEtudeVmc([P('sdb', 1)], CTX({ solution: 'simple_flux' }), { donneesReseau: dr, referentielPertes: REF });
  A(r.pertes.reseaux[0].statut === 'incomplet' && r.statutEtude === 'etude_sous_hypotheses', '3. pertes partielles → sous hypothèses');
  A(r.chemins.favorise.length === 0, '3. aucun chemin fabriqué (perte non calculable)');
}

// ---- 4/5. DF : deux réseaux + hypothèse d'équilibrage ----------------------------
{
  const r = VMC.preEtudeVmc([P('sdb', 1), P('chambre', 1)], CTX({ solution: 'double_flux' }));
  A(r.sections.reseaux.some(x => x.type === 'extraction') && r.sections.reseaux.some(x => x.type === 'insufflation'), '4. DF : deux réseaux distincts');
  A(r.synthese.debitExtraction === 30 && r.synthese.debitInsufflation === 30, '5. DF : insufflation = cible d\'équilibrage (30)');
  A(r.hypotheses.some(h => h.clef === 'equilibrage_df' && h.origine === 'regle_pro'), '5. hypothèse d\'équilibrage explicite (regle_pro)');
  A(!/perteTotaleGlobale|reseauFusionne/.test(JSON.stringify(r.synthese)), '4. DF : pertes jamais fusionnées');
}

// ---- 6. Solution inconnue --------------------------------------------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1), P('chambre', 1)], CTX({ solution: 'inconnue' }));
  A(r.systeme === 'inconnue' && r.indetermine === true && r.statutEtude === 'etude_indeterminee', '6. inconnue → étude_indeterminee');
  A(!/simple_flux|"SF"|"DF"/.test(JSON.stringify(r.synthese)), '6. inconnue → aucun système inventé');
}

// ---- 7. Pièce hors scope exclue --------------------------------------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1), P('sdb', 2, undefined, { enScope: false })], CTX({ solution: 'simple_flux' }));
  A(!JSON.stringify(r.besoin.pieces).includes('sdb#2'), '7. pièce hors scope exclue');
}

// ---- 8. Absence de fonction retenue (conserver) → partielle ----------------------
{
  const r = VMC.preEtudeVmc([P('sdb', 1)], CTX({ solution: 'simple_flux', intention: 'conserver' }));
  A(r.statutEtude === 'etude_partielle' && /aucun réseau/i.test(r.raisonStatut), '8. aucune fonction retenue → étude_partielle (raison)');
}

// ---- 9. Dimensions manquantes → signalées (volumes) ------------------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1, { l: 3, la: 4 /* h manquant */ })], CTX({ solution: 'simple_flux' }));
  A(r.preDimensionnement.volumes.parPiece['cuisine#1'] === null && r.donneesManquantes.some(d => /dimensions_piece/.test(d.champ)), '9. dimension manquante → volume null + signalé');
}

// ---- 10/11. Données physiques absentes → chemin non décrit -----------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1)], CTX({ solution: 'simple_flux' }), { referentielPertes: REF }); // pas de donneesReseau
  A(r.chemins.favorise.length === 0 && r.chemins.defavorise.length === 0, '10. pas de géométrie → aucun chemin');
  A(r.donneesManquantes.some(d => d.champ === 'chemin_physique_non_decrit'), '11. chemin_physique_non_decrit signalé');
}

// ---- 12. Pertes calculables sur un chemin explicite → favorable/défavorable ------
{
  const dr = { extraction: {
    antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 8, diametre: 125, conduit: 'souple', singularites: [] },
               { pieceRef: 'wc#1', debit: 15, longueur: 2, diametre: 125, conduit: 'souple', singularites: [] }],
    collecteur: { longueur: 4, diametre: 160, conduit: 'souple', singularites: [] }
  } };
  const r = VMC.preEtudeVmc([P('sdb', 1), P('wc', 1)], CTX({ solution: 'simple_flux' }), { donneesReseau: dr, referentielPertes: REF });
  A(r.chemins.favorise.length === 1 && r.chemins.defavorise.length === 1, '12. chemins favorable/défavorable identifiés');
  // sdb#1 (8×1=8 + collecteur 4×0.5=2 = 10) défavorable ; wc#1 (2+2=4) favorable
  A(r.chemins.defavorise[0].destination === 'sdb#1' && r.chemins.favorise[0].destination === 'wc#1', '12. favorable=wc#1, défavorable=sdb#1 (selon perte)');
  A(r.statutEtude === 'etude_calculable', '12. statut = etude_calculable');
}

// ---- 13. Absence caractéristiques terminal --------------------------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1)], CTX({ solution: 'simple_flux' }));
  A(r.donneesManquantes.some(d => d.champ === 'caracteristiques_aerauliques_terminaux'), '13. caractéristiques terminaux signalées manquantes');
}

// ---- 14/15/16. Aucune fabrication diamètre/pression/marge ------------------------
{
  const r = VMC.preEtudeVmc([P('cuisine', 1)], CTX({ solution: 'simple_flux' }));
  A(!/diametreRetenu|diametreCommercial|diametreRequis/.test(JSON.stringify(r)), '14. aucun diamètre commercial/retenu');
  A(r.synthese.pressionNecessaireCalculable === false, '15. pression non calculable → false (pas de pression fabriquée)');
  A(!/marge|pressionDisponible/.test(JSON.stringify(r.synthese)) && !/\bconforme\b/i.test(JSON.stringify(r)), '16. aucune marge/pression dispo/« conforme »');
}

// ---- 17/18. Money-path + non-mutation + déterminisme ----------------------------
{
  const pieces = [P('cuisine', 1, { l: 3, la: 4, h: 2.5 }), P('chambre', 1)];
  const c = CTX({ solution: 'double_flux' });
  const snap = JSON.stringify({ pieces, c });
  const r1 = VMC.preEtudeVmc(pieces, c);
  const r2 = VMC.preEtudeVmc(pieces, c);
  A(JSON.stringify({ pieces, c }) === snap, '17. entrées non mutées');
  A(JSON.stringify(r1) === JSON.stringify(r2), '18. déterministe');
  A(!('config' in pieces[0]), '17. aucune création piece.config');
}
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function preEtudeVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal/.test(BLOC), '17. aucun money-path/config/catalogue dans l\'orchestrateur');

const total = ok + ko;
if (ko === 0) console.log('✅ Pré-étude VMC (M57 LOT16) : ' + ok + '/' + total + ' — orchestrateur pur, statuts tracés, chemins si calculables, hors money-path');
else { console.error('❌ Pré-étude VMC LOT16 : ' + ok + '/' + total); process.exit(1); }
