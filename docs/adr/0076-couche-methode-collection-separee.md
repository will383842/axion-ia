# ADR 0076 — Couche « Méthode » : une collection séparée dans la base de connaissance

- **Statut** : **PROPOSÉ** — implémentation livrée derrière un interrupteur éteint (`METHODE_ACTIVE`), à valider par Williams
- **Date** : 2026-11-11
- **Auteur** : Claude, sous mandat de Williams (routine M-1)
- **Référence** : décisions de Williams du 11/11/2026 ; dépôt de marque, branche `methode/livres-2026-11-11`, dossier `methode/` ; `prisma/schema.prisma` (`KnowledgeEntry`, `KnowledgeCollection`) ; `src/lib/knowledge/search-fts.ts`

## 1. Contexte

Williams dispose de fiches de synthèse de neuf livres de vente appliqués à Axion-IA
(Dunford, Osterwalder, Hormozi ×2, Miller, Dib, Rackham, Cialdini, Voss), d'une fiche 00
« Méthode de vente » qui les assemble, de cinq fiches « important à savoir » (closing,
déroulé d'audit, expressions, persuasion, posture), de six fiches « à étudier », et d'un
dossier « santé privée ». Le Drive « Livres savoir par cœur » reste la source d'origine ;
le dépôt de marque en porte une copie texte (extraction des PDF).

Décisions du 11/11 :

1. ces fiches entrent dans la base du site comme une collection **« Méthode » séparée**
   du RAG public et du Knowledge factuel ;
2. deux étages : fiches appliquées **découpées par section** (une règle, un script, une
   objection = une fiche) ; plus tard, une couche « livre pur » par auteur ;
3. les **chiffres et prix sont séparés des principes** : les fiches contiennent des
   montants d'**entraînement** (290 €/mois, 1 900 €, acompte de 30 %…) qui ne sont pas
   des prix publics. Seul prix public : la Journée IA, tirée de `src/content/offre.ts` ;
4. le **secteur santé est à part** : servi seulement quand on s'adresse à la santé ;
5. un **point d'entrée unique** que tous les outils appellent : noyau toujours injecté
   (fiche 00) + recherche à la demande ;
6. le Drive reste intact.

## 2. Décision

### 2.1 Modèle : on RÉUTILISE, aucune table, aucune migration

`KnowledgeEntry` + `KnowledgeTranslation` (locale `fr`) + `KnowledgeCollection` /
`KnowledgeCollectionItem` + `KnowledgeTag` / `KnowledgeTagOnEntry` couvrent tout le besoin.
Les énumérations nécessaires existent déjà : `KbType.methodology` / `doctrine`,
`KbDomain.methodology`, `KbAudience.team`, `KbConfidentiality.internal`,
`KbStatus.approved`. La recherche plein texte réutilise `search_vector` (colonne générée
`fr_unaccent`, `prisma/migrations_fts/kb_fts_setup.sql`). **Aucune migration** : pas
d'ESCALADE.

`ChatKbChunk` (base du chatbot public) n'est **pas** utilisé.

### 2.2 Cloisonnement

| Champ                   | Valeur                             | Pourquoi                                                |
| ----------------------- | ---------------------------------- | ------------------------------------------------------- |
| `audience`              | `team`                             | jamais `public`                                         |
| `confidentiality`       | `internal`                         | la recherche publique exige `public`                    |
| `status`                | `approved`, **jamais** `published` | la recherche publique exige `published`/`deprecated`    |
| `publishedAt`           | nul                                | aucune page, aucun sitemap                              |
| `type`                  | `methodology` (noyau : `doctrine`) |                                                         |
| `domain`                | `methodology`                      |                                                         |
| `sourceFactoryId`       | `methode-import`                   | l'import ne touche jamais une entrée d'une autre source |
| collection `visibility` | `team`, `publishedAt` nul          |                                                         |

Trois verrous indépendants empêchent une fiche Méthode de sortir par `searchKnowledge`
(chatbot, `/connaissances`, RAG des articles) : statut, confidentialité, audience. **En v1,
rien n'est servi au chatbot public des visiteurs**, ni au sitemap, ni aux pages.

### 2.3 Slugs stables

`methode/<fichier>/<section>` :

- `<fichier>` = nom du fichier source, en minuscules, sans accents
  (`00-axion-ia-methode-de-vente`, `07-rackham-spin-selling`, `fiche-closing-axion-ia`) ;
- `<section>` selon la forme du fichier :
  - fiches « livre appliqué » : `NN-<titre>` pour les sections numérotées, puis les blocs
    fixes `essentiel`, `si-alors`, `cas-N-<titre>` (un cas = une fiche), `teste-toi`,
    `cartes-memo`, `a-relire-avant-d-agir` ;
  - fiches « affiche » (`important-a-savoir/`, mises en page en colonnes, sans titres
    fiables) : `page-NN`, l'unité stable du PDF d'origine ;
  - dossier santé (Markdown) : `<titre H1>` et `<titre H1>--<titre H2>`.

Le **noyau** est `methode/00-axion-ia-methode-de-vente/essentiel` : la section
« L'ESSENTIEL EN 30 SECONDES » suivie de « LE CHEMIN ».

L'import est **idempotent sur le slug** : créé s'il manque, mis à jour si le texte a
changé, inchangé sinon. **Jamais de suppression** : une section disparue de la source
reste en base, à archiver à la main.

### 2.4 Étiquettes

- `livre:<auteur>` (`livre:hormozi`, `livre:voss`… ; `livre:axion-ia` pour les fiches maison) ;
- `type:regle | script | objection | calcul | posture` ;
- `chiffres-exercice` : la section porte un montant en euros ;
- `secteur:sante` : la section vient du dossier santé ;
- `doctrine:a-revoir` : la section heurte la doctrine de publication
  (`src/lib/contenu/interdits-publication.ts` : ville du siège nommée, promesse de gain, étiquette
  TPE/PME, Qualiopi…). Elle est importée pour relecture, **jamais servie**.

### 2.5 Séparation des chiffres

Toute section qui contient un montant en euros reçoit `chiffres-exercice` **et** commence
par l'avertissement :

> ⚠️ Montants d'entraînement, pas de prix public. Le seul prix public est celui de la
> Journée IA, tiré de `src/content/offre.ts`. Ne jamais recopier ces montants dans un
> texte destiné à un client.

Le bloc injecté dans un prompt rappelle en plus le seul prix autorisé, lu dans
`prixJourneeIa()` — jamais écrit à la main.

### 2.6 Collections

- `methode-vente` : la fiche 00, les neuf livres appliqués, `important-a-savoir/`,
  `a-etudier/` ;
- `methode-secteur-sante` : le dossier santé (l'original Markdown seulement ; l'extraction
  PDF, gardée pour comparaison, et les `LISEZ-MOI.md` ne sont pas importés).

### 2.7 Point d'entrée unique et interrupteur

`src/server/methode/index.ts` → `obtenirContexteMethode({ sujet, secteur?, max? })` rend
`{ noyau, extraits[] }` :

- `noyau` = l'entrée du slug ci-dessus (audience `team`, statut `approved`) ;
- `extraits` = recherche plein texte (`websearch_to_tsquery('fr_unaccent', …)`) dans
  `methode-vente`, plus `methode-secteur-sante` **seulement** si `secteur === "sante"` ;
  exclusion par étiquette en double sécurité (`secteur:sante` hors santé,
  `doctrine:a-revoir` toujours) ; 5 extraits par défaut, 10 au plus, 1 500 caractères
  chacun.

Interrupteur `METHODE_ACTIVE` (déclaré dans `src/env.ts`, commenté dans `.env.example`),
**éteint par défaut** ; seule la valeur exacte `"true"` l'allume. Éteint, la fonction rend
`{ noyau: null, extraits: [] }` sans interroger la base. Une panne de base rend le même
contexte neutre.

### 2.8 Branchements v1 (minimaux)

- **MCP** : outil en lecture `axionia.methode.contexte` (le `methode_contexte` de la
  demande, au format de nommage du registre), `dataClass: internal`.
- **content-gen** : `blocMethodePourPromptSysteme(nature)` n'injecte le noyau que si
  l'interrupteur est allumé **et** que la nature est `mail`, `offre` ou `script`. Aucun
  générateur commercial n'existe encore : les générateurs SEO publics ne sont **pas**
  branchés, et ne doivent jamais l'être.
- **Chatbot public** : non touché.

## 3. Conséquences

- Aucun changement de comportement tant que `METHODE_ACTIVE` n'est pas allumé et que
  l'import n'a pas été lancé avec `--ecrire`.
- Essai à blanc sur la copie du 11/11 : **356 fiches** (278 `methode-vente`, 78
  `methode-secteur-sante`), 120 `chiffres-exercice`, 18 `doctrine:a-revoir`.
- Les 18 fiches `doctrine:a-revoir` sont surtout des mises en situation situées près de la
  ville du siège, nommée : à réécrire dans le dépôt de marque (ville neutre), puis réimporter.
- La couche « livre pur » (étage 2) se rangera dans la même collection, sous
  `methode/livre-<auteur>/<section>`, avec les mêmes règles.

## 4. Ce qui reste à décider (par Williams)

1. Lancer l'import réel (`--ecrire`) sur la base de production.
2. Allumer `METHODE_ACTIVE` sur l'app (et le worker si un outil du worker l'appelle).
3. Réécrire les 18 fiches `doctrine:a-revoir` dans la source.
