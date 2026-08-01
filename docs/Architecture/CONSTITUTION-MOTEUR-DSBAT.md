# Constitution du Moteur DSBAT

> **Document fondateur — règle suprême du projet.**
> Cette Constitution ne décrit ni architecture, ni algorithme, ni code. Elle énonce les
> principes que tout le projet doit respecter, aujourd'hui comme dans dix ans. Elle est
> **indépendante du langage, de la plateforme et des moteurs actuels** : elle reste valable
> même si le logiciel est entièrement réécrit.

---

## Préambule

Le Moteur DSBAT est un **moteur d'expertise** : il transforme des connaissances métier en
décisions justes, explicables et durables. Sa valeur ne tient pas à une technologie, mais à
la **discipline** avec laquelle il sépare le savoir, la décision, le calcul et le prix.

Cette Constitution fixe cette discipline. Elle prime sur tout autre document, chapitre ou
implémentation. En cas de conflit entre un principe et une facilité technique, **le principe
l'emporte** — ou il est amendé explicitement, jamais contourné.

Chaque principe est énoncé, puis accompagné de son **objectif** et des **conséquences de sa
violation**.

---

## Les principes fondateurs

### Principe 1 — Le Référentiel de Connaissances est la source unique du savoir.
Toute connaissance métier (norme, règle, recommandation, option) réside dans le Référentiel,
et nulle part ailleurs.
- **Objectif** : un seul endroit à consulter et à corriger ; pas de savoirs dispersés.
- **Si violé** : connaissances contradictoires, corrections partielles, incohérences invisibles.

### Principe 2 — Les moteurs métier exploitent le savoir, ils ne le contiennent pas.
Le savoir évolue ; le calcul est stable. Les deux ne se mélangent pas.
- **Objectif** : faire évoluer une norme sans toucher au code de calcul.
- **Si violé** : chaque mise à jour réglementaire impose de modifier des moteurs → régressions.

### Principe 3 — Le moteur décide, le catalogue chiffre ; le prix ne décide jamais.
Une décision technique doit être juste indépendamment de son coût.
- **Objectif** : préserver la justesse technique et l'intérêt du client, jamais la marge.
- **Si violé** : dépendance circulaire décision ↔ prix, conseils biaisés, perte de confiance.

### Principe 4 — Toute décision est explicable ; rien n'est décidé en silence.
Chaque prestation se justifie par ses faits et ses fiches ; chaque conflit est résolu ouvertement.
- **Objectif** : audits possibles, confiance de l'humain et de l'IA.
- **Si violé** : moteur « boîte noire », indéfendable, non auditable.

### Principe 5 — Chaque connaissance a un identifiant unique et pérenne.
Un identifiant stable, qui ne change jamais.
- **Objectif** : citer, versionner, tracer, expliquer.
- **Si violé** : impossible de référencer une décision ; traçabilité brisée.

### Principe 6 — Le Port d'Accès au Savoir est l'unique entrée vers les connaissances.
Aucun moteur ne lit directement les normes, règles, recommandations ou options.
- **Objectif** : faire évoluer le Référentiel sans toucher aux moteurs.
- **Si violé** : couplages directs multiples ; le Référentiel devient figé par ses lecteurs.

### Principe 7 — Chaque couche possède une responsabilité unique.
Une couche, une raison d'exister.
- **Objectif** : clarté, testabilité, évolution isolée.
- **Si violé** : responsabilités mêlées, effets de bord, maintenance coûteuse.

### Principe 8 — Les dépendances vont toujours du haut vers le bas, jamais l'inverse.
Le savoir ne dépend de rien ; l'interface ne commande rien au cœur.
- **Objectif** : pas de cycle ; chaque couche évolue isolément.
- **Si violé** : dépendances circulaires, évolutions impossibles sans tout casser.

### Principe 9 — Le Projet (Dossier) est le contrat unique entre les moteurs.
Tous les moteurs reçoivent exactement le même objet.
- **Objectif** : indépendance à l'interface ; cohérence entre moteurs.
- **Si violé** : chaque moteur invente son format ; couplage à l'UI ; incohérences.

### Principe 10 — Le vocabulaire officiel est partagé par tout le logiciel.
Moteurs, IA, API et franchises désignent les mêmes objets par les mêmes noms.
- **Objectif** : une seule langue DSBAT, sans ambiguïté.
- **Si violé** : termes divergents, correspondances erronées, fautes silencieuses.

### Principe 11 — Le Journal de Décision garantit la traçabilité complète du raisonnement.
Faits, hypothèses, règles consultées et appliquées, conflits, justifications, décisions finales.
- **Objectif** : reconstituer tout raisonnement ; socle des audits, de l'IA, de la confiance.
- **Si violé** : raisonnement irreproductible, débogage aveugle.

### Principe 12 — Une recommandation n'est jamais une obligation.
Le conseil ne se confond pas avec la contrainte.
- **Objectif** : le client garde le choix ; l'obligation ne se dilue pas dans du conseil.
- **Si violé** : on impose l'inutile, ou on présente une obligation comme facultative (risque technique/juridique).

### Principe 13 — Une option n'est jamais une recommandation.
Le confort et la personnalisation ne se confondent pas avec le conseil d'expert.
- **Objectif** : un message clair, ni survente ni sous-information.
- **Si violé** : brouillage du message, décisions client faussées.

### Principe 14 — Les connaissances sont versionnées ; les anciens devis restent reproductibles.
On peut rejouer un devis passé avec le savoir de sa date d'émission.
- **Objectif** : justifier et défendre un devis émis hier.
- **Si violé** : un devis passé devient inexplicable ; perte de valeur juridique.

### Principe 15 — L'IA ne crée jamais de connaissance ; elle exploite le savoir validé.
L'IA formule, résume, propose ; elle ne décide ni n'invente.
- **Objectif** : garder l'humain garant du savoir ; empêcher l'invention.
- **Si violé** : hallucinations présentées comme vérité DSBAT.

---

## Les principes ajoutés

Principes structurants absents de la liste initiale, mais nécessaires à la solidité du socle.

### Principe 16 — Le cœur est indépendant de l'interface et de la technologie.
Le savoir et la décision ne dépendent d'aucun langage, plateforme ni interface.
- **Objectif** : le moteur sert web, mobile, API, franchise et IA sans changer ; il survit à une réécriture.
- **Si violé** : le cœur devient prisonnier d'une technologie ; toute migration devient une refonte.

### Principe 17 — Le raisonnement est déterministe et reproductible.
Mêmes faits + même version du savoir ⟹ mêmes décisions.
- **Objectif** : rendre le moteur testable, auditable, défendable.
- **Si violé** : résultats instables, non testables, indéfendables.

### Principe 18 — Le logiciel propose, l'humain décide.
Aucune recommandation ni option ne modifie automatiquement le devis ; le consentement reste humain.
- **Objectif** : le client et l'artisan gardent le contrôle et la responsabilité.
- **Si violé** : des choix sont imposés à l'insu du client ; perte de confiance et de responsabilité.

### Principe 19 — Toute connaissance est validée avant d'être active.
Une connaissance naît en brouillon, passe une revue humaine, puis devient active et datée.
- **Objectif** : aucun savoir non vérifié ne décide en production.
- **Si violé** : des connaissances fausses ou non validées pilotent des devis réels.

### Principe 20 — Échec sûr : une connaissance défaillante n'altère jamais l'ensemble ; l'inconnu est signalé, jamais masqué.
Une règle cassée est isolée ; une donnée manquante devient une information, pas une erreur cachée.
- **Objectif** : robustesse à l'échelle de centaines de règles ; l'incomplétude est visible.
- **Si violé** : une seule règle défectueuse fausse tout le devis ; des manques passent inaperçus.

### Principe 21 — Une seule source de vérité par donnée.
Chaque donnée — savoir, prix, vocabulaire, projet — a un unique propriétaire.
- **Objectif** : corriger à un seul endroit ; interdire les copies divergentes.
- **Si violé** : versions contradictoires, corrections partielles, bugs de cohérence.

---

## Les engagements d'évolution

- La Constitution **prime** sur tout document, chapitre, architecture ou implémentation.
- Toute évolution est **confrontée à la Constitution** avant d'être adoptée.
- Un principe ne se modifie que par un **amendement explicite, daté et justifié** — jamais par
  contournement ni exception silencieuse.
- La Constitution est **indépendante de toute technologie** et demeure valable après une
  réécriture complète du logiciel.
- En cas de conflit entre un principe et une facilité technique, **le principe l'emporte**, ou
  la facilité est refusée.

---

## Les critères de conformité d'une future évolution

Avant d'adopter une évolution, on répond à ces questions. **Un seul « non » suffit à la
remettre en question.**

1. Le savoir reste-t-il **exclusivement dans le Référentiel** ? *(P1, P2)*
2. Le **prix reste-t-il hors des décisions** ? *(P3)*
3. La décision reste-t-elle **explicable et tracée** ? *(P4, P11)*
4. Passe-t-elle par le **Port d'accès** et par le **Projet** ? *(P6, P9)*
5. Emploie-t-elle le **vocabulaire officiel** ? *(P10)*
6. Les **dépendances** restent-elles descendantes et **sans cycle** ? *(P7, P8)*
7. Distingue-t-elle clairement **obligation / recommandation / option** ? *(P12, P13)*
8. Reste-t-elle **reproductible et versionnée** ? *(P14, P17)*
9. L'**humain garde-t-il la décision**, l'IA restant simple exploitante ? *(P15, P18)*
10. Est-elle **indépendante de l'interface/technologie** et **sûre en cas d'échec** ? *(P16, P19, P20, P21)*

---

## Conclusion

**Cette Constitution peut-elle être considérée comme la règle suprême du projet DSBAT ?**

### ✅ OUI

Justification. Ces principes sont **clairs, intemporels et non ambigus**, et n'évoquent aucune
technologie : ils resteraient vrais si DSBAT était réécrit dans un autre langage. Ils couvrent
les quatre séparations vitales — savoir / décision / calcul / prix — et les garanties qui les
rendent durables : identité, traçabilité, versionnement, déterminisme, gouvernance, robustesse,
primauté de l'humain. Ils sont **cohérents** avec les Chapitres 1 et 2, la Revue d'Architecture
n°1 et les Fondations complémentaires, sans en contredire aucune ligne, et fournissent une
**grille de conformité opérationnelle** applicable à toute évolution future.

Cette Constitution peut donc servir de **référence officielle et suprême** du projet. À chaque
évolution, une seule question devra être posée :

> **« Cette évolution respecte-t-elle la Constitution du Moteur DSBAT ? »**
> Si la réponse est non, l'évolution est remise en question.

*— Constitution du Moteur DSBAT. Règle suprême du projet.*
