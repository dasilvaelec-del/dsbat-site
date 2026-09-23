// =====================================================================
// tests/composition-programme-m62.test.js — M62 : programme « Maison neuve » branché sur compositionTypologie
// =====================================================================
// Vérifie : (A) rétrocompat stricte sans programme ; (B) overrides programme (priorité sur surface) ;
// (C) transmission appliquerTypologie UNIQUEMENT en neuf ; (D) validerPieces conserve les configs.
// Fonctions RÉELLES extraites de devis-configurateur.html. Aucune modification de fichier ici.
// =====================================================================
const fs = require('fs');
const path = require('path');
const CFG = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = CFG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CFG.indexOf('{', s), d = 0;
  for (; i < CFG.length; i++) { if (CFG[i] === '{') d++; else if (CFG[i] === '}') { d--; if (d === 0) return CFG.slice(s, i + 1); } }
  throw new Error('fin: ' + sig);
}
const norm = o => JSON.stringify(Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {}));
const eq = (a, b) => norm(a) === norm(b);

const compositionTypologie = new Function(extraire('function compositionTypologie(') + ';return compositionTypologie;')();

const BASE = {
  '1': { salon: 1, cuisine: 1, sdb: 1, wc: 1, entree: 1 },
  '2': { salon: 1, chambre: 1, cuisine: 1, sdb: 1, wc: 1, entree: 1 },
  '3': { salon: 1, chambre: 2, cuisine: 1, sdb: 1, wc: 1, entree: 1 },
  '4': { salon: 1, chambre: 3, cuisine: 1, sdb: 1, wc: 1, entree: 1, couloir: 1 },
  '5': { salon: 1, chambre: 4, cuisine: 1, sdb: 1, sde: 1, wc: 1, entree: 1, couloir: 1 },
  '6': { salon: 1, chambre: 5, cuisine: 1, sdb: 1, sde: 1, wc: 1, entree: 1, couloir: 1 }
};

// ===== A. RÉTROCOMPAT STRICTE (sans programme) =====
{
  ['1', '2', '3', '4', '5', '6'].forEach(f => {
    A(eq(compositionTypologie(f, 60).compo, BASE[f]), 'A. F' + f + ' sans programme = historique (surface 60)');
    A(eq(compositionTypologie(f, 60, undefined).compo, BASE[f]), 'A. F' + f + ' + programme=undefined = historique');
  });
  // enrichissements de surface historiques préservés
  A(compositionTypologie('5', 110).compo.sde === 1, 'A. T5/110 : sde=1 (heuristique surface conservée)');
  A(compositionTypologie('6', 120).compo.wc === 2, 'A. T6/120 : wc=2 (heuristique surface conservée)');
  A(compositionTypologie('9', 60) === null, 'A. typologie invalide -> null (inchangé)');
}

// ===== B. OVERRIDES PROGRAMME =====
{
  // 1. T4 standard sans programme
  A(eq(compositionTypologie('4', 95).compo, BASE['4']), 'B1. T4/95 sans programme = historique');
  // 2. T4 + 4 chambres
  A(compositionTypologie('4', 95, { nbChambres: '4' }).compo.chambre === 4, 'B2. T4 + 4 chambres -> chambre=4');
  // 3. T4 + 2 salles d'eau -> SDB + SDE
  { const c = compositionTypologie('4', 95, { nbSallesEau: '2' }).compo; A(c.sdb === 1 && c.sde === 1, 'B3. T4 + 2 salles d\'eau -> sdb=1 + sde=1'); }
  // 4. T4 + 2 WC
  A(compositionTypologie('4', 95, { nbWc: '2' }).compo.wc === 2, 'B4. T4 + 2 WC -> wc=2');
  // 5. garage oui
  A(compositionTypologie('4', 95, { garage: 'oui' }).compo.garage === 1, 'B5. garage oui -> garage=1');
  A(!('garage' in compositionTypologie('4', 95, { garage: 'non' }).compo), 'B5b. garage non -> pas de garage');
  // 6. cellier oui -> mapping existant « cave » (aucun id « cellier »)
  { const c = compositionTypologie('4', 95, { cellier: 'oui' }).compo; A(c.cave === 1 && !('cellier' in c), 'B6. cellier oui -> cave=1 (pas d\'id cellier)'); }
  // 7. 2 niveaux -> escalier ; 1 niveau -> pas d'escalier
  A(compositionTypologie('4', 95, { nbNiveaux: '2' }).compo.escalier === 1, 'B7. 2 niveaux -> escalier=1');
  A(!('escalier' in compositionTypologie('4', 95, { nbNiveaux: '1' }).compo), 'B7b. 1 niveau -> pas d\'escalier');
  // priorité programme > heuristique surface
  A(compositionTypologie('6', 130, { nbWc: '1' }).compo.wc === 1, 'B8. programme wc=1 prime sur heuristique surface (qui aurait mis 2)');
  { const c = compositionTypologie('6', 130, { nbSallesEau: '1' }).compo; A(c.sdb === 1 && !('sde' in c), 'B8b. programme 1 pièce d\'eau prime (sde retiré)'); }
  // 8. combinaison complète T4 / 95 / 4 ch / 2 SDE / 2 WC / garage / cellier
  const full = compositionTypologie('4', 95, { nbChambres: '4', nbSallesEau: '2', nbWc: '2', garage: 'oui', cellier: 'oui', nbNiveaux: '1' }).compo;
  const attendu = { salon: 1, chambre: 4, cuisine: 1, sdb: 1, sde: 1, wc: 2, entree: 1, couloir: 1, garage: 1, cave: 1 };
  A(eq(full, attendu), 'B9. T4 complet -> ' + norm(full));
}

// ===== C. TRANSMISSION appliquerTypologie (neuf uniquement) =====
function fabriqueTypo(chantier) {
  const compteurs = {};
  const elStub = () => ({ textContent: '', classList: { add() {}, remove() {}, toggle() {} }, style: {} });
  const document = { getElementById: () => elStub() };
  const api = new Function(
    'compteurs', 'chantier', 'document', 'renderDimBlocks', 'afficherPropositionTypologie', 'saveEtat',
    extraire('function compositionTypologie(') + '\n' + extraire('function appliquerTypologie(') +
    ';return { appliquerTypologie };'
  )(compteurs, chantier, document, () => {}, () => {}, () => {});
  return { api, compteurs };
}
{
  // NEUF : programme appliqué
  const neuf = fabriqueTypo({ typeProjet: 'neuf', pieces: '4', surface: 95, nbChambres: '4', nbSallesEau: '2', nbWc: '2', garage: 'oui', cellier: 'oui', nbNiveaux: '1' });
  neuf.api.appliquerTypologie();
  A(neuf.compteurs.chambre === 4 && neuf.compteurs.sde === 1 && neuf.compteurs.wc === 2 && neuf.compteurs.garage === 1 && neuf.compteurs.cave === 1, 'C1. neuf : compteurs reflètent le programme M61');
  // RÉNO : programme (défauts M61 présents) IGNORÉ -> composition historique T4
  const reno = fabriqueTypo({ typeProjet: 'renov', pieces: '4', surface: 95, nbChambres: '2', nbSallesEau: '1', nbWc: '1', garage: 'non', cellier: 'non', nbNiveaux: '1' });
  reno.api.appliquerTypologie();
  A(reno.compteurs.chambre === 3 && !reno.compteurs.garage && !reno.compteurs.cave, 'C2. réno : programme ignoré -> T4 historique (chambre=3, pas de garage)');
  // absence de typeProjet -> historique
  const sans = fabriqueTypo({ pieces: '4', surface: 95, nbChambres: '2' });
  sans.api.appliquerTypologie();
  A(sans.compteurs.chambre === 3, 'C3. sans typeProjet -> historique (chambre=3)');
}

// ===== D. validerPieces conserve les configurations existantes =====
{
  const PIECES_DEF_SRC = extraire('const PIECES_DEF =');
  const stub = () => {};
  const doc = { getElementById: () => ({ style: {} }) };
  const initial = [{ id: 'salon', numero: 1, nom: 'Salon', icon: 's', dims: { l: 4, la: 5, h: 2.5, fenetres: 2, portes: 1 }, config: { electricite: { ELEC_PL_SA: 3, ELEC_PRISE10: 5 } }, elecGamme: 'mosaic', chauffageFonctions: { intention: { action: 'creer' } } }];
  const compteurs = { salon: 1 };
  const api = new Function(
    'piecesSelectionnees', 'compteurs', 'chantier', 'dimsParPiece', 'dimKey', 'poseParDefaut', 'gammeElecParDefaut', 'gammePloParDefaut', 'normaliserGammesIP44', 'verifierCoherenceGlobale', 'afficherCoherence', 'masquerCoherence', 'appliquerNorme', 'appliquerObjectif', 'saveEtat', 'allerPhase', 'document', '__coherenceAcquittee',
    PIECES_DEF_SRC + '\n' + extraire('function validerPieces(') +
    ';return { run: validerPieces, get: function(){ return piecesSelectionnees; } };'
  )(initial, compteurs, {}, {}, (id, i) => id + '#' + i, () => 'placo', () => 'mosaic', () => 'standard', stub, () => [], stub, stub, stub, stub, stub, stub, doc, true);
  api.run();
  const res = api.get();
  const salon = res.find(p => p.id === 'salon' && p.numero === 1);
  A(salon && salon.config.electricite && salon.config.electricite.ELEC_PL_SA === 3 && salon.config.electricite.ELEC_PRISE10 === 5, 'D1. validerPieces : config électricité préservée à la revalidation');
  A(salon && salon.chauffageFonctions && salon.chauffageFonctions.intention.action === 'creer', 'D2. validerPieces : chauffageFonctions préservé');
  A(salon && salon.dims.l === 4 && salon.dims.la === 5, 'D3. validerPieces : dims saisies préservées');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Programme Maison neuve -> compositionTypologie (M62) : ' + ok + '/' + total + ' — rétrocompat stricte, overrides (chambres/SDE/WC/garage/cave/escalier) prioritaires sur la surface, transmission neuf-only, validerPieces préserve les configs');
else { console.error('❌ M62 : ' + ok + '/' + total); process.exit(1); }
