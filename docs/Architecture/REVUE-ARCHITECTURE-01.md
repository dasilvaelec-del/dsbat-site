# Moteur DSBAT V2 — Revue d'Architecture n°1

> **Validation officielle des Chapitres 1 et 2.**
> Analyse d'architecte logiciel (conceptuelle), sans code et sans modification des
> chapitres. Ce document fait foi comme acte de validation des fondations.

Documents examinés :
- `docs/MOTEUR-DSBAT-ARCHITECTURE-V2.md` (charte d'architecture)
- `docs/REFERENTIEL-CONNAISSANCES-CH1.md` (Chapitre 1 — Référentiel de Connaissances)
- `docs/MOTEUR-DECISION-CH2.md` (Chapitre 2 — Moteur de Décision)

---

## Analyse globale

Les deux chapitres forment un couple classique et sain : une **base de savoir
déclarative** (Ch1) et un **moteur d'inférence** qui l'exploite (Ch2). La séparation
cardinale — *le savoir ne calcule pas, le moteur ne stocke pas de savoir* — est posée et
tenue. Le sens des dépendances est correct (le moteur dépend du référentiel, jamais
l'inverse) et la règle « aucune décision ne produit de prix ni de quantité » est respectée.

C'est une fondation solide. La revue distingue toutefois *ce qui est écrit* de *ce qui est
implicite* : les deux chapitres reposent sur **deux contrats qu'aucune couche ne possède
explicitement** — le **vocabulaire partagé** (faits, besoins, conditions) et le **modèle du
Projet** (source des faits). C'est le constat central de la revue.

## Points forts

Séparation des responsabilités nette (Ch1 = quoi/pourquoi ; Ch2 = quelles règles et dans
quel ordre). Raisonnement monotone du Ch2 = terminaison garantie et boucles interdites par
construction. Traçabilité native (déclencheurs + fondements + version des fiches).
Versionnement daté du référentiel (« que savait le moteur à telle date »). Séparation
besoin abstrait ↔ prix qui protège durablement le savoir de la contamination par le catalogue.

## Points faibles

1. **Vocabulaire (ontologie) sans propriétaire.** `conditionApplication` (fiche, Ch1),
   « faits normalisés » (moteur, Ch2) et « besoins » (vers les moteurs) parlent la même
   langue, définie dans aucune couche → risque de duplication et de divergence.
2. **Frontière floue décision / contrôles / recommandations / confiance.** Le Ch2 fait
   *sélectionner* recommandations et contrôles par le moteur de décision, alors que la
   charte en fait des moteurs distincts. À trancher : le moteur de décision fait
   l'inférence/sélection, les autres sont des consommateurs en aval.
3. **Contrat d'accès au savoir non défini.** « Le moteur interroge le référentiel » sans
   spécifier l'interface de requête ni la sélection de version.
4. **Convention d'identifiants hétérogène** (source-préfixe pour les Normes, famille-préfixe
   pour les autres) — à harmoniser et documenter.

## Éléments éventuellement manquants (briques architecturales)

- **A. Couche Vocabulaire / Ontologie partagée** — la fondation manquante la plus
  importante ; langage commun des faits, besoins, métiers, types de pièce.
- **B. Contrat du Projet / Dossier formalisé** — prérequis d'entrée du moteur de décision.
- **C. Port d'accès au savoir** — interface de requête + sélection de cliché versionné.
- (Réserver aussi un champ **juridiction / locale** dans le schéma de fiche.)

## Risques

Dépendance circulaire : faible, **à condition** que le prix ne remonte jamais dans la
décision (ligne rouge absolue). Duplication : réelle sur le vocabulaire tant que l'ontologie
n'a pas de propriétaire. Complexité excessive : un moteur à chaînage avant dépasse le besoin
courant → démarrer à une passe. Évolution difficile : concentrée sur le futur langage de
conditions actionnables, volontairement différé. Mauvaise séparation : limitée à la frontière
décision/contrôles/confiance, corrigeable par écrit.

## Évolutivité

5 ans : sans réserve. 10 ans : solide, sous condition d'ontologie partagée + gouvernance du
référentiel. 15 ans : l'architecture tient ; les limites deviennent **organisationnelles**
(entretien du corpus, choix du langage de conditions, hypothèse d'un modèle de Projet unique),
pas structurelles. La technologie d'implémentation est correctement isolée.

## Compatibilité avec la V1.5

Trajectoire crédible et non-destructive : `moteur-recommandations.js` = prototype du moteur
de décision ; `normes.js` = graine de la famille Normes ; les « besoins » de `calculerDevis`
= faits dérivés codés en dur, à extraire plus tard **sans changer un montant** (d'où le jeu de
cas de référence). Tout est additif.

## Recommandations

Avant le Chapitre 3, poser les trois briques manquantes (Vocabulaire, Contrat du Projet, Port
d'accès au savoir) ; clarifier la frontière décision/contrôles/confiance ; harmoniser la
convention d'identifiants ; réserver un champ juridiction/locale ; maintenir la ligne rouge
« aucun prix dans la décision » ; constituer le jeu de cas de référence. Ce sont des **ajouts**,
pas des corrections.

## Conclusion

**Les Chapitres 1 et 2 peuvent-ils être considérés comme les fondations officielles du
Moteur DSBAT ?**

### ✅ OUI

La séparation savoir/décision est juste, les dépendances vont dans le bon sens, le moteur de
décision est indépendant des interfaces et des catalogues, le référentiel est générique et
versionné, et l'ensemble est compatible avec la V1.5 par ajout progressif. Les faiblesses
relevées ne sont **pas des erreurs à corriger** dans ces chapitres : ce sont des **briques
additionnelles** qui prolongent la fondation sans en contredire une ligne. Validation
prononcée, sous la réserve explicite que ces briques soient traitées comme **faisant partie
des fondations** — objet du document *Fondations complémentaires* (A, B, C, D).

*— Revue d'Architecture n°1, socle officiel du Moteur DSBAT.*
