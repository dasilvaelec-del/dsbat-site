# MISSION 003 — Vérification métier du calcul des prises vs NF C 15-100
**Date : 2026-07-28 · Audit pur, aucun code modifié.**
Référence code : `normeMin()` + `recoDSBAT()` + `getElecPourPiece()` (devis-configurateur.html) · agrégation circuits ligne 2120 · catalogue prix.js.
Référence norme : NF C 15-100 amendement A5 (2015), toujours en vigueur.

---

## 1. Tableau comparatif pièce par pièce

| Pièce | Ce que calcule le configurateur (verrouillé 🔒) | Ce qu'impose la NF C 15-100 (A5) | Différences | Verdict |
|---|---|---|---|---|
| **Salon / Séjour** | `max(5, ceil(S/4))` prises 16A + 1 RJ45 + 1 TV | **5 socles si S ≤ 28 m², 7 si S > 28 m²**. RJ45 : exigence par logement (2 juxtaposés près de la prise TV du séjour), pas par pièce | Règle pré-A5 : un séjour de 40 m² se voit imposer 10 prises au lieu de 7 (**sur-chiffrage ~3 prises ≈ 300 €**). Jamais sous la norme. Sans dimensions saisies → 5 (conforme ≤28 m²) | ⚠️ Conforme mais obsolète |
| **Chambre** | 3 prises + 1 RJ45 + 1 TV | **3 socles**. RJ45/TV : par logement, pas par chambre | Prises exactes ✓. RJ45+TV verrouillés en trop (règle DSBAT badgée « norme ») | ✅ Conforme (sur-équipé) |
| **Cuisine** | 6 prises 16A + 1 prise 32A + 2 prises 20A | **6 socles dont 4 au plan de travail** (3 socles si S < 4 m²) + circuit cuisson 32A + min. 3 circuits spécialisés par logement | Exception kitchenette < 4 m² non gérée (sur-chiffrage studio). Les « 4 au plan de travail » non distingués. 2 cuisines → 1 seul circuit 32A au tableau (booléen) | ✅ Conforme, exception manquante |
| **Salle de bains** | 1 prise + liaison équipotentielle + sèche-serviette | **Aucun socle obligatoire** (autorisé hors volumes). Liaison équipotentielle : ✓ obligatoire. Sèche-serviette : jamais exigé | Prise et sèche-serviette = règles DSBAT badgées 🔒 « norme » à tort. Aucun contrôle des volumes 0/1/2 ni IPX | ⚠️ Sur-équipé + badge trompeur |
| **WC** | 0 prise (éclairage seul) | Aucun socle exigé | Aucune | ✅ Conforme |
| **Couloir** | 1 prise (branche `else` générique) | 1 socle dans les circulations et locaux ≥ 4 m² | Conforme ; pas de condition de surface (couloir minuscule = quand même 1 prise, sans conséquence) | ✅ Conforme |
| **Entrée** | 1 prise + sonnette | 1 socle (circulation). Sonnette : jamais exigée | Sonnette = règle DSBAT badgée « norme » | ✅ Conforme + badge trompeur |
| **Cellier** | **Le type n'existe pas** dans `PIECES_DEF` (le plus proche : « Cave / Buanderie ») → 1 prise via `else` | 1 socle si ≥ 4 m² | Pas de pièce dédiée ; le client caserait un cellier dans « Cave / Buanderie » | ⚠️ Type absent |
| **Garage** | 1 prise 16A standard | Pas de minimum dans le tableau d'équipement minimal (recommandation : 1 socle + éclairage) | Le moteur impose plus que la norme ; pas de considération d'usage (congélateur → circuit dédié conseillé, IRVE si VE) | ✅ Au-dessus de la norme |
| **Buanderie** | Fusionnée avec Cave (« Cave / Buanderie ») → 1 prise 16A. **`getElecPourPiece('cave')` ne propose NI prise 20A ni sortie câble** | Le lave-linge exige un **circuit spécialisé** (parmi les 3 minimum du logement) | **Trou réel** : la plomberie propose « Raccordement lave-linge » en cave, mais l'électricité ne permet même pas d'y ajouter la prise spécialisée correspondante. Machine à laver branchée sur circuit standard = non conforme | ❌ Non-conformité possible |
| **Bureau** | 1 prise verrouillée (`else`) + conseils retirables (+2 prises, +1 RJ45 en mode standard) | Si le bureau est une **pièce principale** (pièce de vie), la norme le traite comme une chambre → **3 socles minimum** | **Trou réel** : en mode « Mise aux normes » ou si le client retire les conseils, un bureau part avec 1 prise < 3 exigées | ❌ Non-conformité possible |
| **Extérieur** (terrasse, jardin, façade, carport) | 1 prise 16A **intérieure standard, verrouillée** (branche `else` non filtrée) | **Aucun socle exigé**. Si installé : IP24/IP44, fixation et protection adaptées | Triple problème : minimum imposé sans fondement, produit inadapté (pas de variante étanche au catalogue configurateur), prix faux (pose extérieure ≠ pose intérieure) | ❌ Règle erronée |

## 2. Cas particuliers oubliés (synthèse)

1. **Séjour > 28 m²** : seuil A5 à 7 socles non implémenté (règle 1/4 m² dépassée depuis 2015).
2. **Cuisine < 4 m²** : tolérance 3 socles non gérée → sur-chiffrage systématique des studios (la typologie T1 ajoute d'office une cuisine à 6 prises + 32A + 2×20A).
3. **Bureau pièce principale** : minimum 3 socles non garanti.
4. **Lave-linge hors cuisine** : aucun circuit spécialisé proposable en cave/buanderie ; idem sèche-linge, congélateur, four indépendant hors cuisine.
5. **Garantie « 3 circuits spécialisés minimum par logement »** : jamais vérifiée globalement — elle n'est vraie que si une cuisine est configurée.
6. **GTL/ETEL** : la norme demande 2 socles 16A non commandés dans la gaine technique — inexistants dans le moteur (comme la GTL elle-même).
7. **RJ45 par logement** : l'exigence réelle (2 RJ45 juxtaposés au séjour près de la TV, coffret de communication) n'est pas modélisée ; à la place, RJ45 verrouillé par pièce et **coffret VDI jamais chiffré**.
8. **Extérieur** : pas de prise étanche IP44 au configurateur, pas de circuit dédié extérieur.
9. **Volumes SDB** et hauteurs d'implantation : non contrôlés.
10. **Prise triple** non comptée dans les circuits ; prise commandée absente du configurateur (déjà relevé en Mission 002).

## 3. Améliorations possibles (sans changer l'architecture)

| # | Amélioration | Effort | Impact |
|---|---|---|---|
| 1 | Séjour : `S > 28 ? 7 : 5` dans `normeMin` | 1 ligne | Devis plus justes sur grands séjours (compétitivité) |
| 2 | Cuisine : `S < 4 → 3 socles` | 1 ligne | Studios mieux chiffrés |
| 3 | Bureau : `min.ELEC_PRISE10 = 3` (aligné chambre) | 1 ligne | Supprime une non-conformité |
| 4 | Ajouter `ELEC_PRISE20` aux prestations de `cave` (+ garage) dans `getElecPourPiece` | 1 ligne | Supprime la non-conformité lave-linge |
| 5 | Extérieur : exclure `terrasse/jardin/facade/carport` du `else` (min 0) + créer un poste « prise étanche IP44 » au catalogue | 3–5 lignes + 1 entrée catalogue | Supprime la règle erronée |
| 6 | Re-badger sèche-serviette / sonnette / RJ45-TV en 💡 Conseil DS.BAT | déplacement normeMin→recoDSBAT | Crédibilité (aucun impact prix en mode standard) |
| 7 | Contrôle global « ≥ 3 circuits spécialisés par logement » dans `renderPhase3` (alerte non bloquante, comme la cohérence) | ~10 lignes | Filet de conformité logement |
| 8 | Compter `ELEC_PRISET` dans `prises16` | 1 ligne | Robustesse future |
| 9 | Ajouter un type de pièce « Cellier / Buanderie » distinct de Cave | 1 entrée `PIECES_DEF` | UX + règles ciblées |
| 10 | Mentionner « dont 4 au plan de travail » dans `explicationsPiece` cuisine | 1 ligne | Pédagogie visite technique |

## 4. Note du moteur de calcul des prises : **6/10**

**Justification :**

**Points forts (ce qui vaut 6)** : mécanisme de plancher verrouillé excellent et unique sur ce type d'outil (impossible de vendre sous la norme dans les pièces couvertes), recalcul dynamique propre, séparation norme/conseils avec traçabilité (`_recoApplique`), explications en français à chaque niveau, agrégation vers les circuits cohérente et conservatrice (prise double = 2 socles, 8/circuit), chambre/cuisine/WC/circulations exacts.

**Ce qui empêche d'aller plus haut** : 2 non-conformités réelles possibles (bureau à 1 prise, lave-linge sans circuit spécialisé en buanderie), 1 règle erronée (prise intérieure verrouillée en extérieur), 1 règle obsolète depuis 2015 (séjour 1/4 m²), l'exigence « 3 circuits spécialisés/logement » et la GTL non vérifiées, 4 règles maison badgées « norme » à tort, et l'exception kitchenette absente. Aucun de ces points n'est architectural : ils tiennent tous dans `normeMin`, `getElecPourPiece` et une alerte de cohérence.

**Réponse à la question posée** : le moteur est **presque toujours au-dessus de la norme** (donc sûr pour le client final dans 90 % des cas), mais il n'est **ni strictement conforme A5, ni complet** : conforme ≠ à jour (séjour), et complet ≠ couvert (bureau, buanderie, extérieur, GTL, spécialisés hors cuisine). Avec le lot de correctifs du §3 (≈ 20 lignes au total), la note passerait à 8,5/10 ; le 10/10 exigerait le bilan de puissance et l'affectation circuits→différentiels, qui relèvent du futur moteur métier.
