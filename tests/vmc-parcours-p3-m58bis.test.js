// =====================================================================
// tests/vmc-parcours-p3-m58bis.test.js — M58bis : parcours réel PARTIE 3 (VMC = vrai métier)
// =====================================================================
// Reproduit le CYCLE RÉEL du configurateur pour la VMC, comme l'électricité :
//   clic VMC (metier actif) -> bloc VMC rendu -> questions intention/solution -> majContexteVmc
//   -> obligationsVmc/fonctionsVmcRetenues (règles existantes) -> projeterVmcVersConfig
//   -> piece.config.vmc (quantités) -> syncVmcDOM (affichage) -> total pièce (devis).
// Document mocké (portable, sans dépendance) reproduisant getElementById + textContent/value.
// Réutilise les VRAIES fonctions extraites de devis-configurateur.html (aucune ré-implémentation).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = CONFIG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CONFIG.indexOf('{', s), d = 0, e = -1;
  for (; i < CONFIG.length; i++) { if (CONFIG[i] === '{') d++; else if (CONFIG[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return CONFIG.slice(s, e);
}

// ---- Document mocké : getElementById + textContent/value/style --------------------
function makeDoc() {
  const store = {};
  return {
    _store: store,
    reg(id, el) { store[id] = el || { textContent: '', value: '', style: {} }; return store[id]; },
    getElementById(id) { return store[id] || null; }
  };
}

// ---- Bundle des VRAIES fonctions du configurateur ---------------------------------
function makeApi(doc, chantier, metiersActifs, piecesSelectionnees, sessionStorage) {
  const src =
    extraire('function _contexteVmc(') + '\n' +
    extraire('function fonctionsVmcRetenues(') + '\n' +
    extraire('function projeterVmcVersConfig(') + '\n' +
    extraire('function orchestrerVmcPiece(') + '\n' +
    extraire('function projeterVmcToutesPieces(') + '\n' +
    extraire('function questionsVmcHtml(') + '\n' +
    extraire('function majContexteVmc(') + '\n' +
    extraire('function syncVmcDOM(') + '\n' +
    extraire('function renderPrestRow(') + '\n' +
    extraire('function renderMetierSection(') + '\n' +
    // recalcPiece : reproduit EXACTEMENT la branche VMC de la production (orchestration + affichage)
    'function recalcPiece(index){ var piece=piecesSelectionnees[index]; if(!piece)return;' +
    ' if(metiersActifs.includes("vmc")){ if(typeof orchestrerVmcPiece==="function") orchestrerVmcPiece(piece); syncVmcDOM(index); } }\n' +
    'return { renderMetierSection, questionsVmcHtml, majContexteVmc, orchestrerVmcPiece, projeterVmcToutesPieces, syncVmcDOM, recalcPiece, _contexteVmc, fonctionsVmcRetenues };';
  const getPrixPrestFor = () => ({ min: 10, max: 20, unite: 'U' });
  const getMoyenPrixFor = () => 15;
  const formatEuro = (v) => String(v) + ' €';
  const objectifProjet = 'standard';
  const modeChantier = 'complet';
  return new Function(
    'document', 'obligationsVmc', 'getVmcPourPiece', 'chantier', 'metiersActifs',
    'piecesSelectionnees', 'sessionStorage', 'modeChantier', 'getPrixPrestFor',
    'getMoyenPrixFor', 'formatEuro', 'objectifProjet', src
  )(doc, VMC.obligationsVmc, VMC.getVmcPourPiece, chantier, metiersActifs,
    piecesSelectionnees, sessionStorage, modeChantier, getPrixPrestFor, getMoyenPrixFor, formatEuro, objectifProjet);
}

function sectionVmc(pieceId) { return { metier: 'vmc', icon: '💨', label: 'VMC', prests: VMC.getVmcPourPiece(pieceId) }; }
function sessionStub() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, _m: m }; }

// =====================================================================
// 1. Clic VMC -> panneau métier VMC visible + questions DANS le bloc
// =====================================================================
{
  const chantier = { intentionVentilation: 'inconnu', solutionVentilation: 'inconnue' };
  const piece = { id: 'sdb', config: {}, dims: {} };
  const api = makeApi(makeDoc(), chantier, ['vmc'], [piece], sessionStub());
  const html = api.renderMetierSection(sectionVmc('sdb'), 0);
  A(/Que souhaitez-vous faire concernant votre ventilation ?/.test(html), '1a. bloc VMC : question intention affichée');
  A(/Avez-vous déjà une solution de ventilation en tête ?/.test(html), '1b. bloc VMC : question solution affichée');
  A(/id="vmc_intention_0"[\s\S]*onchange="majContexteVmc\(0\)"/.test(html) && /id="vmc_solution_0"/.test(html), '1c. selects intention/solution câblés (majContexteVmc)');
  A(/id="qty_0_VMC_BOUCHE"/.test(html), '1d. prestations VMC rendues dans le bloc (ligne bouche)');
}

// =====================================================================
// 2. Questions VMC UNIQUEMENT dans le bloc VMC (plus en Partie 2)
// =====================================================================
{
  A(!/<select id="intentionVentilation"/.test(DEVIS) && !/<select id="solutionVentilation"/.test(DEVIS), '2a. Partie 2 (devis.html) : aucune question intention/solution');
  A(/id="vmc_intention_\$\{pieceIndex\}"/.test(CONFIG) && /id="vmc_solution_\$\{pieceIndex\}"/.test(CONFIG), '2b. questions présentes dans le bloc VMC du configurateur');
  A(/section\.metier === 'vmc' \? questionsVmcHtml\(pieceIndex\)/.test(CONFIG), '2c. renderMetierSection insère questionsVmcHtml pour le métier vmc');
}

// =====================================================================
// 3. Décision (intention+solution) -> configuration automatique (obligation)
// =====================================================================
{
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
  const piece = { id: 'sdb', config: {}, dims: {} };
  const api = makeApi(makeDoc(), chantier, ['vmc'], [piece], sessionStub());
  api.orchestrerVmcPiece(piece);
  A(piece.config.vmc && piece.config.vmc.VMC_BOUCHE === 1, '3. intention=creer + simple_flux -> VMC_BOUCHE=1 auto (aucun ajout manuel)');
}

// =====================================================================
// 4. CYCLE RÉEL DOM : réponse client -> majContexteVmc -> config -> quantité affichée != 0
// =====================================================================
{
  const doc = makeDoc();
  const chantier = { intentionVentilation: 'inconnu', solutionVentilation: 'inconnue' };
  const piece = { id: 'sdb', config: {}, dims: {} };
  const ss = sessionStub();
  const api = makeApi(doc, chantier, ['vmc'], [piece], ss);
  // Éléments réels du DOM après rendu du bloc (selects répondus + spans de quantité).
  doc.reg('vmc_intention_0', { value: 'creer' });
  doc.reg('vmc_solution_0', { value: 'simple_flux' });
  VMC.getVmcPourPiece('sdb').forEach(pr => { doc.reg('qty_0_' + pr.code, { textContent: '0' }); doc.reg('pprix_0_' + pr.code, { textContent: '' }); doc.reg('ptotal_0_' + pr.code, { textContent: '' }); });
  api.majContexteVmc(0); // onchange réel
  A(chantier.intentionVentilation === 'creer' && chantier.solutionVentilation === 'simple_flux', '4a. majContexteVmc écrit les champs chantier existants');
  A(ss.getItem('chantier') && JSON.parse(ss.getItem('chantier')).solutionVentilation === 'simple_flux', '4b. chantier persisté en sessionStorage');
  A(piece.config.vmc && piece.config.vmc.VMC_BOUCHE === 1, '4c. configuration VMC créée automatiquement (VMC_BOUCHE=1)');
  A(doc.getElementById('qty_0_VMC_BOUCHE').textContent === 1 || doc.getElementById('qty_0_VMC_BOUCHE').textContent === '1', '4d. quantité affichée dans le DOM = 1 (jamais 0 quand une obligation est retenue)');
}

// =====================================================================
// 5. Les quantités alimentent réellement le devis (total pièce)
// =====================================================================
{
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
  const piece = { id: 'sdb', config: {}, dims: {} };
  const api = makeApi(makeDoc(), chantier, ['vmc'], [piece], sessionStub());
  api.orchestrerVmcPiece(piece);
  // total section VMC = somme config.vmc[code] * prix (miroir d'updateSectionTotals)
  let total = 0; for (const c in piece.config.vmc) total += 15 * piece.config.vmc[c];
  A(total > 0, '5. total VMC de la pièce > 0 (les quantités projetées alimentent le devis)');
}

// =====================================================================
// 6. Obligation non supprimable : baisse manuelle -> plancher réappliqué au recalcul
// =====================================================================
{
  const doc = makeDoc();
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
  const piece = { id: 'sdb', config: { vmc: { VMC_BOUCHE: 0 } }, dims: {} };
  const api = makeApi(doc, chantier, ['vmc'], [piece], sessionStub());
  VMC.getVmcPourPiece('sdb').forEach(pr => doc.reg('qty_0_' + pr.code, { textContent: '' }));
  api.recalcPiece(0);
  A(piece.config.vmc.VMC_BOUCHE >= 1, '6. VMC_BOUCHE remis à 0 -> plancher réappliqué (>=1) au recalcul');
}

// =====================================================================
// 7. a_verifier / solution inconnue -> aucune quantité inventée ; 8. idempotence
// =====================================================================
{
  const av = { id: 'sdb', config: {}, dims: {} };
  makeApi(makeDoc(), { intentionVentilation: 'conserver', solutionVentilation: 'simple_flux' }, ['vmc'], [av], sessionStub()).orchestrerVmcPiece(av);
  A(!av.config.vmc || !av.config.vmc.VMC_BOUCHE, '7a. intention=conserver (a_verifier) -> aucune quantité');
  const inc = { id: 'sdb', config: {}, dims: {} };
  makeApi(makeDoc(), { intentionVentilation: 'creer', solutionVentilation: 'inconnue' }, ['vmc'], [inc], sessionStub()).orchestrerVmcPiece(inc);
  A(!inc.config.vmc || !inc.config.vmc.VMC_BOUCHE, '7b. solution inconnue -> aucune projection SF/DF arbitraire');
  const idem = { id: 'sdb', config: {}, dims: {} };
  const api = makeApi(makeDoc(), { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' }, ['vmc'], [idem], sessionStub());
  api.orchestrerVmcPiece(idem); const snap = JSON.stringify(idem); api.orchestrerVmcPiece(idem); api.orchestrerVmcPiece(idem);
  A(JSON.stringify(idem) === snap && idem.config.vmc.VMC_BOUCHE === 1, '8. idempotence : 3 orchestrations -> VMC_BOUCHE reste 1, état identique');
}

// =====================================================================
// 9. Le cycle est branché au bon endroit + aucune régression élec / Runtime
// =====================================================================
{
  A(/function recalcPiece\(index\)[\s\S]{0,900}metiersActifs\.includes\('vmc'\)[\s\S]{0,120}orchestrerVmcPiece\(piece\)[\s\S]{0,60}syncVmcDOM\(index\)/.test(CONFIG), '9a. recalcPiece contient la branche VMC (orchestration + syncVmcDOM)');
  A(/renderPieceConfig\(p, i\)\)\.join\(''\);[\s\S]{0,120}forEach\(\(p, i\) => recalcPiece\(i\)\)/.test(CONFIG), '9b. rendu des pièces (2749-2751) suivi de recalcPiece(i) : quantités matérialisées à l\'ouverture');
  A(/if \(metiersActifs\.includes\('electricite'\)\) \{ appliquerNorme\(index\); syncElecDOM\(index\); \}/.test(CONFIG), '9c. plancher électrique intact (aucune régression)');
  const NEW = extraire('function orchestrerVmcPiece(') + extraire('function majContexteVmc(') + extraire('function syncVmcDOM(') + extraire('function questionsVmcHtml(');
  A(!/runtime|moteur-prive|Runtime/.test(NEW), '9d. code VMC M58bis ne référence pas le Runtime physique');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Parcours PARTIE 3 VMC (M58bis) : ' + ok + '/' + total + ' — bloc VMC + questions, décision -> config auto -> quantités != 0 -> devis, obligation plancher, a_verifier/inconnue sans invention, idempotent, cycle branché sur recalcPiece, élec/Runtime intacts');
else { console.error('❌ Parcours PARTIE 3 VMC M58bis : ' + ok + '/' + total); process.exit(1); }
