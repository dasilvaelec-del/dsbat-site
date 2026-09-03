// =====================================================================
// tests/vmc-existant-lot2.test.js — M57 LOT2 : existant VMC enrichi
// =====================================================================
// Vérifie l'ajout de `typeVentilationExistante` (donnée DÉCLARÉE, distincte de `vmc`)
// SANS toucher le champ historique `vmc` ni le calcul électrique (b.vmc) ni aucun prix.
// Règles clés : « vmc=non » NE devient PAS « aucune » (défaut = inconnu) ;
// vmc=oui/defaillante → vmc_motorisee ; le nouveau champ n'entre dans AUCUN moteur.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CTX = fs.readFileSync(path.join(RACINE, 'js', 'contexte-projet.js'), 'utf8');
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Champ historique `vmc` intact -----------------------------------
A(/<select id="vmc" onchange="majTypeVentilation\(\)">/.test(DEVIS), 'vmc : select conservé (onchange ajouté, valeurs inchangées)');
['oui', 'defaillante', 'non'].forEach(v => A(new RegExp('<option value="' + v + '">').test(DEVIS), 'vmc : option « ' + v + ' » conservée'));
A(/typeVentilationExistante/.test(DEVIS), 'nouveau champ typeVentilationExistante présent');

// ---- Les 5 valeurs de l'existant -------------------------------------
['vmc_motorisee', 'ventilation_naturelle', 'aerateur', 'aucune', 'inconnu']
  .forEach(v => A(new RegExp('value="' + v + '"').test(DEVIS), 'typeVentilationExistante : valeur « ' + v +' »'));
A(/<option value="inconnu" selected>/.test(DEVIS), 'défaut UI = inconnu (jamais aucune d\'office)');

// ---- Collecte + provenance -------------------------------------------
A(/typeVentilationExistante: \(document\.getElementById\('typeVentilationExistante'\)/.test(DEVIS), 'chantier collecte typeVentilationExistante');
A(/typeVentilationExistante: ch\.typeVentilationExistante \|\| null/.test(CTX), 'contexte-projet : écho déclaré (provenance) présent');

// ---- AUCUN impact calcul : le champ n'entre dans aucun moteur --------
A(!/typeVentilationExistante/.test(MOTEUR), 'moteur-devis n\'utilise PAS typeVentilationExistante (aucun calcul)');
['plomberie', 'vmc', 'electricite', 'carrelage', 'peinture', 'sols', 'isolation', 'menuiserie', 'chauffage'].forEach(m => {
  const src = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', m + '.js'), 'utf8');
  A(!/typeVentilationExistante/.test(src), 'moteur ' + m + ' n\'utilise PAS typeVentilationExistante');
});
// mapping électrique historique intact
A(/chantier\.vmc && chantier\.vmc !== 'non'/.test(MOTEUR), 'mapping b.vmc = (vmc !== non) intact');

// ---- Comportement de majTypeVentilation() ----------------------------
const SRC = extraire(DEVIS, 'function majTypeVentilation()');
function run(vmcVal, selInit) {
  const bloc = { style: {} };
  const sel = { value: selInit != null ? selInit : 'inconnu' };
  const els = { blocTypeVentilation: bloc, typeVentilationExistante: sel, vmc: { value: vmcVal } };
  const document = { getElementById: (id) => els[id] || null };
  new Function('document', SRC + ';majTypeVentilation();')(document);
  return { display: bloc.style.display, value: sel.value };
}
// vmc=oui / defaillante → bloc masqué, valeur vmc_motorisee
A(run('oui').display === 'none' && run('oui').value === 'vmc_motorisee', 'vmc=oui → masqué, typeVentilationExistante=vmc_motorisee');
A(run('defaillante').value === 'vmc_motorisee', 'vmc=defaillante → typeVentilationExistante=vmc_motorisee');
// vmc=non → bloc visible, défaut inconnu (JAMAIS aucune), sans écraser un choix explicite
{
  const r = run('non', 'vmc_motorisee');
  A(r.display === '' && r.value === 'inconnu', 'vmc=non → visible + défaut inconnu (pas aucune)');
  A(run('non', 'ventilation_naturelle').value === 'ventilation_naturelle', 'vmc=non → choix « ventilation_naturelle » conservé');
  A(run('non', 'aerateur').value === 'aerateur', 'vmc=non → choix « aerateur » conservé');
  A(run('non', 'aucune').value === 'aucune', 'vmc=non → choix explicite « aucune » conservé');
}
// aucune n'est jamais produit automatiquement à partir de non
A(run('non', 'vmc_motorisee').value !== 'aucune' && run('non').value !== 'aucune', 'non → n\'est jamais transformé automatiquement en aucune');

const total = ok + ko;
if (ko === 0) console.log('✅ Existant VMC (M57 LOT2) : ' + ok + '/' + total + ' — vmc historique intact, typeVentilationExistante déclaré, aucun impact calcul');
else { console.error('❌ Existant VMC LOT2 : ' + ok + '/' + total); process.exit(1); }
