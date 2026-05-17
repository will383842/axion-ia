# A6 — Audit Performance & Bundle admin

> Sous-agent Explore, poids ×1. Lecture seule (pas de `pnpm build`).
> Date : 2026-05-17.

## Scoring (/80)

| #   | Critère                     | Score /10 | Findings                                                                                                                                                                           | Cible post-refonte                   |
| --- | --------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | First Load JS gz par route  | 5         | 4 composants client lourds (TiptapEditor, AdminCommandPalette ~11.5 KB src, JobLogStream, GeoEventsBanner). Tiptap v3 ~180 KB raw estimé.                                          | ≤ 75 KB std / ≤ 120 KB graphs        |
| 2   | LCP p75                     | 6         | Pages = Server Components pur. Aucun skeleton sur tables/lists → FCP retardé sur tables denses.                                                                                    | ≤ 1 800 ms                           |
| 3   | INP p75                     | 5         | cmdk (~11.5 KB) + AdminSidebar usePathname → hydration layout complète. SSE actifs ajoutent peu mais hydration bloquante.                                                          | ≤ 100 ms                             |
| 4   | CLS (zéro)                  | 4         | Dashboard + calendrier + users sans width/height explicite sur skeletons → layout shift FCP.                                                                                       | = 0                                  |
| 5   | TBT desktop                 | 6         | `force-dynamic` + Prisma `Promise.all` parallel = FCP rapide server. Mais cmdk init + Tiptap init non-lazy = TBT spike hydration.                                                  | ≤ 150 ms                             |
| 6   | Chunks splitting            | 4         | 157 pages partagent 1 layout + AdminSidebar (client) + AdminCommandPalette (client ~11.5 KB). Bundle layout client hydratable global.                                              | Vendor 60K / Commons 40K / Route 35K |
| 7   | Server Component ratio      | 7         | ~155/157 pages RSC, mais 5 composants client (Tiptap, JobLogStream, GeoEventsBanner, AdminSidebar, AdminCommandPalette). cmdk + AdminSidebar dans layout = client boundary global. | ≥ 70 %                               |
| 8   | Tiptap / charts lazy-loaded | 2         | TiptapEditor importe `@tiptap/react + starter-kit` **statiquement**. Pas de `dynamic(... ssr:false)`. Aucun chart en admin (Recharts/Tremor absents). Pas de loading state.        | Dynamic + fallback obligatoire       |

**Total** : **39/80** (ROUGE — seuils AGENTS.md non-alignés)

---

## Inventaire dépendances client admin

**Tiptap** (3 imports) :

- `@tiptap/react@3.22.5` (core ProseMirror bridge).
- `@tiptap/starter-kit@3.22.5` (bold/italic/h1-h6/lists/blockquote/code/hr/strike/underline).
- `@tiptap/pm@3.22.5` (ProseMirror peer, ~80 KB raw).
- **Estimation** : 180-250 KB raw → ~45-65 KB gz après tree-shake.
- **Utilisé** : TiptapEditor.tsx (templates, review-queue, connaissances).

**Charts** : aucun (Recharts/Tremor/Visx absents).

**Sentry browser** : `@sentry/nextjs@10.51.0` installé, intégration probable via `instrumentation.ts` (serveur), pas d'import client direct détecté en admin.

**DnD kit** : `@dnd-kit/core@6.3.1` (~0.5 KB gz minimal). Usage potentiel `/calendrier/reschedule`.

**UI base** : Radix UI (14 imports) tous serveur sauf AdminSidebar/AdminCommandPalette. Lucide-react imports serveur safe. Sonner (toasts) absent en admin.

---

## Composants client (`'use client'`) sous admin

| Fichier                                                          | Raison                                                  | LOC         | Impact                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `src/components/admin/TiptapEditor.tsx`                          | `useEditor` Tiptap + useState 3 champs (html/json/text) | 167         | **45-65 KB gz Tiptap** par route utilisant l'éditeur |
| `src/components/admin/content-gen/JobLogStream.tsx`              | `EventSource` SSE + useEffect/useState live logs        | 159         | 1-2 KB gz                                            |
| `src/components/admin/content-gen/GeoEventsBanner.tsx`           | `EventSource` SSE + useEffect/useState geo events       | 115         | 1-2 KB gz                                            |
| `src/components/admin/AdminSidebar.tsx`                          | `usePathname()` aria-current dynamique                  | 75          | 0.5 KB gz (négligeable, mais hydrate layout)         |
| `src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx` | `cmdk` + Cmd+K palette + useRouter                      | 11.5 KB src | **8-12 KB gz** — dans layout, hydrate tout admin     |

**Nested client boundary risk** : AdminCommandPalette dans layout global ⇒ toute l'admin hydrate comme client malgré `force-dynamic`. Aucun bénéfice SSR pour interactive UI portions.

---

## Patterns à mettre en place (Phase 5/6)

### P0 — Suspense granulaire + Skeleton dimensions

```tsx
// content-gen/page.tsx
export default async function ContentGenDashboard() {
  return (
    <section>
      <Suspense fallback={<DashboardHeadSkeleton />}>
        <DashboardHead />
      </Suspense>

      <Suspense fallback={<KpiGridSkeleton count={8} />}>
        <KpiCards />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={10} cols={7} />}>
        <QuickGenForms />
      </Suspense>
    </section>
  );
}
```

Skeleton requis : `width: 100%`, `height: 44px` (form rows), `min-height: 60px` (KPI card). Élimine CLS.

### P0 — Dynamic `TiptapEditor` avec `ssr: false`

```tsx
const TiptapEditorClient = dynamic(
  () => import("./TiptapEditor").then((m) => ({ default: m.TiptapEditor })),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: 300, background: "#f5f5f5", borderRadius: 4 }}>
        <em>Chargement éditeur…</em>
      </div>
    ),
  },
);
```

Gain : Tiptap ~45 KB gz ne charge que les routes utilisant l'éditeur (templates, review-queue, connaissances).

### P1 — Lazy AdminCommandPalette + route-based trigger

cmdk ~8 KB gz deferred jusqu'au premier keystroke (P(user presses Cmd+K) ≈ 20 % session).

### P2 — Cleanup `EventSource` JobLogStream / GeoEventsBanner

`useCallback` + cleanup explicite pour éviter les leaks SSE.

---

## Patches Phase 5/6 prioritaires

| Prio | Fix                                                                    | Impact                                        | Effort |
| ---- | ---------------------------------------------------------------------- | --------------------------------------------- | ------ |
| P0   | Dynamic TiptapEditor (`ssr: false`) + Suspense fallback                | **-45 KB gz** First Load routes sans editor   | 2 h    |
| P0   | Skeleton templates avec width/height explicite (users/jobs/calendar)   | **CLS = 0**, -200-500 ms LCP shift            | 3 h    |
| P0   | Suspense par section (DashboardHead / KpiGrid / Table séparés)         | **LCP ≤ 1 500 ms** (partial server-render)    | 4 h    |
| P1   | AdminCommandPalette deferred load (Cmd+K trigger)                      | **-8 KB gz First Load**, +1 KB on-demand cmdk | 1.5 h  |
| P1   | Lazy charts (non-détecté mais prévoir pour M10)                        | Future-proof                                  | 0 h    |
| P2   | `useCallback` + cleanup `EventSource` (JobLogStream / GeoEventsBanner) | Memory leak fix                               | 1 h    |
| P2   | Per-route bundle analysis (`size-limit` gate admin routes)             | Prevent regression                            | 2 h    |

---

## Préservation obligatoire

- ✅ `force-dynamic` doit rester sur toutes pages admin (sinon ISR cache stale KPIs/counts/user data).
- ✅ Sentry server instrumentation (si présente) intouchée.
- ✅ Server Actions (quickGen, logoutAction, etc.) conservent leur sémantique mutation.
- ✅ Prisma `Promise.all()` queries = FCP rapide, ne pas refactorer vers séquentiel.
- ❌ NE PAS passer TiptapEditor client-only dans le layout (nested boundary = pas de bénéfice).

---

**Conclusion** : admin bundle dominé par **Tiptap (P0 critique)**. Impact First Load réel ≈ **75 KB shell + 45 KB Tiptap ≈ 120 KB** sur routes editor. Routes simples (dashboard, users, calendar) ≤ 65 KB possible. **CLS risk = HIGH** (aucun skeleton). Phase 5 doit débuter par Tiptap dynamic + Skeleton patterns.
