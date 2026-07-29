# Architecture du configurateur DS.BAT

Document de référence pour organiser les développements futurs.
Objectif : faire évoluer le configurateur vers un vrai logiciel, **module par module**,
sans jamais casser l'existant.

## Principe directeur

Le code passe progressivement d'un gros fichier HTML monolithique
(`devis-configurateur.html`) vers des **moteurs autonomes** dans `/js`.
On ne déplace un bloc que lorsqu'il est **stable** et **testable isolément**.
Tant qu'un module est instable ou fortement couplé au DOM, il reste dans le HTML.

Règle d'or : **une extraction ne doit changer ni un calcul, ni un prix, ni l'interface.**
On déplace du code, on ne le réécrit pas.

## État actuel des fichiers

### Chargés dans le `<head>` (ordre important)

| Ordre | Fichier | Rôle | Statut |
|------|---------|------|--------|
| 1 | `config.js` | Constantes entreprise, réseaux, TVA/acomptes | stable |
| 2 | `prix.js` | Catalogue `PRIX` + sous-moteurs métier (`dimensionnementTableau`, `dimensionnementVMC`, `coefZone`, prix peinture/élec…) | stable |
| 3 | `js/moteur-devis.js` | **Moteur de calcul unifié** `calculerDevis()` (Total HT / TVA / TTC / acomptes) | stable ✅ extrait |
| 4 | `js/moteur-recommandations.js` | **Moteur de recommandations** `window.RecoEngine` (conseils classés, base de règles) | stable ✅ extrait |
| 5 | `menu.js` | Menu / navigation commune | stable |

### Encore dans `devis-configurateur.html` (script inline)

Ces modules restent dans le HTML car ils sont **couplés au DOM** ou **encore en évolution** :

- **UI / rendu** : `renderPhase1/2/3`, `renderPieceConfig`, `renderPrestRow`, onglets, phase-bar → futur `js/ui.js`.
- **État & persistance** : `piecesSelectionnees`, `chantier`, `metiersActifs`, `saveEtat`, `restaurerEtat` (sessionStorage).
- **Recalcul pièce** : `recalcPiece`, `changerQty`, `updateSectionTotals` (lit/écrit le DOM).
- **Normes & reco par pièce** : `normeMin`, `recoDSBAT`, `appliquerNorme`.
- **Génération PDF & emails** : `genererPDFConfig`, `envoyerNotifications`, `envoyerEmail`.
- **Parcours / capture** : `allerPhase`, `validerCoordonnees`, `captureModal` (MISSION 024).
- **Utilitaires** : `formatEuro`, `tempsUnitaire`, `findPrestLabel` → futur `js/utils.js`.

## Comment les scripts partagent leurs données

Tous les fichiers `/js` sont des **scripts classiques** (`<script src>`), pas des modules ES.
Ils partagent donc la **même portée globale** : une fonction extraite (ex. `calculerDevis`)
continue de lire `piecesSelectionnees`, `chantier`, `PRIX`, `tauxTVA`… au **moment de l'appel**.
C'est pourquoi l'ordre de chargement importe peu pour les dépendances lues à l'exécution,
mais on garde `prix.js` avant les moteurs par clarté.

## Convention pour les prochaines extractions

1. Choisir un bloc **stable** et le plus **découplé** possible du DOM.
2. Le déplacer **verbatim** dans `js/<nom-du-module>.js` (aucune réécriture).
3. Ajouter le `<script src>` dans le `<head>`, **après** ses dépendances.
4. Remplacer le bloc inline par un commentaire pointeur.
5. Vérifier : syntaxe (Node), définition unique, aucun doublon, aucune régression visible.
6. Documenter le déplacement ici.

## Feuille de route suggérée (non figée)

- `js/utils.js` — helpers purs (`formatEuro`, formatage, dates).
- `js/ui.js` — rendu des phases et composants (après stabilisation).
- `js/moteur-peinture.js` / `js/moteur-electricite.js` — extraits de `prix.js` **uniquement quand figés**.
- `js/etat.js` — gestion d'état + persistance (sessionStorage/localStorage).

> Ne pas extraire un module tant qu'il change encore souvent : le coût de synchronisation dépasse le bénéfice.
