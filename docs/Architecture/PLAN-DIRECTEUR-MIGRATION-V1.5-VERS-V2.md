# Moteur DSBAT — Plan directeur de migration V1.5 → V2

> **Document de stratégie d'architecture. Aucun code, aucune fonctionnalité, aucun document
> existant modifié.** Feuille de route officielle pour transformer *progressivement* le
> logiciel actuel en Moteur DSBAT, sans réécriture, sans interruption, sans perte
> fonctionnelle, et sans jamais changer un prix.

Documents de référence : Constitution · Architecture Générale · Référentiel de Connaissances
(Ch1) · Moteur de Décision (Ch2) · Modèle des objets (Ch3) · Revue d'Architecture n°1 ·
Fondations complémentaires.

---

## Vision générale de la migration

La V1.5 fonctionne et **reste la référence** pendant toute la migration. On ne remplace pas le
logiciel : on **fait pousser le Moteur DSBAT autour de lui**, brique par brique, jusqu'à ce
qu'il prenne le relais couche par couche. Aucune étape ne « coupe » le logiciel ; à tout moment
on peut s'arrêter, et le logiciel continue de fonctionner comme avant.

La stratégie repose sur trois techniques d'architecture éprouvées :

- **L'étranglement progressif** (*strangler*) : on encapsule l'existant derrière des coutures,
  puis on remplace l'intérieur sans que l'extérieur s'en aperçoive.
- **La couture d'abstraction** (*branch by abstraction*) : à chaque frontière (Projet, savoir,
  décision, chiffrage), on insère un point de commutation où cohabitent l'implémentation V1.5
  et la future implémentation V2, choisies par un **interrupteur**.
- **L'exécution en miroir** (*shadow run*) : la V2 calcule **en silence, à côté** de la V1.5,
  et on **compare** les deux résultats. La V1.5 reste seule maîtresse tant que la V2 n'est pas
  strictement identique.

Le juge de paix de toute la migration est un **jeu de cas de référence** (golden master) :
un ensemble de projets représentatifs et leurs résultats attendus (devis, recommandations,
contrôles, prix), **capturés sur la V1.5 d'aujourd'hui**. Aucune migration ne commence avant
qu'il existe.

---

## Principes directeurs

1. **Le filet avant le trapèze.** Le jeu de cas de référence est constitué *en premier*. Il
   fige les devis, recommandations, contrôles et prix actuels comme contrat d'équivalence.
2. **Un seul composant fait autorité à la fois.** À chaque frontière, soit la V1.5 décide, soit
   la V2 — jamais les deux. La seconde tourne en miroir jusqu'à preuve d'équivalence.
3. **Comparer avant de basculer.** On ne bascule un composant que lorsque son résultat est
   *identique* au golden master. Un écart = on reste en V1.5 et on corrige la V2.
4. **Additif d'abord, destructif en dernier.** On ajoute la nouvelle voie (*expand*), on la
   valide en miroir, on bascule, et on ne retire l'ancienne (*contract*) qu'après une période
   de sécurité.
5. **Jamais de changement de prix pendant une migration de structure.** Déplacer *où vit* une
   règle ne change pas *ce qu'elle calcule* (Constitution P3).
6. **Chaque étape est réversible.** Tout passe par un interrupteur ; on peut revenir à l'état
   précédent instantanément.
7. **La migration n'arrête pas le développement métier.** Les moteurs continuent d'être
   améliorés en parallèle ; les deux chantiers avancent ensemble.

---

## Stratégie de cohabitation V1.5 / V2

La cohabitation repose sur des **coutures** posées aux frontières naturelles du système :

- **Couture « Projet »** : un adaptateur construit l'objet *Projet* normalisé (Fondation B) à
  partir de l'état actuel (`chantier`, `piecesSelectionnees`, `metiersActifs`). Au départ, il
  ne fait que *produire en miroir* le Projet ; les moteurs continuent d'utiliser l'ancien état.
- **Couture « Savoir »** : le *Port d'Accès au Savoir* (Fondation C) est introduit comme une
  **façade de lecture** au-dessus des sources existantes (`normes.js`, règles embarquées).
  D'abord il ne fait que transmettre ; plus tard, on remplace ce qu'il y a derrière.
- **Couture « Besoins »** : là où `calculerDevis` assemble aujourd'hui les besoins en dur, on
  insère un point où soit la logique V1.5, soit le *Moteur de Décision* V2 fournit ces besoins.
- **Couture « Chiffrage »** : le *Catalogue* est isolé derrière une abstraction ; les valeurs de
  prix ne bougent pas, seule leur voie d'accès change.

Chaque couture est commandée par un **interrupteur** (par composant), et la V2 y tourne
**en miroir** avant toute bascule. Les deux mondes partagent **les mêmes données** (prix,
savoir) : une seule source de vérité, jamais dupliquée (Constitution P21).

---

## Ordre recommandé des migrations

Du moins risqué (donnée passive) au plus intriqué (calcul), en suivant l'ordre de dépendance
des fondations. **Ce qui doit rester en V1.5 le plus longtemps : l'interface** (rendu du
configurateur, PDF) et **le calcul autoritatif** (`calculerDevis` reste la source de vérité
jusqu'à ce que chaque sous-partie soit prouvée équivalente).

1. **Jeu de cas de référence** *(pré-requis, aucun impact)* — capturer les résultats V1.5.
2. **Vocabulaire / Ontologie (A)** *(risque nul)* — le dictionnaire + une table d'alias reliant
   les codes actuels (`ELEC_PRISE10`, `p.id = 'sdb'`…) aux codes canoniques. Donnée passive :
   rien ne la consomme encore de façon contraignante.
3. **Contrat du Projet (B)** *(risque faible)* — l'adaptateur produit le Projet en miroir ; on
   compare qu'il représente fidèlement l'état actuel. Les moteurs ne changent pas encore.
4. **Référentiel + Port (Ch1 / C)** *(risque faible)* — externaliser d'abord le savoir le plus
   *documentaire* et stable : `normes.js` → fiches *Norme*. Le Port devient l'entrée unique de
   lecture, d'abord en simple relais.
5. **Journal de Décision (D)** *(risque nul)* — branché en **observateur passif** : il
   enregistre le raisonnement déjà à l'œuvre, sans rien changer au résultat.
6. **Moteur de Décision (Ch2) en miroir** *(risque maîtrisé)* — brancher le moteur de
   recommandations existant derrière le Port, puis extraire *une famille de règles à la fois*
   (minimums normatifs, implications) vers des fiches *Règle métier*, en double exécution.
7. **Connexion moteur par moteur** — un moteur métier à la fois reçoit ses besoins du Moteur de
   Décision au lieu de les recalculer en dur (électricité d'abord, la mieux outillée ; puis
   VMC, plomberie, chauffage…). Chacun validé avant le suivant.
8. **Séparation Catalogue / moteurs (prix.js)** — scinder les données `PRIX` des sous-moteurs,
   brancher le chiffrage derrière l'abstraction Catalogue. Prix inchangés.
9. **Bascule du calcul autoritatif** — quand tout concorde, l'Orchestrateur V2 devient la source
   de vérité ; `calculerDevis` V1.5 est conservé en secours, puis retiré tardivement.

**Où intégrer les grands chantiers annexes** *(question du « quand »)* : jamais dans les
fondations — toujours branchés sur une couture déjà posée, donc planifiés selon la *maturité de
la couture dont ils dépendent* :

| Chantier | Se branche après | Pourquoi |
|----------|------------------|----------|
| **Temps de pose** | Séparation du Catalogue (étape 8) | Simple attribut de référence ; additif |
| **Catalogues fournisseurs multiples** | Catalogue derrière abstraction + profil | On change le catalogue actif, pas les moteurs |
| **API** | Contrat Projet + Orchestrateur stables | L'API est un *appelant* de plus du même cœur |
| **Franchisés** | Multi-catalogue + profil + routage du Port | Une franchise = un profil + une sélection savoir/catalogue |
| **IA** | Journal de Décision en place | Elle lit décisions + journal ; elle n'écrit jamais de savoir (P15/P19) |

---

## Jalons de validation

Chaque jalon a **un critère de sortie unique : « golden master identique »**. Tant qu'il n'est
pas atteint, on reste au jalon précédent.

- **J0 — Fondations validées** *(fait)* **+ jeu de cas de référence figé.**
- **J1 — Ontologie + alias** en place, aucun impact sur les calculs.
- **J2 — Projet produit en miroir**, comparé fidèle à l'état V1.5.
- **J3 — Port de lecture** opérationnel + normes externalisées.
- **J4 — Journal passif** branché, capturant toute la chaîne de raisonnement.
- **J5 — Premier moteur connecté** (électricité) au Moteur de Décision → **devis identique**.
- **J6 — Deuxième moteur connecté** (VMC / plomberie) → identique.
- **J7 — … itération métier par métier …** chacun validé isolément.
- **J8 — Catalogue séparé**, chiffrage derrière abstraction, prix inchangés.
- **J9 — Bascule autoritative V1.5 → V2** (interrupteur), V1.5 conservée en secours.
- **J10 — Retrait progressif** du code V1.5 devenu inutile, après période de sécurité prolongée.

Chaque jalon est **réversible** : s'il échoue, on revient au précédent sans dommage.

---

## Gestion des risques

**Risques techniques.**
- *Divergence subtile des montants* (arrondis, ordre des opérations) → golden master +
  comparaison exhaustive + déterminisme (Constitution P17) rendent tout écart visible.
- *Couplage caché aux variables globales* (`window.__*`) → cartographier les dépendances avant
  d'extraire un composant ; poser la couture avant de toucher au contenu.
- *Double source de vérité* → interdite (P21) : un seul composant autoritatif à la fois.

**Risques organisationnels.**
- *Migration qui s'éternise* → jalons courts, chacun livrant une valeur ; migration menée *en
  parallèle* du développement métier, sans le geler.
- *Gouvernance du savoir non prête* → nommer le responsable du Référentiel **avant J3**.
- *Tentation du big-bang* → interdite par la Constitution ; le plan n'avance que par étapes
  réversibles.

**Risques fonctionnels.**
- *Perte de fonctionnalité* → le golden master couvre devis **et** recommandations **et**
  contrôles **et** prix ; rien n'est retiré avant équivalence prouvée.
- *Écart dans les explications* → le Journal est validé en observateur passif avant de remplacer
  les explications actuelles.

---

## Conditions de réussite

Le jeu de cas de référence existe et fait autorité avant toute migration. Un seul composant fait
autorité à la fois, la V2 tournant en miroir jusqu'à équivalence. Aucun prix n'est modifié
pendant une migration de structure. Chaque étape est derrière un interrupteur et réversible. La
gouvernance du Référentiel est active dès l'externalisation du savoir. Enfin, à chaque étape, une
seule question tranche : *« cette étape respecte-t-elle la Constitution ? »* — sinon, elle est
remise en question.

---

## Compatibilité avec la Constitution

Ce plan est **l'application opérationnelle de la Constitution** : il extrait le savoir des
moteurs (P1, P2) sans jamais laisser le prix influencer une décision ni dupliquer une donnée
(P3, P21) ; il installe le Journal comme brique de traçabilité (P4, P11) ; il repousse
l'interface en dernier (P16) ; il s'appuie sur le déterminisme pour comparer (P17) ; il exige la
validation du savoir avant activation (P19). Le big-bang, contraire à la philosophie de la
Constitution, est explicitement proscrit. Aucun principe n'est enfreint.

---

## Compatibilité avec la V1.5

La V1.5 **reste opérationnelle et autoritative pendant toute la migration**. Les moteurs
existants continuent de tourner et d'être améliorés ; les nouvelles couches poussent à côté, en
miroir, sans droit de véto sur le résultat tant qu'elles ne sont pas prouvées identiques. À
aucun moment le logiciel n'est « en travaux » : chaque jalon laisse un système qui fonctionne
exactement comme avant, avec une brique de plus prête à prendre le relais.

---

## Conclusion

Cette feuille de route permet de faire évoluer DSBAT vers son moteur d'expertise **sans
réécriture, sans interruption et sans perte fonctionnelle**, pendant les années nécessaires. Sa
sécurité tient à trois idées simples : **un filet** (le jeu de cas de référence), **une
discipline** (un seul composant autoritatif, comparé avant bascule) et **une réversibilité**
(tout derrière un interrupteur). Elle transforme une migration risquée en une **suite d'étapes
prudentes**, chacune vérifiable, arrêtable et annulable — exactement ce qu'exige un moteur conçu
pour durer dix ans ou plus.

*— Plan directeur de migration V1.5 → V2. Feuille de route officielle du Moteur DSBAT.*
