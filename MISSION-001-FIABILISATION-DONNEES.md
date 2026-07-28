# MISSION 001 — Fiabilisation des données d'entrée
**Date : 2026-07-28 · Aucun calcul métier modifié. Seule `collecterDonnees()` (devis.html) a été corrigée.**

## 1. Tableau complet des champs du formulaire `devis.html`

Légende « Enregistré ? » : ✅ = présent dans le sessionStorage avant correction · 🔧 = ajouté par cette mission · — = non enregistré (volontaire ou non).

### Étape 1 — Coordonnées & demande

| Champ (id) | Question | Enregistré ? | Où | Utilisé où ? | Si non utilisé, pourquoi | Exploitable pour les calculs ? | Supprimable ? |
|---|---|---|---|---|---|---|---|
| `clientNom` | Nom complet * | ✅ | `client.nom` | Garde d'accès configurateur, PDF, emails lead, WhatsApp, confirmation | — | Non (identification) | Non |
| `clientTel` | Téléphone * | ✅ | `client.tel` | Garde d'accès, emails, WhatsApp, confirmation | — | Non | Non |
| `clientEmail` | Email | ✅ | `client.email` | Emails lead, WhatsApp | — | Non | Non |
| `clientAdresse` | Adresse | ✅ | `client.adresse` | PDF, emails, WhatsApp | — | Oui : géocodage → frais de déplacement réels (aujourd'hui seul le CP compte) | Non |
| `clientCP` | Code postal * | ✅ | `chantier.codePostal` (+ `depannageCP` si dépannage) | `coefZone()` ×1,00/1,13/1,22 (récap + PDF), `chargerVilles()`, depannage.html | — | Déjà exploité | Non |
| `clientVille` | Ville | ✅ | `chantier.ville` | Affichage zone (`majZone`) à l'étape 1 uniquement ; jamais relu ensuite | Redondant avec le CP pour le calcul | Faible (le CP suffit au coef) | Oui, du storage (garder l'affichage) |
| `clientSource` | Comment nous avez-vous connu | ✅ | `client.source` | **Nulle part** (même pas dans l'email lead) | Collecté pour le marketing mais jamais transmis | Non (marketing, pas calcul) — à ajouter à l'email lead | Non (utile marketing), mais à brancher |
| `clientDelai` | Délai souhaité | ✅ | `client.delai` | Email lead (`Delai`), message WhatsApp | — | Oui : pourrait moduler un « planning/urgence » (majoration délai court) | Non |
| `typeDemande` | Travaux / Dépannage | — (transient) | Rien (sert au routage, + `depannageCP`) | Bifurcation vers `depannage.html` | Volontaire : simple aiguillage | Non | Non (routage) |

### Étape 2 — Chantier

| Champ (id) | Question | Enregistré ? | Où | Utilisé où ? | Si non utilisé, pourquoi | Exploitable pour les calculs ? | Supprimable ? |
|---|---|---|---|---|---|---|---|
| `typeProjet` | Rénovation / Neuf / Extension | ✅ | `chantier.typeProjet` | `tauxTVA()` (10/20 %), `poseParDefaut()` (placo si neuf), email lead, récap texte | — | Déjà exploité | Non |
| `typeBien` | Maison / Appart / Local | ✅ | `chantier.typeBien` | `tauxTVA()` (local → 20 %), récap, emails | — | Oui : appartement → contraintes copro/gaines techniques | Non |
| `typeLogement` | Principal / Secondaire / Locatif / Vente | ✅ | `chantier.typeLogement` | **Nulle part** | Stocké mais aucune règle ne le lit | Oui : locatif/vente → mode « mise en sécurité minimale » vs confort ; électricité décence locative | Non — à brancher |
| `etage` | Étage (si appartement) | 🔧 **corrigé** | `chantier.etage` | Rien encore (désormais disponible) | **Bug** : demandé, jamais écrit dans `collecterDonnees()` | Oui : étage élevé sans ascenseur → majoration manutention | Non |
| `ascenseur` | Ascenseur ? | 🔧 **corrigé** | `chantier.ascenseur` | Rien encore (désormais disponible) | **Bug** : idem | Oui : couplé à `etage` pour un forfait manutention | Non |
| `surface` | Surface totale * | ✅ | `chantier.surface` | `compositionTypologie()` (sde/2e WC), `controlesCoherence()` (écart ±25 %), récap texte | — | Déjà exploité ; pourrait aussi borner le bilan de puissance | Non |
| `pieces` | Nb pièces principales * | ✅ | `chantier.pieces` | `compositionTypologie()` (T1–T6), circuits chauffage `ceil(n/3)`, choix ballon 100/200L, emails | — | Déjà exploité | Non |
| `hauteurPlafond` | Hauteur sous plafond | ✅ | `chantier.hauteurPlafond` | **Nulle part** | Le configurateur redemande la hauteur réelle par pièce (`dims.h`) → doublon | Oui : pré-remplir `dims.h` (2,5 / 3,0 / 3,4) au lieu du défaut fixe 2,5 | Oui (si pré-remplissage fait), sinon doublon inutile |
| `ageBati` | Âge du bâtiment | ✅ | `chantier.ageBati` | Récap étape 4 uniquement | Aucune règle ne le lit | Oui : très ancien → présomption rénovation complète, diagnostic, majoration saignées | Non — à brancher |
| `etatLieux` | État général | ✅ | `chantier.etatLieux` | `poseParDefaut()` (saillie/goulotte/saignée), gammes peinture par défaut, récap | — | Déjà exploité | Non |
| `accessibilite` | Accès véhicule | ✅ | `chantier.accessibilite` | Forfait accès +80 € (moyen) / +200 € (difficile) au récap | — | Déjà exploité | Non |
| `accessSup` | Contraintes (voisins/occupé/copro) | 🔧 **corrigé** | `chantier.accessSup` | **Réactive 3 règles existantes** : +50 € voisins, +120 € copro, ×1,088 logement occupé (récap + PDF) | **Bug** : les règles existaient, la donnée n'arrivait jamais | Déjà exploité (désormais actif) | Non |
| `tableauExistant` | Tableau actuel | ✅ | `chantier.tableauExistant` | Parafoudre si ancien/inexistant ; pas de chiffrage tableau si récent | — | Déjà exploité | Non |
| `chauffage` | Type de chauffage | ✅ | `chantier.chauffage` | Sorties fil pilote (prestations + norme min), circuits chauffage tableau, thermostat conseil confort, calibre ID 63A | — | Déjà exploité | Non |
| `vmc` | VMC existante ? | ✅ | `chantier.vmc` | Circuit VMC 2A dans le tableau si ≠ non | — | Déjà exploité | Non |
| `eauChaude` | Eau chaude sanitaire | 🔧 **corrigé** | `chantier.eauChaude` | **Réactive 3 règles existantes** : circuit chauffe-eau 20A + contacteur J/N, calibre ID 63A, ajout ballon 100/200L au récap | **Bug** : idem accessSup | Déjà exploité (désormais actif) | Non |
| `qualiteMateriaux` | Gamme matériaux | ✅ | `chantier.qualiteMateriaux` | `gammeElecParDefaut()` (dooxie/mosaic/celiane), `gammePloParDefaut()`, récap | — | Déjà exploité | Non |
| `domotique` | Domotique ? | ✅ | `chantier.domotique` | **Nulle part** | Aucune règle ni prestation domotique dans le moteur | Oui : basique → prises connectées ; complet → modules volets/éclairage, écosystème (poste catalogue à créer) | Non — à brancher (sinon retirer la question : promesse non tenue au client) |
| `pv` | Panneaux solaires ? | ✅ | `chantier.pv` | **Nulle part** | Aucune règle PV | Oui : coffret AC/DC, disjoncteur dédié, ou simple mention « à étudier en visite » | Oui à court terme, ou brancher une mention visite technique |
| `borneVE` | Borne de recharge ? | ✅ | `chantier.borneVE` | `b.irve` → circuit 32A + différentiel type A dédié dans le tableau | — | Déjà exploité (mais la borne elle-même n'est pas chiffrée, seulement le départ tableau) | Non |

### Étapes 3–4

| Champ | Enregistré ? | Où | Utilisé où ? | Commentaire |
|---|---|---|---|---|
| `metier` (8 checkboxes) | ✅ | `devisMetiers` | Filtre les sections métiers du configurateur ; défaut = tous si vide | Exploité |
| `description` | ✅ (transient : email seulement) | Nulle part en storage | Email lead + WhatsApp | Pourrait être stockée pour la visite technique / PDF |

## 2. Synthèse des anomalies

- **4 champs demandés mais jamais enregistrés** (bug) : `etage`, `ascenseur`, `accessSup`, `eauChaude` → **corrigés**.
- **5 champs enregistrés mais jamais lus** : `typeLogement`, `hauteurPlafond`, `ageBati`, `domotique`, `pv` (+ `ville`, `source` transmis mais inertes). Non supprimés — chacun a un potentiel d'exploitation documenté ci-dessus ; décision à prendre en Mission ultérieure (brancher ou retirer).
- `domotique` est le plus problématique commercialement : on pose la question au client, il répond « complet », et le devis n'en tient aucun compte.

## 3. Correction appliquée (seul changement de code)

Fichier : `devis.html`, fonction `collecterDonnees()`, objet `chantier`. 4 lignes ajoutées :

```js
etage: document.getElementById('etage').value,
ascenseur: document.getElementById('ascenseur').value,
...
accessSup: document.getElementById('accessSup').value,
...
eauChaude: document.getElementById('eauChaude').value,
```

**Vérifications effectuées :**
- Syntaxe validée (parse Node).
- Les 4 éléments existent toujours dans le DOM (les champs `etage`/`ascenseur` sont seulement masqués en CSS quand non pertinents, `.value` reste lisible) → aucun risque d'erreur JS.
- Cohérence des valeurs avec les comparaisons du configurateur : `accessSup` → `'voisins' | 'occupé' | 'copro'` (accent conservé, identique ligne 2167–2169 du configurateur) ; `eauChaude` → `'ballon'` (lignes 2137 et 2156).
- Aucun autre fichier modifié ; aucun calcul métier touché. Les règles réactivées existaient déjà et n'ont pas été modifiées.

**Effet de bord attendu (voulu)** : les devis générés après cette correction pourront être plus chers qu'avant à saisie identique (majoration occupé, forfaits, ballon, calibre 63A) — c'est le comportement prévu du moteur qui était silencieusement désactivé.
