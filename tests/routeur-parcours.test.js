// =====================================================================
// tests/routeur-parcours.test.js — Routeur « type de demande » + périmètre travaux
// =====================================================================
// Vérifie le routage réel de devis.html (2 parcours existants : travaux → configurateur,
// depannage → depannage.html) et le choix de périmètre (complet/partiel/indecis) mémorisé
// dans sessionStorage.perimetreTravaux, puis le câblage d'init du configurateur
// (perimetreTravaux → modeChantier). Aucun 3e parcours, aucun moteur modifié.
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

// ---- Statique : structure demande + périmètre + câblage configurateur ----
A(/data-type="travaux"/.test(DEVIS) && /data-type="depannage"/.test(DEVIS), 'devis.html : 2 cartes de demande (travaux / depannage)');
A(/data-prm="complet"/.test(DEVIS) && /data-prm="partiel"/.test(DEVIS) && /data-prm="indecis"/.test(DEVIS), 'devis.html : 3 cartes de périmètre (complet/partiel/indecis)');
A(/window\.location\.href = 'depannage\.html'/.test(DEVIS), 'devis.html : depannage → depannage.html (parcours existant conservé)');
A(/sessionStorage\.setItem\('perimetreTravaux'/.test(DEVIS), 'devis.html : périmètre mémorisé dans sessionStorage');
A(/if \(prm === 'partiel' \|\| prm === 'indecis'\) modeChantier = 'partiel';/.test(CONF), 'configurateur : partiel/indecis → modeChantier=partiel');
A(/else if \(prm === 'complet'\) modeChantier = 'complet';/.test(CONF), 'configurateur : complet → modeChantier=complet');
A(/getItem\('perimetreTravaux'\)/.test(CONF), 'configurateur : lit perimetreTravaux à l\'init');

// ---- Exécution réelle du routeur devis.html ------------------------
const SRC = [
  extraire(DEVIS, 'function marquerCarte(el, on)'),
  extraire(DEVIS, 'function choisirDemande(type)'),
  extraire(DEVIS, 'function choisirPerimetre(p)'),
  extraire(DEVIS, 'function etape1Suivant()')
].join('\n');

function fabrique() {
  const els = {
    typeDemande: { value: 'travaux' },
    perimetreTravaux: { value: 'complet' },
    perimetreBloc: { style: {} },
    clientCP: { value: '77400' }
  };
  const dmd = [{ dataset: { type: 'travaux' }, style: {} }, { dataset: { type: 'depannage' }, style: {} }];
  const prm = [{ dataset: { prm: 'complet' }, style: {} }, { dataset: { prm: 'partiel' }, style: {} }, { dataset: { prm: 'indecis' }, style: {} }];
  const store = {};
  const document = {
    getElementById: (id) => els[id] || null,
    querySelectorAll: (sel) => sel.indexOf('dmd-card') >= 0 ? dmd : (sel.indexOf('prm-card') >= 0 ? prm : [])
  };
  const sessionStorage = { setItem: (k, v) => { store[k] = String(v); }, getItem: (k) => (k in store ? store[k] : null) };
  const win = { location: { href: '' } };
  let allerEtapeArg = null;
  const allerEtape = (n) => { allerEtapeArg = n; };
  const api = new Function('document', 'sessionStorage', 'window', 'allerEtape',
    SRC + ';return { choisirDemande, choisirPerimetre, etape1Suivant };')(document, sessionStorage, win, allerEtape);
  return { api, els, store, win, getAllerEtape: () => allerEtapeArg };
}

// TEST I — Dépannage → depannage.html, PAS de configurateur
{
  const { api, els, win, getAllerEtape, store } = fabrique();
  api.choisirDemande('depannage');
  A(els.typeDemande.value === 'depannage', 'I — sélection depannage : typeDemande=depannage');
  A(els.perimetreBloc.style.display === 'none', 'I — périmètre masqué en mode depannage');
  api.etape1Suivant();
  A(win.location.href === 'depannage.html', 'I — depannage → redirection depannage.html');
  A(getAllerEtape() === null, 'I — depannage ne passe pas à l\'étape 2 (pas de configurateur)');
}

// TEST A — Travaux + tout le logement → étape 2 + perimetreTravaux=complet
{
  const { api, store, getAllerEtape } = fabrique();
  api.choisirDemande('travaux');
  api.choisirPerimetre('complet');
  api.etape1Suivant();
  A(store.perimetreTravaux === 'complet', 'A — travaux/tout le logement → perimetreTravaux=complet');
  A(getAllerEtape() === 2, 'A — travaux → passage à l\'étape 2 (questionnaire obligatoire)');
}

// TEST B — Travaux + certaines pièces → perimetreTravaux=partiel
{
  const { api, store } = fabrique();
  api.choisirDemande('travaux');
  api.choisirPerimetre('partiel');
  api.etape1Suivant();
  A(store.perimetreTravaux === 'partiel', 'B — certaines pièces → perimetreTravaux=partiel');
}

// TEST D — Travaux + je ne sais pas encore → perimetreTravaux=indecis (pas un 3e modèle)
{
  const { api, store } = fabrique();
  api.choisirDemande('travaux');
  api.choisirPerimetre('indecis');
  api.etape1Suivant();
  A(store.perimetreTravaux === 'indecis', 'D — je ne sais pas → perimetreTravaux=indecis (orientation, pas de moteur)');
}

// TEST défaut — Travaux sans choix explicite de périmètre → complet (historique)
{
  const { api, store } = fabrique();
  api.choisirDemande('travaux'); // périmètre reste sur défaut 'complet'
  api.etape1Suivant();
  A(store.perimetreTravaux === 'complet', 'défaut — travaux sans choix → complet (comportement historique)');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Routeur parcours + périmètre : ' + ok + '/' + total + ' — 2 parcours réels, périmètre → modeChantier, aucun 3e modèle');
else { console.error('❌ Routeur parcours : ' + ok + '/' + total); process.exit(1); }
