# Moteur DSBAT — MISSION 009 : Analyse stratégique de la première migration métier

> **Étude d'architecture. Aucun code, aucune modification du logiciel.** Objectif : choisir le
> meilleur moteur pour inaugurer les migrations métier, et proposer une feuille de route.

---

## Analyse des moteurs

État réel du code (mesuré sur `prix.js`, `js/coherence.js`, `js/moteur-devis.js`) :

- **Cohérence** (`js/coherence.js`, `controlesCoherence`) — **déjà modulaire**, fonction pure
  `(pieces, ch) → alertes`. Règles = `SEUILS_COHERENCE` (surfaces min par type de pièce, hauteurs,
  ratios). **Aucun prix, aucun impact sur le devis** : ne produit que des alertes informatives.
  Aucune dépendance à d'autres moteurs.
- **VMC** (`dimensionnementVMC`, ~44 lignes) — sous-moteur **petit et isolé** (caisson + gaines +
  rejet), déclenché seulement si le métier VMC est actif et qu'il y a des bouches. Règles :
  `VMC_PARAMS` (débits par bouche, NF DTU 68.3). **Feuille** : ne réinjecte rien ailleurs.
- **Isolation** (`dimensionnementIsolation`, ~30 lignes) — petit, feuille, `ISOLATION_PARAMS`.
- **Plomberie** (`dimensionnementPlomberie`, ~60 lignes) — moyen, feuille (réseaux EF/ECS +
  évacuations), `PLOMBERIE_PARAMS`.
- **Chauffage** (`dimensionnementChauffage` + `selectionRadiateurs`) — moyen, mais **couplé** : son
  nombre de circuits est réinjecté dans le tableau électrique.
- **Électricité / Tableau** (`dimensionnementTableau`, ~130 lignes) — le **plus gros et le plus
  central** ; **hub** qui agrège tous les besoins élec et **dépend** de la sortie du chauffage.
  Règles denses (`MODULES_TABLEAU`, `TABLEAU_PARAMS`, NF C 15-100).
- **Peinture, Sols, Carrelage, Menuiserie** — **pas de sous-moteur dédié** : calculés dans
  `recalcPiece` (dans le HTML), **couplés au DOM**. `PEINTURE_PARAMS`, `SOLS_PARAMS`,
  `CARRELAGE_PARAMS`.

---

## Comparatif

Notes : ✅ favorable · ⚠️ moyen · ❌ défavorable (pour une *première* migration).

| Moteur | Complexité | Dépendances | Volume de règles | Impact prix (risque) | Facilité | Intérêt archi. |
|--------|-----------|-------------|------------------|----------------------|----------|----------------|
| **Cohérence** | ✅ faible | ✅ aucune (modulaire) | ⚠️ moyen | ✅ **nul** (pas de prix) | ✅ élevée | ✅ répète tout le motif |
| **VMC** | ✅ faible | ✅ feuille | ✅ faible | ⚠️ prix (isolé) | ✅ élevée | ✅ 1ᵉʳ chiffrage propre |
| Isolation | ✅ faible | ✅ feuille | ✅ faible | ⚠️ prix | ✅ élevée | ⚠️ moins central |
| Plomberie | ⚠️ moyen | ✅ feuille | ⚠️ moyen | ⚠️ prix | ⚠️ moyen | ✅ utile |
| Chauffage | ⚠️ moyen | ❌ couplé au tableau | ⚠️ moyen | ⚠️ prix | ❌ couplage | ⚠️ à faire après |
| Électricité/Tableau | ❌ élevée | ❌ hub (dépend du chauffage) | ❌ dense | ❌ fort | ❌ faible | ✅ mais trop tôt |
| Peinture/Sols/Carrelage | ⚠️ moyen | ❌ couplé au DOM (recalcPiece) | ⚠️ moyen | ⚠️ prix | ❌ faible | ⚠️ après extraction UI |
| Menuiserie | ✅ faible | ⚠️ catalogue seul | ✅ faible | ⚠️ prix | ⚠️ moyen | ⚠️ faible |

---

## Avantages

Choisir **Cohérence** en premier apporte :

- **Risque prix nul** : elle ne produit aucun montant. Une erreur de migration **ne peut pas**
  changer un devis — la dimension « prix » du Golden Master est intouchable par construction.
- **Déjà isolée** : fonction pure, module autonome, aucune dépendance à un autre moteur.
- **Répétition du motif complet** au plus bas risque : externaliser ses règles en **fiches** lues
  via le **Port**, produire des **Contrôles/Alertes** (objets déjà prévus par le Modèle) et les
  **tracer au Journal** — exactement le schéma des migrations métier à venir, mais sans enjeu
  financier.
- **Sortie facile à comparer** : les alertes sont déjà capturées par le Golden Master ; l'égalité
  se vérifie directement.

Puis **VMC** comme premier moteur **de chiffrage** : petit, feuille, déclenchement étroit — le
meilleur candidat pour inaugurer une migration qui touche un prix, une fois le motif rodé sur la
Cohérence.

---

## Risques

- **Traduire une règle en la modifiant par inadvertance** → mitigé par la comparaison au Golden
  Master (alertes identiques pour Cohérence, montants identiques pour VMC).
- **Fuite de prix dans une fiche** → interdit (P3) ; pour Cohérence, la question ne se pose même pas.
- **Sur-migration** (vouloir tout externaliser d'un coup) → on migre **une famille de règles à la
  fois**, en miroir.
- **Couplages cachés** (chauffage↔tableau) → raison de **ne pas** commencer par ces moteurs.

---

## Recommandation

**Inaugurer par le moteur de Cohérence (MIGRATION 010).** C'est le point d'entrée le plus simple,
le plus propre et le moins risqué : zéro impact prix, déjà modulaire, règles nettement isolées, et
il permet de **répéter l'intégralité du motif** (règles → Référentiel → Port → production →
Journal) sans jamais pouvoir altérer un montant. C'est la répétition générale idéale.

**Enchaîner par la VMC (MIGRATION 011)** comme premier moteur de **chiffrage** migré : petit,
feuille, déclenchement étroit — le plus sûr des moteurs porteurs de prix.

> Si l'on tenait absolument à commencer par un moteur de chiffrage, **VMC** serait le choix ; mais
> la prudence recommande la **Cohérence** d'abord, précisément parce qu'elle ne peut pas casser un
> prix.

---

## Feuille de route proposée

- **MIGRATION 010 — Cohérence** : externaliser `SEUILS_COHERENCE` et les contrôles en fiches (via
  Port), produire les alertes comme objets Contrôle/Alerte, tracer au Journal. *Mêmes alertes.*
- **MIGRATION 011 — VMC** : externaliser NF DTU 68.3 + débits ; le moteur consulte le Port ;
  résultat chiffré **identique**. Premier chiffrage migré.
- **MIGRATION 012 — Isolation** : petit moteur feuille, même motif.
- **MIGRATION 013 — Plomberie** : moteur feuille de taille moyenne.
- **MIGRATION 014 — Chauffage** : à traiter **avant** le tableau côté connaissances, mais en tenant
  compte du couplage (ses circuits nourrissent le tableau).
- **MIGRATION 015 — Électricité / Tableau** : le hub, migré **en dernier** parmi les moteurs de
  calcul, une fois le motif parfaitement rodé.
- **MIGRATION 016+ — Peinture / Sols / Carrelage / Menuiserie** : nécessitent d'abord l'**extraction
  de `recalcPiece`** hors du HTML (migration préparatoire), car ils sont couplés au DOM.
- **Micro-migration parallèle** — sortir `tauxTVA` du HTML vers un module (dette identifiée depuis
  la MIGRATION 005).

---

## Pourquoi cet ordre

Un principe unique le gouverne : **du plus sûr au plus risqué, des feuilles vers le hub**.

- **Sans prix avant avec prix** : Cohérence d'abord — impossible d'altérer un devis.
- **Feuilles avant hub** : VMC, Isolation, Plomberie (indépendants) avant Chauffage (couplé) et
  avant le Tableau (central, dépend du chauffage).
- **Modulaire avant couplé au DOM** : les sous-moteurs de `prix.js` avant peinture/sols/carrelage,
  qui exigent d'abord d'extraire `recalcPiece`.
- **Petit avant gros** : on rode le motif sur de petites surfaces avant d'attaquer le tableau.

Chaque étape est validée « Golden Master identique » et reste réversible.

---

## Compatibilité avec la Constitution

L'ordre proposé respecte le savoir au Référentiel (P1/P2), l'absence de prix dans les décisions
(P3), la traçabilité par le Journal (P4/P11), la responsabilité unique (P7) et le déterminisme
(P17) — avec le Golden Master comme garde-fou permanent. Commencer par un moteur **sans prix**
(Cohérence) est la lecture la plus stricte du principe de prudence.

## Compatibilité avec le Plan Directeur

C'est exactement l'étape « **connexion moteur par moteur, un à la fois, validé Golden Master
identique** » du Plan Directeur, appliquée dans l'ordre « le moins risqué d'abord ». Les coutures
nécessaires (Port, Journal, observateur) sont déjà en place (MIGRATIONS 006–008).

---

## Conclusion

Le meilleur point d'entrée pour les migrations métier est le **moteur de Cohérence** : simple,
isolé, sans aucun impact sur les prix, il permet de répéter l'intégralité du motif de migration au
risque le plus faible possible, avant d'attaquer les moteurs de chiffrage en commençant par le plus
petit et le plus isolé, la **VMC**. La feuille de route qui suit — feuilles avant hub, sans-prix
avant prix, modulaire avant DOM — conduit jusqu'au tableau électrique en gardant, à chaque étape,
un logiciel qui produit exactement les mêmes devis.

*— MISSION 009 : analyse du premier moteur métier. Recommandation : Cohérence, puis VMC.*
