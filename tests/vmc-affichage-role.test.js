// =====================================================================
// tests/vmc-affichage-role.test.js — affichage VMC par RÔLE fonctionnel de pièce (présentation)
// =====================================================================
// Corrige uniquement la PRÉSENTATION : le bloc VMC d'une pièce ne montre que la prestation
// applicable à son rôle (source de vérité = _vmcRole du moteur, INCHANGÉ).
//   extraction (cuisine/sdb/sde/wc/cave) -> Bouche d'extraction UNIQUEMENT
//   balayage  (salon/salle_manger/chambre/bureau) -> Entrée d'air UNIQUEMENT
//   sans rôle (entree/couloir/garage/…) -> aucune ligne
// Le contrôle de cohérence (déjà rôle-correct) et le calcul/prix ne sont pas modifiés.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CFG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = CFG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CFG.indexOf('{', s), d = 0;
  for (; i < CFG.length; i++) { if (CFG[i] === '{') d++; else if (CFG[i] === '}') { d--; if (d === 0) return CFG.slice(s, i + 1); } }
  throw new Error('fin: ' + sig);
}
// Fonction UI RÉELLE extraite du configurateur, alimentée par le VRAI moteur (getVmcPourPiece + _vmcRole).
const getVmcPourPieceUI = new Function('getVmcPourPiece', '_vmcRole',
  extraire('function getVmcPourPieceUI(') + ';return getVmcPourPieceUI;')(VMC.getVmcPourPiece, VMC._vmcRole);
const codes = pieceId => getVmcPourPieceUI(pieceId).map(p => p.code);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ===== Affichage par rôle (cas 1-6) =====
{
  // 1. chambre -> entrée d'air, jamais extraction
  A(eq(codes('chambre'), ['VMC_ENTREE_AIR']), '1. chambre : entrée d\'air uniquement (pas de bouche)');
  // 2. séjour -> entrée d'air, jamais extraction
  A(eq(codes('salon'), ['VMC_ENTREE_AIR']) && eq(codes('salle_manger'), ['VMC_ENTREE_AIR']), '2. séjour/salle à manger : entrée d\'air uniquement');
  // bureau assimilé pièce principale
  A(eq(codes('bureau'), ['VMC_ENTREE_AIR']), '2b. bureau : entrée d\'air uniquement');
  // 3. cuisine -> extraction, jamais entrée d'air
  A(eq(codes('cuisine'), ['VMC_BOUCHE']), '3. cuisine : bouche d\'extraction uniquement (pas d\'entrée d\'air)');
  // 4. SDB -> extraction uniquement ; sde aussi
  A(eq(codes('sdb'), ['VMC_BOUCHE']) && eq(codes('sde'), ['VMC_BOUCHE']), '4. SDB/SDE : bouche d\'extraction uniquement');
  // 5. WC -> extraction uniquement
  A(eq(codes('wc'), ['VMC_BOUCHE']), '5. WC : bouche d\'extraction uniquement');
  // cave (local de service) -> extraction
  A(eq(codes('cave'), ['VMC_BOUCHE']), '5b. cave/buanderie : bouche d\'extraction uniquement');
  // 6. pièce sans rôle VMC -> aucune ligne
  ['entree', 'couloir', 'escalier', 'garage', 'dressing', 'terrasse', 'jardin'].forEach(id =>
    A(eq(codes(id), []), '6. ' + id + ' : aucune ligne VMC (rôle nul)'));
}

// ===== Cohérence par rôle (cas 7 & 8) — inchangée, rôle-correcte =====
function piece(id, cfg) { return { id, nom: id, config: { vmc: cfg || {} } }; }
{
  // 7. absence d'une fonction NON applicable -> AUCUNE alerte
  A(!VMC.controlesOublisVmc(piece('chambre', {})).some(s => s.code === 'VMC_BOUCHE'), '7a. chambre sans extraction -> pas d\'alerte (non applicable)');
  A(!VMC.controlesOublisVmc(piece('cuisine', {})).some(s => s.code === 'VMC_ENTREE_AIR'), '7b. cuisine sans entrée d\'air -> pas d\'alerte (non applicable)');
  A(!VMC.evaluationSupportVmc(piece('chambre', {}), {}).some(t => /bouche|extraction/i.test(t)), '7c. évaluation chambre : aucune reco d\'extraction');
  A(!VMC.verifierVMC([piece('chambre', {})], ['vmc']).some(a => /chambre/i.test(a.texte) && /bouche|extraction/i.test(a.texte)), '7d. verifierVMC : chambre jamais signalée pour absence d\'extraction');

  // 8. absence d'une fonction RÉELLEMENT requise -> alerte MAINTENUE
  A(VMC.controlesOublisVmc(piece('cuisine', {})).some(s => s.code === 'VMC_BOUCHE'), '8a. cuisine sans bouche -> alerte maintenue');
  A(VMC.controlesOublisVmc(piece('chambre', {})).some(s => s.code === 'VMC_ENTREE_AIR'), '8b. chambre sans entrée d\'air -> alerte maintenue');
  A(VMC.verifierVMC([piece('sdb', {})], ['vmc']).some(a => /sans bouche/i.test(a.texte)), '8c. verifierVMC : SDB sans bouche -> alerte maintenue');
}

// ===== Preuve : moteur / calcul / prix NON modifiés (cas 9) =====
{
  // getVmcPourPiece (contrat métier figé, parité vmc.js) reste INCHANGÉ : extraction = 2 codes.
  A(eq(VMC.getVmcPourPiece('cuisine').map(p => p.code), ['VMC_BOUCHE', 'VMC_ENTREE_AIR']), '9a. getVmcPourPiece(cuisine) inchangé (moteur/parité intacts)');
  A(eq(VMC.getVmcPourPiece('chambre').map(p => p.code), ['VMC_ENTREE_AIR']), '9b. getVmcPourPiece(chambre) inchangé');
  // getVmcPourPieceUI est un SOUS-ENSEMBLE de getVmcPourPiece (filtre d'affichage, n'invente rien).
  ['cuisine', 'sdb', 'chambre', 'salon', 'wc', 'cave', 'entree'].forEach(id => {
    const base = VMC.getVmcPourPiece(id).map(p => p.code);
    A(codes(id).every(c => base.includes(c)), '9c. UI(' + id + ') ⊆ getVmcPourPiece (aucune prestation inventée)');
  });
  // Le configurateur ne modifie pas le moteur : aucune écriture config.vmc dans le helper UI.
  const SRC = extraire('function getVmcPourPieceUI(');
  A(!/config\.vmc|config\[|projeter|prix|getMoyenPrix|Runtime/.test(SRC), '9d. helper UI = présentation pure (aucun calcul/projection/prix)');
}

// ===== Branchement UI (le bloc VMC et le DOM utilisent la liste filtrée) =====
{
  A(/const prests = getVmcPourPieceUI\(pieceId\);/.test(CFG), '10a. section VMC utilise getVmcPourPieceUI');
  A(/getVmcPourPieceUI\(piece\.id\)\.forEach/.test(CFG), '10b. syncVmcDOM utilise getVmcPourPieceUI');
  A(/function getVmcPourPieceUI\(pieceId\)/.test(CFG) && /_vmcRole/.test(extraire('function getVmcPourPieceUI(')), '10c. helper s\'appuie sur _vmcRole (source de vérité existante)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Affichage VMC par rôle : ' + ok + '/' + total + ' — extraction=bouche seule, balayage=entrée d\'air seule, sans rôle=rien ; cohérence rôle-correcte inchangée ; moteur/calcul/prix intacts');
else { console.error('❌ VMC affichage rôle : ' + ok + '/' + total); process.exit(1); }
