# Runtime DSBAT – R08

> **Phase Runtime · Mission R08 — Protection du patrimoine métier DSBAT (1re étape réelle).**
> R08 **commence la séparation définitive** entre l'**interface publique** et le **patrimoine métier**.
> Priorité absolue : **supprimer l'exposition du catalogue de prix** au navigateur. On introduit une
> **vue tarifaire Runtime** — le navigateur ne reçoit plus le catalogue complet (`prix.js`), seulement
> les **prix d'affichage** déjà résolus. Les **calculs restent au Runtime**. Migration **additive, sous
> flag, totalement réversible** ; **aucune règle, aucun calcul, aucune interface** modifiés. Le Golden
> Master reste la référence absolue.

---

## Objectifs

L'inventaire R07 a désigné la principale exposition résiduelle : les **lectures directes du catalogue**
pour l'affichage (`getMoyenPrixFor`, `getPrixPrestFor`, `tempsUnitaire`, `findPrestLabel`), câblées en
**32 points** dans le configurateur. Tant que l'écran lit ces prix, le navigateur charge `prix.js`
(**1 186 lignes**) — donc **tout le savoir-faire tarifaire** : marges (`COEF_FOURNITURE = 1,45`), table
d'appareillage, décomposition **pose + appareillage** / **pose + fourniture**, formules `prixElec` /
`prixPlomberie`, dimensionnements, coefficients de zone.

R08 pose la première pierre de la protection : faire du **Runtime l'unique détenteur des connaissances
tarifaires**, et du **navigateur une simple fenêtre d'affichage**. Concrètement : (1) concevoir une
**vue tarifaire** ne contenant **que** les montants nécessaires à l'écran ; (2) la faire **servir par le
Runtime** ; (3) permettre au navigateur d'**afficher sans catalogue**, sous flag et avec repli ;
(4) **prouver** que l'affichage reste identique et que la vue ne révèle **aucun** secret ; (5) préparer
le **débranchement** de `prix.js` (R09).

## Vue tarifaire Runtime

Nouveau module **pur** `js/vue-tarifaire.js`, utilisable côté serveur **et** navigateur :

- `construireVueTarifaire({ PRIX, prixElec, prixPlomberie })` **aplati** le catalogue en une structure
  minimale `{ prestations: { CODE → entrée } }`. Chaque entrée ne porte que ce que l'écran affiche —
  `label`, `unite`, `temps`, et le **prix d'affichage déjà résolu** `{ min, max }` — sous **une seule**
  forme, selon la **priorité exacte** de `getPrixPrestFor` :
  - `flat` : prix unique (rénov / prix tout compris) ;
  - `elec` : variantes **pose × gamme** pré-calculées (les 4 méthodes × 4 gammes que propose l'interface),
    obtenues en **rejouant** `prixElec` — la **formule et la marge ne sont jamais exposées** ;
  - `plomberie` : variantes **gamme sanitaire** (entrée / standard / premium), via `prixPlomberie`.
- `creerAccesseursVue(vue)` **rejoue**, à partir de la **seule vue**, les **4 accesseurs** de
  `js/pricing.js` avec des **signatures et valeurs identiques**, **sans aucun accès au catalogue**.

La vue résout **à l'avance** toutes les combinaisons `(code, pièce)` que l'interface peut demander : le
navigateur n'a plus qu'à **lire** un montant, jamais à le **construire**. Les **calculs de devis** et de
**pièce** restent, eux, servis par le Runtime (R05 / R06) : R08 ne déplace **que** l'affichage des prix.

Servie en lecture seule par le Runtime : **`GET /v1/tarifs/vue`** (ajout additif à l'API A10, aucune
logique métier). Le contrôleur navigateur `js/tarifs-mode.js` (feature flag `?tarifs=vue`, **défaut
`catalogue`**) charge la vue et **remplace** les 4 accesseurs globaux par des lectures de la vue, avec
**repli automatique** sur le catalogue à la moindre erreur et **retour arrière instantané**.

## Catalogue de prix

Le **catalogue complet** (`prix.js`) devient un **actif serveur**. En R08 il **reste présent** dans le
dépôt public (le mode par défaut et le repli en dépendent encore), mais il n'est **plus indispensable à
l'affichage** : la preuve montre que la vue seule suffit. Ce que la vue **ne contient pas** — et que le
client cessera donc de recevoir dès que `prix.js` sera débranché (R09) :

- la **marge** `COEF_FOURNITURE` (1,45) et la **table d'appareillage** (`APPAREILLAGE`) ;
- la **décomposition** interne des prix (`pose` + `appareillage`, `pose` + `fourniture`) ;
- les **formules** `prixElec` / `prixPlomberie` / `appCost` ;
- les **dimensionnements** (tableau, VMC, chauffage, plomberie, isolation) et **coefficients de zone**.

La vue ne porte que des **montants d'affichage** et un **libellé**. Mesure : **51 952 octets** de données
(vue) contre **91 192 octets** de code (`prix.js`) — **≈ 43 % de volume en moins**, et surtout une
**opacité structurelle** : aucune formule, aucune marge, aucune mécanique — seulement des résultats.

## Modules retirés du navigateur

R08 ne **retire** encore rien (étapes additives, repli actif) mais **rend retirables** — le débranchement
effectif est R09, sous critères stricts :

- **`prix.js`** (catalogue + marges + formules + dimensionnements) → **actif serveur** ;
- **`js/pricing.js`** (accesseurs sur catalogue) → remplacé par `creerAccesseursVue` alimenté par la vue.

Condition de retrait : le mode `tarifs=vue` déployé et stable, plus **aucune** lecture d'affichage
dépendant du catalogue. Le retrait consistera à **cesser de charger** `prix.js` / `js/pricing.js` côté
client, puis (séparation définitive) à les **sortir** du dépôt public vers le Runtime.

## Modules restant dans l'interface

Le navigateur conserve **strictement son rôle d'affichage** :

- `js/vue-tarifaire.js` (accesseurs de **lecture** de la vue — aucune règle, aucun prix construit) ;
- `js/tarifs-mode.js` (aiguillage de **source**, réversible) ;
- le **rendu** (formatage `formatEuro`, construction du HTML, panneaux, badges, phases) ;
- la **validation de formulaire**, la **lecture DOM → modèle**, les **interactions**, la **mise en page
  du PDF**, et l'**orchestration** des appels au Runtime (client d'accès).

L'interface **décrit ce que l'utilisateur veut** et **affiche ce que le Moteur répond** ; elle ne décide
plus **combien ça coûte**.

## Impact GitHub

- **Ajouts** (additifs, inertes par défaut) : `js/vue-tarifaire.js`, `js/tarifs-mode.js`, la route
  `GET /v1/tarifs/vue` (api-dsbat.js + composer/environnement), l'artefact `runtime/rapports/vue-tarifaire.json`,
  et deux filets (`tests/golden-master/vue-tarifaire-check.js`, `runtime/tests/tarifs-bascule-check.js`).
  Deux `<script>` **inertes** et un bootstrap `?tarifs=vue` **sans effet par défaut** dans le configurateur.
- **Rien n'est supprimé** en R08 : le dépôt public reste fonctionnel à l'identique. Le repli exige la
  présence de `prix.js`.
- **R09** : une fois `tarifs=vue` à 100 % et la fenêtre d'observation passée, **cesser de charger**
  `prix.js` / `js/pricing.js` (retrait des `<script src>`), puis les **déplacer** vers le dépôt privé
  (Runtime). Le dépôt public ne gardera que l'**interface** + le **client d'accès** + la **vue**.

## Impact sécurité

- **Le point sensible est traité en premier.** La vue tarifaire est le **mécanisme** qui permettra au
  client de ne **plus jamais** recevoir le catalogue : il obtiendra des **montants d'affichage** résolus,
  pas la **façon** de les produire (marge, décomposition, formules). La **preuve « zéro secret »** vérifie
  qu'aucun marqueur de savoir-faire (`COEF_FOURNITURE`, `1.45`, `APPAREILLAGE`, `prixElec`,
  `prixPlomberie`, `dimensionnement`, `coefZone`, `function`) n'apparaît dans la vue, et que ses **clés
  structurelles** forment un **ensemble fermé** (aucune clé `pose` / `four` / `app` / `renov`).
- **Surface d'attaque** : en mode vue, la logique tarifaire quitte le client ; le Runtime en garde
  l'**exclusivité**, derrière l'API (crochet d'authentification A10) et une journalisation **sans prix**.
- **Réversibilité** : tant que le repli catalogue existe, tout est réversible ; la protection ne devient
  **définitive** qu'à R09 (débranchement puis retrait public), sous critères stricts.

## Validation Golden Master

R08 **ne modifie aucun code moteur** : la vue **rejoue** le catalogue via ses propres fonctions. Preuves
exécutées, toutes vertes :

```
Moteur (référence, INCHANGÉ)
  Golden Master devis / PIÈCE / reco-oublis        → ✅ IDENTIQUES (verify)
  A08 / A09 / A10 (Modèle / Orchestrateur / API)   → ✅ 18 / 17 / 18 OK
Runtime (R02–R06)
  parité R02 · smoke HTTP · Shadow R03 · sélecteur R04 · bascule devis R05 · bascule pièce R06 → ✅ verts

R08 — Golden Master VUE TARIFAIRE (vue-tarifaire-check.js) → ✅ 9/9
  • PARITÉ TOTALE vue ↔ catalogue : 304 codes × 6 080 variantes → 0 écart
  • SUFFISANCE sans catalogue : affichage reproductible depuis la seule vue transportée
  • ZÉRO SECRET : aucun marqueur de savoir-faire ; clés structurelles fermées
  • ENDPOINT : GET /v1/tarifs/vue → 200 ; POST → 405 (lecture seule)
R08 — BASCULE TARIFAIRE (tarifs-bascule-check.js) → ✅ 9/9
  • inerte par défaut · activation « vue » (affichage identique) · retour arrière exact · repli auto
```

**Démonstration exigée par la mission :**
- *le navigateur n'a plus besoin du catalogue* : les accesseurs de vue reproduisent **6 080** valeurs
  d'affichage **sans** `PRIX` / `prixElec` / `prixPlomberie` chargés ;
- *l'affichage reste identique* : **0 écart** sur tous les codes et toutes les variantes pièce ;
- *tous les Golden Master restent verts* : moteur inchangé (verify identique), A08–A10 et R02–R06 OK ;
- *le Runtime devient l'unique source tarifaire* : la vue est **construite et servie** par le Runtime
  (`/v1/tarifs/vue`), et le client s'y branche sous flag, repli garanti.

## Préparation de R09

R08 fournit le **mécanisme** et la **preuve** ; R09 réalise le **débranchement**. Séquence : déployer
`tarifs=vue` en canari (1 % → 100 %) avec parité d'affichage surveillée ; une fois stable et la fenêtre
d'observation passée, **cesser de charger** `prix.js` et `js/pricing.js` dans le configurateur (l'écran
lit alors **exclusivement** la vue Runtime, le repli catalogue disparaissant) ; puis **déplacer** ces
fichiers vers le **dépôt privé** (Runtime). Le dépôt public ne conservera que l'**interface**, le
**client d'accès** et la **vue** ; le Golden Master tarifaire suivra le catalogue dans le dépôt privé,
un **test de parité API** restant côté public. La **séparation Interface / Moteur** deviendra alors
**définitive pour les prix** — le même schéma servira ensuite aux règles (cohérence, reco/oublis).

## Conclusion

La première véritable étape de protection est posée. Le navigateur peut désormais **afficher tous les
prix sans recevoir le catalogue** : il lit une **vue tarifaire** — des montants déjà résolus — pendant
que le **Runtime** garde l'**exclusivité** du savoir-faire (marges, formules, décompositions,
dimensionnements). La preuve est double et sévère : **parité totale** (304 codes, 6 080 variantes, 0
écart) et **zéro secret** dans la vue. Tout est **additif, sous flag et instantanément réversible** ;
**aucune règle, aucun calcul, aucune interface** n'a changé, et **tous les Golden Master sont verts**.
Le Runtime devient l'**unique source des données tarifaires** ; R09 n'aura plus qu'à **débrancher** le
catalogue du navigateur, puis à le **sortir** du dépôt public — rendant la protection **définitive**.

*— MISSION R08 : le navigateur affiche les prix sans jamais les connaître ; le patrimoine tarifaire DSBAT vit désormais côté Runtime.*
