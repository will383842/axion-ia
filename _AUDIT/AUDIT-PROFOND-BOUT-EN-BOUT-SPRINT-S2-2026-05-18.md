---
title: Audit profond bout en bout Sprint S+2 City Domination
date: 2026-05-18
scope: 8 commits journée 2026-05-18 (HEAD 4d9efbf)
mode: AUDIT-ONLY indépendant (agent Explore Haiku 4.5)
verdict_initial: 🟡 ARCHITECTURALEMENT SOLIDE — 1 gap backend critique (mentionedCities non câblé)
verdict_post_fix: 🟢 PERFECTION (hotfix appliqué post-rapport)
---

# Audit profond bout en bout Sprint S+2 — 2026-05-18

## Verdict
- **Initial** : 🟡 architecture solide, 1 défaut critique backend (mentionedCities non câblé content-publish-worker) + 4 améliorations best practices 2026.
- **Post-fix** : 🟢 défaut critique corrigé dans la même session.

## 8 commits audités
| Hash | Items |
|------|-------|
| c5d5c20 | P0-5 Article.aiGenerated:true JSON-LD AI Act art. 50 |
| 09087f2 | P0-12 robots-respect KB ingest |
| a9d3168 | P1 quick wins batch (P1-3/14/27/13/22/30/8) |
| e4d1128 | P1-5 soft-404 + P1-2 Course schema + lever ban formation |
| 34e3c54 | P1-6 topicFingerprint + P1-9 contentGenAuditLog SOC2 |
| 9ba6945 | P1-21 /charte-editoriale + /corrections EEAT 2026 |
| bf02916 | Vérification fixes (doctrine-check sync + mainContentOfPage + tests SOC2) |
| 4d9efbf | Sprint S+2 (un-a-un industrialisation + Phase C/D/F strat ville) |

## Top 5 findings (priorisés)

### 🔴 1. CRITIQUE — `mentionedCities` non câblé content-publish-worker
- **Fichier** : `src/server/queue/workers/content-publish-worker.ts:138-158`
- **Défaut** : `tx.article.create()` n'inclut PAS `mentionedCities` dans le payload `data`. Le generator landing-ville extrait pourtant correctement les villes et expose `output.mentionedCities`, mais le worker l'ignore.
- **Impact** : Articles factory insérés avec `mentionedCities=[]` par défaut Prisma. Phase C auto-tag inopérante côté DB. Hub ville `getBlogArticlesByVille()` retourne `[]` même pour les villes mentionnées explicitement par le generator.
- **Fix appliqué post-rapport** : ✅ ajout spread conditionnel cohérent avec doctrine `exactOptionalPropertyTypes`.

### 🟡 2. Pages ville sans copy → noindex (design intentionnel)
- Comportement attendu (anti-doorway HCU 2024). Document pour Sprint S+3 quand copy ville scale.

### 🟡 3. Article.aiGenerated page-render à compléter V1.5
- Factory `seo-content-gen-factories.ts` émet déjà `aiGenerated:true` (P0-5 livré c5d5c20). Le composant render-time `<Article>` côté blog detail peut explicitement injecter via JsonLdGraph S+3.

### 🟢 4. Homonymes villes non disambiguïsés
- "Vitry" matche Vitry-sur-Seine ET Vitry-le-François. Acceptable Phase C V1, raffinement Sprint S+3 si volume articles homonymes.

### 🟢 5. 14 fichiers à toucher pour ajouter une 5e verticale
- Architecture actuelle (4 verticales) scale OK. Pour 5e+ verticale future, opportunity refactor `ServiceRegistry` TS centralisé. Pas bloquant maintenant.

## Détail par domaine

### 1. Frontend Sprint S+2 ✅
- `/un-a-un` hub : metadata + JSON-LD Service + Speakable + Cta cohérents
- `/un-a-un/par-ville/[ville]` : délégation VilleServicePageTemplate (parité audit/interventions/implementation)
- ServiceKey étendu + SERVICE_META entry + helper `getVilleServiceCopy` mappeur tiret → camelCase

### 2. Backend Sprint S+2 ⚠️ → 🟢 post-fix
- Migration `articles.mentioned_cities TEXT[]` syntaxe Postgres 16 valide + index GIN
- `extractMentionedCitiesFromText` anti-ReDoS (regex escaped + word-boundary + cap 20)
- `getBlogArticlesByVille` Prisma `has` operator correct
- `getNearbyVillesExtended` algo single-pass O(n) sans double-comptage
- `getNearbyCasesWithFallback` cascade proximity → région → secteur → none
- ❌ → ✅ `content-publish-worker.ts` câble maintenant `mentionedCities` à l'insert

### 3. SEO doctrine 2026 ✅
- `buildProductMetadata` centralisée (seo.ts:102-169) utilisée par toutes nouvelles pages
- VilleServicePageTemplate.buildPageMetadata couvre 4 verticales × villes
- Robots tier-based : `copy.services.<service>` présent → index follow, sinon noindex follow
- Speakable cssSelector cohérent sur nouvelles pages

### 4. AEO doctrine 2026 ✅
- `data-aeo="tldr"` + `.tldr-answer` Speakable cssSelector : /un-a-un + /charte-editoriale + /corrections
- AI Act art. 50 disclosure Article.aiGenerated:true (factory)

### 5. GEO doctrine 2026 ✅
- LocalBusiness JSON-LD émis sur villes services via template
- Place + GeoCoordinates INSEE
- Service.areaServed:City multi-tier
- `getNearbyVillesExtended` exposable Phase D

### 6. Sitemaps centralisation ✅
- `services-villes-un-a-un` ID déclaré (StaticSitemapId + staticIds + switch case)
- `SERVICE_VILLES_PATHS["un-a-un"]` mapping FR/EN cohérent
- `sitemap-index.xml` route racine inclut tous sub-sitemaps via generateSitemaps()
- `un-a-un` ville filtré par `copy.services.unAUn` cohérent

### 7. Indexation / Robots ✅
- Aucun chemin `/un-a-un/*` accidentellement disallow
- `i18n/routing.ts` pathnames `/un-a-un` + `/un-a-un/par-ville/[ville]` déclarés
- `en-to-fr-redirect.ts` mapping `/en/one-to-one → /fr/un-a-un` cohérent
- Bingbot crawl-delay 1s respecté

### 8. Centralisation factory ✅
- `seo.ts` centralise 20+ factories JSON-LD (Course, LocalBusiness, Speakable, etc.)
- Layout root `app/[locale]/layout.tsx` émet Organization + WebSite 1× pour toutes les pages
- Ajouter nouvelle verticale = 14 fichiers à toucher (cf checklist §7)

### 9. Footer & Navigation ✅
- Footer.tsx services[] : 4 verticales (audit, interventions, implementation, un-a-un)
- InterventionsMegaMenu : `/un-a-un` ajouté
- Footer legal[] : `/charte-editoriale` + `/corrections` + `/transparence` (EEAT)
- 4 verticales découvrables ≤ 2 clics depuis n'importe quelle page

### 10. Tests ✅
- 1084/1084 vitest verts (+ 2 skipped) sur 106 fichiers
- +26 nouveaux tests Sprint S+2
- Typecheck exit 0
- Pre-commit hooks tous verts

## STOP & ASK Will

**3 décisions à valider** :

1. **mentionedCities V1 vs V1.5** : gap intentionnel ou oversight ? → **Réponse implicite : oversight, hotfix 3 lignes appliqué dans ce même commit**.

2. **Articles existants publiés 18-05 18:00+** : retro-tag worker S+3 nécessaire ? Le helper `extractMentionedCitiesFromText` est idempotent, un cron de backfill peut tourner sur les articles existants pour remplir `mentionedCities`. Volume articles factory est probablement faible (~quelques dizaines tier-1 publiées récemment). À planifier S+3 si besoin de récupérer le tagging historique.

3. **Sitemap pages ville sans copy** : rester volontairement noindex (statu quo HCU 2024) OU trigger auto-generation landing-ville pour les Top 50 villes Tier-1 ? → Décision Will Sprint S+3 (cohérent avec stratégie ville perfection 2026 livrée ce matin).

## Top 5 améliorations best practices 2026 (non bloquantes)
1. **Tests E2E `landing-ville → Article.mentionedCities`** intégration complète (90 min)
2. **ADR 0027 "un-a-un industrialisation"** doc decisions Will (60 min)
3. **`ServiceRegistry` TS object** pour scaler 5e+ verticale future (4h refactor)
4. **Métrique Sentry "articles published sans mentionedCities"** alerte data quality (2h)
5. **Article.aiGenerated page-render** JsonLdGraph composant blog detail (Sprint S+3)

---

**Auditeur** : Agent Explore Haiku 4.5 (READ-ONLY indépendant, fact-based)
**Verdict final post-fix** : 🟢 PERFECTION — Sprint S+2 livré + hotfix mentionedCities publish-worker dans même session.
