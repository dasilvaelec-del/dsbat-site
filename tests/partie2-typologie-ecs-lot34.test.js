// tests/partie2-typologie-ecs-lot34.test.js — LOT34 : typologie->chambres, énergie, ECS déplacée
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CFG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const CT = require(path.join(RACINE, 'js', 'choix-travaux.js'));
const AD = require(path.join(RACINE, 'js', 'choix-travaux-adapt.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) { const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable ' + sig); let i = src.indexOf('{', s), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) return src.slice(s, i + 1); } } throw new Error('fin ' + sig); }

// ===== 1. TYPOLOGIE -> NOMBRE DE CHAMBRES (dérivé, lecture seule) =====
const reg = {};
const doc = { getElementById: id => reg[id] || null };
reg['nbChambres'] = { value: '' };
const majNbChambres = new Function('document', extraire(DEVIS, 'function majNbChambres(') + '\nreturn majNbChambres;')(doc);
[['1', '0'], ['2', '1'], ['3', '2'], ['4', '3'], ['5', '4'], ['6', '5']].forEach(([p, expected]) => {
  reg['pieces'] = { value: p };
  majNbChambres();
  A(reg['nbChambres'].value === expected, 'T' + p + ' => ' + expected + ' chambre(s)');
});
// champ chambres = lecture seule (input readonly, plus de <select id="nbChambres">)
A(/<input id="nbChambres"[^>]*readonly/.test(DEVIS), 'nbChambres = champ lecture seule (dérivé)');
A(!/<select id="nbChambres"/.test(DEVIS), 'nbChambres n\'est plus une saisie <select> indépendante');
A(/id="pieces" onchange="majNbChambres\(\)"/.test(DEVIS), 'nbChambres se resynchronise au changement de typologie');

// ===== 2. M62 / compositionTypologie inchangé avec la valeur dérivée =====
const compositionTypologie = new Function(extraire(CFG, 'function compositionTypologie(') + ';return compositionTypologie;')();
// T3 -> 2 chambres dérivées -> compo.chambre === 2
A(compositionTypologie('3', 95, { nbChambres: '2' }).compo.chambre === 2, 'compositionTypologie consomme la valeur dérivée (T3 -> 2 chambres)');
A(compositionTypologie('4', 95).compo && typeof compositionTypologie('4', 95).compo === 'object', 'compositionTypologie rétrocompatible sans programme');

// ===== 3. ÉNERGIE (Partie 2) : #energie, fioul retiré en neuf, plus de #chauffage/#eauChaude =====
A(/<select id="energie">/.test(DEVIS), 'Partie 2 : question énergie (#energie)');
A(!/<select id="chauffage">/.test(DEVIS), 'Partie 2 : plus de #chauffage (système déplacé au questionnaire)');
A(!/id="eauChaude"/.test(DEVIS), 'Partie 2 : ECS retirée');
// fioul présent dans l'UI (valeur historique) mais masqué en neuf par majContexteTypePrestation
A(/<option value="fioul">/.test(DEVIS), 'énergie : option fioul présente (valeur historique conservée)');
A(/#energie option\[value="fioul"\]/.test(DEVIS) && /fio\.style\.display = neuf \? 'none'/.test(DEVIS), 'énergie : fioul masqué en NEUF (préservé pour la rénovation)');
// collecterDonnees : energie collectée, chauffage/eauChaude non collectés en Partie 2
const chBlock = extraire(DEVIS, 'chantier: {');
A(/\benergie:/.test(chBlock), 'collecterDonnees : chantier.energie (descriptif)');
A(!/\bchauffage:/.test(chBlock) && !/\beauChaude:/.test(chBlock), 'collecterDonnees : plus de chauffage/eauChaude en Partie 2');

// ===== 4. ECS dans le questionnaire + écriture canonique chantier.eauChaude =====
const q = CT.construireQuestionnaire({ typeProjet: 'neuf' }, [{ id: 'cuisine', numero: 1, nom: 'Cuisine' }], ['plomberie']);
const ecs = q.sections.find(s => s.code === 'ecs');
A(ecs && ecs.questions[0].id === 'type' && ecs.questions[0].options.some(o => o.v === 'ballon'), 'questionnaire : section ECS avec valeurs réelles (ballon)');
A(!ecs.questions[0].options.some(o => !['chaudiere', 'ballon', 'instantane', 'autre'].includes(o.v)), 'ECS : aucune valeur inventée (enum audité)');
// adaptateur : ECS -> chantier.eauChaude (source canonique consommée)
let pieces = [{ id: 'cuisine', numero: 1, nom: 'Cuisine', config: {}, dims: {} }];
let chantier = { typeProjet: 'neuf', choixTravaux: { version: 2, ecs: { type: 'ballon' }, plomberie: { sdb: {}, wc: {}, cuisine: {}, laveLinge: { piece: null } } } };
let r = AD.appliquer(pieces, chantier, { metiersActifs: ['plomberie'] });
A(chantier.eauChaude === 'ballon', 'ECS ballon -> chantier.eauChaude (canonique, consommée par moteur-devis)');
A(r.applique.some(x => /ECS/i.test(x) && /ballon/i.test(x)), 'ECS ballon rapportée comme chiffrée');
// pas de doublon : eauChaude n'est PAS stocké dans une 2e structure
A(!('eauChaude' in chantier.choixTravaux), 'ECS : pas de doublon eauChaude dans choixTravaux (source = chantier.eauChaude)');
// valeur non-ballon : conservée, descriptive
let ch2 = { typeProjet: 'neuf', choixTravaux: { version: 2, ecs: { type: 'instantane' }, plomberie: { sdb: {}, wc: {}, cuisine: {}, laveLinge: { piece: null } } } };
let r2 = AD.appliquer([{ id: 'cuisine', numero: 1, config: {}, dims: {} }], ch2, { metiersActifs: ['plomberie'] });
A(ch2.eauChaude === 'instantane' && r2.descriptif.some(x => /ECS/i.test(x)), 'ECS non-ballon : conservée + signalée descriptive');

const total = ok + ko;
if (ko === 0) console.log('✅ LOT34 typologie/énergie/ECS : ' + ok + '/' + total);
else { console.error('❌ LOT34 : ' + ok + '/' + total); process.exit(1); }
