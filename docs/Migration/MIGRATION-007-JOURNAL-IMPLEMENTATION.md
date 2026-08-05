# Moteur DSBAT — MIGRATION 007 : Première implémentation passive du Journal de Décision

> **Seconde couture d'architecture dans le code.** Crée l'**infrastructure** du Journal de Décision,
> totalement **passive** et **connectée à aucun moteur**. *Aucun calcul, règle, prix, interface,
> recommandation, alerte, contrôle ni devis modifié. Golden Master intégralement valide.*

---

## Analyse de l'existant

Aujourd'hui, les explications du raisonnement sont **partielles et dispersées** :
`explicationsTableau` (dans `prix.js`) justifie le tableau électrique, les messages du moteur de
recommandations expliquent les conseils, mais il n'existe **aucun réceptacle unique** capable de
recueillir, dans l'ordre, l'ensemble du raisonnement (faits, candidates, règles retenues/écartées,
hypothèses, conflits, décisions). La MIGRATION 006 a posé le Port (l'accès au savoir) ; il manquait
le **témoin** de ce que le moteur en fait.

---

## Architecture retenue

Un **module autonome, injectable et passif**, sur le même modèle que le Port : il ne se branche à
rien tout seul, il ne connaît aucun moteur, et il n'est **chargé par aucune page**. On crée un
journal, on l'alimente, on le consulte, on le vide — c'est tout.

Choix de conception garantissant la passivité :

- **Entrées figées** (immuables une fois écrites — *append-only*).
- **Données clonées** à l'enregistrement (données simples, sérialisées) : le Journal est **isolé**
  des objets du moteur, donc **incapable d'influencer** le raisonnement.
- **Consultation = copie en lecture seule**.
- **Ordre garanti par un compteur monotone**, indépendant de l'horloge (déterminisme de l'ordre).
- **Robustesse** : un événement défaillant ne casse jamais le Journal.

---

## Module créé

`js/journal-decision.js` — une fabrique `creerJournal(options)` qui retourne un journal figé, plus
un vocabulaire de types d'événements `TYPES_EVENEMENT` aligné sur la spécification (MIGRATION 004) :
`fait`, `connaissance_candidate`, `regle_appliquee`, `regle_ecartee`, `hypothese`,
`recommandation`, `controle`, `conflit`, `decision`.

---

## Contrat du Journal

- **Reçoit** des événements normalisés `{ sequence, horodatage, type, donnees }`.
- **Conserve l'ordre** chronologique (par séquence).
- **Restitue** une copie en lecture seule.
- **Se vide** pour un nouveau cycle — sans jamais éditer une entrée passée.
- **Ne stocke que des données simples** : il *référence* le savoir (identifiants, versions), il ne
  recopie jamais son contenu comme source → il n'est pas une base de connaissances.
- **Ne renvoie rien d'exploitable pour décider** : l'écriture ne produit aucun retour utile au
  raisonnement.

---

## API publique

| Méthode | Rôle |
|---------|------|
| `creerJournal({ horloge? })` | crée un journal (horloge injectable pour les tests) |
| `enregistrer(type, donnees)` | ajoute un événement (données clonées et figées) |
| `consulter()` | copie en lecture seule, ordre chronologique |
| `filtrerParType(type)` | sous-ensemble par type |
| `taille()` | nombre d'événements |
| `vider()` | réinitialise le journal (nouveau cycle) |

Invariants **vérifiés par test** (`tests/golden-master/journal-check.js`, 15 assertions) : créé
vide ; ordre 1,2,3 indépendant de l'horloge ; entrées et journal **figés** ; **isolation** des
données (muter l'objet source après enregistrement ne change rien) ; **aucune** méthode
`decider`/`calculer`/`appliquer` ; robustesse (contenu non sérialisable journalisé sans planter) ;
`vider()` réinitialise.

---

## État actuel (passif)

Le Journal est **inerte** : il n'est importé par aucun moteur, chargé par aucune page, et **aucun
événement réel n'est encore enregistré**. C'est **uniquement l'infrastructure**, prête à recevoir,
lors des prochaines étapes, les événements du raisonnement — sans qu'aucune décision ne soit encore
tracée.

---

## Fichiers créés

- `js/journal-decision.js` — le module Journal (fabrique + types d'événements).
- `tests/golden-master/journal-check.js` — les invariants de passivité.

## Fichiers modifiés

**Aucun.** Aucun fichier livré n'a été touché (`git status` : aucun fichier modifié). Le Journal
n'est référencé par aucune page.

---

## Validation Golden Master

```
node journal-check.js         → ✅ Journal : 15 assertions OK, 0 échec
node port-check.js            → ✅ Port : 15 assertions OK, 0 échec
node golden-master.js verify  → ✅ Golden Master IDENTIQUE — aucune régression
```

Un composant nouveau, isolé et non branché ne peut pas changer les sorties : **mêmes prestations,
quantités, prix, recommandations, alertes, contrôles, devis. Aucune régression.**

---

## Compatibilité avec la Constitution

Application des **P4** (explicabilité — future) et **P11** (traçabilité — infrastructure). Respect
du **P3** (aucun prix ; données simples uniquement), **P7** (responsabilité unique : témoin, jamais
acteur — vérifié), **P17** (ordre déterministe), **P21** (référence le savoir, ne le duplique pas).
Le Journal ne devient ni base de connaissances, ni moteur de décision, ni moteur de calcul.

## Compatibilité avec le Plan Directeur

C'est la brique **D** introduite en **observateur passif**, prévue après le Port. Elle **complète le
Port** : le Port fournira les versions de fiches, le Journal les consignera — les deux briques sont
pensées ensemble et posées l'une après l'autre, sans consommateur contraignant.

## Compatibilité avec la Charte

Migration **additive** (deux fichiers neufs), **réversible** (les supprimer laisse la V1.5 intacte),
**testable** (invariants + Golden Master), **documentée**. Aucune logique déplacée, aucun moteur
touché.

---

## Préparation de la Migration 008

Le Port (lecture du savoir) et le Journal (témoin du raisonnement) étant tous deux en place mais non
branchés, la MIGRATION 008 pourra **relier un premier fil de raisonnement**, en observateur et à
sortie strictement identique : par exemple, **journaliser en parallèle** un raisonnement déjà
existant (comme le dimensionnement du tableau électrique, qui produit déjà une explication), en
lisant ses fiches via le Port et en consignant l'événement au Journal — **sans modifier le devis ni
l'affichage**, et validé « Golden Master identique ». Ce sera la première fois que Port et Journal
travailleront ensemble, toujours en miroir passif.

---

## Conclusion

Le Journal de Décision a sa **première implémentation** : une infrastructure passive, figée, isolée
et déterministe, capable de recevoir, ordonner, restituer et vider des événements — **sans décider,
sans calculer, sans rien modifier**, et **sans être branchée**. Avec le Port (MIGRATION 006), les
deux témoins de l'architecture — *accès au savoir* et *trace du raisonnement* — sont désormais dans
le code, prêts à être reliés progressivement, à comportement rigoureusement inchangé. Le Golden
Master reste intégralement valide.

*— MIGRATION 007 : Journal de Décision (infrastructure passive). Seconde couture d'architecture.*
