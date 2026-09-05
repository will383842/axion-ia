# ADR-DRAFT — Knowledge Base unifiée Axion-IA

> Brouillon Phase A — à fusionner dans `docs/adr/0021-knowledge-base-unifiee.md` uniquement après GO Will (Phase B).
> Convention numéro suivant : ADR 0020 livré (`migration-data-v0-vers-v1`).
> Date proposition : 2026-05-13
> Statut : **PROPOSED**

---

## Contexte

Axion-IA produit plusieurs types de contenu — articles de blog, études de cas, FAQ, articles d'aide, glossaire, guides IA, plus une doctrine interne riche (~70+ fichiers `_AUDIT/*.md`, 20 ADRs, méthodologies, post-mortems, SOPs, prompts internes, fiches outils, fiches concurrents, documents commerciaux, étapes onboarding) — chacun avec son propre modèle Prisma, son admin CRUD séparé, sa surface publique dédiée, sa logique métier dispersée.

À HEAD `95bba36` (main) le repo compte 5+ modèles de contenu (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`, `Category` + sources hardcode `glossaire`/`guide-ia`) avec :

- Édition admin fragmentée (`/admin/blog`, `/case-studies`, `/faq`, `/help`, `/categories`) — pas de vue unifiée.
- 3 FTS Postgres séparés (`article_translations`, `help_article_translations`, `case_study_translations`).
- Pas d'audit log applicatif (`ActivityLog` existe mais non systématiquement utilisé sur les content actions).
- Pas de versionning de contenu (toute modification écrase, pas de rollback).
- Pas de pipeline éditorial (calendrier, brief, assignation reviewer, quality score).
- Pas de pipeline médias (asset library + sharp + EXIF strip).
- Pas de RAG / embeddings (V1.5 cible).
- Surfaces publiques découplées, sans hub agrégateur ni RSS global cross-type ni llms.txt enrichi.

À l'échelle 2150 villes pSEO + roadmap éditoriale Axion-IA (Manon + collaborateurs futurs), ce modèle ne tient pas : duplication code, dette éditoriale, impossibilité d'industrialiser, friction RGPD, pas de RAG futur pour chatbot.

---

## Décision

**Adopter un modèle de Knowledge Base unifiée** :

1. **Un seul modèle racine** `KnowledgeEntry` polymorphique avec :
   - `type KbType` enum 16 valeurs (`article`, `case_study`, `help_article`, `faq`, `glossary_term`, `guide`, `methodology`, `doctrine`, `adr`, `prompt_template`, `sop`, `post_mortem`, `tool_card`, `competitor_card`, `commercial_doc`, `onboarding_step`).
   - `domain KbDomain` enum 10 valeurs.
   - `audience KbAudience` (public, client, team, will_only).
   - `confidentiality KbConfidentiality` (public, internal, confidential, secret).
   - `status KbStatus` (draft, review, approved, scheduled, published, archived, deprecated) — **enum dédié, ne pas étendre `PublishStatus`** (risque pollution booking).
   - `pipelineStage KbPipelineStage` (cohabitant avec `status`, dédié pipeline éditorial amont).
   - - 12 modèles satellites (`KnowledgeTranslation`, `KnowledgeVersion`, `KnowledgeTag`, `KnowledgeRelation`, `KnowledgeFeedback`, `KnowledgeAsset`, `KnowledgeSlugHistory`, `KnowledgeBookmark`, `KnowledgeImportBatch`, `KnowledgeReviewerAssignment` + `KnowledgeEmbedding` V1.5).
2. **Migration zero-downtime** des modèles legacy (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`) selon le pattern **expand → backfill → contract** sur 3 sprints. Glossaire et Guide-IA hardcode → migrés depuis code source (script one-shot) en KB-5.
3. **URLs publiques préservées** : `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia` continuent à servir le même contenu, alimentées par `KnowledgeEntry` filtré sur `type`. **Zéro 301 SEO**. Nouveau hub `/fr/ressources/` (parité `/en/resources/`) en bonus cross-type.
4. **Admin FR cohérent** sous `/fr/<adminPrefix>/connaissances/` (12 écrans). Admin legacy (`/blog`, `/case-studies`, `/help`, `/faq`, `/categories`) **conservé** en strangler progressif (marqué `legacy`), redirigé vers `/connaissances/?filter=type=...` quand validé Will.
5. **Backend unifié** : 25+ server actions sous `src/server/actions/knowledge/<action>.ts` (1 fichier par action), Zod systématique, audit log dans `ActivityLog` (events `kb.*`), revalidatePath sur publish/unpublish/update.
6. **Pipeline complet** : workflow états + versionning immutable + audit log + pipeline éditorial + reviewer assignment + quality score bloquant publication + asset library sharp AVIF/WebP + slug history + sanitization Tiptap SSR + multi-format (PDF, RSS, JSON Feed, llms.txt enrichi, OG dynamique, newsletter digest).
7. **Surfaces 4 fronts** : interne admin (équipe + Will), client connecté `/mes-ressources/` (magic-token Booking V1 réutilisé), public SEO/AEO/GEO, RAG V1.5 pour fonctionnalités IA futures.
8. **FTS V1, pgvector V1.5** : `tsvector` Postgres généré-stored avec config `fr_unaccent` custom + `english_stem` (étendu depuis l'existant). Embeddings via Voyage AI `voyage-3-lite` (1024 dims, $0.02/1M tokens) en V1.5, hybride RRF FTS + cosine, refus dur `confidentiality IN ('confidential', 'secret')`.
9. **SSOT TypeScript** : `src/content/knowledge-base.ts` + sous-modules `src/content/knowledge/{types,domains,audiences,confidentialities,statuses,relation-kinds,routes,templates,snippets,quality-thresholds,review-windows}.ts`. Aucune string magique dans les composants.
10. **i18n** : namespacer `knowledge.*` dans les fichiers mono `src/messages/fr.json` et `en.json` existants (pas de migration multi-fichiers).
11. **WCAG 2.2 AA + E-E-A-T strict** : bloc auteur SSR optimisé, schema Person JSON-LD, `lastReviewedAt` jamais cachée, badge `fact-checked`, citations bas de page, bouton "comment citer" (BibTeX + APA + permalink), alt text bloquant publication.
12. **RGPD propre** : `pii-redaction.ts` intégré dans `publish.ts` (bloquant), `expiresAt` honoré par cron `retention-purge`, export GDPR full-KB JSON OWNER+HMAC+rate-limit, refus dur embeddings pour `secret`.

---

## Alternatives considérées

### Alternative 1 — Conserver les modèles séparés (status quo)

**Rejet** : dette éditoriale insurmontable à l'échelle Axion-IA, duplication code multipliée par chaque nouveau type, pas de RAG futur, pas de gouvernance unifiée RGPD. Score scoring /300 incompatible avec ambition produit.

### Alternative 2 — Migrer vers Sanity / Contentful / Strapi cloud

**Rejet** : viole la doctrine Axion-IA `hosting Hetzner CPX32 + Cloudflare Free + €0 SaaS additionnel` (ADR 0009). Vendor lock-in. Pas de contrôle RGPD fin sur `confidentiality='secret'`.

### Alternative 3 — Strapi self-hosted sur Hetzner

**Rejet** : ajoute une stack Java/Node parallèle, charge CPX32 (RAM contrainte), perte de cohérence avec Next.js + Prisma + NextAuth existant, dette de migration vers admin Strapi (vs admin maison déjà avancé).

### Alternative 4 — Markdown flat files dans le repo

**Rejet** : non éditable depuis admin (contre cible §0.0/4 du master prompt), pas de versionning DB, pas de RGPD applicatif, mauvaise UX pour Manon + futurs rédacteurs non-tech.

### Alternative 5 — `KnowledgeEntry` polymorphique unique (cette ADR)

**Adopté**.

### Alternative 6 — Tables polymorphiques séparées par groupe (ex. `EditorialEntry` pour public + `InternalEntry` pour interne)

**Rejet** : duplication des concepts (workflow, version, audit, slug history, asset library) sans bénéfice. Le couple `audience × confidentiality` traite proprement la séparation logique.

---

## Conséquences

### Positives

- **Industrialisation éditoriale** : Manon + agents IA peuvent produire des contenus sur 16 types depuis une seule console.
- **Cohérence** : un seul workflow, un seul versionning, un seul audit log, une seule recherche, un seul sitemap, un seul llms.txt.
- **Zéro perte SEO** : URLs publiques préservées + slug history.
- **RAG-ready** : V1.5 ajoute pgvector + endpoint RAG sans refonte (modèle dédié `KnowledgeEmbedding` table séparée).
- **RGPD propre** : centralisé.
- **Coût €0 V1** (Hetzner CPX32 absorbe). V1.5 €0.05-13/mois fonction du volume.
- **WCAG 2.2 AA + E-E-A-T** atteignables par design.
- **Maintenance long-terme** : review cycles + expiration + health dashboard exposent automatiquement la dette éditoriale.

### Négatives / coûts

- **Effort initial** : ~81 dj V1 + ~18 dj V1.5 (Phase 6).
- **Migration legacy risquée** : 4 modèles + 2 sources hardcode à migrer expand-backfill-contract. Mitigation : `--dry-run` + tests intégration + feature flag `KB_BACKEND_UNIFIED` route par route.
- **Admin legacy en double pendant la transition** : `/blog`, `/case-studies`, `/help`, `/faq`, `/categories` coexistent avec `/connaissances/`. Risque "double vérité" mitigé par lecture unifiée depuis `KnowledgeEntry` (DB) dès KB-2 — les admin legacy lisent les mêmes rows.
- **TipTap rendu SSR custom** : helper `renderTiptapJsonToReact` à écrire (ne pas importer `@tiptap/*` côté public — budget 75 KB gz). Mitigation : Sprint KB-11 dédié + tests.
- **DB grossit** : ~50MB body + assets pour 1k entrées, ~5GB pour 100k entrées. Mitigation : politique compaction LRU V2+.
- **Apprentissage équipe** : Manon doit s'approprier la console `/connaissances/`. Mitigation : style guide rédacteurs (`docs/knowledge/editorial-style-guide.md`) + onboarding.

### Hors scope V1

- Chatbot public alimenté par RAG (V2+).
- Multi-tenant (clients rédigent leurs propres entrées) (V2+).
- Auto-génération autonome IA d'entrées (V1.5 = assistance, V2+ = autonome).
- Syndication LinkedIn / X / Substack cross-post (V2+).
- Paywall (V2+).

---

## Liens

- Prompt master : [`_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`](../../../_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md)
- Audit Phase A (22 fichiers) : [`_AUDIT/KNOWLEDGE-BASE-2026/`](../../../_AUDIT/KNOWLEDGE-BASE-2026/)
  - `00-REALITY-CHECK.md`
  - `01-DATA-MODEL.md` à `18-TESTS-OBSERVABILITY.md`
  - `SYNTHESIS.md` (verdict CONDITIONAL GO 266/300)
  - `04-PLAN-EXECUTION.md` (plan sprints chiffré 81 dj V1 + 18 dj V1.5)
- ADRs liés :
  - ADR 0001 — Stack initial Next.js + Prisma.
  - ADR 0002 — Design pivot editorial V3.
  - ADR 0007 — Typography hierarchy v3.2.
  - ADR 0009 — Hosting Hetzner CPX32 + Cloudflare Free.
  - ADR 0010 — Telegram PII minimisation.
  - ADR 0011 — Interventions taxonomy 4 familles.
  - ADR 0015 — TVA agnostique FR vs EE.
  - ADR 0016 — Pricing DB-managed `PricingConfig`.
  - ADR 0020 — Migration data v0 vers v1 (Booking).

---

## Statut

**PROPOSED** — en attente décisions Will (SYNTHESIS §3) :

1. Unification vs cohabitation (recommandation = unification).
2. Nom hub public (recommandation = `/fr/ressources/` + `/en/resources/`).
3. Glossaire/Guide-IA migration hardcode (recommandation = OUI en KB-5).
4. Volume Coolify confirmé (à confirmer avant Sprint KB-11).
5. WIP booking gestion (à confirmer avant Phase B `feature/kb-foundations`).

Si toutes les 5 décisions sont validées et `GO BUILD KB-SPRINT-1` reçu, statut passera à **ACCEPTED** et l'ADR sera commité dans `docs/adr/0021-knowledge-base-unifiee.md`.

---

**Auteur** : William Jullin (`williamsjullin@gmail.com` / `la boîte personnelle de la cliente (masquée — dépôt PUBLIC)`).
**Reviewer requis avant ACCEPTED** : Will (auto-revue suffit, projet solo).
