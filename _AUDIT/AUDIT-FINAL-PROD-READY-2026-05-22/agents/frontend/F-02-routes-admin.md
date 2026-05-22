# F-02 Routes admin
## Score : 22/25 — 🟢

## Findings (preuves)

1. **Cloisonnement par segment dynamique secret** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:67-74` valide `adminPrefix !== process.env.ADMIN_URL_PREFIX` → `notFound()`. Pas de fingerprint dans le repo public — l’URL admin n’est jamais hardcodée.

2. **Auth NextAuth v5 + double guard** : `src/auth.config.ts:19-141` configure JWT 30j + `callbacks.authorized` qui force redirect vers `/fr/<prefix>/login` si `!auth?.user` sur toute route admin (regex `^/(fr|en)/${adminSegment}(?:/|$)`). Géré aussi côté layout (`auth()` ligne 86) avec `showSidebar` conditionné session.

3. **Force FR sur admin (CLAUDE.md §14)** : `layout.tsx:77-79` redirige `/en/...admin` → `/fr/...admin`.

4. **Inventaire admin V2** : **125 fichiers `page.tsx`** sous `src/app/[locale]/(admin)/[adminPrefix]/`. Sections principales :
   - `content-gen/` (50+ routes) : Pilotage (`/`, `jobs`, `queue`, `publications`, `publications-status`), Sources (`rss`, `kb-readonly`, `keyword-strategy`, `templates`), Suivi (`coverage`, `quality`, `costs`, `analytics`, `review-queue`, `similarity-monitor`, `brand-voice-drift`, `keyword-tracking`), Réglages (`settings/*` × 11 + `onboarding`, `embeddings`, `external-links`).
   - `image-bank/` (16 routes) : library, bulk-import, categories, licensing, quality, analytics, usage-logs, sources, etc.
   - Autres : `2fa/setup`, `activity-logs`, `alerts`, `analytics`, `blog`, `calendrier` (+ heatmap + reschedule), `case-studies`, `categories`, `connaissances`, `devis`, `echeanciers`, `factures`, `faq`, `help`, `infra`, `login`, `newsletter`, `options`, `paiements`, `reservations`, `settings`, `submissions`, `testimonials`, `users`, `web-vitals`.

5. **Shell V2 actif et permanent** (`layout.tsx:117-141`) : `AdminTopbar` + `AdminSidebarNav` + `AdminCommandPalette` + `AdminUserMenu` + `AdminSessionExpiryWarning` (heartbeat 5 min). Feature flag supprimé 2026-05-20 (memoire).

6. **CSS isolation admin** : `admin-hide-public-shell-css` (ligne 108-115) injecte `:has(.admin-layout-v2)` qui cache `header.bg-terracotta` + `footer.bg-mocha-rich` SANS forcer `dynamic` sur les pages publiques. Architecture proper.

7. **CTAs admin terracotta** : `admin.css` token `--color-admin-bg` + ADR 0028 cloisonnement. Buildnav SSOT `src/lib/admin-nav.ts`.

8. **Force-dynamic admin** : layout (`layout.tsx:40`) + dashboards (`content-gen/page.tsx:13`) → toujours frais, pas de cache obsolète sur écrans live (jobs queue, failed badge).

9. **Failed jobs badge** : `getFailedJobsCount()` (ligne 96) émet badge sidebar — fire-and-forget, stub-safe (try/catch).

## P0 bloquants prod
- **Aucun**.

## P1 importants
- `signOut` exposé uniquement via form action POST dans dashboard root V2 (commentaire layout l. 118) — vérifier que `AdminUserMenu` ne tente pas un GET sur `/api/auth/signout` (Auth.js v5 → 405).
- `ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"` (fallback hardcodé l. 69 + proxy.ts:62 + auth.config.ts:17) : si env absent en prod → fallback prefix devient public. Devrait throw au boot si NODE_ENV=production.

## P2 polish
- Le robots `/admin/`, `/fr/admin/`, `/en/admin/` est Disallow mais le vrai prefix `admin-dev-x7k2n9` (ou customisé) n’est pas dans la liste — couvert par auth + 404 mais GSC pourrait crawler.

## Verdict
Architecture admin solide : segment URL secret + Auth.js v5 + redirect locale FR + 4 sections claires (Pilotage/Sources/Suivi/Réglages) conformes D-P5-6. 125 pages V2 toutes derrière auth. Sidebar SSOT + Command palette + session warning. Cloisonnement CSS impeccable (pas de leakage shell public dans admin). Score 22/25 ; -3 pour fallback prefix hardcodé et hygiène signOut à valider e2e.
