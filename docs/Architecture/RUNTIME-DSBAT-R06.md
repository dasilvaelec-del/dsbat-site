# Runtime DSBAT – R06

> **Phase Runtime · Mission R06 — Bascule progressive du calcul par pièce.** La même mécanique que R05
> (cache d'amorçage, empreinte d'entrée, repli immédiat, journalisation sans prix) est étendue au
> **calcul par pièce**. Le Runtime produit les résultats par pièce **uniquement** quand le feature flag
> Runtime est actif ; sinon, comportement **strictement identique**. Le moteur historique, le mode
> Shadow et le Runtime sont tous conservés. **Aucun moteur métier modifié.** Le Golden Master reste la
> référence absolue.

---

## Objectifs

Prolonger la bascule contrôlée du devis (R05) au **calcul par pièce** (`calculerPiece`), afin que le
Runtime devienne progressivement la source des résultats — toujours de façon **additive, réversible et
prouvée**.

## Architecture

**Points d'exécution du calcul par pièce** — un seul, dans `recalcPiece` : la séquence en trois temps
(1er `calculerPiece` → `appliquerRevetements` si sols/carrelage → 2e `calculerPiece`). Cette séquence
mute la pièce (surfaces, config, `totalHT`, temps) et retourne l'objet de résultats `R`.

**Extraction (byte-identique)** — la séquence est nommée `calculerPieceComplet(piece, chantier,
metiers)` dans `js/moteur-piece-complet.js` (orchestration de trois appels **existants**, extraite
**verbatim**). `recalcPiece` appelle désormais cette fonction unique — comportement **strictement
identique** (vérifié : 10/10 cas). Cela crée un **point d'aiguillage unique**, comme `calculerDevis`
en R05.

**Chemin Runtime** — un nouvel endpoint `POST /v1/pieces/calcul` (API A10, additif) exécute la même
séquence **côté serveur** sur une **copie** de la pièce et renvoie `{ piece, resultat }`. Un
**adaptateur** `moteurPiece` (composer) l'implémente via `calculerPieceComplet` ; le client Runtime
gagne une méthode `calculerPiece(entree)`. **Aucun moteur métier n'est modifié** : ils sont
référencés, jamais copiés.

**Sélecteur par pièce** — une seconde instance de `MoteurModeDSBAT.creerSelecteurMoteur`, dédiée aux
pièces, avec une **empreinte par pièce** (`modele.empreinte({chantier, metiers, piece})`) et les mêmes
primitives (cache d'amorçage, repli, journal) que R05.

```
   calculerPieceComplet(piece, …) ─▶ SÉLECTEUR PIÈCE (mode runtime)
                                        │  empreinte(chantier, metiers, piece)
                              ┌─────────┴──────────┐
                        cache CHAUD ?          cache FROID ?
                              │                     │
                 SERT { piece, R } du Runtime   REPLI local (calcul par pièce)
                 (fusionné dans la pièce)       + amorçage en arrière-plan
```

## Parcours Runtime

Activé par `?moteur=runtime` :

1. `recalcPiece` appelle `calculerPieceComplet(piece, chantier, metiers)` (routé).
2. Le wrapper calcule l'**empreinte** d'une **copie propre** de la pièce.
3. **Cache chaud** → le résultat `{ piece, resultat }` du **Runtime** est servi ; les champs calculés
   (surfaces, config, `totalHT`, temps, quantités peinture) sont **fusionnés** dans la pièce réelle, et
   `R` est retourné pour l'affichage.
4. **Cache froid** → **repli** calcul local immédiat + **amorçage** Runtime en arrière-plan, de sorte
   que les rendus suivants soient servis par le Runtime (convergence en 2–3 appels identiques).
5. Le résultat Runtime est **byte-identique** au calcul local — sur la pièce mutée **et** sur `R`
   (prouvé sur tous les cas). Le Runtime ne change que le **lieu** d'exécution.

## Parcours historique

Par défaut (aucun flag), `calculerPieceComplet` **n'est pas enveloppé** : `recalcPiece` exécute la
séquence locale, **exactement** comme avant l'extraction. En mode `arret`, ou en **repli**, c'est
également le calcul **local** qui sert. Le moteur historique reste chargé et disponible en permanence.

## Gestion du cache

- **Clé = empreinte** de l'entrée par pièce (`chantier + metiers + piece`) via `ModeleProjetDSBAT.empreinte`.
- **Amorçage** sur une **copie propre** de la pièce (jamais la pièce déjà mutée) → le serveur reçoit une
  entrée cohérente ; `calculerPieceComplet` étant **idempotent** (les passages écrasent, n'accumulent
  pas), un ré-amorçage donne le même résultat.
- **Invalidation implicite** : toute modification de la pièce change l'empreinte → cache froid → repli.
  **Jamais** de résultat périmé servi.
- **Repli permanent** : à froid ou en cas d'échec Runtime, le calcul local sert — le service n'est
  **jamais** interrompu.

## Journalisation

Chaque exécution par pièce est journalisée **sans aucun prix** (P3) : `{ mode, source
('historique' | 'runtime' | 'repli'), empreinte, horodatage }`, accumulée dans
`__moteurPieceDSBAT.rapport()` et `window.__execPiece`. Le rapport unifié `__runtimeDSBAT.rapport()`
agrège **devis** et **pièce**. On suit ainsi les premières exécutions réelles par pièce (servies par
le Runtime, replis, empreintes) sans jamais exposer de montant.

## Validation

```
node runtime/tests/piece-bascule-check.js → ✅ 12 assertions :
     • endpoint /v1/pieces/calcul : { piece, resultat } IDENTIQUE au calcul local
     • cache froid → repli ; après amorçage → Runtime sert (pièce mutée + R identiques)
     • entrée modifiée → cache invalidé ; retour arrière immédiat ; journal SANS prix
     • parité sur TOUS les cas ; DEVIS GLOBAL toujours identique à la référence
node runtime/tests/bascule-check.js       → ✅ devis (R05) inchangé
node runtime/tests/moteur-mode-check.js   → ✅ sélecteur (R04) inchangé
node runtime/tests/shadow-check.js        → ✅ Shadow (R03) inchangé
Refactor recalcPiece → calculerPieceComplet : ✅ byte-identique (10/10 cas)
Golden Master (devis / PIÈCE / reco) + A08/A09/A10 → ✅ tous identiques
Simulation navigateur :
     • défaut → calculerPieceComplet NON enveloppé, comportement identique
     • ?moteur=runtime → repli puis Runtime sert le calcul par pièce (totalHT identique) ; retour arrière → historique
```

**Comparaisons demandées** : **résultats par pièce** (identiques, pièce + `R`), **devis global**
(identique à la référence), **journaux** (sans prix), **Golden Master** (tous verts). La chaîne
pièce → devis est préservée.

## Golden Master

Le Golden Master **par pièce** (`piece-golden-master.js`, qui couvre `calculerPiece` +
`appliquerRevetements`) reste **identique** : R06 ne modifie aucun moteur, seulement le *lieu*
d'exécution et l'aiguillage. Le Golden Master devis reste identique lui aussi. La référence ne change
pas ; seul le lieu d'exécution peut changer, sous flag.

## Préparation de R07

R05 (devis) et R06 (pièce) couvrent désormais **les deux** calculs du navigateur. R07 pourra
**retirer progressivement les calculs du navigateur**, sous réserve des critères :

1. **Parité 100 %** en shadow (devis **et** pièce) sur un **volume représentatif** de trafic réel.
2. **Zéro écart** critique/majeur ; écarts mineurs documentés et non significatifs.
3. **Taux de repli** faible et **latence** (P95) sous seuil, y compris sous la fréquence élevée des
   recalculs par pièce (débounce à prévoir).
4. **Repli** vérifié en conditions réelles (coupure serveur → calcul local sans incident).
5. **Golden Master** toujours vert (devis + pièce).
6. **Retour arrière** unifié testé (`__runtimeDSBAT.retourArriere()` + flag).

Une fois ces critères tenus durablement, R07 cessera de **charger** les moteurs côté client (le
navigateur ne calculera plus), puis R08 retirera prix et moteurs du dépôt public.

## Conclusion

La bascule contrôlée s'étend au **calcul par pièce**, avec **exactement** la mécanique prudente de
R05 : extraction byte-identique de la séquence (`calculerPieceComplet`), endpoint Runtime dédié,
sélecteur par pièce à **cache d'amorçage** clé par empreinte, **repli** local permanent,
**journalisation sans prix**, **retour arrière unifié** immédiat. Le Runtime sert les résultats par
pièce — pièce mutée **et** objet `R` — **byte-identiques** au calcul local, uniquement sous flag ; le
devis global et tous les Golden Master restent identiques ; aucun moteur métier n'a été modifié. Le
navigateur peut désormais faire calculer **devis et pièces** côté serveur, tout en gardant le moteur
historique à portée de main. Migration extrêmement prudente, entièrement réversible, prête pour le
retrait progressif des calculs du navigateur (R07).

*— MISSION R06 : le calcul par pièce aussi peut venir du serveur — et l'on revient au moteur local en un instant.*
