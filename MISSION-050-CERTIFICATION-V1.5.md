# MISSION 050 — Certification de l'architecture V1.5

**Date : 2026-07-31 · Périmètre : audit + nettoyage strict, aucune règle / aucun calcul / aucun prix / aucune interface modifiés.**

Objectif : déterminer si l'architecture est désormais assez propre pour reprendre le développement fonctionnel (V2). Aucune fonctionnalité nouvelle proposée.

---

## Nettoyage effectué

Une seule action, la seule réellement nécessaire : retrait de la balise `<script src="js/moteur-recommandations.js"></script>` de `devis-configurateur.html`. Ce script chargeait un moteur de règles générique (`analyser`, `contexteDepuisApp`, `enregistrerRegle`, `rendreHTML`) qui n'était **appelé nulle part** dans l'application — vérifié par recherche exhaustive (0 occurrence fonctionnelle dans tout le dépôt). Il était donc chargé à chaque ouverture de la page sans jamais servir. Le fichier lui-même est **conservé** sur le disque (aucune suppression de fichier), seul son chargement mort a été retiré.

Aucun autre nettoyage n'était nécessaire : les vérifications ci-dessous ont confirmé que le reste de l'architecture était déjà conforme, donc rien n'a été modifié inutilement.

## Code supprimé

Aucun. Aucune fonction, aucune ligne de logique métier / calcul / prix / interface n'a été supprimée ou déplacée. Les couches issues des missions 046→049 étaient déjà en place et vérifiées identiques au comportement d'origine.

## Scripts supprimés

`js/moteur-recommandations.js` — retiré du chargement HTML uniquement (fichier gardé). C'était le seul script mort. Tous les autres scripts sont chargés une seule fois, dans le bon ordre, et réellement utilisés (aucun doublon : la « 2ᵉ » mention de `moteur-devis.js` à la ligne ~2638 est un simple commentaire, pas une balise).

## Dépendances restantes

Ordre de chargement final (sain, sans doublon, sans import mort) :

1. `config.js`
2. `prix.js` — catalogue `PRIX` + `*_PARAMS` + moteurs de dimensionnement logement (`dimensionnementTableau/VMC/Plomberie/Chauffage/Isolation`) + `prixElec` / `prixPlomberie` / `coefZone`
3. `js/pricing.js` — accesseurs catalogue purs (`getPrixPrestFor`, `getMoyenPrixFor`, `tempsUnitaire`, `findPrestLabel`)
4. `js/moteur-devis.js` — orchestrateur `calculerDevis`
5. `js/moteur-piece.js` — calcul pur `calculerPiece`
6. `menu.js`
7. `js/moteurs/{electricite, plomberie, peinture, sols, carrelage, isolation, chauffage, vmc, menuiserie}.js` — logique métier par pièce (getXxxPourPiece, evaluationSupportXxx, controlesOublisXxx, verifierXxx)
8. `js/coherence.js` — `controlesCoherence` / `verifierCoherenceGlobale`

Chaîne de dépendances : `moteurs/*` et `moteur-piece` s'appuient sur `pricing` + `prix` ; `coherence` s'appuie sur les `verifierXxx` des `moteurs/*` ; `moteur-devis` orchestre en s'appuyant sur `prix` (dimensionnements) et le modèle des pièces. Résolution en portée globale partagée (scripts classiques), lue à l'appel — l'ordre est donc robuste.

## Points volontairement conservés

- **`js/moteur-recommandations.js` (fichier) est gardé** : inutilisé aujourd'hui mais non destructeur ; sa suppression physique n'était pas nécessaire à la propreté de l'architecture et sort du strict périmètre.
- **`recalcPiece` dans le HTML** reste une fine enveloppe de liaison DOM (lecture des `<select>` → modèle pièce, appel `calculerPiece`, affichage). C'est sa juste responsabilité : elle ne contient aucun calcul, elle relie l'interface au moteur pur. Conservée telle quelle.
- **Fonctions d'affichage dans le HTML** (`renderPhase3`, `afficherCoherence`, `formatEuro`, `construireRecapTexte`, `genererPDFConfig`, oublis render/handlers…) : correctement laissées côté HTML — c'est la couche présentation, elle a le droit de toucher au DOM.
- **Effets de bord `window.__xxxAuto`** (tableau, VMC, plomberie, chauffage, ballon) entre `calculerDevis` et les moteurs d'explication : conservés à l'identique, ils font partie du contrat existant. Aucune interface modifiée.

## Vérifications réalisées

1. **Chargement des scripts** : un seul chargement par script, ordre cohérent, aucune balise en double, aucun import mort restant (le seul, `moteur-recommandations`, a été retiré).
2. **Code mort** : `moteur-recommandations.js` = 0 usage fonctionnel confirmé → chargement retiré. Aucun autre code mort détecté.
3. **Responsabilités** : recherche confirmant que **toute** la logique métier / calcul / cohérence / catalogue est **hors du HTML** — 0 occurrence dans `devis-configurateur.html` de `getElecPourPiece`, `normeMin`, `recoDSBAT`, `calculerPiece`, `verifierCoherenceGlobale`, `controlesCoherence`, `getMoyenPrixFor`, `getPrixPrestFor`, `dimensionnementTableau`, `dimensionnementChauffage`.
4. **Pureté DOM des modules** : 0 accès DOM réel dans tous les fichiers `js/` (les rares correspondances `.value` étaient des faux positifs de `Object.values(PRIX)`).
5. **Orchestrateur** : `moteur-devis.js` est un pur orchestrateur — 0 appel à `getMoyenPrixFor` (il somme `piece.totalHT` déjà calculés) et se contente d'appeler les dimensionnements logement + TVA/coef/acomptes.
6. **Compatibilité comportementale** : garantie par les comparaisons octet-pour-octet déjà réalisées lors des extractions (046 : 72/72 sorties identiques ; 047 : 25/25 ; 048 : 18/18 alertes ; 049 : 128/128 prix). La seule modification de la mission 050 étant le retrait d'un script **mort et jamais appelé**, le comportement ne peut pas avoir changé.
7. **Certification end-to-end** : chargement de tous les modules + exécution d'un devis complet réaliste (5 pièces, 8 métiers). Résultat : `calculerPiece` → `getMoyenPrixFor` → `verifierCoherenceGlobale` → `calculerDevis` produisent un devis cohérent et complet (Total HT calculé, TVA/TTC, sous-moteurs tableau + chauffage + VMC + plomberie + ballon tous actifs, 13 alertes de cohérence, accesseurs prix opérationnels). HTML re-parsé après nettoyage : valide, 0 occurrence du script retiré.

## État final de l'architecture

Séparation en couches claire et respectée :

- **Catalogue & paramètres** : `prix.js` (données + moteurs de dimensionnement logement).
- **Accès prix** : `js/pricing.js` (accesseurs purs).
- **Métier par pièce** : `js/moteurs/*.js` (un fichier par corps d'état, purs).
- **Calcul pur par pièce** : `js/moteur-piece.js` (`calculerPiece`, aucun DOM).
- **Cohérence** : `js/coherence.js` (purs).
- **Orchestration devis** : `js/moteur-devis.js` (assemble le tout, aucun prix en dur, aucun DOM).
- **Présentation / liaison DOM** : `devis-configurateur.html` (uniquement UI, rendu, PDF, e-mail).

Le HTML ne contient plus aucune logique de calcul, de prix, de règle métier ou de cohérence. Les modules sont testables isolément (chacun a son `module.exports`). Aucun prix en dur nulle part (tout vient de `PRIX` / `*_PARAMS`).

## Recommandation

Reprendre le développement fonctionnel V2 sur cette base. La seule réserve connue est **fonctionnelle, pas architecturale** : le corps d'état Maçonnerie / Démolition reste absent du configurateur. Ce n'est pas un défaut de l'architecture V1.5 (qui est propre) mais un périmètre métier à couvrir en V2 — à traiter comme un nouveau moteur `js/moteurs/maconnerie.js` s'inscrivant naturellement dans la structure existante.

---

## Verdict

# ✅ OUI — l'architecture V1.5 est stable et propre.

**Note d'architecture : 9 / 10.**

Justification : séparation en couches nette et cohérente, HTML entièrement débarrassé de la logique métier/calcul/prix/cohérence, modules purs (0 DOM) et testables isolément, orchestrateur sans prix en dur, chargement de scripts sain et sans doublon, comportement strictement identique à V1 (vérifié). Le point non-parfait n'est pas dans l'architecture livrée mais dans le fichier `moteur-recommandations.js` laissé sur le disque bien qu'inutilisé (chargement retiré, fichier conservé volontairement) — détail cosmétique, sans impact sur la propreté fonctionnelle du code chargé.
