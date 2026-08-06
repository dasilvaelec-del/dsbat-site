# Runtime DSBAT – R04

> **Phase Runtime · Mission R04 — Préparation de la bascule contrôlée.** Un **sélecteur de moteur**
> (feature flag) permet de choisir **dynamiquement** quel moteur sert le résultat — historique,
> shadow, runtime — avec **retour arrière immédiat**. Le moteur historique reste la **référence** et
> demeure disponible pendant toute la mission. **Aucun changement fonctionnel, aucune modification des
> calculs, aucune régression.** Le Golden Master reste la référence absolue.

---

## Architecture du feature flag

Le sélecteur (`js/moteur-mode.js`, `MoteurModeDSBAT`) est un **routeur**, pas un calculateur : il
**aiguille** vers une source de calcul et sait revenir instantanément à l'historique. Il ne contient
aucune logique métier ; **les moteurs sont injectés**, jamais modifiés.

```
   calculerDevis() ─▶ SÉLECTEUR (mode courant)
                          │
        ┌─────────────────┼───────────────────┬─────────────────┐
        ▼                 ▼                   ▼                 ▼
   historique          shadow              runtime            arret
   (référence)     historique servi     Runtime sert       coupe-circuit
                   + comparaison BG     (repli auto sur     → historique
                   (résultat ignoré)     historique)
```

- **Sources injectées** : `historique(etat)` (obligatoire, le moteur actuel), `runtimeSync(etat)`
  (Node/test), `runtimeAsync(etat)` (navigateur, via l'Orchestrateur/API), `observer(etat, devisLocal)`
  (hook Shadow R03). Le sélecteur ne connaît aucun d'eux en dur.
- **L'Orchestrateur reste le point d'entrée du Runtime** : les sources `runtime*` passent par
  l'API/Orchestrateur (A09/A10), jamais par un accès direct aux moteurs.
- **Lecture du flag** : `lireModeDepuisEnv(location, localStorage)` → `?moteur=…` (ou `?shadow=1`
  comme alias), sinon `localStorage 'dsbat_moteur'`, **défaut `historique`**.

## Modes disponibles

| Mode | Résultat **servi** à l'utilisateur | Effet | Usage |
|------|-----------------------------------|-------|-------|
| **historique** *(défaut)* | moteur historique | passe-plat, **aucun** effet | production actuelle |
| **shadow** | moteur historique | + comparaison Runtime en tâche de fond (résultat Runtime **ignoré**) | mesure de parité (R03) |
| **runtime** | Runtime (via Orchestrateur) | **repli automatique** immédiat sur l'historique en cas d'échec | première bascule (R05) |
| **arret** | moteur historique | coupe-circuit : neutralise tout | retour arrière d'urgence |

En mode **historique** et **arret**, le résultat servi est **toujours** l'historique. En mode
**shadow**, le résultat servi **reste** l'historique (la référence), la comparaison n'est
qu'observation. Seul le mode **runtime** sert le résultat du Runtime — et encore, avec **repli**.

## Bascule

La bascule est un simple **changement de mode**, sans aucune modification des moteurs :

- **`setMode('runtime')`** → le sélecteur sert le Runtime (chemin synchrone en test, asynchrone en
  navigateur, préparé pour R05).
- **Progressivité** : le mode se pilote par flag (URL / `localStorage`), donc activable pour une
  **fraction** des sessions (cohorte, canari) sans redéploiement.
- **Point d'entrée unique** : toute exécution Runtime passe par l'Orchestrateur/API — un seul chemin à
  surveiller.

Dans le configurateur, le service actuel de `calculerDevis()` est **synchrone** (utilisé par
`renderPhase3`). Le sélecteur sert donc l'historique en synchrone et, en mode shadow, observe en
parallèle. La **consommation asynchrone** du Runtime (servir réellement son résultat dans le rendu)
est le geste de **R05** : elle est déjà **branchée** via `runtimeAsync` / `calculerAsync`, prête à
être activée.

## Retour arrière

Réversibilité **instantanée**, à trois niveaux :

1. **Explicite** : `__moteurDSBAT.retourArriere()` (ou `setMode('historique')`) → retour immédiat au
   moteur historique, sans redéploiement.
2. **Par le flag** : retirer `?moteur=…` / la clé `localStorage` → défaut historique.
3. **Automatique (repli)** : en mode runtime, **toute** erreur (réseau, 5xx, exception) fait
   **retomber** le service sur l'historique — l'utilisateur est toujours servi, aucune exception
   propagée. Le repli est **compté** dans le rapport.

Le mode **arret** offre en plus un **coupe-circuit** explicite qui neutralise tout et force
l'historique.

## Validation

```
node runtime/tests/moteur-mode-check.js → ✅ 21 assertions :
     • défaut = historique ; 4 modes définis
     • runtime : devis IDENTIQUE à l'historique (parité sur tous les cas)
     • retour arrière IMMÉDIAT (retourArriere / setMode)
     • shadow : sert l'historique + déclenche l'observation
     • repli AUTOMATIQUE si le Runtime échoue (aucune exception)
     • 'arret' coupe-circuit → historique ; mode invalide rejeté
     • calculerDevis INCHANGÉ (aucun moteur patché) ; lecture du flag
node runtime/tests/shadow-check.js       → ✅ Shadow inchangé (12 assertions)
node runtime/tests/parite-runtime.js     → ✅ Runtime ⇄ reference.json identique
Golden Master (devis / pièce / reco) + A08/A09/A10 → ✅ tous identiques
Simulation navigateur :
     • défaut (aucun flag) → calculerDevis NON enveloppé, comportement identique
     • ?moteur=shadow → sert le local + observe ; retour arrière → historique
     • ?moteur=runtime → service synchrone reste historique (repli), mode='runtime'
```

**Démonstration des trois exigences** : le configurateur **continue** d'utiliser le moteur historique
(mode par défaut) ; il **peut utiliser** le Runtime quand le flag est activé (mode runtime, parité
prouvée) ; le **retour au moteur historique est immédiat** (retourArriere / repli / retrait du flag).

## Critères pour autoriser la bascule définitive (R05)

La bascule **runtime** par défaut ne sera autorisée que si **tous** les critères sont réunis :

1. **Parité 100 %** en mode shadow sur un **volume représentatif** de trafic réel (pas seulement les
   cas figés) et sur une **fenêtre d'observation** suffisante.
2. **Zéro écart** de gravité **critique** ou **majeur** ; les écarts mineurs éventuels documentés et
   jugés non significatifs.
3. **Taux d'erreur d'observation** (réseau/serveur) **maîtrisé** et sous seuil.
4. **Latence** du Runtime (P95) sous le seuil d'acceptabilité pour le rendu.
5. **Repli automatique** vérifié en conditions réelles (coupure serveur → service historique sans
   incident).
6. **Golden Master** toujours vert (le moteur, où qu'il s'exécute, reproduit la référence).
7. **Retour arrière** répété testé (flag + coupe-circuit) — réversibilité prouvée.

Tant qu'un critère manque, **on ne bascule pas** : on corrige l'adaptateur serveur, jamais la
référence.

## Compatibilité avec le configurateur

Par défaut (aucun flag), le sélecteur est un **no-op total** : `calculerDevis` n'est pas enveloppé, le
comportement est **strictement identique** (prouvé en simulation). Activé, le sélecteur sert toujours
l'historique en synchrone (mode shadow/runtime actuel), n'altère jamais le rendu, et se désactive
instantanément. Les nouveaux scripts sont **inertes** au chargement.

## Compatibilité avec la Constitution

**P3** (aucun prix exposé ni journalisé), **P6** (Runtime atteint via le Port/Orchestrateur), **P7**
(le sélecteur a une responsabilité unique : aiguiller, jamais calculer), **P11** (traçabilité : mode
courant, replis et services comptés au rapport), **P16** (indépendance : sélecteur pur, prouvé en
Node), **P17** (déterminisme : le mode ne change pas le résultat — parité byte-identique), **P21**
(source unique : les moteurs ne sont ni copiés ni modifiés, seulement aiguillés).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission R04** de la feuille de route Runtime : *mécanisme de choix dynamique du
moteur, préparation de la bascule, sans remplacement*. Réalisée **dans l'ordre**, en amont direct de
R05. Approche **additive** et **réversible**.

## Compatibilité avec la Charte

**Additive** (un module + un test + généralisation du bloc opt-in ; le chemin par défaut est
inchangé), **réversible** (retour arrière instantané à trois niveaux), **testable** (21 assertions +
simulations navigateur + tous les Golden Master), **documentée** (présent document). Aucune logique de
calcul modifiée.

## Préparation de R05

R04 fournit l'**interrupteur** ; R05 réalise la **première bascule réelle** :

- Rendre le chemin de rendu **asynchrone** là où c'est nécessaire (`calculerAsync` est déjà prêt),
  pour que le mode **runtime** serve effectivement le résultat du Runtime dans `renderPhase3` puis
  `genererPDFConfig`.
- Activer le mode runtime en **canari** (1 % → 100 %) sous les **critères** ci-dessus, avec repli
  automatique et retour arrière immédiat.
- Conserver le moteur historique comme **repli** jusqu'à stabilité prouvée (retrait ultérieur, R07).

## Conclusion

Le Runtime dispose désormais d'un **interrupteur de moteur** : historique, shadow, runtime, arret —
choisis dynamiquement par un feature flag, sans jamais toucher aux moteurs métier, l'Orchestrateur
restant le point d'entrée du Runtime. Le moteur historique demeure la **référence** et le service par
défaut ; le Runtime peut être activé d'un flag (parité prouvée) ; le **retour arrière est immédiat**
(explicite, par retrait du flag, ou par repli automatique). Aucun changement fonctionnel, aucune
régression, tous les Golden Master verts. La bascule définitive (R05) est désormais **outillée** et
**conditionnée** à des critères clairs — transition extrêmement prudente et entièrement réversible.

*— MISSION R04 : le moteur a un interrupteur — on peut passer au Runtime, et revenir, en un instant.*
