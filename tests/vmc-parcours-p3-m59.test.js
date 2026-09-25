// =====================================================================
// tests/vmc-parcours-p3-m59.test.js — M59 : parcours PARTIE 3 (questions PROJET) + groupe/moteur
// =====================================================================
// Cycle réel reproduit avec les VRAIES fonctions extraites de devis-configurateur.html :
//   Partie 3 -> sélection VMC -> questions intention/solution AU NIVEAU PROJET
//   -> règles (obligationsVmc) -> fonctions obligatoires (fonctionsVmcRetenues)
//   -> groupe/moteur (projeterGroupeVmc) + bouches (projeterVmcVersConfig)
//   -> quantités (piece.config.vmc) -> prix (somme catalogue).
// Le client n'ajoute NI le moteur NI les bouches obligatoires manuellement.
// Codes catalogue RÉELS : VMC_CAISSON_SF (SF/hygro) et VMC_CAISSON_DF (DF).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CAT = fs.readFileSync(path.join(RACINE, 'js', 'vue-tarifaire-data.js'), 'utf8');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = CONFIG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CONFIG.indexOf('{', s), d = 0, e = -1;
  for (; i < CONFIG.length; i++) { if (CONFIG[i] === '{') d++; else if (CONFIG[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return CONFIG.slice(s, e);
}
function makeDoc() {
  const store = {};
  return { _store: store,
    reg(id, el) { store[id] = el || { textContent: '', value: '', style: {}, innerHTML: '' }; return store[id]; },
    getElementById(id) { return store[id] || null; } };
}
// Bundle des VRAIES fonctions M59 (aucune ré-implémentation).
function makeApi(doc, chantier, metiersActifs, piecesSelectionnees, sessionStorage) {
  const src =
    extraire('function _contexteVmc(') + '\n' +
    extraire('function fonctionsVmcRetenues(') + '\n' +
    extraire('function projeterVmcVersConfig(') + '\n' +
    extraire('function orchestrerVmcPiece(') + '\n' +
    extraire('function projeterVmcToutesPieces(') + '\n' +
    extraire('function _vmcCodeCaisson(') + '\n' +
    extraire('function _vmcInstallationRetenue(') + '\n' +
    extraire('function projeterGroupeVmc(') + '\n' +
    extraire('function _vmcGroupeInfoHtml(') + '\n' +
    extraire('function questionsVmcProjetHtml(') + '\n' +
    extraire('function majContexteVmcProjet(') + '\n' +
    extraire('function renderVmcProjetBloc(') + '\n' +
    extraire('function syncVmcDOM(') + '\n' +
    extraire('function renderPrestRow(') + '\n' +
    extraire('function renderMetierSection(') + '\n' +
    extraire('function getVmcPourPieceUI(') + '\n' +
    // recalcPiece : reproduit EXACTEMENT la branche VMC de la production (orchestration + affichage).
    'function recalcPiece(index){ var piece=piecesSelectionnees[index]; if(!piece)return;' +
    ' if(metiersActifs.includes("vmc")){ if(typeof orchestrerVmcPiece==="function") orchestrerVmcPiece(piece); syncVmcDOM(index); } }\n' +
    'return { renderMetierSection, questionsVmcProjetHtml, majContexteVmcProjet, projeterVmcToutesPieces, projeterGroupeVmc, _vmcCodeCaisson, _vmcInstallationRetenue, orchestrerVmcPiece, syncVmcDOM, _contexteVmc };';
  const getPrixPrestFor = () => ({ min: 10, max: 20, unite: 'U' });
  const getMoyenPrixFor = () => 15;
  const formatEuro = (v) => String(v) + ' €';
  const findPrestLabel = (code) => (code === 'VMC_CAISSON_SF' ? 'Caisson VMC simple flux' : code === 'VMC_CAISSON_DF' ? 'Caisson VMC double flux' : code);
  const objectifProjet = 'standard';
  const modeChantier = 'complet';
  return new Function('document', 'obligationsVmc', 'getVmcPourPiece', '_vmcRole', 'chantier', 'metiersActifs',
    'piecesSelectionnees', 'sessionStorage', 'modeChantier', 'getPrixPrestFor', 'getMoyenPrixFor',
    'formatEuro', 'findPrestLabel', 'objectifProjet', src)(
    doc, VMC.obligationsVmc, VMC.getVmcPourPiece, VMC._vmcRole, chantier, metiersActifs, piecesSelectionnees,
    sessionStorage, modeChantier, getPrixPrestFor, getMoyenPrixFor, formatEuro, findPrestLabel, objectifProjet);
}
function sessionStub() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; }
function pieces() { return [ { id: 'sdb', config: {}, dims: {} }, { id: 'sejour', config: {}, dims: {} } ]; }
function caissonsDe(ps) { const out = []; ps.forEach(p => { const v = (p.config && p.config.vmc) || {}; ['VMC_CAISSON_SF','VMC_CAISSON_DF'].forEach(c => { if (v[c]) out.push({ piece: p.id, code: c, q: v[c] }); }); }); return out; }
function prixVmc(ps) { let t = 0; ps.forEach(p => { const v = (p.config && p.config.vmc) || {}; Object.keys(v).forEach(c => t += 15 * v[c]); }); return t; }

// =====================================================================
// 1. Questions UNIQUEMENT au niveau PROJET, PLUS dans la config par pièce
// =====================================================================
{
  const chantier = { intentionVentilation: 'inconnu', solutionVentilation: 'inconnue' };
  const ps = pieces();
  const api = makeApi(makeDoc(), chantier, ['vmc'], ps, sessionStub());
  const bloc = api.questionsVmcProjetHtml();
  A(!/<select id="vmc_intention_projet"/.test(bloc) && !/<select id="vmc_solution_projet"/.test(bloc), '1a. LOT32 : bloc PROJET = rappel lecture seule (plus de question éditable)');
  A(/Votre projet de ventilation/.test(bloc) && /Intention/.test(bloc), '1b. rappel VMC affiche intention/solution (lecture seule)');
  const sect = api.renderMetierSection({ metier: 'vmc', icon: 'V', label: 'VMC', prests: VMC.getVmcPourPiece('sdb') }, 0);
  A(!/vmc_intention/.test(sect) && !/vmc_solution/.test(sect) && !/majContexteVmc/.test(sect), '1c. config PAR PIÈCE : AUCUNE question intention/solution');
  A(/id="qty_0_VMC_BOUCHE"/.test(sect), '1d. config par pièce : prestations VMC (bouches) toujours rendues');
  A(!/questionsVmcHtml\(pieceIndex\)/.test(CONFIG), '1e. plus aucun appel questionsVmcHtml(pieceIndex) dans le configurateur');
  A(/<div id="vmcProjetBloc"><\/div>/.test(CONFIG), '1f. conteneur #vmcProjetBloc présent au-dessus des pièces (Partie 3)');
}

// =====================================================================
// 2. creer + simple_flux -> groupe VMC_CAISSON_SF + bouches (auto)
// =====================================================================
{
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
  const ps = pieces();
  const api = makeApi(makeDoc(), chantier, ['vmc'], ps, sessionStub());
  api.projeterVmcToutesPieces();
  const cais = caissonsDe(ps);
  A(cais.length === 1 && cais[0].code === 'VMC_CAISSON_SF' && cais[0].q === 1, '2a. creer+simple_flux -> 1 groupe VMC_CAISSON_SF (compté une seule fois)');
  A(ps[0].config.vmc && ps[0].config.vmc.VMC_BOUCHE === 1, '2b. bouche d\'extraction SDB projetée automatiquement (=1)');
  A(prixVmc(ps) > 0, '2c. quantités chiffrées (groupe + bouches alimentent le devis)');
}

// =====================================================================
// 3. remplacer + hygro -> groupe VMC_CAISSON_SF (hygro = famille SF) + bouches
// =====================================================================
{
  const chantier = { intentionVentilation: 'remplacer', solutionVentilation: 'hygro' };
  const ps = pieces();
  const api = makeApi(makeDoc(), chantier, ['vmc'], ps, sessionStub());
  api.projeterVmcToutesPieces();
  const cais = caissonsDe(ps);
  A(cais.length === 1 && cais[0].code === 'VMC_CAISSON_SF', '3a. remplacer+hygro -> groupe VMC_CAISSON_SF (aucun code hygro inventé)');
  A(ps[0].config.vmc && ps[0].config.vmc.VMC_BOUCHE === 1, '3b. bouches nécessaires projetées (hygro tarifé comme SF)');
}

// =====================================================================
// 4. creer + double_flux -> groupe VMC_CAISSON_DF
// =====================================================================
{
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'double_flux' };
  const ps = pieces();
  const api = makeApi(makeDoc(), chantier, ['vmc'], ps, sessionStub());
  api.projeterVmcToutesPieces();
  const cais = caissonsDe(ps);
  A(cais.length === 1 && cais[0].code === 'VMC_CAISSON_DF', '4. creer+double_flux -> 1 groupe VMC_CAISSON_DF');
}

// =====================================================================
// 5. conserver -> AUCUN nouveau groupe ; reparer -> pas de remplacement inventé
// =====================================================================
{
  const cons = pieces();
  makeApi(makeDoc(), { intentionVentilation: 'conserver', solutionVentilation: 'simple_flux' }, ['vmc'], cons, sessionStub()).projeterVmcToutesPieces();
  A(caissonsDe(cons).length === 0, '5a. conserver -> aucun groupe VMC ajouté');
  A(!cons[0].config.vmc || !cons[0].config.vmc.VMC_BOUCHE, '5b. conserver -> aucune bouche inventée');
  const rep = pieces();
  makeApi(makeDoc(), { intentionVentilation: 'reparer', solutionVentilation: 'simple_flux' }, ['vmc'], rep, sessionStub()).projeterVmcToutesPieces();
  A(caissonsDe(rep).length === 0, '5c. reparer -> pas de remplacement complet inventé (aucun groupe)');
}

// =====================================================================
// 6. Aucun code/prix inventé : seuls des codes RÉELS du catalogue sont émis
// =====================================================================
{
  A(/"VMC_CAISSON_SF"\s*:/.test(CAT) && /"VMC_CAISSON_DF"\s*:/.test(CAT), '6a. VMC_CAISSON_SF et VMC_CAISSON_DF existent dans le catalogue (vue-tarifaire-data.js)');
  const sols = ['simple_flux', 'hygro', 'double_flux', 'inconnue'];
  sols.forEach(sol => {
    const ps = pieces();
    const api = makeApi(makeDoc(), { intentionVentilation: 'creer', solutionVentilation: sol }, ['vmc'], ps, sessionStub());
    api.projeterVmcToutesPieces();
    caissonsDe(ps).forEach(c => A(new RegExp('"' + c.code + '"\\s*:').test(CAT), '6b. code groupe « ' + c.code + ' » (' + sol + ') présent dans le catalogue'));
  });
  const inc = pieces();
  makeApi(makeDoc(), { intentionVentilation: 'creer', solutionVentilation: 'inconnue' }, ['vmc'], inc, sessionStub()).projeterVmcToutesPieces();
  A(caissonsDe(inc).length === 0, '6c. solution inconnue -> aucun groupe (pas d\'invention SF/DF)');
}

// =====================================================================
// 7. Idempotence : ré-orchestrations répétées -> état stable, 1 seul groupe
// =====================================================================
{
  const chantier = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
  const ps = pieces();
  const api = makeApi(makeDoc(), chantier, ['vmc'], ps, sessionStub());
  api.projeterVmcToutesPieces();
  const snap = JSON.stringify(ps.map(p => p.config.vmc || {}));
  api.projeterVmcToutesPieces(); api.projeterVmcToutesPieces();
  A(JSON.stringify(ps.map(p => p.config.vmc || {})) === snap, '7a. idempotence : 3 projections -> configs identiques');
  A(caissonsDe(ps).length === 1, '7b. idempotence : toujours exactement 1 groupe (pas de doublon)');
  // changement de solution -> ancien caisson purgé, nouveau posé (pas d'accumulation)
  chantier.solutionVentilation = 'double_flux';
  api.projeterVmcToutesPieces();
  const cais = caissonsDe(ps);
  A(cais.length === 1 && cais[0].code === 'VMC_CAISSON_DF', '7c. changement SF->DF : ancien caisson purgé, 1 seul VMC_CAISSON_DF');
}

// =====================================================================
// 8. CYCLE RÉEL DOM : réponse client (bloc projet) -> config auto -> quantité affichée
// =====================================================================
{
  const doc = makeDoc();
  const chantier = { intentionVentilation: 'inconnu', solutionVentilation: 'inconnue' };
  const ps = pieces();
  const ss = sessionStub();
  const api = makeApi(doc, chantier, ['vmc'], ps, ss);
  doc.reg('vmcProjetBloc', { innerHTML: '' });
  doc.reg('vmc_intention_projet', { value: 'creer' });
  doc.reg('vmc_solution_projet', { value: 'simple_flux' });
  VMC.getVmcPourPiece('sdb').forEach(pr => { doc.reg('qty_0_' + pr.code, { textContent: '0' }); doc.reg('pprix_0_' + pr.code, { textContent: '' }); doc.reg('ptotal_0_' + pr.code, { textContent: '' }); });
  api.majContexteVmcProjet();
  A(chantier.intentionVentilation === 'creer' && chantier.solutionVentilation === 'simple_flux', '8a. majContexteVmcProjet écrit les champs chantier EXISTANTS');
  A(ss.getItem('chantier') && JSON.parse(ss.getItem('chantier')).solutionVentilation === 'simple_flux', '8b. chantier persisté (sessionStorage)');
  A(ps[0].config.vmc && ps[0].config.vmc.VMC_CAISSON_SF === 1, '8c. groupe VMC intégré automatiquement (VMC_CAISSON_SF=1)');
  A(String(doc.getElementById('qty_0_VMC_BOUCHE').textContent) === '1', '8d. quantité bouche affichée dans le DOM = 1 (jamais 0)');
  A(/Groupe VMC inclus automatiquement/.test(doc.getElementById('vmcProjetBloc').innerHTML), '8e. bloc projet affiche « Groupe VMC inclus automatiquement »');
}

// =====================================================================
// 9. Branchement au bon endroit + aucune régression électricité
// =====================================================================
{
  A(/\(piecesSelectionnees \|\| \[\]\)\.forEach\(function \(piece\) \{ orchestrerVmcPiece\(piece\); \}\);\s*\n\s*projeterGroupeVmc\(\);/.test(CONFIG), '9a. projeterVmcToutesPieces enchaîne bouches puis projeterGroupeVmc');
  A(/if \(metiersActifs\.includes\('electricite'\)\) \{ appliquerNorme\(index\); syncElecDOM\(index\); \}/.test(CONFIG), '9b. plancher électrique intact (aucune régression)');
  const NEW = extraire('function projeterGroupeVmc(') + extraire('function majContexteVmcProjet(') + extraire('function questionsVmcProjetHtml(');
  A(!/runtime|moteur-prive|Runtime/.test(NEW), '9c. code VMC M59 ne référence pas le Runtime physique');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Parcours PARTIE 3 VMC + groupe/moteur (M59) : ' + ok + '/' + total + ' — questions au niveau projet (pas par pièce), creer/remplacer -> caisson SF/hygro/DF réel + bouches auto, conserver/reparer/inconnue sans groupe, 1 seul groupe, idempotent, DOM à jour, élec/Runtime intacts');
else { console.error('❌ Parcours PARTIE 3 VMC M59 : ' + ok + '/' + total); process.exit(1); }
