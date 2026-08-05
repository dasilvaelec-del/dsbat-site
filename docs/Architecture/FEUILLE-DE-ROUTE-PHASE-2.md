# Feuille de route officielle — Phase 2 du Moteur DSBAT

> **Mission d'architecture A03. Aucun développement.** Prépare l'intégralité de la Phase 2 :
> dette technique restante, missions proposées (objectif / intérêt / risques / bénéfices / ordre /
> validation), éléments stabilisés, et vision finale. Document de gouvernance.

---

## État actuel

La Phase 1 a fait entrer l'architecture dans le logiciel **domaine par domaine**, sans régression.
Aujourd'hui :

- **Fondations en place** : Ontologie, Port, Journal, Référentiel (conception), deux Golden Master
  (devis + par pièce).
- **Neuf domaines migrés** : leur savoir est exposé au Port, leur raisonnement traçable au Journal,
  calculs et prix inchangés dans les moteurs.
- **Observateurs passifs** présents pour chaque domaine, **inertes** côté navigateur.

Mesure de l'existant (relevé) : le script inline du HTML contient encore **~101 fonctions**, dont
**14 fonctions reco/oublis** qui fondent domaine et rendu, plus **`tauxTVA`**. L'état applicatif est
porté par des **globales** (`piecesSelectionnees`, `chantier`, `metiersActifs`, `objectifProjet`…) et
la communication entre moteurs passe encore par **9 effets de bord `window.__*`**.

## Éléments stabilisés

**À ne plus modifier sauf nécessité exceptionnelle** (et alors par amendement documenté) :

- La **Constitution**, la **Charte**, le **Plan Directeur** — textes de gouvernance.
- L'**Ontologie** (codes canoniques), les **contrats** du Port et du Journal.
- Le **Pattern DSBAT** (méthode de migration).
- Les **moteurs de calcul** (`calculerDevis`, `calculerPiece`, sous-moteurs de `prix.js`) : leurs
  **calculs, quantités et prix** sont figés — toute évolution passe par le Golden Master.
- Les **fiches `*-savoir.js`** (référencent les vrais paramètres, source unique).
- Les **références Golden Master** (`reference.json`, `reference-piece.json`) : ne se recapturent que
  pour un changement **voulu et documenté**.

Ces éléments constituent le **socle gelé** de la V2.

## Dette technique restante

| # | Dette | Nature | Impact |
|---|-------|--------|--------|
| D1 | **reco/oublis fondus** (14 fonctions `*Html`) | domaine + présentation mêlés | empêche de router la part domaine via Port/Journal |
| D2 | **`tauxTVA` dans le HTML** | règle de calcul logée dans l'interface | dernière dépendance calcul ↔ HTML |
| D3 | **État global** (`piecesSelectionnees`, `chantier`, `metiersActifs`) | couplage implicite | les moteurs lisent des globales au lieu de paramètres |
| D4 | **Effets de bord `window.__*`** (×9) | canal de communication global | couplage caché entre calcul, explications et observateurs |
| D5 | **`recalcPiece` dans le HTML** | contrôleur UI logé dans le monolithe | cosmétique, mais alourdit le HTML |
| D6 | **Pas d'Orchestrateur ni d'API** | couches de construction absentes | bloque API / mobile / franchises |
| D7 | **Journal non branché** | observateurs encore passifs | les explications ne viennent pas encore du Journal |
| D8 | **Niveaux de confiance non calculés** | signaux émis, non agrégés | fonctionnalité future en attente |

---

## Missions proposées

Chaque mission suit le **Pattern DSBAT** : additif, réversible, validé « Golden Master identique ».

### A04 — Extraction de `tauxTVA` vers un module *(dette D2)*
- **Objectif** : sortir `tauxTVA` du HTML vers `js/pricing.js` (ou un module dédié).
- **Intérêt** : supprime la dernière règle de calcul logée dans l'interface ; simplifie le harnais.
- **Risques** : faibles (fonction pure, une dépendance : `chantier`).
- **Bénéfices** : le devis ne dépend plus d'aucune fonction résidant dans le HTML.
- **Validation** : Golden Master **devis** identique ; harnais qui n'extrait plus `tauxTVA` par eval.

### A05 — `metiersActifs` (et l'état lu) passés en paramètre *(dette D3)*
- **Objectif** : passer `metiersActifs` explicitement aux fonctions qui le lisent en global (à
  commencer par `moteur-revetements.js`).
- **Intérêt** : retire un couplage global ; rend les modules autonomes et testables sans état ambiant.
- **Risques** : moyens (plusieurs sites d'appel).
- **Bénéfices** : modules purs par signature, préparant le Modèle du Projet.
- **Validation** : les **deux** Golden Master identiques.

### A06 — Remplacer les effets de bord `window.__*` par des données explicites *(dette D4)*
- **Objectif** : faire consommer aux moteurs d'explication et aux observateurs l'**objet retourné**
  par `calculerDevis` (qui contient déjà tableau/vmc/ballon/chauffage/plomberie) plutôt que
  `window.__*`.
- **Intérêt** : supprime un canal global caché ; rend le flux de données explicite.
- **Risques** : moyens (`explicationsTableau`, PDF, observateurs lisent `window.__*`).
- **Bénéfices** : couplage supprimé, testabilité accrue, voie ouverte à l'Orchestrateur.
- **Validation** : Golden Master identique **et** explications/PDF inchangés.

### A07 — Découplage reco/oublis : domaine vs rendu *(dette D1)*
- **Objectif** : scinder chaque fonction `recoSupport*Html`/`oublis*Html` en une fonction **domaine**
  (retourne une donnée) et une fonction **rendu** (retourne le HTML) ; router la part domaine via le
  Port et le Journal.
- **Intérêt** : c'est la **plus grosse dette** ; elle ouvre la recommandation/le contrôle à
  l'architecture (Port + Journal).
- **Risques** : moyens-élevés (14 fonctions, touche l'affichage).
- **Bénéfices** : recommandations et oublis deviennent traçables et explicables ; HTML allégé.
- **Validation** : Golden Master identique (ces suggestions n'entrent pas au devis) **et** rendu HTML
  strictement inchangé (comparaison visuelle / textuelle).

### A08 — Formaliser le **Modèle du Projet (Dossier)** *(fondation B)*
- **Objectif** : introduire l'objet **Projet** normalisé (entrées, hypothèses, décisions, résultats)
  et un adaptateur depuis l'état actuel (`chantier` + `piecesSelectionnees` + `metiersActifs`).
- **Intérêt** : le contrat d'entrée unique de tous les moteurs — pilier de l'indépendance à
  l'interface, prérequis de l'Orchestrateur et de l'API.
- **Risques** : moyens (contrat structurant à figer avec soin).
- **Bénéfices** : socle prêt pour API, mobile, franchises.
- **Validation** : Golden Master identique (l'adaptateur produit le même état de calcul).

### A09 — **Orchestrateur** *(couche de construction, dette D6)*
- **Objectif** : formaliser l'enchaînement calcul par pièce → devis → contrôles → recommandations en
  un **Orchestrateur** produisant un **Dossier calculé** immuable + traces.
- **Intérêt** : source unique de vérité du résultat complet ; point d'ancrage de l'API.
- **Risques** : élevés (couche centrale) — d'où l'exigence de A06/A08 d'abord.
- **Bénéfices** : résultat unique, tracé, réutilisable par tous les canaux.
- **Validation** : Golden Master identique ; contrat de sortie stable.

### A10 — **API d'Exposition** *(couche de construction, dette D6)*
- **Objectif** : définir la surface d'API stable (obtenir un devis, lire le savoir) au-dessus de
  l'Orchestrateur ; le configurateur web en devient le **premier client**.
- **Intérêt** : ouvre API, mobile, intégrations — sans toucher au cœur.
- **Risques** : moyens (contrat public à versionner).
- **Bénéfices** : indépendance à l'interface *prouvée* (deux clients minimum).
- **Validation** : sorties identiques via l'API et via l'appel direct.

### A11 — Brancher le **Journal** comme source des explications *(dette D7)*
- **Objectif** : remplacer les explications ad hoc (`explicationsTableau`, messages) par des
  explications issues du Journal, en miroir puis bascule.
- **Intérêt** : une seule source d'explication, cohérente et traçable.
- **Risques** : moyens (comparer les textes avant bascule).
- **Bénéfices** : explications homogènes, auditables ; les observateurs deviennent utiles.
- **Validation** : explications équivalentes ; Golden Master inchangé.

### A12 — **Niveaux de confiance** *(dette D8)*
- **Objectif** : agréger les signaux déjà émis (inconnues/hypothèses, conflits, part de fiches
  validées) en un **indice de confiance**.
- **Intérêt** : prépare l'IA, la remise commerciale, l'analyse qualité.
- **Risques** : faibles (additif, lecture du Journal).
- **Bénéfices** : score exploitable, sans impact sur le devis.
- **Validation** : score reproductible ; aucun effet sur les montants.

### A13 — Extraction de `recalcPiece` vers `ui.js` *(dette D5, cosmétique)*
- **Objectif** : déplacer le contrôleur `recalcPiece` (lecture DOM → calcul → affichage) hors du HTML.
- **Intérêt** : achève l'allègement du monolithe ; sépare nettement UI et cœur.
- **Risques** : moyens (contrôleur couplé au DOM).
- **Bénéfices** : couche interface clairement isolée.
- **Validation** : les deux Golden Master + rendu identique.

---

## Priorités

**Ordre recommandé** — du plus sûr et fondateur au plus structurant :

```
A04 (tauxTVA) → A05 (metiersActifs) → A06 (window.__*) → A07 (reco/oublis)
   → A08 (Modèle Projet) → A09 (Orchestrateur) → A10 (API)
   → A11 (Journal→explications) → A12 (Confiance) → A13 (ui.js, à tout moment)
```

Logique : d'abord **nettoyer les couplages** (A04–A07) pour que le cœur soit propre ; puis **poser
les contrats** (A08 Projet, A09 Orchestrateur, A10 API) ; enfin **activer** les briques déjà prêtes
(A11 Journal, A12 Confiance). A13 est cosmétique et peut s'intercaler quand c'est commode.

## Risques

- **Toucher le HTML** (A07, A13) : mitigé par le double Golden Master + comparaison du rendu.
- **Couche centrale** (A09) : mitigé en la faisant **après** le nettoyage des couplages (A06/A08).
- **Contrats publics** (A08, A10) : à figer avec soin, versionnés, car ils deviennent des points
  d'appui durables.
- **Explications** (A11) : comparer avant de basculer, ne jamais remplacer sans miroir vert.
- **Sur-ambition** : garder le pas prudent — une mission = une dette, validée avant la suivante.

## Stratégie

Rien ne change dans la méthode : **Pattern DSBAT** intégral. Chaque mission est **additive**,
**réversible**, **testée** contre les deux Golden Master, **documentée**. On ne migre qu'une dette à
la fois ; on ne bascule que sur « identique ». Le socle gelé n'est pas rediscuté : on **construit
dessus**. Les grands contrats (Projet, Orchestrateur, API) sont posés **après** avoir assaini les
couplages, pour ne pas bâtir sur du sable.

## Critères de validation

Une mission de Phase 2 est **terminée** lorsque :

1. Les **deux Golden Master** (devis + par pièce) sont **identiques** (ou, pour un changement voulu,
   la référence est recapturée et documentée).
2. Le **rendu utilisateur** est inchangé (pour les missions touchant l'affichage).
3. La mission est **additive et réversible** ; aucun moteur/calcul/prix modifié (sauf déplacement
   verbatim explicitement validé).
4. Le **couplage visé est réellement supprimé** (vérifié : plus de `window.__*` pour A06, plus de
   `tauxTVA` dans le HTML pour A04, etc.).
5. La mission est **documentée** (rapport + mise à jour de la carte d'architecture).

## Vision finale

À la fin de la Phase 2, DSBAT sera un **moteur d'expertise pur, orchestré et exposé** :

- Un **Modèle du Projet** unique en entrée ; des **moteurs purs** sans état global ni dépendance HTML.
- Un **Orchestrateur** produisant un **Dossier calculé** immuable et **tracé**, avec un **indice de
  confiance**.
- Une **API d'Exposition** dont le configurateur web n'est **qu'un client** parmi d'autres à venir.
- Des **explications issues du Journal**, homogènes et auditables ; le savoir centralisé derrière le
  **Port**.
- Un HTML réduit à une **couche interface** claire (`ui.js`), sans logique métier ni calcul.

Autrement dit : le configurateur d'aujourd'hui deviendra **une façade parmi d'autres** au-dessus d'un
cœur indépendant — prêt, sans refonte, à accueillir l'**API**, la **base de connaissances
centralisée**, l'**application mobile**, les **franchisés**, et de nouveaux domaines (**Dépannage**,
**Approvisionnement**) comme de simples ajouts.

## Conclusion

La Phase 2 ne réinvente rien : elle **assainit les derniers couplages**, **pose les contrats** qui
manquent (Projet, Orchestrateur, API) et **active** les briques déjà construites (Journal, Confiance).
Dix missions (A04–A13), ordonnées du plus sûr au plus structurant, chacune additive, réversible et
validée par le double Golden Master. Le socle gelé de la Phase 1 en sort **prolongé, jamais remis en
cause**. Au terme de la Phase 2, DSBAT sera un cœur d'expertise **indépendant, explicable et ouvert**,
dont l'interface actuelle ne sera plus qu'un client.

*— A03 : Feuille de route officielle de la Phase 2, Moteur DSBAT V2.*
