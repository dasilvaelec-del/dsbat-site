# DÉPLOIEMENT – D01

> **Phase Déploiement · Mission D01 — Préparation du dépôt privé Runtime.**
> Mission **documentaire** : aucun code, aucun moteur, aucun calcul modifié. Guide d'exécution **git**
> pas à pas pour créer le dépôt **privé** `dsbat-runtime` **sans risque**, avec conservation de
> l'historique utile, gestion des modules partagés, versionning, synchronisation et retour arrière.
> Les commandes sont fournies pour une **exécution future** ; **rien n'est exécuté ici**.

---

## Objectifs

Séparer le dépôt en deux, sur la base des faits établis (P01) :

- **Le seul secret** est `runtime/moteur-prive/prix.js` + `pricing.js` (+ leur présence dans l'historique :
  `prix.js` fut à la racine, **25 commits** concernés).
- **`js/` est entièrement non-secret** ; il contient **23 fichiers chargés par le navigateur** (à garder
  public) et **23 fichiers Runtime/tests uniquement** (privé-only).
- Le Runtime (`runtime/src`) **résout ses `require` par rapport à la racine du dépôt** (`RACINE/js/…`,
  `RACINE/runtime/moteur-prive/…`). Pour **ne modifier aucun code**, le dépôt privé **conserve la même
  arborescence** (`js/`, `runtime/`, `tests/`) → tous les `require` résolvent tels quels.

Principe directeur : **dépôt privé = moteur complet auto-suffisant** (les Golden Master s'y exécutent sans
modification) ; **dépôt public = interface** (site + JS navigateur), **sans secret et sans historique
sensible**.

## Dépôt public

`dsbat-site` (GitHub Pages, `dsbat.fr`) — **ce qui reste** :

- Toutes les pages `*.html`, `styles.css`, `image/`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `CNAME`,
  fichiers de vérification, `README.md`, `config.js`, `menu.js`, `devis-common.js`.
- Les **23 `js/` chargés par le navigateur** : `coherence.js`, `modele-projet.js`, `moteur-devis.js`
  (dormant, mais toujours inclus par le HTML → conservé pour **ne pas toucher au code**), `moteur-mode.js`,
  `moteur-piece.js`, `moteur-piece-complet.js`, `moteur-revetements.js`, `moteur-tva.js`, `moteurs/*.js` (9),
  `parametres-metier.js`, `runtime-client.js`, `shadow.js`, `tarifs-mode.js`, `vue-tarifaire.js`,
  `vue-tarifaire-data.js`.
- `docs/` (documentation d'architecture).

**Ce qui QUITTE le public** (vers le privé) et est **purgé de l'historique** : `runtime/` (dont
`moteur-prive/` ★secret), `tests/`, et les **23 `js/` Runtime-only** : `api-dsbat.js`, `orchestrateur.js`,
`journal-decision.js`, `moteur-recommandations.js`, `port-savoir.js`, `js/*-savoir.js` (9),
`js/observateur-*.js` (9). Plus la purge historique de `prix.js` et `pricing.js`.

## Dépôt Runtime privé

`dsbat-runtime` (privé, serveur `api.dsbat.fr`) — **auto-suffisant**, même arborescence que le monorepo pour
que les `require` résolvent sans modification :

- `runtime/` : `src/` (composer, environnement, serveur), `bin/` (demarrer, generer-vue), `tests/`,
  `rapports/`, `package.json`, **`moteur-prive/{prix,pricing}.js` ★secret**.
- `js/` : **le moteur complet** (les 23 modules Runtime-only **+** les modules partagés requis :
  `modele-projet`, `moteur-tva`, `moteur-piece`, `moteur-piece-complet`, `moteur-revetements`,
  `moteurs/*`, `vue-tarifaire`, `moteur-devis`, `coherence`…).
- `tests/golden-master/` : la **référence de non-régression** voyage avec le moteur.
- `.env.example`, `README` privé.

> Les **modules partagés** (chargés aussi par le navigateur) sont **présents dans les deux dépôts**. Ils
> sont **non-secrets** : la duplication ne crée **aucune fuite**, seulement un besoin de **synchronisation**
> (voir plus bas). Une variante **submodule** (dé-duplication stricte) est décrite en fin de section.

## Arborescence

```
dsbat-site  (PUBLIC, Pages)              dsbat-runtime  (PRIVÉ, serveur)
├─ index.html … (toutes les pages)       ├─ runtime/
├─ styles.css  image/  favicon.svg       │   ├─ src/{composer,environnement,serveur}.js
├─ config.js  menu.js  devis-common.js   │   ├─ bin/{demarrer,generer-vue}.js
├─ js/                                    │   ├─ tests/*  rapports/*  package.json
│   ├─ (23 modules navigateur :          │   └─ moteur-prive/{prix,pricing}.js   ★SECRET
│   │   modele-projet, moteur-piece*,     ├─ js/
│   │   moteur-revetements, moteur-tva,   │   ├─ (moteur complet : api-dsbat, orchestrateur,
│   │   moteurs/*, coherence, vue-*,      │   │   journal-decision, moteur-devis, moteur-recommandations,
│   │   parametres-metier, runtime-client,│   │   *-savoir, observateur-*, port-savoir,
│   │   moteur-mode, shadow, tarifs-mode) │   │   + modules partagés : modele-projet, moteur-piece*,
│   └─ (PAS de moteur Runtime-only)       │   │     moteur-revetements, moteur-tva, moteurs/*, vue-tarifaire)
├─ docs/                                  ├─ tests/golden-master/*   (référence)
└─ (PAS de runtime/, PAS de secret,       ├─ .env.example
    historique PURGÉ du catalogue)        └─ README (privé)
```

## Synchronisation

**Un seul flux automatisé : PRIVÉ → PUBLIC** (le moteur produit, l'interface consomme).

1. **Artefact dérivé** (obligatoire) : après tout changement de catalogue,
   `node runtime/bin/generer-vue.js` régénère `js/vue-tarifaire-data.js` (+ `runtime/rapports/vue-tarifaire.json`)
   → **publier `js/vue-tarifaire-data.js` vers le public**.
2. **Modules partagés** (rares) : si un module partagé évolue **côté moteur** (privé), copier la version vers
   le public via un script dédié `publier-vers-public.sh` (liste blanche fixe) :
   ```
   FILES="js/modele-projet.js js/moteur-tva.js js/moteur-piece.js js/moteur-piece-complet.js \
          js/moteur-revetements.js js/vue-tarifaire.js js/vue-tarifaire-data.js js/coherence.js \
          js/moteur-devis.js $(cd dsbat-runtime && ls js/moteurs/*.js)"
   for f in $FILES; do cp "dsbat-runtime/$f" "dsbat-site/$f"; done
   # puis, dans dsbat-site : git add js/ && git commit -m "sync moteur → interface" && git push
   ```
3. **Anti-dérive** : un test compare les modules partagés public↔privé (sur le modèle de
   `parametres-drift-check.js`) → **échoue si divergence** (à lancer en CI des deux côtés).

**Sens interface → moteur** : les changements **de site** (HTML/CSS/pages, glue client `runtime-client`,
`moteur-mode`, `shadow`, `tarifs-mode`) restent **publics** et **ne remontent pas** au privé (le moteur n'en
dépend pas). Règle : **un fichier = un propriétaire** (moteur=privé, présentation=public).

> **Variante submodule (dé-duplication stricte)** : extraire les modules partagés dans un 3ᵉ dépôt
> `dsbat-moteur-core` monté en **submodule** dans les deux. Plus propre, mais impose d'**ajuster les chemins
> de résolution** (configuration de modules, non métier) — à réserver si la duplication devient pénible.

## Commandes Git

> **Prérequis** : `git`, `git filter-repo` (`pip install git-filter-repo`), une **sauvegarde** du monorepo.
> Travailler sur des **clones dédiés** (jamais sur le dépôt de travail courant).

**0) Filet de sécurité (sur le monorepo actuel)**
```
git tag pre-split && git push origin pre-split      # retour arrière total
git bundle create ../dsbat-monorepo-backup.bundle --all   # archive hors-ligne
```

**1) Créer les dépôts distants** : sur GitHub, créer `dsbat-runtime` en **privé** (vide) et, au besoin, un
nouveau `dsbat-site` public (option « repo neuf » de la purge).

**2) Construire le dépôt PRIVÉ (conserve l'historique utile : js/, runtime/, tests/)**
```
git clone --no-local <monorepo> dsbat-runtime && cd dsbat-runtime
git filter-repo --path js/ --path runtime/ --path tests/          # garde ces chemins + leur historique
git remote add origin git@github.com:<compte>/dsbat-runtime.git
git branch -M main && git push -u origin main
# Validation immédiate : le moteur est auto-suffisant
node runtime/tests/parite-runtime.js && node runtime/tests/smoke-http.js
node tests/golden-master/golden-master.js verify
```

**3) Construire/nettoyer le dépôt PUBLIC (retrait moteur + PURGE du secret dans TOUT l'historique)**
```
git clone --no-local <monorepo> dsbat-site && cd dsbat-site
git filter-repo \
  --path prix.js --path js/pricing.js \
  --path runtime/ \
  --path js/api-dsbat.js --path js/orchestrateur.js --path js/journal-decision.js \
  --path js/moteur-recommandations.js --path js/port-savoir.js \
  --path-glob 'js/*-savoir.js' --path-glob 'js/observateur-*.js' \
  --path tests/ \
  --invert-paths            # SUPPRIME ces chemins de tout l'historique (dont le catalogue)
echo "runtime/"      >> .gitignore
echo "moteur-prive/" >> .gitignore
git add .gitignore && git commit -m "P01 : interface seule, catalogue et moteur retirés"
git remote set-url origin git@github.com:<compte>/dsbat-site.git
git push --force origin main      # réécrit l'historique public (prévenir les collaborateurs)
```

**4) Branches & versionning** (voir sections suivantes) puis **vérifications** (section dédiée).

## Configuration des branches

- **`main`** : branche **de production** (déployée). Protégée (revue + CI verte obligatoire).
- **`develop`** (optionnel) : intégration ; fusion vers `main` par PR.
- **Correctifs** : `hotfix/*` → `main` (+ back-merge `develop`).
- **Privé** : CI = Golden Master + tests runtime **verts** avant fusion sur `main`.
- **Public** : CI = anti-dérive modules partagés + lint HTML ; `main` = ce que sert Pages.

## Stratégie de versionning

- **Runtime (SemVer)** : `vMAJ.MIN.PATCH` taggé sur `dsbat-runtime` à chaque déploiement.
  - **MAJEUR** = rupture du **contrat A08/A10** (négociation de version déjà en place).
  - **MINEUR** = évolution compatible (nouveau champ, nouvel endpoint).
  - **CORRECTIF** = correction sans changement de contrat.
- **Catalogue** : tag dédié `catalogue-AAAA-MM-JJ` (ou version incrémentale) à chaque changement de prix,
  **accompagné** de la mise à jour du Golden Master (référence) **assumée**.
- **Contrat** : `VERSION_CONTRAT` (modele-projet) et `VERSION_API` (api-dsbat) restent la **source de
  vérité** de compatibilité client/serveur ; les tags git les reflètent.
- **Interface** : versionnée par les commits Pages ; référence le Runtime via `CONFIG.runtime.base` (pas de
  version en dur, compat via négociation).

## Vérifications

**Points de contrôle après création des dépôts :**

1. **Privé auto-suffisant** :
   ```
   cd dsbat-runtime
   node tests/golden-master/golden-master.js verify        # ✅ IDENTIQUE
   node tests/golden-master/piece-golden-master.js verify  # ✅ IDENTIQUE
   node runtime/tests/parite-runtime.js                    # ✅ vert
   node runtime/bin/demarrer.js & curl -s localhost:8787/v1/sante   # ✅ 200
   ```
2. **Public sans secret (arbre ET historique)** :
   ```
   cd dsbat-site
   git ls-files | grep -E 'prix\.js|pricing\.js|moteur-prive|^runtime/' || echo "OK: aucun secret suivi"
   git log --all --oneline -- prix.js js/pricing.js runtime/moteur-prive || echo "OK: absent de l'historique"
   ```
3. **Public fonctionnel** : `devis-configurateur.html` charge bien les 23 `js/` navigateur + la vue ;
   les prix par prestation s'affichent (hors-ligne) ; le devis global appelle le Runtime.
4. **Anti-dérive** : les modules partagés public↔privé sont **identiques** (test dédié vert).

## Rollback

Trois niveaux, du plus rapide au plus radical :

1. **Ne rien basculer tant que non validé** : le **monorepo actuel reste la production** jusqu'à ce que les
   deux nouveaux dépôts soient vérifiés. La séparation est un **ajout**, pas une bascule immédiate.
2. **Tag `pre-split`** : `git checkout pre-split` (ou restauration du **bundle**) restaure le monorepo
   complet (interface + moteur + catalogue + historique) à l'identique.
3. **Par dépôt** : le dépôt privé conserve tout le moteur (aucune perte) ; le public, en cas de purge
   erronée, est reconstruisible depuis `pre-split`. Conserver `pre-split` et le bundle **hors-ligne** au
   moins jusqu'à la mise en production validée (E01).

## Risques

| Risque | Prévention | Retour arrière |
|---|---|---|
| **Purge d'historique incomplète** (secret encore présent) | vérifier `git log --all -- prix.js …` = vide ; utiliser `filter-repo` (fiable) | dépôt neuf public depuis `pre-split` |
| **`require` cassés dans le privé** | conserver l'arborescence `js/`+`runtime/` identique ; lancer Golden Master | corriger la liste `filter-repo` ; `pre-split` |
| **Dérive des modules partagés** | script de sync one-way + **test anti-dérive** en CI | resynchroniser depuis le privé (source de vérité) |
| **`push --force` public destructeur** | prévenir collaborateurs ; sauvegarder le bundle ; fenêtre planifiée | restaurer depuis `pre-split`/bundle |
| **Secret dans les forks/caches GitHub** | considérer le catalogue comme **potentiellement déjà vu** ; l'auth API (S01) protège l'exploitation | rotation ultérieure du modèle de prix si jugé nécessaire |
| **Oubli d'un module Runtime-only requis** | la liste `js/` privé = **tout** `js/` (auto-suffisant) → aucun oubli | ajouter le fichier manquant depuis `pre-split` |

## Conclusion

La création du dépôt privé est **spécifiée de bout en bout**, **reproductible** et **sans risque** : le dépôt
privé **conserve l'arborescence** (donc **aucun `require` ni code modifié**) et embarque le **moteur complet
+ le Golden Master**, tandis que le dépôt public devient **l'interface seule**, **sans secret** et
**historique purgé** (`prix.js`/`pricing.js`/`runtime/` retirés des **25 commits** concernés). Les **modules
partagés non-secrets** sont gérés par une **synchronisation à sens unique** (moteur → interface) doublée d'un
**test anti-dérive** ; le **versionning** suit SemVer + le contrat A10. La séparation est **additive** : le
**monorepo `pre-split`** reste la production tant que les deux dépôts ne sont pas **vérifiés** (Golden Master
privé vert, secret absent du public en arbre **et** en historique), garantissant un **retour arrière
immédiat**. Aucune modification du moteur métier.

*— DÉPLOIEMENT D01 : guide git de création du dépôt privé Runtime, reproductible et réversible, prêt pour exécution, sans toucher au moteur.*
