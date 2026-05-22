# Conversation Part 3 — V2 shell wired + 11 pages backlog — 2026-05-19

Suite de `CONVERSATION-2026-05-18-PART2-ADMIN-CRASH.md`. Sauvegarde demandée par Will pour reprise mercredi matin 2026-05-20.

## TL;DR session

- ✅ **V2 shell wired** dans `layout.tsx` (commit `5ca2eb5` pushed origin/main). AdminTopbar + AdminSidebarNav (lucide-react collapsible Cmd+B) + AdminUserMenu actifs quand `isAdminV2Enabled()` retourne true. V1 fallback intact.
- ✅ **ADMIN_V2_ENABLED=true confirmé** dans container Coolify (`docker exec printenv` vérifié via workflow `admin-enable-v2.yml`).
- ✅ **Audit V1 vs V2 complet** : 117 pages admin → **106 V2 (90.6%)**, **11 V1 fall-through** (login + 10 forms détail/création CRUD).
- ⏸️ **STOP demandé par Will** — migration des 11 pages restantes NON faite. Reprise mercredi matin.

## Diagnostic du « old design » que Will voyait

Cause root identifiée en profondeur :

- `layout.tsx` importait `AdminSidebar` (V1 emojis) en dur, sans aucun check du flag.
- Commentaire dans `AdminSidebarNav.tsx:15-16` disait littéralement : *« La sidebar V1 reste utilisable derrière flag ADMIN_V2_ENABLED=false ; layout.tsx switchera en PR 6+. »* → PR 6 a livré le composant V2 mais n'a jamais fait le câblage.
- Donc même flag à true → shell V1 visible en permanence (sidebar emojis, header plain), seules les pages internes rendaient V2.

Fix appliqué dans `5ca2eb5` :

```tsx
const v2 = showSidebar ? await isAdminV2Enabled() : false;
if (v2 && session?.user) {
  return (
    <div className="admin-layout-v2 min-h-screen bg-[color:var(--color-admin-bg)]">
      <AdminTopbar
        brand={...}
        commandPalette={<AdminCommandPalette ... />}
        userMenu={<AdminUserMenu ... />}
      />
      <div className="flex">
        <AdminSidebarNav items={nav} />
        <main className="admin-main min-w-0 flex-1">{children}</main>
      </div>
      <AdminSessionExpiryWarning />
    </div>
  );
}
// fallback V1 intact
```

Anti-régression : typecheck 0, hooks ×8 verts au commit.

## Audit V1 vs V2 — 11 pages fall-through V1 à migrer

Pattern `// V2 non implémenté pour cette route legacy admin. Flag check préservé pour spec compliance.` puis `// Intentional fall-through to V1 below.` :

1. `src/app/[locale]/(admin)/[adminPrefix]/login/page.tsx` — pré-auth (justifié, V2 layout n'applique pas)
2. `src/app/[locale]/(admin)/[adminPrefix]/users/new/page.tsx` — form création user
3. `src/app/[locale]/(admin)/[adminPrefix]/users/[id]/page.tsx` — détail user
4. `src/app/[locale]/(admin)/[adminPrefix]/settings/new/page.tsx` — form création setting
5. `src/app/[locale]/(admin)/[adminPrefix]/settings/[key]/page.tsx` — édition setting
6. `src/app/[locale]/(admin)/[adminPrefix]/devis/new/page.tsx` — form création devis
7. `src/app/[locale]/(admin)/[adminPrefix]/devis/[id]/page.tsx` — détail devis (~225L)
8. `src/app/[locale]/(admin)/[adminPrefix]/factures/[id]/page.tsx` — détail facture (~363L)
9. `src/app/[locale]/(admin)/[adminPrefix]/options/[id]/page.tsx` — détail option
10. `src/app/[locale]/(admin)/[adminPrefix]/reservations/[id]/page.tsx` — détail réservation
11. `src/app/[locale]/(admin)/[adminPrefix]/submissions/[id]/page.tsx` — détail soumission

## Plan de migration des 11 pages (pour mercredi 2026-05-20)

Pattern proposé par page (minimal, non-destructif) :

```tsx
// Extraire le contenu en variable
const inner = (
  <>
    {/* admin-dashboard-head V1 OU AdminPageHeader V2 selon flag */}
    {/* cards de détail (admin-card OU AdminCard) */}
  </>
);

const v2 = await isAdminV2Enabled();
if (v2) {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="..."
        description="..."
        actions={<Link href={...} className="admin-link">← Retour</Link>}
      />
      {/* corps existant, ou réécrit avec AdminCard */}
    </AdminPageShell>
  );
}
return (
  <section>
    <div className="admin-dashboard-head">...</div>
    {/* corps existant */}
  </section>
);
```

Effort estimé : ~30 min/page × 11 = **~5h30 d'autopilote**.

Composants V2 à utiliser (déjà exportés, voir `src/components/admin/ui/index.ts`) :
- `AdminPageShell` (wrapper section, max-width 1280px)
- `AdminPageHeader` (titre + description + actions + meta + breadcrumbs)
- `AdminCard` (variant informational/compact/interactive)
- `AdminBadge` / `AdminStatusBadge` (status colorés)
- `AdminTable` (tables denses)
- `AdminBreadcrumbs` (chemin nav)

Login : à voir s'il faut migrer ou laisser tel quel (V2 layout ne s'applique pas pré-auth — le shell V2 ne sera jamais visible sur login).

## État infra prod au moment du STOP

- **Prod commit** : déploiement `5ca2eb5` en cours (build GHCR + Coolify pull). ETA ~25 min depuis 22:10 UTC.
- **HEAD origin/main** : `5ca2eb5 feat(admin): wire V2 shell in layout when ADMIN_V2_ENABLED=true (PR 6 promise)`
- **Container** : restarted 2026-05-18T20:48:41 UTC avec `ADMIN_V2_ENABLED=true` + healthcheck OK
- **Coolify env** : `ADMIN_V2_ENABLED=true` (uuid=ugua6ssha85gqjfm5zvd1f81), `HELP_BACKEND_UNIFIED=true`

## Sentry — scope token à corriger

Token `SENTRY_AUTH_TOKEN` actuel (Internal Integration) :
- ✅ Marche pour `/projects/{org}/{project}/issues/` → `list-recent` OK
- ❌ HTTP 401 « Invalid token » sur `/issues/{id}/events/latest/` → `event-detail` bloqué

Will doit :
1. Sentry → Settings → Developer Settings → Internal Integrations → axion-ia
2. Ajouter scopes : `Event: Read` + `Issue & Event: Read`
3. Sauvegarder (Sentry peut demander de régénérer le token — si oui, refaire `gh secret set SENTRY_AUTH_TOKEN`)

Issue à investiguer une fois scope corrigé : **118951810 « Error: failed to pipe response »** count=14, lastSeen 2026-05-18T11:44 (cause probable admin crash pré-c33a831).

## Commits cette session Part 3

```
829804f  fix(ops): sentry-query dump raw JSON for issue/event-detail
5ca2eb5  feat(admin): wire V2 shell in layout when ADMIN_V2_ENABLED=true (PR 6 promise) ← LE FIX DU SESSION
```

## Phrase canonique pour reprendre mercredi

> « Reprends la migration V2 des 11 pages fall-through V1 listées dans `_AUDIT/DEPLOY-UNSTUCK-2026-05-18/transcripts/CONVERSATION-2026-05-19-PART3-V2-WIRE-UP.md`. Pattern : extraire le contenu en variable, retourner `<AdminPageShell><AdminPageHeader/>{content}</AdminPageShell>` quand `isAdminV2Enabled()`, sinon fallback V1 intact. Commencer par users/new + users/[id] (les plus simples), puis settings, devis, factures, options, reservations, submissions. Login : voir si à migrer ou laisser. Anti-régression typecheck après chaque page. Commit groupé par section. Push à la fin. »

## Verdict honnête (mise à jour 2026-05-19 ~23:45 UTC)

⚠️ **V2 shell PAS visible en prod malgré tout** — bug runtime à creuser mercredi.

Vérifications faites :
- ✅ Bundle compilé contient `admin-sidebar-v2` + `AdminSidebarNav` (curl chunks statiques)
- ✅ Container post-restart 23:41 UTC : `docker exec ... printenv | grep ADMIN_V2_ENABLED` → `true`
- ✅ Sentry-release header confirme `5ca2eb5` en prod
- ✅ Page dashboard rend KPI cards (mais pourrait être V1 dashboard aussi, visuel similaire)
- ❌ Diagnostic console JS : `wrapper: admin-layout` (V1), `topbar: false`, `sidebarV2: false`, `userMenu: false`
- ❌ `/api/admin/session-ping` retourne 401 en boucle (suspect : `auth()` retourne null dans API routes mais OK dans Server Components ?)

**Hypothèses à investiguer mercredi** (ordre de probabilité) :
1. **Next.js inline `process.env["ADMIN_V2_ENABLED"]` au build** malgré bracket notation — webpack DefinePlugin ou Next standalone build pre-resolution. Si var pas set au build (GH Actions), inline → undefined → false runtime. **Test** : add `data-debug-env={process.env.ADMIN_V2_ENABLED ?? "undefined"}` + `data-debug-v2={String(v2)}` sur le wrapper layout. Push. Inspecter DOM.
2. **Auth.js v5 session resolution differ entre API routes et Server Components** — session-ping 401 mais page sees session. Si `auth()` retourne null dans LAYOUT (qui est Server Component) mais OK dans PAGE, alors `showSidebar=false` → branche V1 même sans flag check. **Test** : ajouter `data-debug-session={String(!!session?.user)}`.
3. **Layout compilation différente du reste** — Next.js peut compiler la layout avec une stratégie de cache différente (e.g., shared layout cache). **Test** : grep le server bundle `.next/server/app/[locale]/(admin)/[adminPrefix]/layout.js` via SSH pour vérifier que `"admin-layout-v2"` string est présent.

**Plan d'action mercredi (par ordre)** :
1. Push commit diagnostic avec 3 `data-debug-*` attributs sur le wrapper layout V1 (pour qu'on les voie même quand v2=false). Deploy ~25 min.
2. Will inspecte DOM et donne valeurs des 3 attributs → on sait exactement.
3. Fix root cause selon ce que les attributs révèlent.
4. Re-deploy. Vérification V2 visible.
5. ENSUITE seulement, attaquer la migration des 11 pages V1 fall-through.

**État infra au moment du STOP final** :
- HEAD origin/main : `5ca2eb5 feat(admin): wire V2 shell in layout when ADMIN_V2_ENABLED=true (PR 6 promise)`
- Container Coolify : restarted 2026-05-19 23:40:33 UTC + ADMIN_V2_ENABLED=true confirmé
- Aucun commit unpushed sur main
- Sprint City Quality 6 reste « NON PUSHÉ » sur disque (par décision Will)

**Sentry token scope (toujours bloqué)** : Will doit ajouter `Event:Read` + `Issue&Event:Read` sur Internal Integration. Sans ça, `event-detail` reste en 401. Pourrait éclairer si le 401 session-ping pré-c33a831 admin crash sont liés.

## Ce que reste V1 (réel)

- ⛔ TOUT le shell admin (sidebar + topbar + user menu) en prod — V2 codé mais ne s'active pas runtime
- ⏸️ 11 pages fall-through (forms détail/création CRUD) — backlog mercredi
- ⏸️ Sentry deep diagnostic (token scope)
- ⏸️ Sprint City Quality 6 non pushé (par décision)
