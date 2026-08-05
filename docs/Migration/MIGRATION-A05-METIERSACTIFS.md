# Moteur DSBAT — Phase 2 · MISSION A05 : Suppression de la dépendance globale `metiersActifs`

> Deuxième mission de la Phase 2, dans l'ordre de la feuille de route (dette D3). `metiersActifs`
> devient une **donnée passée explicitement** aux fonctions du module de revêtements, avec repli sur
> la globale (compat). *Aucun calcul, règle, prix, prestation, interface ni devis modifié. Les deux
> Golden Master restent strictement identiques.*

---

## Analyse de `metiersActifs`

`metiersActifs` est une **variable globale** (`let` de haut niveau du script inline) listant les
corps d'état actifs. Elle est lue à de nombreux endroits comme un **état ambiant du navigateur**, ce
qui couple les moteurs à cet état et empêche une exécution propre derrière une API.

**Cycle de vie** : initialisée au chargement (depuis `devisMetiers` en sessionStorage, ou tous les
métiers par défaut), lue tout au long des calculs et du rendu, jamais réécrite par les moteurs.

## Cartographie des usages

| Emplacement | Occurrences | Nature |
|-------------|-------------|--------|
| `devis-configurateur.html` | 34 | contrôleur UI + orchestration (`calculerDevis`, rendu) |
| `js/moteur-devis.js` | 6 | `calculerDevis` (lit aussi `piecesSelectionnees`, `chantier`) |
| `js/coherence.js` | 3 | contrôles de cohérence |
| `js/moteurs/*.js` | 1–2 chacun | `getXPourPiece` / `verifier*` (listes UI + contrôles) |
| `js/moteur-recommandations.js` | 1 | `contexteDepuisApp` (via `src.metiersActifs`) |
| `js/moteur-piece.js` | 1 | **déjà paramétré** (`metiers` + repli) — modèle à suivre |
| `js/moteur-revetements.js` | 3 (réels) | **cible de A05** |

## Stratégie retenue

**Additive et progressive**, calquée sur `calculerPiece` (déjà paramétré en M017) :

- Les fonctions de `js/moteur-revetements.js` — `appliquerRevetements()` et `solMateriauxDispo()` —
  reçoivent désormais un **paramètre `metiers`**, avec **repli sur la globale** si absent :
  `metiers = metiers || (typeof metiersActifs !== 'undefined' ? metiersActifs : [])`.
- Les usages internes de la globale sont remplacés par le **paramètre**.
- Les **sites d'appel** de ce module dans le HTML passent désormais `metiersActifs` **explicitement**.

Résultat : le module **peut s'exécuter sans aucun état global** dès lors que l'appelant fournit
`metiers` — tout en restant **100 % compatible** avec le navigateur grâce au repli. On ne touche
**pas** aux parties encore fortement couplées (voir « conservées »).

## Dépendances supprimées

- **`js/moteur-revetements.js`** : les **3 usages durs** de la globale (`solMateriauxDispo` +
  `appliquerRevetements` ×2) sont remplacés par le paramètre `metiers`. La globale n'y subsiste plus
  qu'en **repli** — plus aucune dépendance dure.
- Les **2 sites d'appel** dans le HTML (`appliquerRevetements(...)`, `solMateriauxDispo(...)`) passent
  `metiersActifs` explicitement.

**Preuve** (`tests/golden-master/a05-check.js`, 7 assertions) : `appliquerRevetements` et
`solMateriauxDispo` s'exécutent **sans aucune globale** `metiersActifs` (param explicite), produisent
le bon résultat (sol carrelé posé / non selon `metiers`), et le **repli** donne un résultat **identique**
au paramètre.

## Dépendances conservées

Conservées **volontairement** (prudence — parties fortement couplées ou relevant d'une mission
ultérieure) :

- **`calculerDevis`** (`moteur-devis.js`) : lit `metiersActifs` **et** `piecesSelectionnees` **et**
  `chantier`. C'est un enjeu de **Modèle du Projet** (mission **A08**) ; le paramétrer isolément
  maintenant serait invasif pour peu de gain.
- **`coherence.js`, `moteurs/*.js`** : fonctions de listes UI et de contrôles, couplées à la
  configuration ; migration progressive ultérieure.
- **`moteur-recommandations.js`** : reçoit déjà `metiersActifs` via l'objet `src`
  (`contexteDepuisApp`) — pas une globale dure.
- **Le contrôleur HTML** (34 usages) : couche interface, traitée avec `ui.js` / Modèle du Projet plus
  tard.

## Validation Golden Master

```
node a05-check.js                  → ✅ 7 assertions OK (module sans globale + repli identique)
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
node golden-master.js verify       → ✅ Golden Master IDENTIQUE — aucune régression
node carrelage / peinture / sols   → ✅ tous identiques
syntaxe module + inline HTML       → 0 erreur
```

`metiersActifs` ne subsiste dans `moteur-revetements.js` que sous forme de **repli** ; les deux Golden
Master (devis + par pièce) sont identiques ; aucun comportement modifié.

## Compatibilité avec la Constitution

**P2** (moteur rendu autonome de l'état global), **P3** (aucun prix touché), **P7** (responsabilité
claire : `metiers` en entrée), **P16** (indépendance vis-à-vis du navigateur — un module exécutable
sans état ambiant), **P17/P21** (déterminisme vérifié ; logique déplacée, non réécrite).

## Compatibilité avec le Plan Directeur / Feuille de route

C'est **exactement la mission A05**, réalisée **dans l'ordre**, avec le critère annoncé (les **deux**
Golden Master identiques). Approche **additive et progressive** conforme à la consigne (« ne pas tout
modifier si certaines parties restent fortement couplées »).

## Compatibilité avec la Charte

**Additive** (param optionnel + repli), **réversible** (retirer le param restaure l'état),
**testable** (preuve A05 + deux Golden Master), **documentée**. Aucune logique de calcul déplacée.

---

## Préparation de A06

**A06** (dette D4) : remplacer les effets de bord **`window.__*`** (×9, posés par `calculerDevis` et
lus par les moteurs d'explication et les observateurs) par la consommation directe de l'**objet
retourné** par `calculerDevis` (qui contient déjà `tableau`, `vmc`, `ballon`, `chauffage`,
`plomberie`…). Cela supprimera un canal de communication global caché, dans la continuité de A05.
Ensuite, **A08** formalisera le **Modèle du Projet**, ce qui permettra de paramétrer `calculerDevis`
et les derniers lecteurs de `metiersActifs`.

## Conclusion

`metiersActifs` n'est plus une **dépendance dure** du module de revêtements : `appliquerRevetements`
et `solMateriauxDispo` reçoivent `metiers` en paramètre et savent s'exécuter **sans état global** —
prouvé par un test dédié —, tout en restant compatibles avec le navigateur via un repli. Les deux
Golden Master sont identiques. C'est un pas net vers l'**indépendance du Moteur DSBAT vis-à-vis du
navigateur**, et donc vers sa future **exécution derrière une API**. Avancée prudente, additive et
entièrement réversible.

*— MISSION A05 : le module de revêtements ne dépend plus de l'état global.*
