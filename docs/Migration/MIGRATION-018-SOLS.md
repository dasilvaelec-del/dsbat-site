# Moteur DSBAT — MIGRATION 018 : Migration du domaine Sols

> Le pattern DSBAT est appliqué au domaine **Sols**. Ses **connaissances** deviennent des fiches
> accessibles par le **Port**, son **raisonnement** est **journalisé passivement** — sans toucher au
> calcul, et **le montant reste identique**. *Aucun calcul, surface, quantité, prix, recommandation,
> alerte ni devis modifié. Les deux Golden Master restent strictement identiques.*

---

## Analyse du domaine Sols

Le calcul des sols vit dans `calculerPiece` (`js/moteur-piece.js`) : à partir de la surface au sol,
du type de revêtement (`piece.solType`), de la pose (`piece.solPose`) et de la sous-couche, il
applique une **majoration** = `(1 − fraction) + fraction × (1 + perte)` et chiffre le revêtement
(+ sous-couche). Les connaissances sont centralisées dans `SOLS_PARAMS` (`prix.js`). Le module
`js/moteur-revetements.js` (M016) reste le **point d'entrée** du domaine (dérivation du matériau).

## Connaissances identifiées

- **Norme** : `NF DTU 51.11` (pose flottante), `NF DTU 51.2`, `NF DTU 53.2` — déjà exposées par le
  Port depuis `normes.js`.
- **Règles métier** (dans `SOLS_PARAMS`) : **pertes** (chutes de coupe) par revêtement, **supplément
  de pose diagonale**, **fraction fourniture** (les pertes ne s'appliquent qu'à la part fourniture,
  jamais à la main-d'œuvre).

Ne relèvent **pas** du savoir : les prix et les codes catalogue (`SOL_PARQ_FLOT`…), qui restent dans
le moteur.

## Intégration au Port

`js/sols-savoir.js` présente `SOLS_PARAMS` comme **3 fiches `REGLE_METIER`** (`SOL-PERTES`,
`SOL-DIAGONALE`, `SOL-FOURNITURE-FRACTION`), en **référençant les vrais paramètres** (source unique,
P21 — vérifié : `SOL-PERTES.parametres.stratifie === SOLS_PARAMS.pertes.stratifie`). Aucun prix,
aucun code catalogue.

## Observateur

`js/observateur-sols.js` — observateur **passif** : il lit les données déjà déterminées par
`calculerPiece` (`solType`, `solPose`, `solSousCouche`, `surfaces.sol`), **consulte les coefficients
(perte, fraction, supplément diagonale) VIA LE PORT** — pour *expliquer* la décision, pas la
recalculer — et consigne le raisonnement. Aucun prix touché.

> **Nouveauté de cette migration** : c'est le premier observateur qui **lit des données de décision
> via le Port** (les coefficients de perte/fraction depuis les fiches), et non plus seulement la
> norme. Le Port devient la **source des explications**, conformément à sa vocation.

## Journalisation

Événements, dans l'ordre demandé : `debut_raisonnement` (début du calcul) → `fait` (surface, type de
revêtement, pose, sous-couche) → `connaissance_candidate` (NF DTU 51.11 + identifiants des règles
sols, via le Port) → `decision` (type, surface, sous-couche, pose diagonale, **perte** et **fraction
fourniture** lues via le Port, supplément diagonale) → `fin_raisonnement`. **P3 respecté** : aucun
prix, aucun code catalogue dans le Journal (vérifié : ni `prix`, ni `sols_auto`, ni `SOL_`).

---

## Validation Golden Master global

```
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

## Validation Golden Master calcul par pièce

```
node sols-migration-check.js       → ✅ 9 assertions OK
     Sol chiffré : 1110,06 € HT (inchangé) | stratifié diagonale | 3 règles au Port | Journal : 5 évts, 0 prix
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
```

Le calcul sols (`sols_auto`) est **identique** avant/après l'observation ; la décision journalisée
reflète le type, la pose et la **perte réelle** (0,08 pour le stratifié, lue via le Port) ; le
Journal est **sans prix** ; les **deux** Golden Master sont identiques.

*Fichiers créés : `js/sols-savoir.js`, `js/observateur-sols.js`,
`tests/golden-master/sols-migration-check.js`, ce document. Aucun fichier livré modifié. Modules
chargés par aucune page.*

---

## Compatibilité avec la Constitution

**P1/P2** (règles sols = savoir accessible par le Port), **P3** (aucun prix ni code catalogue dans
les fiches ni le Journal), **P4/P11** (raisonnement tracé, coefficients expliqués), **P6** (savoir
via le Port — y compris pour l'explication), **P7** (observateur = témoin), **P21** (fiches
référençant les vrais paramètres). Le moteur reste la source unique des surfaces, quantités et
montants.

## Compatibilité avec le Plan Directeur

Deuxième métier « par pièce » migré, en miroir passif, validé par les **deux** Golden Master. Le
module de revêtements reste le point d'entrée du domaine.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (9 assertions + 2 Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements

- **Le Port sert aussi les explications** : lire les coefficients (perte, fraction) depuis les fiches
  pour justifier une décision — sans recalculer de prix — enrichit le Journal tout en respectant la
  source unique. C'est un usage nouveau, réutilisable pour les prochains métiers.
- **La distinction savoir / calcul / prix reste nette** : perte et fraction (savoir) au Port ; la
  majoration et le montant (calcul) dans le moteur ; aucun prix dans la trace.
- **Le double filet reste la garantie** : validation simultanée pièce + devis, comme pour la
  Peinture.

---

## Préparation de la Migration 019

Reste le dernier métier « par pièce » : le **Carrelage** (`CARRELAGE_PARAMS` + `moteur-revetements`
pour la faïence et le sol carrelé). La MIGRATION 019 l'abordera selon le même pattern, validée sur
les deux Golden Master — ce qui **clôturera les métiers par pièce**. Resteront ensuite des
extractions d'architecture : passer `metiersActifs` en paramètre du module de revêtements, découpler
les fonctions reco/oublis (domaine vs rendu), et sortir `tauxTVA` du HTML.

---

## Conclusion

Le domaine Sols est le **deuxième métier « par pièce »** entré dans l'architecture DSBAT : ses
connaissances (pertes, diagonale, fraction fourniture) sont accessibles par le Port, son raisonnement
est tracé par le Journal **sans le moindre prix** — avec, pour la première fois, des **coefficients
de décision lus via le Port** —, et il produit **exactement le même montant qu'avant** (1110,06 €
HT). Le pattern tient, validé par les **deux** Golden Master, au risque le plus faible, entièrement
réversible. Aucun comportement n'a changé.

*— MIGRATION 018 : Sols. Deuxième métier « par pièce » dans l'architecture V2.*
