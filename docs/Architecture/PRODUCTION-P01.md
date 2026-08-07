# PRODUCTION – P01

> **Phase Production · Mission P01 — Séparation définitive du Runtime DSBAT (préparation, sans déploiement).**
> Cette mission **ne réalise aucun déploiement** et **ne modifie aucun moteur, règle, calcul ou prix**.
> Elle **prépare** la séparation entre le **dépôt public (interface)** et le **Runtime privé** : classification
> des fichiers, arborescences cibles, dépendances, configuration (ENV/HTTPS/CORS), impacts GitHub Pages,
> et procédures de sauvegarde / mise à jour / retour arrière. Tout est **démontré** sur l'état réel du dépôt.

---

## Objectifs

La certification V01 a établi que la seule faiblesse restante est **de déploiement** : le catalogue
(`runtime/moteur-prive/prix.js`) est toujours **suivi par git** dans le dépôt public et vraisemblablement
servi par GitHub Pages. P01 prépare l'état cible :

- **Dépôt public** `dsbat-site` (GitHub Pages, `dsbat.fr`) : **interface + client**, aucun secret.
- **Dépôt privé** `dsbat-runtime` (serveur dédié) : **moteur + catalogue + orchestration**, jamais publié.

Contrainte de vérité : le navigateur exécute **encore** le calcul par pièce et les règles (cohérence,
reco/oublis) — non-secrets mais du savoir-faire. P01 sépare **le secret tarifaire** (objectif prioritaire) ;
rendre le navigateur *purement* client (déplacer pièce + règles au Runtime) est une phase **ultérieure**.

## Dépôt public

**`dsbat-site` — ce qui RESTE (interface + client, zéro secret).**

Contenu du site (inchangé) : toutes les pages `*.html` (vitrine, SEO, réalisations, `devis-configurateur.html`),
`styles.css`, `image/`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `CNAME`, vérifications moteurs de recherche,
`README.md`, `config.js`, `menu.js`, `devis-common.js`.

JavaScript **chargé par le navigateur** (client + moteur non-secret nécessaire à l'interface) — **25 scripts**,
dont depuis `js/` :

| Fichier | Rôle | Catégorie |
|---|---|---|
| `runtime-client.js`, `modele-projet.js` | appel Runtime + Contrat Projet | Runtime Client |
| `moteur-mode.js`, `tarifs-mode.js`, `shadow.js` | sélecteurs / bascules / réversibilité | Technique |
| `vue-tarifaire.js`, `vue-tarifaire-data.js` | accesseurs + **vue de prix d'affichage** (dérivé) | Affichage |
| `parametres-metier.js` | métrés non-tarifaires + explications | Métier (non-tarifaire) |
| `moteur-piece.js`, `moteur-piece-complet.js`, `moteur-revetements.js` | calcul **par pièce** (local) | Métier (non-tarifaire) |
| `moteurs/*.js` (9) | recommandations / oublis | Métier (règles) |
| `coherence.js` | contrôles de cohérence | Métier (règles) |
| `moteur-tva.js` | libellé/taux TVA | Technique |

**Ce qui QUITTE le dépôt public** (vers le privé) :

- **Secret** : `runtime/moteur-prive/prix.js`, `runtime/moteur-prive/pricing.js`.
- **Serveur Runtime** : tout `runtime/src`, `runtime/bin`, `runtime/tests`, `runtime/rapports`, `runtime/package.json`.
- **Moteur non chargé par le navigateur** (aucune page ne les référence — prouvé) : `js/api-dsbat.js`,
  `js/orchestrateur.js`, `js/journal-decision.js`, `js/moteur-recommandations.js`, `js/*-savoir.js` (8),
  `js/observateur-*.js` (9), `js/port-savoir.js`, et `js/moteur-devis.js` (**dormant** : plus appelé par défaut).
- **Golden Master** : `tests/golden-master/*` **suit le moteur** dans le privé (référence de non-régression).
  Un **test de parité API** léger peut rester public pour surveiller l'interface.

> **Nettoyage requis (constat P01)** : 8 pages `devis-electricite/plomberie/carrelage/isolation/menuiserie/
> peinture/sols/vmc.html` contiennent encore `<script src="prix.js">` **mort** (0 usage du catalogue, fichier
> désormais absent → 404). À supprimer lors de la migration (ni fuite ni fonction, simple résidu).

## Dépôt privé

**`dsbat-runtime` — le moteur complet, jamais publié.**

```
dsbat-runtime/                         (dépôt PRIVÉ)
├─ moteur-prive/
│   ├─ prix.js          ← CATALOGUE (prix, marges ×1,45, formules, dimensionnements, zones)  ★SECRET
│   └─ pricing.js       ← accesseurs catalogue                                                ★SECRET
├─ moteur/              ← moteur non-secret déplacé du public
│   ├─ moteur-devis.js  orchestrateur.js  api-dsbat.js  journal-decision.js
│   ├─ moteur-recommandations.js  *-savoir.js  observateur-*.js  port-savoir.js
│   └─ (partagés requis : voir « Dépendances »)
├─ src/    composer.js  environnement.js  serveur.js
├─ bin/    demarrer.js  generer-vue.js
├─ tests/  golden-master/*  + tests runtime (parité, smoke, bascules)
├─ package.json
├─ .env.example
└─ interface/          ← (option A) git submodule → dsbat-site, fournit les modules PARTAGÉS
```

**Modules PARTAGÉS** (non-secrets, requis par le navigateur **ET** le Runtime) : `modele-projet.js`,
`moteur-tva.js`, `moteur-piece.js`, `moteur-piece-complet.js`, `moteur-revetements.js`, `moteurs/peinture.js`
(et les autres `moteurs/*` pour les règles), `vue-tarifaire.js`. Source de vérité = **dépôt public** ; le
Runtime les consomme via **submodule** (recommandé, zéro dérive) ou **vendoring + CI de synchro** (alternative).

## Runtime

Dépendances **réelles** du Runtime (relevé `require` de `runtime/src` + `runtime/bin`) :

```
composer.js       → js/{modele-projet, orchestrateur, journal-decision, api-dsbat}
environnement.js  → moteur-prive/prix.js  (★) ,  js/{moteur-tva, moteurs/peinture,
                    moteur-piece, moteur-revetements, moteur-piece-complet, moteur-devis, vue-tarifaire}
serveur.js        → http (natif, zéro dépendance externe)
tests/*           → moteur-prive/{prix,pricing}.js + Golden Master
```

Le Runtime est **autonome** (Node ≥ 18, `"dependencies": {}`). Il expose l'API A10 :
`GET /v1/sante`, `GET /v1/tarifs/vue`, `POST /v1/projets/calcul`, `POST /v1/pieces/calcul`.
**Artefact dérivé** : `bin/generer-vue.js` régénère `vue-tarifaire-data.js` (non secret) **publié vers le
dépôt public** — c'est le **seul flux privé → public**.

**Dépendances Interface ↔ Runtime (contrat clair)** :

```
Interface (dsbat.fr)                     Runtime (api.dsbat.fr)
  Projet DSBAT (A08) ───POST /v1/projets/calcul──►  devis complet (JSON)
  vue-tarifaire-data.js  ◄──── généré/publié ────   moteur-prive/prix.js
  (aucune autre dépendance runtime au chargement des pages)
```

## GitHub Pages

- **Retrait de `runtime/`** du dépôt public → Pages ne sert plus `/runtime/*` (fin de l'exposition en URL directe).
- Ajouter `runtime/` (et `moteur-prive/`) au **`.gitignore`** public (ceinture + bretelles).
- `CNAME = dsbat.fr` **reste** sur le dépôt public (Pages). Le Runtime vit sur un **sous-domaine séparé**
  (`api.dsbat.fr` ou `runtime.dsbat.fr`) pointant vers le serveur dédié — **jamais** servi par Pages.
- Pas de `_config.yml`/`.nojekyll` aujourd'hui : inutile une fois `runtime/` retiré, mais on peut ajouter un
  `.nojekyll` pour servir les fichiers tels quels.
- **Impact SEO/vitrine : nul** (seuls des fichiers non référencés par les pages sont retirés).

## Hébergement

Le Runtime est un serveur **Node natif** (aucune dépendance) : hébergeable sur toute plateforme Node.

| Option | HTTPS | CORS | Remarque |
|---|---|---|---|
| PaaS (Render / Railway / Fly.io) | TLS managé | via `serveur.js` | déploiement git privé, simple |
| VPS + reverse proxy (Caddy/nginx) | Let's Encrypt | proxy ou app | contrôle total |
| Cloudflare Tunnel + VPS | TLS Cloudflare | app | masque l'IP d'origine |

Recommandation : **PaaS** (déploiement depuis `dsbat-runtime` privé, HTTPS automatique, variables d'ENV
gérées par la plateforme), sous-domaine `api.dsbat.fr`.

## Variables d'environnement

Fichier `.env.example` (dépôt privé — jamais de secret en clair dans le code) :

```
DSBAT_PORT=8787                       # port d'écoute
DSBAT_ALLOWED_ORIGINS=https://dsbat.fr,https://www.dsbat.fr   # allowlist CORS (production)
DSBAT_AUTH_MODE=apikey                # off | apikey (activer avant exposition publique)
DSBAT_API_KEY=__défini_par_la_plateforme__            # clé attendue (crochet A10)
DSBAT_CONTRACT_VERSIONS=1             # majeures de contrat supportées
NODE_ENV=production
```

Côté **interface** (public, non secret) : `config.js → CONFIG.runtime.base = "https://api.dsbat.fr"`.
`sourceDevis: "runtime"` (défaut). Aucune clé secrète côté navigateur.

## HTTPS

- **Interface** : déjà en HTTPS via GitHub Pages (`dsbat.fr`).
- **Runtime** : **obligatoirement en HTTPS** (le navigateur en HTTPS ne peut pas appeler un endpoint HTTP —
  *mixed content*). TLS fourni par la plateforme PaaS ou un reverse proxy (Caddy/Let's Encrypt).
- Certificat sur `api.dsbat.fr` ; redirection HTTP→HTTPS ; HSTS recommandé.

## CORS

`serveur.js` gère déjà les en-têtes CORS (`Access-Control-Allow-Origin`, `-Methods`, `-Headers`, pré-vol
`OPTIONS`). En production :

- Remplacer l'origine permissive `*` par l'**allowlist** `DSBAT_ALLOWED_ORIGINS` (via `options.origine`).
- Autoriser `GET, POST, OPTIONS` et l'en-tête d'authentification.
- **Rappel sécurité (certification)** : CORS **ne protège pas** le serveur (il protège les navigateurs
  tiers). La vraie protection de l'endpoint est l'**authentification** (`DSBAT_AUTH_MODE=apikey`) +
  rate-limit, à activer **avant** exposition publique — sinon les prix restent scrapables via l'API.

## Sauvegardes

- **Catalogue** : versionné dans le dépôt **privé** (git) ; **tags de version** à chaque changement de prix ;
  copie hors-ligne (le dossier de travail local + un miroir privé). C'est la **source de vérité**.
- **Golden Master** : `reference*.json` conservés dans le privé — baseline de non-régression, sauvegardée avec le catalogue.
- **Artefact dérivé** `vue-tarifaire-data.js` : **régénérable** (`generer-vue.js`) → pas une sauvegarde
  critique, mais versionné dans le public pour le site.
- **Archive de bascule** : **tag `pre-split`** du monorepo actuel avant migration (retour arrière total possible).

## Retour arrière

Trois niveaux, du plus fin au plus radical :

1. **Application (immédiat)** : `CONFIG.runtime.base` repointe un Runtime précédent ; `CONFIG.runtime.sourceDevis`
   et le sélecteur R04/R05 permettent de rebasculer (le calcul par pièce et l'affichage restent hors-ligne).
2. **Runtime (déploiement)** : redéployer le **tag privé précédent** ; l'API est **versionnée** (négociation
   de contrat A10) → compatibilité ascendante.
3. **Dépôt (structurel)** : le **tag `pre-split`** restaure le monorepo complet (interface + moteur + catalogue)
   en un `git checkout`. La migration est donc **totalement réversible** tant que l'archive existe.

## Procédure de migration

*(À exécuter lors d'une future mission de déploiement — décrite ici, non réalisée.)*

1. **Archiver** : `git tag pre-split` sur le monorepo actuel (filet de retour arrière).
2. **Créer le dépôt privé** `dsbat-runtime` : y importer `runtime/`, `moteur-prive/`, le moteur non-public
   (`api-dsbat`, `orchestrateur`, `journal-decision`, `moteur-devis`, `*-savoir`, `observateur-*`,
   `moteur-recommandations`, `port-savoir`) et `tests/golden-master`. Ajouter les modules **partagés** via
   **submodule** du public (ou vendoring). Ajuster les chemins `require` (résolution de modules — **aucune
   logique moteur modifiée**).
3. **Purger le secret de l'historique public (OBLIGATOIRE)** : `git filter-repo` (ou BFG) pour supprimer
   `prix.js` et `pricing.js` de **tout l'historique** (présents dans **25 commits**). Sans cela, le catalogue
   reste accessible dans l'historique GitHub. *Alternative plus sûre : recréer un dépôt public neuf sans
   l'historique sensible.*
4. **Nettoyer le public** : retirer `runtime/`, les `js/` moteur non-chargés, les 8 `<script src="prix.js">`
   morts ; ajouter `runtime/` à `.gitignore` ; conserver un test de parité API léger.
5. **Déployer le Runtime** : PaaS/VPS sur `api.dsbat.fr`, HTTPS, ENV (CORS allowlist + auth activée).
6. **Configurer l'interface** : `CONFIG.runtime.base = https://api.dsbat.fr` dans le public.
7. **Valider** : Golden Master **privé** vert ; smoke live (`/v1/sante`, `/v1/projets/calcul` depuis `dsbat.fr`) ;
   vue d'affichage à jour ; PDF/devis identiques (parité déjà prouvée R10).
8. **Mise à jour continue** : changement de prix → privé → Golden Master → `generer-vue.js` → publier la vue
   dérivée au public → déployer le Runtime.

## Conclusion

La séparation est **entièrement spécifiée** et **prête à exécuter**, sans toucher au moteur. L'état cible :
un **dépôt public** `dsbat-site` réduit à l'**interface et au client** (aucun prix, aucune marge, aucune
formule, aucun catalogue), et un **dépôt privé** `dsbat-runtime` détenant le **catalogue secret**, le
**moteur** et l'**API**, déployé sur un **serveur dédié** en HTTPS avec CORS restreint et authentification.
Le seul flux privé → public est l'**artefact d'affichage dérivé** (`vue-tarifaire-data.js`).

Trois points d'attention sont **clairement identifiés** : (1) la **purge de l'historique git** public est
**obligatoire** (le catalogue y figure encore, 25 commits) ; (2) l'**authentification de l'API** doit être
active **avant** exposition (le CORS ne suffit pas) ; (3) le navigateur **n'est pas encore un client pur** —
il exécute toujours le calcul par pièce et les règles (non-secrets), dont le portage éventuel au Runtime
relève d'une **phase ultérieure**. Une fois la migration exécutée, **GitHub ne contiendra plus que
l'interface** et le **patrimoine tarifaire vivra exclusivement dans le Runtime privé** — faisant passer la
protection effective de **Moyenne** à **Forte/Très forte**. Réversibilité garantie par le tag `pre-split`.

*— PRODUCTION P01 : séparation Interface / Runtime spécifiée, sourcée et réversible ; prête pour un déploiement ultérieur, sans aucune modification du moteur.*
