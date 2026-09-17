// =====================================================================
// tests/vmc-orchestration-m58.test.js — M58 : orchestration questionnaire → configuration VMC
// =====================================================================
// M58 est une couche d'ORCHESTRATION. Elle NE crée AUCUNE règle réglementaire/métier :
// elle réutilise obligationsVmc() (vmc-public.js) + fonctionsVmcRetenues()/_contexteVmc()/
// projeterVmcVersConfig() (devis-configurateur.html). Rôle : matérialiser la couche
// fonctionnelle piece.ventilationFonctions pour les pièces à rôle VMC en périmètre, AVANT
// l'ouverture de la configuration par pièce, afin que la projection tarifaire ne reste pas
// à 0. Déterministe, idempotent, non destructif, sans doublon, aucune quantité inventée.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Fabrique : orchestrerVmcPiece bindé (piece dans le périmètre) -----------------
function makeOrch(chantier, metiers, piece) {
  const src = extraire(CONFIG, 'function _contexteVmc(') + '\n' +
              extraire(CONFIG, 'function fonctionsVmcRetenues(') + '\n' +
              extraire(CONFIG, 'function projeterVmcVersConfig(') + '\n' +
              extraire(CONFIG, 'function orchestrerVmcPiece(') + '\n;return orchestrerVmcPiece;';
  const sessionStorage = { getItem: () => null };
  return new Function('obligationsVmc', 'chantier', 'metiersActifs', 'sessionStorage', 'modeChantier', 'piecesSelectionnees',
    src)(VMC.obligationsVmc, chantier, metiers, sessionStorage, 'complet', [piece]);
}
function orchestrer(chantier, metiers, piece) { makeOrch(chantier, metiers, piece)(piece); return piece; }

// fonctionsVmcRetenues pure (mécanisme statuts), pour recommandé/libre (aucune règle inventée)
const fonctionsVmcRetenues = new Function(extraire(CONFIG, 'function fonctionsVmcRetenues(') + '\n;return fonctionsVmcRetenues;')();

const CH_SF = { intentionVentilation: 'creer', solutionVentilation: 'simple_flux' };
const CH_HYGRO = { intentionVentilation: 'creer', solutionVentilation: 'hygro' };
const CH_DF = { intentionVentilation: 'creer', solutionVentilation: 'double_flux' };
const CH_INC = { intentionVentilation: 'creer', solutionVentilation: 'inconnue' };
const CH_CONSERVER = { intentionVentilation: 'conserver', solutionVentilation: 'simple_flux' };

A(/function orchestrerVmcPiece\(/.test(CONFIG) && /projeterVmcToutesPieces[\s\S]{0,140}orchestrerVmcPiece\(/.test(CONFIG), '0. orchestrateur M58 présent (orchestrerVmcPiece) et projeterVmcToutesPieces y délègue');

// =====================================================================
// 1. QUESTIONNAIRE — majTypeVentilation() (devis.html)
// =====================================================================
{
  const SRC = extraire(DEVIS, 'function majTypeVentilation()');
  function run(vmcVal, selInit) {
    const bloc = { style: {} };
    const sel = { value: selInit != null ? selInit : 'inconnu' };
    const els = { blocTypeVentilation: bloc, typeVentilationExistante: sel, vmc: { value: vmcVal } };
    const document = { getElementById: (id) => els[id] || null };
    new Function('document', SRC + ';majTypeVentilation();')(document);
    return { display: bloc.style.display, value: sel.value };
  }
  A(run('non').display === 'none', '1a. vmc=non → question du type existant cachée');
  A(run('oui').display === '', '1b. vmc=oui (fonctionnelle) → question du type existant visible');
  A(run('defaillante').display === '', '1c. vmc=defaillante → question du type existant visible');
  A(run('non', 'vmc_motorisee').value === 'inconnu', '1d. vmc=non → vmc_motorisee jamais retenu (réinit. inconnu)');
  A(run('oui', 'inconnu').value !== 'vmc_motorisee' && run('defaillante', 'inconnu').value !== 'vmc_motorisee', '1e. aucun forçage silencieux de vmc_motorisee');
}

// =====================================================================
// 2. FONCTION OBLIGATOIRE — ajout auto, non supprimable, réappliquée, explication
// =====================================================================
{
  const p = { id: 'sdb', config: {} };
  orchestrer(CH_SF, ['vmc'], p);
  A(p.ventilationFonctions && typeof p.ventilationFonctions === 'object', '2a. obligatoire → couche fonctionnelle matérialisée automatiquement');
  A(p.config.vmc && p.config.vmc.VMC_BOUCHE === 1, '2b. obligatoire projetée → VMC_BOUCHE = 1 (déterminable)');
  const eff = fonctionsVmcRetenues(VMC.obligationsVmc('sdb', { intention: 'creer', solution: 'simple_flux', perimetre: 'complet', pieceEnScope: true, metiersActifs: ['vmc'] }), p.ventilationFonctions);
  A(eff.extraction && eff.extraction.present === true && eff.extraction.verrou === true, '2c. obligatoire = présente + verrou (non supprimable)');
  // Réappliquée au recalcul même si une donnée historique tente de la retirer (plancher fonctionnel)
  const p2 = { id: 'sdb', config: {}, ventilationFonctions: { extraction: false } };
  orchestrer(CH_SF, ['vmc'], p2);
  A(p2.config.vmc && p2.config.vmc.VMC_BOUCHE >= 1, '2d. obligation retirée artificiellement → plancher réappliqué (VMC_BOUCHE ≥ 1)');
  A(/🔒 Nécessaire/.test(CONFIG) && /nécessaire pour la configuration de ventilation retenue/.test(CONFIG), '2e. explication obligatoire visible dans l\'UI');
}

// =====================================================================
// 3. FONCTION RECOMMANDÉE — présente par défaut, supprimable, suppression persistante
// =====================================================================
{
  const rec = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'recommande' } }, {});
  A(rec.entree_air.present === true && rec.entree_air.verrou === false, '3a. recommandé → présent par défaut + supprimable (pas de verrou)');
  const recOff = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'recommande' } }, { entree_air: false });
  A(recOff.entree_air.present === false, '3b. recommandé retiré (choix client false) → reste retiré');
  A(/💡 Recommandé/.test(CONFIG) && /Vous pouvez la retirer/.test(CONFIG), '3c. explication recommandé visible dans l\'UI');
}

// =====================================================================
// 4. FONCTION À VÉRIFIER — aucune quantité, aucune projection
// =====================================================================
{
  const p = { id: 'sdb', config: {} };
  orchestrer(CH_CONSERVER, ['vmc'], p); // intention=conserver → a_verifier
  A(!p.config.vmc || !p.config.vmc.VMC_BOUCHE, '4a. a_verifier → aucune projection (aucune quantité)');
  A(/⚠ À vérifier/.test(CONFIG) && /Aucune quantité/.test(CONFIG), '4b. explication à vérifier visible (aucune quantité inventée)');
}

// =====================================================================
// 5. FONCTION LIBRE — aucune imposition automatique
// =====================================================================
{
  const libreOff = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'libre' } }, {});
  A(libreOff.entree_air.present === false && libreOff.entree_air.verrou === false, '5a. libre → aucune imposition automatique');
  const libreOn = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'libre' } }, { entree_air: true });
  A(libreOn.entree_air.present === true, '5b. libre → activable par choix client uniquement');
}

// =====================================================================
// 6. PROJECTION avant ouverture — SF / hygro / DF / inconnue / contexte incomplet
// =====================================================================
{
  const sf = orchestrer(CH_SF, ['vmc'], { id: 'sdb', config: {} });
  A(sf.config.vmc.VMC_BOUCHE === 1, '6a. simple_flux → projeté avant ouverture (VMC_BOUCHE=1)');
  const hy = orchestrer(CH_HYGRO, ['vmc'], { id: 'sdb', config: {} });
  A(hy.config.vmc.VMC_BOUCHE === 1, '6b. hygro → projeté (même périmètre autorisé)');
  const df = orchestrer(CH_DF, ['vmc'], { id: 'chambre', config: {} });
  A(!df.config.vmc || Object.keys(df.config.vmc).length === 0, '6c. double_flux → aucune projection tarifaire inventée');
  const inc = orchestrer(CH_INC, ['vmc'], { id: 'sdb', config: {} });
  A(!inc.config.vmc || !inc.config.vmc.VMC_BOUCHE, '6d. solution inconnue → aucune projection SF/DF arbitraire');
  const noGate = orchestrer(CH_SF, ['electricite'], { id: 'sdb', config: {} }); // vmc non actif
  A((!noGate.config.vmc || Object.keys(noGate.config.vmc).length === 0) && noGate.ventilationFonctions === undefined, '6e. contexte incomplet (métier vmc absent) → aucun effet');
}

// =====================================================================
// 7. IDEMPOTENCE — projection deux/trois fois = même état, aucun doublon
// =====================================================================
{
  const p = { id: 'sdb', config: {} };
  const fn = makeOrch(CH_SF, ['vmc'], p);
  fn(p);
  const s1 = JSON.stringify(p);
  fn(p); fn(p);
  const s3 = JSON.stringify(p);
  A(s1 === s3, '7a. idempotence : orchestration 1× == 3× (état identique)');
  A(p.config.vmc.VMC_BOUCHE === 1, '7b. aucune augmentation répétée (VMC_BOUCHE reste 1)');
  A(Object.keys(p.ventilationFonctions).length === 0, '7c. aucun doublon dans la couche fonctionnelle');
}

// =====================================================================
// 8. DÉCISION CLIENT — recommandé supprimé reste supprimé ; obligation réappliquée
// =====================================================================
{
  // Recommandé retiré puis « recalcul » (nouvelle réconciliation) → reste retiré
  const r1 = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'recommande' } }, { entree_air: false });
  const r2 = fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'recommande' } }, { entree_air: false });
  A(r1.entree_air.present === false && r2.entree_air.present === false, '8a. recommandé supprimé → reste supprimé après recalcul');
  // Obligation « retirée » artificiellement dans les données → réappliquée (source = obligationsVmc)
  const eff = fonctionsVmcRetenues(VMC.obligationsVmc('sdb', { intention: 'creer', solution: 'simple_flux', perimetre: 'complet', pieceEnScope: true, metiersActifs: ['vmc'] }), { extraction: false });
  A(eff.extraction.present === true, '8b. obligation retirée artificiellement → réappliquée (ventilationFonctions n\'est pas la source des obligations)');
}

// =====================================================================
// 9. RÉGRESSION / Golden Masters — sessions anciennes préservées
// =====================================================================
{
  // Ancienne session, métier vmc absent → aucune matérialisation, config intacte
  const old1 = { id: 'sdb', config: { electricite: { ELEC_PRISE10: 3 } } };
  orchestrer(CH_SF, ['electricite'], old1);
  A(old1.ventilationFonctions === undefined && old1.config.electricite.ELEC_PRISE10 === 3, '9a. vmc non actif → Golden Master intact (aucune projection, élec inchangée)');
  // vmc actif mais solution inconnue → couche matérialisée mais AUCUNE quantité inventée
  const inc = orchestrer(CH_INC, ['vmc'], { id: 'sdb', config: {} });
  A(inc.ventilationFonctions && (!inc.config.vmc || !inc.config.vmc.VMC_BOUCHE), '9b. solution inconnue → couche fonctionnelle sans quantité (rien inventé)');
  // Garde historique de projeterVmcVersConfig conservée (compat sessions sans ventilationFonctions)
  A(/if \(!piece \|\| !piece\.ventilationFonctions\) return/.test(extraire(CONFIG, 'function projeterVmcVersConfig(')), '9c. garde ventilationFonctions de projeterVmcVersConfig intacte');
}

// =====================================================================
// 10. ARCHITECTURE — aucune règle nouvelle, Runtime/catalogue/moteurs intacts
// =====================================================================
{
  const ORCH = extraire(CONFIG, 'function orchestrerVmcPiece(').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Réutilise les règles existantes, n'en définit aucune :
  A(/obligationsVmc\(/.test(ORCH) && /fonctionsVmcRetenues/.test(ORCH) && /projeterVmcVersConfig\(/.test(ORCH), '10a. orchestrateur réutilise obligationsVmc/fonctionsVmcRetenues/projeterVmcVersConfig');
  // Aucune règle réglementaire recopiée dans l'orchestrateur (pas de liste de pièces, de codes fonction, de statuts)
  A(!/SORTIE_AIR|ADMISSION_AIR|INSUFFLATION|reglementaire|VMC_BOUCHE|VMC_ENTREE_AIR/.test(ORCH), '10b. aucune règle/def réglementaire recopiée dans l\'UI (orchestration pure)');
  A(!/'sdb'|'cuisine'|'chambre'|_vmcRole|debit|NF |m3\/h/.test(ORCH), '10c. aucune classification de pièce ni grandeur physique dans l\'orchestrateur');
  // Runtime jamais référencé par l'orchestration
  A(!/runtime|moteur-prive|Runtime/.test(ORCH), '10d. orchestrateur ne touche pas le Runtime');
  // Moteurs de calcul non impactés par la projection
  const PIECE = fs.readFileSync(path.join(RACINE, 'js', 'moteur-piece.js'), 'utf8');
  const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
  A(!/orchestrerVmc|ventilationFonctions/.test(PIECE) && !/orchestrerVmc|ventilationFonctions/.test(MOTEUR), '10e. moteur-piece / moteur-devis non modifiés');
  // Module de règles vmc-public.js : obligationsVmc reste la seule source de statuts (non redéfinie ailleurs)
  A(!/function obligationsVmc\(/.test(CONFIG), '10f. obligationsVmc non redéfinie dans l\'UI (règles = vmc-public.js)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Orchestration VMC (M58) : ' + ok + '/' + total + ' — questionnaire corrigé, obligations auto-projetées avant ouverture, recommandé/libre/à-vérifier respectés, idempotent, décisions client conservées, aucune règle nouvelle, Runtime/moteurs intacts, aucune quantité inventée');
else { console.error('❌ Orchestration VMC M58 : ' + ok + '/' + total); process.exit(1); }
