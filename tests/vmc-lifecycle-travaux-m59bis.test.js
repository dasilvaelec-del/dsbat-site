// =====================================================================
// tests/vmc-lifecycle-travaux-m59bis.test.js — M59bis : le VRAI cycle du clic « VMC »
// =====================================================================
// Reproduit le LIFECYCLE RÉEL, pas un appel interne direct :
//   Étape 3 « Sélectionnez vos travaux » (devis.html) -> l'utilisateur COCHE « VMC » (#m_vmc)
//   -> l'événement 'change' déclenche le VRAI handler majBlocVmcTravaux -> le bloc VMC devient
//   VISIBLE -> l'utilisateur répond (intention/solution) -> la VRAIE collecterDonnees écrit
//   chantier.intentionVentilation / solutionVentilation -> persistance sessionStorage
//   -> le configurateur (cycle M59 INCHANGÉ : obligationsVmc -> fonctions -> projection -> groupe)
//   -> bouches obligatoires + groupe/caisson DÉJÀ présents (aucun ajout manuel).
// Portable : shim DOM minimal (aucune dépendance), mais fonctions et dispatch d'événement RÉELS.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const CAT = fs.readFileSync(path.join(RACINE, 'js', 'vue-tarifaire-data.js'), 'utf8');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) return src.slice(s, i + 1); } }
  throw new Error('fin introuvable: ' + sig);
}

// ---- Shim DOM minimal (les éléments réellement touchés par le parcours) --------------
function makeChangeEl(props) { return Object.assign({ _l: [], style: {}, addEventListener(t, f) { this._l.push([t, f]); }, dispatchEvent(e) { this._l.filter(x => x[0] === e.type).forEach(x => x[1](e)); return true; } }, props); }
function makeDom(metiersCoches, intentionVal, solutionVal) {
  const reg = {
    m_vmc: makeChangeEl({ checked: metiersCoches.includes('vmc') }),
    vmcProjetBloc: { style: { display: 'none' } },
    intentionVentilation: { value: intentionVal },
    solutionVentilation: { value: solutionVal }
  };
  return {
    _reg: reg,
    getElementById(id) { return reg[id] || { value: '', style: {} }; },
    querySelectorAll(sel) {
      if (/name="metier"/.test(sel)) return metiersCoches.map(v => ({ value: v }));
      return [];
    }
  };
}

// ---- Fonctions RÉELLES de devis.html (handler + collecte) -----------------------------
function apiDevis(document) {
  const src = extraire(DEVIS, 'function majBlocVmcTravaux(') + '\n' + extraire(DEVIS, 'function collecterDonnees(') +
    '\nreturn { majBlocVmcTravaux, collecterDonnees };';
  return new Function('document', src)(document);
}

// ---- Cycle RÉEL du configurateur (M59, inchangé) -------------------------------------
function apiConfig(chantier, metiersActifs, piecesSelectionnees, sessionStorage) {
  const src =
    extraire(CONFIG, 'function _contexteVmc(') + '\n' +
    extraire(CONFIG, 'function fonctionsVmcRetenues(') + '\n' +
    extraire(CONFIG, 'function projeterVmcVersConfig(') + '\n' +
    extraire(CONFIG, 'function orchestrerVmcPiece(') + '\n' +
    extraire(CONFIG, 'function projeterVmcToutesPieces(') + '\n' +
    extraire(CONFIG, 'function _vmcCodeCaisson(') + '\n' +
    extraire(CONFIG, 'function _vmcInstallationRetenue(') + '\n' +
    extraire(CONFIG, 'function projeterGroupeVmc(') + '\n' +
    'return { projeterVmcToutesPieces };';
  return new Function('obligationsVmc', 'chantier', 'metiersActifs', 'piecesSelectionnees', 'sessionStorage', 'modeChantier', src)(
    VMC.obligationsVmc, chantier, metiersActifs, piecesSelectionnees, sessionStorage, 'complet');
}
function ssStub(extra) { const m = Object.assign({ perimetreTravaux: 'complet' }, extra || {}); return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; }
function pieces() { return [{ id: 'sdb', config: {}, dims: {} }, { id: 'sejour', config: {}, dims: {} }]; }
function caissons(ps) { const o = []; ps.forEach(p => { const v = (p.config && p.config.vmc) || {}; ['VMC_CAISSON_SF', 'VMC_CAISSON_DF'].forEach(c => { if (v[c]) o.push({ piece: p.id, code: c }); }); }); return o; }

// ===== LE PARCOURS RÉEL, de bout en bout =====
// clic VMC -> bloc visible -> réponses -> collecte -> sessionStorage -> configurateur.
function parcoursReel(intention, solution, vmcCoche) {
  const metiers = vmcCoche ? ['vmc'] : [];
  const document = makeDom(metiers, intention, solution);
  const dv = apiDevis(document);
  const blocAvant = document.getElementById('vmcProjetBloc').style.display;
  // VRAI clic : on coche puis on DISPATCHE l'événement 'change' (le handler y est abonné).
  const cb = document.getElementById('m_vmc');
  cb.addEventListener('change', dv.majBlocVmcTravaux);   // équivaut à onchange="majBlocVmcTravaux()"
  cb.dispatchEvent({ type: 'change' });
  const blocApres = document.getElementById('vmcProjetBloc').style.display;
  // VRAIE collecte -> chantier (comme envoyerDevis), puis persistance sessionStorage.
  const data = dv.collecterDonnees();
  const chantier = Object.assign({}, data.chantier, { description: '' });
  const ss = ssStub();
  ss.setItem('chantier', JSON.stringify(chantier));
  ss.setItem('devisMetiers', JSON.stringify(data.metiers));
  // Configurateur : relit chantier depuis sessionStorage et projette.
  const chantierConfig = JSON.parse(ss.getItem('chantier'));
  const metiersActifs = JSON.parse(ss.getItem('devisMetiers'));
  const ps = pieces();
  if (metiersActifs.includes('vmc')) apiConfig(chantierConfig, metiersActifs, ps, ss).projeterVmcToutesPieces();
  return { blocAvant, blocApres, chantier, metiers: data.metiers, ps };
}

// ===== 1. AVANT clic VMC : bloc caché, aucune projection =====
{
  const r = parcoursReel('inconnu', 'inconnue', false);
  A(!/id="intentionVentilation"/.test(DEVIS) && !/id="solutionVentilation"/.test(DEVIS), '1a. LOT32 : questions VMC retirées du funnel (déplacées vers le questionnaire)');
  A(r.blocApres === 'none', '1b. VMC NON coché -> bloc VMC reste caché');
  A(!r.metiers.includes('vmc') && caissons(r.ps).length === 0, '1c. VMC non retenu -> aucune projection');
}

// ===== 2. LE SCÉNARIO DEMANDÉ : clic VMC -> panneau visible -> remplacer+hygro -> configurateur =====
{
  const r = parcoursReel('remplacer', 'hygro', true);
  A(r.blocAvant === 'none' && r.blocApres !== 'none', '2a. clic VMC -> bloc VMC devient VISIBLE immédiatement (Étape Travaux)');
  A(r.chantier.intentionVentilation === 'remplacer' && r.chantier.solutionVentilation === 'hygro', '2b. réponses collectées dans chantier (intention=remplacer, solution=hygro)');
  A(r.ps[0].config.vmc && r.ps[0].config.vmc.VMC_BOUCHE === 1, '2c. configurateur : bouche d\'extraction DÉJÀ présente (aucun ajout manuel)');
  const c = caissons(r.ps);
  A(c.length === 1 && c[0].code === 'VMC_CAISSON_SF', '2d. configurateur : groupe VMC_CAISSON_SF DÉJÀ présent (hygro = famille SF)');
}

// ===== 3. Comportements M59 conservés, via le parcours réel =====
{
  const sf = parcoursReel('creer', 'simple_flux', true);
  A(caissons(sf.ps).map(x => x.code).join() === 'VMC_CAISSON_SF' && sf.ps[0].config.vmc.VMC_BOUCHE === 1, '3a. creer+simple_flux -> VMC_CAISSON_SF + bouches');
  const df = parcoursReel('creer', 'double_flux', true);
  A(caissons(df.ps).map(x => x.code).join() === 'VMC_CAISSON_DF', '3b. creer+double_flux -> VMC_CAISSON_DF');
  const cons = parcoursReel('conserver', 'simple_flux', true);
  A(caissons(cons.ps).length === 0 && (!cons.ps[0].config.vmc || !cons.ps[0].config.vmc.VMC_BOUCHE), '3c. conserver -> aucun caisson, aucune bouche');
  const rep = parcoursReel('reparer', 'simple_flux', true);
  A(caissons(rep.ps).length === 0, '3d. reparer -> aucun remplacement (pas de caisson)');
  const inc = parcoursReel('creer', 'inconnue', true);
  A(caissons(inc.ps).length === 0, '3e. solution inconnue -> aucune invention (pas de caisson)');
}

// ===== 4. Idempotence via le parcours réel =====
{
  const r = parcoursReel('remplacer', 'hygro', true);
  const snap = JSON.stringify(r.ps.map(p => p.config.vmc || {}));
  // relancer le cycle configurateur deux fois de plus sur les mêmes pièces
  const ss = ssStub(); const ma = ['vmc'];
  apiConfig(r.chantier, ma, r.ps, ss).projeterVmcToutesPieces();
  apiConfig(r.chantier, ma, r.ps, ss).projeterVmcToutesPieces();
  A(JSON.stringify(r.ps.map(p => p.config.vmc || {})) === snap, '4a. idempotence : projections répétées -> état identique');
  A(caissons(r.ps).length === 1, '4b. idempotence : toujours 1 seul groupe');
}

// ===== 5. Codes RÉELS du catalogue + branchement du handler =====
{
  A(/"VMC_CAISSON_SF"\s*:/.test(CAT) && /"VMC_CAISSON_DF"\s*:/.test(CAT), '5a. VMC_CAISSON_SF/DF réels dans le catalogue (aucun code inventé)');
  A(/id="m_vmc"[^>]*onchange="majBlocVmcTravaux\(\)"/.test(DEVIS), '5b. le HANDLER RÉEL est branché sur la case VMC (#m_vmc onchange=majBlocVmcTravaux)');
  A(/if \(metiersActifs\.includes\('electricite'\)\) \{ appliquerNorme\(index\); syncElecDOM\(index\); \}/.test(CONFIG), '5c. plancher électrique intact (aucune régression)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Lifecycle VMC réel (M59bis) : ' + ok + '/' + total + ' — clic #m_vmc -> bloc visible -> remplacer+hygro -> configurateur : bouches + VMC_CAISSON_SF déjà présents ; M59 (SF/hygro/DF, conserver/reparer/inconnue, idempotence) conservé ; élec intacte');
else { console.error('❌ Lifecycle VMC réel M59bis : ' + ok + '/' + total); process.exit(1); }
