// =====================================================================
// tests/depose-niveau1.test.js — Tests PRÉPARATOIRES « Dépose / Enlèvement » Niveau 1
// =====================================================================
// OBJECTIF (TDD — tests écrits AVANT le code) : préparer l'ajout de 3 recommandations
// de dépose sanitaire dans controlesOublisPlo (js/moteurs/plomberie.js) :
//     PLO_DEPOSE_WC · PLO_DEPOSE_BAIG · PLO_DEPOSE_LAV
//
// AUCUN fichier de production n'est modifié par ce fichier. Il ne fait que LIRE
// js/moteurs/plomberie.js (déjà exporté pour Node) et, pour le seul contrôle
// tarifaire, le CATALOGUE RÉEL privé s'il est accessible localement.
//
// Deux familles d'assertions, comptées SÉPARÉMENT :
//   • A(...) INVARIANTS — doivent être VERTS dès maintenant ET après implémentation
//     (opt-in, aucune mutation, aucune proposition en neuf, dédup, refus respecté…).
//   • P(...) COMPORTEMENTS ATTENDUS — resteront ⏳ EN ATTENTE tant que plomberie.js
//     ne propose pas les 3 déposes. Ils basculeront ✅ une fois l'étape 2 réalisée.
//
// Code de sortie : fondé UNIQUEMENT sur les INVARIANTS (A). Le fichier sort donc 0
// aujourd'hui (rien de cassé), tout en affichant clairement les P encore en attente.
// Aucun prix inventé : les valeurs viennent exclusivement du catalogue réel.
// =====================================================================

const path = require('path');
const RACINE = path.join(__dirname, '..');
const PLO = require(path.join(RACINE, 'js', 'moteurs', 'plomberie.js'));
const controlesOublisPlo = PLO.controlesOublisPlo;

let ok = 0, ko = 0, pend = 0, pendOk = 0;
// Invariant : doit être vrai maintenant. Échec = régression réelle → exit 1.
const A = (c, m) => { if (c) { ok++; } else { ko++; console.error('  ❌ INVARIANT: ' + m); } };
// Comportement attendu (TDD) : ⏳ tant que plomberie.js n'est pas modifié.
const P = (c, m) => { if (c) { pendOk++; console.log('  ✅ (déjà satisfait) ' + m); } else { pend++; console.log('  ⏳ EN ATTENTE (plomberie.js) : ' + m); } };

// ---- Helpers ---------------------------------------------------------
const CODES_DEPOSE = ['PLO_DEPOSE_WC', 'PLO_DEPOSE_BAIG', 'PLO_DEPOSE_LAV'];
const trouve = (list, code) => (list || []).find(x => x && x.code === code) || null;
const contientUneDepose = (list) => (list || []).some(x => x && CODES_DEPOSE.includes(x.code));

// Fabrique une pièce isolée (le moteur lit piece.config.plomberie).
function piece(cfgPlomberie, extra) {
  return Object.assign({
    id: 'sdb', nom: 'Salle de bain',
    dims: { l: 2, la: 2, h: 2.5, portes: 1, fenetres: 1 },
    config: { plomberie: Object.assign({}, cfgPlomberie) }
  }, extra || {});
}
// Le futur code lira chantier.typeProjet (comme sols.js / menuiserie.js). On l'installe
// en global AVANT chaque appel. Sans effet sur le comportement actuel (non lu aujourd'hui).
function setChantier(typeProjet) { global.chantier = { typeProjet }; }

// =====================================================================
console.log('— Dépose Niveau 1 — INVARIANTS (doivent être verts) —');

// 5. ABSENCE D'APPAREIL → aucune proposition de dépose (rénovation).
setChantier('renov');
A(!contientUneDepose(controlesOublisPlo(piece({}))),
  'aucun appareil sanitaire → aucune dépose proposée');

// 7. NEUF / EXTENSION → aucune dépose (rien à retirer).
setChantier('neuf');
A(!contientUneDepose(controlesOublisPlo(piece({ PLO_WC_SUSP: 1, PLO_BAIGNOIRE: 1, PLO_MEUBLE_LAV: 1 }))),
  'projet neuf + appareils configurés → aucune dépose proposée');
setChantier('extension');
A(!contientUneDepose(controlesOublisPlo(piece({ PLO_WC_SUSP: 1 }))),
  'projet extension → aucune dépose proposée');

// 8. CODE DÉJÀ PRÉSENT EN CONFIG → jamais reproposé (garde q.plo[code]).
setChantier('renov');
A(!trouve(controlesOublisPlo(piece({ PLO_WC_SUSP: 1, PLO_DEPOSE_WC: 1 })), 'PLO_DEPOSE_WC'),
  'dépose WC déjà en config → non reproposée (pas de doublon)');

// 4. REFUS → non reproposé (garde piece._oublisIgnoresPlo).
setChantier('renov');
A(!trouve(controlesOublisPlo(piece({ PLO_WC_SUSP: 1 }, { _oublisIgnoresPlo: { PLO_DEPOSE_WC: true } })), 'PLO_DEPOSE_WC'),
  'dépose WC refusée (ignorée) → non reproposée');

// 9. OPT-IN / AUCUNE MUTATION : appeler le contrôle ne modifie jamais piece.config.
setChantier('renov');
const pAvant = piece({ PLO_WC_SUSP: 1, PLO_BAIGNOIRE: 1 });
const snap = JSON.stringify(pAvant.config);
controlesOublisPlo(pAvant);
A(JSON.stringify(pAvant.config) === snap,
  'controlesOublisPlo ne mute pas piece.config (proposition pure, opt-in)');

// Le contrôle renvoie toujours une liste (contrat de forme inchangé).
A(Array.isArray(controlesOublisPlo(piece({ PLO_WC_SUSP: 1 }))),
  'controlesOublisPlo retourne une liste');

// =====================================================================
console.log('— Dépose Niveau 1 — COMPORTEMENTS ATTENDUS (⏳ jusqu\'à plomberie.js) —');

// 6 + 1. WC : rénovation + WC configuré → propose PLO_DEPOSE_WC, qté = nb WC.
setChantier('renov');
{
  const l = controlesOublisPlo(piece({ PLO_WC_SUSP: 1 }));
  const d = trouve(l, 'PLO_DEPOSE_WC');
  P(!!d && d.qty === 1 && d.unite === 'U', 'WC : PLO_DEPOSE_WC proposé (qté 1, U) en rénovation');
}
// WC dérivé aussi de PLO_WC_SIMPLE (pièce WC).
{
  const l = controlesOublisPlo(piece({ PLO_WC_SIMPLE: 1 }, { id: 'wc', nom: 'WC' }));
  const d = trouve(l, 'PLO_DEPOSE_WC');
  P(!!d && d.qty === 1, 'WC : PLO_DEPOSE_WC dérivé de PLO_WC_SIMPLE');
}

// 2. BAIGNOIRE : rénovation + baignoire configurée → PLO_DEPOSE_BAIG, qté = nb baignoires.
{
  const l = controlesOublisPlo(piece({ PLO_BAIGNOIRE: 1 }));
  const d = trouve(l, 'PLO_DEPOSE_BAIG');
  P(!!d && d.qty === 1 && d.unite === 'U', 'Baignoire : PLO_DEPOSE_BAIG proposé (qté 1, U)');
}

// 3. LAVABO : rénovation + lavabo/meuble vasque configuré → PLO_DEPOSE_LAV.
{
  const l = controlesOublisPlo(piece({ PLO_MEUBLE_LAV: 1 }));
  const d = trouve(l, 'PLO_DEPOSE_LAV');
  P(!!d && d.qty === 1 && d.unite === 'U', 'Lavabo : PLO_DEPOSE_LAV proposé (qté 1) depuis PLO_MEUBLE_LAV');
}
{
  const l = controlesOublisPlo(piece({ PLO_LAV_SIMPLE: 1 }, { id: 'wc', nom: 'WC' }));
  const d = trouve(l, 'PLO_DEPOSE_LAV');
  P(!!d && d.qty === 1, 'Lavabo : PLO_DEPOSE_LAV dérivé de PLO_LAV_SIMPLE');
}

// 1-3 « acceptation » (sémantique pure) : une fois le code ajouté en config, il n'est
// plus reproposé (idempotence de l'acceptation). Invariant valable dès aujourd'hui.
setChantier('renov');
A(!trouve(controlesOublisPlo(piece({ PLO_BAIGNOIRE: 1, PLO_DEPOSE_BAIG: 1 })), 'PLO_DEPOSE_BAIG'),
  'acceptation baignoire simulée (code en config) → non reproposée');

// 6. RÉNOVATION → au moins une dépose possible quand un appareil est présent.
setChantier('renov');
P(contientUneDepose(controlesOublisPlo(piece({ PLO_WC_SUSP: 1, PLO_BAIGNOIRE: 1, PLO_MEUBLE_LAV: 1 }))),
  'rénovation + 3 appareils → au moins une dépose proposée');

// =====================================================================
// 10. RÉSOLUTION TARIFAIRE DES 3 CODES — via le CATALOGUE RÉEL privé (si accessible).
//     N'affiche AUCUN montant ; vérifie seulement que chaque code se résout à un prix
//     numérique positif. SKIP propre si le catalogue privé n'est pas monté localement.
console.log('— Dépose Niveau 1 — RÉSOLUTION TARIFAIRE (catalogue réel) —');
(function () {
  const candidats = [
    process.env.DSBAT_CATALOGUE,
    path.join(RACINE, '..', '..', 'dsbat-runtime', 'runtime', 'moteur-prive', 'prix.js'),
    path.join(RACINE, '..', '..', '..', 'dsbat-runtime', 'runtime', 'moteur-prive', 'prix.js')
  ].filter(Boolean);
  let cata = null;
  for (const c of candidats) { try { cata = require(c); break; } catch (e) { /* essai suivant */ } }
  if (!cata || !cata.PRIX) {
    console.log('  ⏭️  SKIP : catalogue privé non monté localement (aucune valeur inventée). ' +
                'Résolution à valider dans la suite Runtime (a-/golden-master).');
    return;
  }
  let TM;
  try { TM = require(path.join(RACINE, 'js', 'tarifs-mode.js')); } catch (e) { TM = null; }
  if (!TM || typeof TM.creerAccesseursCatalogue !== 'function') {
    console.log('  ⏭️  SKIP : accesseurs tarifs-mode indisponibles.');
    return;
  }
  const acc = TM.creerAccesseursCatalogue({ PRIX: cata.PRIX, prixElec: cata.prixElec, prixPlomberie: cata.prixPlomberie });
  CODES_DEPOSE.forEach(code => {
    const p = acc.getPrixPrestFor(code, {});
    A(p && typeof p.min === 'number' && typeof p.max === 'number' && p.min > 0 && p.max >= p.min,
      'résolution tarifaire ' + code + ' (prix numérique positif, valeurs non affichées)');
  });
})();

// =====================================================================
const totalA = ok + ko;
console.log('\n————————————————————————————————————————————————');
console.log('INVARIANTS         : ' + ok + '/' + totalA + (ko ? '  · ' + ko + ' ÉCHEC(S)' : '  ✅ tous verts'));
console.log('COMPORTEMENTS TDD  : ' + pendOk + ' satisfait(s), ' + pend + ' EN ATTENTE de plomberie.js');
if (pend > 0) console.log('→ Après implémentation de l\'étape 2, ces ' + pend + ' comportements doivent passer à ✅.');
console.log('————————————————————————————————————————————————');
process.exit(ko === 0 ? 0 : 1); // exit fondé UNIQUEMENT sur les invariants
