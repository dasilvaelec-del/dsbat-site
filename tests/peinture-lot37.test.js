// tests/peinture-lot37.test.js — LOT37 : peinture (enduit mural, moulures, radiateurs/coffrets neuf, plinthes, rosaces)
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const PEINT = require(path.join(RACINE, 'js', 'moteurs', 'peinture.js'));
const MP = fs.readFileSync(path.join(RACINE, 'js', 'moteur-piece.js'), 'utf8');
const CFG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const VUE = fs.readFileSync(path.join(RACINE, 'js', 'vue-tarifaire-data.js'), 'utf8');
const SOLS = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'sols.js'), 'utf8');
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const codesOf = (piece) => PEINT.controlesOublisPeinture(piece).map(o => o.code);
const oubli = (piece, code) => PEINT.controlesOublisPeinture(piece).find(o => o.code === code);
const mkP = (id, dims) => ({ id, numero: 1, nom: id, config: {}, dims: Object.assign({ l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 }, dims || {}) });
const PIECES = ['salon', 'cuisine', 'chambre', 'bureau', 'entree', 'couloir', 'sdb', 'sde', 'wc', 'garage', 'cellier', 'cave', 'buanderie', 'piece_dynamique_x'];

// ===== MOULURES (§4) : PEINT_BOISERIE, m², qty = périmètre, toutes pièces =====
global.chantier = { typeProjet: 'neuf' };
A(/"PEINT_MOULURE":\{[^}]*"unite":"ml"/.test(VUE), 'moulures : code catalogue réel PEINT_MOULURE en ml');
PIECES.forEach(id => {
  const p = mkP(id); const o = oubli(p, 'PEINT_MOULURE');
  const per = Math.round(2 * (p.dims.l + p.dims.la) * 10) / 10;
  A(o && o.unite === 'ml' && o.qty === per, 'moulures présentes, ml, qty=périmètre — ' + id);
  A(codesOf(p).indexOf('PEINT_BOISERIE') === -1, 'moulures : plus de PEINT_BOISERIE (m²) — ' + id);
});
// quantité auto (pas de saisie manuelle) : dépend uniquement des dimensions
const pA = mkP('salon', { l: 6, la: 5 }); A(oubli(pA, 'PEINT_MOULURE').qty === 22 && oubli(pA, 'PEINT_MOULURE').unite === 'ml', 'moulures : quantité automatique = périmètre (6×5 → 22 ml)');

// ===== PLINTHES (§8) : absentes du métier peinture ; portées par les sols =====
A(PIECES.every(id => codesOf(mkP(id)).indexOf('PEINT_PLINTHE') === -1), 'plinthes ABSENTES du métier peinture (toutes pièces)');
A(/SOL_PLINT_BOIS|SOL_PLINT_STR/.test(SOLS), 'plinthes portées par les sols (SOL_PLINT_*)');

// ===== RADIATEURS (§6) : absents en NEUF, présents en rénovation =====
global.chantier = { typeProjet: 'neuf' };
A(codesOf(mkP('salon')).indexOf('PEINT_RAD') === -1, 'radiateurs à peindre ABSENTS en neuf');
global.chantier = { typeProjet: 'renov', etatLieux: 'bon' };
A(codesOf(mkP('salon')).indexOf('PEINT_RAD') !== -1, 'radiateurs à peindre CONSERVÉS en rénovation');

// ===== COFFRETS VR (§7) : absents en NEUF, présents en rénovation =====
global.chantier = { typeProjet: 'neuf' };
A(codesOf(mkP('salon')).indexOf('PEINT_COFFRE_VR') === -1, 'coffrets VR ABSENTS en neuf');
global.chantier = { typeProjet: 'renov', etatLieux: 'bon' };
A(codesOf(mkP('salon')).indexOf('PEINT_COFFRE_VR') !== -1, 'coffrets VR CONSERVÉS en rénovation');

// ===== PORTES (§3) : inchangées =====
global.chantier = { typeProjet: 'neuf' };
A(codesOf(mkP('chambre')).indexOf('PEINT_PORTE_NEUVE') !== -1, 'portes intérieures inchangées (neuf : PEINT_PORTE_NEUVE)');
global.chantier = { typeProjet: 'renov' };
A(codesOf(mkP('chambre')).indexOf('PEINT_PORTE_EXIST') !== -1, 'portes intérieures inchangées (réno : PEINT_PORTE_EXIST)');

// ===== ENDUIT MURAL (§1) : prestation distincte, code réel, chiffrée séparément =====
A(/"PREP_ENDUIT_MUR":\{[^}]*"unite":"m²"[^}]*"prix":\{"min":\d/.test(VUE), 'enduit mural : code catalogue réel PREP_ENDUIT_MUR (m², prix défini)');
A(/piece\.enduitMur === 'oui'.*getMoyenPrixFor\('PREP_ENDUIT_MUR'/s.test(MP) && /totalPeinture = pMur \+ pPlaf \+ pPapier \+ pSousCouche \+ pEnduitMur/.test(MP), 'enduit mural : ligne distincte chiffrée séparément dans moteur-piece');
A(/id="enduit_mur_\$\{pieceIndex\}"/.test(CFG) && /Option : Enduit mural — 2 passes/.test(CFG), 'enduit mural : option UI (neuf) présente');
A(/const enduitMur = document\.getElementById\(`enduit_mur_\$\{index\}`\)/.test(CFG) && /piece\.enduitMur = enduitMur/.test(CFG), 'enduit mural : choix lu et mémorisé (recalcPiece)');

// ===== PEINTURE MURS/PLAFOND NEUF = impression + 2 couches ; plus de gamme enduit-bakée en neuf =====
A(/const gammes = projetNeuf \? \[\s*\{ val:'std', label:'Standard \(impression \+ 2 couches\)' \},\s*\]/s.test(CFG), 'neuf : gamme murs = Standard (impression + 2 couches) uniquement (enduit sorti de la gamme)');
A(/PEINT_SOUS_COUCHE/.test(MP) && /construction neuve/.test(fs.readFileSync(path.join(RACINE,'js','moteurs','peinture.js'),'utf8')), 'impression auto en neuf (PEINT_SOUS_COUCHE via detectionSousCouche)');

// ===== ROSACES (§5) + ENDUIT PLAFOND (§2) : NON branchés (aucun code Runtime), aucun faux code/prix =====
A(!/PEINT_ROSACE|ROSACE/.test(VUE) && !/PEINT_ROSACE/.test(fs.readFileSync(path.join(RACINE,'js','moteurs','peinture.js'),'utf8').replace(/\/\/.*/g,'')), 'rosaces : aucun code inventé (hors commentaires)');
A(!/PREP_ENDUIT_PLAF/.test(VUE), 'enduit plafond : aucun code plafond inventé dans le catalogue');

const total = ok + ko;
if (ko === 0) console.log('✅ LOT37 peinture : ' + ok + '/' + total);
else { console.error('❌ LOT37 : ' + ok + '/' + total); process.exit(1); }
