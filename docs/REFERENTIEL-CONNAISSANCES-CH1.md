# Moteur DSBAT V2 — Chapitre 1 : Référentiel de Connaissances

> Document de **conception uniquement**. Aucun code, aucune fonctionnalité, aucun
> moteur/calcul/prix/interface modifié. On définit **l'architecture du savoir** du
> logiciel : la source unique de toutes les connaissances métier de DSBAT.

Ce chapitre approfondit la couche « Socle de connaissances » de la charte V2
(`docs/MOTEUR-DSBAT-ARCHITECTURE-V2.md`).

---

## Architecture proposée

Le Référentiel de Connaissances est une **base de savoir déclarative** : de la donnée,
pas de la logique. Il énonce *ce que DSBAT sait* (obligations, expertise, conseils,
options) et *pourquoi*. Il ne calcule rien, ne contient aucun prix, ne connaît aucune
interface.

Trois principes le gouvernent :

1. **Séparation savoir / traitement.** Le référentiel dit *quoi* et *pourquoi* ; les
   moteurs disent *comment calculer*. Un moteur n'« embarque » plus une connaissance :
   il l'**interroge**.
2. **Chaque connaissance est une fiche identifiée.** Un identifiant unique et stable
   (NF-001, RM-024…) rend chaque savoir citable par le devis, l'IA, les audits et le
   versionnement.
3. **Deux niveaux de lecture par fiche.** Un niveau **documentaire** (source,
   justification, texte) toujours présent, et un niveau **actionnable par la machine**
   (condition + effet formels) **optionnel et progressif**. On peut cataloguer une
   connaissance utile avant de savoir l'exécuter automatiquement.

Le référentiel est **indépendant de l'interface** : configurateur web, mobile, API,
logiciel franchisé, agents IA et outils d'audit l'interrogent tous de la même façon.

---

## Organisation générale

Deux axes d'organisation se combinent :

- **Par famille** (nature du savoir) : Normes, Règles métier, Recommandations, Options.
  C'est l'axe *logique* — il détermine le comportement (une norme est imposée, une option
  ne l'est jamais).
- **Par métier / domaine** (électricité, plomberie, carrelage…) : c'est l'axe *pratique*
  de rangement et de maintenance.

Chaque fiche porte donc **sa famille** et **son (ou ses) métier(s)**. On peut ainsi
demander « toutes les obligations plomberie » aussi bien que « tout le savoir applicable
à une salle de bain ».

Le référentiel se pense comme **une collection unique de fiches** (même structure de base
pour toutes), rangée par famille puis par métier pour la lisibilité humaine. Une zone
distincte est réservée aux **interactions entre métiers** (voir plus bas), qui ne sont pas
des fiches ordinaires mais des **liens** entre fiches.

---

## Les quatre familles de connaissances

| Famille | Nature | Imposée ? | Préfixe d'identifiant | Exemple |
|---------|--------|-----------|-----------------------|---------|
| **Normes** | Obligation issue d'un texte officiel | Oui | selon la source : `NF-`, `DTU-`, `RE-`, `REG-` | NF-001, DTU-015 |
| **Règles métier** | Expertise DSBAT (terrain, bonnes pratiques, logique) | Oui (par cohérence technique, pas par la loi) | `RM-` | RM-024 |
| **Recommandations** | Amélioration proposée, jamais obligatoire | Non | `REC-` | REC-018 |
| **Options** | Confort / personnalisation | Non | `OPT-` | OPT-007 |

**1. Normes.** Proviennent de références officielles (NF, DTU, RE2020, réglementation,
obligations techniques). Elles sont **imposées par des textes**. Une norme énonce une
exigence (ex. étanchéité obligatoire en pièce humide — NF DTU 52.2), jamais un prix.

**2. Règles métier.** L'**expertise DSBAT**, qui ne découle pas directement d'une norme
mais de l'expérience, des bonnes pratiques et de la logique des métiers :
- une douche italienne implique une étanchéité ;
- un parquet flottant nécessite généralement une sous-couche ;
- un WC suspendu implique un bâti-support ;
- une cuisine rénovée implique plusieurs circuits spécialisés.
Elles sont exprimées en **implications** (« X implique Y ») et **ne contiennent aucun prix**.

**3. Recommandations.** Jamais obligatoires ; elles **améliorent** le projet (prise
supplémentaire, VMC hygroréglable, meilleure isolation, sous-couche acoustique). **Le
client garde toujours le choix.** Elles ne modifient jamais le devis automatiquement.

**4. Options.** **Confort et personnalisation** (domotique, éclairage décoratif, prises
USB, variateurs, finitions premium). Elles ne doivent **jamais** être confondues avec une
obligation ou une recommandation : c'est une famille à part entière, distinguée par sa
famille et son préfixe.

> La distinction imposé / conseillé / optionnel est portée par le **champ famille** de
> chaque fiche — jamais laissée à l'interprétation d'un moteur.

---

## Structure d'une connaissance

Toutes les familles partagent un **socle commun**, enrichi de champs propres à chaque
famille. La structure reste **ouverte** (une zone d'extension permet d'ajouter des champs
sans casser l'existant).

**Socle commun (toutes familles) :**

| Champ | Rôle |
|-------|------|
| `identifiant` | Identité unique et stable (NF-001, RM-024…) |
| `famille` | Normes / Règle métier / Recommandation / Option |
| `metiers` | Un ou plusieurs corps d'état concernés |
| `typePiece` | Type(s) de pièce visés (cuisine, sdb, tous…) |
| `titre` | Intitulé court et lisible |
| `importance` | Niveau (obligatoire / fortement conseillé / conseillé / confort) |
| `conditionApplication` | Quand la fiche s'applique (décrite, puis un jour formalisée) |
| `justification` | Le « pourquoi » (texte d'explication, réutilisé par le devis et l'IA) |
| `source` | Origine (référence du texte, ou « expertise DSBAT ») |
| `version` | Version de la fiche |
| `dateEntreeVigueur` | À partir de quand elle s'applique |
| `etat` | brouillon / en revue / active / dépréciée / archivée |
| `historique` | Journal des versions précédentes |
| `tags` | Mots-clés de recherche et de filtrage |
| `liens` | Références croisées vers d'autres fiches (dont interactions métiers) |
| `extensions` | Zone ouverte pour champs futurs |

**Champs spécifiques par famille :**

- **Normes** : `typeSource` (NF/DTU/RE2020/réglementation), `referenceOfficielle`,
  `caractereObligatoire`.
- **Règles métier** : `implique` (les besoins déclenchés — ex. « étanchéité »,
  « bâti-support »), exprimés comme **besoins abstraits**, jamais comme références de
  catalogue.
- **Recommandations** : `benefice` (ce que ça améliore), `niveauReco`
  (🟢 recommandé / 🟡 à envisager / 🔵 information) — aligné sur le moteur existant.
- **Options** : `categorieConfort`, `exclusivites` (options incompatibles entre elles).

**Deux niveaux de représentation** (rappel) : le niveau **documentaire** ci-dessus est
toujours rempli ; un niveau **actionnable** (condition + effet formalisés, exploitables
par un moteur) est **ajouté progressivement**, fiche par fiche, sans obligation.

*Exemple illustratif (fiche, pas du code) :*

```
identifiant       : RM-024
famille           : Règle métier
metiers           : [plomberie, carrelage]
typePiece         : [sdb]
titre             : Douche à l'italienne — étanchéité obligatoire
importance        : obligatoire (bonne pratique + renvoi NF DTU 52.2)
conditionApplic.  : présence d'une douche à l'italienne
implique          : [etancheite_sous_carrelage, caniveau_ou_pente,
                     evacuation_adaptee, hauteur_faience_minimale]
justification      : "Une douche italienne est de plain-pied : sans étanchéité
                     sous carrelage, l'eau s'infiltre. Le carrelage n'est pas
                     étanche par lui-même."
source            : Expertise DSBAT + NF DTU 52.2
liens             : [NF-052 (norme), interaction: PLOMBERIE↔CARRELAGE]
version           : 1.0
dateEntreeVigueur : 2026-01-01
etat              : active
```

---

## Cycle de vie d'une connaissance

Une fiche suit un cycle **gouverné** :

1. **Brouillon** — proposée (par un expert DSBAT ou, plus tard, suggérée par l'IA).
2. **En revue** — vérifiée (exactitude, source, non-doublon).
3. **Active** — validée, avec une **date d'entrée en vigueur**.
4. **Dépréciée** — remplacée par une version plus récente (`remplacePar`), mais conservée.
5. **Archivée** — plus applicable, gardée pour l'historique et les audits.

Principes clés pour tenir dix ans :

- **On ne supprime jamais.** Une fiche obsolète est dépréciée/archivée, jamais effacée.
- **Chaque modification crée une version** ; l'ancienne rejoint `historique`.
- **Datation systématique.** On doit pouvoir répondre : « que savait le moteur à la date
  du devis N° X ? » — condition d'un audit fiable et de la reproductibilité d'un ancien devis.

---

## Relations avec les moteurs métier

Renversement de responsabilité :

- **Avant (V1)** : les moteurs *contenaient* les connaissances (seuils, implications,
  minimums) directement dans leur code.
- **Cible (V2)** : les moteurs **interrogent** le référentiel. Ils reçoivent les fiches
  applicables à un projet, puis **calculent** — mais ne *possèdent* plus le savoir.

Répartition nette des rôles :

- Le **référentiel** détient le *quoi* et le *pourquoi* (obligations, implications,
  justifications) — **sans prix, sans calcul**.
- Le **moteur métier** détient le *comment* (dimensionnement, quantités) et produit des
  **prestations**.
- Le **catalogue** (couche séparée) détient les *références et les prix* qui répondent aux
  besoins exprimés par les fiches.

Sens de circulation **à sens unique** : les moteurs **lisent** le référentiel, ils ne
l'écrivent jamais. Le référentiel ne dépend d'aucun moteur.

> Migration progressive : tant qu'une connaissance vit encore dans un moteur, elle y reste ;
> on l'en extrait vers le référentiel **quand elle est stable**, sans big-bang.

---

## Compatibilité avec l'architecture actuelle

Le référentiel est **additif** : rien ne casse.

- **`normes.js`** devient la **graine de la famille Normes**. Ses entrées (par métier,
  `{ref, description}`) se transposent en fiches identifiées (NF-###, DTU-###…) sans changer
  ce que la page « engagements » ou les pages devis affichent aujourd'hui — une vue de
  compatibilité peut continuer à exposer l'ancien format.
- **`js/moteur-recommandations.js`** est déjà, de fait, une **amorce des familles
  Recommandations et Options** : sa structure `{id, catégorie, priorité, condition,
  message}` se mappe directement sur le socle commun. Les catégories 🟢/🟡/🔵 correspondent
  au champ `niveauReco`.
- **Les règles métier aujourd'hui dans `prix.js`** (implications, seuils) constituent le
  vivier de la **famille Règles métier** — à extraire plus tard, quand elles sont figées.
- **Le catalogue (`PRIX`)** reste strictement séparé : le référentiel n'y touche pas et ne
  contient aucun prix.

Aucune de ces transpositions n'exige de modifier un moteur, un calcul ou l'interface
maintenant : ce chapitre **conçoit**, il ne migre pas encore.

---

## Préparation des interactions entre métiers

Les interactions (Plomberie ↔ Carrelage, Électricité ↔ Chauffage, Isolation ↔ Menuiserie,
Salle de bain ↔ Étanchéité, Douche ↔ Faïence) **ne sont pas développées maintenant**, mais
**prévues dans l'architecture** :

- On réserve une **collection distincte d'« interactions »** : chaque interaction est un
  **lien** entre deux métiers/fiches, porteur d'une règle de cohérence (ex. « l'étanchéité
  se pose avant la faïence » → contrainte d'**ordre** ; « une douche italienne côté plomberie
  impose une hauteur de faïence côté carrelage » → contrainte de **cohérence**).
- Le champ `liens` de chaque fiche permet déjà de **référencer** ces interactions.
- Types d'interaction à prévoir : **ordre** (séquencement des lots), **dépendance** (l'un
  requiert l'autre), **cohérence** (valeurs à accorder), **exclusion** (incompatibilité).

Ainsi, le jour où un « moteur d'interactions » sera écrit, il lira cette collection sans
qu'on ait à retoucher les fiches ni les moteurs métier.

---

## Préparation de l'IA

Le référentiel est le **socle de vérité** qui permettra à l'IA de raisonner sans inventer :

- **Identifiants stables + justifications + sources** = corpus citable. Chaque décision du
  logiciel pourra pointer « parce que RM-024 et NF-052 ».
- **Traçabilité** : un devis pourra lister les fiches ayant conduit à chaque prestation.
- **Boucle d'amélioration** : l'IA pourra **proposer** de nouvelles fiches, qui entrent en
  état **brouillon** et passent par la revue humaine — jamais actives sans validation.
- **Niveau actionnable** : plus les fiches gagnent une condition/effet formels, plus l'IA
  peut les exploiter de façon fiable.

---

## Préparation des catalogues fournisseurs

Principe intangible : **le référentiel ne contient aucun prix ni aucune référence
fournisseur**. Il exprime des **besoins abstraits** (ex. « bâti-support », « étanchéité sous
carrelage »). Ce sont les **catalogues** (couche séparée, multi-fournisseurs) qui
**résolvent** ces besoins en produits concrets et en prix.

Pour préparer cela sans le construire :

- Introduire un **vocabulaire partagé de besoins** (une nomenclature stable de « types de
  besoin ») que les fiches emploient et que les catalogues savent faire correspondre.
- Ainsi, changer de fournisseur ou de catalogue ne touche **ni les fiches, ni les moteurs** :
  seule la correspondance besoin → référence/prix change.

---

## Préparation du versionnement

Le versionnement est **au cœur** de la durabilité :

- **Par fiche** : `version`, `dateEntreeVigueur`, `etat`, `historique`, `remplacePar`.
- **Au niveau du référentiel** : notion de **cliché daté** (« état du savoir au JJ/MM/AAAA »),
  pour rejouer un ancien devis avec les connaissances de l'époque.
- **Supersession explicite** : une nouvelle norme référence celle qu'elle remplace.
- **Auditabilité** : toute décision du moteur peut être reliée à la **version précise** des
  fiches utilisées.

C'est ce qui permettra, dans dix ans, de justifier un devis émis aujourd'hui.

---

## Avantages

- **Source unique de vérité** : plus de connaissances éparpillées et contradictoires.
- **Indépendance à l'interface** : un seul savoir pour web, mobile, API, franchise, IA, audit.
- **Traçabilité et confiance** : chaque décision est citable et datée.
- **Séparation nette** obligation / expertise / conseil / option, non laissée aux moteurs.
- **Évolutivité** : structure ouverte, ajout de fiches et de champs sans casse.
- **Durabilité juridique** : versionnement + datation = reproductibilité des devis passés.
- **Migration douce** : additif, sans big-bang, capitalise sur `normes.js` et le moteur de
  recommandations existants.

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **Gouvernance faible** (qui valide/date les fiches ?) | Savoir obsolète ou faux | Rôle de « responsable référentiel » + cycle de vie obligatoire |
| **Sur-formalisation trop tôt** | Blocage, lenteur | Commencer **documentaire**, ajouter l'actionnable au fil de l'eau |
| **Doublons / incohérences entre fiches** | Décisions contradictoires | Identifiants uniques, revue anti-doublon, liens croisés |
| **Fuite de prix dans les fiches** | Perte de la séparation savoir/catalogue | Interdit par conception : besoins abstraits uniquement |
| **Schéma figé trop vite** | Refontes coûteuses | Zone `extensions` + socle minimal stable |
| **Big-bang de migration** | Régressions | Extraction fiche par fiche, seulement quand stable |

---

## Recommandations

1. **Figer d'abord le socle commun minimal** (identifiant, famille, métiers, justification,
   source, version, date, état) — le reste peut s'ajouter par `extensions`.
2. **Adopter tout de suite la convention d'identifiants** (NF-/DTU-/RE-/REG-/RM-/REC-/OPT-)
   et la traiter comme un contrat immuable.
3. **Rester documentaire au départ.** Formaliser conditions/effets seulement pour les fiches
   mûres et à forte valeur (ex. douche italienne, WC suspendu, cuisine).
4. **Nommer un responsable du référentiel** et écrire la règle de revue (brouillon → active).
5. **Prévoir dès maintenant** la collection d'interactions et le vocabulaire de besoins,
   **sans les remplir** — juste réserver la place.
6. **Constituer un premier lot pilote** de 15–20 fiches (les plus citées : électricité SDB,
   douche italienne, WC suspendu, cuisine, parquet flottant) pour valider la structure avant
   toute extraction depuis les moteurs.
7. **Ne rien migrer tant que la structure n'est pas éprouvée** sur ce lot pilote.

> Objectif : un savoir clair, modulaire, documenté et daté — capable d'évoluer pendant de
> nombreuses années, et de servir un jour tous les canaux DSBAT sans être réécrit.
