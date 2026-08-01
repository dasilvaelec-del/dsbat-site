# Moteur DSBAT V2 — Chapitre 3 : Modèle des objets du bâtiment

> **Conception d'architecture conceptuelle uniquement.** Aucun code, aucun moteur/calcul
> modifié, aucun chapitre validé touché. Ce chapitre donne corps à la **Fondation A
> (Ontologie)** : il définit le langage commun d'objets partagé par le Référentiel, le
> Moteur de Décision, les moteurs métier, les API, le mobile, l'IA, l'audit et les franchises.

---

## Vision générale

Modéliser DSBAT, c'est décrire **quatre mondes distincts** qui coopèrent sans se confondre :
le **bâtiment réel** (ce qui existe et ce qu'on va faire), le **traitement** (ce que le moteur
manipule pour raisonner), la **décision** (ce que le moteur conclut et pourquoi), et le
**savoir** (les définitions qui font autorité).

La colonne vertébrale du modèle n'est pas la longue liste des objets, mais un petit nombre
d'**abstractions** (Paroi, Ouverture, Équipement, Réseau…) que l'on **spécialise** pour chaque
métier. Ajouter un métier, un équipement ou une réglementation, c'est ajouter une
**spécialisation** ou une **fiche** — jamais modifier une abstraction. C'est ce qui rend le
modèle durable.

Le modèle est **agnostique** : il ne contient ni prix, ni fournisseur, ni entreprise. Ces
notions vivent ailleurs (catalogue, référentiel, profil). Le modèle du bâtiment ne change donc
jamais quand on ajoute un fournisseur ou une franchise.

---

## Principes de modélisation

1. **Type vs instance.** Le savoir définit des **types** (« la Douche à l'italienne implique
   une étanchéité ») ; le projet manipule des **instances** (« la douche de la SDB-1 »). Un
   même mot peut exister des deux côtés (ex. *Recommandation-type* dans le savoir,
   *Recommandation émise* dans la décision) : on les nomme distinctement.
2. **Abstraction avant énumération.** On modélise d'abord des familles (Paroi, Équipement,
   Réseau), puis leurs spécialisations. Les abstractions sont stables ; les spécialisations
   sont extensibles.
3. **Composition privilégiée à l'héritage profond.** Un objet *contient* ou *est desservi par*
   d'autres objets plutôt que d'hériter de longues chaînes. Un attribut `type` distingue les
   variantes légères.
4. **Trois natures de relation** clairement séparées : **composition** (contient),
   **desserte** (alimente / dessert), **référence** (concerne / justifie).
5. **Aucun prix, aucun fournisseur dans le modèle** (Constitution P3, P21).
6. **Vocabulaire officiel unique** : chaque objet porte un code canonique de la Fondation A
   (Constitution P10).

---

## Classification des objets

Quatre catégories, explicitement séparées :

| Catégorie | Nature | Exemples | Rôle |
|-----------|--------|----------|------|
| **Objets physiques** | Le bâtiment réel (instances) | Logement, Pièce, Paroi, Ouverture, Escalier, Revêtement, Support, Équipement, Réseau, Organe de distribution, Composant | Décrire ce qui existe et ce qu'on réalise |
| **Objets logiques** | Abstractions de traitement | Projet/Dossier, Zone, Besoin, Prestation, Hypothèse, Contrainte, Résultat | Structurer le raisonnement et porter le contrat |
| **Objets de décision** | Conclusions du raisonnement | Décision, Recommandation émise, Contrôle réalisé, Alerte, Conflit résolu, Journal de décision, Signaux de confiance | Porter les conclusions **et leur trace** |
| **Objets de connaissance** | Définitions faisant autorité (types) | Fiche → Norme, Règle métier, Recommandation-type, Option-type, Interaction métier | Définir les règles, sans instance ni prix |

---

## Description des objets principaux

Format compact : *rôle · propriétés principales (haut niveau) · relations · cycle de vie*.

### Objets physiques

**Logement / Bâtiment** — le contenant bâti. *Propriétés* : type, surface, ancienneté.
*Relations* : contient des Pièces. *Cycle* : existant → rénové.

**Pièce** — unité fonctionnelle (cuisine, SDB, séjour…). *Propriétés* : type, dimensions,
usage, caractère humide. *Relations* : contient Parois, Ouvertures, Équipements ; appartient à
des Zones. *Cycle* : existante → reconfigurée.

**Paroi** *(abstraction)* → **Mur**, **Sol**, **Plafond**, **Cloison**. *Rôle* : surface
délimitant une pièce. *Propriétés* : type, surface, orientation. *Relations* : porte un
Support et reçoit des Revêtements ; peut être percée par des Ouvertures. *Cycle* : conservée /
déposée / créée / modifiée.

**Ouverture** *(abstraction)* → **Fenêtre**, **Porte**, **Baie**. *Rôle* : percement d'une
paroi. *Propriétés* : type, dimensions. *Relations* : appartient à une Paroi ; réduit la
surface utile de revêtement.

**Escalier** — circulation verticale. *Relations* : relie des Zones/niveaux.

**Support** — l'état du subjectile sous un revêtement. *Rôle* : conditionne la préparation.
*Relations* : porté par une Paroi ; consommé par un Revêtement.

**Revêtement** — couche de finition (faïence, peinture, parquet, carrelage…). *Relations* :
appliqué sur une Paroi, au-dessus d'un Support. *Cycle* : posé sur support préparé.

**Équipement** *(abstraction — appareil terminal)* → **Douche** (dont *à l'italienne*),
**Receveur**, **Baignoire**, **WC** (dont *suspendu*), **Lavabo/Vasque**, **Évier**,
**Radiateur/Émetteur**, **Ballon**, **Bouche/Entrée d'air**, **Meuble**, **Point lumineux**,
**Prise**… *Rôle* : appareil desservi par un ou plusieurs réseaux. *Relations* : installé dans
une Pièce ; **requiert** un Réseau (eau, évacuation, circuit) ; peut **impliquer** d'autres
objets (une Douche italienne implique étanchéité + caniveau).

**Réseau / Installation** *(abstraction)* → **Circuit électrique**, **Canalisation** (EF/ECS),
**Évacuation**, **Gaine de ventilation**. *Rôle* : achemine énergie/fluide/air. *Relations* :
**alimente/dessert** plusieurs Équipements ; **piloté** par un Organe de distribution.

**Organe de distribution** *(abstraction)* → **Tableau électrique**, **Nourrice**, **Caisson
VMC**. *Rôle* : point central d'un réseau. *Relations* : pilote des Réseaux/Circuits ; a une
capacité (limite structurante). *Cycle* : existant → remplacé / créé.

**Composant** — élément unitaire d'un réseau ou d'un organe (différentiel, robinet d'arrêt,
manchon…). *Relations* : appartient à un Réseau ou un Organe.

### Objets logiques

**Projet (Dossier)** — objet **racine** et **contrat unique** (Fondation B). *Rôle* : contient
la représentation physique, porte les entrées, les hypothèses, les décisions et les résultats.
*Cycle* : entrée figée → décisions ajoutées → résultats ajoutés (append-only).

**Zone** — regroupement logique de pièces (ex. « zone humide », « niveau R+1 »). *Rôle* :
appliquer des règles ou contraintes à un ensemble. *Relations* : regroupe des Pièces.

**Besoin** — exigence abstraite déclenchée par une décision (ex. « étanchéité sous
carrelage »). *Rôle* : exprimer *ce qu'il faut* sans dire *avec quoi* ni *combien*. *Relations* :
produit par une Décision ; satisfait par une Prestation. *Cycle* : déclenché → satisfait.

**Prestation** — ce que fera un moteur métier pour satisfaire un besoin (quantité, ouvrage).
*Relations* : répond à un Besoin ; alimente un Résultat. *Note* : le **prix** lui est attaché
plus tard par le catalogue — jamais ici.

**Hypothèse** — valeur retenue faute de donnée (ex. hauteur 2,5 m). *Rôle* : combler une
inconnue **en la signalant**. *Relations* : rattachée à un objet physique ; tracée au Journal.

**Contrainte** — limitation du contexte (accès, logement occupé, copropriété). *Relations* :
s'applique au Projet, à une Zone ou à une Pièce ; influence les décisions.

**Résultat** — agrégat des prestations (et, en aval, des montants). *Rôle* : porter la sortie
finale. *Relations* : composé de Prestations.

### Objets de décision

**Décision** — conclusion du raisonnement (« proposer une étanchéité »). *Propriétés* :
déclencheurs (faits), fondements (fiches + versions), priorité appliquée. *Relations* :
**concerne** plusieurs objets ; **fondée sur** plusieurs Fiches ; **produit** des Besoins.
*Cycle* : produite → immuable → tracée.

**Recommandation émise** — instance d'une Recommandation-type appliquée au projet. *Relations* :
liée à des Décisions et à des objets ; **jamais** appliquée automatiquement (Constitution P18).

**Contrôle réalisé** — vérification effectuée. *Propriétés* : gravité, résultat. *Relations* :
**porte sur** plusieurs objets ; peut produire une Alerte.

**Alerte** — signalement d'incohérence, d'oubli ou de conflit. *Relations* : issue d'un
Contrôle ou d'un Conflit.

**Conflit résolu** — trace d'une contradiction et de son départage. *Relations* : entre des
Fiches / Décisions.

**Journal de décision** — trace complète du raisonnement (Fondation D). *Relations* : rangé
dans `Projet.decisions` ; référence Décisions, Fiches (versions), Conflits.

**Signaux de confiance** — métadonnées brutes (inconnues, conflits, part de fiches validées).
*Rôle* : préparer le futur indice de confiance, sans l'agréger.

### Objets de connaissance (types)

**Fiche** *(abstraction)* → **Norme**, **Règle métier**, **Recommandation-type**,
**Option-type**, **Interaction métier**. *Rôle* : définir une exigence, une implication, un
conseil, une option ou un lien inter-métiers. *Propriétés* : identifiant pérenne, condition
d'application, justification, source, version, état. *Relations* : citée par des Décisions ;
peut référencer d'autres Fiches. *Cycle* (Ch1) : brouillon → active → dépréciée → archivée.

---

## Relations entre les objets

Trois natures de relation, à ne pas mélanger :

- **Composition** (▷ contient) : structure le réel.
- **Desserte** (→ alimente / dessert) : relie réseaux et équipements.
- **Référence** (⋯ concerne / justifie) : relie décisions, contrôles et savoir aux objets.

```
Projet ▷ Logement ▷ Pièce ▷ Paroi ▷ Revêtement
                     │        └─ Support
                     ├─ Ouverture (perce la Paroi)
                     ├─ Équipement ──requiert──► Réseau ──desservi/piloté──► Organe de distribution
                     └─ appartient à ▷ Zone

Décision ⋯concerne⋯► {Pièce, Équipement, Paroi…}
Décision ⋯fondée sur⋯► Fiche(s) {Norme, Règle métier}
Décision ──produit──► Besoin ──satisfait par──► Prestation ──compose──► Résultat
Recommandation émise ⋯liée à⋯► Décision(s) + objets
Contrôle réalisé ⋯porte sur⋯► plusieurs objets ──► Alerte
Interaction métier ⋯relie⋯► deux métiers / objets (ex. Plomberie ↔ Carrelage)
Journal ⋯trace⋯► Décisions + Fiches (versions) + Conflits
```

**Cardinalités clés** : un Projet contient plusieurs Pièces (1..*) ; une Pièce plusieurs
Parois (1..*) ; une Paroi plusieurs Revêtements (0..*) ; une Installation alimente plusieurs
Équipements (1..*) ; une Décision concerne plusieurs objets et s'appuie sur plusieurs Fiches
(*..*) ; une Recommandation peut être liée à plusieurs Décisions (*..*) ; un Contrôle porte sur
plusieurs objets (*..*). Le graphe de **composition** est un arbre (pas de cycle) ; les
relations de **référence** sont *m:n* mais ne créent pas de dépendance de calcul circulaire.

---

## Responsabilités de chaque catégorie

- **Objets physiques** : *décrire le réel* et porter les faits mesurables. Ils ne décident
  rien, ne calculent rien, ne connaissent aucun prix.
- **Objets logiques** : *structurer le traitement* (regrouper, poser hypothèses et contraintes,
  porter besoins, prestations et résultats). Ils orchestrent la donnée, pas la connaissance.
- **Objets de décision** : *porter les conclusions et leur trace*. Ils sont produits, jamais
  fournis par l'interface ; ils ne contiennent aucun prix (Constitution P3, P11).
- **Objets de connaissance** : *définir les types et les règles*. Ils ne contiennent ni
  instance de projet, ni prix, et sont la propriété exclusive du Référentiel (Constitution P1).

---

## Compatibilité avec les Chapitres 1 et 2

Les **objets de connaissance** sont exactement les fiches du **Chapitre 1** (Norme, Règle
métier, Recommandation-type, Option-type, Interaction). Les **objets de décision** sont
exactement les sorties du **Chapitre 2** (Décision, Recommandation émise, Contrôle, Conflit,
Journal, signaux de confiance). Les **objets physiques et logiques** peuplent le **Projet
(Fondation B)**, exprimé dans le **vocabulaire (Fondation A)**, et interrogé via le **Port
(Fondation C)**. Le modèle ne fait donc qu'**incarner** les fondations validées, sans en
contredire une ligne.

---

## Compatibilité avec la Constitution

- **P1/P2** : le savoir n'existe que comme *objets de connaissance* (types), séparés des
  instances de projet.
- **P3/P21** : aucun objet ne porte de prix ni de fournisseur ; une seule source de vérité par
  donnée grâce à la séparation type/instance.
- **P4/P11** : Décision et Journal portent déclencheurs, fondements et trace.
- **P10** : chaque objet porte un code canonique unique.
- **P12/P13** : Recommandation-type, Option-type et Norme sont des objets **distincts**, jamais
  confondus.
- **P16** : le modèle est purement conceptuel, indépendant de toute technologie.
- **P18** : la *Recommandation émise* est une conclusion proposée, jamais appliquée d'office.

Le modèle passe la grille de conformité de la Constitution.

---

## Évolutivité

- **Nouveau corps de métier** → nouvelles **spécialisations** d'Équipement / Réseau / Paroi +
  nouvelles Fiches. Les abstractions ne bougent pas.
- **Nouvel équipement** → nouvelle spécialisation d'Équipement.
- **Nouvelle réglementation** → nouvelle Fiche *Norme* (Ch1), aucune touche au modèle d'objets.
- **Plusieurs fournisseurs / entreprises / franchises** → traités par le **catalogue**, le
  **référentiel** et le **profil**, **hors** du modèle du bâtiment. Le modèle, agnostique, reste
  identique. C'est l'application du principe *ouvert à l'extension, fermé à la modification*.

---

## Risques éventuels

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| **Sur-modélisation** (trop d'objets) | Complexité, lenteur de conception | Peu d'abstractions, spécialisations légères via attribut `type` |
| **Héritage trop profond** | Rigidité | Composition + `type` plutôt que longues chaînes d'héritage |
| **Confusion type / instance** | Savoir et projet mêlés | Nommage distinct (Recommandation-type vs émise) |
| **Projet « god-object »** | Couplage, illisibilité | Agrégat à sous-parties claires, sections séparées (Fondation B) |
| **Fuite de prix/fournisseur dans le modèle** | Rupture d'agnosticisme | Interdit : prix/fournisseur hors modèle (catalogue) |
| **Détail prématuré des propriétés** | Fige trop tôt | Rester au niveau conceptuel, zones d'extension |

---

## Recommandations

1. **Adopter la colonne vertébrale d'abstractions** (Paroi, Ouverture, Équipement, Réseau,
   Organe de distribution) et la traiter comme stable ; n'étendre que par spécialisation.
2. **Imposer la séparation type / instance** dans tout le vocabulaire.
3. **Garder le modèle agnostique** : aucun prix, aucun fournisseur, aucune entreprise.
4. **Valider le modèle sur le lot pilote** (ex. une SDB avec douche italienne : Pièce + Parois
   + Support + Revêtements + Équipement Douche + Receveur + Réseau d'évacuation + Décision
   d'étanchéité + Contrôle de pente + Journal) avant d'aller plus loin.
5. **Réserver des zones d'extension** sur chaque objet, sans les détailler maintenant.
6. **Geler l'ensemble des abstractions** une fois validé ; laisser les spécialisations ouvertes.

---

## Conclusion

**Le modèle proposé constitue-t-il une base suffisamment robuste pour représenter durablement
tous les métiers du bâtiment traités par DSBAT, ainsi que leurs futures évolutions ?**

### ✅ OUI

Justification. Le modèle repose sur un **petit socle d'abstractions** (Paroi, Ouverture,
Équipement, Réseau, Organe) que chaque métier **spécialise** sans jamais modifier le socle :
c'est la garantie d'ajouter électricité, plomberie, carrelage — ou un métier futur — par
**extension**, pas par refonte. La **séparation en quatre catégories** (physique / logique /
décision / connaissance) et la **distinction type / instance** évitent les confusions qui
minent les modèles à long terme. Le modèle est **agnostique** (ni prix, ni fournisseur, ni
entreprise), ce qui lui permet d'absorber le multi-fournisseur et le multi-franchise **sans
changer**. Enfin, il **incarne fidèlement** les Chapitres 1 et 2 et **respecte la Constitution**
sur tous ses points applicables. Sous réserve de le valider sur le lot pilote et d'en geler les
abstractions, il constitue une base durable pour représenter le domaine du bâtiment DSBAT
pendant de nombreuses années.
