// =====================================================================
// tests/type-prestation-partie1-m60.test.js — M60 : type de prestation directeur en Partie 1
// =====================================================================
// Reproduit le VRAI parcours utilisateur (pas un appel interne direct) :
//   Partie 1 (coordonnées) -> clic sur une carte « type de prestation » -> le VRAI onclick
//   déclenche choisirPrestation -> mapping canonique (typeDemande / typeProjet) + conditionnement
//   Partie 2 -> collecterDonnees écrit chantier -> lecteurs existants (tauxTVA, tableau).
// Shim DOM minimal (portable, sans dépendance) ; fonctions et dispatch d'événement RÉELS.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const { tauxTVA } = require(path.join(RACINE, 'js', 'moteur-tva.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = DEVIS.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = DEVIS.indexOf('{', s), d = 0;
  for (; i < DEVIS.length; i++) { if (DEVIS[i] === '{') d++; else if (DEVIS[i] === '}') { d--; if (d === 0) return DEVIS.slice(s, i + 1); } }
  throw new Error('fin introuvable: ' + sig);
}

// ---- Shim DOM : getElementById (défaut sûr), querySelectorAll, event dispatch réel ----
function makeCard(type, prestation) {
  return { dataset: { type, prestation }, style: {}, onclick: null, _l: [],
    addEventListener(t, f) { this._l.push([t, f]); },
    dispatchEvent(e) { if (this.onclick && e.type === 'click') this.onclick(e); this._l.filter(x => x[0] === e.type).forEach(x => x[1](e)); return true; } };
}
function makeDoc() {
  const reg = {};
  const doc = {
    _reg: reg, _cards: [],
    reg(id, v) { reg[id] = v; return v; },
    getElementById(id) { return reg[id] || { value: '', style: {}, textContent: '' }; },
    querySelectorAll(sel) { return /#demandeCards \.dmd-card/.test(sel) ? doc._cards : []; }
  };
  return doc;
}
function ssStub() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, _m: m }; }
function makeApi(doc, ss, win, allerEtape) {
  const src = extraire('function marquerCarte(') + '\n' + extraire('function choisirDemande(') + '\n' +
    extraire('function choisirPrestation(') + '\n' + extraire('function majContexteTypePrestation(') + '\n' +
    extraire('function majTypeVentilation(') + '\n' + extraire('function etape1Suivant(') + '\n' +
    extraire('function collecterDonnees(') + '\n' +
    'return { choisirPrestation, etape1Suivant, collecterDonnees, choisirDemande, majContexteTypePrestation };';
  return new Function('document', 'sessionStorage', 'window', 'allerEtape', src)(doc, ss, win, allerEtape);
}
// Construit un DOM réaliste de la Partie 1 + champs Partie 2 touchés par le conditionnement.
function scene() {
  const doc = makeDoc();
  const ss = ssStub();
  const win = { location: { href: '' } };
  let allerEtapeArg = null;
  const api = makeApi(doc, ss, win, (n) => { allerEtapeArg = n; });
  doc.reg('typePrestation', { value: '' });
  doc.reg('typeDemande', { value: 'travaux' });
  doc.reg('typeProjet', { value: 'renov' });
  doc.reg('erreur-prestation', { style: { display: 'none' } });
  doc.reg('perimetreBloc', { style: { display: 'none' } });
  doc.reg('perimetreTravaux', { value: 'complet' });
  doc.reg('sectionExistant', { style: { display: '' } });
  doc.reg('tableauExistant', { value: 'recent' });   // défaut HISTORIQUE (piège du neuf)
  doc.reg('vmc', { value: 'oui' });
  doc.reg('blocTypeVentilation', { style: {} });
  doc.reg('typeVentilationExistante', { value: 'inconnu' });
  doc.reg('intentionVentilation', { value: 'inconnu' });
  doc.reg('typeProjetEcho', { textContent: '—' });
  doc.reg('clientCP', { value: '77000' });
  const cNeuf = makeCard('travaux', 'neuf'), cRenov = makeCard('travaux', 'renov'), cDep = makeCard('depannage', 'depannage');
  cNeuf.onclick = () => api.choisirPrestation('neuf');
  cRenov.onclick = () => api.choisirPrestation('renov');
  cDep.onclick = () => api.choisirPrestation('depannage');
  doc._cards = [cNeuf, cRenov, cDep];
  return { doc, ss, win, api, allerEtape: () => allerEtapeArg, cards: { neuf: cNeuf, renov: cRenov, depannage: cDep } };
}

// =====================================================================
// 0. Contrat HTML (le choix EST en Partie 1)
// =====================================================================
{
  A(/Quel type de prestation recherchez-vous/.test(DEVIS), '0a. Partie 1 : question « type de prestation » présente');
  ['neuf', 'renov', 'depannage'].forEach(k => A(new RegExp('data-prestation="' + k + '"[^>]*onclick="choisirPrestation\\(\'' + k + '\'\\)"').test(DEVIS) || new RegExp('onclick="choisirPrestation\\(\'' + k + '\'\\)"').test(DEVIS), '0b. carte prestation « ' + k +' » câblée sur choisirPrestation'));
  A((DEVIS.match(/id="typeProjet"/g) || []).length === 1 && /<select id="typeProjet" style="display:none;">/.test(DEVIS), '0c. typeProjet canonique UNIQUE, en Partie 1 (caché)');
  A(/<option value="extension">/.test(DEVIS), '0d. valeur technique « extension » conservée');
  A(/id="sectionExistant"/.test(DEVIS), '0e. section « Installations existantes » identifiable (conditionnable)');
  A(/id="erreur-prestation"/.test(DEVIS), '0f. message d\'obligation présent');
  A(/if \(document\.getElementById\('demandeCards'\)\) \{ choisirPerimetre\('complet'\); \}/.test(DEVIS), '0g. aucune présélection de prestation au chargement (choix obligatoire)');
}

// =====================================================================
// 1. Construction neuve : clic réel -> mapping + neutralisation existant
// =====================================================================
{
  const S = scene();
  S.cards.neuf.dispatchEvent({ type: 'click' });            // VRAI clic
  A(S.doc.getElementById('typeDemande').value === 'travaux', '1a. neuf -> typeDemande=travaux');
  A(S.doc.getElementById('typeProjet').value === 'neuf', '1b. neuf -> typeProjet=neuf');
  A(S.doc.getElementById('typePrestation').value === 'neuf', '1c. sélection mémorisée (typePrestation=neuf)');
  A(S.doc.getElementById('sectionExistant').style.display === 'none', '1d. neuf -> section « existant » masquée (non demandée)');
  A(S.doc.getElementById('tableauExistant').value === 'inexistant', '1e. neuf -> tableauExistant=inexistant (valeur sûre)');
  A(S.doc.getElementById('vmc').value === 'non', '1f. neuf -> vmc=non (valeur sûre)');
  A(S.doc.getElementById('intentionVentilation').value === 'inconnu', '1g. LOT32 : neuf ne force plus l\'intention VMC au funnel (défaut « créer » dans le questionnaire)');
  A(S.doc.getElementById('perimetreBloc').style.display === 'block', '1h. neuf (travaux) -> périmètre affiché');
  // La valeur arrive dans chantier
  const chantier = S.api.collecterDonnees().chantier;
  A(chantier.typeProjet === 'neuf', '1i. chantier.typeProjet=neuf (collecte)');
  A(chantier.tableauExistant === 'inexistant', '1j. chantier.tableauExistant=inexistant');
  A(chantier.vmc === 'non', '1k. chantier.vmc=non');
  // Tableau neuf plus bloqué par l'ancien défaut « recent »
  A((chantier.tableauExistant !== 'recent') === true, '1l. dimensionnement tableau neuf NON bloqué (tableauExistant !== recent)');
  // TVA 20% attendue en neuf (lecteur existant)
  global.chantier = chantier; A(tauxTVA() === 0.20, '1m. tauxTVA()=20% en neuf (lecteur existant intact)');
}

// =====================================================================
// 2. Rénovation : mapping + questions d'existant conservées
// =====================================================================
{
  const S = scene();
  S.cards.renov.dispatchEvent({ type: 'click' });
  A(S.doc.getElementById('typeDemande').value === 'travaux', '2a. renov -> typeDemande=travaux');
  A(S.doc.getElementById('typeProjet').value === 'renov', '2b. renov -> typeProjet=renov (valeur canonique conservée)');
  A(S.doc.getElementById('sectionExistant').style.display === '', '2c. renov -> section « existant » visible (questions conservées)');
  const chantier = S.api.collecterDonnees().chantier;
  A(chantier.typeProjet === 'renov', '2d. chantier.typeProjet=renov');
  global.chantier = chantier; A(tauxTVA() === 0.10, '2e. tauxTVA()=10% en rénovation (lecteur existant intact)');
}

// =====================================================================
// 3. Dépannage : routage existant + persistance
// =====================================================================
{
  const S = scene();
  S.cards.depannage.dispatchEvent({ type: 'click' });
  A(S.doc.getElementById('typeDemande').value === 'depannage', '3a. depannage -> typeDemande=depannage');
  A(S.doc.getElementById('perimetreBloc').style.display === 'none', '3b. depannage -> périmètre masqué');
  S.api.etape1Suivant();
  A(S.win.location.href === 'depannage.html', '3c. depannage -> routage existant vers depannage.html');
  A(S.ss.getItem('depannageCP') === '77000', '3d. depannage -> CP persisté (sessionStorage)');
  A(S.allerEtape() === null, '3e. depannage -> ne passe PAS à la Partie 2');
}

// =====================================================================
// 4. Choix obligatoire avant de poursuivre
// =====================================================================
{
  const S = scene();                                        // aucune carte cliquée
  S.api.etape1Suivant();
  A(S.doc.getElementById('erreur-prestation').style.display === 'block', '4a. aucun choix -> message d\'obligation affiché');
  A(S.allerEtape() === null && S.win.location.href === '', '4b. aucun choix -> ni Partie 2 ni redirection');
  // Puis choix neuf -> passe en Partie 2
  S.cards.neuf.dispatchEvent({ type: 'click' });
  S.api.etape1Suivant();
  A(S.doc.getElementById('erreur-prestation').style.display === 'none', '4c. après choix -> erreur masquée');
  A(S.allerEtape() === 2, '4d. après choix (travaux) -> passe à la Partie 2');
  A(S.ss.getItem('perimetreTravaux') === 'complet', '4e. périmètre mémorisé pour le configurateur');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Type de prestation directeur en Partie 1 (M60) : ' + ok + '/' + total + ' — neuf/renov/depannage mappés (typeDemande/typeProjet canoniques), existant neutralisé en neuf (tableau=inexistant, vmc=non, tableau non bloqué), routage dépannage conservé, choix obligatoire, TVA/lecteurs intacts');
else { console.error('❌ M60 : ' + ok + '/' + total); process.exit(1); }
