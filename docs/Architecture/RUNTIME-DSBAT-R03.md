# Runtime DSBAT – R03

> **Phase Runtime · Mission R03 — Mode Shadow.** Le configurateur continue de calculer **localement**
> (référence servie à l'utilisateur) et, **en parallèle**, le même Projet est envoyé au Runtime ; les
> deux résultats sont **comparés automatiquement**. Le résultat du Runtime n'est **jamais** montré à
> l'utilisateur : il ne sert qu'à **vérifier la parité**. Approche **totalement additive**, activable
> par flag, désactivée par défaut. Le Golden Master reste la référence absolue.

---

## Objectifs

Avant toute bascule (R05), il faut **prouver en conditions réelles** que le Runtime produit
exactement les mêmes résultats que le moteur historique. Le mode Shadow réalise cette preuve **sans
aucun risque** :

1. Exécuter le moteur **en double** — local (référence) + Runtime (observé).
2. **Comparer** automatiquement devis global, calculs par pièce, journaux utiles et structure.
3. **Journaliser uniquement les écarts** et produire un **rapport de synthèse** (comparaisons, écarts,
   types, gravité).
4. Ne **jamais** perturber le configurateur : observation asynchrone, résultat Runtime ignoré,
   activation/désactivation triviale.

## Architecture du mode Shadow

```
   Utilisateur ─▶ calculerDevis (LOCAL, référence) ─▶ résultat affiché  ✅ (chemin inchangé)
                        │
                        │  (enveloppe additive, si Shadow actif)
                        ▼  planifie une observation ASYNCHRONE, non bloquante
                 ShadowDSBAT.observer
                        │  construit un Projet (A08) depuis l'état de l'app
                        ▼
                 RuntimeClient ──POST /v1/projets/calcul──▶ Runtime (R02)
                        │
                        ▼
                 Comparateur : devis · parPiece · journaux · structure
                        │  n'enregistre QUE les écarts → Rapport
                        ▼
                 __shadowDSBAT.rapport()   (résultat Runtime JAMAIS affiché)
```

Trois nouveaux composants, tous **inertes au chargement** :

- **`js/shadow.js`** (`ShadowDSBAT`) — le moteur de comparaison : diff profond, classification par
  gravité, journal des écarts, rapport, drapeau `actif`, et une **enveloppe** de fonction locale.
- **`js/runtime-client.js`** (`RuntimeClientDSBAT`) — client `fetch` vers l'API du Runtime
  (`POST /v1/projets/calcul`), renvoyant `{ devis, parPiece, journaux }`. Transport injectable.
- **Bloc d'activation** (bas de `devis-configurateur.html`) — **opt-in strict** : n'agit que sur
  `?shadow=1` (ou `localStorage 'dsbat_shadow'='1'`).

Shadow ne calcule ni ne décide rien : il ne fait que **comparer** et **rapporter**.

## Fonctionnement

1. Le configurateur appelle `calculerDevis()` **localement** ; son résultat est **rendu inchangé** et
   affiché — le chemin utilisateur n'est pas modifié.
2. Si le Shadow est **actif**, l'enveloppe **planifie** (microtâche) une observation en tâche de fond :
   elle construit un **Projet DSBAT** (`ModeleProjetDSBAT.creerProjetDSBAT`) à partir de l'état courant
   (`chantier`, `piecesSelectionnees`, `metiersActifs`) et du devis local.
3. Le **client Runtime** envoie ce Projet à l'API et récupère le résultat serveur.
4. Le **comparateur** confronte local et Runtime, puis met à jour le **rapport**.
5. Le résultat Runtime est **jeté** : il ne touche jamais l'interface.

Toute erreur (réseau, Runtime indisponible, timeout) est **avalée** et comptée comme *erreur
d'observation* — jamais propagée à l'utilisateur, jamais transformée en faux écart.

## Comparaison des résultats

Le comparateur opère à **quatre niveaux** :

| Niveau | Ce qui est comparé | Gravité d'un écart |
|--------|--------------------|--------------------|
| **Devis global** | l'objet `devis` complet (calculé **côté serveur**) : `totalHT`, `ttc`, `tva`, `taux`, `coefZ`, `forfaitAcces`, tableau/vmc/plomberie/chauffage… | **critique** sur les clés de total |
| **Calculs par pièce** | `parPiece[id].totalHT` (Runtime) vs total local de chaque pièce | **majeur** |
| **Journaux utiles** | les événements de coordination du Runtime : présents, et **sans aucun prix** (P3) | **critique** si un prix fuite, sinon **mineur** |
| **Structure** | clés manquantes / superflues / types divergents | **majeur** |

Le diff est **profond et déterministe** (chemins triés). Il **normalise** les différences non
significatives : une clé présente mais `undefined` (côté local) équivaut à une clé absente (côté
Runtime, car JSON supprime les `undefined`) ; les champs volatils (`horodatage`, `requestId`,
`calculeLe`, `empreinte`, `sequence`) sont **ignorés**. Ainsi, seuls les **vrais** écarts de calcul
sont remontés.

## Journalisation des écarts

**Seuls les écarts** sont journalisés (les comparaisons parfaites n'émettent rien, pour éviter le
bruit). Chaque écart porte : `cas`, `chemin`, `type` (`valeur`, `type`, `cle_manquante`,
`cle_superflue`, `prix_dans_journal`), `gravite` (`critique` / `majeur` / `mineur`), `attendu`
(local) et `obtenu` (Runtime). En navigateur, un crochet `onEcart` les affiche en `console.warn`.
Aucun prix n'est journalisé — au contraire, le Shadow **signale** un prix qui fuiterait dans un
journal.

## Rapport Shadow

`__shadowDSBAT.rapport()` fournit une synthèse :

```json
{
  "comparaisons": 5, "sansEcart": 5, "avecEcart": 0, "erreurs": 0, "ecarts": 0,
  "pariteParfaitePct": 100,
  "parType": {}, "parGravite": { "critique": 0, "majeur": 0, "mineur": 0 },
  "exemples": []
}
```

`__shadowDSBAT.texteRapport()` en donne une ligne lisible.

**Premier rapport de comparaison** (hors ligne, 5 cas figés du Golden Master, Runtime composé en
mémoire — fichier `runtime/rapports/shadow-rapport-initial.json`) :

```
[Shadow DSBAT] comparaisons=5 · sans écart=5 · avec écart=0 · erreurs=0 · parité=100%
               · gravité{critique:0, majeur:0, mineur:0}
```

**Parité parfaite (100 %)** : sur tous les cas de référence, le Runtime produit exactement le même
devis, les mêmes totaux par pièce et des journaux propres. Le comparateur a par ailleurs été **prouvé
capable de détecter** un écart injecté (un `totalHT` faussé → **critique** ; un total pièce faussé →
**majeur**), garantissant que la parité observée n'est pas un angle mort.

## Activation / Désactivation

- **Désactivé par défaut** : au chargement normal de la page, **rien** ne se passe (prouvé : les
  modules se définissent, `calculerDevis` **n'est pas enveloppé**, aucun `__shadowDSBAT`).
- **Activer** : ajouter `?shadow=1` à l'URL, ou `localStorage.setItem('dsbat_shadow','1')`. On peut
  cibler un autre Runtime via `?shadowRuntime=https://…`.
- **Désactiver** : retirer le paramètre / la clé — retour immédiat à l'état inerte.
- **En code** : `ShadowDSBAT.creerShadow(...).activer() / .desactiver()`.

L'activation est entièrement encapsulée dans un `try/catch` : même en cas de problème
(module absent, Runtime injoignable), le configurateur **fonctionne normalement**.

## Validation Golden Master

```
node runtime/tests/shadow-check.js  → ✅ 12 assertions : parité 100 % (5 cas) + détection d'écarts
                                        (critique/majeur) + robustesse (panne avalée, inactif = inerte,
                                        résultat local rendu inchangé)
node runtime/tests/parite-runtime.js → ✅ Runtime ⇄ reference.json identique
node runtime/tests/smoke-http.js     → ✅ démarrage HTTP réel
node tests/golden-master/golden-master.js verify        → ✅ IDENTIQUE
node tests/golden-master/piece-golden-master.js verify  → ✅ IDENTIQUE
node tests/golden-master/reco-oublis-domain-golden.js verify → ✅ IDENTIQUE
node tests/golden-master/a08/a09/a10-check.js           → ✅ inchangés
Simulation navigateur (chargement par défaut)           → ✅ calculerDevis NON enveloppé, comportement identique
Simulation navigateur (?shadow=1, Runtime injoignable)  → ✅ résultat LOCAL rendu, aucune exception
```

Les trois filets Golden Master et les preuves A08–A10 restent **identiques**. Le mode Shadow ne
modifie **aucun** comportement : la référence, c'est toujours le moteur local.

## Compatibilité avec le configurateur

Le chemin utilisateur est **strictement inchangé** : `calculerDevis` renvoie toujours le résultat
**local**, affiché tel quel. Les nouveaux scripts sont **inertes** au chargement ; l'observation ne
démarre qu'avec le flag et s'exécute **en tâche de fond**, sans jamais bloquer ni altérer l'UI. Sans
flag (cas par défaut), c'est un **no-op** complet.

## Préparation de R04

R03 met en place la **mesure de parité en production réelle**. R04 en fait un **usage systématique** :

- Activer le Shadow sur une **fraction du trafic** (interne / franchise pilote) via le flag.
- **Collecter** les rapports (parité, types/gravité d'écarts, taux d'erreur d'observation) sur une
  **fenêtre d'observation**.
- **Condition de passage à R05 (première bascule)** : parité **100 %** sur un volume représentatif,
  **zéro** écart de gravité critique/majeur, taux d'erreur d'observation maîtrisé (réseau), et retour
  arrière (flag off) vérifié. Tant que ce seuil n'est pas atteint, **on ne bascule pas** : on corrige
  l'adaptateur serveur, jamais la référence.

## Compatibilité avec la Constitution

**P3** (aucun prix journalisé ; le Shadow **détecte** un prix qui fuiterait), **P6** (le savoir reste
atteint via le Port, côté serveur), **P7** (Shadow a une responsabilité unique : comparer/rapporter),
**P11** (traçabilité : écarts horodatés, rapport de synthèse), **P16** (indépendance : comparateur
sans dépendance au navigateur, prouvé en Node), **P17** (déterminisme : diff trié, parité
byte-cohérente), **P21** (source unique : le moteur local reste la référence ; le Runtime référence
les mêmes briques).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission R03** de la feuille de route Runtime (R01) : *shadow-calcul du devis,
mesure de parité, sans bascule*. Réalisée **dans l'ordre**, dernière étape avant la première bascule
(R05). Approche **additive** et **réversible**.

## Compatibilité avec la Charte

**Additive** (3 fichiers + un bloc opt-in ; le chemin par défaut est inchangé), **réversible**
(retirer le flag, ou les scripts, restaure l'état exact), **testable** (12 assertions Shadow + 2
simulations navigateur + tous les Golden Master), **documentée** (présent document + premier rapport).
Aucune logique de calcul modifiée.

## Conclusion

Le **mode Shadow** est en place : le configurateur calcule localement comme toujours et, en parallèle
lorsqu'il est activé, envoie le même Projet au Runtime pour **comparer automatiquement** devis,
calculs par pièce, journaux et structure — **sans jamais** montrer le résultat serveur à
l'utilisateur ni perturber la page. Le premier rapport affiche une **parité parfaite (100 %)** sur les
cas de référence, et le comparateur sait **détecter et classer** les écarts. Désactivé par défaut,
activable d'un paramètre, entièrement réversible et couvert par le Golden Master, le Shadow est la
**dernière étape d'observation** avant la première bascule vers le Runtime (R05).

*— MISSION R03 : le Runtime est désormais observé en parallèle — le configurateur, lui, n'a rien changé.*
