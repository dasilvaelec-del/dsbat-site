// tests/interpretation-pieces-lot41.test.js — LOT41.
// Sépare « cave » et « buanderie » dans l'interprétation du descriptif.
// Teste le VRAI mécanisme (InterpretationDescriptifDSBAT.interpreterDescriptif),
// pas une regex isolée.
// NB moteur (inchangé) : une pièce n'est « détectée » que si la clause porte aussi
// une action/un métier/une gamme (ou une quantité). On emploie donc des verbes
// d'action réels (« rénover », « refaire »…) déjà présents dans le vocabulaire.
const path = require('path');
const RACINE = path.join(__dirname, '..');
const I = require(path.join(RACINE, 'js', 'interpretation-descriptif.js'));
const fs = require('fs');
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'interpretation-descriptif.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const pids = (t) => (I.interpreterDescriptif(t, {}).elementsDetectes || []).map(e => e.pieceId).filter(Boolean);
const has = (t, id) => pids(t).indexOf(id) !== -1;

// ===== Structure : deux entrées distinctes, sans chevauchement =====
A(/id: 'cave', label: 'cave', mots: \['cave'\]/.test(SRC), 'entrée cave = { cave }');
A(/id: 'buanderie', label: 'buanderie', mots: \['buanderie'\]/.test(SRC), 'entrée buanderie = { buanderie }');
A(!/label: 'cave \/ buanderie'/.test(SRC), 'ancien libellé « cave / buanderie » supprimé');

// ===== A. « une cave » -> cave, jamais buanderie =====
A(has('renover une cave', 'cave'), 'A. « (rénover) une cave » -> pièce cave détectée');
A(!has('renover une cave', 'buanderie'), 'A. « une cave » ne crée pas buanderie');

// ===== B. « une buanderie » -> buanderie, jamais cave =====
A(has('renover une buanderie', 'buanderie'), 'B. « (rénover) une buanderie » -> pièce buanderie détectée');
A(!has('renover une buanderie', 'cave'), 'B. « une buanderie » ne crée pas cave (dette corrigée)');

// ===== C. « cave » : comportement historique conservé (mot -> id cave) =====
A(has('refaire la cave', 'cave') && !has('refaire la cave', 'buanderie'), 'C. « cave » toujours interprétée comme cave');

// ===== D. « buanderie » : nouveau comportement attendu (mot -> id buanderie) =====
A(has('refaire la buanderie', 'buanderie') && !has('refaire la buanderie', 'cave'), 'D. « buanderie » interprétée comme buanderie');
// casse + accents indifférents (mécanisme normFull)
A(has('Refaire la BUANDERIE', 'buanderie'), 'D. casse indifférente (BUANDERIE)');

// ===== E. descriptif contenant les deux -> deux pièces distinctes =====
const deux = pids('renover la cave et refaire la buanderie');
A(deux.indexOf('cave') !== -1 && deux.indexOf('buanderie') !== -1, 'E. « une cave et une buanderie » -> cave ET buanderie');
A(deux.filter(x => x === 'cave').length >= 1 && deux.filter(x => x === 'buanderie').length >= 1, 'E. les deux pièces coexistent');

// ===== F. non-régression : autres pièces inchangées =====
// Pièces présentes dans le vocabulaire du descriptif : toujours détectées.
['garage', 'veranda', 'cuisine', 'chambre'].forEach(id => {
  A(has('renover la ' + id, id), 'F. « ' + id + ' » toujours correctement détecté');
});
// grenier : ABSENT du vocabulaire du descriptif AVANT comme APRÈS LOT41
// (hors périmètre : « ne modifie pas grenier/combles »). On vérifie seulement
// qu'il reste inchangé et n'est jamais confondu avec cave/buanderie.
A(!has('renover la grenier', 'grenier'), 'F. grenier : non interprété (inchangé, hors périmètre)');
A(!has('renover la grenier', 'cave') && !has('renover la grenier', 'buanderie'), 'F. grenier : jamais confondu avec cave/buanderie');
// aucune pièce ci-dessus ne doit être confondue avec cave ou buanderie
['garage', 'veranda', 'cuisine', 'chambre'].forEach(id => {
  const got = pids('renover la ' + id);
  A(got.indexOf('cave') === -1 && got.indexOf('buanderie') === -1, 'F. « ' + id + ' » ne déclenche ni cave ni buanderie');
});

console.log('interpretation-pieces-lot41 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
