# ADR 0076 — Couche « Méthode » : collection séparée dans la base de connaissance

- **Statut** : **PROPOSÉ** — à valider par Williams (aucune fusion sans son accord)
- **Date** : 2026-11-11
- **Auteur** : Claude, sous mandat de Williams (tâche M-1)
- **Référence** : `prisma/schema.prisma` (`KnowledgeEntry`, `KnowledgeTranslation`,
  `KnowledgeCollection`, `KnowledgeCollectionItem`, `KnowledgeTag`), `prisma/migrations_fts/kb_fts_setup.sql`,
  `src/server/chatbot/retrieval/knowledge-entry-search.ts`, dépôt `axion-brand`
  branche `methode/livres-2026-11-11` (dossier `methode/`)

## 1. Contexte

Williams dispose de fiches de synthèse de neuf livres de vente appliqués à Axion-IA
(Dunford, Osterwalder, Hormozi ×2, Miller, Dib, Rackham, Cialdini, Voss), d'une fiche 00
« Méthode de vente » qui les assemble, de fiches « important à savoir » (closing, déroulé
d'audit, expressions, persuasion, posture), de fiches « à étudier » (signature, paiement,
présentation des offres, tri des e-mails, guide Hormozi) et d'un dossier secteur santé.
Le Drive « Livres savoir par cœur » reste la **source d'origine, intacte** ; le dépôt
`axion-brand` en porte une copie texte.

Décisions de Williams du 11/11 :

1. ces fiches entrent dans la base du site comme collection « Méthode » **séparée** du RAG
   public et du Knowledge factuel ;
2. deux étages : fiches appliquées découpées par section (une règle, un script, une
   objection = une fiche), puis plus tard une couche « livre pur » par auteur ;
3. les **chiffres et prix sont séparés des principes** : les montants des fiches
   (290 €/mois, 1 900 € d'installation, acompte de 30 %, abonnement, suivi à 30 jours…)
   sont des **EXEMPLES d'entraînement, jamais des règles ni des prix**. Seul prix public :
   Journée IA 1 490 € HT, source unique `src/content/offre.ts` ;
4. le secteur santé est **à part** : servi seulement quand on s'adresse à la santé ;
5. un **point d'entrée unique** que tous les outils appellent : noyau toujours injecté
   (fiche 00) + recherche à la demande ;
6. le Drive reste la source d'origine.

## 2. Décision

### 2.1 Modèle : réutiliser l'existant, AUCUNE migration

On **réutilise** `KnowledgeEntry` + `KnowledgeTranslation` (locale `fr`) +
`KnowledgeCollection` / `KnowledgeCollectionItem` + `KnowledgeTag` / `KnowledgeTagOnEntry`.
Pas de nouvelle table, pas de nouvelle valeur d'énumération, pas de nouvelle colonne :

| Champ                  | Valeur                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `type`                 | `methodology` (règles, calculs, posture) ou `doctrine` (fiche 00) |
| `domain`               | `methodology`                                                     |
| `audience`             | `team`                                                            |
| `confidentiality`      | `internal`                                                        |
| `status`               | `approved` — **JAMAIS `published`**                               |
| `pipelineStage`        | `approved`                                                        |
| `publishedAt`          | `NULL`                                                            |
| `KnowledgeTranslation` | `fr` seule ; `body` = `bodyText` = texte de la section            |

La recherche plein texte réutilise la colonne générée `knowledge_translations.search_vector`
(`fr_unaccent`, index GIN, `kb_fts_setup.sql`) : rien à créer.

**Pas d'ESCALADE** : aucune migration n'est indispensable.

### 2.2 Cloisonnement

- `audience = team`, `confidentiality = internal`, `status = approved` : toutes les lectures
  publiques existantes (chatbot visiteurs `knowledge-entry-search.ts`, `search-fts.ts`,
  pages `/connaissances`, sitemaps) filtrent `status = published` ET `audience = public` :
  ces fiches n'y apparaissent donc **jamais**.
- **Jamais servi au chatbot PUBLIC des visiteurs en v1.** Le chatbot public n'est pas modifié.
- Jamais dans le sitemap ni dans les pages.
- Les collections `methode-vente` et `methode-secteur-sante` portent `visibility = "team"`
  et `publishedAt = NULL`.
- `confidentiality = internal` (et non `confidential`) : les fiches peuvent être envoyées au
  fournisseur de modèle pour la génération interne ; elles ne contiennent pas de données
  personnelles de clients (les entreprises citées sont des exemples d'entraînement).

### 2.3 Slugs stables

`methode/<fichier>/<section>`, en minuscules ASCII, tirets :

- `<fichier>` = nom du fichier Markdown sans extension, normalisé
  (`00-AXION-IA-Methode-de-vente.md` → `00-axion-ia-methode-de-vente`) ;
- `<section>` = `<n>-<titre-normalise>` tronqué à 60 caractères pour les sections
  numérotées (`1-dire-non-doit-couter-plus-cher-que-dire-oui`), `introduction` pour le
  texte qui précède la section 1, et `essentiel` pour le noyau de la fiche 00 ;
- le slug complet est borné à 180 caractères (limite de la colonne).

Le slug ne dépend que du nom de fichier et du titre de section : réimporter le même fichier
rend les mêmes slugs (import **idempotent**).

### 2.4 Étiquettes (`KnowledgeTag`)

| Étiquette           | Sens                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `methode`           | toute entrée de la couche                                                                                   |
| `livre:<auteur>`    | `livre:dunford`, `livre:hormozi`, `livre:rackham`… ; `livre:axion-ia` pour la fiche 00 et les fiches maison |
| `type:regle`        | règle / principe                                                                                            |
| `type:script`       | formulation à dire (phrases entre guillemets, « dites »)                                                    |
| `type:objection`    | traitement d'une objection                                                                                  |
| `type:calcul`       | formule, calcul de perte / gain                                                                             |
| `type:posture`      | voix, tenue, attitude                                                                                       |
| `chiffres-exercice` | la section contient un montant en euros ou un pourcentage d'acompte / un abonnement / un suivi à 30 jours   |
| `secteur:sante`     | dossier secteur santé                                                                                       |

Le `type:*` est déduit du titre et du texte (heuristique documentée dans le script) ; une
section reçoit exactement un `type:*`.

### 2.5 Séparation des chiffres

Toute section contenant un montant en euros (`€`, `EUR`, `euros`) ou l'un des marqueurs
« acompte », « abonnement », « suivi à 30 jours » reçoit l'étiquette `chiffres-exercice` et
son corps est **préfixé** de l'avertissement :

> ⚠️ Montants d'entraînement, pas de prix public. Les montants, l'acompte, l'abonnement et
> le suivi cités ici sont des EXEMPLES, jamais des règles ni des prix. Seul prix affiché :
> Journée IA 1 490 € HT (source : `src/content/offre.ts`).

`obtenirContexteMethode` repose **en plus** cet avertissement en tête de chaque extrait
étiqueté (défense en profondeur : une fiche éditée à la main sans l'avertissement est quand
même servie avec).

### 2.6 Collections

| Collection              | Contenu                                                                                      | Servie                               |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| `methode-vente`         | fiche 00 (noyau + sections), fiches 01-09, important à savoir, à étudier                     | toujours (recherche)                 |
| `methode-secteur-sante` | `secteurs/sante/…_CODE_SOURCE.md` (l'extrait PDF n'est pas importé : doublon de comparaison) | **seulement** si `secteur = 'sante'` |

Ne sont pas importés : `LISEZ-MOI.md`, `EVALUATION-FICHES-*.md`, `livres-purs/` (couche
« livre pur », étage 2, plus tard, dans une collection `methode-livres` à créer alors).

### 2.7 Point d'entrée unique et interrupteur

- `src/server/methode/index.ts` → `obtenirContexteMethode({ sujet, secteur?, max? })` rend
  `{ noyau, extraits[] }` :
  - `noyau` = l'entrée `methode/00-axion-ia-methode-de-vente/essentiel`
    (« L'ESSENTIEL EN 30 SECONDES » + « LE CHEMIN ») ;
  - `extraits` = recherche plein texte (`websearch_to_tsquery('fr_unaccent', sujet)`) sur
    les entrées des collections `methode-vente` (+ `methode-secteur-sante` si
    `secteur = 'sante'`), filtrées `audience = team`, non supprimées, `max` borné (défaut 5).
- Interrupteur `METHODE_ACTIVE` (défaut `false`, seule la valeur exacte `"true"` l'allume),
  déclaré dans `src/env.ts`. **Éteint, la fonction rend `{ noyau: null, extraits: [] }`
  sans toucher à la base, et rien ne change nulle part.**
- Toute nouvelle automatisation qui parle à un client passe par `obtenirContexteMethode`.

### 2.8 Branchements v1 (minimaux)

- MCP : outil de lecture `methode_contexte` si `src/server/mcp` expose un registre d'outils.
- Génération de contenu : le noyau est ajouté au prompt système **uniquement** si
  `METHODE_ACTIVE` ET pour les contenus commerciaux (mails, offres, scripts).
- Chatbot public : **non touché**.

### 2.9 Import

`scripts/methode/importer-methode.ts <dossier>` : **essai à blanc par défaut** (affiche ce
qu'il ferait), écriture seulement avec `--ecrire`. Crée ou met à jour par slug, **ne
supprime jamais rien**, **ne publie jamais rien** (refuse d'écrire `published`).

## 3. Conséquences

- Aucune migration, aucun changement du schéma, aucun risque app ↔ worker (cf. AGENTS.md).
- Aucune donnée supprimée ; l'import réel en production reste une action manuelle de
  Williams (`--ecrire` avec la vraie `DATABASE_URL`).
- Tant que `METHODE_ACTIVE` n'est pas `true`, le comportement du site et des outils est
  strictement identique.

## 4. Alternatives écartées

- **Nouvelle table `MethodeFiche`** : migration, double moteur de recherche, double console ;
  rien que `KnowledgeEntry` ne sache déjà porter.
- **Injecter les fiches dans `chat_kb_chunks`** : c'est le RAG du chatbot public ; contraire
  à la décision 1.
- **Nouvelle valeur `KbAudience`/`KbType`** : migration d'énumération et risque de contrat
  app ↔ worker, sans gain : `team` + `methodology` + collections suffisent.
