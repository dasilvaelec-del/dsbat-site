# API Officielle DSBAT

> **Phase 2 · Mission A10 — Naissance officielle de l'API DSBAT.** L'API est la **porte d'entrée**
> du Moteur DSBAT. Elle est construite **autour de l'Orchestrateur** (A09), pas du configurateur :
> `Projet DSBAT → API → Orchestrateur → Projet enrichi → réponse JSON`. **Elle ne contient aucune
> règle métier, aucun calcul, aucune décision, aucun prix.**
>
> *Mission d'architecture : aucune interface, aucun comportement modifié. L'implémentation est
> additive, transport-agnostique et non branchée ; tous les Golden Master restent identiques et le
> devis servi par l'API est byte-identique à la référence sur tous les cas.*

---

## Objectifs

Depuis A08/A09, le moteur est découplé du navigateur : un **Projet** (contrat A08) entre dans un
**Orchestrateur** (A09) et en ressort enrichi. Il manquait la **porte d'entrée** permettant à
d'autres clients que le configurateur web — API, mobile, franchisés, outils internes — d'exécuter le
moteur. L'API la fournit, en restant volontairement **mince** : valider, transmettre à
l'Orchestrateur, renvoyer. Elle ne réimplémente rien ; elle **expose** ce qui existe.

## Principes

1. **Zéro logique métier.** L'API ne calcule pas, ne décide pas, ne connaît aucun prix. Toute
   décision reste dans les moteurs, atteints uniquement via l'Orchestrateur.
2. **Bâtie sur l'Orchestrateur.** L'unité de travail est le Projet ; le point d'exécution est
   `orchestrer(projet)`. L'API n'est qu'un adaptateur de transport autour de lui.
3. **Transport-agnostique.** Le cœur est une fonction **pure** `traiter(requete) → reponse` sur des
   objets simples. Aucun couplage à Express, au navigateur ou à un runtime précis.
4. **Contrat d'abord.** L'entrée et la sortie sont le **contrat Projet** (A08). L'API valide
   strictement ce contrat et **négocie sa version**.
5. **Sûre par défaut.** Validation stricte, erreurs explicites, traçabilité (requestId),
   journalisation d'accès, crochet d'authentification prêt.
6. **Additive et réversible.** Non branchée au configurateur ; l'inclure ne change rien.

## Architecture

```
   Client (web / mobile / franchisé / outil interne)
        │  requête HTTP  { methode, chemin, corps, entetes }
        ▼
   ┌──────────────────────────────────────────────┐
   │                  API DSBAT                    │   ← transport + validation, 0 métier
   │  auth → parse → valider contrat → négocier    │
   │  version → transmettre → envelopper (JSON)    │
   └───────────────────────┬──────────────────────┘
                           │ orchestrer(projet)
                           ▼
                    ORCHESTRATEUR (A09)   ← coordination pure
                           │
                           ▼
                    Moteurs métier        ← calcul & décisions
                           │
                           ▼
                    Projet enrichi  →  réponse JSON enveloppée
```

Une fonction pure (`creerAPI(deps).traiter`) et des **dépendances injectées** : `orchestrateur`
(obligatoire), `modele` (contrat), `versions`, `authentifier` (crochet), `idRequete`, `horloge`,
`journalAcces`. Un **adaptateur HTTP mince** (Node `http`, Express, Cloudflare Workers…) mappera
`req/res` réels sur les objets `requete/reponse` — sans toucher au cœur.

## Cycle d'exécution

Pour `POST /v1/projets/calcul` :

1. **Identifier** la requête (requestId) et **journaliser** l'accès.
2. **Authentifier** (crochet ; ouvert par défaut, token requis à terme).
3. **Lire / parser** le corps JSON (415 si illisible).
4. **Valider strictement** le contrat Projet (`modele.conforme` ; 400 sinon).
5. **Négocier la version** du contrat (majeure supportée ; 422 sinon).
6. **Transmettre** à l'Orchestrateur (`orchestrer(projet)`) — *l'API ne calcule jamais*.
7. **Envelopper** le Projet enrichi + le journal de coordination en **réponse JSON** (200).

## Endpoints proposés

| Méthode | Chemin | Rôle | Corps entrée | Réponse |
|--------:|--------|------|--------------|---------|
| `GET`  | `/v1/sante` | Vivacité du service + versions | — | `{ statut, versions, contratsSupportes }` |
| `GET`  | `/v1/moteur/versions` | Versions moteur / contrat | — | `{ versions, contratsSupportes }` |
| `POST` | `/v1/projets/validation` | Valider un Projet **sans calculer** | Projet | `{ valide }` ou `400` |
| `POST` | `/v1/projets/calcul` | **Exécuter** le moteur via l'Orchestrateur | Projet | Projet enrichi + journal |

Le préfixe `/v1` porte le versionnement d'API (distinct de la version du **contrat** Projet).

## Contrat d'entrée

Le corps de `/v1/projets/calcul` et `/v1/projets/validation` est un **Projet DSBAT** conforme au
schéma A08 (`schema-projet-dsbat.schema.json`) : discriminant `"$contrat": "dsbat.projet"`,
`versionContrat` SemVer, et au minimum `identite`, `chantier`, `metiers`, `pieces`, `versions`. Toute
autre forme est rejetée avant le moindre appel de moteur.

## Contrat de sortie

Enveloppe **stable** :

```json
{
  "api": "dsbat", "versionApi": "1.0.0",
  "requestId": "req-1", "horodatage": null,
  "statut": "ok",
  "projet": { "$contrat": "dsbat.projet", "…": "… Projet enrichi (resultats, versions, journaux)" },
  "journal": [ { "sequence": 1, "type": "orchestration_demarree", "donnees": {…} } ]
}
```

En cas d'erreur :

```json
{
  "api": "dsbat", "versionApi": "1.0.0", "requestId": "req-2",
  "statut": "erreur",
  "erreur": { "code": "CONTRAT_INVALIDE", "message": "…", "details": ["…"] }
}
```

En-têtes systématiques : `Content-Type: application/json`, `X-DSBAT-Request-Id`,
`X-DSBAT-Version-Api`, `X-DSBAT-Version-Moteur`.

## Validation

L'API **ne fait pas confiance** à l'entrée. Elle vérifie : corps JSON lisible (415 sinon),
conformité au contrat (`modele.conforme` → 400 + liste des problèmes), version de contrat supportée
(422 sinon). La validation est **structurelle** : l'API ne juge jamais le *contenu métier* (surfaces,
choix…), qui relève des moteurs. `/v1/projets/validation` permet à un client de vérifier un Projet
**avant** de le soumettre au calcul.

## Gestion des erreurs

| Code | `erreur.code` | Cause |
|-----:|---------------|-------|
| 400 | `CONTRAT_INVALIDE` | Projet non conforme au contrat |
| 401 | `NON_AUTHENTIFIE` | Auth requise / invalide (crochet) |
| 404 | `ROUTE_INCONNUE` | Chemin inexistant |
| 405 | `METHODE_NON_AUTORISEE` | Mauvaise méthode (+ en-tête `Allow`) |
| 415 | `CORPS_INVALIDE` | Corps non-JSON, vide ou illisible |
| 422 | `VERSION_INCOMPATIBLE` / `ECHEC_ORCHESTRATION` | Version de contrat non supportée / échec côté Orchestrateur |
| 500 | `ORCHESTRATEUR_INDISPONIBLE` / `MODELE_INDISPONIBLE` / `ERREUR_INTERNE` | Défaut de configuration / imprévu |

Toute exception est **capturée** et transformée en réponse 500 propre : l'API ne fuit jamais de trace
interne brute.

## Sécurité

- **Validation stricte du contrat** : première ligne de défense (rejet avant tout traitement).
- **Version de contrat** négociée (majeure) : refus explicite des versions non supportées (422).
- **Version de moteur** exposée dans chaque réponse (`versions.moteur`, en-tête dédié) : le client
  sait *quel* moteur a produit le résultat.
- **Authentification (future)** : crochet `authentifier(requete)` injectable ; par défaut ouvert, il
  imposera un token *bearer* / clé de franchise sans changer le cœur.
- **Traçabilité** : `requestId` unique par requête, propagé en en-tête et dans le corps.
- **Journalisation** : journal d'accès (requête/réponse) côté API + journal de **coordination** de
  l'Orchestrateur renvoyé au client — **sans aucun prix** (Constitution P3).
- **Isolation** : l'API ne touche ni au DOM ni au navigateur ; surface d'attaque minimale (pas de
  logique métier à exploiter).

## Compatibilité avec le configurateur

Le configurateur web actuel **n'est pas modifié** : l'API est additive et non branchée. À terme, il
pourra appeler `/v1/projets/calcul` au lieu d'exécuter `calculerDevis` en local — l'adaptateur moteurs
de l'Orchestrateur garantit un **devis identique** (prouvé byte-à-byte sur tous les cas). La migration
se fera donc **sans changement de comportement**, écran par écran, sous Golden Master.

## Compatibilité mobile

Le contrat étant transport-agnostique et sérialisable (A08), une application mobile envoie un Projet
JSON et reçoit un Projet enrichi. Aucune logique métier n'est dupliquée côté mobile : le calcul reste
**serveur**, garantissant des résultats homogènes entre plateformes (`versions.moteur` identique).

## Compatibilité franchisés

`identite.franchise` (A08) rend chaque Projet multi-tenant. Le crochet d'authentification portera la
**clé de franchise** ; l'Orchestrateur pourra être configuré avec le **Référentiel** propre à une
franchise (Port à sources injectées), `versions.referentiel` traçant lequel a servi — le tout sans
modifier l'API ni le cœur.

## Compatibilité future

Nouveaux endpoints (persistance de dossiers, historique, export PDF) et nouvelles versions d'API
(`/v2`) s'ajoutent **sans casser** l'existant. Le versionnement séparé (API vs contrat) autorise des
évolutions indépendantes. De nouveaux moteurs sont exposés **sans changer l'API** : ils entrent par
l'Orchestrateur.

## Première implémentation

Livrée, **additive et non branchée** :

- **`js/api-dsbat.js`** — `creerAPI(deps)` → `traiter(requete) → reponse` (fonction pure). Quatre
  endpoints, enveloppe JSON stable, erreurs normalisées, en-têtes de traçabilité, crochets
  `authentifier` / `journalAcces` / `idRequete` / `horloge` injectables.
- **`tests/golden-master/a10-check.js`** — 18 assertions : identité du devis via `/calcul` sur tous
  les cas, enveloppe & traçabilité, endpoints santé/versions/validation, erreurs 400/404/405/415/422/401,
  refus explicite sans Orchestrateur.

Aucun adaptateur HTTP concret n'est imposé : brancher `traiter` sur un serveur réel est une étape
ultérieure, triviale et isolée.

## Validation Golden Master

```
node a10-check.js                  → ✅ 18 assertions OK (5 cas : devis identiques via /calcul)
node a09-check.js                  → ✅ Orchestrateur inchangé
node a08-check.js                  → ✅ Modèle Projet inchangé
node golden-master.js verify       → ✅ Golden Master IDENTIQUE — aucune régression
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE
node reco-oublis-domain-golden.js verify → ✅ domaine reco/oublis IDENTIQUE
node --check js/api-dsbat.js       → ✅ syntaxe OK
```

Le devis servi par l'API est **strictement identique** à la référence : l'API **ne modifie aucun
résultat**. Le configurateur, non modifié, fonctionne à l'identique.

## Compatibilité avec la Constitution

**P3** (aucun prix dans les journaux d'accès / de coordination), **P6** (le savoir n'est atteint que
via le Port, par les moteurs — jamais par l'API), **P7** (responsabilité unique : transporter et
valider, jamais décider), **P11** (traçabilité : requestId + journalisation), **P16** (indépendance :
API sans DOM ni navigateur, transport-agnostique), **P17** (déterminisme : horloge/idRequete
injectables ; devis reproductible), **P21** (source unique : l'API ne duplique ni calcul ni savoir).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission A10** (Exposition API), réalisée **dans l'ordre**, bâtie **sur
l'Orchestrateur** (A09) et le **contrat Projet** (A08). Approche **additive et non intrusive** :
l'API expose l'existant sans le réécrire, avec un résultat identique prouvé.

## Compatibilité avec la Charte

**Additive** (nouveau module + nouveau test ; rien de retiré), **réversible** (supprimer
`js/api-dsbat.js` ne change rien), **testable** (`a10-check.js` + tous les Golden Master verts),
**documentée** (présent document). Aucune logique de calcul déplacée ni créée.

## Conclusion

L'API DSBAT **naît officiellement** : une porte d'entrée mince, transport-agnostique et indépendante
du navigateur, bâtie **autour de l'Orchestrateur**. Elle valide le Projet reçu, négocie la version du
contrat, le transmet à l'Orchestrateur et renvoie le Projet enrichi en JSON — **sans aucune logique
métier, aucun calcul, aucun prix**. Le devis servi est **byte-identique** à la référence sur tous les
cas ; tous les filets Golden Master sont verts ; le configurateur est inchangé. Web, mobile,
franchisés et outils internes disposent désormais d'un **point d'entrée unique et durable** vers le
Moteur DSBAT. Une architecture extensible, sécurisable et pensée pour les années à venir.

*— MISSION A10 : le Moteur DSBAT a une porte d'entrée officielle — qui ouvre sur l'Orchestrateur, jamais sur le calcul lui-même.*
