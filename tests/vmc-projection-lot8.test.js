// =====================================================================
// tests/vmc-projection-lot8.test.js — M57 LOT8 : projection VMC → config tarifaire
// =====================================================================
// projeterVmcVersConfig(piece) projette la config fonctionnelle (LOT7-B) vers les codes
// tarifaires historiques (piece.config.vmc), SF/hygro-only, via obligationsVmc +
// fonctionsVmcRetenues (aucune règle dupliquée). Idempotent (Math.max), gaté sur
// piece.ventilationFonctions (compat Golden Masters). INSUFFLATION jamais projetée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = CONFIG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CONFIG.indexOf('{', s), d = 0, e = -1;
  for (; i < CONFIG.length; i++) { if (CONFIG[i] === '{') d++; else if (CONFIG[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return CONFIG.slice(s, e);
}

// Environnement d'exécution : on injecte obligationsVmc/fonctionsVmcRetenues/_contexteVmc
// + globals (chantier, metiersActifs, sessionStorage stub). _contexteVmc lit sessionStorage.
function makeProjeter(chantier, metiersActifs) {
  const src = extraire('function _contexteVmc(') + '\n' +
              extraire('function fonctionsVmcRetenues(') + '\n' +
              extraire('function projeterVmcVersConfig(') + '\n;return projeterVmcVersConfig;';
  const sessionStorage = { getItem: () => null }; // perimetre via modeChantier
  const modeChantier = 'complet';
  return new Function('obligationsVmc', 'chantier', 'metiersActifs', 'sessionStorage', 'modeChantier', 'piecesSelectionnees',
    src)(VMC.obligationsVmc, chantier, metiersActifs, sessionStorage, modeChantier, []);
}
const CH_SF = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
// pieceEnScope : _contexteVmc calcule piecesSelectionnees.indexOf(piece)!==-1. On injecte la
// pièce dans piecesSelectionnees en la passant comme unique élément via une fabrique dédiée.
function projeterAvecScope(chantier, metiers, piece) {
  const src = extraire('function _contexteVmc(') + '\n' +
              extraire('function fonctionsVmcRetenues(') + '\n' +
              extraire('function projeterVmcVersConfig(') + '\n;return projeterVmcVersConfig;';
  const sessionStorage = { getItem: () => null };
  const fn = new Function('obligationsVmc', 'chantier', 'metiersActifs', 'sessionStorage', 'modeChantier', 'piecesSelectionnees',
    src)(VMC.obligationsVmc, chantier, metiers, sessionStorage, 'complet', [piece]);
  fn(piece);
  return piece;
}

// ---- A. Historique : sans ventilationFonctions → aucune modification --------------
{
  const p = { id: 'sdb', config: { vmc: {} } };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(Object.keys(p.config.vmc).length === 0, 'A. sans ventilationFonctions → config.vmc inchangée');
  const p2 = { id: 'sdb' }; // pas de config du tout
  projeterAvecScope(CH_SF, ['vmc'], p2);
  A(!p2.config || !p2.config.vmc || Object.keys(p2.config.vmc).length === 0, 'A. sans config → rien créé');
}

// ---- B. SORTIE_AIR retenue → VMC_BOUCHE >= 1 -------------------------------------
{
  const p = { id: 'sdb', config: {}, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(p.config.vmc && p.config.vmc.VMC_BOUCHE >= 1, 'B. SORTIE_AIR obligatoire → VMC_BOUCHE >= 1');
  A(!('VMC_ENTREE_AIR' in p.config.vmc), 'B. sdb : pas d\'entrée d\'air (SORTIE_AIR seule)');
}

// ---- C. ADMISSION_AIR retenue → VMC_ENTREE_AIR >= 1 ------------------------------
{
  const p = { id: 'chambre', config: {}, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(p.config.vmc && p.config.vmc.VMC_ENTREE_AIR >= 1, 'C. ADMISSION_AIR obligatoire → VMC_ENTREE_AIR >= 1');
  A(!('VMC_BOUCHE' in p.config.vmc), 'C. chambre : pas de bouche');
}

// ---- D. Quantité existante supérieure conservée (Math.max) -----------------------
{
  const p = { id: 'sdb', config: { vmc: { VMC_BOUCHE: 2 } }, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(p.config.vmc.VMC_BOUCHE === 2, 'D. VMC_BOUCHE=2 + requis 1 → reste 2 (Math.max)');
}

// ---- E. Idempotence : deux appels → pas d'augmentation ---------------------------
{
  const p = { id: 'sdb', config: {}, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  const fn = new Function('obligationsVmc', 'chantier', 'metiersActifs', 'sessionStorage', 'modeChantier', 'piecesSelectionnees',
    extraire('function _contexteVmc(') + '\n' + extraire('function fonctionsVmcRetenues(') + '\n' + extraire('function projeterVmcVersConfig(') + '\n;return projeterVmcVersConfig;')(VMC.obligationsVmc, CH_SF, ['vmc'], { getItem: () => null }, 'complet', [p]);
  fn(p); fn(p);
  A(p.config.vmc.VMC_BOUCHE === 1, 'E. idempotence : 3 appels → VMC_BOUCHE reste 1');
}

// ---- F. Obligation + choix client false → prestation quand même présente ---------
{
  const p = { id: 'sdb', config: {}, ventilationFonctions: { extraction: false } };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(p.config.vmc.VMC_BOUCHE >= 1, 'F. choix false + obligation → VMC_BOUCHE présent (obligation non contournable)');
}

// ---- G. a_verifier (conserver) → aucune création automatique ---------------------
{
  const p = { id: 'sdb', config: {}, ventilationFonctions: {} };
  projeterAvecScope({ intentionVentilation: 'conserver', solutionVentilation: 'simple_flux' }, ['vmc'], p);
  A(!p.config.vmc || !p.config.vmc.VMC_BOUCHE, 'G. conserver → SORTIE_AIR a_verifier → aucune projection');
}

// ---- H. Hors scope → aucune projection -------------------------------------------
{
  // pièce non incluse dans piecesSelectionnees passé à la fabrique → pieceEnScope=false
  const p = { id: 'sdb', config: {}, ventilationFonctions: {} };
  const fn = new Function('obligationsVmc', 'chantier', 'metiersActifs', 'sessionStorage', 'modeChantier', 'piecesSelectionnees',
    extraire('function _contexteVmc(') + '\n' + extraire('function fonctionsVmcRetenues(') + '\n' + extraire('function projeterVmcVersConfig(') + '\n;return projeterVmcVersConfig;')(VMC.obligationsVmc, CH_SF, ['vmc'], { getItem: () => null }, 'complet', [/* autre pièce */ { id: 'x' }]);
  fn(p);
  A(!p.config.vmc || !p.config.vmc.VMC_BOUCHE, 'H. hors scope → aucune projection');
}

// ---- I. Solution inconnue → aucune invention de simple flux -----------------------
{
  const p = { id: 'sdb', config: {}, ventilationFonctions: {} };
  projeterAvecScope({ intentionVentilation: 'creer', solutionVentilation: 'inconnue' }, ['vmc'], p);
  A(!p.config.vmc || !p.config.vmc.VMC_BOUCHE, 'I. solution inconnue → aucune projection (pas de SF inventé)');
}

// ---- J/K. Insufflation jamais projetée + double flux → aucune projection ----------
{
  const p = { id: 'chambre', config: {}, ventilationFonctions: { insufflation: true } };
  projeterAvecScope({ intentionVentilation: 'creer', solutionVentilation: 'double_flux' }, ['vmc'], p);
  A(!p.config.vmc || Object.keys(p.config.vmc).length === 0, 'J/K. double_flux → aucune projection (pas de SF simulé, insufflation non projetée)');
  // vérif statique : aucune association INSUFFLATION→code dans la projection
  const SRC = extraire('function projeterVmcVersConfig(');
  A(!/INSUFFLATION/.test(SRC), 'J. projeterVmcVersConfig ne référence pas INSUFFLATION');
  A(/extraction: 'VMC_BOUCHE'/.test(SRC) && /entree_air: 'VMC_ENTREE_AIR'/.test(SRC), 'J. mapping limité à VMC_BOUCHE / VMC_ENTREE_AIR');
  A(!/doubleFlux/.test(SRC), 'K. aucune activation doubleFlux dans la projection');
}

// ---- L/M. conserver / remplacer → pas de dépose ni remise à niveau auto ----------
{
  const SRC = extraire('function projeterVmcVersConfig(');
  A(!/DEPOSE|depose|condamn/i.test(SRC), 'L/M. aucune dépose automatique projetée');
}

// ---- N. Autres métiers non modifiés ----------------------------------------------
{
  const p = { id: 'sdb', config: { electricite: { ELEC_PRISE10: 3 }, plomberie: { PLO_X: 1 } }, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  A(p.config.electricite.ELEC_PRISE10 === 3 && p.config.plomberie.PLO_X === 1, 'N. électricité/plomberie inchangées');
}

// ---- P. Aucun code tarifaire autre que VMC_BOUCHE / VMC_ENTREE_AIR ----------------
{
  const p = { id: 'cuisine', config: {}, ventilationFonctions: {} };
  projeterAvecScope(CH_SF, ['vmc'], p);
  const codes = Object.keys(p.config.vmc || {});
  A(codes.every(c => c === 'VMC_BOUCHE' || c === 'VMC_ENTREE_AIR'), 'P. uniquement VMC_BOUCHE / VMC_ENTREE_AIR');
}

// ---- Point d'appel : hors render/calcul, à la préparation du devis ---------------
A(/if \(n === 3\)[\s\S]{0,500}projeterVmcToutesPieces\(\)[\s\S]{0,200}renderPhase3\(\)/.test(CONFIG), 'appel dans allerPhase(3) (préparation), avant renderPhase3');
A(!/function calculerPiece[\s\S]{0,4000}projeterVmcVersConfig/.test(CONFIG), 'projection PAS dans calculerPiece');
const PIECE = fs.readFileSync(path.join(RACINE, 'js', 'moteur-piece.js'), 'utf8');
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
A(!/projeterVmc|ventilationFonctions/.test(PIECE) && !/projeterVmc|ventilationFonctions/.test(MOTEUR), 'moteur-piece/moteur-devis non modifiés (pas de projection dans le calcul)');
// gating solution présent
A(/ctx\.solution !== 'simple_flux' && ctx\.solution !== 'hygro'/.test(extraire('function projeterVmcVersConfig(')), 'gating solution simple_flux|hygro présent (DF/inconnue exclus)');
// gating ventilationFonctions présent
A(/if \(!piece \|\| !piece\.ventilationFonctions\) return/.test(extraire('function projeterVmcVersConfig(')), 'gating ventilationFonctions présent (compat historique)');

const total = ok + ko;
if (ko === 0) console.log('✅ Projection VMC (M57 LOT8) : ' + ok + '/' + total + ' — SF/hygro-only, idempotent, gaté ventilationFonctions, INSUFFLATION/DF exclus');
else { console.error('❌ Projection VMC LOT8 : ' + ok + '/' + total); process.exit(1); }
