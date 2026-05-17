# A3 — Audit Pages catégoriques admin (12 pages × 10 critères)

> Sous-agent Explore, poids ×1.5. Lecture seule.
> Date : 2026-05-17.

## Matrice de scoring (/100 par page)

| Page                     | Header | Toolbar | Table | Form | Empty | Loading | Error | Détail | États | A11y | Total /100 |
| ------------------------ | ------ | ------- | ----- | ---- | ----- | ------- | ----- | ------ | ----- | ---- | ---------- |
| dashboard                | 9      | 6       | 0     | 3    | 9     | 3       | 2     | N/A    | 8     | 4    | 44         |
| calendrier               | 9      | 8       | 9     | 3    | 9     | 5       | 3     | N/A    | 8     | 5    | 59         |
| reservations             | 9      | 8       | 9     | 0    | 9     | 3       | 2     | 7      | 8     | 4    | 59         |
| devis                    | 9      | 8       | 8     | 0    | 8     | 3       | 2     | 7      | 7     | 4    | 56         |
| factures                 | 9      | 9       | 9     | 0    | 8     | 3       | 2     | 7      | 8     | 4    | 59         |
| content-gen (home)       | 9      | 8       | 0     | 8    | N/A   | 5       | 3     | N/A    | 8     | 5    | 46         |
| content-gen/coverage     | 9      | 7       | 8     | 7    | 8     | 3       | 2     | 6      | 6     | 4    | 60         |
| content-gen/jobs         | 9      | 9       | 9     | 0    | 8     | 3       | 2     | 8      | 7     | 4    | 59         |
| content-gen/publications | 9      | 7       | 8     | 7    | 8     | 3       | 2     | 7      | 7     | 4    | 62         |
| content-gen/review-queue | 9      | 7       | 8     | 7    | 8     | 3       | 2     | 7      | 7     | 5    | 63         |
| image-bank/library       | 7      | 6       | 0     | 0    | 9     | 3       | 2     | 8      | 6     | 3    | 44         |
| users                    | 9      | 7       | 9     | 7    | 8     | 3       | 2     | 7      | 8     | 4    | 64         |

**Total cumulé** : 644/1200 (× poids 1.5 = **966/1800 pondéré**)
**Moyenne par page** : **53.7/100**

---

## Top 10 patterns à standardiser

1. **PageHeader pattern** (12×) — `.admin-dashboard-head` réinventé titre + meta + actions. → primitive `<AdminPageHeader title description primaryAction>`.
   - LOC : dashboard:240-251, calendrier:76-83, reservations:151-158, etc.

2. **Filtre+Toolbar morcellé** (10×) — `<div className="admin-filters-grid">` + `<select>` inline + `<button>Filtrer` sans cohérence UX. → `<AdminFilterForm filters={} onSubmit={}>`.
   - LOC : reservations:160-179, devis:107-126, factures:129-175.

3. **Tableau statique sans actions inline** (5×) — colonnes figées, actions toujours « → Détail ». Manque sort header clickable, row hover, bulk actions, inline edit.
   - LOC : reservations:182-241, devis:129-177, factures:177-223, jobs:206-254.

4. **Empty state disparate** (12×) — texte hardcodé, no icon, no CTA. Plusieurs pages omettent l'empty state.
   - LOC : reservations:196-201, factures:192-196, coverage:127-130.

5. **KPI cards inline vs composant** (3×) — `function KpiCard()` redéfini localement (dashboard:313, content-gen:125). → `src/components/admin/KpiCard.tsx` puis `<AdminStatCard>`.

6. **Form validation → Server Actions loose** (6×) — pas de wrapper réutilisable. Chaque page fait `<form action={...}>` à la main, pas de visual feedback pending.
   - LOC : content-gen:36-53 (quickGen), coverage:63-110 (filter form).

7. **Status badge multi-énumération** (10×) — `admin-badge admin-badge-${status}` supposé exister, CSS partiel. 8 enums Prisma à mapper.
   - LOC : reservations:224-226, globals.css absent pour certains statuts.

8. **Pagination pattern ad-hoc** (8×) — certaines pages hardcode `← Précédent / Suivant →`, d'autres omettent. Pas de composant.
   - LOC : reservations:243-267, factures:226-250, review-queue:153-177.

9. **Role-based visibility inline** (3×) — chaque page vérifie le rôle localement. Pas de middleware/hook partagé.
   - LOC : calendrier:71-72, users:30-31.

10. **A11y présent mais minimal** — `aria-live` / `aria-label` / `aria-disabled` sporadiques. Pas de `tabindex` explicite ni shortcut documenté.
    - LOC : review-queue:153-177 (bon exemple), sinon absent.

---

## Anti-patterns récurrents

- **No loading skeleton** — toutes pages `force-dynamic` sans skeleton. Réseau bloque rendu.
- **Emojis SVG inline au lieu d'icônes** — `🏙️ 📝 🔑` dans le JSX (content-gen:177-228, calendrier:99-117).
- **No error boundary** — aucune page n'a try-catch RSC ni ErrorBoundary client pour erreurs Prisma.
- **Formatage date/devise dupliqué** — `formatDate / formatEur` redéfinis dans 12 pages. Pas de `src/lib/format.ts` central.
- **URL params magic strings** — `?status=awaiting_admin_validation` hardcodé 10+ fois.
- **Formulaires sans reset/autofocus** — aucun `autoFocus` ni `ref.current.focus()` post-submission.

---

## Sous-composants partagés identifiés

- **`SubmitButton`** (`src/components/admin/content-gen/SubmitButton.tsx`) — bien fait, à promouvoir vers `src/components/admin/ui/AdminSubmitButton.tsx`.
- **`<select>` patterns** (10 pages) — pas de composant `<AdminSelect>` abstrait.
- **Status badge styling** — `<AdminStatusBadge>` à créer (mappe enum → variant).
- **Filter link toggles** — patterns divergents (`<Link>`, `<form>`, `<select>`). Unifier en `<AdminFilterTabs>`.
- **Table columns/headers** — 0 réutilisation.

---

## Préservation obligatoire

- **Server Actions consommées** : `getCalendarMonthAction()`, `listCampaigns()`, `approveReview()`, `archiveArticle()`, etc. Avant refactor, mapper chaque action vers sa destination.
- **DOM IDs ciblés par e2e tests** : vérifier les Playwright specs avant centralisation forms.
- **URL query params API** : pagination `?page=`, filtres `?status=`, sort `?sort=` — contrat à documenter avant standardisation.
- **`force-dynamic` + `await auth()`** : chaque page redirect-si-non-authentifiée. Pas de middleware global pour l'instant.

---

## Chantiers prioritaires

| Priorité | Action                                                            | Impact          | Effort  | Dépendance            |
| -------- | ----------------------------------------------------------------- | --------------- | ------- | --------------------- |
| P0       | Extraire `<AdminPageHeader>`, `<AdminTable>`, `<AdminPagination>` | -35 % LOC moy.  | 3 jours | Phase 2 ADR posé      |
| P0       | Centraliser `formatDate()`, `formatEur()` → `src/lib/format.ts`   | Cohérence       | 2 h     | —                     |
| P1       | `<AdminStatusBadge>` + CSS token `.admin-badge-*` complétés       | A11y + maintien | 4 h     | Tokens admin Phase 3  |
| P1       | `<AdminFilterForm>` wrapper                                       | UX fluide       | 1 jour  | Form validation spec  |
| P2       | Loading skeleton pour pages `force-dynamic`                       | Perceptive perf | 2 jours | `<AdminLoadingState>` |
| P2       | Documenter URL contract (`?status=`, `?page=`) dans ADR 0029      | Contrat API     | 4 h     | —                     |
