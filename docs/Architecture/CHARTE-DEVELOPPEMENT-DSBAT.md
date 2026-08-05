# Charte officielle de développement DSBAT

> **Document de gouvernance du développement.** Il ne décrit pas *comment le logiciel
> fonctionne* (rôle de l'Architecture Générale), mais *comment le logiciel doit évoluer*.
> À respecter par **toute personne et toute IA** participant au projet. *Aucun code, aucun
> document existant modifié.*

Place dans la hiérarchie des textes :

- **La Constitution** dit *quoi* et *pourquoi* (principes intemporels). Elle est suprême.
- **La présente Charte** dit *comment on travaille* (règles de contribution). Elle sert la
  Constitution.
- **Le Plan Directeur de Migration** dit *dans quel ordre* on avance (trajectoire).

En cas de conflit : la Constitution prime sur la Charte, qui prime sur toute pratique.

---

## Vision

Le Moteur DSBAT vivra et évoluera pendant de nombreuses années, sous la main de contributeurs
multiples — humains comme IA. Le risque n'est pas l'immobilité : c'est la **dérive**, la lente
érosion de l'architecture sous la pression des ajouts pressés. Cette Charte existe pour qu'après
des centaines d'évolutions, le logiciel ait toujours **la même architecture cohérente**.

Sa promesse : rendre chaque évolution **vérifiable, réversible et traçable**, afin que la
cohérence ne dépende jamais de la vigilance d'une seule personne, mais de règles partagées.

---

## Principes de développement

1. **Toute évolution respecte la Constitution.** Elle est le juge suprême de toute contribution.
2. **Aucune fonctionnalité ne contourne l'architecture.** On passe toujours par les couches et
   les coutures prévues ; jamais par un raccourci direct entre deux couches éloignées.
3. **Toute nouvelle règle métier est intégrée au Référentiel de Connaissances** — jamais codée
   en dur dans un moteur.
4. **Les moteurs exploitent le savoir, ils ne le deviennent jamais.** Un moteur qui « sait »
   est un défaut à corriger.
5. **Toute fonctionnalité a une responsabilité unique et clairement située.** On doit pouvoir
   nommer la couche à laquelle elle appartient.
6. **Toute migration est progressive.** Aucune réécriture globale, jamais.
7. **Toute évolution est réversible.** Derrière un interrupteur, additive d'abord, destructive en
   dernier.
8. **Toute évolution est testable.** Contre le Golden Master et des cas dédiés.
9. **Le Golden Master reste la référence** tant que la migration correspondante n'est pas validée.
10. **Toute décision importante est documentée** (registre des décisions d'architecture).

*Règles transverses* : une seule source de vérité par donnée (aucune duplication) ; les valeurs
de prix ne sont jamais touchées par une évolution de structure ; le déterminisme du raisonnement
est préservé (mêmes entrées ⟹ mêmes sorties).

---

## Principes de migration

- **Le filet avant le trapèze** : le Golden Master existe avant toute migration.
- **Un seul composant fait autorité à la fois** ; la nouvelle version tourne *en miroir*
  jusqu'à équivalence prouvée.
- **Comparer avant de basculer** : on ne bascule qu'avec un résultat identique au Golden Master.
- **Élargir → valider → basculer → contracter** : on ajoute la nouvelle voie, on la valide, on
  bascule, et on ne retire l'ancienne que tardivement.
- **Poser la couture avant de toucher au contenu** : on isole une frontière avant d'en remplacer
  l'intérieur.
- **Jamais de changement de prix dans une migration de structure** : déplacer *où vit* une règle
  ne change pas *ce qu'elle calcule*.
- **Chaque étape franchit un jalon** dont le critère de sortie est « Golden Master identique ».

---

## Principes de validation

- **Le Golden Master est le contrat d'équivalence** : devis, recommandations, contrôles et prix.
- **Deux natures de test, toujours** : la **non-régression** (rien ne change là où rien ne doit
  changer) et la **validation de l'intention** (le comportement voulu est bien présent, et lui
  seul).
- **Comparaison systématique avant/après** : tout écart non voulu bloque l'évolution.
- **Une évolution n'est « faite » que lorsqu'elle est validée**, pas lorsqu'elle est écrite.
- **Le déterminisme rend les tests fiables** ; toute source d'aléa dans le raisonnement est un
  défaut.
- **Traçabilité** : tout changement de comportement *voulu* est relié à une fiche du Référentiel
  et à une décision documentée.

---

## Principes de documentation

- **Toute décision d'architecture importante donne une note de décision** : contexte, options
  envisagées, choix retenu, conséquences — datée, conservée dans un registre.
- **La documentation vit avec le projet**, versionnée au même titre que le reste.
- **Une évolution de règle métier = une fiche mise à jour et versionnée**, jamais un commentaire
  isolé perdu dans du code.
- **Les documents fondateurs ne se réécrivent pas** : ils s'**amendent** explicitement (voir
  Gestion des exceptions).
- **Le « pourquoi » prime sur le « comment »** dans la documentation durable ; le comment change,
  le pourquoi reste.

---

## Principes applicables aux IA

Une IA contribue **sous** la Constitution et cette Charte, exactement comme un humain, mais avec
des garde-fous renforcés — parce qu'elle agit vite et à grande échelle.

- **Ne jamais créer ni modifier une règle métier sans justification explicite**, et toujours la
  porter au Référentiel en état *brouillon* : l'IA **propose**, l'humain **valide** (Constitution
  P15, P19).
- **Ne jamais déplacer une responsabilité entre couches sans analyse d'impact documentée.**
- **Ne jamais supprimer un moteur, une règle ou un composant sans validation** (Golden Master +
  revue humaine).
- **Ne jamais introduire un raccourci** qui contourne une couche ou une couture.
- **Toujours laisser une trace** : ce qui a changé, pourquoi, quelles fiches sont concernées,
  quel est l'effet sur le Golden Master.
- **Rester dans un périmètre borné** : agir sur une couche ou une couture identifiée, pas
  « partout à la fois ».
- **En cas de doute ou de conflit avec un principe : s'arrêter et demander**, jamais forcer.
- **L'IA n'a pas autorité pour amender la Constitution ni la Charte** ; elle peut seulement le
  proposer.

---

## Critères d'acceptation d'une évolution

Toute évolution — humaine ou IA — passe cette grille. **Un seul « non » la refuse ou la renvoie**,
sauf exception formelle (voir ci-dessous).

1. Respecte-t-elle **la Constitution** ?
2. A-t-elle **une responsabilité unique et clairement placée** ?
3. Respecte-t-elle **la séparation des couches** (passe-t-elle par les coutures) ?
4. Respecte-t-elle **le Plan Directeur** (progressive, sans big-bang) ?
5. Le **savoir** va-t-il au Référentiel (et non dans un moteur) ?
6. Le **prix** reste-t-il hors des décisions, et inchangé s'il s'agit d'une migration de structure ?
7. Est-elle **testable** et **comparée au Golden Master** ?
8. Est-elle **réversible** ?
9. Est-elle **documentée** (décision + fiches concernées) ?
10. La **traçabilité** (Journal de Décision) est-elle préservée ?

---

## Gestion des exceptions

Un principe peut parfois gêner une évolution légitime. La réponse n'est **jamais** le
contournement silencieux. Deux voies, et deux seulement :

- **L'exception documentée et temporaire** : une dérogation **explicite, datée, nominative**,
  assortie d'un **plan de retour à la conformité** et d'une échéance. Elle est inscrite au
  registre des décisions. Une exception non documentée est une **violation**.
- **L'amendement** : si un principe doit réellement changer, on **amende** le document concerné
  (Constitution ou Charte) par une décision explicite, datée et justifiée — **jamais par la
  pratique ni par accumulation d'exceptions**.

Règles complémentaires : une exception **ne crée jamais de précédent tacite** ; si l'on s'écarte
pour aller vite, la **dette** ainsi contractée est inscrite avec son échéance de remboursement.

---

## Conclusion

Cette Charte est le **document de référence de toute évolution future de DSBAT**. Associée à la
Constitution (les principes) et au Plan Directeur (la trajectoire), elle garantit qu'après des
années et de multiples contributeurs — humains comme IA — l'architecture reste **cohérente,
vérifiable et durable**.

À chaque contribution, une seule question suffit :

> **« Cette évolution respecte-t-elle la Constitution, les responsabilités, la séparation des
> couches et le Plan Directeur — et peut-elle être testée, tracée et annulée ? »**
> Si un seul élément manque, l'évolution est remise en question.

*— Charte officielle de développement DSBAT.*
