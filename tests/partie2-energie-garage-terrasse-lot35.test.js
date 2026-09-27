// tests/partie2-energie-garage-terrasse-lot35.test.js — LOT35 : énergie, garage config, terrasse
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const DEVIS = fs.readFileSync(path.join(RACINE, 'devis.html'), 'utf8');
const CT = require(path.join(RACINE, 'js', 'choix-travaux.js'));
const AD = require(path.join(RACINE, 'js', 'choix-travaux-adapt.js'));
let ok = 0, ko = 0; const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) { const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable ' + sig); let i = src.indexOf('{', s), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) return src.slice(s, i + 1); } } throw new Error('fin ' + sig); }

// ===== 1. ÉNERGIE (Partie 2) =====
const enBloc = DEVIS.slice(DEVIS.indexOf('<select id="energie">'), DEVIS.indexOf('</select>', DEVIS.indexOf('<select id="energie">')) + 9);
A(enBloc.indexOf('<option value="" selected>Sélectionnez</option>') !== -1, 'énergie : valeur initiale vide « Sélectionnez »');
A(enBloc.indexOf('<option value="electrique">Électricité</option>') !== -1, 'énergie : Électricité');
A(enBloc.indexOf('<option value="gaz_electricite">Gaz + électricité</option>') !== -1, 'énergie : Gaz + électricité');
A(!/<option value="gaz">/.test(enBloc), 'énergie : pas de « gaz seul »');
A(!/<option value="pompe">/.test(enBloc) && !/<option value="autre">/.test(enBloc), 'énergie : ni PAC ni « autre » (ce ne sont pas des énergies)');
A(/<option value="fioul">/.test(enBloc), 'énergie : fioul conservé dans le code (historique)');
// fioul masqué en neuf (majContexteTypePrestation)
A(/#energie option\[value="fioul"\]/.test(DEVIS) && /fio\.style\.display = neuf \? 'none'/.test(DEVIS), 'énergie : fioul masqué en NEUF');
A(/en\.value === 'fioul'\) en\.value = '';/.test(DEVIS), 'énergie : fioul neuf -> réinitialisé à vide (pas d\'auto-sélection)');
// chantier.chauffage non touché par la Partie 2
const chBlock = extraire(DEVIS, 'chantier: {');
A(/\benergie:/.test(chBlock) && !/\bchauffage:/.test(chBlock), 'collecterDonnees : energie collectée, chauffage non touché');

// ===== 2. GARAGE : configuration conditionnelle =====
A(/<select id="garage" onchange="majGarageConfig\(\)">/.test(DEVIS), 'garage : onchange majGarageConfig');
A(/id="garageConfig"/.test(DEVIS) && /value="separe"/.test(DEVIS) && /value="attenant"/.test(DEVIS), 'garage : configurations séparé / attenant présentes');
const reg = {}; const doc = { getElementById: id => (id in reg ? reg[id] : { value: '', style: {} }) };
const majGarageConfig = new Function('document', extraire(DEVIS, 'function majGarageConfig(') + '\nreturn majGarageConfig;')(doc);
reg['garageConfigWrap'] = { style: { display: 'x' } }; reg['garageConfig'] = { value: 'attenant' };
reg['garage'] = { value: 'oui' }; majGarageConfig();
A(reg['garageConfigWrap'].style.display === '' && reg['garageConfig'].value === 'attenant', 'garage=oui : question config visible + valeur conservée');
reg['garage'] = { value: 'non' }; majGarageConfig();
A(reg['garageConfigWrap'].style.display === 'none' && reg['garageConfig'].value === '', 'garage=non : config masquée + valeur vidée');

// ===== 3. TERRASSE : éclairage conditionnel =====
A(/<select id="terrasse" onchange="majTerrasse\(\)">/.test(DEVIS), 'terrasse : onchange majTerrasse');
A(/id="terrasseEclairage"/.test(DEVIS), 'terrasse : question éclairage présente');
const reg2 = {}; const doc2 = { getElementById: id => (id in reg2 ? reg2[id] : { value: '', style: {} }) };
const majTerrasse = new Function('document', extraire(DEVIS, 'function majTerrasse(') + '\nreturn majTerrasse;')(doc2);
reg2['terrasseEclairageWrap'] = { style: { display: 'x' } }; reg2['terrasseEclairage'] = { value: 'oui' };
reg2['terrasse'] = { value: 'oui' }; majTerrasse();
A(reg2['terrasseEclairageWrap'].style.display === '' && reg2['terrasseEclairage'].value === 'oui', 'terrasse=oui : éclairage visible + conservé');
reg2['terrasse'] = { value: 'non' }; majTerrasse();
A(reg2['terrasseEclairageWrap'].style.display === 'none' && reg2['terrasseEclairage'].value === '', 'terrasse=non : éclairage masqué + vidé');

// ===== 4. collecterDonnees : stockage garage/terrasse (garde anti-valeur périmée) =====
const reg3 = {}; const doc3 = { getElementById: id => (id in reg3 ? reg3[id] : { value: '' }), querySelectorAll: () => [] };
const collecterDonnees = new Function('document', extraire(DEVIS, 'function collecterDonnees(') + '\nreturn collecterDonnees;')(doc3);
reg3['garage'] = { value: 'oui' }; reg3['garageConfig'] = { value: 'separe' };
reg3['terrasse'] = { value: 'oui' }; reg3['terrasseEclairage'] = { value: 'oui' };
let ch = collecterDonnees().chantier;
A(ch.garage === 'oui' && ch.garageConfig === 'separe', 'collecte : garage oui + config séparé stockés');
A(ch.terrasse === 'oui' && ch.terrasseEclairage === 'oui', 'collecte : terrasse oui + éclairage stockés');
reg3['garage'] = { value: 'non' }; reg3['garageConfig'] = { value: 'separe' }; // valeur périmée
reg3['terrasse'] = { value: 'non' }; reg3['terrasseEclairage'] = { value: 'oui' };
ch = collecterDonnees().chantier;
A(ch.garageConfig === '', 'collecte : garage non -> garageConfig vidé (pas de valeur périmée)');
A(ch.terrasseEclairage === '', 'collecte : terrasse non -> terrasseEclairage vidé');

// ===== 5. ÉCLAIRAGE EXTÉRIEUR ENTRÉE : dans le questionnaire Électricité, PAS en Partie 2 =====
const q = CT.construireQuestionnaire({ typeProjet: 'neuf' }, [], ['electricite']);
const elec = q.sections.find(s => s.code === 'electricite');
A(elec.questions.some(x => x.id === 'eclairageExtEntree'), 'entrée : question éclairage extérieur dans le questionnaire Électricité');
A(!/entrée de la maison/.test(DEVIS), 'entrée : PAS dans la Partie 2 (devis.html)');
// pas de doublon transverse / programme
A(!/eclairageExtEntree/.test(DEVIS), 'entrée : donnée absente de la Partie 2 (pas de doublon programme)');
// adaptateur : descriptif (aucun consommateur dédié)
let ch2 = { typeProjet: 'neuf', choixTravaux: { version: 2, electricite: { niveau: null, reseauMultimedia: null, eclairageExtEntree: 'oui' } } };
let r = AD.appliquer([{ id: 'salon', numero: 1, config: {}, dims: {} }], ch2, { metiersActifs: ['electricite'] });
A(r.descriptif.some(x => /entrée/i.test(x)), 'entrée : signalée descriptive (aucun consommateur moteur dédié)');

const total = ok + ko;
if (ko === 0) console.log('✅ LOT35 énergie/garage/terrasse : ' + ok + '/' + total);
else { console.error('❌ LOT35 : ' + ok + '/' + total); process.exit(1); }
