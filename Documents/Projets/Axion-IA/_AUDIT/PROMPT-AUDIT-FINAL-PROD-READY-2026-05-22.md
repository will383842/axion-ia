# MEGA-PROMPT AUDIT FINAL PRÉ-PRODUCTION
## AxionIA — Vérification exhaustive frontend + backend + flows + production readiness — mai 2026

**Date création** : 2026-05-22
**Type** : Mega-audit pré-production (DERNIER audit avant utilisation concrète prod)
**Mode** : **AUDIT-ONLY strict** — zéro modification code, zéro commit
**Effort estimé** : **15-20h autopilot avec Opus 4.7 recommandé**
**Demandé par Will explicitement le 2026-05-22** : "audit complet de tout cet outil de bout en bout... vérifier aussi le frontend, le backend et que tout les routes et que tout soit parfaitement raccordé et parfait"

**🎯 Sortie unique critique** : `ROADMAP-P0-P1-P2-CONSOLIDE.md` — UN SEUL fichier listant tous les P0/P1/P2 trouvés, ordonnés, chiffrés, priorisés. Avec un verdict GO PROD / SPRINT FINAL / NO-GO.

---

## 0. CONTEXTE PROJET AXION-IA (lecture intégrale obligatoire)

### Qui est AxionIA
- **Société française** (D7 tranché : pas Axion-IA OÜ Estonie)
- Activité : audit IA + conseil + formation + accompagnement 1-to-1 + sites web augmentés IA
- Site : `https://axion-ia.com` (français), locale EN désactivée
- Fondateur : Will Jullin (`williamsjullin@gmail.com`)
- Persona contenus : "Manon, experte IA chez Axion-IA" (personnage fictif assumé)

### 5 verticales métier
| Slug | Activité |
|---|---|
| `interventions_formations` | Formations IA + interventions |
| `audits` | Audits IA entreprise |
| `un_a_un` | Coaching/accompagnement individuel dirigeants |
| `implementations` | Projets d'intégration IA |
| `sites_web_augmentes` | Sites web augmentés par IA |

### Stack technique
- **Frontend** : Next.js 16 App Router (RSC + Server Actions)
- **DB** : Postgres 16 + Prisma 5.22
- **Queue** : BullMQ (Redis)
- **LLM** : Anthropic Claude Sonnet 4.6 (gen) + Opus 4.7 (reviewer judge)
- **Embeddings** : OpenAI text-embedding-3-large (3072 dim, pgvector IVFFlat)
- **Hosting** : Hetzner CPX42 + Coolify
- **CDN** : Cloudflare
- **Search** : Postgres FTS + pg_trgm
- **Auth** : NextAuth.js
- **Storage** : Hetzner Storage Box (backups)

### Décisions Will canoniques FIGÉES (ne pas re-demander)

**D-W1 à D-W5** (P1.5) :
- D-W1 : `MAX_PUBLISH_PER_DAY=30` initial, rampe progressive 30→500
- D-W3 : `factoryAutoPublishAllBlogTypes` ACTIVÉ
- D-W4 : Embedding provider = OpenAI text-embedding-3-large

**D-P5-1 à D-P5-6** (P5 console admin) :
- D-P5-1 : 6 presets CampaignTemplate validés
- D-P5-2 : Seuil qualité 60/100
- D-P5-3 : Reporting email hebdo lundi 8h CET
- D-P5-4 : Tableau croisé (pas heatmap)
- D-P5-5 : MAX_PUBLISH rampe manuelle UI
- D-P5-6 : Ordre Phase A puis B

**D1-D5** (P4 qualité éditoriale) :
- D1 : Seuil REJECT = 6.0/10 (= 60/100)
- D2 : 3 itérations pour `blog_pillar`+`landing_ville`, 2 pour autres
- D3 : Persona "Manon, experte IA chez Axion-IA"
- D4 : Wording AI Act = "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."
- D5 : Reporting email lundi 8h

**D7** : Société française pure (pas OÜ)

### EXCLUSIONS WILL ABSOLUES (NE PAS mentionner / proposer)
- ❌ Wikidata Q-ID : Will renonce
- ❌ DPA Anthropic signature : reporté
- ❌ CF WAF Block AI Bots : déjà désactivé
- ❌ Toggle auto/manuel publication : renoncé

---

## 1. MISSION DU MEGA-PROMPT

Vérifier que **TOUT L'OUTIL AxionIA** est **production-ready** pour utilisation concrète client, sur 4 dimensions critiques :

1. **Frontend complet** (10 axes) : toutes routes publiques + admin V2 + responsive + a11y + SEO
2. **Backend complet** (10 axes) : workers + APIs + DB + queues + APIs externes + monitoring
3. **Flows utilisateur bout-en-bout** (10 axes) : 15 scénarios réels testés
4. **Production readiness** (10 axes) : sécurité + RGPD + AI Act + backups + CI/CD + tests + best practices 2026

**40 sous-agents parallèles**, score `/25 chacun = /1000 total`.

**Sortie principale** : `ROADMAP-P0-P1-P2-CONSOLIDE.md` avec **TOUS les P0/P1/P2 dans un seul fichier**, priorisés, chiffrés, actionnables.

**Verdict final** : 🟢 GO PROD / 🟡 SPRINT FINAL / 🔴 NO-GO.

---

## 2. FICHIERS À LIRE EN PREMIER (60+ fichiers, lecture obligatoire)

### Bloc A — Mémoires Claude
1. `axionia_decisions_will_final_2026-05-21.md` (D7 + exclusions)
2. `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5)
3. `axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)
4. `axionia_phase6_verdict_global_2026-05-21.md` (P6 verdict si livré)
5. `axionia_metaaudit_phase6_2026-05-22.md` (méta-audit P6 si livré)
6. `axionia_audit_complet_end_to_end_2026-05-22.md` (audit 16 axes si livré)
7. `axionia_sprint_external_links_database_livre_2026-05-22.md` (si livré)
8. `axionia_sprint_perfection_2026_livre_2026-05-22.md` (si livré)
9. `axionia_sprint_keywords_perfection_livre_2026-05-22.md` (si livré)
10. `axionia_sprint_campaign_controls_livre_2026-05-22.md` (si livré)
11. `axionia_content_gen_p1_5_livre_2026-05-21.md`
12. `axionia_verif_sprint_p2/p3/p4/p5_corrections_2026-05-21.md` (4 mémoires)
13. `axionia_keywords_747seeds_2026-05-20.md`
14. `axionia_keyword_strategy_audit_2026-05-19.md`
15. `axionia_image_bank_complet_2026-05-20.md`
16. `feedback_no_dalle_images.md`
17. `feedback_no_repeat_action_lists.md`
18. `axionia_couleurs.md`
19. `axionia_positionnement_4_verticales.md`

### Bloc B — Verdicts d'audit historiques
20. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-{1,1.5,2,3,4,5,6}/PHASE-X-VERDICT.md` (7 verdicts)
21. `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/VERDICT-AUDIT-COMPLET-CONTENT-GEN.md` (si livré)
22. `_AUDIT/EXTERNAL-LINKS-2026-05-22/VERDICT-SPRINT-EXTERNAL-LINKS-DATABASE.md` (si livré)

### Bloc C — Code source clés à auditer

#### Configuration
23. `package.json` + `pnpm-lock.yaml`
24. `next.config.ts`
25. `tsconfig.json`
26. `eslint.config.mjs`
27. `.env.example`
28. `Dockerfile` + `Dockerfile.worker`
29. `Caddyfile`
30. `lighthouserc.json`
31. `prisma/schema.prisma` (modèle complet)

#### Frontend
32. `src/app/layout.tsx` (root layout)
33. `src/app/[locale]/layout.tsx`
34. `src/app/[locale]/page.tsx` (home)
35. `src/app/[locale]/blog/[slug]/page.tsx`
36. `src/app/[locale]/audits/[ville]/page.tsx`
37. `src/app/[locale]/implantations/[ville]/page.tsx`
38. `src/app/[locale]/(admin)/[adminPrefix]/content-gen/layout.tsx`
39. `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx`
40. `src/app/sitemap.ts` + sub-sitemaps
41. `src/app/robots.ts`
42. `src/components/seo/AiContentDisclaimer.tsx`
43. `src/components/seo/Breadcrumbs.tsx`
44. `src/components/seo/AuthorByline.tsx`
45. `src/components/seo/ArticleTOC.tsx`
46. `src/components/admin/content-gen/*` (composants V2 livrés)
47. `src/lib/seo.ts` (JSON-LD builders)
48. `src/lib/brand.ts`
49. `src/lib/slug.ts`

#### Backend
50. `src/server/queue/workers/*.ts` (tous les workers, 12+ fichiers)
51. `src/server/content-gen/generators/*.ts` (7 generators)
52. `src/server/content-gen/reviewer/llm-judge.ts`
53. `src/server/content-gen/dedup/*.ts`
54. `src/server/content-gen/keyword-selector.ts`
55. `src/server/content-gen/images/assign-hero-image.ts`
56. `src/server/content-gen/admin/*.ts` (server actions)
57. `src/server/clients/*.ts` (Anthropic, OpenAI, Perplexity, etc.)
58. `src/server/queue/index.ts` (queue registration)
59. `auth.ts` + `auth.config.ts`
60. `proxy.ts` (Edge middleware)

#### Infra + DevOps
61. `.github/workflows/*.yml` (CI/CD)
62. `deploy/*` (scripts deploy)
63. `docker/*` (configs Docker)
64. `prisma/migrations/` (toutes les migrations)
65. `prisma/seeds/` (seeds)

### Mode AUDIT-ONLY (impératif)
- ❌ Aucun `git commit`, `git push`, modification source
- ❌ Aucune installation dépendance
- ❌ Aucune modification env vars / Coolify
- ❌ Aucune création worker / cron / hook
- ✅ Lecture exhaustive
- ✅ Diagnostics (`pnpm typecheck/lint/test`, `curl`, `psql -c "SELECT..."`, `npx lighthouse`, BullMQ admin lecture)
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/`

---

## 3. SPAWN 40 SOUS-AGENTS PARALLÈLES (4 blocs × 10 agents)

Chaque agent produit un rapport `agents/<bloc>/<numéro>-<nom>.md`. Score `/25` honnête.

---

### 🔹 BLOC FRONTEND (10 agents × 25 pts = 250 pts)

#### F-01 — Routes publiques 100% fonctionnelles (/25)
Tester via curl chaque route publique (échantillon 30+ routes) :
- `/`, `/fr`, `/audits`, `/audits/paris`, `/interventions-formations`, `/un-a-un`, `/implementations`, `/sites-web-augmentes`
- `/blog`, `/blog/[test-slug]`, `/guides`, `/cas-concrets`, `/glossaire`, `/presse`, `/galerie`
- `/stack-ia`, `/stack-ia/[tool]`, `/codage-developpement`
- `/contact`, `/booking`, `/mentions-legales`, `/cgv`, `/rgpd`, `/transparence`, `/corrections`
- `/ai-policy`, `/faq`, `/qui-sommes-nous`
- `/implantations/paris`, `/implantations/lyon`

Pour chaque :
- Status 200 ?
- JSON-LD présent et valide ?
- BreadcrumbList ?
- metaTitle + metaDescription uniques ?
- H1 unique ?
- Pas de 404 cassés (`<a href>` internes valides) ?

#### F-02 — Routes admin V2 sécurisées (/25)
Tester routes admin :
- `/[adminPrefix]/content-gen/**` (~22 sous-pages)
- `/[adminPrefix]/image-bank/**`
- `/[adminPrefix]/users/**`
- `/[adminPrefix]/settings/**`

Pour chaque :
- Redirige vers login si non-auth ?
- `ADMIN_URL_PREFIX` env var respecté (secret) ?
- CTA terracotta présent (D-P5-2) ?
- 4 sections regroupées dashboard (D-P5-6) ?
- Pause/resume liste campagnes (D-P5 sprint P5) ?

#### F-03 — Mobile responsive (/25)
Lighthouse mobile sur 5 pages échantillon :
- `/` (home)
- `/blog/[slug-test]`
- `/audits/paris`
- `/contact`
- `/[adminPrefix]/content-gen/`

Scores attendus mobile :
- Performance ≥ 85
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95
- LCP mobile ≤ 2500ms
- CLS mobile ≤ 0.1
- INP mobile ≤ 200ms

#### F-04 — Accessibility WCAG 2.2 AA (/25)
- Tous les `<img>` ont `alt` non-vide ?
- Tous les boutons icon-only ont `aria-label` ?
- Contrastes ≥ 4.5:1 partout (terracotta #c24a1b sur ivoire #faf8f3) ?
- Navigation clavier 100% accessible ?
- Skip links présents ?
- `<html lang="fr">` correct ?
- Heading hierarchy logique (H1→H2→H3) ?
- Form labels associés ?

#### F-05 — Performance Web Vitals 2026 (/25)
Lighthouse desktop sur 10 pages :
- LCP ≤ 1800ms (gate lighthouserc.json)
- INP ≤ 80ms (best practice 2026, remplace FID)
- CLS ≤ 0.05
- TBT ≤ 200ms
- FCP ≤ 1500ms
- Bundle JS initial ≤ 75 KB gzipped
- AVIF + WebP partout
- `<Image>` Next.js avec `width`/`height` (anti-CLS)
- `priority` sur LCP image
- `next/font` ou `font-display: swap`

#### F-06 — SEO meta + JSON-LD centralisation (/25)
- 100% pages ont metaTitle unique (< 60 chars)
- 100% pages ont metaDescription unique (< 155 chars)
- JSON-LD `Organization` avec `legalName` société FR (D7)
- JSON-LD `WebSite` + `SearchAction`
- JSON-LD `BreadcrumbList` sur 100% pages
- JSON-LD `BlogPosting` + `aiGenerated:true` sur articles
- JSON-LD `SpeakableSpecification` (acquis P3 QW-1)
- JSON-LD `Person` Manon (D3)
- JSON-LD `FAQPage` sur /faq
- JSON-LD `LocalBusiness` sur pages villes

#### F-07 — Maillage interne + suggested content (/25)
- 100% articles ont ≥ 3 liens internes
- 100% articles ont ≥ 2 liens externes (sources autorité)
- Composant "Articles connexes" en bas de chaque article
- Pages villes ont section "Villes proches" (acquis P3 QW-10)
- Ancres descriptives partout (pas "cliquez ici")
- Pas d'orphan pages (toutes accessibles depuis sitemap + navigation)

#### F-08 — Sitemaps + robots.txt (/25)
- `sitemap-index.xml` master présent
- `sitemap-pages.xml`, `sitemap-blog.xml`, `sitemap-news.xml`, `sitemap-villes-*.xml`, `sitemap-guides.xml`, `sitemap-glossaire.xml`, `sitemap-presse.xml`, `sitemap-cas-concrets.xml`, `sitemap-stack-ia.xml`, `sitemap-images-*.xml`
- Chaque sub-sitemap auto-généré depuis DB
- `<lastmod>` différencié
- `robots.ts` permet ClaudeBot/GPTBot/PerplexityBot/GoogleBot
- IndexNow ping post-publish
- GSC + Bing WMT soumissions

#### F-09 — UX/UI brand cohérent (/25)
- Couleurs respectées : terracotta `#c24a1b` CTAs primaires + bleu `#1a4dd9` pointes + ivoire `#faf8f3` fond
- Aucun `bg-blue-*` sur CTAs primaires
- Typographie cohérente (next/font)
- Spacing system cohérent (Tailwind tokens)
- Component library SSOT (`src/components/ui/`)
- Pas de divergence entre admin V2 et front public (même design system)

#### F-10 — Cookieless future + privacy (/25)
- Analytics first-party only (Plausible / Umami / Vercel Analytics) — pas Google Analytics ?
- Cookies non-essentiels avec consentement utilisateur (Tarteaucitron / Klaro / cookieyes)
- IP hashing acquis (SHA-256 + `IP_HASH_SALT`)
- Pas de tracking cross-site
- Politique de confidentialité à jour
- Pas de fingerprinting browser

---

### 🔹 BLOC BACKEND (10 agents × 25 pts = 250 pts)

#### B-01 — Workers BullMQ santé (/25)
Lister tous les workers actifs (12+ probable) :
- `content-gen-worker`
- `content-publish-worker`
- `content-quality-improver-worker`
- `content-monitoring-worker`
- `content-gen-orchestrator-worker`
- `content-gen-scheduler-worker` (si Sprint Campaign Controls livré)
- `content-gen-deadline-checker-worker` (idem)
- `indexnow-worker`
- `sitemap-update-worker`
- `image-bank-enrich-worker`
- `image-bank-translate-worker`
- `keyword-tracking-worker`
- `keyword-opportunity-detector-worker`
- `external-links-monitor-worker` (si External Links Sprint livré)
- `embeddings-backfill-worker`
- `brand-voice-drift-monitor-worker`
- `weekly-quality-report-worker`
- `rss-fetch-worker`

Pour chaque vérifier :
- `lockDuration: 120000` (acquis P2 sprint)
- `captureWorkerError` + Sentry (acquis S+4)
- Retry policy : 3 retries + backoff exponentiel
- Dead-letter queue
- Rate limiter si appel API externe (acquis P2 P0-7)

#### B-02 — APIs + Server Actions sécurisées (/25)
- Auth admin requise sur 100% routes admin
- Rate limiting sur APIs publiques (POST /api/contact, /api/booking)
- Validation Zod côté serveur sur 100% inputs
- CSRF protection (Server Actions natif Next.js)
- SQL injection : Prisma parameterized partout
- XSS : DOMPurify sur user-generated content (acquis S+5 FAQ)
- Pas de secrets exposés client-side (grep `process.env.[A-Z_]*` dans `src/app/` `src/components/`)

#### B-03 — DB Postgres + Prisma optimisé (/25)
- `prisma migrate status` no drift
- `prisma validate` OK
- Index critiques présents (acquis P2 P0-8) :
  - `articles (status, published_at DESC)`
  - `generation_provenance (article_id, timestamp DESC)`
  - `keywords (vertical, last_used_at ASC NULLS FIRST, usage_count ASC)`
- `EXPLAIN ANALYZE` sur 5 queries critiques : pas de Seq Scan sur grosses tables
- Foreign keys cohérentes (ON DELETE RESTRICT pour `generation_provenance` — acquis P2 P0-1 AI Act)
- Pas de N+1 (acquis P2 P1-15 reporté ? à vérifier)
- Connection pool dimensionné (Prisma `connection_limit` env var)

#### B-04 — Redis + queues clean (/25)
- BullMQ queues nommées clairement
- Pas de jobs orphelins (queue depth raisonnable)
- Dead-letter queue configurée
- Cost tracker INCR atomique (acquis P2 P0-4)
- Cleanup automatique jobs complétés (gardé X jours)
- Monitoring queue depth (alerte si > seuil)

#### B-05 — External APIs intégration (/25)
- Anthropic : Claude Sonnet 4.6 (gen) + Opus 4.7 (reviewer judge) — clients existants et utilisés
- OpenAI : embeddings text-embedding-3-large (D-W4)
- Voyage AI : si activé pour RAG fact-checking
- Perplexity : si activé pour citations (P3) + sources externes (External Links sprint)
- GSC API : service account JSON valorisé Coolify ?
- IndexNow : clé valide + ping post-publish
- Telegram : webhook valorisé pour alertes
- Pour chaque : fallback si API down ? Retry strategy ?

#### B-06 — Cost tracker + alertes (/25)
- `cost-tracker.ts` robuste (acquis P2)
- Monthly caps par provider (Anthropic / OpenAI / Voyage AI)
- Alerte Telegram à 80% du cap
- Désactivation automatique provider à 100%
- Kill-switch global si plus de provider dispo
- Audit trail DB
- Coût moyen / article observé (lecture `cost_records` table) : cohérent attendu ~$0.10/article ?

#### B-07 — Provenance + AI Act compliance (/25)
- `GenerationProvenance` model présent (acquis P1.5 B.4)
- Hash chaîné (acquis)
- CASCADE → RESTRICT (acquis P2 P0-1)
- `promptHash` = vrai hash du prompt LLM (acquis P2 P0-3)
- 16 champs trace AI Act
- Rétention 6 ans
- Endpoint admin lecture pour audit
- Pas de PII en clair (sanitize-job-data appliqué)

#### B-08 — Background jobs cron documentés (/25)
Lister tous les cron actifs :
- Daily 3h UTC : embeddings backfill (si activé)
- Daily 4h UTC : brand voice drift monitor
- Daily 00:05 UTC : campaign deadline checker (si Sprint Campaign Controls livré)
- Every 5 min : campaign scheduler (idem)
- Weekly Monday 6h UTC : keyword opportunity detector
- Weekly Monday 8h CET : quality report email Will (D-P5-3)
- Daily 3h UTC : Storage Box backups Postgres
- Monthly 1st 3h UTC : external links HEAD check (si External Links sprint livré)
- PSI weekly Monday 3h UTC : performance monitoring
- Pour chaque : actif en Coolify ? Logs OK ? Sentry capture si erreur ?

#### B-09 — Worker errors observability (/25)
- Sentry frontend + backend configurés (DSN env vars)
- `captureWorkerError` sur 100% workers
- `correlationId` propagé entre workers (acquis P2 P1-5 ? à vérifier)
- `traceId` distributé tracing
- `tokensInput` non-hardcodé à 0 (P2 P1-4)
- Logs structurés (JSON) via `pino` ou équivalent
- Pas de `console.log` debug en prod (P2 P1-3)

#### B-10 — Image-bank pipeline (/25)
- Sharp variants AVIF + WebP + LQIP + thumbnail
- EXIF/XMP/IPTC embed (acquis)
- Watermark on-the-fly (acquis)
- IndexNow ping étendu
- Sitemap-images.xml Google 1.1
- JSON-LD ImageObject
- 0 image AI-générée en DB (`SELECT COUNT(*) FROM image_assets WHERE is_ai_generated=true AND ai_model IS NULL` doit être 0 — acquis P1.5 QW-7)
- License CC BY 4.0 par défaut

---

### 🔹 BLOC FLOWS UTILISATEUR (10 agents × 25 pts = 250 pts)

#### Fl-01 — Flow visiteur lit article blog (/25)
Scénario :
1. Visiteur va sur Google, cherche "audit IA Paris 2026"
2. Click sur résultat AxionIA `/blog/audit-ia-paris-guide-2026`
3. Page charge en ≤ 1800ms LCP
4. Voit immédiatement : H1, image hero, `<AuthorByline />` Manon, AiContentDisclaimer en bas
5. JSON-LD `BlogPosting` + `aiGenerated:true` + `speakable` + `Person` + `BreadcrumbList` dans `<head>`
6. Lit l'article : ≥ 3 liens internes (vers `/audits`, `/audits/paris`, etc.)
7. Voit ≥ 2 liens externes (INSEE / DARES / etc.)
8. Voit ArticleTOC si > 1500 mots (acquis P3 follow-up)
9. Voit "Articles connexes" en bas
10. Click CTA → arrive sur formulaire contact

À tester via `curl` + parsing HTML. Score 100% présence éléments.

#### Fl-02 — Flow visiteur recherche locale (/25)
Scénario :
1. Visiteur cherche "audit IA Paris" sur Google
2. Voit dans SERP : organique `/audits/paris` + (futurement) Local Pack si GBP créé
3. Click `/audits/paris`
4. JSON-LD `LocalBusiness` graphe 8 schémas
5. Voit section "Villes proches" (acquis P3 QW-10) avec 6 villes Haversine
6. Voit articles ville-spécifiques `anchorVilleSlug='paris'`
7. CTA contact local visible

#### Fl-03 — Flow admin login + dashboard (/25)
Scénario :
1. Admin va sur `/[adminPrefix]/content-gen/`
2. Si pas auth → redirige NextAuth login
3. Login email + password (ou magic link)
4. Arrive dashboard content-gen
5. Voit 4 sections regroupées (D-P5-6) : 🎯 Pilotage / 🛠️ Sources / 📊 Suivi / ⚙️ Réglages
6. Voit CTA "Nouvelle campagne" terracotta sticky (D-P5)
7. Voit campagnes actives (3-5 cartes)
8. Voit progress bar 39/120 villes (ou cible élargie)
9. Voit anomaly badge si > 0
10. Sidebar avec compteurs

#### Fl-04 — Flow admin crée campagne depuis preset (/25)
Scénario :
1. Admin clique "Templates" / accède `/content-gen/templates`
2. Voit 6 cards presets (D-P5-1)
3. Click "Utiliser ce preset" sur "PME audits"
4. Redirigé vers `/content-gen/coverage/new?preset=pme-audits`
5. Wizard pré-rempli (verticales, types, batchSize, dailyCap)
6. Banner "Démarrage depuis preset : PME audits"
7. Modifie 1 champ (ex: batchSize 20 → 30)
8. Click submit
9. DB INSERT `CoverageCampaign` + jobs BullMQ enqueued
10. Redirigé vers `/content-gen/coverage/[id]` avec progression

#### Fl-05 — Flow admin pause/resume campagne (/25)
Scénario :
1. Admin va sur `/content-gen/coverage/`
2. Voit liste campagnes avec status
3. Pour campagne running, click bouton "Pause"
4. Server Action `pauseCampaign` exécutée
5. BullMQ jobs purgés (acquis P1.5 B.2 + P5 sprint)
6. Status DB = "paused"
7. UI rafraîchi (status updated)
8. Click "Resume" → jobs re-enqueued, status "running"

#### Fl-06 — Flow review article needs_review (/25)
Scénario :
1. Admin va sur `/content-gen/quality/`
2. Voit articles en `needs_review`
3. Click sur 1 article
4. Voit détail : score qualité, issues détectées, body
5. Voit `qualityImprovementAttempts` (acquis P5 P0-4)
6. Click thumbs up ou down
7. ArticleFeedback inséré en DB (acquis P5 P1-4)
8. Article passé en "approved" → `publishStatus = "published"`

#### Fl-07 — Flow génération article complet (worker) (/25)
Scénario backend :
1. Campagne running → orchestrator crée 1 job content-gen-worker
2. Worker prend job, `selectKeyword()` atomique
3. Worker appelle Claude Sonnet 4.6 generation
4. LLM-judge note article (D1 seuil 6.0)
5. Si score < 6.0 → quality-improver-worker (D2 3 itérations pilier+landing, 2 autres)
6. Si score ≥ 6.0 → content-publish-worker
7. Publish-worker valide ≥ 2 liens externes + AiContentDisclaimer wording
8. Article status = "published", `GenerationProvenance` enregistré
9. IndexNow ping
10. Sitemap update

#### Fl-08 — Flow 3 campagnes parallèles (/25)
Scénario :
1. Admin crée 3 campagnes running simultanément
2. Workers BullMQ traitent en parallèle (concurrency=3)
3. Cap `MAX_PUBLISH_PER_DAY=30` respecté global (acquis P2 P0-4 Redis INCR)
4. Pas de double publication même keyword (lockDuration 120s)
5. Isolation campagnes (filtrage `campaignId` dans selectKeyword)
6. Cost tracker monthly cap respecté

#### Fl-09 — Flow RSS sans plagiat (/25)
Scénario :
1. RSS-fetch-worker récupère 1 nouvel article de flux test
2. blog-from-rss-worker généré nouvel article basé sur metadata
3. **NE CITE PAS la source** (exigence Will explicite 2026-05-22)
4. SimHash similarité < 0.50 vs article source
5. Embeddings cosine similarity < 0.85 (si flag activé)
6. Article tier_2 (ou tier_1 si score ≥ 8.5)
7. IndexNow ping immédiat
8. sitemap-news.xml inclut l'URL
9. Google News pickup attendu < 24h

#### Fl-10 — Flow image-bank galerie + download (/25)
Scénario :
1. Visiteur va sur `/galerie`
2. Voit grille images (acquis sprint S+5 + corrections)
3. Filtre par catégorie / module / pays
4. Click image → page détail `/galerie/[slug]`
5. JSON-LD `ImageObject`
6. Click "Télécharger" → tracking download (RGPD IP hashée)
7. ImageDownloadLog row inséré
8. Image servie (avec watermark on-the-fly si option activée)

---

### 🔹 BLOC PRODUCTION READINESS (10 agents × 25 pts = 250 pts)

#### Pr-01 — Sécurité OWASP Top 10 2026 (/25)
- A01 Broken Access Control : auth admin partout + RLS Postgres ?
- A02 Cryptographic Failures : HTTPS forced, secrets bcrypt/argon2, IP hash SHA-256
- A03 Injection : Prisma parameterized, DOMPurify XSS, validation Zod
- A04 Insecure Design : threat modeling documenté ?
- A05 Security Misconfiguration : CSP, HSTS preload, X-Frame-Options, Referrer-Policy
- A06 Vulnerable Components : `pnpm audit` clean ?
- A07 Authentication Failures : NextAuth.js robuste, brute-force protection
- A08 Software Integrity : SRI, dependency lock, Renovate
- A09 Logging Failures : Sentry + audit trail SOC2
- A10 SSRF : pas d'URL user-controlled passées à fetch ?

#### Pr-02 — RGPD compliance complète (/25)
- Registre traitements art. 30 documenté ?
- DPA sous-processeurs : OpenAI ? (Anthropic reporté Will). Voyage AI ? Perplexity ?
- DPIA si données sensibles
- Droit à l'effacement art. 17 : endpoint admin standalone (acquis P2 P0-2)
- IP hashing systématique
- Cookies banner si cookies non-essentiels
- Politique de confidentialité à jour (`/rgpd`)
- Mentions légales à jour (`/mentions-legales`)
- CGV à jour (`/cgv`)
- Page transparence IA (`/transparence`)

#### Pr-03 — AI Act art. 50 (deadline 2026-08-02) (/25)
- AiContentDisclaimer 100% pages AI-générées
- Wording transparence max D4 partout
- JSON-LD `aiGenerated:true` + `additionalType:AIGeneratedContent` partout
- GenerationProvenance traçabilité 6 ans
- Pas de double-publication (acquis P2 lockDuration)
- Provider transparent (Claude Sonnet 4.6 mentionné dans wording)
- Tests fonctionnels conformité

#### Pr-04 — Backups + Disaster Recovery (/25)
- Daily backups Postgres automatiques
- Storage Box Hetzner externe (acquis sprint Axion CRM Pro 2026-05-17)
- Retention : 7j local / 30j distant
- Restore tested au moins 1 fois ?
- Plan DR documenté (`_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-BACKUPS.md` ?)
- RTO / RPO documentés (Recovery Time / Point Objective)
- Tests restore régulier ?

#### Pr-05 — CI/CD + Coolify (/25)
- GitHub Actions workflows actifs (`.github/workflows/*.yml`)
- Build success rate > 95% sur main
- Tests automatiques bloquants : typecheck + lint + vitest + lhci
- Pre-commit hooks ×8 (anti-siren, anti-hex, use-client, eslint, prettier, typecheck, content-gen isolation, image-bank isolation)
- Pre-push hooks ×3 (i18n, zod, vitest full)
- Deploy automatique Coolify post-merge main
- Rollback procedure documentée
- Smoke tests post-deploy

#### Pr-06 — Monitoring + Alertes (/25)
- Sentry frontend (`@sentry/nextjs`) + DSN env var
- Sentry backend (workers BullMQ)
- Telegram webhook actif pour alertes critiques
- Dashboards Grafana ? Sinon admin dashboard custom
- Uptime monitoring (UptimeRobot / BetterStack ?)
- Web Vitals RUM (PSI weekly worker acquis S+2)
- Lighthouse CI gates (lighthouserc.json)
- Cost tracker monthly observable
- Runbooks ops documentés (acquis S+5)

#### Pr-07 — Performance + cache + CDN (/25)
- Bundle ≤ 75 KB gz target acquis
- LCP ≤ 1800ms sur 90% pages (LHCI)
- Cache-Control headers cohérents (immutable assets, public articles, no-cache admin)
- CDN Cloudflare front cache HIT rate > 80%
- Image optimization Sharp pipeline complet
- `optimizePackageImports` 15+ packages (acquis P4-09)
- Edge runtime sur middleware si applicable
- Streaming SSR / Partial Prerendering Next.js 16

#### Pr-08 — Tests coverage + qualité (/25)
- Vitest unit tests count ≥ 1376/1383 (baseline P1.5)
- Après tous les sprints ajoutés : tests count attendu ≥ 1600+
- Coverage modules critiques (workers content-gen) ≥ 80%
- Tests E2E Playwright ? (si livré)
- Tests integration BullMQ workers
- Tests régression (snapshot tests si pertinent)
- Mutation testing (Stryker ?) optionnel

#### Pr-09 — Documentation runbooks + ADRs (/25)
- README projet complet
- Runbooks ops `_AUDIT/A5-RUNBOOKS-OPS-*` (acquis 2026-05-15)
- ADRs (Architecture Decision Records) : 27+ acquis (ADR 0027 image-bank V1)
- CLAUDE.md projet conventions
- AGENTS.md persona Manon
- Onboarding nouveau dev (10-30 min lecture)
- API documentation (si APIs exposées)
- Schémas archi (Mermaid diagrams ?)

#### Pr-10 — Best practices mai 2026 (/25)
- Next.js 16 App Router + RSC by default
- Server Components majority
- Server Actions pour mutations
- Suspense boundaries pour streaming
- Edge runtime middleware (`proxy.ts`)
- Partial Prerendering (PPR) Next.js 16
- React 19 features (use, useFormStatus, etc.)
- TypeScript strict mode
- Prisma 5+ generated client output configuré
- BullMQ 4+ avec Repeatable Jobs
- Tailwind v3+ avec design tokens centralisés
- AI Overviews / SGE readiness (cf. P3 verif)
- Voice search SEO (cf. P3 verif intents 2026)
- Cookieless future preparedness
- WCAG 2.2 AA minimum
- Core Web Vitals INP gate (remplace FID)
- AVIF + WebP + LQIP optimisation images
- Mobile-first absolu
- Privacy Sandbox compliance (si applicable)
- AI Act art. 50 compliance (acquis P2 vérif)

---

## 4. TESTS FONCTIONNELS RÉELS OBLIGATOIRES (15 scénarios)

Au-delà des 40 sous-agents qui lisent le code, exécuter ces 15 tests **réels** :

### Test 1 — Smoke prod 30 URLs publiques
```powershell
foreach ($url in @("/", "/audits", "/blog", "/contact", "/galerie", "/glossaire", "/cgv", "/rgpd", "/audits/paris", "/blog/test-slug", ...)) {
  curl -I -A "Mozilla/5.0" "https://axion-ia.com$url"
}
# Attendu : 30/30 status 200 (ou 301 redirect acceptable)
```

### Test 2 — Lighthouse 10 pages mobile + desktop
```powershell
npx lighthouse https://axion-ia.com/ --output=json --output-path=./lh-home-mobile.json --preset=mobile
# Pour 10 URLs. Scores attendus 90+ partout.
```

### Test 3 — JSON-LD validation 5 pages
```powershell
curl -s https://axion-ia.com/fr/blog/test-slug | grep -A 100 'application/ld+json'
# Parse JSON-LD, valider via schema.org/validator
```

### Test 4 — Multi-campagnes parallèles (BullMQ stress test)
- Créer 3 campagnes test 50 articles chacune
- Observer 30 min via BullMQ admin
- Vérifier cap respecté global + isolation + pas de double-pub

### Test 5 — Article complet bout-en-bout
- Trigger 1 article test verticale `audits` + ville `paris`
- Suivre dans logs Sentry/console : keyword select → LLM → judge → publish → indexnow
- Vérifier article apparaît dans `/blog/[slug]` ET `/audits/paris/[slug]` (acquis si V-01 audit complet OK)

### Test 6 — Worker crash recovery
- Tuer manuellement 1 worker en plein job
- Observer : job re-pris par autre worker après lockDuration ? OU stalled handling correct ?

### Test 7 — DB performance EXPLAIN ANALYZE
```sql
EXPLAIN ANALYZE SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 50;
-- Attendu : Index Scan, pas Seq Scan
```

### Test 8 — Backup restore test
- Lancer manuellement script restore depuis dernier backup Storage Box
- Vérifier intégrité DB restaurée (count rows tables critiques)

### Test 9 — Sentry alert test
- Trigger une erreur volontaire (ex: cron worker avec exception)
- Vérifier Sentry capture + Telegram alerte reçue

### Test 10 — Lighthouse CI gates
```powershell
npx lhci autorun --upload.target=temporary-public-storage
# Vérifier que les gates lighthouserc.json sont respectés sur 5 URLs
```

### Test 11 — RGPD droit à l'oubli
- Endpoint admin `DELETE /api/admin/users/[id]/erase` (ou équivalent)
- Vérifier suppression DB cascade
- Audit trail SOC2 row inséré

### Test 12 — AI Act traçabilité
- Pour 5 articles random publiés, vérifier `GenerationProvenance` accessible
- Hash chain validé
- 16 champs présents
- promptHash = vrai hash du prompt LLM (pas jobId)

### Test 13 — RSS pas de plagiat
- Forcer 1 article from-rss test
- SimHash vs source : < 0.50
- Si embeddings ON : cosine < 0.85
- Lecture article : pas de mention "Source : [site]"

### Test 14 — Cost tracker kill-switch
- Forcer simulation cap mensuel Anthropic atteint
- Vérifier alerte Telegram à 80%
- Vérifier désactivation provider à 100%
- Kill-switch global si tous providers off

### Test 15 — Image-bank pipeline E2E
- Upload 1 image test via admin
- Worker enrich : Sharp variants + EXIF + auto-traduction
- Vérifier `image_assets` row + variants AVIF/WebP/LQIP/thumbnail
- 0 image marquée `isAiGenerated=true` sauf si Will l'a explicitement uploadée comme IA

---

## 5. ZONES INTERDITES (AUDIT-ONLY strict)

- ❌ Aucun `git commit`, `git push`, modification source
- ❌ Aucune installation dépendance
- ❌ Aucune modification env vars Coolify
- ❌ Aucune création worker / cron / hook / migration
- ✅ Lecture exhaustive
- ✅ Diagnostics (curl, Lighthouse, EXPLAIN ANALYZE, BullMQ admin lecture, Sentry consult)
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/`

---

## 6. LIVRABLES OBLIGATOIRES

### Structure
```
_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/
├── VERDICT-AUDIT-FINAL-PROD-READY.md           (livrable principal, ~1000 lignes)
├── ROADMAP-P0-P1-P2-CONSOLIDE.md              ⭐ FICHIER UNIQUE P0/P1/P2 (demande Will)
├── PRODUCTION-CHECKLIST.md                     (100 items yes/no)
├── CROSS-CUTTING.md                            (analyses transverses)
├── tests-results/                              (15 tests réels)
│   ├── test-01-smoke-prod-30-urls.md
│   ├── test-02-lighthouse-10-pages.md
│   ├── test-03-jsonld-validation.md
│   ├── test-04-multi-campagnes-stress.md
│   ├── test-05-article-e2e.md
│   ├── test-06-worker-crash-recovery.md
│   ├── test-07-db-explain-analyze.md
│   ├── test-08-backup-restore.md
│   ├── test-09-sentry-alert.md
│   ├── test-10-lighthouse-ci.md
│   ├── test-11-rgpd-erasure.md
│   ├── test-12-ai-act-provenance.md
│   ├── test-13-rss-no-plagiat.md
│   ├── test-14-cost-kill-switch.md
│   └── test-15-image-bank-e2e.md
└── agents/
    ├── frontend/
    │   ├── F-01-routes-publiques.md
    │   ├── F-02-routes-admin.md
    │   ├── ... (10 rapports F-01 à F-10)
    ├── backend/
    │   ├── B-01-workers-bullmq.md
    │   ├── ... (10 rapports B-01 à B-10)
    ├── flows/
    │   ├── Fl-01-visiteur-blog.md
    │   ├── ... (10 rapports Fl-01 à Fl-10)
    └── prod-readiness/
        ├── Pr-01-owasp-top10.md
        ├── ... (10 rapports Pr-01 à Pr-10)
```

### Format `VERDICT-AUDIT-FINAL-PROD-READY.md`

```markdown
# VERDICT AUDIT FINAL PRÉ-PRODUCTION
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Auditeur : Claude Opus 4.7 (1M context) — AUDIT-ONLY

---

## RÉSUMÉ EXÉCUTIF (1 page Will)

**Score global : XXX/1000** — 🟢 GO PROD | 🟡 SPRINT FINAL | 🔴 NO-GO

**Verdict en 3 phrases pour Will** :
<paragraphe>

### Top 5 forces du système
1. ...
2. ...
3. ...
4. ...
5. ...

### Top 5 P0 bloquants prod (si présents)
1. ... (effort X h, gain Y pts, risque si non-fait : ...)
2. ...

### Décision immédiate recommandée
<1 ligne claire>

---

## SCORE DÉTAILLÉ PAR BLOC

### Frontend : XXX/250
| Agent | Score | Verdict |
|-------|-------|---------|
| F-01 Routes publiques | XX/25 | 🟢/🟡/🔴 |
| ... (F-01 à F-10) |

### Backend : XXX/250
| Agent | Score | Verdict |
|-------|-------|---------|
| B-01 Workers BullMQ | XX/25 | 🟢/🟡/🔴 |
| ... (B-01 à B-10) |

### Flows utilisateur : XXX/250
| Agent | Score | Verdict |
|-------|-------|---------|
| Fl-01 Visiteur blog | XX/25 | 🟢/🟡/🔴 |
| ... (Fl-01 à Fl-10) |

### Production readiness : XXX/250
| Agent | Score | Verdict |
|-------|-------|---------|
| Pr-01 OWASP Top 10 | XX/25 | 🟢/🟡/🔴 |
| ... (Pr-01 à Pr-10) |

**TOTAL : XXX/1000**

### Visualisation
```
Frontend         ████████████████████ XXX/250
Backend          ████████████████████ XXX/250
Flows            ████████████████████ XXX/250
Prod readiness   ████████████████████ XXX/250
```

---

## TESTS FONCTIONNELS RÉSULTATS (15 tests)
| # | Test | Résultat |
|---|------|----------|
| 1 | Smoke prod 30 URLs | ✅ 30/30 | ⚠️ 28/30 | ❌ ... |
| ... (15 tests) |

---

## RÉPONSES AUX QUESTIONS WILL ORIGINAL

### 1. Le frontend est-il 100% fonctionnel et raccordé ?
**Réponse** : OUI/PARTIEL/NON
**Preuves** : ...
**Gaps** : ...

### 2. Le backend est-il robuste et production-ready ?
...

### 3. Toutes les routes sont-elles parfaitement raccordées ?
...

### 4. Les flows utilisateur fonctionnent-ils tous bout-en-bout ?
...

### 5. Les croisements entre features ne créent-ils pas de bugs ?
...

### 6. Le système est-il prêt pour vraie utilisation production ?
...

---

## RECOMMANDATION FINALE

**Verdict : 🟢 GO PROD | 🟡 SPRINT FINAL | 🔴 NO-GO**

**Argumentaire chiffré** :
<paragraphe basé sur score + nombre P0/P1>

**Si 🟢 GO PROD** :
- 0 P0 bloquant
- < 5 P1 critiques
- Action : activer prod + rampe progressive MAX_PUBLISH 30→500 selon D-W1
- Monitoring 48h post-activation

**Si 🟡 SPRINT FINAL** :
- 1-3 P0 identifiés
- Sprint correctif final ~XXh autopilot avant prod
- Action : lancer sprint final puis re-audit

**Si 🔴 NO-GO** :
- > 3 P0 ou faille sécurité critique
- Refonte ciblée requise
- Action : Sprint(s) correctif(s) majeur(s)

**Prochain pas concret** :
1. ...
2. ...
3. ...
```

### Format `ROADMAP-P0-P1-P2-CONSOLIDE.md` (⭐ FICHIER UNIQUE demande Will)

```markdown
# Roadmap consolidée P0/P1/P2 — Audit final pré-prod
## Date : YYYY-MM-DD
## Total items : XXX (XX P0 + XX P1 + XX P2)

---

## 🔴 P0 BLOQUANTS PROD (action immédiate avant launch)

| # | Item | Bloc | Zone code | Effort | Risque si non-fait |
|---|------|------|-----------|--------|---------------------|
| P0-1 | <description> | Backend | src/server/queue/workers/X.ts | 2h | Pénalité Google HCU possible |
| P0-2 | ... |

**Total P0 : X items, effort cumulé XXh**

---

## 🟠 P1 IMPORTANTS (1-4 semaines post-launch)

| # | Item | Bloc | Effort | Impact business |
|---|------|------|--------|------------------|
| P1-1 | ... |
| P1-2 | ... |

**Total P1 : X items, effort cumulé XXh**

---

## 🟡 P2 POLISH (backlog 3-6 mois)

| # | Item | Bloc | Effort | Impact |
|---|------|------|--------|--------|
| P2-1 | ... |

**Total P2 : X items, effort cumulé XXh**

---

## ✅ ITEMS OK (vue d'ensemble — top 30 forces)

1. ✅ Frontend Web Vitals 100% pages green (LCP 1500ms moyen)
2. ✅ AI Act art. 50 conforme (acquis P2 follow-up e0b1973)
3. ...

---

## 🎯 Recommandation FINALE

### Si 🟢 GO PROD
- Liste 5 actions Will pour activation prod
- Calendrier rampe MAX_PUBLISH

### Si 🟡 SPRINT FINAL
- Sprint dédié aux X P0 → ~XXh
- Re-audit léger post-sprint avant prod

### Si 🔴 NO-GO
- Refonte sur axes < 50% (lister)
- Sprint majeur ~XXXh
```

### Format `PRODUCTION-CHECKLIST.md`

```markdown
# Production Checklist — 100 items

## Frontend (25 items)
- [ ] Lighthouse mobile ≥ 85 sur 5 pages principales
- [ ] Lighthouse desktop ≥ 90
- [ ] LCP ≤ 1800ms (90% des pages)
- [ ] CLS ≤ 0.05
- [ ] INP ≤ 80ms
- [ ] WCAG 2.2 AA validé
- [ ] Mobile responsive 320px-2560px
- [ ] Tous les `<img>` ont `alt`
- [ ] JSON-LD valide sur 100% pages (schema.org/validator)
- [ ] ... (25 items frontend)

## Backend (25 items)
- [ ] typecheck ✅ (0 erreur)
- [ ] lint ✅ (0 erreur)
- [ ] vitest ≥ 1376/1383 + tests sprints supplémentaires
- [ ] prisma migrate status ✅
- [ ] prisma validate ✅
- [ ] Sentry frontend + backend actifs
- [ ] ... (25 items backend)

## Flows (25 items)
- [ ] Visiteur peut lire un article blog complet sans bug
- [ ] Admin peut créer une campagne depuis preset
- [ ] Worker génère un article complet sans erreur
- [ ] ... (25 items flows)

## Production readiness (25 items)
- [ ] HTTPS forced (HSTS preload 2 ans)
- [ ] CSP strict configured
- [ ] Backups daily Postgres → Storage Box
- [ ] Restore tested au moins 1 fois
- [ ] Sentry capture worker errors
- [ ] Telegram alerts actives
- [ ] CI/CD GitHub Actions passe
- [ ] Coolify auto-deploy main
- [ ] AI Act art. 50 deadline 2026-08-02 conforme
- [ ] RGPD registre traitements à jour
- [ ] ... (25 items prod readiness)

## Total checklist : 100 items
## Score : XX/100 = XX% prêt prod
```

### Mémoire à créer
Slug : `axionia_audit_final_prod_ready_2026-05-22`
Type : project
Body : score `/1000` global, verdict 🟢/🟡/🔴, top 5 forces, top 5 P0, recommandation Will.

### MEMORY.md à mettre à jour
```
- [🟢/🟡/🔴 AxionIA Audit final pré-prod LIVRÉ 2026-05-22 — score XXX/1000](axionia_audit_final_prod_ready_2026-05-22.md) — 40 sous-agents (10 frontend + 10 backend + 10 flows + 10 prod readiness) + 15 tests fonctionnels réels. ROADMAP-P0-P1-P2-CONSOLIDE.md avec XX P0/XX P1/XX P2. PRODUCTION-CHECKLIST 100 items. Verdict GO PROD / SPRINT FINAL / NO-GO.
```

---

## 7. RÈGLES STRICTES

- ❌ AUCUNE mention Wikidata / DPA / CF WAF dans verdict ou roadmap (exclusions Will)
- ❌ AUCUNE re-demande des décisions déjà tranchées (D-W, D-P5, D1-D5, D7)
- ✅ Score `/1000` HONNÊTE (pas gonflé)
- ✅ Si typecheck/vitest ne sont pas verts au lancement : noter alerte critique mais continuer audit
- ✅ Tests fonctionnels réels OBLIGATOIRES (curl, Lighthouse, EXPLAIN ANALYZE, BullMQ admin)
- ✅ ROADMAP-P0-P1-P2-CONSOLIDE.md = **UN SEUL fichier** (demande Will explicite "dans un seul fichier")

---

## 8. STOP & ASK FINAL

Format strict (livré dans VERDICT-AUDIT-FINAL-PROD-READY.md §RECOMMANDATION FINALE).

```
✅ Audit final pré-prod livré.

📊 Score global : XXX/1000 — 🟢 GO PROD | 🟡 SPRINT FINAL | 🔴 NO-GO

📈 4 blocs :
- Frontend : XXX/250
- Backend : XXX/250
- Flows : XXX/250
- Prod readiness : XXX/250

✨ Top 5 forces :
1. ...
2. ...
3. ...
4. ...
5. ...

⚠️ Top 5 P0 bloquants :
1. ... (effort X h)
2. ...
3. ...
4. ...
5. ...

🧪 Tests fonctionnels : XX/15 OK

📋 ROADMAP-P0-P1-P2-CONSOLIDE.md prêt avec X P0 + Y P1 + Z P2.

🚀 Choix Will :
[A] 🟢 Activation prod immédiate (si 0 P0) + rampe MAX_PUBLISH 30→50→100→...
[B] 🟡 Sprint final correctif ~XXh autopilot puis re-audit léger
[C] 🔴 Sprint(s) correctif(s) majeur(s) puis nouveau audit complet
[D] Continuer en mode CONDITIONNEL (CA suffisant pour exploiter avec gaps documentés)
```

---

## 9. MODÈLE RECOMMANDÉ

**Opus 4.7 fortement recommandé** pour ce mega-audit :
- Synthèse multi-document complexe (60+ fichiers)
- Verdict critique GO PROD / NO-GO
- Orchestration 40 sous-agents parallèles
- Cohérence inter-blocs (Frontend ↔ Backend ↔ Flows ↔ Prod readiness)
- Honnêteté maximale (pas d'auto-complaisance)

Coût estimé Opus 4.7 pour 15-20h autopilot : **~$50-80** (assurance vs risque mauvaise décision business prod).

Sonnet 4.6 acceptable mais score potentiellement moins honnête (verdict superficiel possible).

---

## 10. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le mega-audit final pré-production décrit dans `_AUDIT/PROMPT-AUDIT-FINAL-PROD-READY-2026-05-22.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA Anthropic, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les 19 mémoires Bloc A + 9 verdicts Bloc B + 47 fichiers code/config Bloc C. Spawn 40 sous-agents parallèles répartis 4 blocs : Frontend F-01 à F-10 (routes publiques, admin V2, mobile responsive, WCAG 2.2 AA, Web Vitals 2026 INP+LCP+CLS, SEO meta+JSON-LD, maillage interne+suggested, sitemaps+robots, UX brand cohérent, cookieless future) + Backend B-01 à B-10 (workers BullMQ santé, APIs sécurisées, DB Postgres optimisé, Redis queues, external APIs intégration, cost tracker+alertes, provenance AI Act, cron documentés, observability Sentry+correlationId, image-bank pipeline) + Flows utilisateur Fl-01 à Fl-10 (visiteur blog, recherche locale, admin login dashboard, création campagne preset, pause/resume, review article, génération worker, multi-campagnes parallèles, RSS sans plagiat, image-bank galerie) + Production readiness Pr-01 à Pr-10 (OWASP Top 10 2026, RGPD complet, AI Act art. 50, backups+DR, CI/CD Coolify, monitoring Sentry+Telegram, performance+cache+CDN, tests coverage, doc runbooks+ADRs, best practices mai 2026 RSC+Edge+AVIF+WCAG2.2). Exécuter TOUS les 15 tests fonctionnels réels obligatoires (smoke 30 URLs, Lighthouse 10 pages, JSON-LD validation, multi-campagnes stress, article E2E, worker crash, EXPLAIN ANALYZE, backup restore, Sentry alert, LHCI gates, RGPD erasure, AI Act provenance, RSS sans source, cost kill-switch, image-bank E2E). Gates baseline (typecheck/vitest verts). Self-troubleshoot toutes erreurs. Score `/1000` HONNÊTE pas gonflé. **Produire UN SEUL fichier ROADMAP-P0-P1-P2-CONSOLIDE.md** (demande Will explicite) avec tous les P0/P1/P2 dans 1 seul fichier consolidé. Produire aussi VERDICT-AUDIT-FINAL-PROD-READY.md + PRODUCTION-CHECKLIST.md 100 items + 40 rapports agents + 15 tests-results dans `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/`. Mémoire axionia_audit_final_prod_ready_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢 GO PROD / 🟡 SPRINT FINAL / 🔴 NO-GO + 4 options [A/B/C/D]. Go.
```

---

## 11. QUAND LANCER CE PROMPT

⏳ **DERNIER audit** : à lancer **APRÈS** que tous les autres sprints/audits soient livrés :
- ✅ Sprint External Links Database livré
- ✅ Sprint Perfection 2026 Finalisation livré
- ✅ Sprint Keywords Perfection livré
- ✅ Sprint Campaign Controls livré
- ✅ P6 verdict global /5000 livré
- ✅ Méta-audit P6 livré
- ✅ Audit complet end-to-end 16 axes livré (si lancé)

Sinon il auditera un système incomplet → résultats biaisés.

C'est **L'AUDIT FINAL** qui dit "OK on peut lancer en production réelle" ou "il reste exactement ça à faire".

---

## 12. POURQUOI CE PROMPT EST PARFAIT ET SANS OUBLI

- ✅ Couvre **Frontend** complet (routes publiques + admin + responsive + a11y + Web Vitals + SEO + maillage + cookieless)
- ✅ Couvre **Backend** complet (workers + APIs + DB + Redis + external APIs + cost + provenance + cron + observability + image-bank)
- ✅ Couvre **Flows utilisateur** réels bout-en-bout (10 scénarios + 15 tests fonctionnels)
- ✅ Couvre **Production readiness** (sécurité OWASP + RGPD + AI Act + backups + CI/CD + monitoring + performance + tests + doc + best practices 2026)
- ✅ **Best practices mai 2026** explicitement énoncés (RSC, Edge runtime, INP gate, WCAG 2.2, AVIF, AI Overviews, voice search SEO, cookieless future)
- ✅ Sortie **UN SEUL fichier ROADMAP-P0-P1-P2-CONSOLIDE.md** (demande Will explicite)
- ✅ Tests fonctionnels **réels** (pas juste lecture code)
- ✅ Décisions Will figées intégrées (pas de re-demande)
- ✅ Exclusions Will respectées (Wikidata/DPA/CF WAF/toggle)
- ✅ Self-contained (60+ fichiers listés)
- ✅ AUDIT-ONLY strict (zéro risque casser prod)
- ✅ Modèle Opus 4.7 recommandé explicitement
- ✅ Score `/1000` honnête (pas gonflé pour faire plaisir)
- ✅ Verdict tranché GO PROD / SPRINT FINAL / NO-GO avec recommandation chiffrée

---

*Mega-audit final pré-production — 15-20h Opus 4.7 autopilot — AUDIT-ONLY — Vérification exhaustive bout-en-bout AxionIA mai 2026*
