# ADR 0028 — Design System admin v1 (Mai 2026)

- **Statut** : Accepted — Foundation **Implemented** 2026-05-17 (PRs 0-5 + 13 livrées sur `main` local, 0 push). Migrations per-page (PR 6-11) + polish (PR 12) restent incrémentales.
- **Date** : 2026-05-17
- **Spec maître** : `_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`
- **Audit Phase 1** : `_AUDIT/ADMIN-REFONTE-2026-05-17/SYNTHESE-PHASE-1.md` (531.7/1000 baseline)
- **Cible verdict** : ≥ 1700/2000 post-refonte
- **Override** : §17 du master prompt remplacé par règles dures Will (autopilote, 0 push origin, commits sur main local, STOP & ASK uniquement sur 4 cas extrêmes).

## Contexte

La console admin Axion-IA souffre, au 2026-05-17 post-merge PR #14 :

- **116 routes** + **48 routes content-gen** + 10 composants admin + ~36 items sidebar dans 6 groupes.
- **0 token `--color-admin-*` / `--space-admin-*` / `--text-admin-*`** (design system admin inexistant).
- **0 / 116 `error.tsx`**, **1 / 116 `loading.tsx`**, **0 / 116 `not-found.tsx`**.
- **0 `@media print`** dans `src/` — factures et devis non imprimables proprement.
- **94 emojis** comme icônes nav + cmdk (`📊 📅 📋 …`) — anti-pattern mai 2026 confirmé.
- **`aria-current="page"`** injecté mais sans styling CSS (`globals.css:675-693`) → A11y theatre.
- **`TiptapEditor`** chargé statiquement (~45-65 KB gz sur toutes les routes utilisatrices, pas de `dynamic({ ssr: false })`).
- **0 skeleton** avec dimensions exactes → CLS risk.
- **SSE JobLogStream / GeoEventsBanner** sans reconnect backoff.
- **0 autosave Tiptap** → risque perte travail sur crash navigateur.

Constat Will :

> « La console est catastrophique et vieillotte. Je veux moderne mai 2026, sans friction, exceptionnelle. Le content generator doit être plus fluide. Le design admin doit être centralisé. Attention : 0 régression. »

## Décisions

### 1. Cloisonnement strict admin

- **Tokens** : nouveau fichier `src/app/admin.css`, importé **uniquement** par `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`. Tokens préfixés `--color-admin-*` / `--space-admin-*` / `--text-admin-*` / `--radius-admin-*` / `--shadow-admin-*` / `--z-admin-*` (cf. §6.1 master prompt).
- **Primitives** : nouveau dossier `src/components/admin/ui/**`. **Jamais importé hors admin**. Gate `isolation-check` (script `scripts/check-isolation.ts`) étendu pour ajouter cette règle.
- **Composants existants** : `src/components/ui/**` reste **public**, extensible uniquement, jamais modifié dans l'API publique.

### 2. Doctrine visuelle admin

- **Positionnement** : « console métier dense, productive, sobre. Réf Linear / Vercel Dashboard / Stripe Dashboard. Pas Notion (trop éditorial), pas Airtable (trop coloré). »
- **Palette** : étendre Design.md sans toucher publics. Tokens admin dérivent largement via `var(--color-bg)`, `var(--color-paper)`, `var(--color-sand)` (alt rows), `var(--color-fg-soft)`, `var(--color-primary)` (info CTA), `var(--color-sage)` (success), `var(--color-terracotta)` (warning), `var(--color-error)` (destructive).
- **Typography** : `--text-admin-*` 11/12/13/14/16/20 px (plus dense que public 14-18 base), `--lh-admin-tight 1.35 / --lh-admin-body 1.5`.
- **Spacing** : scale 2/4/6/8/12/16/24/32 (dense vs public 8/16/24/32/48/64).
- **Radius** : 4/6/8/12 max (vs public 12-16).
- **Shadows** : elevation 1/2/3/4 subtles, `0 1px 0 rgb(0 0 0 / 0.04)` à `0 12px 24px rgb(0 0 0 / 0.10)`.
- **Light only** : pas de dark mode admin (cohérent doctrine éditoriale).
- **Doctrine intouchable** : pas de noir pur (`#000`, `text-black`, `bg-black`), pas d'italique terracotta sur CTA primaire (signature éditoriale uniquement). ~~pas d'emojis comme icônes (remplacer par `lucide-react`)~~ — **clause levée le 2026-08-25, voir l'amendement en fin d'ADR**.

### 3. Primitives admin (≈ 25 composants)

Voir `_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md` pour la spec détaillée. Synthèse :

| Catégorie    | Primitives                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Layout       | `<AdminPageShell>`, `<AdminDetailShell>`, `<AdminPageHeader>`, `<AdminTopbar>`, `<AdminBreadcrumbs>`                                    |
| Navigation   | `<AdminSidebarNav>` v2 (refonte AdminSidebar.tsx), `<AdminUserMenu>`, `<AdminNotificationsDropdown>`, `<AdminCommandPalette>` (enrichi) |
| Données      | `<AdminTable>`, `<AdminTableColumn>`, `<AdminBulkActions>`, `<AdminFilterChip>`, `<AdminPagination>`                                    |
| Formulaires  | `<AdminFormField>`, `<AdminFormSection>`, `<AdminInlineEdit>`, `<AdminSubmitButton>` (promu)                                            |
| Présentation | `<AdminCard>`, `<AdminStatCard>`, `<AdminBadge>` / `<AdminStatusBadge>`, `<AdminTabs>`, `<AdminKeyboardHint>`                           |
| États        | `<AdminEmptyState>`, `<AdminLoadingState>`, `<AdminErrorState>`, `<AdminConfirmDialog>`                                                 |
| UX critique  | `<AdminSessionExpiryWarning>` (§3.6), `<AdminConflictDialog>` (§3.7)                                                                    |

### 4. Conventions de code

- **Server Component par défaut**. `'use client'` **uniquement** si nécessaire (hooks, events, browser APIs). Justification obligatoire en commentaire ligne 1 (gate `use-client-check`).
- **TypeScript strict** : pas de `any`. Props interfaces typées avec génériques `<T>` pour `<AdminTable<T>>`.
- **`cn()` utility** (clsx + tailwind-merge) déjà présent — réutiliser.
- **Tailwind utilities** + admin.css tokens. Pas de styled-components, pas de CSS-in-JS.
- **A11y first** : tout composant interactif a `role`, `aria-*`, focus management.
- **Reduced motion** respecté (`motion-reduce:` Tailwind).
- **React 19** : `useActionState`, `useFormStatus`, `useOptimistic` partout où la latence > 100 ms.
- **Progressive enhancement** : forms admin fonctionnent sans JS.

### 5. Feature flag `ADMIN_V2_ENABLED`

- Helper `isAdminV2Enabled()` déjà créé (`src/lib/feature-flags.ts`, commit `568d92e`).
- Pattern d'usage : chaque page migrée propose `<PageV1 />` (legacy) vs `<PageV2 />` (refonte). Switch via env var (default `false` = legacy).
- **Override per-session** : cookie `admin_v2=1` — sera câblé dans le middleware admin en PR 1 (FoundationShell).
- **Retrait final** : PR 14 supprime le flag + dossiers `_v1/` + nettoyage.

### 6. Trio `error.tsx` / `loading.tsx` / `not-found.tsx`

- **Couverture minimale** au niveau `src/app/[locale]/(admin)/[adminPrefix]/` (héritage Next 16 → couvre les 116 routes par défaut).
- **Overrides** pour sections denses : `content-gen/` (jobs queue, review-queue), `image-bank/` (library), `factures/` + `devis/` (PDF generation).
- Toutes les `error.tsx` admin utilisent `<AdminErrorState>` ; `loading.tsx` utilisent `<AdminLoadingState>` ; `not-found.tsx` utilisent `<AdminEmptyState>` variant "not-found".

### 7. Print mode (factures, devis, échéanciers)

- Nouveau fichier `src/app/print.css` minimal :
  - `@media print { .admin-sidebar, .admin-header, .admin-bulk-actions { display: none } main { padding: 0 } .currency, .invoice-amount { font-family: ui-monospace, monospace } }`.
- Import dans `layout.tsx` admin (au-dessus de `admin.css`).
- Tests `Cmd+P` manuels sur 3 pages représentatives : `/factures/[id]`, `/devis/[id]`, `/echeanciers`.

### 8. Préservation contrats critiques

- **JobLogStream / GeoEventsBanner SSE** : endpoints `/api/content-gen/jobs/[id]/stream` + `/api/content-gen/geo-events` inchangés. Transport text/event-stream, `withCredentials: true`, format payload identique. Le wrapper UI peut changer, le contrat réseau non.
- **26 `logActivity()`** dans 7 fichiers content-gen : aucun renaming ni signature change. Grep avant/après chaque refonte de page.
- **50+ `force-dynamic`** admin : aucun passage à ISR sans STOP & ASK Will + ADR.
- **CSP nonce** + COEP intacts (Sprint 24) : aucune inline-style/script sans nonce.
- **Server Actions** signatures inchangées (§3.1 master prompt).

### 9. Endpoint nouveau `/api/admin/session-ping`

- Endpoint léger GET (≤ 200 octets payload) : `{ ok: true, expiresAt: <ISO> }` ou `401` si session expirée.
- Heartbeat côté `<AdminSessionExpiryWarning>` (toutes les 5 min ; si `expiresAt < now() + 2 min` → modal non-bloquante).
- Cf. §3.6 master prompt.

### 10. Gates par PR (cf. §8.3 master prompt)

```
pnpm typecheck      # 0 erreur
pnpm lint           # 0 erreur, 0 warning nouveau
pnpm test           # 100 % primitives nouvelles ou modifiées
pnpm test:e2e:admin # smoke admin reste vert
pnpm build          # bundle delta admin/* ≤ +5 KB gz vs main
pnpm anti-hex       # 0 nouvelle violation
pnpm use-client-check # 0 use-client non justifié
pnpm isolation-check  # 0 leak admin/ui hors admin
+ Playwright visual diff vs baseline (±5 % par zone autorisé)
+ Lighthouse desktop ≥ 90 sur 3 URLs admin pilotes
```

Si gate échoue → fix root cause, jamais skip.

## Alternatives rejetées

1. **Réutiliser `src/components/ui/**` pour l'admin sans cloisonnement séparé\*\*. Rejeté : risque drift design éditorial vs admin (densité ≠), risque cassure publique si on adapte une primitive pour besoin admin. Cloisonnement = isolation safety + flexibilité.
2. **Refonte big-bang sans feature flag**. Rejeté : 116 routes à migrer en une fois = risque régression non-rattrapable, impossible de tester V2 en prod sans bascule globale. Flag + cookie override = sécurité maximale.
3. **Dark mode admin**. Rejeté : doctrine éditoriale light-only, cohérence brand, complexité tokens × 2.
4. **Réutiliser une lib externe (Mantine, ShadCN UI complet, react-aria-components)**. Rejeté : Radix UI déjà présent (utilisé par `src/components/ui/**`), introduire une nouvelle lib = +30 KB gz minimum + courbe d'apprentissage + risque d'incompatibilité avec doctrine Design.md. Construction maison sur tokens propres = contrôle total.

## Conséquences

- **Positives** :
  - Console mai 2026 moderne, sobre, productive, sans friction.
  - Design system admin centralisé = -35 % LOC sur les pages (estimation A7).
  - A11y WCAG 2.2 AA atteint sur tous composants nouveaux.
  - First Load JS admin réduit (Tiptap dynamic, cmdk deferred).
  - Mitigations §3.6-3.9 câblées (session expiry, conflict, print, reduced motion).
- **Négatives** :
  - 25 primitives à créer + 116 pages à migrer = effort 35-55 h autopilote.
  - Risque régression non-zéro (mitigé par feature flag + tests anti-régression).
  - Cycle de stabilisation après merge final (PR 14) à prévoir.
- **Coût** :
  - Aucun nouveau coût d'infrastructure (pas de dépendance externe payante).
  - Aucun changement DB / API / worker.
  - Effort dev autopilote.

## Plan d'implémentation

Voir `_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md` (15 PRs équivalents séquentiels sur `main` local, 0 push).

## Suivi

- Tag baseline : `admin-refonte-baseline-2026-05-17` (LOCAL).
- Tags PR : `admin-refonte-pr<N>-start` / `admin-refonte-pr<N>-end` (LOCAL, N=0..14).
- Journal : `_AUDIT/ADMIN-REFONTE-2026-05-17/JOURNAL.md`.
- Verdict final : `_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (/2000).
- Rapport anti-régression : `_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md`.

## Décision

**Adopter le design system admin v1** comme défini ci-dessus, avec exécution autopilote selon les règles dures Will. Le STOP & ASK §6.4 du master prompt (validation Phase 2 par Will) est **explicitement remplacé** par la règle dure §3 du brief Will : autopilote sauf 4 cas extrêmes (scope > 200 routes, score Phase 1 < 350, régression non-réparable, dépendance npm > 30 KB gz). Ces 4 conditions ne sont pas remplies (116 routes < 200 ; 531.7/1000 > 350 ; pas de régression encore ; pas de nouvelle dépendance prévue). → **GO Phase 3** sans interruption.

## Amendement 2026-08-25 — la clause anti-emoji est levée

**Décidé par Will**, en connaissance de l'argument opposé, qui lui a été présenté
avant la décision.

Ce que la clause interdisait : l'emoji comme icône dans la console admin. Elle
était outillée par trois gardes — `admin-emoji-ratchet.test.ts` (plafond global
sur `src/app/[locale]/(admin)` + `src/components/admin` + deux fichiers SSOT
nommés), une assertion dans `admin-labels.test.ts`, et un bloc de
`session-parcours.spec.ts`. **Les trois sont retirés.**

Les deux motifs d'origine restent vrais et sont consignés ici pour que la
décision soit reprise en connaissance de cause si elle doit l'être un jour :

1. le dessin, la chasse et la graisse d'un emoji dépendent du système et de la
   police du poste — impossible à aligner sur une grille, rendu variable d'un
   utilisateur à l'autre ;
2. deux emojis peuvent ne différer **que par la couleur** (🔴 / 🟠), ce qui rend
   l'information invisible en vision des couleurs déficiente. C'était le cas du
   niveau d'alerte, l'information la plus urgente de la console.

Ce qui NE change pas, et qui n'a jamais été une règle sur les emojis :
**un pictogramme ne porte jamais seul une information.** L'état s'écrit en
toutes lettres, la couleur s'accompagne d'une forme ou d'un mot (WCAG 1.4.1), et
un glyphe décoratif se marque `aria-hidden`. C'est cette exigence-là que les
tests conservés vérifient désormais, à la place du comptage d'emojis.

Motif de la levée : les emojis sont voulus sur le **site public** (refonte de
`/contact` du 2026-08-25), et Will a choisi de ne pas maintenir deux doctrines
opposées de part et d'autre de la frontière admin/public.
