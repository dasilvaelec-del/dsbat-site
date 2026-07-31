# MISSION 051 — Dimensions indépendantes par pièce

**Date : 2026-07-31 · Périmètre : gestion des pièces et de leurs dimensions uniquement. Aucun calcul, aucune formule, aucun prix, aucun moteur métier, aucune logique de cohérence modifiés.**

## Cause du problème

Le modèle de données était **déjà correct et indépendant** : chaque objet de `piecesSelectionnees` possède son propre `dims`, et `calculerPiece(piece, …)` lit `piece.dims` pièce par pièce. Les moteurs n'étaient donc pas en cause.

Le défaut était **entièrement dans la couche de saisie** de l'étape « Pièces » :

1. La grille de sélection n'affichait **qu'un seul bloc de dimensions par type** (`pdims_${id}`, inputs `pdim_l_${id}`…).
2. Le staging `dimsParType` était indexé **par type** (`dimsParType['chambre']`), pas par instance.
3. `validerPieces` recopiait cette **unique** valeur de type dans **toutes** les instances (`existante.dims = …, dimsParType[p.id]`).

Résultat : deux chambres partageaient forcément les mêmes cotes. Ce n'était donc **pas** une limite du modèle de données mais un défaut d'interface + de staging — correction ciblée, sans refonte.

## Fichiers modifiés

`devis-configurateur.html` uniquement. Aucun fichier de `js/` (moteurs, calcul, cohérence, prix) touché.

## Corrections réalisées

- Remplacement du staging `dimsParType` (clé par type) par `dimsParPiece` (clé `id#numero`, ex. `chambre#1`, `chambre#2`).
- `ensureDims(id, numero)` et nouveau `setDimPiece(id, numero, field, value)` : chaque saisie écrit dans l'instance concernée.
- Nouvelle fonction `renderDimBlocks(id)` : génère **un bloc de dimensions par instance** (« Chambre 1 », « Chambre 2 », …) selon le compteur, chaque champ relié à `setDimPiece`.
- La grille (`renderGrid`) ne contient plus qu'un conteneur vide `#pdims_${id}` rempli dynamiquement.
- `changerCompteur` et `appliquerTypologie` appellent `renderDimBlocks(id)` pour (re)générer les blocs.
- `validerPieces` lit `dimsParPiece[dimKey(p.id, i)]` pour chaque instance `i`.
- Persistance : `saveEtat` sauve `dimsParPiece` ; `restaurerEtat` le restaure, re-génère les blocs, et **migre** les anciennes sessions enregistrées par type (initialise chaque instance à partir de l'ancienne valeur, sans écraser un staging par instance existant).

## Vérifications

Test T3 avec 2 chambres (3,5×3,2 et 4,1×2,8), 2 cuisines (3,0×3,0 et 2,5×2,2), 2 salles d'eau (2,0×1,8 et 2,6×2,4) via le pipeline réel (`calculerPiece` + moteurs + `calculerDevis`) :

- Surfaces distinctes pour chaque paire de même type : ✅ (chambres 11,20 vs 11,48 m² ; cuisines 9,00 vs 5,50 m² ; SDE 3,60 vs 6,24 m²).
- Totaux par pièce distincts : ✅.
- Modifier les cotes d'une pièce n'affecte **pas** l'autre pièce du même type : ✅.
- Devis final = somme des pièces + ajouts logement (tableau/VMC/etc.) : ✅.
- HTML : tous les `<script>` inline parsent, aucune référence orpheline (`dimsParType`/`setDimType` ne subsistent que dans le code de migration voulu).

## Compatibilité

Les calculs sont identiques (mêmes formules, mêmes moteurs) : seul le remplissage de `piece.dims` change, et il reste au même format `{l, la, h, fenetres, portes}`. `calculerPiece()` traite chaque pièce indépendamment comme avant. Les moteurs métier, la cohérence et les prix sont inchangés. Les sessions déjà enregistrées sont migrées automatiquement.

## Statut

✅ Chaque pièce possède désormais ses propres dimensions, sans impact sur les moteurs de calcul.
