// =====================================================================
// tests/orientation-indecis.test.js — M54 : aide « Je ne sais pas encore »
// =====================================================================
// Vérifie que l'orientation résout TOUJOURS vers l'un des DEUX parcours existants
// (complet | partiel), jamais un 3e modèle, en 2 questions max, puis mémorise
// perimetreTravaux pour le configurateur. Aucun moteur, aucune F1..F6 touchée.
// Exécute le source réel extrait de devis.html avec des dépendances stubées.
// =====================================================================
const fs = require('fs');
const path = require('path');
const DEVIS = fs.readFileSync(path.join(__dirname, '..', 'devis.html'), 'utf8');
const CONF = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Statique : structure d'orientation + garde sélection vide + non-régression ----
A(/id="orientationBloc"/.test(DEVIS), 'devis.html : bloc d\'orientation présent');
A(/data-ori="complet"/.test(DEVIS) && /data-ori="partiel"/.test(DEVIS) && /data-ori="aide"/.test(DEVIS), 'devis.html : 3 réponses d\'orientation');
A(/Votre projet concerne-t-il une rénovation générale du logement \?/.test(DEVIS), 'devis.html : question d\'orientation validée');
A(/const cible = \(kind === 'complet'\) \? 'complet' : 'partiel';/.test(DEVIS), 'choisirOrientation : résout vers complet OU partiel (jamais un 3e modèle)');
A(/if \(piecesSelectionnees\.length === 0\)/.test(CONF), 'configurateur : sélection vide bloque la validation (Test 4)');
A(!/perimetreTravaux/.test(extraire(CONF, 'function compositionTypologie(nbPieces, surface)')), 'F1..F6 (compositionTypologie) non touchées par M54');

// ---- Exécution réelle ----------------------------------------------
const SRC = [
  extraire(DEVIS, 'function marquerCarte(el, on)'),
  extraire(DEVIS, 'function choisirPerimetre(p)'),
  extraire(DEVIS, 'function choisirOrientation(kind)'),
  extraire(DEVIS, 'function etape1Suivant()')
].join('\n');

function fabrique() {
  const els = {
    typeDemande: { value: 'travaux' },
    perimetreTravaux: { value: 'complet' },
    perimetreBloc: { style: {} },
    orientationBloc: { style: {} },
    orientationAide: { style: {} },
    clientCP: { value: '77400' }
  };
  const prm = [{ dataset: { prm: 'complet' }, style: {} }, { dataset: { prm: 'partiel' }, style: {} }, { dataset: { prm: 'indecis' }, style: {} }];
  const ori = [{ dataset: { ori: 'complet' }, style: {} }, { dataset: { ori: 'partiel' }, style: {} }, { dataset: { ori: 'aide' }, style: {} }];
  const store = {};
  const document = {
    getElementById: (id) => els[id] || null,
    querySelectorAll: (sel) => sel.indexOf('prm-card') >= 0 ? prm : (sel.indexOf('ori-card') >= 0 ? ori : [])
  };
  const sessionStorage = { setItem: (k, v) => { store[k] = String(v); }, getItem: (k) => (k in store ? store[k] : null) };
  const win = { location: { href: '' } };
  let allerEtapeArg = null;
  const allerEtape = (n) => { allerEtapeArg = n; };
  const api = new Function('document', 'sessionStorage', 'window', 'allerEtape',
    SRC + ';return { choisirPerimetre, choisirOrientation, etape1Suivant };')(document, sessionStorage, win, allerEtape);
  return { api, els, store, getAllerEtape: () => allerEtapeArg };
}

// Test 1 — indécis → rénovation générale → complet
{
  const { api, els, store, getAllerEtape } = fabrique();
  api.choisirPerimetre('indecis');
  A(els.orientationBloc.style.display === 'block', 'Test 1 — « indécis » révèle l\'orientation');
  api.choisirOrientation('complet');
  A(els.perimetreTravaux.value === 'complet', 'Test 1 — « oui, ensemble » → perimetreTravaux=complet');
  api.etape1Suivant();
  A(store.perimetreTravaux === 'complet' && getAllerEtape() === 2, 'Test 1 — mémorisé + questionnaire obligatoire (étape 2)');
}
// Test 2 — indécis → certaines pièces → partiel
{
  const { api, els } = fabrique();
  api.choisirPerimetre('indecis');
  api.choisirOrientation('partiel');
  A(els.perimetreTravaux.value === 'partiel', 'Test 2 — « non, certaines pièces » → perimetreTravaux=partiel');
}
// Test 3 — toujours indécis → aide → partiel (aucun 3e modèle)
{
  const { api, els } = fabrique();
  api.choisirPerimetre('indecis');
  api.choisirOrientation('aide');
  A(els.perimetreTravaux.value === 'partiel', 'Test 3 — « je ne sais toujours pas » → partiel (sélection des pièces sûres)');
  A(els.orientationAide.style.display === 'block', 'Test 3 — aide courte affichée');
  A(['complet', 'partiel'].includes(els.perimetreTravaux.value), 'Test 3 — la valeur reste dans {complet, partiel} (jamais un 3e modèle)');
}
// Test 5 — changement d'avis : revenir sur un périmètre franc masque/réinitialise l'orientation
{
  const { api, els } = fabrique();
  api.choisirPerimetre('indecis');
  api.choisirOrientation('aide');           // valeur = partiel, aide visible
  api.choisirPerimetre('complet');          // changement d'avis explicite
  A(els.perimetreTravaux.value === 'complet', 'Test 5 — choix franc « tout le logement » → complet');
  A(els.orientationBloc.style.display === 'none', 'Test 5 — orientation masquée');
  A(els.orientationAide.style.display === 'none', 'Test 5 — aide réinitialisée (pas de résidu)');
}
// Invariant — après toute réponse d'orientation, jamais la valeur 'indecis'
{
  const { api, els } = fabrique();
  ['complet', 'partiel', 'aide'].forEach(k => { api.choisirPerimetre('indecis'); api.choisirOrientation(k); A(els.perimetreTravaux.value !== 'indecis', 'invariant — orientation(' + k + ') ne laisse jamais perimetreTravaux=indecis'); });
}

const total = ok + ko;
if (ko === 0) console.log('✅ Orientation « je ne sais pas encore » (M54) : ' + ok + '/' + total + ' — 2 questions max, résolution complet/partiel, aucun 3e modèle');
else { console.error('❌ Orientation M54 : ' + ok + '/' + total); process.exit(1); }
