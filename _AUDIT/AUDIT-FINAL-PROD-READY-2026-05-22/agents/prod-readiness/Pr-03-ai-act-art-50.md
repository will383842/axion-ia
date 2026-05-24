# Pr-03 — AI Act Art. 50 (deadline 2026-08-02)

**HEAD** : 81f6ea0e
**Score** : 22 / 25

## Évidence

### Wording disclosure D4 (Will figée)

- `src/components/marketing/AiContentDisclaimer.tsx:33-76` composant Server Component bilingue FR/EN aligné Art. 50 §4 AI Act 2024/1689.
- Wording max FR (ligne 37) : « Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689). »
- Wording EN équivalent (ligne 38).
- Provider transparent (Claude Sonnet 4.6, Anthropic) — exigence Art. 50 §1 "informed in a clear and distinguishable manner".
- Pattern visuel terracotta-soft, lien `/transparence` (ligne 67) — hub conformité.
- Routes couvertes documentées (ligne 17-22) : `/actualites/[slug]`, `/blog/[slug]`, `/centre-aide/[slug]`, `/guides/[slug]`.

### JSON-LD machine-readable

- `src/lib/seo-content-gen-factories.ts:69-77` factory pose :
  - `aiGenerated: true` (Schema.org/AIGeneratedContent)
  - `additionalType: "https://schema.org/AIGeneratedContent"`
  - `disambiguatingDescription` humain-readable
  - Pose `creator` (Anthropic Claude) + `usageInfo` (référence /transparence)
- Tests `src/lib/seo-content-gen-factories.test.ts` ✅.
- Couvre BlogPosting + NewsArticle + HelpArticle + Guide (cf. méta-cert AGENT 20 commentaire ligne 17-22 du composant).

### Traçabilité GenerationProvenance (6 ans rétention SOC2)

- `prisma/schema.prisma:976-1000` modèle complet :
  - `articleId` (relation Restrict — empêche suppression article cascade)
  - `step`, `provider`, `model`, `modelVersion`
  - `promptHash` 64 chars (SHA-256) — non-repudiation
  - `inputTokens`, `outputTokens`, `cacheReadInputTokens`
  - `cost` Decimal(10,6)
  - `regulationVersion: "AI-Act-2024/1689"` defaulted
  - `previousHash` + `hash` — hash-chaîné (audit-trail blockchain-style)
  - `timestamp` indexé
- Migration `prisma/migrations/20260521180000_sync_schema_p0_fixes/migration.sql` sync explicite onDelete: Restrict.

### Pas de double-publication (lockDuration BullMQ)

- Verrouillage worker côté queue (mémoire 2026-05-21 P0-2 `lockDuration` corrigé). `content-publish-worker` côté `src/server/queue/workers/`.

### Persona Manon (transparence éditoriale)

- `/equipe/manon` portrait + disclaimer (mémoire 2026-05-22 V-04). `AuthorProfile.aiGenerated` flag DB.

## Findings P0 / P1 / P2

- **P0** : aucun bloquant. Deadline 2026-08-02 maîtrisée largement (2,5 mois d'avance).
- **P1 (coverage check pages IA)** : composant `AiContentDisclaimer` confirme 4 routes (`/actualites`, `/blog`, `/centre-aide`, `/guides`). Cas-concrets, comparaisons, glossaire entries IA-générés à vérifier — `Grep aiGenerated.*true` confirme `cas-concrets/[slug]/page.tsx` couvert (8 fichiers total). À ratifier via test E2E systématique : grep tous templates AI content factory + check rendu disclaimer.
- **P1 (formal AIA register)** : pas de "Registre traitements IA" interne distinct du registre RGPD Art. 30. AI Act n'exige pas formellement un registre interne side-by-side mais best practice 2026 dans le cadre des audits sectoriels (Bpifrance, CNIL JTLM joint task force). Effort ~2-3h.
- **P2 (snapshot regulationVersion)** : default `"AI-Act-2024/1689"` figé en schéma. Quand AIA Annex sera mis à jour (Implementing Acts attendus 2026-Q4), prévoir migration `default → "AI-Act-2024/1689-IA1"`. Pas urgent.
- **P2 (provider versioning)** : `modelVersion` champ `String? @VarChar(40)` — bonne pratique mais usage à confirmer dans workers (`content-gen-worker.ts` doit le populer).

## Verdict (paragraphe)

Conformité AI Act Art. 50 quasi-exemplaire à 2,5 mois avant deadline (2026-08-02). Triple-couche conformité : (1) disclosure humain visible bilingue avec wording explicite provider+régulation, (2) machine-readable JSON-LD `aiGenerated:true + AIGeneratedContent` sur 4+ templates contenu, (3) traçabilité forensique `GenerationProvenance` hash-chaînée 6 ans SOC2-ready (provider, prompt hash, tokens, coût, regulationVersion versionné, previousHash audit-trail). Persona Manon + `/transparence` complètent le narratif éditorial. Restant : coverage check systématique tous templates IA-générés + éventuel registre AIA narratif (best practice). Score 22/25 — production-ready, modèle de référence pour la place.
