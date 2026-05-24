# MEGA-PROMPT AUDIT COMPLET CONTENT-GEN END-TO-END
## AxionIA Content-Gen Perfection 2026 — Vérification 13 axes critiques

**Date création** : 2026-05-22
**Type** : Audit profond AUDIT-ONLY (zéro modif code, zéro commit)
**Effort estimé** : 8-12h autopilot (13 sous-agents parallèles + synthèse)
**Self-contained** : ce prompt suffit, aucune autre lecture obligatoire en dehors des fichiers listés §2

**Demandé par Will explicitement le 2026-05-22** : "il faudrait un prompt extrêmement complet pour faire ça dans une nouvelle conversation"

---

## 0. CONTEXTE PROJET AXION-IA (lecture intégrale obligatoire)

### Qui est AxionIA
- **Société française** (pas Axion-IA OÜ — D7 tranché Will 2026-05-21)
- Activité : audit + conseil + formation + accompagnement individuel + sites web augmentés IA
- Site : `https://axion-ia.com` (français), locale EN désactivée
- Fondateur : Will Jullin (`williamsjullin@gmail.com`)
- Persona contenus : "Manon, experte IA chez Axion-IA" (personnage fictif assumé)

### 5 verticales métier
| Slug Prisma | Activité |
|-------------|----------|
| `interventions_formations` | Formations IA + interventions |
| `audits` | Audits IA entreprise |
| `un_a_un` | Coaching/accompagnement individuel dirigeants (1-to-1) |
| `implementations` | Projets d'intégration IA |
| `sites_web_augmentes` | Sites web augmentés par IA (verticale créée 2026-05-21) |

### Stack technique
- **Frontend** : Next.js 16 App Router
- **DB** : Postgres 16 + Prisma 5.22
- **Queue** : BullMQ (Redis)
- **LLM** : Anthropic Claude Sonnet 4.6 (génération) + Opus 4.7 (reviewer LLM-judge)
- **Embeddings** : OpenAI text-embedding-3-large (3072 dim, pgvector IVFFlat)
- **Hosting** : Hetzner CPX42 + Coolify (orchestration)
- **CDN** : Cloudflare
- **Search** : Postgres FTS + pg_trgm

### Pipeline content-gen perfection 2026 (état au 2026-05-22)
Le pipeline est composé de 6 phases d'audit (P1, P1.5, P2, P3, P4, P5) + sprints correctifs + vérifs + P6 verdict global final.

**État actuel HEAD origin/main `e0b1973` (2026-05-21 20:57)** :

| Phase | Audit | Sprint | Vérif | Score |
|---|---|---|---|---|
| P1 audit forensique | ✅ | N/A | N/A | 531.5/1000 |
| P1.5 sprint compliance | N/A | ✅ | ✅ 192/200 | ~795/1000 |
| P2 architecture pipeline | ✅ | ✅ + correctif AI Act | ✅ AI Act CONFORME | ~810/1000 |
| P3 SEO/AEO/GEO | ✅ | ✅ + follow-up | ✅ | 761/1000 |
| P4 qualité éditoriale | ✅ | ✅ 3 phases | ✅ + corrections | 712/1000 |
| P5 console admin | ✅ | ✅ 4 phases A/B/C/D | ⏳ pas faite | 593/1000 |
| P6 verdict global | ❌ jamais créé | — | — | — |

**Total cumul estimé** : ~3671/5000 — 🟡 SPRINT CORRECTIF (gap 829 pts vers GO ≥ 4500).

### Décisions Will canoniques FIGÉES (ne pas re-demander)

**D-W1 à D-W5** (P1.5) :
- D-W1 : `MAX_PUBLISH_PER_DAY=30` initial, rampe progressive 30→500
- D-W3 : `factoryAutoPublishAllBlogTypes` ACTIVÉ
- D-W4 : Embedding provider = OpenAI text-embedding-3-large (3072 dim, IVFFlat)

**D-P5-1 à D-P5-6** (P5 console admin) :
- D-P5-1 : 6 presets CampaignTemplate validés
- D-P5-2 : Seuil qualité 60/100
- D-P5-3 : Reporting email hebdo lundi 8h CET
- D-P5-4 : Tableau croisé (pas heatmap)
- D-P5-5 : MAX_PUBLISH rampe manuelle UI
- D-P5-6 : Ordre Phase A puis B

**D1-D5** (P4 qualité éditoriale) :
- D1 : Seuil REJECT = 6.0/10 (= 60/100)
- D2 : 3 itérations pour `blog_pillar`+`landing_ville`, 2 pour autres types
- D3 : Persona "Manon, experte IA chez Axion-IA"
- D4 : Wording AI Act = "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."
- D5 : Reporting email lundi 8h (=D-P5-3)

**D7** (statut juridique) : Société française pure (PAS Axion-IA OÜ)

### EXCLUSIONS WILL ABSOLUES (NE PAS mentionner / proposer / alerter)
- ❌ **Wikidata Q-ID** : Will renonce. Aucune mention dans verdict.
- ❌ **DPA Anthropic signature** : reporté Will "un autre jour". Pas relancer.
- ❌ **CF WAF Block AI Bots** : déjà désactivé par Will dans Cloudflare. Acquis.
- ❌ **Toggle auto/manuel publication** : Will renoncé 2026-05-22.

---

## 1. MISSION DU MEGA-PROMPT

Will demande la vérification approfondie de **16 axes critiques** pour s'assurer que le système content-gen est à la perfection 2026 :

1. **Publication multi-targets** : articles générés vont-ils dans `/blog` ET dans les hubs villes correspondants si la ville est ciblée ?
2. **Templates pages hubs + blogs** : parfaits avec catégories, UX premium ?
3. **Fil d'Ariane (breadcrumbs)** : centralisé, automatique partout ?
4. **Web Core Vitals** : LCP/INP/CLS à la perfection sur 100% des pages ?
5. **Système de queue** : robuste pour publication multi-campagnes parallèles ?
6. **Pipeline RSS** : pas de plagiat, contenu unique adapté, indexation rapide ?
7. **SEO/AEO/GEO/Speakable/Breadcrumbs/MetaDescription/MetaTitle** : automatisé, robuste, centralisé, parfait ?
8. **Intention de recherche 2026** : informational + transactional + voice + AI Overview + featured snippet implémentés ?
9. **Anti-doublon + anti-redondance** : sémantique + exact + outline + embeddings, 4 couches actives ?
10. **Slugs** : best-practice 2026 (court, hyphenated, sans stopwords, unique, stable, lowercase, sans accents) ?
11. **Sitemaps** : automatiques, complets (sitemap-index + sub-sitemaps blog/villes/glossaire/etc), pingés ?
12. **Mots-clés** : perfection (5 verticales équilibrées, clusters thématiques, diversité intent, géolocalisation) ?
13. **Qualité éditoriale** : LLM-judge calibration (seuil REJECT 6.0/60), 3-2 itérations selon contentType, persona Manon cohérent partout, boucle improve avec issues feedback, brand voice SSOT, AiContentDisclaimer wording transparence max ?
14. **Liens internes + Suggested content** : maillage interne automatique, suggestions bas de page (articles connexes), catalogue URL → injection contextuelle, ancres descriptives ?
15. **KB sectorielle + Image hero + Fact-checking** : 5 verticales avec KB (audits pilote livré, 4 autres à venir), image hero assignée automatiquement depuis image-bank (zéro DALL-E), quarantaine fact-check si score < 50 ?
16. **Cross-cutting** : cohérence orchestrateur entre les 15 axes ci-dessus + score global ?

Mode : **AUDIT-ONLY strict**. Zéro modification code. Le rôle est de produire un verdict exhaustif scoré + roadmap correctif.

---

## 2. FICHIERS À LIRE EN PREMIER (préchargement contexte)

### Bloc A — Mémoires Claude persistantes (lire EN PREMIER)
1. `~/.claude/projects/C--Users-willi/memory/axionia_decisions_will_final_2026-05-21.md` (D7 + exclusions)
2. `~/.claude/projects/C--Users-willi/memory/axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5)
3. `~/.claude/projects/C--Users-willi/memory/axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)
4. `~/.claude/projects/C--Users-willi/memory/axionia_content_gen_p1_5_livre_2026-05-21.md` (baseline P1.5 vérifié 192/200)
5. `~/.claude/projects/C--Users-willi/memory/axionia_verif_sprint_p2_corrections_2026-05-21.md` (AI Act compliance)
6. `~/.claude/projects/C--Users-willi/memory/axionia_verif_sprint_p3_corrections_2026-05-21.md` (P3 vérif 761/1000)
7. `~/.claude/projects/C--Users-willi/memory/axionia_verif_sprint_p4_corrections_2026-05-21.md` (P4 vérif 712/1000)
8. `~/.claude/projects/C--Users-willi/memory/axionia_sprint_p3_corrections_livre_2026-05-21.md` (P3 745/1000)
9. `~/.claude/projects/C--Users-willi/memory/axionia_sprint_p4_corrections_livre_2026-05-21.md` (P4 740/1000)
10. `~/.claude/projects/C--Users-willi/memory/axionia_sprint_p5_corrections_livre_2026-05-21.md` (P5 593/1000)
11. `~/.claude/projects/C--Users-willi/memory/axionia_keywords_747seeds_2026-05-20.md` (état keywords)
12. `~/.claude/projects/C--Users-willi/memory/feedback_no_dalle_images.md` (règle absolue 0 image IA générée)
13. `~/.claude/projects/C--Users-willi/memory/feedback_no_repeat_action_lists.md` (ne pas répéter listes)

### Bloc B — Verdicts d'audit pipeline
14. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/PHASE-1-VERDICT.md`
15. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/RAPPORT-VERIFICATION-FINALE.md`
16. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/PHASE-2-VERDICT.md`
17. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/PHASE-3-VERDICT.md`
18. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/PHASE-4-VERDICT.md`
19. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/PHASE-5-VERDICT.md`
20. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/CROSS-CUTTING.md`
21. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/CROSS-CUTTING.md`

### Bloc C — Code source clés à auditer
22. `prisma/schema.prisma` (modèles Article, ContentGenJob, Keyword, CoverageCampaign, City si livré, GenerationProvenance)
23. `src/server/queue/workers/content-gen-worker.ts` (orchestrateur génération)
24. `src/server/queue/workers/content-publish-worker.ts` (publication)
25. `src/server/queue/workers/content-quality-improver-worker.ts` (boucle improve)
26. `src/server/content-gen/generators/` (7 generators : blog-pillar, landing-ville, blog-article, blog-from-keywords, blog-from-title, blog-from-rss, qa-derived, comparison)
27. `src/server/content-gen/reviewer/llm-judge.ts` (LLM-as-judge)
28. `src/server/content-gen/dedup/` (outline-simhash + openai-embedder + dedup-guard)
29. `src/server/content-gen/keyword-selector.ts`
30. `src/server/content-gen/images/assign-hero-image.ts`
31. `src/lib/seo.ts` (JSON-LD builders)
32. `src/lib/brand.ts` (legalName, alternateName)
33. `src/lib/slug.ts` (slug generation)
34. `src/components/seo/AiContentDisclaimer.tsx`
35. `src/components/seo/Breadcrumbs.tsx` (ou équivalent)
36. `src/components/seo/AuthorByline.tsx`
37. `src/components/seo/ArticleTOC.tsx`
38. `src/app/[locale]/blog/[slug]/page.tsx` (rendering blog post)
39. `src/app/[locale]/implantations/[ville]/page.tsx` (hub ville)
40. `src/app/sitemap.ts` + `src/app/sitemap-*.xml/route.ts` (sub-sitemaps)
41. `src/app/[locale]/(public)/[vertical]/[ville]/page.tsx` (pages villes verticales)

### Bloc D — Config
42. `.env.example` (env vars documentées)
43. `lighthouserc.json` (gates Web Vitals CI)
44. `package.json` (deps, scripts)
45. `next.config.ts` (config Next.js)

---

## 3. SPAWN 13 SOUS-AGENTS PARALLÈLES

Chaque sous-agent produit un rapport `agents/V-XX-<nom>.md` dans `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/`. Score `/100` honnête, P0/P1/P2 priorisés.

### V-01 — Publication multi-targets (/100)

**Question Will** : "Lors de la publication des contenus générés, sont-ils bien dans blog et aussi dans LES HUBS DE CHAQUE VILLE CORRESPONDANTES si c'est sur une ville ou si ça parle d'une ville ?"

**Vérifications obligatoires** :
- Lire `content-publish-worker.ts` : un article avec `anchorVilleSlug` set produit-il :
  - Une URL `/blog/[slug]` ?
  - Une URL `/implantations/<ville>/[slug]` ou équivalent dans le hub de la ville ?
  - Ou seulement `/blog/[slug]` avec mention de la ville dans le contenu ?
- Lire `src/app/[locale]/implantations/[ville]/page.tsx` : la page hub de chaque ville liste-t-elle les articles `anchorVilleSlug=<ville>` ?
- Vérifier les autres hubs verticales : `/audits/[ville]`, `/interventions/[ville]`, `/un-a-un/[ville]`, `/implantations/[ville]`, `/sites-web-augmentes/[ville]` — chaque hub remonte-t-il les articles de sa verticale × sa ville ?
- Test fonctionnel : `curl https://axion-ia.com/fr/implantations/paris/` → est-ce que les articles concernant Paris sont listés ?
- Si système hub ne liste PAS automatiquement les articles ville-spécifiques → red flag P0

**Score** : 100 max

### V-02 — Templates hubs + blogs (/100)

**Question Will** : "Est-ce que les templates des pages hubs et blogs sont parfait avec catégories pour que tout soit à la perfection et parfait pour l'expérience utilisateurs ?"

**Vérifications obligatoires** :
- Lire les templates :
  - `src/app/[locale]/blog/[slug]/page.tsx` (article blog)
  - `src/app/[locale]/blog/page.tsx` (hub blog général)
  - `src/app/[locale]/implantations/[ville]/page.tsx` (hub ville)
  - `src/app/[locale]/audits/[ville]/page.tsx` (hub vertical × ville)
  - `src/app/[locale]/audits/page.tsx` (hub vertical national)
- Évaluer UX :
  - Présence catégories (cluster thématique, secteur, intent)
  - Filtres lisibles (par cible tpe/pme/eti, par type contenu, par date)
  - Pagination claire
  - Cards article avec image hero + titre + extrait + CTA
  - Sidebar avec contenus suggérés
  - Mobile responsive
- Évaluer hiérarchie :
  - H1 unique par page
  - H2 sémantiques
  - Internal linking entre articles connexes
- Best-practice 2026 :
  - Search bar avec autocomplete (suggestions keywords)
  - "Articles connexes" en bas de chaque article
  - Tags cliquables
  - Date de publication + date de mise à jour
- Score : 100 max

### V-03 — Fil d'Ariane (breadcrumbs) (/100)

**Question Will** : "Est-ce que toutes les pages ont bien le fil d'Ariane automatiquement (il me semble qu'on a un système centralisé pour ça non ?)"

**Vérifications obligatoires** :
- Identifier le système centralisé breadcrumbs :
  - Composant ? `src/components/seo/Breadcrumbs.tsx` ou équivalent
  - Helper ? `src/lib/breadcrumbs.ts`
  - JSON-LD ? `BreadcrumbList` Schema.org
- Tester sur échantillon 10 routes :
  - `/` (home)
  - `/blog`
  - `/blog/[slug]`
  - `/audits`
  - `/audits/paris`
  - `/audits/paris/[slug]`
  - `/implantations/paris`
  - `/guides/[slug]`
  - `/glossaire/[term]`
  - `/case-studies/[slug]`
- Pour chaque : vérifier
  - Breadcrumb visible UX (chemin hiérarchique cliquable)
  - JSON-LD `BreadcrumbList` présent dans `<head>`
  - Chemin sémantique correct (pas de "page#article-123" mais "Accueil > Audits > Paris > Article")
- Centralisation :
  - 1 seul helper qui construit le breadcrumb depuis la route ?
  - Pas de breadcrumb hardcodé page par page ?
- Score : 100 max

### V-04 — Web Core Vitals (/100)

**Question Will** : "Est-ce que web core vitals est à la perfection pour toutes les pages et tous les nouveaux contenus qui seront créés ?"

**Vérifications obligatoires** :
- Lire `lighthouserc.json` :
  - LCP gate : ≤ 1800ms ?
  - CLS gate : ≤ 0.05 ?
  - INP gate : ≤ 80ms ?
  - JS bundle : ≤ 75 KB gz ?
- Vérifier images :
  - `<Image>` Next.js partout (pas de `<img>` brut)
  - `width`/`height` toujours explicites (anti-CLS)
  - `priority` sur LCP image (hero ville/article)
  - `loading="lazy"` sur autres images
  - AVIF + WebP variants servis
- Vérifier polices :
  - `next/font` ou `font-display: swap`
  - Subset latin uniquement
- Vérifier scripts :
  - `<Script>` Next.js avec stratégie appropriée (afterInteractive/lazyOnload)
  - Pas de scripts bloquants render-blocking
- Lighthouse audit sur 5 pages échantillon :
  - `/` (home)
  - `/blog/[slug-test]`
  - `/audits/paris`
  - `/glossaire/intelligence-artificielle`
  - `/contact`
- Pour chaque : scores attendus
  - Performance ≥ 90
  - SEO ≥ 95
  - Accessibility ≥ 90
  - Best Practices ≥ 90
- Articles générés par worker → respectent-ils les budgets perf (max 75 KB gz, etc.) ?
- Score : 100 max

### V-05 — Système de queue publication (/100)

**Question Will** : "Pour la publication, vu qu'il y aura plusieurs campagnes, et de nombreux articles générés, y a t'il bien un système de queue ?"

**Vérifications obligatoires** :
- Lire `src/server/queue/` :
  - Queues identifiées : content-gen, content-publish, content-quality-improver, indexnow, content-monitoring, etc.
  - `concurrency` configurée par worker
  - `lockDuration: 120000` (acquis P2 sprint correctif)
  - Retry policy : 3 retries, backoff exponentiel
  - Dead-letter queue si échec définitif
- Multi-campagnes :
  - Plusieurs campagnes `status='running'` peuvent-elles tourner en parallèle ?
  - Filtrage `campaignId` dans worker (isolation) ?
  - Pas de race condition (cf. P2 P0-4 corrigé)
- Throttling :
  - `MAX_PUBLISH_PER_DAY` cap respecté atomiquement (Redis INCR acquis P2)
  - Drip publishing 8h-22h CET (acquis P1.5)
- Pause/resume :
  - `pauseCampaign()` purge BullMQ jobs (acquis P1.5 P0-10)
  - `resumeCampaign()` ré-enqueue ?
- Monitoring :
  - BullMQ dashboard accessible admin ?
  - Métriques observables (queue depth, processing time, error rate)
- Test fonctionnel : créer 3 campagnes parallèles 100 articles chacune → vérifier
  - Pas de double publication (P0-2 P2 lockDuration)
  - Cap journalier respecté global
  - Isolation campagnes
- Score : 100 max

### V-06 — Pipeline RSS sans plagiat (/100)

**Question Will** : "Les articles news qui sont générés à partir de flux RSS : POUR CES contenus, il ne faut pas dire la source mais il faut que ça prenne l'article source, que ça génère un nouvel article surtout sans plagiat et adapté à nous non ? Pour que l'article soit rapidement indexé par les moteurs de recherche."

**Vérifications obligatoires** :
- Lire `src/server/content-gen/generators/blog-from-rss.ts` (commit `71f658f` BUG-5)
- Question clé : **CITE-T-IL LA SOURCE OU NON ?**
  - Si oui : ⚠️ Will dit de NE PAS dire la source
  - Si non : ✅ correct selon Will
- Anti-plagiat :
  - Le generator extrait-il juste métadonnées (title, summary, link) puis génère un NOUVEAU contenu ?
  - Ou copie-t-il le body original ?
  - Présence d'un check de similarité (SimHash + embeddings) vs source RSS ?
  - Seuil refus si similarité > 0.85 ?
- Adapté à AxionIA :
  - Angle Manon (cf. D3 persona) ?
  - Brand voice respecté (cf. brand-voice.ts SSOT) ?
  - Ton expert mais accessible ?
  - Lien interne vers contenus AxionIA ?
- Indexation rapide :
  - IndexNow ping immédiat post-publish ?
  - Sub-sitemap `sitemap-news` avec `<news:news>` Google News (acquis S+4) ?
  - `Article` JSON-LD avec `datePublished` récent ?
  - Priorité Tier 1 (indexable) ?
- Test fonctionnel : générer 1 article from-rss sur un flux test → vérifier
  - Pas de mention source dans le contenu
  - Similarité < 0.50 vs article source (SimHash)
  - Indexation pingée IndexNow
  - Sitemap-news contient l'URL
- Score : 100 max

**ALERTE WILL** : si le generator cite la source → P0 critique car Will l'a explicitement interdit. Documenter dans verdict.

### V-07 — SEO/AEO/GEO centralisation (/100)

**Question Will** : "Est-ce que le système de seo, aeo, geo, speakable, breadcrumbs, metadescription, metatitle etc etc etc et tout ce qui concerne la visibilité maximale est automatisé, robuste, centralisé et à la perfection ?"

**Vérifications obligatoires** :
- Centralisation :
  - `src/lib/seo.ts` SSOT pour JSON-LD ?
  - 1 seul helper `buildArticleJsonLd()` utilisé partout ?
  - Pas de JSON-LD hardcodé page par page ?
- Schémas JSON-LD attendus :
  - `Organization` (legalName société FR D7)
  - `WebSite` + `SearchAction`
  - `BreadcrumbList`
  - `BlogPosting` + `aiGenerated:true` + `additionalType:AIGeneratedContent`
  - `SpeakableSpecification` (acquis P3 QW-1)
  - `Person` (Manon — D3 persona)
  - `FAQPage` sur /faq
  - `QAPage` sur articles Q/R
  - `HowTo` sur tutoriels
  - `Article` `isBasedOn[]` si citations Perplexity
  - `LocalBusiness` graphe 8 schémas sur pages villes
  - `AggregateRating` SI reviews réelles (pas inventées)
  - `ItemList` pour TOC ArticleTOC
  - `DefinedTerm` glossaire
- Centralisation metaTitle / metaDescription :
  - Auto-générés par le worker (acquis P1.5)
  - Validation longueur (< 60 chars title, < 155 chars description)
  - Keyword principal dans metaTitle (acquis P1-3)
- Robustesse :
  - `aiGenerated:true` 100% des articles AI ?
  - `AiContentDisclaimer` wording transparence max sur 100% pages AI ? (D4)
  - 39 pages `/implantations/[ville]` ont AiContentDisclaimer ? (acquis P4 P0-5)
- Score : 100 max

### V-08 — Intention de recherche 2026 (/100)

**Question Will** : "EST CE QUE TOUT FONCTIONNE EN INTENTION DE RECHERCHE (ou plutôt pour ce qui est le mieux pour la visibilité en 2026 ?)"

**Vérifications obligatoires** :
- Lire enum Prisma `SearchIntent` :
  - Valeurs actuelles : informational / navigational / transactional / commercial_investigation (4 standard)
  - Best practice 2026 ajoute : voice_search / ai_overview / featured_snippet (3 nouveaux)
- Si seulement 4 intents → P1 gap (à étendre via Sprint Perfection 2026 Phase D ou Sprint Keywords Perfection Phase 4)
- Si 7 intents → ✅ best practice 2026
- Vérifier mapping keywords ↔ intents :
  - `keyword.search_intent` rempli pour 100% des 747 seeds ?
  - Heuristiques d'assignment (commence par "comment" → voice_search, etc.) ?
- SYSTEM_PROMPTs adaptés par intent :
  - `voice_search` : phrases courtes max 15 mots, réponse directe paragraphe 1
  - `ai_overview` : définition précise sourcée paragraphe 1 (40-50 mots)
  - `featured_snippet` : paragraphe 40-60 mots data-aeo="tldr"
- Validation post-LLM cohérence intent ↔ contenu ?
- Score : 100 max

### V-09 — Anti-doublon 4 couches (/100)

**Question Will** : "Est-ce que tout est bien anti-duplicate content, anti-doublons et anti-redondance pour ne pas diluer le seo ?"

**Vérifications obligatoires** :
- Couches dedup acquises :
  - Couche 1 : exact match (hash idempotencyKey + slug) ✅
  - Couche 2 : pg_trgm similarity titre/slug ✅
  - Couche 3 : outline SimHash (h2/h3 hashing 64-bit Charikar, acquis P1.5 commit `2c9948a0`) ✅
  - Couche 4 : OpenAI embeddings 3072 dim + pgvector cosine ⚠️ flag `OPENAI_EMBEDDINGS_ENABLED` par défaut OFF
- État du flag :
  - Lire `.env.example` : valeur `OPENAI_EMBEDDINGS_ENABLED` ?
  - Coolify env var prod : vérifier statut (action Will)
  - Si OFF → couche 4 dormante, anti-doublon sémantique partiellement actif
- Backfill embeddings :
  - Articles publiés pré-P1.5 ont-ils des embeddings ?
  - Script backfill créé (P1-10 reporté S+6) ? Status ?
- Seuils :
  - Hamming SimHash : ≤4 BLOCK, 5-8 WARN, >8 OK ?
  - Cosine embeddings : > 0.85 BLOCK ?
- Tests fonctionnels :
  - Générer 1 article identique à un déjà publié → DOIT échouer couche 1
  - Générer 1 article avec outline similaire → DOIT déclencher couche 3
  - Si flag ON : générer 1 article sémantiquement proche → DOIT déclencher couche 4
- Score : 100 max

### V-10 — Slugs perfection 2026 (/100)

**Question Will** : "SLUGS À LA PERFECTION SELON LES MEILLEURES PRATIQUES EN 2026 ?"

**Vérifications obligatoires** :
- Lire `src/lib/slug.ts` (helper SSOT)
- Best practices 2026 :
  - **Court** : 3-7 mots max (50-70 chars)
  - **Hyphenated** : `-` entre mots, pas `_`
  - **Lowercase** : tout en minuscules
  - **Sans accents** : `é` → `e`, `à` → `a`, etc.
  - **Sans stopwords** : sans "le", "la", "de", "à", "the", etc. (pondéré : OK si meaningful)
  - **Unique** : contrainte DB
  - **Stable** : ne PAS changer après publication (sinon 301 redirect obligatoire)
  - **Sémantique** : reflète le contenu (pas hash random)
  - **ASCII safe** : pas de caractères spéciaux
- Tests :
  - Article "Comment auditer une IA d'entreprise à Paris en 2026" → slug attendu ~`auditer-ia-entreprise-paris-2026`
  - Validation : pas de doublon, pas trop long, pas trop court
- Si slug fonction non-stable (re-génère sur update) → P0 (casse les URLs)
- Score : 100 max

### V-11 — Sitemaps automatiques (/100)

**Question Will** : "Les sitemaps sont-ils parfaits, automatiques ?"

**Vérifications obligatoires** :
- Lire `src/app/sitemap.ts` et `src/app/sitemap-*` (route handlers ou static)
- Sub-sitemaps attendus :
  - `sitemap-index.xml` (master)
  - `sitemap-pages.xml` (pages statiques)
  - `sitemap-blog.xml` (articles blog)
  - `sitemap-news.xml` (articles récents 48h, news:news Google News)
  - `sitemap-villes-*.xml` (par verticale × villes)
  - `sitemap-guides.xml`
  - `sitemap-glossaire.xml`
  - `sitemap-presse.xml`
  - `sitemap-cas-concrets.xml`
  - `sitemap-stack-ia.xml`
  - `sitemap-images-*.xml` (Google Image 1.1)
- Pour chaque sub-sitemap :
  - Auto-généré depuis DB (pas hardcoded)
  - `<lastmod>` différencié par URL
  - `<changefreq>` cohérent
  - `<priority>` cohérent
  - `<xhtml:link rel="alternate" hreflang="fr">` (acquis)
- Indexation :
  - GSC + Bing WMT soumissions (acquises 2026-05-13)
  - IndexNow ping post-publish
- Test fonctionnel :
  - `curl https://axion-ia.com/sitemap.xml` → 200 + XML valide
  - Compter URLs : doit correspondre à count DB articles publiés + pages statiques
- Score : 100 max

### V-12 — Mots-clés perfection (/100)

**Question Will** : "LES MOTS CLÉS SONT ILS À LA PERFECTION ?"

**Vérifications obligatoires** :
- Compter keywords par verticale : `SELECT vertical, COUNT(*) FROM keywords GROUP BY vertical;`
- Équilibrage : toutes verticales ≥ 150 ? Cible ideale ≥ 250
- Diversité intents : 7 intents distribués selon best-practice 2026 ?
- Clusters thématiques : présence de `clusterId` rempli pour la plupart des keywords ?
- Géolocalisation : `cityIds[]` rempli pour keywords géo (≥ 30% du total) ?
- Qualité linguistique :
  - Pas de keyword < 2 mots
  - Pas de doublon sémantique (embeddings > 0.85)
  - Pas de mots interdits brand voice ("révolutionner", "disruptif", "game-changer")
- Couverture concurrentielle :
  - Keywords où concurrents directs ranquent (axionai.fr, KPMG IA, Capgemini, etc.) couverts ?
- Sprint Keywords Perfection (créé `PROMPT-SPRINT-KEYWORDS-PERFECTION-2026-05-22.md`) lancé ?
- Score : 100 max

### V-13 — Qualité éditoriale (/100)

**Question Will** : "Pour chaque type (formation/audit/1-to-1/implémentation/sites_web_augmentés), nous surpassons tous les concurrents et que nous sommes numéro un en France et dans chaque ville. Il faut la perfection."

**Vérifications obligatoires** :
- **LLM-as-judge calibration** :
  - `src/server/content-gen/reviewer/llm-judge.ts` : seuil REJECT = 6.0/10 (= 60/100) cohérent D1 ?
  - Échelle harmonisée (0-10 ou 0-100 partout) ?
  - 7 dimensions évaluées : factual_accuracy, depth, originality, readability, seo_completeness, value_to_reader, tone_axionia_alignment ?
  - Verdict déterministe recalculé depuis globalScore + issues (anti-hallucination) ?
- **Itérations boucle improve** :
  - `content-quality-improver-worker.ts` : 3 itérations pour `blog_pillar`+`landing_ville`, 2 pour autres types (cohérent D2) ?
  - Passe 2 reçoit-elle `verdict1.issues[]` formaté dans le prompt (acquis BUG 4 commit 0947d9e) ?
  - Pas de re-évaluation identique sans modification ?
- **Persona Manon (D3) cohérent** :
  - Grep "Manon" dans les 7 SYSTEM_PROMPTs (`src/server/content-gen/generators/*.ts`) → présent partout ?
  - "Manon, experte IA chez Axion-IA" exact ?
  - Aucun résidu "expert anonyme" ou "expert contenu Axion-IA" générique ?
- **Brand voice SSOT** :
  - `src/server/content-gen/brand/brand-voice.ts` (créé sprint P4 P1-5) ?
  - `injectBrandVoice()` câblée dans les 7 generators ?
  - Mots interdits ("révolutionner", "disruptif", "game-changer") respectés ?
- **AiContentDisclaimer wording** (D4) :
  - Composant `<AiContentDisclaimer />` wording exact "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA." ?
  - Présent sur 100% pages AI-générées (blog, cas-concrets, guides, implantations 39 villes acquis P4 P0-5) ?
- **REJECT-P0 vs REJECT-qualité** :
  - Distinction implémentée (acquis P4 P0-7) ?
  - REJECT-P0 (SIREN, AI Act, données perso) → `quarantined_critical` + alerte Telegram ?
  - REJECT-qualité → `needs_review` ?
- **Test fonctionnel** : générer 1 article par type (7 types) → vérifier persona Manon + wording disclaimer + score qualité conforme seuils
- Score : 100 max

### V-14 — Liens internes + Suggested content (/100)

**Question Will (brief original)** : "Liens internes + externes (base linkbase secteur) + suggested content bas page"

**Vérifications obligatoires** :
- **Liens internes** :
  - Catalogue URL `src/server/content-gen/links/internal-link-catalog.ts` créé (P4 P1-12 reporté) ?
  - `buildInternalLinkCatalog()` scanne `src/app/**/page.tsx` + DB `Article.publishStatus = "published"` ?
  - Worker post-LLM injecte 3-5 liens internes contextuels par article ?
  - 1 lien par phrase max, 5 par article max ?
  - Ancres descriptives (pas "cliquez ici") ?
  - `internalLinkCount` calculé correctement (regex HTML + Markdown dual-mode, commit 56decf0) ?
- **Liens externes** :
  - SYSTEM_PROMPTs imposent ≥ 2 sources externes autorité FR (INSEE/DARES/BPI/etc.) par article ?
  - Validation post-LLM : `externalLinkCount < 2` → `needs_review` ?
  - `citations[]` Perplexity câblé dans `isBasedOn` JSON-LD (acquis P3 QW-6) ?
- **Suggested content (articles connexes)** :
  - Section "Articles connexes" en bas de chaque page article ?
  - Composant `<RelatedArticles />` ou équivalent ?
  - Algorithme suggestion : par cluster keyword / par verticale / par ville / par embedding similarity ?
  - `ItemList` JSON-LD pour les articles suggérés ?
  - Mobile responsive ?
- **Maillage interne villes proches** :
  - `getNearbyVillesExtended()` câblé (acquis P3 QW-10) ?
  - Section "Villes proches" sur pages villes avec 6 villes Haversine ?
- **Test fonctionnel** :
  - `curl https://axion-ia.com/fr/blog/[test-slug]` → compter `<a href="/...` (liens internes) ≥ 3
  - `curl https://axion-ia.com/fr/audits/paris` → présence section "Villes proches"
  - Vérifier ancres descriptives (pas "cliquez ici", "lien")
- Score : 100 max

### V-15 — KB sectorielle + Image hero + Fact-checking (/100)

**Question Will** : "KB pour qualité sans inventer (zéro invention)" + "Image obligatoire (≥1 standard, ≥3 piliers) — JAMAIS DALL-E/IA générative"

**Vérifications obligatoires** :
- **KB sectorielle 5 verticales** :
  - `src/data/kb/audits.ts` (pilote acquis P4 P0-6) avec 50-100 facts vérifiés sourcés ?
  - `src/data/kb/interventions_formations.ts` créé ? (reporté Sprint S+7)
  - `src/data/kb/un_a_un.ts` créé ?
  - `src/data/kb/implementations.ts` créé ?
  - `src/data/kb/sites_web_augmentes.ts` créé ?
  - Si manquantes : gap P1 documenté
  - Fact format : `{ id, text, source, sourceUrl, verifiedAt, verticales[], confidence }` ?
  - Ingestion FTS Postgres ?
  - Generators utilisent `kbQuery()` avant LLM pour grounded facts ?
- **Image hero pipeline** :
  - `src/server/content-gen/images/assign-hero-image.ts` (acquis P1.5 B.6) ?
  - Scoring : module +10, city +5, region +5, kw overlap +3, sector +2, featured +0.5 ?
  - Filtres durs : `isActive=true`, `isAiGenerated=false` (doctrine zéro DALL-E), `deletedAt=null` ?
  - `VERTICAL_TO_IMAGE_MODULE` mapping cohérent (5 verticales) (acquis P4 P0-4) ?
  - Worker propage `heroImageFilePath` → `Article.featuredImage` ?
  - Fallback `pending_image` si pas de match ?
  - Vérifier 0 image AI générée en prod : `SELECT COUNT(*) FROM image_assets WHERE is_ai_generated=true AND ai_model IS NULL;` → DOIT être 0 (acquis P1.5 QW-7)
- **Fact-checking quarantaine** :
  - `src/server/content-gen/factcheck/fact-checker.ts` ?
  - Gate dur : si `factCheckScore < 50` → status `quarantined_factcheck` (acquis P4 P0-6) ?
  - `FactCheckClaim` model Prisma créé ?
  - Claims individuels persistés (pas juste score agrégé) ?
  - Voyage AI RAG vectoriel : mode `stub` ou réel ? (documenté)
- **Test fonctionnel** :
  - Compter facts par KB : si pilote `audits` seul → noter gap 4 verticales
  - Générer 1 article avec claim hardcoded faux → `factCheckScore < 50` → quarantained
  - Vérifier 5 articles random : featuredImage non-null + non-générique
- Score : 100 max

### V-16 — Cross-cutting orchestrateur (/100)

- Cohérence inter-agents V-01 à V-15 : 0 contradiction
- Score global `/1600` honnête (somme V-01 à V-16)
- Top 5 forces du système actuel
- Top 5 gaps critiques (P0)
- Recommandation Will : verdict 🟢/🟡/🔴 + 5 options [A-E]
- Roadmap correctif chiffrée (effort heures, priorité, gain pts par item)
- Synthèse des sprints disponibles qui adressent les gaps :
  - `PROMPT-SPRINT-PERFECTION-2026-FINALISATION-2026-05-22.md` (Cities 2100 + KB 4 verticales + intents 2026 + embeddings + diversification + brand voice drift)
  - `PROMPT-SPRINT-KEYWORDS-PERFECTION-2026-05-22.md` (perfection keywords N°1 France)
  - `PROMPT-SPRINT-CAMPAIGN-CONTROLS-2026-05-22.md` (durée + ordre villes + schedule cron)
  - `PROMPT-6-ROADMAP-EXECUTION-CHIFFREE.md` (verdict global /5000)
- Score : 100 max

**TOTAL : 1600 pts → normalisé `/1000`**

---

## 4. GATES OBLIGATOIRES AVANT AUDIT

```powershell
git log origin/main -1 --format="%h %s %ai"   # confirmer HEAD
pnpm typecheck --noEmit                         # baseline 0 erreur
pnpm test --run                                 # baseline vitest ≥ 1376/1383
pnpm prisma migrate status                      # no drift
```

Si typecheck/vitest ne sont PAS verts : noter dans verdict comme **alerte critique** mais continuer audit (le but est de produire le verdict, pas remédier).

---

## 5. TESTS FONCTIONNELS OBLIGATOIRES

Pour valider que les flux décrits dans le code fonctionnent vraiment :

### Test 1 — Publication multi-targets
- Créer 1 article test avec `anchorVilleSlug='paris'`, verticale `audits`
- Vérifier qu'il est accessible via :
  - `/fr/blog/[slug]`
  - `/fr/audits/paris/` (hub liste l'article ?)
  - `/fr/implantations/paris/` (hub liste l'article ?)
- Si seul `/blog/[slug]` accessible : P0 (article pas dans hubs)

### Test 2 — Breadcrumbs sur 10 routes
- `curl` chaque route, parser JSON-LD `<script type="application/ld+json">`
- Présence `BreadcrumbList` ?
- Items cohérents ?

### Test 3 — Lighthouse 5 pages
```powershell
npx lighthouse https://axion-ia.com/ --only-categories=performance,seo,accessibility,best-practices --output=json --output-path=./lh-home.json --chrome-flags="--headless"
# répéter pour /blog/[test-slug], /audits/paris, /glossaire/ia, /contact
```
Scores attendus ≥ 90 sur les 4 catégories.

### Test 4 — Sitemap validation
```powershell
curl -s https://axion-ia.com/sitemap.xml | head -50  # master sitemap index
curl -s https://axion-ia.com/sitemap-blog.xml | grep -c "<url>"  # count URLs
```

### Test 5 — Anti-doublon 4 couches
- Insérer article test identique à un existant → couche 1 doit BLOCK
- Insérer article test outline similaire → couche 3 doit WARN ou BLOCK selon seuil

### Test 6 — Pipeline RSS
- Lancer worker `content-gen-worker` sur 1 job from-rss test
- Vérifier article produit :
  - Pas de mention "Source :" / "D'après [site]" / similaire (Will refuse)
  - Similarité SimHash < 0.50 vs article source
  - Indexation IndexNow pingée

### Test 7 — Intents 2026
- Si enum `SearchIntent` étendue (7 valeurs) : créer keyword `voice_search` test + générer article → vérifier que SYSTEM_PROMPT adapté (phrases courtes)
- Si pas étendue : noter gap dans V-08

### Test 8 — Multi-campagnes concurrence
- Créer 3 campagnes test running parallèle (50 articles chacune)
- Observer 30 min : pas de race condition cap (MAX_PUBLISH respecté), pas de double publication

### Test 9 — Qualité éditoriale (V-13)
- Générer 1 article par type (7 types : blog_pillar / landing_ville / blog_from_keywords / blog_from_title / blog_from_rss / qa_derived / comparison)
- Pour chaque article :
  - Persona "Manon, experte IA chez Axion-IA" mentionné
  - Wording AiContentDisclaimer exact transparence max
  - Score qualité respecte seuil REJECT 6.0/60
  - Boucle improve fonctionne (3 itérations pilier+landing, 2 autres)
  - Brand voice respecté (pas de mots interdits "révolutionner"/"disruptif"/"game-changer")

### Test 10 — Liens internes + suggested content (V-14)
- Sur 5 articles random publiés :
  - Compter `<a href="/...` (liens internes) → ≥ 3 par article
  - Compter `<a href="https://...` (liens externes hors axion-ia.com) → ≥ 2 par article
  - Présence section "Articles connexes" en bas
  - Présence section "Villes proches" sur pages villes
  - Ancres descriptives (grep "cliquez ici" → 0 occurrences)

### Test 11 — KB sectorielle + Image hero + Fact-checking (V-15)
- `SELECT COUNT(*) FROM kb_facts GROUP BY vertical;` → vérifier counts par verticale
- `SELECT COUNT(*) FROM image_assets WHERE is_ai_generated=true AND ai_model IS NULL;` → DOIT être 0
- Sur 5 articles random : `featuredImage` non-null + image existe dans `image_assets` + `isAiGenerated=false`
- Forcer 1 article avec claim faux ("L'INSEE a publié en 2030 que...") → `factCheckScore < 50` → status `quarantined_factcheck`

---

## 6. ZONES INTERDITES (AUDIT-ONLY strict)

- ❌ Aucun `git commit`, `git push`, modification source
- ❌ Aucune installation dépendance
- ❌ Aucune modification env vars
- ❌ Aucune création worker / cron / hook
- ✅ Lecture exhaustive
- ✅ Diagnostics (`pnpm typecheck/lint/test`, `curl`, `psql -c "SELECT..."`, BullMQ admin lecture)
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/`

---

## 7. LIVRABLES OBLIGATOIRES

### Structure
```
_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/
├── VERDICT-AUDIT-COMPLET-CONTENT-GEN.md    (livrable principal, ~600-1000 lignes)
├── CROSS-CUTTING.md                         (analyses transverses)
├── ROADMAP-CORRECTIF-CHIFFREE.md           (effort + priorité + gain pts par item)
├── tests-results/
│   ├── test-01-multi-targets.md
│   ├── test-02-breadcrumbs.md
│   ├── test-03-lighthouse.md
│   ├── test-04-sitemap.md
│   ├── test-05-antidoublon.md
│   ├── test-06-rss.md
│   ├── test-07-intents.md
│   ├── test-08-multi-campagnes.md
│   ├── test-09-qualite-editoriale.md
│   ├── test-10-liens-suggested.md
│   └── test-11-kb-image-factcheck.md
└── agents/
    ├── V-01-publication-multi-targets.md
    ├── V-02-templates-hubs-blogs.md
    ├── V-03-breadcrumbs.md
    ├── V-04-web-vitals.md
    ├── V-05-queue-publication.md
    ├── V-06-pipeline-rss.md
    ├── V-07-seo-aeo-geo-centralisation.md
    ├── V-08-intents-2026.md
    ├── V-09-anti-doublon-4-couches.md
    ├── V-10-slugs-2026.md
    ├── V-11-sitemaps.md
    ├── V-12-keywords.md
    ├── V-13-qualite-editoriale.md
    ├── V-14-liens-suggested-content.md
    ├── V-15-kb-image-factcheck.md
    └── V-16-cross-cutting.md
```

### Format VERDICT-AUDIT-COMPLET-CONTENT-GEN.md

```markdown
# VERDICT AUDIT COMPLET CONTENT-GEN END-TO-END
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Auditeur : Claude Opus 4.7 (1M context) — AUDIT-ONLY

---

## RÉSUMÉ EXÉCUTIF (1 page Will)

**Score global : XXX/1000** — 🟢 GO PROD | 🟡 SPRINT CORRECTIF | 🔴 NO-GO

**Verdict en 3 phrases pour Will** :
<paragraphe explicatif clair>

### Top 3 forces
1. ...
2. ...
3. ...

### Top 3 gaps critiques (P0)
1. ... (effort X h, gain Y pts)
2. ...
3. ...

### Action immédiate recommandée
<1 ligne>

---

## SCORE DÉTAILLÉ PAR AXE

| # | Axe | Score | Max | % | Verdict |
|---|-----|-------|-----|---|---------|
| 1 | Publication multi-targets | XX | 100 | XX% | 🟢/🟡/🔴 |
| 2 | Templates hubs + blogs | XX | 100 | XX% | 🟢/🟡/🔴 |
| 3 | Fil d'Ariane | XX | 100 | XX% | 🟢/🟡/🔴 |
| 4 | Web Core Vitals | XX | 100 | XX% | 🟢/🟡/🔴 |
| 5 | Queue publication | XX | 100 | XX% | 🟢/🟡/🔴 |
| 6 | Pipeline RSS | XX | 100 | XX% | 🟢/🟡/🔴 |
| 7 | SEO/AEO/GEO centralisé | XX | 100 | XX% | 🟢/🟡/🔴 |
| 8 | Intents 2026 | XX | 100 | XX% | 🟢/🟡/🔴 |
| 9 | Anti-doublon 4 couches | XX | 100 | XX% | 🟢/🟡/🔴 |
| 10 | Slugs 2026 | XX | 100 | XX% | 🟢/🟡/🔴 |
| 11 | Sitemaps | XX | 100 | XX% | 🟢/🟡/🔴 |
| 12 | Keywords | XX | 100 | XX% | 🟢/🟡/🔴 |
| 13 | Qualité éditoriale LLM-judge | XX | 100 | XX% | 🟢/🟡/🔴 |
| 14 | Liens internes + suggested content | XX | 100 | XX% | 🟢/🟡/🔴 |
| 15 | KB sectorielle + Image hero + Fact-check | XX | 100 | XX% | 🟢/🟡/🔴 |
| 16 | Cross-cutting | XX | 100 | XX% | 🟢/🟡/🔴 |
| **TOTAL** | | **XXXX** | **1600** | **XX%** | |
| **Normalisé /1000** | | **XXX** | **1000** | | |

---

## RÉPONSES AUX 13 QUESTIONS WILL

Pour chaque question Will originale, réponse claire structurée :

### 1. Publication dans blog + hubs villes correspondantes ?
**Réponse** : OUI/PARTIEL/NON
**Preuves** : ...
**Gap** : ... (si partiel)

### 2. Templates hubs + blogs parfait avec catégories ?
...

### 3. Fil d'Ariane automatique partout, centralisé ?
...

### 4. Web Core Vitals perfection 100% pages ?
...

### 5. Système de queue multi-campagnes robuste ?
...

### 6. RSS : pas de source, pas de plagiat, adapté AxionIA, indexation rapide ?
...

### 7. SEO/AEO/GEO automatisé, robuste, centralisé, parfait ?
...

### 8. Intention de recherche optimale pour IA + moteurs en 2026 ?
...

### 9. Anti-doublon + anti-redondance sémantique robuste ?
...

### 10. Slugs perfection 2026 ?
...

### 11. Sitemaps parfaits + automatiques ?
...

### 12. Mots-clés à la perfection ?
...

### 13. Qualité éditoriale (LLM-judge calibration, persona Manon, brand voice, boucle improve) ?
**Réponse** : OUI/PARTIEL/NON
**Preuves** : ...
**Gap** : ... (si partiel)

### 14. Liens internes + suggested content bas page ?
...

### 15. KB sectorielle 5 verticales + Image hero pertinente + Fact-checking quarantaine ?
...

---

## ITEMS OK ✅
<liste détaillée>

## ITEMS PARTIELS ⚠️
<liste détaillée>

## ITEMS MANQUANTS / P0 🔴
<liste détaillée>

---

## ROADMAP CORRECTIF CHIFFRÉE

| Priorité | Item | Axe | Effort | Gain pts | Sprint suggéré |
|----------|------|-----|--------|----------|----------------|
| P0 | ... | V-01 | 5h | +30 | Sprint X |
| ...

---

## STOP & ASK WILL

```
✅ Audit complet end-to-end livré.

📊 Score global : XXX/1000 — 🟢/🟡/🔴

📈 16 axes :
- V-01 publication multi-targets : XX/100
- V-02 templates hubs+blogs : XX/100
- V-03 breadcrumbs : XX/100
- V-04 web vitals : XX/100
- V-05 queue publication : XX/100
- V-06 pipeline RSS : XX/100
- V-07 SEO/AEO/GEO centralisation : XX/100
- V-08 intents 2026 : XX/100
- V-09 anti-doublon 4 couches : XX/100
- V-10 slugs 2026 : XX/100
- V-11 sitemaps : XX/100
- V-12 keywords : XX/100
- V-13 qualité éditoriale LLM-judge : XX/100
- V-14 liens internes + suggested : XX/100
- V-15 KB + image hero + fact-check : XX/100
- V-16 cross-cutting : XX/100

✨ Top 3 forces :
1. ...

⚠️ Top 3 gaps critiques (P0) :
1. ...

🚀 Action recommandée :
[A] Sprint correctif ciblé sur P0 (≈XXh)
[B] Lancer Sprint Perfection 2026 Finalisation déjà créé
[C] Lancer Sprint Keywords Perfection déjà créé
[D] Lancer Sprint Campaign Controls déjà créé
[E] Continuer P6 verdict global /5000 pipeline content-gen perfection
```
```

### Mémoire à créer
Slug : `axionia_audit_complet_end_to_end_2026-05-22`
Type : project
Body : score global /1000, 13 axes, top 3 forces, top 3 gaps, recommandation Will.

### MEMORY.md à mettre à jour
```
- [🟢/🟡/🔴 AxionIA Audit complet end-to-end LIVRÉ 2026-05-22 — score XXX/1000](axionia_audit_complet_end_to_end_2026-05-22.md) — 13 axes vérifiés : publication multi-targets / templates / breadcrumbs / web vitals / queue / RSS / SEO / intents / dedup / slugs / sitemaps / keywords + cross-cutting. Réponses aux 13 questions Will + roadmap correctif chiffrée.
```

---

## 8. RÈGLES STRICTES

- ❌ AUCUNE mention Wikidata / DPA / CF WAF dans verdict ou roadmap
- ❌ AUCUNE re-demande des décisions déjà tranchées (D-W, D-P5, D1-D5, D7)
- ✅ Score `/1000` HONNÊTE (pas gonflé pour faire plaisir)
- ✅ Si typecheck/vitest ne sont pas verts au lancement : noter alerte critique mais continuer
- ✅ Tests fonctionnels réels (curl, queries DB, Lighthouse) — pas juste lecture code

---

## 9. STOP & ASK FINAL

Format strict (voir §7 livrable principal).

---

## 10. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance l'audit complet end-to-end décrit dans `_AUDIT/PROMPT-AUDIT-COMPLET-CONTENT-GEN-END-TO-END-2026-05-22.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure pas OÜ) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA Anthropic, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les 13 mémoires Bloc A du prompt + 8 verdicts Bloc B + 24 fichiers code Bloc C + 4 fichiers config Bloc D. Spawn 16 sous-agents parallèles V-01 à V-16 (publication multi-targets blog+hubs villes, templates hubs/blogs catégories UX, breadcrumbs centralisé automatique, Web Vitals 100% pages, queue multi-campagnes robuste, RSS sans source/sans plagiat/indexation rapide, SEO/AEO/GEO/Speakable/metaTitle/metaDescription centralisé, intents 2026 voice/AI overview/featured snippet, anti-doublon 4 couches sémantique, slugs perfection 2026, sitemaps automatiques, keywords perfection 5 verticales, qualité éditoriale LLM-judge+persona Manon+brand voice+boucle improve, liens internes catalogue + suggested content bas page, KB sectorielle 5 verticales + image hero zéro DALL-E + fact-checking quarantaine, cross-cutting). Exécuter TOUS les 11 tests fonctionnels obligatoires (multi-targets blog+hubs, breadcrumbs 10 routes, Lighthouse 5 pages, sitemap validation, anti-doublon, RSS sans source, intents 2026, multi-campagnes, qualité éditoriale 7 types, liens internes+externes+suggested, KB+image+fact-check). Gates baseline (typecheck/vitest verts). Self-troubleshoot toutes erreurs. Score `/1000` HONNÊTE pas gonflé. Produis 7 livrables principaux + 16 rapports agents + 11 tests-results dans `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/`. Mémoire axionia_audit_complet_end_to_end_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢/🟡/🔴 + 5 options [A-E]. Go.
```

---

## 11. POURQUOI CE PROMPT EST SELF-CONTAINED

Ce prompt contient :
- ✅ Tout le contexte projet AxionIA (§0)
- ✅ Toutes les décisions Will figées (§0)
- ✅ Toutes les exclusions Will absolues (§0)
- ✅ Mission claire (§1)
- ✅ Liste exhaustive des 45 fichiers à lire (§2)
- ✅ 13 sous-agents détaillés avec critères (§3)
- ✅ Gates baseline (§4)
- ✅ 8 tests fonctionnels obligatoires (§5)
- ✅ Mode AUDIT-ONLY strict (§6)
- ✅ Format livrables exhaustif (§7)
- ✅ Règles strictes (§8)
- ✅ STOP & ASK format (§9)
- ✅ Phrase de lancement AUTOPILOT (§10)

**Aucune connaissance externe nécessaire**. Le prompt suffit pour qu'une nouvelle conversation Claude Code l'exécute en autonomie totale.

---

*Mega-prompt audit complet content-gen end-to-end — 8-12h autopilot — AUDIT-ONLY — 13 axes critiques Will 2026-05-22*
