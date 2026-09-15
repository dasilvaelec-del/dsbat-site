// =====================================================================
// tests/deposes-projet.test.js — Contrat du registre Dépose H-DÉPOSE-02
// =====================================================================
// Vérifie uniquement le contrat de données transversal projet.deposes[].
// Aucun moteur métier, catalogue, prix ou UI n'est branché ici.
// =====================================================================

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const Modele = require(path.join(ROOT, 'js', 'modele-projet.js'));

let ok = 0, ko = 0;
const A = (c, m) => {
  if (c) ok++;
  else {
    ko++;
    console.error('  ❌ ' + m);
  }
};

const deposes = [
  {
    id: 'dep_001',
    objetType: 'equipement',
    objetRef: 'radiateur-01',
    pieceRefs: ['salon'],
    zoneRef: null,
    action: 'deposer',
    origineMetier: 'chauffage',
    classification: 'radiateur',
    quantite: 1,
    unite: 'U',
    motif: 'remplacement',
    statut: 'propose',
    provenance: { source: 'moteur_chauffage' },
    pointsAVerifier: []
  },
  {
    id: 'dep_002',
    objetType: 'revetement',
    objetRef: null,
    pieceRefs: ['chambre-01', 'chambre-02'],
    zoneRef: null,
    action: 'deposer',
    origineMetier: 'sols',
    classification: 'parquet',
    quantite: null,
    unite: 'm²',
    motif: 'remplacement',
    statut: 'a_verifier',
    provenance: { source: 'moteur_sols' },
    pointsAVerifier: ['quantite à confirmer']
  }
];

const entree = {
  id: 'test-deposes',
  chantier: { typeBien: 'maison' },
  pieces: [],
  metiers: ['chauffage', 'sols'],
  deposes
};

const projet = Modele.creerProjetDSBAT(entree);

// 1) Registre présent et conservé
A(Array.isArray(projet.deposes), 'deposes[] présent dans le projet');
A(projet.deposes.length === 2, 'deux demandes de dépose conservées');

// 2) Contrat métier
A(projet.deposes[0].objetType === 'equipement', 'objetType = equipement');
A(projet.deposes[0].classification === 'radiateur', 'classification = radiateur');
A(projet.deposes[1].objetType === 'revetement', 'objetType = revetement');
A(projet.deposes[1].classification === 'parquet', 'classification = parquet');

// 3) Relation aux pièces
A(projet.deposes[0].pieceRefs.length === 1, 'une première demande peut viser une pièce');
A(projet.deposes[1].pieceRefs.length === 2, 'une demande peut viser plusieurs pièces');

// 4) Inconnu ≠ zéro
A(projet.deposes[1].quantite === null, 'quantité inconnue conservée à null');

// 5) Statuts V1
A(projet.deposes[0].statut === 'propose', 'statut propose conservé');
A(projet.deposes[1].statut === 'a_verifier', 'statut a_verifier conservé');

// 6) Provenance
A(projet.deposes[0].provenance.source === 'moteur_chauffage',
  'provenance chauffage conservée');
A(projet.deposes[1].provenance.source === 'moteur_sols',
  'provenance sols conservée');

// 7) Pas de chiffrage introduit dans le registre
const brut = JSON.stringify(projet.deposes);
A(brut.indexOf('"prix"') === -1, 'aucun prix dans deposes[]');
A(brut.indexOf('"totalHT"') === -1, 'aucun totalHT dans deposes[]');
A(brut.indexOf('"codeCatalogueRetenu"') === -1,
  'aucun code catalogue retenu dans deposes[]');
// 8) Compatibilité avec les opérations génériques du Projet
const serialise = Modele.serialiser(projet);
const restaure = Modele.deserialiser(serialise);

A(Array.isArray(restaure.deposes), 'désérialisation : deposes[] conservé');
A(restaure.deposes.length === 2, 'désérialisation : deux demandes conservées');
A(restaure.deposes[0].id === 'dep_001', 'désérialisation : identifiant conservé');
A(restaure.deposes[1].quantite === null, 'désérialisation : quantité inconnue reste null');

// Le modèle ne doit pas transformer une demande de dépose en résultat,
// décision ou configuration tarifable.
A(!restaure.resultats || !restaure.resultats.deposes,
  'deposes[] reste distinct des resultats');
A(!restaure.decisions || !restaure.decisions.deposes,
  'deposes[] reste distinct des decisions');

const conforme = Modele.conforme(projet);
A(conforme.ok === true, 'Projet contenant deposes[] reste conforme');
const total = ok + ko;
if (ko === 0) {
  console.log('✅ Dépose Projet (H-DÉPOSE-02) : ' + ok + '/' + total + ' — contrat deposes[] OK');
} else {
  console.error('❌ Dépose Projet : ' + ok + '/' + total);
}

process.exit(ko === 0 ? 0 : 1);