// tests/choix-travaux.test.js — Questionnaire v2 (moteur pur) — LOT33
const path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const PIECES = [
  { id: 'salon', numero: 1, nom: 'Salon' }, { id: 'chambre', numero: 1, nom: 'Chambre 1' },
  { id: 'cuisine', numero: 1, nom: 'Cuisine' }, { id: 'sdb', numero: 1, nom: 'Salle de bain' },
  { id: 'sde', numero: 1, nom: "Salle d'eau" }, { id: 'wc', numero: 1, nom: 'WC' },
  { id: 'buanderie', numero: 1, nom: 'Buanderie' }
];
const M = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie', 'isolation'];

const vide = CT.choixTravauxVide();
A(vide.version === 2 && vide.chauffage && vide.isolation && vide.ba13, 'squelette v2 (chauffage/isolation/ba13)');
A(!('chauffageAuSol' in vide.chauffage) && 'type' in vide.chauffage && 'solution' in vide.chauffage && 'secheServiette' in vide.chauffage, 'chauffage = arborescence type/solution/secheServiette');
A(!('transverse' in vide), 'plus de section transverse');

const q = CT.construireQuestionnaire({ typeProjet: 'neuf', domotique: 'complet', borneVE: 'oui', pv: 'non' }, PIECES, M);
const sec = c => q.sections.find(s => s.code === c);

// CHAUFFAGE : arborescence + solutions par type + sèche-serviette
const chf = sec('chauffage');
A(chf.type.options.some(o => o.v === 'electrique') && chf.type.options.some(o => o.v === 'gaz') && chf.type.options.some(o => o.v === 'pompe'), 'chauffage : types electrique/gaz/pompe');
A(chf.solutionsParType.electrique.some(o => o.v === 'radiateurs') && chf.solutionsParType.electrique.some(o => o.v === 'chauffage_sol'), 'électricité : radiateurs + chauffage au sol');
A(chf.solutionsParType.fioul.length === 1 && chf.solutionsParType.fioul[0].v === 'radiateurs', 'fioul : radiateurs seulement');
A(chf.secheServiette && chf.secheServiette.pieces.some(p => p.id === 'sdb') && chf.secheServiette.pieces.some(p => p.id === 'sde'), 'sèche-serviette : pièces d\'eau réelles');

// VMC : neuf = choix direct (pas de "créer ventilation")
const vmcNeuf = sec('vmc');
A(!vmcNeuf.questions.some(x => x.id === 'intention'), 'VMC neuf : pas de question intention (créer)');
A(vmcNeuf.questions.some(x => x.id === 'solution' && x.options.some(o => o.v === 'double_flux')), 'VMC neuf : choix direct du système');
const vmcReno = CT.construireQuestionnaire({ typeProjet: 'renovation' }, PIECES, ['vmc']).sections.find(s => s.code === 'vmc');
A(vmcReno.questions.some(x => x.id === 'intention' && x.options.some(o => o.v === 'conserver')), 'VMC réno : intention conserver/remplacer/créer');

// PLOMBERIE : salle de bain ≠ salle d'eau
const plo = sec('plomberie');
A(plo.sdb.length === 1 && plo.sdb[0].equipements.some(e => e.v === 'baignoire'), 'SDB : baignoire proposée');
A(plo.sde.length === 1 && !plo.sde[0].equipements.some(e => e.v === 'baignoire') && plo.sde[0].equipements.some(e => e.v === 'douche_ital'), "SDE : douche, pas de baignoire");
// lave-linge dynamique : toutes pièces pertinentes présentes ; cuisine consommée, buanderie non
const llv = plo.laveLinge.options; const byV = {}; llv.forEach(o => byV[o.v] = o);
A(byV['cuisine#1'] && byV['cuisine#1'].consomme === true, 'lave-linge : cuisine (consommée)');
A(byV['buanderie#1'] && byV['buanderie#1'].consomme === false, 'lave-linge : buanderie proposée mais non consommée');
A(byV['sdb#1'] && byV['sde#1'], 'lave-linge : liste dérivée du logement (sdb, sde présentes)');
A(llv[0].v === 'aucun', 'lave-linge : option Aucun en tête');

// MENUISERIE : volets tri-état unique
const men = sec('menuiserie');
const volets = men.questions.find(x => x.id === 'volets');
A(volets.options.length === 3 && volets.options.some(o => o.v === 'manuel') && volets.options.some(o => o.v === 'motorise'), 'volets : non / manuel / motorisé (une seule question)');
A(!men.questions.some(x => x.id === 'motoriser'), 'plus de 2e question motorisation');

// ISOLATION + BA13
const iso = sec('isolation'); const ba13 = sec('ba13');
A(iso.questions.some(x => x.id === 'niveau') && iso.questions.some(x => x.id === 'acoustique'), 'isolation : niveau + acoustique');
A(ba13 && ba13.questions.some(x => x.id === 'cloisons') && ba13.questions.some(x => x.id === 'fauxPlafond'), 'BA13 : cloisons + faux plafond');
function labelsOptions(sec){ return (sec.questions||[]).map(function(x){ return x.label+' '+(x.options||[]).map(function(o){return o.l+' '+o.v;}).join(' '); }).join(' | '); }
A(!/m²|épaisseur|epaisseur|\bmm\b|combien|nombre/i.test(labelsOptions(iso)) && !/m²|plaque|rail|montant|combien|nombre/i.test(labelsOptions(ba13)), 'isolation/BA13 : aucune quantité technique demandée (labels/options)');

const total = ok + ko;
if (ko === 0) console.log('✅ Questionnaire v2 LOT33 (moteur) : ' + ok + '/' + total);
else { console.error('❌ Questionnaire v2 LOT33 : ' + ok + '/' + total); process.exit(1); }
