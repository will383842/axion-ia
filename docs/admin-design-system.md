# Admin Design System v1 (Mai 2026)

> Statut : Foundation Implemented (PRs 0-5 + 13 livrées) ; migrations per-page incrémentales restantes.
> ADR : [`docs/adr/0028-admin-design-system-v1.md`](./adr/0028-admin-design-system-v1.md).
> Audits / décisions : [`_AUDIT/ADMIN-REFONTE-2026-05-17/`](../_AUDIT/ADMIN-REFONTE-2026-05-17/).

## Vue d'ensemble

L'admin v2 introduit un design system **strictement cloisonné** sous :

- `src/app/admin.css` — tokens admin préfixés (importé uniquement par le layout admin).
- `src/app/print.css` — print mode (factures/devis/échéanciers).
- `src/components/admin/ui/**` — 28 primitives admin (ne JAMAIS importer hors admin).
- `src/lib/admin-nav.ts` — SSOT navigation (sidebar + cmdk consomment).
- `src/lib/feature-flags.ts` — toggle `ADMIN_V2_ENABLED` + cookie override.

Aucun token public (`globals.css @theme`) ni composant `src/components/ui/**` n'a été modifié.

## Tokens admin

Tous préfixés `--*-admin-*`. Cf. [`src/app/admin.css`](../src/app/admin.css) pour la liste complète.

| Catégorie  | Préfixe              | Exemples                                                             |
| ---------- | -------------------- | -------------------------------------------------------------------- |
| Surfaces   | `--color-admin-*`    | `bg`, `paper`, `paper-alt`, `surface-hover`, `border`                |
| Foreground | `--color-admin-fg*`  | `fg`, `fg-soft`, `fg-muted`, `fg-disabled`                           |
| Status     | `--color-admin-*`    | `success / warning / destructive / info / neutral` + `*-soft / *-fg` |
| Spacing    | `--space-admin-*`    | `1` (2px) à `9` (48px)                                               |
| Typography | `--text-admin-*`     | `xs` (11px) à `2xl` (24px) + `--lh-admin-*`                          |
| Radius     | `--radius-admin-*`   | `sm` (4px) à `xl` (12px)                                             |
| Shadows    | `--shadow-admin-*`   | `1` (subtle) à `4` (modal)                                           |
| Z-index    | `--z-admin-*`        | `base / sticky / dropdown / modal / toast`                           |
| Targets    | `--target-admin-*`   | `min-desktop` (24px) / `min-mobile` (44px) (WCAG 2.2 §2.5.8)         |
| Timings    | `--duration-admin-*` | `fast / base / slow` + `--easing-admin`                              |

### Étendre les tokens

Ajouter dans `src/app/admin.css` à l'intérieur du `@layer admin-tokens`. **Ne jamais modifier** les variables existantes (compat ascendante).

## Primitives livrées (28 composants)

Import : `import { ... } from "@/components/admin/ui"`.

### Layout & shells

- `<AdminPageShell>` — wrapper page (width `full / narrow / wide`).
- `<AdminPageHeader>` — title + description + breadcrumbs + actions + meta.
- `<AdminTopbar>` — header sticky (brand + breadcrumbs + cmdk + notifications + user menu).
- `<AdminToolbar>` — filters + search + sort + actions slots, `role="toolbar"`.
- `<AdminCard>` — 3 variants (compact / informational / interactive), 3 elevations.

### Navigation

- `<AdminSidebarNav>` — v2 sidebar (icônes lucide, collapse 64px via Cmd+B, search, groupes collapsibles).
- `<AdminBreadcrumbs>` — a11y nav, truncation 5 items.
- `<AdminTabs>` — count badge, aria-current, min target.
- `<AdminUserMenu>` — dropdown native `<details>` (email + 2FA + settings + logout).
- `<AdminNotificationsDropdown>` — bell + badge counter + liste 5 + lien « voir toutes ».

### Données

- `<AdminTable<T>>` — générique typée, sortable (aria-sort), row hover, empty fallback.
- `<AdminPagination>` — Précédent / Suivant + preserved params.
- `<AdminBulkActions>` — sticky bottom bar quand selection > 0.
- `<AdminFilterChip>` — dismissible (href ou callback).

### Formulaires

- `<AdminFormField>` — label + input/textarea/select + hint + error inline. A11y : `aria-required`, `aria-invalid`, `aria-errormessage`, `aria-describedby`.
- `<AdminFormSection>` — section verticale + variante collapsible (`<details>`).
- `<AdminSubmitButton>` — `useFormStatus` React 19 (disabled pendant pending).
- `<AdminInlineEdit>` — clic → input → Enter/ESC.

### Présentation

- `<AdminBadge>` — 6 tones (`neutral / info / success / warning / destructive / outline`).
- `<AdminStatusBadge>` — mappe enum Prisma → tone (booking/invoice/quote/job/publication/user-role/image-asset/review).
- `<AdminStatCard>` — KPI tile (delta auto-colored + lien opt).
- `<AdminKeyboardHint>` — `<kbd>` stylé pour shortcuts.
- `<AdminAutosaveIndicator>` — états idle/saving/saved/error.

### États

- `<AdminEmptyState>` — icon + heading + body + CTA. 3 variants (card / inline / not-found).
- `<AdminLoadingState>` — skeleton 5 variants (table / card / stat-grid / detail-header / form), dimensions exactes (CLS = 0).
- `<AdminErrorState>` — `role="alert"`, detail dev-only. 2 variants (page / inline).

### Modals

- `<AdminConfirmDialog>` — destructive avec require-type-to-confirm (2-step).

### UX critique (mitigations §3.6-3.7 master prompt)

- `<AdminSessionExpiryWarning>` — heartbeat 5min `/api/admin/session-ping`, modal non-bloquante (`Reconnect` + `Save local draft`).
- `<AdminConflictDialog>` — optimistic concurrency `updatedAt` round-trip.

## Trio error/loading/not-found

Couverture des 116 routes admin via héritage Next 16, au niveau `src/app/[locale]/(admin)/[adminPrefix]/` :

- `error.tsx` (client, Sentry capture + tags `route=admin/boundary=adminPrefix-root`)
- `loading.tsx` (RSC, `<AdminLoadingState variant="card">`)
- `not-found.tsx` (RSC, `<AdminEmptyState variant="not-found">`)

Override par section dense (`content-gen/`, `image-bank/`, `factures/`) possible en posant un trio plus profond.

## Patterns canoniques

Voir [`_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md`](../_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md) pour les 5 templates :

1. Page liste (resource/page.tsx)
2. Page détail (resource/[id]/page.tsx)
3. Page formulaire (resource/new/page.tsx + edit)
4. Page dashboard (page.tsx racine)
5. Page settings (settings/page.tsx)

## Feature flag

```tsx
import { isAdminV2Enabled } from "@/lib/feature-flags";

export default async function Page() {
  const v2 = await isAdminV2Enabled();
  return v2 ? <PageV2 /> : <PageV1 />;
}
```

- Bascule globale : env var `ADMIN_V2_ENABLED=true`.
- Override per-session : cookie `admin_v2=1` (Will peut tester V2 dans son navigateur sans flip prod global).

## Endpoint session-ping

`GET /api/admin/session-ping` :

- 200 `{ ok: true, expiresAt: "<ISO>" }` si session valide.
- 401 `{ ok: false }` sinon.
- `Cache-Control: no-store`.

Consommé par `<AdminSessionExpiryWarning>` monté dans `layout.tsx` admin.

## A11y WCAG 2.2 AA

Tous les composants respectent :

- `:focus-visible` ring (2px primary + offset 2px).
- `aria-*` (current, sort, invalid, required, errormessage, describedby, live, pressed, busy).
- `role` (alert, status, toolbar, navigation).
- Min target size desktop 24×24px, mobile 44×44px (WCAG 2.2 §2.5.8).
- `@media (prefers-reduced-motion: reduce)` → transitions 0ms.
- Focus trap natif via `<dialog>` (showModal).
- Return focus to trigger sur modal close.

## Préservations

Aucune régression sur :

- Server Actions admin (signatures inchangées).
- API routes admin (`/api/admin/**` intactes, sauf `session-ping` ajouté).
- Prisma schema / RLS / migrations.
- Workers BullMQ.
- Auth.js config / middleware admin (`adminPrefix` validation, FR redirect).
- CSP nonce + COEP.
- `logActivity()` audit trail (26 occurrences content-gen intactes).
- `force-dynamic` sur 50+ pages admin.
- Endpoints SSE (`JobLogStream`, `GeoEventsBanner` — contrat préservé).
- Sentry instrumentation.

## Tests

- **Vitest** : ~50 tests primitives admin (cf. `*.test.tsx` colocalisés + `src/lib/admin-nav.test.ts`).
- Couverture cible primitives ≥ 80 % (atteinte sur `AdminPageHeader / Badge / StatusBadge / EmptyState / FormField / Pagination / LoadingState` + `admin-nav`).
- Total projet : 937 tests verts (vs 887 baseline pré-refonte).

## Roadmap migrations per-page (PRs 6-12 reportées)

Les primitives sont prêtes. La migration des 116 routes admin reste à faire incrémentalement :

- PR 6 — pages main (9 routes) : dashboard, calendrier, reservations, devis, factures, paiements, echeanciers, options, submissions.
- PR 7 — pages content-gen (48 routes) — FOCUS WILL.
- PR 8 — pages image-bank (15 routes).
- PR 9 — pages content (blog, categories, etc.).
- PR 10 — pages ops (analytics, web-vitals, infra, alerts, newsletter).
- PR 11 — pages système (users, activity-logs, settings, 2fa).
- PR 12 — polish UX (shortcuts, optimistic updates, autosave Tiptap localStorage).

Effort estimé restant : ~50h (cf. `IMPLEMENTATION-PLAN.md`).

Méthode par page :

1. Lire la page actuelle (`page.tsx` + sous-composants).
2. **Inventorier** Server Actions / hooks / loaders / fetchs — **0 modification**.
3. **Remplacer uniquement le JSX** par les primitives admin/ui/\*\*.
4. **Préserver** les `key`, `id`, `name`, `aria-*` ciblés par e2e tests.
5. Tester `pnpm test:e2e:admin` (au moins le smoke).
6. Bench Lighthouse desktop (≥ 90).
