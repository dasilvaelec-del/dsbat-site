// tests/config-neuf-redondance-lot36.test.js — LOT36 : Configuration neuf sans redondance
// Exécute les VRAIES fonctions de rendu extraites de devis-configurateur.html.
const fs = require('fs'), path = require('path');
const CFG = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');
const REV = require(path.join(__dirname, '..', 'js', 'moteur-revetements.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) { const s = CFG.indexOf(sig); if (s < 0) throw new Error('introuvable ' + sig); let i = CFG.indexOf('{', s), d = 0; for (; i < CFG.length; i++) { if (CFG[i] === '{') d++; else if (CFG[i] === '}') { d--; if (d === 0) return CFG.slice(s, i + 1); } } throw new Error('fin ' + sig); }

// environnement global partagé
global._SEL_SS = '';
global.deriveSolMateriau = REV.deriveSolMateriau;
global.solMateriauxDispo = REV.solMateriauxDispo;
global.faienceModesDispo = REV.faienceModesDispo;
global.deriveFaience = REV.deriveFaience;
global.FAIENCE_PARAMS = REV.FAIENCE_PARAMS;

const bundle = extraire('function renderChauffageConfig(') + '\n'
  + extraire('function __faiencePertinente(') + '\n'
  + extraire('function renderFaienceBlock(') + '\n'
  + extraire('function renderPeintureAuto(') + '\n'
  + extraire('function renderSolsAuto(') + '\n'
  + 'return { renderChauffageConfig, renderPeintureAuto, renderSolsAuto };';
function api(chantier, metiersActifs, pieces) {
  return new Function('chantier', 'metiersActifs', 'piecesSelectionnees', 'deriveSolMateriau', 'solMateriauxDispo', 'faienceModesDispo', 'deriveFaience', 'FAIENCE_PARAMS', '_SEL_SS', bundle)(
    chantier, metiersActifs, pieces, REV.deriveSolMateriau, REV.solMateriauxDispo, REV.faienceModesDispo, REV.deriveFaience, REV.FAIENCE_PARAMS, '');
}
const METIERS = ['chauffage', 'electricite', 'plomberie', 'peinture', 'sols', 'carrelage'];
const mkP = (id, extra) => Object.assign({ id, numero: 1, nom: id, config: {}, dims: { l: 5, la: 5, h: 2.5, fenetres: 1, portes: 1 } }, extra || {});

// ===== 1. CHAUFFAGE =====
const salonNeuf = mkP('salon', { chauffageFonctions: { solution: { technologie: 'radiateur_electrique' } } });
const neufCh = { typeProjet: 'neuf', chauffage: 'electrique' };
let hN = api(neufCh, METIERS, [salonNeuf]).renderChauffageConfig(0);
A(!/id="chauffage_present_0"/.test(hN) && !/chauffage_action_0/.test(hN) && !/chauffage_objectif_0/.test(hN) && !/chauffage_technologie_0/.test(hN), 'chauffage neuf : aucune question situation/intention/objectif/solution');
A(/défini au questionnaire/i.test(hN) && /Radiateurs électriques/.test(hN) && /dimensionnement/i.test(hN), 'chauffage neuf : rappel lecture seule + solution + dimensionnement auto');
let hR = api({ typeProjet: 'renov', chauffage: 'electrique' }, METIERS, [mkP('salon')]).renderChauffageConfig(0);
A(/id="chauffage_present_0"/.test(hR) && /chauffage_technologie_0/.test(hR), 'chauffage rénovation : questions conservées (aucune régression)');

// ===== 2. PEINTURE — REVÊTEMENT MURAL =====
let pN = api(neufCh, METIERS, [mkP('salon')]).renderPeintureAuto(0);
A(!/Rafraîchissement \(2 couches sur bon état\)/.test(pN), 'peinture neuf : plus de « rafraîchissement bon état »');
A(/impression \+ 2 couches/i.test(pN), 'peinture neuf : impression + 2 couches');
A(/Enduit mural — 2 passes/i.test(pN) && /Option/i.test(pN), 'peinture neuf : enduit 2 passes en OPTION séparée (LOT37 : toggle distinct, plus dans la gamme)');
A(!/id="peint_papier_0"/.test(pN), 'peinture neuf : pas de décollage papier peint (pièce sèche)');
A(!/Faïence murale/.test(pN), 'neuf : pas de faïence générique dans une pièce sèche (salon)');
// pièces humides : faïence conservée en neuf
A(/Faïence murale/.test(api(neufCh, METIERS, [mkP('cuisine')]).renderPeintureAuto(0)), 'neuf cuisine : faïence conservée');
A(/Faïence murale/.test(api(neufCh, METIERS, [mkP('sdb')]).renderPeintureAuto(0)), 'neuf SDB : faïence conservée');
A(/Faïence murale/.test(api(neufCh, METIERS, [mkP('sde')]).renderPeintureAuto(0)), 'neuf SDE : faïence conservée');
// rénovation : comportement inchangé (papier peint + rafraîchissement + faïence disponibles)
let pR = api({ typeProjet: 'renov', etatLieux: 'bon' }, METIERS, [mkP('salon')]).renderPeintureAuto(0);
A(/id="peint_papier_0"/.test(pR) && /Rafraîchissement/.test(pR), 'peinture rénovation : papier peint + rafraîchissement conservés');

// ===== 3. SOLS — sous-couche conditionnée =====
let sCarr = api(neufCh, METIERS, [mkP('salon', { solMateriau: 'carrelage' })]).renderSolsAuto(0);
A(/id="sol_souscouche_wrap_0" style="display:none;"/.test(sCarr), 'sols : sous-couche MASQUÉE pour le carrelage');
let sParq = api(neufCh, METIERS, [mkP('salon', { solMateriau: 'parq_flot' })]).renderSolsAuto(0);
A(/id="sol_souscouche_wrap_0" style=""/.test(sParq), 'sols : sous-couche visible pour un sol flottant (parquet)');
A(/Matériau du sol/.test(sCarr) && /calculée automatiquement/i.test(sCarr), 'sols : fourniture/pose carrelage (matériau + surface auto) conservés');

const total = ok + ko;
if (ko === 0) console.log('✅ LOT36 Configuration neuf sans redondance : ' + ok + '/' + total);
else { console.error('❌ LOT36 : ' + ok + '/' + total); process.exit(1); }
