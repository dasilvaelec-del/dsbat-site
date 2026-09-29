// tests/sols-lot38.test.js — LOT38 : refonte du calcul et de la présentation des revêtements de sol.
// Vérifie §13 : carrelage/grand format = prestation complète (fourniture+colle auto),
// réagréage distinct, primaire non systématique, distinction prep-mortier/réagréage,
// seuils gérés par mono-revêtement, plinthes = choix du revêtement, non-régression.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const REV  = require(path.join(RACINE, 'js', 'moteur-revetements.js'));
const CARR = require(path.join(RACINE, 'js', 'moteurs', 'carrelage.js'));
const SOLS = require(path.join(RACINE, 'js', 'moteurs', 'sols.js'));
const CFG  = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const VUE  = fs.readFileSync(path.join(RACINE, 'js', 'vue-tarifaire-data.js'), 'utf8');

// Dépendances résolues à l'appel (comme en navigateur) : on les expose en globales.
global.logementMonoRevetement = REV.logementMonoRevetement;
global.piecesSelectionnees = [];
global.chantier = {};

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- Helpers ------------------------------------------------------------
function applyCarr(mat, surf, dims, extra) {
  const p = Object.assign(
    { id: 'salon', config: {}, faienceMode: 'non', solMateriau: mat,
      dims: Object.assign({ l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 }, dims || {}) },
    extra || {});
  REV.appliquerRevetements(p, surf || { sol: 20, murs: 0 }, ['carrelage']);
  return p;
}
function applySouple(mat, plinthesType, dims) {
  const p = { id: 'salon', config: {}, solMateriau: mat, plinthesType: plinthesType,
    dims: Object.assign({ l: 5, la: 4, portes: 1 }, dims || {}) };
  REV.appliquerRevetements(p, { sol: 20, murs: 0 }, []);
  return p;
}
function oublisCarr(cfg) {
  const p = { id: 'salon', surfaces: { sol: 20, murs: 0 }, dims: { l: 5, la: 4, portes: 1, fenetres: 1 },
    config: { carrelage: Object.assign({ CAR_POSE_SOL: 20 }, cfg || {}) } };
  return CARR.controlesOublisCarr(p).map(o => o.code);
}
function oublisSol(solType, cfg) {
  const p = { id: 'salon', solType: solType, surfaces: { sol: 20 }, dims: { l: 5, la: 4, portes: 1 },
    config: { sols: cfg || {} } };
  return SOLS.controlesOublisSol(p).map(o => o.code);
}
const PERIM = Math.round((2 * (5 + 4) - 0.8 * 1) * 100) / 100; // 17.2 ml

// ===== §1 : LABELS « fourniture + pose » ================================
A(REV.SOL_MATERIAUX.find(m => m.val === 'carrelage').label.indexOf('fourniture + pose') !== -1,
  '§1 label carrelage = « Carrelage — fourniture + pose »');
A(REV.SOL_MATERIAUX.find(m => m.val === 'carrelage_grand').label.indexOf('fourniture + pose') !== -1,
  '§1 label carrelage grand format = « … fourniture + pose »');

// ===== §1-3 : CARRELAGE STANDARD = prestation COMPLÈTE (auto) ===========
const p1 = applyCarr('carrelage', { sol: 20, murs: 0 });
const c1 = p1.config.carrelage;
A(c1.CAR_POSE_SOL === 20, '§1 carrelage std : pose sol = surface');
A(Math.abs(c1.CAR_FOURN_CARREAU - 22) < 0.01, '§3 carrelage std : fourniture carreau AUTO avec pertes (20→22)');
A(c1.CAR_MORTIER_COLLE === 20, '§2 carrelage std : mortier-colle AUTO intégré (=surface)');
A(p1.solMateriau === 'carrelage', '§10 source unique : solMateriau conservé (deriveSolMateriau)');

// ===== §1-3 : CARRELAGE GRAND FORMAT ===================================
const p2 = applyCarr('carrelage_grand', { sol: 20, murs: 0 });
const c2 = p2.config.carrelage;
A(c2.CAR_POSE_SOL_GRAND === 20, '§1 grand format : pose = CAR_POSE_SOL_GRAND');
A(Math.abs(c2.CAR_FOURN_CARREAU - 22.4) < 0.01, '§3 grand format : fourniture AUTO pertes 12% (20→22.4)');
A(c2.CAR_MORTIER_COLLE === 20, '§2 grand format : mortier-colle AUTO intégré');

// ===== §2-4 : plus d'« oublis » pour fourniture/colle ===================
global.piecesSelectionnees = [];
const oc = oublisCarr();
['CAR_FOURN_CARREAU', 'CAR_FOURN_FAIENCE', 'CAR_MORTIER_COLLE', 'CAR_PRIMAIRE', 'CAR_PREP_MORTIER', 'CAR_PLINTHE']
  .forEach(code => A(oc.indexOf(code) === -1, '§4 oublis carrelage : ' + code + ' plus proposé (intégré ou retiré)'));

// ===== §5 : RÉAGRÉAGE = option distincte, NON auto ======================
A(!(c1.CAR_RAGREAGE > 0) && !(c2.CAR_RAGREAGE > 0), '§5 réagréage : NON auto-inclus dans la prestation');
const recoNeuf = CARR.evaluationSupportCarr({ id: 'salon', config: { carrelage: { CAR_POSE_SOL: 20 } } }, { typeProjet: 'neuf' }).map(r => r.code);
A(recoNeuf.indexOf('CAR_RAGREAGE') !== -1, '§5 réagréage : recommandation distincte conservée (neuf)');
const recoOk = CARR.evaluationSupportCarr({ id: 'salon', config: { carrelage: { CAR_POSE_SOL: 20 } } }, { typeProjet: 'renov', etatLieux: 'bon' }).map(r => r.code);
A(recoOk.indexOf('CAR_RAGREAGE') === -1, '§5 réagréage : pas de recommandation si support sain');

// ===== §6 : PRIMAIRE plus systématique =================================
A(!c1.CAR_PRIMAIRE && !c2.CAR_PRIMAIRE, '§6 primaire : aucune génération automatique dans la prestation');
global.chantier = { typeProjet: 'neuf' };
A(oublisCarr().indexOf('CAR_PRIMAIRE') === -1, '§6 primaire : plus généré même en neuf (oublis)');
global.chantier = {};

// ===== §7 : distinction prep-mortier / réagréage, pas de triple prep ====
A(/"CAR_PREP_MORTIER"/.test(VUE), '§7 code catalogue CAR_PREP_MORTIER conservé (non supprimé)');
A(/"CAR_RAGREAGE"/.test(VUE), '§7 code catalogue CAR_RAGREAGE conservé');
A(oc.indexOf('CAR_PREP_MORTIER') === -1 && oc.indexOf('CAR_PRIMAIRE') === -1,
  '§7 pas de préparations support concurrentes générées (ni prep-mortier ni primaire)');

// ===== §8 : SEUILS gérés par mono-revêtement ===========================
A(REV.logementMonoRevetement([]) === true, '§8 mono-revêtement : logement vide/0-1 pièce = mono');
A(REV.logementMonoRevetement([{ config: { carrelage: { CAR_POSE_SOL: 5 } } }, { config: { carrelage: { CAR_POSE_SOL: 8 } } }]) === true,
  '§8 mono-revêtement : carrelage partout = mono');
A(REV.logementMonoRevetement([{ config: { carrelage: { CAR_POSE_SOL: 5 } } }, { solType: 'stratifie', config: {} }]) === false,
  '§8 mono-revêtement : carrelage + stratifié = mixte');
global.piecesSelectionnees = [];
A(oublisCarr().indexOf('CAR_SEUIL') === -1, '§8 seuils carrelage : ABSENTS en logement mono-revêtement');
global.piecesSelectionnees = [{ config: { carrelage: { CAR_POSE_SOL: 20 } } }, { solType: 'stratifie', config: {} }];
A(oublisCarr().indexOf('CAR_SEUIL') !== -1, '§8 seuils carrelage : présents si revêtements mixtes (transition possible)');
global.piecesSelectionnees = [];

// ===== §9 : PLINTHES = choix du revêtement, quantité auto (ml) ==========
A(c1.CAR_PLINTHE === PERIM, '§9 plinthes carrelage : CAR_PLINTHE = périmètre auto (' + PERIM + ' ml)');
const pb = applySouple('parq_flot', 'bois');
A(pb.config.sols && pb.config.sols.SOL_PLINT_BOIS === PERIM, '§9 plinthes bois : SOL_PLINT_BOIS = périmètre (ml)');
const ps = applySouple('stratifie', 'stratifiee');
A(ps.config.sols && ps.config.sols.SOL_PLINT_STR === PERIM, '§9 plinthes stratifiées : SOL_PLINT_STR = périmètre (ml)');
const pn = applyCarr('carrelage', { sol: 20, murs: 0 }, {}, { plinthesType: 'aucune' });
A(!(pn.config.carrelage && pn.config.carrelage.CAR_PLINTHE > 0), '§9 plinthes : choix « aucune » => aucune plinthe');

// §9 UI : sélecteur présent, quantité auto, pas de saisie manuelle, choix mémorisé
A(/id="sol_plinthes_\$\{pieceIndex\}"/.test(CFG), '§9 UI : sélecteur « Type de plinthes » (renderSolsAuto)');
A(/Type de plinthes/.test(CFG), '§9 UI : libellé « Type de plinthes »');
A(/Quantité \(ml\) calculée automatiquement au périmètre/.test(CFG), '§9 UI : quantité auto au périmètre (pas de saisie manuelle)');
A(/piece\.plinthesType = _plinthes/.test(CFG), '§9 UI : choix plinthes mémorisé (recalcPiece)');

// §9 plinthes plus proposées en « oubli » (sols)
global.piecesSelectionnees = [];
const os1 = oublisSol('stratifie');
A(os1.indexOf('SOL_PLINT_BOIS') === -1 && os1.indexOf('SOL_PLINT_STR') === -1, '§9 oublis sols : plinthes plus proposées');

// ===== §8 seuils sols : mono vs mixte ==================================
A(os1.indexOf('SOL_SEUIL') === -1, '§8 seuils sols : ABSENTS en logement mono-revêtement');
global.piecesSelectionnees = [{ config: { carrelage: { CAR_POSE_SOL: 20 } } }, { solType: 'stratifie', config: {} }];
A(oublisSol('stratifie').indexOf('SOL_SEUIL') !== -1, '§8 seuils sols : présents si revêtements mixtes');
global.piecesSelectionnees = [];

// ===== NON-RÉGRESSION : ragréage / dépose / joint lino conservés ========
global.chantier = { typeProjet: 'neuf' };
A(oublisSol('pvc').indexOf('SOL_RAGREAGE') !== -1, 'non-régression : ragréage sol conseillé si support le justifie (neuf)');
global.chantier = { typeProjet: 'renov' };
A(oublisSol('stratifie').indexOf('SOL_DEPOSE') !== -1, 'non-régression : dépose proposée en rénovation');
global.chantier = {};
A(oublisSol('lino').indexOf('SOL_JOINT_LINO') !== -1, 'non-régression : joint à froid lino conservé');

// ---- Bilan --------------------------------------------------------------
console.log('sols-lot38 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
