# SPRINT CORRECTIF P4 — QUALITÉ ÉDITORIALE & TEMPLATES
## AxionIA Content-Gen Perfection 2026 — Phase 4 corrections

**Date création** : 2026-05-21
**Phase parent** : P4 (Qualité éditoriale & Templates) — score audit 547/1000 🔴 NO-GO
**Score cible post-sprint** : ≥ 775/1000 🟡 CONDITIONNEL (limite GO)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 16-20h autopilot (Phase QUICK 4h + Phase parallèle 8h + Phase COMPLET 8h)
**P0-1 STATUT** : ✅ DÉJÀ RÉSOLU via BUG-5 (4 stubs implémentés sur origin/main, commits 75420e4/8b3f470/71f658f/99fe423). NE PAS RE-FAIRE.

---

## 0. CONTEXTE — À LIRE AVANT TOUT

### État du repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche cible** : `main`
- **HEAD origin/main au lancement** : `0906722` (Manon backfill embeddings — 2026-05-21 16:51)
- **Baseline P1.5 livrée + vérifiée** : commit `37ca0147` (P1.5 B.8 LLM-judge), audit 11 agents GO 192/200
- **BUG-5 4 stubs résolu** :
  - `75420e4` qa-derived (QAPage + Speakable)
  - `8b3f470` comparison (`<table>` obligatoire, hard gate)
  - `71f658f` blog-from-rss (pipeline dédié actualité, citation source)
  - `99fe423` blog-from-title (titre forcé sortie, quality loop 3 passes)

### Fichiers d'audit à lire avant de coder
1. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/PHASE-4-VERDICT.md` (verdict 547/1000)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/A4-01-TEMPLATES.md` à `A4-10-FEEDBACK-LOOP.md` (10 fichiers détaillés)
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/CROSS-CUTTING.md`

### Décisions Will VALIDÉES 2026-05-21 (à appliquer directement, NE PAS re-demander)

✅ **D1 — Seuil LLM-judge REJECT = 6.0/10 (= 60/100 normalisé)**
- Taux rejet attendu ~10-20%, équilibre qualité/volume
- **Cohérence forte avec D-P5-2** (Sprint P5 a tranché 60/100 — même valeur normalisée)
- Action code : harmoniser `llm-judge.ts` (actuellement 7.0 hardcodé en échelle 0-10) avec `QualityLoopV2` config DB (échelle 0-100). Constant `REJECT_THRESHOLD = 6.0` ou lire depuis `ContentGenConfig.key="quality_reject_threshold"` value `60` (échelle 100).

✅ **D2 — Itérations boucle improve = Option B (3 itérations pour `blog_pillar` + `landing_ville`, 2 pour les autres types)**
- Investit sur les contenus longs/stratégiques (~3000 mots) qui méritent l'effort de regénération
- Coût tokens : +15% vs Option A
- Action code : `content-quality-improver-worker.ts` lire `contentType` du job → `maxIterations = ['blog_pillar', 'landing_ville'].includes(contentType) ? 3 : 2`
- Stocker config DB : `ContentGenConfig.key="quality_max_iterations_long"` value `3`, `key="quality_max_iterations_short"` value `2` (pour edition Will via UI Sprint P5)

✅ **D3 — Persona auteur E-E-A-T = Option B (Manon, experte IA chez Axion-IA)**
- Personnage fictif assumé, cohérent avec brand (JSON-LD Person + image fondateur déjà déployés autour de Manon)
- RGPD safe (pas de vraie personne dont les droits sont violés)
- Action code : tous les SYSTEM_PROMPTs blog/landing/pilier/qa/comparison/rss-from-title remplacent "expert contenu Axion-IA" anonyme par "Manon, experte IA chez Axion-IA"
- Action code : `<AuthorByline />` instancié dans `/blog/[slug]`, `/cas-concrets/[slug]`, `/guides/[slug]` avec `name="Manon"`, `jobTitle="Experte IA chez Axion-IA"`
- Action code : `Person` JSON-LD cohérent (vérifier `src/lib/seo.ts buildAuthorJsonLd` ou équivalent)
- **Cohérence avec** : mémoire `[[axionia_session_2026-05-16_image_bank_v1_post_audit_patches]]` doctrine v2.1 (Manon n'a aucun réseau social — ne PAS générer profils sociaux fake)

✅ **D4 — Wording mention humaine AI Act = Option B (transparence maximale avec mention modèle)**
- **Wording exact à utiliser** : `"Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."`
- Avantage : les bots IA (ChatGPT, Perplexity, Claude AI Overviews) préfèrent citer les contenus transparents — bonus SEO/AEO gratuit
- AI Act art. 50 surconforme (deadline applicable août 2026)
- Action code : modifier composant `<AiContentDisclaimer />` (le seul composant SSOT pour la mention) — propriété `disclaimer` ou texte hardcoded → utiliser le wording ci-dessus
- Vérifier que toutes les pages utilisent ce composant (déjà fait sur `/blog/[slug]` + `/cas-concrets/[slug]` post-P1.5, à étendre `/implantations/[ville]` 39 pages dans ce sprint P0-5)
- **NOTE** : si le modèle utilisé change (ex: passe à Claude Opus 4.7 ou autre), prévoir env var `AI_MODEL_DISCLOSURE_NAME` (default `"Claude Sonnet 4.6"`) pour éviter de re-générer tous les articles.

✅ **D5 — Reporting qualité hebdomadaire = Option A (email lundi 8h CET → williamsjullin@gmail.com)**
- Déjà tranché D-P5-3 par Will lors de l'audit P5. Pas re-demandé.
- Hors scope direct du Sprint P4 (sera implémenté par Sprint P5 ou Sprint S+6 cron).

### Décision Will résiduelle (à demander UNIQUEMENT si nécessaire au code)

⏳ **D6 — Adresse FR Local SEO** : pas tranché à 2026-05-21 (reco Claude : Domiciliation Sedomicilier ~30€/mois pour démarrer, upgrade WeWork si CA décolle). **Hors scope code Sprint P4** — action externe Will. Pas besoin d'attendre pour lancer le sprint.

⏳ **D7 — Statut juridique (OÜ estonien vs société FR pure)** : à demander à Will dans la conversation P3 (impact `legalName` JSON-LD + Wikidata Q-ID). **Hors scope code Sprint P4** — n'affecte pas D1-D5.

**Décisions D1-D5 sont validées et le sprint peut démarrer sans STOP & ASK initial.**

### Mémoires Claude pertinentes
- `axionia_bug5_generators_phase_abc_2026-05-21` (4 stubs implémentés)
- `axionia_content_gen_p1_5_livre_2026-05-21` (baseline + LLM-judge livré)
- `axionia_keywords_747seeds_2026-05-20` (747 keywords seeds 29 secteurs)
- `feedback_no_dalle_images` (règle absolue : aucune image IA générative)
- `axionia_positionnement_4_verticales` (5 verticales actuelles : 4 + sites_web_augmentes)

---

## 1. MODE OPÉRATIONNEL

### Autorisations
- ✅ Création/modification de code source
- ✅ Création de migrations Prisma (UNIQUEMENT pour KB sectorielle, PAS pour `ArticleFeedback` qui est réservé à P5)
- ✅ Commits Conventional + Co-Authored-By
- ✅ Push sur `main`
- ❌ JAMAIS `--no-verify`
- ❌ JAMAIS modifier `prisma/seeds/villes/copy/<slug>.ts` (Manon)
- ❌ JAMAIS modifier `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ JAMAIS créer modèle `ArticleFeedback` (P5 territory)
- ❌ JAMAIS modifier composants JSON-LD (P3 territory)
- ❌ JAMAIS modifier console admin V2 pages (P5 territory)
- ❌ JAMAIS re-générer les 4 stubs BUG-5 déjà faits

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm content-gen:isolation-check
```

### Gates obligatoires AVANT chaque push
```powershell
git pull --rebase origin main
pnpm prisma migrate diff
```

### Format commits
```
feat(content-gen): p4 sprint correctif — <description courte>

<corps>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. PHASE QUICK (P0 indépendants, ~4h)

### P0-3 — Regex `internalLinkCount` + parseBody + citationCount (~2h)
**Gain** : A4-05 actuel 34/80 → ~50/80 (+16 pts)

**NOTE** : commit `56decf0` "internalLinkCount regex markdown → HTML + markdown dual-mode" sur origin/main suggère que ce P0 est PARTIELLEMENT fait. **Vérifier d'abord** avec `git show 56decf0 --stat` ce qui a été fixé. Compléter ce qui manque :

**Spec** :
- Fichier : `src/server/content-gen/seo/compute-seo-score.ts` (ou équivalent)
- Vérifier que la regex `internalLinkCount` détecte les `<a href="...">` HTML ET les `[text](url)` Markdown
- Vérifier que `parseBody()` ne strip pas les `<a>` (utiliser un parser HTML proper, pas une regex)
- Câbler `citationCount` (nombre de sources externes) à `computeSeoScore()`
- Test : générer 1 article test avec 5 liens internes + 3 sources externes → vérifier que `internalLinkCount=5` et `citationCount=3`

### P0-4 — Mismatch slugs image hero (~1h)
**Gain** : A4-08 actuel 39/70 → ~55/70 (+16 pts)

**NOTE** : commit `8d3d886` "module mapping image-bank audit/interventions/implementations/un-a-un" suggère que ce P0 est PARTIELLEMENT fait. **Vérifier d'abord**.

**Spec** :
- Fichier : `src/server/content-gen/images/assign-hero-image.ts` (constant `VERTICAL_TO_IMAGE_MODULE`)
- Vérifier mapping cohérent :
  - `audits` → `audits` (pas `audit`)
  - `interventions_formations` → `interventions-formations`
  - `implementations` → `implementations`
  - `un_a_un` → `un-a-un`
  - `sites_web_augmentes` → `sites-web-augmentes`
- Test intégration : seeder 1 image par module via `image-bank/seed-images.ts` (READ-ONLY de mon côté, juste consulter) → générer 1 article par verticale → vérifier que `featuredImage` n'est PAS le fallback générique.

### P0-5 — AiContentDisclaimer 39 pages /implantations/[ville] (~1h)
**Gain** : A4-06 actuel 46/70 → ~58/70 (+12 pts). **Deadline AI Act art. 50 : août 2026.**

**Spec** :
- Fichier : `src/app/[locale]/implantations/[ville]/layout.tsx` (ou page.tsx si pas de layout dédié)
- Importer `<AiContentDisclaimer />` (composant existant utilisé sur `/blog/[slug]` et `/cas-concrets/[slug]`)
- Placer en bas de page (avant footer), pas en haut
- Vérifier sur les 39 villes pilote (`paris`, `lyon`, etc.) que le disclaimer apparaît
- Vérifier que la mention textuelle correspond à D4 (recommandée Option B : "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA.")

### P0-7 — Distinguer REJECT-P0 vs REJECT-qualité (~2h)
**Gain** : A4-07 actuel 56/80 → ~66/80 (+10 pts)

**Spec** :
- Fichier : `src/server/queue/workers/content-quality-improver-worker.ts` ou `src/server/content-gen/reviewer/llm-judge.ts`
- Après cap d'itérations atteint (D2 = 2 ou 3 selon décision), distinguer :
  - **REJECT-P0** : violation AI Act détectée, SIREN hardcodé, données personnelles, contenu offensant → status `quarantined_critical`, alerte immédiate Telegram + email Will
  - **REJECT-qualité** : score < threshold après improve sans P0 critique → status `needs_review`, badge orange dans review queue
- Mécanisme détection : champ `issues[]` du verdict LLM-judge contient `severity: "P0" | "P1" | "P2"`. Si `issues.some(i => i.severity === "P0")` → REJECT-P0.
- UI : afficher distinction dans `ReviewListV2.tsx` (P5 territory, mais juste lecture champ `publishStatus` — pas de modif UI)

---

## 3. PHASE PARALLÈLE (P0 plus complexes, ~8h)

### P0-2 — Boucle improve cassée — passer issues[] (~4h)
**Gain** : A4-07 +10 pts

**NOTE** : commit `0947d9e` "quality loop re-génère avec feedback LLM-judge (BUG 4)" sur origin/main SEMBLE résoudre ce P0. **Vérifier d'abord** :
```powershell
git show 0947d9e --stat
```

Si déjà fait : skip P0-2, noter dans verdict "P0-2 résolu par commit 0947d9e pré-sprint".

Sinon spec :
- Fichier : `src/server/queue/workers/content-quality-improver-worker.ts`
- Lors de la passe 2 du quality loop, passer `verdict1.issues[]` (Array<{severity, section, suggestedFix}>) dans le prompt de ré-génération
- Format prompt : "Voici les problèmes identifiés dans la version précédente : <liste issues formatée>. Corrige ces points spécifiquement."
- Test : créer 1 article avec qualité initiale 6.5 + issues → vérifier que la passe 2 produit un score > 6.5 OU des issues différentes (jamais identiques).

### P0-6 — Quarantaine fact-check + persistance claims (~4h)
**Gain** : A4-04 actuel 68/100 → ~85/100 (+17 pts)

**Spec** :
- Fichier : `src/server/content-gen/factcheck/fact-checker.ts`
- Gate dur : si `factCheckScore < 50` → article passe en `publishStatus = "quarantined_factcheck"` (pas publié, pas indexé)
- Persistance individuelle des claims : créer modèle Prisma (si pas existant) :
```prisma
model FactCheckClaim {
  id           String   @id @default(cuid())
  articleId    String
  claim        String   @db.Text // la phrase factuelle extraite
  status       String   // "verified" | "unverified" | "contradicted"
  sourceUrl    String?
  sourceTitle  String?
  confidence   Float    // 0.0 - 1.0
  createdAt    DateTime @default(now())

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId])
  @@index([status])
  @@map("factcheck_claims")
}
```
- Migration : `20260521160000_add_factcheck_claims_and_kb_sectorielle`
- RAG vectoriel Voyage AI : pour l'instant le stub SHA-256 reste, **NE PAS** câbler la vraie API Voyage AI dans ce sprint (P1 reporté). Juste documenter dans verdict que claim verification est en mode `stub`.

---

## 4. PHASE COMPLET (P1 prioritaires, ~8h)

### P1-2 — Instruction keyword DOIT apparaître en H1 (~45 min)
**Gain** : A4-03 actuel 47/80 → ~55/80 (+8 pts)

**Spec** :
- Fichiers : `src/server/content-gen/generators/blog-from-keywords.ts`, `landing-ville-generator.ts`, `blog-pillar.ts`, `blog-article.ts`, `blog-from-title.ts`
- Dans le SYSTEM_PROMPT, ajouter : "Le keyword principal `{keyword}` DOIT apparaître textuellement dans le H1 (titre principal). Sans cela, l'article sera rejeté."
- Validation post-LLM dans `validateKeywordInTitle()` (déjà existant `src/server/content-gen/keyword-selector.ts`) : appliquer le check au H1 extrait du markdown généré
- Si keyword absent du H1 : status `needs_review` + log warning

### P1-3 — Valider keyword dans `metaTitle` (~2h)
**Gain** : +5 pts

**Spec** :
- Vérifier dans le worker `content-publish-worker.ts` que `article.metaTitle` contient le keyword principal
- Si non : log warning + flag `seoTitleNotOptimized` dans article
- Optionnel : auto-correction (préfix keyword au metaTitle si absent)

### P1-5 — Brand voice SSOT centralisé (~4h)
**Gain** : A4-06 +12 pts

**Spec** :
- Créer `src/server/content-gen/brand/brand-voice.ts` :
```typescript
export const BRAND_VOICE_AXION_IA = {
  persona: "Manon, experte IA chez Axion-IA, ton accessible mais rigoureux",
  tone: {
    formal_level: "tutoiement professionnel français",
    use_we: true,
    avoid: ["expressions familières", "jargon non expliqué", "superlatifs marketing creux"],
    favor: ["exemples concrets FR", "chiffres sourcés", "questions rhétoriques courtes"],
  },
  vocabulary: {
    canonical: {
      "AI": "IA",
      "ML": "Machine Learning (ML)",
      "RAG": "Retrieval-Augmented Generation (RAG)",
    },
    forbidden: ["révolutionner", "disruptif", "next-gen", "game-changer"],
  },
  signature: "L'équipe Axion-IA",
};

export function injectBrandVoice(systemPrompt: string): string {
  return `${systemPrompt}\n\n## CONTRAINTES BRAND VOICE\n${formatBrandVoice(BRAND_VOICE_AXION_IA)}`;
}
```
- Injecter dans les 7 generators via `injectBrandVoice(SYSTEM_PROMPT)`

### P1-6 — Unifier persona auteur (D3 = Manon) (~2h)
**Gain** : +4 pts

**Spec** :
- Remplacer "expert contenu Axion-IA" anonyme par "Manon, experte IA chez Axion-IA" dans tous les system prompts blog
- Cohérence avec JSON-LD `Person` schema déjà déployé pour Manon
- Vérifier le composant `<AuthorByline />` (P3 territory créera l'instanciation)

### P1-7 — Glossaire 60 termes dans prompts (~3h)
**Gain** : A4-06 +5 pts

**Spec** :
- Fichier source : `src/data/glossary.ts` (60 termes IA en français)
- Créer helper `getGlossaryContext(keywords: string[]): string` qui retourne les définitions des termes glossaire matchant les keywords article
- Injecter dans system prompt : "Vocabulaire de référence : <définitions>". Permet expansion acronymes LLM/RAG/NLP dans le contenu généré.

### P1-11 — Fix hreflang layout (~1h)
**Gain** : A4-09 +3 pts

**Spec** :
- Fichier : `src/app/[locale]/layout.tsx`
- Actuellement déclare toujours `hreflang="en"` même si locale EN désactivée
- Conditionner : `if (ENABLED_LOCALES.includes("en")) <link rel="alternate" hrefLang="en" ... />`
- Variable `ENABLED_LOCALES` dans `src/i18n/config.ts` ou équivalent

### P1-12 — Catalogue URL pages → injection liens internes (~8h)
**Gain** : A4-05 +12 pts

**Spec** :
- Créer `src/server/content-gen/links/internal-link-catalog.ts`
- Fonction `buildInternalLinkCatalog()` : scanne le filesystem `src/app/**/page.tsx` + DB `Article.publishStatus = "published"`
- Retourne une `Map<topic, URL[]>` indexée par mots-clés/topics
- Lors de la génération d'un article, après LLM, post-process pour injecter 3-5 liens internes contextuels :
  - Identifier 3-5 phrases sans liens contenant des topics du catalogue
  - Remplacer le mot-clé par `<a href="/path">mot-clé</a>`
  - Limiter 1 lien par phrase, pas plus de 5 par article
- Test : article landing-ville Paris audits → doit avoir liens vers /audits, /interventions, /paris, /codage-developpement, etc.

---

## 5. KB SECTORIELLE 5 VERTICALES (P1 long, ~8h optionnel — peut être reporté Sprint suivant)

### Spec
- Verticales : `interventions_formations`, `un_a_un`, `audits`, `implementations`, `sites_web_augmentes`
- Pour chaque verticale, créer `src/data/kb/<verticale>.ts` avec :
  - 50-100 facts vérifiés sourcés (INSEE, DARES, BPI France, etc.)
  - Format : `{ id, text, source, sourceUrl, verifiedAt, verticales[], cities?[], confidence }`
- Charger via `prisma.kbFact.upsert()` dans `prisma/seeds/content-gen/seed-kb-facts.ts`
- Indexer dans FTS Postgres (déjà en place)
- **Si effort > 4h restant** : reporter ce P1 au sprint suivant, créer juste 1 verticale pilote (`audits`) pour démontrer le pattern.

---

## 6. P2 RÉSIDUELS (à reporter — NE PAS faire dans ce sprint)

- A4-01 : Factoriser SYSTEM_PROMPT commun (DRY) — Sprint S+7
- A4-02 : Détection voix passive FR (compromise) — Sprint S+7
- A4-02 : Variation longueur phrases — Sprint S+7
- A4-04 : Voyage AI vraie clé API (RAG) — Sprint S+7 quand DPA signé
- A4-04 : Vérification 404 URLs Perplexity — Sprint S+7
- A4-05 : Composant "Articles suggérés" frontend — P3 territory ou P5
- A4-07 : Reviewer séparé avec contexte minimal — Sprint S+7
- A4-08 : alt EN automatique + figcaption — Sprint S+7
- A4-09 : Worker traduction EN — Sprint S+7 quand `KB_LOCALE=fr_en`
- A4-09 : 747 keyword seeds EN — Sprint S+7
- A4-10 : Active learning Will feedback (boucle reviewNotes) — Sprint S+7
- A4-10 : Détection dérive brand voice (embeddings) — Sprint S+7

---

## 7. ZONES INTERDITES (convergence Manon + P3 + P5)

- ❌ `prisma/seeds/villes/copy/<slug>.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ `src/components/seo/*.tsx` (P3)
- ❌ `src/lib/seo.ts` (P3 — sauf P0-5 qui touche `buildArticleJsonLd` SI nécessaire pour AiContentDisclaimer logic)
- ❌ `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` (P5)
- ❌ `src/components/admin/content-gen/**` (P5)
- ❌ Modèle Prisma `ArticleFeedback` (P5)
- ❌ Modèle Prisma `CampaignTemplate` (P5)
- ❌ Re-générer les 4 stubs BUG-5

---

## 8. LIVRAISON FINALE

### Verdict final à créer
`_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/VERDICT-SPRINT-P4-CORRECTIONS.md`

Format :
```markdown
# VERDICT SPRINT P4 CORRECTIONS — Qualité éditoriale
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA court>
## Score avant → après : 547/1000 → XXX/1000 (+XXX pts)

## Décisions Will validées (D1-D4)
- D1 seuil REJECT : X.X
- D2 itérations : ...
- D3 persona : ...
- D4 wording mention : ...
- D5 reporting : (déjà tranché D-P5-3)

## Items livrés
| Item | Statut | Commit | Gain pts |
|------|--------|--------|----------|
| P0-2 | ✅/⏭️ (pré-fait par X) | ... | ... |
| P0-3 | ✅ | ... | ... |
| ...

## Items skipped
- KB sectorielle 5 verticales : reporté Sprint S+7 (effort)

## Migrations Prisma
- `20260521160000_add_factcheck_claims_and_kb_sectorielle` (si KB pilote livré)

## Gates anti-régression
- typecheck ✅
- lint ✅
- vitest XXXX/XXXX ✅
- isolation-check ✅

## Score détaillé par agent
| Agent | Avant | Après | Delta |
|-------|-------|-------|-------|
| A4-01 Templates 7 types | 52/120 | 52/120 | 0 (BUG-5 hors scope) |
| A4-02 Qualité textuelle | 49/100 | XX/100 | +XX |
| A4-03 Keyword titre | 47/80 | XX/80 | +XX |
| A4-04 KB & fact-check | 68/100 | XX/100 | +XX |
| A4-05 Liens | 34/80 | XX/80 | +XX |
| A4-06 Brand voice | 46/70 | XX/70 | +XX |
| A4-07 LLM-judge calibration | 56/80 | XX/80 | +XX |
| A4-08 Image hero | 39/70 | XX/70 | +XX |
| A4-09 Bilingue | 34/70 | XX/70 | +XX |
| A4-10 Feedback loop | 13/30 | XX/30 | +XX |

## Actions Will post-sprint
1. ...

## UNKNOWNs résiduels
- ...
```

### Mémoire à créer
Slug : `axionia_sprint_p4_corrections_livre_2026-05-21`
Type : project

### MEMORY.md à mettre à jour
```
- [🟢 AxionIA Sprint P4 corrections LIVRÉ 2026-05-21 — score 547→~775/1000](axionia_sprint_p4_corrections_livre_2026-05-21.md) — Qualité éditoriale : brand voice SSOT + glossaire 60 termes + AiContentDisclaimer 39 villes + quarantaine fact-check + REJECT distingués + KB pilote audits.
```

---

## 9. STOP & ASK FINAL (à Will)

```
✅ Sprint P4 corrections livré.
- HEAD : <sha>
- Score 547 → XXX/1000 (+XXX pts)
- X commits pushés
- 1-2 migrations Prisma
- Gates ✅

📋 Décisions Will validées : D1=X, D2=X, D3=X, D4=X

⚠️ Items reportés : KB sectorielle 5 verticales (Sprint S+7), P2 polish, RAG Voyage AI réel.

🚀 Suite proposée :
[A] Lancer Sprint P3 corrections (10 QW SEO + Wikidata, ~8h) si pas déjà lancé
[B] Lancer Sprint P5 corrections (console admin, ~16h) si pas déjà lancé
[C] Lancer P6 roadmap chiffrée + verdict global /5000
[D] Validation prod 48h
```

---

## 10. PHRASE DE LANCEMENT

```
Lance le sprint correctif décrit dans `_AUDIT/PROMPT-SPRINT-P4-CORRECTIONS-2026-05-21.md`. Mode IMPLEMENTATION. Décisions Will D1-D5 DÉJÀ VALIDÉES dans le prompt (D1=6.0/60, D2=3 itérations pilier+landing/2 autres, D3=Manon, D4=transparence max Claude Sonnet 4.6, D5=email lundi 8h via Sprint P5) — NE PAS re-demander. Vérifie d'abord ce qui est déjà fait sur origin/main (commits 56decf0, 8d3d886, 0947d9e). Puis : Phase QUICK 4h → Phase PARALLÈLE 8h → Phase COMPLET 8h. Commits incrémentaux avec push. Convergence Manon (git pull --rebase). Gates verts obligatoires. KB sectorielle : juste pilote `audits` (reste reporté). Termine par VERDICT-SPRINT-P4-CORRECTIONS.md + mémoire + STOP & ASK Will. Go.
```

---

*Sprint correctif P4 — 16-20h autopilot — Cible 547 → 775/1000*
