# Moteur DSBAT — MIGRATION 005 : Première implémentation réelle (Golden Master)

> **Première migration technique du code.** Elle installe le **filet de non-régression** exigé par
> la Charte, sans modifier aucun fichier livré. *Invisible pour l'utilisateur ; aucun calcul, prix,
> règle, interface, recommandation ni devis modifié.*

---

## Analyse de l'état actuel

Le cœur du devis est déjà modulaire et déterministe :

- `js/moteur-devis.js` → `calculerDevis()` : source unique du devis (HT/TVA/TTC, tableau, VMC,
  ballon, chauffage, plomberie, acomptes).
- `js/coherence.js` → `controlesCoherence(pieces, ch)` : les contrôles.
- `js/moteur-recommandations.js` → `RecoEngine.analyser(ctx)` : les recommandations.
- `prix.js` : catalogue et sous-moteurs (exportés en Node).

Une seule dépendance du calcul vit encore dans l'interface : **`tauxTVA`** (dans
`devis-configurateur.html`). Il manquait **un filet** : aucun référentiel de résultats attendus ne
permettait de *prouver* qu'une future migration ne change rien.

---

## Choix de la migration

**Implémenter le Golden Master** : un jeu de cas figé + un harnais de capture/comparaison qui
exécute le cœur modulaire actuel et vérifie l'égalité stricte avec une référence.

## Justification

La Charte est catégorique : *« le filet avant le trapèze : le Golden Master existe avant toute
migration. »* Toute autre première brique (façade du Port, abstraction…) **violerait notre propre
Charte**. C'est donc la seule première migration autorisée — et objectivement la plus utile : elle
transforme « on pense que rien n'a changé » en « on **prouve** que rien n'a changé », et elle
sécurise **toutes** les migrations suivantes. Elle est réalisée **maintenant** parce qu'elle
conditionne tout le reste ; elle est **prioritaire** parce qu'aucune couture ne peut être validée
sans elle.

## Architecture proposée

Un harnais **hors ligne**, en lecture seule sur le code livré :

1. il **reconstitue l'environnement** de `calculerDevis` (catalogue + sous-moteurs de `prix.js`
   exposés en globales, shim `window`, et `tauxTVA` **extrait de sa source** sans recopie ni
   modification du HTML — respect de la source unique, P21) ;
2. il exécute les **trois sorties** (devis, contrôles, recommandations) sur chaque cas ;
3. il **sérialise de façon déterministe** (clés triées) et compare à `reference.json`.

## Fichiers concernés

- **Créés** (nouveaux, non chargés par le site) : `tests/golden-master/fixtures.js`,
  `tests/golden-master/golden-master.js`, `tests/golden-master/reference.json`,
  `tests/golden-master/README.md`.
- **Lus, jamais modifiés** : `prix.js`, `js/moteur-devis.js`, `js/coherence.js`,
  `js/moteur-recommandations.js`, `devis-configurateur.html` (pour `tauxTVA`).

## Travaux réalisés

- 5 cas de référence couvrant les branches du cœur : projet vide (TVA 10 %), salle de bain complète
  (douche italienne → plomberie + VMC + tableau), chauffage électrique, neuf + zone Z3 + logement
  occupé (TVA 20 %, coef 1,22, majoration ×1,088), local commercial (TVA 20 %).
- Harnais `capture` (fige la référence) et `verify` (compare, échoue au moindre écart).
- Référence capturée sur la V1.5 actuelle et vérifiée identique.

---

## Compatibilité avec la Constitution

Respect intégral : **P3** (aucun prix touché ; les prix ne sont que *lus*), **P17** (le
déterminisme rend la référence fiable — vérifié par double exécution identique), **P21** (`tauxTVA`
lue de sa source, non recopiée), **P2** (aucun moteur modifié). Le Golden Master est précisément
l'outil qui rendra vérifiable le respect de la Constitution à chaque étape suivante.

## Compatibilité avec le Plan Directeur

C'est l'**étape 1** (« Jeu de cas de référence, pré-requis ») et le jalon **J0 → J1**. Son critère
de sortie — « Golden Master identique » — devient le critère de tous les jalons suivants.

## Compatibilité avec la Charte

Application directe : « le filet avant le trapèze » ; « le Golden Master reste la référence » ;
« toute évolution est testable et réversible ». La migration est **additive** (un dossier de tests),
**réversible** (le supprimer laisse la V1.5 intacte) et **documentée**.

---

## Validation Golden Master

Exécution réelle dans l'environnement Node :

```
node golden-master.js capture  → ✅ Référence capturée (5 cas)
node golden-master.js verify   → ✅ Golden Master IDENTIQUE — aucune régression
node golden-master.js verify   → ✅ IDENTIQUE (déterminisme confirmé, 2ᵉ passe)
```

Contrôle de couverture (extraits de la référence) : `neuf_zone3_occupe` taux 0,20 / coefZ 1,22 ;
`local_commercial` taux 0,20 ; `chauffage_electrique` chauffage présent ; `vide_renovation`
totalHT 0 / taux 0,10 ; `sdb_complete` 4 recommandations, 1 contrôle, tableau + VMC + plomberie
déclenchés.

Contrôle d'invisibilité / non-régression au niveau du dépôt : `git status` ne rapporte **aucun
fichier modifié** — uniquement des fichiers **nouveaux** (`tests/`, docs). Les fichiers du site sont
inchangés au bit près, donc : **mêmes prestations, mêmes quantités, mêmes prix, mêmes
recommandations, mêmes contrôles, mêmes devis, aucune régression.**

---

## Risques

- **Couplage `tauxTVA` au HTML** : le harnais l'extrait de sa source ; si le HTML déplace/renomme
  `tauxTVA`, le harnais devra ré-extraire. *Mitigation* : extraction par lecture (jamais copie) ;
  candidat à une micro-migration (sortir `tauxTVA` dans un module).
- **Périmètre v1** : `piece.totalHT` (produit par `recalcPiece`, couplé au DOM) est fourni comme
  **entrée figée**. Le Golden Master v1 verrouille donc le **cœur modulaire** ; l'agrégation par
  pièce sera couverte lors de l'extraction de `recalcPiece`. *Assumé et documenté.*
- **État global partagé** entre cas : neutralisé par une réinitialisation stricte (`window`,
  `chantier`, `piecesSelectionnees`, `metiersActifs`) avant chaque cas.

## Préparation de la migration suivante

Le filet étant posé, la **MIGRATION 006** pourra introduire la **première façade du Port d'Accès au
Savoir** en simple relais (lecture des normes), validée « Golden Master identique ». À terme, on
étendra le jeu de cas (plus de branches) et on couvrira `recalcPiece` lors de son extraction. La
sortie de `tauxTVA` du HTML est également un candidat naturel à court terme.

---

## Conclusion

L'architecture entre pour la première fois dans le code — non par une fonctionnalité, mais par son
**filet de sécurité**. Le Golden Master est en place, **vert et déterministe**, sans avoir modifié
une seule ligne du logiciel livré. Le point de départ de l'implémentation de la V2 est officiellement
franchi : à partir de maintenant, chaque migration devra passer par ce contrat de non-régression.

*— MIGRATION 005 : Golden Master implémenté. Point de départ de l'implémentation V2.*
