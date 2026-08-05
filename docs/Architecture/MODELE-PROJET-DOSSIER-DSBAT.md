# Modèle Projet / Dossier DSBAT

> **Phase 2 · Mission A08 — Fondation d'architecture.** Ce document définit le **contrat officiel**
> du Projet DSBAT : la structure de données durable qui représentera un dossier, du configurateur
> web actuel jusqu'à la future API, le mobile et les franchisés. Ce n'est pas un simple objet
> JavaScript, c'est un **contrat** appelé à accompagner le logiciel pendant des années.
>
> *Mission d'architecture : aucun calcul, aucune interface, aucun comportement modifié. Une première
> implémentation minimale, additive et non branchée, accompagne le contrat (les trois Golden Master
> restent strictement identiques).*

---

## Objectifs

Le Modèle Projet répond à un manque structurel : aujourd'hui, un « projet » n'existe nulle part comme
**objet nommé**. Il est **éparpillé** dans des variables globales du navigateur (`chantier`,
`piecesSelectionnees`, `metiersActifs`) et dans des résultats transitoires (`window.__*`, retour de
`calculerDevis`). Cette dispersion empêche de sauvegarder, transporter, rejouer ou partager un
dossier de façon fiable.

Le contrat vise à ce qu'un même Projet DSBAT puisse être :

- **configuré** par le configurateur web actuel ;
- **calculé et exposé** par la future API DSBAT ;
- **saisi et consulté** depuis une application mobile ;
- **détenu et géré** par des franchisés (multi-tenant) ;
- **consommé** par les moteurs actuels et futurs ;
- **sauvegardé, exporté, importé** sans perte ni ambiguïté ;
- **rejoué à l'identique** (reproductibilité d'un calcul).

Un objectif transverse gouverne tous les autres : **une seule représentation** du dossier, la même
partout, pour supprimer les traductions implicites entre couches.

## Principes

1. **Le Projet est une donnée, pas un moteur.** Il *contient* entrées, décisions et résultats ; il ne
   *calcule* rien, ne *décide* rien, ne *modifie* aucune connaissance.
2. **Séparation entrée / sortie.** Le contrat distingue nettement l'**entrée** (chantier, pièces,
   métiers, décisions) de la **sortie** (résultats des moteurs). La sortie est toujours dérivable de
   l'entrée.
3. **Reproductibilité par construction.** Tout ce qu'il faut pour rejouer un calcul — entrée exacte +
   **versions** de toutes les briques — est stocké dans le Projet. Le moteur étant déterministe
   (Constitution P17), l'entrée et les versions suffisent : aucun aléa, aucun état caché.
4. **Aucun prix dans les décisions ni les journaux** (Constitution P3). Les prix vivent dans les
   résultats et le catalogue ; le Projet ne référence le catalogue que par sa **version**, jamais par
   son contenu.
5. **Le savoir reste au Référentiel** (P1/P2/P21). Le Projet ne recopie pas les règles : il stocke les
   **identifiants et versions** des fiches utilisées, obtenus via le Port.
6. **Additif, versionné, réversible.** Le contrat porte un numéro de version (`versionContrat`) ; il
   évolue par ajouts compatibles. La première implémentation n'est branchée nulle part.
7. **Stabilité de sérialisation.** Clés triées, sortie déterministe : indispensable pour les
   sauvegardes, les diffs et les empreintes.

## Responsabilités

| Brique | Responsabilité vis-à-vis du Projet |
|--------|-------------------------------------|
| **Modèle Projet** (`js/modele-projet.js`) | Assembler, lire, sérialiser, versionner, figer un dossier conforme. **Ne calcule ni ne décide jamais.** |
| **Moteurs** (`moteur-devis`, `moteur-piece`, `moteurs/*`) | Consommer l'**entrée** du Projet, produire les **résultats**. Ne connaissent pas le contenant. |
| **Port d'Accès au Savoir** | Fournir les fiches (identifiants + versions) que le Projet référence. Lecture seule. |
| **Journal de Décision** | Produire les événements que le Projet archive (sans prix). |
| **Référentiel** | Détenir la connaissance ; le Projet n'en stocke que des **références versionnées**. |
| **Orchestrateur** (A09, à venir) | Prendre un Projet en entrée, appeler les moteurs, rattacher les résultats. |
| **API** (A10, à venir) | Transporter le Projet (contrat = charge utile HTTP). |

## Structure proposée

Un Projet DSBAT est un objet à **onze sections**, regroupées en trois familles :

**Entrée (ce que l'utilisateur décide)**

- `identite` — id stable, référence lisible, statut de cycle de vie, auteur, franchise.
- `client` — coordonnées, avec minimisation RGPD.
- `chantier` — les 19 caractéristiques actuelles, normalisées.
- `metiers` — corps d'état actifs.
- `pieces` — pièces détaillées : dimensions + `config` (décisions par métier).
- `decisions` — choix explicites au-delà des `config` (recommandations acceptées / refusées).

**Sortie (ce que les moteurs produisent)**

- `resultats` — devis (retour de `calculerDevis`) + détail par pièce + horodatage + empreinte + drapeau `fige`.
- `journaux` — décisions observées (sans prix).

**Contexte & garanties**

- `references` — fiches de savoir utilisées (identifiant + version + état + origine).
- `versions` — versions de **toutes** les briques (contrat, référentiel, moteur, règles, catalogue prix).
- `metadonnees` — origine (web/api/mobile), locale, devise, étiquettes.
- `reproductibilite` — cliché de l'entrée + versions + **empreinte d'entrée** + `deterministe`.

## Contrat officiel

Le contrat formel est défini en **JSON Schema** : [`schema-projet-dsbat.schema.json`](./schema-projet-dsbat.schema.json)
(discriminant `"$contrat": "dsbat.projet"`, `versionContrat` SemVer). Forme de référence (abrégée) :

```json
{
  "$contrat": "dsbat.projet",
  "versionContrat": "1.0.0",
  "identite":   { "id": "…", "reference": null, "statut": "brouillon",
                  "creeLe": "…", "auteur": null, "franchise": null },
  "client":     { "type": "particulier", "nom": null, "adresse": {…}, "rgpd": {…} },
  "chantier":   { "typeProjet": "renov", "surface": 60, "codePostal": "77410",
                  "chauffage": "electrique", "…": "… (19 champs)" },
  "metiers":    ["peinture", "sols"],
  "pieces":     [ { "id": "salon", "dims": {…}, "solType": "parq_flot",
                    "config": { "peinture": { "PEINT_MUR": 1 } } } ],
  "decisions":  { "recommandationsAcceptees": [], "recommandationsRefusees": [] },
  "resultats":  { "devis": {…}, "parPiece": [], "calculeLe": "…",
                  "empreinte": "…", "fige": false },
  "journaux":   [ { "sequence": 1, "horodatage": 0, "type": "regle_appliquee", "donnees": {…} } ],
  "references": { "fiches": [ { "identifiant": "…", "version": "v0", "origine": "V1.5" } ] },
  "versions":   { "contrat": "1.0.0", "referentiel": "v0", "moteur": "V2-phase2",
                  "regles": "v0", "cataloguePrix": "v0" },
  "metadonnees":{ "source": "configurateur-web", "locale": "fr-FR", "devise": "EUR" },
  "reproductibilite": { "entree": {…}, "versions": {…},
                        "empreinteEntree": "ccae9158", "deterministe": true }
}
```

Ce contrat est **stable** : les consommateurs peuvent s'y fier. Il évolue par **ajouts compatibles**
(nouvelle propriété optionnelle → `versionContrat` mineure ; changement cassant → majeure).

## Relations avec les moteurs

Les moteurs ne connaissent **pas** le contenant Projet ; ils travaillent sur ses champs d'entrée.
La correspondance est directe, car le contrat épouse la réalité actuelle :

- `chantier` → paramètre `chantier` de `calculerPiece` / `calculerDevis` ;
- `pieces[].config` → décisions par métier consommées par `calculerPiece` / `appliquerRevetements` ;
- `metiers` → paramètre `metiers` (déjà explicite depuis A05) ;
- retour de `calculerDevis` → `resultats.devis` ; `calculerPiece` par pièce → `resultats.parPiece`.

L'Orchestrateur (A09) fera la jonction : `Projet(entrée) → moteurs → Projet(entrée + résultats)`, via
`attacherResultats()` qui **recopie** les sorties sans jamais recalculer dans le Modèle.

## Relations avec le Port

Le Projet ne duplique pas le savoir. Quand un moteur applique une fiche, l'identifiant et la
**version** de cette fiche (obtenus du Port : `obtenirVersion`, `obtenirFiche`) sont consignés dans
`references.fiches`. On sait ainsi *quelle version du savoir* a produit un résultat, sans figer le
contenu du Référentiel dans le dossier. Le Port reste l'unique porte d'accès (P6).

## Relations avec le Journal

`journaux` archive les événements du Journal de Décision (`{sequence, horodatage, type, donnees}`)
tels que produits par les observateurs — **sans prix ni code catalogue** (P3, déjà garanti :
missions M018/M019 montrent 0 prix / 0 code au Journal). Le Journal explique *pourquoi* une décision
a été prise ; le Projet en conserve la trace pour l'audit et la future explication (A11).

## Relations avec le Référentiel

Le Référentiel est la **source unique** de la connaissance (P21). Le Projet s'y rattache par la
**version** (`versions.referentiel`) et par les **références** de fiches, jamais par recopie. Rejouer
un projet ancien consistera à charger la version de référentiel enregistrée, puis à relancer le
moteur sur l'entrée figée — d'où l'importance de versionner le savoir (aujourd'hui `v0` / origine
`V1.5`, via le Port).

## Compatibilité API

Le contrat **est** la charge utile de l'API DSBAT (A10). Un `POST /projets` recevra un Projet en
entrée (identité + client + chantier + pièces + métiers) ; la réponse renverra le même Projet enrichi
de `resultats`, `journaux`, `references`, `reproductibilite`. `$contrat` et `versionContrat`
permettent la **négociation de version** entre client et serveur. La sérialisation stable garantit
des charges utiles déterministes (cache, ETags, idempotence).

## Compatibilité sauvegarde

`serialiser()` / `deserialiser()` produisent un JSON **stable** (clés triées) : une sauvegarde est un
simple fichier `.dsbat.json` conforme au contrat. `deserialiser()` **refuse** tout objet dont
`$contrat` n'est pas `dsbat.projet`, protégeant contre les imports malformés. La version du contrat
permet des **migrations** de sauvegardes anciennes (montée de `versionContrat`).

## Compatibilité multi-utilisateur

`identite.id` (stable, jamais réutilisé) et `identite.auteur` (avec `role`) permettent l'attribution
et le suivi. `modifieLe` / `valideLe` tracent le cycle de vie. Le gel des projets validés
(immutabilité) évite les conflits d'écriture sur un dossier signé. La concurrence fine (verrous,
révisions) relèvera de l'API (A10) ; le contrat en pose les fondations (identité + statut + versions).

## Compatibilité franchisés

`identite.franchise` (id + nom) rend le modèle **multi-tenant** dès l'origine : chaque dossier
appartient à une franchise. À terme, une franchise pourra disposer de son propre **Référentiel** (le
Port accepte déjà des sources injectées) ; `versions.referentiel` enregistrera *quel* référentiel a
servi. Le contrat étant commun, un dossier reste lisible par le réseau tout en respectant le
cloisonnement des données.

## Gouvernance

Règles officielles attachées au Projet :

1. **Immutabilité des résultats validés.** Le passage au statut `valide` **fige en profondeur** le
   dossier (`validerProjet` → gel récursif) : les résultats signés ne peuvent plus être altérés.
2. **Versionnement obligatoire.** Tout résultat porte les versions `contrat` / `referentiel` /
   `moteur` / `regles` / `cataloguePrix`. Un résultat sans versions n'est pas opposable.
3. **Traçabilité.** Entrée figée + références de fiches + journaux = chaîne complète « pourquoi ce
   résultat », auditable a posteriori (P4/P11).
4. **Reproductibilité contrôlée.** L'`empreinteEntree` détecte toute divergence d'entrée ; rejouer la
   même entrée avec les mêmes versions **doit** redonner le même résultat (déterminisme P17).
5. **Séparation des prix.** Décisions et journaux sans prix (P3) ; les prix ne vivent que dans
   `resultats`, et le catalogue n'est référencé que par version.
6. **Compatibilité ascendante.** Le contrat n'évolue que par ajouts compatibles ; les changements
   cassants imposent une **version majeure** et une stratégie de migration.

## Proposition d'implémentation progressive

Approche prudente, en marches successives — la marche 1 est **livrée** dans cette mission :

- **Marche 1 (A08, faite).** Contrat (JSON Schema) + module additif `js/modele-projet.js`
  (`creerProjetDSBAT`, `projetDepuisApp`, `attacherResultats`, `validerProjet`, `serialiser` /
  `deserialiser`, `conforme`, `empreinte`) **non branché** à l'UI. Prouvé par `a08-check.js` ;
  les trois Golden Master restent identiques.
- **Marche 2 (A09).** L'Orchestrateur consomme un Projet, appelle les moteurs, rattache les résultats
  — sans changer le rendu.
- **Marche 3 (A10).** Exposition API : le contrat devient la charge utile HTTP.
- **Marche 4.** Le configurateur lit/écrit progressivement *via* le Projet (sauvegarde locale, reprise
  de dossier) — additif, réversible, sous Golden Master.
- **Marche 5.** Versionnement réel du Référentiel et du catalogue (remplacer les `v0` par de vraies
  versions), franchisés multi-référentiels.

## Compatibilité avec la Constitution

**P1/P2** (le savoir reste au Référentiel ; le Projet n'en stocke que des références), **P3** (aucun
prix dans décisions/journaux ; catalogue référencé par version), **P4/P11** (traçabilité :
entrée + références + journaux), **P6** (versions/fiches obtenues via le Port), **P7** (responsabilité
unique : le Modèle structure, il ne calcule ni ne décide), **P16** (indépendance : contrat sans DOM ni
navigateur), **P17** (déterminisme au cœur de la reproductibilité), **P21** (source unique : le Projet
ne duplique jamais la connaissance).

## Compatibilité avec le Plan Directeur

C'est **exactement la mission A08** (Modèle du Projet), réalisée **dans l'ordre**, en **fondation**
pour l'Orchestrateur (A09) puis l'API (A10). L'approche est **additive et non intrusive** : le contrat
épouse la réalité actuelle du code (d'où une jonction future sans traduction), et la première
implémentation ne modifie aucun flux existant.

## Compatibilité avec la Charte

**Additive** (nouveau contrat + nouveau module + nouveau test ; rien de retiré), **réversible**
(supprimer `js/modele-projet.js` ne change rien, il n'est branché nulle part), **testable**
(`a08-check.js`, 18 assertions + trois Golden Master identiques), **documentée** (présent document +
JSON Schema). Aucune logique de calcul déplacée.

## Préparation de A09

**A09 (Orchestrateur).** Le Modèle fournit le **contenant d'entrée/sortie** attendu par
l'Orchestrateur : celui-ci prendra un Projet (`projetDepuisApp` au début, puis un Projet transmis),
appellera les moteurs sur son entrée, et rattachera les résultats via `attacherResultats()` — le tout
sans toucher au rendu. Le Golden Master du Modèle (A08) et les deux Golden Master de calcul
garantiront l'absence de régression lors de ce branchement.

## Conclusion

Le Projet DSBAT dispose désormais d'un **contrat officiel** : une structure unique, versionnée,
reproductible et gouvernée, capable de représenter un dossier du configurateur web jusqu'à l'API, le
mobile et les franchisés. Entrée et sortie sont séparées, les prix restent hors des décisions, le
savoir reste au Référentiel, et un projet validé devient immuable. La première implémentation est
**additive, non branchée et sans aucune régression** (trois Golden Master identiques). Cette fondation
ouvre l'Orchestrateur (A09) puis l'exposition API (A10) — une architecture pensée pour durer, plutôt
qu'une implémentation rapide.

*— MISSION A08 : le Projet DSBAT devient un contrat, pas une poignée de variables globales.*
