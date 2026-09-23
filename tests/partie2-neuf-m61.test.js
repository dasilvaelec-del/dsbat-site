// =====================================================================
// tests/partie2-neuf-m61.test.js — M61 : Partie 2 adaptée au NEUF (nettoyage existant + Énergie + programme)
// =====================================================================
// Reproduit le vrai parcours : clic « type de prestation » (Partie 1) -> conditionnement Partie 2.
//  NEUF  : existant masqué (âge/année/état/accès/installations), valeurs sûres, programme visible, Énergie visible.
//  RÉNO  : existant visible et inchangé ; Énergie (chauffage/ECS) fonctionne toujours.
// Champs & enums réutilisés (aucun nouveau modèle). Shim DOM portable + fonctions réelles + dispatch réel.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(sig) {
  const s = DEVIS.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = DEVIS.indexOf('{', s), d = 0;
  for (; i < DEVIS.length; i++) { if (DEVIS[i] === '{') d++; else if (DEVIS[i] === '}') { d--; if (d === 0) return DEVIS.slice(s, i + 1); } }
  throw new Error('fin: ' + sig);
}
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
function makeApi(doc) {
  const src = extraire('function marquerCarte(') + '\n' + extraire('function choisirDemande(') + '\n' +
    extraire('function choisirPrestation(') + '\n' + extraire('function majContexteTypePrestation(') + '\n' +
    extraire('function majTypeVentilation(') + '\n' + extraire('function collecterDonnees(') + '\n' +
    'return { choisirPrestation, collecterDonnees, majContexteTypePrestation };';
  return new Function('document', src)(doc);
}
function scene() {
  const doc = makeDoc();
  const api = makeApi(doc);
  // Partie 1
  doc.reg('typePrestation', { value: '' }); doc.reg('typeDemande', { value: 'travaux' });
  doc.reg('typeProjet', { value: 'renov' }); doc.reg('erreur-prestation', { style: {} });
  doc.reg('perimetreBloc', { style: {} }); doc.reg('typeProjetEcho', { textContent: '—' });
  // Partie 2 — existant (masquable)
  ['fgAgeBati', 'fgAnneeConstruction', 'fgEtatLieux', 'sectionAccessibilite', 'sectionExistant', 'blocTypeVentilation'].forEach(id => doc.reg(id, { style: { display: '' } }));
  doc.reg('ageBati', { value: 'moyen' }); doc.reg('anneeConstruction', { value: '1985' }); doc.reg('etatLieux', { value: 'moyen' });
  doc.reg('accessibilite', { value: 'moyen' }); doc.reg('accessSup', { value: 'occupé' });
  doc.reg('tableauExistant', { value: 'recent' }); doc.reg('vmc', { value: 'oui' });
  doc.reg('typeVentilationExistante', { value: 'inconnu' }); doc.reg('intentionVentilation', { value: 'inconnu' });
  // Partie 2 — Énergie (toujours visible)
  doc.reg('sectionEnergie', { style: { display: '' } }); doc.reg('chauffage', { value: 'electrique' }); doc.reg('eauChaude', { value: 'chaudiere' });
  // Partie 2 — Programme neuf (visible en neuf seulement)
  doc.reg('sectionProgrammeNeuf', { style: { display: 'none' } });
  doc.reg('nbChambres', { value: '2' }); doc.reg('nbNiveaux', { value: '1' }); doc.reg('nbSallesEau', { value: '1' });
  doc.reg('nbWc', { value: '1' }); doc.reg('garage', { value: 'non' }); doc.reg('cellier', { value: 'non' });
  // champs lus par collecterDonnees (défauts sûrs déjà gérés par getElementById)
  ['surface', 'pieces', 'typeBien', 'typeLogement', 'qualiteMateriaux'].forEach(id => doc.reg(id, { value: 'x' }));
  const cN = makeCard('travaux', 'neuf'), cR = makeCard('travaux', 'renov'), cD = makeCard('depannage', 'depannage');
  cN.onclick = () => api.choisirPrestation('neuf'); cR.onclick = () => api.choisirPrestation('renov'); cD.onclick = () => api.choisirPrestation('depannage');
  doc._cards = [cN, cR, cD];
  return { doc, api, cards: { neuf: cN, renov: cR, depannage: cD } };
}
const disp = (el, v) => el.style.display === v;

// ===== 0. CONTRAT HTML =====
{
  A(/id="sectionEnergie"/.test(DEVIS), '0a. section Énergie présente');
  const iEne = DEVIS.indexOf('id="sectionEnergie"'), iCh = DEVIS.indexOf('id="chauffage"'), iEc = DEVIS.indexOf('id="eauChaude"'), iEx = DEVIS.indexOf('id="sectionExistant"');
  A(iEne < iCh && iCh < iEx && iEne < iEc && iEc < iEx, '0b. chauffage + ECS placés dans la section Énergie (avant Installations existantes)');
  const existBloc = DEVIS.slice(DEVIS.indexOf('id="sectionExistant"'), DEVIS.indexOf('id="sectionEnergie"') >= 0 ? DEVIS.length : DEVIS.length);
  const sectionExistantHtml = DEVIS.slice(DEVIS.indexOf('id="sectionExistant"'), DEVIS.indexOf('</div>\n\n    <div class="form-section">\n      <h3>⭐'));
  A(!/id="chauffage"/.test(sectionExistantHtml) && !/id="eauChaude"/.test(sectionExistantHtml), '0c. chauffage/ECS ne sont PLUS dans « Installations existantes »');
  A((DEVIS.match(/id="chauffage"/g) || []).length === 1 && (DEVIS.match(/id="eauChaude"/g) || []).length === 1, '0d. pas de double question chauffage/ECS');
  ['nbChambres', 'nbNiveaux', 'nbSallesEau', 'nbWc', 'garage', 'cellier'].forEach(f => A(new RegExp('id="' + f + '"').test(DEVIS), '0e. champ programme « ' + f + ' » présent'));
  A(/id="sectionProgrammeNeuf" style="display:none;"/.test(DEVIS), '0f. programme neuf masqué par défaut');
  A(/id="fgAgeBati"/.test(DEVIS) && /id="fgEtatLieux"/.test(DEVIS) && /id="sectionAccessibilite"/.test(DEVIS), '0g. champs existant toujours dans le modèle (ids ajoutés)');
  ['nbChambres', 'nbNiveaux', 'nbSallesEau', 'nbWc', 'garage', 'cellier'].forEach(k => A(new RegExp(k + ': \\(document.getElementById').test(DEVIS), '0h. collecte de « ' + k + ' » dans chantier'));
}

// ===== 1. NEUF : existant masqué, programme visible, Énergie visible, valeurs sûres, collecte =====
{
  const S = scene();
  S.cards.neuf.dispatchEvent({ type: 'click' });
  const g = id => S.doc.getElementById(id);
  A(disp(g('fgAgeBati'), 'none'), '1a. âge du bâtiment masqué');
  A(disp(g('fgAnneeConstruction'), 'none'), '1b. année de construction masquée');
  A(disp(g('fgEtatLieux'), 'none'), '1c. état général masqué');
  A(disp(g('sectionAccessibilite'), 'none'), '1d. accessibilité / occupation masquée');
  A(disp(g('sectionExistant'), 'none'), '1e. installations existantes (tableau/VMC) masquées');
  A(disp(g('sectionProgrammeNeuf'), ''), '1f. programme neuf VISIBLE');
  A(disp(g('sectionEnergie'), ''), '1g. section Énergie VISIBLE (chauffage/ECS non masqués)');
  // valeurs sûres (enums existants)
  A(g('ageBati').value === 'recent', '1h. ageBati=recent (sûr)');
  A(g('anneeConstruction').value === '', '1i. anneeConstruction neutre');
  A(g('etatLieux').value === 'bon', '1j. etatLieux=bon (sûr)');
  A(g('accessibilite').value === 'facile', '1k. accessibilite=facile (défaut sûr, pas de forfait involontaire)');
  A(g('accessSup').value === 'aucune', '1l. accessSup=aucune (jamais « occupé »)');
  A(g('tableauExistant').value === 'inexistant', '1m. tableauExistant=inexistant (débloque le dimensionnement)');
  A(g('vmc').value === 'non', '1n. vmc=non');
  A(g('intentionVentilation').value === 'creer', '1o. intention VMC = creer');
  // le chauffage/ECS restent CHOISISSABLES (le forçage M60 est levé)
  g('chauffage').value = 'pompe'; g('eauChaude').value = 'ballon';
  const ch = S.api.collecterDonnees().chantier;
  A(ch.typeProjet === 'neuf', '1p. chantier.typeProjet=neuf conservé');
  A(ch.chauffage === 'pompe', '1q. chauffage CHOISISSABLE en neuf (M60 corrigé)');
  A(ch.eauChaude === 'ballon', '1r. ECS choisissable en neuf');
  A(ch.nbChambres === '2' && ch.nbNiveaux === '1' && ch.nbSallesEau === '1' && ch.nbWc === '1' && ch.garage === 'non' && ch.cellier === 'non', '1s. programme neuf collecté dans chantier');
  A(ch.ageBati === 'recent' && ch.etatLieux === 'bon' && ch.accessSup === 'aucune', '1t. valeurs sûres présentes dans chantier (existant conservé)');
}

// ===== 2. RÉNOVATION : existant visible et inchangé, programme masqué, Énergie fonctionne =====
{
  const S = scene();
  S.cards.renov.dispatchEvent({ type: 'click' });
  const g = id => S.doc.getElementById(id);
  A(disp(g('fgAgeBati'), '') && disp(g('fgEtatLieux'), '') && disp(g('fgAnneeConstruction'), ''), '2a. réno : âge/année/état VISIBLES');
  A(disp(g('sectionAccessibilite'), '') && disp(g('sectionExistant'), ''), '2b. réno : accessibilité + installations existantes VISIBLES');
  A(disp(g('sectionProgrammeNeuf'), 'none'), '2c. réno : programme neuf masqué');
  A(disp(g('sectionEnergie'), ''), '2d. réno : Énergie visible');
  const ch = S.api.collecterDonnees().chantier;
  A(ch.typeProjet === 'renov', '2e. chantier.typeProjet=renov');
  A(ch.chauffage === 'electrique' && ch.eauChaude === 'chaudiere', '2f. chauffage/ECS toujours collectés en réno (aucune régression)');
  // réno ne force AUCUNE valeur d'existant (comportement inchangé)
  A(g('ageBati').value === 'moyen' && g('vmc').value === 'oui', '2g. réno : valeurs d\'existant non écrasées');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Partie 2 NEUF (M61) : ' + ok + '/' + total + ' — existant masqué + valeurs sûres, programme neuf visible/collecté, Énergie (chauffage/ECS) réexposée et choisissable, rénovation intacte');
else { console.error('❌ M61 : ' + ok + '/' + total); process.exit(1); }
