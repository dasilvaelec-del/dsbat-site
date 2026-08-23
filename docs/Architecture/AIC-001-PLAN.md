# AIC-001 — Plan technique d'évolution du configurateur DSBAT
## Phase 1 : préparation technique (analyse & plan — **aucun code**)

> **Statut : analyse seule.** Aucun fichier n'a été modifié, aucune question supprimée, aucune règle métier changée, aucun refactor, aucun commit. Ce document est le **plan** à valider avant tout développement.
> **Complément de** `AIC-001.md` (audit fonctionnel). Ce plan s'appuie sur cet audit et sur des vérifications de code ciblées faites pour cette mission.

---

### Résumé pour décision (à lire en premier)

Bonne nouvelle : **une grande partie de l'infrastructure que tu décris existe déjà** dans le code, sous forme de premières briques. L'évolution AIC n'est donc pas une reconstruction, mais l'**extension prudente de mécanismes présents** :

| Concept visé (ta mission) | État réel dans le code | Conséquence |
|---|---|---|
| Préconfiguration selon typologie | ✅ existe (`compositionTypologie`, T1–T6) | À **étendre** (bureau, terminologie, propositions) |
| Écart surface déclarée vs configurée (§4) | ✅ existe (`coherence.js`, seuil ±25 %) | À **affiner** (« il reste ~7 m² »), pas à créer |
| Contrôles contextuels non bloquants (§3, §5) | ✅ existe (`verifierCoherenceGlobale` + acquittement) | **Point d'insertion** idéal des nouveaux contrôles |
| Proposition → confirmation (§21, §3) | ✅ existe (pattern « oublis » Oui/Non) | Modèle à **réutiliser** |
| Gamme par poste et non globale (§17) | ✅ déjà par pièce (`elecGamme`/`ploGamme`, seed `qualiteMateriaux`) | Surtout un **nettoyage conceptuel** |
| Contexte Projet unifié (§3) | ❌ n'existe pas | À **introduire** comme couche additive pure |
| Profil rénovation / logistique (§10, §11) | ❌ n'existe pas | Dérivés **purs**, non tarifaires |
| Attribut « pièce principale » (§5) | ❌ n'existe pas (implicite dans la typologie) | Décision de modélisation à prendre |

---

## A. Fichiers concernés

| Fichier | Fonctions clés | Rôle actuel |
|---|---|---|
| `devis.html` | wizard 4 étapes, `collecterDonnees()`, `envoyerDevis()`, `majZone/chargerVilles` | Saisie amont (client + chantier + métiers) ; écrit `sessionStorage` (`chantier`, `client`, `devisMetiers`) ; lead e-mail + WhatsApp |
| `devis-configurateur.html` | `compositionTypologie`, `appliquerTypologie`, `changerCompteur`, `validerPieces`, `renderPieceConfig`, `renderMetierSection`, `recalcPiece`, `renderPhase3`, `genererPDFConfig`, `poseParDefaut`, `gammeElecParDefaut/gammePloParDefaut`, `afficherCoherence` | Cœur interface : sélection pièces, préconfiguration, config par métier, récap, PDF, appel Runtime |
| `js/coherence.js` | `SEUILS_COHERENCE`, `controlesCoherence`, `verifierCoherenceGlobale`, `verifierPlomberie/Sols/VMC/Menuiserie/Chauffage` | **Moteur de cohérence non bloquant** (déjà riche : dimensions, éclairage/prise manquants, points d'eau, écart surface, chambres vs surface) |
| `js/moteur-devis.js` | `calculerDevis()` | Consolidation Total HT/TVA/TTC/acomptes + forfaits accès + coefZone + tableau/chauffage/VMC (source de vérité du devis global) |
| `js/moteur-piece.js` / `moteur-piece-complet.js` | `calculerPiece`, `calculerPieceComplet` | Calcul par pièce (surfaces → chiffrage) |
| `js/moteur-revetements.js` | `appliquerRevetements`, helpers faïence/sol | Surfaces & prix revêtements |
| `js/moteur-recommandations.js` | `RecoEngine`, `recoDSBAT` | Recommandations (mode normes/standard/confort) |
| `js/parametres-metier.js` | `TABLEAU_PARAMS` (sous-ensemble non secret) | Paramètres publics de dimensionnement |
| `js/moteur-tva.js` | `tauxTVA()` | Taux TVA |
| `js/vue-tarifaire.js` + `vue-tarifaire-data.js` | accesseurs de prix (vue auto-hébergée) | Prix pièce côté navigateur, sans catalogue secret |
| `runtime/moteur-prive/prix.js`, `pricing.js` | catalogue, marges, `coefZone`, `dimensionnement*` | **Cerveau économique privé** (Runtime) — devis global |
| `tests/golden-master/*`, `runtime/tests/*` | `golden-master.js`, `r09-*`, `tarifs-bascule-check.js` | Filets de non-régression (comparaison **octet par octet**) |

---

## B. Données existantes (champs, stockage, circulation)

**Circulation :**
```
devis.html (saisie) ──envoyerDevis()──▶ sessionStorage['chantier' | 'client' | 'devisMetiers']
                                              │ (redirection)
devis-configurateur.html (chargement) ◀──────┘  lit ces 3 clés
   │  + persistance locale sessionStorage['configEtatV1'] (compteurs, dims, pièces, objectif)
   ▼
piecesSelectionnees[] + config par métier ──▶ __obtenirDevisRuntime() ──▶ Runtime (devis global)
```

**`client{}`** : nom, tel, email, adresse, source, delai.
**`chantier{}`** (23 champs) : codePostal, ville, typeBien, typeLogement, etage, ascenseur, surface, pieces, ageBati, etatLieux, typeProjet, hauteurPlafond, accessibilite, accessSup, qualiteMateriaux, chauffage, vmc, eauChaude, tableauExistant, borneVE, pv, domotique.
**`metiersActifs[]`** : sous-ensemble des 8 métiers.
**`piecesSelectionnees[]`** : `{id, nom, icon, numero, dims{l,la,h,fenetres,portes}, config{métier:{CODE:qty}}, elecMethode, elecGamme, ploGamme, peint*, sol*, faience*, normeMin, _recoApplique, surfaces, totalHT}`.

> Détail complet des 48 questions, options et usages : voir `AIC-001.md` §3 et §6.

---

## C. Dépendances (qui lit / qui modifie / quels calculs)

Synthèse des couplages **vérifiés dans le code** (détail par question dans `AIC-001.md` §4) :

- **`codePostal` → `coefZone()` → × Total HT global** (moteur-devis L163). Donnée la plus impactante, lue une fois, jamais modifiée après saisie.
- **`config.electricite` (par pièce) → dimensionnement Tableau** (agrégation prises/points/spécialisés/volets/télérupteurs/sonnette/fil pilote, moteur-devis L54-84). Couplage le plus riche.
- **`chauffage='electrique'` → `dimensionnementChauffage` → circuits injectés au tableau** (L42-45, L73-77).
- **`vmc`/`eauChaude='ballon'`/`borneVE='oui'` → circuits dédiés tableau** (VMC / chauffe-eau / IRVE).
- **`tableauExistant` → chiffrage tableau + parafoudre** (`!=='recent'` ; `ancien`/`inexistant` → parafoudre).
- **`accessibilite`/`accessSup` → forfaitAcces + ×1,088 (occupé)** (L155-159).
- **`typeProjet` → sous-couche peinture + reco + cohérence** ; **`etatLieux` → défaut gamme peinture** ; **`ageBati`/`etatLieux` → reco ragréage**.
- **`surface` → dimensionnement tableau (`surfaceLogement`) + `compositionTypologie` + contrôle d'écart cohérence**.
- **`pieces` (T1–T6) → `compositionTypologie` + repli circuits chauffage**.
- **`qualiteMateriaux` → seed des gammes par défaut** (`gammeElecParDefaut`/`gammePloParDefaut`), puis **gamme réelle portée par la pièce** (`elecGamme`/`ploGamme`).
- **`objectifProjet` (normes/standard/confort) → `recoDSBAT` ajouts élec par pièce** (retirables, plancher = norme).
- **`metiersActifs` → sections affichées + moteurs déclenchés** (racine du périmètre).

**Modifient les données :** `changerCompteur`/`togglePiece` (compteurs), `setDimPiece` (dims), `setElec*/setPloGamme` (gammes pièce), `recalcPiece` (config revêtements + appel calcul), `appliquerNorme` (plancher élec verrouillé), `appliquerObjectif` (ajouts reco), `validerPieces` (fusion pièces sans perte de config).

**Champs collectés mais non lus par un moteur de calcul :** `ville`, `etage`, `ascenseur`, `pv`, `domotique` (quasi), et **lecture morte `chantier.statut`** (le champ réel est `typeLogement`). Cf. `AIC-001.md` §5-Q2/Q3.

---

## D. Architecture proposée — le « Contexte Projet »

### D.0 Principe directeur

Introduire une **couche additive et purement dérivée** : le **Contexte Projet**. Elle **lit** les données existantes et **produit** des informations enrichies (déductions, hypothèses, points de vérification), **sans jamais écrire dans le calcul de prix**. Le moteur métier et le Runtime restent l'unique autorité tarifaire.

```
Données déclarées (chantier + pièces + config + texte libre)
        │  (lecture seule)
        ▼
  CONTEXTE PROJET  (module pur js/contexte-projet.js — À CRÉER)
   ├─ declare{}        : recopie des saisies client
   ├─ deduit{}         : déductions (profil réno, profil logistique, catégorie d'âge…)
   ├─ confirme{}       : déductions validées par le client
   ├─ incoherences[]   : ALIMENTÉ par verifierCoherenceGlobale (existe déjà)
   ├─ recommandations[]: ALIMENTÉ par RecoEngine / oublis (existe déjà)
   ├─ hypotheses[]     : propositions non confirmées (chauffage, ECS, VMC neuve…)
   ├─ aVerifierVisite[]: points à contrôler par l'artisan (ex. tableau « inconnu »)
   └─ confiance{}      : niveau de confiance par bloc (quand pertinent)
        │  (lecture seule)
        ▼
   Affichage client (bandeaux) + Dossier artisan   ← consommateurs
        │
        ✗ NE RÉINJECTE JAMAIS dans moteur-devis / Runtime (prix, quantités techniques)
```

### D.1 Où l'introduire (points d'insertion, tous déjà présents)

1. **Préconfiguration (§5, §6)** → étendre `compositionTypologie` / `afficherPropositionTypologie` (déjà une « proposition » modifiable). C'est déjà le bon endroit et le bon ton (« Composition proposée automatiquement… ajustez librement »).
2. **Contrôles contextuels (§3, §5, §12)** → brancher sur `verifierCoherenceGlobale` (déjà non bloquant, déjà avec acquittement « Continuer quand même »). Les nouveaux contrôles (« WC supprimé → intégré à la SDB ? », « il reste ~7 m² ») sont des **alertes supplémentaires** dans ce moteur.
3. **Proposition → confirmation (§14-§20)** → réutiliser le pattern « oublis » (`controlesOublisVmc/Peinture` : suggestion chiffrée + boutons **Oui, ajouter / Non**). Modèle idéal pour « remplacer le chauffage ? », « borne VE ? », etc.
4. **Profils (§10, §11)** → nouveaux **dérivés purs** lus depuis `chantier` (âge + état + installations + projet → profil rénovation ; accès + étage + ascenseur + contraintes → profil logistique). **Aucun coefficient de prix** (interdit §10, §11).
5. **Dossier artisan** → nouveau consommateur du Contexte (agrège incohérences + hypothèses + points à vérifier). Enrichit le PDF/récap sans toucher au chiffrage.

### D.2 Alimentation par les données existantes

- `incoherences[]` ← `verifierCoherenceGlobale(pieces, chantier)` (existe).
- Écart surface ← `coherence.js` `ecartSurfaceGlobal` (existe ; à raffiner en « reste X m² à répartir »).
- `deduit.categorieAge` ← `ageBati` (+ future « année » → catégorie, §8).
- `deduit.profilRenovation` ← `ageBati` + `etatLieux` + `tableauExistant` + `vmc` + `typeProjet` + `metiersActifs`.
- `deduit.profilLogistique` ← `accessibilite` + `etage` + `ascenseur` + `accessSup` + `typeLogement` + métiers de dépose/évacuation (futur module §23).
- `hypotheses[]` ← choix « remplacement » sur chauffage/ECS/VMC/borne VE/PV (assistants §14-§20).
- `aVerifierVisite[]` ← valeurs « inconnu » (tableau §13), champs manquants, écarts de métré.

### D.3 Modification minimale et réversible

- **Un seul fichier neuf** : `js/contexte-projet.js`, **fonction pure** `construireContexteProjet(chantier, pieces, metiersActifs, texteLibre?)` → renvoie un objet. Chargé en `<script src>`, **inerte tant qu'aucun consommateur ne l'appelle**.
- **Zéro modification** de `moteur-devis.js`, `moteur-piece*.js`, `prix.js`, Runtime.
- Réversibilité : retirer la balise `<script>` + les bandeaux d'affichage → retour à l'état actuel, calcul identique.
- Les premières briques (profils, message « reste X m² ») sont **affichage seul** : elles n'altèrent ni `piecesSelectionnees` ni la config.

---

## E. Risques

**E.1 Régression de calcul (le plus critique).**
Les Golden Master comparent le résultat **octet par octet** (`obtenu === attendu`). Toute modification touchant, même indirectement, `piecesSelectionnees`, `config`, `chantier` lus par un moteur peut casser la parité. ⚠️ Rappel connu : la comparaison est sensible **CRLF/LF** (faux écart Windows). → Toute mission passe le Golden Master **avant/après**.

**E.2 Doublons à éviter (fonctions déjà présentes).**
- **Écart surface** : ne pas créer un 2ᵉ contrôle — **enrichir** `coherence.js`.
- **Gamme** : elle est **déjà par pièce** ; ne pas réintroduire une gamme globale multiplicatrice (§17). `qualiteMateriaux` n'est qu'un *seed* de défauts — le clarifier, pas le dupliquer.
- **VMC / chauffage** : l'information existe en 3 endroits (chantier `vmc`/`chauffage`, métier coché, config par pièce) ; unifier **via le Contexte** (lecture), sans nouvelle saisie.

**E.3 Règles métier existantes à préserver absolument.**
- **Norme électrique verrouillée** (`appliquerNorme` / `normeMin`) : plancher intouchable.
- **coefZone**, **×1,088 logement occupé**, **forfaits accès**, **agrégation élec→tableau**, **parafoudre**, **garde anti-double-facturation ballon** : règles de prix — hors périmètre AIC.
- **`compositionTypologie` écrase `compteurs`** au chargement si aucun état restauré : attention à ne pas déclencher une préconfiguration qui **efface** des choix (le code protège déjà via `restaurerEtat` — ne pas contourner).

**E.4 Endroits dangereux (ne pas toucher sans mission dédiée + preuves).**
`moteur-devis.js`, `runtime/moteur-prive/*`, `appliquerNorme`, `validerPieces` (fusion sans perte), `recalcPiece` (séquence surfaces→revêtements→chiffrage). Toute intervention ici = risque tarifaire direct.

**E.5 Risque produit.**
Trop de bandeaux/hypothèses = bruit et perte de confiance. Chaque proposition doit être **rare, pertinente, confirmable** (jamais silencieuse — §21).

---

## F. Plan d'implémentation (petites missions réversibles)

> Ordre proposé : du plus sûr (affichage pur) au plus engageant (assistants métier). Chaque mission est **additive, réversible, avec Golden Master vert avant/après**.

| # | Mission | Nature | Fichiers | Réversibilité |
|---|---|---|---|---|
| **M1** | Créer `js/contexte-projet.js` **pur et inerte** (`construireContexteProjet`, aucun consommateur) + tests unitaires | Additif, 0 effet | +1 fichier | Retirer le fichier |
| **M2** | **Affiner le message d'écart surface** (« il reste ~X m² à répartir ») dans `coherence.js` — enrichir le texte existant, mêmes seuils | Texte only | `coherence.js` | Restaurer le libellé |
| **M3** | **Profil de rénovation** (dérivé pur, affichage bandeau lecture seule, aucun prix) | Additif | `contexte-projet.js` + 1 bandeau | Masquer le bandeau |
| **M4** | **Profil logistique** (dérivé pur, affichage ; distingue approvisionnement vs évacuation) | Additif | idem | idem |
| **M5** | **Contrôle contextuel « WC supprimé → intégré à la SDB ? »** via `verifierCoherenceGlobale` (proposition + confirmation) | Additif non bloquant | `coherence.js` / hook | Retirer la règle |
| **M6** | **Préconfiguration enrichie** : proposer *bureau* et gérer la terminologie retenue (après décision §6) ; toujours une **proposition** modifiable | UI proposition | `compositionTypologie` + libellés | Revenir au map actuel |
| **M7** | **Année de construction (facultative) → catégorie d'âge** (une seule vérité, §8) | Additif champ | `devis.html` + mapping pur | Masquer le champ |
| **M8** | **Contraintes cumulables + « autre/précision libre »** (§12) : passage mono→multi, en **préservant** la lecture actuelle `accessSup` | Compat ascendante | `devis.html` + adaptateur | Revenir au select simple |
| **M9** | **Champ gamme clarifié « par poste »** (§17) : documentation + UI, sans changer les prix | Clarification | libellés / doc | — |
| **M10+** | **Assistants métier** (chauffage, ECS, VMC neuve, borne VE, PV, domotique) : **une fiche métier validée par toi AVANT chaque assistant** ; propositions chiffrées « prévisionnelles à confirmer en visite » | Additif par métier | fiches + assistants | Désactiver l'assistant |
| **Mn** | **Module démolition/dépose/évacuation** (§23) : mission séparée après analyse d'impact | Nouveau module | à définir | — |
| **Mx** | **Copilote IA** (§22) : dernier, jamais source de vérité prix/quantités/conformité | Couche externe | à définir | — |

Chaque mission suit le protocole opérateur habituel : objectif, pré-checks, sauvegarde, diff `--name-status` (aucun fichier moteur en M/D/R inattendu), Golden Master, validation avant la suivante.

---

## G. Tests (par type de mission)

- **Toute mission** : `node tests/golden-master/golden-master.js verify` + `r09-navigateur-sans-pricing.js` **verts** (parité octet ; neutraliser CRLF pour éviter un faux écart).
- **Cohérence (M2, M5)** : tests unitaires sur `verifierCoherenceGlobale` (cas WC supprimé, écart surface +/- seuil) → l'alerte apparaît/disparaît correctement, **non bloquante**, acquittement OK.
- **Contexte pur (M1, M3, M4)** : tests sur `construireContexteProjet` (entrées chantier variées → profils attendus) ; **assert : aucun accès au DOM, aucune écriture dans `config`/prix**.
- **Préconfiguration (M6)** : la proposition ne s'applique **que** si aucun état restauré ; ajout/suppression/transformation de pièce préservés ; `validerPieces` ne perd aucune config.
- **Champ année (M7)** : année → catégorie déterministe ; jamais deux valeurs contradictoires stockées.
- **Contraintes multi (M8)** : anciennes lectures `accessSup` toujours satisfaites (forfaits inchangés) ; non-régression prix.
- **Assistants métier (M10+)** : chaque proposition est **confirmable** et n'altère le devis qu'après confirmation ; « à confirmer en visite » présent.
- **Non-régression prix globale** : un panel de devis types → Total HT/TVA/TTC **identiques** avant/après chaque mission.

---

## H. Questions à trancher (décisions métier — je ne décide pas seul)

1. **Terminologie pièces (§6)** : afficher « T3/F3 » (immobilier) ou « 3 pièces » (actuel) côté client ? (le code stocke un **nombre** 1–6, affiche « T{n} » seulement dans les explications). Impact direct sur les libellés de préconfiguration.
2. **Bureau en préconfiguration (§5)** : aujourd'hui `bureau` **n'est jamais proposé** par la typologie (seulement salon + chambres). Faut-il l'ajouter comme pièce principale conditionnelle ? À partir de quelle typologie/surface ?
3. **Modèle « pièce principale » (§5)** : créer un **attribut explicite** `principale: true/false` sur `PIECES_DEF`, ou garder la logique **implicite** (salon + chambres) ? (aucun attribut n'existe aujourd'hui).
4. **Règle « WC supprimé » (§5)** : quelles conséquences exactes de calcul quand « WC intégré à la SDB » ? (déplacement d'un point d'eau ? rien côté prix ?). Je ne toucherai aux quantités qu'avec ta règle.
5. **Seuils des profils (§10)** : quelles combinaisons définissent « légère / intermédiaire / lourde » ? (je propose une grille, tu valides — **aucun prix** associé).
6. **Année → catégorie (§8)** : bornes exactes (récent <10, moyen 10–30, ancien 30–50, très ancien >50 sont les catégories actuelles — l'année calcule l'âge par rapport à quelle date de référence ?).
7. **États ECS (§16)** : liste exacte (existant / conservation / remplacement / changement techno / inconnu) — confirmer avant fiche métier.
8. **Familles VMC (§15)** : périmètre des technologies à modéliser (simple flux auto / hygro A / hygro B / double flux / autres ?) — chacune = modèle de config distinct (fiche métier dédiée requise avant code).
9. **Contraintes cumulables (§12)** : liste finale + faut-il conserver la compat avec `accessSup` mono-valeur pour ne pas casser les forfaits actuels ?
10. **Gamme par poste (§17)** : liste des postes où la gamme a un sens (appareillage, robinetterie, sanitaires, carrelage, finitions peinture) vs postes techniques déterminés par la règle — valider la liste.
11. **Texte libre (§21)** : à ce stade, seulement « source d'information » affichée à l'artisan, ou déjà détection d'intentions (nécessite l'IA, donc plus tard) ?

---

## Conclusions demandées

### 1. Ce que je peux implémenter sans risque
- **M1** : `js/contexte-projet.js` pur et inerte (aucun consommateur) + tests.
- **M2** : affiner le **message d'écart surface** existant (« il reste ~X m² à répartir »), sans changer les seuils ni bloquer.
- **M3 / M4** : **profils rénovation & logistique** en **affichage lecture seule** (dérivés purs, zéro prix).
- Ces trois briques sont **additives, réversibles, sans impact sur le calcul** (Golden Master inchangé par construction).

### 2. Ce qui nécessite une décision métier
- Terminologie T/F (Q1), bureau & modèle « pièce principale » (Q2-Q3), règle « WC → SDB » (Q4), seuils de profils (Q5), référence de calcul d'âge (Q6), états ECS (Q7), familles VMC (Q8), contraintes cumulables (Q9), liste des postes à gamme (Q10), rôle du texte libre (Q11). **Aucune de ces décisions ne sera codée avant ta réponse.**

### 3. Ce que je recommande de faire en premier
Dans l'ordre : **M1 → M2 → M3**. C'est le chemin le plus sûr : on pose le socle (Contexte pur), on améliore une valeur immédiatement visible (écart surface, déjà présente donc à faible risque), puis on introduit le premier profil en affichage seul. Trois missions sans aucun risque tarifaire, qui prouvent le concept avant tout engagement métier.

### 4. Ce qu'il ne faut surtout pas toucher pour l'instant
- `moteur-devis.js`, `runtime/moteur-prive/*` (catalogue, marges, `coefZone`, `dimensionnement*`).
- `appliquerNorme` / `normeMin` (plancher normatif verrouillé).
- `validerPieces` (fusion des pièces sans perte de config) et `recalcPiece` (séquence de calcul).
- Les règles de prix : forfaits accès, ×1,088, agrégation élec→tableau, parafoudre, garde ballon.
- Toute intégration IA (§22) et le module démolition/évacuation (§23) : missions ultérieures, hors AIC-001 Phase 1.

---

*Fin du plan AIC-001 Phase 1. En attente de ta validation avant toute modification de fichier. Aucun code écrit, aucun commit.*
