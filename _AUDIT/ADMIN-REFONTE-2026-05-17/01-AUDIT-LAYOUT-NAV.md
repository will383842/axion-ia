# A1 — Audit Layout & Navigation admin

> Sous-agent Explore, poids ×1.5. Lecture seule.
> Date : 2026-05-17.

## Scoring (/100)

| #   | Critère                  | Score /10 | Justification courte                                                                                                                                                                                                                                         |
| --- | ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Hiérarchie visuelle      | 6         | Header minimaliste (brand + email), sidebar 240px 6 groupes, main 960px. Pas de breadcrumb contextuel, pas de topbar scoped. Layout strict mais creux.                                                                                                       |
| 2   | Densité informationnelle | 7         | Sidebar 36 items bien groupés en 6 sections, mais emojis tuent la professionalité. Admin-cmdk palette complète (58 items) redonde nav. KPI grid + card grid utiles (Sprint 3).                                                                               |
| 3   | Scrollabilité sidebar    | 5         | `overflow-y: auto` présent (line 657), mais zéro sticky-scroll ou collapsible groups. Body entier scrolle, pas de scroll-lock. Sidebar étendue (~480px height totale 6 groupes × 18px margin) = UX lente sur 768px.                                          |
| 4   | Active state lien        | 3         | `aria-current="page"` injecté côté client (AdminSidebar.tsx:58 ✓), MAIS AUCUN styling CSS associé. `.admin-nav-link[aria-current="page"]` n'existe pas. Visuellement indistinctible. CTA-critical bug.                                                       |
| 5   | Search interne nav       | 9         | `Cmd+K` cmdk palette fonctionnelle (58 items, 8 groupes), filtre texte réactif, hints de contexte, keyboard escape, jump rapide. V1 solide — manque seulement search submissions/reservations dynamique.                                                     |
| 6   | Responsive               | 4         | Sidebar 240px dure sur mobile (pas de hamburger, pas de collapse). Grid 2 colonnes `240px 1fr` non clamp. Aucune mediaquery adaptée. Desktop 1280px OK (line 446 `max-width: 1280px`), tablet/mobile = non-fonctionnel en lecture seule.                     |
| 7   | A11y                     | 7         | `aria-label` sidebar (line 43 ✓), `aria-current="page"` présent (line 58 ✓), role `main` implicite (line 155), skip-link absent. Emojis `aria-hidden` correct (line 60). Manquent : focus ring admin-cmdk-trigger, contrast ratio label header.              |
| 8   | Brand / signature        | 6         | "Axion-IA · Admin" (line 144) épuré, email tagline light. Aucune référence Design.md terracotta/italique. Header couleurs OK (paper + border doux). Admin-cmdk cmdk-item[data-selected] → terracotta hover (line 1482) = signature détectable mais discrète. |
| 9   | Notifications / alertes  | 3         | `.admin-alert-error` et `.admin-alert-success` définis (lines 592-600) mais pas de badge counter, dropdown, ou toast. Aucun système d'alertes ops (infra/alerts page routée mais UI vide).                                                                   |
| 10  | Context switcher         | 2         | Zéro context switcher (env/tenant/user). Email header (line 148) fake proxy user state. Pas de menu utilisateur, pas de logout, pas de tenant picker. Critical pour multi-instance admin.                                                                    |

**Total** : **52/100** (× poids 1.5 = **78/150 pondéré**)

---

## Top 10 findings à patcher

### 1. **[P0]** Sidebar active link INVISIBLE — `aria-current` injecté mais pas stylisé

`AdminSidebar.tsx:58` injecte bien `aria-current="page"`, mais aucune règle CSS dans `globals.css:675-693` ne stylise `.admin-nav-link[aria-current="page"]`. Visuellement indistinctible.

**Patch** : ajouter dans `globals.css` après `.admin-nav-link:hover` (≈ line 687) :

```css
.admin-nav-link[aria-current="page"] {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 500;
  border-left: 3px solid var(--color-primary);
  padding-left: 7px;
}
```

### 2. **[P0]** Emoji icons partout — anti-pattern confirmé, remplacer par lucide-react

`layout.tsx:44-115` (buildNav) + `AdminCommandPalette.tsx` ≈ 94 emojis cumulés. Aucune cohérence avec Design.md.

**Patch** : créer `src/lib/admin-icons.ts` mapping `(group, label) → lucide icon`, refondre AdminSidebar.tsx pour rendre `<Icon>` JSX.

### 3. **[P1]** Responsive sidebar collapse manquant

Sidebar 240px verrouillée sur mobile + grid `240px 1fr` non clamp → scroll horizontal sur tablet/mobile.

**Patch** : mediaquery `globals.css` + `<AdminHamburger>` client, sidebar `position: fixed; z-50` quand collapse.

### 4. **[P1]** AdminCommandPalette redonde la nav

Sync-drift risk : nav `buildNav()` (layout.tsx) vs items palette dupliqués.

**Patch** : extraire `buildNav()` vers `src/lib/admin-nav.ts` (SSOT), importer dans les 2.

### 5. **[P1]** Pas de breadcrumb / topbar contextuelle

`/image-bank/library` vs `/image-bank/upload` = même heading visuel.

**Patch** : créer `<AdminBreadcrumb>` server component lisant `pathname` + buildNav. Insertion avant `<main>` (layout.tsx:155).

### 6. **[P1]** Focus ring manquant sur `.admin-cmdk-trigger`

**Patch** : ajouter `.admin-cmdk-trigger:focus-visible { outline: 2px solid var(--color-border-strong); outline-offset: 2px; }`.

### 7. **[P1]** User menu absent (logout, switcher, account)

**Patch** : `src/components/admin/AdminUserMenu.tsx` (DropdownMenu Radix) + intégration `layout.tsx:146-149`.

### 8. **[P2]** Sidebar non-sticky

Scroll long page fait disparaître la sidebar.

**Patch** : `.admin-sidebar { position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }`.

### 9. **[P2]** Système alertes incomplet (toasts/badge counters)

Pages `/infra` et `/alerts` routées mais UI vide.

**Patch** : `AlertBadge` + `ToastProvider` dans header-actions.

### 10. **[P2]** Aucune signal `light-only` doctrine

**Patch** : commentaire en-tête `layout.tsx:1` + check CSS `@supports (prefers-color-scheme: dark)` bloquant.

---

## Anti-patterns détectés

- **Emoji icons everywhere** (94 emojis nav+cmdk) — copypaste errors, inaccessibility, maintenance hell.
- **`aria-current` injecté mais non stylisé** — A11y theatre.
- **Mobile unresponsive** — sidebar 240px verrouillée, zéro hamburger.
- **Duplicate nav data** — 36 items buildNav + 58 cmdk = ×1.6 redondance.
- **Aucun layer contextuel** (breadcrumb, topbar, depth indicator).
- **Sidebar non-sticky** — contradiction directe avec doctrine `layout.tsx:8`.
- **User menu absent** — multi-instance / logout impossible depuis UI.
- **Alertes squelettiques** — `.admin-alert-*` définis mais sans counter/toast/dropdown.

---

## Préservation obligatoire

- **Design.md doctrine** : light-only, jamais `#000`, italique terracotta = signature éditoriale uniquement, tokens publics intouchables.
- **`aria-current="page"`** sur AdminSidebar (déjà présent via `usePathname()`) — STYLISER en P0 sans retirer.
- **ADMIN_URL_PREFIX env validation** : `layout.tsx:120` strict `adminPrefix !== expectedPrefix → 404`. Security pattern, à conserver.
- **Force FR locale** : `layout.tsx:128` redirect `/en/*` → `/fr/*`.
- **`export const dynamic = "force-dynamic"`** : `layout.tsx:23` — session check chaque requête.
- **AdminCommandPalette** : V1 cmdk solide (Cmd+K, 58 items). Garder l'architecture, dédupliquer la source nav (P1-4).
- **CSS structure existante `.admin-*`** : laisser globals.css en place tant que la migration vers `admin.css` séparé n'est pas livrée (Phase 3) — éviter le big-bang.
- **Responsive breakpoint** : `max-width: 1280px` desktop préservé, ajouter 768px / 480px.
