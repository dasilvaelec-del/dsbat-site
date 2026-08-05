# Ontologie officielle DSBAT

> **Langage officiel unique du projet DSBAT.** Produit par la MIGRATION 002 (première migration
> réelle de la V2). *Document de référence — aucun code, aucun moteur, aucun calcul, aucun prix,
> aucun devis, aucune interface modifiés.* Purement architectural.
>
> Cette ontologie donne corps à la **Fondation A** et au **Chapitre 3 (Modèle des objets)**. Elle
> devient la référence de vocabulaire pour les moteurs métier, le Référentiel de Connaissances, le
> Moteur de Décision, le Port d'Accès au Savoir, le Journal, les API et les futurs agents IA et
> franchisés.

---

## Vision générale

Un logiciel qui doit durer dix ans et être partagé par des humains, des IA, des API et des
franchises ne peut pas tolérer que la même notion soit nommée de trois façons différentes.
L'Ontologie DSBAT fixe **un mot officiel par notion**, et **un seul**. Tout le reste — anciens
codes, termes informels, synonymes — devient un **alias** qui *pointe vers* le mot officiel, sans
jamais faire autorité.

Cette migration **n'exécute rien**. Elle publie un dictionnaire. Le logiciel continue de
fonctionner exactement comme avant ; on lui ajoute simplement une **langue de référence** que les
composants futurs adopteront progressivement.

---

## Principes de l'ontologie

1. **Un mot officiel par notion.** Chaque notion possède un **code canonique** unique, stable et
   neutre. Les autres appellations sont des alias.
2. **Type vs instance.** L'ontologie définit des **types** (« la Douche à l'italienne ») ; les
   projets manipulent des **instances** (« la douche de SDB-1 »).
3. **Abstraction puis spécialisation.** On nomme d'abord des **familles** (Paroi, Équipement,
   Réseau), puis leurs **spécialisations**. Les familles sont stables ; les spécialisations
   s'ajoutent.
4. **Le code ne se traduit pas ; le libellé, oui.** Le code canonique est immuable et neutre ; son
   libellé affiché peut être localisé.
5. **Aucun prix, aucun fournisseur dans l'ontologie.** Elle nomme des objets, pas des références
   de catalogue (Constitution P3).
6. **On n'efface jamais.** Un terme obsolète est déprécié, jamais supprimé ; les anciens codes
   restent valides via alias (compatibilité).

---

## Familles d'objets

Quatre grandes catégories (reprises du Chapitre 3), chacune regroupant des familles :

| Catégorie | Familles d'objets |
|-----------|-------------------|
| **Physiques** | `LOGEMENT`, `PIECE`, `PAROI`, `OUVERTURE`, `ESCALIER`, `SUPPORT`, `REVETEMENT`, `EQUIPEMENT`, `RESEAU`, `ORGANE_DISTRIBUTION`, `COMPOSANT` |
| **Logiques** | `PROJET`, `ZONE`, `BESOIN`, `PRESTATION`, `HYPOTHESE`, `CONTRAINTE`, `RESULTAT` |
| **Décision** | `DECISION`, `RECOMMANDATION_EMISE`, `CONTROLE`, `ALERTE`, `CONFLIT`, `JOURNAL` |
| **Connaissance** | `FICHE` → `NORME`, `REGLE_METIER`, `RECOMMANDATION`, `OPTION`, `INTERACTION` |

Les abstractions se spécialisent : `PAROI` → `MUR`, `SOL`, `PLAFOND`, `CLOISON` ; `OUVERTURE` →
`FENETRE`, `PORTE`, `BAIE` ; `EQUIPEMENT` → `DOUCHE`, `BAIGNOIRE`, `WC`, `LAVABO`, `EVIER`,
`RADIATEUR`, `BALLON`, `BOUCHE_VMC`, `MEUBLE`, `PRISE`, `POINT_LUMINEUX`… ; `RESEAU` →
`CIRCUIT_ELECTRIQUE`, `CANALISATION`, `EVACUATION`, `GAINE` ; `ORGANE_DISTRIBUTION` →
`TABLEAU_ELECTRIQUE`, `NOURRICE`, `CAISSON_VMC`.

---

## Définitions officielles

Format : *rôle · définition officielle · relations principales · code(s) · synonymes interdits*.

### Objets physiques

**LOGEMENT** — *Rôle* : le contenant bâti. *Définition* : l'ensemble immobilier objet du projet.
*Relations* : contient des `PIECE`. *Synonymes interdits* : « bien », « habitation » (comme code).

**PIECE** — *Rôle* : unité fonctionnelle habitable. *Définition* : espace délimité par des parois,
d'un usage identifié. *Relations* : contient `PAROI`, `OUVERTURE`, `EQUIPEMENT` ; appartient à des
`ZONE`. *Synonymes interdits* : « local », « espace », « room ».

**PAROI** *(abstraction)* — *Rôle* : surface délimitant une pièce. *Spécialisations* : `MUR`,
`SOL`, `PLAFOND`, `CLOISON`. *Relations* : porte un `SUPPORT`, reçoit des `REVETEMENT`, peut être
percée par une `OUVERTURE`. *Synonymes interdits* : « face », « surface » (ambigus).

**OUVERTURE** *(abstraction)* — *Rôle* : percement d'une paroi. *Spécialisations* : `FENETRE`,
`PORTE`, `BAIE`. *Relations* : appartient à une `PAROI`. *Synonymes interdits* : « trou »,
« vide ».

**ESCALIER** — *Rôle* : circulation verticale. *Relations* : relie des niveaux/`ZONE`.

**SUPPORT** — *Rôle* : subjectile sous un revêtement. *Définition* : état/nature de la surface à
recouvrir. *Relations* : porté par une `PAROI`, préparé avant un `REVETEMENT`. *Synonymes
interdits* : « fond », « subjectile » (comme code).

**REVETEMENT** — *Rôle* : couche de finition. *Définition* : matériau appliqué sur une paroi
(faïence, peinture, parquet, carrelage…). *Relations* : appliqué sur `PAROI`, au-dessus d'un
`SUPPORT`. *Synonymes interdits* : « finition » (c'est une étape, pas l'objet).

**EQUIPEMENT** *(abstraction)* — *Rôle* : appareil terminal desservi par un réseau.
*Spécialisations* : `DOUCHE` (type `ITALIENNE`/`CABINE`), `BAIGNOIRE`, `WC` (type `SUSPENDU`/
`POSE`), `LAVABO`, `EVIER`, `RADIATEUR`, `BALLON`, `BOUCHE_VMC`, `MEUBLE`, `PRISE`,
`POINT_LUMINEUX`… *Relations* : installé dans une `PIECE` ; **requiert** un `RESEAU` ; peut
**impliquer** d'autres objets (`DOUCHE.ITALIENNE` implique étanchéité). *Synonymes interdits* :
« appareil », « élément » (trop génériques).

**RESEAU** *(abstraction)* — *Rôle* : acheminement d'énergie, de fluide ou d'air.
*Spécialisations* : `CIRCUIT_ELECTRIQUE`, `CANALISATION`, `EVACUATION`, `GAINE`. *Relations* :
**dessert** des `EQUIPEMENT` ; **piloté** par un `ORGANE_DISTRIBUTION`. *Synonymes interdits* :
« ligne », « tuyau » (comme code générique).

**ORGANE_DISTRIBUTION** *(abstraction)* — *Rôle* : point central d'un réseau.
*Spécialisations* : `TABLEAU_ELECTRIQUE`, `NOURRICE`, `CAISSON_VMC`. *Relations* : pilote des
`RESEAU` ; possède une capacité. *Synonymes interdits* : « central », « boîtier ».

**COMPOSANT** — *Rôle* : élément unitaire d'un réseau ou d'un organe (différentiel, robinet
d'arrêt, manchon…). *Relations* : appartient à un `RESEAU` ou un `ORGANE_DISTRIBUTION`.

### Objets logiques

**PROJET** — *Rôle* : objet racine et **contrat unique** (Fondation B). *Définition* : la
représentation complète d'un chantier (entrées, hypothèses, décisions, résultats). *Relations* :
contient `LOGEMENT`/`PIECE`, porte `DECISION` et `RESULTAT`. *Synonymes interdits* : « devis »
(le devis est une *sortie*, pas le projet), « chantier » comme code (rester `PROJET`).

**ZONE** — *Rôle* : regroupement logique de pièces (ex. zone humide, niveau). *Relations* :
regroupe des `PIECE`.

**BESOIN** — *Rôle* : exigence abstraite déclenchée par une décision. *Définition* : *ce qu'il
faut* (ex. « étanchéité sous carrelage »), sans dire *avec quoi* ni *combien*. *Relations* :
produit par une `DECISION`, satisfait par une `PRESTATION`. *Synonymes interdits* :
« prestation », « ouvrage ».

**PRESTATION** — *Rôle* : ouvrage réalisé pour satisfaire un besoin. *Relations* : répond à un
`BESOIN`, compose un `RESULTAT`. *Note* : le prix lui est attaché par le catalogue, **jamais dans
l'ontologie**.

**HYPOTHESE** — *Rôle* : valeur retenue faute de donnée, **signalée**. *Relations* : rattachée à
un objet ; tracée au `JOURNAL`. *Synonymes interdits* : « défaut » (ambigu avec « défaut
technique »).

**CONTRAINTE** — *Rôle* : limitation du contexte (accès, logement occupé, copropriété).
*Relations* : s'applique au `PROJET`, à une `ZONE` ou à une `PIECE`.

**RESULTAT** — *Rôle* : agrégat des prestations (et, en aval, des montants). *Relations* :
composé de `PRESTATION`.

### Objets de décision

**DECISION** — *Rôle* : conclusion du raisonnement. *Relations* : **concerne** des objets,
**fondée sur** des `FICHE`, **produit** des `BESOIN`. *Synonymes interdits* : « choix »
(le choix est humain).

**RECOMMANDATION_EMISE** — *Rôle* : instance d'une `RECOMMANDATION` (type) appliquée au projet.
*Relations* : liée à des `DECISION` et à des objets. **Jamais** appliquée d'office. *Synonymes
interdits* : « suggestion auto », « ajout automatique ».

**CONTROLE** — *Rôle* : vérification réalisée. *Relations* : **porte sur** des objets ; peut
produire une `ALERTE`.

**ALERTE** — *Rôle* : signalement (incohérence, oubli, conflit) avec gravité. *Relations* : issue
d'un `CONTROLE` ou d'un `CONFLIT`.

**CONFLIT** — *Rôle* : trace d'une contradiction et de son départage. *Relations* : entre `FICHE`
ou `DECISION`.

**JOURNAL** — *Rôle* : trace complète du raisonnement (Fondation D). *Relations* : rangé dans
`PROJET`, référence `DECISION`, `FICHE` (versions), `CONFLIT`.

### Objets de connaissance (types)

**FICHE** *(abstraction)* — *Spécialisations* : `NORME`, `REGLE_METIER`, `RECOMMANDATION`,
`OPTION`, `INTERACTION`. *Rôle* : définir une exigence, une implication, un conseil, une option ou
un lien inter-métiers. *Relations* : citée par des `DECISION`. *Synonymes interdits* : confondre
`RECOMMANDATION` (conseil) et `OPTION` (confort) et `NORME` (obligation) — interdit par la
Constitution (P12, P13).

---

## Relations principales

Trois natures, à ne jamais mélanger : **composition** (▷ contient), **desserte** (→ alimente),
**référence** (⋯ concerne/justifie).

```
PROJET ▷ LOGEMENT ▷ PIECE ▷ PAROI ▷ REVETEMENT
                     │        └─ SUPPORT
                     ├─ OUVERTURE (perce la PAROI)
                     ├─ EQUIPEMENT ──requiert──► RESEAU ──pilote──► ORGANE_DISTRIBUTION
                     └─ appartient à ▷ ZONE

DECISION ⋯concerne⋯► {PIECE, EQUIPEMENT, PAROI…}
DECISION ⋯fondée sur⋯► FICHE(s)   ──produit──► BESOIN ──satisfait par──► PRESTATION ──► RESULTAT
CONTROLE ⋯porte sur⋯► objets ──► ALERTE
INTERACTION ⋯relie⋯► deux métiers/objets
JOURNAL ⋯trace⋯► DECISION + FICHE (versions) + CONFLIT
```

---

## Conventions de nommage

**Codes canoniques d'objets** : `MAJUSCULES_SNAKE`, en français, **sans accent**, au **singulier**,
**immuables**. Ex. `PIECE`, `TABLEAU_ELECTRIQUE`, `DOUCHE`.

**Spécialisations** : soit un code propre (`MUR`, `WC`), soit un **type** contrôlé porté par la
famille (`DOUCHE` type `ITALIENNE`). La liste des types est elle-même canonique.

**Identifiants d'instances** (pour les décisions/journal) : code d'objet + numéro, ex. `SDB-1`,
`TABLEAU-1`.

**Identifiants de connaissances** (fiches, rappel Ch1) : préfixe par source/famille + numéro
pérenne — `NF-`, `DTU-`, `RE-`, `REG-`, `RM-`, `REC-`, `OPT-`.

**Alias** : un alias relie un terme existant ou informel au code canonique. Il **ne fait jamais
autorité** ; il n'existe que pour la compatibilité et la lecture.

**Règles d'évolution** : on **ajoute** des objets/types/alias ; on ne **renomme jamais** un code
canonique (si un terme change, on ajoute un alias) ; on **déprécie** au lieu de supprimer ;
l'ontologie est **versionnée** ; toute addition passe un état *brouillon → actif* (gouvernance,
comme au Ch1).

### Table d'alias V1.5 → canonique (ancrée sur le code réel, extensible)

| Terme / identifiant V1.5 | Code canonique | Famille |
|--------------------------|----------------|---------|
| `sdb` | `PIECE` type `SALLE_DE_BAIN` | Pièce |
| `sde` | `PIECE` type `SALLE_EAU` | Pièce |
| `wc` | `PIECE` type `WC` | Pièce |
| `cuisine`, `salon`, `chambre`, `bureau`, `couloir`, `entree`, `dressing`, `cave`, `garage`, `salle_manger`, `veranda` | `PIECE` type correspondant | Pièce |
| `terrasse`, `jardin`, `facade`, `carport`, `escalier` | `PIECE`/`ZONE` extérieure ou `ESCALIER` | Pièce/Zone |
| `electricite`, `plomberie`, `peinture`, `sols`, `carrelage`, `isolation`, `menuiserie`, `vmc` | métiers (attribut `metiers`) | — |
| `PLO_DOUCHE_ITAL` | `DOUCHE` type `ITALIENNE` (référence catalogue) | Équipement |
| `PLO_WC_SUSP` | `WC` type `SUSPENDU` | Équipement |
| `PLO_NOURRICE` | `NOURRICE` | Organe |
| `PLO_BALLON_100/200/50` | `BALLON` | Équipement |
| `VMC_BOUCHE`, `VMC_ENTREE_AIR` | `BOUCHE_VMC`, `ENTREE_AIR` | Composant |
| `ELEC_PRISE10/20/32…` | `PRISE` (références catalogue) | Composant |
| `ELEC_PL_*` | `POINT_LUMINEUX` (références catalogue) | Composant |
| `window.__tableauAuto` / `dimensionnementTableau` | `TABLEAU_ELECTRIQUE` | Organe |

*La table est illustrative et se complète progressivement ; elle relie les codes catalogue
existants aux notions canoniques, sans jamais les remplacer.*

---

## Compatibilité avec la Constitution

Cette ontologie **est** l'application du **P10** (vocabulaire officiel partagé). Elle respecte le
**P21** (une seule source de vérité par notion : un code canonique unique), le **P16** (codes
neutres, indépendants de toute technologie), et les **P1/P2** (l'ontologie est une donnée de
référence, pas une connaissance embarquée dans un moteur). Elle sépare `RECOMMANDATION`, `OPTION`
et `NORME` (**P12, P13**) et ne contient **aucun prix** (**P3**).

---

## Compatibilité avec le Plan Directeur

C'est la **MIGRATION 002** prévue (« Vocabulaire / Ontologie + table d'alias »), immédiatement
après le Golden Master. Donnée **passive** : elle prépare le **Port d'Accès au Savoir** (qui
exprimera ses requêtes dans ce vocabulaire), le **Journal** (qui référencera ces objets), les
**moteurs métier** et les **API**, sans qu'aucun ne la consomme encore de façon contraignante.

---

## Compatibilité avec le Golden Master

**Aucun impact.** Cette migration n'ajoute qu'un document de référence ; elle ne touche ni
`calculerDevis`, ni `controlesCoherence`, ni `RecoEngine`, ni aucun fichier exécuté. Le contrat de
non-régression est donc respecté **trivialement** : à entrées identiques, le logiciel produit des
devis, contrôles et recommandations strictement identiques — puisque rien d'exécutable n'a changé.

---

## Recommandations

1. **Figer d'abord le socle des familles** (les ~30 codes canoniques ci-dessus) et le traiter
   comme immuable ; n'étendre que par spécialisation et par alias.
2. **Compléter la table d'alias progressivement**, code catalogue par code catalogue, sans jamais
   remplacer les identifiants V1.5 pendant la migration (compatibilité permanente).
3. **Interdire explicitement les synonymes listés** dans toute nouvelle contribution (humaine ou
   IA) : une seule façon de nommer chaque notion.
4. **Nommer un responsable de l'ontologie** (gouvernance des ajouts et dépréciations).
5. **Ne rien migrer d'exécutable** tant que l'ontologie n'est pas adoptée comme référence par la
   première couture (le Port, MIGRATION suivante).

---

## Conclusion

Cette ontologie constitue le **langage officiel unique de DSBAT** : un mot par notion, des
familles stables qui se spécialisent, des alias qui assurent la compatibilité avec la V1.5, et des
règles d'évolution qui garantissent que ce langage tiendra dix ans. Elle ne change rien au
fonctionnement du logiciel aujourd'hui — c'est précisément sa force : elle installe la **langue
commune** sur laquelle s'appuieront, sans ambiguïté, toutes les migrations et tous les composants
à venir.

*— Ontologie DSBAT, produite par la MIGRATION 002. Langage officiel du projet.*
