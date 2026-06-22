# Journal — Option 1 : persistance des citations structurées (2026-06-22)

> Sauvegarde progressive de l'état du chantier (reprise si Claude Code ferme).
> Branche de travail : `feat/blog-templates-refonte` (NON poussée).

## Contexte / découverte

L'utilisateur croyait qu'un « système de citations » avait été mis en place hier
(2026-06-21). Vérification en profondeur → il y a **trois** choses, pas un doublon :

- **Système A** (migration `20260514120000`, 14 mai) : tables `external_references`
  + `content_citations` (modèles Prisma `ExternalReference` + `ContentCitation`).
  → Structuré, lu par le bloc public « Sources & méthodologie » + JSON-LD `isBasedOn`.
  → **AUCUN writer existant** → tables **VIDES** en prod → bloc jamais affiché.
- **Système B** (sprint 22 mai) : catalogue `ALL_EXTERNAL_LINKS` (~2 400 liens réels
  vérifiés HEAD, fichiers TS sous `src/data/external-links/`) + table de tracking
  `external_link_usage`. → **ACTIF** : injecte 3-5 liens d'autorité dans le prompt
  de CHAQUE générateur ; détection d'hallucination rejette toute URL hors catalogue.
- **Hier (#130, `50608fb2`)** : couche de **rendu** (`ArticleSources`,
  `ArticleExpertQuote`, `ArticleKeyTakeaway`, `ArticleFaq`) + colonnes `expert_quote_*`
  + seuils juge LLM. → Le bloc « Sources » lit le Système A (vide) → invisible.

**Comment les citations sont « trouvées »** : pipeline Perplexity offline
(`seed-external-links-from-perplexity.ts`, ~270 requêtes) → vérif HEAD
(`verify-external-links-head.ts`) → catalogue curé. Aucune invention au runtime.

## Décision : Option 1

Brancher l'écriture des tables A au moment du publish, à partir des liens
RÉELLEMENT présents dans le body (`detectHallucinations().valid`, déjà filtrés
contre le catalogue → zéro citation inventée, parité affichage ↔ contenu).
Point de passage UNIQUE pour le contenu généré = `content-publish-worker.ts:433`
(`tx.article.create`). Couvre donc TOUS les types de contenus générés.

## Modifications faites (toutes sur `feat/blog-templates-refonte`)

1. **NOUVEAU** `src/server/content-gen/links/persist-citations.ts`
   - `persistArticleCitations({ articleId, jobId, linkIds, bodyHtml })` : upsert
     `ExternalReference` (par `url` unique) + create `ContentCitation`. Idempotent
     (`deleteMany` par articleId d'abord). Mappe autorité→TrustTier, extrait l'ancre
     réelle du body. Helpers purs exportés : `mapAuthorityToTrustTier`, `extractAnchorText`.
2. **NOUVEAU** `src/server/content-gen/links/persist-citations.test.ts` — 6 tests, VERTS.
3. `content-publish-worker.ts` : import + appel dans le bloc try **non-bloquant**
   existant (après `trackExternalLinksUsage`), avec `logStep("citations_persist", …)`.
   Utilise `detection.valid` comme source (liens réellement cités).
4. `v7-phase8-shared.ts` : ajout `selectedExternalLinkIds: externalLinksCtx.ids` au
   retour (gap : les 12 types Phase-8 ne propageaient pas les IDs ; tracking ne reposait
   que sur la détection body).
5. `shared/generation-log.ts` : ajout du step `"citations_persist"` au type `GenerationLogStep`.

## Validation

- [x] Test `persist-citations.test.ts` : 6/6 verts.
- [x] Typecheck `tsc --noEmit` : **exit 0** (step `citations_persist` ajouté).
- [x] eslint fichiers modifiés : **0 erreur** (3 warnings `no-console` PRÉEXISTANTS dans
      `v7-phase8-shared` l.323/348/353, hors périmètre).
- [x] Tests `src/server/content-gen/links/` : **27/27 verts** (dont les 6 nouveaux).
- [ ] Suite complète vitest : à faire avant push (Will).

## Cleanup

Aucune suppression : le Système A n'est PAS un doublon mort — l'Option 1 l'active.
Le supprimer casserait le bloc « Sources » + le JSON-LD `isBasedOn` posés hier.
Rien d'autre identifié comme réellement orphelin sans risque (autres conversations
en cours → surface minimale volontaire).

## Backfill (livré 2026-06-22)

`src/scripts/backfill-article-citations.ts` — rejoue la logique runtime sur l'historique :
lit `ArticleTranslation.body` (FR), `detectHallucinations()` (catalogue-only → zéro
invention), `persistArticleCitations()` (idempotent). Batché par curseur (200/page),
`--dry-run` (rapport seul), `--limit=N`, garde anti-`stub.invalid`, rapporte les URLs
hors-catalogue. `jobId` rendu optionnel dans `persist-citations.ts` (articles sans job).
Usage : `pnpm tsx src/scripts/backfill-article-citations.ts --dry-run` puis sans flag.

## ⚠️ Conversation concurrente sur la même branche (constaté 2026-06-22)

Pendant ce chantier, une AUTRE conversation travaille en direct sur `feat/blog-templates-refonte` :
- HEAD a bougé `a7ce9800` → `cc698a17` pendant mon travail.
- Édition NON commitée de `src/app/[locale]/actualites/[slug]/page.tsx` (+37 l, bloc TOC)
  → introduit une erreur de typage `TocItem[]` ligne ~290. **PAS la mienne, je n'y touche pas.**
- `tsc` ne sort QUE cette erreur → **tous mes fichiers sont type-clean** (tsc liste tout).

**Conséquence pour le commit** : NE PAS `git add -A`. Committer UNIQUEMENT mes fichiers :
- `src/server/content-gen/links/persist-citations.ts` (+ `.test.ts`)
- `src/scripts/backfill-article-citations.ts`
- `src/server/queue/workers/content-publish-worker.ts`
- `src/server/content-gen/generators/v7-phase8-shared.ts`
- `src/server/content-gen/shared/generation-log.ts`
- `_AUDIT/CITATIONS-OPTION1-2026-06-22/`
Laisser `actualites/[slug]/page.tsx` + le JOURNAL-REPRISE de l'autre chantier à l'autre conversation.

## Reste à faire (Will)

- Re-run typecheck complet vert + suite vitest + eslint.
- Commit sur `feat/blog-templates-refonte` (NE PAS pousser sans accord).
- Migrate deploy : AUCUNE migration nouvelle (tables A existent depuis le 14 mai).
- Après deploy, republier 1 article test → vérifier le bloc « Sources & méthodologie »
  s'affiche + lignes dans `content_citations` / `external_references`.
- (Optionnel) backfill des articles déjà publiés : script qui rejoue
  `persistArticleCitations` depuis `Article.body` existant.
