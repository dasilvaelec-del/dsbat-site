# Moteur DSBAT — MIGRATION 004 : Journal de Décision

> **Conception d'un contrat conceptuel. Aucun code, aucune implémentation.** Formalise une brique
> déjà prévue par l'architecture (Fondation D). *Aucun moteur, calcul, prix, interface ni
> comportement modifié.*

Le Journal de Décision est le **témoin** du raisonnement du Moteur DSBAT : il enregistre *comment*
et *pourquoi* les décisions ont été prises, sans jamais y participer.

---

## Vision générale

Un moteur d'expertise n'a de valeur que si l'on peut lui demander : *« pourquoi cette prestation
apparaît-elle ? »* — et obtenir une réponse complète et vérifiable. Le Journal est ce qui rend
cette réponse possible. Il **observe** le déroulé du raisonnement et le **consigne**, pour que
chaque décision puisse être remontée jusqu'aux faits et aux connaissances qui l'ont produite.

Il est **passif par nature** : il ne décide pas, ne calcule pas, ne modifie aucune connaissance.
Il écrit ce qui s'est passé, un point c'est tout.

---

## Rôle

Rendre le raisonnement du moteur **entièrement explicable et reproductible**, en enregistrant la
chaîne complète : *faits → connaissances consultées → règles retenues → décision → besoin →
prestation*. C'est l'application concrète des principes P4 (toute décision est explicable) et P11
(le Journal garantit la traçabilité).

---

## Responsabilités

- **Consigner** chaque cycle de décision : faits, candidates, règles retenues et écartées,
  hypothèses, recommandations, contrôles, conflits, décisions finales.
- **Horodater** et **référencer les versions** exactes des fiches utilisées (via le Port).
- **Relier** chaque décision aux objets qu'elle concerne (instances : `SDB-1`, `TABLEAU-1`…) et aux
  fiches qui la fondent (`RM-024`, `DTU-52.2`…).
- **Rester attaché au Projet** (section `decisions`), en **append-only** et **immuable** une fois
  écrit.
- **Émettre les signaux bruts** utiles aux futurs niveaux de confiance, sans les agréger.

---

## Informations enregistrées

Pour chaque cycle de décision :

- **Les faits connus** — issus du Projet (ex. « `DOUCHE.ITALIENNE` détectée en `SDB-1` »).
- **Les connaissances candidates** — les fiches fournies par le Port pour le contexte (par
  périmètre déclaré), avant toute évaluation.
- **Les règles réellement appliquées** — les fiches dont la condition a été satisfaite.
- **Les règles écartées** — les candidates non retenues, **avec justification** si nécessaire
  (condition non remplie, remplacée par une fiche plus spécifique, dépréciée…).
- **Les hypothèses retenues** — les valeurs par défaut utilisées faute de donnée, **signalées**.
- **Les recommandations produites** — les recommandations émises (jamais appliquées d'office).
- **Les contrôles déclenchés** — et leurs résultats/alertes éventuelles.
- **Les conflits éventuels** — et la règle de départage qui les a résolus.
- **Les décisions finales** — les conclusions, avec leurs **fondements** (identifiants + versions
  de fiches) et les **objets concernés**.

À quoi s'ajoutent, comme métadonnées : l'**horodatage**, le **cliché du savoir** utilisé, et les
**versions** précises des fiches — de quoi rejouer et auditer.

**Exemple de chaîne restituable :**

```
Prestation « étanchéité » — pourquoi ?
  ← Décision : « étanchéité requise »
     ← Règles retenues : RM-024 (v1.0) + DTU-52.2 (v en vigueur à la date)
        ← Candidates fournies par le Port : [RM-024, REC-021, …]
           ← Faits : DOUCHE.ITALIENNE détectée en SDB-1
```

---

## Informations volontairement exclues

- **Aucun prix, aucun montant, aucune quantité** — le Journal explique la *décision*, jamais le
  chiffrage (ligne rouge P3). Le chiffrage aura, si besoin, sa propre trace, séparée.
- **Aucune connaissance stockée en propre** — le Journal **référence** les fiches (identifiant +
  version) ; il ne recopie pas leur contenu comme source. Il n'est pas une base de connaissances.
- **Aucun résultat recalculé** — il consigne ce que le moteur a produit, il ne le reproduit pas.
- **Aucune donnée superflue** — il enregistre ce qui sert à expliquer le raisonnement, pas plus.

---

## Cycle de vie

1. **Production** — écrit par le Moteur de Décision *pendant* le cycle de raisonnement, au fil des
   décisions.
2. **Scellé** — une fois le cycle terminé, l'entrée est **immuable** (append-only) : on n'édite
   jamais une trace passée.
3. **Rattachement** — rangé dans le Projet (`Projet.decisions`), horodaté et versionné.
4. **Conservation** — gardé pour l'audit et la reproductibilité ; associé au cliché de savoir de
   l'époque, il permet de réexpliquer un devis même ancien.
5. **Exploitation** — lu (jamais réécrit) par les explications, les audits, le débogage, les futurs
   niveaux de confiance et les analyses IA.

---

## Relations avec le Port d'Accès

Le Port fournit au Journal la **provenance** : quelles fiches candidates ont été servies, avec
quelles **versions** et quelles **références**. Le Journal **enregistre** ces éléments ; il
n'interroge pas le savoir lui-même et ne le stocke pas. Port et Journal sont pensés ensemble : le
premier donne les versions, le second les consigne.

---

## Relations avec le Moteur de Décision

Le Journal est **produit par** le Moteur de Décision, comme un sous-produit de son raisonnement. Le
moteur **écrit**, le Journal **stocke**. Point capital : le Journal **ne revient jamais** influencer
le raisonnement — il n'est jamais relu par le moteur pour décider. C'est un miroir, pas une boucle.
Cette séparation garantit qu'il reste un simple **témoin**.

---

## Relations avec les moteurs métier

Le Journal peut relier une **décision** au **besoin** qu'elle a produit, puis à la **prestation**
que le moteur métier en a tirée — assurant la traçabilité *de la règle jusqu'à la ligne du devis*.
Mais il **consigne** ce lien ; il ne calcule ni la prestation ni son montant. Les moteurs métier ne
lisent pas le Journal pour travailler.

---

## Préparation des futurs niveaux de confiance

Le Journal **n'agrège aucun score**, mais il rend disponibles les **signaux bruts** qui
permettront de le calculer plus tard :

- **Complétude** — le nombre et la nature des **hypothèses** retenues (données manquantes comblées).
- **Cohérence** — le nombre et la gravité des **conflits** rencontrés et résolus.
- **Fiabilité** — la part de décisions fondées sur des fiches **actives/validées** vs
  **brouillon**, et l'**ancienneté** des normes mobilisées.

Ces signaux voyagent *avec* le Journal ; la future couche « confiance » les consommera sans qu'on
la développe maintenant. Le Journal prépare aussi, de la même façon, les **audits**, les
**explications utilisateurs**, le **débogage** et les **analyses IA** — tous *lecteurs* du Journal.

---

## Compatibilité avec la Constitution

Le Journal **est** l'application des principes **P4** (explicabilité) et **P11** (traçabilité). Il
respecte **P3** (aucun prix), **P14** (versions + cliché ⟹ reproductibilité des devis passés),
**P17** (le déterminisme rend le Journal fidèle et rejouable), **P21** (il *référence* les fiches,
il ne duplique pas le savoir), et **P7** (responsabilité unique : témoin, jamais acteur). Il ne
devient jamais une base de connaissances, un moteur de décision ni un moteur de calcul.

---

## Compatibilité avec le Plan Directeur

C'est la brique **D** du Plan Directeur, prévue après le Port. Sa mise en œuvre se fera en
**observateur passif** : il enregistrera d'abord le raisonnement *déjà à l'œuvre* (y compris les
explications actuelles comme celles du tableau électrique ou les messages de recommandation), **sans
rien changer au résultat**. Une fois validé qu'il capture la chaîne complète, il pourra devenir la
**source** des explications du devis, en remplacement des explications ad hoc — étape par étape,
chacune « Golden Master identique ».

---

## Compatibilité avec le Golden Master

**Aucun impact.** Un observateur qui se contente d'enregistrer ne modifie ni `calculerDevis`, ni
`controlesCoherence`, ni `RecoEngine`, ni aucune sortie. À entrées identiques, le logiciel produit
des devis, contrôles et recommandations strictement identiques : le contrat de non-régression est
respecté par construction.

---

## Conclusion

Le Journal de Décision est désormais **complètement défini** : un témoin passif, immuable et
horodaté, qui enregistre la chaîne entière du raisonnement — faits, candidates, règles retenues et
écartées, hypothèses, recommandations, contrôles, conflits, décisions — sans jamais y participer,
sans jamais stocker de prix ni de savoir en propre, et sans jamais revenir influencer une décision.
Il permet d'**expliquer intégralement** un devis et prépare la confiance, les audits, les
explications et l'IA. Sa définition suffit pour l'implémenter en toute sécurité, en observateur
passif, sans rien changer au comportement actuel du logiciel.

*— MIGRATION 004 : Journal de Décision. Contrat conceptuel, avant implémentation.*
