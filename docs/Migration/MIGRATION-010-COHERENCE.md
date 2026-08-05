# Moteur DSBAT — MIGRATION 010 : Première migration métier (Cohérence)

> **Première migration métier réelle.** Le moteur de Cohérence entre dans l'architecture DSBAT :
> ses **règles** deviennent des fiches accessibles par le **Port**, et son **raisonnement** est
> **journalisé passivement** — sans que le moteur de calcul des alertes ne change d'un iota.
> *Aucun prix, quantité, calcul, prestation, devis ni interface modifié. Alertes strictement
> identiques. Golden Master intégralement valide.*

---

## Analyse du moteur

`js/coherence.js` → `controlesCoherence(pieces, ch)` : fonction **pure**, sans DOM, qui retourne un
tableau d'alertes `{ niveau, texte }`. Ses **connaissances** sont les seuils `SEUILS_COHERENCE`
(surfaces minimales par type de pièce, hauteurs plausibles, ratios, écart de surface, typologie).
C'est le candidat idéal (MISSION 009) : **aucun prix**, **aucun impact devis**, déjà modulaire,
règles nettement isolées.

Points d'entrée : le calcul des alertes (`controlesCoherence`) et ses seuils (`SEUILS_COHERENCE`).

---

## Choix de migration

Migration **délibérément partielle et parfaitement validée** (préférence exprimée : « incomplète
mais sûre » plutôt qu'« ambitieuse mais risquée ») :

- **On NE touche PAS** à `controlesCoherence` ni à `SEUILS_COHERENCE` : le calcul des alertes reste
  **exactement** ce qu'il est → alertes identiques par construction.
- **On externalise les règles** de cohérence sous forme de **fiches** (`REGLE_METIER`) accessibles
  par le Port, **en lisant les vrais seuils** (source unique, jamais recopiés).
- **On journalise passivement** le raisonnement (début, faits, connaissances consultées via le Port,
  contrôles produits, fin), en observateur **après coup**.

Ce qui n'est **pas** encore fait (assumé) : rerouter le *calcul* de `controlesCoherence` pour qu'il
lise ses seuils via le Port. Ce serait modifier le chemin de calcul — reporté à une étape ultérieure,
une fois le motif éprouvé, pour ne prendre **aucun risque** de régression maintenant.

---

## Architecture retenue

Trois pièces, toutes additives et inertes (chargées par aucune page) :

- `js/coherence-savoir.js` — présente `SEUILS_COHERENCE` comme **6 fiches `REGLE_METIER`**
  (surface min, hauteur, ouvertures, ratio, écart de surface, chambres/grande surface), en
  **référençant** les valeurs réelles (source unique, P21).
- `js/port-savoir.js` — **étendu** (additif) pour accepter une source `regles` et servir ces fiches
  via le même contrat de lecture seule.
- `js/observateur-coherence.js` — **observateur passif** : lit les alertes déjà produites, consulte
  les règles via le Port, consigne le raisonnement au Journal. Ne recalcule ni ne modifie rien.

Le moteur `controlesCoherence` reste **la source unique** des alertes ; les nouvelles pièces ne font
que **l'observer** et **exposer son savoir**.

---

## Utilisation du Port

Les 6 règles de cohérence sont désormais **accessibles par le Port** comme fiches `REGLE_METIER`
(`COH-SURFACE-MIN`, `COH-HAUTEUR`, `COH-OUVERTURES`, `COH-RATIO`, `COH-ECART-SURFACE`,
`COH-GRANDE-SURFACE-CHAMBRES`). Leurs paramètres **reflètent les vrais seuils** : vérifié par test
(`fiche.parametres.sdb === SEUILS_COHERENCE.surfaceMin.sdb`). Le Port ne les évalue pas ; il les
**fournit** (candidates par périmètre `metier: 'coherence'`).

## Utilisation du Journal

L'observateur journalise, dans l'ordre : `debut_raisonnement` → `fait` (nb pièces, dimensions
renseignées/manquantes, surface déclarée) → `connaissance_candidate` (les identifiants des règles
consultées via le Port) → un `controle` **par alerte** (niveau + texte, **tels quels**) →
`fin_raisonnement`. Le Journal reçoit des données **clonées et figées**, sans lien avec le moteur :
il ne peut pas influencer le calcul.

---

## Fichiers modifiés

- **Modifié (additif)** : `js/port-savoir.js` — accepte et sert une source `regles`. Extension pure ;
  les invariants du Port restent verts (15/15).
- **Créés** : `js/coherence-savoir.js`, `js/observateur-coherence.js`,
  `tests/golden-master/coherence-migration-check.js`.
- **NON touché** : `js/coherence.js` (le moteur), donc **aucune** alerte ne change.

> Aucun fichier **livré** (chargé par une page) n'est modifié : `js/coherence.js` est intact, et les
> nouveaux modules ne sont chargés par aucune page.

---

## Validation Golden Master

```
node coherence-migration-check.js  → ✅ 9 assertions OK
     (alertes AVANT === APRÈS observation ; Port sert 6 règles depuis les vrais seuils ;
      chaque alerte journalisée comme contrôle ; aucun prix dans les fiches)
node port-check.js                 → ✅ 15/15   node journal-check.js → ✅ 15/15
node golden-master.js verify       → ✅ Golden Master IDENTIQUE — aucune régression
```

Preuve de non-régression : `controlesCoherence` renvoie **exactement** les mêmes alertes avant et
après l'observation, et le Golden Master (qui capture déjà les contrôles) est **identique**. Mêmes
prestations, quantités, prix, recommandations, alertes, contrôles, devis.

---

## Compatibilité avec la Constitution

Application du **P1/P2** (les règles de cohérence deviennent du savoir accessible par le Port, sans
quitter leur source), **P3** (aucun prix — le sujet ne se pose pas), **P4/P11** (raisonnement tracé
au Journal), **P6** (le savoir passe par le Port), **P7** (l'observateur reste témoin, jamais
acteur), **P21** (les fiches référencent les vrais seuils, aucune duplication). Le motif complet
— règles → Port → production → Journal — est exécuté au **risque prix nul**.

## Compatibilité avec le Plan Directeur

C'est la première « connexion d'un moteur » du Plan Directeur, appliquée au moteur **le moins
risqué**, en miroir passif, validée « Golden Master identique ». Les coutures (Port, Journal,
observateurs) préparées en MIGRATIONS 006–008 sont réutilisées telles quelles.

## Compatibilité avec la Charte

Migration **additive**, **réversible** (supprimer les nouveaux fichiers et annuler l'extension du
Port laisse la V1.5 intacte), **testable** (9 assertions + Golden Master), **documentée**. Aucune
logique de calcul déplacée. Périmètre volontairement restreint, parfaitement validé.

---

## Préparation de la Migration 011

Le motif étant rodé au risque nul, la MIGRATION 011 pourra l'appliquer au premier moteur **de
chiffrage** : la **VMC** (petit, feuille, déclenchement étroit). On y externalisera les règles
NF DTU 68.3 + débits comme fiches (via le Port), on journalisera le raisonnement en observateur, et
on vérifiera que le **montant reste identique** au Golden Master. Étape suivante possible côté
Cohérence : rerouter, plus tard, le *calcul* pour lire les seuils via le Port (en miroir, à alertes
identiques) — une fois le motif de chiffrage également éprouvé.

---

## Conclusion

Le moteur de Cohérence est le **premier métier entré dans l'architecture DSBAT** : ses règles sont
désormais du savoir accessible par le Port, son raisonnement est tracé par le Journal, et pourtant
**il produit exactement les mêmes alertes qu'avant**. La première migration métier est faite au
risque le plus faible possible — parfaitement validée, entièrement réversible, totalement
transparente pour l'utilisateur. Le Golden Master reste intégralement valide.

*— MIGRATION 010 : Cohérence. Premier moteur métier dans l'architecture V2.*
