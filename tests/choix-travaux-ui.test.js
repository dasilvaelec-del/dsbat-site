// =====================================================================
// tests/choix-travaux-ui.test.js — Câblage UI du questionnaire de choix de travaux
// =====================================================================
// Exécute les VRAIES fonctions extraites de devis-configurateur.html
// (ouvrirChoixTravaux / renderChoixTravaux / setters / validerChoixTravaux)
// sur un shim DOM minimal. Vérifie : affichage dynamique selon métiers actifs,
// VMC exclue, persistance dans sessionStorage('chantier'), NON-duplication des
// sources canoniques (domotique/borneVE/pv restent des clés chantier), et
// conformité source unique via ChoixTravauxDSBAT.verifierSourceUnique.
// =====================================================================
const fs = require('fs');
const path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));
const HTML = fs.readFileSync(path.join(__dirname, '..', 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ---- extraire le bloc câblé (entre marqueurs) ----
const D = HTML.indexOf('// ===== QUESTIONNAIRE DE CHOIX DE TRAVAUX (entre');
const F = HTML.indexOf('// ===== FIN QUESTIONNAIRE DE CHOIX DE TRAVAUX =====');
if (D < 0 || F < 0) { console.error('bloc câblé introuvable'); process.exit(1); }
const bloc = HTML.slice(D, F);

// ---- shim DOM minimal ----
const elements = {};
function el(id){ if(!elements[id]) elements[id]={ id:id, style:{}, _html:'', get innerHTML(){return this._html;}, set innerHTML(v){this._html=v;} }; return elements[id]; }
['phase1','phase2','phase3','phaseConfirmation','phaseProposition','phasePrestation','phaseChoixTravaux'].forEach(el);
global.document = { getElementById: (id)=> el(id) };
const store = {};
global.sessionStorage = { getItem:(k)=> (k in store? store[k]: null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:(k)=>{delete store[k];} };
global.window = { scrollTo(){} };
global.ChoixTravauxDSBAT = CT;
global.phaseActuelle = null;
let allerPhaseCalls = [];
global.allerPhase = (n)=>{ allerPhaseCalls.push(n); };

// contexte projet (globals lus par le bloc)
global.chantier = { domotique:'complet', borneVE:'oui', pv:'non', typeProjet:'neuf' };
global.piecesSelectionnees = [
  { id:'salon', numero:1, nom:'Salon' },
  { id:'chambre', numero:1, nom:'Chambre 1' },
  { id:'cuisine', numero:1, nom:'Cuisine' },
  { id:'sdb', numero:1, nom:'Salle de bain' }
];
global.metiersActifs = ['electricite','plomberie','chauffage','carrelage','sols','peinture','menuiserie','isolation','vmc'];

// ---- construire les fonctions câblées (portée globale, free vars -> global) ----
const factory = new Function(bloc + '\n;return { ouvrirChoixTravaux, renderChoixTravaux, validerChoixTravaux, retourChoixTravaux, sauverChoixTravaux, __ctSetTransverse, __ctSetMetier, __ctSetPiece };');
const W = factory();

// ---- (1) ouverture + affichage + VMC exclue ----
W.ouvrirChoixTravaux();
const zone = el('phaseChoixTravaux');
A(zone.style.display === 'block', '(1) zone questionnaire affichée');
A(el('phase1').style.display === 'none' && el('phase2').style.display === 'none', '(1b) phases masquées');
A(global.phaseActuelle === 'choixTravaux', '(1c) phaseActuelle = choixTravaux');
A(/Électricité/.test(zone.innerHTML) && /Plomberie/.test(zone.innerHTML), '(1d) sections métiers rendues');
A(!/VMC|ventilation/i.test(zone.innerHTML), '(1e) VMC absente du questionnaire');
A(zone.innerHTML.indexOf('\ud83d\udd25 Chauffage') === -1, '(1e2) section chauffage absente du questionnaire V1 (source canonique = chauffageFonctions)');
A(/Déjà indiqué/.test(zone.innerHTML) && /complet/.test(zone.innerHTML), '(1f) transverses référencés rappelés (domotique=complet)');
A(/Chauffage au sol/.test(zone.innerHTML) && /Volets roulants motorisés/.test(zone.innerHTML), '(1g) transverses nouveaux présents');

// ---- (2) affichage dynamique selon métiers actifs ----
global.metiersActifs = ['electricite'];
W.ouvrirChoixTravaux();
A(/Électricité/.test(zone.innerHTML) && !/Plomberie/.test(zone.innerHTML) && !/Isolation/.test(zone.innerHTML), '(2) un seul métier actif => une seule section');
// rétablir le contexte complet
global.metiersActifs = ['electricite','plomberie','chauffage','carrelage','sols','peinture','menuiserie','isolation','vmc'];
W.ouvrirChoixTravaux();

// ---- (3) persistance transverse ----
W.__ctSetTransverse('chauffageAuSol','complet');
let saved = JSON.parse(store['chantier']);
A(saved.choixTravaux.transverse.chauffageAuSol === 'complet', '(3) chauffageAuSol persisté dans sessionStorage(chantier)');

// ---- (4) persistance par pièce (plomberie / douche italienne) ----
W.__ctSetPiece('plomberie','parPiece','sdb#1','doucheItalienne','oui');
saved = JSON.parse(store['chantier']);
A(saved.choixTravaux.parMetier.plomberie.parPiece['sdb#1'].doucheItalienne === 'oui', '(4) douche italienne persistée par pièce');

// ---- (5) NON-duplication des sources canoniques ----
A(saved.domotique === 'complet' && saved.borneVE === 'oui' && saved.pv === 'non', '(5a) clés canoniques chantier intactes');
const tk = Object.keys(saved.choixTravaux.transverse);
A(tk.indexOf('domotique') === -1 && tk.indexOf('irve') === -1 && tk.indexOf('borneVE') === -1 && tk.indexOf('pv') === -1, '(5b) aucune source canonique dupliquée dans choixTravaux');

// ---- (6) conformité source unique ----
A(CT.verifierSourceUnique(saved).length === 0, '(6) verifierSourceUnique => conforme');

// ---- (7) validation -> allerPhase(2) + persistance ----
allerPhaseCalls = [];
W.validerChoixTravaux();
A(allerPhaseCalls.length === 1 && allerPhaseCalls[0] === 2, '(7) validerChoixTravaux -> allerPhase(2)');
A(el('phaseChoixTravaux').style.display === 'none', '(7b) zone masquée après validation');

// ---- (8) reprise : réouverture préserve les réponses ----
W.ouvrirChoixTravaux();
saved = JSON.parse(store['chantier']);
A(saved.choixTravaux.parMetier.plomberie.parPiece['sdb#1'].doucheItalienne === 'oui', '(8) réponses préservées à la réouverture');

const total = ok + ko;
if (ko === 0) console.log('✅ Câblage UI questionnaire choix de travaux : ' + ok + '/' + total);
else { console.error('❌ Câblage UI questionnaire : ' + ok + '/' + total); process.exit(1); }
