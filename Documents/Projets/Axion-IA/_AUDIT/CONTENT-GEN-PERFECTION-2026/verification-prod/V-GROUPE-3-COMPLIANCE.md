# V-GROUPE-3-COMPLIANCE — AI Act + SEO + Compliance

Audit AUDIT-ONLY | Date : 2026-05-22 | Auditeur : agent Claude Sonnet 4.6

---

## A. AiContentDisclaimer — présence sur toutes les pages IA

### Composant `src/components/marketing/AiContentDisclaimer.tsx`

✅ **Existe** — server component pur, 0 hook, 0 state.

✅ **Contient "Claude Sonnet 4.6"** — ligne 37 :
```
"Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA avant publication."
```

✅ **Contient mention légale AI Act art. 50** — ligne 37-38 :
```
"Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."
```
(version EN identique)

✅ **Lien vers /transparence** — hub AI Act EU + persona Manon + sous-processeurs IA.

---

### A.1 — `src/app/[locale]/blog/[slug]/page.tsx`

✅ **Import présent** — ligne 14 :
```typescript
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
```

✅ **Utilisé dans le rendu** — ligne 410 :
```tsx
<AiContentDisclaimer locale={loc} />
```

---

### A.2 — `src/app/[locale]/guides/[slug]/page.tsx`

✅ **Import présent** — ligne 25 :
```typescript
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
```

✅ **Utilisé dans le rendu** — ligne 185 :
```tsx
<AiContentDisclaimer locale="fr" className="mt-10" />
```

---

### A.3 — Pages /implantations (landing_ville)

⚠️ **Situation nuancée** :

- `src/app/[locale]/implantations/[region]/page.tsx` (hub région) : ❌ `AiContentDisclaimer` **absent**. Justification acceptable : cette page est statique (contenu humain, pas généré par IA pipeline). Pas de flag `aiGenerated` dans le contenu servi. Risque AI Act limité, mais à surveiller si du contenu IA y est injecté.

- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` : ✅ **Import et usage présents** — ligne 30 (import) et ligne 864 (rendu) :
```typescript
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
// ...
<AiContentDisclaimer locale={loc} />
```

---

### A.4 — `src/app/[locale]/cas-concrets/[slug]/page.tsx`

✅ **Import présent** — ligne 18 :
```typescript
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
```

✅ **Utilisé dans le rendu** — ligne 219 :
```tsx
<AiContentDisclaimer locale={loc} />
```
Commentaire explicite : `// P1.5 QW-6 — AI Act art. 50 disclosure visible (bandeau IA-assisté).`

---

## B. JSON-LD aiGenerated

### B.1 — `aiGenerated: true` dans les JSON-LD articles

⚠️ **Situation nuancée** :

- `buildArticleJsonLd()` dans `src/lib/seo.ts` : ❌ **N'émet PAS `aiGenerated`** directement. La factory de base ne contient pas ce champ.

- **MAIS** : les pages qui l'utilisent spread explicitement le flag :

  - `blog/[slug]/page.tsx` lignes 227-245 :
    ```typescript
    const articleJsonLd = {
      ...buildArticleJsonLd({ ... }),
      aiGenerated: true,
      additionalType: "https://schema.org/AIGeneratedContent",
    };
    ```
  - `cas-concrets/[slug]/page.tsx` lignes 80-92 :
    ```typescript
    const articleJsonLd = {
      ...buildArticleJsonLd({ ... }),
      aiGenerated: true,
      additionalType: "https://schema.org/AIGeneratedContent",
    };
    ```

✅ `aiGenerated: true` présent **in fine** dans les JSON-LD émis pour blog et cas-concrets via spread pattern.

❌ `guides/[slug]/page.tsx` utilise `buildArticleJsonLd` depuis `seo-content-gen-factories.ts` (pas `seo.ts`) — sans spread `aiGenerated`. Vérification dans la factory :

```
src/lib/seo-content-gen-factories.ts → buildArticleJsonLd()
```
Ce fichier émet `speakable` et `isBasedOn` mais aucun `aiGenerated` explicite n'est spreadé dans `guides/[slug]/page.tsx`. ❌ **Flag `aiGenerated` manquant pour guides.**

---

### B.2 — `speakable` présent

✅ **`speakable` présent dans les factories** :

- `src/lib/seo.ts` : `buildFaqJsonLd()` (ligne 316) et `buildFaqSpeakableJsonLd()` (ligne 713) émettent tous deux `speakable`.
- `src/lib/seo-content-gen-factories.ts` : `buildArticleJsonLd()` émet `speakable` (ligne 198-209) avec cssSelectors `[".tldr-answer", '[data-aeo="tldr"]', ".faq-answer", '[data-aeo="answer"]']`.

✅ **Couverture correcte** pour FAQ et articles content-gen.

---

### B.3 — `isBasedOn` ou `citation` présent

✅ **`isBasedOn`** :
- `src/lib/seo.ts` `buildArticleJsonLd()` : paramètre `isBasedOn` optionnel (lignes 584-588), émis si fourni (lignes 672-680).
- `src/lib/seo-content-gen-factories.ts` : `isBasedOn` émis systématiquement (ligne 238) pour news articles.
- `blog/[slug]/page.tsx` : spread conditionnel `...(view.citations.length > 0 ? { isBasedOn: view.citations } : {})` (ligne 241).

✅ **`citation`** :
- `src/lib/seo.ts` `buildArticleJsonLd()` : paramètre `citations` optionnel émis comme `citation[]` (lignes 661-671).
- `src/lib/seo-content-gen-factories.ts` : `buildCitationArray()` disponible (ligne 391+).

✅ Les deux propriétés sont supportées et câblées. Présence effective dépend des données (nullable optionnel).

---

## C. promptHash réel (AI Act art. 50 compliance)

### C.1 — `hashPrompt` importe une vraie fonction SHA-256

✅ **`src/server/content-gen/provenance/provenance-logger.ts`** :
- Ligne 14 : `import { createHash } from "node:crypto";`
- Ligne 49-51 :
```typescript
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 64);
}
```
SHA-256 natif Node.js. Pas de mock, pas de stub.

---

### C.2 — Hash basé sur le SYSTEM_PROMPT réel

✅ **`src/server/content-gen/generators/blog-from-keywords.ts`** :
- Ligne 19 : `import { hashPrompt } from "../provenance/provenance-logger";`
- Ligne 123 : `lastPromptHash = hashPrompt(SYSTEM_PROMPT + userPrompt);`

Le hash est calculé sur `SYSTEM_PROMPT` (constante réelle définie lignes 37-47, injectée avec `injectBrandVoice()`) **concaténé** avec le `userPrompt` spécifique au job. Ce n'est pas un hash de `contentType:jobId` — c'est bien le hash du prompt complet système+utilisateur.

✅ Conforme AI Act art. 50.

---

## D. Schema.prisma — champs AI Act

### D.1 — `promptHash` sur ContentGenJob

❌ **`promptHash` absent sur `model ContentGenJob`** (lignes 2947-3036 du schema).

Le champ `promptHash` existe sur `model GenerationProvenance` (ligne 987 : `promptHash String @map("prompt_hash") @db.VarChar(64)`), qui est lié à `Article` via `articleId`. La traçabilité est donc assurée par indirection Article → GenerationProvenance, pas directement sur ContentGenJob.

⚠️ **Conformité indirecte** : le hash de prompt est stocké dans `GenerationProvenance`, pas dans `ContentGenJob`. L'audit trail AI Act est présent mais à un niveau différent de ce que spécifie le critère.

---

### D.2 — `aiGenerated` sur Article (ou équivalent)

❌ **`aiGenerated` absent sur `model Article`** (lignes 874-973 du schema).

Le champ `aiGenerated Boolean` existe uniquement sur `model AuthorProfile` (ligne 2822) — il s'agit du flag "persona IA fictif", pas du flag "article généré par IA".

⚠️ Le flag `aiGenerated: true` est émis dans le JSON-LD en dur dans les pages (spread pattern) mais n'est **pas persisté en DB** sur Article. Pas de possibilité de query `Article.aiGenerated = true` pour audit.

---

### D.3 — `quarantined_critical` et `quarantined_factcheck` dans enum ContentGenJobStatus

✅ **Présents** — lignes 2532-2548 :
```prisma
/// `quarantined_critical` P4-P0-7 = violation P0 LLM-judge (AI Act, SIREN hardcodé…).
/// `quarantined_factcheck` P4-P0-6 = score fact-check < 50 — revue manuelle.
enum ContentGenJobStatus {
  // ...
  quarantined_critical
  quarantined_factcheck
}
```

---

### D.4 — `factCheckClaims` table présente

✅ **Présente** — `model FactCheckClaim` (lignes 1005-1019) avec `articleId → Article` relation (ligne 962 : `factCheckClaims FactCheckClaim[]`).

---

### D.5 — `lockDuration` présent

⚠️ **`lockDuration` absent dans `schema.prisma`** — aucune colonne `lock_duration` ou `locked_until` dans le schema Prisma.

✅ **`lockDuration` présent au niveau worker** (BullMQ option) :
- `content-gen-worker.ts` ligne 703 : `lockDuration: 120_000`
- `content-quality-improver-worker.ts` ligne 354 : `lockDuration: 120_000` (avec commentaire P0-2 explicite)
- `content-publish-worker.ts` ligne 613 : `lockDuration: 120_000`

Cohérent avec le fix P0-2 décrit dans les sessions précédentes (lockDuration géré au niveau BullMQ worker, pas persisté en DB).

---

## E. AuthorByline E-E-A-T

### Composant `src/components/knowledge/public/AuthorByline.tsx`

✅ **Existe** — server component pur (pas `'use client'`). Props : `authorName`, `authorSlug?`, `authorAvatarUrl?`, `authorBio?`, `authorLinkedinUrl?`, `publishedAt`, `lastReviewedAt?`, `factChecked?`, `locale`.

✅ Émet un **JSON-LD Person** en ligne via `<JsonLd data={personJsonLd} />`.

⚠️ **Note** : le composant est dans `src/components/knowledge/public/` (pas `src/components/seo/`). Aucun `AuthorByline` dans `src/components/seo/` — c'est l'emplacement canonique effectif.

---

### E.1 — Utilisé dans blog/[slug]/page.tsx

✅ **Présent** — lignes 15 (import) et 338-345 (usage) :
```typescript
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
// ...
<AuthorByline
  authorName={view.author}
  authorSlug={view.author.toLowerCase()}
  publishedAt={view.publishedAt ? new Date(view.publishedAt) : null}
  lastReviewedAt={view.updatedAt ? new Date(view.updatedAt) : null}
  locale={loc}
/>
```
Commentaire : `// P3 QW-5 — AuthorByline E-E-A-T (KB-10).`

---

### E.2 — Utilisé dans guides/[slug]/page.tsx

✅ **Présent** — lignes 26 (import) et 151-156 (usage) :
```typescript
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
// ...
<AuthorByline
  authorName="Manon"
  publishedAt={guide.publishedAt ? new Date(guide.publishedAt) : null}
  lastReviewedAt={guide.updatedAt ? new Date(guide.updatedAt) : null}
  locale="fr"
/>
```
Commentaire : `// P3 QW-5 — AuthorByline E-E-A-T (KB-10).`

---

### E.3 — Utilisé dans cas-concrets/[slug]/page.tsx

✅ **Présent** — lignes 19 (import) et 178-184 (usage) :
```typescript
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
// ...
<AuthorByline
  authorName={isFr ? "Équipe Axion-IA" : "Axion-IA team"}
  publishedAt={new Date("2026-05-01")}
  locale={loc}
/>
```
Commentaire : `// P3 QW-5 — AuthorByline E-E-A-T (KB-10).`

---

## F. ArticleTOC

### Composant `src/components/seo/ArticleTOC.tsx`

✅ **Existe** — exports : `ArticleTOC`, `extractTocItems`, `TocItem`. Émet un JSON-LD `ItemList` inline. Support sticky desktop + repliable mobile. Parser HTML h2/h3 + fallback markdown ##/###.

---

### F.1 — Utilisé dans guides/[slug]/page.tsx

✅ **Import présent** — ligne 27 :
```typescript
import { ArticleTOC, type TocItem } from "@/components/seo/ArticleTOC";
```

✅ **Utilisé dans le rendu** — lignes 132-134 :
```tsx
{tocItems.length >= 2 && (
  <ArticleTOC items={tocItems} pageUrl={pageUrl} locale="fr" sticky={false} />
)}
```
TOC conditionnel si ≥ 2 items extraits des steps structurées.

✅ **Également utilisé dans blog/[slug]/page.tsx** — lignes 16 (import), 380-384 (rendu conditionnel si wordCount > 1500).

---

## G. legalName + alternateName FR

### G.1 — `legalName: "Axion-IA"` dans `src/lib/brand.ts`

✅ **Présent** — ligne 16 :
```typescript
legalName: "Axion-IA",
```
Commentaire : `// Raison sociale juridique pour mentions légales (société française — Will précise forme SAS/SASU + SIREN).`

✅ Pas d'indication OÜ, aligné décision D7 (société française pure).

---

### G.2 — `alternateName` liste FR sans "Axion-IA OÜ"

❌ **"Axion-IA OÜ" toujours présent dans `brand.ts`** — ligne 18 :
```typescript
alternateName: ["AxionIA", "Axion IA", "Axion-IA OÜ", "axion-ia.com"] as const,
```

❌ **"Axion-IA OÜ" toujours présent dans `src/lib/seo.ts`** — 3 occurrences :
- Ligne 390 (`buildOrganizationJsonLd`) : `alternateName: ["AxionIA", "Axion IA", "Axion-IA OÜ", "axion-ia.com"]`
- Ligne 794 (`buildLocalBusinessJsonLd` → `parentOrganization`) : idem
- Ligne 1288 (autre factory) : idem

⚠️ **ANOMALIE** : La décision D7 (Will 2026-05-21) impose "société française pure" (pas OÜ). L'entrée "Axion-IA OÜ" dans `alternateName` signale l'ancienne entité estonienne. Elle doit être retirée de `brand.ts` et des 3 emplacements de `seo.ts`.

---

## H. search_term_string dans WebSite JSON-LD

### `src/lib/seo.ts` → `buildWebsiteJsonLd()`

✅ **`{search_term_string}` présent** (pas `{query}`) — lignes 459-461 :
```typescript
urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={search_term_string}`,
},
"query-input": "required name=search_term_string",
```

✅ Conforme spec Google Sitelinks Search Box 2026.

---

## Synthèse globale

| Groupe | Item | Statut | Criticité |
|--------|------|--------|-----------|
| A | AiContentDisclaimer — composant (Claude Sonnet 4.6 + art. 50) | ✅ | — |
| A.1 | AiContentDisclaimer dans blog/[slug] | ✅ | — |
| A.2 | AiContentDisclaimer dans guides/[slug] | ✅ | — |
| A.3 | AiContentDisclaimer dans implantations/[region] (hub) | ❌ absent | Faible (contenu non IA-généré) |
| A.3 | AiContentDisclaimer dans implantations/[region]/[ville] | ✅ | — |
| A.4 | AiContentDisclaimer dans cas-concrets/[slug] | ✅ | — |
| B.1 | `aiGenerated: true` dans JSON-LD blog | ✅ (spread) | — |
| B.1 | `aiGenerated: true` dans JSON-LD cas-concrets | ✅ (spread) | — |
| B.1 | `aiGenerated: true` dans JSON-LD guides | ❌ absent | **P1** |
| B.2 | `speakable` dans factories | ✅ | — |
| B.3 | `isBasedOn` / `citation` dans factories | ✅ (optionnel) | — |
| C.1 | `hashPrompt` = SHA-256 réel Node.js crypto | ✅ | — |
| C.2 | Hash basé sur SYSTEM_PROMPT réel | ✅ | — |
| D.1 | `promptHash` sur ContentGenJob | ❌ absent (sur GenerationProvenance) | P2 |
| D.2 | `aiGenerated` sur Article | ❌ absent en DB | **P1** |
| D.3 | `quarantined_critical` + `quarantined_factcheck` dans enum | ✅ | — |
| D.4 | `factCheckClaims` table | ✅ | — |
| D.5 | `lockDuration` (worker BullMQ) | ✅ | — |
| E | AuthorByline composant existe | ✅ | — |
| E.1 | AuthorByline dans blog/[slug] | ✅ | — |
| E.2 | AuthorByline dans guides/[slug] | ✅ | — |
| E.3 | AuthorByline dans cas-concrets/[slug] | ✅ | — |
| F | ArticleTOC composant existe | ✅ | — |
| F.1 | ArticleTOC dans guides/[slug] | ✅ | — |
| G.1 | `legalName: "Axion-IA"` (français, pas OÜ) | ✅ | — |
| G.2 | `alternateName` sans "Axion-IA OÜ" | ❌ présent × 4 | **P1** |
| H | `{search_term_string}` dans WebSite JSON-LD | ✅ | — |

---

## Anomalies P1 à corriger

### P1-A — `aiGenerated: true` absent dans guides/[slug]/page.tsx

**Fichier** : `src/app/[locale]/guides/[slug]/page.tsx`

Le `jsonLd` construit aux lignes 77-96 (via `buildHowToJsonLd` ou `buildArticleJsonLd` de `seo-content-gen-factories.ts`) ne reçoit pas de spread `aiGenerated: true`. Correction :

```typescript
const jsonLd = {
  ...(guide.hasStructuredSteps
    ? buildHowToJsonLd({ ... })
    : buildArticleJsonLd({ ... })),
  aiGenerated: true,
  additionalType: "https://schema.org/AIGeneratedContent",
};
```

---

### P1-B — `aiGenerated` absent sur `model Article` en DB

**Fichier** : `prisma/schema.prisma`

Ajout recommandé dans `model Article` (après ligne 896 `factCheckScore`) :

```prisma
/// AI Act art. 50 — flag machine-readable "article généré/assisté par IA".
/// Posé à true par tous les générateurs content-gen. False = article FS ou humain.
aiGenerated Boolean @default(false) @map("ai_generated")
```

Nécessite une migration Prisma additive (default false = aucune rupture).

---

### P1-C — "Axion-IA OÜ" à retirer de `alternateName`

**Fichiers** :
- `src/lib/brand.ts` ligne 18
- `src/lib/seo.ts` lignes 390, 794, 1288

Retirer "Axion-IA OÜ" de chaque array `alternateName`. Laisser : `["AxionIA", "Axion IA", "axion-ia.com"]`.

---

### P2 — `promptHash` sur ContentGenJob (mineur)

Le hash du prompt est actuellement stocké dans `GenerationProvenance` (lié à `Article`), pas directement sur `ContentGenJob`. L'audit trail AI Act est assuré par indirection. Ajout direct sur `ContentGenJob` serait un bonus de traçabilité mais non bloquant.

---

*Rapport généré en AUDIT-ONLY — aucune modification de code effectuée.*
