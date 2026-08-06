# Runtime DSBAT – R07

> **Phase Runtime · Mission R07 — Retrait progressif des calculs du navigateur (inventaire &
> feuille de route).** Cette mission **n'exécute aucune suppression** : elle **inventorie** précisément
> ce qui calcule encore côté navigateur, décide **ce qui peut** être assuré exclusivement par le
> Runtime, **ce qui doit rester** dans l'interface, et fixe **l'ordre** de retrait. Objectif de fond :
> **protéger progressivement le savoir-faire DSBAT** (les prix d'abord), en migration **additive,
> prudente et totalement réversible**. Aucun moteur, aucune règle, aucun calcul modifié. Le Golden
> Master reste la référence absolue.

---

## État actuel

Le Runtime sait déjà exécuter **les deux calculs cœur** :

- le **devis global** (`calculerDevis`) — routable via le sélecteur (R05) ;
- le **calcul par pièce** (`calculerPieceComplet`) — routable via le sélecteur (R06).

Ces bascules sont **actives uniquement sous feature flag**, avec **repli** local permanent, **retour
arrière** unifié immédiat et **journalisation sans prix**. Mais le navigateur **charge et exécute
encore** l'intégralité des moteurs et du **catalogue de prix** (`prix.js`, ~1 186 lignes), notamment
pour **afficher les prix par prestation**. Tant que c'est le cas, le savoir-faire (prix + règles)
**reste exposé** dans le dépôt public servi au client.

## Inventaire des calculs navigateur

Scripts de calcul chargés par `devis-configurateur.html` et usages inline réels :

| # | Calcul / responsabilité | Fichier(s) | Rôle | Dépendances | Migration | Risque |
|---|-------------------------|-----------|------|-------------|-----------|--------|
| 1 | **Devis global** `calculerDevis` | `js/moteur-devis.js` | agrégation HT/TVA/TTC + sous-dimensionnements | `prix.js`, `tauxTVA`, sous-moteurs | **Faite** (R05, routable) | Faible (repli + parité prouvée) |
| 2 | **Calcul par pièce** `calculerPieceComplet` | `js/moteur-piece.js`, `moteur-revetements.js`, `moteur-piece-complet.js` | surfaces + revêtements + chiffrage pièce | `getMoyenPrixFor`, `tempsUnitaire`, `SOLS_PARAMS`… | **Faite** (R06, routable) | Faible (repli + parité) |
| 3 | **Sous-dimensionnements** (tableau, VMC, chauffage, plomberie) | `prix.js` | consommables/centrale | `prix.js` | Déjà **serveur** via `calculerDevis` | Faible |
| 4 | **Dimensionnement isolation (inline)** `dimensionnementIsolation` @ recap | inline HTML + `prix.js` | consommables BA13 (texte récap) | `prix.js`, `explicationsIsolation` | À router (endpoint recap) | Faible |
| 5 | **Affichage des prix par prestation** `getMoyenPrixFor` **(×28)**, `getPrixPrestFor`, `tempsUnitaire` | inline HTML + `js/pricing.js` + `prix.js` | montre le prix de chaque option en phase 2 | **`prix.js` (catalogue complet)** | **À router — PRIORITÉ** (vue tarifaire projet) | Moyen (nombreux points d'affichage) |
| 6 | **Contrôles de cohérence** `verifierCoherenceGlobale` | `js/coherence.js` | alertes de cohérence (panel) | config pièces, `chantier` | À router (endpoint cohérence) | Faible/Moyen |
| 7 | **Recommandations / oublis** `evaluationSupport*`, `controlesOublis*`, `controlesInfo*` | `js/moteurs/*.js`, `normes.js` | encarts « Recommandation / Pensez à… » | savoir métier, normes | À router (domaine déjà sous filet A07) | Faible |
| 8 | **Libellé TVA** `labelTVA` | `js/moteur-tva.js` | libellé « TVA 10 % » (affichage) | `chantier` | Optionnel (faible valeur) | Négligeable |

Note : `js/moteur-recommandations.js` (RecoEngine) **n'est pas chargé** par le configurateur (usage
serveur/tests). Les `calculerPiece(` détectés autour des lignes 3480+ sont le **wiring R06**
(sélecteur), pas des sites de calcul.

## Éléments pouvant être retirés

Peuvent devenir **exclusivement Runtime** (dans l'ordre de valeur/protection) :

1. **Le calcul cœur (devis + pièce)** — déjà routable ; il ne « reste » au navigateur que le **repli**
   et le **chargement** des moteurs. Le retrait consiste à **cesser de charger** `moteur-devis.js` /
   `moteur-piece*.js` une fois le rollout stable.
2. **L'affichage des prix par prestation** (item 5) — c'est **le** point sensible : 28 lectures
   directes du catalogue pour l'UI. Migration vers une **vue tarifaire de projet** servie par le
   Runtime (une liste `{ code → prix affiché }` calculée côté serveur), afin que **`prix.js` ne soit
   plus jamais envoyé au client**.
3. **Sous-dimensionnement isolation (recap)** et autres calculs de **récapitulatif** (item 4) — vers un
   endpoint « explications/recap ».
4. **Contrôles de cohérence** (item 6) — vers un endpoint dédié.
5. **Recommandations / oublis** (item 7) — vers des endpoints, en s'appuyant sur le **domaine déjà
   extrait et sous Golden Master** (A07).

## Éléments devant rester

Le navigateur conserve son rôle d'**interface** — jamais de calcul métier ni de prix :

- **Validation de formulaire** : parsing des saisies, champs requis, plages, formats.
- **Lecture DOM → modèle** : la partie de `recalcPiece` qui lit les valeurs de l'interface pour
  construire la pièce (avant tout calcul).
- **Rendu et formatage** : `toFixed`, construction de HTML, panneaux, badges, navigation de phase.
- **Interactions utilisateur** : ajout/suppression de pièces, sélection de métiers, événements.
- **Mise en page du PDF** : le *calcul* (via `calculerDevis`) est routable ; la **composition** du
  document reste locale.
- **Orchestration d'appels** : construire le Projet (A08) et appeler le Runtime, gérer repli/erreurs.

En clair : **l'interface décrit *ce que l'utilisateur veut*** (un Projet) et **affiche *ce que le
Moteur répond*** ; elle ne décide plus *combien ça coûte* ni *quelles règles s'appliquent*.

## Ordre de migration

Séquence optimale (chaque étape additive, sous flag, réversible, validée par Golden Master + parité
shadow) :

1. **Consolider R05/R06** : rollout du mode runtime (devis + pièce) sous les critères R04/R06 (canari
   1 %→100 %, parité 100 %, latence P95 sous seuil, repli vérifié). *Aucun code — déploiement.*
2. **Vue tarifaire de projet (prix d'affichage)** — endpoint Runtime renvoyant les prix nécessaires à
   l'écran, en **remplacement** des 28 `getMoyenPrixFor` inline. **Étape prioritaire** (protège les
   prix). Shadow puis bascule.
3. **Recap / dimensionnements d'affichage** (isolation, consommables) — endpoint « explications ».
4. **Contrôles de cohérence** — endpoint dédié, shadow puis bascule.
5. **Recommandations / oublis** — endpoints, domaine déjà sous filet (A07).
6. **Cesser de charger** les moteurs et le catalogue côté client une fois **toutes** leurs lectures
   navigateur servies par le Runtime (fin de R07). Le repli local disparaît alors — d'où l'exigence
   d'un Runtime éprouvé et hautement disponible.
7. **Retrait du savoir du dépôt public** → **R08**.

L'ordre privilégie **la valeur de protection** (les prix d'abord) et **le risque croissant** (afficher
des prix < cohérence < reco), en gardant le repli local jusqu'au bout.

## Impact GitHub

- **Pendant R07** : **rien n'est retiré** du dépôt public. Les étapes sont additives (nouveaux
  endpoints + bascules sous flag). Le repli local exige que les fichiers restent présents.
- **Fin de R07** : lorsque plus **aucune** lecture navigateur ne dépend de `prix.js`,
  `js/moteur-*.js`, `js/moteurs/*.js`, `js/pricing.js`, `normes.js`, on **cesse de les charger**
  (retrait des `<script src>`), sans encore les supprimer.
- **R08** : déplacement de ces fichiers vers un **dépôt privé** (le Runtime) ; le dépôt public ne
  garde que l'**interface** + le **client d'accès**. Condition : aucun chemin client ne les référence,
  drapeaux à 100 %, fenêtre d'observation passée.

## Impact sécurité

- **Priorité absolue : les prix.** Tant que `prix.js` est servi au client (via les 28 lectures
  d'affichage), le catalogue complet est **public**. L'étape 2 (vue tarifaire Runtime) est donc la
  **plus importante** : après elle, le client ne reçoit que des **montants d'affichage** calculés, pas
  le catalogue.
- **Règles et normes** (`normes.js`, `moteurs/*.js`, `coherence.js`) : savoir **secondaire** mais
  réel ; migrés ensuite pour que le client ne connaisse plus la mécanique de décision.
- **Surface d'attaque** : à mesure que le calcul quitte le client, il ne reste qu'une interface sans
  logique exploitable ; le Runtime, côté serveur, garde l'**exclusivité** du savoir-faire, avec
  authentification (crochet A10) et journalisation **sans prix** (P3).
- **Réversibilité** : tant que le repli local existe, tout est réversible ; la protection ne devient
  définitive qu'à R08 (retrait public), sous critères stricts.

## Validation Golden Master

R07 **ne modifie aucun code moteur** : c'est un inventaire et une feuille de route. L'état est
inchangé, prouvé par l'exécution intégrale des filets :

```
Golden Master devis / PIÈCE / reco-oublis        → ✅ IDENTIQUES
A08 / A09 / A10 (Modèle / Orchestrateur / API)   → ✅ inchangés
R02 smoke HTTP / parité Runtime                  → ✅ verts
R03 Shadow / R04 sélecteur / R05 devis / R06 pièce → ✅ verts
```

Le **retrait proposé** est une stratégie : rien n'est retiré dans cette mission, donc **aucun
comportement n'est modifié**. Chaque étape future sera, elle aussi, validée par Golden Master + parité
shadow **avant** toute bascule, puis avant tout retrait de chargement.

## Préparation de R08

R07 pose la condition de R08 : **quand** le navigateur ne lira plus ni prix ni règles (toutes les
lectures servies par le Runtime, repli désactivé, fenêtre d'observation passée), R08 pourra
**déplacer** `prix.js`, `js/pricing.js`, `js/moteur-*.js`, `js/moteurs/*.js`, `normes.js` vers un
**dépôt privé** (le Runtime), le dépôt public ne conservant que l'**interface** + le **client
d'accès**. Le Golden Master suivra le moteur dans le dépôt privé ; un **test de parité API** restera
côté public pour garantir l'interface. La **séparation Interface / Moteur DSBAT** sera alors
**définitive**.

## Conclusion

L'inventaire est fait : le navigateur exécute encore le **calcul cœur** (déjà routable, R05/R06), mais
surtout **affiche 28 prix issus du catalogue** — l'exposition majeure du savoir-faire — ainsi que la
**cohérence** et les **recommandations**. Le retrait doit commencer par **les prix** (vue tarifaire
Runtime), puis recap, cohérence et reco, en gardant **le repli local** jusqu'à ce que tout soit servi
côté serveur — moment où l'on **cessera de charger** les moteurs, avant de les **sortir du dépôt
public** (R08). Ce qui reste au navigateur est clairement circonscrit : **validation, lecture DOM,
rendu, interactions, mise en page** — une **interface**, rien de plus. La stratégie est **additive,
prudente et totalement réversible** ; aucun comportement n'est modifié dans cette mission, et tous les
Golden Master sont verts. Le navigateur devient progressivement une simple **fenêtre** sur le Moteur
DSBAT, désormais **exécuté et protégé côté serveur**.

*— MISSION R07 : on sait exactement ce qui doit quitter le navigateur, dans quel ordre, et ce qui doit y rester — l'interface d'un côté, le Moteur DSBAT de l'autre.*
