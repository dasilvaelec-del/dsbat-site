# Moteur DSBAT — MIGRATION 013 : Migration du moteur Plomberie

> Le pattern éprouvé (MIGRATIONS 010–012) est appliqué au moteur Plomberie : ses **connaissances**
> deviennent des fiches accessibles par le **Port**, son **raisonnement** est **journalisé
> passivement** — sans toucher au moteur, et **le montant reste identique**. *Aucun calcul, règle,
> prix, prestation, devis, recommandation, alerte ni interface modifié. Golden Master intégralement
> valide.*

---

## Analyse du moteur Plomberie

`prix.js` → `dimensionnementPlomberie(b)` : à partir du comptage d'appareils (WC, vasque, douche,
baignoire, évier, lave-linge), il dimensionne les **réseaux manquants** — alimentations EF/ECS (PER),
évacuations Ø40/Ø100 — et les **accessoires** (nourrice, robinets d'arrêt, receveur), et retourne une
composition **chiffrée** (`prixTotalHT`). Moteur **feuille**, appelé par `calculerDevis` (donc
montant validable par le Golden Master, comme la VMC).

## Connaissances identifiées

- **Normes** : `NF DTU 60.1`, `NF DTU 60.11` (plomberie) — **déjà exposées** par le Port depuis
  `normes.js`.
- **Règles métier** (dans `PLOMBERIE_PARAMS`) : métré des alimentations EF/ECS par point, métré et
  **diamètres** des évacuations (WC → Ø100, autres → Ø40), règles d'accessoires (nourrice si
  plusieurs appareils, robinet d'arrêt par alimentation).
- **`PLOMBERIE_INCLUSIONS`** (contenu « inclus/exclus » par poste, anti-doublon) : connaissance
  métier réelle mais **fortement couplée aux codes catalogue** → **laissée dans le moteur** pour
  l'instant (candidate à une migration ultérieure).

Ne relèvent **pas** du savoir : les prix et les codes catalogue (`PLO_RESEAU_EF`…).

## Intégration au Port

`js/plomberie-savoir.js` présente `PLOMBERIE_PARAMS` comme **3 fiches `REGLE_METIER`**
(`PLO-RESEAU-EF-ECS`, `PLO-EVACUATIONS`, `PLO-ACCESSOIRES`), en **référençant les vrais paramètres**
(source unique, P21 — vérifié : `PLO-RESEAU-EF-ECS.parametres.mlEFparPoint ===
PLOMBERIE_PARAMS.mlEFparPoint`). Aucun prix, aucun code catalogue dans les fiches (les diamètres
Ø40/Ø100 sont des caractéristiques physiques, pas des références).

## Observateur mis en place

`js/observateur-plomberie.js` — observateur **passif** : il lit les résultats déjà produits par
`calculerDevis` (`window.__besoinsPlomberie` = les faits, `window.__plomberieAuto` = la décision),
consulte le savoir via le Port (lecture seule), et consigne le raisonnement. Il ne recalcule rien.

## Journalisation

Événements consignés, dans l'ordre : `debut_raisonnement` → `fait` (comptage d'appareils) →
`connaissance_candidate` (NF DTU 60.11 + identifiants des règles plomberie, via le Port) →
`decision` (points EF/ECS, évacuations Ø40/Ø100, accessoires, nombre de composants) →
`fin_raisonnement`. **P3 respecté** : aucun prix dans le Journal (vérifié).

---

## Fichiers modifiés

**Aucun fichier existant modifié.** Fichiers **créés** : `js/plomberie-savoir.js`,
`js/observateur-plomberie.js`, `tests/golden-master/plomberie-migration-check.js`, ce document.
**NON touché** : `prix.js` (`dimensionnementPlomberie` + `PLOMBERIE_PARAMS`), source unique. Modules
chargés par aucune page.

---

## Validation Golden Master

```
node plomberie-migration-check.js  → ✅ 10 assertions OK
     Plomberie chiffrée : 1746 € HT (inchangé) | 3 règles au Port | Journal : 5 événements, 0 prix
node isolation-migration-check.js → ✅   node vmc-migration-check.js → ✅   node coherence-migration-check.js → ✅
node port-check.js → ✅ 15/15   node journal-check.js → ✅ 15/15
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

`dimensionnementPlomberie` renvoie **le même résultat, prix inclus** (1746 € HT), avant et après
l'observation ; le Journal est **sans prix** ; le devis complet est **identique** à la référence.
Mêmes prestations, quantités, prix, recommandations, alertes, contrôles, devis.

---

## Compatibilité avec la Constitution

**P1/P2** (règles Plomberie = savoir accessible par le Port, sans quitter leur source), **P3**
(aucun prix ni dans les fiches, ni dans le Journal), **P4/P11** (raisonnement tracé), **P6** (savoir
via le Port), **P7** (observateur = témoin), **P21** (fiches référençant les vrais paramètres). Le
moteur reste la source unique des décisions et des montants.

## Compatibilité avec le Plan Directeur

Quatrième « connexion d'un moteur », moteur feuille de chiffrage, en miroir passif, validé « Golden
Master identique ». Coutures Port/Journal/observateur réutilisées telles quelles.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (10 assertions + Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements de cette migration

- **Le pattern est désormais industrialisé** : quatre moteurs migrés (contrôle, chiffrage, métré,
  chiffrage à réseaux), toujours la même structure (fiches + observateur + moteur intact).
- **Toute connaissance n'est pas encore mûre pour le Port** : `PLOMBERIE_INCLUSIONS` (anti-doublon)
  est du savoir métier, mais son couplage aux codes catalogue justifie de l'y intégrer plus tard,
  quand on saura exprimer les « inclus/exclus » en vocabulaire d'ontologie plutôt qu'en codes. On
  migre **ce qui est prêt**, pas plus (prudence).
- **La frontière prix reste nette** : même sur un moteur à plusieurs postes chiffrés, le montant
  reste dans le moteur, jamais dans le savoir ni le Journal.

---

## Préparation de la Migration 014

Les moteurs **feuilles** sont désormais couverts. La MIGRATION 014 abordera le **Chauffage**
(`dimensionnementChauffage`), premier moteur **couplé** : son nombre de circuits est réinjecté dans
le tableau électrique. Le pattern reste le même, mais l'observation devra tenir compte de ce
couplage (observer le chauffage sans perturber l'enchaînement chauffage → tableau). Le **Tableau
électrique** (hub) restera pour la fin, conformément à la feuille de route M009.

---

## Conclusion

Le moteur Plomberie est le **quatrième métier** entré dans l'architecture DSBAT : ses connaissances
sont accessibles par le Port, son raisonnement est tracé par le Journal **sans le moindre prix**, et
il produit **exactement le même montant qu'avant** (1746 € HT). Le pattern tient sur un moteur de
chiffrage à réseaux multiples, au risque le plus faible, parfaitement validé et entièrement
réversible. Le Golden Master reste intégralement valide.

*— MIGRATION 013 : Plomberie. Quatrième moteur métier dans l'architecture V2.*
