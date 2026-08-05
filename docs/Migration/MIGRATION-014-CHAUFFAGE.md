# Moteur DSBAT — MIGRATION 014 : Migration du moteur Chauffage

> Le pattern standardisé (MIGRATIONS 010–013) est appliqué au moteur Chauffage, **premier moteur
> couplé** (ses circuits nourrissent le tableau électrique). Ses **connaissances séparables**
> deviennent des fiches accessibles par le **Port**, son **raisonnement** est **journalisé
> passivement** — sans toucher au moteur, et **le montant comme le couplage restent identiques**.
> *Aucun calcul, règle, prix, prestation, devis, recommandation, alerte ni interface modifié.
> Golden Master intégralement valide.*

---

## Analyse du moteur Chauffage

`prix.js` → `dimensionnementChauffage(pieces, ch)` (V1 : électrique). Pour chaque pièce de vie, il
calcule un besoin de puissance (surface × hauteur/référence × W/m²), **sélectionne des radiateurs**
(`selectionRadiateurs`, gloutonne avec tolérance), ajoute un thermostat, et produit sorties fil
pilote + **nombre de circuits**. **Particularité : moteur couplé** — dans `calculerDevis`, le
chauffage est calculé **avant** le tableau et `chauffage.nbCircuits` est **réinjecté** dans les
besoins du tableau (`b.circuitsChauffage`).

## Connaissances identifiées

Séparables et relevant du Référentiel :

- `wParM2` (puissance W/m² par niveau d'isolation) + `hauteurRef` — règle thermique.
- `isolationParAge` (âge du bâti → niveau d'isolation) — règle métier.
- `piecesChauffees` (pièces de vie chauffées) — règle métier.
- `maxWparCircuit` (~4600 W par circuit 20 A) — règle électrique normative.
- **Norme** : `RE2020 / RT Existant` — déjà exposée par le Port depuis `normes.js`.

## Connaissances volontairement laissées dans le moteur (avec justification)

- **`radiateurs`** (codes catalogue `ELEC_RAD_*` + watts) et **`thermostatCode`** (`ELEC_THERMO`) :
  **fortement couplés au catalogue** → restent dans le moteur (le savoir décrit le besoin, pas la
  référence).
- **`tolerance` (0,10)** et l'**algorithme `selectionRadiateurs`** : **paramètre et logique de
  calcul**, pas une règle de Référentiel → restent dans le moteur.
- **La réinjection `nbCircuits` → tableau** : c'est du **calcul** (orchestration), pas du savoir →
  reste dans le moteur.

Principe : on migre **ce qui est prêt et clairement du Référentiel**, pas plus (prudence).

## Intégration au Port

`js/chauffage-savoir.js` présente les connaissances séparables comme **4 fiches `REGLE_METIER`**
(`CH-PUISSANCE`, `CH-ISOLATION-AGE`, `CH-PIECES-CHAUFFEES`, `CH-CIRCUIT-PUISSANCE`), en **référençant
les vrais paramètres** (source unique, P21 — vérifié : `CH-PUISSANCE.parametres.wParM2.faible ===
CHAUFFAGE_PARAMS.wParM2.faible`). Aucun prix, **aucun code catalogue** (`ELEC_RAD…`, `ELEC_THERMO`
exclus — vérifié par test).

## Observateur

`js/observateur-chauffage.js` — observateur **passif** : il lit `window.__chauffageAuto` (déjà
produit par `calculerDevis`), consulte le savoir via le Port (lecture seule), et consigne le
raisonnement. Il **n'interfère pas** avec l'enchaînement chauffage → tableau : l'observation a lieu
**après** le calcul complet.

## Journalisation

Événements consignés, dans l'ordre : `debut_raisonnement` → `fait` (type de chauffage, âge du bâti,
nb pièces chauffées) → `connaissance_candidate` (RE2020 + identifiants des règles chauffage, via le
Port) → `decision` (niveau d'isolation, W/m², puissances, **nbCircuits + sorties fil pilote** =
couplage tableau) → `fin_raisonnement`. **P3 respecté** : aucun prix dans le Journal. Le **couplage
est rendu visible** dans la trace (nbCircuits journalisés), sans être modifié.

---

## Validation Golden Master

```
node chauffage-migration-check.js  → ✅ 12 assertions OK
     Chauffage chiffré : 1053 € HT (inchangé) | Circuits->tableau : 1 (inchangé)
     4 règles au Port | Journal : 5 événements, 0 prix
node plomberie / isolation / vmc / coherence → ✅   node port-check → ✅ 15/15   node journal-check → ✅ 15/15
node golden-master.js verify → ✅ Golden Master IDENTIQUE — aucune régression
```

Preuves : `dimensionnementChauffage` renvoie **le même résultat, prix inclus** (1053 € HT) ; le
**couplage** `circuitsChauffage` réinjecté au tableau est **identique** avant/après ; le Journal est
**sans prix** ; le devis complet est **identique** à la référence. Mêmes prestations, quantités,
prix, recommandations, alertes, contrôles, devis.

*Fichiers modifiés : **aucun** fichier existant.* Créés : `js/chauffage-savoir.js`,
`js/observateur-chauffage.js`, `tests/golden-master/chauffage-migration-check.js`, ce document.
`prix.js` (`dimensionnementChauffage` + `CHAUFFAGE_PARAMS` + `selectionRadiateurs`) **non touché**.

---

## Compatibilité avec la Constitution

**P1/P2** (connaissances séparables = savoir accessible par le Port), **P3** (aucun prix dans les
fiches ni le Journal), **P4/P11** (raisonnement + couplage tracés), **P6** (savoir via le Port),
**P7** (observateur = témoin), **P21** (fiches référençant les vrais paramètres). Le moteur reste la
source unique des décisions, puissances et montants.

## Compatibilité avec le Plan Directeur

Cinquième « connexion d'un moteur », **premier moteur couplé**, en miroir passif, validé « Golden
Master identique ». Le couplage chauffage → tableau est **observé sans être perturbé** — exactement
la précaution annoncée en M013.

## Compatibilité avec la Charte

Migration **additive**, **réversible**, **testable** (12 assertions + Golden Master), **documentée**.
Aucune logique de calcul déplacée. Périmètre restreint, parfaitement validé.

---

## Enseignements

- **Le pattern absorbe le couplage** : un moteur qui alimente un autre (chauffage → tableau) se
  migre sans difficulté, à condition d'**observer après coup** (jamais pendant) — l'enchaînement de
  calcul reste intact.
- **Le couplage devient traçable** : journaliser `nbCircuits` rend visible, dans le raisonnement, le
  lien chauffage ↔ tableau — utile pour les explications et l'audit, sans rien changer.
- **La distinction savoir / calcul / catalogue se précise** : `wParM2` (savoir) vs `tolerance`
  (calcul) vs `ELEC_RAD_*` (catalogue) — trois natures dans un même `CHAUFFAGE_PARAMS`, dont seule la
  première rejoint le Port.

---

## Préparation de la Migration 015

Restent, côté sous-moteurs de `calculerDevis`, le **Tableau électrique** (`dimensionnementTableau`),
le **hub** dont dépendent chauffage (circuits) et l'ensemble des besoins élec. C'est le plus gros et
le plus central : la MIGRATION 015 l'abordera **en dernier parmi les moteurs de calcul**, avec le
pattern désormais rodé sur cinq moteurs (dont un couplé), en observant sa décision déjà produite
(`window.__tableauAuto`) — comme l'a préfiguré la MIGRATION 008.

---

## Conclusion

Le moteur Chauffage est le **cinquième métier** — et le **premier couplé** — entré dans
l'architecture DSBAT : ses connaissances séparables sont accessibles par le Port, son raisonnement
(couplage tableau compris) est tracé par le Journal **sans le moindre prix**, et il produit
**exactement le même montant et les mêmes circuits qu'avant** (1053 € HT, 1 circuit). Le pattern
tient sur un moteur couplé, au risque le plus faible, parfaitement validé et entièrement réversible.
Le Golden Master reste intégralement valide.

*— MIGRATION 014 : Chauffage. Cinquième moteur métier — premier couplé — dans l'architecture V2.*
