# Moteur DSBAT — Phase 2 · MISSION A06 : Suppression progressive des effets de bord globaux (`window.*`)

> Troisième mission de la Phase 2, dans l'ordre de la feuille de route (dette D4). `calculerDevis`
> ne **dépend plus** de `window` : son objet retourné devient la source de vérité, les écritures
> `window.__*` deviennent **gardées** (présentes en navigateur pour les consommateurs HTML, ignorées
> sans `window`). *Aucun calcul, règle, prix, prestation, interface ni devis modifié. Les deux Golden
> Master restent strictement identiques.*

---

## Inventaire des effets de bord globaux

| Effet global | Rôle | Où | Décision |
|--------------|------|-----|----------|
| `window.__chauffageAuto` | résultat chauffage | posé par `calculerDevis`, lu par explications/PDF | **gardé** (write) |
| `window.__besoinsTableau` / `__tableauAuto` | besoins + résultat tableau | idem | **gardé** |
| `window.__ballon` | ballon auto | idem | **gardé** |
| `window.__besoinsVMC` / `__vmcAuto` | besoins + résultat VMC | idem | **gardé** |
| `window.__besoinsPlomberie` / `__plomberieAuto` | besoins + résultat plomberie | idem | **gardé** |
| `window.__forfaitAcces` | forfait d'accès | idem | **gardé** |
| `window.calculerDevis` | exposition de la fonction | bas de `moteur-devis.js` (déjà gardé) | **conservé** |
| `window.__*` (readers) | explications, PDF, `construireRecapTexte`, `moteurs/plomberie.js` | HTML + module | **conservés** (voir plus bas) |
| `globalThis.window = {}` | échafaudage de test | harnais Golden Master / observateurs | **conservé** |

Les mentions `window.__*` dans les observateurs sont des **commentaires**, pas du code.

## Analyse

`calculerDevis` **écrivait** 9 valeurs intermédiaires dans `window.__*` **et** les retournait dans
son objet. Les écritures servaient uniquement aux **consommateurs HTML** (blocs d'explication, PDF,
récap) qui lisaient `window.__*` directement. Le moteur **dépendait donc de l'existence de `window`**
(en Node, il fallait un shim), ce qui contredit l'objectif d'exécution hors navigateur.

Point subtil relevé : `window.__besoins*` n'était renseigné que si le métier concerné était actif ;
sinon le retour portait `undefined` (clé omise en JSON). Ce comportement devait être **reproduit à
l'identique**.

## Stratégie retenue

**Additive, prudente, réversible** :

- Un utilitaire local **`_pub`**, créé à chaque appel : `(typeof window !== 'undefined') ? (k,v)=>window[k]=v : ()=>{}`.
  Les écritures `window.__x = v` deviennent `_pub('__x', v)` → **publiées en navigateur, ignorées
  sans `window`**.
- Les besoins intermédiaires (`besoinsTableau`, `besoinsVMC`, `besoinsPlomberie`) sont **hoistés en
  variables locales** (non initialisées → `undefined`, pour reproduire exactement l'ancien JSON), et
  le **retour les lit depuis les locales**, plus depuis `window.__*`.

Ainsi le moteur **n'exige plus `window`** ; l'objet retourné est la **source de vérité**. On **ne
touche pas** aux consommateurs HTML (lecteurs de `window.__*`), qui **ne sont pas couverts par le
Golden Master** — les modifier serait risqué.

## Dépendances supprimées

- **`calculerDevis` ne dépend plus de `window`** : les 9 écritures directes `window.__* =` sont
  remplacées par `_pub` (gardé), et le retour utilise des **locales** au lieu de `window.__besoins*`.

**Preuve** (`tests/golden-master/a06-check.js`, 7 assertions) : `calculerDevis` **s'exécute sans
aucun `window`** (aucun crash), retourne un devis complet (tableau/vmc/plomberie + besoins issus des
locales), **identique à la référence Golden Master** (`totalHT` 11665, `ttc` 12831.5), et **ne crée
pas `window`** (aucune pollution globale).

## Dépendances conservées

- **Les écritures `window.__*` gardées** : maintenues pour les **consommateurs HTML**
  (explications, PDF, `construireRecapTexte`) qui lisent encore `window.__*`. Ce ne sont plus des
  dépendances *dures* (le moteur fonctionne sans), mais un **pont de compatibilité** avec le rendu.
- **Les lecteurs HTML de `window.__*`** et **`moteurs/plomberie.js`** : conservés car **non couverts
  par le Golden Master** (rendu/explications) ; leur migration vers l'objet retourné se fera quand le
  rendu sera sous filet (proche des missions A07/A11).
- **`window.calculerDevis`** (exposition) et **le shim de test** : conservés (déjà gardés / hors
  périmètre).

## Validation Golden Master

```
node a06-check.js                  → ✅ 7 assertions OK (calculerDevis sans window, identique)
node golden-master.js verify       → ✅ Golden Master IDENTIQUE — aucune régression
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
node vmc / plomberie / chauffage / tableau / observateur / a05 / coherence → ✅ tous verts
```

Les briques qui lisent `window.__*` (via leur harnais qui pose un shim) restent identiques : en
présence de `window`, `_pub` publie exactement comme avant. Aucun comportement modifié.

## Compatibilité avec la Constitution

**P2** (le moteur devient autonome du navigateur), **P3** (aucun prix touché), **P7**
(responsabilité inchangée), **P16** (indépendance vis-à-vis de l'environnement — exécutable sans
`window`), **P17/P21** (déterminisme vérifié ; logique déplacée, non réécrite ; `undefined` préservé).

## Compatibilité avec le Plan Directeur / Feuille de route

C'est **exactement la mission A06**, réalisée **dans l'ordre**, avec approche **progressive** (on
supprime la dépendance *dure* sans toucher aux lecteurs HTML risqués), validée par les **deux**
Golden Master.

## Compatibilité avec la Charte

**Additive** (`_pub` gardé + locales), **réversible** (retirer `_pub` et relire `window.__*`
restaurerait l'état), **testable** (preuve A06 + deux Golden Master), **documentée**. Aucune logique
de calcul déplacée.

---

## Préparation de A07

**A07** (dette D1) : découpler les **fonctions reco/oublis** (14 `recoSupport*Html` / `oublis*Html`)
en **domaine** (donnée) + **rendu** (HTML), et router la part domaine via le Port/Journal. Cette
mission mettra les blocs d'explication/rendu sous une forme testable, ce qui **débloquera** ensuite
la migration des derniers **lecteurs `window.__*`** vers l'objet retourné par `calculerDevis` (fin de
la dette D4).

## Conclusion

`calculerDevis` **ne dépend plus de `window`** : son résultat est porté par l'objet retourné, et les
écritures globales ne subsistent que comme **pont de compatibilité gardé** pour le rendu HTML —
prouvé par un test exécutant le moteur **sans navigateur**. Les deux Golden Master sont identiques.
Le Moteur DSBAT se rapproche nettement d'une **exécution indépendante du navigateur**, prête pour un
hébergement **derrière une API**. Avancée prudente, additive et entièrement réversible.

*— MISSION A06 : le calcul du devis s'exécute sans navigateur.*
