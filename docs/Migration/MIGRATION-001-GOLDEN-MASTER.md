# Moteur DSBAT — MIGRATION 001 : Établissement du Golden Master

> **Spécification de migration. Aucun code produit dans ce document.** Il identifie et cadre la
> toute première migration technique de la V2, conformément au Plan Directeur et à la Charte.
> *Aucune fonctionnalité, aucun calcul, aucun prix, aucune interface, aucun comportement modifié.*

---

## Analyse de l'état actuel

Le devis est produit par une **source unique** : `calculerDevis()` dans `js/moteur-devis.js`.
Elle lit trois données d'entrée globales — `piecesSelectionnees`, `chantier`, `metiersActifs` —
et retourne un objet complet :

```
{ totalHT, taux, tva, ttc,
  tableau, ballon, vmc, plomberie, chauffage, forfaitAcces, coefZ,
  besoinsTableau, besoinsVMC, besoinsPlomberie,
  acomptes:{ a1, a2, a3 } }
```

Ses dépendances, résolues à l'appel :

- **Catalogue et sous-moteurs** (`prix.js`, déjà requêtable en Node) : `PRIX`, `VMC_PARAMS`,
  `coefZone`, `dimensionnementTableau`, `dimensionnementVMC`, `dimensionnementPlomberie`,
  `dimensionnementChauffage`.
- **Une règle encore dans le HTML** : `tauxTVA()` est définie dans `devis-configurateur.html`
  (≈ ligne 2873). C'est **la seule dépendance de `calculerDevis` qui ne vit pas déjà dans un
  module**.

Les deux autres sorties visées par l'équivalence sont elles aussi déjà modularisées :

- **Contrôles** : `controlesCoherence(pieces, ch)` dans `js/coherence.js` (export Node présent).
- **Recommandations** : `RecoEngine.analyser(ctx)` dans `js/moteur-recommandations.js` (export
  Node présent).

**Constat** : le cœur du calcul est déjà isolé et déterministe. Il manque **le filet** : aucun
référentiel de résultats attendus ne permet aujourd'hui de prouver qu'une future migration ne
change rien.

---

## Pourquoi cette migration est prioritaire

La Charte est explicite : *« Le filet avant le trapèze : le Golden Master existe avant toute
migration. »* Toute autre première migration (y compris l'ontologie) **violerait notre propre
Charte**. Le Golden Master est donc, littéralement, la seule première étape autorisée.

Elle est aussi objectivement la meilleure première étape :

- **Valeur maximale** : elle transforme « on pense que rien n'a changé » en « on prouve que rien
  n'a changé ». C'est le contrat d'équivalence qui sécurisera *toutes* les migrations suivantes.
- **Risque minimal** : elle **n'observe** que le comportement actuel ; elle ne touche à aucun
  moteur, calcul, prix ni interface.
- **Invisible** : elle vit hors du logiciel livré (dossier de tests), l'utilisateur ne voit rien.
- **Préparatoire** : sans elle, aucune migration ultérieure ne peut être validée.

---

## Description détaillée de la migration

Créer un **harnais de capture** et un **jeu de cas de référence** (le Golden Master), plus un
**harnais de comparaison**. Tout se fait **en lecture seule** sur le code existant.

**Fichiers concernés**

- *Lus, jamais modifiés* : `prix.js`, `js/moteur-devis.js`, `js/coherence.js`,
  `js/moteur-recommandations.js`, et — pour `tauxTVA` — `devis-configurateur.html`.
- *Créés* (nouveaux, hors périmètre livré) : un dossier dédié, par ex. `tests/golden-master/`,
  contenant les **cas d'entrée** (fixtures), les **résultats attendus** (référence figée) et le
  **harnais** de capture/comparaison.

**Principe de fonctionnement**

1. Chaque **cas** est un triplet d'entrée figé : `chantier` + `piecesSelectionnees` +
   `metiersActifs` (des « Projets » au sens du domaine, en données brutes).
2. Le harnais installe ces entrées dans l'environnement d'exécution (globales + un `window`
   minimal pour les effets de bord `window.__*`), charge le catalogue et les sous-moteurs réels,
   puis appelle `calculerDevis()`, `controlesCoherence()` et `RecoEngine.analyser()`.
3. Il **sérialise** les sorties (devis complet, contrôles, recommandations, totaux par pièce)
   dans le fichier de **référence**.
4. Le harnais de **comparaison** rejoue les mêmes cas et vérifie l'**égalité stricte** avec la
   référence.

**Traitement de la dépendance `tauxTVA`** (le seul point délicat) : le harnais **récupère la
fonction depuis sa source réelle** (extraction du texte de `tauxTVA` depuis le HTML, évaluée dans
le contexte du harnais) — il ne la **recopie pas**. On respecte ainsi la source unique
(Constitution P21) sans modifier aucun fichier. *(La sortie de `tauxTVA` du HTML vers un module
sera un candidat naturel pour une micro-migration ultérieure, hors périmètre ici.)*

**Couverture visée par les cas** : au moins un cas par branche conditionnelle du calcul et des
sorties, notamment — projet vide ; pièce unique électricité seule ; salle de bain complète
(douche italienne → plomberie + étanchéité, VMC) ; cuisine (prise 32 A, circuits spécialisés) ;
chauffage électrique (dimensionnement) ; ballon d'eau chaude ; tableau ancien/inexistant
(parafoudre) ; logement occupé (majoration) ; zones tarifaires Z1/Z2/Z3 (`coefZone`) ; TVA 10 %
(rénovation) et 20 % (neuf/extension/local) ; logement complet multi-pièces multi-métiers.

---

## Impact sur l'architecture

**Nul sur le logiciel livré.** Aucune couche du Moteur DSBAT n'est encore introduite : cette
migration ne pose pas de couture, ne déplace aucune responsabilité, n'ajoute aucune couche.
Elle installe le **dispositif de mesure** qui permettra, ensuite, d'introduire les coutures en
toute sécurité. C'est l'instrument, pas encore la construction.

---

## Compatibilité avec la Constitution

Respect intégral. La migration **n'altère aucun prix ni aucune décision** (P3) ; elle
**s'appuie sur le déterminisme** du raisonnement pour capturer des références fiables (P17) ;
elle **ne duplique aucune donnée** — `tauxTVA` est lue de sa source, non recopiée (P21) ; elle
**ne crée aucune connaissance** et ne touche aucun moteur (P2). Le Golden Master est précisément
l'outil qui rendra vérifiable le respect de la Constitution à chaque étape suivante.

---

## Compatibilité avec la Charte

C'est l'**application directe** de la Charte : « le filet avant le trapèze » ; « le Golden Master
reste la référence tant que la migration n'est pas validée » ; « toute évolution est testable et
réversible ». La migration est additive (un dossier de tests), entièrement **réversible** (sa
suppression laisse la V1.5 intacte), et **documentée** (le présent document + la référence figée).

---

## Compatibilité avec le Plan Directeur

Elle **est** l'étape 1 du Plan Directeur (« Jeu de cas de référence, pré-requis ») et le jalon
**J0 → J1**. Elle conditionne tous les jalons suivants, dont le critère de sortie unique est
« Golden Master identique ».

---

## Golden Master attendu

Un artefact **figé et versionné** contenant, pour chaque cas :

- l'**entrée** exacte (`chantier`, `piecesSelectionnees`, `metiersActifs`) ;
- le **devis** complet renvoyé par `calculerDevis()` : `totalHT`, `taux`, `tva`, `ttc`,
  `acomptes`, et les sous-résultats `tableau` / `vmc` / `ballon` / `chauffage` / `plomberie`
  (avec leurs `prixTotalHT` et champs structurants) ;
- les **totaux par pièce** (`piece.totalHT`) ;
- les **contrôles** produits par `controlesCoherence()` ;
- les **recommandations** produites par `RecoEngine.analyser()`.

Ce fichier de référence est capturé **sur la V1.5 actuelle** et devient la **vérité de
comparaison** pour toute la migration.

---

## Tests de validation

- **Test d'auto-cohérence** : le harnais rejoué immédiatement sur la V1.5 **inchangée** doit
  renvoyer **100 % identique** à la référence (preuve que la capture est déterministe et fidèle).
- **Comparaison stricte** : égalité exacte sur les montants (tolérance **zéro** sur les prix),
  et égalité structurelle sur contrôles et recommandations.
- **Isolation des cas** : réinitialisation de l'état global (y compris `window.__*`) entre chaque
  cas, pour éviter toute contamination.
- **Test de couverture** : chaque branche conditionnelle listée plus haut est représentée par au
  moins un cas.
- **Test de non-dépendance temporelle** : les résultats ne dépendent pas de la date d'exécution
  (`calculerDevis` est indépendant de l'horloge ; à vérifier explicitement).

---

## Critères de réussite

La migration est **terminée** lorsque :

1. Un **jeu de cas de référence** est capturé depuis la V1.5 et **figé** (versionné).
2. Un **harnais de comparaison** existe et rapporte **100 % identique** sur la V1.5 inchangée.
3. La **couverture** est complète : toute branche de `calculerDevis`, des contrôles et des
   recommandations est exercée par au moins un cas.
4. **Aucun fichier livré n'a été modifié** ; le dispositif est **entièrement réversible**
   (supprimable sans trace).
5. Le tout est **documenté** (ce document + la référence + le mode d'emploi du harnais).

---

## Étapes suivantes

Une fois le Golden Master en place et vert :

- **MIGRATION 002 — Vocabulaire / Ontologie (Fondation A)** : introduire le dictionnaire et une
  **table d'alias** reliant les codes actuels (`ELEC_PRISE10`, `p.id = 'sdb'`, `PLO_WC_SUSP`…)
  aux codes canoniques. Donnée passive, aucun impact sur les calculs, validée par le Golden
  Master (résultat inchangé).
- **MIGRATION 003 — Contrat du Projet (Fondation B) en miroir** : produire l'objet *Projet*
  normalisé à partir de l'état actuel, comparé fidèle, sans que les moteurs le consomment encore.
- Puis Port de lecture (C), Journal passif (D), et connexion des moteurs un par un — chacun
  validé « Golden Master identique ».

*Candidat de micro-migration à planifier bientôt* : sortir `tauxTVA` du HTML vers un module, pour
supprimer la dernière dépendance du calcul résidant dans l'interface.

---

*— MIGRATION 001 : Golden Master. Point de départ officiel de la V2.*
