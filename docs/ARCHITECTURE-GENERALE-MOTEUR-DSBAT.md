# Architecture Générale du Moteur DSBAT

> **Document de synthèse — porte d'entrée officielle du projet.**
> À lire en premier pour comprendre ce qu'est le Moteur DSBAT, comment il fonctionne et
> pourquoi il est construit ainsi. Il ne remplace aucun document fondateur ; il les relie.
> *Aucun code, aucune modification des chapitres existants.*

Documents fondateurs reliés par cette synthèse : Constitution · Chapitre 1 (Référentiel de
Connaissances) · Chapitre 2 (Moteur de Décision) · Revue d'Architecture n°1 · Fondations
complémentaires · Chapitre 3 (Modèle des objets du bâtiment).

---

## Vision

Le Moteur DSBAT est un **moteur d'expertise du bâtiment**. À partir de la description d'un
chantier, il détermine **ce qu'il faut faire, pourquoi, et selon quelles règles** — puis laisse
le calcul et le chiffrage produire un devis **juste et explicable**.

En une phrase : *le Moteur DSBAT transforme des connaissances métier en décisions traçables,
qui deviennent un devis que l'on peut toujours justifier.*

---

## Philosophie

**Ce n'est pas un simple configurateur de devis.** Un configurateur additionne des lignes et
des prix. Le Moteur DSBAT, lui, **raisonne** : il sait qu'une douche à l'italienne impose une
étanchéité, qu'un logement ancien appelle une mise aux normes, qu'un tableau proche de sa
capacité doit être anticipé. Le devis n'est que la **conséquence chiffrée** de ce raisonnement.

Sa vocation : être le **cœur durable** du logiciel, indépendant de l'interface et de la
technologie, capable d'alimenter demain un site web, une application mobile, une API, un
logiciel franchisé et des agents IA — **sans être réécrit**. Le configurateur actuel n'est que
son *premier client*, pas sa finalité.

Le fil conducteur tient en quatre séparations : **le savoir** (ce que DSBAT sait), **la
décision** (ce qu'il faut faire), **le calcul** (combien il en faut) et **le prix** (combien
ça coûte) ne se mélangent jamais.

---

## Les couches

Deux couches sont **transversales** (elles gouvernent tout, sans être des étapes) :

- **La Constitution** — la règle suprême. Elle n'exécute rien : elle fixe les principes que
  toutes les autres couches respectent.
- **Le Modèle des objets / Vocabulaire** — la langue commune (Pièce, Paroi, Douche, Circuit…)
  que toutes les couches parlent à l'identique.

Les autres couches forment le **parcours de traitement**, du chantier au devis :

| Couche | Rôle en une phrase |
|--------|--------------------|
| **Référentiel de Connaissances** | Détient tout le savoir : normes, règles métier, recommandations, options — sans aucun prix. |
| **Moteur de Décision** | Lit les faits + le savoir et décide **quelles règles s'appliquent et pourquoi**. Ne calcule ni prix ni quantité. |
| **Modèle des objets du bâtiment** | Fournit le langage d'objets partagé par tous (le chantier « en objets »). |
| **Moteurs métier** | Calculent **les quantités et dimensionnements** (tableau, VMC, plomberie, chauffage…) à partir des décisions. |
| **Catalogue** | Fait correspondre les besoins à des **références et des prix** (multi-fournisseurs possible). |
| **Orchestrateur** | Le chef d'orchestre : enchaîne les couches dans le bon ordre et assemble un résultat unique. |
| **Calcul du devis** | Produit le **Total HT / TVA / TTC** et les acomptes, à partir des prestations chiffrées. |
| **Sorties : PDF / API / Application / IA** | Présentent le même résultat sur chaque canal, sans jamais toucher au cœur. |

Vue empilée :

```
        LA CONSTITUTION  ── règle suprême, au-dessus de tout ──┐
                                                                │
   Projet (Dossier)  ──► décrit en ► MODÈLE DES OBJETS (langue commune)
        │
        ▼
   RÉFÉRENTIEL DE CONNAISSANCES  ──►  MOTEUR DE DÉCISION
        (le savoir)                     (choisit les règles, explique)
                                            │  décisions + besoins
                                            ▼
                                     MOTEURS MÉTIER  (quantités)
                                            │
                                            ▼
                                       CATALOGUE  (références + prix)
                                            │
                                            ▼
                                     ORCHESTRATEUR ──► CALCUL DU DEVIS
                                                              │
                                            ┌─────────────────┼───────────────┐
                                            ▼                 ▼               ▼
                                          PDF               API / App        IA
```

---

## Les responsabilités

Chaque question a **une** réponse — une seule couche par responsabilité :

| Question | Couche responsable |
|----------|--------------------|
| **Qui sait ?** | Le Référentiel de Connaissances |
| **Qui décide ?** | Le Moteur de Décision |
| **Qui calcule (les quantités) ?** | Les moteurs métier |
| **Qui chiffre (les prix) ?** | Le Catalogue |
| **Qui explique ?** | Le Journal de Décision |
| **Qui contrôle ?** | La couche Contrôles (alertes, incohérences, oublis) |
| **Qui parle la langue commune ?** | Le Modèle des objets / Vocabulaire |
| **Qui assemble le tout ?** | L'Orchestrateur |
| **Qui garantit les règles du jeu ?** | La Constitution |

---

## Les flux

L'information circule **du réel vers le devis**, en une seule direction :

1. **Le Projet** décrit le chantier (pièces, dimensions, équipements, choix), dans le
   vocabulaire commun.
2. Le **Moteur de Décision** confronte ces **faits** au **savoir** du Référentiel et produit
   des **décisions** (règles applicables + justifications) et des **besoins** abstraits.
3. Les **moteurs métier** transforment ces besoins en **prestations** (quantités,
   dimensionnements).
4. Le **Catalogue** attache aux prestations des **références et des prix**.
5. Le **Calcul du devis** en tire **HT / TVA / TTC**.
6. Les **sorties** (PDF, API, application, IA) présentent le résultat.

À chaque étape, on **enrichit** sans jamais revenir en arrière ni créer de boucle. Et le
**prix ne remonte jamais** influencer une décision.

---

## Les décisions

Le Moteur de Décision est le cerveau. Il **sélectionne** les règles applicables, gère leurs
**enchaînements** sans boucle (une règle peut en déclencher une autre), **résout les conflits**
par une hiérarchie explicite (une norme prime une recommandation), et **classe** ses sorties :
obligations, recommandations (jamais imposées), contrôles à réaliser. Il ne calcule aucun prix
et ne modifie jamais le devis d'autorité : **le logiciel propose, l'humain décide.**

---

## La traçabilité

Toute décision est suivie **de la règle jusqu'à la ligne du devis**. Exemple concret :

```
Douche à l'italienne détectée en SDB-1
   └─► Règle RM-024 + Norme DTU-52.2   (le POURQUOI)
        └─► Décision : « étanchéité requise »
             └─► Besoin : étanchéité sous carrelage
                  └─► Prestation : mise en œuvre de l'étanchéité   (le COMBIEN)
                       └─► Ligne du devis chiffrée par le Catalogue   (le PRIX)
```

Le **Journal de Décision** conserve toute la chaîne, avec la **version** des règles utilisées.
On peut donc, pour n'importe quelle ligne d'un devis — même ancien — remonter jusqu'à la règle
et à la version qui l'ont justifiée.

---

## Les évolutions futures

L'architecture est faite pour **ajouter sans casser** :

- **IA** : elle lit les décisions et le Journal pour expliquer et proposer — elle n'invente
  jamais de connaissance.
- **API / Application mobile / CRM** : ce sont de nouvelles *sorties* branchées au-dessus du
  cœur, qui ne le modifient pas.
- **Multi-fournisseurs** : plusieurs catalogues coexistent ; le cœur (agnostique aux prix) ne
  bouge pas.
- **Multi-entreprises / franchises** : chaque profil apporte ses prix, ses zones et ses règles
  optionnelles, sans toucher aux moteurs.
- **Nouveaux métiers / équipements / réglementations** : on ajoute des fiches au Référentiel et
  des spécialisations au Modèle — les fondations ne changent pas.

**Le cycle de vie du moteur** illustre comment il progresse :

```
Connaissance ─► Décision ─► Calcul ─► Devis ─► Validation ─► Retour d'expérience
      ▲                                                                │
      └──────────────  Amélioration des connaissances  ◄──────────────┘
```

Le moteur **apprend en enrichissant son savoir**, pas en changeant ses principes. Chaque retour
du terrain affine les fiches du Référentiel ; les fondations, elles, restent stables.

---

## Pourquoi cette architecture

Parce qu'elle sépare ce qui **change vite** (le savoir, les prix) de ce qui doit **rester
stable** (les principes, la décision, le modèle). Cette séparation, combinée à la
**traçabilité**, au **versionnement** (les anciens devis restent reproductibles) et à
l'**indépendance vis-à-vis de l'interface et de la technologie**, donne un système que l'on
peut faire évoluer pendant des années sans le réécrire. La technologie d'aujourd'hui est un
simple *détail d'implémentation* : les principes, eux, survivent à une réécriture.

---

## Conclusion

Le Moteur DSBAT n'est pas un configurateur : c'est un **moteur d'expertise** dont le devis est
la sortie visible. Son architecture en couches — gouvernée par la Constitution, parlant une
langue commune, séparant savoir / décision / calcul / prix, et traçant chaque décision —
constitue un socle **clair, explicable et durable**.

Ce document est la **porte d'entrée** du projet : quiconque le découvre doit pouvoir, après
cette lecture, situer chaque couche, comprendre qui fait quoi, et suivre une décision de la
règle jusqu'au devis. Pour approfondir, se reporter à la Constitution puis aux Chapitres 1, 2
et 3.
