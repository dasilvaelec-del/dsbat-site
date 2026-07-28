# MISSION 002 — Audit du moteur de calcul des PRISES
**Date : 2026-07-28 · Audit pur, aucun code modifié.**

---

## 1. Où est calculé le nombre de prises ?

Le nombre de prises est déterminé à **4 endroits**, tous dans `devis-configurateur.html` (sauf le dernier) :

| Étape | Lieu | Rôle |
|---|---|---|
| a. Minimum réglementaire | `normeMin(pieceId, portes, surface)` — ligne ~1725 | Fixe le plancher verrouillé de prises par pièce |
| b. Injection du plancher | `appliquerNorme(index)` — ligne ~1795 | Écrit `config.electricite[code] = max(actuel, min)` ; rappelée à **chaque** `recalcPiece()` |
| c. Conseils additionnels | `recoDSBAT(pieceId, dims, ch, niveau)` — ligne ~1749 + `appliquerObjectif(piece)` | Pré-ajoute des prises selon l'objectif (standard/confort), retirables |
| d. Ajustement client | `changerQty(pieceIndex, code, metier, delta)` — ligne ~1936 | Boutons +/− avec plancher : `newVal = Math.max(minNorme, current + delta)` |
| e. Agrégation tableau | `renderPhase3()` ligne ~2120 → `dimensionnementTableau(b)` dans **prix.js** | `b.prises16 = Σ(ELEC_PRISE10 + 2×ELEC_PRISED)` → circuits 16A |

Le **prix** unitaire d'une prise est calculé dans `prix.js` : `prixElec(poste, methode, gamme)` = `pose[méthode] + appareillage` où `appCost({prise:n}, gamme)` = n × `APPAREILLAGE.prise[gamme]` (8,32 € dooxie / 11,67 € mosaic / 14,51 € celiane / 18,73 € ASL en saillie).

## 2. Fonctions utilisées (chaîne complète)

```
validerPieces() / recalcPiece()
  └─ appliquerNorme(index)
       └─ normeMin(pieceId, portes, surface)      ← plancher normatif
  └─ appliquerObjectif(piece)
       └─ recoDSBAT(pieceId, dims, chantier, niveau) ← conseils
changerQty()                                        ← saisie client (plancher = normeMin)
renderPrestRow()                                    ← badges 🔒/💡 (rappelle normeMin + recoDSBAT)
getElecPourPiece(pieceId)                           ← quelles prises sont PROPOSÉES par pièce
getPrixPrestFor(code, piece) → prixElec()/appCost() ← prix (prix.js)
getMoyenPrixFor()                                   ← (min+max)/2 utilisé partout
renderPhase3() → dimensionnementTableau(b)          ← prises → circuits (prix.js)
explicationsPiece() / explicationsTableau()         ← justification en français
```

## 3. Données utilisées

| Donnée | Utilisée ? | Comment |
|---|---|---|
| **Type de pièce** (`pieceId`) | ✅ principale | Branche du `if/else` de `normeMin` + filtre des prestations proposées (`getElecPourPiece`) |
| **Surface de la pièce** (`dims.l × dims.la`) | ✅ partielle | Uniquement pour salon/salle à manger : `max(5, ceil(surface/4))`. Ignorée pour toutes les autres pièces |
| **Nombre de portes** (`dims.portes`) | ✅ indirecte | Ne joue pas sur les prises (choisit le type d'éclairage) |
| **Nombre de pièces** (`chantier.pieces`) | ✅ indirecte | Via `compositionTypologie` : détermine COMBIEN de chambres/pièces existent, donc le total de prises du logement |
| **Type de logement** (`chantier.typeLogement`) | ❌ | Jamais lu (locatif/vente ne changent rien) |
| **Surface totale** (`chantier.surface`) | ✅ indirecte | Enrichit la composition (sde, 2e WC) → plus de pièces → plus de prises ; contrôle de cohérence ±25 % |
| **Chauffage** (`chantier.chauffage`) | ✅ | Ajoute `ELEC_SC20_FP` (sortie câble, pas une prise) en pièces de vie |
| **Objectif projet** (`objectifProjet`) | ✅ | standard/confort ajoutent des prises doubles conseillées |
| **Qualité matériaux / état des lieux** | ✅ prix seulement | Gamme et méthode de pose par défaut → prix unitaire, pas le nombre |
| **Fenêtres, hauteur, âge bâti, typeBien, domotique** | ❌ | Aucun effet sur les prises |

## 4. Minimum calculé par type de pièce

Fichier concerné pour toutes les lignes : **devis-configurateur.html**, fonction `normeMin()` (lignes 1725–1742). Le catalogue de prix est dans **prix.js**.

| Pièce | Minimum verrouillé | Origine réelle de la règle |
|---|---|---|
| Cuisine | 6× prise 16A + 1× prise 32A + 2× prise 20A | **NF C 15-100** (6 socles dont 4 plan de travail ; circuits spécialisés) — conforme dans l'esprit |
| Salon / Salle à manger | `max(5, ceil(surface/4))` prises + 1 RJ45 + 1 TV | Prises : **NF C 15-100 pré-A5** (règle 1/4 m² remplacée en 2015). RJ45+TV par pièce : **règle DSBAT** (la norme raisonne par logement) |
| Chambre | 3 prises + 1 RJ45 + 1 TV | 3 prises : **NF C 15-100** ✓. RJ45+TV : **règle DSBAT** |
| SDB | 1 prise (+ liaison équipotentielle ✓ norme, + sèche-serviette = **règle DSBAT** badgée à tort « norme ») | 1 prise : tolérée par la norme (hors volumes), pas un minimum obligatoire → **règle DSBAT prudente** |
| SDE | 1 prise | **Règle DSBAT** (même remarque ; noter : pas de liaison équipotentielle verrouillée en SDE, contrairement à la SDB) |
| WC | 0 prise | **NF C 15-100** ✓ (aucun socle exigé) |
| Entrée | 1 prise (+ sonnette = **règle DSBAT** badgée « norme ») | 1 prise dégagement : esprit norme ✓ |
| Bureau, dressing, couloir, escalier, cave, garage, véranda | 1 prise (branche `else`) | **Règle DSBAT** générique — la norme n'exige 1 socle que dans certains dégagements/pièces >4 m² |
| Terrasse, jardin, façade, carport | 1 prise (même branche `else` !) | **Règle DSBAT involontaire** : l'extérieur hérite du minimum générique avec une prise intérieure standard |

## 5. Cas particuliers GÉRÉS

1. Plancher infranchissable : le client ne peut jamais descendre sous `normeMin` (`changerQty`), badge 🔒 avec justification affichée.
2. Recalcul dynamique : si les portes/surface changent, `appliquerNorme` libère les anciens minima devenus caducs et applique les nouveaux (sans écraser les ajouts manuels au-dessus du plancher).
3. Prise double comptée **2 socles** dans le dimensionnement des circuits (`prises16 += PRISED×2`) — conservateur.
4. Prises spécialisées cuisine : 1 circuit dédié **par** prise 20A/SC20 ; la 32A bascule le flag `cuisson` (circuit 32A + exigence type A).
5. Chauffage électrique → sortie de câble fil pilote verrouillée dans les pièces de vie.
6. Conseils contextuels : chambre (+1 double chevet), bureau (+2 prises télétravail), cuisine (+1 double plan de travail), confort (+1 double pièces de vie) — retirables, mémorisés dans `_recoApplique` pour un retrait propre au changement de mode.
7. Fusion : retour en phase 1 puis revalidation ne réinitialise pas les quantités saisies.
8. Multi-exemplaires : 3 chambres = 3× le minimum chacune.
9. Max 8 prises par circuit 16A (1,5 mm², réglage sécuritaire) dans le tableau.
10. Explication du raisonnement à l'écran, dans le PDF et l'email (`explicationsPiece`, `explicationsTableau`).

## 6. Cas particuliers NON gérés

1. **Cuisine < 4 m²** : la norme tolère 3 socles ; le moteur impose toujours 6 (sur-chiffrage kitchenette/studio).
2. **Séjour > 28 m² (A5)** : règle actuelle pré-2015 (`1/4 m² min 5`). Un séjour de 40 m² se voit imposer 10 prises alors que l'A5 en demande 7 → sur-chiffrage ; à l'inverse la logique A5 « 5 si ≤28 m² » est équivalente en dessous.
3. **Séjour sans dimensions saisies** : surface 0 → retombe à 5 prises silencieusement (pas d'alerte spécifique prises).
4. **Prises extérieures** : terrasse/jardin/façade/carport reçoivent une prise standard verrouillée — pas de variante étanche IP44, pas de prix spécifique, pas de circuit dédié extérieur.
5. **Prise triple `ELEC_PRISET`** : vendable via le catalogue mais **jamais proposée** dans le configurateur ; si elle l'était, elle n'est **pas comptée** dans `prises16` (agrégation ligne 2120 n'additionne que PRISE10 et PRISED) → circuits sous-dimensionnés.
6. `ELEC_PRISECMD` (prise commandée) : au catalogue, jamais proposée.
7. **Plan de travail** : pas de distinction des « 4 prises plan de travail » exigées par la norme dans les 6 de la cuisine — invérifiable en visite.
8. **Volumes SDB** : la prise SDB n'est soumise à aucun contrôle de position/volume (0/1/2) ni IPX.
9. **2 cuisines** (ex. logement + studio) : 2× (6+32A+2×20A) prestations, mais `b.cuisson` est un booléen → **1 seul circuit 32A** au tableau pour 2 plaques.
10. **Réseau de communication par logement** : la norme exige un minimum de socles RJ45 par logement (selon typologie) près du coffret ; ici RJ45 est par pièce et le coffret VDI n'est jamais chiffré.
11. **Prises non affectées à un circuit précis** : le moteur compte globalement (`ceil(total/8)`), il ne répartit pas par pièce/zone comme le ferait un schéma unifilaire.
12. `typeLogement` locatif/vente : aucun mode « décence locative / minimum sécurité » — même minima partout.
13. Grande chambre (>12 m²) : toujours 3 prises, aucune modulation par surface hors séjour.

## 7. Vérification de conformité NF C 15-100

| Règle du moteur | Verdict |
|---|---|
| Séjour `max(5, ceil(S/4))` | ⚠️ **Obsolète** (pré-amendement A5 2015). A5 : 5 socles si S ≤ 28 m², 7 sinon. Le moteur sur-chiffre les grands séjours. Jamais NON conforme (toujours ≥ norme), mais commercialement pénalisant |
| Chambre : 3 socles | ✅ Conforme |
| Cuisine : 6 socles + 32A + spécialisés | ✅ Conforme (sauf exception <4 m² non gérée) |
| WC : 0 socle | ✅ Conforme |
| SDB/SDE : 1 socle | ✅ Au-dessus de l'exigence (la norme n'impose pas de socle en SDB) — prudent, pas de contrôle de volume |
| Circuits : 8 socles max / 16A / 1,5 mm² | ✅ Conforme (choix sécuritaire ; la norme autorise aussi 12 socles en 20A/2,5 mm² — option non offerte) |
| Prise double = 2 socles pour le circuit | ✅ Plus strict que l'A5 (qui compte 1 boîte multiple = 1 socle) → jamais sous-dimensionné, parfois un circuit de trop |
| Circuit spécialisé par prise 20A, cuisson 32A dédié | ✅ Conforme |
| RJ45/TV verrouillés par pièce sous badge « Norme » | ⚠️ Excès de zèle : exigence réelle par logement ; le badge 🔒 est trompeur |
| Sèche-serviette et sonnette badgés « Norme » | ❌ Faux : jamais exigés par la NF C 15-100 (règles DSBAT à re-badger 💡) |
| Prises extérieures standard | ⚠️ La pose extérieure exige IP adapté — non modélisé |

**Conclusion conformité** : le moteur ne produit **jamais** un devis sous la norme (tous les écarts sont vers le haut), mais il sur-chiffre les grands séjours, force 6 prises dans les kitchenettes, et étiquette « norme » plusieurs règles maison — risque de crédibilité si un client vérifie.

## 8. Améliorations possibles SANS changer l'architecture

Toutes réalisables dans `normeMin()` / `recoDSBAT()` / la boucle d'agrégation, sans toucher au flux ni aux structures :

1. **Mettre à jour la règle séjour** (A5) : `surface > 28 ? 7 : 5` — une ligne dans `normeMin`.
2. **Exception cuisine < 4 m²** : `if (surface > 0 && surface < 4) min.ELEC_PRISE10 = 3` — une ligne.
3. **Compter `ELEC_PRISET` dans `prises16`** (`+ e.ELEC_PRISET×3`) même si non proposée — filet de sécurité à une ligne (ligne 2120).
4. **Re-badger honnêtement** : sortir sèche-serviette, sonnette, RJ45/TV du `normeMin` vers `recoDSBAT` (ils resteraient pré-cochés en mode standard, mais badgés 💡 Conseil au lieu de 🔒 Norme). Zéro impact prix en mode standard, gain de crédibilité.
5. **Pièces extérieures** : dans la branche `else`, tester `['terrasse','jardin','facade','carport']` → min 0 prise ou prestation dédiée « prise étanche IP44 » à ajouter au catalogue (1 entrée dans `PRIX.electricite_appareillage`).
6. **Dédupliquer/multiplier cuisson** : remplacer `b.cuisson = true` par un compteur (`b.cuisson += e.ELEC_PRISE32`) et `d32 = cCuisson + cIrve` suit déjà — deux lignes.
7. **Alerte prises sans dimensions** : ajouter un contrôle dans `controlesCoherence` : « séjour sans cotes → minimum calculé sur 5 prises par défaut ».
8. **Exploiter `typeLogement`** (désormais en storage) : en locatif, ne pré-appliquer que le mode `normes` par défaut.
9. **Documenter les 4 prises plan de travail** : sans changer le calcul, ajouter la mention dans `explicationsPiece` cuisine (« dont 4 au plan de travail à positionner en visite »).
10. **Offrir l'option circuit 20A/2,5 mm² (12 socles)** : paramètre déjà prévu (`TABLEAU_PARAMS.maxPrisesParCircuit` est configurable) — exposer un réglage sans réécrire le moteur.
