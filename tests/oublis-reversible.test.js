// =====================================================================
// tests/oublis-reversible.test.js — Réversibilité des recommandations « oublis »
// =====================================================================
// Vérifie que Oui / Non deviennent RÉVERSIBLES : après « Non » la reco reste
// visible (bloc « refusé » + « Ajouter finalement ») et le cycle
//   Oui → Retirer → Oui   et   Non → Ajouter finalement → Retirer → Ajouter finalement
// fonctionne, sans double comptage. Aucune modification de fichier de production.
// On EXTRAIT le vrai source des handlers + helpers depuis devis-configurateur.html
// et on les EXÉCUTE avec des dépendances stubées.
// =====================================================================
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

function extraire(src, sig) {
  const s = src.indexOf(sig);
  if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Vérif statique : les 7 cartes ont refHtml + bloc refusé ---------
A((HTML.match(/const refHtml = oublisRefusHtml\(/g) || []).length === 7, 'les 7 cartes définissent refHtml (oublisRefusHtml)');
A((HTML.match(/\$\{refHtml \? '<div style="margin-top:6px;border-top:1px dashed/g) || []).length === 7, 'les 7 cartes rendent le bloc refusé');

// liste blanche plomberie inclut les déposes (pour afficher [Retirer] après acceptation)
A(/const OUBLI = \[[^\]]*PLO_DEPOSE_WC[^\]]*PLO_DEPOSE_BAIG[^\]]*PLO_DEPOSE_LAV/.test(HTML), 'liste OUBLI plomberie inclut les 3 déposes (état accepté visible)');

// ---- Exécution réelle des handlers ----------------------------------
const SRC =
  extraire(HTML, 'function oublisRefusHtml(index, configKey, ignProp)') + '\n' +
  extraire(HTML, 'function reajouterOubli(index, configKey, ignProp, code, qty)') + '\n' +
  extraire(HTML, 'function ajouterOubliPlo(index, code, qty)') + '\n' +
  extraire(HTML, 'function ignorerOubliPlo(index, code)') + '\n' +
  extraire(HTML, 'function retirerOubliPlo(index, code)');

function fabrique(piece) {
  const piecesSelectionnees = [piece];
  const recalcPiece = () => {};
  const saveEtat = () => {};
  const document = { getElementById: () => null };
  const findPrestLabel = (c) => 'Dépose ' + c;
  // suggestion factice fournissant la quantité (comme le vrai controlesOublisPlo)
  const controlesOublisPlo = () => [{ code: 'PLO_DEPOSE_WC', qty: 1, question: 'Dépose WC ?', unite: 'U' }];
  return new Function(
    'piecesSelectionnees', 'recalcPiece', 'saveEtat', 'document', 'findPrestLabel', 'controlesOublisPlo',
    SRC + '\n;return { oublisRefusHtml, reajouterOubli, ajouterOubliPlo, ignorerOubliPlo, retirerOubliPlo };'
  )(piecesSelectionnees, recalcPiece, saveEtat, document, findPrestLabel, controlesOublisPlo);
}

const CODE = 'PLO_DEPOSE_WC';
const nbCodes = (piece) => Object.keys((piece.config && piece.config.plomberie) || {}).filter(k => piece.config.plomberie[k] > 0).length;

// TEST 2 — Oui → prestation ajoutée
{
  const p = { config: {} }; const F = fabrique(p);
  F.ajouterOubliPlo(0, CODE, 1);
  A(p.config.plomberie && p.config.plomberie[CODE] === 1, 'TEST 2 — Oui : PLO_DEPOSE_WC ajouté (qty 1)');
}
// TEST 3 — Retirer → prestation supprimée, ré-ajoutable
{
  const p = { config: { plomberie: { [CODE]: 1 } } }; const F = fabrique(p);
  F.retirerOubliPlo(0, CODE);
  A(!p.config.plomberie[CODE], 'TEST 3 — Retirer : PLO_DEPOSE_WC supprimé de config');
  F.ajouterOubliPlo(0, CODE, 1);
  A(p.config.plomberie[CODE] === 1, 'TEST 3 — ré-ajout immédiat possible');
}
// TEST 4 — Non → pas dans config, reste visible (refusé)
{
  const p = { config: {} }; const F = fabrique(p);
  F.ignorerOubliPlo(0, CODE);
  A(!(p.config.plomberie && p.config.plomberie[CODE]), 'TEST 4 — Non : aucune prestation dans config');
  A(p._oublisIgnoresPlo && p._oublisIgnoresPlo[CODE] === 1, 'TEST 4 — Non : refus mémorisé avec quantité (réversible)');
  const html = F.oublisRefusHtml(0, 'plomberie', '_oublisIgnoresPlo');
  A(/Ajouter finalement/.test(html) && /reajouterOubli\(0,'plomberie','_oublisIgnoresPlo','PLO_DEPOSE_WC',1\)/.test(html),
    'TEST 4 — Non : bloc « Ajouter finalement » présent et réversible');
}
// TEST 5 — Ajouter finalement → accepté, retirable
{
  const p = { config: {}, _oublisIgnoresPlo: { [CODE]: 1 } }; const F = fabrique(p);
  F.reajouterOubli(0, 'plomberie', '_oublisIgnoresPlo', CODE, 1);
  A(p.config.plomberie[CODE] === 1, 'TEST 5 — Ajouter finalement : prestation ajoutée');
  A(!(p._oublisIgnoresPlo && p._oublisIgnoresPlo[CODE]), 'TEST 5 — sort de la liste des refusés');
}
// TEST 6 — cycle Oui → Retirer → Oui → Retirer
{
  const p = { config: {} }; const F = fabrique(p);
  F.ajouterOubliPlo(0, CODE, 1); F.retirerOubliPlo(0, CODE); F.ajouterOubliPlo(0, CODE, 1); F.retirerOubliPlo(0, CODE);
  A(!p.config.plomberie[CODE], 'TEST 6 — cycle Oui/Retirer×2 : état final cohérent (retiré)');
}
// TEST 7 — cycle Non → Ajouter finalement → Retirer → Ajouter finalement
{
  const p = { config: {} }; const F = fabrique(p);
  F.ignorerOubliPlo(0, CODE);
  F.reajouterOubli(0, 'plomberie', '_oublisIgnoresPlo', CODE, 1);
  F.retirerOubliPlo(0, CODE);
  F.reajouterOubli(0, 'plomberie', '_oublisIgnoresPlo', CODE, 1);
  A(p.config.plomberie[CODE] === 1 && nbCodes(p) === 1, 'TEST 7 — cycle inverse : état final accepté, sans doublon');
}
// TEST 8 — anti-double : jamais plus d'une occurrence
{
  const p = { config: {} }; const F = fabrique(p);
  F.ajouterOubliPlo(0, CODE, 1); F.ajouterOubliPlo(0, CODE, 1);
  F.reajouterOubli(0, 'plomberie', '_oublisIgnoresPlo', CODE, 1);
  A(nbCodes(p) === 1 && p.config.plomberie[CODE] === 1, 'TEST 8 — anti-double : une seule occurrence du code');
}
// TEST 10 — mécanisme générique (autres clés, ex. sols/menuiserie) via reajouterOubli
{
  const p = { config: {}, _oublisIgnoresSol: { SOL_DEPOSE: 6 } }; const F = fabrique(p);
  const html = F.oublisRefusHtml(0, 'sols', '_oublisIgnoresSol');
  A(/reajouterOubli\(0,'sols','_oublisIgnoresSol','SOL_DEPOSE',6\)/.test(html), 'TEST 10 — bloc refusé générique fonctionne pour SOL_DEPOSE (qty conservée)');
  F.reajouterOubli(0, 'sols', '_oublisIgnoresSol', 'SOL_DEPOSE', 6);
  A(p.config.sols && p.config.sols.SOL_DEPOSE === 6 && !p._oublisIgnoresSol.SOL_DEPOSE, 'TEST 10 — réajout générique écrit dans la bonne clé config');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Réversibilité oublis : ' + ok + '/' + total + ' — Oui/Non réversibles, anti-double, mécanisme générique');
else { console.error('❌ Réversibilité oublis : ' + ok + '/' + total); process.exit(1); }
