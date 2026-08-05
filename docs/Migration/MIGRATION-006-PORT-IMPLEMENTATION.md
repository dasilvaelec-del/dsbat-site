# Moteur DSBAT — MIGRATION 006 : Première implémentation du Port d'Accès au Savoir

> **Première migration d'architecture dans le code.** Crée la **façade** du Port en lecture seule
> au-dessus des sources de savoir existantes, **sans la brancher** à aucun moteur. *Aucun calcul,
> règle, prix, interface, devis, recommandation ni contrôle modifié. Golden Master intégralement
> valide.*

---

## Analyse de l'existant

Le savoir du logiciel est aujourd'hui accessible par **accès directs** à deux sources :

- **`normes.js`** → l'objet `NORMES` (normes NF/DTU/RE2020 par métier, `{ ref, description }`).
- **`js/moteur-recommandations.js`** → `RecoEngine` (les règles de recommandation ; métadonnées
  exposées par `listerRegles()` : `id`, `categorie`, `tags`).

D'autres « savoirs » restent **imbriqués dans le calcul** (minimums NF C 15-100 et implications
métier dans `calculerDevis`/`prix.js`, `tauxTVA` dans le HTML). Il n'existait aucun **point
d'entrée unique** : chaque futur consommateur devait connaître ces sources.

---

## Architecture retenue

Un **port hexagonal** : une façade qui **reçoit ses sources par injection** et expose un petit
contrat de requêtes en lecture seule. Le magasin réel (aujourd'hui `NORMES` + `RecoEngine`, demain
le Référentiel, ou le référentiel d'une franchise) peut être remplacé **sans toucher aux
consommateurs**. Un repli optionnel lit les globales du navigateur si rien n'est injecté.

Le Port **normalise la forme** des connaissances (identifiant, famille, métiers, justification,
source, version, état) même quand la source V1.5 n'a pas encore de version — en marquant
honnêtement l'origine (`V1.5`, `v0`, `actif`) sans inventer de donnée.

---

## Description du Port

Contrat de requêtes (intentions stables, conformes à MIGRATION 003) :

| Intention | Rôle |
|-----------|------|
| `obtenirFiche(identifiant)` | une fiche par identifiant pérenne |
| `listerFichesCandidates(descripteur)` | fiches **candidates** par périmètre déclaré (famille / métier / tags) — **jamais** d'évaluation de condition |
| `obtenirReferences(identifiant)` | références officielles d'une fiche |
| `obtenirVersion(identifiant)` | version / état / date d'entrée en vigueur |
| `obtenirCliche(date)` | cliché courant (versionnement historique pas encore disponible) |

Invariants **vérifiés par test** (`tests/golden-master/port-check.js`, 15 assertions) : le Port et
ses fiches sont **figés** (lecture seule) ; il n'expose **ni** `analyser`, **ni** `calculer`, **ni**
`appliquer` ; **aucune** fiche ne porte de prix ; et il **ne modifie pas** les sources (empreintes
de `NORMES` et nombre de règles inchangés avant/après).

---

## Accès encapsulés

- **Les normes** (`NORMES` de `normes.js`) → exposées comme fiches `NORME` (27 fiches).
- **Les recommandations** (`RecoEngine.listerRegles()`) → exposées comme fiches `RECOMMANDATION`
  (16 fiches), en **métadonnées seules** (id/catégorie/tags) : le Port ne déclenche jamais
  l'évaluation d'une règle.

Total : **43 fiches** accessibles par un point d'entrée unique.

---

## Accès restant à migrer

- **Règles métier imbriquées dans le calcul** (`calculerDevis`, sous-moteurs de `prix.js`) :
  minimums NF C 15-100, implications « douche italienne → besoins plomberie », etc. → **restent
  directs** car les extraire toucherait au calcul (interdit ici) ; ce sera une migration ultérieure,
  fiche par fiche, via le Moteur de Décision, en comparaison miroir.
- **`tauxTVA`** (dans le HTML) : c'est une règle, candidate à une micro-extraction, mais hors savoir
  « référentiel » ; laissée directe pour l'instant.
- **Catalogue `PRIX`** : ce **n'est pas** du savoir (ce sont des prix) → **jamais** dans le Port
  (Constitution P3). Il reste dans la couche Catalogue.
- **Options** : aucune source d'options n'existe encore ; le Port n'en expose donc pas (honnête).

Pourquoi ces accès restent directs : les migrer maintenant modifierait le comportement, ce que la
mission et la Charte interdisent. Ils suivront, un par un, chacun validé « Golden Master identique ».

---

## Fichiers concernés

- **Créés** : `js/port-savoir.js` (la façade), `tests/golden-master/port-check.js` (les invariants).
- **Lus, jamais modifiés** : `normes.js`, `js/moteur-recommandations.js`.
- **Non touchés** : `calculerDevis`, `coherence.js`, `prix.js`, le HTML, les pages.

> `js/port-savoir.js` **n'est chargé par aucune page** : il est totalement inerte côté navigateur.
> C'est ce qui garantit la transparence pour l'utilisateur.

---

## Validation Golden Master

```
node port-check.js            → ✅ Port : 15 assertions OK, 0 échec
node golden-master.js verify  → ✅ Golden Master IDENTIQUE — aucune régression
```

Au niveau du dépôt : `git status` ne montre **aucun fichier modifié** — uniquement des fichiers
**nouveaux**. Les fichiers du site sont inchangés au bit près : **mêmes prestations, quantités,
prix, recommandations, contrôles, devis. Aucune régression.**

---

## Compatibilité avec la Constitution

Application directe du **P6** (point d'entrée unique vers le savoir). Respect du **P1/P2** (le savoir
reste dans ses sources ; le Port ne les contient pas, il les lit), **P3** (aucun prix), **P7**
(responsabilité unique : fournir, jamais décider ni calculer — vérifié), **P16** (façade neutre,
injectable), **P21** (une seule porte ; sources non recopiées, lues à la demande). La frontière
« candidates ≠ appliquées » empêche le Port d'empiéter sur le Moteur de Décision.

## Compatibilité avec le Plan Directeur

C'est l'étape **« Port de lecture en simple relais »** : introduit **sans consommateur
contraignant**, il prépare les migrations suivantes sans en imposer aucune. Jalon franchi, critère
« Golden Master identique » respecté.

## Compatibilité avec la Charte

Migration **additive** (deux fichiers neufs), **réversible** (les supprimer laisse la V1.5 intacte),
**testable** (invariants + Golden Master), **documentée**. Un seul composant nouveau, à
responsabilité unique. Aucune règle déplacée.

---

## Préparation de la Migration 007

Le Port existant mais non branché, la suite naturelle est d'**introduire un premier consommateur en
lecture**, en miroir et à sortie identique — deux options :

1. **Journal de Décision passif** (brique D) : l'installer en observateur, enregistrant le
   raisonnement déjà à l'œuvre, sans rien changer — préparé de pair avec le Port (versions de fiches).
2. **Premier branchement de lecture** : router l'affichage des normes (page engagements) via le
   Port, à rendu strictement identique, pour valider le Port « en situation » sans risque de calcul.

Recommandation : commencer par le **Journal passif** (risque nul, prépare la confiance et les
explications), puis brancher progressivement des lectures sur le Port.

---

## Conclusion

Le Port d'Accès au Savoir a sa **première implémentation réelle** : une façade unique, en lecture
seule, figée, qui expose 43 fiches (normes + recommandations) sans décider, sans calculer, sans
modifier aucune connaissance — et **sans être encore branchée**, donc totalement transparente. Le
Golden Master reste intégralement valide. La première brique d'architecture est entrée dans le code,
exactement comme le prévoit le Plan Directeur : par une couture, à comportement inchangé.

*— MIGRATION 006 : Port d'Accès au Savoir (façade). Première couture d'architecture dans le code.*
