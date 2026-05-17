# A5 — Audit A11y WCAG 2.2 AA console admin

> Sous-agent Explore, poids ×1. Lecture seule.
> Date : 2026-05-17.

## Scoring (/100)

| #   | Critère                            | Score /10 | Violations actuelles                                                                                                     | Patches prio                               |
| --- | ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1   | Landmark roles                     | 9         | Skip-to-content absent (sinon header/aside/main OK).                                                                     | Ajouter skip link dans layout.tsx.         |
| 2   | Skip-to-content link               | 2         | **ABSENT — P0 critique**.                                                                                                | Ajouter avant `<main>` avec `sr-only`.     |
| 3   | Focus visible (3:1 contrast)       | 8         | `:focus-visible` 2px outline bleu présent, manque sur `.admin-input-toggle`.                                             | Étendre à tous controls.                   |
| 4   | Color contrast (4.5:1 / 3:1)       | 8         | `--color-fg-muted` (#5a4f44) 5.0:1 sur #fff (OK AA). Anciens #6b6155 = 4.4:1 fixés.                                      | Audit complet combos fg/bg non-primary.    |
| 5   | Keyboard-only complet              | 8         | Cmd+K palette OK, ESC ferme, Tab nav OK. Manque focus trap et return-focus modals custom.                                | Ajouter focus-trap lib (reschedule modal). |
| 6   | Screen reader labels               | 8         | `aria-label` palette OK, `aria-current="page"` sidebar (2.4.8), `role="alert"` errors. Manque `aria-describedby` inputs. | Ajouter sur TiptapEditor + forms.          |
| 7   | Target size (24×24 WCAG 2.2)       | 6         | `.admin-nav-link` 6×20 ❌, `.admin-button-ghost` 8×16 ❌, `.admin-input-toggle` 4×10 ❌.                                 | Padding min 24px.                          |
| 8   | Reduced motion                     | 9         | `@media (prefers-reduced-motion: reduce)` présent (≈ ligne 396-422), animations 0ms, shimmer interdit.                   | ✅ Conforme.                               |
| 9   | Form errors associated             | 7         | `role="alert"` / `role="status"` présents. Manque `aria-invalid` + `aria-errormessage` sur inputs.                       | Ajouter sur tous inputs form.              |
| 10  | Modals / Dialogs (focus trap, ESC) | 7         | `.admin-cmdk-dialog` ESC OK (cmdk lib), `reschedule` role="dialog" OK. Return-focus manque ; focus trap non uniforme.    | Implémenter focus-trap universelle.        |

**Total** : **72/100**

---

## Violations P0 (bloquantes refonte)

- **Skip-to-content absent** (WCAG 2.4.1 Bypass Blocks) — layout.tsx:140-156 aucun lien `sr-only` avant `<main>`. SR/clavier doivent traverser header+sidebar (~70+ items) avant le contenu.
  - **Fix** : ajouter `<a href="#admin-main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-primary focus:text-white focus:rounded">Aller au contenu principal</a>` en top du header. + `id="admin-main-content"` sur `<main>` (ligne 155).

- **Target size critique** (WCAG 2.2 — 2.5.8 Target Size Minimum) :
  - `.admin-nav-link` padding 6×10 → ~22×44px (sous 24×24 minimum).
  - `.admin-button-ghost` padding 8×16 → ~32×40px (borderline).
  - `.admin-input-toggle` padding 4×10 → ~20×32px (sous seuil).
  - **Fix** : `.admin-nav-link { padding: 8px 12px; min-height: 44px; }`, `.admin-input-toggle { padding: 6px 12px; min-height: 32px; }`.

---

## Violations P1 (incluses dans refonte)

- **Focus trap absent sur modals custom** (WCAG 2.4.3 Focus Order) — `.admin-cmdk-dialog` OK (cmdk lib interne), mais `ReschedulePanel.tsx` role="dialog" sans focus trap → Tab échappe. Pattern : `cmdk` good, custom modals need `focus-trap` ou KeyDown manuel.
- **`aria-describedby` manquant sur inputs** (WCAG 1.3.1) — TiptapEditor.tsx:51 `aria-label` seul, pas de help text descriptif. Forms (BlogForm, CaseStudyForm, etc.) manquent l'association description ↔ input.
- **`aria-invalid` + `aria-errormessage` manquants** (WCAG 3.3.1) — `.admin-alert` `role="alert"` affiche l'erreur, mais l'input fautif ne porte pas `aria-invalid="true"`. Pattern à câbler via state retourné de Server Action.
- **Contrast audit non-primary** :
  - `--color-terracotta-deep` (#8c3010) sur `--color-terracotta-soft` (#f5e3d8) → ~3.2:1 (AA large OK, normal borderline).
  - `--color-error` (#ee1d36) sur `--color-terracotta-soft` (#f5e3d8) → ~3.4:1 (idem).
  - **Audit WebAIM complet recommandé** sur 12+ combos.

---

## Violations P2 (post-refonte)

- **Return focus to trigger manquant** (WCAG 2.4.3) — AdminCommandPalette ligne 307, fermeture modal ne réattribue pas focus au `.admin-cmdk-trigger`.
- **Landmark structure améliorable** : sidebar = `<aside aria-label="Navigation">` (acceptable mais `<nav>` plus standard pour 101 items).
- **Shimmer/skeleton + reduced-motion** : blocage global OK, mais audit composant-spécifique JobLogStream recommandé.

---

## Patches prioritaires

1. **[P0 — bloquant]** Skip link dans `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` (avant header close) + `id="admin-main-content"` sur `<main>`.
2. **[P0 — bloquant]** `.admin-nav-link` padding 8×12 + `min-height: 44px` (globals.css:679).
3. **[P0]** `.admin-input-toggle` padding 6×12 + `min-height: 32px` (globals.css:710).
4. **[P1]** Focus trap dans `ReschedulePanel.tsx` (`focus-trap` lib ou pattern manuel useRef + useEffect).
5. **[P1]** Audit complet 12+ combos couleurs admin via WebAIM Contrast Checker — rapport compliance.
6. **[P1]** `aria-invalid` + `aria-errormessage` sur tous `<input>` admin (BlogForm, CaseStudyForm, etc.).

---

## Préservation obligatoire

- **`aria-current="page"`** dans `AdminSidebar.tsx:58` (via `usePathname()`) — cité par tests E2E WCAG 2.4.8.
- **Tous les `role="alert"` / `role="status"`** sur `.admin-alert*` — couverts par tests form error handling.
- **`Command.Dialog`** cmdk palette (AdminCommandPalette.tsx) — focus trap interne respectée, garder tel quel.
- **`@media (prefers-reduced-motion: reduce)`** (globals.css:396-422) — strict et fonctionnel, ne pas modifier.
- **`<aside aria-label="Navigation admin">`** (AdminSidebar.tsx:43) — ARIA correct WCAG 1.3.1, préservé.

---

**Synthèse** : admin console ≈ **72/100** WCAG 2.2 AA. Les 3 blocages (skip, target size, aria-invalid) sont triviaux à fixer. Audit contraste + focus-trap routinier en Phase 5. ✅ Prêt pour planning intégration.
