'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(
  __dirname,
  '..',
  'docs',
  'Architecture',
  'schema-projet-dsbat.schema.json'
);

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

let ok = 0;
let ko = 0;

function A(condition, message) {
  if (condition) {
    ok++;
  } else {
    ko++;
    console.error('❌ ' + message);
  }
}

// ------------------------------------------------------------------
// 1) Le schéma JSON reste valide
// ------------------------------------------------------------------
A(
  schema &&
  schema.type === 'object' &&
  schema.properties &&
  schema.properties.pieces &&
  schema.properties.pieces.items &&
  schema.properties.pieces.items.properties,
  'le schéma contient bien la définition des pièces'
);

// ------------------------------------------------------------------
// 2) chauffageFonctions est déclaré au niveau de la pièce
// ------------------------------------------------------------------
const pieceProps = schema.properties.pieces.items.properties;

A(
  Object.prototype.hasOwnProperty.call(pieceProps, 'chauffageFonctions'),
  'chauffageFonctions est déclaré sur une pièce'
);

// ------------------------------------------------------------------
// 3) Le bloc est bien déclaratif et fermé
// ------------------------------------------------------------------
const chauffage = pieceProps.chauffageFonctions;

A(
  chauffage &&
  chauffage.type &&
  chauffage.type.includes('object'),
  'chauffageFonctions accepte un objet'
);

A(
  chauffage.additionalProperties === false,
  'chauffageFonctions possède un contrat fermé'
);

A(
  chauffage.properties &&
  chauffage.properties.existant &&
  chauffage.properties.intention &&
  chauffage.properties.solution &&
  chauffage.properties.etatLocal,
  'chauffageFonctions contient existant, intention, solution et etatLocal'
);

// ------------------------------------------------------------------
// 4) Séparation déclaratif / money-path
// ------------------------------------------------------------------
A(
  pieceProps.config &&
  pieceProps.config.additionalProperties,
  'config conserve son contrat par métier'
);

A(
  !Object.prototype.hasOwnProperty.call(
    chauffage.properties,
    'prix'
  ),
  'chauffageFonctions ne contient pas de prix'
);

A(
  !Object.prototype.hasOwnProperty.call(
    chauffage.properties,
    'code'
  ),
  'chauffageFonctions ne contient pas de code catalogue'
);

// ------------------------------------------------------------------
// 5) Pas de résultat calculé dans le déclaratif
// ------------------------------------------------------------------
A(
  !Object.prototype.hasOwnProperty.call(
    chauffage.properties,
    'puissance'
  ),
  'chauffageFonctions ne contient pas de puissance calculée'
);

A(
  !Object.prototype.hasOwnProperty.call(
    chauffage.properties,
    'circuits'
  ),
  'chauffageFonctions ne contient pas de circuits'
);

A(
  !Object.prototype.hasOwnProperty.call(
    chauffage.properties,
    'resultat'
  ),
  'chauffageFonctions ne contient pas de résultat moteur'
);

// ------------------------------------------------------------------
// Résultat
// ------------------------------------------------------------------
console.log(
  (ko === 0 ? '✅' : '❌') +
  ' CH-11-B (Contrat chauffageFonctions) : ' +
  ok +
  ' assertions OK, ' +
  ko +
  ' échec(s).'
);

process.exit(ko === 0 ? 0 : 1);