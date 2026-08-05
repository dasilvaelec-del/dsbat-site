# Bilan officiel de la Phase 1 — Moteur DSBAT V2

> **Document de référence historique et de gouvernance.** Il marque la fin de la Phase 1 de la V2 et
> explique *pourquoi* le logiciel a été transformé de cette manière. Destiné à être relu dans
> plusieurs années pour comprendre les choix fondateurs. *Aucun code.*

---

## Historique

Le projet DSBAT est né comme un **configurateur de devis** (V1), enrichi progressivement, puis
consolidé (V1.5 : modularisation, fiabilisation). Fin de la V1.5, le logiciel fonctionnait
correctement mais son savoir métier était **dispersé et imbriqué** dans le calcul et l'interface.

La **V2** a démarré non par du code, mais par une **phase de conception** : Constitution, Charte,
Plan Directeur, Référentiel de Connaissances, Ontologie, Port d'Accès au Savoir, Journal de Décision,
Modèle des objets. Puis une **phase de migration**, objet du présent bilan, qui a fait entrer cette
architecture dans le logiciel existant, **sans jamais casser son comportement**.

Repères de la Phase 1 : mise en place du **Golden Master** (M005), du **Port** (M006), du **Journal**
(M007), première **journalisation passive** (M008), puis migration successive de **neuf domaines
métier** (Cohérence, VMC, Isolation, Plomberie, Chauffage, Tableau, Peinture, Sols, Carrelage),
encadrée par deux missions d'architecture (A01 : analyse de `recalcPiece` ; A02 : extension du Golden
Master au calcul par pièce) et une extraction (M016 : `appliquerRevetements`).

## Situation avant la V2

- **Un savoir imbriqué** : normes, règles métier, seuils et implications vivaient *à l'intérieur* des
  moteurs de calcul et parfois du HTML. Modifier une règle, c'était modifier du code de calcul.
- **Pas de filet** : aucune garantie automatique qu'une évolution ne changeait pas un devis.
- **Un couplage fort à l'interface** : une partie de la logique dépendait du DOM (calcul par pièce
  déclenché depuis l'affichage).
- **Une valeur réelle mais fragile** : le logiciel produisait de bons devis, mais chaque évolution
  était risquée, faute de séparation et de vérification.

## Objectifs

Transformer le configurateur en **moteur d'expertise durable**, **sans réécriture** et **sans
interruption** : séparer le savoir du calcul et du prix, rendre chaque décision **explicable**,
garantir la **non-régression** à chaque pas, et préparer les canaux futurs (API, mobile, franchises,
IA) — le tout à comportement utilisateur **strictement inchangé**.

## Architecture retenue

Une architecture **en couches**, à dépendances descendantes (rien ne remonte) :

```
Interfaces → Exposition (API) → Orchestrateur → Moteurs
                                                   ↓ lisent
                            { Connaissances (Référentiel via Port), Modèle du Projet }
```

Principe cardinal : **le savoir est de la donnée, le moteur est du calcul**. Le savoir vit dans le
Référentiel, s'interroge par le **Port**, et chaque raisonnement se trace dans le **Journal**. Le
prix ne participe jamais à une décision.

## Golden Master

**Le filet avant le trapèze.** Le Golden Master est un **contrat de non-régression** : un jeu de cas
de référence figé, capturé sur la V1.5, et un harnais qui rejoue le cœur du logiciel et **compare au
bit près**. Deux niveaux existent aujourd'hui : le **devis complet** (`calculerDevis`, contrôles,
recommandations — M005) et le **calcul par pièce** (`calculerPiece`, `appliquerRevetements` — A02).
Aucune migration n'a été autorisée sans lui, et chacune s'est conclue par « Golden Master
identique ». C'est l'outil qui a rendu la transformation **sûre**.

## Port d'Accès au Savoir

Le **guichet unique de lecture** vers les connaissances. Les moteurs n'accèdent plus directement aux
normes ou aux règles : ils **interrogent le Port**, qui fournit fiches, justifications, références et
versions — **jamais** de prix, **jamais** de décision (il distingue les fiches *candidates* de leur
*application*). Introduit en simple relais au-dessus des sources existantes, il expose désormais des
dizaines de fiches (normes + règles métier de tous les domaines), toutes **référençant les vrais
paramètres** des moteurs (source unique, aucune duplication).

## Journal de Décision

Le **témoin passif** du raisonnement. Il enregistre, dans l'ordre, faits, connaissances consultées,
décisions et métré — **jamais un prix ni un code catalogue**. Immuable, isolé des objets du moteur
(données clonées), il ne peut pas influencer le calcul. Il rend le raisonnement **explicable** et
prépare les audits, les explications de devis, les niveaux de confiance et l'IA.

## Pattern DSBAT

La méthode officielle, éprouvée sur neuf domaines :

1. **Ne pas toucher au moteur** : les calculs, quantités et prix restent la source unique.
2. **Exposer les connaissances au Port** comme fiches `REGLE_METIER`, en référençant les vrais
   paramètres (source unique) — sans prix ni code catalogue.
3. **Observer passivement** le raisonnement *après coup* (lecture des résultats déjà produits) et le
   **journaliser** (sans prix).
4. **Valider** par le(s) Golden Master : identité stricte, sinon on ne bascule pas.
5. **Additif et réversible** : nouveaux fichiers, chargés par aucune page tant que non nécessaires ;
   suppression sans trace possible.

## Migrations réalisées

| # | Domaine | Nature | Résultat vérifié |
|---|---------|--------|------------------|
| M010 | Cohérence | contrôles (sans prix) | alertes identiques |
| M011 | VMC | chiffrage | 767 € HT identique |
| M012 | Isolation | métré informatif | métré identique |
| M013 | Plomberie | chiffrage réseaux | 1746 € HT identique |
| M014 | Chauffage | chiffrage **couplé** (→ tableau) | 1053 € HT + circuits identiques |
| M015 | Tableau électrique | **hub** (agrège les métiers) | 1002 € HT + dépendances identiques |
| M017 | Peinture | métier « par pièce » | 1170 € HT identique |
| M018 | Sols | métier « par pièce » | montant identique (perte lue via le Port) |
| M019 | Carrelage | métier « par pièce » | métré identique |

Encadrement : **A01** (analyse de `recalcPiece` — le calcul pur était déjà extrait), **A02**
(extension du Golden Master au calcul par pièce), **M016** (extraction de `appliquerRevetements` vers
un module, à comportement identique). À chaque étape, **aucune régression**.

## Enseignements

- **Le calcul pur était déjà largement isolé** (MISSION 047) : `recalcPiece` était devenu un
  contrôleur ; le plus dur avait été fait avant la V2.
- **Le pattern est universel** : il a absorbé un moteur de contrôle, des moteurs de chiffrage, un
  moteur **couplé**, un **hub** central, un moteur de **métré informatif** et des métiers **couplés à
  l'interface** — sans changer de méthode.
- **La frontière du prix est nette et tenue** : le prix reste dans le moteur/catalogue, jamais dans
  le savoir ni le Journal — c'est ce qui distingue proprement chaque nature de moteur.
- **Le Port sert aussi les explications** : lire un coefficient depuis une fiche pour justifier une
  décision (Sols, Carrelage) enrichit la trace sans recalculer ni dupliquer.
- **Observer après coup, jamais pendant** : cette règle a permis de tracer même les couplages
  (Chauffage → Tableau) sans les perturber.

## Pourquoi cette stratégie a fonctionné

Cinq facteurs expliquent la transformation **sans régression** :

1. **Le filet d'abord.** Le Golden Master a précédé toute migration ; le critère « identique au bit »
   a rendu chaque écart immédiatement visible. La discipline « comparer avant de basculer » n'a
   jamais été contournée.
2. **L'additivité.** Chaque migration a **ajouté** du code (fiches, observateurs, tests) sans
   modifier les moteurs ; l'immense majorité des étapes n'a **touché aucun fichier livré**. Le risque
   était donc structurellement borné.
3. **L'observation passive.** En lisant les résultats *déjà produits* au lieu d'instrumenter les
   calculs, on a garanti l'absence d'effet de bord — le moteur ne « savait » même pas qu'il était
   observé.
4. **La source unique.** Les fiches référencent les vrais paramètres ; aucune valeur n'a été
   recopiée, donc aucune divergence possible entre le savoir exposé et le calcul.
5. **Le déterminisme.** Des moteurs purs et déterministes ont rendu la comparaison fiable et
   reproductible — condition sine qua non d'un filet de non-régression crédible.

À quoi s'ajoute un facteur de gouvernance : **des documents fondateurs écrits avant le code**
(Constitution, Charte, Plan Directeur) qui ont servi d'arbitre constant — au point que le choix de la
première migration (le Golden Master) a été **imposé par la Charte elle-même**.

## Gains obtenus

- **Non-régression prouvée** en continu (deux Golden Master, dizaines de vérifications).
- **Savoir centralisé et citable** : normes et règles de tous les domaines accessibles par un point
  unique, chacune identifiée.
- **Raisonnement explicable** : le Journal reconstitue la chaîne faits → connaissances → décision →
  métré.
- **Séparation nette** savoir / calcul / prix, tenue sur tous les domaines.
- **Réversibilité** : chaque brique est additive et supprimable sans trace.
- **Allègement du monolithe** : le HTML a commencé à se dégraisser (extraction des revêtements).

## Risques évités

- **Le big-bang** (réécriture globale) — proscrit par la Constitution, jamais entrepris.
- **La régression silencieuse** — rendue impossible par le Golden Master.
- **La fuite de prix dans le savoir ou la décision** — interdite et vérifiée à chaque migration.
- **La duplication de valeurs** — évitée par la source unique.
- **La dérive d'architecture** — cadrée par la Charte et une grille de conformité constante.

## État actuel de l'architecture

- **Fondations** : Référentiel (conception), Ontologie, Port, Journal — en place.
- **Filets** : Golden Master **devis** et **par pièce** — opérationnels et déterministes.
- **Moteurs** : les neuf domaines exposent leur savoir au Port et tracent leur raisonnement au
  Journal, calculs et prix inchangés.
- **Observateurs passifs** : présents pour chaque domaine, non branchés à l'interface (inertes côté
  navigateur).
- **Interface** : `recalcPiece` reste un contrôleur (lecture DOM → calcul → affichage) ; le calcul
  pur vit dans des modules.

## Ce qui reste à réaliser

- **Découpler les fonctions reco/oublis** (domaine vs rendu) pour router leur part domaine via le
  Port et le Journal.
- **Passer `metiersActifs` en paramètre** du module de revêtements (retirer le couplage global).
- **Sortir `tauxTVA`** du HTML vers un module (dernière règle logée dans l'interface).
- **Brancher réellement** (à terme, prudemment) les observateurs et le savoir dans le flux
  d'explication du devis — aujourd'hui encore purement passifs.
- **Formaliser l'Orchestrateur et l'API d'Exposition** (couches de construction prévues par la
  charte, au-dessus du socle).

## Nouvelle feuille de route

- **Phase 1 bis (finitions d'architecture)** : reco/oublis domaine/rendu ; `metiersActifs` en
  paramètre ; extraction de `tauxTVA` ; extraction éventuelle de `recalcPiece` vers `ui.js`.
- **Phase 2 (activation)** : construire l'**Orchestrateur** et l'**API d'Exposition** ; brancher le
  Journal comme source des explications du devis ; introduire les **niveaux de confiance** à partir
  des signaux déjà émis.
- **Phase 3 (ouverture)** : multi-catalogues, profils **entreprise/franchise**, puis les canaux
  externes (mobile, IA), sans toucher au socle.

## Vision

L'architecture prépare **naturellement**, et sans remettre en cause le travail déjà réalisé :

- **Une API DSBAT** : l'Exposition n'est qu'un adaptateur au-dessus de moteurs purs déjà en place ; le
  configurateur web en deviendra le premier client.
- **Une base de connaissances centralisée** : le Référentiel derrière le Port ; on remplace le
  magasin sans toucher aux moteurs, versionnement compris.
- **Une application mobile** : mêmes moteurs, mêmes fiches, via l'API ou embarqués — le cœur ne dépend
  d'aucune interface.
- **Des franchisés** : un **profil** apporte prix, zones et règles ; le Port route vers le référentiel
  de la franchise, transparent pour les moteurs.
- **Un moteur Dépannage** : un nouveau moteur qui lit le même Projet et interroge le même Port — un
  domaine de plus, pas une refonte.
- **Un moteur d'Approvisionnement** : les besoins abstraits (déjà distincts des prix) se relient à des
  catalogues fournisseurs ; l'appro devient un consommateur du Port et du Catalogue.

Le fil conducteur : parce que le savoir, la décision, le calcul et le prix sont **séparés**, chaque
nouveau canal ou domaine **s'ajoute** au lieu de remettre en cause l'existant.

## Conclusion

La Phase 1 de la V2 a atteint son but : faire entrer une **architecture d'expertise durable** dans un
logiciel vivant, **domaine par domaine**, **sans une seule régression** et **sans changement visible
pour l'utilisateur**. Neuf métiers suivent désormais le pattern DSBAT ; le savoir est centralisé et
citable, le raisonnement traçable, les prix protégés, et l'ensemble tenu par deux filets de
non-régression. Le socle est **stable, explicable et ouvert** — prêt pour l'activation (Phase 2) et
l'ouverture (Phase 3), sans jamais remettre en cause ce qui a été construit.

Si ce document est relu dans plusieurs années, qu'il retienne une chose : **la transformation a
réussi parce qu'elle a refusé le big-bang, posé le filet avant tout, et respecté, à chaque pas, la
règle qu'elle s'était donnée.**

*— Bilan officiel de la Phase 1, Moteur DSBAT V2.*
