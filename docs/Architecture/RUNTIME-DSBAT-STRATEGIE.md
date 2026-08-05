# Stratégie officielle de migration vers le Runtime DSBAT

> **Phase Runtime · Mission R01 — Document de stratégie (aucune ligne de code migrée).** Cette mission
> définit *comment* le configurateur actuel deviendra progressivement un simple **client** du Moteur
> DSBAT exécuté **côté serveur**, via l'API (A10) et l'Orchestrateur (A09). La règle d'or reste
> inchangée : **aucune réécriture** ; migration **additive, réversible et sécurisée par le Golden
> Master** à chaque pas.

---

## Situation actuelle

Le moteur est **déjà découplé** (A01–A10) mais **s'exécute encore dans le navigateur**. Le
configurateur charge en scripts classiques `prix.js` (catalogue **avec les prix**), `js/moteur-*.js`
et `js/moteurs/*.js`, puis appelle localement :

- **`calculerDevis()`** — source unique des totaux — à **2 sites seulement** : `renderPhase3()`
  (affichage du devis) et `genererPDFConfig()` (PDF) ;
- **`calculerPiece(piece, chantier, metiersActifs)`** — calcul par pièce — pendant la configuration
  (phase 2), à mesure que l'utilisateur remplit chaque pièce ;
- les fonctions de **recommandations/oublis** (domaine déjà extrait, A07) et de **cohérence**.

Deux conséquences structurantes :

1. **Le savoir-faire est public.** Prix, quantités et règles vivent dans le dépôt GitHub servi au
   client. N'importe qui peut lire `prix.js` et les moteurs.
2. **Le point de bascule est étroit.** Comme `calculerDevis` n'a que 2 sites d'appel et que le Projet
   (A08) capture exactement son entrée, **rediriger ces appels vers l'API** est un changement local et
   contrôlable — pas une refonte.

Trois filets Golden Master protègent déjà tout : devis (`golden-master.js`), par pièce
(`piece-golden-master.js`), domaine reco/oublis (`reco-oublis-domain-golden.js`), plus les preuves
A08/A09/A10 (Modèle, Orchestrateur, API produisent des résultats **byte-identiques**).

## Objectifs

1. Faire exécuter le moteur **côté serveur** (Runtime DSBAT) sans changer ce que voit l'utilisateur.
2. **Retirer les calculs du navigateur**, appel par appel, dans un ordre maîtrisé.
3. Permettre, à terme, de **retirer les moteurs et les prix du dépôt public** (protection du
   savoir-faire).
4. Faire du navigateur **une simple interface** (saisie + rendu), le calcul devenant un service.
5. Poser les bases **mobile**, **franchisés** et **moteur Dépannage** sans dette nouvelle.

## Principes

- **Aucune réécriture.** On *redirige* des appels existants ; on ne réimplémente rien.
- **Additif & réversible.** Chaque pas s'active derrière un **drapeau** (feature flag) et se
  désactive instantanément (retour au calcul local).
- **Golden Master souverain.** Aucun pas n'est validé si un Golden Master diverge d'un octet.
- **Parité prouvée avant bascule.** On compare API vs local **en double exécution** (shadow) avant de
  couper le calcul local.
- **Le Projet est le contrat.** Tout ce qui transite est un Projet DSBAT (A08) — jamais des fragments
  ad hoc.
- **Une bascule = un appel.** On migre `calculerDevis`, puis `calculerPiece`, etc. — jamais tout d'un
  coup.

## Architecture cible

```
   NAVIGATEUR (interface seule)                SERVEUR (Runtime DSBAT)
   ┌───────────────────────────┐              ┌──────────────────────────────┐
   │ saisie → Projet (A08)      │  ── HTTPS ──▶│ API (A10)                    │
   │ rendu ← Projet enrichi     │◀──  JSON  ── │   → Orchestrateur (A09)      │
   │ (aucun prix, aucun moteur) │              │      → Moteurs + prix + Port │
   └───────────────────────────┘              │      → Journal               │
                                              └──────────────────────────────┘
```

État final : le navigateur ne contient **ni prix, ni moteur** ; il construit un Projet, appelle
`POST /v1/projets/calcul`, et affiche le Projet enrichi. Le catalogue et les règles ne quittent
jamais le serveur.

## Étapes proposées

Vue d'ensemble (détail chiffré en feuille de route ci-dessous) :

1. **Serveur Runtime** hébergeant l'API/Orchestrateur (déploiement, pas de bascule client).
2. **Client d'accès** dans le navigateur : une couche `runtime-client.js` qui sait appeler l'API,
   **désactivée par défaut** (drapeau off) → aucun changement.
3. **Shadow-calcul du devis** : à chaque `calculerDevis` local, appeler aussi l'API en tâche de fond
   et **comparer** (sans utiliser le résultat API) → on mesure la parité en production réelle.
4. **Bascule du devis** : `renderPhase3` puis `genererPDFConfig` consomment le résultat **API** ;
   calcul local conservé en repli immédiat.
5. **Bascule du calcul par pièce** (`calculerPiece`) selon le même schéma shadow → bascule.
6. **Retrait des calculs navigateur** : une fois toutes les bascules stables, on cesse de charger les
   moteurs côté client.
7. **Retrait du savoir du dépôt public** : prix et moteurs quittent GitHub public → serveur only.
8. **Interface pure** : le navigateur n'est plus qu'un client ; ouverture mobile / franchisés /
   Dépannage.

## Validation

Chaque pas est validé par une **triple garantie** :

1. **Golden Master vert** (3 filets + preuves A08–A10) — non-régression du moteur.
2. **Parité API/local** — en mode shadow, `serialiser(devisAPI) === serialiser(devisLocal)` sur le
   trafic réel, pendant une fenêtre d'observation, **avant** toute bascule.
3. **Parité visible** — comportement utilisateur strictement identique (mêmes montants, mêmes écrans,
   mêmes PDF), vérifié par échantillons.

Critère de succès d'un pas : Golden Master vert **et** parité shadow à 100 % sur la fenêtre
d'observation **et** retour arrière testé.

## Golden Master

Le Golden Master reste **la référence absolue** pendant toute la transition, à deux niveaux :

- **Hors ligne** : les filets existants tournent à chaque commit (aucune régression du moteur, quel
  que soit son lieu d'exécution — local ou serveur : c'est le **même code**).
- **En ligne (nouveau)** : un contrôle de parité rejoue les **cas figés** contre l'API déployée
  (`reference.json` doit être reproduit par le serveur). C'est le pont entre le Golden Master
  historique et le Runtime : *la référence ne change pas, seul le lieu d'exécution change.*

Tant qu'un écart existe, **on ne bascule pas** : on corrige l'adaptateur serveur, jamais la référence.

## Retour arrière

Le retour arrière est **conçu avant** chaque bascule, pas improvisé :

- **Drapeau par appel** : chaque bascule (`devis`, `pdf`, `piece`) a son drapeau ; le passer à *off*
  restaure le calcul local **immédiatement**, sans redéploiement.
- **Repli automatique** : si l'API échoue (réseau, 5xx, latence > seuil), le client **retombe** sur le
  calcul local tant que celui-ci est présent.
- **Code local conservé** jusqu'à stabilité prouvée : on ne **supprime** les moteurs du navigateur
  (pas 6) qu'après une période de bascule 100 % stable — jusque-là, le retour arrière est gratuit.
- **Déploiement réversible** : versions serveur immuables, bascule de trafic progressive (voir
  déploiement).

## Déploiement progressif

- **Canari par pourcentage** : 1 % → 5 % → 25 % → 50 % → 100 % du trafic sur l'API, avec fenêtre
  d'observation à chaque palier (parité + erreurs + latence).
- **Cohortes** : d'abord interne/franchise pilote, puis grand public.
- **Observabilité** : taux de parité, taux de repli, latence P95, taux d'erreur — un seuil dépassé
  déclenche un retour au palier précédent (drapeau off).
- **Idempotence** : `POST /v1/projets/calcul` est sans effet de bord persistant à ce stade → un rejeu
  est sûr.

## Protection du savoir-faire

C'est un **objectif de premier plan** du Runtime. Le savoir sensible = **prix** (`prix.js`) et
**règles/moteurs**. Séquence de protection :

1. Le serveur devient l'**unique** exécutant du calcul (pas 4–5).
2. Le navigateur cesse de charger `prix.js` et les moteurs (pas 6) → **plus aucun prix ni règle**
   envoyé au client.
3. Ces fichiers **quittent le dépôt public** (pas 7) et vivent dans un dépôt/serveur privé.

Résultat : le catalogue et les règles ne sont **jamais** exposés ; le client ne reçoit que des
**résultats** (montants finaux), pas la mécanique qui les produit.

## Impact GitHub

- **Pendant la transition** : le dépôt public reste inchangé (bascules additives). Aucune suppression
  tant que le calcul local sert de repli.
- **Après bascule stable** (fin pas 6) : on **retire du dépôt public** `prix.js`, `js/moteur-*.js`,
  `js/moteurs/*.js`, `js/pricing.js` — déplacés vers un **dépôt privé** (le Runtime). Le dépôt public
  ne conserve que l'**interface** (HTML/CSS/JS d'affichage) et le **client d'accès** à l'API.
- **Golden Master** : les filets suivent le moteur dans le dépôt privé (ils testent le moteur) ; un
  **test de parité API** reste côté public pour garantir l'interface.
- **Condition de retrait** : ne retirer un fichier du public **que** lorsque plus aucun chemin client
  ne l'utilise (drapeaux à 100 %, repli local désactivé, fenêtre d'observation passée).

## Compatibilité configurateur

Le configurateur **fonctionne sans interruption** : chaque pas est invisible pour l'utilisateur. Les
2 sites d'appel de `calculerDevis` et les sites de `calculerPiece` sont redirigés un par un derrière
un drapeau, avec repli local. Aucun écran, montant, PDF ou parcours ne change — c'est la condition de
validation de chaque pas.

## Compatibilité API

La cible est **exactement** l'API A10 : `POST /v1/projets/calcul` reçoit un Projet, renvoie un Projet
enrichi ; `/v1/projets/validation` permet de pré-valider ; `/v1/moteur/versions` et `/v1/sante`
outillent le déploiement. Le versionnement séparé (API `/v1` vs contrat Projet) autorise l'évolution
sans casse. Le client d'accès parle ce contrat et rien d'autre.

## Compatibilité mobile

Une fois le calcul **côté serveur**, une application mobile devient un **second client** de la même
API : elle construit un Projet, appelle `/v1/projets/calcul`, affiche le résultat. Aucun moteur ni
prix embarqué → mêmes résultats que le web (`versions.moteur` identique), maintenance unique côté
serveur. Le Runtime **est** la fondation mobile.

## Compatibilité franchisés

`identite.franchise` (A08) et l'authentification (crochet A10) permettent le **multi-tenant** : chaque
requête porte sa franchise ; l'Orchestrateur peut être configuré avec le **Référentiel** propre à une
franchise (Port à sources injectées) ; `versions.referentiel` trace lequel a servi. Les franchisés
consomment l'API comme le web, avec **cloisonnement** des données et éventuellement des prix/règles
distincts — **sans** fork du moteur.

## Vision finale

- **Navigateur** = interface (saisie → Projet, rendu ← Projet enrichi), **sans** prix ni moteur.
- **Serveur** = Runtime DSBAT unique (API → Orchestrateur → Moteurs + Port + Journal), **détenteur
  exclusif** du savoir-faire.
- **Clients multiples** (web, mobile, franchisés, outils internes, futur **moteur Dépannage**) parlant
  le **même contrat Projet**.
- **Golden Master** garantissant, à chaque étape, que « déplacer le calcul » n'a **jamais** changé un
  résultat.

Le **moteur Dépannage** s'inscrit naturellement : nouveau moteur métier branché **derrière
l'Orchestrateur**, exposé par la **même API** (nouveau type de Projet ou nouveau champ métier), avec
son propre Golden Master — **sans** toucher aux clients existants.

---

## Feuille de route Runtime

> Format par étape : **Objectif · Intérêt · Risques · Critères de validation · Retour arrière.**
> Progression stricte, chaque étape conditionnée par la précédente.

### R01 — Stratégie officielle *(présente mission)*
- **Objectif** : figer la stratégie, l'ordre, les risques, les validations, les critères de succès.
- **Intérêt** : cadre partagé et opposable ; aucune bascule sans plan.
- **Risques** : aucun (document).
- **Validation** : ce document approuvé ; cohérent avec Constitution/Plan Directeur/Charte.
- **Retour arrière** : sans objet (rien n'est modifié dans le produit).

### R02 — Serveur Runtime (hébergement de l'API)
- **Objectif** : déployer l'API (A10) + Orchestrateur (A09) + moteurs sur un serveur privé ; endpoints
  `/v1/sante`, `/v1/moteur/versions` opérationnels.
- **Intérêt** : le moteur s'exécute côté serveur, **sans aucun client branché**.
- **Risques** : infrastructure (déploiement, secrets, CORS) — **pas** de risque produit (client
  inchangé).
- **Validation** : **contrôle de parité en ligne** — l'API rejoue `reference.json` à l'identique ;
  santé/latence OK.
- **Retour arrière** : éteindre le serveur ; le configurateur, non branché, n'est pas affecté.

### R03 — Client d'accès (désactivé par défaut)
- **Objectif** : ajouter `runtime-client.js` (construit un Projet via le Modèle, appelle l'API) avec
  un **drapeau global off**.
- **Intérêt** : le canal existe et est testable, **sans rien changer** au comportement.
- **Risques** : quasi nuls (code mort tant que le drapeau est off).
- **Validation** : Golden Master vert ; drapeau off ⇒ comportement **identique** ; en labo, drapeau on
  ⇒ appel API fonctionnel.
- **Retour arrière** : drapeau off (défaut) ; ou retirer le script (additif).

### R04 — Shadow-calcul du devis
- **Objectif** : à chaque `calculerDevis` local, appeler **aussi** l'API en tâche de fond et
  **comparer** (résultat API **non utilisé**).
- **Intérêt** : mesurer la **parité réelle** en production, sans risque pour l'utilisateur.
- **Risques** : charge réseau/serveur ; aucun impact visible (résultat API ignoré).
- **Validation** : parité `serialiser(API)===serialiser(local)` à 100 % sur la fenêtre d'observation ;
  Golden Master vert.
- **Retour arrière** : couper le shadow (drapeau) ; aucun effet visible.

### R05 — Bascule du devis (avec repli)
- **Objectif** : `renderPhase3` puis `genererPDFConfig` consomment le résultat **API** ; **repli
  automatique** sur le calcul local en cas d'échec/latence.
- **Intérêt** : premier calcul réellement servi par le Runtime — sur un point **étroit** (2 sites).
- **Risques** : latence perçue, panne réseau → mitigés par repli + canari.
- **Validation** : parité maintenue ; montants/PDF identiques ; latence P95 sous seuil ; canari
  1→100 %.
- **Retour arrière** : drapeau `devis` off ⇒ retour **immédiat** au calcul local (conservé).

### R06 — Shadow + bascule du calcul par pièce
- **Objectif** : appliquer R04→R05 à `calculerPiece` (phase 2).
- **Intérêt** : retire le plus **gros** du calcul navigateur.
- **Risques** : appels plus **fréquents** (chaque édition de pièce) → débit/latence ; mitigés par
  débounce + repli.
- **Validation** : Golden Master par pièce vert ; parité shadow 100 % ; parité visible ; canari.
- **Retour arrière** : drapeau `piece` off ⇒ calcul local par pièce restauré.

### R07 — Retrait des calculs du navigateur
- **Objectif** : cesser de **charger** les moteurs côté client une fois toutes les bascules 100 %
  stables ; le navigateur ne calcule plus.
- **Intérêt** : prépare la protection du savoir-faire ; allège le client.
- **Risques** : plus de repli local → dépendance forte au serveur ; exige R02–R06 **éprouvés** +
  haute dispo serveur.
- **Validation** : période prolongée sans repli déclenché ; SLO serveur tenu ; Golden Master (dépôt
  moteur) vert.
- **Retour arrière** : **recharger** les moteurs (drapeau de chargement) ⇒ repli local de nouveau
  disponible.

### R08 — Retrait du savoir du dépôt public
- **Objectif** : déplacer `prix.js`, `js/pricing.js`, `js/moteur-*.js`, `js/moteurs/*.js` vers le
  **dépôt privé** (Runtime) ; le public ne garde qu'interface + client d'accès.
- **Intérêt** : **protection définitive** du savoir-faire (prix + règles hors du client public).
- **Risques** : irréversible côté « exposition » (une fois retiré du public) → **ne faire qu'après**
  R07 stable ; vérifier qu'aucun chemin client ne référence ces fichiers.
- **Validation** : build public fonctionnel **sans** ces fichiers ; test de parité API côté public
  vert ; aucun 404 de script.
- **Retour arrière** : ré-inclure les fichiers (conservés en privé/historique Git) et rebrancher le
  chargement — coûteux mais possible tant que l'historique existe.

### R09 — Interface pure + ouverture multi-clients
- **Objectif** : acter le navigateur comme **simple client** ; ouvrir mobile, franchisés (auth +
  Référentiel par tenant), et préparer le **moteur Dépannage** derrière la même API.
- **Intérêt** : plateforme unique, maintenance centralisée, nouveaux produits sans dette.
- **Risques** : montée en charge, gestion multi-tenant, sécurité/authentification.
- **Validation** : auth en place ; parité par tenant ; Golden Master du moteur Dépannage vert ; SLO
  tenus.
- **Retour arrière** : par fonctionnalité (drapeaux) ; le socle API/Orchestrateur reste stable.

## Compatibilité avec la Constitution

**P3** (les prix restent hors du client et hors journaux ; le Runtime les protège), **P6** (savoir
atteint via le Port, côté serveur), **P7** (chaque brique garde sa responsabilité ; on déplace le
*lieu* d'exécution, pas les responsabilités), **P11** (traçabilité renforcée : requestId + journaux
côté serveur), **P16** (indépendance du navigateur — c'est l'aboutissement du Runtime), **P17**
(déterminisme : la parité API/local **repose** sur lui), **P21** (source unique : le serveur devient
l'unique exécutant ; la référence Golden Master ne change pas).

## Compatibilité avec le Plan Directeur

R01 ouvre la **Phase Runtime** dans la continuité directe de A08–A10 : le Projet, l'Orchestrateur et
l'API sont les briques que cette phase met **en production**. Aucune réécriture, progression **dans
l'ordre**, chaque étape conditionnée et réversible.

## Compatibilité avec la Charte

**Additive** (client d'accès, shadow, drapeaux — rien de retiré avant preuve), **réversible** (drapeau
par appel, repli local, historique Git), **testable** (Golden Master hors ligne + parité en ligne à
chaque pas), **documentée** (présente stratégie + critères par étape). Aucune logique de calcul
réécrite.

## Conclusion

Le **Runtime DSBAT** commence officiellement. La stratégie est claire : **déplacer le calcul vers le
serveur sans jamais changer un résultat**, un appel à la fois, chaque pas protégé par un drapeau, un
repli local et le Golden Master. On commence par le point le plus étroit (le devis, 2 sites d'appel),
on prouve la **parité** en shadow avant toute bascule, puis on retire progressivement le calcul du
navigateur — jusqu'à sortir prix et moteurs du dépôt public. À l'arrivée, le configurateur n'est plus
qu'une **interface**, le savoir-faire est **protégé côté serveur**, et une **plateforme unique** sert
le web, le mobile, les franchisés et le futur moteur Dépannage. Migration **progressive, additive,
réversible et totalement sécurisée par le Golden Master** — conformément à l'exigence fondatrice.

*— MISSION R01 : le Runtime DSBAT a sa feuille de route ; le calcul s'apprête à quitter le navigateur, sans que l'utilisateur ne s'en aperçoive jamais.*
