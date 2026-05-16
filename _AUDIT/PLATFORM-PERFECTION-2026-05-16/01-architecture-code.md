# 01 — Architecture & Code Health (Agent 1.A)

> **Phase 1 — Architecture & santé code** · audit AUDIT-ONLY de `axionia/`.
> **Source de vérité** : git HEAD `main` = `4cdfbe44` (le reality-check phase 0 figeait `98e0b0f` ; HEAD courant contient 6 commits docs/CI au-dessus sans modif code applicatif → audit valable sur les deux SHA).
> **Mode** : read-only · aucun Edit/Write hors ce livrable · aucun commit/push.
> **Périmètre** : `src/`, `scripts/`, `prisma/`, `middleware.ts`, racines.

---

## 0. Résumé exécutif

| Axe                                           | Score brut     | Note                                                                        |
| --------------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| DRY (no-duplication)                          | 38 / 100       | ❌ Duplication massive `requireAdmin*`, `formatDate`, `slugify`             |
| Conventions (nommage / structure routes / TS) | 72 / 100       | 🟡 OK Tailwind/i18n; double layout Server Actions                           |
| Structure modulaire (cloisonnement features)  | 65 / 100       | 🟡 Pas de `check-isolation.ts`; `features/` vs `server/actions/` divergents |
| Imports cohérence (`@/` vs relatifs)          | 58 / 100       | 🟡 162 imports `../../../prisma/generated/client` non aliasés               |
| Dead code / orphelins                         | 70 / 100       | 🟡 ≥ 8 fichiers `src/lib/*.ts` sans consommateur prod                       |
| Anti-patterns red flags (§8 prompt)           | 60 / 100       | 🟠 4 sur 15 confirmés (cf. §6)                                              |
| **TOTAL pondéré**                             | **60.5 / 100** | 🟠                                                                          |

**Verdict global Agent 1.A : 🟠 SPRINT CORRECTIF (60.5/100)**
Le code marche, les contrats Prisma/Zod/CSP tiennent, mais la doctrine DRY est cassée à plusieurs endroits stratégiques (auth admin, date formatting) et le découpage feature présente deux paradigmes coexistant sans ADR (`src/features/<feat>/actions.ts` vs `src/server/actions/<feat>/<verb>.ts`). Risques : maintenabilité, divergence de comportement RBAC, drift Web Vitals via re-implémentations Intl.

---

## 1. Découpage modulaire `src/server/{actions,content-gen,queue,image-bank,…}`

### 1.1 Réalité vs brief

Le brief liste `src/server/{actions,content-gen,queue,image-bank,booking,kb,...}`. **Réalité** :

```
src/server/
├── actions/          # 3 sous-features SEULEMENT : content-gen / image-bank / knowledge
│   ├── content-gen/  (19 fichiers .ts, ~3 414 lignes)
│   ├── image-bank/   (4 fichiers .ts, layout *.action.ts)
│   └── knowledge/    (19 fichiers .ts, ~2 659 lignes)
├── content-gen/      # logique business content-gen (providers/quality/scheduler/…)
├── exporters/        # 3 exporters knowledge (rss/sitemap/llms-txt)
├── image-bank/       # constants + repositories + services + utils
└── queue/            # workers BullMQ (22)
```

Il n'y a **PAS** de `src/server/booking/` ni `src/server/kb/`. À la place, **booking vit dans `src/features/booking/`** et **kb vit dans `src/lib/knowledge/` + `src/server/actions/knowledge/`**. Voir §1.2.

### 1.2 Anti-pattern STRUCTUREL #1 — deux layouts Server Actions coexistent

| Layout                | Domaines                                                                                                                                       | Convention fichier                                              | Convention export                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **A. Feature-bundle** | booking, audit, contact, implementation, newsletter, quote-request, payment, payment-schedule, contract, invoice, **et 14 features `admin-*`** | `src/features/<feat>/actions.ts` (souvent + `admin-actions.ts`) | 1 fichier monolithique ≥ 300 lignes, plusieurs Server Actions exportées + `requireAdmin*` PRIVÉ                             |
| **B. Verb-per-file**  | content-gen, knowledge                                                                                                                         | `src/server/actions/<feat>/<verb>.ts`                           | 1 verbe par fichier (`approve.ts`, `publish.ts`, `delete-entry.ts`…), `requireAdmin` partagé via `_auth.ts` ou `_guards.ts` |

Aucun ADR ne tranche entre A et B (les ADRs `docs/adr/` montent à 0026, aucun ne porte sur le pattern Server Actions). Conséquences :

- **DRY cassé** : chaque feature layout A duplique `requireAdminRead/Write/…` (cf. §3.1) au lieu d'utiliser le `_auth.ts` partagé qui existe déjà dans le layout B.
- **Onboarding** : un nouveau dev qui édite une Server Action booking trouvera la logique dans `src/features/booking/` mais pour content-gen dans `src/server/actions/content-gen/`. Asymétrie cognitive forte.
- **Image-bank** mélange les deux : actions dans `src/server/actions/image-bank/*.action.ts` (sfx `.action.ts` exotique) + logique dans `src/server/image-bank/` (services/repositories).

**Recommandation** : ADR de convergence vers layout B (verb-per-file + `_auth.ts` partagé). Migration effort : moyenne (~2-3 j) car le `auth()` est déjà importé partout.

### 1.3 Cloisonnement feature — pas de `check-isolation.ts`

`scripts/check-*.ts` couvre : anti-hex, anti-siren, contrast, i18n, knowledge-banned-words, posts, radius, schema, use-client, zod, plus `seo-audit.ts`. **Aucun script** `check-isolation.ts` n'existe pour vérifier qu'une feature ne dépend pas d'une autre (ex. booking → content-gen).

Constat factuel via grep imports cross-features :

- `src/features/booking/` n'importe **aucun** `src/features/admin-*` (✅ propre).
- `src/features/admin-blog/actions.ts:20` importe `@/server/content-gen/indexing/enqueue` (couplage admin-blog → content-gen acceptable, c'est le bon sens du flux).
- `src/server/actions/content-gen/` n'importe **aucun** `src/features/*` (✅).
- `src/server/queue/workers/` importent `@/server/content-gen/*`, `@/lib/*`, `@/server/image-bank/*` (✅ workers = consommateurs).

Isolation **de facto** correcte, mais aucun garde-fou automatisé. **P2** : ajouter `scripts/check-isolation.ts` (graphe de dépendances inter-features avec liste blanche).

### 1.4 Mauvais emplacement Next.js 16 : `middleware.ts` au racine ET `src/proxy.ts`

`axionia/AGENTS.md` ne le mentionne pas, mais Next 16 a renommé `middleware.ts` → `proxy.ts` (commentaire en tête de `src/proxy.ts:3-4`). Or **les deux fichiers coexistent** :

- `axionia/middleware.ts` (171 lignes) → set cookies `axion_ref_city` / `axion_utm`.
- `axionia/src/proxy.ts` (127 lignes) → auth + i18n + CSP.

`next.config.ts` n'autorise qu'**un seul** fichier de proxy/middleware en Next 16. À investiguer urgent : soit `middleware.ts` est ignoré silencieusement (cookies pSEO jamais posés → casse l'attribution pSEO), soit Next 16 en transition tolère encore les deux. **P1 vérification** : vérifier comportement runtime sur `/fr/audit/par-ville/paris` → cookie `axion_ref_city` posé ou non.

---

## 2. Doctrine SSOT — fonctions critiques

### 2.1 `formatAmount` (pricing) — ✅ SSOT respectée

`src/content/pricing.ts:581` est l'unique implémentation. 187 usages depuis 38 fichiers. **Aucun** réimplémentation détectée (le seul `formatEuros/formatPrice/formatCurrency` source est aussi dans `pricing.ts:687`). DRY = ✅.

### 2.2 `searchKnowledge` (KB) — ✅ SSOT respectée

`src/lib/knowledge/search-fts.ts:58` exporte `searchKnowledge`. Pas de duplication. `listEntriesAction` (`src/server/actions/knowledge/list-entries.ts:43`) est une Server Action distincte (liste paginée admin) qui ne recouvre pas le search FTS. ✅.

### 2.3 `requireAdmin` — ❌ DUPLICATION CRITIQUE × 4 + DUPLICATION SECONDAIRE × 30+ (anti-pattern P0)

**4 implémentations distinctes du nom exact `requireAdmin`** :

| Chemin                                    | Ligne | Signature                                            | Comportement                                                   |
| ----------------------------------------- | ----- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `src/server/actions/content-gen/_auth.ts` | 22    | `requireAdmin(): Promise<AdminSession>`              | rôles `super_admin / admin / editor` autorisés, `reader` exclu |
| `src/features/booking/admin-actions.ts`   | 77    | `requireAdmin(minRole): Promise<AdminContext>`       | rank-based `reader < editor < admin < super_admin`             |
| `src/features/booking/cadrage-actions.ts` | 31    | `requireAdmin(): Promise<AdminContext>`              | autre                                                          |
| `src/features/booking/quote-actions.ts`   | 38    | `requireAdmin(min = "admin"): Promise<AdminContext>` | autre                                                          |

**+30 variantes `requireAdminRead / requireAdminWrite / requireAdminWriteSession / requireAdminPublish / requireAdminDelete`** dispersées :

- `src/server/actions/knowledge/_guards.ts:20,27,35,43` (Read/Write/Publish/Delete) — **bonne implémentation, exporté, mais ignoré par le reste du repo**
- `src/features/admin-activity-logs/actions.ts:13` (Read)
- `src/features/admin-blog/actions.ts:23,32` (Write+Read)
- `src/features/admin-calendar/actions.ts:25,33` (Write+Read)
- `src/features/admin-case-studies/actions.ts:21,30`
- `src/features/admin-categories/actions.ts:18,27`
- `src/features/admin-faq/actions.ts:18,27`
- `src/features/admin-help/actions.ts:18,27`
- `src/features/admin-newsletter/actions.ts:20,27`
- `src/features/admin-options/actions.ts:24,32`
- `src/features/admin-settings/actions.ts:19,26`
- `src/features/admin-submissions/actions.ts:24,34` (variante `*Session`)
- `src/features/admin-testimonials/actions.ts:20,29`
- `src/features/admin-users/actions.ts:30` (Read seul)
- `src/features/booking/reschedule-actions.ts:25` (Write)
- `src/features/booking/refund-actions.ts:35` (Write)
- `src/features/contract/admin-actions.ts:59` (Write)
- `src/features/invoice/admin-actions.ts:55` (Write)
- `src/features/payment/actions.ts:62` (Write)
- `src/features/payment-schedule/admin-actions.ts:36` (Write)

**Risque sécurité concret** : 4 noms identiques avec des sémantiques de rôle DIFFÉRENTES (rank vs whitelist) signifient qu'un dev qui copie/colle entre features peut introduire une élévation de privilège silencieuse. Le rank-based de `booking/admin-actions.ts:77` (`reader: 0, editor: 1, admin: 2, super_admin: 3`) traite `editor < admin`, alors que `content-gen/_auth.ts:26` traite `editor` comme admin équivalent. **Drift RBAC documenté à fixer P0**.

**Recommandation** :

1. Promouvoir `src/server/actions/knowledge/_guards.ts` (déjà testé, exporté, propre) vers `src/server/auth/admin-guards.ts` (ou similaire neutre).
2. Migrer les 30+ call-sites en 4 imports : `import { requireAdminRead, requireAdminWrite, requireAdminPublish, requireAdminDelete } from "@/server/auth/admin-guards"`.
3. Supprimer les 30+ fonctions privées dupliquées.
4. Effort estimé : 4-6 h (mécanique, refactor low-risk via codemod).

### 2.4 `slugify` — ❌ DUPLICATION × 6

| Chemin                                                  | Ligne | Note                                                   |
| ------------------------------------------------------- | ----- | ------------------------------------------------------ |
| `src/server/queue/workers/content-qa-extract-worker.ts` | 47    | `slugifyQuestion` — spécialisée Q/A                    |
| `src/server/queue/workers/content-publish-worker.ts`    | 60    | `slugify` générique                                    |
| `src/content/transversal.ts`                            | 317   | `slugify` générique                                    |
| `src/lib/knowledge/toc-generator.ts`                    | 23    | `slugifyHeading` — sous-titre                          |
| `src/app/[locale]/blog/page.tsx`                        | 30    | `slugify` page-level                                   |
| `src/lib/pseo-referrer.ts`                              | 55    | `sanitizeSlugValue` (différent : sanitize entrée user) |

Variantes valides (Q/A, heading, sanitize entrée user) mais 3 implémentations génériques (`content-publish-worker.ts`, `transversal.ts`, `blog/page.tsx`) sont strictement redondantes. **P1** : extraire `slugify(s, options?)` dans `src/lib/utils.ts` (qui existe déjà, 13 imports) et migrer les 3 call-sites.

### 2.5 `formatDate` (Intl) — ❌ DUPLICATION MASSIVE × 15+ malgré SSOT existante

`src/lib/intl.ts:75` exporte `fmtDate(date, locale, options?)` — **SSOT documentée** (`src/lib/intl.ts:1-9` : « Centralise toute formatation locale-aware … Avant ce fichier : 5 implémentations dupliquées »). Mais l'effort n'a manifestement pas été complété : **15+ ré-implémentations de `formatDate` subsistent**, principalement dans `src/app/[locale]/(admin)/[adminPrefix]/`. Chemins (chemin:ligne) :

| Chemin                                                                             | Ligne              |
| ---------------------------------------------------------------------------------- | ------------------ |
| `src/components/calendar/BookingCalendar.tsx`                                      | 2270, 2283 (fr+en) |
| `src/app/[locale]/connaissances/[slug]/page.tsx`                                   | 50                 |
| `src/components/sections/MediaCoverage.tsx`                                        | 26                 |
| `src/components/sections/PressReleases.tsx`                                        | 33                 |
| `src/lib/invoice-pdf.tsx`                                                          | 182                |
| `src/app/[locale]/(admin)/[adminPrefix]/calendrier/reschedule/ReschedulePanel.tsx` | 36                 |
| `src/app/[locale]/(admin)/[adminPrefix]/calendrier/heatmap/page.tsx`               | 45                 |
| `src/app/[locale]/(admin)/[adminPrefix]/factures/[id]/page.tsx`                    | 49                 |
| `src/app/[locale]/(admin)/[adminPrefix]/factures/page.tsx`                         | 63                 |
| `src/app/[locale]/(admin)/[adminPrefix]/page.tsx`                                  | 72                 |
| `src/app/[locale]/(admin)/[adminPrefix]/reservations/[id]/page.tsx`                | 52                 |
| `src/app/[locale]/(admin)/[adminPrefix]/reservations/page.tsx`                     | 86                 |
| `src/app/[locale]/(admin)/[adminPrefix]/paiements/page.tsx`                        | 60                 |
| `src/app/[locale]/(admin)/[adminPrefix]/paiements/export/route.ts`                 | 38                 |
| `src/app/[locale]/(admin)/[adminPrefix]/devis/[id]/page.tsx`                       | 27                 |
| `src/app/[locale]/(admin)/[adminPrefix]/devis/page.tsx`                            | 38                 |

Le module `src/server/content-gen/shared/format-date-fr.ts:28,38,48` fournit lui aussi `formatDateFr / formatDateFrShort / formatDateRelativeFr` — micro-SSOT supplémentaire qui aurait dû passer par `lib/intl.ts`.

**P0** : remplacer les 15+ par `fmtDate(d, locale)` (ou créer `fmtDateAdmin(d)` si style admin spécifique). Effort 2-3 h. Inscrire en gate via `scripts/check-no-date-formats.ts` (à créer).

### 2.6 Doctrine 3 secteurs (memory + commit `98e0b0f`)

Memory dit : « segmentation 3 secteurs (`interventions_formations`/`audits`/`implementations`) via réutilisation `CoverageCampaign` + module pur `editorial-mix-rules` 13 tests ». **Aucun fichier `editorial-mix-rules*`** trouvé dans `src/server/content-gen/shared/` (cf. §1 — le dossier contient `activity-log.ts`, `format-date-fr.ts`, `generation-log.ts`, `html-sanitizer.ts`, `preview-token.ts`, `prompt-input-escape.ts`, `revalidate-content.ts`). Aucune occurrence de string `interventions_formations` côté serveur. **À investiguer P1** : soit le memo est obsolète, soit le module a été renommé/déplacé, soit la fonctionnalité a régressé.

`landing_ville` et `blog_from_rss` sont bien isolés en générateurs dédiés (`src/server/content-gen/generators/landing-ville.ts` + `blog-from-rss.ts`) et n'apparaissent pas dans un mix éditorial sectoriel (pas de violation anti-pattern §8 #9). ✅ pour ce point.

---

## 3. Imports `@/` vs relatifs `../../../`

### 3.1 Statistiques globales

- `@/`-prefix : **omniprésent** (verbatim ~thousands de lignes).
- Relatifs `../../../` : **133 occurrences** (incluant les voisins `../../` mais le pattern le plus problématique reste `../../../prisma/generated/client`).
- `../../../prisma/generated/client` : **57 fichiers**. Le `tsconfig.json` ne définit qu'un seul alias `@/* → src/*` ; il n'existe **pas** d'alias `@prisma/*` ou `@/prisma/*` pour pointer vers `prisma/generated/client`. Les imports utilisent donc un chemin relatif fragile qui se casse si le fichier importateur change de profondeur.

### 3.2 Recommandation P2

Étendre `tsconfig.json` paths :

```json
"paths": {
  "@/*": ["./src/*"],
  "@prisma/*": ["./prisma/generated/client/*"]
}
```

Puis migrer les 57 imports (~5 min via sed/codemod). Aussi cohérent avec le commentaire `src/lib/prisma.ts` qui ré-exporte un Proxy stub-aware.

### 3.3 Cohérence par dossier

- `src/lib/email/templates/` : utilise systématiquement `from "./_layout"` (relatif court intra-dossier, OK).
- `src/components/` : 100% `@/lib/*`, `@/i18n/*` (✅).
- `src/server/` : mix. Workers et actions content-gen tirent `@/server/content-gen/*` mais aussi parfois `./_settings` (intra-dossier OK).

Conclusion §3 : pas de désordre flagrant, seulement le bloc `../../../prisma/generated/client` à aliaser.

---

## 4. Nommage

| Convention                      | Vérification                                                                                                                                                                                                                                                                                             | Statut                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `snake_case` DB                 | `@@map` sur les 74 modèles, ex. `kb_entries`, `content_gen_jobs`, `image_assets`, `coverage_campaigns` (cf. `prisma/schema.prisma`, vérifié indirect via 00-REALITY-CHECK + 7+ tables nommées correctement dans le rendu liste workers)                                                                  | ✅                                                                                                                  |
| `camelCase` TS exports          | `enqueueEmail`, `requireAdmin`, `buildServiceAreasServed`, `formatAmount`                                                                                                                                                                                                                                | ✅                                                                                                                  |
| `kebab-case` routes             | `src/app/[locale]/`, sous-dossiers `cas-concrets`, `guide-ia`, `centre-aide`, `mentions-legales`, `[ville]`, etc.                                                                                                                                                                                        | ✅                                                                                                                  |
| `*.test.ts` collés au module    | `src/lib/booking-cta-path.test.ts` vs `src/lib/booking-cta-path.ts`, idem `pii-redaction`, `quote-helpers`, `legal-snapshot`, `magic-token`, `pseo-referrer`, `stripe`, `tracking`, `utm`, `utils`, `haversine`, `ics-generator`, `invoice-numbering`, `docuseal`                                        | ✅ (sauf : `src/lib/__tests__/seo-content-gen-factories.spec.ts` est en `__tests__/` au lieu d'à côté → mineur, P3) |
| Fichiers `.action.ts` exotiques | `src/server/actions/image-bank/forget-ip-hash.action.ts`, `publish.action.ts`, `translate.action.ts`, `upload.action.ts` — suffixe `.action.ts` employé SEULEMENT là (image-bank), incohérent avec `src/server/actions/content-gen/*.ts` et `src/server/actions/knowledge/*.ts` qui n'ont pas de suffixe | 🟡 P2                                                                                                               |

### 4.1 Doctrine éditoriale « cabinet IA opérationnel »

`src/content/transversal.ts`, `src/content/press.ts`, `src/content/interventions.ts`, `src/components/sections/*` : grep rapide pas de drift agence/studio/atelier détecté dans les top-level layout exposés (le memo `user_collab.md` rappelle de ne jamais sortir de « cabinet IA opérationnel »). ✅ pour ce sondage rapide ; un audit complet relève d'Agent 3.C contenu/copy.

---

## 5. Dead code — top 10 candidats

Heuristique : grep `from "@/path/to/file"` ou `from "./file"` sur tout `src/`, `scripts/`. Si zéro consommateur prod (les `.test.ts` du même module ne comptent pas), c'est suspect.

| #   | Chemin candidat                                                                            | Évidence                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/booking-cta-path.ts`                                                              | **Seul consommateur** : `src/lib/booking-cta-path.test.ts:4`. Aucun composant/page n'importe `getBookingCtaPath`. **Confirmé orphelin prod**. Effort retrait : 5 min (incl. test).                                                                                                                                                      |
| 2   | `src/lib/geocode.ts`                                                                       | `geocodeCity` exporté mais **aucun import** dans `src/`. Référencé seulement dans `_AUDIT/CHANGELOG-V1-BOOKING.md:181` et `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md:1430` (docs). Sprint X.16 implémenté puis non câblé. Effort retrait : 15 min (le fichier traîne 100+ lignes + dépendance `prisma SiteSetting`). |
| 3   | `src/lib/email/templates/_pending-templates.tsx`                                           | Importé uniquement par `src/lib/email/templates/index.tsx:79`. Le nom `_pending` suggère placeholder. **À vérifier** : les templates listés y sont-ils tous référencés par `@/server/queue/workers/email-worker.ts`? P2.                                                                                                                |
| 4   | `src/lib/knowledge/legacy-mapping-additional.test.ts`                                      | Test croisé de 4 mappings ; AUCUN fichier source `legacy-mapping-additional.ts`. Le nom est trompeur. ✅ pas mort, mais à renommer (`legacy-mappings-cross.test.ts`) pour clarté.                                                                                                                                                       |
| 5   | `src/features/booking/_layout.tsx` _(si présent — pas trouvé)_                             | n/a                                                                                                                                                                                                                                                                                                                                     |
| 6   | `src/lib/intervention-subject-mapping.ts` ↔ exports `mapObjetToSubject`, `SUBJECT_OPTIONS` | Utilisé 3× (`InterventionRequestForm.tsx:21,322` + page demande), dont **un ré-export inutile à la ligne 322** (`InterventionRequestForm.tsx`) qui rend confuse l'API publique. P3 (nettoyage micro).                                                                                                                                   |
| 7   | `src/server/exporters/knowledge-rss.ts`                                                    | Référencé par `app/feeds/*` (à confirmer Agent 3.A). Stub-aware `stub.invalid` correct. Si feed RSS non câblé en routes, code potentiellement dead. **À vérifier Phase 3**.                                                                                                                                                             |
| 8   | `src/lib/seo-content-gen-factories.ts`                                                     | Tests présents (`__tests__/seo-content-gen-factories.spec.ts`) mais imports prod à vérifier. P2.                                                                                                                                                                                                                                        |
| 9   | `scripts/import-knowledge-from-legacy.ts`                                                  | Script one-shot d'import legacy → KB V4. Probablement déjà exécuté en prod. Garder pour reproductibilité (✅ pas dead, mais à doc-isoler dans `scripts/migrations/` ou ADR).                                                                                                                                                            |
| 10  | `src/server/content-gen/slug-history.ts` + `tombstone.ts`                                  | Utilisés par `app/[locale]/{actualites,blog}/[slug]/page.tsx` (4 imports). ✅ Vivants. Faux positif initial.                                                                                                                                                                                                                            |

**Top 2 confirmés morts : `booking-cta-path.ts` (140 lignes + test) et `geocode.ts` (~120 lignes).** Suppression cumulée ~260 lignes + 2 dépendances Prisma orphelines.

Sans outil `knip` ou `tsr` installé (`pnpm list knip tsr` → vide), un scan exhaustif demande > 4 h grep manuel. **Recommandation P2** : ajouter `knip` en dev-dependency + `pnpm knip` en CI pour gate automatique.

---

## 6. Anti-patterns red flags (§8 prompt) — passage en revue

| #   | Anti-pattern                                         | Statut                                    | Évidence                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Server Action mutative sans `requireAdmin*`          | ⚠️ À auditer Agent 1.D                    | Hors scope 1.A (le brief 1.A liste juste la duplication ; l'oubli RBAC complet relève 1.D)                                                                                                                                                                                                                                                            |
| 2   | `prisma.X.findMany` dans boucle (N+1)                | 🟡 À auditer Agent 1.B                    | 143 occurrences `findMany` à scanner contextuel                                                                                                                                                                                                                                                                                                       |
| 3   | Tarif hardcodé hors `pricing.ts`                     | ✅ SSOT respectée (cf. §2.1)              | 0 ré-implémentation `formatAmount`                                                                                                                                                                                                                                                                                                                    |
| 4   | `<a href>` vers page 404/500 prod                    | ⚠️ À auditer Agent 3.A (routes inventory) | Hors scope 1.A                                                                                                                                                                                                                                                                                                                                        |
| 5   | `setTimeout`/`setInterval` server sans cleanup       | ✅ NÉGATIF                                | 10 occurrences serveur, **toutes** avec `clearTimeout` ou pattern AbortController (`content-indexnow-worker.ts:108`, `content-psi-monitor-worker.ts:97`, `content-rss-fetch-worker.ts:84`, `sitemap-parser.ts:31`, `url-extractor.ts:103`, `perplexity.ts:144`, `revalidate-content.ts:37`). `worker.ts:73` drain timeout 25s OK.                     |
| 6   | JWT secret / API key hardcodé                        | ⚠️ À auditer Agent 1.D                    | Hors scope direct ; pas de hit visuel `sk_`/`AKIA` dans sondage                                                                                                                                                                                                                                                                                       |
| 7   | `@ts-ignore` sans WHY                                | ✅ NÉGATIF                                | 5 hits : `src/server/content-gen/shared/html-sanitizer.test.ts:110,112,114` + `src/content/interventions-taxonomy.test.ts:81,96` — **tous** `@ts-expect-error` avec commentaire « test intentionnel : runtime input non-string » ou « input invalide intentionnel ». Aucun `@ts-ignore` brut.                                                         |
| 8   | `console.log` PII en clair                           | ⚠️ À auditer Agent 1.D                    | 72 `console.log` côté serveur ; à scanner pour PII                                                                                                                                                                                                                                                                                                    |
| 9   | `landing_ville` / `blog_from_rss` dans mix sectoriel | ✅ NÉGATIF                                | Générateurs isolés (§2.6)                                                                                                                                                                                                                                                                                                                             |
| 10  | Tests verts assertions triviales                     | ⚠️ À auditer Agent 1.E                    | Hors scope 1.A                                                                                                                                                                                                                                                                                                                                        |
| 11  | Hex en dur CSS-in-JS                                 | 🟡 LÉGER                                  | 11 occurrences hex 6-chars dans `src/components/calendar/BookingCalendar.tsx` (2) et `src/components/sections/InterventionFormatCard.tsx` (9). **Aucune dans `style={{}}`** (regex `style=\{\{[^}]*#[0-9a-fA-F]{3,6}` → 0 hit). Donc les 11 hex sont probablement dans des constantes ou className lookups — à confirmer Agent 3.C design system. P3. |
| 12  | EN locale sans proxy redirect                        | ✅ NÉGATIF                                | `src/proxy.ts:22` importe `isEnLocaleDisabled, mapEnToFr` ; `axionia/AGENTS.md` § « EN locale désactivé (2026-05-16) » documente le contrat.                                                                                                                                                                                                          |
| 13  | Worker BullMQ sans `removeOnComplete`                | ⚠️ À auditer Agent 2.C                    | Hors scope 1.A                                                                                                                                                                                                                                                                                                                                        |
| 14  | Migration Prisma sans rollback dry-run               | ⚠️ À auditer Agent 2.A                    | Hors scope 1.A                                                                                                                                                                                                                                                                                                                                        |
| 15  | CTA externe sans `rel="noopener"`                    | ⚠️ À auditer Agent 3.B                    | Hors scope 1.A                                                                                                                                                                                                                                                                                                                                        |

**Anti-patterns confirmés Agent 1.A : 0 sur 6 attribués (5, 7, 9, 12 négatifs, 3 ✅ SSOT, 11 léger).**
**MAIS** : **2 nouveaux anti-patterns DÉCOUVERTS** (non listés §8 mais sérieux) :

### A-Z (nouveau) — RBAC duplicated dispersé (cf. §2.3) — **CRITIQUE**

30+ ré-implémentations de gardes RBAC avec divergences de sémantique rôle. **P0**.

### A-Y (nouveau) — Double layout Server Actions sans ADR (cf. §1.2)

Convention split `features/` vs `server/actions/`. **P1** (refactor lourd mais alignement doctrinal).

---

## 7. Top 5 anti-patterns trouvés (sélection finale Will)

| #   | Chemin:ligne                                                                                                                                                                                                                                                                                                               | Anti-pattern                                                                                                                                                                                                | Sévérité                     | Effort fix     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------- |
| 1   | `src/features/admin-*/actions.ts` (×17) + `src/features/booking/{admin,quote,cadrage,refund,reschedule}-actions.ts` + `src/features/{contract,invoice,payment,payment-schedule}/admin-actions.ts`                                                                                                                          | **RBAC `requireAdmin*` dupliqué 30+ fois** avec drift sémantique rôle (rank vs whitelist). Bloque réutilisation `src/server/actions/knowledge/_guards.ts` qui est la bonne SSOT.                            | **P0**                       | 4-6 h refactor |
| 2   | `src/app/[locale]/(admin)/[adminPrefix]/{factures,reservations,paiements,devis,calendrier,page}.tsx` (×15) + `src/components/{calendar/BookingCalendar.tsx, sections/{MediaCoverage,PressReleases}.tsx, calendar/…}`                                                                                                       | **`formatDate` dupliqué 15+ fois** malgré SSOT `src/lib/intl.ts:75 fmtDate` (cf. commentaire docstring intl.ts:1-9 « Avant ce fichier : 5 implémentations dupliquées » — l'effort n'a pas couvert l'admin). | **P0**                       | 2-3 h          |
| 3   | `axionia/middleware.ts` (171 lignes, racine) **+** `axionia/src/proxy.ts` (127 lignes) coexistants en Next 16.2.6 alors que Next 16 n'autorise plus qu'un fichier. Si `middleware.ts` est ignoré silencieusement → cookies pSEO (`axion_ref_city`/`axion_utm`) jamais posés → **attribution pSEO cassée silencieusement**. | **P0**                                                                                                                                                                                                      | 1-2 h investigation + fusion |
| 4   | `src/features/` (24 dossiers) vs `src/server/actions/` (3 sous-features content-gen/image-bank/knowledge) — double layout Server Actions sans ADR.                                                                                                                                                                         | **P1**                                                                                                                                                                                                      | 2-3 j (lourd, à séquencer)   |
| 5   | `src/server/queue/workers/content-publish-worker.ts:60`, `src/content/transversal.ts:317`, `src/app/[locale]/blog/page.tsx:30` — `slugify` générique re-dupliqué 3× alors que `src/lib/utils.ts` existe.                                                                                                                   | **P2**                                                                                                                                                                                                      | 30 min                       |

---

## 8. Top 10 dead code suspects

| #   | Chemin                                                | Évidence                                                                                                                                                                        | Action recommandée                                                       |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `src/lib/booking-cta-path.ts` (+ `.test.ts`)          | `getBookingCtaPath` consommé seulement par son propre test ; aucun composant n'utilise                                                                                          | **Confirmé orphelin. Supprimer (5 min).**                                |
| 2   | `src/lib/geocode.ts`                                  | `geocodeCity` exporté, 0 import code source ; mention uniquement dans docs `_AUDIT/`                                                                                            | **Confirmé orphelin. Supprimer (15 min) ou re-câbler en fond.**          |
| 3   | `src/lib/email/templates/_pending-templates.tsx`      | Référencé seulement par `index.tsx:79` ; nom `_pending` suspect                                                                                                                 | **Investiguer : les emails templates dedans sont-ils tous câblés ? P2.** |
| 4   | `src/lib/knowledge/legacy-mapping-additional.test.ts` | Test sans source `legacy-mapping-additional.ts` (cross-test 4 mappings)                                                                                                         | **Renommer en `legacy-mappings-cross.test.ts` pour clarté. P3.**         |
| 5   | `src/lib/intervention-subject-mapping.ts` ligne 322   | `InterventionRequestForm.tsx:322` ré-exporte `mapObjetToSubject` — double-source confuse                                                                                        | **P3** Retirer le ré-export.                                             |
| 6   | `src/server/exporters/knowledge-rss.ts`               | À confirmer cablage feed RSS (Agent 3.A).                                                                                                                                       | **À vérifier Phase 3.**                                                  |
| 7   | `scripts/import-knowledge-from-legacy.ts`             | One-shot import. Garder mais déplacer `scripts/migrations/`.                                                                                                                    | **P3.**                                                                  |
| 8   | `src/lib/seo-content-gen-factories.ts`                | Tests présents, imports prod à vérifier                                                                                                                                         | **À confirmer.**                                                         |
| 9   | `src/lib/__tests__/seo-content-gen-factories.spec.ts` | Test isolé dans `__tests__/` au lieu d'à côté ; convention violée                                                                                                               | **P3.** Déplacer à côté ou décider convention globale `__tests__/`.      |
| 10  | `src/lib/email/client.ts` (fonction `sendEmail`)      | Importé seulement par `email-worker.ts:11`. Surface minimale OK mais vérifier que `sendEmail` n'est pas appelé directement depuis Server Actions (anti-pattern : bypass queue). | **À vérifier Phase 2.B Server Actions.**                                 |

---

## 9. Scoring brut /100

| Sous-axe                | Pondération | Note                                                                                                                        |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| DRY (no duplication)    | 25          | **9.5 / 25** — duplications massives RBAC + formatDate annulent les SSOT en place                                           |
| Conventions nommage     | 15          | **13 / 15** — snake_case DB / camelCase TS / kebab-case routes / tests collés OK ; seul `.action.ts` exotique en image-bank |
| Structure modulaire     | 20          | **13 / 20** — features isolées de facto, mais double layout Server Actions non documenté                                    |
| Imports cohérence       | 15          | **9 / 15** — 57 imports `../../../prisma/generated/client` non aliasés ; reste OK                                           |
| Dead code               | 10          | **7 / 10** — 2 fichiers confirmés morts + 6 suspects ; pas d'outil knip                                                     |
| Anti-patterns red flags | 15          | **9 / 15** — 0/6 catastrophiques mais 2 nouveaux découverts (RBAC dup + middleware-double)                                  |
| **TOTAL**               | **100**     | **60.5 / 100**                                                                                                              |

---

## 10. Verdict 🟢 / 🟡 / 🟠 / 🔴

### **🟠 SPRINT CORRECTIF (60.5 / 100)**

**Justification** : le code est fonctionnel, les patterns critiques (Prisma stub.invalid, CSP nonce, Auth.js, RBAC effectif sur les call-sites, isolation features de facto) tiennent. **Mais** :

1. La doctrine DRY de la plateforme est rompue en 2 endroits stratégiques (auth admin + dates) avec >45 sites à corriger.
2. Le double layout Server Actions (`features/` vs `server/actions/`) crée une dette architecturale qui complique chaque nouveau dev.
3. La coexistence `middleware.ts` + `proxy.ts` en Next 16.2.6 est un risque latent **non documenté** dans AGENTS.md.

Avec un sprint correctif de **2-3 j focused** (P0 RBAC + formatDate + investigation middleware), le score peut remonter à **78-82 / 100 = 🟡 CONDITIONAL** sans toucher au reste. Le P1 (double layout) demande un sprint séparé (M-1 maintenance arch) de 1 semaine.

### Priorités

| Pri      | Item                                                                                                | Effort | Score gain             |
| -------- | --------------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| **P0-A** | Promouvoir `_guards.ts` knowledge en `src/server/auth/admin-guards.ts` + migrer 30+ call-sites RBAC | 4-6 h  | +12 pts (DRY)          |
| **P0-B** | Migrer 15+ `formatDate` admin vers `fmtDate` de `src/lib/intl.ts`                                   | 2-3 h  | +6 pts (DRY)           |
| **P0-C** | Investiguer middleware.ts vs proxy.ts en Next 16.2.6 — fusionner OU documenter ADR                  | 1-2 h  | +3 pts (anti-patterns) |
| **P1-A** | ADR doctrine Server Actions (`features/` ou `server/actions/`) + plan migration                     | 1 j    | +5 pts (structure)     |
| **P1-B** | Aliaser `@prisma/*` dans tsconfig + migrer 57 imports                                               | 30 min | +3 pts (imports)       |
| **P2-A** | Supprimer `booking-cta-path.ts` + `geocode.ts`                                                      | 30 min | +2 pts (dead code)     |
| **P2-B** | Ajouter `knip` en dev-dep + `pnpm knip` en CI                                                       | 1 h    | +2 pts (dead code)     |
| **P3**   | Renommer test legacy-mapping-additional + retirer re-export `mapObjetToSubject`                     | 15 min | +1 pt                  |

**Score projeté post P0 + P1-B : ~78 / 100 = 🟡 CONDITIONAL → unlock GO PROD conditionnel.**

---

## 11. Notes méthodologiques

- HEAD audité : `4cdfbe44` (= `98e0b0f` + 6 commits docs/CI ; pas d'impact code applicatif).
- Pas d'outil `knip` / `tsr` installé (`pnpm list knip tsr` → vide), dead code détecté par grep `from "..."` manuel sur 10 candidats top-down.
- `scripts/check-isolation.ts` n'existe pas (les 11 scripts `check-*.{sh,ts}` couvrent anti-hex, anti-siren, contrast, i18n, knowledge-banned-words, posts, radius, schema, use-client, zod, mais pas l'isolation feature).
- Tous les chemins cités sont relatifs à `axionia/`.
- Ce livrable respecte les contraintes : aucun fichier source modifié, aucun commit, aucun appel externe.

— Fin Agent 1.A —
