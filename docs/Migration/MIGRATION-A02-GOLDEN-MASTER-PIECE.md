# Moteur DSBAT — MISSION A02 : Extension du Golden Master au cœur du calcul par pièce

> **Renforcement du filet de sécurité. Aucun changement fonctionnel, aucun calcul, moteur ou
> interface modifié.** On protège désormais explicitement `calculerPiece()` et
> `appliquerRevetements()` par un Golden Master dédié, avant toute migration des métiers par pièce.

---

## Analyse de la couverture actuelle

Le Golden Master initial (MIGRATION 005) protège `calculerDevis` + `controlesCoherence` +
`RecoEngine`, mais traite **`piece.totalHT` comme une entrée figée** (limite assumée). Conséquence :
le **calcul par pièce** — `calculerPiece` (`js/moteur-piece.js`) et `appliquerRevetements`
(revêtements sol + faïence) — **n'était pas validé**. C'est précisément le cœur que les futurs
moteurs Peinture / Sols / Carrelage vont toucher : il fallait le mettre sous filet.

Bonne nouvelle confirmée par l'analyse : les dépendances de `calculerPiece` sont **déjà
modulaires** (`js/pricing.js`, `js/moteurs/peinture.js`, `prix.js`) — donc reproductibles hors
navigateur. Seuls les helpers de revêtements (faïence/sol) restent dans le HTML, mais forment un
**bloc contigu auto-suffisant**, chargé en lecture seule depuis sa source (comme `tauxTVA` en M005).

## Nouvelles zones couvertes

Un **Golden Master par pièce** (`tests/golden-master/piece-golden-master.js`) capture, pour chaque
cas, le **modèle produit** : `surfaces`, `config` (dont `peinture_auto`, `sols_auto`, `carrelage`),
`totalHT`, `tempsChantier`, `tempsParMetier`, `peintureQuantites`, et l'objet de retour. Il reproduit
**fidèlement l'enchaînement de `recalcPiece`** : `calculerPiece → (si sols/carrelage)
appliquerRevetements → calculerPiece`.

## Cas de référence ajoutés

**10 scénarios représentatifs** (pas de redondance) :

1. `peinture_seule` — murs + plafond, état moyen.
2. `sol_souple_parquet` — parquet flottant + sous-couche.
3. `sol_souple_diagonale` — pose diagonale (perte majorée, `SOLS_PARAMS`).
4. `sol_carrelage` — carrelage au sol via `appliquerRevetements` (+ crédence auto en cuisine).
5. `faience_sdb_zone` — faïence zone douche (SDB).
6. `mixte_peinture_faience` — **cas mixte** peinture + faïence (SDB).
7. `piece_humide_souscouche` — SDB neuve, déclenche la détection de sous-couche.
8. `multi_metiers_sdb` — élec + plomberie + peinture + faïence (boucle prestations manuelles).
9. `cas_limite_dims_nulles` — dimensions nulles → surfaces 0, `totalHT` 0.
10. `cas_limite_grande_piece` — grande surface, hauteur haute.

## Couverture de calculerPiece()

Entièrement exercée : calcul des **surfaces** (sol, murs nets déduction ouvertures, plafond),
**peinture auto** (gammes murs/plafond, papier, sous-couche), **sols auto** (revêtement + sous-couche
+ perte/diagonale), **boucle des prestations manuelles** (élec, plomberie, carrelage…), **temps de
chantier** par métier, et `totalHT`. Dépendances réelles utilisées (getMoyenPrixFor, tempsUnitaire,
detectionSousCouche, quantitesPeinture, SOLS_PARAMS) — aucun prix modifié.

## Couverture de appliquerRevetements()

Exercée sur les deux volets : **sol** (souple vs carrelé → `CAR_POSE_SOL`/`CAR_POSE_SOL_GRAND` ou
`solType`) et **faïence murale** (modes zone / soubassement / crédence / murs, formats standard /
mosaïque, hauteur et surface). Les comportements automatiques par type de pièce sont capturés (ex.
**crédence automatique en cuisine** → `CAR_POSE_MUR = 2,4 m²`), verrouillant des subtilités qu'une
migration pourrait casser sans s'en apercevoir.

## Cas limites

`dims` nulles (surfaces et total à 0), grande pièce + hauteur haute (murs nets élevés), pose
diagonale (majoration de perte), pièce humide (détection de sous-couche). Ces bornes protègent les
branches sensibles du calcul.

## Zones restant hors couverture

- **`recalcPiece` lui-même** (le contrôleur DOM : lectures de gammes, affichage, `saveEtat`) — reste
  hors couverture *par nature* (il touche le DOM ; il n'est pas un calcul). Sa future extraction vers
  `ui.js` est cosmétique.
- **Les fonctions reco/oublis** (`recoSupport*Html`, `oublis*Html`) — non couvertes (elles fondent
  domaine et présentation ; à découpler plus tard).
- **`tauxTVA`** — toujours dans le HTML (chargée par extraction ; micro-migration à venir).

## Niveau de confiance

**Élevé** sur le cœur du calcul par pièce : capture **déterministe** (double `verify` identique),
scénarios couvrant peinture, sols souples, carrelage, faïence, cas mixtes, pièce humide et cas
limites. Combiné au Golden Master devis (inchangé), le filet couvre désormais **les deux niveaux** :
le calcul **par pièce** (nouveau) et l'**agrégation en devis** (existant). Il reste **modéré** sur la
couche présentation (reco/oublis), volontairement hors périmètre.

---

## Compatibilité avec la Constitution

Renforce **P17** (déterminisme vérifié), sert **P3** (aucun prix touché ; prix seulement *lus*),
respecte **P21** (helpers HTML lus de leur source, non recopiés). Aucun savoir, moteur ou décision
modifié — pur outillage de non-régression.

## Compatibilité avec le Plan Directeur

Applique la règle d'or « **le filet avant le trapèze** » au niveau du calcul par pièce, avant
d'autoriser les migrations Peinture / Sols / Carrelage. C'est le prérequis identifié par l'analyse
A01.

## Compatibilité avec la Charte

Additif (3 fichiers de test neufs), **réversible** (suppression sans trace), **testable** (c'est le
test), **documenté**. Aucun fichier livré modifié ; harnais hors ligne.

---

## Préparation de la future Migration 016

Le cœur du calcul par pièce étant sous filet, la **MIGRATION 016** pourra déplacer
`appliquerRevetements` (et ses helpers faïence/sol) du HTML vers un module, **validé par
`piece-golden-master.js`** (résultat identique). Puis viendront les migrations **Peinture (017)**,
**Sols (018)** et **Carrelage (019)** selon le pattern DSBAT, chacune vérifiée « Golden Master pièce
identique » **et** « Golden Master devis identique ».

## Conclusion

Le Golden Master couvre désormais **explicitement** `calculerPiece()` et `appliquerRevetements()` :
10 scénarios représentatifs, capture déterministe, cas mixtes et cas limites inclus, subtilités
métier verrouillées (crédence auto, sous-couche, diagonale). Le filet de sécurité est **extrêmement
solide** avant d'aborder les moteurs Peinture, Sols et Carrelage — exactement ce que l'analyse A01
recommandait. Aucun comportement n'a changé ; les deux Golden Master (devis et pièce) sont verts.

*— MISSION A02 : le cœur du calcul par pièce est désormais protégé.*
