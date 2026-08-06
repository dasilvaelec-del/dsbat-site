# Runtime DSBAT – R09

> **Phase Runtime · Mission R09 — Retrait progressif du patrimoine métier du dépôt public
> (1re étape concrète).** R09 réalise le **premier retrait réel** d'un composant métier de la surface
> navigateur : **`js/pricing.js`** quitte le dépôt public et devient **exclusivement Runtime** ; ses
> 4 accesseurs de prix sont désormais servis par la **vue tarifaire auto-hébergée** (dérivée, sans
> formule ni marge). Migration **additive, progressive et totalement réversible** ; **aucune règle,
> aucun calcul, aucun prix, aucune prestation** modifiés. Le Golden Master reste la référence absolue.

---

## Objectifs

R08 a prouvé qu'une **vue tarifaire** (prix d'affichage résolus, sans formule ni marge) reproduit **à
l'identique** les 4 accesseurs de `js/pricing.js`. R09 en tire la première conséquence concrète : **le
navigateur cesse de charger `js/pricing.js`**. La cartographie des dépendances (préalable de la mission)
établit que ces 4 accesseurs — `getPrixPrestFor`, `getMoyenPrixFor`, `tempsUnitaire`, `findPrestLabel` —
sont la **seule** raison pour laquelle `pricing.js` était servi au client, et qu'ils sont utilisés à la
fois par l'**affichage** (32 points) et par le **calcul local** (`moteur-piece.js`, `js/moteurs/*.js`).
La vue les remplace **intégralement** et **sans serveur** (actif statique auto-hébergé), pour l'affichage
**comme** pour le calcul. Objectif : faire du navigateur une **interface** qui lit des prix résolus, et
du Runtime le **propriétaire** de la couche d'accès au catalogue.

## Composants retirés

**`js/pricing.js` — retiré du dépôt public et déplacé côté Runtime privé** : `runtime/moteur-prive/pricing.js`.

- Le configurateur ne le charge plus (`<script src="js/pricing.js">` supprimé).
- Les 4 accesseurs globaux (`getPrixPrestFor`/`getMoyenPrixFor`/`tempsUnitaire`/`findPrestLabel`) sont
  **installés depuis la vue auto-hébergée** `js/vue-tarifaire-data.js` **avant tout moteur**, via
  `VueTarifaireDSBAT.installerDepuisEmbarque(window)`. Le calcul local et l'affichage lisent donc des
  **prix résolus**, jamais le catalogue.
- Côté serveur, `pricing.js` reste utilisé par le Runtime (environnement) et par le harnais Golden
  Master — c'est-à-dire **le moteur et sa référence**, désormais **du côté privé**.

Artefacts **ajoutés** (dérivés, non secrets) : `js/vue-tarifaire-data.js` (vue auto-hébergée) et
`runtime/bin/generer-vue.js` (générateur reproductible de la vue à partir du catalogue privé).

## Dépendances restantes

Ce qui **empêche encore** de retirer **`prix.js`** du navigateur (blocage assumé, traité en R10) : le
**calcul local** (mode par défaut et **repli**) en a toujours besoin, non pour les prix d'affichage
(désormais servis par la vue) mais pour :

- les **paramètres métier** : `SOLS_PARAMS`, `CARRELAGE_PARAMS`, `ISOLATION_PARAMS`, `VMC_PARAMS`,
  `PLOMBERIE_PARAMS`, `CHAUFFAGE_PARAMS`, `TABLEAU_PARAMS`, `PEINTURE_PARAMS`, `quantitesPeinture` ;
- la **logique de dimensionnement** : `dimensionnementTableau / VMC / Chauffage / Plomberie / Isolation`,
  `selectionRadiateurs`, `coefZone` / `ZONES`, `MODULES_TABLEAU` ;
- **une** lecture structurelle de prix subsistante dans `moteur-devis.js` (ballon d'eau chaude
  automatique : `PRIX.plomberie_divers`), seul accès à un **prix brut** encore présent côté navigateur.

Restent donc dans le dépôt public (interface + moteur local de repli) : `prix.js`, `js/moteur-devis.js`,
`js/moteur-piece.js`, `js/moteur-revetements.js`, `js/moteur-piece-complet.js`, `js/moteurs/*.js`,
`js/coherence.js`, `js/moteur-tva.js`, plus les **contrôleurs** (`js/moteur-mode.js`, `js/tarifs-mode.js`),
le **client d'accès** (`js/runtime-client.js`, `js/modele-projet.js`, `js/shadow.js`) et la **vue**
(`js/vue-tarifaire.js`, `js/vue-tarifaire-data.js`).

## Dépendances supprimées

- **Dépendance navigateur → `js/pricing.js`** : **supprimée** (plus chargé, plus référencé).
- **Appels navigateur aux formules de résolution de prix** — `prixElec`, `prixPlomberie`, `appCost`,
  table `APPAREILLAGE`, `COEF_FOURNITURE` : **plus aucun appelant côté navigateur** (seul `pricing.js`
  les utilisait). Ils demeurent physiquement dans `prix.js` (encore chargé pour les paramètres et
  dimensionnements) mais sont **inertes dans le navigateur** ; ils quitteront le client avec `prix.js`
  en R10.
- **Dépendance serveur** : le Runtime et le Golden Master requièrent désormais
  `runtime/moteur-prive/pricing.js` (repointage des `require`), matérialisant la frontière **privée**.

## Impact GitHub

- **Déplacé** : `js/pricing.js` → `runtime/moteur-prive/pricing.js` (via `git mv`, historique conservé).
- **Ajouté** : `js/vue-tarifaire-data.js`, `runtime/bin/generer-vue.js`,
  `tests/golden-master/r09-navigateur-sans-pricing.js`.
- **Modifié** : `devis-configurateur.html` (retrait de l'include `pricing.js` + installation des
  accesseurs de vue par défaut, avec bascule `?tarifs=catalogue`), `js/vue-tarifaire.js`
  (`installerAccesseurs` / `installerDepuisEmbarque`), `js/tarifs-mode.js` (`creerAccesseursCatalogue`
  pour le retour arrière), `runtime/src/environnement.js` et cinq harnais Golden Master + le filet R08
  (repointage du `require` de `pricing.js`).
- **Aucune suppression brutale** : le seul « retrait » est un **déplacement** réversible d'un `git
  revert`. Le dépôt public reste pleinement fonctionnel hors-ligne (la vue est auto-hébergée).

## Impact sécurité

- **Frontière rendue concrète.** Pour la première fois, un fichier de la couche métier quitte
  physiquement la surface publique du navigateur pour un emplacement **Runtime privé**
  (`runtime/moteur-prive/`). Le navigateur n'exécute plus la **couche d'accès au catalogue** : il lit des
  **montants résolus** issus de la vue (aucune formule, aucune marge, aucune décomposition).
- **Portée réelle et limites.** `pricing.js` n'était pas, en soi, le secret : le **cœur du patrimoine
  tarifaire** (numéros de prix, `APPAREILLAGE`, `COEF_FOURNITURE`, formules) vit dans **`prix.js`**, encore
  servi pour les **paramètres/dimensionnements** et une lecture ballon. R09 **prépare** son retrait sans
  encore l'exécuter : c'est l'objet de **R10**. La protection devient significative quand `prix.js`
  quitte le client.
- **Réversibilité = sécurité.** Tant que `prix.js` reste présent, `?tarifs=catalogue` (ou
  `__tarifsDSBAT.retourArriere()`) reconstruit **à l'identique** les accesseurs d'origine — le retrait
  n'est jamais un point de non-retour.

## Validation Golden Master

Aucun code métier modifié (déplacement + réinstallation d'accesseurs **prouvés identiques**). Preuves
exécutées, toutes vertes :

```
Moteur (référence)
  Golden Master devis / PIÈCE / reco-oublis        → ✅ IDENTIQUES (verify)
  migrations carrelage / peinture / sols (repointées) → ✅ inchangées
  A08 / A09 / A10                                  → ✅ 18 / 17 / 18 OK
Runtime (R02–R08)
  parité · smoke HTTP · Shadow · sélecteur · bascule devis · bascule pièce → ✅ verts
  vue tarifaire (R08) 9/9 · bascule tarifaire (R08) 9/9  → ✅
  endpoint GET /v1/tarifs/vue → 200 (304 prestations)   → ✅ (après déplacement)

R09 — navigateur SANS pricing.js (r09-navigateur-sans-pricing.js) → ✅ 5/5
  • calcul par pièce (10 cas) rejoué avec les accesseurs de la VUE → 0 écart vs reference-piece.json
  • devis-configurateur.html ne charge plus js/pricing.js ; charge la vue auto-hébergée
  • js/pricing.js absent du dossier public ; présent dans runtime/moteur-prive/
```

**Démonstration exigée par la mission :**
- *le navigateur ne dépend plus des composants retirés* : le calcul complet par pièce est **byte-identique**
  au Golden Master **sans** `pricing.js`, les prix venant de la vue ;
- *les Golden Master restent identiques* : moteur, migrations, A08–A10, R02–R08 → verts ;
- *les mécanismes de retour arrière fonctionnent* : `?tarifs=catalogue` / `retourArriere()` reconstruisent
  les accesseurs catalogue (0 écart, 6 080 variantes) ;
- *le Runtime devient l'unique détenteur* de la couche d'accès concernée (`runtime/moteur-prive/pricing.js`).

## Retour arrière

Trois niveaux, du plus fin au plus radical :

1. **Runtime, instantané** : `?tarifs=catalogue` dans l'URL, ou `window.__tarifsDSBAT.retourArriere()`
   en console → réinstalle les accesseurs reconstruits depuis `prix.js` (toujours chargé). Aucune
   reconstruction de page, aucun écart.
2. **Configuration** : `localStorage['dsbat_tarifs'] = 'catalogue'` fige le mode catalogue.
3. **Dépôt** : `git revert` du commit R09 restaure `js/pricing.js` et son include. Le déplacement étant
   un `git mv`, l'historique et le contenu sont intacts.

## Préparation de R10

R10 visera le **cœur du patrimoine** : sortir **`prix.js`** (numéros de prix, `APPAREILLAGE`,
`COEF_FOURNITURE`, formules) du navigateur. Chemin préparé par R09 :

- **router la lecture ballon** de `moteur-devis.js` via la vue (`getMoyenPrixFor` / `findPrestLabel`),
  supprimant le dernier accès à un prix brut côté client ;
- **scinder** `prix.js` en une part **non-price** (paramètres + dimensionnements + `coefZone`) restant
  utile au repli local, et une part **catalogue de prix** devenant **exclusivement Runtime** — ou faire
  du **Runtime le calculateur par défaut** (R05/R06 déjà routables) pour retirer le repli local et, avec
  lui, tout besoin de catalogue au navigateur ;
- à chaque étape : parité shadow, Golden Master vert, repli conservé jusqu'au bout.

## Conclusion

La séparation Interface / Moteur devient **concrète** : `js/pricing.js` a **quitté** la surface publique
du navigateur pour le **Runtime privé**, et les prix d'affichage proviennent désormais d'une **vue
auto-hébergée** — sans formule, sans marge, sans serveur. Le navigateur calcule et affiche **exactement
comme avant** (Golden Master pièce **identique**, 10 cas, 0 écart), tous les filets R02–R08 restent
verts, et le **retour arrière** est immédiat à trois niveaux tant que `prix.js` demeure. Le blocage
résiduel est **nommé précisément** — le calcul local a encore besoin des **paramètres, dimensionnements**
et d'**une** lecture de prix brut — et fixe l'objet de **R10** : sortir enfin le **catalogue de prix**
du dépôt public. La migration reste **additive, progressive et totalement réversible**, sécurisée par le
Golden Master.

*— MISSION R09 : premier composant métier effectivement retiré du navigateur ; la couche d'accès aux prix vit désormais côté Runtime, l'interface ne fait plus que lire.*
