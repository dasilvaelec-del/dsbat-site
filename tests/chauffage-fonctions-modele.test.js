'use strict';

const assert = require('assert');
const modeleProjet = require('../js/modele-projet.js');

const chauffageFonctions = {
  existant: {
    present: true,
    type: 'radiateur_electrique',
    energie: 'electricite',
    statut: 'fonctionnel'
  },
  intention: {
    action: 'remplacer',
    objectif: 'renovation'
  },
  solution: {
    technologie: 'electrique',
    systeme: 'radiateur',
    statut: 'a_configurer'
  },
  etatLocal: 'a_configurer'
};

const piece = {
  id: 'salon',
  nom: 'Salon',
  chauffageFonctions: chauffageFonctions,
  config: {
    electricite: {
      ELEC_SC20_FP: 1
    }
  }
};

const projet = modeleProjet.creerProjetDSBAT({
  chantier: {},
  pieces: [piece],
  metiers: ['chauffage', 'electricite']
});

assert.deepStrictEqual(
  projet.pieces[0].chauffageFonctions,
  chauffageFonctions,
  'chauffageFonctions est conservé dans le Projet'
);

assert.deepStrictEqual(
  projet.pieces[0].config,
  piece.config,
  'la config existante est conservée'
);

assert.notStrictEqual(
  projet.pieces[0],
  piece,
  'la pièce du Projet est une copie'
);

assert.notStrictEqual(
  projet.pieces[0].chauffageFonctions,
  chauffageFonctions,
  'chauffageFonctions est également cloné'
);

console.log(
  '✅ CH-11-C (Transport modèle Projet) : 4 assertions OK, 0 échec(s).'
);