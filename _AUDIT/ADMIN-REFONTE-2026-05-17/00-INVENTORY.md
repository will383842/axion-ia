# Phase 0 — Inventaire reality check console admin

> Mode : lecture seule. Snapshot 2026-05-17, post-merge PR #14 image-bank V1.
> Commandes sourcées dans le brief master §4.1 (15 points).
> Branche : `main` local @ tag `admin-refonte-baseline-2026-05-17`.

---

## Gate d'entrée (§4.3 master prompt)

| Métrique             | Attendu | Mesuré  | Verdict                      |
| -------------------- | ------- | ------- | ---------------------------- |
| Routes admin totales | ~145    | **116** | 🟢 sous seuil bloquant (200) |
| Routes content-gen   | 48      | **48**  | 🟢 exact                     |

→ Pas de STOP & ASK. L'écart -29 routes vs estimation prompt vient probablement d'un comptage différent (sous-segments dynamiques `[id]` comptés à part ?). Documenté pour Phase 1 (cf. risque P3).

---

## 1. Routes admin (`page.tsx`)

- **Total** : 116 fichiers
- **Top-level sections** : 27 (cf. liste ci-dessous, par ordre alpha)
- **Source** : `find 'src/app/[locale]/(admin)/[adminPrefix]' -name 'page.tsx' -type f | sort | wc -l`

```
2fa             devis          help             paiements         testimonials
activity-logs   echeanciers    image-bank       reservations      users
alerts          factures       infra            settings          web-vitals
analytics       faq            login            submissions
blog            calendrier     case-studies     categories
connaissances   content-gen    newsletter       options
```

## 2. Routes content-gen (`content-gen/**/page.tsx`)

- **Total** : 48 fichiers (= attendu)
- **Sous-sections** : 19 (par ordre alpha)
- **Source** : `find 'src/app/[locale]/(admin)/[adminPrefix]/content-gen' -name 'page.tsx' -type f | sort`

```
author/manon         landing-variants     publications-status
costs                onboarding           quality
coverage             orchestrator         queue
geo                  publications         review-queue
jobs                 rss                  settings
kb-readonly          similarity-monitor   templates
keyword-tracking
```

## 3. Composants admin (`src/components/admin/**/*.tsx`)

- **Total** : 10 fichiers (3 racine + sous-dossiers)
- **Racine** : `AdminSidebar.tsx`, `PreviewButton.tsx`, `TiptapEditor.tsx`
- **Sous-dossiers** : `content-gen/` (inclut `JobLogStream.tsx`, `GeoEventsBanner.tsx`), `image-bank/`
- **AdminCommandPalette** : `src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx` (route-local, pas dans `components/admin/` — note Phase 1 : pourquoi pas centralisé ?)

## 4. Server Actions admin (`"use server"`)

- **Total fichiers `"use server"` dans `src/server/actions/`** : 46
- **Sous-set admin-relatif** : tous (les 46) car aucune action publique côté visiteur ne réside là (publiques = `/contact`, `/newsletter-subscribe`, `/reserver` directement dans `src/server/` ou routes API).
- **Domaines couverts** : `knowledge/` (22), `content-gen/` (20), `image-bank/` (4).
- **logActivity()** : 26 occurrences dans 7 fichiers content-gen (≈ 100 % couverture pour les mutations content-gen). À grep avant/après chaque refonte de form.
- **Source** : `grep -l "^\"use server\"" src/server/actions/ -r | wc -l`

## 5. APIs admin pures

- **Total** : 3 routes sous `src/app/api/admin/**/route.ts`
  - `api/admin/invoices/[id]/pdf/route.ts` (génère PDF facture)
  - `api/admin/newsletter/export/route.ts` (export CSV)
  - `api/admin/submissions/export/route.ts` (export CSV)
- **Webhooks externes** (publics, mais updates affichables en admin) :
  - `api/stripe/webhook/route.ts` (paiements / facturation)
  - `api/docuseal/webhook/route.ts` (signature documents)
  - `api/markdown/[type]/[slug]/route.ts` (preview content-gen)
  - `api/og/route.tsx` (image OG dynamique)
- ⚠️ **Aucune Server Action ne doit changer de signature ni de chemin d'import** (§3.1). Aucune route `/api/admin/**` ni les 2 webhooks Stripe/DocuSeal ne sera touchée par la refonte UI.

## 6. Hooks admin (`src/hooks/`)

- **Folder `src/hooks/` n'existe pas**. Aucun hook centralisé. → Phase 2 décidera s'il faut en créer un (sous `src/hooks/admin/` ou `src/lib/admin/hooks/`).

## 7. CSS admin (`admin-*` classes + `--color-admin-*`)

- **Source** : `grep -n "admin-\|--color-admin\|--space-admin\|--font-admin" src/app/globals.css`
- **30+ classes `admin-*`** dans `globals.css` (login/auth section, sidebar layout, buttons, forms, alerts, etc.).
- **0 token `--color-admin-*`** : aucun token CSS dédié admin → tout dérivé des tokens publics. Phase 2 décidera de créer `src/app/admin.css` + tokens préfixés `--color-admin-*` / `--space-admin-*` / `--font-admin-*` (cf. §3.2 master prompt).

## 8. Tests admin

- **E2E (`tests/e2e/`)** :
  - `flows/admin-auth.spec.ts` (login + 2FA + redirect)
  - `flows/admin-booking-flow.spec.ts` (booking flow)
  - `flows/admin-routes.spec.ts` (redirects + 404 fingerprint)
  - `admin-baseline-screenshots.spec.ts` (créé pré-flight, @baseline gated)
- **Vitest** : `tests/content-gen/admin-smoke.spec.ts` (smoke content-gen admin)
- **Fixtures** : `tests/e2e/fixtures/admin-auth.ts`
- **Couverture observée** : minimale. La Phase 5 devra étendre cette suite (RPGs : édition publication, conflit multi-tab, session expiry, reduced-motion, print).

## 9. Trio `error.tsx` / `loading.tsx` / `not-found.tsx` admin

> **GAP MAJEUR — Phase 5 priority** : couverture quasi-nulle.

| Type            | Présent                                   | Manquants |
| --------------- | ----------------------------------------- | --------- |
| `error.tsx`     | **0 / 116 routes**                        | toutes    |
| `loading.tsx`   | **1 / 116** (`connaissances/loading.tsx`) | 115       |
| `not-found.tsx` | **0 / 116**                               | toutes    |

→ Anti-pattern §3.5 confirmé : "chaque dossier `page.tsx` doit avoir son trio (ou hériter d'un parent qui le couvre explicitement)". Aucun parent ne couvre — il faudra **trio minimal au niveau `[adminPrefix]/`** (héritage Next 16) + overrides par section dense (content-gen, image-bank, factures).

## 10. Sentry instrumentation admin

- **`src/app/[locale]/(admin)/**`** : 0 fichier avec `Sentry.setTag|setContext|addBreadcrumb|captureException|withScope`.
- **`src/components/admin/**`\*\* : 0 fichier.
- **Conclusion** : Sentry est instrumenté côté serveur (server actions, workers, API routes) mais pas dans les composants page admin. À confirmer en Phase 1 (sous-agent dédié) : si Sentry tags propagés via `instrumentation.ts` côté requête, alors préservation = ne pas casser le contexte de requête. À documenter avant toute refonte d'une route admin.

## 11. CSP nonce usage admin

- **`src/app/[locale]/(admin)/**`** : 0 occurrence `nonce=\{`/`getNonce(`/`headers().get("x-nonce")`.
- **Hypothèse** : le nonce est propagé via le proxy / middleware (`src/proxy.ts`) au header HTTP, pas via JSX inline-style. Les pages admin n'ont pas besoin de lire le nonce car elles n'injectent pas de `<style>` ni `<script>` inline.
- **À vérifier Phase 1** : si la refonte introduit un `<style nonce={nonce}>` ou un script inline (tracking client-side custom), il faudra propager le nonce explicitement.

## 12. `force-dynamic` / `revalidate` admin

- **`export const dynamic = "force-dynamic"`** : 50+ fichiers admin (≈ 100 % des pages auth-protected).
- **`export const revalidate = N`** : 0 occurrence dans admin (cohérent avec le mode session-based).
- **Layout admin** : `force-dynamic` au niveau `layout.tsx` (ligne 23) → couvre tous les enfants par défaut, les `force-dynamic` per-page sont défensifs.
- **Préservation §3.1** : aucune page admin ne doit introduire `revalidate = N` ou passer en ISR sans STOP & ASK. À grep avant/après chaque refonte de page.

## 13. JobLogStream + SSE/polling

- **Clients SSE** (`'use client'` + `EventSource`) :
  - `src/components/admin/content-gen/JobLogStream.tsx` (ligne 48 : `new EventSource(url, { withCredentials: true })`)
  - `src/components/admin/content-gen/GeoEventsBanner.tsx` (ligne 44 : `new EventSource("/api/content-gen/geo-events", { withCredentials: true })`)
- **Endpoints serveur** (`new ReadableStream`) :
  - `src/app/api/content-gen/jobs/[id]/stream/route.ts` (ligne 44)
  - `src/app/api/content-gen/geo-events/route.ts` (ligne 35)
- **Transport** : SSE pur (pas WebSocket, pas polling).
- **Contrat à préserver** (§3.10) : la refonte UI **doit consommer les mêmes endpoints avec les mêmes assumptions** (`withCredentials: true`, format SSE text/event-stream). Le wrapper visuel peut changer ; le hook de connexion ne touche pas le contrat réseau.
- **Reconnect / format payload** : à documenter dans `04-AUDIT-CONTENT-GEN.md` (Phase 1).

## 14. Print styles

- **Source** : `grep -rn "@media print\|print:" src/`
- **Résultat** : 0 occurrence dans `src/`.
- **GAP §3.9** : Will imprime factures / devis / échéanciers depuis l'admin. Pas de styles print → impression actuelle = capture brute de l'UI (sidebar visible, header gros, layout inadapté).
- **Action Phase 5** : créer `src/app/print.css` minimal (`@media print { .admin-sidebar, .admin-header { display: none } main { padding: 0 } }`) + monospace montants. Tester `Cmd+P` sur 3 pages : facture, devis, échéancier.

## 15. Webhooks externes vers admin

- **Stripe webhook** : `src/app/api/stripe/webhook/route.ts` — modifie `Reservation`, `Facture`, `Paiement` (visible en admin). **Ne pas casser** : aucune ressource Prisma touchée par refonte.
- **DocuSeal webhook** : `src/app/api/docuseal/webhook/route.ts` — modifie `Devis`, `Facture` signature status. **Ne pas casser**.
- **OG image** : `src/app/api/og/route.tsx` — public, pas de lien admin.
- **Markdown preview** : `src/app/api/markdown/[type]/[slug]/route.ts` — preview content-gen, peut être consommée par les pages `/content-gen/publications/[id]/edit` via Tiptap. À auditer Phase 1.

---

## Anti-patterns détectés au pré-audit (confirmation des dettes §2.5)

1. **Icônes emoji dans la navigation** ✅ confirmé (`📊 📅 📋 📄 🧾 💶 ⏳ 📥 📚 🧠 📝 🏷️ 🏆 💬 ❓ ❔ 🖼️ ⬆️ 📦 🔍 📊 🏷️ 🔖 🛡️ ⚙️ 📧 📊 📈 🔧 🚨 👥 📜 ⚙️ 🔐` dans `layout.tsx buildNav()`) → remplacer par `lucide-react` (Phase 4).
2. **Aucun trio `error.tsx`/`loading.tsx`/`not-found.tsx`** au-delà d'un seul `loading.tsx` (`connaissances/`) → patch Phase 5.
3. **Aucun token CSS dédié admin** (`--color-admin-*` absent) → conception design system Phase 2 + extraction Phase 3.
4. **Aucun pattern page unifié** (PageHeader, Toolbar, FiltersBar, Table, EmptyState, ErrorState, LoadingSkeleton) → primitives Phase 3.
5. **Aucun `@media print`** alors que factures/devis sont imprimés → patch Phase 5.
6. **Aucun hook centralisé** (`src/hooks/` n'existe pas) → conception Phase 2 (devrait-on en créer ?).
7. **AdminCommandPalette mal localisé** (sous `src/app/[locale]/(admin)/[adminPrefix]/` au lieu de `src/components/admin/`) → migration Phase 4.
8. **Sidebar collapse manquante** : composant `AdminSidebar` ne supporte pas le collapse de groupe ni le scroll-lock (cf. §2.5).

## Cross-leak `components/admin` → audit

- **`grep -rn "from '@/components/admin'" src/ | grep -v 'src/app/\[locale\]/(admin)' | grep -v 'src/components/admin/'`** : **0 résultat**.
- ✅ Isolation propre : les composants admin ne fuient pas vers le frontend public.

## Bilan Phase 0

- **Scope confirmé** : 116 routes admin + 10 composants + 6 groupes sidebar + 19 sous-sections content-gen + ~36 items nav.
- **Cible centralisation** : large (8 anti-patterns récurrents) → ROI design system élevé.
- **Régressions à surveiller** : 50+ `force-dynamic`, 26 `logActivity`, 2 EventSource SSE, 0 nonce inline.
- **Gap visible** : trio error/loading/not-found, print styles, design system admin dédié.
- **Verdict** : **GO Phase 1** (audit 8 sous-agents //).
