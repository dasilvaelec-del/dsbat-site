# Moteur DSBAT — MIGRATION 017 : Migration du moteur Peinture

> Le pattern DSBAT est appliqué au premier métier « par pièce » : la **Peinture**. Ses
> **connaissances** deviennent des fiches accessibles par le **Port**, son **raisonnement** est
> **journalisé passivement** — sans toucher au calcul, et **le montant reste identique**. *Aucun
> calcul, surface, quantité, prix, recommandation, alerte ni devis modifié. Les deux Golden Master
> restent strictement identiques.*

---

## Analyse du domaine Peinture

Le calcul de la peinture vit dans `calculerPiece` (`js/moteur-piece.js`) : à partir des surfaces
(murs nets, plafond) et des gammes choisies (murs / plafond / papier peint), il calcule le coût de
finition, détecte et ajoute une **sous-couche** (`detectionSousCouche`, `js/moteurs/peinture.js`),
produit le **métré** (`quantitesPeinture`, `prix.js` : litres + pots) et le total `peinture_auto`.
Les connaissances techniques sont centralisées dans `PEINTURE_PARAMS` (`prix.js`).

## Connaissances identifiées

- **Norme** : `NF DTU 59.1` (peinture des bâtiments) — déjà exposée par le Port depuis `normes.js`.
- **Règles métier** (dans `PEINTURE_PARAMS`) : nombre de couches (finition / sous-couche),
  rendements m²/L/couche (murs, plafond, sous-couche), conditionnements de pots.
- **Règle d'ajout de sous-couche** (`detectionSousCouche`) : sous-couche d'impression sur support
  neuf / BA13 non peint — exposée en fiche documentaire.

Ne relèvent **pas** du savoir : les prix, les codes catalogue (`PEINT_MUR_STD`…) et le mapping
gamme → code (logique de calcul), qui restent dans le moteur.

## Intégration au Port

`js/peinture-savoir.js` présente `PEINTURE_PARAMS` comme **4 fiches `REGLE_METIER`**
(`PEINT-COUCHES`, `PEINT-RENDEMENT`, `PEINT-CONDITIONNEMENTS`, `PEINT-SOUS-COUCHE`), en **référençant
les vrais paramètres** (source unique, P21 — vérifié : `PEINT-RENDEMENT.parametres.murs ===
PEINTURE_PARAMS.rendement.murs`). Aucun prix, aucun code catalogue.

## Observateur

`js/observateur-peinture.js` — observateur **passif** : il lit le résultat déjà produit par
`calculerPiece` (`retour.peinture = { sousCouche, sousCouchePrix, quantites }` + `piece.surfaces`),
consulte le savoir via le Port (lecture seule), et consigne le raisonnement. Il ne recalcule rien.

## Journalisation

Événements, dans l'ordre : `debut_raisonnement` → `fait` (surfaces murs/plafond + gammes) →
`connaissance_candidate` (NF DTU 59.1 + identifiants des règles peinture, via le Port) → `decision`
(présence de sous-couche + sa raison, et le **métré** : litres murs/plafond/sous-couche) →
`fin_raisonnement`. **P3 respecté** : le Journal ne contient **aucun prix** — ni `sousCouchePrix`, ni
`peinture_auto` (vérifié).

---

## Validation Golden Master global

```
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

## Validation Golden Master calcul par pièce

```
node peinture-migration-check.js  → ✅ 10 assertions OK
     Peinture chiffrée : 1170 € HT (inchangé) | sous-couche : oui | 4 règles au Port | Journal : 5 évts, 0 prix
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
```

Le calcul peinture (`peinture_auto` + métré) est **identique** avant/après l'observation ; le Journal
est **sans prix** ; les **deux** Golden Master sont identiques. Mêmes surfaces, quantités, prix,
recommandations, alertes, devis.

*Fichiers créés : `js/peinture-savoir.js`, `js/observateur-peinture.js`,
`tests/golden-master/peinture-migration-check.js`, ce document. Aucun fichier livré modifié
(`prix.js` / `moteur-piece.js` / `moteur-revetements.js` non touchés). Modules chargés par aucune
page.*

---

## Compatibilité avec la Constitution

**P1/P2** (règles peinture = savoir accessible par le Port, sans quitter leur source), **P3** (aucun
prix dans les fiches ni le Journal), **P4/P11** (raisonnement tracé), **P6** (savoir via le Port),
**P7** (observateur = témoin), **P21** (fiches référençant les vrais paramètres). Le moteur reste la
source unique des surfaces, quantités et montants.

## Compatibilité avec le Plan Directeur

Premier métier « par pièce » migré, **après** la mise sous filet du calcul par pièce (A02) et
l'extraction des revêtements (M016), en miroir passif, validé par les **deux** Golden Master. Le
module de revêtements reste le point d'entrée unique des métiers de revêtement.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (10 assertions + 2 Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements

- **Le pattern s'applique au calcul « par pièce » sans changement** : `calculerPiece` fait office de
  moteur (comme les sous-moteurs de `calculerDevis`), et l'observation se fait sur son résultat.
- **Le double filet fait ses preuves** : la migration est validée à la fois au niveau **devis** et au
  niveau **pièce** — la couverture ajoutée en A02 était indispensable pour aborder ce métier en
  sécurité.
- **La sous-couche, une règle métier à part entière** : sa détection (support neuf/BA13) est
  désormais citée dans le Journal via une fiche dédiée, rendant la décision explicable.

---

## Préparation de la Migration 018

Deux métiers « par pièce » restent : les **Sols** (`SOLS_PARAMS` : pertes, fraction de fourniture,
diagonale — déjà calculés dans `calculerPiece`) et le **Carrelage** (`CARRELAGE_PARAMS` +
`moteur-revetements`). La MIGRATION 018 abordera les **Sols** selon le même pattern, validée sur les
deux Golden Master. Restent aussi, en préparation : passer `metiersActifs` en paramètre (retirer le
couplage global du module de revêtements), et sortir `tauxTVA` du HTML.

---

## Conclusion

La Peinture est le **premier métier « par pièce »** entré dans l'architecture DSBAT : ses
connaissances sont accessibles par le Port, son raisonnement (surfaces → couches → métré, sous-couche
comprise) est tracé par le Journal **sans le moindre prix**, et elle produit **exactement le même
montant qu'avant** (1170 € HT). Le pattern tient sur le calcul par pièce, validé par les **deux**
Golden Master, au risque le plus faible, entièrement réversible. Aucun comportement n'a changé.

*— MIGRATION 017 : Peinture. Premier métier « par pièce » dans l'architecture V2.*
