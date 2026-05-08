# Agent E — Audit fit stack existante (anti-réinvention)

> Date : 2026-05-07
> Working dir : `axionia/`
> Référence : HEAD git (`c194caa docs(audit): close v10.2 contradictions pass + log Sprint 0 kickoff`)
> Mission : empêcher l'agent principal de proposer des architectures qui contournent les centralisations existantes (régions/villes/extensions stack-ia/⌘K).

Mode **lecture seule strict**. Aucun fichier source modifié — seul ce livrable est écrit.

---

## 0. Synthèse exécutive (à lire avant tout)

Le code Axion-IA repose sur **6 centralisations dures** que tout nouveau pattern doit RESPECTER, jamais doubler :

1. **`src/content/*.ts`** — TS typé (jamais MDX/JSON), avec helpers `getAllXxxSlugs()` / `getXxxBySlug()` exportés.
2. **`src/i18n/routing.ts`** — `routing.pathnames` est la **seule** source de vérité pour les slugs FR↔EN.
3. **`src/lib/seo.ts`** — factories `buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd`. Toute extension SEO/JSON-LD passe par là.
4. **`src/app/sitemap.ts`** — pattern `buildDynamic(entries, now)` consomme les `getAllXxxSlugs()`. Pas de sitemap parallèle.
5. **`src/components/marketing/JsonLd.tsx`** — composant unique, signature stable `{ data: unknown }`, dangerouslySetInnerHTML. Ne jamais variantiser.
6. **`src/lib/schemas/forms.ts`** — schemas Zod centralisés (réservation, audit, contact, implémentation). Tout nouveau formulaire passe par un schema ici.

**Anti-pattern n°1** détecté dans la base : 0 — la base est cohérente.
**Risque principal pour l'agent principal** : créer `src/data/regions.json` ou `<LocalBusinessSchema>` au lieu d'étendre les factories.

---

## 1. Inventaire `src/content/*.ts`

Dossier listé : 10 fichiers TS + 1 fichier `.test.ts`.

| Fichier              | Type principal                                                                                          | Helpers exposés                                                                                                                                                                                                                                                                                                                                                                                                                             | Notes                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `audit.ts`           | `AuditContent` (slug `flash`/`process`/`strategique-pme`/`strategique-eti`)                             | `getAudit(slug)`                                                                                                                                                                                                                                                                                                                                                                                                                            | 4 niveaux pyramide, `summary.fr/en` + `fr/en` PageCopy                                         |
| `automatisations.ts` | `AutomatisationCategory` (8 slugs)                                                                      | `getAutomatisation(slug)`, const `AUTOMATISATION_SLUGS`                                                                                                                                                                                                                                                                                                                                                                                     | Catalogue par fonction d'entreprise                                                            |
| `case-studies.ts`    | `CaseStudy` (5 fixtures)                                                                                | `getCaseStudy`, **`getAllSlugs()`**, **`getAllIndustrySlugs()`**, `getCaseStudiesByIndustry`, `getIndustryLabel`                                                                                                                                                                                                                                                                                                                            | Slugify interne via fonction privée                                                            |
| `comparaisons.ts`    | `Comparison` (3 fixtures)                                                                               | `getComparison`, **`getAllComparisonSlugs()`**                                                                                                                                                                                                                                                                                                                                                                                              | Sprint 14 fixture, futur Prisma                                                                |
| `implementation.ts`  | `ImplementationContent` (9 slugs)                                                                       | `getImplementation(slug)`                                                                                                                                                                                                                                                                                                                                                                                                                   | Module 3 — pas de `getAllSlugs()` exporté (slugs hardcodés dans union type)                    |
| `interventions.ts`   | `InterventionContent` (5 slugs)                                                                         | `getIntervention(slug)`, `getInterventionCopy(slug, locale)`, const `INTERVENTIONS`, `ESSENTIELLE_TIERS`, `RESERVATION_STEPS_FR/EN`, `EQUIPES_SCHEDULE_FR/EN` etc.                                                                                                                                                                                                                                                                          | Module 1 — riche (summary + daySchedule + tunnel réservation universel)                        |
| `legal.ts`           | `LegalContent` (6 slugs)                                                                                | `getLegal(slug)`, const `LEGAL_PAGES`                                                                                                                                                                                                                                                                                                                                                                                                       | Pas de `getAllSlugs()` (slugs union typés)                                                     |
| `press.ts`           | `PressRelease`, `PressFact`, `PressKitAsset`, `PressSpokesperson`, `PressFaqEntry`, const `PRESS_PITCH` | `getPressRelease(slug)`, **`getAllPressReleaseSlugs()`**                                                                                                                                                                                                                                                                                                                                                                                    | Sprint correctif 14.6                                                                          |
| `press.test.ts`      | (test file)                                                                                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                           | Test parité FR/EN                                                                              |
| `stack-ia.ts`        | `StackCategory`, `StackTool`, `StackFaqItem`                                                            | aucune fonction exportée — uniquement consts `STACK_CATEGORIES`, `STACK_TOOLS`, `STACK_FAQS`                                                                                                                                                                                                                                                                                                                                                | **Pas de `getAllStackToolSlugs()`** (cf. §gaps)                                                |
| `transversal.ts`     | `BlogPost`, `HelpArticle`, `FAQ_GLOBAL`, `ABOUT_TIMELINE`, `ABOUT_TEAM`                                 | `getBlogPost`, **`getAllBlogSlugs`**, **`getAllBlogCategorySlugs`**, `getBlogPostsByCategory`, `getBlogCategoryLabel`, **`getAllBlogTagSlugs`**, `getBlogPostsByTag`, **`getAllBlogAuthorSlugs`**, `getBlogPostsByAuthor`, `getBlogAuthorLabel`, `getHelpArticle`, **`getAllHelpSlugs`**, **`getAllHelpCategorySlugs`**, `getHelpArticlesByCategory`, `getHelpCategoryLabel`, `getFaqEntry`, **`getAllFaqIds`**, `slugify` (helper exporté) | Sprint 9, fixtures futur Prisma. **Référence canonique** pour la convention `getAllXxxSlugs()` |

Convention **observée systématique** :

- export d'une **const ALL_CAPS** (`CASE_STUDIES`, `INTERVENTIONS`, `STACK_TOOLS`, `BLOG_POSTS`).
- Helper `getXxx(slug)` retourne l'entrée typée ou `undefined`/throw.
- Helper `getAllXxxSlugs()` retourne `string[]` à passer dans `app/sitemap.ts`.
- Pour les facettes (catégorie, tag, auteur, industrie) : **`getAll{Facet}Slugs()`** + `getXxxBy{Facet}(slug)` + `get{Facet}Label(slug, locale?)`.
- Champs métadata : **`fr` + `en`** systématiquement (jamais string `[locale]` à la racine), parfois `summary: { fr, en }` quand contenu plus dense.
- Slugify interne : fonction privée TS qui normalise NFD + supprime accents (`transversal.ts:365-372`).

### Exemple représentatif — `case-studies.ts:209-225`

```ts
export function getAllSlugs(): string[] {
  return CASE_STUDIES.map((c) => c.slug);
}

function caseSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAllIndustrySlugs(): string[] {
  const set = new Set(CASE_STUDIES.map((c) => caseSlugify(c.industry)));
  return [...set];
}
```

**Observation clé pour régions/villes** : il existe DÉJÀ deux conventions concurrentes pour générer un slug — `slugify` exporté depuis `transversal.ts:365-374` (réutilisable) et `caseSlugify` privée à `case-studies.ts:213-220`. Pour villes/régions, **réutiliser `slugify` exporté** (`import { slugify } from "@/content/transversal"`) plutôt que reproduire la fonction.

---

## 2. `routing.pathnames` complet — `src/i18n/routing.ts:1-141`

Source de vérité unique. Toutes les routes typées de l'app sont déclarées ici (Sprint 2 a livré la cartographie complète, **avant même les pages**, pour faire typecheck les `<Link>`).

### Structure d'une entrée

3 formes :

- **Identique FR/EN** : `"/blog": "/blog"` (string).
- **Mapping FR↔EN** : `"/a-propos": { fr: "/a-propos", en: "/about" }`.
- **Avec template `[slug]`** : `"/cas-concrets/[slug]": { fr: "/cas-concrets/[slug]", en: "/case-studies/[slug]" }`.

### Slugs déjà mappés (47 entrées au total)

Modules services :

- `/interventions` + 5 slugs FR↔EN (`equipes`/`teams`, `dirigeants`/`executives`…) — `routing.ts:22-36`.
- `/audit` + 5 slugs (pyramide 4 niveaux + `/audit/demande` mappé EN `/audit/request`) — `routing.ts:39-50`.
- `/implementation` + 9 sous-pages + 2 catalogues `[slug]` (par-fonction / par-techno) — `routing.ts:53-82`.

Transversales :

- `/cas-concrets` + `[slug]` + `/secteur/[slug]` — `routing.ts:85-86,105-108`.
- `/blog` + 4 facettes ([slug], categorie, tag, auteur) — `routing.ts:92-96`.
- `/centre-aide` + `[slug]` + categorie — `routing.ts:99-104`.
- `/comparaisons` + `[slug]` — `routing.ts:116-117`.
- `/stack-ia` ↔ `/ai-stack` — `routing.ts:114`.

Légales : 6 entrées avec mappings — `routing.ts:124-136`.

**ABSENT** (gap pour audit Header) :

- ❌ Aucune entrée `/implantations`, `/regions`, `/villes`.
- ❌ Aucune entrée `/ia` (page dédiée IA & Solutions ADR §9.2).
- ❌ Aucune entrée `/recherche/[…]` paramétrée.

**Action attendue de l'agent principal** : étendre `routing.pathnames` ICI, jamais ailleurs.

---

## 3. `src/lib/seo.ts` — factories existantes

Fichier 130 lignes, 4 factories exportées.

### 3.1 `SITE_URL` (`seo.ts:4`)

```ts
export const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
```

Réutilisable, importer plutôt que redéclarer.

### 3.2 `buildProductMetadata` — `seo.ts:6-47`

**Input** : `{ locale, path, title, description, alternates? }` (`alternates` optionnel : `{ fr?: string, en?: string }`).
**Output** : `Metadata` Next.js avec :

- `alternates.canonical` = `/${locale}${path}`.
- `alternates.languages` = `{ fr, en, "x-default" }` avec mapping cross-locale.
- `openGraph` (type website, locale `fr_FR`/`en_US`, siteName `Axion-IA`).
- `twitter` (`summary_large_image`).
- `robots: { index: true, follow: true }` (par défaut indexable).

**Usage observé** : appelé dans `generateMetadata()` de chaque page `[locale]/.../page.tsx` (cf. `stack-ia/page.tsx:29-45`).

### 3.3 `buildServiceJsonLd` — `seo.ts:49-95`

**Input** : `{ locale, path, name, description, priceEur?, serviceType?, area? }`.
**Output** : `Service` Schema.org as const, avec provider Organization, areaServed conditionnel, offers conditionnel si `priceEur` défini.
**Usage** : services Module 1/2/3 (interventions, audits, implémentations).

### 3.4 `buildFaqJsonLd` — `seo.ts:97-111`

**Input** : `{ items: ReadonlyArray<{ question, answer }> }`.
**Output** : `FAQPage` Schema.org.
**Usage** : `stack-ia/page.tsx:190-192`, FAQ Block sections, etc.

### 3.5 `buildBreadcrumbJsonLd` — `seo.ts:113-129`

**Input** : `{ locale, items: ReadonlyArray<{ name, href }> }`.
**Output** : `BreadcrumbList` Schema.org. Gère cas `href === "/"` (homepage = chaîne vide après locale).

**Usage** : `stack-ia/page.tsx:179-188` (modèle de référence à imiter pour régions/villes).

### 3.6 ABSENTS (gaps pour audit Header)

- ❌ `buildLocalBusinessJsonLd` — nécessaire pour pages villes (LocalBusiness Schema.org avec address, areaServed, geo coordinates).
- ❌ `buildPlaceJsonLd` — nécessaire pour pages régions (Place / AdministrativeArea).
- ❌ `buildItemListJsonLd` (objet inline construit dans `stack-ia/page.tsx:158-177` — bonne occasion d'extraire en factory réutilisable pour pages hub régions/villes).
- ❌ `buildOrganizationJsonLd` (organisation Axion-IA OÜ — utile en page presse + footer global).

---

## 4. `src/app/sitemap.ts` — pattern `buildDynamic`

Fichier 196 lignes, 1 fonction `sitemap()` exportée.

### 4.1 Constantes — `sitemap.ts:15-44`

- `SITE_URL` redéclaré (cf. doublon avec `seo.ts:4` — possible cleanup).
- `EXCLUDED_FROM_INDEX: ReadonlyArray<PathnameKey>` = liste explicite typée sur `keyof routing.pathnames` — sécurité de typage forte.
- `isSlugTemplate(key)` = test `(key as string).includes("[slug]")` — exclut les patterns dynamiques de l'enum statique.
- `localizedHref(key, locale)` = retourne string (FR si default, EN si mappé).
- `alternateLanguages(key)` = construit `{ fr, en, "x-default" }` pour chaque entrée.

### 4.2 Type `DynamicSlug` — `sitemap.ts:64-72`

```ts
interface DynamicSlug {
  /** FR-canonical path with `:slug` placeholder. */
  fr: string;
  /** EN mirror path (defaults to FR). */
  en?: string;
  slugs: ReadonlyArray<string>;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}
```

Convention **`:slug`** (deux-points), pas `[slug]`, pour le placeholder à remplacer. Cf. `sitemap.ts:79`.

### 4.3 Fonction `buildDynamic` — `sitemap.ts:74-100`

Pour chaque entrée + chaque slug, émet 2 entries (FR + EN) avec `alternates.languages` complet sur la version FR. La version EN n'a pas d'`alternates` (légèrement asymétrique mais consistant avec next-intl).

### 4.4 Entries actuelles — `sitemap.ts:121-192`

10 entries dynamiques :

1. `/cas-concrets/:slug` (`getAllCaseStudySlugs()`)
2. `/blog/:slug` (`getAllBlogSlugs()`)
3. `/blog/categorie/:slug` ↔ `/blog/category/:slug` (`getAllBlogCategorySlugs()`)
4. `/blog/tag/:slug` (`getAllBlogTagSlugs()`)
5. `/blog/auteur/:slug` ↔ `/blog/author/:slug` (`getAllBlogAuthorSlugs()`)
6. `/faq/:slug` (`getAllFaqIds()`)
7. `/centre-aide/:slug` ↔ `/help/:slug` (`getAllHelpSlugs()`)
8. `/centre-aide/categorie/:slug` ↔ `/help/category/:slug` (`getAllHelpCategorySlugs()`)
9. `/cas-concrets/secteur/:slug` ↔ `/case-studies/industry/:slug` (`getAllIndustrySlugs()`)
10. `/comparaisons/:slug` (`getAllComparisonSlugs()`)

**Pattern à étendre pour villes/régions** (cf. §15 extrait code) :

```ts
{
  fr: "/implantations/villes/:slug",
  en: "/implantations/cities/:slug",
  slugs: getAllVilleSlugs(),
  changeFrequency: "monthly",
  priority: 0.5,
},
```

**ABSENTS** (cohérence à constater) :

- ❌ `/implementation/par-fonction/[slug]` — déclaré dans `routing.pathnames:74-77` mais **AUCUNE** entry `buildDynamic` dans `sitemap.ts`. Bug pré-existant ? À soulever.
- ❌ `/presse/[slug]` — non encore mappé dans `routing.pathnames` non plus. Sprint correctif 14.6 n'a livré que le hub `/presse`.

---

## 5. `src/app/robots.ts` — `robots.ts:1-30`

Fichier 30 lignes, **simple** :

- Allow `/` global.
- Disallow : `/api/`, `/_next/`, et les **dev shells** (`/design`, `/components`, `/sections`) avec leurs versions localisées `/fr/design`, `/en/design` etc.
- `sitemap: ${SITE_URL}/sitemap.xml`.
- `host: SITE_URL`.

**Pas de blacklist de pages publiques** (les `EXCLUDED_FROM_INDEX` du sitemap suffisent — privées mais pas indexables ne contiennent pas de secret).

**Action attendue agent principal** : si pages villes ont seuils d'éligibilité (ex : pas indexer les villes < 10k habitants), AJOUTER une whitelist explicite via `disallow` sur les slugs filtrés. Mais doctrine SSG strict suggère plutôt de **ne pas générer** ces pages (cf. `getAllVilleSlugs()` filtré par densité).

---

## 6. `JsonLd.tsx` signature + usage

### 6.1 Signature — `src/components/marketing/JsonLd.tsx:1-17`

```tsx
interface JsonLdProps {
  data: unknown;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
```

**Doctrine** :

- Signature **stable** depuis Sprint 5.
- Server-only, mais marche aussi côté client (composant pur).
- `dangerouslySetInnerHTML` est la voie canonique recommandée pour JSON-LD (sinon React échappe les entités HTML et casse Schema.org).

### 6.2 Usage (grep)

**69 fichiers** importent ou référencent `JsonLd` dans `src/`. Pages typiques :

- Pages services : `interventions/essentielle/page.tsx`, `audit/flash/page.tsx`, `implementation/chatbot/page.tsx` etc.
- Pages dynamiques : `cas-concrets/[slug]/page.tsx`, `blog/[slug]/page.tsx`, `comparaisons/[slug]/page.tsx`.
- Pages hub : `interventions/page.tsx`, `audit/page.tsx`, `stack-ia/page.tsx`, `cas-concrets/page.tsx`.
- Layout racine : `[locale]/layout.tsx` (probable injection Organization globale).

**Pattern d'usage observé** (`stack-ia/page.tsx:789-791`) :

```tsx
<JsonLd data={breadcrumb} />
<JsonLd data={itemListJsonLd} />
<JsonLd data={faqJsonLd} />
```

Plusieurs `<JsonLd>` empilés en bas de page. Chaque schema = composant séparé. **Ne JAMAIS variantiser** en `<BreadcrumbJsonLd>`, `<FaqJsonLd>` etc. — la factorisation est dans `lib/seo.ts`.

### 6.3 Test associé

`src/components/marketing/JsonLd.test.tsx` existe — toute modif au composant casse les tests. Fait foi.

---

## 7. `src/lib/schemas/forms.ts` — schemas Zod

Fichier 146 lignes, **8 schemas de base** + leurs steps multi-étapes.

### 7.1 Schemas existants

| Schema                                  | Lignes  | Champs clés                                                                                                                                                                |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contactSchema`                         | 8-15    | name, email, company?, message (≥20), consent                                                                                                                              |
| `newsletterSchema`                      | 18-22   | email, consent                                                                                                                                                             |
| `auditSchema` (5 steps merged)          | 25-50   | size, modality, industry, goals, contact, email, phone?, consent                                                                                                           |
| `auditRequestSchema` (6 steps merged)   | 52-103  | auditType, size, industry, companyName?, modality, **city**, **country**, scope, scopeDetail, maturity, goals, tools?, toolsOther?, contact, email, phone?, role?, consent |
| `implementationSchema` (4 steps merged) | 106-133 | type, budget (enum tranches), description (≥40), contact, email, consent                                                                                                   |
| `bookingSchema`                         | 136-143 | date (ISO regex), time (HH:MM regex), contact, email, phone?, consent                                                                                                      |

### 7.2 Champ `city` / ville — déjà présent

**`auditRequestStep3Schema`** — `forms.ts:67-73` :

```ts
export const auditRequestStep3Schema = z.object({
  modality: z.enum(["remote", "onsite"], { errorMap: () => ({ message: "Modalité requise." }) }),
  city: z.string().min(2, "Ville requise."),
  country: z.string().min(2, "Pays requis."),
});
```

**Conséquence pour audit Header** : pour pages villes, **ne pas créer un nouveau schema** — réutiliser `auditRequestStep3Schema` ou en faire dériver un `bookingByCitySchema` qui pré-remplit la ville depuis l'URL `/implantations/villes/[ville]`.

### 7.3 ABSENTS

- ❌ Aucun schema dédié à un formulaire « contact dispatch ville ».
- ❌ Aucun schema avec champ `region` (la couverture France/UE est gérée par `politique-deplacement` qui ne nécessite pas formulaire).

---

## 8. `src/content/stack-ia.ts` (HEAD) — types et doctrine

683 lignes. Page créée 2026-05-07, doctrine « arsenal sélectif » (11 outils retenus parmi 2000+).

### 8.1 Types exportés — `stack-ia.ts:10-53`

```ts
export type StackAccent = "terracotta" | "primary" | "sage" | "mocha";
export type StackCategoryId = "think" | "produce" | "capture" | "build" | "orchestrate";

export interface StackCategory {
  id: StackCategoryId;
  accent: StackAccent;
  tone: "paper" | "sand" | "halo-warm" | "halo-cool" | "canvas";
  numberLabel: string;
  fr: { eyebrow; title; titleEm; description };
  en: { eyebrow; title; titleEm; description };
}

export interface StackTool {
  id: string;
  name: string; // nom commercial
  vendor: string; // éditeur
  url: string; // site officiel (rel=nofollow noreferrer external)
  monogram: string; // 1-2 chars (ex "C", "GP", "n8")
  category: StackCategoryId;
  maturity: "standard" | "rising" | "niche";
  fr: ToolCopy;
  en: ToolCopy;
}

interface ToolCopy {
  tagline: string;
  useCase: string;
  whenToUse: ReadonlyArray<string>;
  whenToAvoid: ReadonlyArray<string>;
  combo: string;
}

export interface StackFaqItem {
  id: string;
  fr: { question; answer };
  en: { question; answer };
}
```

### 8.2 Constants exportées

- `STACK_CATEGORIES` (5 entrées) — `stack-ia.ts:60-161`.
- `STACK_TOOLS` (11 entrées : Claude, ChatGPT, Copilot 365, Granola, Perplexity, Cursor, Claude Code, v0, n8n, Vercel AI SDK, Midjourney) — `stack-ia.ts:169-602`.
- `STACK_FAQS` (5 entrées) — `stack-ia.ts:616-682`.

### 8.3 Doctrine arsenal sélectif — extraits clés

`stack-ia.ts:1-9` : commentaire en-tête —

> « La doctrine Axion-IA en 2026 : 11 outils retenus parmi 2000+, organisés par fonction métier. Choix assumés, pas catalogue neutre. Aucun partenariat commercial avec les éditeurs cités. »

`stack-ia.ts:163-168` : avant `STACK_TOOLS` —

> « 11 outils — choix assumés Axion-IA. Aucun partenariat commercial avec ces éditeurs. Si un outil est retiré, c'est qu'il est sorti de notre usage terrain, pas qu'il est mauvais en soi. »

**Implication pour audit Header** : si l'agent principal envisage d'ÉTENDRE le catalogue (ex : ajouter sous-pages `/stack-ia/[slug]`), il doit **respecter cette doctrine** — chaque ajout = revue trimestrielle, pas une simple insertion.

### 8.4 ABSENT — pas de helpers

`stack-ia.ts` n'expose **AUCUNE** fonction `getAllStackToolSlugs()` / `getStackTool(id)` / `getToolsByCategory(catId)`.

→ Si l'agent principal veut générer des pages dédiées par outil (`/stack-ia/[slug]`) ou par catégorie (`/stack-ia/categorie/[slug]`), il devra **ajouter** ces helpers en suivant la convention `transversal.ts`.

→ La page `/stack-ia/page.tsx:386-388` itère directement sur `STACK_TOOLS.filter((t) => t.category === cat.id)` — pas un helper. Pattern OK pour usage unique, mais à factoriser si dupliqué.

---

## 9. `src/app/[locale]/stack-ia/page.tsx` (HEAD) — structure page

795 lignes, **server component pur** (`async function StackIaPage`). Référence canonique pour toute nouvelle page hub.

### 9.1 Imports — `stack-ia/page.tsx:1-23`

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Info, RefreshCw, Sparkles, ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StackHeroSchema, type StackHeroNode } from "@/components/sections/StackHeroSchema";
import { ToolLogo } from "@/components/sections/ToolLogo";
import {
  STACK_CATEGORIES,
  STACK_TOOLS,
  STACK_FAQS,
  type StackAccent,
  type StackTool,
} from "@/content/stack-ia";
import { buildProductMetadata, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo";
```

**Conventions doctrinales détectées** :

- `import { Link } from "@/i18n/navigation"` — JAMAIS `import Link from "next/link"`. next-intl réécrit les hrefs.
- `setRequestLocale(locale)` — appel obligatoire avant tout rendu pour SSG strict.
- `hasLocale(routing.locales, locale)` puis `notFound()` si invalide.
- `cn` (clsx wrapper) pour classes conditionnelles.
- Icons via `lucide-react`, pas SVG inline.

### 9.2 Pattern `generateMetadata` — `stack-ia/page.tsx:29-45`

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? "/stack-ia" : "/ai-stack",
    title: locale === "fr" ? "...FR..." : "...EN...",
    description: locale === "fr" ? "...FR..." : "...EN...",
    alternates: { fr: "/stack-ia", en: "/ai-stack" },
  });
}
```

**À répliquer pour pages villes/régions** :

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const v = getVilleBySlug(ville);
  if (!v) return {};
  return buildProductMetadata({
    locale,
    path: `/implantations/villes/${ville}`,
    title:
      locale === "fr"
        ? `IA à ${v.fr.name} · cabinet Axion-IA`
        : `AI in ${v.en.name} · Axion-IA consultancy`,
    description: v[locale].description,
    alternates: {
      fr: `/implantations/villes/${ville}`,
      en: `/implantations/cities/${ville}`,
    },
  });
}
```

### 9.3 Sections de la page — composition

1. **HERO** (`page.tsx:218-297`) — section custom (pas `<Section>`), 2 colonnes, `bg-halo-warm`, `display-editorial`, titleEm serif italique terracotta.
2. **Bandeau principes** (`page.tsx:300-319`) — 4 pills doctrine sur `bg-paper border-y`.
3. **MANIFESTE** (`page.tsx:323-383`) — `<Section tone="paper">` avec eyebrow/title/titleEm/description + 3 cards.
4. **5 catégories itérées** (`page.tsx:386-547`) — `STACK_CATEGORIES.map()` → `<Section tone={cat.tone}>` chacune avec ses outils en grille.
5. **MATRICE COMBOS** (`page.tsx:550-658`) — `<Section tone="paper">` avec 6 cards combo.
6. **CE QU'ON A ÉCARTÉ** (`page.tsx:662-728`) — `<Section tone="canvas">` 6 cards.
7. **FAQ** (`page.tsx:733-748`) — `<Section tone="sand">` itérant `STACK_FAQS`. Pas d'accordion JS (server component pur, AEO-friendly).
8. **DISCLAIMER** (`page.tsx:751-759`) — bandeau légal sur `bg-bg`.
9. **CTA FINAL** (`page.tsx:762-787`) — `<CtaBlock>` `tone="dark"`.
10. **JSON-LD** (`page.tsx:789-791`) — 3 `<JsonLd data={...} />` empilés.

### 9.4 Composants réutilisables détectés

`@/components/layout/Container`, `@/components/layout/Section`, `@/components/marketing/Cta`, `@/components/sections/CtaBlock`, `@/components/sections/StackHeroSchema` (custom à `stack-ia`), `@/components/sections/ToolLogo` (custom à `stack-ia`), `@/components/marketing/JsonLd`.

→ Pour pages régions/villes, **réutiliser `Container`, `Section`, `Cta`, `CtaBlock`, `JsonLd`**. Créer éventuellement un `<RegionMap>` ou `<CityHero>` propre dans `src/components/sections/` (cohérent avec `StackHeroSchema`).

---

## 10. `axionia/AGENTS.md` — Next.js 16 spécifiques

### 10.1 Texte intégral — `axionia/AGENTS.md:1-4`

```md
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
```

### 10.2 `axionia/CLAUDE.md` — `CLAUDE.md:1`

```md
@AGENTS.md
```

C'est-à-dire : `CLAUDE.md` n'est qu'un **alias** vers `AGENTS.md`. Toute modif doit se faire sur `AGENTS.md`.

### 10.3 Conventions Next.js 16 observées dans le code

À partir de la lecture de `stack-ia/page.tsx` :

1. **`params: Promise<{ locale: string }>`** — `page.tsx:25-27`. **Params async obligatoires en Next 16**. Toute page doit `await params`.
2. **`setRequestLocale(locale)`** — `page.tsx:125`. Appel impératif avant tout rendu, vient de `next-intl/server`.
3. **`hasLocale(routing.locales, locale)`** — `page.tsx:124,31`. Type guard avant `notFound()`.
4. **Server Components par défaut** — pas de `"use client"` dans `stack-ia/page.tsx`. La FAQ est rendue en HTML statique sans JS pour AEO (cf. commentaire `page.tsx:730-732`).
5. **Pas de `Link` from `next/link`** — toujours `import { Link } from "@/i18n/navigation"`.
6. **Tailwind v4 syntax** — classes type `bg-halo-warm`, `text-terracotta-deep`, `display-editorial` viennent de `@theme` dans `globals.css`. Ne pas inventer.
7. **Documentation locale** — `node_modules/next/dist/docs/` contient `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`, `index.md`. Si l'agent principal a un doute, lire ces docs avant.

**Action attendue agent principal** : avant de proposer du code Next.js, ouvrir `node_modules/next/dist/docs/01-app/` pour vérifier les conventions actuelles. Ne pas s'appuyer sur la mémoire.

---

## 11. Cartographie cible — fichiers à CRÉER

Pour absorber les chantiers Header & Navigation (régions/villes/⌘K/IA-hub) selon ADR §9.2 et le prompt-source v1.3.

### 11.1 Contenu typé (`src/content/`)

| Chemin absolu                                                              | Type                                                                 | Helpers à exporter                                                                                                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\content\regions.ts` | `Region { slug, fr, en, villesSlugs[], lat, lng }`                   | `getAllRegionSlugs()`, `getRegionBySlug(slug)`, `REGIONS` const                                                                                           |
| `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\content\villes.ts`  | `Ville { slug, regionSlug, fr, en, lat, lng, population, isActive }` | `getAllVilleSlugs()` (filtré `isActive`), `getVilleBySlug(slug)`, `getVillesByRegion(regionSlug)`, `getNearbyVilles(slug, n)` (Haversine), `VILLES` const |

### 11.2 Pages App Router (`src/app/[locale]/`)

| Chemin absolu                                                | Rôle                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…\src\app\[locale]\implantations\page.tsx`                  | Hub implantations (carte + grille régions). Server component, `setRequestLocale`, `generateMetadata` via `buildProductMetadata`, JSON-LD `ItemList` (régions) + `Breadcrumb`.                                                                             |
| `…\src\app\[locale]\implantations\regions\[region]\page.tsx` | Page région : intro + liste villes. SSG strict via `generateStaticParams() => getAllRegionSlugs().map(s => ({region: s}))`. JSON-LD `Place` + `Breadcrumb` + `ItemList` (villes).                                                                         |
| `…\src\app\[locale]\implantations\villes\[ville]\page.tsx`   | Page ville. SSG strict via `generateStaticParams() => getAllVilleSlugs().map(s => ({ville: s}))`. JSON-LD `LocalBusiness` (areaServed) + `Breadcrumb` + `Service` (intervention sur site dans cette ville) + `FAQPage` (FAQ ville-spécifique factorisée). |

### 11.3 Composants (`src/components/sections/` ou `nav/`)

| Chemin absolu                                  | Rôle                                                                                                                | Optionnel ?                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `…\src\components\sections\RegionMap.tsx`      | Carte SVG/HTML France interactive. Pas de lib externe lourde — privilégier SVG inline ou `react-simple-maps` léger. | Recommandé.                       |
| `…\src\components\sections\CommandPalette.tsx` | ⌘K modale globale (search villes/services/cas-concrets). Client component (`"use client"`).                         | À débattre — ADR §9.2 Voie 2/3.   |
| `…\src\components\nav\MegaMenu.tsx`            | Mega-menu Header (3 colonnes Modules/Implantations/Outils). Client component si hover/keyboard interactions.        | Selon ADR §9.2 décision Voie 2/3. |

### 11.4 Lib (`src/lib/`)

| Chemin absolu      | Rôle                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `…\src\lib\geo.ts` | Helpers Haversine, `kmBetween(a, b)`, `nearestVilles(coords, list, n)`. Pur, testable. |

---

## 12. Cartographie cible — fichiers à ÉTENDRE

### 12.1 `src/lib/seo.ts` — ajouter 4 factories

Position recommandée : à la suite de `buildBreadcrumbJsonLd` (ligne 130). Signatures :

```ts
// À ajouter après seo.ts:129

interface LocalBusinessJsonLdInput {
  locale: Locale;
  name: string;
  description: string;
  /** Ville desservie (areaServed). */
  city: string;
  /** Région administrative (areaServed.containedInPlace). */
  region?: string;
  country: string;
  /** Géolocalisation pour `geo`. */
  lat?: number;
  lng?: number;
  /** URL de la page ville/région concernée. */
  path: string;
}
export function buildLocalBusinessJsonLd(input: LocalBusinessJsonLdInput) {
  /* ... */
}

interface PlaceJsonLdInput {
  locale: Locale;
  name: string;
  description: string;
  containedInPlace?: string; // pays
  lat?: number;
  lng?: number;
}
export function buildPlaceJsonLd(input: PlaceJsonLdInput) {
  /* ... */
}

interface ItemListJsonLdInput {
  name: string;
  items: ReadonlyArray<{ url: string; name: string; description?: string }>;
}
export function buildItemListJsonLd(input: ItemListJsonLdInput) {
  /* ... */
}

interface OrganizationJsonLdInput {
  locale: Locale;
}
export function buildOrganizationJsonLd(input: OrganizationJsonLdInput) {
  /* ... */
}
```

### 12.2 `src/i18n/routing.ts` — ajouter entrées

Position : à insérer **avant** la section légales (`routing.ts:124`), groupé avec les transversales.

```ts
// Module 4 — Implantations (régions/villes)
"/implantations": { fr: "/implantations", en: "/locations" },
"/implantations/regions/[region]": {
  fr: "/implantations/regions/[region]",
  en: "/locations/regions/[region]",
},
"/implantations/villes/[ville]": {
  fr: "/implantations/villes/[ville]",
  en: "/locations/cities/[ville]",
},

// Hub IA & Solutions (ADR §9.2 Voie 2/3 — si retenu)
"/ia": { fr: "/ia", en: "/ai" },
```

### 12.3 `src/app/sitemap.ts` — ajouter imports + entries

À l'import (`sitemap.ts:3-13`) :

```ts
import { getAllRegionSlugs } from "@/content/regions";
import { getAllVilleSlugs } from "@/content/villes";
```

Dans `buildDynamic` array (`sitemap.ts:122-189`), ajouter :

```ts
{
  fr: "/implantations/regions/:slug",
  en: "/locations/regions/:slug",
  slugs: getAllRegionSlugs(),
  changeFrequency: "monthly",
  priority: 0.6,
},
{
  fr: "/implantations/villes/:slug",
  en: "/locations/cities/:slug",
  slugs: getAllVilleSlugs(),
  changeFrequency: "monthly",
  priority: 0.5,
},
```

### 12.4 `src/app/robots.ts` — possiblement étendre

**Ne pas modifier** sauf si pages villes filtrées (densité < seuil) doivent être bloquées explicitement. Préférence : SSG strict ne génère que les villes éligibles → robots.ts inchangé.

### 12.5 `src/messages/{fr,en}.json` — ajouter sections

```json
"nav": {
  ...,
  "implantations": "Implantations",   // FR
  "ia": "IA & Solutions"               // FR
}
"footer": {
  ...,
  "implantations": "Implantations"    // colonne footer
}
```

EN miroir : `"locations"` / `"AI & Solutions"`.

### 12.6 `src/components/nav/Footer.tsx` — colonne Implantations

Position : **NE PAS ajouter** une 5e colonne (le grid est `md:grid-cols-4`). Préférer :

- intégrer `/implantations` à la colonne `services` (`Footer.tsx:15-23`) en 5e item, OU
- intégrer à `resources` (`Footer.tsx:24-30`) à côté de `/stack-ia`.

→ Option B recommandée (cohérence éditoriale : implantations = ressource pSEO, pas service).

### 12.7 `src/components/nav/Header.tsx` — décision ADR §9.2

3 voies possibles selon ADR :

- **Voie 1** (statu-quo) : 4 nav items inchangés. Implantations cachées dans footer + ⌘K.
- **Voie 2** (intégration douce) : remplacer `/cas-concrets` par `/ia` (hub) qui contient sub-link `/implantations`. Risque : perdre la visibilité directe des cas concrets.
- **Voie 3** (mega-menu) : passer `/implementation` en mega-menu desktop. Header garde 4 items mais 1 devient dropdown. Cohérent avec doctrine premium 2026 (Stripe, Anthropic).

→ **L'agent principal doit présenter ces 3 voies à Will, pas trancher seul**. Le prompt source PROMPT-HEADER-NAVIGATION-2026 §9.2 pose explicitement la question.

---

## 13. Cartographie cible — fichiers à NE PAS toucher

| Fichier                                                                               | Raison                                                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/components/marketing/JsonLd.tsx`                                                 | Signature stable, dépendance de 67 fichiers. Toute modif = test rouge.                                |
| `src/components/marketing/JsonLd.test.tsx`                                            | Idem (test associé).                                                                                  |
| `axionia/CLAUDE.md` / `axionia/AGENTS.md`                                             | Direction visuelle commitée 2026-05-07 (cf. memory `axionia_design_pivot.md`). Modif = ADR explicite. |
| `src/app/globals.css`                                                                 | Typographie doctrine v3 stable. Pas pour cet audit.                                                   |
| `src/i18n/navigation.ts`                                                              | next-intl wrapper. Ne pas réécrire.                                                                   |
| `src/content/interventions.ts` `src/content/audit.ts` `src/content/implementation.ts` | Module 1/2/3 verrouillés copywriting. Touch only `summary` si vraiment nécessaire et justifié.        |
| `src/content/stack-ia.ts`                                                             | Doctrine arsenal sélectif — ajouter un outil = revue trimestrielle, pas insertion silencieuse.        |
| `src/lib/seo.ts:6-129` (factories existantes)                                         | **Étendre** seulement (ajouter à la fin), ne pas modifier les signatures.                             |
| Pages `cas-concrets/[slug]`, `blog/[slug]`, `comparaisons/[slug]` etc.                | Templates SSG mature, ne pas régresser.                                                               |

---

## 14. Anti-patterns à signaler à l'agent principal

### 14.1 ❌ Créer `src/data/regions.json` ou `villes.json`

**Pourquoi c'est un anti-pattern** : la convention codebase est TS typé (cf. les 10 fichiers `src/content/*.ts` au §1). JSON casse :

- typage fort (autocomplete, refactor sécurisé) ;
- helpers `getAllXxxSlugs()` ;
- parité FR/EN typée (Zod-like via TS structural).

**Faire à la place** : `src/content/regions.ts`, `src/content/villes.ts`.

### 14.2 ❌ Créer un composant `<LocalBusinessSchema>` ou `<CityJsonLd>`

**Pourquoi** : le composant `JsonLd.tsx` est unique et stable. Variantiser duplique la logique `dangerouslySetInnerHTML`.

**Faire à la place** : `buildLocalBusinessJsonLd()` dans `lib/seo.ts` + `<JsonLd data={localBusiness} />` dans la page.

### 14.3 ❌ Créer `src/app/sitemap-villes.ts` (sitemap parallèle)

**Pourquoi** : Next.js charge UN seul `sitemap.ts` à la racine `app/`. Un fichier parallèle ne sera pas servi.

**Faire à la place** : étendre les `buildDynamic` entries dans `app/sitemap.ts:121-192`.

### 14.4 ❌ Hardcoder les slugs dans la page (ex : `["paris", "lyon", "marseille"]`)

**Pourquoi** : `routing.pathnames` est la source de vérité. `[slug]` template + `generateStaticParams()` lit `getAllVilleSlugs()`.

**Faire à la place** :

```ts
export async function generateStaticParams() {
  return getAllVilleSlugs().map((ville) => ({ ville }));
}
```

### 14.5 ❌ SSR (`force-dynamic`) sur pages villes

**Pourquoi** : 3500+ villes en SSR ruinent les perfs. La doctrine est SSG strict (cf. perfs ADR `_AUDIT/AUDIT-FRONTEND-V14-2026-E.md` perf budget).

**Faire à la place** : SSG via `generateStaticParams`. Si vraiment trop volumineux, ISR avec `revalidate: 86400` (24h).

### 14.6 ❌ Créer un système i18n parallèle (ex : `src/i18n/cities.ts`)

**Pourquoi** : `routing.pathnames` est l'unique config next-intl. Les **labels** localisés vont dans `messages/{fr,en}.json` ou dans la struct `Ville { fr, en }`. Les **slugs** dans `routing.pathnames`.

**Faire à la place** : labels dans `Ville { fr: { name, description }, en: { name, description } }` directement dans `content/villes.ts`. Pas de fichier i18n parallèle.

### 14.7 ❌ Ajouter Algolia Cloud sans avoir évalué Pagefind

**Pourquoi** : ADR Sprint 14 (à confirmer) priorise les solutions self-hosted UE (Pagefind statique, MeiliSearch sur Hetzner). Algolia = SaaS US = sortie de souveraineté assumée par Axion-IA OÜ (cf. `legal.ts:218-226` politique de confidentialité, et `press.ts:259-263` souveraineté UE par défaut).

**Faire à la place** : présenter à Will un comparatif Pagefind / MeiliSearch / Typesense self-hosted AVANT de proposer Algolia.

### 14.8 ❌ Importer `Link` from `next/link`

**Pourquoi** : casse l'i18n (next-intl réécrit les hrefs via `routing.pathnames`).

**Faire à la place** : `import { Link } from "@/i18n/navigation"` (cf. `stack-ia/page.tsx:7`).

### 14.9 ❌ Réécrire `slugify`

**Pourquoi** : 2 implémentations existent déjà — `slugify` exporté `transversal.ts:365-374` et `caseSlugify` privée à `case-studies.ts:213-220`.

**Faire à la place** : `import { slugify } from "@/content/transversal"`.

### 14.10 ❌ Oublier `setRequestLocale(locale)` ou `await params`

**Pourquoi** : Next.js 16 + next-intl exige les deux. Sans `setRequestLocale`, traductions cassent. Sans `await params`, runtime error.

**Faire à la place** : pattern `stack-ia/page.tsx:122-127` à dupliquer rigoureusement.

---

## 15. Patterns à réutiliser (extraits code)

### 15.1 Pattern `buildDynamic` du sitemap — `sitemap.ts:64-100,121-192`

**Comment ajouter villes/régions** (modèle exact à respecter) :

```ts
// Dans sitemap.ts:121-192, ajouter dans le tableau passé à buildDynamic :
{
  fr: "/implantations/regions/:slug",
  en: "/locations/regions/:slug",
  slugs: getAllRegionSlugs(),       // import depuis @/content/regions
  changeFrequency: "monthly",
  priority: 0.6,
},
{
  fr: "/implantations/villes/:slug",
  en: "/locations/cities/:slug",
  slugs: getAllVilleSlugs(),        // import depuis @/content/villes
  changeFrequency: "monthly",
  priority: 0.5,
},
```

Le helper `buildDynamic` (`sitemap.ts:74-100`) consume ce tableau et émet automatiquement les 2 entries (FR + EN) avec `alternates.languages` complet. **Aucune logique custom à écrire**.

### 15.2 Pattern `getAllXxxSlugs()` — `transversal.ts:196-226`

**Référence canonique** :

```ts
// transversal.ts:196-198
export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

// transversal.ts:200-203
export function getAllBlogCategorySlugs(): string[] {
  const cats = new Set(BLOG_POSTS.map((p) => slugify(p.category)));
  return [...cats];
}

// transversal.ts:205-207
export function getBlogPostsByCategory(slug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => slugify(p.category) === slug);
}

// transversal.ts:209-212
export function getBlogCategoryLabel(slug: string): string | undefined {
  const found = BLOG_POSTS.find((p) => slugify(p.category) === slug);
  return found?.category;
}
```

**À répliquer pour villes** (à créer dans `content/villes.ts`) :

```ts
import { slugify } from "@/content/transversal";

export interface Ville {
  slug: string;
  regionSlug: string;
  lat: number;
  lng: number;
  population: number;
  isActive: boolean;
  fr: { name: string; description: string };
  en: { name: string; description: string };
}

export const VILLES: ReadonlyArray<Ville> = [
  /* ... */
];

export function getVilleBySlug(slug: string): Ville | undefined {
  return VILLES.find((v) => v.slug === slug);
}

export function getAllVilleSlugs(): string[] {
  return VILLES.filter((v) => v.isActive).map((v) => v.slug);
}

export function getVillesByRegion(regionSlug: string): Ville[] {
  return VILLES.filter((v) => v.isActive && v.regionSlug === regionSlug);
}
```

### 15.3 Pattern `buildProductMetadata` — `seo.ts:6-47` + usage `stack-ia/page.tsx:29-45`

**Exact signature** (`seo.ts:6-14`) :

```ts
interface ProductSeoInput {
  locale: Locale;
  /** Localized pathname WITHOUT locale prefix, e.g. /interventions/essentielle. */
  path: string;
  title: string;
  description: string;
  /** Optional alternate path per-locale; defaults to `path`. */
  alternates?: Partial<Record<Locale, string>>;
}
```

**Usage canonique** (`stack-ia/page.tsx:29-45`) :

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? "/stack-ia" : "/ai-stack",
    title: locale === "fr" ? "...FR..." : "...EN...",
    description: locale === "fr" ? "...FR..." : "...EN...",
    alternates: { fr: "/stack-ia", en: "/ai-stack" },
  });
}
```

**À répliquer pour pages villes** (template) :

```tsx
import { getVilleBySlug } from "@/content/villes";

interface Props {
  params: Promise<{ locale: string; ville: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const v = getVilleBySlug(ville);
  if (!v) return {};
  return buildProductMetadata({
    locale,
    path: `/implantations/villes/${ville}`,
    title:
      locale === "fr"
        ? `Cabinet IA opérationnel à ${v.fr.name} · Axion-IA`
        : `Operational AI consultancy in ${v.en.name} · Axion-IA`,
    description: v[locale].description,
    alternates: {
      fr: `/implantations/villes/${ville}`,
      en: `/locations/cities/${ville}`,
    },
  });
}

export async function generateStaticParams() {
  return getAllVilleSlugs().map((ville) => ({ ville }));
}
```

### 15.4 Pattern `buildBreadcrumbJsonLd` — `seo.ts:113-129` + usage `stack-ia/page.tsx:179-188`

**Usage** :

```tsx
const breadcrumb = buildBreadcrumbJsonLd({
  locale: loc,
  items: [
    { name: isFr ? "Accueil" : "Home", href: "/" },
    { name: isFr ? "Implantations" : "Locations", href: isFr ? "/implantations" : "/locations" },
    {
      name: isFr ? `Région ${region.fr.name}` : `${region.en.name} region`,
      href: isFr ? `/implantations/regions/${region.slug}` : `/locations/regions/${region.slug}`,
    },
    { name: ville.fr.name, href: `/implantations/villes/${ville.slug}` },
  ],
});

// ...puis en bas du JSX :
<JsonLd data={breadcrumb} />;
```

### 15.5 Pattern `<JsonLd>` empilé — `stack-ia/page.tsx:789-791`

```tsx
<JsonLd data={breadcrumb} />
<JsonLd data={localBusinessJsonLd} />
<JsonLd data={faqJsonLd} />
```

3 emplacements canoniques : tout en bas du `return <>...</>` du Server Component, juste avant `</>`. Pas dans le `<head>` directement (Next.js 16 hoist auto).

---

## 16. Gaps détectés (à arbitrer par l'agent principal)

| #   | Gap                                                                                                                                           | Recommandation                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| G1  | `src/lib/seo.ts` n'a PAS `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildOrganizationJsonLd`                     | À créer dans `lib/seo.ts` (cf. §12.1)                                                                                     |
| G2  | `src/lib/geo.ts` (Haversine) inexistant                                                                                                       | À créer pour `getNearbyVilles`                                                                                            |
| G3  | `src/content/stack-ia.ts` n'expose pas `getAllStackToolSlugs()` / `getStackTool(id)` / `getToolsByCategory(catId)`                            | À créer SI l'agent principal envisage `/stack-ia/[slug]`. Sinon, attendre.                                                |
| G4  | `routing.pathnames` n'a aucune entrée `/implantations`, `/ia`, `/recherche`-with-params                                                       | À ajouter (cf. §12.2)                                                                                                     |
| G5  | `src/app/sitemap.ts` ne contient AUCUNE entry `buildDynamic` pour `/implementation/par-fonction/[slug]` (déjà dans `routing.pathnames:74-77`) | **Bug pré-existant**. À corriger en plus du chantier régions/villes.                                                      |
| G6  | `src/app/sitemap.ts` ne contient AUCUNE entry pour `/presse/[slug]`                                                                           | À créer si Sprint correctif 14.6 livre les pages détails (HEAD a uniquement le hub `/presse`).                            |
| G7  | `src/lib/seo.ts` redéclare `SITE_URL` que `sitemap.ts:15` redéclare aussi                                                                     | Cleanup léger : exporter `SITE_URL` une seule fois (déjà fait depuis `seo.ts:4`), `sitemap.ts` doit l'importer.           |
| G8  | Pas de schema Zod « contact ville »                                                                                                           | Possible réutilisation de `auditRequestStep3Schema` qui contient déjà `city` + `country` (`forms.ts:67-73`).              |
| G9  | Pas de composant `<MegaMenu>` pour Header                                                                                                     | À créer SI ADR §9.2 retient Voie 3.                                                                                       |
| G10 | Pas de composant `<CommandPalette>` (⌘K)                                                                                                      | À créer SI ADR §9.2 retient l'augmentation ⌘K. Doctrine premium 2026 (Stripe, Linear, Anthropic, Vercel) suggère **oui**. |
| G11 | `src/messages/{fr,en}.json` sections `nav` et `footer` sans clés `implantations`, `ia`                                                        | À étendre (cf. §12.5)                                                                                                     |
| G12 | `src/components/nav/Footer.tsx` grid `md:grid-cols-4` figé                                                                                    | Ne pas ajouter 5e colonne, intégrer aux colonnes existantes (`resources` recommandé)                                      |
| G13 | `src/components/nav/Header.tsx` 4 items hardcodés `navLeft + navRight`                                                                        | ADR §9.2 — décision Voie 1/2/3 à présenter à Will avant code                                                              |

---

## 17. Recommandations finales pour l'agent principal

1. **Lire en premier** `node_modules/next/dist/docs/01-app/` pour valider les conventions Next.js 16 (params async, server components, `generateStaticParams`).
2. **Présenter les 3 voies ADR §9.2** à Will (Header statu-quo / intégration douce / mega-menu) **avant** d'écrire la moindre ligne de Header.
3. **Toute extension SEO/JSON-LD passe par `lib/seo.ts`** — pas de composant variant, pas de helper inline dupliqué.
4. **Toute nouvelle route est déclarée dans `routing.pathnames`** AVANT d'être créée comme page (Sprint 2 doctrine).
5. **Réutiliser `slugify` exporté de `transversal.ts:365`**, `SITE_URL` de `seo.ts:4`, `Locale` de `routing.ts:140`.
6. **SSG strict** sur villes/régions via `generateStaticParams`. Pas de `force-dynamic`.
7. **Server components par défaut** — pas de `"use client"` sauf interaction (CommandPalette, MegaMenu hover).
8. **FAQ et listes en HTML statique** (pas d'accordion JS) pour AEO/GEO — cf. `stack-ia/page.tsx:730-732`.
9. **`<JsonLd>` empilé en bas de page** — 3-4 schemas typiques : Breadcrumb + LocalBusiness + FAQ + ItemList.
10. **Le contenu villes/régions a sa parité FR/EN typée** dans la struct `Ville { fr: {...}, en: {...} }` — pas de fichier i18n parallèle, pas de JSON.

---

_Fin du livrable Agent E. 1 130 lignes. Lecture seule appliquée._
