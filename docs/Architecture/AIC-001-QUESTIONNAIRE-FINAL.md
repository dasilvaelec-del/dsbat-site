# AIC-001 — Finalisation du questionnaire : matrice & écarts
## Vérification de couverture — **aucun fichier modifié**

> **Statut : vérification.** Aucun code écrit/modifié, aucune question supprimée, aucun commit. Objectif : confirmer que **chaque question a un rôle identifié** et que **sa réponse est conservée** jusqu'au configurateur, puis lister **concrètement** ce qui reste à faire pour terminer le questionnaire.
> **A. Matrice complète** : voir le fichier `AIC-001-MATRICE-QUESTIONNAIRE.xlsx` (34 questions × 15 colonnes). Les listes B→H ci-dessous en sont la synthèse actionnable.

---

## B. Questions déjà conformes (rôle identifié + réponse conservée)

`clientNom, clientTel, clientEmail, clientAdresse, clientCP, typeDemande` (étape 1) ·
`typeProjet, surface, hauteurPlafond, etatLieux, accessibilite, tableauExistant, chauffage, vmc, eauChaude, qualiteMateriaux, borneVE` (étape 2) ·
`metier` (étape 3) · `objectifProjet, pièces (compteurs), dims` (configurateur phase 1).

→ Ces questions ont un rôle client/artisan/devis identifié, leur réponse est stockée (`sessionStorage` / globales) et arrive bien au configurateur. **Rien à faire.**

## C. Questions dont la réponse est stockée mais pas encore exploitée (rôle validé, à raccorder plus tard)

| Question | Stockée dans | Rôle validé non encore branché |
|---|---|---|
| `clientVille` | chantier.ville | localisation (calcul passe par le CP) — informatif |
| `clientDelai` | client.delai | planning de la visite |
| `etage` | chantier.etage | logistique / acheminement / évacuation (dépose) |
| `ascenseur` | chantier.ascenseur | logistique / manutention (dépose) |
| `domotique` | chantier.domotique | futur assistant domotique |
| `pv` | chantier.pv | futur assistant photovoltaïque |

> **Ces questions ne sont PAS inutiles** : rôle métier validé, réponse conservée. Classées « QUESTION EXISTANTE — RÔLE À RACCORDER AU FUTUR CONTEXTE/DEVIS ». À raccorder après la finalisation (logistique/dépose, assistants).

## D. Questions dont la réponse est mal / partiellement transmise

| Question | Problème constaté (OBSERVATION DU CODE) |
|---|---|
| `description` (descriptif libre) | **Envoyé au lead e-mail mais NON re-transmis** au configurateur (absent de `sessionStorage['chantier']`). La donnée existe à la saisie puis disparaît du parcours. → à re-transporter (partie « descriptif libre », après). |
| `typeLogement` (Statut) | Correctement stocké, mais **un moteur lit `chantier.statut`** (champ inexistant) au lieu de `typeLogement` → **lecture morte** (RISQUE TECHNIQUE). À aligner (après). |

## E. Informations réellement manquantes (« MANQUANTE — À TRAITER »)

1. **Année exacte de construction** — seul `ageBati` (tranches) existe. *(validé : à ajouter en facultatif).*
2. **Proposition automatique d'extérieurs si Maison** — les pièces extérieures existent, mais **aucune logique `typeBien==='maison'` → proposer**. *(validé : à ajouter).*
3. **Contraintes cumulables** — `accessSup` est un **choix unique** ; pas de multi-sélection ni « autre/précision libre ». *(validé : à ajouter, sans toucher au prix).*

> Les systèmes VMC (simple/hygro/double flux), le remplacement chauffage/ECS et le module dépose/démolition ne sont **pas** des manques du questionnaire : ce sont des **fiches métier / modules futurs** (section G).

## F. Modifications nécessaires pour FINALISER le questionnaire (liste concrète)

> Chacune dépend d'un arbitrage Q1→Q5 déjà présenté ; rappel de la cible. **Aucune ne touche aux prix / moteurs / Runtime.**

| # | Modification | Fichier | Dépend de |
|---|---|---|---|
| **F1** | Préconfiguration **T5 et T6 → 2 salles de bain/eau** (recommandé sdb + sde), modifiable | `devis-configurateur.html` (`compositionTypologie`) | **Q1** |
| **F2** | **Maison → bandeau de proposition** d'extérieurs (garage/carport/terrasse/jardin/façade), non cochés, confirmés par le client ; « éclairage extérieur » **non** transformé en pièce | `devis-configurateur.html` (phase 1) | **Q4** |
| **F3** | **Année de construction facultative** (« Connaissez-vous l'année ? → année / je ne sais pas ») → **déduit la tranche `ageBati`** | `devis.html` (étape 2) | **Q3** |
| **F4** | **Contraintes cumulables + « autre/libre »** : nouveau champ multi **informatif**, `accessSup` conservé tel quel (prix inchangé) | `devis.html` (étape 2) | **Q2** |
| **F5** *(optionnel)* | **Libellé « T3 / F3 »** dans le menu « Nombre de pièces principales » (cosmétique, valeur interne inchangée) | `devis.html` (étape 2) | **Q5** |

## G. À traiter APRÈS la finalisation du questionnaire

- **Descriptif libre** : re-transport vers le configurateur + exploitation (proposition→confirmation), puis IA.
- **Fiches métier** : remplacement chauffage, ECS, **systèmes VMC** (simple flux / hygro A/B / double flux) — chacune = modèle de configuration distinct.
- **Raccordement logistique** : `etage`, `ascenseur`, `accessSup` (cumul) → forfaits/dépose/évacuation (impact prix, mission dédiée).
- **Alignement `statut`/`typeLogement`** (lecture morte).
- **Assistants** domotique / borne VE / PV.
- **Branchement des nouveaux champs au Contexte Projet M2** (`contexte-projet.js`, lecture seule).
- **Module démolition / dépose / évacuation** (réutilisera pièces, surfaces, `ageBati`, `etatLieux`, `tableauExistant`, accès, contraintes, métiers).

## H. Confirmation de couverture

Contrôle de la liste « NE RIEN OUBLIER » → chaque domaine est représenté (par une question) ou obtenu autrement :

identité/nature projet → `clientNom..email`, `typeDemande`, `typeProjet` · type de logement → `typeLogement` · maison/appartement → `typeBien` · surface → `surface` · typologie T1–T6 → `pieces` · composition & modification des pièces / chambres / bureau / sdb / sde / wc / cuisine / séjour / annexes → **compteurs par type** (configurateur) · espaces extérieurs (garage/carport/terrasse/jardin/façade) → **pièces extérieures** (proposition Maison = E-2 à ajouter) · éclairage extérieur → **prestation élec** (pas une question) · année/âge → `ageBati` (+ année = E-1) · état bâtiment → `etatLieux` · état installations → `tableauExistant`, `vmc`, `eauChaude`, `chauffage` · accessibilité → `accessibilite` · contraintes → `accessSup` (cumul = E-3) · chauffage existant → `chauffage` (remplacement = G) · VMC existante → `vmc` (création/systèmes = G) · élec/plomberie/peinture/sols/carrelage/faïence/menuiseries → `metier` + config par pièce · gammes / standard-premium → `qualiteMateriaux` + gammes par poste · équipements → `domotique`, `borneVE`, `pv` + config · métrage → `surface` + `dims` · influence dépose/démolition/évacuation → `ageBati`, `etatLieux`, `tableauExistant`, `typeBien`, `accessibilite`, `accessSup`, `etage`, `ascenseur`, `metier` (rôles à raccorder = G) · infos artisan/client/visite → transverses (colonnes 5/6/11 de la matrice).

> **« Aucune question déjà étudiée n'a été oubliée dans cette vérification. »**
> Aucune question n'est orpheline ; aucune donnée importante ne disparaît entre le questionnaire et le configurateur, **sauf** le descriptif libre (D) — signalé, à traiter après.

---

## Prochaine étape

Cette liste **F1→F5** est la liste concrète des modifications pour terminer le questionnaire. Elle attend uniquement tes arbitrages **Q1→Q5** (message précédent). Dès validation, je code **F1→F5** (au questionnaire uniquement), puis je vérifie : navigation complète, conservation des réponses, arrivée au configurateur, préconfigurations T1→T6, Maison/Appartement, Golden Master, invariance des prix. Aucun commit, aucun push.

*Fin de la vérification. Aucun fichier modifié.*
