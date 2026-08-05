# Runtime DSBAT – R02

> **Phase Runtime · Mission R02 — Premier déploiement.** Le Runtime DSBAT est installé **en
> parallèle** du configurateur : une infrastructure serveur qui héberge l'API (A10), l'Orchestrateur
> (A09), le contrat Projet (A08), le Port, le Journal et les moteurs métier, **démarrable
> indépendamment**. **Aucun changement visible** : le configurateur continue d'utiliser le moteur
> local, aucune bascule n'est réalisée. Le Golden Master reste la référence absolue.

---

## Objectifs

Poser la **première brique d'infrastructure** du Runtime, de façon **totalement additive** :

1. Un serveur capable d'exécuter le moteur **côté serveur**, sans qu'aucun client n'y soit branché.
2. Une **composition** claire des briques déjà livrées (environnement → Orchestrateur → API).
3. Des **points d'entrée** HTTP opérationnels (santé, versions, validation, calcul).
4. La **preuve** que ce Runtime reproduit exactement la référence Golden Master.
5. Aucune modification du configurateur, des calculs, des règles, des prix, de l'interface ou des
   devis.

## Architecture proposée

Le Runtime **compose** des composants existants ; il n'en réécrit aucun.

```
   bin/demarrer.js
        │  démarre
        ▼
   src/serveur.js  (HTTP natif)  ── req/res ⇄ requete/reponse ──▶  API (js/api-dsbat.js, A10)
        ▲                                                              │ orchestrer(projet)
        │ compose                                                      ▼
   src/composer.js ──▶ Orchestrateur (js/orchestrateur.js, A09) ──▶ Moteurs (adaptateur globales)
        │                                                              ▲
        └──▶ src/environnement.js (PRIX, sous-moteurs, tauxTVA, window, calculerDevis)
                     = MÊME montage que le harnais Golden Master
```

Trois couches, chacune sans logique métier :

- **`environnement.js`** installe l'environnement d'exécution des moteurs — **identique** au harnais
  `tests/golden-master/golden-master.js` — d'où des résultats byte-identiques.
- **`composer.js`** câble les briques par **injection de dépendances** : adaptateur moteurs →
  Orchestrateur → API. Le Journal est fourni par sa fabrique, le Modèle est le contrat A08.
- **`serveur.js`** est le **seul** composant qui connaît `http` : il traduit les requêtes réelles en
  objets simples attendus par l'API pure, et inversement.

## Arborescence

```
runtime/
  README.md
  package.json                 (aucune dépendance externe ; scripts start / parite / smoke)
  bin/
    demarrer.js                point d'entrée (serveur HTTP, démarrable seul)
  src/
    environnement.js           installe l'environnement des moteurs (= Golden Master)
    composer.js                compose environnement → Orchestrateur (A09) → API (A10)
    serveur.js                 adaptateur HTTP natif (req/res ⇄ requete/reponse)
  tests/
    parite-runtime.js          parité Runtime ⇄ reference.json (in-process)
    smoke-http.js              démarrage HTTP réel + requêtes localhost
```

Le dossier `runtime/` est **entièrement nouveau** : rien hors de lui n'est modifié.

## Composants installés

| Brique | Origine (référencée, non copiée) | Rôle dans le Runtime |
|--------|----------------------------------|----------------------|
| **API** | `js/api-dsbat.js` (A10) | Porte d'entrée HTTP (4 endpoints) |
| **Orchestrateur** | `js/orchestrateur.js` (A09) | Coordination pure |
| **Contrat Projet** | `js/modele-projet.js` (A08) | Validation / assemblage du Projet |
| **Port d'Accès au Savoir** | `js/port-savoir.js` | Disponible pour les moteurs (préparé) |
| **Journal de Décision** | `js/journal-decision.js` | Journalisation de coordination |
| **Moteurs métier** | `prix.js`, `js/moteur-*.js`, `js/moteurs/*.js` | Calcul (via l'adaptateur globales) |

Toutes ces briques sont **requises** (source unique de vérité) — jamais dupliquées.

## Adaptateurs créés

1. **Adaptateur d'environnement** (`environnement.js`) : installe `PRIX`, les sous-moteurs de
   dimensionnement, `tauxTVA`, le shim `window`, puis charge `calculerDevis`. Reproduit exactement le
   montage du Golden Master → résultats identiques.
2. **Adaptateur HTTP** (`serveur.js`) : serveur Node natif qui mappe `req/res` ↔ `requete/reponse`,
   lit le corps (limite de sécurité 1 Mo, `413` au-delà), gère le **pré-vol CORS** (`OPTIONS`) et
   ajoute des en-têtes CORS permissifs en préparation du **shadow R03** depuis le navigateur.
3. **Réutilisation de l'adaptateur moteurs** (`creerAdaptateurMoteursGlobaux`, livré en A09) : le
   seul composant qui connaît les globales — l'Orchestrateur et l'API restent purs.

Aucun adaptateur ne contient de logique métier ; ils ne font que **traduire** et **câbler**.

## Compatibilité avec le configurateur actuel

Le configurateur **n'est pas modifié** : `devis-configurateur.html` ne référence pas `runtime/`
(vérifié : 0 occurrence). Il continue de charger `prix.js` et les moteurs, et d'appeler
`calculerDevis` / `calculerPiece` **localement**, exactement comme avant. Le Runtime tourne **à
côté**, sans client branché. **Aucune bascule** n'est réalisée dans cette mission.

## Validation Golden Master

```
node runtime/tests/parite-runtime.js  → ✅ 5 cas : devis identiques à reference.json (via Runtime composé)
node runtime/tests/smoke-http.js       → ✅ 5 assertions : démarrage HTTP réel, /v1/sante 200, /calcul 200, 404
node tests/golden-master/golden-master.js verify        → ✅ IDENTIQUE
node tests/golden-master/piece-golden-master.js verify  → ✅ IDENTIQUE
node tests/golden-master/reco-oublis-domain-golden.js verify → ✅ IDENTIQUE
node tests/golden-master/a08/a09/a10-check.js           → ✅ Modèle / Orchestrateur / API inchangés
node runtime/bin/demarrer.js (boot réel)                → 🟢 /v1/sante = 200 ok
```

Le devis servi par le Runtime — **en mémoire et via HTTP réel** — est **byte-identique** à la
référence sur tous les cas. Les trois filets Golden Master et les preuves A08–A10 restent identiques.
Aucun fichier de calcul, de règle ou de prix n'a été touché : la référence Golden Master, elle, **ne
change pas** — seul un **nouveau lieu d'exécution** (le serveur) a été ajouté.

## Préparation de R03

Ce qui est **prêt** pour la première exécution parallèle (mode Shadow) :

- Un **serveur démarrable** exposant `POST /v1/projets/calcul`, prouvé conforme à la référence.
- **CORS** activé (pré-vol `OPTIONS` + en-têtes) pour permettre au navigateur d'appeler le Runtime en
  tâche de fond.
- La **construction d'un Projet** depuis les données de l'app (`ModeleProjetDSBAT.projetDepuisApp`)
  déjà disponible côté client (A08) : R03 pourra bâtir le Projet et appeler le Runtime **sans utiliser
  le résultat**, puis **comparer** (`serialiser(API) === serialiser(local)`).
- Des **en-têtes de traçabilité** (`X-DSBAT-Request-Id`, `X-DSBAT-Version-Moteur`) pour corréler les
  comparaisons de parité.

R03 ajoutera uniquement, côté client, un **client d'accès désactivé par défaut** et le **shadow-calcul
du devis** — sans aucune bascule.

## Compatibilité avec la Constitution

**P3** (les prix restent dans le moteur, hors journaux ; côté serveur ils ne sont pas exposés au
client), **P6** (le savoir reste atteint via le Port par les moteurs), **P7** (chaque brique garde sa
responsabilité ; on ajoute un **hôte**, pas une logique), **P11** (traçabilité : requestId +
journalisation d'accès), **P16** (indépendance du navigateur — le moteur tourne désormais aussi sur un
serveur), **P17** (déterminisme : parité byte-identique prouvée), **P21** (source unique : les briques
sont référencées, jamais copiées ; la référence Golden Master est inchangée).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission R02** de la feuille de route Runtime (R01) : *serveur Runtime hébergeant
l'API/Orchestrateur, sans bascule client*. Réalisée **dans l'ordre**, en préparation directe du shadow
(R03). Approche **additive et non intrusive**.

## Compatibilité avec la Charte

**Additive** (nouveau dossier `runtime/` uniquement ; rien de retiré ni modifié ailleurs),
**réversible** (supprimer `runtime/` restaure l'état exact ; le configurateur ne le référence pas),
**testable** (parité + smoke HTTP + tous les Golden Master verts), **documentée** (présent document +
README). Aucune logique de calcul réécrite, aucune dépendance externe ajoutée.

## Conclusion

Le **Runtime DSBAT est déployé en parallèle** : un serveur autonome, sans dépendance externe, qui
héberge l'API, l'Orchestrateur, le contrat Projet, le Port, le Journal et les moteurs, et qui
**reproduit exactement** la référence Golden Master — en mémoire comme via HTTP réel. Le configurateur
n'a **pas bougé d'un octet** et continue d'utiliser son moteur local. Tout est prêt pour la première
exécution **parallèle** du moteur via l'API (mode Shadow, R03) : le canal existe, la parité est
prouvée, la traçabilité est en place. Mise en place **totalement additive, réversible et sécurisée par
le Golden Master**.

*— MISSION R02 : le moteur tourne désormais aussi sur un serveur — sans que le configurateur ne s'en aperçoive.*
