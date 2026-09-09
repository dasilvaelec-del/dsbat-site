// =====================================================================
// tests/vmc-pertes-charge-lot15a.test.js — M57 LOT15-A
// =====================================================================
// pertesDeChargeVmc(...) : ÉVALUATEUR PUR. Aucun coefficient dans le moteur : tout vient
// d'un referentielPertes fourni + d'une géométrie fournie (donneesReseau). Sans l'un ou
// l'autre → 'incomplet' (aucune valeur inventée). DF = deux réseaux séparés.
//
// NB PROVENANCE : le référentiel ci-dessous est une FIXTURE DE TEST (source 'FIXTURE_TEST',
// version 'test-0') — ses valeurs n'ont AUCUNE prétention normative ; elles servent
// uniquement à vérifier l'ARITHMÉTIQUE de l'évaluateur (R×L, ζ·½ρV²).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const approx = (a, b, e) => a != null && Math.abs(a - b) <= (e || 0.01);

// ---- Référentiel FIXTURE (provenance explicitement de test) ----------------------
const REF = {
  methode: 'table_lineaire_pa_par_m', source: 'FIXTURE_TEST', version: 'test-0', provenance: 'test',
  masseVolumiqueAir: 1.2, // kg/m³ — fixture test (constante physique, provenance test)
  lineaire: { souple: { 125: 1.0, 160: 0.5 } },           // Pa/m — fixtures test
  singulier: { coude: { '90deg': { coefficient: 0.4, source: 'FIXTURE_TEST', version: 'test-0' } } }
};
// preCalcul minimal (on n'a besoin que de systeme + reseaux[].type pour LOT15-A)
const preCalc = (systeme, types) => ({ systeme: systeme, reseaux: types.map(t => ({ type: t })) });

A(typeof VMC.pertesDeChargeVmc === 'function', '0. pertesDeChargeVmc exporté');

// ---- 1. SF données complètes → calcul (arithmétique vérifiée) --------------------
{
  const dr = { extraction: {
    antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }],
    collecteur: { longueur: 6, diametre: 160, conduit: 'souple', singularites: [] } // debit = 30 (somme)
  } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  const ext = r.reseaux.find(x => x.type === 'extraction');
  // linéaire = antenne(1.0×4=4) + collecteur(0.5×6=3) = 7 Pa
  A(approx(ext.pertesLineaires, 7), '1. SF : pertes linéaires = R×L (4 + 3 = 7 Pa)');
  A(ext.pertesSingulieres === 0, '1. SF : aucune singularité déclarée → 0 (non inventé)');
  A(approx(ext.perteTotale, 7) && approx(ext.pressionNecessaire, 7), '1. SF : perte totale / pression = 7 Pa');
  A(r.statut === 'calcule' && r.methode.source === 'FIXTURE_TEST', '1. statut calcule + méthode/source tracées');
}

// ---- 2. Hygro cohérent avec SF (même réseau extraction) --------------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'cuisine#1', debit: 45, longueur: 5, diametre: 125, conduit: 'souple', singularites: [] }], collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] } } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('hygro', ['extraction']), dr, REF);
  A(approx(r.reseaux[0].pertesLineaires, 5 * 1.0 + 2 * 0.5), '2. hygro : même logique extraction (5 + 1 = 6 Pa)');
}

// ---- 3/4. DF : deux réseaux distincts, jamais fusionnés --------------------------
{
  const dr = {
    extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }], collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] } },
    insufflation: { antennes: [{ pieceRef: 'chambre#1', debit: 30, longueur: 3, diametre: 125, conduit: 'souple', singularites: [] }], collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] } }
  };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('double_flux', ['extraction', 'insufflation']), dr, REF);
  const ext = r.reseaux.find(x => x.type === 'extraction'), ins = r.reseaux.find(x => x.type === 'insufflation');
  A(ext && ins, '3. DF : deux réseaux présents');
  A(ext.perteTotale != null && ins.perteTotale != null && ext !== ins, '4. DF : réseaux calculés séparément');
  A(!('perteTotaleGlobale' in r) && r.reseaux.length === 2, '4. DF : pas de perte fusionnée des deux réseaux');
}

// ---- 5. Inconnue : pas de conversion --------------------------------------------
{
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('inconnue', []), {}, REF);
  A(r.systeme === 'inconnue' && r.statut === 'indetermine', '5. inconnue → indéterminé, pas de conversion');
}

// ---- 6. Longueur manquante → incomplet ------------------------------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, diametre: 125, conduit: 'souple', singularites: [] }] } }; // pas de longueur
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  A(r.reseaux[0].statut === 'incomplet' && r.reseaux[0].pertesLineaires === null, '6. longueur manquante → incomplet, pas de perte inventée');
  A(r.donneesManquantes.some(d => /longueur/.test(d.champ)), '6. longueur signalée manquante');
}

// ---- 7. Diamètre manquant → coefficient introuvable → incomplet ------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, conduit: 'souple', singularites: [] }] } }; // pas de diamètre
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  A(r.reseaux[0].pertesLineaires === null && r.reseaux[0].statut === 'incomplet', '7. diamètre manquant → incomplet');
}

// ---- 8/9. Coefficient singulier absent → pas de perte inventée -------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [{ type: 'te', geometrie: 'derivation' }] }], collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] } } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF); // REF n'a pas de ζ pour 'te'
  const ant = r.reseaux[0].troncons.find(t => t.role === 'antenne');
  A(ant.pertesSingulieres === null, '8. singularité sans coefficient → perte non calculée (ni zéro)');
  A(r.donneesManquantes.some(d => /coefficient_singulier:te/.test(d.champ)), '9. coefficient singulier absent signalé (non inventé)');
}

// ---- 8bis. Singularité AVEC coefficient (fixture) → ζ·½ρV² -----------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [{ type: 'coude', geometrie: '90deg' }] }] } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  const S = Math.PI * Math.pow(0.125, 2) / 4, V = (30 / 3600) / S, attendu = 0.4 * 0.5 * 1.2 * V * V;
  A(approx(r.reseaux[0].troncons[0].pertesSingulieres, Math.round(attendu * 100) / 100, 0.02), '8bis. perte singulière = ζ·½ρV² (référentiel)');
}

// ---- 10. Sans référentiel → aucune perte + composant non calculé -----------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }] } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, null); // pas de référentiel
  A(r.methode === null && r.reseaux[0].pertesLineaires === null && r.statut === 'incomplet', '10. sans référentiel → rien calculé, méthode null');
  A(r.donneesManquantes.some(d => d.champ === 'referentiel_pertes'), '10. référentiel signalé manquant');
}

// ---- 11/12. Pas de pression disponible ni marge inventée ------------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }], collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] } } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  A(!/pressionDisponible|marge|0\.8|1\.2\s*\*|×\s*1\.2/.test(JSON.stringify(r.reseaux)) , '11/12. aucune pression disponible / marge cachée dans les réseaux');
  A(r.pointsAVerifier.some(p => /pression disponible/i.test(p.description)), '11. pression disponible signalée non fournie');
}

// ---- 13/14. Débit tronçon distinct + collecteur = somme antennes -----------------
{
  const dr = { extraction: {
    antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] },
               { pieceRef: 'wc#1', debit: 15, longueur: 3, diametre: 125, conduit: 'souple', singularites: [] }],
    collecteur: { longueur: 2, diametre: 160, conduit: 'souple', singularites: [] }
  } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  const col = r.reseaux[0].troncons.find(t => t.role === 'collecteur');
  const a1 = r.reseaux[0].troncons.find(t => t.ref === 'sdb#1');
  A(a1.debit === 30 && col.debit === 45, '13/14. antenne = débit propre (30) ; collecteur = somme (45)');
}

// ---- 15. Chemin défavorable explicite → pression = somme du chemin ---------------
{
  const dr = { extraction: {
    antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }],
    collecteur: { longueur: 6, diametre: 160, conduit: 'souple', singularites: [] },
    cheminDefavorable: ['sdb#1', 'collecteur']
  } };
  const r = VMC.pertesDeChargeVmc([], {}, preCalc('simple_flux', ['extraction']), dr, REF);
  A(approx(r.reseaux[0].pressionNecessaire, 4 * 1.0 + 6 * 0.5) && r.reseaux[0].statut === 'calcule', '15. chemin défavorable → pression = somme du chemin (4 + 3 = 7)');
}

// ---- 16/17. Fonction pure : non-mutation + déterminisme --------------------------
{
  const dr = { extraction: { antennes: [{ pieceRef: 'sdb#1', debit: 30, longueur: 4, diametre: 125, conduit: 'souple', singularites: [] }] } };
  const pc = preCalc('simple_flux', ['extraction']);
  const snap = JSON.stringify({ dr, pc, REF });
  const r1 = VMC.pertesDeChargeVmc([], {}, pc, dr, REF);
  const r2 = VMC.pertesDeChargeVmc([], {}, pc, dr, REF);
  A(JSON.stringify({ dr, pc, REF }) === snap, '16. entrées non mutées');
  A(JSON.stringify(r1) === JSON.stringify(r2), '17. déterministe');
}

// ---- 18/19/20. Money-path / config / aucune constante de perte dans le moteur ----
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const _s0 = SRC.indexOf('function pertesDeChargeVmc(');
const _s1 = SRC.indexOf('function preEtudeVmc(', _s0); // borne : ne pas déborder sur LOT16
const BLOC = SRC.slice(_s0, _s1 > _s0 ? _s1 : SRC.length);
A(!/getMoyenPrixFor|dimensionnementVMC|require\(|fetch\(|document\.|window\.|globalThis\.|config\.vmc\s*=|VMC_BOUCHE|prixTotal/.test(BLOC), '18/19. aucun money-path / config / catalogue');
// Anti-dérive : aucune constante de perte (Pa/m, ζ, marge) écrite en dur dans le moteur.
A(!/Pa\/m\s*=|zeta\s*=\s*0\.|coude\s*=\s*0\.|marge\s*=\s*0\.|=\s*1\.2\s*;.*rho|=\s*0\.5\s*;.*coude/.test(BLOC), '20. aucune constante de perte inventée dans le moteur');
A(!/\bconforme\b/i.test(BLOC), '14bis. le moteur ne produit jamais « conforme »');

const total = ok + ko;
if (ko === 0) console.log('✅ Pertes de charge VMC (M57 LOT15-A) : ' + ok + '/' + total + ' — évaluateur pur, référentiel externe, incomplet si données absentes');
else { console.error('❌ Pertes de charge VMC LOT15-A : ' + ok + '/' + total); process.exit(1); }
