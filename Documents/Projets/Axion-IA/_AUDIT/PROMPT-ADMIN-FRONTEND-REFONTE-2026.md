# PROMPT — Refonte frontend console d'administration Axion-IA · Mai 2026

> **Type** : Master prompt orchestrateur (audit → design system → refonte → certification anti-régression)
> **Cible** : console `/fr/<adminPrefix>/**` + générateur de contenus `/fr/<adminPrefix>/content-gen/**`
> **Mode** : AUDIT-ONLY (Phase 1) → CONCEPTION (Phase 2) → IMPLÉMENTATION (Phases 3-7) → CERTIFICATION (Phase 8)
> **Effort estimé autopilote** : 35-55 h, ~50-80 commits, 0 régression tolérée
> **Date** : 2026-05-17
> **Modèle cible** : Claude Opus 4.7 (1M context) — exécution en sous-agents parallèles

---

## 0. RÉSULTAT ATTENDU EN UNE PHRASE

Une console d'administration **moderne mai 2026** (sobre, dense informationnellement, sans friction, accessible WCAG AA, performante), bâtie sur un **design system admin centralisé unique** (tokens + primitives + patterns), couvrant **les 145 fichiers tsx admin existants** dont les **48 routes du content generator**, livrée **sans casser une seule fonctionnalité** ni une seule route serveur, ni un seul flow métier validé en production le 2026-05-17.

Verdict final attendu : **≥ 1700 / 2000** sur la grille de scoring fin de doc, avec **0 P0 ouvert** et un **rapport anti-régression à 100 %**.

---

## 1. CONSTAT WILL (raison d'être de ce prompt)

> « La console d'administration est **catastrophique et vieillotte**. Je veux que ce soit **moderne mai 2026**. L'expérience utilisateur doit être **facile, exceptionnelle, sans friction**. Le **content generator** (frontend) doit être plus fluide, plus facile à utiliser, tout optimisé pour une UX parfaite. Le design du frontend admin doit être **centralisé** pour que la structure du code soit à la perfection. Attention : **ne pas faire de régression**, ne rien casser sur les fonctionnalités. »

→ Cible double :

1. **Refonte visuelle + UX** (front).
2. **Centralisation architecturale** (design system, primitives, patterns, anti-duplication).

→ Contraintes dures :

- **0 régression** fonctionnelle (CRUD, workflows, jobs, queues, auth, RLS, exports, sitemaps, webhooks).
- **0 régression** de performance (Web Vitals budget intact — voir §3).
- **0 régression** SEO/AEO/GEO (frontend admin = `noindex`, mais aucun impact public).
- **Doctrine Design.md** (Editorial Premium Light v3) **respectée** : ivoire chaud, terracotta italique signature, mocha pour zones premium, **pas de noir pur**.

---

## 2. CONTEXTE TECHNIQUE — état au 2026-05-17

### 2.1 Surface à refondre (chiffres clés)

| Élément | Valeur |
| --- | --- |
| Fichiers `.tsx` sous `src/app/[locale]/(admin)/[adminPrefix]/**` | **145** |
| Routes content-gen (`content-gen/**`) | **48** |
| Composants sous `src/components/admin/**` | AdminSidebar, PreviewButton, TiptapEditor, dossiers `content-gen/` et `image-bank/` |
| Sections admin (groupes sidebar) | 6 — main / content / image-bank / engagement / ops / system |
| Items sidebar | ~35 liens directs (101 sections totales en sous-pages) |
| Layout admin actuel | `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` (159 LOC, basique) |
| Sidebar actuelle | `src/components/admin/AdminSidebar.tsx` (74 LOC, emojis comme icônes) |
| Command palette | `AdminCommandPalette.tsx` (présent, à auditer) |
| Design system public | `src/components/ui/` (button, card, dialog, input, select, sheet, table, etc.) + `src/app/globals.css` (tokens `@theme`) |
| Design system admin | **N'EXISTE PAS** — c'est ce qu'on construit |

### 2.2 Stack figée (à respecter, pas à changer sans ADR)

- **Next.js 16.2** App Router + RSC + Server Actions (lire `node_modules/next/dist/docs/` avant tout, cf. `AGENTS.md`)
- **React 19** (compiler activé par défaut)
- **Tailwind CSS v4** avec directive `@theme` dans `src/app/globals.css` (tokens canon)
- **next-intl v4.11** (mais admin = FR uniquement, cf. `CLAUDE.md §14`)
- **Auth.js v5** (`@/auth`)
- **Prisma 5.22** + Postgres 16 + Redis (BullMQ workers)
- **Sentry** instrumenté (`instrumentation.ts` + `sentry.*.config.ts`)
- **Cloisonnement strict admin** : `src/server/admin/**`, `src/app/[locale]/(admin)/[adminPrefix]/**`, `src/components/admin/**`
- **Build pipeline** : GHCR + Coolify pull (cf. AGENTS.md — ADR 0026). Stubs `stub.invalid` à respecter.

### 2.3 Doctrine visuelle — `axionia/Design.md` v3 (intouchable)

- Surfaces : `--color-bg #faf8f3` (ivoire chaud), `--color-paper #ffffff`, `--color-sand #f0e9da`, `--color-sand-deep #e6dcc4`, `--color-mocha #2a2520` (jamais `#000`).
- Foreground : `--color-fg #1a1815`, `--color-fg-soft #524b41`, `--color-fg-muted #6b6155` (WCAG AA 4.5:1).
- Accent CTA primaire **unique** : `--color-primary #1a4dd9` (Editorial Blue).
- Accent éditorial : `--color-terracotta #c24a1b` (italique signature, **jamais sur CTA primaire**).
- Accent doux : `--color-sage #5e6c54` (Cas concrets, proof, succès indicateurs).
- Typography hierarchy v3.2 (`@theme` text-lg → text-7xl, hero cap 88px, ADR 0007).
- Hero schema carré 576×576 lg+ (`.hero-schema`, ADR 0008).

> **Règle stricte mai 2026** : le frontend admin doit **respecter** Design.md mais peut **étendre** la palette par des tokens dédiés `--color-admin-*` (préfixés) si nécessaire pour la densité informationnelle (tables, graphs, badges status). **Aucun token public ne doit être modifié.**

### 2.4 Performance budget — `AGENTS.md` (gates CI)

- LCP ≤ 1 800 ms p75 (sauf `/reserver` = 2 500 ms)
- INP ≤ 100 ms p75 (sauf `/reserver` = 150 ms)
- CLS = 0 (strict)
- TBT ≤ 150 ms (Lighthouse desktop)
- First Load JS ≤ **75 KB gz / route** (sauf `/reserver` = 110 KB gz)

> **Pour l'admin** : même budget, sauf pour pages avec graphs/tableaux denses (analytics, web-vitals, content-gen/jobs, image-bank/library) → autorisé 120 KB gz max **avec justification ADR**. Toute page admin doit rester sous Lighthouse 90+ desktop.

### 2.5 État connu de la dette UX admin (sourcé)

- **Sidebar** : emojis comme icônes (😬 anti-pattern mai 2026), pas de scroll lock, pas de section collapsible, pas de search interne nav.
- **Layout** : `header > admin-shell > sidebar + main`, aucune topbar contextuelle, pas de breadcrumbs, pas de notifications dropdown, pas de switcher contexte (env prod/staging).
- **Pages** : 145 fichiers `page.tsx` codés à la main, **pas de pattern unifié** (page header, toolbar, filters, tables, empty states, error states, loading skeletons).
- **Content generator** : 48 routes — `coverage/`, `jobs/`, `publications/`, `review-queue/`, `quality/`, `kb-readonly/`, `geo/`, `orchestrator/`, `costs/`, `landing-variants/`, `rss/`, `keyword-tracking/`, `publications-status/`, `queue/`, `onboarding/`, `author/manon/` → besoin urgent d'une **shell content-gen** (sidebar locale, breadcrumbs, status banner, job log streaming).

---

## 3. NON-NÉGOCIABLES (régressions = STOP immédiat)

> Si une de ces lignes est franchie → **STOP & ASK Will** avant de continuer.

### 3.1 Régressions fonctionnelles interdites

- Aucune Server Action existante ne doit changer de signature ni de chemin d'import.
- Aucune route `app/[locale]/(admin)/**` ne doit être renommée ou déplacée.
- Aucune API route existante (`/api/admin/**`) ne doit changer de méthode/url.
- Aucun Prisma query / aucune RLS policy ne doit être touchée.
- Aucun worker BullMQ (`src/server/queue/workers/**`) ne doit être touché.
- Aucun seed, aucune migration Prisma ne doit être créée par cette refonte.
- Auth.js config, middleware admin (`adminPrefix` validation, FR redirect) doivent rester intacts.
- **CSP nonce + COEP intacts** (Sprint 24) : toute nouvelle inline-style ou inline-script doit propager le `nonce` du `headers()` Next.js. Aucun `<style>` ni `<script>` sans nonce. Aucune CSS-in-JS runtime introduite. Gate manuel : `curl -I https://prod | grep -i "content-security-policy"` doit rester identique en directives.
- **Activity logs câblage intact** : chaque Server Action admin mute → entry `ActivityLog` via le helper existant (`logActivity()` ou équivalent). Si je refonds le JSX d'un `<form>` sans toucher l'action, l'audit trail reste. Si je touche l'action, je dois prouver via grep que le `logActivity()` call est conservé identique.
- **Sentry tags / breadcrumbs préservés** : tout composant qui appelle `Sentry.setTag()`, `Sentry.setContext()`, `Sentry.addBreadcrumb()` ou `data-sentry-component` doit conserver ces appels après refonte. Grep `Sentry\.` avant/après chaque migration de page → diff = 0.
- **`force-dynamic` admin conservé** : `export const dynamic = "force-dynamic"` est présent dans `layout.tsx` admin. Aucune page admin ne doit introduire `revalidate = N` ou passer en ISR sans STOP & ASK (cohérence session-based rendering).

### 3.2 Régressions de design système public interdites

- `src/components/ui/**` ne se modifie **que** en ajoutant (jamais en supprimant ni en cassant l'API existante).
- Les tokens publics dans `globals.css` `@theme` ne se touchent pas. Toute nouvelle var = préfixe `--color-admin-*` / `--space-admin-*` / `--font-admin-*` dans **un fichier dédié** `src/app/admin.css` importé uniquement par le layout admin.

### 3.2 Régressions de design système public interdites

- `src/components/ui/**` ne se modifie **que** en ajoutant (jamais en supprimant ni en cassant l'API existante).
- Les tokens publics dans `globals.css` `@theme` ne se touchent pas. Toute nouvelle var = préfixe `--color-admin-*` / `--space-admin-*` / `--font-admin-*` dans **un fichier dédié** `src/app/admin.css` importé uniquement par le layout admin.

### 3.3 Régressions de doctrine interdites

- Pas d'icônes emoji 😬 (remplacer par `lucide-react` ou SVG inline 16/20/24 px).
- Pas de noir pur (`#000`, `text-black`, `bg-black` interdits — utiliser `mocha`).
- Pas d'italique terracotta sur CTA primaire (l'italique terracotta est **signature éditoriale uniquement**).
- Pas de `dark mode` (admin = light only, cohérent avec doctrine éditoriale).
- Pas de couleur hardcodée hex dans un composant (gate `anti-hex` du repo).
- Pas de `'use client'` non justifié en commentaire ligne 1 (gate `use-client-check`).

### 3.4 Régressions de performance interdites

- Toute page admin doit conserver son `First Load JS ≤ 120 KB gz` (table/graph-heavy) ou `≤ 75 KB gz` (standard).
- Toute interaction doit rester `INP ≤ 100 ms p75`.
- Toute page doit rester `CLS = 0` (skeletons avec dimensions explicites obligatoires).
- Lighthouse CI gate doit rester vert sur 5 URLs de monitoring + 3 URLs admin pilotes ajoutées (cf. §8.4).

### 3.5 Doctrine React 19 / Next.js 16 admin (obligatoire mai 2026)

Toute nouvelle primitive form / action admin doit utiliser **par défaut** :

- **`useActionState`** (ex-`useFormState`) pour câbler un Server Action à un form avec retour typé + pending state. Pas de hook custom maison concurrent.
- **`useFormStatus`** pour les sous-composants de form (submit button disabled pendant pending).
- **`useOptimistic`** pour tout toggle / inline edit / drag-and-drop / approve-reject où latence > 100 ms backend → optimistic update + rollback sur erreur.
- **Server Action progressive enhancement** : tout `<form action={action}>` doit fonctionner **sans JS** (admin n'est pas un PWA, mais le contrat React 19 l'exige). Pas de `event.preventDefault()` côté client sauf raison forte.
- **`Suspense` boundaries** explicites par section indépendante d'une page (header, table, stats). Pas un seul `<Suspense>` global = pas de UX.
- **`error.tsx`, `loading.tsx`, `not-found.tsx` par route admin** : chaque dossier `page.tsx` doit avoir son trio (ou hériter d'un parent qui le couvre explicitement). Audit Phase 0 doit lister les routes qui en manquent → patch automatique en Phase 5.

### 3.6 Session expiry pendant édition (Tiptap + forms longs)

Cas critique : Will rédige un article dans `/content-gen/publications/[id]/edit`, sa session Auth.js expire (default 30 jours mais peut être configuré court), il clique save → 401 silencieux, données perdues.

**Mitigation obligatoire à câbler dans `AdminPageShell` + Tiptap wrapper** :

- Heartbeat session toutes les 5 min via `GET /api/admin/session-ping` (à créer si absent — endpoint léger qui retourne `{ ok: true, expiresAt }`).
- Si réponse `401` ou `expiresAt < now() + 2 min` → afficher modal **non-bloquante** `<AdminSessionExpiryWarning>` avec :
  - Bouton « Se reconnecter » (ouvre `/login` dans iframe ou popup, préserve la page).
  - Bouton « Sauvegarder en draft local » (sérialise dans `localStorage` clé `admin-draft:<resourceType>:<id>`).
- Au reload `edit/[id]`, vérifier `localStorage` → si draft local plus récent que serveur → toast « Brouillon récupéré » + bouton « Restaurer » / « Ignorer ».
- TiptapEditor doit exposer `onContentChange` debounced 2 sec qui écrit dans `localStorage` en continu, indépendamment de l'autosave serveur.

### 3.7 Multi-tab edit conflict (optimistic concurrency)

Cas : Will ouvre la même publication dans 2 onglets, édite dans les 2, sauve. Sans protection, le dernier write gagne silencieusement.

**Mitigation** : chaque ressource admin éditable doit avoir un champ `updatedAt` (déjà présent Prisma standard). Le formulaire envoie `updatedAt` original dans le payload Server Action. L'action compare avant write :

- Si `db.updatedAt > payload.updatedAt` → retourne `{ conflict: true, serverVersion }`.
- Le form affiche `<AdminConflictDialog>` : « Modifs externes détectées. Voir diff / Écraser / Annuler ».

Au minimum **les 4 ressources les plus éditées** doivent l'avoir : `Publication`, `Reservation`, `Devis`, `Facture`. Les autres peuvent suivre en P2.

### 3.9 Cas particuliers à valider explicitement (sinon trous UX réels)

- **Mode print (factures, devis, échéanciers)** : Will imprime des factures et devis depuis l'admin. Auditer la présence de `@media print` dans CSS admin. Si absent → créer `src/app/print.css` minimal (cacher header/sidebar/actions, layout pleine page, monospace pour montants). Tester `Cmd+P` sur 3 pages : facture, devis, échéancier.
- **Tablet 768-1280px (déplacement Will)** : admin doit rester **utilisable read+write** sur iPad/Surface en déplacement, pas seulement read-only. Sidebar bascule en drawer (sheet) sous 1024px. Tables → scroll horizontal contrôlé avec sticky first column. Toolbar → wrap propre. Tester sur 3 pages : dashboard, content-gen/jobs, reservations.
- **`prefers-reduced-motion`** : tester `@media (prefers-reduced-motion: reduce)` actif → toutes les transitions > 0ms doivent passer à 0ms, pas de skeleton shimmer, pas de spin loaders animés. Vitest spec dédié + manual check macOS Settings.
- **High-contrast mode Windows** (Will = Windows 11 Pro, cf. env) : tester avec « Paramètres > Accessibilité > Contraste » → tous les textes doivent rester lisibles. Pas de couleur portant sens unique (toujours doubler par icône + label).
- **Drag-and-drop accessibilité** : si un primitive D&D est introduit (reorder review queue, kanban jobs ?) → support clavier obligatoire (Tab pour focus item, Space pour grab, Arrow Up/Down pour move, Space pour drop, ESC pour cancel). Tester sans souris.
- **Auto-logout idle** : si la doctrine Auth.js prévoit timeout idle, l'UI doit prévenir 60 sec avant via toast non-bloquant « Vous serez déconnecté dans 60s. Cliquez pour rester. » (couplé au heartbeat §3.6).

### 3.10 JobLogStream contrat (préserver l'existant)

**Avant** toute refonte de `src/components/content-gen/JobLogStream.tsx` (Phase 6 §9.4), exécuter :

```
grep -rn "EventSource\|/api/.*log-stream\|/api/.*sse\|new ReadableStream" axionia/src/
grep -rn "JobLogStream" axionia/src/
```

→ Documenter dans `04-AUDIT-CONTENT-GEN.md` :

- Transport actuel : SSE / polling / WebSocket ?
- Endpoint exact + headers requis.
- Format payload (lignes brutes / JSON typé).
- Mécanisme de reconnect en cas de coupure.
- Tags Sentry / breadcrumbs attachés.

La refonte UI **doit consommer le même endpoint avec les mêmes assumptions**. Si le contrat doit évoluer → STOP & ASK Will + nouvelle API route versionnée parallèle, jamais remplacement direct.

---

## 3bis. PRÉ-FLIGHT CHECK OBLIGATOIRE (avant Phase 0, bloquant)

> Trois actions humaines/automatiques à valider **avant** la moindre lecture de code. Si un seul échoue → STOP & ASK Will.

### 3bis.1 PR #14 image-bank V1 mergée (BLOQUANT)

La PR #14 (`feat/image-bank-v1`, ouverte 2026-05-16) touche `src/components/admin/image-bank/**` et `src/app/[locale]/(admin)/[adminPrefix]/image-bank/**` (15 pages admin + 4 workers). Lancer la refonte avant son merge = conflits massifs garantis sur ~30 fichiers.

**Action** :

```bash
gh pr view 14 --json mergeable,state,statusCheckRollup
```

- Si `state != "MERGED"` → STOP & ASK Will : « Merge PR #14 d'abord ? Sinon je commence par d'autres groupes (main, content) en évitant image-bank, et image-bank sera fait en dernier après merge PR #14. »
- Si merge fait → continuer.

### 3bis.2 Baseline git tag + screenshots (BLOQUANT)

Avant de toucher la moindre ligne, créer un point de retour vérifiable :

```bash
# Tag git de sauvegarde
git tag -a admin-refonte-baseline-2026-05-17 -m "Baseline admin avant refonte mai 2026"
git push origin admin-refonte-baseline-2026-05-17

# Snapshot Playwright des 12 pages représentatives (cf. §4.2)
pnpm test:e2e:admin --update-snapshots --grep "@baseline"
# (créer le test @baseline-admin-screenshots.spec.ts s'il n'existe pas)
```

Les screenshots vont dans `tests/e2e/admin/__screenshots__/baseline-2026-05-17/`. Ils servent de **golden** pour la phase 7 anti-régression (diff visuel pixel-par-pixel autorisé à ±5 % par zone, à condition que le contenu reste sémantiquement équivalent — texte, structure, ordre d'éléments).

Si Playwright n'est pas configuré pour admin → STOP & ASK Will : « OK pour ajouter une suite Playwright admin minimale d'abord ? ~2h. »

### 3bis.3 Feature flag `ADMIN_V2_ENABLED` posé

Pour pouvoir merger PRs 6-11 (migrations) **sans casser prod**, on a besoin d'un toggle :

- Env var Coolify : `ADMIN_V2_ENABLED=false` (default = ancien UI), `true` pour test.
- Helper serveur : `src/lib/feature-flags.ts` exporte `isAdminV2Enabled()` qui lit `process.env.ADMIN_V2_ENABLED === "true"`.
- Pattern d'usage dans une page migrée :

```tsx
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { PageV1 } from "./_v1/page-v1";
import { PageV2 } from "./_v2/page-v2";

export default async function Page(props: Props) {
  return isAdminV2Enabled() ? <PageV2 {...props} /> : <PageV1 {...props} />;
}
```

- **Override per-session** (cookie `admin_v2=1` set par Will dans son navigateur) pour pouvoir tester V2 en prod sans bascule globale.
- Switch progressive : flag `true` quand 80 % des pages sont migrées + smoke vert. PR 14 finale = retire le flag + supprime les `_v1/`.

Sans ce flag, on est contraints au big-bang merge final → risque de régression non rattrapable. **STOP & ASK Will** s'il préfère le big-bang (possible si toutes les PRs restent en draft jusqu'au merge final).

---

## 4. PHASE 0 — Reality check lecture seule (1-2 h)

> **Objectif** : ancrer la refonte sur l'état exact du code 2026-05-17, pas sur les memories. Aucune écriture de code.

### 4.1 Inventaire exhaustif

Lance, dans cet ordre, et écris les résultats dans `_AUDIT/ADMIN-REFONTE-2026-05-17/00-INVENTORY.md` :

1. **Routes admin** : `find "src/app/[locale]/(admin)/[adminPrefix]" -name "page.tsx" -type f | sort` → URL canonique + slug + groupe sidebar.
2. **Routes content-gen** : idem, sous `content-gen/`.
3. **Composants admin** : `find src/components/admin -name "*.tsx" -type f | sort`.
4. **Server Actions admin** : `grep -r "use server" src/app/[locale]/(admin)/` → liste fonctions exportées + grep `logActivity\|ActivityLog\.create` à proximité.
5. **APIs admin** : `find src/app/api -path "*/admin/*" -name "route.ts"` + grep webhooks externes qui pointent vers ces routes (Stripe, DocuSeal).
6. **Hooks admin** : `find src/hooks -name "use*.ts*" | xargs grep -l "admin\|Admin"`.
7. **CSS admin** : grep `admin-` dans `globals.css` + tous les `.module.css` rencontrés.
8. **Tests admin** : `find . -name "*.test.tsx" -path "*admin*"` + Playwright e2e admin.
9. **`error.tsx` / `loading.tsx` / `not-found.tsx` admin** : `find "src/app/[locale]/(admin)" -name "error.tsx" -o -name "loading.tsx" -o -name "not-found.tsx"` → matrice routes × trio (manquants = patches Phase 5).
10. **Sentry instrumentation admin** : `grep -rn "Sentry\." src/app/[locale]/(admin)/ src/components/admin/` → liste tags / contexts / breadcrumbs / `data-sentry-component` à préserver.
11. **CSP nonce usage** : `grep -rn "headers().*nonce\|nonce={nonce}" src/app/[locale]/(admin)/` → composants serveur qui propagent le nonce (à conserver).
12. **`force-dynamic` / `revalidate` admin** : `grep -rn "force-dynamic\|export const revalidate\|export const dynamic" src/app/[locale]/(admin)/` → mapping route → mode rendering (refonte doit conserver le mode).
13. **JobLogStream + SSE/polling** : `grep -rn "EventSource\|ReadableStream\|/api/.*log-stream\|/api/.*sse" src/` → contrat JobLogStream à préserver (cf. §3.8).
14. **Print styles** : `grep -rn "@media print\|print:" src/` → check factures/devis imprimables.
15. **Webhooks externes vers admin** : `grep -rn "stripe\|docuseal" src/app/api/ axionia/docs/` → liste endpoints qui peuvent recevoir du callback Stripe/DocuSeal et qu'on ne doit pas casser.

### 4.2 Capture de l'existant

- Screenshot (via Playwright si dispo, sinon description textuelle) des 12 pages les plus utilisées : `/`, `/calendrier`, `/reservations`, `/devis`, `/factures`, `/content-gen`, `/content-gen/coverage`, `/content-gen/jobs`, `/content-gen/publications`, `/content-gen/review-queue`, `/image-bank/library`, `/users`.
- Pour chaque : noter densité d'info, états (empty, loading, error, success), composants réutilisés, anti-patterns visibles.

### 4.3 Sortie Phase 0

`_AUDIT/ADMIN-REFONTE-2026-05-17/00-INVENTORY.md` doit contenir :

```
- N routes admin totales : X
- N routes content-gen : 48 (vérifié)
- N composants admin : X
- N Server Actions admin : X
- N APIs admin : X
- Patterns dupliqués détectés (>3 occurrences identiques) : [liste]
- Anti-patterns détectés : [liste]
- Composants ui/ utilisés en admin : [liste]
- Composants admin/ utilisés ailleurs (cross-leak) : [liste — devrait être 0]
```

> **Gate** : si l'inventaire révèle > 200 routes admin (au lieu de ~145), ou < 40 routes content-gen (au lieu de 48), **STOP** et ré-aligner avec Will avant Phase 1.

---

## 5. PHASE 1 — AUDIT-ONLY multi-agents parallèles (4-6 h)

> **Mode** : 8 sous-agents `Explore` en **parallèle** (un seul message, 8 tool uses simultanés). Aucune écriture de code. Sortie = 8 fichiers `.md` distincts dans `_AUDIT/ADMIN-REFONTE-2026-05-17/`.

### 5.1 Sous-agent A1 — Layout & Navigation (poids 1.5×)

**Brief** : Lire `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`, `AdminSidebar.tsx`, `AdminCommandPalette.tsx`. Évaluer vs benchmarks mai 2026 : Linear, Vercel Dashboard, Stripe Dashboard, Supabase Studio, Anthropic Console.

**Critères (10 × /10)** :

1. Hiérarchie visuelle header / sidebar / main / breadcrumbs / topbar contextuelle.
2. Densité informationnelle (pas trop aéré, pas trop dense).
3. Scrollabilité sidebar (sticky, scroll lock body, collapsible groups).
4. Active state lien (`aria-current`, focus ring, hover, depth indicator).
5. Search interne nav (Cmd+K + filtre sidebar).
6. Responsive (1280px desktop priorité, 768-1280px tablet, mobile = read-only).
7. A11y (skip link, landmark roles, keyboard navigation, screen reader).
8. Brand / signature (cohérence Design.md sans casser).
9. Notifications / alertes (badge counter, dropdown, sound? — non).
10. Context switcher (env, tenant, user menu).

**Livrable** : `01-AUDIT-LAYOUT-NAV.md` — score /100 + Top 10 patches.

### 5.2 Sous-agent A2 — Design System actuel (poids 2×)

**Brief** : Auditer `src/components/ui/**` + tout `admin-*` dans CSS + composants admin existants.

**Critères (15 × /10)** :

1. Tokens (palette admin spécifique vs publique).
2. Spacing scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — admin doit être dense, 4-12 prioritaire).
3. Typography scale admin (text-xs / text-sm dominants en admin vs text-base public).
4. Border radius (admin = 6-8px max, vs public éditorial 12-16px).
5. Shadows (admin = `elevation-1/2/3` subtle, pas de shadow Spotify gros).
6. Buttons (primary / secondary / ghost / destructive / link / icon).
7. Inputs (text / number / select / multiselect / combobox / search).
8. Tables (header, sort, filter, pagination, row hover, selection, actions).
9. Forms (label / hint / error / required, layout vertical/horizontal).
10. Cards (compact / informational / stat / interactive).
11. Modals & Sheets (size variants, focus trap, close patterns).
12. Toasts & Banners (info / success / warning / destructive).
13. Empty states (icon + heading + body + CTA).
14. Loading states (skeleton avec dimensions exactes — pas spinner).
15. Error states (boundary RSC + boundary client + form errors).

**Livrable** : `02-AUDIT-DESIGN-SYSTEM.md` — score /150 + liste primitives manquantes + tokens à introduire dans `admin.css`.

### 5.3 Sous-agent A3 — Pages catégoriques (poids 1.5×)

**Brief** : Auditer 12 pages représentatives (cf. §4.2) sur ces 10 critères × /10 :

1. Page header pattern (titre, description, CTA primaire, actions secondaires).
2. Toolbar (filtres + recherche + sort + view toggle).
3. Tableau / liste (densité, sort, pagination, row actions, bulk actions).
4. Formulaire (layout, validation, autosave indicator).
5. Empty state (when no data).
6. Loading state (skeleton or progressive).
7. Error state (réseau, validation, permission).
8. Détail (page `[id]` pattern : breadcrumb back, header sticky, tabs, actions).
9. États métier (statuts visuels, badges, transitions).
10. A11y + keyboard (tabindex, shortcuts, ESC, Enter).

**Livrable** : `03-AUDIT-PAGES-CATEGORIES.md` — matrice 12 × 10 + Top 10 patterns à standardiser.

### 5.4 Sous-agent A4 — Content Generator (poids 2×, FOCUS WILL)

**Brief** : Auditer les **48 routes content-gen** + composants `src/components/admin/content-gen/` + `src/components/content-gen/`.

**Critères (12 × /10)** :

1. Onboarding (`/onboarding`) — clarté du first-run.
2. Orchestrator (`/orchestrator`) — vue d'ensemble pipelines.
3. Coverage (`/coverage`, `/coverage/new`, `/coverage/[id]`) — UX création campagne.
4. Jobs (`/jobs`, `/jobs/[id]`) — log streaming, retry, cancel.
5. Publications (`/publications`, `/publications/[id]/edit`, `/publications-status`) — Tiptap editor expérience.
6. Review queue (`/review-queue`, `/review-queue/[id]`) — diff côte-à-côte, approve/reject fluides.
7. Quality (`/quality`) — métriques + drill-down.
8. Geo (`/geo`, `/geo/batches/**`, `/geo/[villeSlug]/generate`) — sélecteur ville, batches.
9. RSS (`/rss`, `/rss/new`) — ajout flux, mapping catégories.
10. Costs (`/costs`) — visualisation coûts API + alertes budget.
11. Author Manon (`/author/manon`) — profil auteur IA.
12. Cross-cutting : `JobLogStream`, `GeoEventsBanner`, `TemplateForm`, `SubmitButton`.

**Livrable** : `04-AUDIT-CONTENT-GEN.md` — score /120 + Top 15 patches UX + storyboard idéal end-to-end (du briefing à la publication).

### 5.5 Sous-agent A5 — Accessibilité WCAG 2.2 AA (poids 1×)

**Brief** : Auditer landmarks, contrast, focus, keyboard, screen reader, target size (24×24 minimum mai 2026 vs 44×44 mobile), `prefers-reduced-motion`, `aria-*`.

**Critères (10 × /10)** :

1. Landmark roles (banner / nav / main / contentinfo).
2. Skip-to-content link.
3. Focus visible (3:1 contrast minimum, 2px outline).
4. Color contrast 4.5:1 texte normal, 3:1 texte gros.
5. Keyboard-only complet (tab, shift+tab, Enter, ESC, arrows tables).
6. Screen reader labels (aria-label, aria-describedby, aria-live).
7. Target size minimum 24×24 px desktop, 44×44 mobile.
8. Reduced motion (transitions <300ms, opt-out via media query).
9. Form errors associated (`aria-invalid`, `aria-errormessage`).
10. Modals (focus trap, ESC close, return focus to trigger).

**Livrable** : `05-AUDIT-A11Y-WCAG22.md` — score /100 + violations actuelles + patches prio.

### 5.6 Sous-agent A6 — Performance budget (poids 1×)

**Brief** : `pnpm build` snapshot tailles bundles admin + Lighthouse desktop sur 8 URLs admin pilotes : `/`, `/calendrier`, `/content-gen`, `/content-gen/coverage`, `/content-gen/jobs`, `/content-gen/publications`, `/image-bank/library`, `/users`.

**Critères (8 × /10)** :

1. First Load JS gz par route (cible ≤ 75 KB std, ≤ 120 KB graphs).
2. LCP p75 (cible ≤ 1800 ms).
3. INP p75 (cible ≤ 100 ms).
4. CLS (cible = 0).
5. TBT desktop (cible ≤ 150 ms).
6. Chunks splitting (vendor / framework / commons / route).
7. Server Component ratio (cible ≥ 70 % admin pages doivent rester RSC).
8. Tiptap / chart libs lazy-loaded (dynamic import + `loading.tsx`).

**Livrable** : `06-AUDIT-PERF.md` — tableau métriques actuelles + cible post-refonte + plan splitting.

### 5.7 Sous-agent A7 — Centralisation / duplication (poids 1.5×)

**Brief** : Détecter les patterns dupliqués qui doivent devenir des primitives admin.

**Critères (10 × /10)** :

1. Page header pattern (combien de duplications ?).
2. Toolbar filtres pattern.
3. Table pattern.
4. Formulaire pattern.
5. Empty state.
6. Loading state.
7. Error state.
8. Confirmation modal.
9. Detail header pattern.
10. Tabs pattern.

**Livrable** : `07-AUDIT-DUPLICATION.md` — Top 20 duplications à éliminer + abstractions cibles (nom + signature + emplacement).

### 5.8 Sous-agent A8 — UX micro-interactions & friction (poids 1×, FOCUS WILL)

**Brief** : Identifier toute friction UX : confirmations trop nombreuses, clicks inutiles, retours en arrière manquants, raccourcis absents, autosave manquant, optimistic updates manquants.

**Critères (10 × /10)** :

1. Optimistic updates (toggle, edit-in-place, drag-and-drop).
2. Autosave drafts (formulaires longs, Tiptap, settings).
3. Undo / redo (toasts avec action "Undo" 5 sec).
4. Keyboard shortcuts (Cmd+K, Cmd+S, ESC, J/K navigation).
5. Breadcrumbs + back smart (preserve scroll position).
6. Inline editing (clic = édit pour fields simples).
7. Bulk actions (select all + actions).
8. Filter persistence (querystring + localStorage).
9. Confirmation dosing (single click pour low-risk, 2 steps pour destructive).
10. Progressive disclosure (advanced sections collapsed par défaut).

**Livrable** : `08-AUDIT-UX-FRICTION.md` — score /100 + 20 micro-frictions à éliminer.

### 5.9 Sortie consolidée Phase 1

`_AUDIT/ADMIN-REFONTE-2026-05-17/SYNTHESE-PHASE-1.md` :

- Scores agrégés × poids → score global /1000 actuel.
- Top 50 findings (P0 = bloquant refonte, P1 = inclus dans refonte, P2 = post-refonte).
- 10 décisions design à valider Phase 2.
- 3 risques de régression majeurs (avec mitigation).

> **STOP & ASK Will** uniquement si score global < 350/1000 (alors le projet est plus large que prévu).
> Sinon → Phase 2 directement.

---

## 6. PHASE 2 — Conception du design system admin centralisé (3-5 h)

> **Objectif** : produire les **specs** + l'**ADR** + le **plan d'implémentation** avant d'écrire la moindre ligne de prod.
> **Mode** : 1 seul agent (toi), écriture markdown uniquement (aucun code).

### 6.1 Doctrine admin v1 (à figer ici)

Écrire `axionia/docs/adr/0028-admin-design-system-v1.md` (proposé) :

- **Positionnement** : « console métier dense, productive, sobre. Réf : Linear, Vercel, Stripe Dashboard. Pas Notion (trop éditorial), pas Airtable (trop coloré). »
- **Palette admin** étendue (préfixe `--color-admin-*`) : surfaces grises chaudes claires, mocha pour zones premium, primary identique au public, status colors (success / warning / destructive / info) en complément du sage existant.
- **Typography admin** : `--font-admin-sans` = `Inter Variable` (déjà présent ?), tailles dominantes 12 / 13 / 14 / 16, line-height plus serré qu'éditorial (1.4 vs 1.65).
- **Spacing admin** : scale 2 / 4 / 6 / 8 / 12 / 16 / 24 / 32 (plus dense que public).
- **Radius admin** : 4 / 6 / 8 / 12 max.
- **Shadows admin** : elevation 0/1/2/3/4 (subtle).
- **Z-index admin** : 0 (base) / 10 (sticky) / 50 (dropdown) / 100 (modal) / 500 (toast).

### 6.2 Liste des primitives admin à créer

Sous `src/components/admin/ui/**` (cloisonné, jamais utilisé hors admin) :

| Primitive | Fichier | Note |
| --- | --- | --- |
| `<AdminPageHeader>` | `AdminPageHeader.tsx` | titre + description + breadcrumbs + actions slot |
| `<AdminToolbar>` | `AdminToolbar.tsx` | filters slot + search + sort + view toggle |
| `<AdminTable>` | `AdminTable.tsx` | typed generic table avec sort/select/pagination/empty |
| `<AdminTableColumn>` | idem | helper colonne typée |
| `<AdminFormField>` | `AdminFormField.tsx` | label + hint + error + required + child input |
| `<AdminFormSection>` | idem | sectionnement vertical avec divider |
| `<AdminCard>` | `AdminCard.tsx` | variant compact / stat / interactive |
| `<AdminStatCard>` | `AdminStatCard.tsx` | nombre + label + delta + sparkline opt |
| `<AdminBadge>` | `AdminBadge.tsx` | variants status (default/info/success/warning/destructive/neutral) |
| `<AdminEmptyState>` | `AdminEmptyState.tsx` | icon + heading + body + primary CTA + secondary |
| `<AdminLoadingState>` | `AdminLoadingState.tsx` | skeleton matrix avec dims exactes |
| `<AdminErrorState>` | `AdminErrorState.tsx` | RSC + client variant, retry CTA |
| `<AdminBreadcrumbs>` | `AdminBreadcrumbs.tsx` | a11y + truncation longue chaîne |
| `<AdminTabs>` | `AdminTabs.tsx` | wrap `ui/tabs` mais avec count badge + state |
| `<AdminConfirmDialog>` | `AdminConfirmDialog.tsx` | destructive vs neutral, 2-step pour destructive |
| `<AdminCommandPalette>` | déjà présent | enrichir (recent, shortcuts, search global) |
| `<AdminTopbar>` | `AdminTopbar.tsx` | breadcrumbs + actions globales + user menu |
| `<AdminSidebarNav>` | refonte `AdminSidebar.tsx` | groups collapsible, search local, icons lucide |
| `<AdminPageShell>` | `AdminPageShell.tsx` | wrapper standard (header + toolbar slot + content) |
| `<AdminDetailShell>` | `AdminDetailShell.tsx` | wrapper detail (back + header sticky + tabs slot) |
| `<AdminFilterChip>` | `AdminFilterChip.tsx` | chip dismissible avec ESC |
| `<AdminStatusBadge>` | idem | reflète enums Prisma (queued/running/success/failed/etc.) |
| `<AdminInlineEdit>` | `AdminInlineEdit.tsx` | clic-edit-blur save |
| `<AdminBulkActions>` | `AdminBulkActions.tsx` | sticky bottom bar quand sélection > 0 |
| `<AdminToast>` | wrap `sonner` ou maison | undo support |
| `<AdminKeyboardHint>` | `AdminKeyboardHint.tsx` | rendu visuel `⌘ K` |
| `<AdminUserMenu>` | `AdminUserMenu.tsx` | session + 2FA status + logout |
| `<AdminNotificationsDropdown>` | `AdminNotificationsDropdown.tsx` | counter + list |

### 6.3 Patterns à standardiser

Pour chacun, fournir un **mini-template** dans `_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md` :

1. Page liste (`/<resource>/page.tsx`) — header / toolbar / table / pagination / empty.
2. Page détail (`/<resource>/[id]/page.tsx`) — back / header sticky / tabs / actions / content.
3. Page formulaire (`/<resource>/new/page.tsx` + edit) — section / fields / submit + autosave.
4. Page dashboard (`/page.tsx` racine + sous-dashboards) — stats grid + 2-col content + alerts.
5. Page settings (`/settings/page.tsx`) — sectioned form + save-on-blur.

Chaque pattern doit lister :

- Server Component vs Client Component ratio cible.
- Composants admin/ui utilisés.
- Comportement loading / error / empty.
- Skeletons (avec dimensions).
- A11y notes.

### 6.4 Plan d'implémentation (ordre des PRs)

Écrire `_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md` :

```
PR 0 — Baseline tag + Playwright @baseline screenshots + feature flag ADMIN_V2_ENABLED + endpoint /api/admin/session-ping (Pré-flight 3bis)
PR 1 — Foundation tokens + admin.css + admin layout shell (Phase 3.1-3.2) + AdminSessionExpiryWarning + AdminConflictDialog
PR 2 — Primitives ui admin batch 1 (PageShell, PageHeader, Toolbar, Card)
PR 3 — Primitives ui admin batch 2 (Table, FormField, EmptyState, LoadingState, ErrorState) + error.tsx/loading.tsx parent admin
PR 4 — Primitives ui admin batch 3 (Tabs, Breadcrumbs, ConfirmDialog, Badge, StatCard, InlineEdit, BulkActions, AutosaveIndicator)
PR 5 — Sidebar v2 + Topbar + Notifications + UserMenu + CommandPalette enrichi
PR 6 — Migration pages main (dashboard + calendrier + reservations + devis + factures + paiements + echeanciers + options + submissions) + optimistic concurrency top-4 ressources
PR 7 — Migration pages content-gen (48 routes en lot) — FOCUS WILL — heartbeat session + draft localStorage Tiptap
PR 8 — Migration pages image-bank (déjà bien structuré, juste passer aux primitives) — APRÈS merge PR #14
PR 9 — Migration pages content (blog, categories, case-studies, testimonials, faq, help, connaissances)
PR 10 — Migration pages ops (analytics, web-vitals, infra, alerts, newsletter)
PR 11 — Migration pages système (users, activity-logs, settings, 2fa)
PR 12 — Polish UX (shortcuts, optimistic updates, autosave, undo, anti-friction)
PR 13 — Tests anti-régression (Playwright admin smoke 30 flows + visual diff vs baseline + Vitest primitives + Lighthouse CI admin)
PR 14 — Retrait feature flag ADMIN_V2_ENABLED + suppression dossiers _v1/ + ADR 0028 + docs/admin-design-system.md + cleanup
```

Chaque PR doit pouvoir merger indépendamment sans casser les autres (compat ascendante des primitives ou flag `ADMIN_V2_ENABLED`).

> **STOP & ASK Will** sur le plan complet (livrables, ordre PR, ADR 0028) avant Phase 3.

---

## 7. PHASE 3 — Implémentation Foundation + Shell (4-8 h)

### 7.1 Foundation tokens

Créer `axionia/src/app/admin.css` :

```css
/* Importé uniquement par src/app/[locale]/(admin)/[adminPrefix]/layout.tsx */
@layer admin-tokens {
  :where(.admin-layout) {
    /* surfaces */
    --color-admin-bg: #f7f5f0;       /* canvas légèrement plus froid que public */
    --color-admin-paper: #ffffff;
    --color-admin-paper-2: #faf8f3;  /* alt rows */
    --color-admin-border: #e6dcc4;
    --color-admin-border-strong: #cfc4a9;
    --color-admin-fg: #1a1815;
    --color-admin-fg-soft: #524b41;
    --color-admin-fg-muted: #6b6155;
    --color-admin-fg-disabled: #a89e8d;

    /* status (étend Design.md) */
    --color-admin-success: #2f7d3a;
    --color-admin-success-soft: #e6f1e2;
    --color-admin-warning: #a8651b;
    --color-admin-warning-soft: #fbeed4;
    --color-admin-destructive: #b13a2b;
    --color-admin-destructive-soft: #f7e1dd;
    --color-admin-info: #1a4dd9;        /* = --color-primary */
    --color-admin-info-soft: #e8efff;   /* = --color-primary-soft */

    /* spacing dense */
    --space-admin-1: 2px;
    --space-admin-2: 4px;
    --space-admin-3: 6px;
    --space-admin-4: 8px;
    --space-admin-5: 12px;
    --space-admin-6: 16px;
    --space-admin-7: 24px;
    --space-admin-8: 32px;

    /* type */
    --text-admin-xs: 11px;
    --text-admin-sm: 12px;
    --text-admin-base: 13px;
    --text-admin-md: 14px;
    --text-admin-lg: 16px;
    --text-admin-xl: 20px;
    --lh-admin-tight: 1.35;
    --lh-admin-body: 1.5;

    /* radius */
    --radius-admin-sm: 4px;
    --radius-admin-md: 6px;
    --radius-admin-lg: 8px;
    --radius-admin-xl: 12px;

    /* shadows */
    --shadow-admin-1: 0 1px 0 rgb(0 0 0 / 0.04);
    --shadow-admin-2: 0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow-admin-3: 0 4px 10px rgb(0 0 0 / 0.06), 0 2px 4px rgb(0 0 0 / 0.04);
    --shadow-admin-4: 0 12px 24px rgb(0 0 0 / 0.10), 0 4px 8px rgb(0 0 0 / 0.06);

    /* z */
    --z-admin-sticky: 10;
    --z-admin-dropdown: 50;
    --z-admin-modal: 100;
    --z-admin-toast: 500;
  }
}
```

> **Aucun token public dans `globals.css` ne doit être modifié.**

### 7.2 Layout shell refondu

Modifier `axionia/src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` pour utiliser `<AdminShell>` :

- 3 zones : **left rail** (sidebar collapsible), **topbar** (breadcrumbs + global actions), **main** (page shell + toaster + modal portal).
- Sticky topbar avec scroll progress bar (1px terracotta sur scroll, signature éditoriale subtile).
- Sidebar largeur 240px desktop, collapse à 64px (icons only) via toggle `Cmd+B` (mémorisé localStorage).
- Skip-to-content link en première position.

Critères de validation :

- Lighthouse admin home reste ≥ 90 desktop.
- 0 nouvelle dépendance externe (pas `react-aria-components` ni `framer-motion-3` si pas déjà là — utiliser Radix UI déjà présent et `tailwindcss-animate` si existant).
- Aucun token public touché.

### 7.3 Tests Phase 3

- Vitest sur les 3-4 primitives livrées PR 1-2 (`AdminPageHeader`, `AdminPageShell`, `AdminCard`, `AdminToolbar`).
- Playwright smoke admin login → home → 5 pages → logout = vert.

---

## 8. PHASE 4 — Implémentation primitives (8-12 h, PRs 2-5)

> **Mode** : 4 PRs séquentielles. Pour chaque primitive, livrer : composant TSX + Storybook-like example dans `axionia/docs/admin-design-system.md` + tests Vitest minimum.

### 8.1 Conventions de code

- Server Component **par défaut**. `'use client'` **uniquement** si nécessaire (hooks, events, browser APIs).
- Props typées strict TypeScript, pas de `any`.
- `cn()` utility (clsx + tailwind-merge) déjà présent — réutiliser.
- Pas de styled-components, pas de CSS-in-JS — Tailwind utilities + admin.css tokens.
- A11y first : tout composant interactif a `role`, `aria-*`, focus management.
- Reduced motion respecté (`motion-reduce:` Tailwind).

### 8.2 Exemple `<AdminPageHeader>` (canonique)

```tsx
// src/components/admin/ui/AdminPageHeader.tsx
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: React.ReactNode; // <AdminBreadcrumbs>
  actions?: React.ReactNode;     // <Button>...
  meta?: React.ReactNode;        // badges, statuts
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-6)] mb-[var(--space-admin-7)]",
        className,
      )}
    >
      {breadcrumbs && <div className="mb-[var(--space-admin-4)]">{breadcrumbs}</div>}
      <div className="flex items-start justify-between gap-[var(--space-admin-6)]">
        <div className="min-w-0">
          <h1 className="text-[var(--text-admin-xl)] leading-[var(--lh-admin-tight)] font-semibold text-[color:var(--color-admin-fg)] truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-[var(--space-admin-2)] text-[var(--text-admin-md)] text-[color:var(--color-admin-fg-soft)] max-w-prose">
              {description}
            </p>
          )}
          {meta && <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-3)]">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-[var(--space-admin-3)] shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
```

> **Ce niveau de discipline est attendu pour chacune des ~25 primitives.** Pas de magic strings hex (gate `anti-hex` rejette), tokens uniquement.

### 8.3 Gates par PR

À chaque PR :

```
pnpm typecheck      # 0 erreur
pnpm lint           # 0 erreur
pnpm test           # 100 % primitives nouvelles ou modifiées
pnpm test:e2e:admin # smoke admin reste vert
pnpm build          # bundle delta admin/* ≤ +5 KB gz vs main
```

Plus :

- `pnpm anti-hex` (couleurs hardcodées) → 0 nouvelle violation.
- `pnpm use-client-check` → 0 `use-client` non justifié.
- `pnpm isolation-check` (cloisonnement admin) → 0 composant `admin/ui/**` importé hors admin.

> Si un gate échoue → fix root cause, jamais skip.

---

## 9. PHASE 5 — Migration des pages admin (10-15 h, PRs 6-11)

> **Mode** : migration **page par page** vers les primitives, par groupes fonctionnels. À chaque PR, snapshot Lighthouse desktop des pages migrées et delta bundle.

### 9.1 Stratégie de migration sans régression

Pour chaque page :

1. **Lire** le fichier `page.tsx` actuel (et sous-composants utilisés).
2. **Inventorier** les Server Actions / hooks / loaders / fetchs utilisés — **0 modification de ces blocs**.
3. **Remplacer uniquement le JSX** par les nouvelles primitives.
4. **Préserver** les `key`, `id`, `name`, `aria-*` qui pourraient être ciblés par e2e tests.
5. **Lancer** Playwright smoke ciblé sur la page migrée.
6. **Comparer** screenshot avant/après (Playwright `expect(page).toHaveScreenshot()` si déjà configuré, sinon visuel humain) — doit être **meilleur** mais **équivalent fonctionnellement**.

### 9.2 Ordre prioritaire des migrations

1. **Dashboard** racine `/` — vitrine premier impact.
2. **Content-gen 48 routes** — focus Will (cf. §10).
3. **Calendrier / Reservations / Devis / Factures / Paiements / Echeanciers / Options / Submissions** — flow métier critique.
4. **Image-bank** — déjà mieux structuré (skill image-bank v1.1), conversion rapide.
5. **Content** (blog, categories, etc.) — moins urgent.
6. **Ops** (analytics, web-vitals, infra, alerts, newsletter).
7. **Système** (users, activity-logs, settings, 2fa).

### 9.3 Cas particulier `TiptapEditor`

`src/components/admin/TiptapEditor.tsx` est probablement **le plus gros bundle admin** :

- Vérifier `dynamic(() => import(...), { ssr: false, loading: ... })` correctement appliqué.
- Loading skeleton avec dimensions exactes pour CLS = 0.
- Pas de doublon avec un autre éditeur dans le repo.
- Bouton « Plein écran » + autosave indicator.
- Markdown source toggle (utile pour debug).

### 9.4 Cas particulier `JobLogStream`

`src/components/content-gen/JobLogStream.tsx` :

- Stream Server-Sent Events ou polling — préserver le contrat.
- Affichage moderne : virtualised list si > 500 lignes (`@tanstack/react-virtual` si déjà dispo, sinon `react-window` ; sinon truncate à 1000 lines avec « Show all »).
- Filter par level (info / warn / error).
- Search dans logs (Cmd+F intercept).
- Pause / resume stream.
- Copy logs button.
- Download .log file.

---

## 10. PHASE 6 — FOCUS WILL : Content Generator UX exceptionnelle (6-10 h, PR 7)

> Cette phase a **2× le poids** dans le scoring final. Will l'a explicitement demandée.

### 10.1 Storyboard idéal (à implémenter)

**Premier run :**

1. `/content-gen` → si pas d'onboarding fait → **wizard 3 étapes** plein écran (`/content-gen/onboarding`) :
   - Étape 1 : choix secteur (interventions / audits / implementations).
   - Étape 2 : choix scope géographique (cities pilote vs full).
   - Étape 3 : choix profil auteur (`/author/manon` par défaut).
   - Boutons « Précédent / Continuer / Skip » + barre progress.
2. → dashboard `content-gen/` avec stats cartes (publications publiées / draft / queued / failed 7d) + dernières activités + boutons CTA.

**Création de campagne (`/coverage/new`) :**

- Formulaire **1 page**, pas multi-étapes (sauf si > 8 fields).
- Sections expandables : Cible / Volume / Calendrier / Avancé.
- **Preview live** des estimations coût + nb articles à droite.
- Bouton « Tester sur 1 article » avant commit complet.
- Submit → redirect `/coverage/[id]` avec banner success + lien direct vers `/jobs/[id]` du premier batch.

**Suivi (`/coverage/[id]`, `/jobs`, `/jobs/[id]`) :**

- Status banner sticky (queued → running → success/failed).
- Progress bar avec ETA.
- `JobLogStream` v2 (cf. §9.4).
- Actions : Pause / Resume / Cancel / Retry failed / Re-run.

**Review queue (`/review-queue`, `/review-queue/[id]`) :**

- Liste prioritaire (oldest first, badges urgence).
- Détail = **diff côte-à-côte** (versions IA vs validée) ou rendu prévisualisé.
- 3 boutons : Approve (Cmd+Enter) / Edit (Cmd+E ouvre Tiptap) / Reject (Cmd+R avec textarea reason).
- Keyboard nav `J/K` next/prev item.
- Toast undo 10 sec après chaque action.

**Édition (`/publications/[id]/edit`) :**

- TiptapEditor plein écran (max-w-prose center).
- Autosave indicator (top-right : « Saved » / « Saving… » / « Offline »).
- Word count + readability score (si dispo).
- Toolbar slim : bold / italic / link / heading / list / quote / code / image.
- `Cmd+S` = save explicite (autosave est passive).
- `Cmd+P` = preview public dans nouvelle tab.
- Sidebar droite collapsable : metadata SEO + tags + scheduling.

**Qualité (`/quality`) :**

- Heatmap métriques (publications par score).
- Drill-down clic → liste publications de cette tranche.
- Filtre par campagne / auteur / période.

**Costs (`/costs`) :**

- Stat cards : coût mois en cours / coût mois -1 / cumul année / projection fin mois.
- Graphe area chart par fournisseur API (Claude / OpenAI / Mistral si dispo).
- Alertes budget (paramétrables via `/settings`).

### 10.2 Composants content-gen à créer/refondre

| Composant | Emplacement | Refonte |
| --- | --- | --- |
| `OnboardingWizard` | `src/components/admin/content-gen/OnboardingWizard.tsx` | nouveau, 3-step + skip |
| `CampaignFormPreview` | `src/components/admin/content-gen/CampaignFormPreview.tsx` | nouveau, preview live coûts |
| `JobStatusBanner` | `src/components/admin/content-gen/JobStatusBanner.tsx` | sticky top sur pages détail |
| `JobLogStream` v2 | refonte existant | virtualised + filter + pause + copy |
| `ReviewDiffView` | `src/components/admin/content-gen/ReviewDiffView.tsx` | côte-à-côte ou unified |
| `ReviewActionsBar` | `src/components/admin/content-gen/ReviewActionsBar.tsx` | Approve/Edit/Reject sticky bottom |
| `AutosaveIndicator` | `src/components/admin/ui/AdminAutosaveIndicator.tsx` | top-right éditeur |
| `CostStatGrid` | `src/components/admin/content-gen/CostStatGrid.tsx` | nouveau |
| `BudgetAlertBanner` | `src/components/admin/content-gen/BudgetAlertBanner.tsx` | nouveau |

### 10.3 Shortcuts admin globaux (à câbler dans `AdminCommandPalette` + page-level)

| Shortcut | Action |
| --- | --- |
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `Cmd+B` / `Ctrl+B` | Toggle sidebar |
| `Cmd+/` / `Ctrl+/` | Search global |
| `G` then `D` | Go dashboard |
| `G` then `C` | Go content-gen |
| `G` then `J` | Go jobs |
| `G` then `R` | Go review queue |
| `G` then `I` | Go image-bank |
| `J` / `K` | Next / prev in list |
| `Enter` | Open item |
| `ESC` | Close modal / blur |
| `Cmd+S` / `Ctrl+S` | Save (forms + editor) |
| `Cmd+Enter` / `Ctrl+Enter` | Submit form / approve |
| `Cmd+Shift+P` | Open preview public |

Affichage des shortcuts via `<AdminKeyboardHint>` partout où c'est pertinent + page `/settings/shortcuts` listant tous.

---

## 11. PHASE 7 — Anti-régression et tests (3-5 h, PR 13)

### 11.1 Suite Playwright admin smoke (30 flows)

À étendre / créer dans `axionia/tests/e2e/admin/**` :

- Login → home → logout.
- Navigation sidebar : chaque groupe → 1 page.
- CRUD reservation : create → list → detail → edit → cancel.
- CRUD devis : idem.
- CRUD invoice (factures) : list → detail → status change.
- Calendrier : navigation mois, événement detail.
- Content-gen full flow : onboarding → coverage create → job follow → publication edit → review approve.
- Image-bank : upload single → library → detail → delete.
- Users : list → detail → role change.
- Activity logs : list → filter → export.
- Settings : update → reload → assert persisted.
- 2FA : setup flow (mock).
- Command palette : Cmd+K → search → navigate.
- Keyboard shortcuts : `G D`, `J/K`, `ESC`.

Tous doivent rester verts. Tout nouveau test = pas de régression introduite.

### 11.2 Vitest unit primitives

Couvrir au minimum :

- `AdminPageHeader` (titre rendu, description optionnelle, actions slot).
- `AdminTable` (sort, pagination, empty, selection).
- `AdminFormField` (label assoc, error display, required marker).
- `AdminConfirmDialog` (focus trap, ESC close, callback).
- `AdminCommandPalette` (open, search, navigate).

Coverage primitives ≥ 80 %.

### 11.3 Lighthouse CI sur admin authentifié

Admin = derrière Auth.js + segment `[adminPrefix]` runtime. Lighthouse CI ne peut pas s'authentifier en standard. Deux options à proposer Will :

**Option A (recommandée) — Token de bypass CI** :

- Variable env CI uniquement : `LHCI_ADMIN_BYPASS_TOKEN` (générée 32 bytes, jamais en prod via Coolify scope `BUILD` seulement).
- Middleware admin lit `x-lhci-bypass-token` header → si match et `NODE_ENV !== "production"` → session mockée read-only.
- `lighthouserc.json` config `extraHeaders: { "x-lhci-bypass-token": "..." }` sur les 3 URLs admin.
- Risque sécu : si le token fuite en prod = bypass auth. Mitigation : NodeEnv check strict + token rotation CI mensuelle + audit log de tout usage du bypass.

**Option B (fallback) — Lighthouse local-only** :

- LHCI tourne en local sur build preview (`pnpm build && pnpm start`) avec session cookie injecté par script Playwright qui se logue d'abord.
- Pas de gate CI sur admin, seulement gate dev manuel pre-merge.
- Risque : pas de gate automatique → régression peut passer.

**Décision** : STOP & ASK Will entre A et B. Default = A si pas de réponse en 24 h (gate automatique > sécu marginale d'un token CI-only).

URLs admin pilotes :

- `/fr/<adminPrefix>` (dashboard).
- `/fr/<adminPrefix>/content-gen` (dashboard content-gen).
- `/fr/<adminPrefix>/content-gen/coverage` (liste).

Seuils : Performance ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 80 (admin pas SEO mais valider `noindex` bien posé via meta robots ou header `X-Robots-Tag`).

### 11.4 Bundle size gates

Ajouter à `.size-limit.js` (ou config existante) :

- `app/[locale]/(admin)/[adminPrefix]/page.tsx` ≤ 80 KB gz.
- `app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx` ≤ 100 KB gz.
- `app/[locale]/(admin)/[adminPrefix]/content-gen/publications/[id]/edit/page.tsx` ≤ 150 KB gz (Tiptap inclus).

---

## 12. PHASE 8 — Certification finale + verdict (1-2 h)

### 12.1 Grille de scoring final /2000

| Catégorie | Poids | Score |
| --- | --- | --- |
| Layout & Navigation (A1) | 150 | /150 |
| Design System livré (A2) | 300 | /300 |
| Pages catégoriques migrées (A3) | 200 | /200 |
| Content Generator UX (A4) | 400 | /400 (focus Will, ×2) |
| Accessibilité WCAG 2.2 AA (A5) | 150 | /150 |
| Performance budget tenu (A6) | 200 | /200 |
| Centralisation / 0 duplication (A7) | 200 | /200 |
| UX micro-interactions (A8) | 200 | /200 |
| Anti-régression (tests + smoke + visual diff baseline) | 200 | /200 |
| **Non-négociables intacts** (CSP nonce, ActivityLog, Sentry tags, force-dynamic, session-during-edit, multi-tab, JobLogStream contrat) | **bonus / malus -300 si KO** | /0 |
| **TOTAL** | **2000** | **/2000** |

> Tout non-négociable §3 violé déclenche un **malus de -300 pts** par violation détectée, peu importe le score brut. Trois violations = NO-GO automatique.

### 12.2 Verdict

- **≥ 1800 / 2000** : 🟢 **EXCELLENCE — mai 2026 atteint, PR sets mergeables.**
- **1700-1799** : 🟢 **GO — quelques P1 à fixer en suivi, mergeable.**
- **1500-1699** : 🟡 **CONDITIONAL — 2-4 P0 à fixer avant merge final.**
- **< 1500** : 🔴 **NO-GO — revoir la stratégie, STOP & ASK Will.**

### 12.3 Livrables certifiés

Au terme, sous `_AUDIT/ADMIN-REFONTE-2026-05-17/` :

1. `00-PRE-FLIGHT-CHECK.md` (PR #14 statut, tag baseline créé, feature flag posé)
2. `00-INVENTORY.md`
3. `01-AUDIT-LAYOUT-NAV.md`
4. `02-AUDIT-DESIGN-SYSTEM.md`
5. `03-AUDIT-PAGES-CATEGORIES.md`
6. `04-AUDIT-CONTENT-GEN.md`
7. `05-AUDIT-A11Y-WCAG22.md`
8. `06-AUDIT-PERF.md`
9. `07-AUDIT-DUPLICATION.md`
10. `08-AUDIT-UX-FRICTION.md`
11. `09-AUDIT-NON-NEGOCIABLES-RESPECT.md` (CSP nonce / ActivityLog / Sentry / force-dynamic / session-during-edit / multi-tab / JobLogStream / print / tablet / reduced-motion → tableau ✓/✗ par migration)
12. `SYNTHESE-PHASE-1.md`
13. `PATTERNS.md`
14. `IMPLEMENTATION-PLAN.md`
15. `VERDICT-FINAL.md`
16. `ANTI-REGRESSION-REPORT.md` (visual diff baseline vs final + Playwright smoke + Lighthouse delta)
17. `EXEC-SUMMARY-WILL.md` (1 page, lisible 60 sec)

Plus dans le code :

- `axionia/docs/adr/0028-admin-design-system-v1.md`
- `axionia/docs/admin-design-system.md` (catalogue primitives + exemples)
- `axionia/src/app/admin.css`
- `axionia/src/components/admin/ui/**` (~25 primitives)
- `axionia/tests/e2e/admin/**` (30 flows smoke)

### 12.4 Exec summary Will (format figé)

```
# Refonte console admin — Verdict 2026-05-17

Score : ___ / 2000 (🟢/🟡/🔴)
PRs ouvertes : 14 (X mergées, Y open, Z à venir)

Top 3 wins :
1. ...
2. ...
3. ...

Top 3 risques / actions humaines :
1. ...
2. ...
3. ...

Anti-régression : 0 régression détectée sur 30 flows smoke + 8 pages Lighthouse.
Performance : LCP/INP/CLS/TBT/FirstLoadJS tous dans budget.
Doctrine : Design.md respectée, 0 token public modifié.

Prochaine étape recommandée : ...
```

---

## 13. ANTI-PATTERNS INTERDITS (checklist)

Dans tout patch de cette refonte, **rejeter** :

1. ❌ `bg-black`, `text-black`, `border-black` ou tout hex `#000`.
2. ❌ Emoji comme icône produit (😬 → utiliser `lucide-react` ou SVG dédié).
3. ❌ `<div onClick={}>` sans `role="button"` + `tabIndex={0}` + `onKeyDown`.
4. ❌ Modal sans focus trap + ESC close + return focus to trigger.
5. ❌ Form field sans `<label htmlFor>` ou `aria-labelledby`.
6. ❌ Spinner full page pendant chargement (utiliser skeleton dimensionnel).
7. ❌ Toast destructive sans option « Undo » 5-10 sec quand possible.
8. ❌ Bouton primaire couleur autre que `var(--color-primary)` (`#1a4dd9`).
9. ❌ Italique terracotta sur CTA primaire (signature éditoriale only).
10. ❌ `'use client'` ligne 1 sans commentaire ligne 2 justifiant le besoin.
11. ❌ Magic string hex hardcodée (gate `anti-hex`).
12. ❌ Composant `admin/**` importé hors `(admin)/**` ou `server/admin/**`.
13. ❌ Modification d'un Server Action ou d'une API route existante.
14. ❌ Modification d'un seed, d'une migration Prisma.
15. ❌ Ajout d'une dépendance npm > 30 KB gz sans STOP & ASK + ADR.
16. ❌ Dark mode introduit (admin = light only).
17. ❌ Police chargée non préchargée (CLS risk).
18. ❌ Lazy import sans `loading` defined → CLS.
19. ❌ `Date.now()` ou `Math.random()` dans un Server Component (non-déterministe SSG).
20. ❌ Texte EN dans l'admin (FR uniquement, doctrine §14).
21. ❌ `<style>` ou `<script>` inline sans `nonce={headers().get('x-nonce')}` (CSP cassée).
22. ❌ Server Action mutante sans `logActivity()` (ou helper équivalent existant) — audit trail cassé.
23. ❌ Suppression / renommage d'un appel `Sentry.setTag()`, `Sentry.setContext()`, `Sentry.addBreadcrumb()`, ou attribut `data-sentry-component` lors d'une migration de page.
24. ❌ Introduction de `revalidate = N` ou suppression de `force-dynamic` sur route admin sans STOP & ASK.
25. ❌ Form admin sans `useActionState` + `useFormStatus` (doctrine §3.5) si nouveau code post-refonte.
26. ❌ Optimistic update sans rollback `useOptimistic` ou équivalent.
27. ❌ Route admin sans `error.tsx` ni `loading.tsx` après migration Phase 5 (gate audit final).
28. ❌ Modification du contrat `JobLogStream` (endpoint, payload, transport) sans STOP & ASK + API versionnée parallèle.
29. ❌ Édition d'une ressource sans champ `updatedAt` envoyé pour optimistic concurrency (cf. §3.7, top-4 ressources minimum).
30. ❌ Heartbeat session manquant sur page d'édition longue (Tiptap, formulaires > 5 fields) — cf. §3.6.

---

## 14. WORKFLOW PER-PR (commit hygiene)

Pour chaque PR de la refonte :

1. Branche dédiée : `feat/admin-refonte-prX-<scope>` (jamais sur main directement).
2. Commits Conventional Commits :
   - `feat(admin/ui): add AdminPageHeader primitive`
   - `refactor(admin/users): migrate to AdminPageShell + AdminTable`
   - `chore(admin): wire admin.css tokens in layout`
   - `test(admin/e2e): add smoke for content-gen review flow`
   - `docs(admin): ADR 0028 admin design system v1`
3. PR description format :
   ```
   ## Scope
   - ...

   ## Avant / Après (screenshots)
   - ...

   ## Anti-régression
   - [ ] Playwright smoke admin vert
   - [ ] Vitest primitives nouvelles ≥ 80% cov
   - [ ] Lighthouse delta ≤ -2 points
   - [ ] Bundle delta admin/* ≤ +5 KB gz
   - [ ] 0 nouvelle violation anti-hex / use-client / isolation

   ## Risques
   - ...

   ## Rollback plan
   - ...
   ```
4. Pas de squash forcé : conserver l'historique granulaire dans le merge commit.
5. Tag PRs avec label `admin-refonte-2026-05`.

---

## 15. GESTION DES STOP & ASK

Lever un **STOP & ASK Will** uniquement dans ces cas :

1. Inventaire Phase 0 révèle > 200 routes admin (scope élargi).
2. Score global Phase 1 < 350/1000 (refonte plus large).
3. ADR 0028 (Phase 2) impacte une décision design publique (Design.md).
4. Une régression fonctionnelle est détectée sur un flow critique en cours de migration.
5. Une dépendance externe > 30 KB gz est tentante.
6. Un Server Action ou une API existante a besoin d'évoluer pour servir l'UX.
7. Un budget de performance est dépassé sans solution évidente.
8. Un flow content-gen révèle un manque backend (worker, queue, RPC).

Sinon : **avance, applique tes défauts raisonnables, documente dans le commit**.

---

## 16. RAPPELS FINAUX

- **Tu travailles dans `axionia/`** (sous-repo Axion-IA). Tous les chemins de cette refonte sont préfixés `axionia/` même si non écrit.
- **Doctrine code = SSOT** (mémoire user `axionia_doctrine_code_ssot`) : si Design.md et le code divergent, **le code gagne** sauf décision Will explicite.
- **Doctrine commit + push autorisés** (mémoire `feedback_commit_no_push`, 2026-05-14) : commits et push origin/main OK tant que Conventional Commits, pas de `--no-verify`, pas de force-push.
- **Pas de Sentry-only debugging** : aucun fix de prod sans tests verts ajoutés.
- **Ne crée pas de fichiers `.md` de progression hors `_AUDIT/`** : pas de `PROGRESS.md`, pas de `PLAN.md` à la racine.
- **Si tu touches `globals.css` ou Tailwind config public, STOP & ASK** : ces fichiers sont en zone publique sensible (Web Vitals + SEO).
- **Lit `node_modules/next/dist/docs/`** avant tout usage non trivial de Next.js 16 (cf. `AGENTS.md`).
- **Image bank skill v1.1 existe** (cf. mémoires) — réutiliser ses primitives si pertinent côté admin/image-bank.

---

## 17. PHRASE D'INVOCATION (collable directement par Will)

```
Lance la refonte frontend admin selon _AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md.

Ordre :
1. Pré-flight check §3bis (PR #14 mergée ? tag baseline ? feature flag ?) — STOP & ASK si bloqué.
2. Phase 0 reality check (inventaire 15 points).
3. Phase 1 audit 8 sous-agents parallèles → SYNTHESE-PHASE-1.md.
4. Phase 2 conception → ADR 0028 + IMPLEMENTATION-PLAN.md → STOP & ASK Will.
5. PRs 0→14 séquentielles avec gates verts à chaque PR (typecheck, lint, tests, bundle delta,
   anti-hex, isolation-check, use-client-check, Lighthouse admin si Option A choisie,
   visual diff vs baseline).

0 régression tolérée. Focus content-generator (poids ×2 dans scoring final /2000).
Non-négociables §3 + §3.5-§3.10 sacro-saints : toute violation = malus -300 pts.
Verdict final + EXEC-SUMMARY-WILL.md dans _AUDIT/ADMIN-REFONTE-2026-05-17/.
Pushs sur main avec Conventional Commits. Feature flag ADMIN_V2_ENABLED=false par
défaut jusqu'à PR 14 finale (retrait flag).

STOP & ASK Will uniquement aux 8 cas listés §15 (inventaire >200 routes, score <350,
ADR public impacté, régression fonctionnelle, dep >30 KB, Server Action à muter,
budget perf dépassé sans solution, manque backend content-gen) + 3 nouveaux :
Lighthouse Option A vs B, big-bang vs feature flag, JobLogStream contrat à muter.
Sinon applique tes défauts raisonnables et documente dans le commit.
```

---

**Fin du prompt.** Toute déviation de ce cadre doit être tracée dans un STOP & ASK explicite ou un ADR dédié.
