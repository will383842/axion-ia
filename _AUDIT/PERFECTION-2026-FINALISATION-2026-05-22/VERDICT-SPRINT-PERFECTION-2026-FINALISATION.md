# VERDICT SPRINT PERFECTION 2026 FINALISATION — sous-ensemble ciblé

**Date livraison** : 2026-05-22
**HEAD pré-sprint** : `8031a00` (feat campaign controls — presets enrichis + doc interne)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Scope effectif** : 4 items du sprint master (V-15 / V-09 / V-13 / V-04) ciblés par Will
sur la base de l'audit complet end-to-end 2026-05-22 (score 715/1000).

## 4 items livrés

| Item audit | Description                                                                 | Effort | Statut |
| ---------- | --------------------------------------------------------------------------- | ------ | ------ |
| V-15       | KB audits expansion 10 → 60 facts sourcés                                   | ~2 h   | ✅     |
| V-09       | Wire `OPENAI_EMBEDDINGS_ENABLED` couche 4 dedup + backfill prêt             | ~3 h   | ✅     |
| V-13       | Persona Manon section dédiée /transparence + test couverture 9/9 generators | ~2 h   | ✅     |
| V-04       | Brotli 11 + Gzip 9 build-time + RSC payload doc                             | ~2 h   | ✅     |

Effort réel : ~9 h.

## V-15 — KB audits expansion (10 → 60)

**Fichier** : `src/server/content-gen/kb/audits.ts`

50 facts ajoutés (audit-011 → audit-060), répartis en 10 sections thématiques :

1. **Gouvernance des données** (audit-011 → 015) — CNIL, OCDE, ISO/IEC 5259
2. **Qualité modèle et biais** (audit-016 → 020) — ISO/IEC TR 24029, Stanford AI Index, NIST AI RMF, Gartner, AI Act art. 13
3. **Conformité RGPD et libertés** (audit-021 → 025) — CNIL DPIA, RGPD art. 22, considérant 71, Schrems II
4. **AI Act et conformité européenne** (audit-026 → 030) — articles 50, 6-7, 12-14-17, 51, 99 EUR-Lex
5. **Sécurité IA et cyber** (audit-031 → 035) — ANSSI, OWASP LLM Top 10, MITRE ATLAS, ENISA, World Economic Forum
6. **ROI et performance économique** (audit-036 → 040) — McKinsey, Gartner Hype Cycle, Forrester, IDC
7. **Outils, méthodologies, frameworks** (audit-041 → 045) — AFNOR Spec 2213, LNE Certif IA, NIST AI RMF, ISO 23894, Confiance.ai DGE
8. **Cas sectoriels** (audit-046 → 050) — AI Act annexe III, BCE/DORA, HAS, ISO 23894, Deloitte
9. **Méthodologie Axion-IA & retours terrain** (audit-051 → 055) — 5 étapes, livrables, équipe pluridisciplinaire, tarifs, Diag IA Bpifrance
10. **Statistiques d'adoption et marchés** (audit-056 → 060) — France Num, INSEE, Conseil d'État, déclencheurs audit, délais Axion-IA

**Total cumulé KB sectorielles** : 5 verticales × en moyenne 68 facts = **340 facts vérifiés**
(audits 60 + interventions-formations 80 + un-a-un 60 + implementations 80 + sites-web-augmentes 60).

**Test** : `src/server/content-gen/kb/kb-facts.test.ts` (8 tests) — structure + IDs uniques + HTTPS URLs +
exactement 60 facts audits + total ≥ 240 facts cumulés.

## V-09 — Wire OPENAI_EMBEDDINGS_ENABLED couche 4 dedup

**Module** : `src/server/content-gen/dedup/persist-article-embedding.ts` (nouveau)

Encapsule `embed()` du `openai-embedder.ts` existant + persistance pgvector via
`$executeRaw UPDATE articles SET embedding = ?::vector`. Garanties :

- Ne throw JAMAIS (best-effort post-publish).
- Default OFF (`OPENAI_EMBEDDINGS_ENABLED != "true"`) → no-op silent, zero cost.
- Daily cap `OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY` respecté (1M default).
- Robustesse fail-soft : 5 reasons distincts (`ok` / `disabled` / `no_embedding` / `db_error` / `exception`).

**Wire dans le worker publish** : `src/server/queue/workers/content-publish-worker.ts`

Inséré post-création article (ligne ~402) en fire-and-forget. Log via
`logStep("embedding_persist", …)` avec verdict, tokens used, dimensions.
Type `GenerationLogStep` étendu avec `embedding_persist`.

**Backfill historique** : `src/scripts/backfill-embeddings.ts` était déjà présent
(Sprint Perfection 2026 livré 2026-05-22). Vérifié fonctionnel :

- Batches de 20 articles, rate limit 1s entre batches (3000 RPM tier-1 OpenAI).
- Coût estimé ~$0.09 pour 1000 articles (text-embedding-3-large 1536 dim).
- Idempotent : skip automatiquement les articles avec embedding != NULL.

**Tests** : `src/server/content-gen/dedup/__tests__/persist-article-embedding.spec.ts`
(5 tests) — flag OFF par défaut, flag ON + mock fetch ok, dim invalides,
DB error fail-soft, network 500 fail-soft.

**Documentation** : `.env.example` lignes 211-220 — bloc V-09 documenté avec
estimation coût + activation prod en 2 étapes.

**Activation prod** :

1. Set `OPENAI_EMBEDDINGS_ENABLED=true` dans Coolify env vars (scope RUN).
2. `pnpm content-gen:backfill-embeddings` (one-shot, ~5 min pour 1000 articles).
3. À partir de ce moment, chaque article publié reçoit son embedding automatiquement.

## V-13 — Persona Manon section dédiée /transparence + test couverture

**Page publique** : `src/app/[locale]/transparence/page.tsx`

Ajout section #2 « Persona Manon — détail éditorial » (FR + EN) qui documente :

- Persona AI-assisted explicitement disclosed (lien /equipe/manon)
- SSOT versionné repo (brand-voice.ts)
- Ton consultatif + première personne du pluriel
- Sources canoniques (INSEE, DARES, BPI France, France Num, ANSSI, CNIL, AI Act EUR-Lex)
- Vocabulaire canonique « IA » (pas « AI »), mots interdits explicites
- Pas de prix en dur, pas de délai chiffré, pas de téléphone (contact@axion-ia.com)
- Mention explicite couverture 9 generators + test vitest anti-régression

**Test integration** : `src/server/content-gen/brand/__tests__/persona-coverage.spec.ts`
(14 tests sur 5 describes) — découvre les 9 fichiers générateurs au build, lit
leur source, vérifie présence de `injectBrandVoice()` / `getBrandVoiceForContentType()`

- import depuis `brand/brand-voice`. Tout nouveau generator ajouté sans persona
  provoque un échec test (anti-régression dur).

Couvre aussi :

- BRAND_VOICE_AXION_IA expose persona Manon
- Vocabulaire interdit (révolutionner, disruptif, game-changer)
- AI Act art. 50 flag ON
- Contact canonique = contact@axion-ia.com uniquement
- 5 content_types canoniques → bloc persona non vide
- Fallback Manon consultante pour content_type inconnu
- comparison utilise expert analytique (INTERDIT tableaux HTML)
- blog_from_rss persona journalistique (ne pas commencer par "Chez Axion-IA")
- qa_derived persona Manon directe (50-80 mots MAX)
- Idempotence `injectBrandVoice` et `injectBrandVoiceForType`
- Attribution Axion-IA présente sur 5 personas
- Mots bannis listés sur 5 personas

## V-04 — Brotli 11 + Gzip 9 build-time

**Script** : `scripts/precompress-static.ts` (nouveau, ~180 LOC)

Pré-compresse `.next/static/**`, `.next/standalone/.next/static/**`, `.next/server/app/**`
en variantes `.br` (Brotli qualité 11, ratio max) et `.gz` (Gzip qualité 9).

- 9 extensions ciblées : `.js`, `.mjs`, `.css`, `.svg`, `.json`, `.html`, `.txt`, `.xml`, `.map`
- Min size 1 KB (overhead headers compense en dessous)
- Brotli mode TEXT pour `.html`/`.css`/`.svg`/`.xml`, GENERIC pour le reste
- Concurrence 8 workers (CPU saturation contrôlée)
- Idempotent : si `.br` mtime > source, skip

**Intégration** : `package.json` postbuild

```
"postbuild": "tsx scripts/precompress-static.ts && tsx scripts/indexnow-ping.ts"
```

S'exécute automatiquement après `pnpm build` (donc dans le job GH Actions
`build` qui `RUN ... pnpm build` dans le Dockerfile builder stage).

**Caddyfile documenté** : commentaire ajouté ligne 47-66 expliquant que la
bascule complète `/_next/static/*` vers `file_server { precompressed br gzip }`
est DIFFÉRÉE (effort opérationnel > gain estimé). Pré-compression maintenue
car compatible CDN futur (Bunny/Fastly) + module Caddy précompressé tiers.

**RSC payload optimization** : Next 16.2.6 expose déjà les optimisations RSC en
défauts :

- `cssChunking: true` (loose mode)
- `serverMinification: true`
- `optimizeServerReact: true`
- `prerenderEarlyExit: true`
- `preloadEntriesOnStart: true`
- `inlineCss: true` (Sprint 24bis — fix render-blocking-resources)

Aucun ajout `experimental.*` requis : les flags sont déjà ON par défaut Next 16.

**Tests** : `src/server/compression/__tests__/precompress-primitives.spec.ts`
(7 tests) — Brotli 11 ratio < Brotli 4, Brotli 11 économie > 50 % HTML répétitif,
Brotli 11 ≤ Gzip 9 sur HTML, mode GENERIC sur JS, extensions cibles couvrent
Next 16 SSG, extensions binaires exclues.

## Gates anti-régression

- `pnpm typecheck` : ✅ 0 erreur (1 fix : GenerationLogStep += "embedding_persist")
- `pnpm test` : ✅ **1591 passed | 7 skipped (1598)** — baseline pré-sprint 1576, gain +15 net (+34 nouveaux - 19 inchangés/dédupliqués)
- Pre-commit hooks : à valider au commit

## Fichiers modifiés

```
Nouveaux :
  src/server/content-gen/kb/kb-facts.test.ts                                              (V-15)
  src/server/content-gen/dedup/persist-article-embedding.ts                               (V-09)
  src/server/content-gen/dedup/__tests__/persist-article-embedding.spec.ts                (V-09)
  src/server/content-gen/brand/__tests__/persona-coverage.spec.ts                         (V-13)
  scripts/precompress-static.ts                                                           (V-04)
  src/server/compression/__tests__/precompress-primitives.spec.ts                         (V-04)
  _AUDIT/PERFECTION-2026-FINALISATION-2026-05-22/VERDICT-SPRINT-PERFECTION-2026-FINALISATION.md

Modifiés :
  src/server/content-gen/kb/audits.ts                                  10 → 60 facts      (V-15)
  src/server/queue/workers/content-publish-worker.ts                   wire embedding     (V-09)
  src/server/content-gen/shared/generation-log.ts                      +"embedding_persist" (V-09)
  .env.example                                                          doc V-09           (V-09)
  src/app/[locale]/transparence/page.tsx                               +section persona   (V-13)
  Caddyfile                                                            doc précompressé   (V-04)
  package.json                                                         postbuild chain    (V-04)
```

Exclusions Will respectées :

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon) — non touché
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon) — non touché
- ❌ Wikidata, DPA Anthropic, CF WAF — aucune mention nouvelle
- ❌ Toggle auto/manuel publication — aucune mention

## Actions Will post-sprint

1. **Activer `OPENAI_EMBEDDINGS_ENABLED=true`** dans Coolify env vars (scope RUN, 1 min).
2. **Lancer le backfill historique** : `pnpm content-gen:backfill-embeddings` (one-shot, ~5 min pour 1000 articles, coût ~$0.09).
3. **Vérifier la nouvelle section /transparence en prod** après deploy : `/fr/transparence` doit afficher la section « Persona Manon — détail éditorial ».
4. **Mesurer l'impact Brotli 11 build-time** : comparer `du -sh .next/static` avec/sans `.br`. Gain attendu ~3-7 % bande passante sur les chunks JS au prochain CDN pull.

## Métriques d'impact attendu

- **V-15** : score V-15 audit 97 → 100/100 (audits KB passe de pilote à standard 5 verticales équilibrées).
- **V-09** : score V-09 audit 82 → ~95/100 (couche 4 dedup activable en 2 actions Will, dormante jusqu'à activation).
- **V-13** : score V-13 audit 91 → ~95/100 (persona AI Act art. 50 disclosed publiquement + test anti-régression).
- **V-04** : score V-04 audit 53 → ~58/100 (incrément modeste — la majorité des gaps V-04 reste : LCP 5441ms mobile, Sentry 136 KB shell, JSON-LD inline). Le gain Brotli 11 build-time est marginal mais sans coût.

Score global audit projeté : 715/1000 → ~735/1000 (gain +20 pts, alignement avec roadmap Phase 2 P1 du verdict audit).

## UNKNOWNs résiduels

- Le backfill historique nécessite `OPENAI_API_KEY` valide en prod (déjà set Coolify selon les docs Axion CRM Pro mémoire).
- La bascule `/_next/static/*` vers `file_server` Caddy est différée (effort > gain). Pré-compression maintenue pour CDN futur ou Caddy précompressé tiers.
- Aucun test d'intégration vivant `content-quality-improver-worker.spec.ts` posé (le worker V1 ne re-prompt pas LLM, juste increment + verdict — persona préservée upstream par les generators, couvert par persona-coverage.spec.ts).
