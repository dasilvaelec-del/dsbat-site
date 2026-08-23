# AIC-001 — Analyse du parcours après le questionnaire & des contrôles de cohérence
## Phase d'observation uniquement — **aucun fichier modifié**

> **Statut : observation.** Aucun code écrit, rien modifié/supprimé/refactorisé, aucun commit, aucune règle métier changée. Toutes les affirmations ci-dessous sont **tirées de la lecture du code** (fichiers cités). Les écarts avec les hypothèses de départ sont signalés en **« OBSERVATION DU CODE »**.

---

### Constat principal (à lire en premier)

**La crainte centrale de la mission — « une alerte VMC pourrait s'afficher alors que le client n'a pas demandé la VMC » — est, pour les contrôles métier finaux, DÉJÀ traitée dans le code.**

> **OBSERVATION DU CODE #1.** Les cinq contrôles métier finaux s'auto-filtrent par métier sélectionné, en première ligne de fonction :
> - `verifierVMC` (`js/moteurs/vmc.js:63`) : `if (!metiers.includes('vmc')) return alertes;`
> - `verifierPlomberie` (`js/moteurs/plomberie.js:106`) : `if (!metiers.includes('plomberie')) return alertes;`
> - `verifierSols` (`js/moteurs/sols.js:70`) : `if (!metiers.includes('sols')) return alertes;`
> - `verifierMenuiserie` (`js/moteurs/menuiserie.js:122`) : `if (!metiers.includes('menuiserie')) return alertes;`
> - `verifierChauffage` (`js/moteurs/chauffage.js:10`) : `if (ch.chauffage !== 'electrique' || !metiers.includes('electricite')) return alertes;`
>
> **Donc : pas d'alerte « pièce humide sans bouche VMC » si la VMC n'est pas sélectionnée.** De même pour plomberie, sols, menuiserie, chauffage. Le message « pièce humide sans bouche d'extraction » cité dans la mission ne peut **pas** apparaître hors contexte VMC.

Ce qui **n'est pas** filtré par métier, en revanche, ce sont les **contrôles géométriques génériques** (dimensions, surface, hauteur, portes, fenêtres) — voir §F/§G ci-dessous. C'est là que se trouve le vrai sujet à arbitrer, pas sur les contrôles métier.

---

## A. Parcours actuel complet

```
devis.html (wizard 4 étapes)
  └─ envoyerDevis() → sessionStorage['chantier','client','devisMetiers'] → redirection
       │
devis-configurateur.html
  PHASE 1  renderPiecesSelection() → grilles PIECES_DEF
           setObjectif() / compositionTypologie() (préconfig T1–T6)
           changerCompteur()/togglePiece() → compteurs{}
           setDimPiece() → dimsParPiece{}
           validerPieces() ──▶ construit piecesSelectionnees[]  (fusion sans perte)
                           └─▶ verifierCoherenceGlobale(pieces, chantier)   ← CONTRÔLE #1
                               (si alertes && !acquitté → afficherCoherence(), non bloquant)
  PHASE 2  renderPhase2() → pour chaque pièce :
             getPrestationsPourPiece(pieceId, metiersActifs) → sections par métier
             renderMetierSection() → selecteursElec / selecteursPlomberie / peintureAuto / solsAuto / prests
             recalcPiece(index) → calculerPieceComplet(piece, chantier, metiersActifs)
                                  (local OU Runtime ; publie surfaces + config + totalHT)
             + bandeaux « oublis » par métier (proposition Oui/Non)
  PHASE 3  renderPhase3() :
             captureModal (coordonnées) → validerCoordonnees()
             __obtenirDevisRuntime() → DEVIS GLOBAL (Runtime privé)
             verifierCoherenceGlobale(pieces, chantier)  ← CONTRÔLE #2 (recap, L3010)
             récap par pièce + postes globaux (tableau/VMC/plomberie/chauffage) + TVA/acomptes
             genererPDFConfig() → PDF
```

**Deux points d'appel de la cohérence** (identiques, fonction pure) : à l'entrée de la phase 2 (`validerPieces`, L1767) et au récapitulatif (`renderPhase3`, L3010).

---

## B. Liste exacte des corps de métier

Source : cases à cocher de `devis.html` (panel 3) + construction des sections dans `devis-configurateur.html` (`getPrestationsPourPiece`).

| Nom affiché client | Identifiant interne | Section configurateur | Fichier moteur | Contrôle final |
|---|---|---|---|---|
| ⚡ Électricité | `electricite` | Électricité (sélecteurs pose/gamme + prests + tableau) | `js/moteurs/electricite.js` | via `controlesCoherence` (gated) |
| 🚿 Plomberie | `plomberie` | Plomberie (gamme + prests) | `js/moteurs/plomberie.js` | `verifierPlomberie` (gated) |
| 💨 VMC | `vmc` | VMC (prests + oublis bouches/entrées d'air) | `js/moteurs/vmc.js` | `verifierVMC` (gated) |
| 🧱 Isolation / Plâtrerie | `isolation` | Isolation / Plâtrerie (prests) | `js/moteurs/isolation.js` | — (evaluation support) |
| 🎨 Peinture | `peinture` | **Revêtement mural** (auto, surfaces) | `js/moteurs/peinture.js` | via `controlesCoherence` (gated) |
| 🚪 Menuiserie int. | `menuiserie` | Menuiserie (prests) | `js/moteurs/menuiserie.js` | `verifierMenuiserie` (gated) |
| 🪵 Revêtement sols | `sols` | **Revêtement de sol** (auto) | `js/moteurs/sols.js` | `verifierSols` (gated) |
| 🔲 Carrelage / Faïence | `carrelage` | **fusionné** : faïence→Revêtement mural, carrelage sol→Revêtement de sol | `js/moteurs/carrelage.js` | via sols/mural |

> **OBSERVATION DU CODE #2.** Depuis MISSION 052, **le carrelage n'est plus une section autonome**. Une section « Revêtement mural » apparaît si `peinture` **OU** `carrelage` est actif ; « Revêtement de sol » si `sols` **OU** `carrelage` est actif (`devis-configurateur.html:908-913`). Le carrelage est donc un métier « transversal » aux familles revêtements.

---

## C. Liste exacte des données échangées

**Écrites par `devis.html` (`collecterDonnees`/`envoyerDevis`) → sessionStorage :**
- `client{}` : nom, tel, email, adresse, source, delai
- `chantier{}` (23 champs) : codePostal, ville, typeBien, typeLogement, etage, ascenseur, surface, pieces, ageBati, etatLieux, typeProjet, hauteurPlafond, accessibilite, accessSup, qualiteMateriaux, chauffage, vmc, eauChaude, tableauExistant, borneVE, pv, domotique
- `devisMetiers` : `metiersActifs[]`

**Construites dans le configurateur :**
- `piecesSelectionnees[]` : `{id, nom, icon, numero, dims{l,la,h,fenetres,portes}, config{electricite|plomberie|vmc|peinture|carrelage|isolation|menuiserie:{CODE:qty}, peinture_auto:montant}, elecMethode, elecGamme, ploGamme, peintMur/Plaf/Papier, solMateriau, solSousCouche, faienceMode/Hauteur/Format/Surface, normeMin, _recoApplique, surfaces{sol,murs,plafond}, totalHT}`
- Persistance locale : `sessionStorage['configEtatV1']` (compteurs, dimsParPiece, pièces, objectif)

**Transmis au calcul :** `calculerPieceComplet(piece, chantier, metiersActifs)` (par pièce) puis `__obtenirDevisRuntime()` envoie `piecesSelectionnees + chantier + metiersActifs` au Runtime pour le devis global.

---

## D. Dépendances métier → pièces (ce que confirme le code)

Source : `getElecPourPiece`, `getPlombPourPiece`, `getVmcPourPiece`, `getMenuiseriePourPiece`, `getIsolationPourPiece`, sections auto peinture/sol.

| Type de pièce | Élec | Plomberie | VMC | Peinture (mural) | Sol | Carrelage | Isolation | Menuiserie |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Salon / Séjour | ✅ base+TV/RJ45/volet/thermo | — | 🟦 entrée d'air | ✅ | ✅ | (via mural/sol) | ✅* | ✅ |
| Salle à manger | ✅ (comme salon) | — | 🟦 entrée d'air | ✅ | ✅ | – | ✅* | ✅ |
| Cuisine | ✅ +20/32A, hotte | ✅ évier/LV/adouc. | 🟥 extraction | ✅ | ✅ | ✅ | ✅ (humide) | ✅ |
| Bureau | ✅ +RJ45/volet | — | 🟦 entrée d'air | ✅ | ✅ | – | ✅* | ✅ |
| Chambre | ✅ +TV/RJ45/volet | — | 🟦 entrée d'air | ✅ | ✅ | – | ✅* | ✅ |
| Dressing | ✅ base | — | — | ✅ | ✅ | – | ✅* | (selon liste) |
| Salle de bain (sdb) | ✅ +applique/sèche-serv./liaison | ✅ baignoire/douche/vasque/WC susp./ballon | 🟥 extraction | ✅ | ✅ | ✅ | ✅ (humide) | – |
| Salle d'eau (sde) | ✅ +sdb | ✅ douche/vasque | 🟥 extraction | ✅ | ✅ | ✅ | ✅ (humide) | – |
| WC | ✅ base (pas de prise imposée) | ✅ WC/lave-mains | 🟥 extraction | ✅ | ✅ | ✅ | – | – |
| Entrée / Hall | ✅ +sonnette/volet | — | — | ✅ | ✅ | – | ✅* | ✅ (porte entrée) |
| Couloir | ✅ base (min va-et-vient) | — | — | ✅ | ✅ | – | ✅* | – |
| Escalier | ✅ base (min va-et-vient) | — | — | (selon) | (selon) | – | – | ✅ (garde-corps?) |
| Cave / Buanderie | ✅ +20A/SC20 gros électro. | — | 🟥 extraction | ✅ | ✅ | – | – | – |
| Véranda | ✅ base | — | — | ✅ | ✅ | – | ✅* | ✅ |
| Garage | ✅ +20A/SC20 ; gamme IP44 | — | — | ✅ (garage/cave) | ✅ | – | – | – |
| Terrasse | ✅ base extérieur (IP44, pas de socle imposé) | — | — | (selon) | (selon) | – | – | – |
| Jardin / Allée | ✅ base extérieur (aucun éclairage imposé) | — | — | – | – | – | – | – |
| Façade ext. | ✅ base extérieur (IP44) | — | — | – | – | – | – | – |
| Carport | ✅ base extérieur (IP44) | — | — | – | – | – | – | – |

🟥 extraction (bouche + entrée d'air) · 🟦 balayage (entrée d'air seule) · ✅\* isolation : la section apparaît si `getIsolationPourPiece` renvoie des prestations (items spécifiques pour pièces humides sdb/sde/cuisine ; se reporter à `js/moteurs/isolation.js` pour la liste exacte).

> **OBSERVATION DU CODE #3.** **Plomberie ne dessert que `sdb`, `sde`, `wc`, `cuisine`** (`plomberie.js:7-25`). Toute autre pièce → aucune section plomberie.
> **OBSERVATION DU CODE #4.** **VMC** : extraction pour `sdb, sde, wc, cuisine, cave` ; entrée d'air (balayage) pour `salon, salle_manger, chambre, bureau` ; **rien** pour entrée, couloir, escalier, dressing, véranda, garage et extérieur (`vmc.js:7-16`).
> **OBSERVATION DU CODE #5.** **Électricité dessert TOUTES les pièces** (chaque pièce reçoit la base points lumineux + prises), avec des minimums normatifs par type (`normeMin`) ; l'extérieur (terrasse/jardin/façade/carport) n'a **aucun socle imposé** et le jardin **aucun éclairage imposé**.
> **OBSERVATION DU CODE #6.** « **Éclairage extérieur** » listé dans la mission **n'est pas un type de pièce** : les pièces extérieures sont `terrasse`, `jardin`, `facade`, `carport` (PIECES_DEF). L'éclairage extérieur est une prestation élec de ces pièces, pas une pièce.
> **OBSERVATION DU CODE #7.** `getMenuiseriePourPiece` référence des pièces `combles` et `grenier` (`menuiserie.js:77,128`) **absentes de PIECES_DEF** : branches mortes / pièces futures non sélectionnables aujourd'hui.

---

## E. Dépendances métier → questionnaire (données `chantier`/`client`)

| Métier | Champs du questionnaire réellement lus | Effet |
|---|---|---|
| Électricité | `chauffage` (fil pilote pièces de vie), `tableauExistant` (tableau+parafoudre), `vmc`/`eauChaude`/`borneVE` (circuits tableau), `surface` (dimensionnement tableau), `pieces` (repli circuits), `qualiteMateriaux` (seed gamme), `codePostal` (coefZone global) | Prestations + tableau + total |
| Plomberie | `eauChaude` (ballon → circuit), `qualiteMateriaux` (seed gamme) | Prests + gamme |
| VMC | `vmc` (état existant → circuit tableau) | Config ventilation |
| Peinture | `etatLieux` (défaut gamme murs), `typeProjet` (sous-couche auto) | Préparation + prix |
| Sols/Carrelage | `ageBati`/`etatLieux` (reco ragréage) | Reco support |
| (global prix) | `accessibilite`/`accessSup` (forfaits + ×1,088), `codePostal` (coefZone) | Total global |

---

## F. Règles de cohérence existantes (où, quelles données, gating)

Fichier central : **`js/coherence.js`** (`controlesCoherence` → `verifierCoherenceGlobale`). Seuils dans `SEUILS_COHERENCE`.

**Contrôles géométriques génériques — NON filtrés par métier** (s'exécutent pour toute pièce, dès que les cotes existent) :
- Dimensions non renseignées (`l` ou `la` absents) → « comptés à 0 € » (L30).
- Surface < minimum du type (`surfaceMin`) (L35).
- Hauteur hors [2,2 ; 3,2] m (L38).
- Portes > 4 (L41) ; Fenêtres > 5 (L44) ; ratio longueur/largeur > 5 (L47).
- **0 porte (hors extérieur)** → info « conditionne la commande d'éclairage (va-et-vient/télérupteur) » (L63).

**Contrôles de configuration — DÉJÀ filtrés par métier :**
- Éclairage/prise manquants : `if (configuree && metiersActifs.includes('electricite'))` (L67).
- Point d'eau manquant (cuisine/sdb/sde) : `if (configuree && metiersActifs.includes('plomberie'))` (L80).
- Peinture sans dimensions : `if (metiersActifs.includes('peinture') && aPeinture …)` (L93).

**Contrôles globaux — NON filtrés par métier :**
- Écart surface saisie vs déclarée > ±25 % → « pièce oubliée ou cote erronée ? » (L103).
- Grande surface (≥150 m²) avec < 3 chambres → « composition inhabituelle » (L108).

**Contrôles métier finaux — DÉJÀ filtrés par métier** (early-return) : `verifierPlomberie/Sols/VMC/Menuiserie/Chauffage` (L113-131) — chacun sort immédiatement si son métier n'est pas actif (voir Constat principal).

> Les messages cités par la mission proviennent tous de `controlesCoherence` : « Cuisine : aucun point d'eau (évier) prévu » (L84, **gated plomberie**), « Salle de bain : aucun point d'eau » (L87, **gated plomberie**). Les alertes « bouche VMC / entrée d'air » proviennent de `verifierVMC` (**gated vmc**).

---

## G. Alertes pouvant s'afficher « hors contexte » (le vrai sujet)

Compte tenu du gating ci-dessus, **seules ces alertes peuvent apparaître indépendamment du métier demandé** :

1. **Contrôles géométriques génériques** (dimensions, surface min, hauteur, portes>4, fenêtres>5, ratio) — s'affichent même pour un projet « Peinture seule » ou « Plomberie seule ».
   - *Nuance* : ces contrôles sont **pertinents pour presque tous les métiers** (une cote erronée fausse les surfaces peinture/sol comme l'élec). Ils ne sont pas « faux », mais ils ne sont pas non plus rattachés à un métier.
2. **« Aucune porte indiquée → commande d'éclairage… » (L63)** — **formulé en langage électrique** mais **non filtré par métier** : peut s'afficher pour un client qui n'a **pas** pris l'électricité. → **OBSERVATION : c'est le cas le plus net d'alerte à coloration métier affichée hors contexte.**
3. **Écart de surface globale** et **chambres vs grande surface** — non rattachés à un métier (contrôles « projet »), a priori toujours pertinents.

> **En résumé** : le risque « alerte VMC/plomberie hors contexte » n'existe **pas** (déjà gated). Le risque réel = **contrôles géométriques génériques et l'info « éclairage » (L63) affichés quel que soit le métier**. C'est le périmètre à décider.

---

## H. Fonctions responsables de ces alertes

- `controlesCoherence(pieces, ch)` — `js/coherence.js:23` (tous les contrôles génériques + gated config + globaux).
- `verifierCoherenceGlobale(pieces, ch)` — `js/coherence.js:138` (point d'entrée, agrège + appelle les verifier* métier).
- `verifierPlomberie/Sols/VMC/Menuiserie/Chauffage` — `js/moteurs/*.js` (self-gated).
- Affichage (non pur) : `afficherCoherence(alertes)` — `devis-configurateur.html:1701` (bandeau non bloquant + boutons « Corriger » / « Continuer quand même » + `__coherenceAcquittee`).
- Bandeaux « oublis » par métier (proposition Oui/Non) : `oublisPeintureHtml`, `oublisPloHtml`, `oublisCarrHtml`, `oublisVmcHtml`… (surfaces/quantités calculées, ajout seulement au clic).

---

## I. Architecture actuelle du calcul

```
Par pièce (phase 2) :
  recalcPiece(i) → calculerPieceComplet(piece, chantier, metiersActifs)
     a) 1er passage : surfaces (sol=L×la, murs=périmètre×h−ouvertures, plafond)
     b) revêtements si sols/carrelage (appliquerRevetements)
     c) 2e passage : chiffrage → piece.totalHT
  (route Runtime si amorcé, sinon local — résultat identique, parité Golden Master)

Devis global (phase 3) :
  __obtenirDevisRuntime() → Runtime privé calcule :
     Σ pièces + chauffage (si élec) + tableau (NF C 15-100, agrégé depuis config.electricite)
     + VMC/plomberie/ballon + forfaitAcces + ×1,088 (occupé) + ×coefZone(codePostal)
     → Total HT → TVA (tauxTVA) → TTC → acomptes a1/a2/a3
  Repli : si Runtime injoignable → écran de transition (aucun prix affiché)
```

Autorité de calcul : **Runtime privé** (`runtime/moteur-prive/*` — catalogue, marges, `coefZone`, `dimensionnement*`). Le navigateur ne détient plus le catalogue secret. Filets : Golden Master (comparaison **octet par octet**, sensible CRLF/LF).

---

## J. Points à conserver absolument

1. **Le gating métier existant** des `verifier*` (VMC/plomberie/sols/menuiserie/chauffage) et des contrôles config (élec/plomberie/peinture) — **déjà contextuel, ne pas casser**.
2. **La non-bloquance** : tout passe par des alertes + « Continuer quand même » (`__coherenceAcquittee`). Aucun contrôle ne bloque le parcours.
3. **Le pattern proposition→confirmation** (« oublis » Oui/Non) : rien n'est ajouté au devis sans clic.
4. **La pureté de `coherence.js`** (aucun accès DOM) — testable, réutilisable.
5. **Les règles de prix** (norme verrouillée, coefZone, forfaits, ×1,088, agrégation élec→tableau) — hors périmètre.
6. **`getPrestationsPourPiece`** comme filtre unique métier→pièces (déjà `metiersActifs.includes(...)`).

---

## K. Points qui devront être améliorés (constats, pas des solutions)

1. **Contrôles géométriques génériques non rattachés à un métier** (§G-1) : décider s'ils restent « transverses » (car ils protègent les surfaces de tous les métiers) ou s'ils doivent être pondérés par métier.
2. **Alerte L63 « aucune porte → éclairage »** : formulée en langage électrique mais affichée hors contexte élec (§G-2). Candidate n°1 à un gating ou une reformulation neutre.
3. **Pas de notion de « contexte projet »** : les contrôles ne connaissent pas l'intention globale (profil rénovation, métiers croisés). Ils sont per-pièce/per-métier, jamais « projet ».
4. **Branches mortes** (`combles`/`grenier` en menuiserie) et **libellés** (« Éclairage extérieur » n'existe pas comme pièce) : à clarifier avant d'y appuyer de nouvelles règles.
5. **Double appel de cohérence** (phase 2 + récap) : cohérent, mais à garder en tête si l'on ajoute des contrôles coûteux.

---

## L. Proposition d'architecture pour des contrôles CONTEXTUELS (analyse, non codée)

L'infrastructure existe déjà à 80 %. La cible n'est pas une refonte mais une **formalisation** :

```
CONTEXTE PROJET (métiers + pièces + questionnaire)
        │
        ▼
Chaque règle de cohérence porte 4 attributs explicites :
   • CONDITION        (ex. pièce humide sans bouche)
   • MÉTIER CONCERNÉ  (ex. 'vmc')  ← filtre déjà présent, à rendre systématique
   • DONNÉES PERTINENTES (config VMC, rôle pièce)
   • CONSÉQUENCE      (ce que ça change / question à poser)
        │
        ▼
Émission SI (métier ∈ metiersActifs) ET condition ET données présentes
        │
        ▼
Proposition / question → confirmation → mise à jour contexte → moteur métier → devis
```

**Modélisation minimale envisageable** (à valider, non codée) : transformer chaque alerte en objet `{ id, metier|null, niveau, condition(pieces,ch,metiers), texte, consequence }`, et un dispatcher qui n'exécute une règle que si `metier === null` (règle « projet/géométrie ») **ou** `metiersActifs.includes(metier)`. Les `verifier*` respectent déjà ce contrat ; il resterait à **étiqueter** les contrôles génériques de `controlesCoherence` (métier `null` assumé, ou rattachés). Aucune règle métier nouvelle ; on **classe** l'existant.

**Point d'insertion pour la démolition/dépose/évacuation (§8 mission)** — analyse seule : un futur module lirait, **sans rien recalculer côté prix**, `piecesSelectionnees` (types + surfaces `dims`), `metiersActifs` (dépose induite par métier), `chantier.accessibilite/accessSup/etage/ascenseur` (logistique évacuation vs approvisionnement), et les matériaux existants déduits (`tableauExistant`, revêtements en place). Ces données **existent déjà** et suffisent à alimenter un tel module en lecture seule. **Ne pas coder ici.**

---

## OBSERVATIONS DU CODE (récapitulatif)

1. Les `verifier*` métier (VMC/plomberie/sols/menuiserie/chauffage) **s'auto-filtrent déjà** par métier → pas d'alerte métier hors contexte.
2. Le **carrelage n'est plus une section autonome** (fusion mural/sol, MISSION 052).
3. **Plomberie** ne dessert que sdb/sde/wc/cuisine.
4. **VMC** ne concerne que pièces humides + pièces principales (pas entrée/couloir/escalier/dressing/véranda/garage/extérieur).
5. **Électricité** dessert toutes les pièces (minimums normatifs par type ; extérieur sans socle imposé).
6. « **Éclairage extérieur** » n'est **pas** une pièce ; l'extérieur = terrasse/jardin/façade/carport.
7. **Menuiserie** référence `combles`/`grenier` **inexistants** dans PIECES_DEF (branches mortes).
8. Les contrôles **réellement** non contextuels sont les **contrôles géométriques génériques** + l'info « **aucune porte → éclairage** » (L63, coloration élec, non gated).
9. La cohérence est appelée **deux fois** (entrée phase 2 + récap), non bloquante, avec acquittement.

---

## CE QUE DSBAT DEVRAIT DÉCIDER AVANT DE CODER

1. **Contrôles géométriques génériques** (dimensions, surface, hauteur, portes, fenêtres, ratio) : doivent-ils rester **transverses** (affichés quel que soit le métier, car ils protègent les surfaces de tous les métiers) ou être **conditionnés** aux métiers surfaciques présents ? (recommandation d'analyse : les garder transverses, ils ne sont pas « faux »).
2. **Alerte « aucune porte → commande d'éclairage » (L63)** : la **rattacher au métier électricité** (ne l'afficher que si élec sélectionnée) ou la **reformuler en langage neutre** (« nombre d'accès à vérifier ») ? C'est le seul message à coloration métier affiché hors contexte.
3. **Écart de surface & « chambres vs grande surface »** : rester des contrôles **projet** (toujours affichés) ou devenir informatifs seulement si un métier surfacique est présent ?
4. **Modèle de règle contextuelle** : valider le contrat `{condition, métier|null, données, conséquence}` comme cadre unique — sans créer de nouvelle règle métier, uniquement **étiqueter** l'existant.
5. **Nettoyage préalable** : faut-il traiter les branches mortes (`combles`/`grenier`) et clarifier « éclairage extérieur » **avant** d'ajouter des règles, pour ne pas bâtir sur des références fantômes ?
6. **Périmètre du « contexte projet »** pour la cohérence : se limite-t-il aux métiers+pièces+questionnaire actuels, ou doit-il déjà réserver la place des futurs modules (démolition/dépose/évacuation, chauffage/ECS/VMC neuve) ?

---

*Fin de l'analyse AIC-001 (parcours & cohérence). Aucun code écrit, aucun commit. En attente de votre validation métier sur les 6 décisions ci-dessus.*
