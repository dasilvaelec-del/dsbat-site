# Moteur DSBAT V2 — Chapitre 2 : Moteur de décision

> Document de **conception uniquement**. Aucun code, aucune fonctionnalité, aucun
> moteur/calcul/prix/interface modifié. On définit **comment les connaissances du
> Référentiel (Chapitre 1) sont exploitées pour produire des décisions**.

Le moteur de décision est le **cerveau** du moteur d'expertise : il transforme des
**connaissances** (fiches) et des **faits** (le projet) en **décisions traçables**. Il ne
calcule **jamais** un prix, **jamais** une quantité, et ne génère **jamais** un devis.

---

## Architecture générale

Le moteur de décision s'intercale entre deux couches déjà définies :

```
  RÉFÉRENTIEL (savoir)          PROJET (faits normalisés)
   normes · règles métier   +    pièces · équipements · choix
   recommandations · options          (le « Dossier »)
              │                          │
              └───────────┬──────────────┘
                          ▼
              ┌───────────────────────────┐
              │   MOTEUR DE DÉCISION       │   ← ce chapitre
              │  décide QUOI et POURQUOI   │
              └───────────┬───────────────┘
                          ▼
              PLAN DE DÉCISIONS (sans prix, sans quantité)
       besoins · recommandations · contrôles · interactions · TRACES
                          │
                          ▼
   MOTEURS MÉTIER → calculent COMBIEN (quantités, dimensionnements)
   CATALOGUE/CHIFFRAGE → appliquent les PRIX
```

Propriétés fondamentales :

- **Déterministe** : mêmes faits + même version du référentiel ⟹ mêmes décisions.
- **Sans état, sans effet de bord, sans interface** : une fonction de raisonnement pure.
- **Borné** : il *décide*, il ne *calcule* pas librement. Il ne produit ni montant, ni
  quantité, ni devis — uniquement des décisions et leur justification.
- **Explicable par construction** : chaque décision porte ses déclencheurs et ses fondements.

Ce qu'il **produit** — le *Plan de décisions* :
1. les **besoins** déclenchés (abstraits, ex. « étanchéité sous carrelage »),
2. les **recommandations** à proposer (jamais imposées),
3. les **contrôles** à réaliser (ce qu'il faudra vérifier),
4. les **interactions** entre métiers concernées,
5. les **traces** (le « pourquoi » de chaque point).

Ce qu'il ne produit **jamais** : prix, quantités, dimensionnements, devis.

---

## Cycle de décision

Le cycle transforme le projet en décisions, en plusieurs passes ordonnées.

1. **Établir les faits.** Le projet est traduit en **faits normalisés** :
   « SDB-1 contient une douche à l'italienne », « logement > 30 ans », « cuisine présente ».
   Le moteur ne raisonne que sur des faits, jamais sur un formulaire.
2. **Sélectionner les fiches candidates.** Par métier, type de pièce et tags, on ne retient
   que les fiches potentiellement concernées (indexation — on n'évalue pas tout le référentiel).
3. **Évaluer les conditions d'application.** Pour chaque fiche candidate, sa
   `conditionApplication` est confrontée aux faits. Si elle est satisfaite, la fiche est
   **activée** → elle devient une **décision**.
4. **Propager (chaînage avant).** Une décision peut **produire de nouveaux faits** (ex.
   RM-024 déclenche le besoin « étanchéité »), qui peuvent activer d'autres fiches. On répète
   jusqu'à **stabilisation** (plus aucun fait nouveau — le « point fixe »).
5. **Résoudre les conflits** (voir section dédiée) selon un ordre de priorité explicite.
6. **Classer les sorties** : besoins (obligations), recommandations, options, contrôles.
7. **Émettre le Plan de décisions + les traces.**

**Exemple déroulé — douche italienne :**

```
Fait        : SDB-1 contient une douche à l'italienne
  ↓ règle lue
RM-024 (« douche italienne ⟹ étanchéité + caniveau/pente + évacuation + hauteur faïence »)
  ↓ besoins déclenchés
[ étanchéité_sous_carrelage, caniveau_ou_pente, évacuation_adaptée, hauteur_faïence_min ]
  ↓ recommandations proposées (non imposées)
REC-018 (« caniveau linéaire plutôt que pente centrale »), REC-021 (« natte d'étanchéité renforcée »)
  ↓ contrôles déclenchés
CTRL (« vérifier la pente vers l'évacuation »), CTRL (« vérifier hauteur de faïence »)
  ↓ interaction métier activée
PLOMBERIE ↔ CARRELAGE (ordre : étanchéité posée AVANT la faïence)
  ↓ moteurs informés (via les besoins, pas par appel direct)
plomberie (évacuation), carrelage (étanchéité + faïence)
```

Le moteur **n'appelle pas** les moteurs métier : il **émet** un plan que l'orchestrateur
transmet. La décision et le calcul restent séparés.

---

## Ordre d'évaluation des règles

L'ordre n'est **jamais** celui de saisie des fiches. On distingue deux ordres :

**1. Ordre de propagation** (logique) — imposé par les **dépendances entre faits** : un
besoin doit exister avant que la fiche qui en dépend puisse s'activer. Cet ordre est **déduit
du graphe** de dépendances (chaînage avant), pas écrit à la main.

**2. Ordre de priorité** (résolution/affichage) — appliqué par **phases** :

| Phase | Contenu | Raison |
|-------|---------|--------|
| 1 | Établissement des faits | Rien ne se décide sans faits |
| 2 | **Normes** (imposées par un texte) | Force la plus haute |
| 3 | **Règles métier** (imposées techniquement) | Expertise obligatoire |
| 4 | **Recommandations** | Proposées, jamais imposées |
| 5 | **Options** | Confort, jamais imposées |
| 6 | **Contrôles** | Observent le résultat → en dernier |

À priorité égale, on départage de façon **déterministe** : spécificité (fiche la plus ciblée
d'abord), puis récence (`dateEntreeVigueur`), puis **identifiant** (ordre stable) — pour
garantir la reproductibilité.

---

## Gestion des dépendances

Les enchaînements « une règle en déclenche une autre » sont modélisés comme un **graphe
orienté** : *fait → règle → besoin → règle → …*.

Pour permettre ces dépendances **sans jamais créer de boucle** :

- **Raisonnement monotone.** Le moteur ne fait qu'**ajouter** des faits ; il n'en retire
  jamais. L'ensemble des faits est croissant et borné (le référentiel est fini) ⟹ la
  propagation **se termine toujours** (atteinte d'un point fixe).
- **Idempotence.** Un fait déjà connu n'est jamais rejoué ; une décision déjà prise n'est
  pas reprise. Réévaluer ne change rien après stabilisation.
- **Graphe acyclique attendu (DAG).** Les dépendances *entre fiches* doivent former un DAG.
  Un **cycle** (A dépend de B qui dépend de A) est traité comme une **anomalie de
  gouvernance** : détecté, stoppé proprement, et **signalé** (le savoir est à corriger) — pas
  masqué.
- **Garde-fous** : limite de passes et détection de cycle, en filet de sécurité, même si le
  raisonnement monotone garantit déjà la terminaison.

Ainsi les dépendances sont riches mais **toujours sûres** : pas d'emballement, pas de boucle
infinie, résultat stable.

---

## Gestion des conflits

Quand plusieurs fiches se contredisent (l'une recommande, l'autre interdit, une norme
impose), la résolution suit une **hiérarchie explicite** :

**Force par famille** : `Norme (impose)` > `Règle métier (impose techniquement)` >
`Recommandation (propose)` > `Option (propose)`.

Cas types :
- **Obligation vs recommandation** → l'obligation gagne ; la recommandation devient caduque
  ou reste purement informative.
- **Interdiction vs recommandation/option** → l'interdiction gagne.
- **Deux obligations contradictoires** → **conflit dur** : pas de résolution silencieuse. On
  applique la règle de départage (spécificité > récence > identifiant) **et** on émet une
  **alerte de gouvernance** (le référentiel est incohérent, à corriger par un expert).

Principes de départage, dans l'ordre :
1. **Force de la famille** (voir ci-dessus) ;
2. **Spécificité** (une règle ciblée « douche italienne » prime une règle générale « pièce
   humide ») ;
3. **Récence** (`dateEntreeVigueur` la plus récente) ;
4. **Identifiant** (départage ultime, déterministe).

Règle d'or : **aucun conflit n'est résolu en cachette.** Tout conflit résolu est **tracé** ;
tout conflit non résoluble est **signalé**.

---

## Traçabilité des décisions

Chaque décision est **auto-justifiée**. Elle conserve :

- la **décision** (« proposer une prestation d'étanchéité »),
- ses **déclencheurs** (faits du projet : « douche italienne détectée en SDB-1 »),
- ses **fondements** (identifiants des fiches : `RM-024`, `DTU-52.2`),
- la **famille** et la **priorité** appliquée,
- les **conflits éventuels** résolus (avec la règle de départage utilisée),
- la **version** des fiches utilisées et l'**horodatage** (lien avec le versionnement Ch1).

Exemple de justification restituable :

> « Prestation d'étanchéité proposée **car** : RM-024 (expertise DSBAT) **+** DTU-52.2 (norme)
> **+** douche italienne détectée en SDB-1. »

L'ensemble des décisions forme un **arbre de dérivation** reconstituable : on peut toujours
remonter du résultat jusqu'aux faits et aux fiches d'origine. C'est la condition d'un audit
fiable et de la confiance de l'IA et du franchisé.

---

## Relations avec les moteurs métier

Répartition stricte des responsabilités :

- **Moteur de décision** : décide *quoi* et *pourquoi* → émet **besoins, recommandations,
  contrôles, interactions**. Aucune quantité, aucun prix.
- **Moteurs métier** : lisent ces besoins et calculent *combien* (quantités,
  dimensionnements, prestations).
- **Catalogue / chiffrage** : traduisent les prestations en **références et prix**.

Circulation **à sens unique** : décision → moteurs → chiffrage. Les moteurs métier ne
portent plus les règles ; ils **consomment** des décisions. Le moteur de décision ne les
appelle pas directement — c'est l'**orchestrateur** (charte V2) qui relie les couches.

---

## Compatibilité avec l'architecture actuelle

Tout est **additif**, rien ne casse :

- **`js/moteur-recommandations.js` est déjà un mini-moteur de décision** : ses règles
  `condition (ctx) → message`, classées 🟢/🟡/🔵 et isolées par `try/catch`, préfigurent
  exactement le mécanisme (sélection → évaluation → classement → sortie explicable). Il
  devient le **prototype** de la brique « recommandations » du moteur de décision.
- **`calculerDevis` (js/moteur-devis.js) construit déjà des « faits dérivés »** : les besoins
  qu'il assemble (compteurs de prises, besoins plomberie/VMC/tableau) sont, conceptuellement,
  la sortie d'un raisonnement — mais aujourd'hui **codé en dur dans le moteur**. En cible, ces
  implications viendront du **référentiel** via le moteur de décision, et `calculerDevis` ne
  fera plus que **calculer**.
- **Migration progressive** : on peut construire le moteur de décision **à côté**, le nourrir
  du référentiel et le comparer aux sorties actuelles, **sans toucher** aux moteurs existants,
  jusqu'à ce qu'il soit éprouvé.

---

## Préparation de l'IA

Le moteur de décision est le **garde-fou** qui empêche l'IA d'inventer :

- **Frontière stricte** : le raisonnement (déterministe) appartient au moteur ; le langage
  (formulation, résumé, dialogue) appartient à l'IA. L'IA **consomme** le Plan de décisions
  et les fiches citées — elle ne fabrique pas de décision.
- **Grounding** : les décisions structurées + les identifiants + les justifications
  constituent le contexte factuel sur lequel l'IA s'appuie, sans extrapoler.
- **Boucle de proposition encadrée** : l'IA peut **suggérer** de nouvelles fiches, qui
  entrent en état **brouillon** (Ch1) et passent par la revue humaine avant de pouvoir décider.

En résumé : l'IA explique et propose ; **le moteur décide**.

---

## Préparation des niveaux de confiance

Le moteur de décision **n'agrège pas** de score, mais **émet les signaux bruts** qui
permettront de le calculer plus tard :

- **Complétude** : la liste des **faits manquants** (conditions non évaluables faute de
  donnée) — « inconnues » qui empêchent d'activer certaines fiches.
- **Cohérence** : le **nombre et la gravité des conflits** rencontrés, et les contradictions
  signalées.
- **Fiabilité** : la part de décisions fondées sur des fiches **actives/validées** vs
  **brouillon/documentaire**, et l'**ancienneté** des normes mobilisées.

Ces métadonnées voyagent **avec** le Plan de décisions. La future couche « confiance » les
consommera pour produire l'indice — sans qu'on la développe maintenant.

---

## Avantages

- **Robustesse** : raisonnement monotone ⟹ terminaison garantie, pas de boucle.
- **Explicabilité native** : chaque décision porte ses fondements et ses déclencheurs.
- **Évolutivité** : ajouter une fiche au référentiel change le comportement **sans toucher au
  moteur**.
- **Indépendance à l'interface** : le moteur ne connaît que des faits et des fiches.
- **Séparation nette décision / calcul** : les moteurs métier restent simples et purs.
- **Prêt pour l'IA et la confiance** : sorties structurées, tracées, mesurables.
- **Migration douce** : capitalise sur `moteur-recommandations.js`, sans big-bang.

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **Complexité d'un moteur d'inférence** | Difficile à maintenir | Commencer **sans chaînage** (une passe), ajouter la propagation ensuite |
| **Boucles de règles** | Blocage / calcul infini | Raisonnement monotone + DAG + détection de cycle |
| **Qualité tributaire du référentiel** | Décisions fausses si fiches fausses | Gouvernance Ch1 (revue, datation, états) |
| **Explosion combinatoire** | Lenteur | Indexation des candidates (métier/pièce/tags), pas d'évaluation globale |
| **Conflits de priorité mal définis** | Décisions imprévisibles | Hiérarchie explicite + départage déterministe + traçage |
| **Sur-conception** | Retard | Lot pilote d'abord, périmètre volontairement réduit |

---

## Recommandations

1. **Démarrer minimal** : un moteur **à une passe** (sélection → évaluation → classement),
   sur le **lot pilote** de fiches du Chapitre 1 (douche italienne, WC suspendu, cuisine,
   parquet flottant, élec SDB). Ajouter la **propagation** seulement ensuite.
2. **Imposer le raisonnement monotone** dès le départ (on n'ajoute que des faits) — c'est ce
   qui garantit robustesse et terminaison.
3. **Écrire noir sur blanc la hiérarchie de priorité et les règles de départage**, et les
   traiter comme un contrat.
4. **Tout tracer** dès la première version : déclencheurs + fondements + version des fiches.
   La traçabilité n'est pas une option ajoutée après coup.
5. **Poser la frontière IA** tout de suite : le moteur décide, l'IA formule — jamais l'inverse.
6. **Émettre les signaux de confiance** (inconnues, conflits) dès le début, même sans les
   agréger.
7. **Constituer un jeu de cas de référence « décision »** (faits d'entrée → décisions
   attendues) pour verrouiller le comportement, en parallèle du jeu de cas « montants » prévu
   pour les moteurs de calcul.

> Objectif tenu : un moteur de décision **robuste** (terminaison garantie), **explicable**
> (traçabilité native), **évolutif** (piloté par le référentiel) et **indépendant des
> interfaces** (il ne connaît que des faits et des fiches).
