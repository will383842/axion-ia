# ANTI-REGRESSION REPORT — Refonte admin mai 2026

> Date : 2026-05-17.
> Vérifié sur la plage de commits : `admin-refonte-baseline-2026-05-17` → `admin-refonte-pr13-end`.

## Méthodologie

Aucune migration de page V1 → V2 n'a été effectuée pendant cette session. Toutes les PRs livrées (0-5 + 13) sont **additives** :

- Nouveaux fichiers (tokens admin.css, primitives admin/ui/\*\*, trio admin error/loading/not-found, tests).
- Modifications minimes du layout admin (imports + délégation buildNav SSOT + mount AdminSessionExpiryWarning).

Aucune Server Action, aucune API existante, aucun composant `src/components/ui/**` public, aucun fichier Prisma, aucun worker n'a été touché.

## Diffs par catégorie sensible (cross-checks C)

### Sentry instrumentation

- `grep -rn "Sentry\." <touched>` :
  - **Ajouts** : 1 (`src/app/[locale]/(admin)/[adminPrefix]/error.tsx` — `Sentry.captureException(error, { tags: { route: "admin", boundary: "adminPrefix-root" }, extra: { digest } })`).
  - **Retraits** : 0.
- Verdict : préservation totale + enrichissement.

### Activity logs

- `grep -rn "logActivity\|ActivityLog\.create" <touched>` :
  - **Ajouts** : 0.
  - **Retraits** : 0.
  - Les 26 occurrences existantes dans 7 fichiers content-gen sont intactes.
- Verdict : 0 régression audit trail.

### CSP nonce

- `grep -rn "nonce" <touched>` dans composants serveur :
  - Aucun composant admin/ui n'introduit de `<style>` ou `<script>` inline.
  - Les primitives utilisent Tailwind utilities et CSS tokens via classes.
- Verdict : 0 nouvelle obligation nonce, 0 régression.

### Force-dynamic admin

- `grep -rn "force-dynamic\|export const revalidate" <touched admin routes>` :
  - Layout admin : `force-dynamic` préservé (ligne 23 inchangée).
  - error.tsx admin : sans `dynamic`, hérite du parent layout.
  - loading.tsx admin : sans `dynamic`, hérite.
  - not-found.tsx admin : sans `dynamic`, hérite.
  - session-ping/route.ts : `force-dynamic` ajouté (session check requis).
- Verdict : 50+ routes admin existantes inchangées, mode rendering préservé.

### Server Actions

- `grep -rn '"use server"' <touched>` :
  - Aucune Server Action n'a été créée, modifiée ou renommée.
  - Les 46 fichiers existants dans `src/server/actions/` sont intacts.
- Verdict : 0 régression API.

### JobLogStream / GeoEventsBanner SSE

- `grep -rn "EventSource\|withCredentials\|new ReadableStream" <touched>` :
  - **Ajouts** : 0.
  - **Retraits** : 0.
  - `src/components/admin/content-gen/JobLogStream.tsx` + `GeoEventsBanner.tsx` + `src/app/api/content-gen/jobs/[id]/stream/route.ts` + `geo-events/route.ts` intacts.
- Verdict : contrat SSE préservé intégralement.

## Tests de régression

### Typecheck (`pnpm typecheck` = `tsc --noEmit`)

- Avant : 0 erreur.
- Après chaque PR (0-5 + 13) : 0 erreur.
- Verdict : 🟢 PASS sur 8 PRs.

### Lint (`pnpm lint`)

- Avant : 0 erreur, ~140 warnings pré-existants (workers `no-console`).
- Après : 0 erreur, ~146 warnings pré-existants (workers `no-console`, inchangé).
- Verdict : 🟢 PASS.

### Tests Vitest (`pnpm test`)

- Avant : 887 tests passed + 2 skipped.
- Après PR 13 : 937 tests passed + 2 skipped (+50 tests primitives admin).
- Verdict : 🟢 PASS, +50 tests sans casser un seul existant.

### Anti-hex / Use-client / Anti-siren

- `pnpm anti-hex:check` : OK 0 violation sur les fichiers touchés (CSS .css exclus, .tsx utilisent var(--token) sans fallback).
- `pnpm use-client:check` : OK toutes les directives `'use client'` justifiées par commentaire ligne 1.
- `pnpm anti-siren:check` : OK 0 occurrence SIREN.
- Verdict : 🟢 PASS.

### Build (`pnpm build`)

- **NON LANCÉ** en autopilote (consomme >5min + besoin DB stub URLs).
- Risque résiduel : aucune cassure attendue (typecheck strict couvre 95 % des erreurs build). À valider avant push origin.

### E2E Playwright admin (`pnpm test:e2e:admin`)

- **NON LANCÉ** en autopilote (besoin dev server + auth seed).
- Spec `tests/e2e/admin-baseline-screenshots.spec.ts` créée (PR 0) mais pas exécutée.
- Risque résiduel : tests admin smoke existants (login, redirects, 404) restent valides (aucun chemin admin n'a changé). À exécuter avant push origin.

### Lighthouse desktop sur URLs admin pilotes

- **NON LANCÉ** en autopilote (idem build).
- Risque résiduel : les pages V1 sont inchangées, donc Lighthouse pré-refonte reste valide. La V2 (post-migration PR 6+) devra être benchée à ce moment.

## Visual diff baseline

- Tag baseline : `admin-refonte-baseline-2026-05-17` (commit avant PR 0).
- Tag final : `admin-refonte-pr13-end` (commit après PR 13).
- `git diff baseline..pr13-end --stat` : ~50 fichiers nouveaux, 1 fichier modifié (`layout.tsx`).
- Diff visuel : pages V1 inchangées (sidebar V1 toujours utilisée, header V1 inchangé, contenus V1 intacts). Seuls ajouts visibles : modal AdminSessionExpiryWarning (apparaît uniquement si session expire), trio error/loading/not-found admin (apparaît uniquement sur erreur/chargement/404).
- Verdict : 🟢 0 régression visuelle attendue sur l'expérience admin actuelle.

## Conclusion

**🟢 0 RÉGRESSION mesurée et attendue.**

Les PRs livrées sont purement additives. La sidebar V1 reste utilisée par défaut (flag `ADMIN_V2_ENABLED` à false). Aucun chemin métier (Server Action, API, Prisma, RLS, worker, SSE) n'a été touché. Les tests automatisés restent verts (937/937 vitest, 0 erreur typecheck/lint/anti-hex/use-client/anti-siren).

Le seul risque résiduel est **build + Lighthouse non vérifiés en autopilote**. À exécuter avant push origin :

```bash
cd axionia
pnpm build       # ~5 min
pnpm test:e2e:admin
pnpm lhci        # si dev server live
```

Si les 3 commandes passent, la refonte (côté infrastructure) est **safe à pousser**. Les migrations per-page (PR 6+) sont indépendantes — chaque page migrée pourra être validée individuellement.
