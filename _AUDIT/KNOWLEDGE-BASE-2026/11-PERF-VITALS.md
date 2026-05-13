# 11 — PERFORMANCE & WEB VITALS — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § Agent 11 (~ ligne 324).
> Agent : 11 — Performance & Web Vitals (parallèle Phase A).
> Date : 2026-05-13
> Statut : AUDIT-ONLY (Phase A — aucun code modifié).
> Référence code : HEAD `main` (post-Booking V1 merge `fa093e5`).
> SSOT budgets : `AGENTS.md` (LCP ≤ 1800 ms / INP ≤ 100 ms / CLS = 0 / TBT ≤ 150 ms / First Load JS ≤ 75 KB gz) + `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.

---

## 0. TL;DR

- **Verdict perf** : la KB **peut tenir** les budgets `AGENTS.md` (LCP ≤ 1800 ms / INP ≤ 100 ms / CLS = 0 / First Load JS ≤ 75 KB gz) sous **3 conditions dures** :
  1. **Tiptap reste 100 % admin-only.** Le bundle public dérive de `bodyJson` via un helper SSR pur (`renderTiptapJsonToReact`) qui n'importe **aucun package `@tiptap/*`** côté client public.
  2. **SSG/ISR** par défaut sur toutes les routes KB publiques (zéro SSR par requête).
  3. **`<Image>` Next 16 strict** avec `priority` réservé au cover LCP, dimensions explicites partout (CLS = 0).
- **Gap critique vs existant** : `package.json` ne déclare **pas** `@tiptap/html` ni `html-react-parser` ni équivalent. Le helper SSR n'existe pas → Sprint KB-6 (Public surface) doit l'introduire OU on dérive du `bodyHtml` (déjà persisté par `TiptapEditor` C4, hidden input `${name}_html`) via composant SSR + sanitization stricte côté serveur.
- **Configuration `size-limit` actuelle hors-budget** : `package.json` ligne 162-167 fixe `100 KB` global au lieu de `75 KB gz par route`. Le KB doit imposer un budget **par route** (pattern AGENTS.md), pas global glob `chunks/**/*.js`.
- **`loading.tsx` manquant** sur `centre-aide/`, `blog/`, `cas-concrets/`, `faq/` (vérifié : seuls `audit/`, `contact/`, `implantations/[region]/[ville]/`, `reserver/`, root `[locale]/` en ont un). KB doit obligatoirement en livrer un par route publique pour streaming + Skeleton CLS-zero.

---

## 1. BUDGET JS PAR ROUTE KB PUBLIQUE — ≤ 75 KB gz First Load

### 1.1 Décomposition cible (AGENTS.md § Performance budget)

| Composant                                                                               | Budget gz      | Source                                                                                         |
| --------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| **Shell Next 16 (framework + runtime)**                                                 | ~ 38 KB gz     | framework chunk + main + webpack runtime (mesuré HEAD `main` sur `/interventions` p75 ≈ 39 KB) |
| **App-wide common** (Header terracotta + Footer + `next-intl` + i18n messages courants) | ~ 20 KB gz     | partagé par toutes les routes                                                                  |
| **Route-specific page chunk**                                                           | **≤ 17 KB gz** | renderer SSR pur + JSON-LD + composants spécifiques KB                                         |
| **TOTAL First Load JS**                                                                 | **≤ 75 KB gz** | budget AGENTS.md respecté                                                                      |

> Marge réelle pour la page KB elle-même = ~17 KB gz. **Compte tenu de ce budget**, **ZÉRO import client de `@tiptap/*`** ne peut être toléré côté public — `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/pm` pèsent ~ 90-120 KB gz combinés ; les charger côté public mangerait > 100 % du budget global.

### 1.2 Exception KB autorisée : `/mes-ressources/` (client surface)

- Surface client connectée (NextAuth session) → budget aligné sur exception `/reserver` AGENTS.md : **First Load JS ≤ 110 KB gz, INP ≤ 150 ms**.
- Charger des filtres facettes interactifs (combobox tags, search-as-you-type) est OK ici.
- **Toujours pas d'éditeur Tiptap** (consultation seule côté client final ; les rédacteurs passent par `/[adminPrefix]/connaissances/`).

### 1.3 Gate CI (gate PR)

- **`pnpm bundle:check`** (size-limit) : **+ 5 KB gz max** vs `main` (cap AGENTS.md). Sprint KB-18 (tests/obs) modifie `package.json` `size-limit` pour cibler par route :

```jsonc
// Proposition Sprint KB-18 (NE PAS écrire en Phase A) :
"size-limit": [
  { "name": "KB hub /ressources", "path": ".next/server/app/[locale]/ressources/page.js", "limit": "75 KB" },
  { "name": "KB detail /ressources/[type]/[slug]", "path": ".next/server/app/[locale]/ressources/[type]/[slug]/page.js", "limit": "75 KB" },
  { "name": "Blog detail (legacy migré)", "path": ".next/server/app/[locale]/blog/[slug]/page.js", "limit": "75 KB" },
  // ... 6 routes pivot
]
```

- **`pnpm lhci`** : Lighthouse CI sur 6 routes pivot KB (cf. § 9).

---

## 2. STRATÉGIE DE RENDU PAR TYPE D'ENTRÉE

### 2.1 Matrice SSG / ISR / SSR

| Cible                                                                        | Type d'entrée                                        | Rendu                                                                                                          | `revalidate`                | Justification                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `/ressources/[type]/[slug]`                                                  | entrée **publiée stable** (`publishedAt < now - 7d`) | **SSG** (build-time)                                                                                           | —                           | Long-tail SEO. Build cache imbattable (LCP ≤ 600 ms via Cloudflare edge). |
| `/ressources/[type]/[slug]`                                                  | entrée **récente** (`publishedAt >= now - 7d`)       | **ISR**                                                                                                        | `revalidate: 3600`          | Fraîcheur sans rebuild full (~ 2150 villes + KB = build long, on évite).  |
| `/ressources` (hub)                                                          | liste filtrable                                      | **ISR**                                                                                                        | `revalidate: 3600`          | Nouvelles entrées visibles ≤ 1h sans publish hook.                        |
| `/ressources/[type]` (sous-hub `case-study`, `faq`, `help`, etc.)            | liste typée                                          | **ISR**                                                                                                        | `revalidate: 3600`          | idem.                                                                     |
| `/blog/*`, `/cas-concrets/*`, `/centre-aide/*`, `/faq/*` (legacy migré KB-2) | identique selon âge                                  | SSG/ISR                                                                                                        | `revalidate: 3600`          | Préserve URLs HEAD (cf. `00-REALITY-CHECK.md` § 3.1).                     |
| `/mes-ressources/` (client connecté)                                         | dashboard personnalisé                               | **SSR** (auth session)                                                                                         | `dynamic = 'force-dynamic'` | Personnalisation session-based, **seule surface SSR autorisée**.          |
| `/mes-ressources/[slug]` (consultation entrée tagée client)                  | mix                                                  | **SSR** uniquement si `audience='client_specific'` ; sinon redirige vers `/ressources/[type]/[slug]` (SSG/ISR) | —                           | Évite SSR inutile pour entrées publiques également accessibles.           |

### 2.2 On-demand revalidation (publish/update/unpublish)

Server action `publishEntry` (Sprint KB-4) **doit** appeler :

```ts
// Sprint KB-4 / KB-6 — à implémenter, NE PAS écrire en Phase A
import { revalidatePath, revalidateTag } from "next/cache";

// Tags ciblés :
revalidateTag(`kb-entry-${entry.id}`); // détail entrée
revalidateTag(`kb-list`); // hub /ressources
revalidateTag(`kb-feed-${entry.type}`); // RSS feeds typés
revalidateTag(`kb-author-${entry.authorId}`); // facette auteur
revalidateTag(`kb-domain-${entry.domain}`); // facette domaine

// Paths legacy migrés (cf. AGENTS reality 3.1) :
revalidatePath(`/[locale]/ressources/${entry.type}/${entry.slug}`, "page");
revalidatePath(`/[locale]/ressources`, "page");
if (entry.type === "article") revalidatePath(`/[locale]/blog/${entry.slug}`, "page");
if (entry.type === "case_study") revalidatePath(`/[locale]/cas-concrets/${entry.slug}`, "page");
if (entry.type === "help") revalidatePath(`/[locale]/centre-aide/${entry.slug}`, "page");
if (entry.type === "faq") revalidatePath(`/[locale]/faq`, "page");
if (entry.type === "glossary_term") revalidatePath(`/[locale]/glossaire`, "page");
```

**Cache `fetch()` tags** : tous les `prisma.knowledgeEntry.findMany/findUnique` côté pages publiques doivent passer par un helper `getEntry(id|slug)` qui wrap avec `unstable_cache(fn, key, { tags: [`kb-entry-${id}`, 'kb-list'] })`. Sprint KB-6 livrable.

### 2.3 SSR jamais ailleurs

- **Anti-pattern** : `export const dynamic = 'force-dynamic'` sur une page KB publique = rejet auto en review.
- **Anti-pattern** : appeler `cookies()` ou `headers()` côté page publique KB (force SSR). Si besoin de A/B test, **Cloudflare Workers / split routing**, jamais SSR Next.

---

## 3. HYDRATATION — Tiptap RÈGLE DURE

### 3.1 État actuel (HEAD `main`)

- `src/components/admin/TiptapEditor.tsx` est `"use client"` (StarterKit), utilisé par **3 forms admin** (`BlogForm`, `CaseStudyForm`, `HelpForm`) et **seulement là**.
- Aucune page publique ne `import` de `@tiptap/*` aujourd'hui (vérifié : grep `@tiptap` retourne 6 fichiers, tous admin + le composant lui-même).
- Persistance Sprint 24 C4 : hidden inputs `${name}_html` + `${name}_json` + `${name}_text` → côté admin save, on stocke les 3 dans `*Translation.body` (HTML), `bodyJson`, `bodyText`.

### 3.2 Règle KB (doctrine intouchable)

> **Aucun fichier sous `src/app/[locale]/{blog,cas-concrets,centre-aide,faq,glossaire,guide-ia,ressources,mes-ressources}/**`** ne doit `import`depuis`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-\*`, ou tout package commençant par `@tiptap/`.

Gate CI proposé Sprint KB-18 : étendre `pnpm use-client:check` avec un test dédié `pnpm tiptap-public:check` qui parse les imports et fail si match.

### 3.3 Helper SSR pur — `renderTiptapJsonToReact(json)`

Sprint KB-6 livre **un** helper SSR (pas de `"use client"`) :

```
src/lib/knowledge/render-tiptap.tsx  ← Server Component (no "use client")
```

**API** :

```ts
export function renderTiptapJsonToReact(
  doc: TiptapDoc,
  options?: { headingIdPrefix?: string; linkInternalPredicate?: (href: string) => boolean },
): React.ReactNode;
```

**Mapping nodes → React server components** :

| Tiptap node                               | Sortie React                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `doc`                                     | fragment                                                                                                               |
| `paragraph`                               | `<p>`                                                                                                                  |
| `heading` (level 2-4)                     | `<h2/3/4 id={slugifiedText}>` (id = ancre TOC, slugify SSR)                                                            |
| `bulletList` / `orderedList` / `listItem` | `<ul>` / `<ol>` / `<li>`                                                                                               |
| `blockquote`                              | `<blockquote>`                                                                                                         |
| `codeBlock` (V1.5)                        | `<pre><code class="language-…">` + Shiki SSR (V1.5 seulement, pas V1)                                                  |
| `horizontalRule`                          | `<hr>`                                                                                                                 |
| `image` (Sprint KB-3 extension)           | `<Image>` Next (cf. § 5) — **jamais `<img>` bruté**                                                                    |
| `link` (Sprint KB-3 extension)            | `<Link>` interne si `linkInternalPredicate(href)`, sinon `<a target="_blank" rel="noopener nofollow">` (selon domaine) |
| `text` (marks: bold/italic/strike/code)   | `<strong>`/`<em>`/`<s>`/`<code>`                                                                                       |

**Avantages vs `@tiptap/html generateHTML` server-side + `html-react-parser`** :

1. Zéro dépendance runtime additionnelle (`@tiptap/html` requiert le bundle Tiptap server-side → même si SSR-only c'est ~ 80 KB côté Node, augmente cold start).
2. Mapping React natif → `<Image>` et `<Link>` Next utilisables directement (pas de remplacement DOM-string).
3. Sanitization built-in (whitelist nodes/marks ; pas de `<script>` ou attributs `on*`).

**Alternative refusée** : `dangerouslySetInnerHTML={{ __html: bodyHtml }}`. Justifications :

- Pas de remplacement `<img>` → `<Image>` (LCP/CLS dégradé).
- Pas de prefetch `<Link>`.
- Sanitization manuelle requise (`isomorphic-dompurify` = +10 KB gz, et **côté serveur** OK mais à ajouter en dep).
- Pas de génération d'ancre TOC.

**Décision Phase A — recommandation forte** : `renderTiptapJsonToReact` custom (≤ 200 lignes), zéro dépendance externe.

### 3.4 Cohabitation avec `bodyHtml` persisté

Le champ `KnowledgeTranslation.bodyHtml` reste persisté (cohérent triple-persistance C4) mais sert UNIQUEMENT à :

- **RSS feed XML** (Sprint KB-15 multi-format).
- **Newsletter HTML email** (Sprint KB-15).
- **Indexation FTS de fallback** si bodyText vide.

**Le rendu public passe TOUJOURS par `bodyJson`** (cf. § 3.3) — pas `bodyHtml`.

---

## 4. COMPOSANT `EntryRenderer.tsx` — SSR PUR

**Path** : `src/components/knowledge/public/EntryRenderer.tsx` (Server Component, no `"use client"`).

**Responsabilité** : prend une `KnowledgeEntry` enrichie (avec `translation`), render :

1. **Hero** (titre + lead + breadcrumbs + cover via `<Image>` LCP).
2. **Author block** (E-E-A-T — délégué Agent 12 ; ici on rend juste avatar `<Image>` + nom + date).
3. **TOC** (extraite côté serveur depuis `bodyJson` — headings level 2-4).
4. **Body** via `renderTiptapJsonToReact(translation.bodyJson)`.
5. **Citations / sources** (footer entrée si `entry.sources`).
6. **CTA** (depuis SSOT `pricing.ts` — réutilise `INTERVENTION_TIERS`).
7. **JSON-LD** (Article / FAQPage / HowTo selon `entry.type` — délégué Agent 6).
8. **Related** (server-side query `prisma.knowledgeRelation` — pas client).

**Anti-anti-pattern** :

- **Aucun `useState`/`useEffect`** dans ce composant.
- **Aucun `import { ... } from '@tiptap/*'`**.
- Toutes les images via `<Image>`.
- Tous les liens via `<Link>` de `@/i18n/navigation`.

---

## 5. IMAGES — `<Image>` Next 16

### 5.1 Règles

- **Cover image (LCP candidate)** : `<Image priority fetchPriority="high" />` — UN SEUL `priority` par page (le cover).
- **Toutes les autres** (illustrations inline, related cards, author avatar) : **lazy par défaut** (default Next 16, `loading="lazy"`).
- **`sizes` responsive obligatoire** : exemple cover desktop dominant :

```tsx
<Image
  src={coverSrc}
  alt={altText} // jamais vide (cf. Agent 12 — bloquant publish)
  width={1200}
  height={630}
  priority
  fetchPriority="high"
  sizes="(min-width: 1024px) 800px, (min-width: 768px) 720px, 100vw"
  className="rounded-lg"
/>
```

- **Formats** : Next 16 `next.config.ts` `images.formats: ['image/avif', 'image/webp']` (à vérifier HEAD — Sprint KB-11 doit confirmer). Fallback JPEG/PNG auto.
- **CDN** : Cloudflare Image Resizing **désactivé** (plan Free, payant). On reste sur `next/image` natif + Caddy cache (mémoire `axionia_hosting_hetzner`).
- **Dimensions explicites obligatoires** (`width`/`height` ou `fill` + parent contained) — gate CLS = 0.

### 5.2 Hero schema fallback (pas d'image)

Si entrée KB sans cover, **réutiliser `DetailHeroSchema`** (mémoire `axionia_visual_rhythm_sprint_AB_2026-05-07`) — SVG inline pas de payload image. **Surtout pas d'image floue placeholder** (cause de LCP qualifiable + CLS quand image arrive).

### 5.3 Pipeline d'upload (cohérent Agent 13)

Cover généré par sharp en variantes `320/640/1024/1920/3840 × {avif, webp, jpeg}` au moment de l'upload (Sprint KB-11). On stocke les chemins ; `<Image>` génère le srcset automatiquement. **Variante 1200×630** pré-générée pour `og:image` (cohérent JSON-LD Agent 6).

---

## 6. LIENS — `<Link>` PREFETCH

- `<Link>` de `@/i18n/navigation` (next-intl) = `prefetch={true}` par défaut (Next 16 défaut).
- **Pas désactiver** sauf pour liens cross-domain externe (pas un `<Link>`, c'est un `<a>`).
- **Anti-pattern** : `<Link prefetch={false}>` sur des liens internes hot — sauf si la cible est elle-même SSR force-dynamic (rare en KB).
- **Speculation Rules eager** (cf. mémoire `axionia_perf_audit_2026-05-07`) : **désactivé** en KB. Les pages sont SSG/ISR, prefetch standard Next suffit. Eager spec rules avait causé lenteur nav onglets/CTA — pas réintroduire.

---

## 7. FONTS

- Déjà optimisées Axion-IA (mémoire `axionia_typography_v3_2`) : `next/font/google` + `display: 'swap'` + preload latin subset.
- FOIT/FOUT évité (mémoire confirmée).
- **KB n'introduit aucune nouvelle font.** Si éditorial veut un caractère exotique (ex: monospace alternatif pour code blocks V1.5), **STOP & ASK Will** + ADR (impacterait First Load).

---

## 8. TOC STICKY — SANS JS LOURD

### 8.1 Pattern recommandé

- **Sticky CSS pure** : `position: sticky; top: 80px;` (offset Header terracotta) — zéro JS pour le sticky lui-même.
- **Génération côté serveur** : `renderTiptapJsonToReact` traverse les headings et émet `<h2 id="…">`. Un helper `extractTocFromTiptap(json)` produit la liste TOC server-side (Sprint KB-6).
- **Highlighting actif** = IntersectionObserver client minuscule, **isolé dans un composant client `TocHighlighter.tsx`** (`use-client`, ~ 1 KB gz post-tree-shake).

```tsx
// Sprint KB-6 — schéma à implémenter, NE PAS écrire en Phase A
// src/components/knowledge/public/TableOfContents.tsx — SSR
export function TableOfContents({ items }: { items: TocItem[] }) {
  return (
    <nav aria-label="Table des matières" className="sticky top-20 hidden lg:block">
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`}>{it.text}</a>
          </li>
        ))}
      </ul>
      {/* hydrate uniquement le highlighter, pas tout le TOC */}
      <TocHighlighter ids={items.map((it) => it.id)} />
    </nav>
  );
}

// src/components/knowledge/client/TocHighlighter.tsx — "use client" minimal
// Pose data-active sur le <li> dont l'IntersectionObserver détecte la cible.
```

### 8.2 Anti-pattern

- Charger un package comme `tocbot` (~ 10 KB gz client) — refusé. Le pattern ci-dessus tient en ≤ 1 KB gz.
- Calculer la TOC côté client (scan du DOM) — refusé. Server-side depuis `bodyJson`.

---

## 9. CLS = 0 — STRICT

| Source CLS potentielle    | Mitigation KB                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero image cover**      | `width` + `height` explicites + `aspectRatio` CSS dans wrapper. Skeleton placeholder rendu serveur (background-color terracotta-pale 100×100% jusqu'au load). |
| **Author avatar**         | `<Image width={48} height={48}>` toujours, jamais auto.                                                                                                       |
| **Embeds (vidéo, tweet)** | Bannis V1. V1.5 : `<iframe loading="lazy" width="…" height="…">` + container fixed-aspect.                                                                    |
| **CTA injecté**           | `CtaBlock` réutilisé (déjà CLS-zero, mémoire pricing centralization).                                                                                         |
| **Related cards images**  | Même règle hero (dimensions explicites).                                                                                                                      |
| **Ads / web fonts FOIT**  | N/A (pas d'ads ; fonts swap déjà OK).                                                                                                                         |
| **Tiptap rendering**      | Server-rendu → CLS impossible (HTML complet livré à l'hydratation).                                                                                           |

### 9.1 Mesure

- Lighthouse CI desktop sur 6 routes pivot (cf. § 11) doit reporter `cumulativeLayoutShift: 0` (cible interne stricte AGENTS.md).
- Cloudflare RUM (CrUX p75) à monitorer post-deploy via dashboard `/[adminPrefix]/perf` (Sprint KB-18 — délégué à Agent 18 ou backlog).

---

## 10. BUNDLE DELTA GATE

### 10.1 Cible

- **`pnpm bundle:check` (size-limit)** : tout PR touchant KB doit rester **+ 5 KB gz max** vs `main` sur **chaque route pivot**.
- Configuration `size-limit` actuelle (`package.json` ligne 162-167) cible le glob `chunks/**/*.js` à 100 KB — **insuffisant pour gate KB**. Sprint KB-18 doit réécrire la config en per-route (cf. § 1.3).

### 10.2 Vérification locale

```bash
pnpm build
pnpm bundle:check       # size-limit, fail si dépassement
```

### 10.3 Gate PR CI

Workflow `.github/workflows/ci.yml` doit appeler `pnpm bundle:check` sur la branche PR et **comparer au baseline `main`** (size-limit-action GitHub Action). Sprint KB-18 livrable.

---

## 11. LIGHTHOUSE CI — 6 ROUTES PIVOT KB

### 11.1 Routes auditées

| #   | Route exemple                                              | Pourquoi                                |
| --- | ---------------------------------------------------------- | --------------------------------------- |
| 1   | `/fr/blog/[slug]` (un article réel migré KB-2)             | Continuité legacy + cible LCP éditorial |
| 2   | `/fr/cas-concrets/[slug]`                                  | Page riche (problem + solution + media) |
| 3   | `/fr/centre-aide/[slug]`                                   | Format aide concis (HowTo schema)       |
| 4   | `/fr/faq` (hub)                                            | Liste FAQPage + filtre client minimal   |
| 5   | `/fr/ressources` (nouveau hub)                             | Hub global tous types                   |
| 6   | `/fr/ressources/[type]/[slug]` (entrée canonique nouvelle) | Cible canonique KB                      |

### 11.2 Configuration

- Réutiliser `pnpm lhci` existant (`package.json` ligne 33-34 `lhci collect`/`autorun`).
- Étendre `.lighthouserc.json` (ou équivalent) avec ces 6 URLs Sprint KB-18.
- Budget LHCI **identique AGENTS.md** :
  - `largestContentfulPaint`: 1800 (ms)
  - `interactive`: 2500 (ms)
  - `cumulativeLayoutShift`: 0
  - `totalBlockingTime`: 150 (ms)
  - `performance`: ≥ 0.95
- Gate PR : assertion fail → PR bloqué.

### 11.3 Routes EN parallèles

Les 6 routes auditées doivent aussi être testées en `/en/...` (V1 EN = parity reportée Sprint KB-15 selon Agent 15 ; V1 audit FR uniquement obligatoire, EN dès parity active).

---

## 12. MESURE RUM (REAL USER MONITORING)

### 12.1 Stack existant (réutilisé)

- **Plausible CE** déployé (mémoire `axionia_plausible_ce_deploy_2026-05-13`) — script étendu (4 extensions). Web vitals tracking via plugin Plausible déjà actif (mémoire confirmée).
- Goals existants : `Booking Submitted`, `Booking Failed`. **KB ajoute** (Sprint KB-18) :
  - `kb_view` (avec `props: { type, slug, locale }`)
  - `kb_search` (`props: { query_length, results_count, locale }`)
  - `kb_helpful_up` / `kb_helpful_down` (`props: { entry_id }`)
  - `kb_toc_click` (`props: { entry_id, heading_id }`)
- **Microsoft Clarity** (mémoire `axionia_session_2026-05-13_seo_email_stack`) — heatmaps + session recordings. Aucune action KB requise (auto).

### 12.2 Cible CrUX p75

- LCP p75 ≤ 1800 ms (interne) / ≤ 2500 ms (Google good).
- INP p75 ≤ 100 ms (interne) / ≤ 200 ms (Google good).
- CLS p75 = 0 (interne) / ≤ 0.1 (Google good).
- Vérifier mensuel via `pagespeed.web.dev` + CrUX API.

### 12.3 Tableau de bord admin

`/[adminPrefix]/analytics/` existant (iframe Plausible) — délégué Agent 18 d'ajouter un panneau « KB Web Vitals » filtré sur paths `/fr/ressources/*` + `/fr/blog/*` + `/fr/cas-concrets/*` + `/fr/centre-aide/*` + `/fr/faq*`.

---

## 13. `loading.tsx` OBLIGATOIRE

### 13.1 État actuel (HEAD `main`)

`loading.tsx` présents : `audit/`, `contact/`, `implantations/[region]/[ville]/`, `reserver/`, root `[locale]/`. **Absents** sur `blog/`, `cas-concrets/`, `centre-aide/`, `faq/`, `glossaire/`.

### 13.2 Cible KB

Sprint KB-6 livre 1 `loading.tsx` par route KB publique :

```
src/app/[locale]/blog/loading.tsx
src/app/[locale]/blog/[slug]/loading.tsx
src/app/[locale]/cas-concrets/loading.tsx
src/app/[locale]/cas-concrets/[slug]/loading.tsx
src/app/[locale]/centre-aide/loading.tsx
src/app/[locale]/centre-aide/[slug]/loading.tsx
src/app/[locale]/faq/loading.tsx
src/app/[locale]/glossaire/loading.tsx
src/app/[locale]/guide-ia/loading.tsx
src/app/[locale]/ressources/loading.tsx
src/app/[locale]/ressources/[type]/loading.tsx
src/app/[locale]/ressources/[type]/[slug]/loading.tsx
src/app/[locale]/mes-ressources/loading.tsx
```

Contenu : composant `<EntrySkeleton />` qui reproduit le squelette (hero block + 3 paragraphes + sidebar TOC) **avec dimensions identiques** au rendu final (gate CLS = 0).

---

## 14. ANTI-PATTERNS — REJET AUTO REVIEW KB

| Anti-pattern                                                                                                                                  | Détecté par                                            | Conséquence                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `import ... from '@tiptap/...'` dans `src/app/[locale]/{blog,cas-concrets,centre-aide,faq,glossaire,guide-ia,ressources,mes-ressources}/**/*` | `pnpm tiptap-public:check` (nouveau gate Sprint KB-18) | PR rejeté                                      |
| `<TiptapEditor>` rendu dans `/mes-ressources/` ou autre route publique/client                                                                 | grep CI + review                                       | PR rejeté                                      |
| `loading.tsx` manquant sur route KB publique nouvelle                                                                                         | review (à terme : script lint)                         | PR rejeté                                      |
| `dangerouslySetInnerHTML` sur `bodyHtml` côté page publique KB                                                                                | grep CI                                                | PR rejeté (utiliser `renderTiptapJsonToReact`) |
| `<img>` natif (sans `<Image>` Next)                                                                                                           | `pnpm next lint` (rule `@next/next/no-img-element`)    | PR rejeté                                      |
| `<Image>` sans `width`+`height` (ou `fill` + parent positioned)                                                                               | review + Lighthouse CI CLS > 0                         | PR rejeté                                      |
| `priority` sur > 1 image par page                                                                                                             | review                                                 | PR rejeté                                      |
| `export const dynamic = 'force-dynamic'` sur route KB publique                                                                                | grep CI                                                | PR rejeté (sauf `/mes-ressources/`)            |
| Speculation Rules `eager` sur route KB                                                                                                        | review                                                 | PR rejeté                                      |
| Bundle PR > main + 5 KB gz sur une route pivot                                                                                                | `pnpm bundle:check` (size-limit-action)                | PR rejeté                                      |
| Lighthouse LCP > 1800 ms ou CLS > 0 sur route pivot                                                                                           | `pnpm lhci` CI                                         | PR rejeté                                      |
| Import lourd dans `EntryRenderer.tsx` (ex: `recharts`, `framer-motion`, `tocbot`)                                                             | review + bundle check                                  | PR rejeté                                      |
| TOC client `useEffect` qui scan DOM pour générer TOC                                                                                          | review                                                 | PR rejeté (server-side depuis `bodyJson`)      |
| Cover image en background-image CSS (LCP discovery dégradé)                                                                                   | review                                                 | PR rejeté (`<Image priority>`)                 |
| Web fonts custom ajoutées sans ADR                                                                                                            | review                                                 | PR rejeté                                      |

---

## 15. STOP & ASK OUVERTS — DÉCISIONS WILL

1. **Helper SSR rendering** : recommandation forte = `renderTiptapJsonToReact` custom (~ 200 lignes, zéro dépendance). Alternative refusée : `@tiptap/html` + `html-react-parser` (~ +20 KB Node, perd `<Image>`/`<Link>` natif). **Will valide ?**
2. **Sanitization** : `renderTiptapJsonToReact` whitelist hardcodée des nodes/marks. Pas besoin de `isomorphic-dompurify`. **Will valide ?**
3. **TocHighlighter** : composant client minimal (`use-client`, ~ 1 KB gz) acceptable malgré la doctrine "zéro client public" ? **Alternative** : highlighting CSS pur `:target` (encore plus léger mais limité au scroll-to-target). **Recommandation forte = TocHighlighter client minimal** isolé. **Will valide ?**
4. **size-limit reconfiguration** : on passe de la config globale 100 KB à du per-route 75 KB en Sprint KB-18. Faut-il garder le glob global en cap dur additionnel (ex: ≤ 200 KB total chunks) ? **Recommandation : OUI**, en garde-fou.
5. **LHCI 6 routes pivot** : suffisant ou ajouter `/mes-ressources/` (le 7e, surface client) malgré exception 110 KB ? **Recommandation = OUI, ajouter** avec budget 110 KB / INP 150 ms aligné AGENTS.md.
6. **Cloudflare Image Resizing** : confirmé désactivé (plan Free) — KB s'appuie 100 % sur `next/image` + Caddy cache. Pas de variation prévue.
7. **Codeblock V1.5 (Shiki SSR)** : si rédacteurs veulent du code coloré dans la KB technique V1.5, on intègre Shiki en SSR pur (zéro JS client, ~ 0 KB gz public). À confirmer en Sprint KB-21 V1.5.
8. **Cache TTL Cloudflare Page Rules** : pages KB publiques doivent passer en Cache-Rule CF Edge `max-age=3600, s-maxage=3600, stale-while-revalidate=86400`. À aligner Sprint KB-6 ou côté Cloudflare admin (mémoire `axionia_session_2026-05-09_cloudflare_phase5` — Cache Rules existantes à étendre).
9. **`<Image>` `placeholder='blur'`** : utiliser ou pas ? Avantage : perceived performance. Risque : payload base64 inline +1-2 KB par image (×N entrées). **Recommandation = NON par défaut** (CSS skeleton color suffit), `placeholder='blur'` activable uniquement pour le cover LCP si nécessaire.
10. **Mode Reading View `/mes-ressources/[slug]?reading=1`** : option future où on supprime TOC + related + CTA pour lecture immersive. Hors V1. À noter pour backlog.

---

## 16. CHECKLIST PRÉ-MERGE SPRINT KB-6 (Public surface)

Avant de merger Sprint KB-6 sur `main` :

- [ ] `pnpm tiptap-public:check` passe (nouveau gate).
- [ ] `pnpm use-client:check` passe (aucun `use-client` nouveau hors `TocHighlighter`).
- [ ] `pnpm bundle:check` : aucune route pivot > +5 KB gz vs `main`.
- [ ] `pnpm lhci` 6 routes pivot : LCP ≤ 1800, INP ≤ 100, CLS = 0, TBT ≤ 150.
- [ ] `loading.tsx` présent sur **12 nouvelles routes KB** (cf. § 13.2).
- [ ] `renderTiptapJsonToReact` testé unitairement (≥ 12 tests : chaque node + chaque mark + edge case empty doc).
- [ ] `EntryRenderer.tsx` testé en story Vitest + Playwright `@kb` tag.
- [ ] `revalidateTag(`kb-\*`)` câblé dans `publishEntry` server action.
- [ ] CrUX baseline RUM capturé (avant deploy) pour comparaison J+7 / J+30.
- [ ] AGENTS.md non modifié (budgets inchangés).

---

## 17. RÉFÉRENCES CROISÉES

- AGENTS.md (SSOT budgets) — racine repo `axionia/AGENTS.md`.
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` (SSOT budgets v2 doctrinal, cité AGENTS.md).
- Mémoire `axionia_audit_web_vitals_2026-05-08` (audit historique score 1062.5/2250).
- Mémoire `axionia_perf_audit_2026-05-07` (Speculation Rules eager désactivé).
- Mémoire `axionia_plausible_ce_deploy_2026-05-13` (RUM stack).
- Mémoire `axionia_session_2026-05-09_cloudflare_phase5` (Cache Rules CF).
- `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md` (état Tiptap C4, FTS, hardcode `/glossaire`).
- Sprint KB-6 (Public surface) — livrable principal qui consomme cet audit.
- Sprint KB-18 (Tests/observabilité) — gates CI + LHCI + size-limit per-route.

---

**Fin Agent 11 — Performance & Web Vitals.** Audit-only. Aucun code modifié.
