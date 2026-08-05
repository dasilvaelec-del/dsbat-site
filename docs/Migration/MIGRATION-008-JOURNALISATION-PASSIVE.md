# Moteur DSBAT — MIGRATION 008 : Première journalisation passive d'un raisonnement existant

> **Première utilisation réelle du Journal.** Le Journal **observe** un raisonnement déjà présent
> (dimensionnement du tableau électrique) **sans y participer** et **sans modifier le moteur**.
> *Aucun calcul, règle, prix, interface, recommandation, alerte, contrôle ni devis modifié. Golden
> Master intégralement valide.*

C'est la première fois que le **Port** (MIGRATION 006) et le **Journal** (MIGRATION 007)
travaillent ensemble — en miroir passif.

---

## Raisonnement choisi

Le **dimensionnement du tableau électrique (NF C 15-100)** : à partir des besoins électriques d'un
projet (prises, points lumineux, circuits spécialisés, état du tableau existant), le moteur décide
d'un tableau (nombre de circuits, différentiels, rangées, parafoudre).

## Pourquoi ce choix

- **Isolé** : c'est un raisonnement autonome, déjà encapsulé dans un sous-moteur
  (`dimensionnementTableau`).
- **Déjà observable sans instrumentation** : `calculerDevis` **produit déjà aujourd'hui** ses
  résultats intermédiaires — `window.__besoinsTableau` (les faits) et `window.__tableauAuto` (la
  décision). On peut donc les **lire après coup**, sans toucher au moteur.
- **Rattaché à une connaissance réelle** : la norme **NF C 15-100**, que le Port expose déjà — ce
  qui permet de démontrer Port + Journal ensemble.

## Journalisation réalisée

Un **observateur** (`js/observateur-tableau.js`) lit les résultats **déjà calculés** par le moteur,
consulte la norme via le Port (lecture seule) et **consigne** des événements dans le Journal. Il
n'instrumente pas `calculerDevis`, ne recalcule rien, ne re-décide rien : la **décision journalisée
est lue** depuis `window.__tableauAuto`, telle que le moteur l'a produite.

## Événements enregistrés

Dans l'ordre chronologique (vérifié) :

```
#1 debut_raisonnement        { sujet: TABLEAU_ELECTRIQUE }
#2 fait                      { tableauExistant, prises16, pointsLumineux, specialises20A, cuisson, parafoudre, surfaceLogement }
#3 connaissance_candidate    { identifiant: "NF C 15-100", famille: NORME, version, source }   ← via le Port
#4 decision                  { nbCircuits, differentiels, rangees, parafoudre }                ← lue du moteur
#5 fin_raisonnement          { sujet: TABLEAU_ELECTRIQUE }
```

## Architecture retenue

**Observation après coup, jamais instrumentation.** Le moteur reste une boîte close : l'observateur
se place **en aval**, lit les sorties déjà présentes, interroge le Port, écrit au Journal. Le
Journal reçoit des **données clonées et figées** (isolées du moteur), donc **incapables** d'influer
sur le raisonnement. L'observateur est **injecté** (journal + port + contexte) et **chargé par
aucune page** : totalement inerte côté navigateur.

---

## Fichiers modifiés

**Aucun.** (`git status` : aucun fichier existant modifié.)

Fichiers **créés** : `js/observateur-tableau.js` (l'observateur), `tests/golden-master/observateur-check.js`
(la démonstration + les vérifications).

---

## Validation Golden Master

```
node observateur-check.js     → ✅ 5 assertions OK (5 événements dans l'ordre, NF C 15-100 consultée,
                                   décision = décision réelle du moteur, devis identique à la référence)
node golden-master.js verify  → ✅ Golden Master IDENTIQUE — aucune régression
node journal-check.js         → ✅ 15/15    node port-check.js → ✅ 15/15
```

Preuve de non-participation : la décision journalisée (`nbCircuits`) est **égale** à celle produite
par le moteur (`window.__tableauAuto.nbCircuits`), et le devis (`totalHT`, `ttc`) est **identique**
à la référence Golden Master du cas. L'observation n'a **rien changé** : mêmes prestations,
quantités, prix, recommandations, alertes, contrôles, devis.

---

## Compatibilité avec la Constitution

Application des **P4** (le raisonnement devient explicable) et **P11** (traçabilité effective).
Respect du **P3** (aucun prix journalisé), **P7** (l'observateur et le Journal restent des témoins,
jamais des acteurs — vérifié), **P17** (ordre déterministe), **P21** (le Journal *référence* la
norme par identifiant + version, il ne la duplique pas). Le Journal ne décide pas, n'applique pas,
ne modifie rien.

## Compatibilité avec le Plan Directeur

C'est exactement l'étape annoncée par la MIGRATION 007 : **relier un premier fil de raisonnement**
en observateur, à sortie identique, en faisant coopérer Port et Journal. Le raisonnement métier n'est
pas déplacé ; il est simplement **observé**.

## Compatibilité avec la Charte

Migration **additive** (deux fichiers neufs), **réversible** (les supprimer laisse la V1.5 intacte),
**testable** (démonstration exécutée + Golden Master), **documentée**. Aucune logique déplacée.

---

## Préparation de la Migration 009

La démonstration faite, la suite pourra **élargir l'observation** à d'autres raisonnements déjà
présents (VMC, plomberie, ballon, chauffage), toujours en observateur passif, chacun validé « Golden
Master identique ». Ensuite viendra la question du **branchement** : à terme, produire le Journal
*pendant* le calcul (et non après) exigera d'abord d'extraire les décisions du calcul vers le Moteur
de Décision — une migration plus profonde, préparée par toutes les coutures déjà posées. La sortie
de `tauxTVA` du HTML reste également un candidat de micro-migration.

---

## Conclusion

Le Journal a sa **première utilisation réelle** : le raisonnement du tableau électrique est
**observé de bout en bout** — début, faits, connaissance consultée via le Port, décision, fin — et
consigné dans le Journal, **sans que le moteur ne change d'un iota**. La démonstration est faite :
*le raisonnement du Moteur DSBAT peut être observé sans modifier son fonctionnement.* Port et Journal
coopèrent pour la première fois, en pur miroir passif, et le Golden Master reste intégralement
valide.

*— MIGRATION 008 : première journalisation passive. Le raisonnement devient observable.*
