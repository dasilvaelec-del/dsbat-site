# Moteur DSBAT — Phase 2 · MISSION A04 : Extraction de `tauxTVA` vers un module

> Première mission de la Phase 2, appliquée **strictement dans l'ordre** de la feuille de route.
> `tauxTVA` (et son pendant `labelTVA`) quittent le HTML pour un module dédié `js/moteur-tva.js`.
> *Déplacement verbatim, aucune règle/calcul/prix modifié. Les deux Golden Master restent
> strictement identiques.*

---

## Contexte

La Phase 1 est close ; la feuille de route A03 ouvre la Phase 2 par le **nettoyage des couplages
restants**. La première dette (D2) est la présence de `tauxTVA` — une règle de calcul de la TVA —
**dans le script inline du HTML**, alors qu'elle est consommée par `js/moteur-devis.js`
(`calculerDevis`). C'était la **dernière dépendance calcul ↔ HTML**.

## Analyse

`tauxTVA()` (10 % rénovation / 20 % neuf, extension, local) et `labelTVA()` (libellé associé)
étaient définies dans le HTML (lignes 2774–2785). `tauxTVA` lit la globale `chantier` ; `labelTVA`
appelle `tauxTVA`. Toutes deux **pures au sens DOM** (aucun accès HTML). Elles étaient appelées
depuis le HTML (`labelTVA` : 4 sites d'affichage) et depuis `moteur-devis.js` (`tauxTVA`). Le harnais
Golden Master les **extrayait du HTML par `eval`** (technique héritée de M005), dépendance fragile.

Le déplacement est donc **sûr** : ce sont des fonctions pures, à dépendance unique (`chantier`,
résolue à l'appel), et le module chargé comme script classique conserve leur portée globale.

## Objectif

Sortir `tauxTVA` + `labelTVA` du HTML vers `js/moteur-tva.js`, sans changer une virgule de leur
logique, en préservant tous les sites d'appel et en supprimant l'extraction par `eval` dans les tests.

## Travail réalisé

1. **Création** de `js/moteur-tva.js` : `tauxTVA` + `labelTVA` déplacées **verbatim** (via `sed`,
   sans réécriture) + export Node.
2. **Retrait** du bloc du HTML (remplacé par un commentaire pointeur) et **ajout** de
   `<script src="js/moteur-tva.js">` **avant** `moteur-devis.js` (après `pricing.js`).
3. **Mise à jour des harnais** : les 6 tests qui extrayaient `tauxTVA` du HTML par `eval`
   (`golden-master.js` + `observateur-check.js` + `vmc/plomberie/chauffage/tableau-migration-check.js`)
   **requièrent désormais le module** — fin de l'extraction par `eval`.

## Fichiers modifiés

- **Créé** : `js/moteur-tva.js`.
- **Modifié (allègement)** : `devis-configurateur.html` (**+2 / −12** ; `tauxTVA`/`labelTVA` retirés,
  4 appels préservés, script ajouté).
- **Modifié (tests)** : `tests/golden-master/golden-master.js`, `observateur-check.js`,
  `vmc-migration-check.js`, `plomberie-migration-check.js`, `chauffage-migration-check.js`,
  `tableau-migration-check.js` — basculés de l'`eval`-depuis-HTML vers `require('js/moteur-tva.js')`.
- **NON touché** : `prix.js`, `moteur-devis.js`, `moteur-piece.js` (aucune logique/calcul/prix).

## Validation

```
node -e (moteur-tva)              → tauxTVA(neuf)=0.2, tauxTVA(renov)=0.1, labelTVA correct
syntaxe scripts inline HTML       → 2 blocs, 0 erreur
node golden-master.js verify      → ✅ Golden Master IDENTIQUE — aucune régression
node piece-golden-master.js verify→ ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
vmc / plomberie / chauffage / tableau / observateur → ✅ tous verts
```

`tauxTVA` n'est **plus défini dans le HTML** (0 occurrence) ; les 4 sites d'appel `labelTVA()` sont
préservés (résolus vers le module global) ; ordre de chargement vérifié
(`pricing.js` → `moteur-tva.js` → `moteur-devis.js`). Aucun devis ni comportement modifié.

## Compatibilité avec la Constitution

**P2** (une règle rejoint un module dédié, hors interface), **P3** (aucun prix touché), **P7**
(responsabilité isolée : la règle fiscale), **P16** (module neutre, sans dépendance d'interface),
**P17/P21** (déterminisme vérifié ; déplacement, pas copie). Le calcul du devis ne dépend plus
d'aucune fonction résidant dans le HTML.

## Compatibilité avec le Plan Directeur / Feuille de route Phase 2

C'est **exactement la mission A04**, réalisée **dans l'ordre** prévu (première du nettoyage des
couplages), avec le critère de validation annoncé (« Golden Master devis identique » — obtenu, et
même les deux Golden Master).

## Compatibilité avec la Charte

Déplacement **verbatim** (aucune réécriture), **additif/réversible** (remettre le bloc dans le HTML et
retirer le `<script>` restaure l'état), **testable** (deux Golden Master + 4 briques), **documenté**.
Un fichier livré touché (HTML, allégé), un module neuf, des tests mis à jour.

## Enseignements

- **La dette D2 était la plus simple** : une fonction pure, un déplacement verbatim, un gros bénéfice
  (fin de la dépendance calcul ↔ HTML **et** fin de l'`eval`-depuis-HTML dans les tests).
- **Le double filet reste souverain** : même une extraction triviale est validée par les deux Golden
  Master avant d'être actée.
- **Résidu mineur assumé** : les 5 harnais conservent un `const html` désormais inutilisé (lecture
  inoffensive) — nettoyage cosmétique possible plus tard, hors périmètre A04.

## Préparation de la mission suivante

**A05** (dette D3) : passer `metiersActifs` en **paramètre** des fonctions qui le lisent en global
(à commencer par `moteur-revetements.js`), pour retirer un couplage global et rendre les modules
autonomes par signature — validé sur les **deux** Golden Master. Puis **A06** (remplacer les effets
de bord `window.__*` par les données déjà retournées par `calculerDevis`).

## Conclusion

`tauxTVA` et `labelTVA` vivent désormais dans `js/moteur-tva.js`, déplacés tels quels : le devis ne
dépend plus d'aucune fonction du HTML, l'extraction par `eval` disparaît des tests, et les **deux
Golden Master sont identiques**. La Phase 2 démarre par une avancée nette, prudente et entièrement
réversible — exactement selon la feuille de route.

*— MISSION A04 : `tauxTVA` est un module. Première dette de couplage soldée.*
