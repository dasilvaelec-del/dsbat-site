# Moteur DSBAT — MIGRATION 003 : Port d'Accès au Savoir

> **Conception d'un contrat conceptuel. Aucun code, aucune implémentation.** Formalise une brique
> déjà prévue par l'architecture (Fondation C). *Aucun moteur, calcul, prix, interface ni
> comportement modifié.*

Cette mission définit **complètement** le Port d'Accès au Savoir *avant* toute implémentation.
Elle prépare les migrations techniques suivantes.

---

## Vision générale

Aujourd'hui, le savoir est dispersé : les normes dans `normes.js`, les recommandations dans le
moteur de recommandations, les règles métier encore embarquées dans les moteurs. Demain, tout
consommateur de savoir (moteur de décision, moteurs métier, IA, API, audit) devra passer par
**une seule porte**.

Le Port d'Accès au Savoir est cette porte : un **guichet de lecture unique** entre les
consommateurs et le Référentiel de Connaissances. Il **fournit** du savoir ; il ne le **produit**
pas, ne le **modifie** pas, ne l'**applique** pas. C'est une façade stable derrière laquelle le
Référentiel peut évoluer librement.

---

## Rôle

Être **l'unique point d'entrée vers les connaissances** (Constitution P6). Le Port reçoit des
requêtes exprimées dans le **vocabulaire de l'Ontologie**, interroge le Référentiel, et renvoie
les fiches demandées accompagnées de leurs justifications, références et versions. Rien de plus.

Il joue le rôle de **port** au sens hexagonal : un contrat stable, dont l'implémentation intérieure
(structure du Référentiel, stockage, référentiel d'une franchise…) peut changer sans que les
consommateurs s'en aperçoivent.

---

## Responsabilités

- **Sélectionner et restituer** les fiches du Référentiel selon des critères déclarés (identifiant,
  métier, type d'objet, tags).
- **Fournir les métadonnées** attachées : justification, source officielle, version, date d'entrée
  en vigueur, état.
- **Servir un cliché daté** du savoir (« l'état des connaissances au JJ/MM/AAAA ») pour la
  reproductibilité.
- **Encapsuler** le Référentiel : ne jamais exposer sa structure interne, seulement le contrat.
- **Router** (à terme) vers le référentiel du profil actif (entreprise/franchise), de façon
  transparente pour les consommateurs.
- **Rester déterministe et sans état** : même requête + même cliché ⟹ même réponse.

---

## Ce que le Port fournit

- **Une fiche par identifiant** (`NF-…`, `RM-…`, `REC-…`, `OPT-…`), avec sa justification, sa
  source, sa version, sa date d'entrée en vigueur et son état.
- **Un ensemble de fiches candidates** pour un **descripteur de contexte** (ex. « fiches du métier
  plomberie concernant une `DOUCHE` en `SALLE_DE_BAIN` »).
- **Les références officielles** citées par une fiche.
- **La version** d'une connaissance (active, ou celle en vigueur à une date donnée).
- **Un cliché daté** de l'ensemble du savoir.

> **Distinction essentielle — « candidates » ≠ « appliquées ».** Le Port renvoie les fiches dont le
> **périmètre déclaré** correspond au contexte (une sélection par index : métier, type d'objet,
> tags). Il **n'évalue jamais** la condition d'application d'une fiche contre les faits d'un
> projet : décider si une fiche *s'applique réellement* est le travail du **Moteur de Décision**,
> pas du Port. Cette frontière empêche le Port de « décider ».

---

## Ce qu'il ne doit jamais faire

- **Calculer** : aucun montant, aucune quantité, aucun dimensionnement.
- **Décider** : ne pas évaluer une condition d'application, ne pas choisir entre deux fiches, ne
  pas résoudre un conflit.
- **Appliquer une règle** : ne produit ni besoin, ni prestation, ni recommandation émise.
- **Modifier une connaissance** : lecture seule absolue — aucune création, édition ou suppression
  de fiche (la gouvernance du savoir passe par un autre canal).
- **Exposer l'intérieur** du Référentiel (structure, stockage).
- **Dépendre d'une interface ou d'une technologie**.
- **Laisser entrer un prix** dans le savoir qu'il restitue.

---

## Relations avec les autres couches

- **Référentiel de Connaissances** : c'est **le seul magasin** que le Port lit. Le Port est la
  façade ; le Référentiel est le contenu. Le Port ne l'écrit jamais.
- **Moteur de Décision** : **consommateur principal**. Il demande au Port les fiches candidates et
  leurs métadonnées, puis **évalue** lui-même leur application et construit décisions + journal.
- **Moteurs métier** : ils **n'accèdent au savoir que par le Port** (Constitution P6) — jamais en
  lisant `normes.js` ou des règles en dur.
- **Journal de Décision** : le Port lui fournit les **versions** exactes des fiches servies ; le
  Journal les enregistre pour la traçabilité et la reproductibilité.
- **Futures API** : elles **exposent** vers l'extérieur des requêtes du Port (lecture de savoir),
  mais le Port **n'est pas** l'API — l'API l'enveloppe.
- **Futurs agents IA** : ils lisent le savoir **validé** via le Port ; ils n'écrivent jamais de
  connaissance (Constitution P15, P19).

---

## Types de requêtes

Le contrat conceptuel se limite à un **petit nombre d'intentions stables** (peu nombreuses = plus
durables) :

| Intention | Entrée | Sortie | Nature |
|-----------|--------|--------|--------|
| **Obtenir une fiche** | identifiant [+ version ou date] | la fiche (ou « absente ») | lecture ponctuelle |
| **Lister des fiches candidates** | descripteur de contexte (métier, type d'objet, tags) | fiches candidates (par périmètre déclaré) | lecture par index |
| **Obtenir les références** | identifiant | références officielles citées | lecture ponctuelle |
| **Obtenir la version** | identifiant [+ date] | version, état, date d'entrée en vigueur | lecture ponctuelle |
| **Obtenir un cliché** | date | vue figée du savoir à cette date | lecture ponctuelle |

Exemples formulés en langage courant : « donne la fiche `RM-024` » ; « donne les fiches
recommandation applicables (au sens périmètre) à une `DOUCHE` en `SALLE_DE_BAIN` » ; « donne la
version de `DTU-52.2` en vigueur au 12/03/2027 » ; « donne le cliché du savoir au 01/01/2026 ».

Toutes ces intentions sont **en lecture seule**, **déterministes** et **exprimées dans les codes
canoniques de l'Ontologie**.

---

## Compatibilité avec l'Ontologie

Le Port **parle la langue officielle** : ses requêtes et ses descripteurs de contexte emploient les
codes canoniques (`PIECE`, `DOUCHE`, `SALLE_DE_BAIN`, métiers…) définis par l'Ontologie DSBAT. Il
ne réintroduit aucun synonyme ni terme informel. L'Ontologie et le Port se complètent : l'un
définit les mots, l'autre s'en sert pour interroger le savoir.

---

## Compatibilité avec la Constitution

Le Port **est** l'application du **P6** (point d'entrée unique vers le savoir). Il respecte le
**P1/P2** (le savoir reste au Référentiel ; les moteurs l'interrogent, ne le contiennent pas), le
**P5** (accès par identifiant pérenne), le **P14** (versions + cliché daté = anciens devis
reproductibles), le **P16** (indépendant de l'interface et de la technologie), le **P21** (source
unique : une seule porte, un seul magasin), et la ligne rouge **P3** (aucun prix ne transite par le
savoir). Par construction, il **ne décide ni ne calcule** (P7 : responsabilité unique).

---

## Compatibilité avec le Plan Directeur

C'est l'étape prévue **après l'Ontologie** (Fondation C dans le Plan Directeur). Sa mise en œuvre
suivra la stratégie de **couture** : le Port sera d'abord une **façade de lecture en simple relais**
au-dessus des sources existantes (`normes.js`, règles du moteur de recommandations), **sans que
personne ne le consomme encore de façon contraignante**. Les moteurs migreront ensuite leurs
lectures de savoir vers le Port **un point d'appel à la fois** (branche par abstraction), chaque
étape validée « Golden Master identique ». Plus tard, on remplacera ce que le Port a derrière lui
(le vrai Référentiel) sans toucher aux consommateurs.

---

## Préparation des futures migrations

- **Journal de Décision** : le Port fournira les versions de fiches que le Journal doit
  enregistrer — les deux briques sont pensées ensemble.
- **Moteur de Décision** : il s'appuiera sur « lister les fiches candidates » puis évaluera
  lui-même l'application — la frontière candidates/appliquées est déjà posée.
- **Moteurs métier** : leur future connexion consistera à remplacer leurs accès directs au savoir
  par des requêtes au Port, sans changer un calcul.
- **Multi-référentiels (franchises)** : le routage par profil est prévu dès le contrat ; il
  s'ajoutera derrière le Port sans impact sur les consommateurs.
- **API / IA** : elles envelopperont ou consommeront les mêmes intentions de lecture, jamais
  d'écriture de savoir.

---

## Conclusion

Le Port d'Accès au Savoir est désormais **complètement défini** : un guichet de lecture unique,
déterministe, exprimé dans l'Ontologie, qui **fournit** le savoir et ses versions mais ne
**calcule** ni ne **décide** ni ne **modifie** jamais rien. Sa frontière la plus importante —
restituer des fiches *candidates* sans jamais évaluer leur application — garantit qu'il ne
empiète pas sur le Moteur de Décision. Cette définition suffit pour aborder son implémentation en
toute sécurité, par couture progressive, sans rien changer au comportement actuel du logiciel.

*— MIGRATION 003 : Port d'Accès au Savoir. Contrat conceptuel, avant implémentation.*
