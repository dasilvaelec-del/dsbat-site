# Runtime DSBAT – R05

> **Phase Runtime · Mission R05 — Première bascule contrôlée.** Sur le **plus petit périmètre** (le
> devis), le Runtime produit désormais le résultat **réellement affiché** — mais **uniquement** lorsque
> le feature flag `?moteur=runtime` est activé. Le moteur historique reste disponible en permanence,
> le mode Shadow et le retour arrière immédiat sont conservés. **Aucune modification des moteurs, des
> règles, des calculs ni des prix : le Runtime ne change que le *lieu* d'exécution.** Le Golden Master
> reste la référence absolue.

---

## Objectifs

Passer de l'**observation** (R03/R04) à une **utilisation réelle** du Runtime, de façon minimale et
totalement réversible :

1. Identifier le **plus petit périmètre** exploitable : le **devis global** (`calculerDevis`), qui n'a
   que deux points d'appel (`renderPhase3`, `genererPDFConfig`).
2. Faire produire ce résultat par le **Runtime** quand — et seulement quand — le flag est activé.
3. **Conserver** en permanence : le moteur historique, le mode Shadow, le retour arrière immédiat.
4. **Documenter** les deux parcours, les points de contrôle, les mécanismes de repli.
5. **Journaliser** les premières exécutions réelles (sans prix).

## Architecture de la bascule

Difficulté centrale : le rendu appelle `calculerDevis()` de façon **synchrone**, alors que le Runtime
navigateur est **asynchrone** (fetch). La solution est un **cache d'amorçage** (« prime & serve »),
clé par **empreinte de l'entrée** (A08) :

```
   calculerDevis()  ─▶  SÉLECTEUR (mode runtime)
                            │
                 empreinte(chantier, pièces, métiers)
                            │
                 ┌──────────┴───────────┐
          cache CHAUD ?             cache FROID ?
                │                        │
   SERT le devis Runtime         REPLI historique (immédiat)
   (résultat affiché)            + amorçage Runtime en arrière-plan
                                  (fetch → cache) pour les rendus suivants
```

- **Amorçage** (`amorcer(etat)`) : appelle le Runtime (via l'Orchestrateur/API) en tâche de fond et
  range le devis dans le cache sous l'empreinte de l'entrée.
- **Service** (`calculer(etat)`) : en mode runtime, **sert** le devis Runtime si l'entrée est amorcée
  (résultat réellement affiché) ; sinon **repli** historique instantané + amorçage planifié.
- **Invalidation par empreinte** : dès que l'entrée change, l'empreinte change → cache froid → repli.
  **Jamais** de résultat périmé.
- **Aucun moteur touché** : les sources (historique, Runtime) sont **injectées** ; le sélecteur
  aiguille, l'Orchestrateur reste le point d'entrée du Runtime.

## Parcours historique

Le chemin de référence, **inchangé** et toujours disponible :

1. `renderPhase3` / `genererPDFConfig` appellent `calculerDevis()`.
2. En mode `historique` (défaut), `arret`, ou en **repli**, le sélecteur exécute le **moteur local**
   (`prix.js` + `js/moteur-*.js`), exactement comme aujourd'hui.
3. Le devis local est affiché.

Par défaut (aucun flag), `calculerDevis` **n'est même pas enveloppé** : comportement strictement
identique.

## Parcours Runtime

Activé par `?moteur=runtime` (ou `localStorage 'dsbat_moteur'='runtime'`) :

1. `calculerDevis()` est routé par le sélecteur.
2. Le sélecteur calcule l'**empreinte** de l'entrée courante (chantier + pièces + métiers).
3. **Cache chaud** → le devis **Runtime** (calculé côté serveur via `POST /v1/projets/calcul` →
   Orchestrateur → moteurs) est **servi et affiché**.
4. **Cache froid** → **repli** historique immédiat (le service n'est jamais interrompu) **et**
   amorçage Runtime en arrière-plan, de sorte que le **prochain** rendu (ré-affichage après saisie des
   coordonnées, génération du PDF…) soit servi par le Runtime.
5. Le résultat Runtime est **byte-identique** à l'historique (le Runtime ne change que le *lieu*
   d'exécution) — prouvé sur tous les cas.

## Gestion des erreurs

Le service n'est **jamais** interrompu :

- **Runtime injoignable / 5xx / timeout** → l'amorçage échoue silencieusement → le cache reste froid →
  **repli** historique. Compté comme *erreur d'observation* + *repli*, jamais propagé à l'UI.
- **Réponse invalide / non conforme** → rejetée par le client, repli historique.
- **Exception imprévue dans le wrapper** → **ultime repli** sur l'original (`try/catch` englobant).
- **Entrée modifiée** → empreinte différente → repli, jamais de devis périmé affiché.

## Retour arrière

Immédiat, à quatre niveaux :

1. **Explicite** : `__moteurDSBAT.retourArriere()` (ou `setMode('historique')`) → historique instantané,
   le cache est ignoré.
2. **Coupe-circuit** : `setMode('arret')`.
3. **Par le flag** : retirer `?moteur=runtime` / la clé `localStorage`.
4. **Automatique** : tout échec Runtime → repli historique **sans** intervention.

Le moteur historique reste chargé et disponible **en permanence** : le retour arrière ne dépend
d'aucun redéploiement.

## Journalisation

Chaque exécution réelle est journalisée **sans aucun prix** (Constitution P3) : `{ mode, source
('historique' | 'runtime' | 'repli'), empreinte, horodatage }`. Le rapport (`__moteurDSBAT.rapport()`)
agrège : nombre d'appels, répartition par mode, `servisParRuntime`, `servisParRepli`,
`servisParHistorique`, `amorcages`, `replis`, `erreurs`, et les 200 derniers événements. En
navigateur, les événements sont aussi accumulés dans `window.__execRuntime`. Cela permet de **suivre
les premières exécutions réelles** (combien servies par le Runtime, combien de replis, quelles
empreintes) sans jamais exposer de montant.

## Validation Golden Master

```
node runtime/tests/bascule-check.js     → ✅ 14 assertions :
      • cache froid → repli historique (service assuré)
      • après amorçage → Runtime SERT un devis IDENTIQUE à l'historique
      • entrée modifiée → cache invalidé (aucun périmé)
      • retour arrière IMMÉDIAT ; journal SANS prix ; parité sur TOUS les cas
node runtime/tests/moteur-mode-check.js → ✅ 21 assertions (sélecteur R04 inchangé)
node runtime/tests/shadow-check.js      → ✅ 12 assertions (Shadow inchangé)
node runtime/tests/parite-runtime.js    → ✅ Runtime ⇄ reference.json identique
Golden Master (devis / pièce / reco) + A08/A09/A10 → ✅ tous identiques
Simulation navigateur :
      • défaut (aucun flag) → calculerDevis NON enveloppé, comportement identique
      • ?moteur=runtime → 1er rendu repli historique, puis Runtime SERT le devis ; retour arrière → historique
```

**Démonstration des trois exigences** : la bascule est **fonctionnelle** (le Runtime sert le devis
affiché, identique à l'historique) ; le **retour arrière fonctionne immédiatement** (quatre niveaux) ;
**aucune régression** (tous les Golden Master verts, comportement par défaut inchangé).

## Compatibilité avec le configurateur

Par défaut, **rien ne change** : le sélecteur est un no-op, le moteur local sert le devis. Activé, le
Runtime prend le relais **uniquement pour le devis**, avec repli permanent — les écrans, montants et
PDF restent identiques (le Runtime reproduit la référence). Le reste du configurateur (calcul par
pièce, recommandations, cohérence) demeure **local et inchangé** : R05 ne touche qu'un périmètre
minimal.

## Préparation de R06

R05 bascule le **devis global**. R06 étendra la même mécanique au **calcul par pièce**
(`calculerPiece`, phase 2) : shadow par pièce (endpoint dédié côté Runtime), puis bascule par cache
d'amorçage, sous les **mêmes critères** (parité 100 %, zéro écart critique/majeur, latence maîtrisée,
repli vérifié). Le moteur historique restera le repli jusqu'à stabilité prouvée. Ensuite viendront le
retrait des calculs du navigateur (R07) et la protection du savoir-faire (R08).

## Compatibilité avec la Constitution

**P3** (journal d'exécution **sans prix** ; le Runtime protège le catalogue côté serveur), **P6**
(Runtime atteint via l'Orchestrateur/Port), **P7** (le sélecteur aiguille, ne calcule pas), **P11**
(traçabilité des exécutions réelles : mode, source, empreinte), **P16** (indépendance : le devis
s'exécute côté serveur), **P17** (déterminisme : le résultat Runtime est byte-identique ; empreinte
stable), **P21** (source unique : aucun moteur copié ni modifié ; la référence Golden Master ne change
pas).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission R05** de la feuille de route Runtime : *première bascule réelle, périmètre
minimal, réversible*. Réalisée **dans l'ordre**, sous les critères posés en R04. Approche **additive**
et **prudente**.

## Compatibilité avec la Charte

**Additive** (extension du sélecteur + un test + wiring opt-in ; défaut inchangé), **réversible**
(retour arrière immédiat à quatre niveaux ; moteur historique toujours présent), **testable** (14
assertions de bascule + 33 assertions R03/R04 + simulations navigateur + tous les Golden Master),
**documentée** (présent document). Aucune logique de calcul modifiée.

## Conclusion

La **première bascule contrôlée** est en place : sur le plus petit périmètre — le devis — le Runtime
produit le résultat **réellement affiché**, mais **seulement** quand `?moteur=runtime` est activé,
via un **cache d'amorçage** qui sert le Runtime quand il est prêt et **retombe** instantanément sur
l'historique sinon. Le résultat servi est **byte-identique** à la référence ; le moteur historique
reste disponible en permanence ; le mode Shadow et le retour arrière immédiat sont conservés ; les
exécutions réelles sont journalisées **sans prix**. Aucun moteur, aucune règle, aucun prix n'a été
modifié — **seul le lieu d'exécution change**. Tous les Golden Master sont verts. Migration
extrêmement prudente, entièrement réversible, prête à s'étendre au calcul par pièce (R06).

*— MISSION R05 : pour la première fois, le devis affiché peut venir du serveur — et l'on revient au moteur local en un instant.*
