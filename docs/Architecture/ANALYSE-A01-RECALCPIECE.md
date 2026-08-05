# Moteur DSBAT — ANALYSE A01 : recalcPiece()

> **Analyse d'architecture. Aucun code, aucune modification du logiciel.** Objectif : comprendre le
> cœur du configurateur par pièce et préparer les prochaines migrations.

---

## Vue d'ensemble de recalcPiece()

`recalcPiece(index)` (dans `devis-configurateur.html`, ~142 lignes) est déclenchée **après chaque
modification** de l'utilisateur sur une pièce (quantité, pose, gamme, revêtement…). Elle met à jour
la pièce et son affichage.

**Découverte majeure** : contrairement à ce que l'on pouvait craindre, `recalcPiece` **ne contient
plus le calcul métier**. Une migration antérieure (MISSION 047) a déjà **extrait le calcul pur** dans
un module dédié, `js/moteur-piece.js` → `calculerPiece(piece, chantier, metiers)`, qui **n'accède
jamais au DOM** (vérifié : 0 `getElementById`). De même, `appliquerRevetements(piece, surfaces)` (encore
dans le HTML) est **pure** (0 DOM).

`recalcPiece` est donc aujourd'hui, pour l'essentiel, un **contrôleur d'interface** :

```
recalcPiece(index) :
  1. LIRE le DOM      → mémoriser les choix sur la pièce (gammes peinture/sols/faïence)
  2. SYNCHRONISER élec → appliquerNorme + syncElecDOM (DOM)
  3. CALCULER (pur)   → calculerPiece(...) + appliquerRevetements(...)   ← aucun DOM
  4. ÉCRIRE le DOM    → surfaces, sous-couche, reco/oublis par métier, totaux, onglet
  5. PERSISTER        → saveEtat()
```

La structure « lire → calculer → afficher » est déjà celle d'un contrôleur MVC — le plus dur est
donc **déjà fait**.

---

## Cartographie des responsabilités

| Bloc | Nature | Où |
|------|--------|-----|
| Lecture des gammes (peinture/sols/faïence) et persistance sur la pièce | **Interface → Modèle** | recalcPiece (HTML) |
| `appliquerNorme` + `syncElecDOM` | **Interface** (sync DOM) | HTML |
| `calculerPiece(...)` | **Calcul pur (métier)** | `js/moteur-piece.js` |
| `appliquerRevetements(...)` | **Calcul pur (métier)** | HTML (pur) |
| Affichage surfaces, sous-couche, totaux, onglet | **Interface** | recalcPiece (HTML) |
| `recoSupport*Html`, `oublis*Html` (par métier) | **Métier + Présentation MÉLANGÉS** | HTML |
| `updateSectionTotals` | **Interface** (écrit le DOM) | HTML |
| `saveEtat()` | **Persistance** | HTML |

---

## Dépendances

**Entrantes** (qui appelle `recalcPiece`) : les gestionnaires d'événements de l'interface —
`changerQty`, `setElecMethode`, `setElecGamme`, `setPloGamme`, et les changements de configuration
par pièce. Elle est rappelée à chaque interaction.

**Sortantes** :
- **Calcul (métier)** : `calculerPiece` (moteur-piece.js), `appliquerRevetements` (pur).
- **Synchronisation DOM** : `appliquerNorme`, `syncElecDOM`, `updateSectionTotals`.
- **Affichage** : `setSurf`, une quinzaine de `innerHTML`/`textContent` (surfaces, sous-couche,
  `recoSupport*Html` et `oublis*Html` pour peinture/sols/carrelage/isolation/menuiserie/plomberie/vmc,
  estimation faïence, total pièce, onglet), `formatEuro`, `getMoyenPrixFor` (pour l'estimation faïence).
- **Persistance** : `saveEtat()` (sessionStorage).

**Appels aux moteurs métier** : `calculerPiece` (qui, à l'appel, résout `getMoyenPrixFor`,
`quantitesPeinture`, `detectionSousCouche`, `SOLS_PARAMS`) et `appliquerRevetements`.

**Appels d'affichage** : nombreux (voir ci-dessus), tous localisés dans les blocs 4 de la fonction.

---

## Mélanges de responsabilités identifiés

Le calcul métier **n'est plus mélangé** (il est isolé dans `calculerPiece`). Restent deux mélanges :

1. **Contrôleur read→calc→write** dans `recalcPiece` : normal pour un contrôleur, mais encore logé
   dans le HTML (pas dans un `ui.js`).
2. **Reco/oublis : métier + présentation fondus.** Les fonctions `recoSupport*Html(piece)` et
   `oublis*Html(index)` **calculent une recommandation / un contrôle** (domaine) **et** renvoient du
   **HTML** (présentation) en un seul geste. C'est le vrai reliquat de mélange — et le prochain
   candidat au découplage (séparer « donnée » et « rendu »).

---

## Ce qui relève du moteur

- `calculerPiece` (surfaces, quantités, peinture/sols auto, temps, `piece.totalHT`) — **déjà module**.
- `appliquerRevetements` (quantités de sol carrelé / faïence) — **pur, mais encore dans le HTML**.
- La **part domaine** des `recoSupport*Html` / `oublis*Html` (quelle recommandation, quel oubli) —
  actuellement noyée dans la génération HTML.

## Ce qui relève de l'interface

- Toutes les lectures/écritures DOM (gammes lues, surfaces/totaux/onglet affichés, HTML injecté).
- `appliquerNorme` + `syncElecDOM` (synchronisation visuelle des minimums élec).
- L'orchestration read→calc→write et le déclenchement de `saveEtat()`.

## Ce qui pourrait être extrait

1. **`appliquerRevetements`** → module (ex. `js/moteur-piece.js` ou `js/moteur-revetements.js`). Pur,
   petit, faible risque.
2. **La part domaine des reco/oublis** → séparer chaque `recoSupport*Html`/`oublis*Html` en une
   fonction **domaine** (retourne une donnée : recommandation/oubli) + une fonction **rendu**
   (retourne le HTML). La partie domaine pourra alors passer par le **Port** et le **Journal**, comme
   les autres moteurs.
3. **Le contrôleur `recalcPiece`** lui-même → à terme, un `ui.js` (étape cosmétique, différée).

## Ce qui doit rester

- Les **accès DOM** (lecture des gammes, affichage) : ils appartiennent à la couche interface.
- La **synchronisation élec** (`syncElecDOM`, `appliquerNorme`) : couplée à l'affichage.
- Le **déclenchement de `saveEtat()`** : orchestration de persistance, au niveau du contrôleur.
- L'**enchaînement en deux passes** (`calculerPiece` → `appliquerRevetements` → `calculerPiece`) :
  sémantique de calcul à préserver telle quelle.

---

## Proposition de découpage progressif

- **Étape 1 — Étendre le Golden Master à `calculerPiece`** *(prérequis absolu)*. Aujourd'hui, le
  Golden Master traite `piece.totalHT` comme une **entrée figée** (limite assumée de la MIGRATION
  005) : `calculerPiece` et `appliquerRevetements` **ne sont donc pas encore validés**. Il faut
  d'abord capturer leurs sorties (surfaces, `config`, `totalHT`) sur des cas de référence. Sans ce
  filet, aucune migration par pièce n'est sûre.
- **Étape 2 — Déplacer `appliquerRevetements`** vers un module (pur), validé par le Golden Master
  étendu.
- **Étape 3 — Migrer les métiers « par pièce »** (peinture, sols, carrelage) selon le pattern
  DSBAT : exposer `PEINTURE_PARAMS` / `SOLS_PARAMS` / `CARRELAGE_PARAMS` via le Port + observateurs
  passifs sur `calculerPiece`/`appliquerRevetements`, à résultat identique.
- **Étape 4 — Découpler reco/oublis** : séparer domaine (donnée) et rendu (HTML) ; router la part
  domaine via le Port et le Journal.
- **Étape 5 (différée, cosmétique) — Extraire le contrôleur `recalcPiece`** vers `ui.js`.

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **`calculerPiece` hors Golden Master** | Migration par pièce non gardée | Étendre le Golden Master **d'abord** (étape 1) |
| **Éditer le gros fichier HTML** | Régression involontaire | Privilégier les **déplacements de fonctions pures** vers des modules, additifs |
| **Sémantique en deux passes** du calcul | Écart de quantités revêtements | Préserver l'ordre `calculerPiece → appliquerRevetements → calculerPiece` |
| **Reco/oublis fondus HTML** | Découplage délicat | Séparer domaine/rendu par petits pas, chacun validé |
| **Objet de retour `R`** (calc → affichage) | Couplage implicite | Le figer comme contrat entre `calculerPiece` et le contrôleur |

---

## Recommandations

1. **Ne migrer aucun métier « par pièce » avant d'avoir étendu le Golden Master à `calculerPiece`.**
   C'est la condition de sûreté n°1.
2. **Laisser `recalcPiece` tel quel** pour l'instant : c'est déjà un contrôleur propre ; son
   extraction vers `ui.js` est cosmétique et peut attendre.
3. **N'extraire que du pur** en priorité (`appliquerRevetements`) — risque minimal, gain immédiat.
4. **Traiter les reco/oublis comme la vraie dette de mélange** : les scinder domaine/rendu ouvrira
   la voie à leur passage par le Port et le Journal.
5. **Capitaliser sur MISSION 047** : le plus dur (isoler le calcul pur) est fait ; la suite est une
   série de petits pas à faible risque.

---

## Préparation des futures migrations

L'ordre logique des prochaines missions se dessine :

- **A02 / MIGRATION 016** — Étendre le Golden Master à `calculerPiece` (+ `appliquerRevetements`).
- **MIGRATION 017** — Déplacer `appliquerRevetements` vers un module.
- **MIGRATION 018–020** — Peinture, Sols, Carrelage (pattern DSBAT, validés par le Golden Master
  étendu).
- **MIGRATION 021** — Découpler reco/oublis (domaine vs rendu).
- **Micro-migration** — Sortir `tauxTVA` du HTML (dette identifiée depuis M005).
- **Plus tard** — Extraire le contrôleur `recalcPiece` vers `ui.js`.

---

## Conclusion

`recalcPiece()` n'est **pas** le nœud inextricable redouté : la MISSION 047 a déjà extrait son cœur
de calcul (`calculerPiece`, module pur), et `recalcPiece` est aujourd'hui un **contrôleur
d'interface** qui lit le DOM, appelle le calcul pur, puis affiche. Les responsabilités sont **déjà
largement séparées** ; il ne reste que deux mélanges — le contrôleur logé dans le HTML (cosmétique)
et les reco/oublis fondant domaine et présentation (vraie dette). La priorité absolue avant toute
migration par pièce est d'**étendre le Golden Master à `calculerPiece`**, aujourd'hui non validé.
Une fois ce filet posé, les métiers par pièce se migreront par petits pas, avec le pattern DSBAT déjà
éprouvé sur six moteurs.

*— ANALYSE A01 : recalcPiece(). Le cœur du calcul est déjà extrait ; reste à étendre le filet.*
