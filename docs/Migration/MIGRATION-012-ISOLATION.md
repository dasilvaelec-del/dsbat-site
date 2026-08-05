# Moteur DSBAT — MIGRATION 012 : Migration du moteur Isolation

> Le pattern validé en MIGRATIONS 010–011 est appliqué au moteur Isolation : ses **connaissances**
> deviennent des fiches accessibles par le **Port**, son **raisonnement** est **journalisé
> passivement** — sans toucher au moteur. *Aucun calcul, règle, prix, prestation, devis,
> recommandation, alerte ni interface modifié. Golden Master intégralement valide.*

---

## Analyse du moteur Isolation

`prix.js` → `dimensionnementIsolation(surface, opts)` : produit un **métré informatif** d'un ouvrage
BA13 (plaques, rails, montants, suspentes, bande à joint). **Particularité importante** : ce métré
est **sans prix** — les consommables sont déjà compris dans le prix « fourniture + pose », et les
prestations d'isolation sont chiffrées par pièce. Le moteur est appelé depuis
`devis-configurateur.html` (rendu par pièce), **pas** depuis `calculerDevis`. Il est petit, isolé,
et ne porte aucun montant : candidat idéal (MISSION 009).

## Connaissances identifiées

- **Normes** : `NF DTU 25.41` (plaques de plâtre), `NF DTU 45.10` (soufflage combles), RE2020 —
  **déjà exposées** par le Port depuis `normes.js` (métier `isolation`).
- **Règles métier** (dans `ISOLATION_PARAMS`) : épaisseurs d'isolant conseillées par usage
  (mur/plafond/comble/rampant), taux de chutes et surface de plaque, ratios d'ossature (rails,
  montants, suspentes), métré des joints.

Ne relèvent **pas** du savoir : les codes catalogue (`ISO_LV_120`…), qui restent dans le Catalogue.

## Intégration au Port

`js/isolation-savoir.js` présente `ISOLATION_PARAMS` comme **4 fiches `REGLE_METIER`**
(`ISO-EPAISSEUR`, `ISO-METRE-PLAQUES`, `ISO-METRE-OSSATURE`, `ISO-JOINTS`), en **référençant les
vrais paramètres** (source unique, P21 — vérifié : `ISO-EPAISSEUR.parametres.mur ===
ISOLATION_PARAMS.epaisseurs.mur.mm`). Les fiches ne contiennent **ni prix, ni code catalogue** :
`ISO-EPAISSEUR` n'expose que l'épaisseur en mm, jamais `ISO_LV_120` (vérifié par test).

## Observateur mis en place

`js/observateur-isolation.js` — observateur **passif** : il lit le métré déjà produit par
`dimensionnementIsolation`, consulte le savoir via le Port (lecture seule), et consigne le
raisonnement. Il ne recalcule ni ne re-décide rien.

## Journalisation

Événements consignés, dans l'ordre : `debut_raisonnement` → `fait` (surface, plafond) →
`connaissance_candidate` (NF DTU 25.41 + identifiants des règles isolation, via le Port) →
`decision` (surface, plaques, rails, montants, suspentes, bande à joint) → `fin_raisonnement`.
Conforme à **P3** : le Journal ne reçoit **aucun prix** (vérifié : aucune occurrence de « prix »).

---

## Fichiers modifiés

**Aucun fichier existant modifié.** Fichiers **créés** : `js/isolation-savoir.js`,
`js/observateur-isolation.js`, `tests/golden-master/isolation-migration-check.js`, ce document.
**NON touché** : `prix.js` (`dimensionnementIsolation` + `ISOLATION_PARAMS`), source unique. Modules
chargés par aucune page.

---

## Validation Golden Master

```
node isolation-migration-check.js  → ✅ 10 assertions OK
     Métré : 11 plaques (inchangé) | 4 règles au Port | Journal : 5 événements, 0 prix
node vmc-migration-check.js → ✅   node coherence-migration-check.js → ✅
node port-check.js → ✅ 15/15   node journal-check.js → ✅ 15/15
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

`dimensionnementIsolation` renvoie **le même métré** avant et après l'observation ; le Journal est
**sans prix** ; le Golden Master est **identique**. Mêmes prestations, quantités, prix,
recommandations, alertes, contrôles, devis.

---

## Compatibilité avec la Constitution

**P1/P2** (règles Isolation = savoir accessible par le Port, sans quitter leur source), **P3**
(aucun prix ni dans les fiches, ni dans le Journal), **P4/P11** (raisonnement tracé), **P6** (savoir
via le Port), **P7** (observateur = témoin), **P21** (fiches référençant les vrais paramètres). Le
moteur reste la source unique du métré.

## Compatibilité avec le Plan Directeur

Troisième « connexion d'un moteur », moteur feuille, en miroir passif, validé « Golden Master
identique ». Coutures Port/Journal/observateur réutilisées telles quelles.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (10 assertions + Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements de cette migration

- **Le pattern couvre aussi les moteurs de métré informatif** (sans prix), pas seulement chiffrage
  et contrôle. Même structure, mêmes garanties.
- **La règle « aucun code catalogue dans le savoir » se confirme utile** : `ISOLATION_PARAMS` mêle
  épaisseurs conseillées (savoir) et codes catalogue (`ISO_LV_120`) ; on n'expose que les premières.
  Le savoir décrit le besoin, le Catalogue fournit la référence.
- **Le filtrage par famille** (`REGLE_METIER`), déjà retenu en M011, reste la bonne pratique pour
  distinguer règles et normes d'un même métier.

---

## Préparation de la Migration 013

Trois moteurs migrés (contrôle, chiffrage, métré). La MIGRATION 013 pourra appliquer le pattern à la
**Plomberie** (`dimensionnementPlomberie`, moteur feuille de taille moyenne, appelé par
`calculerDevis` — donc validation du montant via le Golden Master, comme la VMC). On gardera le
**Chauffage** (couplé au tableau) et le **Tableau électrique** (hub) pour la fin, conformément à la
feuille de route M009.

---

## Conclusion

Le moteur Isolation est le **troisième métier** entré dans l'architecture DSBAT : ses connaissances
sont accessibles par le Port, son raisonnement est tracé par le Journal, et il produit **exactement
le même métré qu'avant**. Le pattern tient sur un moteur de métré informatif, au risque le plus
faible, parfaitement validé et entièrement réversible. Le Golden Master reste intégralement valide.

*— MIGRATION 012 : Isolation. Troisième moteur métier dans l'architecture V2.*
