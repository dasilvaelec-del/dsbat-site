# Moteur DSBAT — Phase 2 · MISSION A07 : Découplage des recommandations / oublis de leur rendu HTML

> Quatrième mission de la Phase 2, dans l'ordre de la feuille de route (dette **D1**). Les fonctions
> de recommandations et d'oublis produisent une **donnée métier** (le domaine) distincte de sa
> **représentation HTML** (l'adaptateur). Le domaine, déjà largement modularisé dans `js/moteurs/*.js`,
> est mis **sous filet Golden Master** ; le dernier résidu de logique métier encore inline
> (`recoSupportSolHtml`) est **extrait** dans son module. *Aucun calcul, règle, prix, prestation,
> interface visible ni devis modifié. Les deux Golden Master restent strictement identiques et la
> sortie HTML est byte-identique.*

---

## Analyse des fonctions

Le configurateur expose **14 fonctions de rendu** `recoSupport*Html()` / `oublis*Html()` (une paire
par corps d'état) : elles construisent les encarts « Recommandation DS.BAT » et « Pensez à… »
affichés sous chaque pièce.

| Fonction de rendu (HTML) | Fonction domaine appelée (module) | Statut avant A07 |
|--------------------------|-----------------------------------|------------------|
| `recoSupportPloHtml` / `oublisPloHtml` | `evaluationSupportPlo` / `controlesOublisPlo` | adaptateur pur |
| `recoSupportCarrHtml` / `oublisCarrHtml` | `evaluationSupportCarr` / `controlesOublisCarr` | adaptateur pur |
| `recoSupportIsoHtml` / `oublisIsoHtml` | `evaluationSupportIso` / `controlesOublisIso` | adaptateur pur |
| `recoSupportMenHtml` / `oublisMenHtml` | `evaluationSupportMen` / `controlesOublisMen` | adaptateur pur |
| `recoSupportVmcHtml` / `oublisVmcHtml` | `evaluationSupportVmc` / `controlesOublisVmc` | adaptateur pur |
| `recoSupportHtml` / `oublisPeintureHtml` | `evaluationSupport` / `controlesOublisPeinture` | adaptateur pur |
| `oublisSolHtml` | `controlesOublisSol` | adaptateur pur |
| **`recoSupportSolHtml`** | `evaluationSupportSol` **+ logique inline** | **domaine résiduel** |

**Constat** : le gros du travail a déjà été fait aux missions 046/047, qui ont extrait dans
`js/moteurs/*.js` les fonctions `evaluationSupport*`, `controlesOublis*` et `controlesInfo*`
(retournant des **données** : tableaux de messages, `{ragreageConseille, raisons}`…). **13 des 14**
fonctions `*Html` n'étaient donc déjà que des **adaptateurs** appelant leur fonction domaine puis
enrobant le résultat de HTML. **Une seule** conservait une décision métier inline :
`recoSupportSolHtml` calculait elle-même la recommandation « sous-couche sous sol flottant ».

## Séparation Domaine / Présentation

Le principe appliqué, corps d'état par corps d'état :

- **Domaine (production de l'information métier)** — *quelles* recommandations / *quels* oublis
  s'appliquent, et leur libellé. Vit dans `js/moteurs/*.js`, sans aucune balise de mise en page
  (`<div>`, styles, icône). Fonctions pures, exécutables sans navigateur, déterministes.
- **Présentation (représentation HTML)** — l'encart visuel : wrapper `<div>` « Recommandation
  DS.BAT : … » / « Pensez à… », styles, `join(' · ')`. Reste dans `devis-configurateur.html`, et se
  contente d'appeler la fonction domaine puis d'habiller la liste retournée.

Pour `recoSupportSolHtml`, la décision inline (ragréage si support plan non déjà prévu ; sous-couche
si sol flottant non retenue) a été **déplacée verbatim** vers une nouvelle fonction domaine
`recommandationsSol(piece, chantier)` ; l'adaptateur ne conserve que le rendu de l'encart.

## Modules créés

- **`js/moteurs/sols.js` → `recommandationsSol(piece, chantier)`** *(nouveau)* : retourne la **liste
  des messages** de recommandation de support pour une pièce (donnée), extraite mot pour mot de
  l'ancien `recoSupportSolHtml`. S'appuie sur `evaluationSupportSol` (ragréage) et sur la règle sol
  flottant → sous-couche. Aucun prix, aucun code catalogue. Exportée pour les tests Node.
- **`tests/golden-master/reco-oublis-domain-golden.js` + `reference-reco-oublis.json`** *(nouveau
  filet)* : Golden Master dédié au **domaine reco/oublis**. Capture la sortie **donnée** des 16
  fonctions domaine (`evaluationSupport*`, `controlesOublis*`, `controlesInfo*`) sur 10 pièces
  représentatives (après calcul des surfaces / revêtements, comme en réel), avec tri de clés stable
  et comparaison JSON byte-à-byte. Rend cette logique **observable et testable**, conformément à
  l'objectif de la mission.

## Dépendances supprimées

- **`recoSupportSolHtml` ne contient plus aucune décision métier** : les branches ragréage /
  sous-couche (lecture de `evaluationSupportSol`, `piece.config.sols`, `piece.solType`,
  `piece.solSousCouche`) sont retirées du HTML et centralisées dans `recommandationsSol`. La fonction
  de rendu ne dépend plus que d'une **seule** entrée métier : la liste renvoyée par le module.

**Preuve** : la sortie de `recoSupportSolHtml` est **byte-identique avant / après** extraction sur
les 10 pièces (capture réalisée sur la version d'origine, comparée à la version adaptateur). Le
Golden Master du domaine reco/oublis est déterministe (deux `verify` consécutifs identiques).

## Dépendances conservées

Conservées **volontairement**, par prudence :

- **Les 13 autres fonctions `*Html`** : déjà de simples adaptateurs — aucune raison de les toucher.
  Elles restent inline dans le configurateur (couche présentation), appelant leur fonction domaine.
- **L'enrobage HTML** (`<div>`, styles, icône 💡, `join(' · ')`) : c'est la **présentation** ; il
  reste dans le HTML, non couvert par le Golden Master (rendu). Le déplacer serait hors périmètre.
- **Les libellés à emphase (`<strong>…</strong>`) dans les messages** : conservés **verbatim** dans
  la donnée pour garantir une sortie strictement identique. Leur purification éventuelle (donnée
  sémantique pure + emphase ajoutée par l'adaptateur) relève d'un raffinement ultérieur, plus risqué
  pour l'identité de rendu — non entrepris ici.
- **Le branchement Port / Journal des reco/oublis** : les moteurs concernés exposent déjà leurs
  fiches `REGLE_METIER` au Port et journalisent leur raisonnement (missions M018/M019 : sols 3 règles
  / 5 évts, carrelage 4 règles / 5 évts, **0 prix / 0 code** au Journal). Étendre cette observation à
  l'ensemble des reco/oublis se fera avec le branchement du Journal aux explications (mission **A11**).

## Validation Golden Master

```
node reco-oublis-domain-golden.js verify → ✅ domaine reco/oublis IDENTIQUE (10 cas, déterministe)
recoSupportSolHtml avant/après           → ✅ byte-identique (10 cas)
node golden-master.js verify             → ✅ Golden Master IDENTIQUE — aucune régression
node piece-golden-master.js verify       → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
node sols-migration-check.js             → ✅ 9 assertions OK (sol 1110.06 € HT inchangé)
node carrelage-migration-check.js        → ✅ 11 assertions OK (sol 12 m² + faïence 2.4 m² inchangé)
node --check js/moteurs/sols.js          → ✅ syntaxe OK ; recoSupportSolHtml évalue sans erreur
```

Les deux Golden Master (devis + par pièce) sont identiques, la sortie HTML des recommandations est
byte-identique, et le domaine est désormais protégé par son propre filet.

## Compatibilité avec la Constitution

**P1/P2** (le savoir métier vit au module, séparé du navigateur), **P3** (aucun prix touché ; le
Journal reste sans prix ni code), **P6** (fiches exposées au Port inchangées), **P7** (responsabilité
unique : le domaine décide, l'adaptateur affiche), **P16** (indépendance technique : les décisions
reco/oublis s'exécutent sans DOM), **P17/P21** (déterminisme vérifié ; logique **déplacée verbatim**,
non réécrite ; source unique de la décision sol).

## Compatibilité avec le Plan Directeur / Feuille de route

C'est **exactement la mission A07** (dette **D1** : reco/oublis fondus dans le HTML), réalisée **dans
l'ordre**, avec le critère annoncé (les **deux** Golden Master identiques). Approche **additive et
progressive** : on sécurise d'abord le domaine sous filet, puis on extrait le seul résidu inline, sans
toucher aux 13 adaptateurs déjà propres ni au rendu.

## Compatibilité avec la Charte

**Additive** (`recommandationsSol` ajoutée + nouveau Golden Master ; aucune suppression de
comportement), **réversible** (réinsérer la logique dans `recoSupportSolHtml` restaurerait l'état
exact), **testable** (filet domaine + preuve d'identité HTML + deux Golden Master), **documentée**.
Aucune logique de calcul modifiée.

---

## Préparation de A08

**A08** (Modèle du Projet) : formaliser un objet **Projet** (chantier + pièces + métiers) porté
explicitement, plutôt que via les globales `piecesSelectionnees` / `chantier` / `metiersActifs`. Le
découplage domaine/présentation acté ici rend les producteurs d'information (reco/oublis, évaluations)
prêts à recevoir ce Modèle en entrée, et le filet Golden Master du domaine garantira l'absence de
régression lors de ce reparamétrage. Cela ouvrira ensuite l'Orchestrateur (**A09**) puis l'exposition
API (**A10**).

## Conclusion

Les recommandations et les oublis produisent désormais une **donnée métier** clairement séparée de
leur **rendu HTML** : 13 des 14 fonctions `*Html` étaient déjà de simples adaptateurs, et le dernier
résidu inline (`recoSupportSolHtml`) a été extrait dans `recommandationsSol`, au module. L'ensemble du
domaine reco/oublis est mis **sous filet Golden Master**, ce qui le rend observable et testable — tout
en garantissant une sortie **byte-identique**. Les deux Golden Master restent identiques. Le Moteur
DSBAT se rapproche d'une production d'information **indépendante du rendu**, prête à être exposée
**derrière une API**. Avancée prudente, additive et entièrement réversible.

*— MISSION A07 : les recommandations décident au module, le HTML se contente d'afficher.*
