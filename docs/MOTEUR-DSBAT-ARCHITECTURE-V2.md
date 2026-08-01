# Moteur DSBAT — Architecture V2 (charte fondatrice)

> Document de conception. **Aucun code.** Objectif : un moteur d'expertise
> indépendant de l'interface, conçu pour durer au moins dix ans, capable
> d'alimenter le configurateur web, une application mobile, une interface
> franchisé, une API et de futurs agents IA.

---

## 1. Principe directeur

On ne raisonne plus en « pages » ni en « fichiers JS ». On raisonne en **connaissances**
et en **moteurs qui exploitent ces connaissances**.

Trois idées structurent tout le reste :

1. **Séparer ce que DSBAT *sait* de ce que DSBAT *calcule*.**
   La connaissance (catalogue, normes, règles métier) est *déclarative* : des données,
   pas du code. Les moteurs sont *procéduraux* : ils lisent la connaissance et produisent
   un résultat. On peut changer la connaissance sans toucher aux moteurs, et inversement.

2. **L'interface ne connaît jamais le moteur ; le moteur ne connaît jamais l'interface.**
   Entre les deux : un contrat stable (un modèle de données + une API). C'est ce qui permet
   au même moteur de servir le web, le mobile, le franchisé, l'API et l'IA.

3. **Tout résultat est traçable.**
   Chaque prestation, chaque alerte, chaque prix porte son « pourquoi » (quelle règle,
   quelle norme, quel calcul). C'est la condition pour que l'IA, le franchisé et le
   contrôle qualité puissent faire confiance au moteur.

C'est une architecture dite *hexagonale* : un cœur métier pur, entouré d'adaptateurs.
Le vocabulaire ci-dessous reste métier, pas technique.

---

## 2. Analyse des 7 couches proposées — et ce qu'on ajoute

Les 7 couches demandées sont justes. L'analyse fait apparaître **5 briques manquantes**
sans lesquelles l'indépendance à l'interface et la durée de vie de 10 ans ne tiennent pas :

| # | Couche demandée | Verdict | Ajout / précision |
|---|-----------------|---------|-------------------|
| 1 | Catalogue | ✅ conserver | Rendre **multi-fournisseur** et **multi-entreprise** dès la conception |
| 2 | Normes | ✅ conserver | Devient un **moteur de règles versionné et daté** (RE2020 s'applique à partir d'une date) |
| 3 | Règles métier | ✅ conserver | Déclaratives, **sans prix**, exprimées en « implications » |
| 4 | Recommandations | ✅ conserver | Déjà amorcé (moteur-recommandations.js) — jamais appliqué au devis |
| 5 | Contrôles | ✅ conserver | Sortie normalisée : alerte + gravité + localisation |
| 6 | Niveaux de confiance | ✅ conserver | Alimente IA, remise commerciale, qualité |
| 7 | Moteurs métier | ✅ conserver | Deviennent **purs** : lisent les couches, calculent, retournent |
| **+A** | **Référentiel entreprise / franchise** | ⭐ à ajouter | Le « profil actif » (TVA, zones, marges, catalogue choisi) → multi-tenant sans toucher aux moteurs |
| **+B** | **Modèle du projet (le Dossier)** | ⭐ à ajouter | La donnée d'entrée *normalisée*, commune à tous les canaux. Pilier de l'indépendance à l'interface |
| **+C** | **Moteur de chiffrage (pricing)** | ⭐ à ajouter | Sépare « quelles prestations » (règles métier) de « combien ça coûte » (prix + coefficients) |
| **+D** | **Orchestrateur** | ⭐ à ajouter | Le chef d'orchestre : enchaîne les moteurs dans l'ordre, produit un résultat unique et immuable |
| **+E** | **Couche d'exposition (API / SDK)** | ⭐ à ajouter | Le seul point de contact des interfaces. Les moteurs restent invisibles |

---

## 3. Schéma des couches

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INTERFACES (hors moteur)                                                  │
│  Configurateur web · App mobile · Interface franchisé · CRM · Agents IA    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 │  (ne parlent qu'à l'API — jamais aux moteurs)
                    ┌────────────▼─────────────┐
                    │  E. EXPOSITION (API/SDK) │   contrat stable, versionné
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  D. ORCHESTRATEUR        │   enchaîne le pipeline,
                    │  (le chef d'orchestre)   │   produit le « Dossier calculé »
                    └───┬───────┬───────┬──────┘
        ┌───────────────┘       │       └───────────────┐
        ▼                       ▼                        ▼
┌───────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ C. MOTEURS (logique pure, sans état, sans interface)                 │
│  • Moteurs métier      → prestations (quantités, codes, SANS prix)   │
│  • Moteur de chiffrage → montants (applique catalogue + coefficients)│
│  • Moteur de contrôles → alertes / incohérences / oublis + gravité   │
│  • Moteur de recommandations → conseils / options (jamais appliqués) │
│  • Moteur de confiance → complétude / cohérence / fiabilité → score  │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │  lisent (jamais n'écrivent)
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌─────────────────┐   ┌───────────────────────────────────────────────┐
│ B. MODÈLE DU    │   │ A. SOCLE DE CONNAISSANCES (déclaratif, données)│
│    PROJET       │   │  1. Référentiel entreprise / franchise         │
│  (le Dossier :  │   │  2. Catalogue (réf, prix, fournisseurs, unités,│
│   pièces, dims, │   │     temps de pose)                             │
│   équipements,  │   │  3. Normes (NF · DTU · RE2020 · min. régl.)     │
│   choix client) │   │  4. Règles métier (implications, SANS prix)    │
└─────────────────┘   └───────────────────────────────────────────────┘

RÈGLE D'OR DES DÉPENDANCES : les flèches ne montent JAMAIS.
Les interfaces dépendent de l'API ; l'API de l'orchestrateur ; l'orchestrateur des moteurs ;
les moteurs de la connaissance et du modèle projet. La connaissance ne dépend de rien.
```

---

## 4. Rôle de chaque couche

### A — Socle de connaissances (données, zéro logique)

**A1. Référentiel entreprise / franchise.** Le « profil actif » : identité, politique de
TVA, zones et coefficients, marges, quel catalogue fournisseur est utilisé, quelles règles
optionnelles sont activées. C'est **la clé du multi-entreprise/franchise** : on change de
profil, pas de moteur.

**A2. Catalogue.** *Uniquement* : références, prix (fourchette mini/maxi), fournisseurs,
unités, et — évolution prévue — temps de pose par référence. Aucune règle, aucune norme.
Conçu multi-fournisseur : plusieurs catalogues coexistent, le référentiel désigne l'actif.

**A3. Normes.** Cesse d'être un fichier de constantes pour devenir un **corpus de règles
normatives** : NF C 15-100, DTU, RE2020, minimum réglementaire, bonnes pratiques.
Chaque règle est **datée** (date d'entrée en vigueur) et **versionnée** — indispensable sur
10 ans (les normes changent). Elle exprime une *exigence*, pas un prix.

**A4. Règles métier.** La connaissance « chantier » indépendante des normes et des prix,
exprimée en **implications** :
- douche italienne ⟹ étanchéité + caniveau/évacuation + hauteur de faïence ;
- WC suspendu ⟹ bâti-support ;
- cuisine ⟹ prises minimales + arrivées/évacuations d'eau ;
- etc.
Ces règles disent *ce qu'implique* un choix, **jamais combien ça coûte**.

### B — Modèle du projet (le « Dossier »)

La **représentation normalisée** de l'entrée : le logement, les pièces et leurs dimensions,
les équipements existants, les travaux demandés, les choix du client. C'est le **langage
commun** que web, mobile, API et IA remplissent chacun à leur façon. Les moteurs ne lisent
que ce modèle — jamais un formulaire, jamais un DOM. **C'est le pilier de l'indépendance à
l'interface.**

### C — Moteurs (logique pure)

Fonctions **déterministes, sans état, sans effet de bord, sans interface**. Mêmes entrées ⟹
mêmes sorties. Testables et exécutables partout (serveur, mobile, navigateur).

- **Moteurs métier** : à partir du Dossier + Normes + Règles métier, dérivent les
  **prestations** (quantités, codes, dimensionnements : tableau, VMC, plomberie, chauffage…)
  **sans y attacher de prix**.
- **Moteur de chiffrage** : prend les prestations + le Catalogue + les coefficients du
  référentiel (zone, TVA, forfaits, remise) et produit les **montants**. Séparer le chiffrage
  du métier permet de changer les prix sans risque sur les règles.
- **Moteur de contrôles** : produit **alertes / incohérences / oublis** avec un **niveau de
  gravité** et une localisation (quelle pièce, quel poste).
- **Moteur de recommandations** : **conseils, améliorations, options** classés
  (🟢 recommandé / 🟡 à envisager / 🔵 information) — **jamais appliqués automatiquement**.
- **Moteur de confiance** : calcule **complétude, cohérence, fiabilité** → un **indice de
  confiance**. Servira l'IA, la remise commerciale et l'analyse qualité.

### D — Orchestrateur

Le **chef d'orchestre**. Il charge le référentiel, choisit le catalogue/les politiques,
enchaîne les moteurs dans le **bon ordre**, et assemble un **Dossier calculé** unique et
**immuable** : prestations + montants + alertes + recommandations + score + **traces**
(le « pourquoi » de chaque élément). C'est l'unique producteur de vérité — le rôle que joue
aujourd'hui, en plus petit, `calculerDevis`.

### E — Exposition (API / SDK)

Le **seul point de contact** des interfaces. Elle expose un contrat stable et versionné
(« donne-moi un devis pour ce Dossier », « valide ce Dossier », « donne-moi les
recommandations »). Derrière, les moteurs peuvent évoluer librement tant que le contrat tient.

---

## 5. Les échanges entre couches (le pipeline)

Un cycle de calcul, de bout en bout :

1. Une **interface** construit un **Dossier** (modèle projet normalisé) et le remet à l'**API**.
2. L'**orchestrateur** charge le **référentiel** (entreprise/franchise) → sélectionne le
   **catalogue** actif et les politiques (TVA, zones, marges, règles activées).
3. Les **moteurs métier** lisent Dossier + Normes + Règles métier → **prestations** (sans prix).
4. Le **moteur de chiffrage** lit prestations + Catalogue + coefficients → **montants**.
5. Le **moteur de contrôles** lit Dossier + prestations + Normes → **alertes graduées**.
6. Le **moteur de recommandations** lit Dossier + prestations → **conseils** (non appliqués).
7. Le **moteur de confiance** lit Dossier + prestations + contrôles → **score**.
8. L'**orchestrateur** agrège le tout en **Dossier calculé** immuable + **traces**.
9. L'**exposition** sérialise le Dossier calculé pour le canal demandeur (web, PDF, mobile,
   API, IA).

Point clé : les moteurs **lisent** la connaissance, ils ne l'écrivent jamais. La connaissance
est en lecture seule pendant un calcul.

---

## 6. Les dépendances

Une seule direction, vers l'intérieur :

```
Interfaces → Exposition → Orchestrateur → Moteurs → { Connaissances, Modèle projet }
```

- La **connaissance ne dépend de rien** (ni des moteurs, ni de l'interface).
- Les **moteurs** ne dépendent que de la connaissance et du modèle projet.
- **Rien** dans le cœur ne dépend d'un canal (web/mobile/…).

Conséquence directe : ajouter un canal (mobile, API, IA) = ajouter un adaptateur au-dessus de
l'exposition. **Zéro modification du cœur.**

---

## 7. Multi-catalogue · multi-entreprise · multi-franchise

Tout passe par le **référentiel (A1)** injecté au démarrage du pipeline :

- **Plusieurs catalogues fournisseurs** : ils coexistent dans la couche Catalogue ; le
  référentiel désigne l'actif (ou un panachage). Le moteur de chiffrage lit le catalogue
  *résolu* qu'on lui passe — il ne sait même pas qu'il y en a plusieurs.
- **Plusieurs entreprises / franchises** : chaque profil apporte ses prix, ses marges, sa TVA,
  ses zones, ses règles optionnelles. Les moteurs reçoivent ces paramètres en entrée.
- **Résultat** : on ajoute une franchise ou un fournisseur **sans toucher une ligne de moteur**.

---

## 8. Préparer le terrain (sans le développer maintenant)

- **Temps de pose** : simple attribut par référence dans le Catalogue ; un futur *moteur de
  planning* lira les mêmes prestations pour produire délais et charge — sans rien changer.
- **IA** : la connaissance étant *de la donnée* et chaque résultat *tracé*, l'IA peut
  (a) s'appuyer sur le socle pour raisonner sans halluciner, (b) exploiter le score de
  confiance, (c) proposer de nouvelles règles qui entrent par la couche Recommandations.
- **API** : c'est déjà la couche Exposition ; les moteurs purs tournent côté serveur tels quels.
- **CRM** : le Dossier calculé (immuable, horodaté, tracé) est l'objet parfait à persister,
  à versionner et à relier au client.
- **Mobile** : mêmes moteurs, soit appelés via l'API, soit embarqués (logique portable, sans
  dépendance d'interface).

---

## 9. Avantages

- **Indépendance totale à l'interface** : un cœur, plusieurs canaux.
- **Durabilité** : normes et règles versionnées/datées → le moteur vieillit sans se réécrire.
- **Testabilité** : moteurs purs ⟹ jeu de cas de référence qui *verrouille les montants*.
- **Multi-tenant natif** : entreprises, franchises, fournisseurs sans fork des moteurs.
- **Confiance et qualité** : traçabilité + score de confiance exploitables par l'humain et l'IA.
- **Séparation prix / règles** : on met à jour les tarifs sans risque métier, et l'inverse.
- **Migration incrémentale** : on avance brique par brique, sans big-bang (cf. §11).

---

## 10. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **Sur-ingénierie / big-bang** | Blocage, perte de vitesse | Migration incrémentale (§11) ; chaque étape reste livrable et non régressive |
| **Modèle projet instable** | Casse en chaîne des moteurs | Le figer tôt, le versionner, le traiter comme un contrat |
| **Gouvernance des normes** | Règles obsolètes = erreurs | Datation + versioning + un responsable de la mise à jour du corpus |
| **Duplication prix/règles** | Incohérences | Une seule source par donnée ; chiffrage isolé du métier |
| **Performance du pipeline** | Lenteur web/mobile | Moteurs purs = cache/memoïsation faciles ; calcul à la demande |
| **Dérive « le moteur connaît l'UI »** | Perte de l'indépendance | Interdiction stricte : aucun accès DOM/formulaire dans un moteur (revue de code) |
| **Perte de traçabilité** | IA/qualité aveugles | La trace fait partie du contrat de sortie, pas une option |

---

## 11. Trajectoire depuis l'existant (V1.5 → V2)

État actuel : `prix.js` mélange Catalogue **et** moteurs métier ; `normes.js` est surtout des
constantes ; `calculerDevis` (js/moteur-devis.js) joue déjà un mini-orchestrateur ; le moteur
de recommandations est déjà isolé. On capitalise, on ne jette rien.

Étapes proposées, chacune **non régressive** (verrouillée par un jeu de cas de référence) :

1. **Formaliser le Modèle projet** : extraire un « Dossier » normalisé de l'état actuel du
   configurateur (pièces, dims, équipements, choix). Les moteurs lisent le Dossier, plus le DOM.
2. **Scinder `prix.js`** : Catalogue (données pures) d'un côté, moteurs métier de l'autre.
3. **Transformer `normes.js`** en corpus de règles normatives daté/versionné.
4. **Extraire les règles métier** (implications) hors des moteurs vers la couche dédiée.
5. **Isoler le chiffrage** : sortir l'application des prix/coefficients des moteurs métier.
6. **Promouvoir `calculerDevis` en Orchestrateur** avec un contrat de sortie stable
   (Dossier calculé + traces).
7. **Définir l'Exposition (API)** : le configurateur actuel devient le *premier* client de
   cette API, au même titre que le futur mobile.

Avant l'étape 1 : constituer le **jeu de cas de référence** (projets types → montants
attendus) pour garantir qu'aucune étape ne modifie un prix.

---

## 12. Évolutions possibles (horizon 10 ans)

- Corpus de normes multi-pays / multi-langues.
- Tarification dynamique branchée sur les fournisseurs (flux de prix).
- Simulation *what-if* et variantes de devis instantanées.
- Apprentissage : l'IA affine les recommandations à partir de l'historique CRM.
- « Marketplace » de règles métier activables par franchise.
- Mode hors-ligne mobile (moteurs embarqués), synchronisé au retour du réseau.

---

## 13. Décisions à trancher (avant de coder)

1. **Périmètre du Modèle projet v1** : quels champs sont figés dès maintenant ?
2. **Format de la connaissance** : données pures (JSON) chargées, ou modules JS déclaratifs ?
3. **Frontière web/serveur** : moteurs 100 % navigateur au départ, ou API dès la V2 ?
4. **Gouvernance des normes** : qui valide et date les règles normatives ?
5. **Jeu de cas de référence** : combien de projets types pour « verrouiller » les montants ?

> Ces cinq décisions conditionnent la première mission de construction. Le reste de
> l'architecture est stable et peut servir de cap pour les dix prochaines années.
