# A8 — Audit UX Micro-interactions & friction (FOCUS WILL)

> Sous-agent Explore, poids ×1. Lecture seule.
> Date : 2026-05-17.

## Scoring (/100)

| #   | Critère                  | Score /10 | État actuel                                                                                                      | Patch cible                                                                   |
| --- | ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Optimistic updates       | 2         | 0 toggle ; 8 forms avec `useActionState` mais sans optimistic rendering                                          | `useOptimistic` sur 8 BookingActions, toggles Tiptap toolbar, drag-reschedule |
| 2   | Autosave drafts          | 0         | Aucun localStorage draft (risque perte travail sur crash)                                                        | Debounce 2 s + localStorage `admin-draft:publication:<id>` dans Tiptap editor |
| 3   | Undo/redo toasts         | 3         | Tiptap undo/redo natifs OK ; 0 toast Sonner avec action button                                                   | `toast.action()` 5 s post-mutation (Cancel/Pause/Mark) sur 5 actions          |
| 4   | Keyboard shortcuts       | 6         | Cmd+K (AdminCommandPalette) + Tiptap Ctrl+Z/Y. Manquent Cmd+S, ESC, J/K nav                                      | Cmd+S sur tous forms + ESC pour fermer drawer + J/K pagination                |
| 5   | Breadcrumbs + back smart | 2         | AdminCommandPalette liste pages mais PAS de breadcrumb persistant                                                | `<AdminBreadcrumb>` en haut pages détail + scroll position preserve           |
| 6   | Inline editing           | 1         | Aucun champ in-place (tous formulaires = pages séparées ou disclosure blocks)                                    | Inline edits : status toggles, simple text, dates (fetch + optimistic)        |
| 7   | Bulk actions             | 0         | 0 checkbox select-all dans tableaux (Jobs, Reservations…)                                                        | Checkboxes + action bar (Retry, Archive, Mark, Export CSV)                    |
| 8   | Filter persistence       | 4         | `useSearchParams` pour filtres URL ; localStorage absent pour « saved filters »                                  | localStorage `admin-filters:<page>` pour presets (mes brouillons, en attente) |
| 9   | Confirmation dosing      | 7         | 9 BookingActions avec disclosure + motif. Destructive requiert motif 10-500 chars                                | LOW (resume/pause) = 1 clic ; MEDIUM = motif ; DESTRUCTIVE = 2-step modal     |
| 10  | Progressive disclosure   | 5         | `<details>` sur SendContractForm/CancelAndReissueContractForm. Manque sur Publication form, Image bulk, Settings | Appliquer `<details>` pattern sur formulaires longs                           |

**Total** : **30/100**

---

## Top 20 micro-frictions à éliminer (par fréquence d'occurrence Will)

1. **[P0]** **Tiptap publications/edit — pas d'autosave drafts** → risque perte travail si crash navigateur.
   - Patch : `useOptimistic` + debounce 2 s + `localStorage.setItem("admin-draft:publication:<id>", ...)` + toast « Draft saved ».
2. **[P0]** **Aucun undo toast** sur 8 BookingActions (cancel/pause/mark). Clic erreur = appel support.
   - Patch : `toast.action({ action: { label: "Annuler", onClick: revertAction }, duration: 5000 })`.
3. **[P1]** **Confirmations excessives** sur low-risk (Pause demande motif 10-500 chars + textarea).
   - Patch : Pause/Resume = simple clic ; Cancel = motif court ; Hard-delete = 2-step.
4. **[P1]** **Zero breadcrumbs** dans admin. Réservations → Booking [id] → Actions sans path visible.
   - Patch : `<AdminBreadcrumb items={[{label:"Réservations",href:".."},{label:"#123",current:true}]} />`.
5. **[P1]** **Pas de back smart** (preserve scroll position).
   - Patch : `useScrollPosition` hook + route transition snapshot.
6. **[P2]** **Zero keyboard shortcuts** sauf Cmd+K. Manquent Cmd+S, ESC, J/K.
   - Patch : handlers `keydown` dans forms longs. ESC sur modals/drawers.
7. **[P2]** **Inline editing = zéro**. Clic « Status booking » ouvre modal au lieu de toggle.
   - Patch : toggles Tiptap (bold/italic) + checkbox toggles low-risk + datepicker in-place.
8. **[P2]** **Bulk actions = zéro**. Jobs page : « Retry all failed » impossible sans script.
   - Patch : `<input type="checkbox">` col + « Retry selected / Archive selected / Export CSV ».
9. **[P2]** **Formulaires longs sans `<details>`**. Publication form (body + 12 fields SEO/OG).
   - Patch : wrap « Avancé » dans `<details open={false}>`.
10. **[P2]** **Tiptap toolbar manque icons** (boutons en text « B », « I »).
    - Patch : `lucide-react` icons + aria-label + title tooltip.
11. **[P2]** **No toast feedback** sur mutations réussies (state.ok seul).
    - Patch : `toast.success("✓ Booking paused")` post-action dans tous BookingActions.
12. **[P2]** **Factures/devis print mode = absent**.
    - Patch : `@media print { .admin-button { display: none } .facture { page-break-inside: avoid } }`.
13. **[P2]** **Filter persistence = zero « saved filters »**.
    - Patch : preset buttons + localStorage `admin-filters:<page>` ou `User.preferences` server-side.
14. **[P1]** **Form state loss on navigation** (sidebar click accidentel).
    - Patch : `useFormStatus.pending + beforeunload` ou `FormProvider` context dirty state.
15. **[P2]** **No search in tableaux**. Reservations 20/page.
    - Patch : `<input type="search">` + `useSearchParams`.
16. **[P2]** **Pagination boutons non-focusables** clavier.
    - Patch : `tabIndex={0}` + `aria-current` + J/K shortcuts.
17. **[P2]** **No scroll position save** post-detail navigation.
    - Patch : `sessionStorage` + `useEffect` restore (pattern Next.js 16).
18. **[P1]** **Content-Gen review-queue = no drag-drop a11y** si introduit Phase 5.
    - Patch : `@dnd-kit` keyboard adapter ou custom ARIA handlers.
19. **[P1]** **Image bulk import = zero progress indicator**.
    - Patch : BullMQ webhook + SSE ou polling `/api/admin/bulk-import/<jobId>`.
20. **[P1]** **Modal close = no Escape binding** (custom modals).
    - Patch : `useEffect + addEventListener` ou shadcn `<Dialog>` built-in.

---

## Patterns React 19 à appliquer

- **`useActionState`** — déjà utilisé dans BlogForm, BookingActions (9 forms) ✅.
- **`useFormStatus`** — à ajouter : disabled pendant pending sur tous submit buttons + spinner.
- **`useOptimistic`** — CRITIQUE : 0 utilisation. Câbler sur 8 BookingActions pour feedback immédiat.
- **Progressive enhancement** : forms admin doivent fonctionner sans JS (actuellement dépendent `useActionState` client).

---

## Mitigations §3.6-3.9 à câbler

- **AdminSessionExpiryWarning** modal + heartbeat `/api/admin/session-ping` 5 min — actuellement absent.
- **AdminConflictDialog** (top-4 ressources : Publication, Reservation, Devis, Facture) — actuellement absent.
- **print.css** (factures/devis/échéanciers imprimables) — actuellement absent.
- **`prefers-reduced-motion`** strict (pas de shimmer) — global OK, audit par composant.
- **Drag-and-drop a11y** (Tab, Space, Arrow, Space, ESC) — si introduit Phase 5.

---

## Préservation obligatoire

- `logActivity()` après chaque mutation (BookingActions.tsx déjà OK dans actions).
- Server Actions signatures (BookingForm + 9 BookingActions typés Zod strict).
- `revalidatePath()` calls après mutations (check `features/*/actions.ts`).

---

## Effort estimation refonte mai 2026 (Phase 3-4 UX/friction)

- Breadcrumbs + back smart : 4 h
- Autosave + localStorage drafts : 3 h
- Undo toasts + keyboard shortcuts : 6 h
- Bulk actions checkboxes : 5 h
- Inline editing toggles : 5 h
- Print CSS + filter persistence : 4 h
- Form state loss warning : 2 h
- Modal keyboard ESC binding : 2 h
- **Total** : ~31 h
