# Moteur DSBAT — MIGRATION 019 : Migration du domaine Carrelage

> Le pattern DSBAT est appliqué au **dernier métier « par pièce »** : le Carrelage. Ses
> **connaissances** deviennent des fiches accessibles par le **Port**, son **raisonnement** est
> **journalisé passivement** — sans toucher au calcul, et **le résultat reste identique**. *Aucun
> calcul, surface, quantité, prix, recommandation, alerte ni devis modifié. Les deux Golden Master
> restent strictement identiques.*

---

## Analyse du domaine Carrelage

Le carrelage se répartit sur trois éléments existants : `appliquerRevetements` (M016) détermine les
**surfaces posées** (sol carrelé → `CAR_POSE_SOL`/`_GRAND`, faïence → `CAR_POSE_MUR`/`_PETIT`) ;
`calculerPiece` les **chiffre** (boucle prestations) ; et `js/moteurs/carrelage.js` porte les
**recommandations** (étanchéité, ragréage) et les **oublis** (fourniture avec pertes, consommables,
plinthes). Les connaissances sont dans `CARRELAGE_PARAMS` (`prix.js`) et `FAIENCE_PARAMS`
(`js/moteur-revetements.js`).

## Connaissances identifiées

- **Norme** : `NF DTU 52.2` (pose collée, étanchéité pièces humides) — déjà exposée par le Port.
- **Règles métier** : pertes (chutes) par format et pose (`CARRELAGE_PARAMS.pertes`), étanchéité
  obligatoire en pièce humide (`etancheite.mode`), dimensionnement de la faïence (hauteurs par mode,
  longueur de zone — `FAIENCE_PARAMS`), ragréage sur support irrégulier.

Ne relèvent **pas** du savoir : les prix, les codes catalogue (`CAR_*`), et le mapping code → type de
perte (`perteParPose`, code-catalogue), qui restent dans le moteur.

## Intégration au Port

`js/carrelage-savoir.js` présente ces connaissances comme **4 fiches `REGLE_METIER`**
(`CARR-PERTES`, `CARR-ETANCHEITE`, `CARR-FAIENCE`, `CARR-RAGREAGE`), en **référençant les vrais
paramètres** (source unique, P21 — vérifié : `CARR-PERTES.parametres.pertes.diagonale ===
CARRELAGE_PARAMS.pertes.diagonale`, et `CARR-FAIENCE.parametres.zoneLongueur ===
FAIENCE_PARAMS.zoneLongueur`). Aucun prix, **aucun code catalogue** dans les fiches (vérifié).

## Observateur

`js/observateur-carrelage.js` — observateur **passif** : il lit les surfaces posées
(`piece.config.carrelage`), le mode de faïence et la pose, **consulte le savoir via le Port** (norme
+ coefficient de perte) — pour *expliquer* —, et consigne le raisonnement. Il ne recalcule aucun
prix et ne journalise **aucun code catalogue** (les surfaces sont exprimées en m²).

## Journalisation

Événements, dans l'ordre demandé : `debut_raisonnement` (début) → `fait` (surfaces, sol carrelé m²,
faïence m², type de pose, mode/format de faïence, pièce humide) → `connaissance_candidate`
(NF DTU 52.2 + identifiants des règles carrelage, via le Port) → `decision` (sol carrelé / faïence
présents, type de pose, perte de fourniture lue via le Port, étanchéité requise, **métré** sol/faïence
en m²) → `fin_raisonnement`. **P3 respecté** : aucun prix, aucun code `CAR_*` (vérifié).

---

## Validation Golden Master global

```
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

## Validation Golden Master calcul par pièce

```
node carrelage-migration-check.js  → ✅ 11 assertions OK
     Carrelage : sol 12 m² + faïence 2,4 m² (inchangé) | 4 règles au Port | Journal : 5 évts, 0 prix / 0 code
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
```

Le calcul carrelage (`config.carrelage` + `totalHT`) est **identique** avant/après l'observation ; le
Journal est **sans prix et sans code catalogue** ; les **deux** Golden Master sont identiques.

*Fichiers créés : `js/carrelage-savoir.js`, `js/observateur-carrelage.js`,
`tests/golden-master/carrelage-migration-check.js`, ce document. Aucun fichier livré modifié. Modules
chargés par aucune page.*

---

## Compatibilité avec la Constitution

**P1/P2** (règles carrelage/faïence = savoir accessible par le Port), **P3** (aucun prix ni code
catalogue dans les fiches ni le Journal), **P4/P11** (raisonnement tracé, coefficients expliqués),
**P6** (savoir via le Port), **P7** (observateur = témoin), **P21** (fiches référençant les vrais
paramètres). Le moteur reste la source unique des surfaces, quantités et montants.

## Compatibilité avec le Plan Directeur

Dernier métier « par pièce » migré, en miroir passif, validé par les **deux** Golden Master. Le
module `moteur-revetements.js` reste le point d'entrée unique du domaine des revêtements.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (11 assertions + 2 Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements

- **Un métier réparti sur plusieurs fichiers se migre proprement** : surfaces
  (`appliquerRevetements`), chiffrage (`calculerPiece`), reco/oublis (`moteurs/carrelage.js`) — le
  savoir en est extrait sans toucher aux trois.
- **Les reco/oublis carrelage sont déjà des fonctions de données** (`evaluationSupportCarr`,
  `controlesOublisCarr` renvoient des objets, pas du HTML). Le futur découplage domaine/rendu sera
  donc plus simple ici que pour les métiers dont les reco génèrent directement du HTML.
- **Le métré sans code catalogue** : journaliser des surfaces (m²) plutôt que des codes `CAR_*`
  garde la trace lisible et conforme à P3.

## Bilan des métiers « par pièce »

Les **trois** métiers « par pièce » sont désormais migrés selon le pattern DSBAT :

| Métier | Migration | Connaissances au Port | Montant/métré | Golden Master |
|--------|-----------|-----------------------|---------------|---------------|
| Peinture | M017 | couches, rendements, conditionnements, sous-couche | identique | pièce + devis ✅ |
| Sols | M018 | pertes, diagonale, fraction fourniture | identique | pièce + devis ✅ |
| Carrelage | M019 | pertes, étanchéité, faïence, ragréage | identique | pièce + devis ✅ |

Avec les moteurs de `calculerDevis` déjà migrés (Cohérence, VMC, Isolation, Plomberie, Chauffage,
Tableau), **l'ensemble des domaines métier suit désormais le pattern DSBAT** : savoir au Port,
raisonnement au Journal, calculs et prix inchangés dans les moteurs, sous double filet Golden Master.

## Préparation de la suite

Les migrations métier étant faites, restent des **extractions d'architecture** (sans nouveau
comportement) : passer `metiersActifs` en paramètre du module de revêtements (retirer le couplage
global), **découpler les fonctions reco/oublis** (domaine vs rendu) pour router leur part domaine via
le Port/Journal, et **sortir `tauxTVA`** du HTML. Le cas de la **menuiserie** (prestations catalogue
manuelles, sans paramètres métier dédiés) ne nécessite pas de migration de connaissances à ce stade.

## Conclusion

Le Carrelage est le **dernier métier « par pièce »** entré dans l'architecture DSBAT : ses
connaissances (pertes, étanchéité, faïence, ragréage) sont accessibles par le Port, son raisonnement
est tracé par le Journal **sans le moindre prix ni code catalogue**, et il produit **exactement le
même résultat qu'avant** (sol 12 m² + faïence 2,4 m²). Cette migration **clôt les métiers par
pièce** : tous les domaines suivent désormais le pattern, validés par les **deux** Golden Master, au
risque le plus faible, entièrement réversibles. Aucun comportement n'a changé.

*— MIGRATION 019 : Carrelage. Les métiers « par pièce » sont clôturés.*
