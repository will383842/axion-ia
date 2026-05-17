# IMPLEMENTATION-PLAN — Refonte admin v2

> Sortie Phase 2. Plan d'exécution séquentiel sur `main` local (0 push origin).
> Référence : ADR 0028 + PATTERNS.md + master prompt §6.4.

## Vue d'ensemble

15 PR-équivalents (PR 0 → PR 14), chacun atomique-mergeable, séquentiel sur `main` local.

| PR  | Thème                                                                                                              | LOC estimées | Effort | Risque           |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------ | ------ | ---------------- |
| 0   | Pré-flight (baseline + flag + screenshots + session-ping)                                                          | ~250         | 2 h    | Très faible      |
| 1   | Foundation tokens + admin.css + shell + mitigations §3.6-7                                                         | ~600         | 4 h    | Faible           |
| 2   | Primitives batch 1 (PageShell, PageHeader, Toolbar, Card)                                                          | ~500         | 3 h    | Faible           |
| 3   | Primitives batch 2 (Table, FormField, EmptyState, ErrorState, LoadingState) + trio error/loading admin             | ~900         | 5 h    | Faible           |
| 4   | Primitives batch 3 (Tabs, Breadcrumbs, ConfirmDialog, Badge, StatCard, InlineEdit, BulkActions, AutosaveIndicator) | ~800         | 5 h    | Faible           |
| 5   | Sidebar v2 + Topbar + UserMenu + NotificationsDropdown + CommandPalette enrichi                                    | ~900         | 6 h    | Moyen (SSOT nav) |
| 6   | Migration pages main (9 routes) + optimistic concurrency top-4                                                     | ~1200        | 6 h    | Moyen            |
| 7   | Migration pages content-gen (48 routes) — FOCUS WILL + heartbeat + Tiptap autosave                                 | ~2500        | 10 h   | Moyen-Haut (SSE) |
| 8   | Migration pages image-bank (15 routes) — APRÈS merge PR #14                                                        | ~800         | 4 h    | Faible           |
| 9   | Migration pages content (blog, categories, case-studies, testimonials, faq, help, connaissances)                   | ~1200        | 6 h    | Faible           |
| 10  | Migration pages ops (analytics, web-vitals, infra, alerts, newsletter)                                             | ~700         | 4 h    | Faible           |
| 11  | Migration pages système (users, activity-logs, settings, 2fa)                                                      | ~600         | 3 h    | Faible           |
| 12  | Polish UX (shortcuts, optimistic updates, autosave, undo, anti-friction)                                           | ~600         | 5 h    | Faible           |
| 13  | Tests anti-régression (Playwright admin 30 flows + visual diff + Vitest primitives + Lighthouse CI admin)          | ~800         | 5 h    | Faible           |
| 14  | Retrait flag ADMIN_V2_ENABLED + suppression `_v1/` + ADR + docs/admin-design-system.md + cleanup                   | ~400         | 3 h    | Faible           |

**Total estimé** : ~12 250 LOC, ~71 h cumulées (cohérent fourchette master prompt 35-55 h en parallèle agents).

---

## Détail par PR-équivalent

### PR 0 — Pré-flight §3bis

**Tag start** : `admin-refonte-baseline-2026-05-17` (déjà créé).
**Livrables** :

- ✅ `_AUDIT/ADMIN-REFONTE-2026-05-17/` scaffolding (`README.md`, `JOURNAL.md`)
- ✅ `src/lib/feature-flags.ts` (`isAdminV2Enabled()`)
- ✅ `tests/e2e/admin-baseline-screenshots.spec.ts` (@baseline gated)
- ⏳ `src/app/api/admin/session-ping/route.ts` (endpoint léger heartbeat session)

**Tag end** : `admin-refonte-pr0-end`.
**Gates** : typecheck + lint + use-client-check + anti-hex + isolation-check.

### PR 1 — Foundation tokens + admin.css + shell + mitigations §3.6-3.7

**Tag start** : `admin-refonte-pr1-start`.
**Livrables** :

- `src/app/admin.css` (tokens préfixés, ~80 lignes).
- `src/app/print.css` (mediaquery print masquant sidebar/header/actions).
- Import `admin.css` + `print.css` dans `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`.
- Middleware admin lit cookie `admin_v2=1` (override flag).
- `src/components/admin/ui/AdminShell.tsx` (squelette layout v2 derrière flag, V1 reste intact).
- `src/components/admin/ui/AdminSessionExpiryWarning.tsx` (client, heartbeat 5 min).
- `src/components/admin/ui/AdminConflictDialog.tsx` (client, optimistic concurrency).
- `src/lib/admin-nav.ts` (SSOT nav extraite de `layout.tsx`).

**Tag end** : `admin-refonte-pr1-end`.
**Gates** : tous + Lighthouse admin home reste ≥ 90 + Playwright smoke vert + visual diff acceptable (V1 path préservé).

### PR 2 — Primitives batch 1

**Tag start** : `admin-refonte-pr2-start`.
**Livrables** : `<AdminPageShell>`, `<AdminPageHeader>`, `<AdminToolbar>`, `<AdminCard>`. Vitest sur chaque (snapshot + a11y).
**Tag end** : `admin-refonte-pr2-end`.

### PR 3 — Primitives batch 2 + trio error/loading admin

**Tag start** : `admin-refonte-pr3-start`.
**Livrables** :

- `<AdminTable>` générique + `<AdminTableColumn>`.
- `<AdminFormField>` + `<AdminFormSection>`.
- `<AdminEmptyState>`, `<AdminLoadingState>` (5 variants), `<AdminErrorState>`.
- `src/app/[locale]/(admin)/[adminPrefix]/error.tsx` (RSC + reset).
- `src/app/[locale]/(admin)/[adminPrefix]/not-found.tsx`.
- `src/app/[locale]/(admin)/[adminPrefix]/loading.tsx` (skeleton générique).

**Tag end** : `admin-refonte-pr3-end`.

### PR 4 — Primitives batch 3

**Tag start** : `admin-refonte-pr4-start`.
**Livrables** :

- `<AdminTabs>`, `<AdminBreadcrumbs>`, `<AdminConfirmDialog>`.
- `<AdminBadge>` + `<AdminStatusBadge>` (mappe enums Prisma → variants).
- `<AdminStatCard>`, `<AdminInlineEdit>`, `<AdminBulkActions>`.
- `<AdminAutosaveIndicator>` (used by Tiptap wrapper PR 7).
- `<AdminPagination>`, `<AdminFilterChip>`, `<AdminKeyboardHint>`.
- `<AdminSubmitButton>` (promu depuis content-gen).

**Tag end** : `admin-refonte-pr4-end`.

### PR 5 — Sidebar v2 + Topbar + UserMenu + NotificationsDropdown + CommandPalette enrichi

**Tag start** : `admin-refonte-pr5-start`.
**Livrables** :

- `<AdminSidebarNav>` v2 (refonte `AdminSidebar.tsx` : icônes lucide, collapse 64px, groupes collapsibles, search interne).
- `<AdminTopbar>` (breadcrumbs + cmdk trigger + UserMenu + NotificationsDropdown).
- `<AdminUserMenu>` (DropdownMenu Radix : email + 2FA status + logout).
- `<AdminNotificationsDropdown>` (counter + list, V1 stub si pas de data).
- `<AdminCommandPalette>` enrichi (lit `src/lib/admin-nav.ts` SSOT, recent, shortcuts).
- Override per-session cookie `admin_v2=1` activé.

**Tag end** : `admin-refonte-pr5-end`.
**Risque** : casser le contrat SSOT nav. Mitigation : test e2e qui vérifie que cmdk affiche les 36 items et que sidebar affiche les 6 groupes.

### PR 6 — Migration pages main + optimistic concurrency top-4

**Tag start** : `admin-refonte-pr6-start`.
**Routes migrées** : `/`, `/calendrier`, `/reservations`, `/devis`, `/factures`, `/paiements`, `/echeanciers`, `/options`, `/submissions` (9 routes).
**Optimistic concurrency** : ajouter `updatedAt` round-trip dans top-4 ressources (Publication / Reservation / Devis / Facture).
**Pattern** : pour chaque page, V1 dans `_v1/` (déplacé), V2 dans `_v2/`. `page.tsx` racine = switch flag.
**Tag end** : `admin-refonte-pr6-end`.

### PR 7 — Migration pages content-gen (FOCUS WILL)

**Tag start** : `admin-refonte-pr7-start`.
**Routes migrées** : 48 routes content-gen.
**Patches UX** :

- Coverage/new → modal 3-step.
- Review queue → modal `<DiffViewer>`.
- Jobs detail → timeline Gantt CSS.
- Geo → searchbox autocomplete villes + favoris.
- TiptapEditor → dynamic SSR=false + autosave localStorage + AdminSessionExpiryWarning + AdminConflictDialog wiring.
- JobLogStream + GeoEventsBanner → wrapper UI uniquement, contrat SSE intact, reconnect 5×.

**Tag end** : `admin-refonte-pr7-end`.
**Risque** : casser SSE. Mitigation : grep `EventSource\|withCredentials` avant/après → diff = 0.

### PR 8 — Migration pages image-bank (15 routes)

**Tag start** : `admin-refonte-pr8-start`.
**Routes** : overview, library, library/[id], upload, bulk-import, quality, analytics, categories, tags, usage-logs, settings.
**Note** : déjà bien structuré (skill v1.1). Conversion rapide aux primitives.
**Tag end** : `admin-refonte-pr8-end`.

### PR 9 — Migration pages content

**Tag start** : `admin-refonte-pr9-start`.
**Routes** : `/blog`, `/categories`, `/case-studies`, `/testimonials`, `/faq`, `/help`, `/connaissances`.
**Tag end** : `admin-refonte-pr9-end`.

### PR 10 — Migration pages ops

**Tag start** : `admin-refonte-pr10-start`.
**Routes** : `/analytics`, `/web-vitals`, `/infra`, `/alerts`, `/newsletter`.
**Tag end** : `admin-refonte-pr10-end`.

### PR 11 — Migration pages système

**Tag start** : `admin-refonte-pr11-start`.
**Routes** : `/users`, `/activity-logs`, `/settings`, `/2fa/setup`.
**Tag end** : `admin-refonte-pr11-end`.

### PR 12 — Polish UX

**Tag start** : `admin-refonte-pr12-start`.
**Livrables** : keyboard shortcuts (Cmd+S, ESC, J/K), undo toasts (5 actions), filter persistence localStorage, scroll position preserve, form state loss warning, inline editing toggles, bulk actions sur Jobs et Reservations.
**Tag end** : `admin-refonte-pr12-end`.

### PR 13 — Tests anti-régression

**Tag start** : `admin-refonte-pr13-start`.
**Livrables** :

- Playwright admin smoke : 30 flows (login → home → 5 pages clés + 5 actions critiques).
- Visual diff vs `admin-refonte-baseline-2026-05-17` tag (Playwright `toHaveScreenshot`).
- Vitest sur les ~25 primitives admin (snapshot + a11y + props variants).
- Lighthouse CI admin : 3 URLs pilotes (`/`, `/content-gen/jobs`, `/factures`).
- Bundle delta `size-limit` gate admin/\*.

**Tag end** : `admin-refonte-pr13-end`.

### PR 14 — Cleanup & retrait flag

**Tag start** : `admin-refonte-pr14-start`.
**Livrables** :

- Suppression `ADMIN_V2_ENABLED` flag + `isAdminV2Enabled()` helper.
- Suppression cookie `admin_v2` (middleware lit plus).
- Suppression tous les dossiers `_v1/`.
- Update ADR 0028 (statut : Implemented).
- `axionia/docs/admin-design-system.md` (doc primitives + tokens, ≈ 1500 lignes).
- `_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (score /2000).
- `_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md`.
- `_AUDIT/ADMIN-REFONTE-2026-05-17/EXEC-SUMMARY-WILL.md`.
- `_AUDIT/ADMIN-REFONTE-2026-05-17/LISTE-COMMITS-LOCAUX-PRETS.md` (SHA range + tags + commit messages pour push).

**Tag end** : `admin-refonte-pr14-end`.

---

## Boucle de vérification par PR (rappel brief Will)

À chaque PR finalisée, **avant tag `*-end`** :

### A. Gates techniques (bloquants)

```
pnpm typecheck      # 0 erreur
pnpm lint           # 0 erreur, 0 warning nouveau
pnpm test           # 100 % primitives nouvelles, couverture ≥ 80 %
pnpm test:e2e:admin # smoke 30 flows vert
pnpm build          # bundle delta ≤ +5 KB gz vs tag start
pnpm anti-hex       # 0 nouvelle violation
pnpm use-client-check # 0 use-client non justifié
pnpm isolation-check  # 0 leak admin/ui hors admin
+ Playwright visual diff vs baseline (±5 % par zone)
+ Lighthouse desktop ≥ 90 sur 3 URLs admin pilotes
```

### B. Self-review sous-agent indépendant

Lancer Explore agent avec brief :

> Tu n'as PAS écrit ce code. Tu reviens à froid. Lis `git diff admin-refonte-prX-start..HEAD`. Audite contre §3 + §3.5-§3.10 + anti-patterns §13 + doctrine code = SSOT + préservation Server Actions / API / Prisma / Sentry tags / ActivityLog / CSP nonce / force-dynamic / contrat JobLogStream. Verdict APPROVE / REJECT.

Si REJECT → patcher avant tag end (max 3 itérations, sinon résiduel P1 dans JOURNAL.md).

### C. Cross-checks systématiques

```
grep -rn "Sentry\."           <touched> avant/après → diff = 0
grep -rn "logActivity\|ActivityLog\.create" <touched> → diff = 0
grep -rn "nonce"              <server> → nonce préservé
grep -rn "force-dynamic\|revalidate" <admin routes> → mode inchangé
grep -rn "useActionState\|useFormStatus\|useOptimistic" → doctrine React 19 appliquée
```

Test mental scénarios : session-expiry / multi-tab-conflict / reduced-motion / print sur 1 page représentative par PR.

### D. Journal de bord

`_AUDIT/ADMIN-REFONTE-2026-05-17/JOURNAL.md` après chaque PR :

- Date / tags start-end / N commits / SHA range / gates status / verdict sous-agent.
- Décisions autonomes prises + rationale.
- Risques résiduels (P1/P2 pour suivi post-merge).
- Liste fichiers touchés (count + groupes).

---

## Compatibilité ascendante par PR

Chaque PR doit merger indépendamment sans casser :

- **PR 0-4** : ajouts purs (tokens, primitives, mitigations dans `_v2/`). Flag = false par défaut → aucune page utilise les V2. Pages V1 inchangées.
- **PR 5** : Sidebar/Topbar v2 derrière flag. V1 sidebar reste utilisée si flag = false.
- **PR 6-11** : migration par page avec `page.tsx` racine = switch `<PageV1 />` / `<PageV2 />`. Flag = false → V1 toujours rendue.
- **PR 12** : polish, additive only.
- **PR 13** : tests, additive only.
- **PR 14** : flag retiré → bascule globale. À ce stade, V2 doit être 100 % testée.

→ Will peut **arrêter à n'importe quel PR** et revenir au comportement actuel en remettant `ADMIN_V2_ENABLED=false` (ou en supprimant la variable). Aucun push prod prévu dans le cadre de cette refonte autopilote (règle dure §1).

---

## STOP & ASK Will conditions (rappel)

Pendant l'exécution PRs 0-14, je m'arrête seulement si :

1. **Régression fonctionnelle détectée non-réparable** (worker, RLS, auth). → STOP + documentation.
2. **Gate échoue 3× consécutives** sur le même fix → STOP + diagnostic.
3. **Score d'un PR < 350/1000 pondéré** sur l'auto-review (improbable). → STOP.
4. **Besoin ajouter dépendance npm > 30 KB gz**. → STOP + ADR.

Sinon, autopilote intégral jusqu'à PR 14 + Phase 8.
