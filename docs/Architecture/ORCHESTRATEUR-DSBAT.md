# Orchestrateur DSBAT

> **Phase 2 · Mission A09 — Fondation d'architecture.** L'Orchestrateur est le **chef d'orchestre**
> du Moteur DSBAT : il reçoit un Projet (A08), coordonne les briques (contrat, Journal, Port, moteurs)
> et rend un Projet enrichi de ses résultats. **Il ne contient aucune logique métier, aucun calcul,
> aucune règle, aucun prix.** Il ne fait que *coordonner*.
>
> *Mission d'architecture : aucune interface, aucun comportement modifié. L'implémentation est
> additive et non branchée ; les trois Golden Master restent strictement identiques et le devis
> orchestré est byte-identique à la référence sur tous les cas.*

---

## Objectifs

Jusqu'ici, l'enchaînement des briques du moteur était **implicite**, dispersé dans le configurateur :
la page installait des variables globales, appelait `calculerDevis`, lisait des `window.__*`,
déclenchait les recommandations… Aucun composant ne portait, à lui seul, la responsabilité de
*coordonner* une exécution complète.

L'Orchestrateur crée ce composant : un **point d'entrée unique** qui, à partir d'un Projet, pilote
une exécution reproductible du moteur, de la validation du contrat jusqu'au Projet enrichi. Le même
Orchestrateur doit servir le **configurateur actuel** et la **future API DSBAT** — d'où l'exigence
d'une coordination **pure**, indépendante du navigateur et du HTML.

## Responsabilités

L'Orchestrateur assume **neuf responsabilités de coordination**, et rien d'autre :

1. **Recevoir** un Projet DSBAT.
2. **Valider** le contrat du Projet (délégué au Modèle : `conforme`).
3. **Initialiser** le Journal de Décision.
4. **Préparer** le Port d'Accès au Savoir (disponibilité ; il ne lit jamais le savoir lui-même).
5. **Appeler** les moteurs métier dans le bon ordre (via un port injecté).
6. **Collecter** leurs résultats.
7. **Construire** les résultats finaux (rattachés au Projet par le Modèle, sans recalcul).
8. **Renseigner** les versions.
9. **Produire** le Projet enrichi.

Ce qu'il **ne fait jamais** : aucune logique métier, aucun calcul, aucune quantité, aucun prix,
aucune règle de décision, aucun accès au DOM, aucune dépendance au navigateur. *Toute décision reste
la responsabilité des moteurs métier.*

## Architecture

L'Orchestrateur suit une **architecture hexagonale** (ports & adaptateurs). Il ne connaît pas la
mécanique des moteurs : il dialogue avec eux au travers d'un **port injecté**.

```
                 ┌──────────────────────────────────────────────┐
   Projet (A08) ─▶│                ORCHESTRATEUR                  │─▶ Projet enrichi
                 │  (coordination pure — 0 calcul, 0 prix)      │   (+ résultats, versions, journaux)
                 └───┬──────────┬──────────┬──────────┬─────────┘
                     │          │          │          │
              valide contrat  Journal    Port      PORT « moteurs »   ◀── injection de dépendance
              (Modèle)       (init)    (prépare)   { calculer(projet) }
                                                        │
                                                        ▼
                                          ADAPTATEUR moteurs (le SEUL à connaître
                                          les globales / l'environnement d'exécution)
                                                        │
                                                        ▼
                                          Moteurs classiques : calculerDevis, …
```

Trois pièces :

- **Le coordinateur** (`creerOrchestrateur(deps)`) : pur, sans effet de bord métier, injectable.
- **Le port `moteurs`** : contrat minimal `calculer(projet) → { devis, parPiece, references }`.
  C'est la **couture** entre coordination et calcul.
- **L'adaptateur par défaut** (`creerAdaptateurMoteursGlobaux`) : implémente le port en branchant les
  **moteurs classiques** (installe l'entrée du Projet là où `calculerDevis` la lit, puis l'appelle).
  C'est le **seul** composant qui connaît les globales — jamais l'Orchestrateur.

Ce découplage permet de remplacer l'adaptateur (Node, API, mobile, moteurs futurs) **sans toucher au
coordinateur**.

## Cycle d'exécution

`orchestrer(projet)` déroule une séquence stricte :

1. **Valider le contrat** — `modele.conforme(projet)`. Un projet non conforme est **rejeté** (erreur
   explicite), avant tout appel de moteur.
2. **Initialiser le Journal** — via `fabriqueJournal()` ; l'Orchestrateur y consigne uniquement des
   événements de **coordination** (`orchestration_demarree`, `port_pret`, `moteurs_appeles`,
   `orchestration_terminee`) — **jamais de prix** (P3).
3. **Préparer le Port** — disponibilité signalée. L'Orchestrateur ne lit pas le savoir ; ce sont les
   moteurs qui interrogent le Port.
4. **Appeler les moteurs** — `moteurs.calculer(projet)`. **Aucun calcul dans l'Orchestrateur** : tout
   est délégué au port.
5. **Collecter** — `{ devis, parPiece, references }`.
6. **Renseigner les versions** — fusion des versions du Projet et des versions supplémentaires.
7. **Produire le Projet enrichi** — `modele.attacherResultats(...)` (recopie, aucun recalcul), puis
   rattachement des versions et des journaux.

La sortie est `{ projet: <enrichi>, journal }`.

## Relations avec le Projet

Le Projet est **l'unité de travail** : entrée et sortie de l'Orchestrateur. En entrée, l'Orchestrateur
lit son **contrat** (`$contrat`, `versionContrat`) et son **entrée reproductible**
(`reproductibilite.entree` : chantier + pièces + métiers). En sortie, il rend le **même Projet**
enrichi de `resultats`, `versions` et `journaux`, toujours conforme au contrat. L'Orchestrateur ne
fabrique jamais le Projet lui-même (c'est le rôle du Modèle) ; il le **traverse**.

## Relations avec les moteurs

Les moteurs métier gardent **l'entière responsabilité** du calcul et des décisions. L'Orchestrateur
les appelle à travers le port `moteurs`, sans connaître leur contenu. L'adaptateur par défaut
reproduit **exactement** le flux du configurateur actuel : il installe `chantier`,
`piecesSelectionnees`, `metiersActifs` puis appelle `calculerDevis` — d'où un résultat **byte-identique**
à la référence Golden Master. Demain, un adaptateur API fera de même côté serveur, sans changer le
coordinateur.

## Relations avec le Port

L'Orchestrateur **prépare** le Port (le rend disponible aux moteurs) mais ne l'interroge jamais :
lire le savoir reste le travail des moteurs de décision (P6). Le Port étant à sources injectées, un
Orchestrateur peut être configuré avec le Référentiel d'une franchise sans modification de code —
la préparation du Port est un simple point d'injection.

## Relations avec le Journal

L'Orchestrateur **initialise** le Journal et y écrit la **trame de coordination** de l'exécution
(début, port prêt, moteurs appelés, fin). Ces événements sont **sans prix** (P3) et décrivent le
*déroulé*, pas les *décisions métier* (celles-ci sont journalisées par les observateurs des moteurs).
Le Journal complet est ensuite **rattaché** au Projet enrichi (`projet.journaux`), pour l'audit et la
future explication (A11).

## Relations avec le Golden Master

Le Golden Master est le **juge** de cette mission. La preuve `a09-check.js` construit un Projet à
partir de chaque cas figé, l'orchestre, et compare le `resultats.devis` produit à `reference.json` :
il doit être **byte-identique sur les 5 cas**. Les deux Golden Master de calcul (devis + par pièce) et
le Golden Master du domaine reco/oublis restent par ailleurs **identiques** — l'Orchestrateur, étant
additif et non branché, ne peut rien changer au comportement existant.

## Première implémentation

Livrée dans cette mission, **additive et non branchée** :

- **`js/orchestrateur.js`** — `creerOrchestrateur(deps)` (coordinateur pur) +
  `creerAdaptateurMoteursGlobaux(opts)` (adaptateur par défaut vers les moteurs classiques).
  Dépendances **injectables** : `moteurs` (obligatoire), `modele`, `fabriqueJournal`, `port`,
  `horloge` (défaut `null` pour le déterminisme), `versions`.
- **`tests/golden-master/a09-check.js`** — 17 assertions : identité du devis sur tous les cas,
  journal de coordination sans prix, rejet d'un projet non conforme, refus explicite en l'absence de
  port `moteurs`, Projet enrichi conforme (résultats + versions + journaux).

Rien n'est référencé par `devis-configurateur.html` : inclure ou non `orchestrateur.js` ne change
aucun comportement.

## Validation

```
node a09-check.js                  → ✅ 17 assertions OK (5 cas : devis identiques à la référence)
node golden-master.js verify       → ✅ Golden Master IDENTIQUE — aucune régression
node piece-golden-master.js verify → ✅ Golden Master PIÈCE IDENTIQUE — aucune régression
node reco-oublis-domain-golden.js verify → ✅ domaine reco/oublis IDENTIQUE
node a08-check.js                  → ✅ Modèle Projet (18 assertions) inchangé
node --check js/orchestrateur.js   → ✅ syntaxe OK
```

Le devis orchestré est **strictement identique** à la référence : l'Orchestrateur **ne modifie aucun
résultat**. Le configurateur, non modifié, continue de fonctionner à l'identique.

## Compatibilité avec la Constitution

**P3** (journal de coordination sans prix), **P6** (le savoir n'est lu qu'au travers du Port, par les
moteurs — pas par l'Orchestrateur), **P7** (responsabilité unique : coordonner, jamais décider ni
calculer), **P11** (traçabilité : trame de coordination journalisée et rattachée au Projet), **P16**
(indépendance : coordinateur sans DOM ni navigateur), **P17** (déterminisme : horloge injectable,
défaut `null` ; devis reproductible), **P21** (source unique : l'Orchestrateur ne duplique ni savoir
ni calcul, il délègue).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission A09** (Orchestrateur), réalisée **dans l'ordre**, en **fondation** entre
le Modèle du Projet (A08) et l'exposition API (A10). Approche **additive et non intrusive** :
l'adaptateur par défaut épouse le flux existant (résultat identique), et le coordinateur est prêt à
recevoir demain un adaptateur API.

## Compatibilité avec la Charte

**Additive** (nouveau module + nouveau test ; rien de retiré), **réversible** (supprimer
`js/orchestrateur.js` ne change rien, il n'est branché nulle part), **testable** (`a09-check.js`
+ quatre Golden Master verts), **documentée** (présent document). Aucune logique de calcul déplacée
ni créée.

## Préparation de A10

**A10 (Exposition API).** L'Orchestrateur est le **cœur d'exécution** que l'API enveloppera : un
`POST /projets/calcul` désérialisera un Projet (contrat A08), appellera `orchestrer(projet)` avec un
**adaptateur moteurs côté serveur**, et renverra le Projet enrichi sérialisé. Le coordinateur ne
changera pas : seul l'adaptateur (et le transport HTTP) sera ajouté. Le Golden Master A09 garantira
que l'exécution serveur produit les mêmes résultats que le configurateur.

## Conclusion

Le Moteur DSBAT dispose désormais d'un **Orchestrateur officiel** : un coordinateur **pur** qui
reçoit un Projet, valide son contrat, initialise le Journal, prépare le Port, appelle les moteurs via
un port injecté, collecte les résultats, renseigne les versions et produit le Projet enrichi — **sans
aucune logique métier, aucun calcul, aucun prix**. Le devis orchestré est **byte-identique** à la
référence sur tous les cas ; les quatre filets Golden Master sont verts ; le configurateur est
inchangé. Cette fondation, additive et réversible, sert aussi bien le configurateur actuel que la
future API DSBAT (A10). Une architecture pensée pour durer, plutôt qu'une exécution câblée en dur.

*— MISSION A09 : le Moteur DSBAT a un chef d'orchestre — qui coordonne, sans jamais jouer à la place des musiciens.*
