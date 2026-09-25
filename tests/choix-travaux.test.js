// =====================================================================
// tests/choix-travaux.test.js — Questionnaire de choix de travaux v2 (moteur pur)
// =====================================================================
// Vérifie le CONTRAT v2 : squelette ; questionnaire dynamique selon métiers
// actifs + pièces réelles ; VMC conditionnelle neuf/réno ; rappel chantier
// éditable (domotique/irve/pv, PAS de copie) ; lave-linge limité aux pièces
// supportées ; plus de section « transverses » générique ; fusion.
// =====================================================================
const path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const PIECES = [
  { id: 'salon', numero: 1, nom: 'Salon' }, { id: 'chambre', numero: 1, nom: 'Chambre 1' },
  { id: 'cuisine', numero: 1, nom: 'Cuisine' }, { id: 'sdb', numero: 1, nom: 'Salle de bain' },
  { id: 'wc', numero: 1, nom: 'WC' }, { id: 'buanderie', numero: 1, nom: 'Buanderie' }
];
const METIERS = ['electricite', 'plomberie', 'chauffage', 'vmc', 'sols', 'carrelage', 'menuiserie'];

// squelette
const vide = CT.choixTravauxVide();
A(vide.version === 2, 'v2');
A(vide.plomberie && vide.plomberie.sdb && vide.plomberie.laveLinge, 'squelette plomberie');
A(!('transverse' in vide), 'plus de section transverse générique');
A(!('domotique' in vide) && !('irve' in vide) && !('pv' in vide), 'domotique/irve/pv non stockés dans choixTravaux');

// rappel chantier éditable
const qn = CT.construireQuestionnaire({ typeProjet: 'neuf', domotique: 'complet', borneVE: 'oui', pv: 'non' }, PIECES, METIERS);
const rapp = {}; qn.rappel.forEach(r => rapp[r.id] = r);
A(rapp.domotique.cleChantier === 'domotique' && rapp.domotique.valeur === 'complet', 'rappel domotique lit chantier');
A(rapp.irve.cleChantier === 'borneVE' && rapp.irve.valeur === 'oui', 'rappel irve <- borneVE');
A(rapp.domotique.options && rapp.domotique.options.length >= 2, 'rappel domotique éditable (options présentes)');

// dynamique métiers
const codes = qn.sections.map(s => s.code);
A(codes.indexOf('electricite') !== -1 && codes.indexOf('plomberie') !== -1 && codes.indexOf('menuiserie') !== -1, 'sections métiers actifs présentes');
const q1 = CT.construireQuestionnaire({ typeProjet: 'neuf' }, PIECES, ['plomberie']);
A(q1.sections.length === 1 && q1.sections[0].code === 'plomberie', 'métiers inactifs exclus');

// plomberie : SDB multi-choix + WC + cuisine, ciblage pièces réelles
const plo = qn.sections.find(s => s.code === 'plomberie');
A(plo.sdb.length === 1 && plo.sdb[0].id === 'sdb', 'SDB ciblée sur pièce réelle');
A(plo.sdb[0].equipements.some(e => e.v === 'douche_ital') && plo.sdb[0].equipements.some(e => e.v === 'baignoire'), 'SDB : douche ital + baignoire (multi)');
A(plo.wc.length === 1 && plo.wc[0].type.options.some(o => o.v === 'suspendu'), 'WC : type suspendu proposé');
A(plo.cuisine.length === 1 && plo.cuisine[0].evier.options.some(o => o.v === 'double'), 'cuisine : évier double proposé');
// lave-linge : seulement cuisine supportée ; buanderie signalée en "futur"
const llv = plo.laveLinge.options.map(o => o.v);
A(llv.indexOf('cuisine#1') !== -1 && llv.indexOf('buanderie#1') === -1, 'lave-linge : cuisine supportée, buanderie non proposée');
A(plo.laveLinge.futur.some(f => /uanderie/.test(f.nom)), 'lave-linge : buanderie listée comme évolution future');

// VMC conditionnelle : neuf -> pas de "conserver"
const vmcNeuf = qn.sections.find(s => s.code === 'vmc');
const intNeuf = vmcNeuf.questions.find(q => q.id === 'intention').options.map(o => o.v);
A(intNeuf.indexOf('conserver') === -1 && intNeuf.indexOf('creer') !== -1, 'VMC neuf : pas de conserver, créer proposé');
const qReno = CT.construireQuestionnaire({ typeProjet: 'renovation' }, PIECES, ['vmc']);
const intReno = qReno.sections.find(s => s.code === 'vmc').questions.find(q => q.id === 'intention').options.map(o => o.v);
A(intReno.indexOf('conserver') !== -1 && intReno.indexOf('remplacer') !== -1, 'VMC réno : conserver + remplacer proposés');

// chauffage au sol présent + noté non chiffré
const chf = qn.sections.find(s => s.code === 'chauffage');
A(chf && chf.questions[0].id === 'chauffageAuSol' && /non chiffr/i.test(chf.questions[0].note), 'chauffage au sol présent + note non chiffré');

// revêtements unifiés
const rev = qn.sections.find(s => s.code === 'revetements');
A(rev && rev.uniforme && rev.materiaux.length >= 4 && rev.pieces.length === PIECES.length, 'revêtements sol unifiés (global/par pièce)');

// fusion
const merged = CT.fusionner(vide, { chauffage: { chauffageAuSol: 'oui' }, plomberie: { sdb: { 'sdb#1': { equipements: ['douche_ital'] } } } });
A(merged.chauffage.chauffageAuSol === 'oui' && merged.plomberie.sdb['sdb#1'].equipements[0] === 'douche_ital', 'fusion profonde');
A(merged.version === 2, 'fusion garde v2');

const total = ok + ko;
if (ko === 0) console.log('✅ Questionnaire choix de travaux v2 (moteur) : ' + ok + '/' + total);
else { console.error('❌ Questionnaire v2 : ' + ok + '/' + total); process.exit(1); }
