# A2 — Audit Design System admin actuel

> Sous-agent Explore, poids ×2 (le plus critique). Lecture seule.
> Date : 2026-05-17.

## Scoring (/150)

| #   | Critère                | Score /10 | Justification                                                                                                         | Existant ? |
| --- | ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Tokens admin           | 1         | Zéro token `--color-admin-*` / `--space-admin-*` / `--text-admin-*` / `--radius-admin-*` / `--shadow-admin-*`.        | Non        |
| 2   | Spacing scale          | 3         | Hardcodé px dans CSS : 4/6/8/10/12/16/18/20/24/32 px empiriques. Pas de scale cohérent.                               | Partiel    |
| 3   | Typography scale admin | 2         | Mixte : `text-xs/11/12/13/14/15/16 px` épars. Pas de `--text-admin-*` variables. Hérité public 18px body.             | Partiel    |
| 4   | Border radius          | 4         | Scale 4/6/8px existante (admin dense, OK), mais en pixels hardcodés dans classes.                                     | Partiel    |
| 5   | Shadows                | 1         | Zéro token `--shadow-admin-*`. Cards utilisent `--shadow-subtle` / `--shadow-card` publics.                           | Non        |
| 6   | Buttons                | 7         | `.admin-button` + ghost + validate + refuse. Variants sans CVA (hardcodé). Pas de icon/link/loading.                  | Oui        |
| 7   | Inputs                 | 6         | `.admin-input` + variantes TOTP. Pas de select/multiselect/combobox/search admin-spécifiques.                         | Partiel    |
| 8   | Tables                 | 6         | `.admin-table` + `.admin-table-empty`. Pas de sort/filter/pagination intégrées. Pas de bulk.                          | Partiel    |
| 9   | Forms                  | 5         | `.admin-form` / `.admin-field` / `.admin-label` / `.admin-form-block` / `.admin-form-row`. Pas d'hint/error inline.   | Partiel    |
| 10  | Cards                  | 6         | `.admin-card` / `.admin-card-label` / `.admin-card-wide` / `.admin-kpi-card`. Pas de variant compact/interactive net. | Partiel    |
| 11  | Modals & Sheets        | 5         | `.admin-modal` + `.admin-cmdk-dialog`. Pas de size variants. Zéro pattern focus-trap unifié.                          | Partiel    |
| 12  | Toasts & Banners       | 4         | `.admin-alert` + 2 variants. Pas d'info/warning distincts. Zéro toast dismiss pattern.                                | Partiel    |
| 13  | Empty states           | 1         | Zéro primitive. `.admin-table-empty` = texte centré simple.                                                           | Non        |
| 14  | Loading states         | 0         | Zéro skeleton admin-spécifique. `Skeleton` public utilisé sporadiquement, dimensions non exactes.                     | Non        |
| 15  | Error states           | 2         | `.admin-alert-error` basique. Zéro RSC/client boundary admin, form-error styling, validation inline.                  | Partiel    |

**Total** : **53/150** (× poids 2 = **106/300 pondéré**)

---

## Inventaire primitives `src/components/ui/**`

- **button.tsx** : variants `primary / secondary / ghost / outline / terracotta / link / destructive` ; sizes `sm/md/lg/xl/icon` ; shapes `rounded/pill` ; loading spinner intégré.
- **card.tsx** : `Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter` ; padding `p-7` (28px éditorial) ; hover shadow growth.
- **input.tsx** : base `h-12 px-4` ; focus terracotta ring ; placeholder `fg-muted/45`.
- **select.tsx** : Radix base ; trigger `h-11 px-3` ; content shadow-card.
- **dialog.tsx** : Radix ; overlay `fg/40 backdrop-blur` ; content `max-w-lg`.
- **sheet.tsx** : Radix slide variants (top/bottom/left/right) ; side `left` défaut `w-3/4 max-w-sm`.
- **badge.tsx** : CVA 5 variants (`neutral / accent / success / warning / danger`).
- **alert.tsx** : 4 variants (`info / success / warning / danger`).
- **label.tsx** : Radix ; `text-sm font-medium`.
- **checkbox.tsx** : Radix ; 24×24 hit-zone WCAG ; indicator Check icon.
- **tabs.tsx** : Radix ; `TabsList` flex border-b ; `TabsTrigger` h-11 underline active ; `TabsContent`.
- **skeleton.tsx** : `animate-pulse rounded-xs` ; dimensions génériques.
- **popover.tsx**, **accordion.tsx**, **dropdown-menu.tsx**, **slider.tsx**, **switch.tsx**, **radio-group.tsx**, **textarea.tsx**, **tooltip.tsx** : présents (non inspectés en détail).

---

## Primitives MANQUANTES pour admin (à créer Phase 3-4)

| Composant                           | Usage attendu                                                                            | Dépend de                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------- |
| `<AdminPageHeader>`                 | Titre + subtitle + actions slot (back/preview/save)                                      | `Button`, `PreviewButton` |
| `<AdminPageShell>`                  | Wrapper layout `grid 240px 1fr` sidebar + main                                           | `AdminSidebar`            |
| `<AdminDetailShell>`                | Colonne droite contenu detail (sticky header + tabs + actions)                           | `Card`                    |
| `<AdminTable>`                      | Wrapper `<table>` : header sticky, sortable icons, row hover/select, pagination intégrée | `Checkbox`                |
| `<AdminTableRow>`                   | Ligne sélectionnable (bulk actions)                                                      | —                         |
| `<AdminTableColumn>`                | Helper colonne triable (chevron up/down)                                                 | —                         |
| `<AdminBadge>` / `AdminStatusBadge` | Variants status `new / pending / processed / archived / confirmed / refused / ...`       | —                         |
| `<AdminFormField>`                  | Label + Input + error/hint inline + required marker                                      | `Label`, `Input`          |
| `<AdminEmptyState>`                 | Icon (lucide) + heading (h3) + description + CTA primary/secondary                       | `Button`                  |
| `<AdminLoadingState>`               | Skeleton avec dimensions exactes (avatar 32×32, line 200px, card 220px, table N rows)    | `Skeleton`                |
| `<AdminErrorState>`                 | RSC `error.tsx` + Client boundary `ErrorBoundary`                                        | —                         |
| `<AdminConfirmDialog>`              | Modal destructive avec 2 actions (cancel/confirm), 2-step pour destructive               | `Dialog`                  |
| `<AdminBreadcrumbs>`                | Nav breadcrumb a11y + responsive collapse mobile                                         | —                         |
| `<AdminTabs>`                       | Variant admin compact (text-xs header, count badge)                                      | `Tabs`                    |
| `<AdminBulkActions>`                | Sticky bottom bar quand sélection > 0                                                    | `Button`, `Checkbox`      |
| `<AdminStatusPill>`                 | Variant `ok / degraded / down / unknown`, compact 11px                                   | —                         |
| `<AdminStatCard>`                   | Tile KPI : label + value + delta + sparkline opt                                         | —                         |
| `<AdminUserMenu>`                   | Dropdown header (account/settings/logout)                                                | `DropdownMenu`            |
| `<AdminNotificationsDropdown>`      | Bell icon + badge count + list                                                           | `DropdownMenu`, `Badge`   |
| `<AdminInlineEdit>`                 | Double-click texte → input in-place                                                      | `Input`                   |
| `<AdminTopbar>`                     | Header sticky `bg-paper border-b` (brand + cmdk + user menu + notifications)             | —                         |
| `<AdminKeyboardHint>`               | Hint visuel `⌘ K`                                                                        | —                         |
| `<AdminFilterChip>`                 | Badge dismissible (filter actif)                                                         | `Badge`                   |

---

## Tokens à introduire dans `src/app/admin.css` (préfixés)

```css
@layer admin-tokens {
  :where(.admin-layout) {
    /* surfaces */
    --color-admin-bg: var(--color-bg);
    --color-admin-surface: var(--color-paper);
    --color-admin-surface-hover: var(--color-sand);

    /* foreground */
    --color-admin-fg: var(--color-fg);
    --color-admin-fg-soft: var(--color-fg-soft);
    --color-admin-fg-muted: var(--color-fg-muted);
    --color-admin-fg-disabled: color-mix(in srgb, var(--color-fg-muted) 60%, transparent);

    /* status (étend Design.md) */
    --color-admin-success: var(--color-sage);
    --color-admin-success-soft: var(--color-sage-soft);
    --color-admin-warning: var(--color-terracotta);
    --color-admin-warning-soft: var(--color-terracotta-soft);
    --color-admin-destructive: var(--color-error);
    --color-admin-destructive-soft: var(--color-terracotta-soft);
    --color-admin-info: var(--color-primary);
    --color-admin-info-soft: var(--color-primary-soft);

    /* spacing dense */
    --space-admin-1: 2px;
    --space-admin-2: 4px;
    --space-admin-3: 6px;
    --space-admin-4: 8px;
    --space-admin-5: 12px;
    --space-admin-6: 16px;
    --space-admin-7: 24px;
    --space-admin-8: 32px;

    /* type */
    --text-admin-xs: 11px;
    --text-admin-sm: 12px;
    --text-admin-md: 13px;
    --text-admin-base: 14px;
    --text-admin-lg: 16px;
    --text-admin-xl: 20px;
    --lh-admin-tight: 1.35;
    --lh-admin-body: 1.5;

    /* radius */
    --radius-admin-sm: 4px;
    --radius-admin-md: 6px;
    --radius-admin-lg: 8px;
    --radius-admin-xl: 12px;

    /* shadows */
    --shadow-admin-1: 0 1px 0 rgb(0 0 0 / 0.04);
    --shadow-admin-2: 0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow-admin-3: 0 4px 10px rgb(0 0 0 / 0.06), 0 2px 4px rgb(0 0 0 / 0.04);
    --shadow-admin-4: 0 12px 24px rgb(0 0 0 / 0.1), 0 4px 8px rgb(0 0 0 / 0.06);

    /* z */
    --z-admin-sticky: 10;
    --z-admin-dropdown: 50;
    --z-admin-modal: 100;
    --z-admin-toast: 500;
  }
}
```

---

## Anti-patterns dans le code existant

1. **Hardcoded px dans `globals.css`** (lines 433–1558) — `.admin-button { padding: 12px 24px; font-size: 14px; }`, variant change = édition 30+ règles CSS.
2. **Duplication status badge classes** (lines 863–903) — 14 classes `.admin-badge-<status>` répétant chacune `display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px`. CVA serait minimal.
3. **Button styles scattered** (lines 558–585) — pas de système cohérent. `.admin-button` hardcodé `width: 100%` (breaks outline variants).
4. **Form inputs mixtes** — pas de composant wrapper `<AdminFormField>` autour de `.admin-input` / `.admin-input-totp` / `.admin-input-with-toggle`.
5. **Table sans composant** (lines 834–861) — uniquement CSS. Pas de wrapper TS avec sort/filter/bulk intégré. Pagination détachée.
6. **Zéro `:focus-visible` standardisé admin** — `.admin-cmdk-input:focus { outline: none; }` sans ring de remplacement.
7. **Tiptap toolbar ad-hoc** (lines 1092–1180) — `.tiptap-toolbar button` hardcodé sans réutiliser `.admin-button`.
8. **Calendar grid empirique** (lines 994–1058) — `.admin-calendar-cell { min-height: 90px; padding: 8px; }` hardcodé, pas de tokens.

---

## Préservation obligatoire

- **`src/components/ui/**.tsx`\*\* : extensible seulement (jamais modifier l'API existante). Variants CVA peuvent s'ajouter, jamais se retirer.
- **`globals.css @theme`** (lines 13–194) : intouchable. Tous les tokens publics restent SSOT pour la marque Axion-IA.
- **`globals.css .cta-lift / .display-editorial / .hero-schema`** (lines 240–301) : utilitaires éditoriaux signature — réserver au public, jamais admin.

---

**Conclusion** : design system admin quasi inexistant (53/150). La Phase 2 doit produire l'ADR 0028 + créer `src/app/admin.css` + scaffold `src/components/admin/ui/**` avec ~23 primitives. Le ROI est massif (8 anti-patterns récurrents éliminés).
