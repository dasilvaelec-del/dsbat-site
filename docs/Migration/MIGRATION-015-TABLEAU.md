# Moteur DSBAT — MIGRATION 015 : Migration du moteur Tableau électrique

> Le pattern éprouvé (MIGRATIONS 010–014) est appliqué au **Tableau électrique**, le premier **hub**
> du configurateur : ses **règles de dimensionnement NF C 15-100 séparables** deviennent des fiches
> accessibles par le **Port**, son **raisonnement** (dépendances entrantes comprises) est **journalisé
> passivement** — sans toucher au moteur, et **le montant comme les dépendances restent identiques**.
> *Aucun calcul, règle, prix, prestation, devis, recommandation, alerte ni interface modifié. Golden
> Master intégralement valide.*

---

## Analyse du moteur Tableau

`prix.js` → `dimensionnementTableau(b)` : à partir des besoins électriques agrégés (prises, points
lumineux, circuits spécialisés, cuisson, chauffe-eau, VMC, volets, **circuits chauffage**…), il
détermine les circuits, sélectionne les interrupteurs différentiels (type A / AC selon les usages),
dimensionne le coffret (rangées) avec réserve, et retourne une composition **chiffrée**
(`prixTotalHT`). C'est le moteur **le plus central** : il **agrège les besoins de plusieurs métiers**.

## Dépendances identifiées

Le Tableau **reçoit** (via `calculerDevis`, qui assemble `b` avant de l'appeler) :

- **`circuitsChauffage`** ← moteur **Chauffage** (`chauffage.nbCircuits` réinjecté) ;
- **`vmc`** ← présence du moteur **VMC** (circuit VMC) ;
- **`chauffeEau`** ← **Plomberie** (ballon → circuit + contacteur) ;
- **`circuitsVolets`**, `sonnerie`, etc. ← postes configurés.

Ces dépendances sont **strictement conservées** : l'observation intervient **après** le calcul
complet et n'y touche pas. Elles sont désormais **mises en évidence** dans le Journal (lecture seule).

## Connaissances identifiées

Séparables et relevant du Référentiel (règles NF C 15-100 de dimensionnement, dans `TABLEAU_PARAMS`) :

- `maxPrisesParCircuit` (prises max par circuit) ;
- `maxPointsLumineuxParCircuit` (points lumineux max par circuit) ;
- `maxCircuitsParDiff` (circuits max par interrupteur différentiel 30 mA) ;
- `reserve` (réserve de modules obligatoire).
- **Norme** : `NF C 15-100` — déjà exposée par le Port depuis `normes.js`.

## Connaissances volontairement conservées dans le moteur

- **`MODULES_TABLEAU`** (prix de chaque module) → **catalogue** (P3).
- **`modulesParRangee`** (13) → contrainte **physique/catalogue** du coffret.
- **`moForfaitBase`, `moParModule`** → **main-d'œuvre** (chiffrage).
- **Tout l'algorithme** (calcul des circuits, choix type A/AC, dimensionnement du coffret,
  comptage des modules) → **calcul / orchestration**.

Sur un hub, on reste **volontairement conservateur** : on n'externalise que les règles clairement
normatives, et on laisse dans le moteur tout ce qui est encore couplé au calcul ou au catalogue.

## Intégration au Port

`js/tableau-savoir.js` présente les 4 règles séparables comme **fiches `REGLE_METIER`**
(`TAB-CIRCUIT-PRISES`, `TAB-CIRCUIT-LUMIERE`, `TAB-DIFFERENTIEL`, `TAB-RESERVE`), en **référençant les
vrais paramètres** (source unique, P21 — vérifié : `TAB-CIRCUIT-PRISES.parametres.maxPrisesParCircuit
=== TABLEAU_PARAMS.maxPrisesParCircuit`). Aucun prix, **aucun code catalogue** (`disj_…`,
`coffret_…` exclus — vérifié par test).

## Observateur

L'observateur du tableau existait déjà (MIGRATION 008). Il est **enrichi de façon additive** :

- il **met en évidence les dépendances entrantes** (`circuitsChauffage`, `vmc`, `chauffeEau`,
  `circuitsVolets`) dans l'événement `fait` — sans les modifier ;
- il **cite désormais les règles** de dimensionnement (via le Port) en plus de la norme NF C 15-100.

L'enrichissement est **rétro-compatible** : le test de la MIGRATION 008 reste vert (5/5). L'observation
a toujours lieu **après le calcul complet**, garantissant que le couplage n'est pas perturbé.

## Journalisation

Événements, dans l'ordre : `debut_raisonnement` → `fait` (besoins + **dépendances mises en évidence**)
→ `connaissance_candidate` (NF C 15-100 + 4 règles de dimensionnement, via le Port) → `decision`
(circuits, différentiels, rangées, parafoudre) → `fin_raisonnement`. **P3 respecté** : aucun prix.

---

## Validation Golden Master

```
node tableau-migration-check.js  → ✅ 14 assertions OK
     Tableau chiffré : 1002 € HT (inchangé) | 9 circuits | 4 règles au Port | Journal : 5 évts, 0 prix
node observateur-check.js (M008) → ✅ 5/5 (enrichissement rétro-compatible)
node chauffage / plomberie / vmc / coherence → ✅   node journal-check.js → ✅ 15/15
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

Preuves : `dimensionnementTableau` renvoie **le même résultat, prix inclus** (1002 € HT) ; les
**besoins entrants** (dépendances des autres moteurs) sont **identiques** avant/après ; le Journal est
**sans prix** ; le devis complet est **identique** à la référence. Mêmes prestations, quantités, prix,
recommandations, alertes, contrôles, devis.

*Fichiers créés : `js/tableau-savoir.js`, `tests/golden-master/tableau-migration-check.js`, ce
document. Fichier V2 enrichi (additif, testé) : `js/observateur-tableau.js`. `prix.js`
(`dimensionnementTableau`, `TABLEAU_PARAMS`, `MODULES_TABLEAU`) **non touché**.*

---

## Compatibilité avec la Constitution

**P1/P2** (règles NF C 15-100 = savoir accessible par le Port), **P3** (aucun prix dans les fiches ni
le Journal ; `MODULES_TABLEAU` reste au catalogue), **P4/P11** (raisonnement + dépendances tracés),
**P6** (savoir via le Port), **P7** (observateur = témoin), **P21** (fiches référençant les vrais
paramètres). Le moteur reste la source unique des décisions, protections, circuits et montants.

## Compatibilité avec le Plan Directeur

Sixième « connexion d'un moteur », le **hub**, migré **en dernier parmi les moteurs de calcul** comme
prévu (M009), en miroir passif, validé « Golden Master identique ». Les dépendances entrantes sont
**respectées et rendues visibles**, jamais modifiées.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (14 assertions + Golden Master + M008 rétro-
compatible), **documentée**. Aucune logique de calcul déplacée. Périmètre restreint et prudent sur un
moteur central.

---

## Enseignements

- **Le pattern tient jusqu'au hub** : même le moteur le plus central se migre sans toucher au calcul,
  en n'externalisant que les règles clairement normatives et en observant après coup.
- **Les dépendances deviennent explicites sans être touchées** : journaliser `circuitsChauffage`,
  `vmc`, `chauffeEau` rend visible la façon dont le tableau agrège les autres métiers — précieux pour
  l'audit et les futures explications, à comportement strictement inchangé.
- **Réutiliser un observateur existant** (celui de M008) plutôt que d'en créer un nouveau évite la
  duplication ; l'enrichissement additif, validé par le test M008, est la bonne pratique.

## Préparation de la suite

Les **six sous-moteurs** de `calculerDevis` (Cohérence, VMC, Isolation, Plomberie, Chauffage,
Tableau) sont désormais couverts par le pattern. Restent, hors `calculerDevis` : les métiers
**couplés au DOM** (peinture, sols, carrelage — calculés dans `recalcPiece`), qui nécessiteront
d'abord l'**extraction de `recalcPiece`** hors du HTML (migration préparatoire), et la
**micro-migration `tauxTVA`** (sortir la règle du HTML). Ce sera l'objet des prochaines missions.

## Conclusion

Le Tableau électrique — le **hub** — est le sixième moteur entré dans l'architecture DSBAT : ses
règles NF C 15-100 séparables sont accessibles par le Port, son raisonnement et **ses dépendances
entrantes** sont tracés par le Journal **sans le moindre prix**, et il produit **exactement le même
montant et les mêmes circuits qu'avant** (1002 € HT, 9 circuits). Le pattern tient sur le moteur le
plus central, au risque le plus faible, parfaitement validé et entièrement réversible. Le Golden
Master reste intégralement valide.

*— MIGRATION 015 : Tableau électrique. Le hub entre dans l'architecture V2.*
