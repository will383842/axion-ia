# PROMPT AUTOPILOT — Content-Gen AEO/GEO Perfection 2026 V2.1

**Mode** : 🔥 AUTOPILOT TOTAL FIRE-AND-FORGET
**Scope** : Pipeline complet content-gen Axion-IA (9 générateurs, wizard, JSON-LD, crawlers IA, équité villes)
**Objectif** : Score 1000/1000 sur la grille AEO/GEO 2026 — être LA source citée par Google AI Overview, ChatGPT, Perplexity, Claude, Bing Copilot
**Durée** : 10-14 h autopilot (peut tourner sur plusieurs sessions si interruption)
**Budget LLM coût** : aucun appel LLM dans ce sprint (uniquement code)

---

## 🚨 PROTOCOLE D'EXÉCUTION — LIRE EN PREMIER

### Règle d'or absolue
**NE JAMAIS POSER DE QUESTION À WILL.** Toutes les décisions sont déjà prises dans ce document. Si une ambiguïté apparaît, suivre cet ordre de résolution :

1. **Chercher le pattern existant** dans le code (`grep -rn "<feature>" src/`)
2. **Reprendre la convention dominante** (style, naming, structure)
3. **Choisir l'option la plus simple qui passe les gates**
4. **Documenter le choix dans le verdict final** (pas en ASK)

### Quand s'arrêter (HARD STOP uniquement)
- 🛑 Migration Prisma conflictuelle avec une PR Manon en parallèle → push impossible
- 🛑 Build TypeScript échoue après 3 tentatives de fix
- 🛑 Vitest échoue avec > 10 tests cassés (= cassure structurelle)
- 🛑 Pre-push hook échoue 3 fois de suite sur le même commit

Tout autre obstacle → résoudre seul + continuer.

### Gestion stash multi-conversations (CRITIQUE)
D'autres sessions Claude/Manon tournent en parallèle. Avant CHAQUE commit :

```bash
# 1. Vérifier ce qui appartient au sprint vs autres conv
git status --short

# 2. Lister les fichiers à reverter (NON-P4-V2)
git diff --name-only HEAD | grep -vE "(content-gen|seo-content-gen-factories|wizard|equity|keyword-catalog|brand-voice|audience-voice|source-injection|llms.txt|ai.txt|UnsplashCredit|jsonld-coverage)"

# 3. Si conflits stash apparaissent → git checkout HEAD -- <file> sur les fichiers d'autres conv AVANT staging

# 4. Stager UNIQUEMENT les fichiers du sprint actuel
git add <files-explicites-uniquement>

# 5. Si pre-commit revert : récupérer le stash le plus récent via reflog
git stash list  # cherche "On main: lint-staged auto..."
```

### Progress tracking obligatoire
**AU DÉMARRAGE**, créer un TaskCreate avec les 10 phases en tâches. Updater au fur et à mesure (in_progress → completed).

### Resume capability (si interrompu)
Si la session redémarre à mi-parcours :

```bash
# 1. Lire le verdict draft pour savoir où on en est
cat _AUDIT/VERDICT-CONTENT-GEN-AEO-GEO-PERFECTION-2026-V2.md 2>/dev/null

# 2. Lister les commits de ce sprint
git log --oneline main --grep="aeo-geo\|content-gen-v2" -20

# 3. Reprendre à la phase non commitée suivante
```

---

## 📂 CONTEXTE — État du système au lancement (2026-05-22)

### Déjà livré (commit `5d8e8b6f`)
- ✅ Wizard 5 étapes (vertical → géo → cibles → keywords → revue)
- ✅ 5 personas éditoriales (Manon × 3 + éditorial neutre + expert analytique)
- ✅ Comparison sans tableaux (hard gate inversé)
- ✅ UnsplashCredit composant + crédit sur page blog
- ✅ FAQ date visible (BUILD_DATE)
- ✅ keyword-catalog.ts par verticale (55 kws × 5 verticales)
- ✅ city-equity.ts server action
- ✅ blog/loader.ts : photographerName/photographerUrl

### À livrer (ce sprint)
- ⏳ Câblage keywords wizard → ContentGenJob (P0 URGENT)
- ⏳ HowTo JSON-LD sur guide_pilier
- ⏳ Citations sources DANS le body (≥ 2 par article)
- ⏳ Audience-specific prompts (TPE/PME/ETI/GE — vrai angle différent)
- ⏳ Keywords par vertical × content_type (catalog enrichi)
- ⏳ Llms.txt + ai.txt + llms-full.txt
- ⏳ AggregateRating JSON-LD (si témoignages DB existent)
- ⏳ Quota automatique par ville + bouton wizard
- ⏳ UnsplashCredit sur guides
- ⏳ Audit cross-cutting matrice JSON-LD × contentType

---

## 🛡️ RÈGLES ABSOLUES IMMUABLES

```
❌ JAMAIS inventer de données (sources, prix, statistiques)
❌ JAMAIS de mock dans le code de prod (mocks uniquement Vitest)
❌ JAMAIS générer d'images via DALL-E (règle projet — toutes images importées par Will)
❌ JAMAIS skip les hooks pre-commit/pre-push (--no-verify interdit)
❌ JAMAIS toucher la magic string "stub.invalid" (ADR 0026)
❌ JAMAIS modifier MEMORY.md de mémoire — toujours Read d'abord
❌ JAMAIS commit avec git add -A (toujours staging explicite par fichier)

✅ Convergence : git pull --rebase origin main AVANT chaque commit
✅ Gates verts obligatoires AVANT push : typecheck 0, vitest ≥ 1376/1383, lint 0
✅ Commits incrémentaux push après chaque phase (1 phase = 1 commit = 1 push)
✅ Sous-agents Explore pour recherches > 3 fichiers
✅ Parallel tool calls quand indépendants (multiple tools dans 1 message)
```

---

## 🔍 PRE-FLIGHT MANDATORY — Exécuter avant Phase 1

```bash
# Section A : git sync
git status
git pull --rebase origin main
git log --oneline -5

# Section B : inventaire JSON-LD existants
grep -rn "JsonLd\|application/ld+json" src/lib/seo-content-gen-factories.ts src/lib/seo.ts | head -30

# Section C : inventaire generators
ls src/server/content-gen/generators/

# Section D : inventaire JSON-LD factories
grep -n "^export function build" src/lib/seo-content-gen-factories.ts

# Section E : llms.txt déjà ?
ls src/app/llms.txt 2>/dev/null || echo "absent"
ls src/app/ai.txt 2>/dev/null || echo "absent"

# Section F : Review/Testimonial table existe ?
grep -E "^model (Review|Testimonial|CustomerReview)" prisma/schema.prisma

# Section G : Article.featuredImage + ImageAsset photographer fields
grep -n "photographerName\|photographerUrl" prisma/schema.prisma | head -5
```

**Logger les résultats dans `_AUDIT/PREFLIGHT-AEO-GEO-V2.md`** pour traçabilité.

---

# 🚀 PHASES — Exécution dans l'ordre strict

---

## PHASE 1 — Câblage keywords wizard → ContentGenJob 🔴 P0 (2h)

**Pourquoi prioritaire** : Sans ça, les keywords du wizard sont **perdus** (le wizard envoie `primaryKeywords` dans FormData mais `createCampaign()` ne le lit pas → aucun job créé avec le keyword spécifique).

### Dépendances
Aucune (phase indépendante)

### Skip-if
Cette phase n'est PAS skippable — c'est le P0.

### Fichiers à toucher
- `prisma/schema.prisma` (champ `primaryKeywords String[]` sur CoverageCampaign)
- `prisma/migrations/YYYYMMDDHHMMSS_add_coverage_campaign_primary_keywords/migration.sql`
- `src/server/actions/content-gen/coverage.ts` (lire formData → DB)
- `src/server/queue/workers/coverage-orchestrator-worker.ts` (distribuer par keyword × ville)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new/_v2/CoverageNewV2.tsx` (passer le champ)
- Tests : `src/__tests__/server/queue/workers/coverage-orchestrator-worker.spec.ts`

### Implémentation

#### 1.1 Migration Prisma

Nom timestamp : utilise `date +%Y%m%d%H%M%S` ou un nom comme `20260522120000_add_coverage_campaign_primary_keywords`.

```sql
-- migration.sql
ALTER TABLE "coverage_campaigns"
  ADD COLUMN "primary_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
```

Dans schema.prisma sur `CoverageCampaign` :
```prisma
primaryKeywords          String[]       @default([]) @map("primary_keywords")
```

#### 1.2 Type CreateCampaignInput

Dans `src/server/actions/content-gen/coverage.ts`, ajouter `primaryKeywords?: ReadonlyArray<string>` au type d'input + au call Prisma `.create()`.

#### 1.3 Worker orchestrator

Logique à implémenter :
```typescript
// Pseudo
const keywords = campaign.primaryKeywords;
const villes = campaign.anchorVilleSlugs;
const types = Object.entries(campaign.typeDistribution as Record<string, number>);

// Pour chaque type avec sa proportion, créer N jobs
for (const [contentType, pct] of types) {
  const jobCount = Math.round((campaign.totalTargetCount * pct) / 100);
  for (let i = 0; i < jobCount; i++) {
    const keyword = keywords[i % keywords.length] ?? null;
    const villeSlug = villes[i % Math.max(1, villes.length)] ?? null;
    await prisma.contentGenJob.create({
      data: {
        campaignId: campaign.id,
        contentType: contentType as ContentType,
        inputPayload: { primaryKeyword: keyword },
        anchorVilleSlug: villeSlug,
        // ... reste des champs
      },
    });
  }
}
```

#### 1.4 CoverageNewV2.tsx — lire formData

Dans la server action `create(formData)` :
```typescript
const primaryKeywords = String(formData.get("primaryKeywords") ?? "")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);
```

Passer à `createCampaign({ ..., primaryKeywords })`.

### Acceptance tests (exécuter avant commit)

```bash
# 1. Migration appliquée
pnpm prisma migrate dev --name add_coverage_campaign_primary_keywords

# 2. Typecheck
pnpm tsc --noEmit

# 3. Vitest unitaire
pnpm vitest run coverage-orchestrator-worker

# 4. Lint
pnpm lint
```

### Commit
```
feat(content-gen): câblage keywords wizard → ContentGenJob (Phase 1 AEO/GEO v2)
- CoverageCampaign.primaryKeywords (String[] @default([]))
- Migration additive 20260522120000
- coverage-orchestrator-worker distribue 1 job par (keyword × ville × type)
- CoverageNewV2 lit formData.primaryKeywords (newline-separated)
```

---

## PHASE 2 — HowTo JSON-LD sur guide_pilier 🔴 P0 (1h30)

**Pourquoi** : Google cite massivement les pages HowTo schema en AI Overview pour les requêtes "comment".

### Dépendances
Aucune

### Skip-if
Le generator `guide_pilier` n'existe pas (vérifier `ls src/server/content-gen/generators/guide-pilier.ts`)

### Fichiers à toucher
- `src/lib/seo-content-gen-factories.ts` (ajouter `buildHowToJsonLd`)
- `src/server/content-gen/generators/guide-pilier.ts` (détection + émission)
- `src/server/content-gen/generators/types.ts` (`howToJsonLd?: Record<string,unknown>` sur GeneratorOutput)
- `src/app/[locale]/guides/[slug]/page.tsx` (rendre le `<script type="application/ld+json">` si présent)
- Tests : `src/__tests__/lib/seo-content-gen-factories.spec.ts`

### Implémentation

#### 2.1 Factory buildHowToJsonLd

À ajouter dans `src/lib/seo-content-gen-factories.ts` :

```typescript
export interface HowToJsonLdInput {
  readonly name: string;
  readonly description: string;
  readonly url?: string;
  readonly totalTime?: string; // ISO 8601 "PT30M"
  readonly steps: ReadonlyArray<{
    readonly name: string;
    readonly text: string;
    readonly url?: string;
  }>;
}

export function buildHowToJsonLd(input: HowToJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    ...(input.url ? { url: input.url } : {}),
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
    })),
  };
}
```

#### 2.2 Détection HowTo dans guide-pilier.ts

```typescript
function isHowToContent(primaryKeyword: string | undefined, bodyHtml: string): boolean {
  const kw = (primaryKeyword ?? "").toLowerCase();
  if (/\b(comment|méthode|étapes?|guide pour|tutoriel|tuto)\b/i.test(kw)) return true;
  // Détection structurelle : ≥ 3 sections H2 numérotées (1., 2., 3. ou Étape 1, Étape 2...)
  const h2matches = bodyHtml.match(/<h2[^>]*>([^<]+)<\/h2>/gi) ?? [];
  const numbered = h2matches.filter((h) =>
    /(^|\s)(\d+[.)]|étape\s+\d+|step\s+\d+)/i.test(h),
  );
  return numbered.length >= 3;
}

function extractHowToSteps(bodyHtml: string): ReadonlyArray<{ name: string; text: string }> {
  const sections: Array<{ name: string; text: string }> = [];
  const regex = /<h2[^>]*>([\s\S]+?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  let m;
  while ((m = regex.exec(bodyHtml)) !== null) {
    const name = m[1].replace(/<[^>]+>/g, "").trim();
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
    if (name && text) sections.push({ name, text });
  }
  return sections;
}
```

Dans le generator, après assembly :
```typescript
let howToJsonLd: Record<string, unknown> | undefined;
if (isHowToContent(input.primaryKeyword, enrichedBody)) {
  const steps = extractHowToSteps(enrichedBody);
  if (steps.length >= 2) {
    howToJsonLd = buildHowToJsonLd({
      name: parsed.title,
      description: parsed.metaDescription,
      steps,
    });
  }
}

return {
  // ... champs existants
  ...(howToJsonLd ? { howToJsonLd } : {}),
};
```

#### 2.3 GeneratorOutput

Ajouter dans `src/server/content-gen/generators/types.ts` :
```typescript
readonly howToJsonLd?: Record<string, unknown>;
```

#### 2.4 Page guides

Lire la guide depuis DB (KnowledgeEntry probablement), si `howToJsonLd` présent → `<JsonLd data={howToJsonLd} />`.

### Acceptance tests
- [ ] Schema.org validator passe : https://validator.schema.org/
- [ ] Vitest : `buildHowToJsonLd` test unit
- [ ] grep : `grep -rn "buildHowToJsonLd" src/server/content-gen/`

### Commit
```
feat(content-gen): HowTo JSON-LD sur guide_pilier (Phase 2 AEO/GEO v2)
- buildHowToJsonLd factory
- Détection automatique HowTo (keyword "comment/étape/méthode" OU ≥3 H2 numérotées)
- Extraction steps depuis bodyHtml
- Émission JSON-LD côté guides page
```

---

## PHASE 3 — Citations sources DANS le body 🔴 P0 (2h)

**Pourquoi** : Les IA citent les contenus qui citent eux-mêmes des sources crédibles (INSEE, BPI France, AI Act, CNIL, ANSSI, ISO 42001).

### Fichiers à toucher
- `src/server/content-gen/quality/source-injection.ts` (NOUVEAU)
- `src/server/content-gen/generators/blog-article.ts`
- `src/server/content-gen/generators/blog-from-keywords.ts`
- `src/server/content-gen/generators/blog-from-title.ts`
- `src/server/content-gen/generators/blog-from-rss.ts`
- `src/server/content-gen/generators/guide-pilier.ts`
- `src/server/content-gen/generators/comparison.ts`
- `src/server/content-gen/generators/faq-standalone.ts`
- `src/server/content-gen/generators/qa-derived.ts`
- `src/server/content-gen/generators/landing-ville.ts`
- Tests : `src/__tests__/server/content-gen/quality/source-injection.spec.ts`

### Implémentation

#### 3.1 Module source-injection.ts

```typescript
export interface CanonicalSource {
  readonly key: string;
  readonly organization: string;
  readonly url: string;
  readonly contextHint: string; // pour aider le LLM à savoir quand citer
}

export const CANONICAL_SOURCES: ReadonlyArray<CanonicalSource> = [
  { key: "INSEE", organization: "INSEE", url: "https://www.insee.fr", contextHint: "statistiques entreprises France" },
  { key: "BPI", organization: "BPI France", url: "https://www.bpifrance.fr", contextHint: "financement innovation PME" },
  { key: "CNIL", organization: "CNIL", url: "https://www.cnil.fr", contextHint: "données personnelles RGPD" },
  { key: "AI_ACT", organization: "Règlement européen IA", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", contextHint: "conformité AI Act" },
  { key: "ANSSI", organization: "ANSSI", url: "https://www.ssi.gouv.fr", contextHint: "cybersécurité systèmes IA" },
  { key: "ISO_42001", organization: "ISO/IEC 42001", url: "https://www.iso.org/standard/81230.html", contextHint: "norme gouvernance IA" },
  { key: "DARES", organization: "DARES", url: "https://dares.travail-emploi.gouv.fr", contextHint: "emploi et compétences" },
  { key: "FRANCE_NUM", organization: "France Num", url: "https://www.francenum.gouv.fr", contextHint: "transformation numérique TPE/PME" },
];

export function countCanonicalSourcesInBody(bodyHtml: string): number {
  let count = 0;
  for (const src of CANONICAL_SOURCES) {
    // Match texte ou lien
    if (bodyHtml.includes(src.organization) || bodyHtml.includes(src.url)) count++;
  }
  return count;
}

export function buildSourceInjectionPromptSection(): string {
  return `\n## SOURCES À CITER (OBLIGATOIRE — minimum 2)\nIntègre AU MOINS 2 liens externes vers des sources canoniques dans le bodyHtml, sous forme :\n<a href="https://www.insee.fr" rel="noopener noreferrer">INSEE</a>\n\nSources préférées :\n${CANONICAL_SOURCES.map((s) => `- ${s.organization} (${s.url}) — ${s.contextHint}`).join("\n")}\n\nFormat : prose naturelle, pas de liste de sources en bas de page. Exemple : "Selon l'<a href='https://www.insee.fr'>INSEE</a>, 78 % des PME françaises..."`;
}

const MIN_CITATIONS = 2;
export { MIN_CITATIONS };
```

#### 3.2 Update SYSTEM_PROMPT chaque generator

Pattern à appliquer aux 9 generators : ajouter dans le prompt
```typescript
import { buildSourceInjectionPromptSection } from "../quality/source-injection";

const SYSTEM_PROMPT = `...prompt existant...

${buildSourceInjectionPromptSection()}

${getBrandVoiceForContentType("blog_from_keywords")}`;
```

#### 3.3 Quality gate dans quality loop

Pattern à appliquer aux 9 generators dans leur boucle qualité :
```typescript
import { countCanonicalSourcesInBody, MIN_CITATIONS } from "../quality/source-injection";

// ... dans la while loop, après le parse + checks existants
const citationCount = countCanonicalSourcesInBody(parsed.bodyHtml ?? "");
if (citationCount < MIN_CITATIONS) {
  prevFeedback = `Insuffisant : ${citationCount}/${MIN_CITATIONS} sources canoniques citées. Ajoute des liens vers INSEE, BPI France, CNIL, AI Act, ANSSI ou ISO 42001 dans le body.`;
  if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;
  continue;
}
```

### Acceptance tests
- [ ] Vitest couvre `countCanonicalSourcesInBody`
- [ ] grep : `grep -rn "countCanonicalSourcesInBody" src/server/content-gen/generators/ | wc -l` ≥ 9

### Commit
```
feat(content-gen): citations sources canoniques DANS body (Phase 3 AEO/GEO v2)
- source-injection.ts : 8 sources canoniques (INSEE, BPI, CNIL, AI Act, ANSSI, ISO 42001, DARES, France Num)
- buildSourceInjectionPromptSection injecté dans 9 generators
- Quality gate : rejet si < 2 sources citées dans bodyHtml
```

---

## PHASE 4 — Audience-specific prompts TPE/PME/ETI/GE 🟠 P1 (1h30)

### Fichiers
- `src/server/content-gen/brand/audience-voice.ts` (NOUVEAU)
- 9 generators (injection `audienceContext` dans userPrompt)

### Implémentation

```typescript
// src/server/content-gen/brand/audience-voice.ts
export const AUDIENCE_CONTEXTS: Record<string, string> = {
  TPE: `## CONTEXTE AUDIENCE — TPE (< 10 salariés)
- Budget IA limité : quelques centaines d'euros par mois maximum.
- PAS de DSI ni d'équipe IT — le dirigeant fait tout lui-même.
- Solutions clés en main, no-code, immédiatement utilisables.
- Vocabulaire : éviter le jargon, expliquer chaque acronyme à la première occurrence.
- Exemples concrets : artisan, commerçant, profession libérale, micro-entrepreneur.
- ROI attendu : semaines, pas mois.
- Sources préférées : France Num, BPI France.`,

  PME: `## CONTEXTE AUDIENCE — PME (10 à 250 salariés)
- Équipe IT existante mais petite (1-3 personnes), pas toujours de RSSI dédié.
- ROI à justifier au CODIR ou comité de direction.
- Enjeu principal : productivité + automatisation de tâches répétitives.
- Conformité RGPD bien comprise, AI Act émergent.
- Vocabulaire : technique modéré, acronymes connus (ERP, CRM, SaaS, API).
- Exemples concrets : industrie, services BtoB, distribution, SaaS, agence.
- ROI : 6-12 mois acceptable, documenté.
- Sources préférées : INSEE, BPI France, France Num, DARES.`,

  ETI: `## CONTEXTE AUDIENCE — ETI (250 à 5 000 salariés)
- DSI + RSSI + équipe data structurée.
- Gouvernance IA : compliance, audit, traçabilité, AI Act obligatoire.
- Intégration au SI existant (legacy + cloud hybride).
- Validation juridique systématique avant déploiement.
- Vocabulaire : technique avancé OK, normes (ISO 27001, ISO 42001, NIST AI RMF).
- Exemples concrets : multi-sites, multi-filiales, secteurs régulés (santé, finance, énergie, défense).
- ROI : 12-24 mois acceptable, KPIs documentés.
- Sources préférées : AI Act, CNIL, ANSSI, ISO 42001.`,

  GRANDE_ENTREPRISE: `## CONTEXTE AUDIENCE — GRANDE ENTREPRISE (> 5 000 salariés)
- Gouvernance complexe : multiples directions (juridique, conformité, RH, IT, achats).
- Réglementaire majeur : AI Act, RGPD, sectoriels (DORA pour finance, NIS2 pour cyber, MiCA).
- Procurement long : RFP, due diligence, validation board.
- Vocabulaire : très technique, normes internationales (ISO/IEC 42001, NIST AI RMF, CSA STAR).
- ROI : 24-36 mois, KPIs stratégiques (réduction OPEX, time-to-market, conformité).
- Sources préférées : AI Act, ANSSI, ISO 42001, CNIL, normes sectorielles.`,
};

export function getAudienceContext(audienceSize: string | null | undefined): string {
  if (!audienceSize) return "";
  return AUDIENCE_CONTEXTS[audienceSize] ?? "";
}
```

### Injection dans chaque generator (9 fichiers)

Pattern :
```typescript
import { getAudienceContext } from "../brand/audience-voice";

// Dans le builder du userPrompt :
const audienceContext = getAudienceContext(input.targetAudienceSize);

const userPrompt = `...
${audienceContext}
...`;
```

### Acceptance
- [ ] grep : `grep -rn "getAudienceContext" src/server/content-gen/generators/ | wc -l` ≥ 9

### Commit
```
feat(content-gen): audience-specific prompts TPE/PME/ETI/GE (Phase 4 AEO/GEO v2)
- audience-voice.ts : 4 contextes éditoriaux (budget, organisation, ROI, vocabulaire, sources)
- 9 generators injectent getAudienceContext(input.targetAudienceSize)
- Différenciation réelle : TPE no-code vs ETI conformité ISO 42001
```

---

## PHASE 5 — Keywords par vertical × content_type 🟠 P1 (1h30)

### Fichier
- `src/server/content-gen/keywords/keyword-catalog.ts` (REFACTOR)
- `src/components/admin/content-gen/CoverageWizardClient.tsx` (utilise nouveau helper)

### Implémentation

Étendre l'export existant SANS casser la rétrocompat :

```typescript
type ContentTypeKey =
  | "blog_article"
  | "blog_from_keywords"
  | "blog_from_title"
  | "blog_from_rss"
  | "guide_pilier"
  | "faq_standalone"
  | "qa_derived"
  | "landing_ville"
  | "comparison";

export const KEYWORD_CATALOG_V2: Record<
  VerticalSlug,
  Partial<Record<ContentTypeKey, ReadonlyArray<string>>>
> = {
  audits: {
    blog_from_keywords: [
      "comment auditer son IA en 2026",
      "audit IA PME bonnes pratiques",
      "audit conformité AI Act",
      "diagnostic IA gratuit PME",
      "indicateurs maturité IA entreprise",
    ],
    guide_pilier: [
      "guide complet audit IA PME 2026",
      "méthodologie audit IA entreprise étapes",
      "audit IA gouvernance données",
      "audit IA bilan annuel TPE PME",
    ],
    qa_derived: [
      "qu'est-ce qu'un audit IA",
      "combien coûte un audit IA",
      "pourquoi auditer son IA",
      "quand faire un audit IA",
      "qui peut faire un audit IA",
      "quels livrables audit IA",
    ],
    faq_standalone: [
      "FAQ audit IA PME française",
      "questions fréquentes audit conformité IA",
    ],
    landing_ville: [
      "cabinet audit IA",
      "audit IA local PME",
      "expert audit IA proximité",
    ],
    comparison: [
      "audit IA vs diagnostic IA",
      "audit interne vs cabinet externe IA",
      "meilleur cabinet audit IA PME",
    ],
  },
  interventions_formations: {
    blog_from_keywords: [
      "formation IA dirigeants PME",
      "formation IA collaborateurs",
      "ROI formation IA entreprise",
      "tendances formation IA 2026",
      "compétences IA recherchées",
    ],
    guide_pilier: [
      "guide formation IA entreprise 2026",
      "comment former ses équipes à l'IA",
      "plan de formation IA PME",
      "intégrer l'IA dans son organisation",
    ],
    qa_derived: [
      "comment former ses équipes à l'IA",
      "combien coûte une formation IA",
      "quelle formation IA pour TPE",
      "formation IA finançable OPCO",
    ],
    faq_standalone: ["FAQ formation IA entreprise"],
    landing_ville: [
      "formation IA",
      "formateur IA PME",
      "atelier IA pratique",
    ],
    comparison: [
      "formation IA en ligne vs présentiel",
      "formation IA OPCO vs autofinancée",
    ],
  },
  implementations: {
    blog_from_keywords: [
      "implémentation IA PME étapes",
      "déploiement chatbot entreprise",
      "automatisation IA processus métier",
      "intégration LLM système information",
      "RAG entreprise architecture",
    ],
    guide_pilier: [
      "guide implémentation IA TPE PME 2026",
      "comment déployer un agent IA en entreprise",
      "méthodologie projet IA clé en main",
      "intégrer un LLM à son SI",
    ],
    qa_derived: [
      "combien coûte un projet IA",
      "combien de temps pour déployer une IA",
      "quels prérequis pour un projet IA",
      "comment choisir une solution IA",
    ],
    faq_standalone: ["FAQ implémentation IA entreprise"],
    landing_ville: [
      "implémentation IA",
      "déploiement IA local",
      "intégrateur IA",
    ],
    comparison: [
      "IA sur-mesure vs SaaS prêt-à-l'emploi",
      "ChatGPT vs Mistral entreprise",
      "RAG vs fine-tuning LLM",
    ],
  },
  un_a_un: {
    blog_from_keywords: [
      "coaching IA dirigeant PME",
      "accompagnement IA personnalisé",
      "mentoring CDO transformation IA",
      "advisory IA conseil administration",
    ],
    guide_pilier: [
      "guide accompagnement IA dirigeant",
      "comment piloter une transformation IA",
      "feuille de route IA dirigeant PME",
    ],
    qa_derived: [
      "qu'est-ce qu'un coaching IA",
      "combien coûte un accompagnement IA dirigeant",
      "qui est concerné par le coaching IA",
    ],
    faq_standalone: ["FAQ coaching IA dirigeant"],
    landing_ville: ["coach IA", "mentor IA PME", "advisory IA"],
    comparison: [
      "coaching IA vs formation IA",
      "consultant IA salarié vs externe",
    ],
  },
  sites_web_augmentes: {
    blog_from_keywords: [
      "site web augmenté IA 2026",
      "chatbot site web PME",
      "search sémantique site e-commerce",
      "personnalisation IA site marchand",
    ],
    guide_pilier: [
      "guide site web IA intégrée 2026",
      "comment ajouter de l'IA à son site web",
      "agent conversationnel site PME",
    ],
    qa_derived: [
      "comment intégrer un chatbot à son site",
      "combien coûte un site IA",
      "quel chatbot pour PME",
    ],
    faq_standalone: ["FAQ site web IA PME"],
    landing_ville: [
      "site web IA",
      "développeur site IA",
      "agence site IA augmenté",
    ],
    comparison: [
      "chatbot dialogflow vs claude",
      "site web statique vs IA conversationnelle",
    ],
  },
};

/** Helpers */
export function getAllKeywordsForVertical(vertical: VerticalSlug): ReadonlyArray<string> {
  return Object.values(KEYWORD_CATALOG_V2[vertical] ?? {}).flat();
}

export function getKeywordsForVerticalAndType(
  vertical: VerticalSlug,
  contentType: ContentTypeKey,
): ReadonlyArray<string> {
  return KEYWORD_CATALOG_V2[vertical]?.[contentType] ?? [];
}

// Rétrocompat : l'export KEYWORD_CATALOG existant pointe vers tous les keywords agrégés
// (déjà utilisé par le wizard actuel — ne pas casser)
```

### Wizard step 4

Adapter pour utiliser `getAllKeywordsForVertical(vertical)` au lieu de `KEYWORD_CATALOG[vertical]`.

### Acceptance
- [ ] grep : `getKeywordsForVerticalAndType` exporté
- [ ] Vitest : helpers couvertes

### Commit
```
feat(content-gen): keywords par vertical × content_type (Phase 5 AEO/GEO v2)
- KEYWORD_CATALOG_V2 : 5 verticales × 6 content_types = 30 cellules
- ~150 keywords pré-remplis (5 par cellule en moyenne)
- Helpers getKeywordsForVerticalAndType + getAllKeywordsForVertical
- Rétrocompat KEYWORD_CATALOG préservé
```

---

## PHASE 6 — Llms.txt + ai.txt + llms-full.txt 🟠 P1 (1h)

### Fichiers
- `src/app/llms.txt/route.ts` (NOUVEAU)
- `src/app/ai.txt/route.ts` (NOUVEAU)
- `src/app/llms-full.txt/route.ts` (NOUVEAU)
- `src/app/robots.ts` (mention)

### Implémentation

#### 6.1 /llms.txt — résumé site pour crawlers IA

```typescript
// src/app/llms.txt/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const content = `# Axion-IA

> Cabinet de conseil en intelligence artificielle pour TPE, PME et ETI françaises.
> Audits IA, formations & interventions, implémentations, coaching 1-to-1, plateformes web augmentées IA.
> Approche : ZÉRO INVENTION, sources sourcées (INSEE, BPI France, AI Act), conformité AI Act intégrée.

## Verticales de services

- [Audits IA](https://www.axion-ia.com/fr/audits) : diagnostic maturité, conformité AI Act, évaluation ROI
- [Formations & Interventions](https://www.axion-ia.com/fr/formations-interventions) : ateliers pratiques, sensibilisation équipes
- [Implémentations](https://www.axion-ia.com/fr/implementations) : déploiement IA clé en main, automatisation, intégration LLM
- [Coaching 1-to-1](https://www.axion-ia.com/fr/un-a-un) : accompagnement dirigeants, CDO, advisory
- [Plateformes Web & IA](https://www.axion-ia.com/fr/codage-developpement) : sites augmentés IA, chatbots, agents conversationnels

## Ressources éditoriales

- [Blog](https://www.axion-ia.com/fr/blog) : actualité IA, cas d'usage PME/ETI
- [Guides](https://www.axion-ia.com/fr/guides) : guides piliers méthodologiques
- [FAQ](https://www.axion-ia.com/fr/faq) : questions/réponses Featured Snippet AEO
- [Glossaire IA](https://www.axion-ia.com/fr/glossaire) : 60+ termes définis
- [Cas concrets](https://www.axion-ia.com/fr/cas-concrets) : retours d'expérience PME

## Données structurées

- Sitemap XML : https://www.axion-ia.com/sitemap.xml
- Flux RSS blog : https://www.axion-ia.com/blog/rss.xml
- Flux RSS knowledge : https://www.axion-ia.com/api/knowledge/rss

## Conformité et transparence

- Conforme AI Act (Règlement UE 2024/1689) — article 50 transparence contenus générés IA
- Contenu généré IA flagué avec disclaimer visible + JSON-LD aiGenerated:true
- RGPD : contact@axion-ia.com pour exercice des droits
- Auteur principal IA : Manon (persona, sous supervision Will Jullin, fondateur)

## Contact

- Email : contact@axion-ia.com
- Site : https://www.axion-ia.com

# Politique d'indexation IA

Axion-IA AUTORISE l'indexation et la citation de son contenu par :
- ClaudeBot (Anthropic)
- GPTBot (OpenAI)
- PerplexityBot (Perplexity)
- Bingbot (Microsoft Bing + Copilot)
- Google-Extended (Google AI Overview / Gemini)

Attribution demandée : "Axion-IA — cabinet IA français" avec lien vers la page source.
`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
```

#### 6.2 /ai.txt

```typescript
// src/app/ai.txt/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const content = `# AI Crawler Policy — Axion-IA
# Updated: ${new Date().toISOString().slice(0, 10)}

User-Agent: *
Allow: /

User-Agent: ClaudeBot
Allow: /
Crawl-Delay: 1

User-Agent: anthropic-ai
Allow: /

User-Agent: GPTBot
Allow: /
Crawl-Delay: 1

User-Agent: OAI-SearchBot
Allow: /

User-Agent: PerplexityBot
Allow: /
Crawl-Delay: 1

User-Agent: Bingbot
Allow: /

User-Agent: Google-Extended
Allow: /

User-Agent: Applebot-Extended
Allow: /

# Sitemaps
Sitemap: https://www.axion-ia.com/sitemap.xml
Sitemap: https://www.axion-ia.com/llms.txt
Sitemap: https://www.axion-ia.com/llms-full.txt

# Contact
Owner: Axion-IA OÜ
Contact: contact@axion-ia.com
`;
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

#### 6.3 /llms-full.txt — version étendue dynamique

Génère une liste complète des pages clés à partir de la DB (Article + KnowledgeEntry publiés). Si DB stubbed (build GH Actions) → fallback liste statique des 20 pages clés.

```typescript
// src/app/llms-full.txt/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  let dynamicSection = "";

  if (!process.env.DATABASE_URL?.includes("stub.invalid")) {
    try {
      const articles = await prisma.article.findMany({
        where: { status: "published", indexationTier: "tier_1_indexable" },
        orderBy: { publishedAt: "desc" },
        take: 50,
        include: { translations: { where: { locale: "fr" } } },
      });
      dynamicSection = articles
        .map((a) => {
          const t = a.translations[0];
          if (!t) return "";
          return `- [${t.title}](https://www.axion-ia.com/fr/blog/${t.slug}) — ${(t.excerpt ?? "").slice(0, 200)}`;
        })
        .filter(Boolean)
        .join("\n");
    } catch {
      dynamicSection = "";
    }
  }

  const content = `# Axion-IA — Pages clés (LLM-friendly)

> Liste exhaustive pour ingestion par crawlers IA. Toutes les URLs sont indexables et stables (slugs versionnés avec redirects 301 si rename).

## Pages stratégiques

- [Accueil](https://www.axion-ia.com/fr) : Cabinet IA français pour PME
- [À propos](https://www.axion-ia.com/fr/a-propos) : Mission, équipe, méthodologie
- [Audits IA](https://www.axion-ia.com/fr/audits) : Verticale audits
- [Formations](https://www.axion-ia.com/fr/formations-interventions) : Verticale formations
- [Implémentations](https://www.axion-ia.com/fr/implementations) : Verticale implémentations
- [Coaching](https://www.axion-ia.com/fr/un-a-un) : Verticale 1-to-1
- [Web augmenté IA](https://www.axion-ia.com/fr/codage-developpement) : Verticale plateformes
- [Cas concrets](https://www.axion-ia.com/fr/cas-concrets) : Études de cas
- [Glossaire IA](https://www.axion-ia.com/fr/glossaire) : 60+ termes
- [FAQ](https://www.axion-ia.com/fr/faq) : Q&R AEO

## Articles publiés (tier 1)

${dynamicSection || "_(Liste populée dès la première ISR — DB stubbée au build)_"}
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

### Acceptance
- [ ] curl localhost:3000/llms.txt → 200
- [ ] curl localhost:3000/ai.txt → 200
- [ ] curl localhost:3000/llms-full.txt → 200

### Commit
```
feat(seo): llms.txt + ai.txt + llms-full.txt (Phase 6 AEO/GEO v2)
- /llms.txt : résumé site pour crawlers IA (verticales, ressources, conformité)
- /ai.txt : politique crawl (ClaudeBot, GPTBot, PerplexityBot, Google-Extended)
- /llms-full.txt : liste dynamique articles tier-1 + pages stratégiques
```

---

## PHASE 7 — AggregateRating JSON-LD 🟠 P1 (1h)

### Skip-if (IMPÉRATIF — éviter l'invention)
Si **aucune** table `Review`, `Testimonial`, `CustomerReview` n'existe en DB → **SKIP cette phase**.

Vérification :
```bash
grep -E "^model (Review|Testimonial|CustomerReview|ClientReview)" prisma/schema.prisma
```

Si aucun match → noter dans verdict "Phase 7 SKIPPED — pas de table Review en DB" → continuer.

### Si table existe
- Factory `buildAggregateRatingJsonLd` dans `src/lib/seo-content-gen-factories.ts`
- Lookup DB côté landing-ville generator ou template render
- Injection si `reviewCount >= 5`

### Commit (si non-skip)
```
feat(seo): AggregateRating JSON-LD (Phase 7 AEO/GEO v2)
- buildAggregateRatingJsonLd factory
- Injection landings services si ≥ 5 avis DB
```

---

## PHASE 8 — Quota automatique par ville 🟡 P2 (1h)

### Fichier
- `src/server/actions/content-gen/city-equity.ts` (étendre)
- `src/components/admin/content-gen/CoverageWizardClient.tsx` (bouton)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/city-coverage/_v2/CityCoverageV2.tsx` (KPI gap)

### Implémentation

#### 8.1 getCityCoverageGaps

```typescript
const PILOT_CITIES: ReadonlyArray<string> = [
  "paris", "marseille", "lyon", "toulouse", "nice", "nantes", "montpellier",
  "strasbourg", "bordeaux", "lille", "rennes", "toulon", "reims", "saint-etienne",
  "le-havre", "villeurbanne", "dijon", "angers", "grenoble", "nimes",
  "aix-en-provence", "clermont-ferrand", "le-mans", "brest", "tours", "amiens",
  "annecy", "limoges", "metz", "perpignan", "boulogne-billancourt", "besancon",
  "orleans", "rouen", "montreuil", "caen", "argenteuil", "mulhouse", "nancy",
];

export async function getCityCoverageGaps(): Promise<{
  readonly underCovered: ReadonlyArray<{ villeSlug: string; gap: number; current: number }>;
  readonly zeroCovered: ReadonlyArray<string>;
  readonly totalGap: number;
}> {
  const data = await getCityEquityData();
  const equityMap = Object.fromEntries(data.rows.map((r) => [r.villeSlug, r.publishedArticles]));
  const underCovered = PILOT_CITIES
    .map((slug) => ({
      villeSlug: slug,
      current: equityMap[slug] ?? 0,
      gap: EQUITY_TARGET - (equityMap[slug] ?? 0),
    }))
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  const zeroCovered = PILOT_CITIES.filter((slug) => !equityMap[slug]);
  const totalGap = underCovered.reduce((s, r) => s + r.gap, 0);
  return { underCovered, zeroCovered, totalGap };
}
```

#### 8.2 Bouton dans wizard Step 2

```tsx
<button
  type="button"
  onClick={async () => {
    const { underCovered } = await getCityCoverageGaps();
    setSelectedCities(new Set(underCovered.slice(0, 10).map((c) => c.villeSlug)));
  }}
  className="admin-button-ghost text-[length:var(--text-admin-xs)]"
>
  🎯 Combler les villes en retard
</button>
```

#### 8.3 KPI dashboard city-coverage

Ajouter une carte "Gap total : X articles à produire pour atteindre 10/ville sur 39 villes".

### Commit
```
feat(content-gen): quota automatique villes (Phase 8 AEO/GEO v2)
- getCityCoverageGaps : detection villes < EQUITY_TARGET
- Bouton wizard "Combler les villes en retard"
- KPI gap total dashboard city-coverage
```

---

## PHASE 9 — UnsplashCredit sur guides 🟡 P2 (30min)

### Fichier
- `src/app/[locale]/guides/[slug]/page.tsx` (ajout UnsplashCredit)
- Loader guides (si pas déjà fait : exposer photographerName/photographerUrl)

### Skip-if
Les pages guides n'utilisent pas de hero image (vérifier `grep -n "featuredImage\|heroImage" src/app/\[locale\]/guides/\[slug\]/page.tsx`)

### Commit
```
feat(seo): UnsplashCredit sur pages guides (Phase 9 AEO/GEO v2)
- Crédit photographe affiché sous image hero guide (CGU Unsplash §6)
- Loader guides expose photographerName + photographerUrl
```

---

## PHASE 10 — Audit cross-cutting JSON-LD matrice 🟡 P2 (1h)

### Fichier
- `scripts/audit-jsonld-coverage.ts` (NOUVEAU)
- `package.json` : `"audit:jsonld": "tsx scripts/audit-jsonld-coverage.ts"`

### Implémentation

Script qui :
1. Lit la matrice JSON-LD attendue (voir tableau dans le prompt v1)
2. Pour chaque contentType, prend 1 article DB exemple
3. Render la page → extrait tous les `<script type="application/ld+json">`
4. Compare avec la matrice → liste les manques
5. Exit code 1 si gaps, 0 sinon

```typescript
// scripts/audit-jsonld-coverage.ts
const EXPECTED_JSONLD: Record<string, ReadonlyArray<string>> = {
  blog_from_keywords: ["Article", "FAQPage", "Person", "BreadcrumbList"],
  blog_from_title: ["Article", "FAQPage", "Person", "BreadcrumbList"],
  blog_from_rss: ["NewsArticle", "FAQPage", "Person", "BreadcrumbList"],
  guide_pilier: ["Article", "FAQPage", "HowTo", "Person", "BreadcrumbList"],
  faq_standalone: ["FAQPage", "Person", "BreadcrumbList"],
  qa_derived: ["QAPage", "Person", "BreadcrumbList"],
  landing_ville: ["LocalBusiness", "FAQPage", "Person", "BreadcrumbList"],
  comparison: ["Article", "FAQPage", "Person", "BreadcrumbList"],
};

// Pseudo: itérer, fetch /fr/<route>/<slug>, parser HTML, extraire @type des JSON-LD, comparer
// Si gaps → console.error + exit 1
```

### Acceptance
- [ ] `pnpm audit:jsonld` exit 0
- [ ] Si gaps détectés → patch les generators manquants

### Commit
```
feat(content-gen): audit cross-cutting JSON-LD (Phase 10 AEO/GEO v2)
- scripts/audit-jsonld-coverage.ts : vérifie matrice contentType × JSON-LD
- Exit 1 si manques détectés
- pnpm audit:jsonld dans scripts
```

---

# 📋 VERDICT FINAL — Template obligatoire

Écrire `_AUDIT/VERDICT-CONTENT-GEN-AEO-GEO-PERFECTION-2026-V2.md` :

```markdown
# Verdict — Content-Gen AEO/GEO Perfection 2026 V2

**Date de livraison** : 2026-XX-XX
**Score** : XXX / 1000
**Verdict** : 🟢 GO PROD / 🟡 CONDITIONAL / 🔴 STOP
**Durée** : XXh autopilot

## Score par phase (sur 100 chacune)

| Phase | Description | Score | Commit |
|---|---|---|---|
| 1 | Câblage keywords wizard → jobs | XX/100 | `abc1234` |
| 2 | HowTo JSON-LD guide_pilier | XX/100 | `abc1234` |
| 3 | Citations sources DANS body | XX/100 | `abc1234` |
| 4 | Audience prompts TPE/PME/ETI/GE | XX/100 | `abc1234` |
| 5 | Keywords vertical × content_type | XX/100 | `abc1234` |
| 6 | Llms.txt + ai.txt + llms-full | XX/100 | `abc1234` |
| 7 | AggregateRating JSON-LD | XX/100 | `abc1234` ou SKIPPED |
| 8 | Quota auto villes | XX/100 | `abc1234` |
| 9 | UnsplashCredit guides | XX/100 | `abc1234` |
| 10 | Audit cross-cutting JSON-LD | XX/100 | `abc1234` |

**Total : XXX / 1000**

## Gates verts ✅

- typecheck : 0 erreur ✅
- vitest : XXXX / 1383 ✅ (delta vs baseline : +X)
- lint : 0 erreur 0 warning ✅
- isolation-check : OK ✅
- anti-siren / anti-hex / use-client : OK ✅
- prisma validate : OK ✅
- `pnpm audit:jsonld` : OK ✅

## Décisions prises en autopilot (sans STOP & ASK)

1. [Décrire chaque choix non-trivial fait sans demander]
2. [Ex: Phase 7 skippée car pas de table Review en DB]
3. [...]

## Actions Will post-livraison

1. [Action humaine n°1 — ex: créer table Review si l'on veut activer Phase 7]
2. [...]

## Items différés Sprint suivant (S+N)

- [Décrire ce qui n'a pas pu être fait]

## Liens

- Pre-flight log : `_AUDIT/PREFLIGHT-AEO-GEO-V2.md`
- Migration Prisma : `prisma/migrations/YYYYMMDDHHMMSS_*`
- Pull request : https://github.com/will383842/axion-ia/commit/<hash>
```

---

# 💾 MISE À JOUR MÉMOIRE — Obligatoire en fin de sprint

Créer le fichier `~/.claude/projects/C--Users-willi/memory/axionia_content_gen_aeo_geo_v2_2026_05_22.md` :

```markdown
---
name: axionia-content-gen-aeo-geo-v2-2026-05-22
description: Sprint AEO/GEO Perfection 2026 V2 — 10 phases, ~XXX/1000, livré 2026-XX-XX
metadata:
  type: project
---

Sprint livré commits `<hash1>...<hashN>`. 10 phases AEO/GEO 2026.

**Livré :**
- Phase 1 : keywords wizard → jobs (CoverageCampaign.primaryKeywords)
- Phase 2 : HowTo JSON-LD sur guide_pilier + factory buildHowToJsonLd
- Phase 3 : citations sources canoniques dans 9 generators (≥ 2 par article)
- Phase 4 : audience-voice.ts TPE/PME/ETI/GE (4 contextes éditoriaux)
- Phase 5 : KEYWORD_CATALOG_V2 (5 verticales × 6 types = ~150 keywords)
- Phase 6 : /llms.txt + /ai.txt + /llms-full.txt
- Phase 7 : AggregateRating (SKIPPED car pas de table Review) ou livré
- Phase 8 : getCityCoverageGaps + bouton wizard "combler villes en retard"
- Phase 9 : UnsplashCredit sur guides
- Phase 10 : scripts/audit-jsonld-coverage.ts (validation matrice)

**Score final : XXX / 1000**

**Why:** Maximiser citation par Google AI Overview + ChatGPT/Perplexity/Claude/Bing Copilot.

**How to apply:** Pour ajouter un nouveau type de contenu, étendre la matrice EXPECTED_JSONLD dans scripts/audit-jsonld-coverage.ts + ajouter une cellule dans KEYWORD_CATALOG_V2.

Liens : `_AUDIT/VERDICT-CONTENT-GEN-AEO-GEO-PERFECTION-2026-V2.md`
```

Puis Read `MEMORY.md` et ajouter une ligne en haut :
```
- [🟢 AxionIA AEO/GEO Perfection V2 2026-05-22 — XXX/1000](axionia_content_gen_aeo_geo_v2_2026_05_22.md) — 10 phases (keywords câblés, HowTo, sources, audience, catalog v2, llms.txt, équité, audit JSON-LD)
```

---

# 🚀 DÉPLOIEMENT

Après le commit final :

```bash
# Pousser tous les commits
git push origin main

# Surveiller le pipeline (~25 min build + deploy)
gh run watch
```

Le pipeline GH Actions :
1. Build Docker (~25 min) → push GHCR
2. Coolify pull → restart container (~30s à 28 min)
3. Cloudflare purge
4. LHCI gate 5 URLs prod

Si build échoue → analyser logs avec `gh run view <run-id> --log-failed`.

---

# ⚡ EXÉCUTION PARALLÈLE (optionnel pour gagner du temps)

Phases qui peuvent tourner en parallèle via sub-agents :

```
Groupe A (générateurs — séquentiel)
  Phase 1 → Phase 3 → Phase 4
  (toutes touchent les 9 generators — risque conflit fichiers si parallèle)

Groupe B (factories + UI — parallèle possible)
  Phase 2 (HowTo) || Phase 6 (llms.txt) || Phase 8 (quota villes)
  
Groupe C (post-livraison)
  Phase 5 → Phase 9 → Phase 10
```

Recommandation : **séquentiel** pour ce sprint. La parallélisation introduit du stash chaos qui coûte plus de temps qu'elle n'en gagne.

---

# ✅ FIN — Critères de succès

- [ ] Les 10 phases ont leur commit (sauf Phase 7 si SKIPPED documenté)
- [ ] Tous les commits sont sur `origin/main`
- [ ] `_AUDIT/VERDICT-CONTENT-GEN-AEO-GEO-PERFECTION-2026-V2.md` créé
- [ ] Mémoire mise à jour (fichier + ligne MEMORY.md)
- [ ] Pipeline GH Actions vert
- [ ] Score ≥ 850 / 1000 = 🟢 GO PROD

Si score < 850 → 🟡 CONDITIONAL → lister les items à corriger dans le verdict.

---

**GO. AUTOPILOT TOTAL. AUCUNE QUESTION. CONTINUER JUSQU'AU VERDICT FINAL.**
