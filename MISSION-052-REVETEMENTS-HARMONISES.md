# MISSION 052 — Harmonisation des revêtements & calcul automatique des surfaces

**Date : 2026-07-31 · Périmètre : interface + dimensionnement automatique des revêtements. Aucun moteur métier, aucun prix, aucune règle, aucune formule, aucune logique de cohérence modifiés.**

## Analyse

Le modèle de calcul est déjà par pièce et connaît longueur, largeur, hauteur. Les sols souples (parquet/stratifié/PVC/lino/moquette) et la peinture calculaient déjà leur surface automatiquement (moteur-piece). En revanche le carrelage (sol et faïence) était un **métier séparé** dont les surfaces étaient **saisies manuellement**, alors que le carrelage n'est qu'un type de revêtement de sol et la faïence un type de revêtement mural.

## Cause des incohérences

1. `getPrestationsPourPiece` créait trois familles : « Peinture », « Revêtement sols » (auto) et « Carrelage / Faïence » (manuel) — d'où la double sélection Sol + Carrelage.
2. Le carrelage sol (`CAR_POSE_SOL`) et la faïence (`CAR_POSE_MUR`) étaient rendus comme prestations manuelles à quantité saisie, sans utiliser les surfaces déjà calculées, contrairement aux sols souples et à la peinture.

## Fichiers modifiés

`devis-configurateur.html` uniquement (couche interface + orchestration `recalcPiece`). Aucun fichier `js/` (moteurs, calcul, cohérence, prix) touché.

## Évolutions réalisées

- **Deux familles unifiées** : « Revêtement de sol » (un seul choix de matériau : carrelage, carrelage grand format, parquet, stratifié, PVC, lino, moquette) et « Revêtement mural » (peinture, papier peint, faïence). La famille « Carrelage / Faïence » séparée est supprimée.
- **Sol** : le choix du matériau appelle automatiquement le bon moteur — sols souples via `piece.solType` (sols-auto de moteur-piece), carrelage via `piece.config.carrelage.CAR_POSE_SOL(_GRAND)` alimenté avec la surface sol calculée. Plus aucune saisie manuelle de surface de sol.
- **Faïence — dimensionnement automatique par type de pièce** (nouvelle logique d'interface, hauteur et surface ajustables sans limitation, bascule « murs entiers » toujours possible) :
  - Salle de bain / salle d'eau : zone douche/bain par défaut (≈ 3,0 ml : alcôve 1,2 m + 2 retours 0,9 m) × hauteur 2,10 m.
  - WC : soubassement par défaut, périmètre `2×(L+l) − portes` × hauteur 1,20 m.
  - Cuisine : crédence par défaut, plus grand côté × 0,60 m.
  - Autres pièces : aucune faïence par défaut.
  - Dans tous les cas : choix « Murs entiers » (= surface nette des murs), hauteur modifiable, et surface ajustable manuellement en option.
- **Calcul automatique généralisé** : `recalcPiece` fait un premier passage pour obtenir les surfaces, en déduit les quantités de revêtements, puis un second passage pour le chiffrage — le tout via le moteur pur existant. Les prix restent ceux du catalogue (`getMoyenPrixFor`).
- **Répartition d'affichage** : les sous-totaux des deux familles intègrent le carrelage (faïence côté mural, carrelage sol côté sol), la somme des sous-totaux reste égale au total pièce.
- **Compatibilité ascendante** : les sessions enregistrées (ancien `solType`, ancien `CAR_POSE_MUR` manuel) sont ré-interprétées automatiquement (`deriveSolMateriau`, `deriveFaience`).

## Vérifications

Tests exécutés sur le pipeline réel (`calculerPiece` + moteurs + `calculerDevis` + cohérence) :

- Cuisine → Carrelage : surface sol calculée automatiquement (9 m²). ✅
- Salon → Parquet : surface calculée automatiquement (20 m²), aucun carrelage sol. ✅
- SDB → Carrelage sol + Faïence : les deux surfaces automatiques (5 m² sol, 6,3 m² faïence zone). ✅
- Chambre → Parquet + Papier peint : les deux surfaces automatiques, aucune saisie. ✅
- **Prix identiques** : carrelage sol en auto vs saisie manuelle du même m² → total strictement identique (1853 € = 1853 €). ✅
- Modes faïence : WC soubassement (5,52 m²), cuisine crédence (2,4 m²), murs entiers (= s.murs), hauteur ajustée (2,5 m → 7,5 m²), override manuel (10 m²). ✅
- Sans métier carrelage actif : sol souple seul, aucun objet carrelage parasite. ✅
- Devis global + cohérence : inchangés, pipeline opérationnel. ✅
- HTML : tous les `<script>` parsent.

## Compatibilité

Les moteurs sont appelés exactement comme avant : la faïence et le carrelage sol passent par les mêmes prix catalogue (`CAR_POSE_SOL`, `CAR_POSE_MUR`, `CAR_POSE_MUR_PETIT`), la seule différence étant que leur **quantité** est désormais déduite des surfaces au lieu d'être saisie. Les compléments carrelage (fourniture, mortier-colle, plinthes, seuils, profilés, étanchéité, ragréage) restent proposés par le contrôle des oublis existant, sous la famille sol. Aucune formule, aucun prix, aucune règle de cohérence n'a changé.

## Règles DSBAT identifiées pour les futures évolutions

- Plomberie : longueurs de réseaux EF/ECS et évacuations déductibles du nombre et type d'appareils (déjà partiellement auto via le dimensionnement réseau).
- Isolation / plâtrerie : surfaces de murs / rampants / plafond déductibles des dimensions.
- VMC : débits et nombre de bouches déductibles du type et nombre de pièces (déjà auto).
- Chauffage électrique : puissance et nombre d'émetteurs déductibles du volume et de l'isolation (déjà auto).
- Peinture plafond / sous-couche : déjà déduits des surfaces.
- Menuiserie : quantités déductibles du nombre de portes / fenêtres déjà saisi.
- Maçonnerie / couverture (futurs métiers) : à concevoir d'emblée en auto-dimensionnement depuis les cotes.

## Statut

✅ Revêtements harmonisés et calcul automatique des surfaces généralisé, sans impact sur les moteurs métier.
