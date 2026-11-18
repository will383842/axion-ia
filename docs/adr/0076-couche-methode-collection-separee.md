# ADR 0076 — Couche « Méthode » : une collection interne, jamais publiable, jamais lue par un visiteur

- **Statut** : **proposé** — livrée derrière des interrupteurs éteints, à valider par le fondateur
- **Date** : 2026-11-18
- **Référence** : `prisma/schema.prisma` (`KnowledgeEntry`, `KnowledgeCollection`) ; `src/lib/knowledge/search-fts.ts` ; `src/lib/contenu/interdits-publication.ts` ; mode d'emploi : `docs/knowledge/COUCHE-METHODE.md`

## 1. Contexte

L'équipe tient des fiches de vente internes (méthodes, scripts, objections, postures), écrites
dans le dépôt de marque, privé. Elles aideront un jour les outils qui rédigent pour un client.
Ce dépôt-ci est **public** : le contenu des fiches, leurs titres et leurs montants
d'entraînement n'y entrent jamais. Cet ADR décrit seulement les règles.

## 2. Décision

### 2.1 Modèle : on réutilise, aucune migration

`KnowledgeEntry` + `KnowledgeTranslation` (locale `fr`) + `KnowledgeCollection` /
`KnowledgeCollectionItem` + `KnowledgeTag` / `KnowledgeTagOnEntry`. Les énumérations
nécessaires existent déjà. **Aucune migration, aucune suppression de données.**

Une table à part coûterait une migration pour un cloisonnement que les verrous ci-dessous
donnent déjà. Le critère « jamais dans `knowledge_entries` » est donc remplacé par :
**jamais publiable, jamais lue par un lecteur public**, prouvé par test.

### 2.2 Cloisonnement

| Champ                   | Valeur                             | Pourquoi                                                |
| ----------------------- | ---------------------------------- | ------------------------------------------------------- |
| `audience`              | `team`                             | jamais `public`                                         |
| `confidentiality`       | `internal`                         | la recherche publique exige `public`                    |
| `status`                | `approved`, **jamais** `published` | la recherche publique exige `published` / `deprecated`  |
| `publishedAt`           | nul                                | aucune page, aucun sitemap                              |
| `sourceFactoryId`       | `methode-import`                   | l'import ne touche jamais une entrée d'une autre source |
| collection `visibility` | `team`, `publishedAt` nul          |                                                         |

Les lecteurs publics de `knowledge_entries` exigent tous le statut publié et/ou l'audience
publique et/ou la confidentialité publique ; l'envoi au service d'embarquement exige la
confidentialité publique. Le texte de la couche ne part donc chez aucun prestataire.
Un test (`jamais-publiee.spec.ts`) le prouve sur une base factice.

**Garde de publication** : `executeTransition` (`src/server/actions/knowledge/_transition.ts`)
refuse `published` **et** `scheduled` (la programmation) pour toute entrée
`sourceFactoryId = methode-import`, quel que soit le rôle. Une fiche Méthode ne peut pas être
publiée depuis la console.

### 2.3 Sources acceptées (liste blanche, codée dans l'import)

Depuis une copie **locale** du dossier source, seulement `livres/*.md` et
`livres/important-a-savoir/*.md`. Tout le reste est ignoré et **compté** : les fiches non
validées, le dossier du secteur santé (à rouvrir par une fiche à part), les résumés bruts,
les contrôles, les notices, les doublons non nettoyés. La collection du secteur santé
n'est pas créée.

### 2.4 Import : un geste humain, jamais une routine

- `--source <chemin local>` obligatoire ; sans lui, refus, aucun client de base construit ;
- écrit seulement avec `--ecrire`, refusé si `CI` est posé ou si l'entrée standard n'est pas
  un terminal ; essai à blanc par défaut ;
- une fiche qui porte un courriel, un téléphone ou un nom listé dans un fichier local
  (`--noms-sensibles`) est refusée ; le journal n'écrit que des comptes, des slugs et des
  motifs, **jamais le texte** ;
- aucun workflow, worker, cron ni script de `package.json` ne l'appelle (test) ;
- idempotent sur le slug `methode/<fichier>/<section>` ; jamais de suppression.

### 2.5 Filtre de sortie unique

`filtrerPourSortie` (`src/server/methode/filtre-sortie.ts`) est appliqué au noyau **et** aux
extraits. Il refuse toute fiche : étiquetée `chiffres-exercice`, `doctrine:a-revoir` ou
`secteur:sante` ; contenant un montant (euros, dollars, multiplicateurs k, M, mille, million,
HT/TTC, milliards, avec ou sans devise), un courriel (y compris masqué : « [at] »,
« arobase », « @ » entouré d'espaces) ou un téléphone (y compris indicatif entre
parenthèses) ; contenant toute forme de « garanti* » ou « rembours* » (première personne
comprise) ou tout pourcentage, après normalisation ; ou touchée par `detecterInterditsSurface`
(promesse ou garantie de gain, témoignage ou statistique Axion-IA, citation de témoin,
ancrage local).

Double verrou, **les mêmes motifs à l'import** (mêmes fonctions, importées de `decoupage.ts` et
`filtre-sortie.ts`) : un montant pose `chiffres-exercice` ; une promesse, un pourcentage ou un
motif de `detecterInterditsSurface` pose `doctrine:a-revoir` ; un courriel ou un téléphone fait
**refuser** la section (elle n'est pas écrite). Dans tous les cas la fiche n'est jamais servie.

On préfère refuser une fiche saine que laisser passer une fiche douteuse. Conséquence
acceptée : si le noyau porte un montant, il n'est **pas** servi ; il faut réécrire sa section
« essentiel » sans chiffres. Le noyau est reconnu par la forme de son slug
(`methode/<fichier numéroté 00>/essentiel`), jamais par un titre écrit en dur.

### 2.6 Rien n'est ouvert ni allumé

Trois variables, toutes éteintes par défaut, déclarées dans `src/env.ts` et seulement
commentées dans `.env.example` :

- `METHODE_ACTIVE` : `z.enum(["true", "false"]).optional()`, seule la valeur exacte
  `"true"` allume `obtenirContexteMethode` ;
- `METHODE_STUDIO_OUVERT` : même forme, réservée à la porte du Studio (lot suivant) ;
- `METHODE_STUDIO_SECRET` : secret de cette porte (32 caractères minimum), réservé au même lot.

Aucun outil MCP, aucune route publique, aucune lecture par le chatbot, aucun générateur de
contenu n'appelle la couche (test : aucun import hors de `src/server/methode/` et de
l'import).

## 3. Suite prévue (hors de cet ADR)

La porte du Studio sera une route sœur, lecture seule, fermée par défaut, avec son propre
secret : jamais par la recherche publique (publique et mise en cache), jamais par MCP (le
secret MCP ouvre aussi la boîte de réception et l'agenda, et ajouter un outil change
l'empreinte épinglée du manifeste).

## 4. Gestes du fondateur

1. Fournir une copie locale propre du dossier source, et une liste locale de noms sensibles.
2. Lancer l'essai à blanc, lire le journal, puis `--ecrire` sur la base voulue.
3. Poser `METHODE_ACTIVE=true` le moment venu.
4. Supprimer les deux anciennes branches de cette couche, déjà publiques, une fois cette PR fusionnée.
