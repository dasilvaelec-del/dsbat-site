# CERTIFICATION V01 — Audit technique du Runtime DSBAT

> Mission de **certification** (aucun développement). Audit objectif, démontré, sans supposition.
> Chaque conclusion est appuyée par une preuve reproductible (commande + résultat). **Objectif** :
> déterminer si le patrimoine métier DSBAT est **effectivement** protégé par l'architecture Runtime.
>
> ⚠️ **Verdict en une phrase (honnête)** : l'architecture de découplage est **réalisée et prouvée** — le
> navigateur n'exécute plus la logique tarifaire et le Runtime calcule réellement devis/prix — **mais le
> catalogue reste physiquement publié dans le dépôt GitHub public** (`runtime/moteur-prive/prix.js` est
> suivi par git et non exclu). La protection est donc **effective côté application (F12)** mais **pas
> encore côté dépôt/hébergement**. Un seul geste d'hébergement sépare l'état actuel d'une protection forte.

---

## Architecture

Chaîne officielle obtenue (A08→A10 + R01→R10) :

```
NAVIGATEUR (client)                          RUNTIME (moteur)
─────────────────────                        ─────────────────────────────
Interface + validation DOM                   API DSBAT (api-dsbat.js)
Calcul PAR PIÈCE (local, non-tarifaire)  →   Orchestrateur (orchestrateur.js)
Vue tarifaire (prix d'affichage résolus)     Moteurs (devis, pièce, domaines)
Client Runtime (fetch)                   →   Contrat Projet (modele-projet.js)
                                             CATALOGUE (moteur-prive/prix.js, pricing.js)
Devis GLOBAL  ──────────  POST /v1/projets/calcul  ──────────►  Journal de décision (sans prix)
```

Le navigateur **décrit** un Projet et **affiche** ce que le Runtime **calcule**. Le devis global (tableau,
VMC, plomberie, chauffage, zones, TVA) est produit **exclusivement** par le Runtime.

## Cartographie

### Navigateur — 25 fichiers JS réellement chargés (`<script src>` de `devis-configurateur.html`)

| Fichier | Rôle | Catégorie |
|---|---|---|
| `config.js` | configuration (entreprise, base Runtime) | Technique |
| `menu.js` | menu du site | Interface |
| `js/moteur-tva.js` | libellé/taux TVA | Technique |
| `js/parametres-metier.js` | **métrés non-tarifaires** (rendements, pertes, épaisseurs, seuils) + explications | Métier (non-tarifaire) |
| `js/vue-tarifaire.js` | accesseurs de prix d'affichage (lecture de la vue) | Métier (affichage) |
| `js/vue-tarifaire-data.js` | **vue auto-hébergée** : prix d'affichage résolus (min/max/temps/label) | Donnée (affichage) |
| `js/moteur-piece.js`, `js/moteur-piece-complet.js`, `js/moteur-revetements.js` | calcul **par pièce** (surfaces, quantités, chiffrage via la vue) | Métier (non-tarifaire) |
| `js/moteurs/*.js` (9) | **recommandations / oublis** par métier | Métier (règles) |
| `js/coherence.js` | contrôles de **cohérence** | Métier (règles) |
| `js/moteur-devis.js` | orchestration du devis global (**DORMANT** : non appelé par défaut) | Métier (inerte) |
| `js/modele-projet.js` | **Contrat Projet** (construction/empreinte) | Runtime Client |
| `js/runtime-client.js` | appels HTTP au Runtime | Runtime Client |
| `js/shadow.js`, `js/moteur-mode.js`, `js/tarifs-mode.js` | sélecteurs / observation (bascules, réversibilité) | Runtime Client / Technique |

*Preuve* : `grep -oE '<script src="[^"]+"' devis-configurateur.html` → 25 fichiers (aucun `prix.js`, aucun `pricing.js`).

### Runtime — composants côté serveur

| Composant | Fichier |
|---|---|
| **API** | `js/api-dsbat.js` (routes `/v1/sante`, `/v1/tarifs/vue`, `/v1/projets/calcul`, `/v1/pieces/calcul`, …) |
| **Orchestrateur** | `js/orchestrateur.js` |
| **Moteurs** | `js/moteur-devis.js`, `js/moteur-piece*.js`, `js/moteur-revetements.js`, `js/moteurs/*.js` |
| **Référentiel / Contrat** | `js/modele-projet.js` |
| **Catalogue** | `runtime/moteur-prive/prix.js` (PRIX, marges, formules, dimensionnements, zones), `runtime/moteur-prive/pricing.js` |
| **Journal** | `js/journal-decision.js` (journalisation **sans prix**) |
| **HTTP / composition** | `runtime/src/serveur.js`, `composer.js`, `environnement.js` |

## Dépendances

Localisation **démontrée** de chaque élément (définition = où le symbole est déclaré ; exécution = où il tourne).

| Élément | Navigateur | Runtime | Partagé | Justification (preuve) |
|---|:---:|:---:|:---:|---|
| **prix (catalogue complet)** | | ✅ | | `const PRIX =` défini **uniquement** dans `runtime/moteur-prive/prix.js` (0 occurrence dans les 25 fichiers navigateur). |
| **prix d'affichage (min/max)** | ⚠️ | ✅ | | Servis par le Runtime *et* présents dans `vue-tarifaire-data.js` (dérivé, sans marge/formule). |
| **marges (COEF_FOURNITURE ×1,45)** | | ✅ | | Défini uniquement dans le catalogue privé. |
| **catalogue (structure/décompo)** | | ✅ | | `APPAREILLAGE`, `pose/four/app` : privés ; absents de la vue (clés fermées : label/unite/temps/type/prix/min/max). |
| **coefficients (coefZone/ZONES)** | | ✅ | | `function coefZone` défini uniquement dans le catalogue privé ; appliqué par le devis Runtime. |
| **dimensionnements (chiffrants)** | | ✅ | | `dimensionnementTableau/VMC/Plomberie/Chauffage` définis uniquement dans le catalogue privé. |
| **règles métier (cohérence)** | ✅ | ✅ | ✅ | `coherence.js` **s'exécute dans le navigateur** (panel), et le code est aussi disponible côté Runtime. **Sans aucun prix.** |
| **recommandations / oublis** | ✅ | ✅ | ✅ | `moteurs/*.js` **appelés dans le navigateur** (lignes 937, 954, 1015…). **Sans aucun prix.** |
| **normes** | ✅ | | | Encodées dans les seuils publics (`parametres-metier.js`) et les règles (`coherence.js`, `moteurs/*`). `normes.js` **non chargé**. |
| **journaux** | | ✅ | | `journal-decision.js` côté Runtime ; journalisation **sans prix** (P3). |

**Nuances honnêtes** :
- Les **prix d'affichage** (fourchettes min/max par prestation) sont **dérivés** et présents dans
  `vue-tarifaire-data.js` — ce sont les mêmes montants que ceux affichés à l'écran, **sans** marge ni
  formule ni décomposition.
- Les **règles métier** (cohérence, reco/oublis, normes) **s'exécutent encore dans le navigateur**. Elles
  ne contiennent **aucun prix** (les « € » n'apparaissent que dans du texte d'alerte), mais elles restent
  du **savoir-faire exposé** (logique de recommandation et de conformité).

## Audit Runtime

Démonstration en **HTTP réel** (serveur natif Node, port éphémère) :

```
GET  /v1/sante          → 200  service=moteur-dsbat
GET  /v1/tarifs/vue     → 200  304 prestations (prix d'affichage servis par le Runtime)
POST /v1/projets/calcul → 200  totalHT=2427 € · tableau=777 € · coefZ=1  (DEVIS calculé côté serveur)
POST /v1/pieces/calcul  → 200  (calcul par pièce disponible côté Runtime)
```

- ✅ **le Runtime sert réellement le devis** : le chiffrage central (tableau…) est calculé et renvoyé.
- ✅ **le Runtime sert réellement les prix** : `/v1/tarifs/vue` renvoie les 304 prix d'affichage.
- ✅ **le Runtime sert réellement les calculs** : devis global **et** calcul par pièce exposés.
- ✅ **le navigateur est un client** : `renderPhase3`/`genererPDFConfig` appellent `__obtenirDevisRuntime()`
  (POST `/v1/projets/calcul`) ; plus aucun appel synchrone à `calculerDevis` dans le flux par défaut.

## Audit Navigateur

Traçage des symboles sensibles dans les **fichiers réellement chargés** :

- **`PRIX`, `APPAREILLAGE`, `COEF_FOURNITURE`, `prixElec`, `prixPlomberie`, `coefZone`, `MODULES_TABLEAU`,
  `dimensionnement*`** : **0 définition** côté navigateur (toutes dans `moteur-prive/prix.js`).
- **Usages résiduels** (tous inoffensifs car les valeurs secrètes sont **absentes** de la portée navigateur) :
  - `moteur-devis.js` : contient `PRIX`/`coefZone`/`dimensionnement*` mais **`calculerDevis` n'est jamais
    appelé** par défaut (devis global routé au Runtime) → **code dormant**.
  - `vue-tarifaire.js` : `construireVueTarifaire` (lit `PRIX`/`prixElec`) **jamais appelé** au navigateur
    (le client utilise `creerAccesseursVue` sur la vue embarquée) → **code mort au navigateur**.
  - `tarifs-mode.js` : `creerAccesseursCatalogue` (lit `PRIX`) n'est utilisé que par le **repli catalogue**
    (non-défaut) ; `PRIX` étant absent, il ne produit rien.
  - `moteurs/chauffage.js` + `coherence.js` : appellent `dimensionnementChauffage` sous garde
    `typeof … === 'function'` → **court-circuité** (fonction absente) : l'alerte cohérence chauffage est
    simplement omise au navigateur (dégradation mineure, sans impact sur le devis calculé par le Runtime).

**Appels audités** :

| Appel | Exécuté | Preuve |
|---|---|---|
| `calculerDevis` | **Runtime** (défaut) | Navigateur : dormant (garde) ; `POST /v1/projets/calcul`. |
| `calculerPiece` / `calculerPieceComplet` | **Navigateur** (local) | `recalcPiece` → `calculerPieceComplet` (vue + métrés publics, **sans secret**). |
| `getPrixPrestFor`, `getMoyenPrixFor`, `tempsUnitaire` | **Navigateur** via la **vue** | Installés depuis `vue-tarifaire-data.js` (pas de catalogue). |
| `prixElec`, `prixPlomberie`, `coefZone`, `PRIX`, `APPAREILLAGE` | **Runtime uniquement** | Définitions 100 % dans `moteur-prive/prix.js`. |

## Audit GitHub

*Preuve* : `git ls-files | grep -E 'prix\.js|pricing\.js'` →

```
runtime/moteur-prive/pricing.js
runtime/moteur-prive/prix.js
```

- **Présents dans le dépôt public** (racine → interface + tous les `js/` non-tarifaires + la vue dérivée).
- **`prix.js` n'est plus à la racine** ni chargé par le navigateur (déplacé en R10).
- ⚠️ **MAIS** `runtime/moteur-prive/prix.js` (catalogue complet : prix, marges, formules, modules,
  dimensionnements, zones) **est suivi par git** (`git check-ignore` → non ignoré) et **`.gitignore`
  n'exclut pas `runtime/`**. Il n'existe ni `_config.yml` ni `.nojekyll` : le dossier `runtime/` est donc
  **publié sur le dépôt public** et, le site étant servi par **GitHub Pages** (`CNAME` = `dsbat.fr`),
  **vraisemblablement accessible en URL directe** (ex. `https://dsbat.fr/runtime/moteur-prive/prix.js`).

**Élément sensible encore publié : OUI — le catalogue complet.** Il n'est plus *chargé par l'application*,
mais il reste *présent et téléchargeable* dans le dépôt/hébergement public.

## Vérification F12

Si un concurrent ouvre les outils développeur **sur le configurateur** (`dsbat.fr`, onglet Réseau) :

**Ce qu'il récupère** (fichiers effectivement chargés par la page) :
- les **prix d'affichage** par prestation (fourchettes min/max) via `vue-tarifaire-data.js` — *mais ce sont
  les mêmes montants que ceux affichés à l'écran à tout visiteur* ;
- les **métrés non-tarifaires** (rendements, pertes, épaisseurs, seuils NF C 15-100) via `parametres-metier.js` ;
- les **règles** de cohérence et de recommandation (`coherence.js`, `moteurs/*.js`) — textes/logique, **sans prix**.

**Ce qu'il ne récupère plus via l'application** :
- les **marges** (COEF_FOURNITURE ×1,45), la **table d'appareillage**, la **décomposition** pose/fourniture ;
- les **formules** `prixElec`/`prixPlomberie`/`appCost` ;
- les **prix des modules** de tableau, les **taux de main-d'œuvre**, les **coefficients de zone** ;
- le **chiffrage central** (tableau/VMC/plomberie/chauffage) — calculé côté Runtime.

Peut-il reconstruire… (via l'application seule) :
- le **catalogue** ? ❌ non (seuls les prix d'affichage sont visibles, pas la structure/décompo).
- les **prix** ? ⚠️ partiellement — les **fourchettes d'affichage** oui (déjà visibles à l'écran), les **prix de revient / marges** non.
- les **marges** ? ❌ non (COEF_FOURNITURE absent).
- les **formules** ? ❌ non (prixElec/prixPlomberie côté Runtime).
- les **règles métier** ? ⚠️ oui — cohérence/reco/oublis s'exécutent encore dans le navigateur.

> ⚠️ **Réserve majeure** : la question « F12 » ci-dessus ne concerne que **l'application**. Via le **dépôt
> GitHub public** (ou l'URL directe `/runtime/moteur-prive/prix.js`), un concurrent peut aujourd'hui
> **tout** récupérer : catalogue, prix, marges, formules, dimensionnements, zones. **Ce canal reste ouvert.**

## Vérification Golden Master

Aucune régression — **toute la suite exécutée, 0 échec** :

```
Golden Master  devis / PIÈCE / reco-oublis (verify)          → ✅ IDENTIQUES
Migrations (tableau, VMC, chauffage, plomberie, carrelage,
  peinture, sols, isolation, cohérence) + journal + port
  + observateur + A05/A06/A08/A09/A10                        → ✅ 17/17
Runtime R02–R08 (parité, smoke HTTP, shadow, sélecteur,
  bascule devis, bascule pièce, bascule tarifaire)           → ✅ 7/7
Protection R08–R10 :
  • vue tarifaire (parité + zéro secret)                     → ✅ 9/9
  • anti-dérive paramètres (public ≡ privé)                  → ✅ 26/26
  • navigateur SANS pricing.js (pièce, 10 cas)               → ✅ 5/5
  • navigateur SANS prix.js (pièce, 10 cas)                  → ✅ 7/7
  • devis GLOBAL Runtime ≡ local (métiers actifs)            → ✅ 6/6
```

Le comportement (chiffres affichés, devis, PDF) est **byte-identique** à l'avant-migration.

## Niveau de protection

Évaluation **différenciée par canal** (honnête) :

| Canal de fuite | Protection | Justification |
|---|---|---|
| **Application / F12 (Réseau)** | **Forte** | Le catalogue n'est plus chargé ; seuls prix d'affichage + métrés + règles (sans prix) transitent. |
| **Dépôt GitHub public / URL directe** | **Faible** | `runtime/moteur-prive/prix.js` est publié et probablement servi par Pages : catalogue **intégralement** exposé. |
| **Règles métier (reco/normes/cohérence)** | **Faible** | Toujours exécutées et donc lisibles côté navigateur (sans prix, mais savoir-faire exposé). |

**Conclusion effective, aujourd'hui : ☑ Moyenne.**
L'**architecture** (découplage navigateur/Runtime, calcul serveur, réversibilité, Golden Master) est de
qualité **Forte** et rend une protection **Très forte atteignable**. Mais l'**exposition réelle** reste
élevée tant que le catalogue est **physiquement publié**. La protection n'est donc pas encore « Forte »
au sens du patrimoine : **le secret est protégé de l'application, pas du dépôt**.

## Points restant à améliorer

Par ordre d'impact :

1. **Sortir le Runtime du dépôt public (BLOQUANT).** Déplacer `runtime/` (au minimum `runtime/moteur-prive/`)
   vers un **dépôt privé séparé** et un **serveur déployé**. Retirer ces fichiers du dépôt public **et de
   l'historique git** (le catalogue reste sinon accessible dans l'historique). Ajouter `runtime/` à
   `.gitignore` côté public. → fait passer la protection de **Moyenne** à **Forte/Très forte**.
2. **Déployer réellement le Runtime.** `CONFIG.runtime.base` pointe encore `127.0.0.1:8787` : sur `dsbat.fr`,
   le **devis global ne se calcule pas** (état « réessayer »). Renseigner l'URL HTTPS publique + CORS.
3. **Authentifier l'API.** Le crochet d'auth (A10) est ouvert : une fois le Runtime déployé, l'endpoint
   `/v1/projets/calcul` est appelable par quiconque → protéger (clé/App Check/rate-limit) pour éviter le
   rejeu/scraping des prix.
4. **Décider du sort des règles métier** (cohérence, reco/oublis, normes) : les porter au Runtime si elles
   sont considérées comme patrimoine à protéger (elles sont aujourd'hui exécutées au navigateur).
5. **Vue d'affichage** : les fourchettes min/max restent nécessairement visibles (elles sont affichées) ;
   rien à corriger, mais en avoir conscience.

## Conclusion finale

**Honnêtement :** l'objectif d'**architecture** est **atteint et démontré**. Le Runtime est le véritable
moteur — il calcule réellement le devis, sert les prix et les calculs — et le **navigateur ne charge plus
la logique tarifaire** : marges, formules, décompositions, dimensionnements chiffrants et coefficients de
zone ont quitté le code exécuté par la page (prouvé : 0 définition côté navigateur, parité Golden Master
byte-identique, Runtime servant en HTTP réel). **Au sens « F12 sur l'application », le patrimoine tarifaire
est protégé (Forte).**

**Mais l'objectif de _protection du patrimoine_ n'est pas encore effectivement atteint**, pour une raison
unique et clairement identifiée : le catalogue complet (`runtime/moteur-prive/prix.js`) est **toujours
présent dans le dépôt GitHub public** et vraisemblablement **servi en URL directe**. Un concurrent qui
consulte le dépôt — et non l'application — récupère aujourd'hui **tout** le patrimoine tarifaire.

**Protection effective actuelle : Moyenne.** Elle deviendra **Forte/Très forte** dès l'exécution d'**un
seul geste d'hébergement** : déplacer le Runtime (et son catalogue) hors du dépôt public, vers un dépôt
privé + serveur déployé, et purger l'historique. L'ingénierie difficile (découplage réversible, prouvé,
sans régression) est faite ; il reste **une décision d'hébergement**, pas de développement.

*— CERTIFICATION V01 : architecture Runtime certifiée conforme et sans régression ; protection du patrimoine réelle côté application, à finaliser côté dépôt/hébergement (action non-développement).*
