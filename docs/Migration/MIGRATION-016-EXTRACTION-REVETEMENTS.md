# Moteur DSBAT — MIGRATION 016 : Extraction de appliquerRevetements() vers un module

> **Déplacement de code, pas de réécriture.** `appliquerRevetements()` et son bloc de helpers
> (faïence + sol) quittent le HTML pour un module dédié `js/moteur-revetements.js`. *Aucun calcul,
> surface, quantité, règle, prix, recommandation, alerte ni devis modifié. Les deux Golden Master
> restent strictement identiques.*

---

## Analyse de l'existant

`appliquerRevetements(piece, surfaces)` vivait dans le grand script **inline** de
`devis-configurateur.html`, au sein d'un **bloc contigu** (lignes 2011–2111) regroupant : `_r2`,
`SOL_MATERIAUX`, `solMateriauxDispo`, `deriveSolMateriau`, `FAIENCE_PARAMS`, `faienceModeDefaut`,
`faienceModesDispo`, `faienceLongueur`, `faienceSurfaceBase`, `deriveFaience` et
`appliquerRevetements`. Ces fonctions sont **pures** (aucun accès au DOM, vérifié en A01/A02) et
constituent le point d'entrée des futurs moteurs Peinture / Sols / Carrelage. La mission A02 les a
placées **sous filet** (Golden Master par pièce), ce qui autorise leur déplacement en sécurité.

## Stratégie d'extraction

**Déplacement verbatim, zéro réécriture.** Le bloc a été extrait **tel quel** (via `sed`, sans
retouche) vers `js/moteur-revetements.js`, puis retiré du HTML et remplacé par un **commentaire
pointeur**. Le module est chargé comme **script classique** (`<script src>`), immédiatement après
`js/moteur-piece.js` : ses symboles restent donc **globaux** et accessibles depuis le script inline,
exactement comme avant. Aucune signature n'a changé, aucun appelant n'a été réécrit.

## Nouveau module

`js/moteur-revetements.js` — les 11 symboles du bloc, à l'identique, plus un export Node pour les
tests. Chargé en 49ᵉ position dans le HTML (`<script src="js/moteur-revetements.js">`), avant toute
utilisation à l'exécution. Séparation des responsabilités : **logique métier pure** dans le module ;
**accès DOM et affichage** restent dans `recalcPiece` (contrôleur, HTML) ; **aucune** dépendance HTML
dans le module.

## Dépendances supprimées

- **Le couplage du bloc au fichier HTML monolithique** : les helpers de revêtements ne sont plus
  noyés dans les ~3000 lignes du script inline ; ils forment un module isolé et testable.
- **L'extraction par `eval` dans le harnais** : le Golden Master par pièce **requiert désormais le
  module** au lieu d'extraire le code du HTML par `eval` (dépendance fragile supprimée, harnais
  simplifié).

## Dépendances conservées

- **`metiersActifs` (variable globale)** : `appliquerRevetements` et `solMateriauxDispo` la lisent
  encore comme **globale**, résolue à l'appel via la portée partagée des scripts classiques.
  *Pourquoi conservée* : changer la signature pour la passer en paramètre modifierait les appelants
  et créerait un risque de régression — contraire à la prudence demandée. C'est un couplage résiduel
  assumé, candidat à une évolution ultérieure (passer l'état en argument).
- **Écriture de `piece.config` / `piece.solType`** : c'est la **fonction** de `appliquerRevetements`
  (alimenter le modèle), pas une dépendance à retirer.

## Golden Master global

```
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```
Le devis complet est inchangé.

## Golden Master calcul par pièce

```
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
```
**Preuve décisive** : la référence `reference-piece.json` avait été capturée en A02 **depuis le bloc
logé dans le HTML** ; après extraction, le harnais **requiert le module** et obtient un résultat
**byte-pour-byte identique**. Le déplacement préserve donc exactement le comportement (surfaces,
quantités de revêtements, faïence, `totalHT`). Syntaxe du HTML et du module vérifiée (0 erreur).

---

## Compatibilité avec la Constitution

**P2** (le code métier rejoint un module dédié, exploitable par les moteurs), **P3** (aucun prix
touché), **P7** (responsabilité unique : le module = logique de revêtements, le contrôleur = DOM),
**P16** (module neutre, sans dépendance d'interface), **P17/P21** (déterminisme vérifié ; aucune
duplication — le code est *déplacé*, pas copié).

## Compatibilité avec le Plan Directeur

Étape de **modularisation** préparant les migrations Peinture / Sols / Carrelage : on isole leur
point d'entrée avant de migrer leurs connaissances. Validée « deux Golden Master identiques ».

## Compatibilité avec la Charte

Déplacement **verbatim** (aucune réécriture), **réversible** (remettre le bloc dans le HTML et
retirer le `<script>` restaure l'état), **testable** (les deux Golden Master), **documenté**. Un seul
fichier livré touché (`devis-configurateur.html` : −101/+2), plus le module neuf.

---

## Préparation de la Migration 017

Le point d'entrée des revêtements étant isolé et sous filet, la **MIGRATION 017** pourra appliquer le
**pattern DSBAT** au premier de ces métiers — vraisemblablement la **Peinture** (`calculerPiece` gère
déjà la peinture auto ; `PEINTURE_PARAMS` est dans `prix.js`) : exposer ses connaissances via le
Port, observer passivement, journaliser — à **résultat identique** sur les deux Golden Master.
Prochaines extractions possibles : passer `metiersActifs` en paramètre (retirer le couplage global),
puis découpler les fonctions reco/oublis (domaine vs rendu), et sortir `tauxTVA` du HTML.

---

## Conclusion

`appliquerRevetements()` et ses helpers vivent désormais dans `js/moteur-revetements.js`, **déplacés
tels quels**, sans qu'une seule surface, quantité ou prix ne change : les **deux Golden Master
(devis et pièce) sont identiques**, la preuve la plus forte d'une extraction neutre. Le HTML s'allège
de 100 lignes, le point d'entrée des futurs moteurs de revêtements est isolé et testable, et la voie
est ouverte pour la MIGRATION 017 (Peinture). Extraction prudente, réversible et parfaitement
validée.

*— MIGRATION 016 : appliquerRevetements est un module. Le dernier gros bloc historique est isolé.*
