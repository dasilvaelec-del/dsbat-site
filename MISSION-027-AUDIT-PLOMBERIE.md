# MISSION 027 — Audit métier PLOMBERIE
**Date : 2026-07-30 · Audit pur, aucun fichier modifié.**
Périmètre : `getPlombPourPiece` / `selecteursPlomberie` / mes fonctions oublis-évaluation (devis-configurateur.html), catalogue `PRIX.plomberie_sanitaires` + `plomberie_divers` (prix.js), ballon auto (`calculerDevis` dans js/moteur-devis.js), références `normes.js` (DTU 60.1 / 60.11).

---

## 1. Règles métier réellement utilisées

1. **Sélection d'équipements par type de pièce** (`getPlombPourPiece`) : SDB (baignoire, douche italienne/cabine, meuble vasque, WC suspendu, ballon 100 L), SDE (douches, vasque), WC (WC simple/suspendu, lave-mains), cuisine (évier 1/2 bacs, raccordement lave-vaisselle, adoucisseur), cave (raccordement lave-linge, ballon 200 L).
2. **3 gammes** (entrée / standard / premium) sur les sanitaires : `prix = pose + fourniture[gamme]` via `prixPlomberie()`. Chiffrage à la moyenne min-max.
3. **Ballon d'eau chaude automatique** depuis le formulaire (`eauChaude === 'ballon'`), avec garde anti-double facturation (n'ajoute pas si un ballon est déjà configuré manuellement).
4. **Évaluation / oublis** (ajout récent) : groupe de sécurité obligatoire sur ballon, ensemble de douche, paroi, disconnecteur sur adoucisseur, rappel étanchéité douche italienne.
5. Le ballon élec pilote aussi l'électricité (circuit chauffe-eau 20 A + contacteur J/N côté tableau).

## 2. Conformité DTU / bonnes pratiques

- `normes.js` **cite** NF DTU 60.1 (mise en œuvre) et NF DTU 60.11 (**règles de calcul** des installations) — mais **aucune de ces règles de calcul n'est implémentée**. Les DTU sont affichés au client, pas appliqués.
- Correct : groupe de sécurité obligatoire sur chauffe-eau (signalé), disconnecteur sur adoucisseur (bonne pratique), étanchéité SPEC rappelée pour la douche italienne.
- Absent : dimensionnement des diamètres, débits, coefficient de simultanéité (cœur du DTU 60.11), pentes d'évacuation, ventilation primaire/secondaire des chutes.

## 3. Calcul des alimentations EF / ECS

**INEXISTANT.** Les codes `PLO_RESEAU_EF` et `PLO_RESEAU_EC` (PER, 20–24 €/ml) existent au catalogue mais ne sont **jamais proposés ni ajoutés** — vérifié : zéro occurrence dans le configurateur et dans `moteur-devis.js`. Un devis « salle de bain complète » contient **0 ml d'alimentation d'eau**. Aucune longueur, aucun métré, aucune distribution (nourrice/collecteur non proposé non plus).

## 4. Calcul des évacuations

**INEXISTANT.** `PLO_EVAC_40` (Ø40, éviers/douches/baignoires) et `PLO_EVAC_100` (Ø100, WC) existent au catalogue mais ne sont jamais proposés ni calculés. Aucune évacuation n'entre dans un devis. Un WC suspendu est chiffré sans sa chute Ø100.

## 5. Dimensionnement des diamètres

**ABSENT.** Aucune logique ne choisit Ø40 vs Ø100 ni ne calcule une longueur. Les deux diamètres n'existent que comme deux lignes de catalogue distinctes, sans règle de sélection. Le DTU 60.11 (dimensionnement par débit et simultanéité) n'est pas modélisé.

## 6. Équipements oubliés (au catalogue mais non proposables, ou absents)

Non proposés alors qu'au catalogue : réseaux EF/ECS PER, évacuations Ø40/Ø100, **nourrice de distribution** (`PLO_NOURRICE`), **robinet d'arrêt** (`PLO_ROB_ARRET`), **receveurs** (`PLO_RECEV_PRET/90/120PC` — pourtant nécessaires à une douche italienne/cabine), ensemble douche/parois (désormais via oublis seulement).
Absents du catalogue : siphons/bondes, mitigeurs vendus séparément, chauffe-eau thermodynamique, bâti-support autonome (le caisson WC suspendu `PLA_CAISSON_WC` est côté isolation, non relié).

## 7. Incohérences de calcul

- **Douche à l'italienne** : pose 1200–1500 € (très élevée — semble inclure receveur + étanchéité), or mon évaluation recommande en plus l'étanchéité côté carrelage (`CAR_ETANCHEITE`) → **risque de double comptage** si le client ajoute les deux. Le périmètre du « complet » n'est pas documenté.
- **Sanitaires « complet »** : les libellés disent « complet (avec robinetterie) » mais le périmètre exact (raccords locaux, flexibles, siphon) n'est pas explicité → ambiguïté sur ce qui est inclus vs à ajouter.
- **Ballon** : proposé à la fois comme équipement de pièce (SDB 100 L, cave 200 L) ET auto depuis le formulaire — la garde anti-double couvre l'auto, mais deux ballons manuels (SDB + cave) restent cumulés (probablement volontaire).

## 8. Oublis pouvant fausser un devis

1. **Sous-estimation structurelle** : sans alimentation ni évacuation, une SDB réelle est sous-chiffrée de plusieurs centaines d'euros (PER EF+EC + PVC Ø40/Ø100 + raccords).
2. Douche italienne sans receveur/caniveau proposé.
3. WC suspendu sans bâti-support/caisson ni chute Ø100 rattachés.
4. Absence de robinet d'arrêt général et par appareil.
5. Nourrice non proposée alors que c'est le standard des installations neuves.

## 9. Doublons

- Ballon (équipement pièce vs auto formulaire) — géré par garde.
- Étanchéité douche italienne : chevauchement possible `PLO_DOUCHE_ITAL` (pose « complet ») ↔ `CAR_ETANCHEITE` (carrelage) — à clarifier.
- `PLO_RACCORD_LV` (raccordement lave-linge/vaisselle) et un éventuel réseau EF/évac : pas de double aujourd'hui puisque les réseaux ne sont pas proposés.

## 10. Améliorations prioritaires

1. **Auto-dimensionnement du réseau plomberie** (sur le modèle du tableau électrique / centrale VMC) : compter les appareils configurés, en déduire un métré estimatif EF/ECS (PER) + évacuations (Ø40 par appareil, Ø100 par WC) + une nourrice, avec explication « pourquoi ce dimensionnement ».
2. Choix automatique du diamètre : Ø100 pour WC, Ø40 pour les autres appareils.
3. Proposer receveur / caniveau avec la douche italienne, et robinet d'arrêt (général + par appareil).
4. Documenter le périmètre des sanitaires « complet » et lever le doublon étanchéité douche/carrelage.
5. Relier WC suspendu ↔ bâti-support / caisson.

---

## Ce qui est conforme

Sélection d'équipements pertinente par type de pièce ; 3 gammes cohérentes (pose + fourniture) ; ballon auto avec garde anti-double facturation ; groupe de sécurité et disconnecteur correctement signalés comme obligatoires/recommandés ; étanchéité douche italienne rappelée ; le ballon pilote correctement l'électricité (circuit + contacteur). Les prix viennent tous du catalogue (aucun tarif en dur), les choix sont persistés.

## Ce qui doit être corrigé

Les **alimentations EF/ECS** et les **évacuations** ne sont ni proposées ni calculées (codes présents au catalogue, jamais utilisés) ; **aucun dimensionnement de diamètre** ni application du DTU 60.11 ; nourrice, robinet d'arrêt et receveurs non proposés ; périmètre du « complet » ambigu ; doublon potentiel étanchéité douche italienne / carrelage.

## Les risques sur les devis

Risque **majeur de sous-estimation** : un devis plomberie ne contient aujourd'hui ni tuyauterie d'alimentation ni évacuation — l'écart avec la réalité chantier se chiffre en centaines d'euros par pièce d'eau. Risque secondaire de **sur-estimation ponctuelle** via le doublon étanchéité (douche italienne « complet » + étanchéité carrelage). Crédibilité en jeu si un client ou un plombier compare le détail.

## Les 5 corrections prioritaires

1. Auto-dimensionnement réseau EF/ECS + évacuations (compter les appareils → métré estimatif), sur le modèle tableau/VMC.
2. Sélection automatique des diamètres (Ø100 WC / Ø40 autres).
3. Proposer receveur/caniveau + robinet d'arrêt + nourrice.
4. Documenter le périmètre « complet » et supprimer le doublon étanchéité douche/carrelage.
5. Relier WC suspendu → bâti-support/caisson.

## Note sur 10 : **5 / 10**

Le sélecteur d'appareils, les gammes, le ballon auto et les contrôles d'oublis récents sont solides et bien faits. Mais un moteur de plomberie sans alimentation, sans évacuation et sans diamètre reste un **sélecteur d'équipements**, pas un calculateur conforme au DTU 60.11 — et un devis matériellement incomplet. Avec l'auto-dimensionnement réseau (corrections 1–2), la note passerait à ~8/10.

## Statut
🔄 Corrections nécessaires
