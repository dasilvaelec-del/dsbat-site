# AUDIT TECHNIQUE COMPLET — MODULE ÉLECTRICITÉ DSBAT
**Date : 2026-07-28 · Périmètre : devis.html, devis-configurateur.html, prix.js, normes.js, config.js, devis-common.js, devis-electricite.html · Aucune modification effectuée.**

---

## 0. CONSTAT PRÉALABLE IMPORTANT

Il existe **deux modules électricité** dans le code :

1. **`devis-electricite.html`** — ancienne page dédiée. Son moteur JavaScript a été **remplacé par un commentaire placeholder** (`// ... (tout le script existant) ...`, ligne 216). Les boutons appellent `changerGamme()`, `appliquerNorme()`, `genererPDF()` qui **n'existent plus** → la page est **non fonctionnelle** (conteneur `prestations-container` jamais rempli, totaux figés à 0 €). Seul le bloc « Conformité aux normes » (via `normes.js`) s'affiche.
2. **`devis-configurateur.html`** — moteur actuel et vivant. C'est lui qui est audité en détail ci-dessous.

---

## 1. PARCOURS UTILISATEUR COMPLET

### Étape A — `devis.html` : wizard 4 étapes (porte d'entrée obligatoire)

Le configurateur est verrouillé : sans `client.nom` + `client.tel` en sessionStorage, redirection `devis.html?configurateur=1`.

**Panel 1 — Coordonnées**
| Question | Champ | Type |
|---|---|---|
| Nom complet * | `clientNom` | text |
| Téléphone * | `clientTel` | tel |
| Email | `clientEmail` | email |
| Adresse | `clientAdresse` | text |
| Code postal * | `clientCP` | text (déclenche `chargerVilles()`) |
| Ville | `clientVille` | select (affiche la zone tarifaire via `majZone()`) |
| Comment nous avez-vous connu | `clientSource` | select |
| Délai souhaité | `clientDelai` | select |
| Type de demande | `typeDemande` | select : `travaux` / `depannage` (le dépannage bifurque vers l'estimateur rapide) |

**Panel 2 — Caractéristiques chantier**
| Question | Champ | Valeurs |
|---|---|---|
| Type de projet * | `typeProjet` | renov / neuf / extension |
| Type de bien * | `typeBien` | maison / appartement / local / autre |
| Statut * | `typeLogement` | principal / secondaire / locatif / vente |
| Étage (conditionnel appartement) | `etage` | 0–4 |
| Ascenseur (conditionnel) | `ascenseur` | oui / non |
| Surface totale (m²) * | `surface` | number 10–1000 |
| Nombre de pièces principales * | `pieces` | 1–6 |
| Hauteur sous plafond | `hauteurPlafond` | standard / haut / tres_haut |
| Âge du bâtiment | `ageBati` | recent / moyen / ancien / tres_ancien |
| État général | `etatLieux` | bon / moyen / mauvais |
| Accès véhicule | `accessibilite` | facile / moyen / difficile |
| Contraintes | `accessSup` | aucune / voisins / occupé / copro |
| Tableau électrique actuel | `tableauExistant` | recent / ancien / inexistant / inconnu |
| Chauffage | `chauffage` | electrique / gaz / fioul / pompe / autre |
| VMC existante | `vmc` | oui / defaillante / non |
| Eau chaude | `eauChaude` | chaudiere / ballon / instantane / autre |
| Gamme matériaux | `qualiteMateriaux` | eco / standard / premium |
| Domotique | `domotique` | non / basique / complet |
| Borne VE | `borneVE` | non / oui |
| Panneaux solaires | `pv` | non / oui |

**Panel 3 — Corps de métier** : 8 checkboxes `metier` (electricite, plomberie, vmc, isolation, peinture, menuiserie, sols, carrelage) + `description` libre.

**Panel 4 — Récap + envoi** : `collecterDonnees()` → sessionStorage :
- `client` = { nom, tel, email, adresse, source, delai }
- `chantier` = { codePostal, ville, typeBien, typeLogement, surface, pieces, ageBati, etatLieux, typeProjet, hauteurPlafond, accessibilite, qualiteMateriaux, chauffage, vmc, tableauExistant, borneVE, pv, domotique }
- `devisMetiers` = [métiers cochés]

⚠️ **BUG CRITIQUE** : `etage`, `ascenseur`, `accessSup` et `eauChaude` sont **demandés au client mais jamais enregistrés** dans `collecterDonnees()`. Voir §7.

Puis email FormSubmit + WhatsApp pré-rempli + redirection `devis-configurateur.html` (1 s).

### Étape B — `devis-configurateur.html` : 3 phases

**Phase 1 — Mes pièces**
- Choix de l'**objectif projet** (`objectifProjet`) : `normes` / `standard` (défaut) / `confort`.
- **Proposition automatique de composition** (`appliquerTypologie()` → `compositionTypologie(pieces, surface)`) : mapping T1→T6 (salon, chambres, cuisine, sdb, wc, entrée, couloir dès T4) + enrichissement (sde si ≥110 m² et T5+, 2e WC si ≥120 m²) avec bandeau d'explication des raisons.
- Compteurs par type de pièce (19 types : salon, salle_manger, cuisine, bureau, chambre, dressing, sdb, sde, wc, entree, couloir, escalier, cave, veranda, garage, terrasse, jardin, facade, carport).
- Saisie des dimensions par type : `l`, `la`, `h` (défaut 2,5), `fenetres` (défaut 1), `portes` (défaut 1) → `dimsParType`.
- `validerPieces()` : **fusion** (conserve les configs existantes par id+numero), puis **moteur de cohérence** `controlesCoherence()` non bloquant (seuils `SEUILS_COHERENCE` : surfaces mini par pièce, hauteur 2,2–3,2 m, max 4 portes / 5 fenêtres, ratio allongement 5, écart ±25 % surface saisie vs déclarée, ≥150 m² avec <3 chambres). Acquittable (« Continuer quand même »).
- Sur chaque pièce créée : `elecMethode` par défaut via `poseParDefaut(chantier)` (neuf/extension→placo ; bon→saillie ; mauvais→saignee ; sinon goulotte_enc), `elecGamme` via `gammeElecParDefaut` (eco→dooxie, standard→mosaic, premium→celiane), `ploGamme` idem.
- Puis `appliquerNorme(i)` (minimum NF verrouillé) + `appliquerObjectif(p)` (conseils DS.BAT retirables, mémorisés dans `_recoApplique`).

**Phase 2 — Configuration pièce par pièce**
- Onglets par pièce ; rappel dimensions + surfaces auto (sol = l×la ; plafond = sol ; murs nets = 2(l+la)h − 1,5×fenêtres − 2,0×portes).
- Section Électricité : bandeau norme + « moteur a raisonné ainsi » (`explicationsPiece`) + sélecteurs pose/gamme + lignes de prestation avec badges **🔒 Norme** / **💡 Conseil DS.BAT** (avec raison) / **Option**.
- Prestations élec proposées selon la pièce (`getElecPourPiece`) : base (PL simple, PL VV, PL télérupteur, prise simple, prise double) + cuisine (20A, 32A, SC20 hotte) + sdb/sde (sèche-serviette, liaison équipotentielle) + salon/salle à manger (TV, RJ45, volet, thermostat) + chambre/bureau/entrée (variantes) + sortie câble fil pilote si `chauffage === 'electrique'`.
- Compteurs +/− : `changerQty()` **plancher = minimum norme** (`newVal = Math.max(minNorme, current + delta)`) — impossible de descendre sous la norme.
- `recalcPiece()` à chaque modification : surfaces, peinture auto, sols auto, prestations manuelles, total pièce, sauvegarde sessionStorage (`configEtatV1`).

**Phase 3 — Récapitulatif**
- Somme des `totalHT` pièces.
- **Dimensionnement automatique du tableau** (voir §2) si électricité active et `tableauExistant !== 'recent'`.
- Ballon d'eau chaude si `chantier.eauChaude === 'ballon'` (mort — variable jamais enregistrée).
- Forfait accessibilité (+80 € moyen, +200 € difficile), suppléments accessSup (morts), majoration ×1,088 logement occupé (morte).
- Coefficient de zone `coefZone(codePostal)` sur le **total** (Z1=1,00 / Z2=1,13 / Z3=1,22 Paris+petite couronne).
- TVA `tauxTVA()` : local pro ou neuf/extension → 20 %, sinon 10 %.
- Acomptes 40/30/30 sur TTC.
- **Lead automatique** : email FormSubmit dès l'affichage du prix (une fois, `__recapEnvoye`).
- Explication du tableau (`explicationsTableau`), alertes de cohérence résiduelles, PDF (html2pdf, N° `DSBT-<timestamp>`), envoi email avec PDF joint + WhatsApp pré-rempli.

### Variables d'état globales du configurateur
`piecesSelectionnees[]` (id, nom, icon, numero, dims{l,la,h,fenetres,portes}, config{metier:{code:qty}, peinture_auto, sols_auto}, elecMethode, elecGamme, ploGamme, normeMin, _recoApplique, surfaces, totalHT), `metiersActifs[]`, `chantier{}`, `objectifProjet`, `compteurs{}`, `dimsParType{}`, `phaseActuelle`, `pieceActiveIndex`, `__coherenceAcquittee`, `__recapEnvoye`, `window.__tableauAuto`, `window.__besoinsTableau`, `window.__ballon`, `window.__forfaitAcces`.

---

## 2. MOTEUR DE CALCUL

### 2.1 Modèle de prix (prix.js)
- **Postes à appareillage** : `prix = pose[méthode] + appareillage[gamme]`.
  - 4 méthodes de pose : `saillie` / `goulotte_enc` / `placo` / `saignee`, chacune avec fourchette {min, max}.
  - 3 gammes encastré : `dooxie` / `mosaic` / `celiane` ; en saillie la gamme est forcée à `asl` (sélecteur désactivé).
  - `APPAREILLAGE` : prix de vente unitaire HT par mécanisme (prise, inter, bp, rj45, tv, tv_sat, sortie_cable, cmd_volet, cmd_vmc, hp) = achat HT × `COEF_FOURNITURE` (1,45).
  - Chaque poste déclare sa recette : ex. `ELEC_PL_VV` → `app:{inter:2}` ; `ELEC_PRISED` → `app:{prise:2}` ; `ELEC_PL_3BP` → `app:{bp:3}`.
- **Équipements** à prix unique (thermostat, radiateurs, sèche-serviette, VMC, coffret VDI, prise de terre, liaison équipotentielle, parafoudre, etc.).
- Le moteur affiche la fourchette min–max mais **calcule toujours sur la moyenne** : `getMoyenPrixFor = (min+max)/2`.

### 2.2 Fonctions du moteur (liste exhaustive)

**prix.js** : `appCost(app, gamme)`, `prixElec(poste, methode, gamme)`, `prixPlomberie(poste, gamme)`, `coefZone(cp)`, `dimensionnementTableau(b, params)`, `explicationsTableau(b, r)`.

**devis-configurateur.html** :
- Rendu : `renderPiecesSelection`, `renderGrid`, `renderPhase2`, `renderPieceConfig`, `renderMetierSection`, `renderPrestRow`, `renderPeintureAuto`, `renderSolsAuto`, `selecteursElec`, `selecteursPlomberie`, `renderPhase3`.
- Métier/pièce : `getPrestationsPourPiece`, `getElecPourPiece`, `getPlombPourPiece`, `getCarrelagePourPiece`, `getIsolationPourPiece`, `getMenuiseriePourPiece`, `getVmcPourPiece`.
- Norme & conseils : `normeMin(pieceId, portes, surface)`, `recoDSBAT(pieceId, dims, ch, niveau)`, `appliquerNorme(index)`, `appliquerObjectif(piece)`, `setObjectif`, `majObjectifUI`, `bandeauNorme`, `explicationsPiece`, `explicationsPieceHtml`.
- Typologie & cohérence : `compositionTypologie`, `appliquerTypologie`, `afficherPropositionTypologie`, `controlesCoherence`, `afficherCoherence`, `masquerCoherence`.
- Défauts chantier : `poseParDefaut`, `gammeElecParDefaut`, `gammePloParDefaut`.
- Prix : `getPrixPrest`, `getMoyenPrix`, `getPrixPrestFor`, `getMoyenPrixFor`, `majPrixMetier`, `setElecMethode`, `setElecGamme`, `setPloGamme`.
- Calcul : `recalcPiece`, `updateSectionTotals`, `changerQty`, `changerCompteur`, `togglePiece`, `setDimType`, `ensureDims`, `tauxTVA`, `labelTVA`.
- Persistance & sorties : `saveEtat`, `restaurerEtat`, `validerPieces`, `allerPhase`, `allerPiece`, `toggleSection`, `formatEuro`, `envoyerEmail`, `envoyerNotifications`, `construireRecapTexte`, `construireDetailTexte`, `findPrestLabel`, `genererPDFConfig`.

### 2.3 Calculs automatiques
- Surfaces (sol/murs nets/plafond) depuis les dimensions.
- Minimum normatif injecté et verrouillé par pièce.
- Conseils pré-ajoutés selon objectif (retirables jusqu'au plancher norme).
- Type d'éclairage déduit du nombre de portes.
- Dimensionnement complet du tableau (circuits → différentiels → modules → rangées → prix).
- Peinture/sols chiffrés automatiquement depuis les surfaces.
- Coefficient de zone, TVA, acomptes, majoration occupé (morte), forfaits accès.

---

## 3. CALCUL DÉTAILLÉ PAR OBJET

### Prises
- Proposées par pièce ; minimum normatif par `normeMin` :
  - Cuisine : 6× `ELEC_PRISE10` + 1× `ELEC_PRISE32` + 2× `ELEC_PRISE20`.
  - Salon/salle à manger : `max(5, ceil(surface/4))` prises + 1 RJ45 + 1 TV.
  - Chambre : 3 prises + 1 RJ45 + 1 TV.
  - SDB : 1 prise + liaison équipotentielle + sèche-serviette.
  - SDE : 1 prise. WC : aucune. Entrée : 1 prise + sonnette. Autres pièces : 1 prise.
- Prix : `pose[méthode] + prise×gamme` (double = 2 mécanismes, triple = 3).
- Pour le tableau : `prises16 = ELEC_PRISE10 + 2×ELEC_PRISED` (la prise triple **n'est pas comptée** — voir §7).

### Points lumineux
- 1 point lumineux minimum par pièce, type choisi selon les portes (accès) :
  - 1 porte → `ELEC_PL_SA` (simple allumage)
  - 2 portes → `ELEC_PL_VV` (va-et-vient, app: 2 inters)
  - ≥3 portes → `ELEC_PL_3BP` (3 boutons poussoirs + télérupteur au tableau)
- Comptés pour le tableau : `pointsLumineux = PL_SA + PL_VV + PL_3BP` (les variantes PL_SUP, PL_DBL, appliques du catalogue ne sont pas comptées car non proposées dans le configurateur).

### Interrupteurs
- **Pas d'objet « interrupteur » autonome** : l'interrupteur est un composant d'appareillage inclus dans la recette du point lumineux (`app:{inter:n}`). Son prix vient de `APPAREILLAGE.inter[gamme]`.

### Va-et-vient
- Poste `ELEC_PL_VV` = pose (99–298 € selon méthode) + 2 interrupteurs de la gamme. Déclenché automatiquement quand la pièce a exactement 2 portes.

### Télérupteurs
- Côté pièce : `ELEC_PL_3BP` = pose + 3 BP (déclenché à ≥3 portes).
- Côté tableau : `b.telerupteurs = Σ ELEC_PL_3BP` → 1 module télérupteur (44,33 €, 1 module) par point concerné.
- ⚠️ Le libellé du poste dit « + télérupteur au tableau » alors que le module est facturé séparément dans le tableau → ambiguïté de double comptage à clarifier.

### Circuits (`dimensionnementTableau`, prix.js)
```
cPrises  = ceil(prises16 / 8)          → disjoncteurs 16A
cEcl     = ceil(pointsLumineux / 8)    → disjoncteurs 16A
cVolets  = ceil(nbVolets / 5) (min 1)  → disjoncteurs 16A
cSpe20   = nb prises 20A + SC20        → disjoncteurs 20A (1 circuit par prise spécialisée)
cChauff  = nb sèche-serviettes + ceil(nbPièces/3) si chauffage élec → 20A
cChauffeEau = 1 si ballon              → 20A + contacteur J/N
cCuisson = 1 si prise 32A              → 32A
cIrve    = 1 si borne VE               → 32A
cVmc     = 1 si VMC                    → 2A
nbCircuits = Σ
```

### Disjoncteurs
- 1 disjoncteur par circuit, calibre selon la famille (16A / 20A / 32A / 2A). Prix modules : 12,82 € (10/16/20A), 22,49 € (32A), 32,19 € (2A). +1 disjoncteur 20A de protection si parafoudre.

### Différentiels
- `nbIDtot = max(2, ceil(nbCircuits / 8))` — 8 circuits max par ID 30 mA, minimum 2 par logement.
- Type A : `1 + (1 si IRVE)` ; le reste en type AC.
- Calibre : **63A** si cuisson OU chauffe-eau OU chauffage élec en aval, sinon **40A** (esprit amendement A5, règle simplifiée).
- ⚠️ Aucune affectation réelle circuit↔différentiel (pas de répartition cuisson/lave-linge sous le type A, pas d'équilibrage).

### Rangées du tableau
- `modulesUtiles = Σ qté×modules` de la composition ; `modulesAvecReserve = ceil(modulesUtiles × 1,20)` (réserve 20 %) ; `rangees = ceil(modulesAvecReserve / 13)` (13 modules/rangée), plafonné à 4 avec drapeau `debordement` (2e coffret à prévoir en visite).

### Modules
- Table `MODULES_TABLEAU` : prix (achat ×1,45) et encombrement (mod) par composant : disjoncteurs (1 mod), ID (2), télérupteur (1), contacteur (1), minuterie (1), délesteur (2), sonnerie (1), compteurs (1), prise modulaire (2), parafoudre (2), coffrets 1–4 rangées (0), peigne/rangée (0), bornier (0).
- Prix tableau = fourniture (composition + coffret + peignes + bornier) + MO (`90 € + 12 €/module utile`). La MO du tableau **n'est pas** affectée par le coef de zone directement (mais le total global l'est).

---

## 4. RÈGLES NF C 15-100 EFFECTIVEMENT IMPLÉMENTÉES

1. Séjour : 1 prise / 4 m², minimum 5 (règle pré-amendement A5).
2. Chambre : 3 prises minimum.
3. Cuisine : 6 prises dont circuits spécialisés — 1× 32A cuisson + 2× 20A.
4. SDB : liaison équipotentielle supplémentaire obligatoire.
5. Entrée/dégagements/autres pièces : 1 prise minimum.
6. 1 point d'éclairage minimum par pièce.
7. Max 8 prises par circuit 16A (réglage « sécuritaire » 1,5 mm²).
8. Max 8 points lumineux par circuit d'éclairage.
9. Circuit spécialisé dédié par gros électroménager (20A) ; cuisson 32A dédié.
10. Circuit VMC dédié (2A).
11. Max 8 circuits par interrupteur différentiel 30 mA.
12. Minimum 2 ID par logement ; au moins 1 de type A.
13. IRVE : circuit 32A dédié avec différentiel type A réservé.
14. Réserve de 20 % dans le tableau.
15. Calibre ID 40/63A selon charges aval (simplification A5).
16. TVA 10 % rénovation >2 ans / 20 % neuf-extension-local (règle fiscale, pas NF).

---

## 5. RÈGLES MÉTIER « MAISON » (hors norme, issues du configurateur)

1. Choix du type de commande d'éclairage par le **nombre de portes** (1/2/3+) — heuristique, la norme ne l'impose pas.
2. **Sèche-serviette SDB** et **sonnette entrée** marqués « 🔒 Norme » alors qu'ils ne sont pas exigés par la NF C 15-100.
3. RJ45 + TV **par chambre/séjour** en minimum verrouillé (la norme raisonne par logement, pas par pièce).
4. Conseils DS.BAT (`recoDSBAT`) : 2e point lumineux si séjour ≥20 m² ; commandes de volets = nb fenêtres ; prise double chevet en chambre ; +2 prises et RJ45 au bureau (télétravail) ; prise double plan de travail cuisine ; niveau confort : +1 prise double pièces de vie, motorisation volets, RJ45 salon, thermostat si chauffage élec.
5. Modes projet normes/standard/confort avec mécanisme `_recoApplique` (retrait propre au changement de mode).
6. Composition auto du logement par typologie T1–T6 + enrichissements surface (sde ≥110 m², 2e WC ≥120 m²).
7. Défauts de pose/gamme déduits du formulaire (état des lieux → méthode ; qualité → gamme).
8. 1 circuit volets par tranche de 5 volets.
9. Circuits chauffage = nb sèche-serviettes + `ceil(nbPièces/3)` (au lieu d'un calcul par puissance).
10. Parafoudre déclenché par « tableau ancien/inexistant » (la norme raisonne par niveau kéraunique/AQ, pas par vétusté).
11. Chiffrage à la **moyenne** de la fourchette min–max.
12. Coefficient de zone Z1/Z2/Z3 par code postal, appliqué au total.
13. Forfaits accès (80/200 €), majoration occupé 8,8 %, acomptes 40/30/30.
14. Tableau non chiffré si l'existant est « récent ».
15. Coef fourniture ×1,45 ; MO tableau 90 € + 12 €/module.
16. Seuils de cohérence (décret décence 9 m² / 2,20 m comme repère).

---

## 6. LIMITES DU MOTEUR ACTUEL

1. **Pas de calcul de puissance** : aucune somme des kW, pas de choix d'abonnement (6/9/12 kVA), pas de délestage automatique, pas de vérification calibre AGCP.
2. **Pas de sections de câbles ni longueurs** : aucune notion de distance, chute de tension, ou métrés de câble par pièce.
3. **Pas de volumes SDB** (0/1/2), pas d'IPX, pas de contrôle de position des appareillages.
4. **Pas de GTL/ETEL**, pas de coupure d'urgence, pas de DCL explicites.
5. Répartition circuits→différentiels non modélisée (comptage seulement, pas d'affectation type A aux circuits qui l'exigent : cuisson, lave-linge, IRVE).
6. Prise de terre (`ELEC_TERRE`) et **coffret VDI (`ELEC_COFFRET_VDI`) jamais chiffrés** dans le configurateur (ils n'existaient que dans la page morte devis-electricite.html) — on peut vendre 6 RJ45 sans coffret de communication.
7. Règle « 1 prise/4 m² » : ancienne version de la norme (A5 : 5 socles si séjour ≤28 m², 7 au-delà) ; pas d'exception cuisine <4 m².
8. Chiffrage à la moyenne : le PDF affiche un montant unique sans fourchette.
9. `normeMin()` et `recoDSBAT()` dépendent de la globale `chantier` (pas totalement pures, non testables isolément).
10. Le commentaire de `coefZone` dit « à appliquer sur la MAIN-D'ŒUVRE » mais le coefficient est appliqué **au total** (fourniture incluse).
11. Moteur 100 % front-end : prix et règles modifiables dans la console client ; email lead falsifiable.
12. Persistance en sessionStorage uniquement (perdue à la fermeture de l'onglet) ; `config.js.prix` (priseSimple 83,97 €…) est un vestige non utilisé par le configurateur.
13. Deux systèmes de numérotation de devis coexistent (`ELEC-2026-XXXX` via localStorage, `DSBT-<timestamp>`).

## 7. CAS NON GÉRÉS (bugs et angles morts)

1. **Variables formulaire perdues** : `accessSup`, `eauChaude`, `etage`, `ascenseur` ne sont pas enregistrées dans `collecterDonnees()` → les règles « majoration logement occupé +8,8 % », « forfait voisins/copro », « ballon + contacteur jour/nuit », « chauffe-eau → calibre 63A » sont du **code mort** : elles ne se déclenchent jamais.
2. `domotique` et `pv` : demandés, enregistrés… jamais utilisés par aucun moteur.
3. `ELEC_PRISET` (prise triple) non comptée dans `prises16` du tableau ; `ELEC_PRISECMD`, appliques, `ELEC_PL_SUP/DBL` non proposées dans le configurateur.
4. Choix peinture/sols (selects) non persistés dans l'état : retour en phase 2 ou re-render → valeurs réinitialisées, alors que les montants `peinture_auto`/`sols_auto` restent stockés → incohérences possibles.
5. Dimensions saisies **par type de pièce** (`dimsParType`) : 3 chambres partagent les mêmes cotes ; impossible d'avoir des chambres de tailles différentes.
6. Pièce sans dimensions : élec quand même chiffrée (min 5 prises séjour sur surface 0) mais peinture/sols à 0 € — signalé seulement en alerte.
7. `tableauExistant === 'recent'` : aucun coût tableau même si on ajoute 40 prises (aucune vérification de capacité de l'existant). `inconnu` = traité comme à remplacer.
8. Débordement >4 rangées : signalé mais le 2e coffret n'est **pas chiffré**.
9. Monophasé uniquement ; pas de triphasé, pas de rénovation partielle (dépose/repose, diagnostic existant), pas de mise en sécurité simple (fil de l'existant conservé).
10. IRVE : pas de distinction puissance (7,4 vs 22 kW), pas de câble dédié ni de protection 40A/Type F.
11. Aucune validation email/téléphone côté configurateur ; FormSubmit silencieux en cas d'échec (catch vide) — un lead peut se perdre sans trace.
12. `devis-electricite.html` : page publique cassée (voir §0) mais toujours liée/indexée (canonical, sitemap).
13. Le récap PDF recalcule le total dans `genererPDFConfig()` en dupliquant la logique de `renderPhase3()` — double implémentation à risque de divergence.
14. `envoyerWhatsApp()` de devis-common.js utilise `CONFIG.telephone` (inexistant : c'est `CONFIG.entreprise.telephone`) → autre code mort/bogué.

## 8. FONCTIONS À AMÉLIORER EN PRIORITÉ

1. `collecterDonnees()` (devis.html) — enregistrer accessSup/eauChaude/etage/ascenseur : **1 correctif = 4 règles réactivées**.
2. `dimensionnementTableau()` — affectation réelle circuits→ID (type A pour cuisson/lave-linge/IRVE), chiffrage du 2e coffret, bilan de puissance, calibre AGCP.
3. `normeMin()` — mise à jour A5 (5/7 socles séjour, exception cuisine <4 m², réseau communication par logement), injection de `chantier` en paramètre (pureté).
4. `recalcPiece()` / `renderPhase2()` — persister les selects peinture/sols dans `piece.config` ; séparer état et DOM.
5. `getPrixPrestFor()` — recherche linéaire dans tout `PRIX` à chaque ligne ; indexer par code (Map).
6. `renderPhase3()` + `genererPDFConfig()` — factoriser en une fonction unique `calculerTotaux()` pure.
7. `compositionTypologie()` — dimensions par pièce individuelle (pas par type), pièces T6+ (2 sdb, suite parentale).
8. `coefZone()` — appliquer sur MO seulement (conformément au commentaire) ou renommer.
9. `envoyerEmail()` — retour d'état, retry, endpoint serveur (fiabilité leads).
10. Supprimer ou rediriger `devis-electricite.html` ; nettoyer `CONFIG.prix` et le double système de numérotation.

## 9. SCHÉMA DE L'ARCHITECTURE ACTUELLE

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            NAVIGATEUR (100 % front-end, aucun back-end)  │
│                                                                          │
│  devis.html (wizard 4 étapes)                                            │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐                          │
│  │1 Coordo.│→│2 Chantier│→│3 Métiers│→│4 Récap│─ envoyerDevis()          │
│  └─────────┘ └──────────┘ └─────────┘ └───┬───┘                          │
│        collecterDonnees() ⚠ perd accessSup/eauChaude/etage/ascenseur     │
│                                           │                              │
│                 ┌─────────────────────────▼───────────────┐              │
│                 │ sessionStorage                          │              │
│                 │  client / chantier / devisMetiers       │              │
│                 │  configEtatV1 (état configurateur)      │              │
│                 └─────────────────────────┬───────────────┘              │
│                                           │ (garde d'accès : nom+tel)    │
│  devis-configurateur.html                 ▼                              │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │ PHASE 1  compositionTypologie → compteurs+dims                 │      │
│  │          controlesCoherence (non bloquant)                     │      │
│  │          poseParDefaut / gammeElecParDefaut / gammePloParDefaut│      │
│  │ PHASE 2  par pièce :                                           │      │
│  │   normeMin() ──plancher verrouillé──► config.electricite       │      │
│  │   recoDSBAT() ─selon objectifProjet─► conseils retirables      │      │
│  │   getElecPourPiece / changerQty / recalcPiece                  │      │
│  │ PHASE 3  Σ pièces + dimensionnementTableau(besoins)            │      │
│  │   + forfaits accès + coefZone + TVA + acomptes                 │      │
│  │   explicationsTableau (écran / PDF / email)                    │      │
│  └───────────┬──────────────────────┬────────────────────────────┘      │
│              │                      │                                    │
│   ┌──────────▼──────────┐   ┌───────▼────────────────────────────┐      │
│   │ prix.js             │   │ SORTIES                             │      │
│   │  PRIX (catalogue)   │   │  html2pdf → PDF DSBT-xxxxxx         │      │
│   │  APPAREILLAGE ×1,45 │   │  FormSubmit → email contact@dsbat.fr│      │
│   │  prixElec/Plomberie │   │  wa.me → WhatsApp pré-rempli        │      │
│   │  MODULES_TABLEAU    │   │  (lead auto au 1er affichage prix)  │      │
│   │  dimensionnement…   │   └────────────────────────────────────┘      │
│   │  coefZone / ZONES   │                                                │
│   └─────────────────────┘   normes.js (affichage refs) · config.js       │
│                             devis-common.js (utilitaires partagés)       │
│                                                                          │
│  ✝ devis-electricite.html : moteur supprimé (placeholder) → page morte   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Caractéristiques structurelles** : monolithe front (2 500 lignes dans le HTML du configurateur), état global mutable + DOM comme source de vérité partielle, catalogue et moteur de tableau isolés dans prix.js (exporté CommonJS → seul module testable en l'état), aucune API, aucune validation serveur, prix exposés au client.
