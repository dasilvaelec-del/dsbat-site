# Moteur DSBAT V2 — Fondations complémentaires (A · B · C · D)

> **Conception d'architecture uniquement.** Aucun code, aucune fonctionnalité, aucun
> chapitre existant modifié. Ce document complète les fondations validées par la Revue
> d'Architecture n°1 (`docs/Architecture/REVUE-ARCHITECTURE-01.md`).

Ces quatre briques ne corrigent rien : elles **ferment** le socle en formalisant les
contrats jusque-là implicites.

Principes fondamentaux conservés :

> Le moteur **décide**. Le catalogue **chiffre**. Les prix ne participent **jamais** aux
> décisions. Les moteurs métier **calculent**. Le Référentiel **fournit le savoir**. Le
> Moteur de Décision **choisit** les règles applicables. Le Journal de Décision **explique**
> pourquoi. Chaque couche a **une** responsabilité.

---

## Validation de la revue d'architecture

La Revue d'Architecture n°1 est **entérinée** : les Chapitres 1 et 2 sont les fondations
officielles du Moteur DSBAT (verdict ✅ OUI), sous réserve de formaliser les briques
complémentaires. Le présent document lève cette réserve en spécifiant :
- **A. Vocabulaire / Ontologie** (le langage commun) ;
- **B. Contrat du Projet / Dossier** (l'objet d'entrée unique) ;
- **C. Port d'accès au savoir** (le guichet unique vers le Référentiel) ;
- **D. Journal de décision** (la trace complète du raisonnement).

---

## Fondation A – Vocabulaire / Ontologie

**Rôle.** Le **dictionnaire officiel** de DSBAT : la liste des objets que le logiciel
manipule, avec un nom canonique stable pour chacun. C'est la **référence unique du langage
DSBAT**, utilisée à l'identique par les moteurs, l'IA, les API et les franchisés.

**Distinction clé.** L'ontologie définit des **types** (le concept « Douche ») ; le Projet
(Fondation B) en manipule des **instances** (« la douche de la SDB-1 »). L'ontologie est la
grammaire ; le Projet est la phrase.

**Structure d'une entrée d'ontologie :**

| Champ | Rôle |
|-------|------|
| `codeCanonique` | Identifiant stable et neutre (ex. `DOUCHE_ITAL`) — ne change jamais |
| `libelle` | Nom lisible (localisable ; le code, lui, ne l'est pas) |
| `categorie` | Famille d'objets (voir taxonomie ci-dessous) |
| `definition` | Sens précis et non ambigu |
| `alias` | Synonymes / termes informels renvoyant vers le code canonique |
| `attributs` | Attributs attendus (ex. une Pièce a des dimensions) |
| `relations` | Liens vers d'autres objets (ex. un Circuit appartient à un Tableau) |
| `uniteParDefaut` | Unité de mesure naturelle (m², U, ml…) |
| `metiers` | Corps d'état rattaché(s) |
| `version` / `etat` | Évolutivité et cycle de vie (l'ontologie se versionne aussi) |
| `extensions` | Zone ouverte |

**Taxonomie proposée (familles d'objets) :**

- **Contenants spatiaux** : Projet, Logement/Bâtiment, Pièce, Zone.
- **Surfaces** : Mur, Sol, Plafond.
- **Ouvertures** : Ouverture (générique) → Fenêtre, Porte, Baie.
- **Sanitaires** : Douche (dont Douche à l'italienne), Baignoire, WC (dont WC suspendu),
  Lavabo/Vasque, Évier.
- **Électricité** : Tableau électrique, Circuit, Différentiel, Prise, Point lumineux,
  Radiateur, Sortie fil pilote.
- **Plomberie (réseaux)** : Nourrice, Alimentation EF/ECS, Évacuation, Robinet d'arrêt.
- **Ventilation** : VMC, Caisson, Bouche, Entrée d'air, Gaine.

**Principes.** Le `codeCanonique` est **immuable et neutre linguistiquement** (les libellés
peuvent être traduits, pas les codes). Une **table d'alias** relie les termes informels au
code officiel. Ajouter un objet = ajouter une entrée : **aucune refonte**. L'ontologie **ne
dépend de rien** ; tout le reste dépend d'elle.

---

## Fondation B – Contrat du Projet (Dossier)

**Rôle.** L'**objet unique** représentant un chantier, transmis **à l'identique** à tous les
moteurs. L'interface (web, mobile, API, franchise) **remplit** ce contrat ; aucun moteur ne
dépend jamais directement de l'interface.

**Sections du contrat :**

| Section | Contenu | Origine |
|---------|---------|---------|
| `informationsGenerales` | Type de bien/projet, localisation, surface, métiers concernés | Entrée (UI) |
| `pieces` | Instances typées (ontologie), chacune avec ses composants | Entrée |
| `dimensions` | Par pièce : longueur, largeur, hauteur ; surfaces dérivées | Entrée / dérivé |
| `equipementsExistants` | Tableau, chauffage, VMC, eau chaude… | Entrée |
| `choixClient` | Gamme, options retenues, objectif | Entrée |
| `hypotheses` | Valeurs par défaut retenues faute de donnée (ex. hauteur 2,5 m), **marquées comme telles** | Comblé par le moteur |
| `contraintes` | Accès, logement occupé, copropriété… | Entrée |
| `decisions` | Le Plan de décisions (règles appliquées, besoins, recommandations, contrôles) | **Produit** (Ch2) |
| `resultats` | Prestations calculées + montants | **Produit** (moteurs + chiffrage) |

**Principes d'architecte.**

- **Objet unique, structure stable, versionnée.**
- **Séparation entrée / sortie stricte.** L'entrée (généralités, pièces, dimensions,
  équipements, choix, contraintes) est *fournie* ; les hypothèses sont *comblées* ; les
  décisions et résultats sont *produits* — jamais fournis par l'UI.
- **Enrichissement par étapes (append-only conceptuel).** L'entrée est figée avant la
  décision ; la décision ajoute la section `decisions` ; les moteurs ajoutent `resultats`.
  On enrichit sans muter l'amont → la traçabilité est préservée.
- **Vocabulaire imposé.** Toutes les pièces/objets sont désignés par les **codes canoniques**
  de la Fondation A.
- **Indépendance interface prouvée.** Le même contrat sert tous les canaux ; changer d'UI ne
  touche aucun moteur.

---

## Fondation C – Port d'accès au savoir

**Rôle.** Le **guichet unique** entre les moteurs et le Référentiel de Connaissances. Les
moteurs métier (et le moteur de décision) **n'accèdent jamais directement** aux normes,
règles métier, recommandations ou options : ils **interrogent** le port.

**Capacités du port :**

- Fournir les **connaissances applicables** à un contexte (un projet, une pièce, un objet).
- Fournir les **justifications** (le « pourquoi »), les **références** (source officielle) et
  les **versions** des fiches.
- Fournir un **cliché daté** du savoir (« l'état des connaissances au JJ/MM/AAAA ») pour
  reproduire un devis passé.

**Forme conceptuelle.** Un **contrat de requêtes par intention** (peu nombreuses et stables),
par exemple : « quelles fiches s'appliquent à cette pièce ? », « donne la fiche RM-024 »,
« donne le cliché du savoir à cette date ». Le port **n'expose jamais** la structure interne
du référentiel.

**Principes.**

- **Port au sens hexagonal** : interface stable, implémentations interchangeables. On peut
  réorganiser le référentiel, changer son stockage, ou router vers le référentiel d'une
  **franchise** — sans toucher aux moteurs.
- **Lecture seule.** Le port ne permet jamais d'écrire le savoir (la gouvernance passe par un
  autre canal).
- **Ni décision, ni calcul.** Le port *fournit* du savoir ; il ne choisit pas les règles (rôle
  du moteur de décision) et ne calcule rien.
- **Vocabulaire A** : les requêtes s'expriment avec les codes canoniques de l'ontologie.

---

## Fondation D – Journal de décision

**Rôle.** Conserver la **trace complète du raisonnement** du moteur. Objectif : rendre le
raisonnement **totalement explicable** — ce n'est **pas** un historique utilisateur.

**Contenu d'une entrée de journal (par cycle de décision) :**

- les **faits connus** (issus du Projet) ;
- les **hypothèses retenues** (valeurs par défaut, signalées) ;
- les **règles consultées** (candidates évaluées) ;
- les **règles appliquées** (activées) ;
- les **recommandations produites** ;
- les **contrôles déclenchés** ;
- les **conflits résolus** (avec la règle de départage utilisée) ;
- les **justifications** (fondements : identifiants + versions de fiches) ;
- les **décisions finales**.

**Principes.**

- **Sortie du raisonnement**, produite par le moteur de décision et rangée dans la section
  `decisions` du Projet (Fondation B).
- **Append-only, horodaté, versionné** : chaque entrée référence la **version** des fiches
  utilisées (lien avec le versionnement du Ch1).
- **Distinction « consultées » vs « appliquées »** : essentielle au débogage et au futur
  score de fiabilité.
- **Aucun prix.** Le journal explique la **décision**, jamais le chiffrage (ligne rouge). Le
  chiffrage aura, si besoin, sa propre trace séparée.
- **Neutre vis-à-vis de l'interface** : donnée structurée exploitable par audit / IA, pas un
  affichage.

**Ce que le journal prépare** : audits, IA, explications du devis, niveaux de confiance,
débogage, versionnement des règles.

---

## Relations entre ces quatre fondations

```
        ┌───────────────────────────────────────────────┐
        │        A. ONTOLOGIE (langage commun)           │  ← ne dépend de rien
        │   codes canoniques : Pièce, Mur, Douche, WC…   │
        └───────────────────────────────────────────────┘
                 ▲            ▲            ▲
                 │ (types)    │            │ (vocabulaire des requêtes)
        ┌────────┴───────┐    │      ┌─────┴───────────────┐
        │ B. PROJET       │   │      │ C. PORT d'accès      │───► RÉFÉRENTIEL (Ch1)
        │ (instances +    │   │      │ au savoir (guichet)  │      (lecture seule)
        │  entrées/sorties│   │      └─────┬───────────────┘
        └────────┬────────┘   │            │ fournit fiches + versions
                 │ contient   │            ▼
                 │       ┌────┴────────────────────────┐
                 └──────►│ D. JOURNAL de décision       │◄── produit par le
                         │ (dans Projet.decisions)      │    MOTEUR DE DÉCISION (Ch2)
                         └──────────────────────────────┘
```

- **A** est la plus profonde : B, C, D et les Chapitres 1–2 en dépendent ; elle ne dépend de
  rien.
- **B** porte les instances (typées par A) et contient la sortie **D**.
- **C** relie moteurs et savoir, en exprimant les requêtes dans le vocabulaire **A**.
- **D** est produit lors de la décision (Ch2), stocké dans **B**, et référence les fiches via
  **C** (identifiants + versions).

Flux complet : l'UI remplit **B** (en langage **A**) → le moteur de décision interroge le
savoir via **C** → produit décisions + **D** dans **B** → les moteurs métier lisent les
décisions (via **B**) et les besoins (via **C**) → le chiffrage applique les prix.
**Aucune boucle** : le graphe des dépendances reste acyclique.

---

## Compatibilité avec les Chapitres 1 et 2

Les quatre briques **complètent** sans contredire :

- **A** fournit le vocabulaire que les `conditionApplication` du Ch1 et les « faits » du Ch2
  utilisaient sans le nommer (comble le point faible n°1 de la revue).
- **B** formalise le Projet que le Ch2 consomme (comble le point faible « contrat d'entrée »).
- **C** matérialise le « le moteur interroge le référentiel » du Ch2 (comble le point faible
  n°3).
- **D** transforme la « traçabilité native » du Ch2 de principe en **brique structurelle**.

Elles s'emboîtent exactement dans les manques identifiés par la Revue n°1.

---

## Compatibilité avec la V1.5

Tout reste **additif** :

- **A** : le vocabulaire est aujourd'hui éparpillé (codes `ELEC_PRISE10`, `PLO_WC_SUSP`,
  `p.id = 'sdb'`, clés de `config`). L'ontologie les **unifie** ; les codes actuels deviennent
  des alias/entrées canoniques. Aucune modification maintenant.
- **B** : le « projet » est aujourd'hui éclaté entre `chantier`, `piecesSelectionnees`,
  `metiersActifs` et les `window.__*`. Le contrat les **réunit** ; la forme actuelle s'y
  projette. Migration ultérieure.
- **C** : aujourd'hui les moteurs lisent `PRIX` et `normes.js` directement, et `calculerDevis`
  embarque des règles. Le port est précisément ce qui manque ; introduit plus tard, sans casse.
- **D** : des traces partielles existent (`explicationsTableau`, messages de recommandation).
  Le journal les **généralise**.

Aucune de ces briques n'exige de toucher un moteur, un calcul, un prix ou l'interface
maintenant.

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **Ontologie figée trop tôt** | Refontes | Zone `extensions` + versionnement de l'ontologie |
| **Contrat Projet « god-object »** | Complexité, couplage | Sections claires + séparation stricte entrée/hypothèses/décisions/résultats |
| **Port trop fin (fuite d'abstraction)** | Couplage moteurs ↔ référentiel | Requêtes par **intention**, jamais par structure interne |
| **Journal volumineux** | Bruit, coût | Trace technique à niveaux de détail ; non destinée à l'UI |
| **Vocabulaire non imposé** | Divergence des termes | L'ontologie est la **seule** source ; alias obligatoires |
| **Sur-conception avant besoin** | Retard | Rester conceptuel ; valider sur le lot pilote |

---

## Avantages

- **Langage commun (A)** : cohérence totale entre moteurs, IA, API et franchises.
- **Contrat unique (B)** : indépendance à l'interface *prouvée*, pas seulement affirmée.
- **Port (C)** : le Référentiel évolue sans toucher les moteurs ; multi-référentiels
  (franchises) possible de façon transparente.
- **Journal (D)** : explicabilité complète → audits, IA, explications du devis, niveaux de
  confiance, débogage, versionnement des règles.
- **Ensemble** : un socle **fermé, acyclique, à responsabilités uniques**, prêt à durer.

---

## Recommandations

1. **Figer d'abord l'ontologie minimale** (les objets du lot pilote) et la convention de
   `codeCanonique`, traitée comme contrat immuable.
2. **Spécifier le contrat Projet** en sections stables + zone `extensions`, avec séparation
   stricte entrée / hypothèses / décisions / résultats.
3. **Définir le port** par un petit nombre de **requêtes d'intention** stables.
4. **Fixer le format du journal** (consultées vs appliquées, horodatage, versions), sans le
   rendre visible côté interface.
5. **Publier une carte des dépendances** des six couches (A, B, C, D + Référentiel + Décision)
   et la traiter comme contrat d'architecture.
6. **Constituer le jeu de cas de référence** (montants + décisions + journal attendu) avant
   toute migration depuis la V1.5.
7. **Geler le socle** une fois ces quatre briques posées : les chapitres suivants
   *construisent dessus*, ils ne le rediscutent plus.

---

## Conclusion

**Ces quatre fondations peuvent-elles être considérées comme les dernières briques
nécessaires avant de commencer les chapitres suivants du Moteur DSBAT ?**

### ✅ OUI

Justification. Ces quatre briques ferment exactement les manques pointés par la Revue n°1 :
**A** (ontologie) donne le langage commun orphelin, **B** (Projet) formalise l'entrée du
moteur, **C** (port) matérialise l'accès au savoir, et **D** (journal) élève la traçabilité au
rang de brique structurelle. Avec les Chapitres 1 et 2, elles forment un socle **complet,
acyclique et à responsabilités uniques**, où la ligne rouge « aucun prix dans la décision »
est tenue de bout en bout, et qui est **compatible avec la V1.5 par ajout progressif**.

Nuance d'honnêteté : « dernières briques » s'entend au sens des **fondations**. L'orchestrateur
et le moteur de chiffrage, déjà anticipés par la charte, sont des **couches de construction**
qui se posent *sur* ce socle — ils ne sont pas des fondations et n'ont pas à être formalisés
ici. Le socle peut donc être **officiellement gelé** : après A/B/C/D, on ne rediscute plus les
fondations, on construit.
