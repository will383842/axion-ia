# Synthèse Phase 1 — Audit consolidé console admin

> Sortie agrégée des 8 sous-agents Explore (parallèles, lecture seule).
> Date : 2026-05-17.

## Scoring global pondéré

| Sous-agent                           | Poids | Score brut         | Score pondéré | Note                   |
| ------------------------------------ | ----- | ------------------ | ------------- | ---------------------- |
| A1 — Layout & Navigation             | ×1.5  | 52/100             | 78/150        | 🔴 dette UX nav        |
| A2 — Design System                   | ×2    | 53/150             | 106/300       | 🔴 critique            |
| A3 — Pages catégoriques (12 × 10)    | ×1.5  | 53.7/100           | 80.6/150      | 🟠 dispersé            |
| A4 — Content Generator (FOCUS WILL)  | ×2    | 85/120             | 170/240       | 🟢 mature SSE          |
| A5 — A11y WCAG 2.2 AA                | ×1    | 72/100             | 72/100        | 🟡 3 blocages triviaux |
| A6 — Performance & Bundle            | ×1    | 39/80 (=48.75/100) | 48.8/100      | 🔴 Tiptap non-lazy     |
| A7 — Centralisation / Duplication    | ×1.5  | 67/100             | 100.5/150     | 🟡 20 duplications     |
| A8 — UX Micro-frictions (FOCUS WILL) | ×1    | 30/100             | 30/100        | 🔴 critique            |

**Sommes pondérées** : **685.9 / 1290** → normalisé **/1000 = 531.7/1000**.

> **Verdict gate Phase 1 (§5.9 master prompt)** : score 531.7/1000 > seuil 350. **Pas de STOP & ASK**. **GO Phase 2** (conception ADR + plan d'implémentation).

---

## Top 50 findings (priorisés)

### P0 — Bloquants refonte (à fixer avant ou pendant les premières PRs)

1. **Sidebar active link invisible** (A1) — `aria-current="page"` injecté sans styling CSS. → Patch globals.css 1 ligne.
2. **Icônes emoji partout** (A1, A3) — 94 emojis nav + cmdk. → lucide-react.
3. **Skip-to-content absent** (A5) — WCAG 2.4.1. → Patch layout.tsx.
4. **Target size < 24×24** (A5) — `.admin-nav-link`, `.admin-input-toggle`. → Padding min.
5. **Tokens admin inexistants** (A2) — 0 `--color-admin-*`. → Créer `src/app/admin.css`.
6. **Tiptap non-lazy** (A6) — 45-65 KB gz chargé partout. → `dynamic({ ssr: false })`.
7. **Skeletons absents** (A3, A6) — CLS risk. → `<AdminLoadingState>` avec dims exactes.
8. **Aucun error.tsx admin** (00-INVENTORY) — 0/116 routes. → Trio Phase 5.
9. **Aucun not-found.tsx admin** (00-INVENTORY) — 0/116 routes.
10. **Print mode absent** (A8) — factures/devis cassés à l'impression. → `src/app/print.css`.
11. **Autosave Tiptap absent** (A8) — risque perte travail. → localStorage debounce 2s.
12. **SSE reconnect manquant** (A4) — JobLogStream + GeoEventsBanner sans backoff. → Retry 5×.
13. **Coverage création multi-page** (A4) — UX fatigante. → Modal Stepper 3-step.
14. **Aucun undo toast** (A8) — clics destructifs irréversibles silencieux.
15. **Aucun breadcrumb** (A1, A8) — orientation perdue dans 27 sections × 19 sous-sections.

### P1 — Inclus dans refonte (PRs 5-7)

16. Responsive sidebar collapse manquant (A1).
17. AdminCommandPalette redondante avec nav (A1) — extraire SSOT `src/lib/admin-nav.ts`.
18. User menu absent (A1) — `<AdminUserMenu>` Radix DropdownMenu.
19. Focus trap incohérent sur modals custom (A5).
20. `aria-invalid` + `aria-errormessage` absents (A5).
21. `<AdminFormField>` wrapper inexistant (A2, A3, A7).
22. `<AdminTable>` avec sort/filter/bulk inexistant (A2, A3, A7).
23. `<AdminStatusBadge>` unifié inexistant (A3, A7).
24. `<AdminPagination>` réutilisable inexistant (A3, A7).
25. `formatDate / formatEur` dupliqués 12× (A3, A7) — `src/lib/format.ts`.
26. `<AdminConfirmDialog>` (2-step destructive) (A7).
27. `<AdminDetailHeader>` (back + title sticky) (A7).
28. `<AdminStatCard>` (KPI déduit) (A7).
29. `<AdminEmptyState>` standardisée (A3, A7).
30. Review queue : diff côte-à-côte manquant (A4) — `<DiffViewer>`.
31. Jobs detail : timeline Gantt (A4).
32. Geo : searchbox autocomplete villes (A4).
33. Bulk actions checkboxes absents (A8) — Jobs, Reservations.
34. Inline editing absent (A8) — toggles status, dates.
35. Filter persistence (localStorage + presets) (A8).
36. Form state loss on navigation (A8) — beforeunload guard.
37. Image bulk import progress indicator (A8) — SSE / polling.
38. Modal ESC binding manquant (A8) — custom modals.
39. AdminSessionExpiryWarning + heartbeat 5 min (mitigation §3.6).
40. AdminConflictDialog optimistic concurrency (mitigation §3.7) — top-4 ressources.

### P2 — Post-refonte (PR 12+)

41. Sidebar non-sticky (A1).
42. Système alertes (toasts/badge counters) (A1) — `<AdminNotificationsDropdown>`.
43. Doctrine `light-only` signature CSS (A1).
44. Contrast audit complet 12+ combos non-primary (A5).
45. Tabs avec count badge `<AdminTabs>` (A2).
46. TiptapEditor : Image + Link extensions (A4).
47. TemplateForm validation client async (A4).
48. Quality dashboard : alertes trend < -10 pts (A4).
49. Costs : toast budget cap 80 % (A4).
50. `useCallback` + cleanup EventSource (A6) — memory leak.

---

## 10 décisions design à valider Phase 2

1. **Doctrine admin** : « console métier dense, productive, sobre. Réf Linear / Vercel / Stripe Dashboard. Pas Notion (trop éditorial), pas Airtable (trop coloré). »
2. **Tokens** : créer `src/app/admin.css` avec tokens préfixés `--color-admin-*` / `--space-admin-*` / `--text-admin-*` / `--radius-admin-*` / `--shadow-admin-*` / `--z-admin-*`. **Importé uniquement par le layout admin**, jamais par globals.
3. **Primitives** : ~25 composants sous `src/components/admin/ui/**` (cloisonnement strict, jamais importé hors admin — gate `isolation-check` à ajouter).
4. **Sidebar v2** : 240px desktop, collapse 64px icons-only via toggle `Cmd+B` (mémorisé localStorage), groupes collapsibles, search interne nav, icônes lucide.
5. **Topbar contextuelle** : breadcrumbs + actions globales + user menu + notifications dropdown + cmdk trigger.
6. **JobLogStream contrat** : préserver intégralement (transport SSE, endpoints, `withCredentials`, format payload, timing). Le wrapper UI change, le contrat réseau non.
7. **Print mode** : `src/app/print.css` minimal — masquer header/sidebar/actions, monospace montants. Tester sur 3 pages : facture, devis, échéancier.
8. **Feature flag `ADMIN_V2_ENABLED`** : pattern `<PageV1 />` / `<PageV2 />` par page migrée. Override per-session via cookie `admin_v2=1` (middleware lit). Retiré PR 14 finale.
9. **Tiptap dynamic** : import via `dynamic(() => import(...), { ssr: false, loading: ... })` dans toutes les pages utilisatrices.
10. **Trio error/loading/not-found** : couverture minimale au niveau `[adminPrefix]/` (héritage Next 16) + overrides pour sections denses (content-gen, image-bank, factures).

---

## 3 risques de régression majeurs + mitigation

### Risque #1 — Casser le contrat JobLogStream / GeoEventsBanner

Le SSE pipeline content-gen est critique production (Sprint 3 livré, monitoring temps réel). Toute refonte UI doit consommer **les mêmes endpoints avec les mêmes assumptions** (transport, withCredentials, format payload, timing).

**Mitigation** :

- Avant refonte JobLogStream, grep `EventSource` + `withCredentials` avant/après → diff = 0.
- Test e2e SSE dédié : ouvrir page jobs, vérifier reception 1 message log ≤ 5 s, fermer EventSource proprement.
- Bench reconnect : si le wrapper UI introduit auto-reconnect, vérifier que le hook ne sature pas le serveur (cap 5 retries).

### Risque #2 — Perdre des `logActivity()` audit trail

26 occurrences dans 7 fichiers content-gen (≈ 100 % couverture mutations). Si je refonds le JSX d'un `<form>` sans toucher l'action, l'audit trail reste. Si je touche l'action (renaming, signature), risque de perte.

**Mitigation** :

- Aucune Server Action existante ne sera renommée ni déplacée (§3.1).
- Avant chaque PR-équivalent touchant une page content-gen : `grep -rn "logActivity\|ActivityLog\.create" <fichiers touchés>` → diff = 0.
- Test Vitest : pour chaque action critique (jobs.retry, coverage.archive, review.approve), vérifier qu'un `ActivityLog` row est créé.

### Risque #3 — Casser le `force-dynamic` admin → page cachée par ISR

50+ pages admin sont `force-dynamic`. Si une refonte introduit accidentellement `revalidate = N` (par exemple en copiant un template public), KPIs et compteurs deviennent stales → données obsolètes affichées à Will. Pire : data leak si la cache survit après logout.

**Mitigation** :

- Layout admin garde `force-dynamic` (héritage par défaut).
- Avant chaque PR-équivalent : `grep -rn "force-dynamic\|export const revalidate\|export const dynamic" <fichiers touchés>` → diff = 0 régression.
- Si une page migrée a besoin d'ISR (improbable mais possible pour analytics statiques), STOP & ASK Will + ADR.

---

## Décisions techniques actées Phase 1 (rappel pour Phase 2)

- **Cible /2000** : verdict final pondéré x2 vs ce baseline (531.7 → cible ≥ 1700/2000 = ratio 0.85).
- **Effort estimé refonte** : ~35-55 h autopilote (master prompt §0). Cohérent avec 50-80 commits sur 15 PR-équivalents.
- **Régression tolérée** : 0 fonctionnelle, 0 sur 26 `logActivity`, 0 sur 50+ `force-dynamic`, 0 sur 2 endpoints SSE.
- **Gate par PR** : typecheck + lint + test + e2e:admin + build + bundle delta ≤ +5 KB gz + anti-hex + use-client-check + isolation-check + visual diff + Lighthouse desktop 3 URLs pilotes.
