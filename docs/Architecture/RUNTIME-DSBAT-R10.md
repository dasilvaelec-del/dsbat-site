# Runtime DSBAT – R10

> **Phase Runtime · Mission R10 — Retrait définitif du catalogue de prix du dépôt public.**
> Le navigateur **ne reçoit plus le catalogue** : `prix.js` est déplacé côté **Runtime privé**. Les prix
> par prestation viennent de la **vue auto-hébergée** (R08/R09) ; le **devis global** (tableau, VMC,
> plomberie, chauffage, zones, TVA) est désormais calculé par le **Runtime**, devenu **dépendance
> officielle**. Le calcul **par pièce** reste **local** (métrés non-tarifaires + vue). Migration
> **additive, réversible, protégée par le Golden Master**. Aucun prix, aucune règle, aucun calcul modifiés.

---

## Objectifs

R09 avait isolé la couche d'accès (`pricing.js`) mais laissé `prix.js` dans le navigateur, car le calcul
local en avait encore besoin. R10 **supprime cette dépendance publique**. Décision de cadrage validée : le
**Runtime est une dépendance officielle**. On sépare donc, dans `prix.js`, ce qui est **tarifaire et
secret** (qui part définitivement côté Runtime) de ce qui est **non-tarifaire** (métrés/quantités, qui
reste public pour le calcul par pièce). Le navigateur devient une **interface** : il décrit le projet,
affiche des prix résolus, et **délègue au Runtime le chiffrage global**.

## Analyse des dépendances restantes

Les points bloquants identifiés en R09, et leur traitement :

- **Paramètres (métrés)** — `SOLS_PARAMS`, `CARRELAGE_PARAMS`, `ISOLATION_PARAMS`, `PEINTURE_PARAMS`,
  `TEMPS_PARAMS`, `quantitesPeinture`, `potsPourLitres`, `dimensionnementIsolation` : **coefficients de
  surface, rendements, épaisseurs, consommables** — explicitement « aucun prix en dur ». **Rôle** :
  calcul des quantités par pièce. **Migration** : extraits **verbatim** vers le module PUBLIC
  `js/parametres-metier.js`. **Sûr** : non-tarifaires, prouvés identiques au privé (anti-dérive).
- **`coefZone` / `ZONES`** — coefficients de zone appliqués au **total** : **tarifaire**. **Rôle** :
  chiffrage global. **Migration** : reste **privé** ; appliqué par le Runtime dans le devis global.
- **Dimensionnements** — `dimensionnementTableau/VMC/Plomberie/Chauffage`, `MODULES_TABLEAU`,
  `selectionRadiateurs` : **mélangent métré ET chiffrage** (retournent `prixTotalHT`, lisent les prix des
  modules, la marge ×1,45, les taux de main-d'œuvre). **Tarifaires**. **Migration** : restent **privés** ;
  exécutés par le Runtime. Seules les **explications** (texte descriptif, **sans prix**) restent côté
  interface, alimentées par le résultat renvoyé par le Runtime.
- **Lecture ballon** (`PLO_BALLON_*` dans `moteur-devis`) : dernier accès à un **prix brut**. **Rôle** :
  ligne ballon du devis global. **Migration** : exécutée **par le Runtime** (le devis global entier y passe).
- **Autres** — `moteur-devis.js` (orchestration : mappe la config en « besoins ») reste public mais
  **inerte par défaut** (utilisé seulement par le repli local explicite). Il ne contient **aucun prix**.

## Migrations réalisées

1. **Extraction publique non-tarifaire** — `js/parametres-metier.js` : paramètres de métré + fonctions de
   quantités + **explications** (tableau/VMC/plomberie/chauffage/isolation) copiées **verbatim**. Les
   explications ne lisent que des **seuils de dimensionnement** (jamais les taux de main-d'œuvre ni les
   prix des modules — sous-ensemble strict de `TABLEAU_PARAMS`/`CHAUFFAGE_PARAMS`).
2. **Catalogue privé** — `git mv prix.js → runtime/moteur-prive/prix.js` ; tous les `require`
   serveur/tests repointés. Le Runtime en est **l'unique propriétaire**.
3. **Navigateur sans catalogue** — `devis-configurateur.html` : suppression de `<script src="prix.js">`,
   ajout de `js/parametres-metier.js`. Le **calcul par pièce reste local** (métrés publics + vue).
4. **Devis global au Runtime** — `renderPhase3` et `genererPDFConfig` deviennent **asynchrones** et
   appellent `__obtenirDevisRuntime()` (client Runtime, base configurable `CONFIG.runtime.base`,
   mémoïsation par empreinte). Le devis renvoyé (mêmes champs, **besoins** inclus) republie les effets
   `window.__*` : les explications du récap/PDF restent **identiques**. Indisponibilité → état
   « réessayer » (pas de plantage).
5. **Anti-dérive** — `tests/golden-master/parametres-drift-check.js` garantit `public ≡ privé`.

## Catalogue désormais privé

**Exclusivement côté Runtime** (`runtime/moteur-prive/`) — jamais servi au navigateur :

- `prix.js` : `PRIX` (tous les prix), `APPAREILLAGE`, `COEF_FOURNITURE` (marge ×1,45), `prixElec` /
  `prixPlomberie` / `appCost` (formules), `MODULES_TABLEAU` (prix modules), les **dimensionnements**
  chiffrants, `TABLEAU_PARAMS` **complet** (taux de main-d'œuvre), `coefZone` / `ZONES`, `selectionRadiateurs` ;
- `pricing.js` (déjà privé en R09).

Le navigateur ne détient plus **aucun prix, aucune marge, aucune formule, aucun taux, aucun coefficient
de zone**.

## Impact GitHub

- **Déplacé** : `prix.js` → `runtime/moteur-prive/prix.js` (`git mv`, historique conservé).
- **Ajouté (public, non-secret)** : `js/parametres-metier.js` ; **tests** `parametres-drift-check.js`,
  `r10-navigateur-sans-prix.js`, `r10-devis-runtime-parite.js`.
- **Modifié** : `devis-configurateur.html` (retrait catalogue + devis global asynchrone au Runtime),
  `config.js` (bloc `runtime`), `runtime/src/environnement.js` et harnais Golden Master (`require` repointés).
- **Aucune suppression brutale** : `git revert` restaure `prix.js` et l'ancien chargement.
- **Note d'exploitation** : le site étant **statique**, le devis global requiert le **Runtime déployé**
  (URL HTTPS + CORS dans `CONFIG.runtime.base`). Le calcul par pièce et l'affichage restent **hors-ligne**.

## Impact sécurité

- **Protection du catalogue désormais complète côté navigateur** : plus aucune donnée ni logique
  tarifaire n'est envoyée au client. Le patrimoine (prix, marges, formules, dimensionnements chiffrants,
  zones) vit **exclusivement** dans le Runtime privé, derrière l'API (authentification A10, journalisation
  sans prix). Le client ne voit que des **montants résolus** (vue) et un **devis calculé** (Runtime).
- **Surface résiduelle publique** : métrés non-tarifaires (rendements, pertes, épaisseurs) et
  orchestration `moteur-devis` (mappage config → besoins), **sans aucun prix**. Les explications sont du
  **texte descriptif** dérivé d'un résultat déjà chiffré.
- **Réversibilité = sécurité** : tant que la bascule est réversible (`sourceDevis`/`git revert`), le
  retrait n'est jamais un point de non-retour.

## Validation Golden Master

Aucun code moteur modifié (déplacement + extraction **verbatim**, prouvée identique). Filets, tous verts :

```
Anti-dérive params (public ≡ privé)                         → ✅ 26/26 (dont explications tableau/VMC/plomberie/chauffage)
R10 navigateur SANS prix.js (calcul pièce, 10 cas)          → ✅ 7/7  · 0 écart vs reference-piece.json
R10 devis GLOBAL Runtime ≡ local (3 cas métiers actifs)     → ✅ 6/6  · tableau/VMC/plomberie/chauffage/zone/ballon/TVA/besoins identiques
Moteur : Golden Master devis / PIÈCE / reco                 → ✅ IDENTIQUES (verify)
Migrations tableau/VMC/chauffage/plomberie/…/A06/A09/A10    → ✅ inchangées
Runtime R02–R08 (parité, smoke, shadow, sélecteur, bascules, vue, tarifs) → ✅ verts
5 blocs <script> inline du configurateur                    → ✅ syntaxe valide
```

**Démonstration exigée :** `prix.js` n'est plus chargé par le navigateur (include retiré, fichier absent
de la racine publique) ; le Runtime est **l'unique source du catalogue** (`runtime/moteur-prive/prix.js`,
requis uniquement côté serveur/tests) ; tous les Golden Master restent **identiques** ; le devis global
via Runtime est **byte-identique** au calcul local de référence.

## Retour arrière

Trois niveaux :

1. **Configuration** — `CONFIG.runtime.sourceDevis = 'local'` : rebascule le devis global sur le calcul
   local historique (nécessite `prix.js` restauré côté navigateur). `CONFIG.runtime.base` permet de
   pointer un autre Runtime instantanément.
2. **Dépôt** — `git revert` du commit R10 : restaure `prix.js` public et son `<script>`, réactive le
   calcul local complet. Le déplacement étant un `git mv`, contenu et historique sont intacts.
3. **Interface** — le calcul **par pièce** et l'**affichage** ne dépendent pas du Runtime (vue
   auto-hébergée + métrés publics) : ils continuent de fonctionner même Runtime indisponible ; seul le
   **devis global** affiche alors un état « réessayer ».

## Préparation de la phase suivante

Le catalogue de prix est protégé. Restent, pour une future phase, à porter côté Runtime les **règles non
tarifaires** encore publiques si on le souhaite (cohérence, recommandations/oublis — déjà sous filet
A07), et à **durcir l'exploitation** : déploiement du Runtime (HTTPS, CORS, disponibilité), authentification
effective (crochet A10), et éventuel **portage du calcul par pièce** au Runtime si l'on veut retirer aussi
les métrés publics. Ces étapes sont **optionnelles** : le patrimoine **tarifaire**, cœur de la protection,
est désormais **hors du navigateur**.

## Conclusion

La protection du catalogue de prix DSBAT est **achevée côté navigateur** : `prix.js` a quitté le dépôt
public pour le **Runtime privé**, et le client ne reçoit plus **aucune logique tarifaire** — seulement des
**prix résolus** (vue) et un **devis calculé par le Runtime**. Le calcul par pièce et l'affichage restent
**locaux et hors-ligne** grâce aux métrés non-tarifaires publics et à la vue auto-hébergée ; le devis
**global** — tableau, VMC, plomberie, chauffage, zones, TVA — est produit par le Runtime, **byte-identique**
au calcul historique (6/6), sans qu'aucun prix, règle ou calcul n'ait été modifié. Tous les Golden Master
sont **verts**, la migration est **additive** et le **retour arrière immédiat** à trois niveaux. Le
navigateur est devenu une **interface** ; le **Runtime** est l'**unique détenteur du patrimoine tarifaire**.

*— MISSION R10 : le catalogue de prix DSBAT ne quitte plus jamais le Runtime ; le navigateur ne fait que décrire et afficher.*
