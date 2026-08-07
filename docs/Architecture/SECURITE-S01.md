# SÉCURITÉ – S01

> **Phase Sécurité · Mission S01 — Sécurisation du Runtime DSBAT (architecture uniquement).**
> Aucune modification du moteur, des règles, des calculs ou des prix. Aucun impact Golden Master.
> Ce document définit **l'architecture de sécurité d'exploitation** du Runtime avant sa mise en
> production, en s'appuyant sur les crochets **déjà présents** dans le code (authentification,
> journalisation, CORS, limite de corps) — sans les implémenter ici.

---

## Objectifs

Sécuriser **l'accès** au Runtime, désormais moteur officiel exposé via l'API A10 :
`GET /v1/sante`, `GET /v1/moteur/versions`, `GET /v1/tarifs/vue`, `POST /v1/projets/validation`,
`POST /v1/projets/calcul`, `POST /v1/pieces/calcul`.

Point de départ **réel** (déjà dans le code) : un crochet `authentifier(requete) → {ok}` (défaut ouvert,
renvoie **401 NON_AUTHENTIFIE** si refus) sur les endpoints de calcul, un crochet `journalAcces`, une
limite de corps **1 Mo** (413 au-delà), un préflight `OPTIONS`, et un en-tête CORS `Access-Control-Allow-Origin`
**configurable** (défaut `*`). L'architecture S01 **active et complète** ces crochets.

> **Vérité fondatrice (honnête)** : le **seul client légitime** est le **site statique public** `dsbat.fr`,
> exécuté dans le **navigateur du visiteur anonyme**. On **ne peut pas** cacher un secret d'authentification
> dans une application statique (il est visible en F12). La sécurité vise donc à **rendre l'abus coûteux et
> détectable**, pas à rendre l'API inaccessible : le configurateur doit fonctionner pour tout visiteur.
> Le **fichier catalogue** est déjà protégé (P01) ; l'API reste néanmoins un **« oracle de prix »** — c'est
> le risque central à mitiger.

## Analyse des risques

| # | Risque | Vecteur | Gravité | Probabilité |
|---|---|---|---|---|
| R1 | **Oracle de prix / reconstruction du catalogue** | énumération de configurations sur `/v1/projets/calcul` ou `/v1/pieces/calcul` ; aspiration de `/v1/tarifs/vue` (304 prix d'un coup) | **Élevée** (patrimoine) | Moyenne |
| R2 | **Scraping / appels automatisés** | bots headless rejouant les requêtes du navigateur | Élevée | Élevée |
| R3 | **Déni de service simple** | flood, corps volumineux, configurations coûteuses (nb pièces/prestations) | Moyenne (process Node unique) | Moyenne |
| R4 | **Utilisation non autorisée** | appel de l'API depuis un autre site / outil | Moyenne | Élevée |
| R5 | **Fuite de secret côté client** | clé d'API embarquée dans le site statique (visible F12) | Élevée si mal fait | Élevée |
| R6 | **Mauvaise config CORS / mixed-content** | `*` en prod, HTTP au lieu de HTTPS | Moyenne | Moyenne |
| R7 | **Fuite d'information par les erreurs** | stack traces, détails internes renvoyés au client | Faible | Faible |
| R8 | **Exposition d'un endpoint privilégié** | si une route d'écriture/admin du catalogue apparaissait | **Critique** | Faible (aucune aujourd'hui) |
| R9 | **Compromission de l'hôte / des logs** | serveur mal durci, logs contenant des données sensibles | Élevée | Faible |

Constat : **R1/R2/R5** dominent — ils découlent directement du client navigateur public.

## Authentification

Stratégie **progressive** (le navigateur anonyme ne peut porter de secret fort) :

- **Niveau 0 (actuel)** : crochet ouvert (défaut). **Interdit en production.**
- **Niveau 1 — filtrage d'origine (minimum avant exposition)** : vérifier `Origin`/`Referer` ∈ allowlist
  (`dsbat.fr`) **+** CORS restreint (voir *API*). Faible (spoofable serveur-à-serveur) mais bloque l'abus
  navigateur trivial et l'usage cross-site.
- **Niveau 2 — jeton anti-bot (recommandé)** : **Cloudflare Turnstile** (CAPTCHA invisible) ou équivalent.
  Le navigateur obtient un jeton, envoyé sur `/v1/projets/calcul` ; le Runtime le **vérifie côté serveur**
  via `authentifier`. Transparent pour l'humain, **bloque les bots headless** (mitige R1/R2).
- **Niveau 3 — jetons courts signés** : un endpoint léger émet un **jeton signé à courte durée**
  (ex. 5 min) lié à l'origine ; l'API n'accepte que des jetons valides. Limite la **fenêtre** de rejeu.
- **Niveau 4 — authentification réelle (endpoints privilégiés uniquement)** : si un espace **admin/franchisé**
  apparaît (édition catalogue…), API keys / OAuth **par utilisateur**. Ces endpoints ne sont **jamais**
  publics.

> Aucune clé secrète n'est jamais placée dans le site statique. Le « jeton d'app » côté navigateur est un
> facteur **anti-automatisation**, pas un secret de confidentialité.

## Autorisation

Modèle à **deux niveaux**, moindre privilège :

- **Public (anonyme, débité)** : `sante`, `versions`, `tarifs/vue`, `projets/validation`, `projets/calcul`,
  `pieces/calcul` — **lecture / calcul uniquement**, **aucune mutation**.
- **Privilégié (jamais public)** : toute opération d'**écriture** du catalogue reste **hors API** — édition
  par **fichier + git** dans le dépôt privé (P01). **Aucune route d'écriture n'existe** aujourd'hui : ne pas
  en créer d'exposée. Si nécessaire un jour → auth forte + réseau restreint + audit.

Principe : **l'API publique ne peut jamais modifier le catalogue ni révéler sa structure** (seuls des
montants résolus sortent).

## API

Durcissement de la **surface** (déjà minimale : 6 routes) :

- **Validation d'entrée stricte** : contrat A08 (`modele.conforme`) déjà appliqué ; **ajouter des bornes**
  (nb pièces, nb prestations/pièce, tailles de chaînes) pour **plafonner le coût de calcul** (anti-R3).
- **Limite de corps** : 1 Mo (déjà) ; abaisser si possible pour les endpoints de calcul.
- **`/v1/tarifs/vue`** : renvoie tous les prix d'affichage — les traiter comme **équivalents publics**
  (déjà visibles à l'écran) mais **débiter/mettre en cache** (edge) pour éviter l'aspiration en masse.
- **Erreurs** : format **uniforme** déjà en place (`{statut:'erreur', erreur:{code,message}}`), **sans stack
  trace ni détail interne** (anti-R7) ; codes stables (400/401/404/405/413/415/422/429/500).
- **En-têtes de sécurité** (via proxy) : `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Cache-Control` adaptés.
- **Négociation de version** (A10) déjà présente → compatibilité et dépréciation maîtrisées.

## HTTPS

- **Obligatoire** : le site est en HTTPS (Pages) ; un endpoint HTTP serait **bloqué (mixed-content)**.
- TLS fourni par **Cloudflare** (recommandé), une **PaaS** managée, ou **Caddy/Let's Encrypt** en VPS.
- Sous-domaine dédié `api.dsbat.fr` ; **redirection 80→443**, **HSTS**, TLS ≥ 1.2, certificats auto-renouvelés.

## Variables d'environnement

Toutes les valeurs sensibles hors code/dépôt (coffre de la plateforme) :

```
DSBAT_PORT=8787
DSBAT_ALLOWED_ORIGINS=https://dsbat.fr,https://www.dsbat.fr   # allowlist CORS + Origin/Referer
DSBAT_AUTH_MODE=turnstile                # off | origin | turnstile | token
DSBAT_TURNSTILE_SECRET=__vault__         # vérification jeton anti-bot (jamais côté navigateur)
DSBAT_TOKEN_SIGNING_KEY=__vault__        # signature des jetons courts (niveau 3)
DSBAT_RATE_RPM=30                        # requêtes/min/IP (calcul)
DSBAT_RATE_BURST=10
DSBAT_MAX_PIECES=40                      # bornes anti-DoS de calcul
DSBAT_MAX_PRESTATIONS=400
DSBAT_LOG_LEVEL=info
NODE_ENV=production
```

Côté **interface** (public, non secret) : `CONFIG.runtime.base = https://api.dsbat.fr`. **Aucun secret.**

## Rate Limiting

Défense en profondeur (bord **+** applicatif) :

- **Au bord (recommandé)** : Cloudflare / reverse proxy — limite par IP, par ASN, règles de bot, challenge
  progressif, mode « Under Attack » en cas d'incident.
- **Dans l'app** : limiteur **token-bucket par IP** (ex. `DSBAT_RATE_RPM=30`, burst 10), **plus strict** sur
  `/v1/projets/calcul` et `/v1/pieces/calcul` (oracle de prix) que sur `/v1/sante`.
- **Plafonds de calcul** : bornes nb pièces/prestations + **timeout** par requête ; **concurrence globale**
  limitée (process Node unique).
- **Réponse** : **429** avec `Retry-After` ; bannissement IP **temporaire** en cas d'abus répété.

## Journalisation

Journal de **sécurité**, distinct du **Journal de décision** métier (qui reste **sans prix**, P3) :

- **Événements** (via le crochet `journalAcces` déjà présent) : horodatage, `requestId`, **IP hachée**,
  méthode, chemin, statut, latence, `Origin`, résultat d'auth, déclenchements de rate-limit, taille du corps.
- **Ne jamais journaliser** : **prix**, contenu tarifaire, secrets, PII inutile (IP **hachée/salée**, pas en clair).
- **Rotation + rétention** bornée ; stockage **hors** du dépôt ; intégrité (append-only / hash chaîné) en option.
- **Corrélation** par `requestId` (déjà généré par l'API) pour l'analyse d'incident.

## Sauvegardes

- **Catalogue** (dépôt privé) : versionné + **tags de version**, copie chiffrée hors-ligne (source de vérité).
- **Configuration & secrets** : sauvegarde **chiffrée** du coffre ; procédure de restauration documentée.
- **Journaux de sécurité** : export/rotation vers un stockage durable (analyse post-incident).
- **Golden Master** : `reference*.json` conservés avec le moteur (non-régression).
- **Tag `pre-split`** (P01) : retour arrière structurel total.

## Surveillance

- **Disponibilité** : sonde `GET /v1/sante` (uptime externe, ex. UptimeRobot / healthcheck plateforme).
- **Métriques** : taux de requêtes, **taux d'erreur**, latence **p95**, volume 401/429, top IP/ASN, taille des
  réponses, saturation CPU/mémoire du process.
- **Agrégation de logs** : centralisation + tableau de bord (plateforme ou service léger).
- **Détection d'anomalie** : nombreuses **configurations distinctes** depuis une même IP (signature de
  scraping), pics de trafic, séquences d'énumération de codes.

## Alertes

- **Seuils** : downtime `/v1/sante` ; **pic de 401/429** ; taux d'erreur > seuil ; latence p95 > seuil ;
  trafic anormal d'une IP/ASN ; corps rejetés (413) en masse.
- **Sévérité** : info / avertissement / critique.
- **Canaux** : e-mail (et SMS pour le critique) — adaptés à une petite structure (DSBAT).
- **Runbook** : action associée à chaque alerte (activer « Under Attack », bannir IP, rotation secret, rollback).

## Priorités

Progressif, adapté à DSBAT (artisan, ressources limitées) :

- **P0 — bloquant avant toute exposition** : HTTPS + `api.dsbat.fr` ; **CORS allowlist** (fin du `*`) +
  filtrage `Origin/Referer` ; **rate-limit au bord** ; **bornes de calcul** + limite de corps ; **secrets hors
  dépôt et hors historique** (purge P01) ; **journalisation d'accès** (sans prix, IP hachée).
- **P1 — dès la mise en ligne** : **anti-bot Turnstile** (mitige oracle/scraping) ; **surveillance + alertes**
  (uptime, 401/429, latence) ; **sauvegardes** config/logs/catalogue.
- **P2 — durcissement continu** : **détection d'anomalie** (énumération) ; **rotation** automatisée des
  secrets ; réglage WAF ; jetons courts signés (niveau 3).
- **P3 — si besoin fonctionnel** : **auth réelle** pour un éventuel espace admin/franchisé (jamais public).

## Conclusion

L'architecture de sécurité est **définie et graduée**, sans toucher au moteur. Elle s'appuie sur des crochets
**déjà présents** (authentification, journalisation, CORS, limite de corps) et les **active/complète** :
HTTPS + sous-domaine dédié, **CORS/Origin allowlist**, **rate-limiting** au bord et applicatif, **bornes de
calcul**, **anti-bot** (Turnstile), **journalisation de sécurité sans prix (IP hachée)**, **surveillance +
alertes**, **sauvegardes** et **rotation des secrets**.

**Honnêteté requise** : parce que le client légitime est un **site statique public**, l'API reste par nature
**joignable** et constitue un **oracle de prix**. La sécurité **réduit et détecte** l'abus (coût, quotas, bots,
anomalies) mais ne le supprime pas absolument. Combinée à la protection **du fichier** catalogue (P01), elle
porte le risque résiduel à un niveau **maîtrisé et surveillé**. Les priorités **P0** (HTTPS, CORS, rate-limit,
bornes, secrets hors dépôt, logs) sont **bloquantes** avant exposition ; **P1** (anti-bot, surveillance,
sauvegardes) suit immédiatement. Aucun développement métier, aucun changement fonctionnel, aucun impact
Golden Master.

*— SÉCURITÉ S01 : architecture d'accès sécurisé du Runtime, progressive et adaptée à DSBAT ; prête à guider une mise en production maîtrisée, sans modifier le moteur.*
