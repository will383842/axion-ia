# 12 — Design System, doctrine visuelle & cohérence composants

Agent 3.C · AUDIT-ONLY · 2026-05-16
SHA HEAD audité : `4cdfbe44` (descendant figé `98e0b0f` main)
Brief : `_AUDIT/PROMPT-PLATFORM-PERFECTION-CHECK-2026-05-16.md` §Agent 3.C

---

## Verdict

**Score : 81 / 100 — VERT CONDITIONAL (« near excellence »)**
Le design system Axion-IA est globalement très mature (tokens SSOT centralisés dans `globals.css`, lint guards exécutables, modular scale 2026 ADR 0007 appliquée, hero schemas 14/13 alignés, IllustrationPlaceholder + DetailHeroSchema réutilisés). Mais 4 fuites doctrinaires non couvertes par les linters actuels (shadow rgba arbitraires, style inline en admin content-gen, IllustrationPlaceholder sous-utilisé hors `/interventions/*`, top composants partagés sans tests à 50 %) empêchent un VERT GO strict. Aucune régression bloquante prod.

---

## Synthèse 6 dimensions

| Dimension                                                                | Score | Statut | Commentaire                                                                                                                         |
| ------------------------------------------------------------------------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tokens SSOT (`globals.css` `@theme`)                                     | 19/20 | VERT   | 1 fichier source, lint `anti-hex` passe (« 0 hardcoded hex »), `contrast` passe 27/27                                               |
| Typographie modular scale 2026                                           | 18/20 | VERT   | Échelle complète text-sm→text-7xl + display 88 px ADR 0007, line-height + tracking par palier, font-serif chaîné Fraunces           |
| Hero schemas coverage v3.3                                               | 17/20 | VERT   | 14 components dont 13 pages couvertes via `.hero-schema` (cf. matrice ci-dessous)                                                   |
| Composants réutilisables (Illustration / DetailHeroSchema / Placeholder) | 10/15 | JAUNE  | DetailHeroSchema utilisé 4× seulement, IllustrationPlaceholder via Illustration wrapper sur 12 pages mais 0 image réelle drop       |
| `prefers-reduced-motion` + use client                                    | 10/10 | VERT   | Règle CSS globale `@media reduce` force `animation-duration: 0ms`, lint `use-client:check` passe (82 directives, toutes justifiées) |
| Tests top composants partagés                                            | 7/15  | JAUNE  | 4/10 UI testés (button, badge, card, alert), 3 sections testées (Hero, FeatureGrid, ProcessSteps), 0 test hero schemas              |

**Total : 81 / 100**

---

## 1. Tokens SSOT — `globals.css` `@theme {…}` est canonique (19/20)

### Pourquoi VERT

- Fichier unique : `src/app/globals.css` (1553 lignes) déclare tout dans `@theme {}` (Tailwind v4 native), pas de `tailwind.config.ts` (cohérent Tailwind v4 doctrine).
- Palette éditoriale v3 complète : surfaces (`bg`, `paper`, `sand`, `mocha`), foreground (`fg`, `fg-soft`, `fg-muted`), accent (`primary`, `terracotta`, `sage`), borders, états sémantiques (success/warning/error/info).
- Compat v1/v2 conservée (`accent-purple/pink/green/orange/yellow/red`, `gray-300→800`, `primary-300/400`) → 0 régression composants existants.
- Token `--shadow-cta-terracotta` documenté avec justification (RGB littéral terracotta clair `205,107,72` ≠ `--color-terracotta` `#c24a1b` — volontaire pour le glow). Bon exemple de doc inline.

### Lint guards exécutables

| Script                                                  | Résultat HEAD                                             | Couverture                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm anti-hex:check` (`scripts/check-anti-hex.sh`)     | ✅ `0 hardcoded hex`                                      | `*.ts/tsx/js/jsx/mjs` sous `src/components`, `src/app` (exclusions globals.css + design/) |
| `pnpm contrast:check` (`scripts/check-contrast.ts`)     | ✅ 27/27 paires WCAG AA                                   | Toutes combinaisons fg/bg du DS, ratios reportés 4.61→17.72                               |
| `pnpm use-client:check` (`scripts/check-use-client.ts`) | ✅ `every directive justified`                            | 82 directives `use client`, toutes commentées `// use-client: <reason>`                   |
| `pnpm radius:check`                                     | non exécuté ici (audit-only), présent dans `package.json` | Radius tokens (`--radius-xs→2xl + full`)                                                  |

### Faille -1 pt : couverture `anti-hex` incomplète

Le script `check-anti-hex.sh` matche `#xxx` uniquement. Il **ne flag pas** :

- `rgba(0,0,0,0.x)` / `rgb(31,27,22)` → 22 occurrences trouvées sous `src/` hors globals.css
- `hsl()` / `hsla()` (0 occurrence, OK)
- `shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]` (Tailwind arbitrary value) → 17 occurrences

**Reco P2** : durcir `check-anti-hex.sh` pour matcher aussi `rgba?\(|hsla?\(` → bloque la régression future. Coût ~10 min.

---

## 2. Typographie modular scale 2026 — ADR 0007 appliquée (18/20)

### Pourquoi VERT

```
text-base  18 px (anchor) ratio 1.00
text-sm    15 px           0.83
text-lg    20 px           1.11
text-xl    22 px           1.22
text-2xl   26 px           1.44
text-3xl   32 px           1.78
text-4xl   40 px           2.22
text-5xl   52 px           2.89
text-6xl   64 px           3.56
text-7xl   80 px           4.44
display    88 px (cap)     4.89  ← Stripe Press ceiling
```

- Chaque palier override Tailwind v4 default (16/14 → 18/15 anchor) avec `--line-height` et `--letter-spacing` dédiés.
- Hero display cap 88 px (ADR 0007) appliqué via `--text-display: 5.5rem`. Vérifié dans `src/app/globals.css:121`.
- Font chain robuste : `--font-fraunces` (next/font variable, P-105) + 5 fallback web-safe + `serif` final.
- Aliases sémantiques exposés : `--text-section`, `--text-sub`, `--text-feature`, `--text-lead`, `--text-body`, `--text-label-up`, `--text-caption`, `--text-badge-up`, `--text-micro-up` — chacun avec `line-height` + `letter-spacing` doctrine.

### Faille -2 pts

- Aucun **test snapshot** sur les valeurs computed (un `--text-base` accidentellement réécrit en `1rem` casse 80 pages sans CI rouge). Reco P3 : test Vitest qui parse `globals.css` et assert les 13 paliers (sécurité régression).
- `letter-spacing` négatif uniquement sur les gros paliers (≥ text-lg), aucun positif sur petits caps — OK doctrine 2026 mais à formaliser dans Design.md.

---

## 3. Hero schemas v3.3 — matrice coverage 14/13 pages (17/20)

### Components hero schema (15 trouvés)

| #   | Component                                                                                 | Page consommatrice                              | Réutilise DetailHeroSchema ?         |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| 1   | `AboutHeroSchema`                                                                         | `/a-propos`                                     | non (dédié)                          |
| 2   | `AuditHeroSchema`                                                                         | `/audit` (via `.hero-schema` class)             | non                                  |
| 3   | `BlogHeroSchema`                                                                          | `/blog`                                         | non                                  |
| 4   | `CaseStudiesHeroSchema`                                                                   | `/cas-concrets`                                 | non                                  |
| 5   | `ComparisonsHeroSchema`                                                                   | `/comparaisons`                                 | non                                  |
| 6   | `ContactHeroSchema`                                                                       | `/contact`                                      | non                                  |
| 7   | `FaqHeroSchema`                                                                           | `/faq`                                          | non                                  |
| 8   | `HelpHeroSchema`                                                                          | `/centre-aide`                                  | non                                  |
| 9   | `ImplementationHeroSchema`                                                                | `/implementation`                               | non                                  |
| 10  | `InterventionsHeroSchema`                                                                 | `/interventions`                                | non                                  |
| 11  | `MethodologyHeroSchema`                                                                   | `/methodologie`                                 | non                                  |
| 12  | `StackHeroSchema`                                                                         | `/stack-ia`                                     | non                                  |
| 13  | `VilleHeroSchema`                                                                         | `/[ville]/par-ville/*` (pSEO)                   | non                                  |
| 14  | `DetailHeroSchema` (paramétrable)                                                         | 3 détails interventions + `ProductPageTemplate` | n/a (c'est lui-même le réutilisable) |
| 15  | (home) `src/app/[locale]/page.tsx` utilise `.hero-schema` inline (pas de component dédié) | /                                               | /                                    |

13 pages stratégiques avec `.hero-schema` dans le tree (`grep` confirmé). Tous appliquent la doctrine carré 576×576 lg+ + role="img" + aria-label.

### DetailHeroSchema — réutilisé 4× seulement

```
src/app/[locale]/interventions/approfondie/page.tsx
src/app/[locale]/interventions/gagner-du-temps/page.tsx
src/app/[locale]/interventions/intervention-claude/page.tsx
src/components/sections/ProductPageTemplate.tsx
```

→ Couvre `/interventions/{slug}` + le template produit. Mais **PAS** utilisé sur `/audit/{slug}` détails (`AuditDetailPage.tsx`), ni sur les `Conference`, `Dirigeants`, `Collectives` pages (qui ont leurs propres hero ad-hoc).

**Reco P2** : étendre DetailHeroSchema à `AuditDetailPage`, `IndividualCoachingPage`, `CollectiveTrainingPage` (~3 h dev, gain DRY + cohérence visuelle).

### Faille -3 pts

- 14 components hero schema = duplication structurelle modérée. 12 d'entre eux pourraient être paramétrés via `DetailHeroSchema` ou un futur `EditorialHeroSchema` (5-6 props : eyebrow, title, blocks, accent). Coût refacto P3 ~12 h.
- Home page utilise `.hero-schema` inline sans component → pas réutilisable.

---

## 4. Hex en dur — top 10 fuites SSOT (rgba inline / shadow-[] arbitraires)

**Lint `anti-hex` PASSE mais ne couvre pas `rgba()` / `shadow-[]`**. Inventaire des 17 fuites rgba dans le code shippé prod :

| #   | Fichier                                                                           | Ligne       | Pattern                                                                                  | Sévérité                                   |
| --- | --------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `src/components/nav/Header.tsx`                                                   | 119         | `shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]` (CTA primary)                             | P1 — Header partagé, charge sur toute page |
| 2   | `src/components/nav/Header.tsx`                                                   | 119         | `hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]`                                    | P1                                         |
| 3   | `src/components/marketing/StickyMobileCta.tsx`                                    | 72          | `shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]`                                            | P1 — mobile, charge global                 |
| 4   | `src/components/sections/CollectiveDurationListing.tsx`                           | 116         | `shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]` (= duplique `--shadow-cta-terracotta` !) | P1 — token existe, à wirer                 |
| 5   | `src/components/sections/CollectiveTrainingPage.tsx`                              | 413         | `shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]` (badge price)                                | P2                                         |
| 6   | `src/components/sections/InterventionDetailPage.tsx`                              | 142         | `shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]` (= idem badge price)                         | P2                                         |
| 7   | `src/components/sections/InterventionFormatCard.tsx`                              | 142         | `shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]` (= idem badge price)                         | P2                                         |
| 8   | `src/app/[locale]/interventions/page.tsx`                                         | 507 + 922   | `shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]` (×2, = `--shadow-cta-terracotta`)        | P1 — page critique CRO                     |
| 9   | `src/app/[locale]/interventions/page.tsx`                                         | 585         | `hover:shadow-[0_22px_52px_-14px_rgba(0,0,0,0.22)]`                                      | P2                                         |
| 10  | `src/app/[locale]/interventions/collectives/page.tsx`                             | 208/261/262 | `shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]` + 2 variants rgba                        | P1                                         |
| 11  | `src/app/[locale]/stack-ia/page.tsx`                                              | 280         | `shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]` (= duplique pattern Header CTA primary)   | P2                                         |
| 12  | `src/components/admin/content-gen/GeoEventsBanner.tsx`                            | 103         | `style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}`                                 | P3 — admin only                            |
| 13  | `src/components/admin/content-gen/JobLogStream.tsx`                               | 125         | `background: "rgba(0,0,0,0.04)"` inline style                                            | P3                                         |
| 14  | `src/app/api/content-gen/preview/[jobId]/route.ts`                                | 68/70       | `background: rgba(196,90,62,0.08)` + `rgba(0,0,0,0.04)` dans `<style>` SSR               | P3 — HTML response, isolé                  |
| 15  | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx`                     | 355         | `style={{ border: "1px solid rgba(0,0,0,0.08)" }}`                                       | P3 — admin                                 |
| 16  | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications-status/page.tsx` | 192         | `style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}`                                 | P3                                         |
| 17  | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/page.tsx`   | 79          | `style={{ border: "1px solid rgba(0,0,0,0.08)" }}`                                       | P3                                         |

**Analyse** :

- `#4`, `#8`, `#10` × 4 : exact même valeur que `--shadow-cta-terracotta` déjà tokenisée. **Drop-in fix** : remplacer par `shadow-[var(--shadow-cta-terracotta)]` ou créer utilitaire Tailwind `shadow-cta-terracotta` dans `@theme`.
- `#1` + `#11` : pattern « CTA primary glow » dupliqué — créer `--shadow-cta-primary: 0 8px 24px -8px rgba(26,77,217,0.6)` (token absent malgré son emploi récurrent).
- `#5/#6/#7` : pattern « badge price shadow » triplé — créer `--shadow-badge-price`.
- Admin content-gen (5 fuites) : low impact (interne) mais cosmétique. À nettoyer en passe groupée.

### Composants admin content-gen — style inline non-doctrine (P3)

Les composants `GeoEventsBanner`, `JobLogStream`, et 3 pages admin content-gen utilisent `style={{}}` inline avec valeurs `rgba()` au lieu des utilitaires Tailwind. **Cohérent admin SSR fast-iteration**, mais s'éloigne de la doctrine SSOT. Reco P3 nettoyage.

---

## 5. Composants réutilisables : couverture et fidélité doctrine (10/15)

### `Illustration` / `IllustrationPlaceholder` — Server Component pattern

- `Illustration.tsx` (Server) : wrapper next/image qui bascule en `IllustrationPlaceholder` si `src` manquante.
- `IllustrationPlaceholder.tsx` : SVG placeholder on-brand (palette terracotta soft + grille).
- Convention : `public/illustrations/[page]-[slot].avif`.

**Couverture trouvée** : 12 pages importent `Illustration` (a-propos, blog, cas-concrets, centre-aide, comparaisons, guide-ia, implementation, interventions, methodologie, page (home), presse, roi, stack-ia, etc.) — ✅ excellente diffusion.

**Faille -2 pts** : aucun fichier `public/illustrations/*.avif` réellement présent (mode placeholder partout sauf hero schemas). Will mentionne le pattern « drop l'image GPT-image dans `public/illustrations/` et set `src=`». État : **infrastructure prête, contenu manquant** (action humaine). Non-bloquant prod, mais réduit l'impact du Sprint Visual Rhythm 2026.

### `DetailHeroSchema` — 4 sites consommateurs

- Bien doctrinaire (accent paramétré, blocks 2-5, role=img, lucide icons, fontFamily serif italique).
- Sous-utilisé hors `/interventions/*`. Cf. §3 ci-dessus pour reco P2.

### Faille -3 pts

- `ProductPageTemplate.tsx` consomme DetailHeroSchema → bon. Mais les détails `Audit*`, `Conference`, `Dirigeants`, `Collectives*`, `Individual*` ont chacun leur hero spécifique — pas catastrophique mais friction DRY.

---

## 6. `use client` — 82 directives, 0 injustifié (10/10)

Le lint `pnpm use-client:check` passe. Chaque directive est précédée/suivie d'un commentaire `// use-client: <reason>` (cf. `scripts/check-use-client.ts`).

Répartition (échantillon) :

| Catégorie                                                  | Count | Justifications typiques                       |
| ---------------------------------------------------------- | ----- | --------------------------------------------- |
| Forms admin (`*Form.tsx`)                                  | ~14   | react-hook-form + zodResolver + Server Action |
| UI Radix wrappers (`accordion`, `dialog`, `popover`, etc.) | ~13   | Radix uses React context + browser refs       |
| Forms public (`AuditForm`, `ContactForm`, etc.)            | ~8    | react-hook-form + Turnstile widget            |
| Nav (Header, MegaMenu, MobileNav, LocaleSwitcher)          | 5     | useState dropdown + pathname dynamic          |
| Calendar (BookingFlow, HouseCalendar, etc.)                | 4     | datepicker + selection state                  |
| Analytics (Clarity, WebVitals, RefererTracker, Cookies)    | 4     | window-only APIs                              |
| Motion (FadeInOnView, TestimonialsCarousel)                | 2     | IntersectionObserver + setInterval            |
| Misc (StickyMobileCta, RoiSimulator, ToC, AuditHubToggle)  | ~6    | useState UI                                   |

Aucune fuite « use client » sur un component pur display (vérifié par échantillonnage). Le linter custom Will est le gardien le plus mature du repo.

---

## 7. `prefers-reduced-motion` — VERT global (inclus dans 10/10 ci-dessus)

```
src/app/globals.css:392-405
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation: none !important;
  }
}
```

`FadeInOnView` documente explicitement l'héritage (« déjà géré globalement par globals.css, pas besoin de hook React dédié »).

✅ Aucun composant n'override `transition-duration` avec valeur fixe non-token. `TestimonialsCarousel` à vérifier en P2 (`useEffect` auto-rotate ne respecte pas reduce-motion en JS — patch trivial : check `matchMedia('(prefers-reduced-motion: reduce)').matches`).

---

## 8. Top 10 composants partagés : tests présents ? (7/15)

| #   | Component                   | Test colocated             | Statut                                 |
| --- | --------------------------- | -------------------------- | -------------------------------------- |
| 1   | `ui/button.tsx`             | ✅ `button.test.tsx`       | OK                                     |
| 2   | `ui/badge.tsx`              | ✅ `badge.test.tsx`        | OK                                     |
| 3   | `ui/card.tsx`               | ✅ `card.test.tsx`         | OK                                     |
| 4   | `ui/alert.tsx`              | ✅ `alert.test.tsx`        | OK                                     |
| 5   | `ui/input.tsx`              | ❌ aucun                   | **MANQUANT P1** (input critique forms) |
| 6   | `ui/select.tsx`             | ❌ aucun                   | **MANQUANT P2** (Radix wrapper)        |
| 7   | `ui/dialog.tsx`             | ❌ aucun                   | **MANQUANT P2**                        |
| 8   | `sections/Hero.tsx`         | ✅ `Hero.test.tsx`         | OK                                     |
| 9   | `sections/FeatureGrid.tsx`  | ✅ `FeatureGrid.test.tsx`  | OK                                     |
| 10  | `sections/ProcessSteps.tsx` | ✅ `ProcessSteps.test.tsx` | OK                                     |

**Couverture composants UI** : 4/13 (31 %). **Couverture sections** : 3/52 (6 %).

**Hero schemas non testés** : 0/14 → P2 ajouter snapshot test au moins pour `DetailHeroSchema` (paramétrable, donc plus exposé aux régressions).

**Reco P2** : ajouter tests `input.test.tsx`, `select.test.tsx`, `dialog.test.tsx`, `DetailHeroSchema.test.tsx`, `Illustration.test.tsx`. Coût ~4 h.

---

## 9. Faux positifs & angles morts

### Non-issues confirmés

- `bg-halo-warm` (DetailHeroSchema:81) → utilitaire Tailwind défini ailleurs (à grep en P3 si pas dans `@theme`).
- `src/app/[locale]/design/page.tsx` est volontairement excluded de `anti-hex` (page démo design).
- `rgb(31,27,22)` dans `route.ts` (preview content-gen HTML response) = email/preview-only, isolé. P3 cosmétique.

### Angles morts détectés

- **`tailwind.config.ts` absent** : OK Tailwind v4 native `@theme`, mais aucun `prettier-plugin-tailwindcss` configuré pour ordonner les classes (à vérifier `.prettierrc`).
- **Composants `*Page.tsx` (AuditDetailPage, InterventionDetailPage, CollectiveTrainingPage)** : hero ad-hoc avec rgba en dur. Devraient consommer `DetailHeroSchema` paramétré.
- **Token `--shadow-cta-primary` manquant** alors que pattern dupliqué Header + Stack-IA + … → créer token + utility Tailwind.
- **Aucun ADR récent sur shadow tokens** : ADR 0002/0007 traitent palette/typo, rien sur shadow. À documenter.

---

## 10. P0 / P1 / P2

### P0 (bloquant prod) : aucun

Aucune régression bloquante. Le DS est solide.

### P1 (sprint correctif, ~6-8 h)

1. **Wirer `shadow-cta-terracotta` token sur ses 6 sites dupliqués** (interventions/page.tsx ×2, collectives/page.tsx ×3, CollectiveDurationListing.tsx). Drop-in `className="shadow-[var(--shadow-cta-terracotta)]"`. Gain : SSOT + 1 endroit pour ajuster glow.
2. **Créer token `--shadow-cta-primary` dans `@theme`** + l'utiliser sur `Header.tsx` + `stack-ia/page.tsx`. Aligne pattern avec `--shadow-cta-terracotta`.
3. **Durcir `check-anti-hex.sh`** pour matcher aussi `rgba?\(`, `hsla?\(`, et idéalement `shadow-\[.*rgba` (utilitaires Tailwind arbitraires). Bloque régression future. ~10 min.
4. **Tests manquants `input.test.tsx`** (input critique forms public). ~30 min.

### P2 (sprint qualité, ~10-15 h)

5. **Tests manquants** `select.test.tsx`, `dialog.test.tsx`, `DetailHeroSchema.test.tsx`, `Illustration.test.tsx`. ~3 h.
6. **Étendre `DetailHeroSchema`** aux pages `AuditDetailPage`, `Conference`, `Dirigeants`, `Collectives`, `IndividualCoachingPage` (refacto hero ad-hoc → paramétré). ~4 h.
7. **Token `--shadow-badge-price`** pour les 3 badges price triplés. ~30 min.
8. **`TestimonialsCarousel`** : check `matchMedia('(prefers-reduced-motion: reduce)')` côté JS pour stopper auto-rotate. ~30 min.
9. **Nettoyer `style={{}}` inline** dans 5 fichiers admin content-gen (rgba en dur) → utilitaires Tailwind ou tokens. ~2 h.
10. **Drop premières images GPT-image** dans `public/illustrations/` pour bénéficier de l'infra `Illustration` déjà déployée 12× (action humaine + 1 commit set `src=`). ~2 h.

### P3 (chantier doctrine, ~12+ h)

11. **Refacto 12 hero schemas dédiés → `EditorialHeroSchema` paramétré** (props : eyebrow, title, blocks, accent, schema type). Gain DRY massif. ~12 h.
12. **Snapshot test des valeurs computed `globals.css`** (parse + assert paliers typo/colors). ~2 h.
13. **ADR « Shadow tokens v1 »** documentant les 4 patterns shadow tokenisés (cta-primary, cta-terracotta, badge-price, subtle/elevated). ~1 h.

---

## 11. Annexes

### Scripts lint design system disponibles

```
pnpm anti-hex:check        ✅ pass
pnpm contrast:check        ✅ 27/27 pairs WCAG AA
pnpm use-client:check      ✅ 82 directives justifiées
pnpm radius:check          présent (non exécuté ici)
pnpm a11y:audit            playwright @a11y
pnpm bundle:check          size-limit (V6 budget 75 KB gz)
pnpm verify:all            chaîne tout sauf bundle/lhci/a11y
```

### Fichiers clés design system

```
src/app/globals.css                                       1553 lignes, SSOT
src/components/visual/Illustration.tsx                    105 lignes Server
src/components/visual/IllustrationPlaceholder.tsx         (placeholder SVG)
src/components/sections/DetailHeroSchema.tsx              137 lignes paramétré
src/components/sections/*HeroSchema.tsx                   14 fichiers
src/components/ui/{button,badge,card,alert,…}.tsx         13 wrappers Radix/cva
src/components/motion/FadeInOnView.tsx                    66 lignes IntersectionObserver
scripts/check-anti-hex.sh                                 lint hex
scripts/check-use-client.ts                               lint justification
scripts/check-contrast.ts                                 lint WCAG
ADR 0002 Editorial Premium Light                          palette v3
ADR 0007 Modular scale 88 px ceiling                      typo v3.2
ADR 0008 Hero schema doctrine v3.3 (à confirmer)          carré 576×576 lg+
```

### Conventions visibles dans le repo

- Aucun « hex-ok: » présent (pattern ignore lint = inutilisé) → bonne hygiène.
- Aucun `tailwind.config.ts` → Tailwind v4 `@theme` natif.
- 100 % des `use client` justifiés via commentaire — exemplaire.
- `// use-client: <reason>` est un pattern transposable à d'autres projets (extraire en open-source ?).

---

## 12. Scoring détaillé /100

```
Tokens SSOT                          19/20
Typographie modular scale 2026       18/20
Hero schemas v3.3 coverage           17/20
Composants réutilisables (Illu/Detail/Placeholder)  10/15
prefers-reduced-motion + use client  10/10
Tests top composants partagés         7/15
─────────────────────────────────────────
TOTAL                                81/100  →  VERT CONDITIONAL
```

**Verdict final** : VERT CONDITIONAL.
Aucun P0 bloquant. 4 P1 cosmétiques + sprint qualité P2 ~10-15 h pour atteindre VERT GO strict 90+/100.

---

Agent 3.C · fin de rapport.
