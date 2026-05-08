# Annexe D — Cohérence transverse + Doctrine interne

**Lead agent** : AGT-COHERENCE
**Méthode** : audit lecture seule intra-repo. **HEAD = doctrine commitée fait foi**, audit cohérence interne uniquement (sans imposer doctrine externe).

## D.1 — Composants & code DRY

### Inventaire `src/components/`

| Dossier       | Fichiers                                                | Tests |
| ------------- | ------------------------------------------------------- | ----- |
| `ui/`         | 19 composants shadcn-style                              | 4     |
| `sections/`   | 14 composants                                           | 3     |
| `marketing/`  | 9 composants                                            | 2     |
| `nav/`        | 6 composants                                            | 0     |
| `layout/`     | 2 (Container + Section)                                 | 1     |
| `forms/`      | 5 (Audit, Booking, Contact, Implementation, Newsletter) | —     |
| `calendar/`   | 4 (BookingCalendar, BookingFlow, HouseCalendar)         | 1     |
| `typography/` | Eyebrow                                                 | 1     |
| `motion/`     | FadeInOnView                                            | 0     |
| `roi/`        | RoiSimulator + compute                                  | 1     |
| `a11y/`       | SkipToContent                                           | 0     |
| `analytics/`  | WebVitals                                               | 0     |

### Doublons / orphelins

| ID         | Sévérité | Description                                                                                                                                       |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-P2-1** | P2       | `FaqAccordion` (marketing/) **vs** `FaqBlock` (sections/) — frontière floue, consolidable                                                         |
| **D-P2-2** | P2       | `HouseCalendar` legacy + `BookingCalendar` (20 KB nouveau) cohabitent — clarifier déprécation post commit `c8cffef`                               |
| **D-P3-1** | P3       | 6 composants UI orphelins : `dropdown-menu`, `popover`, `select`, `switch`, `tabs`, `tooltip` (0 import dans pages)                               |
| **D-P3-2** | P3       | `Hero` (sections/) utilisé 1x seulement (showcase `/sections`) — l'app utilise `Section titleAs="h1"` partout. Garder pour showcase ou supprimer. |
| **D-P2-3** | P2       | Composant visuel `Breadcrumbs.tsx` jamais importé dans page (JSON-LD via helper OK) — voir aussi B-P2-2                                           |

### Imports relatifs `../../../`

```
0 occurrences dans src/
```

✅ Tous via alias `@/`.

### Top usages (santé)

- `JsonLd` : 105 réfs ✅
- `Section` : 148 réfs
- `Container` : 105 réfs
- `Cta` : 54 réfs
- `Button` : 47 réfs
- `CtaBlock` : 40 réfs

## D.2 — Copy & i18n harmonisée

| Critère                     | Résultat            |
| --------------------------- | ------------------- |
| `pnpm i18n:check`           | ✅ 145 keys in sync |
| `pnpm anti-formation:check` | ✅ 0 banned         |
| `pnpm anti-siren:check`     | ✅ 0                |
| `pnpm anti-hex:check`       | ✅ 0 hardcoded hex  |

### Vocabulaire

| Mot              | Count                                                     |
| ---------------- | --------------------------------------------------------- |
| `intervention`   | 237 (vocabulaire central ✅)                              |
| `opérationnel`   | 43                                                        |
| `cabinet`        | 33                                                        |
| `accompagnement` | 1 ⚠️ **D-P3-3** rare (préférence "intervention" voulue ?) |

### Capitalisation `Axion-IA`

- Canonique `Axion-IA` : 256 occurrences `src/`
- `Axion-IA` : 1 occurrence (commentaire code `Header.tsx:40` décrivant rendu visuel logo) — ✅ non bloquant
- `Axionia` / `Axion IA` (espace) : 0

## D.3 — JSON-LD cohérence

### Organization

| Source                                          | Nb                                       |
| ----------------------------------------------- | ---------------------------------------- |
| Layout central `[locale]/layout.tsx:98`         | 1 (root)                                 |
| Helper centralisé `lib/seo.ts:77`               | 1                                        |
| Pages emboîtées (`publisher`/`author`/`seller`) | 13 (légitime)                            |
| Home `page.tsx:185`                             | 1 — ⚠️ **D-P2-4** redondance avec layout |

### WebSite : 5 occurrences (1 root layout + 4 emboîtées légitimes ✅)

### BreadcrumbList

- 3 occurrences source code (composant + helper + helper consommé partout)
- `buildBreadcrumbJsonLd` helper consommé par pages product/légales/blog/[slug]/cas-concrets/[slug]/faq/[slug]/centre-aide/[slug]/comparaisons/[slug]
- ⚠️ Composant visuel `Breadcrumbs.tsx` jamais rendu (voir D-P2-3)

### Prix `Offer` Essentielle 490 €

- `priceEur: 490` : 2 occurrences (`content/interventions.ts:49` + `:135` fr/en) ✅
- Émis via `lib/seo.ts:77` quand `priceEur` passé ✅

## D.4 — Anti-banni grep complet

| Pattern                                                      | Count                                                         | Verdict |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------- |
| `formation\|formateur\|former\|formé`                        | 0                                                             | ✅      |
| `siren\|siret\|rcs\b`                                        | 0                                                             | ✅      |
| `#[0-9a-fA-F]{3,8}` hors `globals.css`/scripts/`design demo` | 8 (toutes `// hex-ok:` whitelist `api/og/route.tsx`)          | ✅      |
| `'use client'` sans commentaire                              | 0 (29 modules `'use client'` × 30 commentaires `use-client:`) | ✅      |
| `stripe\|paddle\|lemon\|payplug\|mollie`                     | 0 (faux positif unique : commentaire SVG `og/route.tsx`)      | ✅      |
| `resend\|mailchimp\|sendgrid\|brevo`                         | 0                                                             | ✅      |

**Verdict D.4** : ✅ **0 dette anti-banni.**

## D.5 — Doctrine interne (cohérence intra-repo, HEAD fait foi)

### Tokens consommés

| Token                     | Occurrences | Rôle                 |
| ------------------------- | ----------- | -------------------- |
| `--color-terracotta`      | 43          | Signature dominante  |
| `--color-primary`         | 22          | CTA blue             |
| `--color-sage`            | 20          | Accent secondaire    |
| `--color-paper`           | 8           | Logo badge           |
| `--color-border-strong`   | 8           | Bordures             |
| `--color-fg`              | 5           | Texte foreground     |
| `--color-bg`              | 4           | Background base      |
| `--color-terracotta-soft` | 3           | Variante claire      |
| `--color-mocha-fg`        | 3           | Texte sur mocha      |
| `--color-mocha`           | 2           | Footer dark          |
| `--color-sand`            | 1           | Mobile drawer active |

### Hex hardcodés hors `globals.css`

- `api/og/route.tsx` : 8 hex tous `// hex-ok:` (palette OG image SVG)
- `[locale]/design/page.tsx` : page démo (whitelist script)

✅ **0 hex non-justifié**.

### Polices chargées (`layout.tsx:17-39`)

```
Manrope     → --font-manrope    (sans)
Inconsolata → --font-inconsolata (mono)
Fraunces    → --font-serif      (serif éditorial titleEm)
```

✅ Cohérent doctrine v3 (commit `5942d2f`).

### Variants Button/Cta

| Variant       | Cta count | Button count |
| ------------- | --------- | ------------ |
| `outline`     | 9         | 2            |
| `primary`     | 1         | —            |
| `ghost`       | —         | 2            |
| `secondary`   | —         | 1            |
| `link`        | —         | 1            |
| `destructive` | —         | 1            |

⚠️ **D-P3-4** : surface API Button (15 variants disponibles) >> usage réel sur pages. Pattern Cta domine. Acceptable pour design system.

### Top 20 utilities `bg-*`

`bg-primary` (36) · `bg-bg` (30) · `bg-border` (24) · `bg-mocha-rich` (16) · `bg-sand` (15) · `bg-paper` (15) · `bg-terracotta` (13) · `bg-terracotta-soft` (12) · `bg-accent-green` (9) · `bg-accent-yellow` (7) · `bg-halo-warm` (6) · `bg-fg` (6) · `bg-accent-orange` (5) · `bg-primary-hover` (4) · `bg-mocha-fg` (4) · `bg-accent-red` (4) · `bg-accent-purple` (4) · `bg-sage-soft` (3) · `bg-primary-soft` (2) · `bg-primary-400` (2)

✅ Distribution cohérente : CTAs primary + neutres + signature terracotta + accents secondaires.

### Pattern hero (titleEm distribution)

- 36 pages H1
- 27 pages avec `titleEm` italique terracotta
- 3 pages H1 sans titleEm :
  1. `centre-aide/[slug]/page.tsx:81` — dynamique (`copy.title`) → ⚠️ **D-P3-5** justifié
  2. `faq/[slug]/page.tsx` — dynamique → justifié
  3. `sections/page.tsx` — showcase → OK

### Eyebrow distribution (signature dot terracotta)

- 35 pages avec `eyebrow=` prop (94 occurrences total)
- `Section.tsx:265` rend le dot terracotta automatiquement (Section component)
- `Hero.tsx:73` rend également via `accentDot[accent]` (default terracotta)
- 8 dots terracotta manuels supplémentaires (home, CaseStudyCard, FeatureGrid, TimelineBlock, Header mobile CTA) — légitimes

✅ Signature appliquée systématiquement.

### Header pattern figé

`src/components/nav/Header.tsx:29` :

```tsx
className="bg-terracotta border-terracotta-deep text-mocha-fg
           supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40
           border-b backdrop-blur-md"
```

✅ **Confirmé** : couleur figée, **aucun scroll-aware** (commentaire ligne 9-10 explicite). Server Component (pas de `'use client'`). Cohérent commit `941a8e1` "fix(header): retire scroll-aware".

## D.6 — État repo

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 22 commits.
nothing to commit, working tree clean

$ git log origin/main..HEAD --oneline | wc -l
22
```

### Top 10 fichiers les + modifiés

| Fichier                                       | Lignes touchées |
| --------------------------------------------- | --------------- |
| `src/app/[locale]/page.tsx`                   | 3015            |
| `src/components/nav/Footer.tsx`               | 608             |
| `src/components/calendar/BookingCalendar.tsx` | 528             |
| `src/components/nav/Header.tsx`               | 376             |
| `Design.md`                                   | 354             |
| `src/components/layout/Section.tsx`           | 344             |
| `src/app/globals.css`                         | 282             |
| `src/messages/fr.json`                        | 241             |
| `src/messages/en.json`                        | 239             |
| `docs/adr/0002-design-pivot-editorial-v3.md`  | 180             |

✅ Concentration sur : refonte home, doctrine v3, nav, BookingCalendar, i18n.

**Recommandation** : 22 commits propres, working tree clean. Pas d'action audit (lecture seule). Push possible vers `origin/main` quand Will valide.

## D.7 — Code quality

| Critère                           | Count | Verdict                                                           |
| --------------------------------- | ----- | ----------------------------------------------------------------- |
| `TODO/FIXME/HACK/XXX`             | **0** | ✅                                                                |
| `console.log`                     | 0     | ✅                                                                |
| `console.warn`                    | **7** | ⚠️ **D-P2-5** justifiés (5 forms `[stub]` + 2 API guards env var) |
| `console.info` / `console.debug`  | 0     | ✅                                                                |
| `any` réel TypeScript             | **0** | ✅                                                                |
| `@ts-ignore` / `@ts-expect-error` | **0** | ✅                                                                |

Les 7 `console.warn` :

- `api/indexnow/route.ts:35` — guard env var (acceptable)
- `api/vitals/route.ts:28` — guard (acceptable)
- 5 forms `[*:submit:stub]` — formulaires en mode stub, endpoints mail à câbler Sprint 16+

## D.8 — Synthèse

### Findings P0 : 0

### Findings P1 : 0

### Findings P2 (5)

| ID         | Description                                                      |
| ---------- | ---------------------------------------------------------------- |
| **D-P2-1** | FaqAccordion vs FaqBlock — frontière ambiguë                     |
| **D-P2-2** | Dual calendar (HouseCalendar legacy + BookingCalendar)           |
| **D-P2-3** | Composant visuel `Breadcrumbs.tsx` jamais rendu                  |
| **D-P2-4** | Organization JSON-LD émis 2x (layout + home)                     |
| **D-P2-5** | 5 forms en mode stub `[*:submit:stub]` (endpoints mail à câbler) |

### Findings P3 (5)

| ID         | Description                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| **D-P3-1** | 6 composants UI orphelins (dropdown-menu, popover, select, switch, tabs, tooltip) |
| **D-P3-2** | Composant `Hero` utilisé 1x (showcase)                                            |
| **D-P3-3** | `accompagnement` count = 1 (vocabulaire rare à arbitrer)                          |
| **D-P3-4** | Surface API Button (15 variants) >> usage réel pages                              |
| **D-P3-5** | 3 pages H1 sans titleEm (dynamiques + showcase, justifié)                         |

## D.9 — Verdict Partie D

# ✅ **GO Sprint 15** (Partie D)

Cohérence intra-repo solide. Doctrine v3 commitée homogène : tokens cohérents, 0 hex hardcodé, signature terracotta + Fraunces partout, header figé confirmé, anti-banni clean, i18n parité OK. Les 5 P2 sont dettes propres non bloquantes.
