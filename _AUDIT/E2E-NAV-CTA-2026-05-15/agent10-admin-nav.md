# Agent 10.6 — Admin internal navigation

> Audit code uniquement (admin protégé en prod). `<ADMIN_PREFIX>` masqué dans tout ce livrable, conforme prompt master.

## Structure

- Racine : `src/app/[locale]/(admin)/[adminPrefix]/`
- Locale forcée FR (`if (locale !== "fr") redirect(...)`), conforme doctrine CLAUDE.md §14.
- Prefix dynamique = env var `ADMIN_URL_PREFIX` (default `admin-dev-x7k2n9`), URL secrete pas hardcodée dans le repo public.
- Layout : `force-dynamic`, sidebar conditionnée sur session authentifiée (login affiché sans sidebar via children).

## Compte des sections

`find … -name "page.tsx"` → **101 pages** confirmées (matche mémoire « 101 sections »).

Top-level sections (alphabétique) :

```
2fa  activity-logs  alerts  analytics  blog  calendrier  case-studies
categories  connaissances  content-gen  devis  echeanciers  factures
faq  help  infra  login  newsletter  options  paiements  reservations
settings  submissions  testimonials  users  web-vitals
```

Sous-sections content-gen (le plus dense, V1.0.3 tag pushé) :

```
content-gen/{author,costs,coverage,geo,jobs,kb-readonly,keyword-tracking,
landing-variants,onboarding,orchestrator,publications,publications-status,
quality, review-queue, ...}
```

## AdminSidebar / AdminTopbar / AdminBreadcrumbs

- ❌ **Pas de composant dédié `AdminSidebar.tsx`** — la sidebar est inlinée dans `layout.tsx` (lignes 36-145, `buildNav()` + render `<aside className="admin-sidebar">`).
- ❌ **Pas de composant `AdminTopbar.tsx` séparé** — le header admin est inliné `<header className="admin-header">` dans layout.
- ❌ **Pas de composant `AdminBreadcrumbs.tsx`** — chaque page admin émet sa propre nav contextuelle (ex : connaissances/[id]/apercu rend un banner avec ← Retour édition).
- ⚠️ Cela limite la cohérence cross-pages : si Will veut une breadcrumb uniforme admin, c'est un sprint dédié de refonte UI.

## AdminCommandPalette ⌘K ✅

`src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx` :

- Client component (`"use client"`), librairie `cmdk`
- Trigger Cmd+K (mac) / Ctrl+K (windows) — `useEffect` listener clavier
- **49 items** (`grep -c "label:"`) répartis en groupes : Main / Calendrier / Filtres rapides (status réservations, factures, devis) / Contenu / Content-Gen / Système
- Filtres rapides ex : « Réservations — Prêts à valider », « Factures — En retard », « Devis — Envoyés (en attente) » — UX productivité opérationnelle bien pensée
- Affiché dans `<header className="admin-header">` (layout ligne 111) — disponible sur **toutes** les pages admin authentifiées

## Sidebar items

`buildNav()` dans layout.tsx définit 25 items répartis en 5 groupes :

- **main** (9) : Tableau de bord, Calendrier, Réservations, Devis, Factures, Paiements, Échéanciers, Options 48h, Soumissions
- **content** (8) : Connaissances, Générateur contenus, Blog, Catégories, Cas concrets, Témoignages, FAQ, Centre d'aide
- **engagement** (1) : Newsletter
- **ops** (4) : Analytics & SEO, Web Vitals, Infra & outils, Alertes ops
- **system** (4) : Utilisateurs, Activity logs, Paramètres, 2FA — sécurité

⚠️ La sidebar **n'expose pas les 101 sous-sections** (ex : `/calendrier/heatmap`, `/calendrier/reschedule`, `/content-gen/orchestrator` etc.) — accessibles uniquement via ⌘K palette ou clic depuis les pages parent.

## Logout button

`src/app/[locale]/(admin)/[adminPrefix]/page.tsx` ligne 17 : `import { auth, signOut } from "@/auth"`.
Ligne 30 : `await signOut({ redirect: false })` (handler form action).
Ligne 249 : `Déconnexion` (bouton submit du form).

✅ Logout présent **sur la home dashboard uniquement**, pas dans la topbar persistante. Sous-pages doivent revenir au dashboard pour se déconnecter.

⚠️ **P1 UX** : logout devrait être dans le header admin (à côté de l'email user `<span className="admin-tagline">`). 1 commit cosmetic.

## « Voir sur le site » preview buttons

`grep "Voir sur le site|Preview|preview"` → 2 fichiers :

- `content-gen/review-queue/[id]/page.tsx` — preview article factory
- `connaissances/[id]/apercu/page.tsx` — preview KB entry brouillon

✅ Preview existant mais **limité à 2 sections** content. Pas de bouton « Voir sur le site » côté blog admin, case-studies admin, testimonials admin, faq admin, help admin. **P1** : généraliser le pattern preview sur les 6+ sections content.

## Masquage `<ADMIN_PREFIX>`

✅ Conforme prompt — toutes les URLs admin dans ce livrable utilisent `<ADMIN_PREFIX>` placeholder, jamais la valeur réelle.

## P0 / P1 / P2

- **P1** : extraire `AdminSidebar.tsx`, `AdminTopbar.tsx`, `AdminBreadcrumbs.tsx` en composants dédiés (refacto cosmétique). Permet d'ajouter logout dans topbar + breadcrumb uniforme cross-pages.
- **P1** : généraliser le bouton « Voir sur le site » / Preview sur blog admin, case-studies admin, testimonials, faq, help.
- **P2** : ajouter raccourcis ⌘P (preview), ⌘L (logout) dans AdminCommandPalette pour matcher patterns Linear/Notion.
- **P2** : sidebar en collapse mobile (actuellement sidebar full width sur les viewports < lg, prend trop d'espace).
