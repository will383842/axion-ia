# SPRINT CORRECTIF P3 — SEO / AEO / GEO / AI OVERVIEWS
## AxionIA Content-Gen Perfection 2026 — Phase 3 corrections

**Date création** : 2026-05-21
**Phase parent** : P3 (SEO/AEO/GEO/AI Overviews) — score audit 689/1000 🔴 NO-GO
**Score cible post-sprint** : ≥ 800/1000 🟡 CONDITIONNEL
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 6-10h autopilot (10 QW + 5 actions Will + Featured Snippets pilote)

---

## 0. CONTEXTE — À LIRE AVANT TOUT

### État du repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche cible** : `main`
- **HEAD origin/main au lancement** : `0906722` (Manon backfill embeddings — 2026-05-21 16:51)
- **Baseline P1.5 livrée + vérifiée** : `37ca0147` (audit 11 agents GO 192/200)
- **P3 partiel déjà fait** : commits `e986fda` (Knowledge Graph + keywords + WCAG) + `f5fc2c2` (title IA + H1 + FAQ 30Q). **Vérifier ce qui reste à faire** :
  ```powershell
  git show e986fda --stat
  git show f5fc2c2 --stat
  ```

### Fichiers d'audit à lire avant de coder
1. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/PHASE-3-VERDICT.md` (verdict 689/1000)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-01.md` à `A3-10.md`
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/CROSS-CUTTING.md`

### Décisions Will requises (POSER avant de coder)
- **DW-3-01** : ✅ Wikidata Q-ID Axion-IA. Action Will : créer https://www.wikidata.org/wiki/Q[nouveau] avec :
  - `legalName: "Axion-IA OÜ"` (selon brand.ts) MAIS attention : mémoire `axionia_image_bank_complet_2026-05-20` mentionne `Copyright Axion-IA OÜ (0 SIREN)` ET `axionia_session_2026-05-18_image_bank_phase0_1` parle de "société française" — vérifier si OÜ encore active ou si rebrand FR pure. **POSER LA QUESTION à Will**.
  - `sitelinks: axion-ia.com`
  - `foundedBy: Will Jullin`
  - `instance of: AI company / consulting firm`
- **DW-3-02** : Adresse FR Local SEO. Options : WeWork Paris ~300€/mo / domiciliation classique ~30€/mo / rien (perte ranking Local Pack). **Reco** : WeWork Paris si budget OK (selon mémoire `axionia_content_gen_city_domination_2026-05-18`).
- **DW-3-03** : GSC service account JSON. Action Will : créer service account Google Cloud → download JSON → upload Coolify env var `GSC_SERVICE_ACCOUNT_JSON`.
- **DW-3-04** : CF WAF — vérifier bots IA. Action Will : Cloudflare Dashboard → Security → WAF → Managed Rules → désactiver "Block AI Bots" ou créer exceptions pour `ClaudeBot`, `GPTBot`, `PerplexityBot`, `Google-Extended`, `Bytespider`.

**Si Will dit "applique recos, vas-y"** → DW-3-02 = WeWork (mais nécessite signature contrat, donc Claude n'agit pas dessus sauf si Will fournit l'adresse), DW-3-04 = vérifie via curl avec user-agent `ClaudeBot/1.0` et reporte status.

### Mémoires Claude pertinentes
- `axionia_keyword_strategy_audit_2026-05-19` (concurrent homonyme axionai.fr rank #1 brand)
- `axionia_couleurs` (#c24a1b terracotta, #1a4dd9 bleu pointes)
- `axionia_positionnement_4_verticales` (5 verticales actuelles)
- `axionia_session_2026-05-18_image_bank_phase0_1` (société française vs OÜ — décision Will)

---

## 1. MODE OPÉRATIONNEL

### Autorisations
- ✅ Modification composants JSON-LD (`src/components/seo/*.tsx`, `src/lib/seo.ts`)
- ✅ Modification SYSTEM_PROMPT générateurs (UNIQUEMENT pour ajout instruction sources externes)
- ✅ Modification `brand.ts` (legalName, alternateName, wikidataQid)
- ✅ Commits + push
- ❌ JAMAIS modifier generators logique métier (P4)
- ❌ JAMAIS modifier console admin (P5)
- ❌ JAMAIS modifier KB / fact-checker (P4)
- ❌ JAMAIS modifier Prisma schema (P4 ou P5)

### Gates obligatoires
```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm content-gen:isolation-check
```

### Pré-push
```powershell
git pull --rebase origin main
```

### Format commits
```
feat(seo): p3 sprint correctif — <description courte>

<corps>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. QUICK WINS (10 items, ~6h)

### QW-1 — `speakable` dans `buildArticleJsonLd` (~30 min)
**Gain** : +8 pts (A3-01 +5, A3-03 +3)

**Spec** :
- Fichier : `src/lib/seo.ts` fonction `buildArticleJsonLd`
- Ajouter au JSON-LD retourné :
```typescript
speakable: {
  "@type": "SpeakableSpecification",
  cssSelector: ["h1", "[data-aeo='tldr']", "article p:first-of-type"],
}
```
- Référence : patch QW-2 ffdb49a6 a déjà fait pour FAQPage/QAPage/NewsArticle — fais la même chose pour `BlogPosting`.

### QW-2 — `legalName: "Axion-IA OÜ"` + `alternateName` (~50 min, après DW-3-01 validation)
**Gain** : +10 pts (A3-04 +5, A3-10 +5)

**Spec** :
- Fichier : `src/lib/brand.ts:16` (ou équivalent SSOT)
- Si DW-3-01 confirme OÜ active :
```typescript
legalName: "Axion-IA OÜ",
alternateName: ["AxionIA", "Axion IA", "axion-ia.com"],
```
- Si DW-3-01 confirme société française pure (sans OÜ) :
```typescript
legalName: "Axion-IA",  // ou raison sociale FR exacte
alternateName: ["AxionIA", "Axion IA", "Axion-IA OÜ" /* historique */, "axion-ia.com"],
```
- Propager dans tous les composants JSON-LD `Organization`

### QW-3 — Wikidata Q-ID dans `Organization.sameAs` (~30 min, après Will créé le Q-ID)
**Gain** : +20 pts A3-04

**Spec** :
- Quand Will fournit le Q-ID (ex: `Q123456789`) :
- Fichier : `src/lib/brand.ts` ajouter `wikidataQid: "Q123456789"`
- Dans `buildOrganizationJsonLd` ajouter au `sameAs[]` :
```typescript
sameAs: [
  ...existingSameAs,
  `https://www.wikidata.org/wiki/${BRAND.wikidataQid}`,
]
```
- Vérifier que `axion-ia.com` lui-même est dans le sitelink Wikidata côté Will.

### QW-4 — SYSTEM_PROMPT ≥ 2 liens externes/article (~1h)
**Gain** : +10 pts (A3-03 +5, A3-08 +5)

**Spec** :
- Fichiers : `src/server/content-gen/generators/blog-article.ts`, `blog-from-keywords.ts`, `blog-pillar.ts`
- Dans SYSTEM_PROMPT, ajouter :
```
## SOURCES EXTERNES OBLIGATOIRES
Inclure dans l'article **au moins 2 liens externes** vers sources d'autorité FR ou internationales :
- INSEE (insee.fr) — données démographiques/économiques
- DARES (dares.travail-emploi.gouv.fr) — emploi
- BPI France (bpifrance.fr) — PME/financement
- France Travail (francetravail.fr) — recrutement
- McKinsey Global Institute (mckinsey.com/mgi) — études IA/entreprise
- Stanford AI Index Report (aiindex.stanford.edu) — métriques IA
- EU AI Act texte officiel (eur-lex.europa.eu) — réglementation
Format : ancre descriptive, jamais "cliquez ici".
```
- Validation post-LLM dans `content-publish-worker.ts` : si `externalLinkCount < 2` → status `needs_review` + warning log.

### QW-5 — `AuthorByline` sur routes articles (~1h)
**Gain** : +5 pts E-E-A-T (A3-08)

**Spec** :
- Composant `<AuthorByline />` existe déjà (selon verdict P3 A3-08) mais aucune page l'importe
- Importer dans :
  - `src/app/[locale]/blog/[slug]/page.tsx`
  - `src/app/[locale]/cas-concrets/[slug]/page.tsx`
  - `src/app/[locale]/guides/[slug]/page.tsx` (si existe)
- Placer après `<h1>` et avant le contenu body
- Doit utiliser persona Manon (cohérent avec décision P4 D3 si lancé en parallèle, sinon "Équipe Axion-IA" par défaut)

### QW-6 — `citations` Perplexity → `isBasedOn` JSON-LD (~1h)
**Gain** : +5 pts A3-03

**Spec** :
- Fichier : `src/lib/seo.ts` `buildArticleJsonLd`
- Si l'article a un champ `citations[]` (issu de Perplexity factcheck), les inclure :
```typescript
isBasedOn: article.citations?.map(c => ({
  "@type": "WebPage",
  "@id": c.url,
  name: c.title,
  url: c.url,
})) ?? undefined,
```
- Article model : vérifier que `citations` est bien stocké en DB (JSON array). Si absent : juste laisser undefined sans erreur.

### QW-7 — Vérifier CF WAF bots IA (~30 min Will + ~30 min Claude post-Will)
**Gain** : +7 pts potentiels A3-03

**Spec** :
- Will exécute : Cloudflare Dashboard → Security → WAF → Managed Rules → vérifier statut "Block AI Bots"
- Si activé : désactiver OU créer exceptions pour user-agents `ClaudeBot`, `GPTBot`, `PerplexityBot`, `Google-Extended`, `Bytespider`, `Anthropic-AI`, `cohere-ai`, `meta-externalagent`
- Claude vérifie post-Will via :
```powershell
curl -A "ClaudeBot/1.0" https://axion-ia.com/ -I
curl -A "GPTBot/1.0" https://axion-ia.com/ -I
```
- Doit retourner `200 OK`, pas `403`. Documente résultats dans verdict.

### QW-8 — `search_term_string` correct dans `urlTemplate` (~15 min)
**Gain** : +3 pts A3-10

**Spec** :
- Fichier : composant `<WebSiteJsonLd>` ou `buildWebSiteJsonLd` dans `src/lib/seo.ts`
- Vérifier que `SearchAction.target.urlTemplate` utilise bien le placeholder `{search_term_string}` :
```typescript
potentialAction: {
  "@type": "SearchAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: "https://axion-ia.com/recherche?q={search_term_string}",
  },
  "query-input": "required name=search_term_string",
}
```

### QW-9 — `AggregateRating` instanciation pilote (~1h)
**Gain** : +5 pts A3-10

**Spec** :
- La factory `buildAggregateRatingJsonLd` existe déjà selon verdict P3
- L'instancier sur **3 pages pilote** uniquement (pas généralisation) :
  - `/audits` (verticale hub) : `ratingValue: 4.8, reviewCount: 24` (valeurs cohérentes mais fictives = inacceptable RGPD/loyauté commerciale → **POSER À WILL** : avez-vous de vraies reviews ?)
  - **Si Will n'a pas de vraies reviews** : SKIPPER ce QW (ne pas inventer de fausses ratings).
- Si Will fournit reviews réelles (G2, Trustpilot, GBP) : les agréger dans `AggregateRating` honnête.

### QW-10 — `getNearbyVillesExtended()` câblé dans pages villes (~1h)
**Gain** : +5 pts A3-07

**Spec** :
- Fonction `getNearbyVillesExtended()` livrée mais non utilisée (selon verdict)
- L'appeler dans `src/app/[locale]/[vertical]/[ville]/page.tsx` (les 4-5 verticales × villes)
- Ajouter section "Villes proches" en bas de page avec liens vers les 6 villes les plus proches (Haversine)
- JSON-LD `BreadcrumbList` ou `ItemList` pour structure

---

## 3. FEATURED SNIPPETS PILOTE (P0-4, sprint 1 semaine — version condensée ~3h)

### Spec condensée (vs sprint complet 1 semaine)
**Gain** : +15 pts A3-02 (de 38/80 vers ~53/80, pas le max mais significatif)

- Composant TOC (Table Of Contents) :
  - Créer `src/components/seo/ArticleTOC.tsx`
  - Server Component qui parse les `<h2>` / `<h3>` du markdown rendered HTML
  - Sticky positionning desktop (left rail) + collapsible mobile
  - Anchor links avec smooth scroll
- Importer dans :
  - `src/app/[locale]/blog/[slug]/page.tsx` si `wordCount > 1500`
  - `src/app/[locale]/guides/[slug]/page.tsx` toujours
- JSON-LD `ItemList` pour le TOC (optionnel mais améliore parsing Google) :
```typescript
{
  "@type": "ItemList",
  itemListElement: tocItems.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.title,
    url: `${pageUrl}#${item.anchor}`,
  })),
}
```

**Le reste de la roadmap Featured Snippets** (prompt tableau dans comparison.ts, FAQ guides, H2 en questions) est **déjà partiellement résolu** par BUG-5 `8b3f470` (comparison.ts avec `<table>` obligatoire). **Vérifier** :
```powershell
git show 8b3f470 --stat
```
Et compléter si besoin.

---

## 4. ANTI-CONCURRENCE axionai.fr (A3-10, ~1h)

### Spec
- Concurrent homonyme `axionai.fr` rank #1 sur brand queries selon `axionia_keyword_strategy_audit_2026-05-19`
- Action 1 : booster H/I keyword seeds brand (déjà fait `keywords` selon mémoire `axionia_keywords_747seeds_2026-05-20`) — **vérifier que les seeds `g_brand_axionia` sont bien dans la table `Keyword` et que `vertical='brand'`**
- Action 2 : créer page `/brand` ou `/qui-est-axion-ia` qui clarifie l'identité (URL canonique brand)
- Action 3 : Wikidata Q-ID (QW-3 ci-dessus) — bloque Knowledge Panel concurrent
- Action 4 : backlinks autorité FR (action Will, hors scope sprint mais documenter)

---

## 5. ZONES INTERDITES

- ❌ `src/server/content-gen/generators/*.ts` (P4 — sauf ajout SYSTEM_PROMPT sources externes QW-4)
- ❌ `src/server/queue/workers/*.ts` (P2 / P4)
- ❌ `prisma/schema.prisma` (P4 / P5)
- ❌ Console admin V2 (P5)
- ❌ KB / fact-checker (P4)
- ❌ Génération de fausses reviews ou ratings inventés (RGPD/loyauté)

---

## 6. LIVRAISON FINALE

### Verdict final
`_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/VERDICT-SPRINT-P3-CORRECTIONS.md`

Format :
```markdown
# VERDICT SPRINT P3 CORRECTIONS — SEO/AEO/GEO/AI Overviews
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA court>
## Score avant → après : 689/1000 → XXX/1000 (+XXX pts)

## Actions Will validées
- DW-3-01 Wikidata Q-ID : Q<XXXXX> créé / EN ATTENTE
- DW-3-02 Adresse FR : WeWork / domiciliation / aucun
- DW-3-03 GSC service account : DEPLOYÉ / EN ATTENTE
- DW-3-04 CF WAF bots IA : DÉBLOQUÉ / DÉJÀ OK / EN ATTENTE

## QW livrés
| QW | Statut | Commit | Gain |
|----|--------|--------|------|
| QW-1 speakable BlogPosting | ✅ | ... | +8 |
| ...

## P0 partiels
- P0-2 sources externes : ✅ ajouté dans SYSTEM_PROMPT (~10 pts)
- P0-4 Featured Snippets : TOC composant créé (+15 pts, vs +20 max)
- P0-5 SpeakableSpec : couvert par QW-1

## Gates ✅

## Score par agent
| Agent | Avant | Après | Delta |
|-------|-------|-------|-------|
| A3-01 JSON-LD | 67/100 | XX | +XX |
| A3-02 Featured Snippets | 38/80 | XX | +XX |
| ...

## Actions Will résiduelles
1. Wikidata Q-ID création
2. Adresse FR décision
3. GSC service account
4. CF WAF (si pas fait)
5. Backlinks autorité FR (long terme)
```

### Mémoire
Slug : `axionia_sprint_p3_corrections_livre_2026-05-21`

### MEMORY.md
```
- [🟢 AxionIA Sprint P3 corrections LIVRÉ 2026-05-21 — score 689→~800/1000](axionia_sprint_p3_corrections_livre_2026-05-21.md) — SEO/AEO/GEO : 10 QW (speakable + Wikidata + sources externes + AuthorByline + TOC + getNearbyVillesExtended) + Featured Snippets pilote. 4 actions Will pendantes (Q-ID, adresse, GSC, CF WAF).
```

---

## 7. STOP & ASK FINAL

```
✅ Sprint P3 corrections livré.
- HEAD : <sha>
- Score 689 → XXX/1000 (+XXX pts)
- X commits pushés
- Gates ✅

📋 Actions Will pendantes :
1. Wikidata Q-ID (URGENT < 48h, +20 pts directs si fait)
2. Adresse FR (< 7 jours)
3. GSC service account JSON (< 7 jours)
4. CF WAF bots IA (URGENT < 24h)

🚀 Suite proposée :
[A] Lancer Sprint P4 corrections (qualité éditoriale, ~16-20h) si pas déjà lancé
[B] Lancer Sprint P5 corrections (console admin, ~16h) si pas déjà lancé
[C] Lancer P6 roadmap chiffrée + verdict global /5000
[D] Will agit sur les 4 actions ci-dessus puis on fait Sprint P3 follow-up (+34 pts Wikidata)
```

---

## 8. PHRASE DE LANCEMENT

```
Lance le sprint correctif décrit dans `_AUDIT/PROMPT-SPRINT-P3-CORRECTIONS-2026-05-21.md`. Mode IMPLEMENTATION. Vérifie d'abord ce qui est déjà fait sur origin/main (commits e986fda, f5fc2c2, 8b3f470). Pose les questions Will : DW-3-01 (OÜ ou société française pure ?), AggregateRating (vraies reviews ou skip ?). Puis : 10 QW SEO + Featured Snippets pilote TOC + Anti-concurrence axionai.fr seeds brand. Commits incrémentaux + push. Convergence Manon (git pull --rebase). Gates verts obligatoires. Termine par VERDICT-SPRINT-P3-CORRECTIONS.md + mémoire + STOP & ASK Will avec liste des 4 actions Will pendantes. Go.
```

---

*Sprint correctif P3 — 6-10h autopilot — Cible 689 → 800/1000*
