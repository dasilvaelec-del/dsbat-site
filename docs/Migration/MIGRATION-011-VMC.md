# Moteur DSBAT — MIGRATION 011 : Migration du moteur VMC

> **Premier moteur de chiffrage migré.** Le pattern validé en MIGRATION 010 est appliqué à la VMC :
> ses **connaissances** deviennent des fiches accessibles par le **Port**, son **raisonnement** est
> **journalisé passivement** — sans toucher au moteur, et **le montant reste identique**.
> *Aucun prix, quantité, calcul, prestation, devis, recommandation, alerte ni interface modifié.
> Golden Master intégralement valide.*

---

## Analyse du moteur VMC

`prix.js` → `dimensionnementVMC(b)` : à partir des bouches et entrées d'air saisies par pièce, il
dimensionne la **centrale** (caisson simple/double flux, gaines flexibles, manchons, rejet) et
retourne une composition **chiffrée** (`prixTotalHT`). Ses connaissances sont dans `VMC_PARAMS`
(débits par bouche, raccordement, rejet, système). C'est un moteur **petit, feuille, isolé** —
le meilleur candidat pour inaugurer un moteur de chiffrage (MISSION 009).

## Connaissances identifiées

- **Norme** : `NF DTU 68.3` (ventilation) — **déjà exposée** par le Port depuis `normes.js`.
- **Règles métier** (dans `VMC_PARAMS`) : débit d'extraction par bouche (DTU 68.3), raccordement
  (gaine + manchon par bouche), rejet (toiture par défaut / façade), type de système (hygro).

Ne relèvent **pas** du savoir : les prix et les codes catalogue (`VMC_CAISSON_SF`, `VMC_CHAPEAU`…),
qui restent dans le Catalogue (Constitution P3).

## Intégration au Port

`js/vmc-savoir.js` présente `VMC_PARAMS` comme **4 fiches `REGLE_METIER`** (`VMC-DEBIT`,
`VMC-RACCORDEMENT`, `VMC-REJET`, `VMC-SYSTEME`), en **référençant les vrais paramètres** (source
unique, P21 — vérifié : `VMC-DEBIT.parametres.cuisine === VMC_PARAMS.debitParBouche.cuisine`). Les
fiches ne contiennent **ni prix, ni code catalogue** : elles décrivent le besoin, pas la référence.
Servies via la source `regles` du Port (introduite en M010), aux côtés de la norme NF DTU 68.3.

## Observateur mis en place

`js/observateur-vmc.js` — observateur **passif** : il lit les résultats déjà produits par
`calculerDevis` (`window.__besoinsVMC` = les faits, `window.__vmcAuto` = la décision), consulte le
savoir via le Port (lecture seule), et consigne le raisonnement. Il ne recalcule ni ne re-décide
rien : la décision journalisée est **lue** du moteur.

## Journalisation

Événements consignés, dans l'ordre : `debut_raisonnement` → `fait` (bouches, entrées d'air, débit
total) → `connaissance_candidate` (NF DTU 68.3 + identifiants des règles VMC, via le Port) →
`decision` (type, système, débit, rejet, nombre de composants) → `fin_raisonnement`.

**Ligne rouge respectée (P3)** : le Journal ne reçoit **aucun prix**. La décision journalisée décrit
le *raisonnement* (quel système, quel débit, quel rejet), **jamais le montant** — vérifié par test
(aucune occurrence de `prixTotalHT`/`prixUnit` dans le Journal). Le chiffrage reste dans le moteur,
hors de la trace.

---

## Fichiers modifiés

**Aucun fichier existant modifié.** (`git status` : uniquement des fichiers nouveaux.)

Fichiers **créés** : `js/vmc-savoir.js`, `js/observateur-vmc.js`,
`tests/golden-master/vmc-migration-check.js`, ce document.

**NON touché** : `prix.js` (`dimensionnementVMC` + `VMC_PARAMS`), source unique des décisions et des
prix. Les nouveaux modules ne sont chargés par aucune page.

---

## Validation Golden Master

```
node vmc-migration-check.js   → ✅ 10 assertions OK
     VMC chiffrée : 767 € HT (inchangé) | 4 règles au Port | Journal : 5 événements, 0 prix
node coherence-migration-check.js → ✅   node port-check.js → ✅ 15/15   node journal-check.js → ✅ 15/15
node golden-master.js verify  → ✅ Golden Master IDENTIQUE — aucune régression
```

Preuves : `dimensionnementVMC` renvoie **le même résultat, prix inclus**, avant et après
l'observation (767 € HT) ; le Journal est **sans prix** ; le devis complet (`totalHT`, `ttc`) est
**identique** à la référence Golden Master. Mêmes prestations, quantités, prix, recommandations,
alertes, contrôles, devis.

---

## Compatibilité avec la Constitution

**P1/P2** (les règles VMC deviennent du savoir accessible par le Port, sans quitter leur source),
**P3** (aucun prix ni dans les fiches, ni dans le Journal — point central pour un moteur de
chiffrage), **P4/P11** (raisonnement tracé), **P6** (savoir via le Port), **P7** (observateur =
témoin), **P21** (fiches référençant les vrais paramètres). Le moteur reste la **source unique** des
décisions et des montants.

## Compatibilité avec le Plan Directeur

Deuxième « connexion d'un moteur », premier moteur **de chiffrage**, en miroir passif, validé
« Golden Master identique » — exactement l'étape prévue après la Cohérence (MISSION 009). Coutures
Port/Journal/observateur réutilisées telles quelles.

## Compatibilité avec la Charte

Migration **additive**, **réversible** (supprimer les nouveaux fichiers laisse la V1.5 intacte),
**testable** (10 assertions + Golden Master), **documentée**. Aucune logique de calcul déplacée.
Périmètre volontairement restreint, parfaitement validé.

---

## Enseignements de cette migration

- **Le pattern M010 transfère sans friction à un moteur de chiffrage.** Même structure : fiches
  (savoir) + observateur (trace) + moteur intact (calcul/prix).
- **La frontière du prix se confirme nette** : le prix vit dans le moteur/catalogue, **jamais** dans
  le savoir ni dans le Journal. C'est ce qui distingue un moteur de chiffrage d'un moteur de
  contrôle, sans changer le pattern.
- **Détail d'ingénierie utile** : lister les fiches « par métier » renvoie aussi les *normes* de ce
  métier (elles partagent le tag). Pour cibler les seules règles, filtrer **par famille**
  (`REGLE_METIER`). Enseignement pour les migrations suivantes.

---

## Préparation de la Migration 012

Le motif est désormais rodé sur un contrôle (Cohérence) **et** un chiffrage (VMC). La MIGRATION 012
pourra l'appliquer au prochain moteur feuille : **Isolation** (petit, indépendant) ou **Plomberie**
(feuille, taille moyenne), toujours en observateur passif, à montant identique. On réservera le
**Chauffage** (couplé au tableau) et le **Tableau électrique** (hub) pour plus tard, comme prévu par
la feuille de route M009.

---

## Conclusion

La VMC est le **premier moteur de chiffrage** entré dans l'architecture DSBAT : ses connaissances
sont accessibles par le Port, son raisonnement est tracé par le Journal **sans le moindre prix**, et
pourtant **elle produit exactement le même montant qu'avant** (767 € HT). Le pattern de migration
tient sur un moteur porteur de prix, au risque le plus faible possible — parfaitement validé,
entièrement réversible, totalement transparent. Le Golden Master reste intégralement valide.

*— MIGRATION 011 : VMC. Premier moteur de chiffrage dans l'architecture V2.*
