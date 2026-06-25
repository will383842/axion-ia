# 03 — AUDIT BACKEND

> **Laravel ABSENT.** Équivalents audités : **Prisma** (modèles) · **Next route handlers + Server Actions** (controllers) · **BullMQ** (jobs/queues) · `src/server/content-gen/*` (services).

## 3.1 — Modèles & base de données (Prisma)

- ✅ Modèles content : `Article`, `ArticleTranslation`, `ContentGenJob`, `Keyword`, `Category`, `ContentCitation`, `ExternalReference`, `CoverageCampaign`, `GenerationLog`, `ArticleSlugHistory`, `ArticleTombstone`. Index présents (slug unique `@@unique([locale, slug])`, `qualityScore`, `jobId,timestamp`). Pas de migration orpheline détectée.

```
[MAJEUR] | content-publish-worker.ts (gate validateDataQuality) + schema Article | directAnswer/faqJson/keyTakeaway/expertQuote* TOUS nullable, validés UNIQUEMENT par une gate flag-gatée `CONTENT_QUALITY_GATE_ENABLED` (OFF par défaut). | Si la gate est off, des articles « à trous » (sans réponse directe / FAQ < 4) sont publiables → perte Position 0 / risque HCU. (CONFIRMÉ aussi par l'échantillon 02 : un article à 185 mots / 2 H2.)
[MINEUR] | schema Article.generatedByJobId / campaignId | FK String? SANS `@relation` Prisma formelle. | Références orphelines possibles si Job/Campaign supprimé → perte de traçabilité audit.
[MINEUR] | schema ArticleTranslation.ogImage / ogImageAlt | Colonnes présentes mais NULL sur les 33 articles (jamais peuplées ; le rendu og:image dérive de featuredImage). | Colonnes mortes → modèle de données trompeur (cf. 02/07).
[MINEUR] | schema GenerationLog | Index `[jobId,timestamp]` mais PAS `[jobId, step]` ni `[level, timestamp]`. | Requêtes d'audit par étape/niveau = scan post-filtre (lent).
[MINEUR] | scores Decimal(5,2) vs Int vs Float selon table | readability/plagiarism en Decimal, quality/factCheck en Int, KB en Float. | Incohérence de type ; copie directe au publish sans conversion explicite — pas de bug observé mais fragile.
```

## 3.2 — Routes & Server Actions

- ✅ Logique métier déléguée aux Server Actions + services (pattern Next 16, CSRF Origin===Host + Auth.js + HMAC `/api/internal`). Routes admin protégées par `auth()` + role check. Pas de route morte ni d'injection SQL (Prisma only).

```
[MAJEUR] | app/api/internal/revalidate/route.ts | Secret en clair (env) + comparaison de chaîne + AUCUN rate-limit. | Si le secret fuit (logs CI), revalidation arbitraire → pollution de cache / contenu périmé servi. Reco : compare temps-constant + rate-limit.
[MAJEUR] | app/api/admin/articles/[id]/forget/route.ts (~73) | Suppression RGPD cascade SANS ActivityLog (qui/quand/pourquoi). | Non-conformité CNIL art. 17 (traçabilité de la suppression).
[MINEUR] | actions/content-gen/_auth.ts (~56) | Rôle `editor` a accès complet aux actions content-gen (enqueue/approve/reject), pas de granularité par vertical/région. | Broken access control OWASP A01 (faible : comptes admin de confiance).
[MINEUR] | api/admin/.../feedback/route.ts (~29) | `(prisma as any).articleFeedback` contourne le typage. | Perte type-safety.
[MINEUR] | api/internal/kb/ingest/route.ts | Zod sans bornes hautes (`cost` sans max, `generatedAt` sans plafond). | Valeurs aberrantes ingérables (cost=1e9, date 2099).
```

## 3.3 — Jobs & Queues (BullMQ)

- ✅ ~45 workers, queues séparées par priorité (content-gen/publish/fact-check 3-5 concurrence ; email/retention/cron 1). Defaults `attempts:5` + backoff exponentiel + `removeOnComplete/Fail` (rétention 7j/30j). Keyword lock Redis. Alertes Telegram + Sentry sur échec.

```
[MAJEUR] | queues.ts (defaultJobOptions) | AUCUN `timeout` par job/queue (seuls les appels LLM ont 30/60 s). | Un job non-LLM bloqué (ex. image-bank-import) peut tourner indéfiniment → mémoire Redis / OOM worker. Reco : `timeout` par queue.
[MAJEUR] | jobs (failed) | Failed jobs loggés (GenerationLog + Telegram) mais AUCUN dashboard/endpoint d'inspection (pas de BullUI exposé). | Taux/raisons d'échec invisibles côté admin ; si Telegram down, alerte perdue. (cf. 05 : logs non exposés en console.)
[MINEUR] | content-gen-worker.ts (~451-460) | Commentaires `BUG-4 / BUG-5` non suivis dans un tracker. | Dette technique non tracée.
```

## 3.4 — Services & logique métier

- ✅ Helpers extraits et réutilisés : `checkDedup`, `checkDoctrine`, `validateIntentAlignment`, `computeSeoScore`, `acquireKeywordLock`, `trackCost`, `withRetry`, providers encapsulés (router OpenAI/Anthropic, circuit breaker, cost cap). Bonne séparation.

```
[MAJEUR] | src/server/content-gen/ (~200 fichiers) | Pas de couche `ContentGenerationService` unique : la logique de construction de contexte vit dans les générateurs (~1000 l chacun) + worker. | Surface d'audit large, risque de drift logique. Atténué par les helpers extraits. Reco : interface Service { generate/validate/postprocess } pour la clarté d'audit.
[MINEUR] | providers (logging) | Les retries provider sont loggés au niveau provider (console) puis GenerationLog APRÈS coup. | L'audit-trail peut manquer les retries provider-side.
```

## 3.5 — Erreurs & logging

```
[MAJEUR] | shared/generation-log.ts + workers | GenerationLog a un champ `level` mais PAS indexé/filtré ; logs mixtes `console.log`/`logStep` ; pas d'agrégateur (uniquement table DB) ; alertes Telegram fire-and-forget. | Logs prod peu requêtables ; audit-trail (RGPD art. 30 / IA Act art. 50) lent à interroger. Quick-win : `@@index([level, timestamp])` + endpoint `/api/admin/logs`.
[MINEUR] | workers (tous) | `console.log` au lieu d'un logger structuré (pino/winston). | Logs non-JSON → corrélation difficile en prod.
```

## 3.6 — Sécurité

```
[REFUTÉ → acceptable] | « clés API en process.env = CRITIQUE »
Lecture `process.env.ANTHROPIC_API_KEY` etc. est la PRATIQUE STANDARD (env vars). `.env*` est gitignored
(✓ vérifié), les secrets sont injectés au runtime par Coolify (ADR 0026), `SKIP_ENV_VALIDATION` au build
est intentionnel. → NON un CRITIQUE. Reste vrai : rotation de clé = redeploy (acceptable). Reco douce :
gestion de secrets plateforme (déjà le cas via Coolify).
```

```
[MAJEUR] | template-resolver.ts (~71) + console templates | `ContentTemplate.systemPrompt` (éditable en console) est injecté tel quel dans le prompt LLM (au-delà du brand-voice). | Prompt-injection possible si un compte admin/editor est compromis. Reco : longueur bornée + rejet de motifs (« IGNORE / OVERRIDE / INSTRUCTIONS ») OU presets fixes.
[MAJEUR] | shared/generation-log.ts (~19) | `redactGenerationMetadata()` (PII) existe mais N'EST PAS forcé dans `logStep()` (« l'appelant reste responsable »). | Fuite PII possible dans les logs si l'appelant oublie. Reco : redaction obligatoire DANS logStep.
[INFO] XSS LLM → voir 01.5 : REFUTÉ (sanitize en génération ET au rendu, defense-in-depth).
```

- ✅ Zéro secret hardcodé, zéro injection SQL, auth+role sur les routes admin, `.env` gitignored.

### Bilan Étape 3

0 CRITIQUE réel (clés env = pratique standard ; XSS réfuté), ~8 MAJEURS réels (gate qualité off par défaut, revalidate sans rate-limit, RGPD sans log, timeout queues absent, failed-jobs invisibles, prompt-injection template, PII redaction non forcée, pas de service unique), MINEURS divers. **Backend solide** ; priorités = gate qualité + observabilité jobs/logs + RGPD audit-log.
