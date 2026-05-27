# Audit Forensique — Sprint Notif Infra + Contacts/Calendly

> **Date audit** : 2026-05-27
> **Branche auditée** : `feat/notif-infra-contacts-calendly` (HEAD `82a7bb6e`)
> **Base** : `origin/main` `4074bc80` (PR #38 ouverte, **non mergée**)
> **Mode** : AUTOPILOT strict — 9 sub-agents Explore en parallèle, audit lecture seule
> **Verdict global** : 🟡 **GO CONDITIONNEL** — 2 P0 fix triviaux (~15 min) + 7 P1 (~5-8 h)

---

## Synthèse exécutive

Le sprint a livré **8 commits propres** sur la branche, avec une architecture saine (hub notif typé, admin tabs réutilisables, schema Prisma additif, reply system bout-en-bout). **Tous les tests sont verts** (1952/1959, +17 vs baseline 1935/1942). **Aucune régression** sur les 57 call-sites Telegram legacy.

**Points forts** :

- Hub notifications type-safe (discriminated union, 23 catégories typées) — **Chantier 1 production-ready**
- Sécurité OK : zéro secret leak, zéro XSS, zéro SQL raw, CSRF mitigé, rate-limit exhaustif
- Migration Prisma 100% additive idempotente (`IF NOT EXISTS` + `DO/EXCEPTION`)
- Bundle delta `/appel` : +1 KB gz (CalendlyEventCapture passif <1 KB)

**Points faibles bloquants** :

- **P0-1 (bug nav)** : `SubmissionsV2.tsx` hardcode `/submissions` dans `detailHref` → double redirect 301 après clic ligne dans `/contacts/messages`
- **P0-2 (UX archive)** : `listSubmissionsAction` n'inclut **pas** `archivedAt: null` dans le filtre par défaut → submissions archivées visibles dans l'inbox principale

**Points faibles non-bloquants** :

- 7 P1 (badge query non-cachée, badges/filtres listing pas implémentés, preview composer absent, détail Calendly + ajout manuel absents, UTM non extraits, webhook delivery PowerMTA non câblé)
- 4 P2 (retry Telegram, tests UI, RGPD rawPayload retention policy, DPA register)

**Vitest** : 1952/1959 passed, 0 fail, 7 skipped.
**Typecheck** : 0 erreur.
**Lint** : 0 erreur (13 warnings non-bloquants).

---

## Phases passées : 9/10

| Phase             | Status | Findings                                                                                                |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| A — Inventaire    | ⚠️     | 22 fichiers OK, 4 fichiers stubs léger (acceptable), 4 fichiers manquants (2 par-design OK, 2 P1)       |
| B — Hub notif     | ✅     | Type-safety, API notify(), channels, dedup/rate-limit, backward compat — tous OK. 2 P2 (retry, ref ADR) |
| C — Admin tabs    | 🔴     | **1 P0** (URL hardcode), **2 P1** (cache badge, tests AdminTabs)                                        |
| D — Reply system  | 🟡     | **3 P1** (webhook delivery, preview composer, badges listing), 1 P2 (tests UI)                          |
| E — Calendly      | 🟡     | **5 P1** (location field, UTM, filtres listing, détail page, ajout manuel), 1 P2 (test component)       |
| F — Croisements   | 🔴     | **1 P0 confirmé** (F.9 URL hardcode confirme C.4), **1 P0** (F.4 archivedAt filter), 1 P2 (revalidate)  |
| G — Sécurité/RGPD | ✅     | Tout vert (0 leak, 0 XSS, 0 SQL raw, CSRF mitigé, rate-limit). 2 P2 (rawPayload retention, DPA)         |
| H — Web Vitals    | ✅     | /appel +1 KB gz, admin Server Components, indexes pertinents. 1 P1 (N+1 badge unread non-cached)        |
| I — Tests         | ✅     | typecheck/lint/anti-\* tous verts, vitest 1952/1959 (0 fail, +17 vs baseline)                           |
| J — Convergence   | —      | (cette section)                                                                                         |

**Bombes à retardement** : 0 (rien d'irréversible).
**Risques RGPD** : 0 bloquant (2 P2 administratifs : retention rawPayload + DPA register).
**Risques sécurité** : 0.

---

## Top 5 actions Will (prioritaires)

1. **🔴 P0-1 (15 min)** — Fix `SubmissionsV2.tsx:48` : `const base = ...` → utiliser un prop `basePath` injecté par la page parente OU détecter le path. Évite le double-redirect.
2. **🔴 P0-2 (10 min)** — Ajouter `archivedAt: null` au where par défaut dans `listSubmissionsAction` (avec un toggle `includeArchived` Zod). Sinon l'inbox affiche les archivés.
3. **🟡 P1 (1-2 h)** — Implémenter les badges « Sans réponse / Répondu (N) / Échec » dans le listing (D.8 absent) + filtre `needsAttention` checkbox + filtre `Inclure archivés`. C'est l'UX inbox principale.
4. **🟡 P1 (30 min)** — Wrapper `prisma.submission.count` du badge sidebar dans `unstable_cache(30s)` pour éviter le N+1 sur chaque navigation admin (H.5).
5. **🟡 P1 (1-2 h)** — Ajouter preview markdown dans `ReplyComposer.tsx` (rendu live à droite du textarea) + tests `AdminTabs.test.tsx` + tests E2E `e2e/admin-contacts-tabs.spec.ts`.

---

## Détail par phase

### Phase A — Inventaire

⚠️ **22/26 fichiers présents et conformes**, 4 manquants :

| Fichier manquant                                                         | Criticité     | Justification                                                                   |
| ------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------- |
| `src/server/notifications/catalog.ts`                                    | OK-par-design | Inliné dans `types.ts` (discriminated union) + `routing.ts`                     |
| `src/server/queue/workers/notifications-worker.ts`                       | OK-par-design | V1 fire-and-forget (Promise détachée), pas de queue dédiée — documenté ADR 0029 |
| `src/components/admin/__tests__/AdminTabs.test.tsx`                      | **P1**        | Test composant pivot manquant                                                   |
| `e2e/admin-contacts-tabs.spec.ts` + `e2e/admin-reply-submission.spec.ts` | **P1**        | Dossier `e2e/` inexistant, tests E2E non créés                                  |
| `src/components/admin/contacts/__tests__/ReplyComposer.test.tsx`         | **P1**        | Test client component manquant                                                  |
| `src/app/[locale]/(admin)/[adminPrefix]/contacts/calendly/[id]/page.tsx` | **P1**        | Détail Calendly absent (cf. E.6)                                                |

Fichiers stubs <50 LOC (acceptable) : `channels/email.ts` (22 LOC placeholder), `rate-limit.ts` (36 LOC), `contacts/page.tsx` (14 LOC redirect), `dedup.ts` (30 LOC).

### Phase B — Hub notifications

✅ **Production-ready**. Discriminated union stricte 23 catégories, API notify() soft-fail, timeout 3s, sync/async respecté, BUILD-safe stub.invalid, MarkdownV2 escape correct, Sentry breadcrumb + captureMessage selon severity, Redis dedup atomic + fail-open, 57 call-sites legacy + 6 notify() pilotes hors hub.

**P2-001** : Pas de retry exponentiel sur le channel Telegram (V1 fire-and-forget assumé).
**P2-002** : Référence ADR dans `index.ts:3` pointe vers `0027` au lieu de `0029` (renumérotation suite collision avec ADRs existants).

### Phase C — Admin Contacts & Messages

🔴 **1 P0 + 2 P1** :

**P0-1 (CRITICAL nav bug)** — `src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx:48`

```ts
const base = `/fr/${adminPrefix}/submissions`; // ← legacy hardcode
```

Quand `SubmissionsV2` est appelée depuis `/contacts/messages/page.tsx` (cf. C.4), les `detailHref` pointent vers `/submissions/[id]` qui redirige 308 vers `/contacts/messages/[id]` → 2 hops réseau au lieu d'1.

**P1-1 (cache badge unread)** — `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:135`

```ts
prisma.submission.count({ where: { needsAttention: true, archivedAt: null } });
```

Aucun `unstable_cache(30s)` wrapper. Query exécutée à chaque render SSR du layout admin (`force-dynamic`). Impact perf cumulé sur navigation intense.

**P1-2 (tests)** : `AdminTabs.test.tsx` + `e2e/admin-contacts-tabs.spec.ts` absents.

### Phase D — Reply system

🟡 **3 P1 + 1 P2** :

**P1-3 (webhook delivery)** — `src/server/queue/workers/email-worker.ts:84-135` — enum `SubmissionReplyStatus` a 6 valeurs (`pending|sent|delivered|bounced|complained|failed`), mais le worker ne persiste que `sent`/`failed`. `delivered|bounced|complained` requièrent un webhook PowerMTA — non câblé. **Acceptable V1**, à tracker Sprint+1.

**P1-4 (preview composer)** — `src/components/admin/contacts/ReplyComposer.tsx` — pas de preview markdown live. Will tape le body sans voir le rendu final → risque de surprise post-envoi.

**P1-5 (badges listing)** — `SubmissionsV2.tsx` n'affiche **pas** :

- Badge « Sans réponse » (rouge) si `replyCount=0 AND status=new`
- Badge « Répondu (N) » (vert) si `replyCount>0`
- Badge « Échec envoi » (jaune) si dernière reply `deliveryStatus ∈ {bounced,failed}`
- Badge « Archivé » (gris) si `status=archived`

`listSubmissionsAction` (`actions.ts:122-133`) ne `select` même pas les nouveaux champs `replyCount`, `firstRepliedAt`, `lastRepliedAt`, `needsAttention`, `archivedAt`. **C'est le gros gap UX du sprint.**

**P2-003 (tests UI)** : `ReplyComposer.test.tsx`, `ReplyHistory.test.tsx`, `e2e/admin-reply-submission.spec.ts` absents.

### Phase E — Calendly Embed JS

🟡 **5 P1 + 1 P2** :

**P1-6 (champ `location`)** — `prisma/schema.prisma` model `CalendlyEvent` ne contient pas le champ `location` (mentionné dans le PROMPT initial). Migration n'a pas ce field. Skippé volontairement ou oubli ?

**P1-7 (UTM extraction)** — `src/app/[locale]/appel/page.tsx:230-234` — `trackingContext` passe **uniquement** `pageUrl`, pas les UTM (`utmSource`, `utmCampaign`, `utmMedium`, `referrer`). La page est `async function` et pourrait extraire via `searchParams` côté Server Component.

**P1-8 (filtres listing)** — `/contacts/calendly/page.tsx` n'a pas de filtres `Statut / période / recherche email`. Listing brut 100 derniers triés `capturedAt desc`.

**P1-9 (détail Calendly)** — `/contacts/calendly/[id]/page.tsx` n'existe pas. Will ne peut pas drill-down sur un event pour voir le rawPayload JSON, éditer l'inviteeEmail/Name manuellement, ou lier à une Submission.

**P1-10 (ajout manuel)** — `createManualCalendlyEventAction` non implémenté. Bouton « + Ajouter manuellement un RDV » absent. Will ne peut pas rattraper les events ratés (notif Gmail Calendly natif).

**P2-004 (test component)** — `CalendlyEventCapture.test.tsx` absent.

### Phase F — Croisements end-to-end

🔴 **2 P0** + 1 P2 :

**P0-2 (CONFIRMÉ F.4 : archivedAt filter manquant)** — `src/features/admin-submissions/actions.ts:78-144` `listSubmissionsAction` ne filtre **jamais** `archivedAt: null` dans le where par défaut. Les submissions archivées sont visibles dans l'inbox principale au lieu d'être masquées.

**P0-1 (CONFIRMÉ F.9)** — confirmation du bug `SubmissionsV2.tsx:48` (cf. C.4).

**P2-005 (revalidate)** — `replyToSubmissionAction` revalide `/contacts/messages` + `/contacts/messages/[id]` mais pas le sidebar badge unread. Le compteur visuel ne se met à jour qu'au prochain navigation full SSR.

### Phase G — Sécurité + RGPD

✅ **PASS**. 0 leak secret, 0 XSS, 0 SQL injection, CSRF mitigé (Server Actions natif + origin check Calendly), rate-limit complet.

**P2-006 (rawPayload retention)** — `CalendlyEvent.rawPayload` peut contenir PII (email, nom, téléphone) selon ce que Calendly émet. ADR 0030 documente la limitation mais aucune **policy de purge** (TTL 24 mois recommandé RGPD article 5-1-e).

**P2-007 (DPA register)** — ADR 0030 non encore enregistré dans `docs/DPA-REGISTER.md` (si ce fichier existe). Administratif post-merge.

### Phase H — Web Vitals

✅ **PASS**. /appel +1 KB gz (CalendlyEventCapture listener passif useEffect), admin Server Components dominants, ReplyComposer/RetryFailedReplyButton client-side ADMIN-ONLY (0 KB côté public). Indexes Prisma pertinents et alignés avec les filtres.

**P1-1 (rappel)** : badge unread query non cachée — finding partagé avec C.3.

### Phase I — Tests verts

✅ **PASS complet** :

- `pnpm typecheck` : 0 erreur
- `pnpm vitest run` : **1952 passed | 7 skipped (1959 total)** — **+17 vs baseline 1935/1942**
- `pnpm lint` : 0 erreur (13 warnings non-bloquants)
- `pnpm anti-siren:check` : vert
- `pnpm anti-hex:check` : vert
- `pnpm use-client:check` : vert

39 nouveaux tests ajoutés : format (9) + routing (6) + notify (7) + reply-actions (11) + calendly route (6).

---

## Bugs P0 (bloquants prod) — **2**

### P0-1 : Navigation cassée listing → détail (double redirect)

- **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx:48`
- **Symptôme** : Quand `SubmissionsV2` est rendu depuis `/contacts/messages`, le `detailHref` des lignes pointe vers `/submissions/[id]` (legacy hardcode) → cliquer fait un 308 redirect vers `/contacts/messages/[id]`. 2 hops réseau au lieu d'1, latence UX dégradée, devtools pollués.
- **Reproduction** : Login admin → `/fr/admin-dev-x7k2n9/contacts/messages` → cliquer sur une ligne → observer Network tab : 2 requêtes (308 + 200).
- **Fix proposé** : Ajouter un prop `basePath: string` à `SubmissionsV2` (defaulting à `${adminPrefix}/submissions` pour rétrocompat), passer `${adminPrefix}/contacts/messages` depuis la page parente `/contacts/messages/page.tsx`.

### P0-2 : Submissions archivées visibles dans l'inbox par défaut

- **Fichier** : `src/features/admin-submissions/actions.ts:78-144` (`listSubmissionsAction`)
- **Symptôme** : Le `where` Prisma ne filtre **pas** `archivedAt: null`. Les soumissions archivées polluent l'inbox principale.
- **Reproduction** : Archiver une submission via `archiveSubmissionAction` → recharger `/contacts/messages` → la submission archivée est toujours visible avec status `archived` (au lieu d'être masquée par défaut).
- **Fix proposé** : Ajouter dans le schema Zod `listSubmissionsSchema` un champ `includeArchived: z.boolean().default(false)`, puis dans le where : `archivedAt: parsed.includeArchived ? undefined : null`. Front : checkbox « Inclure archivés » dans `SubmissionFilters.tsx` (ou simple link toggle).

---

## Bugs P1 (importants mais non-bloquants) — **7**

### P1-1 : Badge sidebar unread non caché → N+1 DB sur navigation admin

- **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:135`
- **Fix** : Wrap `prisma.submission.count(...)` dans `unstable_cache(...)` avec `revalidate: 30` et tag `submissions-unread`. Invalider via `revalidateTag` dans `replyToSubmissionAction`, `archive`, `markNeedsAttention`.

### P1-2 : Badges & filtres reply-status absents du listing

- **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx` + `src/features/admin-submissions/actions.ts:122-133`
- **Fix** : (a) ajouter `replyCount`, `firstRepliedAt`, `lastRepliedAt`, `needsAttention`, `archivedAt` au `select` Prisma de `listSubmissionsAction`. (b) ajouter colonne « Statut réponse » dans `SubmissionsV2` avec badges colorés selon état. (c) ajouter filtre « Statut réponse » dans `SubmissionFilters.tsx`.

### P1-3 : Preview markdown absent dans ReplyComposer

- **Fichier** : `src/components/admin/contacts/ReplyComposer.tsx`
- **Fix** : Layout 2 colonnes — textarea à gauche, preview rendue à droite via fonction qui simule le parser markdown du template `submission-reply.tsx`. Refresh on blur ou debounced 300ms.

### P1-4 : Champ `location` manquant dans CalendlyEvent (si volontaire, documenter)

- **Fichier** : `prisma/schema.prisma` + migration
- **Fix** : Ajouter `location String? @db.VarChar(255)` (additif). Documenter dans ADR 0030 si volontaire.

### P1-5 : UTM/referrer non extraits sur /appel

- **Fichier** : `src/app/[locale]/appel/page.tsx`
- **Fix** : Récupérer `searchParams` (utm_source/campaign/medium) + `headers().get("referer")` côté Server Component, les passer au `trackingContext` du `<CalendlyEventCapture>`.

### P1-6 : Détail Calendly `[id]/page.tsx` absent + ajout manuel

- **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/contacts/calendly/[id]/page.tsx` (à créer) + `createManualCalendlyEventAction` (à créer)
- **Fix** : Page détail avec édition inline `inviteeName/Email/Phone/startTime`, JSON viewer `rawPayload`, bouton « Lier à Submission », bouton « Marquer canceled/completed/no_show ». Server action `createManualCalendlyEventAction` + modal de création depuis le listing.

### P1-7 : Tests manquants (AdminTabs + e2e + ReplyComposer)

- **Fichiers** : `src/components/admin/__tests__/AdminTabs.test.tsx`, `e2e/admin-contacts-tabs.spec.ts`, `e2e/admin-reply-submission.spec.ts`, `src/components/admin/contacts/__tests__/ReplyComposer.test.tsx`
- **Fix** : Ajouter les tests manquants. Couverture cible : composant admin pivot + 2 flows E2E critiques.

---

## Risques P2 (nice-to-fix) — **7**

| ID     | Domaine | Description                                                                   | Effort       |
| ------ | ------- | ----------------------------------------------------------------------------- | ------------ |
| P2-001 | Notif   | Channel Telegram sans retry exponentiel (V1 fire-and-forget)                  | 1 h          |
| P2-002 | Doc     | `index.ts:3` cite ADR 0027 au lieu de 0029 (renumérotation)                   | 2 min        |
| P2-003 | Tests   | `ReplyHistory.test.tsx` absent                                                | 30 min       |
| P2-004 | Tests   | `CalendlyEventCapture.test.tsx` absent                                        | 30 min       |
| P2-005 | UX      | `replyToSubmissionAction` ne revalide pas le badge sidebar unread (cache 30s) | 5 min        |
| P2-006 | RGPD    | `CalendlyEvent.rawPayload` sans policy de purge TTL 24 mois                   | 1 h (cron)   |
| P2-007 | RGPD    | DPA register non mis à jour pour ADR 0030                                     | 15 min admin |

---

## Croisements problématiques (Phase F)

- **F.4** : Cycle archive cassé (P0-2 ci-dessus)
- **F.9** : Navigation listing→détail double-redirect (P0-1 ci-dessus)
- **F.2** : Cycle reply OK mais sidebar badge ne se rafraîchit pas immédiatement après `replyToSubmissionAction` (cache 30s — P2-005)

Tous les autres croisements (F.1, F.3, F.5, F.6, F.7, F.8) sont **clean**.

---

## Verdict & recommandations

🟡 **GO CONDITIONNEL**

Le sprint est **techniquement solide** (architecture saine, sécurité OK, tests verts, migration additive sûre) mais **2 P0 fix triviaux** bloquent une UX correcte de l'inbox :

1. ✅ **GO PROD direct possible** si Will accepte :
   - Le double-redirect sur clic ligne (latence +1 hop, devtools confus mais fonctionnel)
   - Les submissions archivées visibles dans l'inbox principale (annulable manuellement via filtre futur)

2. ⚠️ **Recommandé : 25 min de fix P0 avant merge**, puis merge → GO PROD full :
   - P0-1 : ajouter `basePath` prop à `SubmissionsV2` (15 min)
   - P0-2 : filtrer `archivedAt: null` par défaut + Zod `includeArchived` (10 min)

3. 📋 **Sprint+1 court (~6 h)** pour les P1 P1-2 (badges listing) + P1-3 (preview) + P1-1 (cache badge). Le reste des P1/P2 peut attendre.

---

## Détails techniques annexes

**Stats commits** :

- 8 commits sprint (16c511b2 → 82a7bb6e) + 1 commit Manon préservé (2b84b72a)
- 38 fichiers modifiés/créés
- +4 010 / -210 LOC net

**Migration Prisma** :

- 1 fichier `20260526220000_add_submission_replies_and_calendly_events/migration.sql`
- 143 LOC, additive 100%, idempotente
- 5 cols ajoutées à `submissions` (DEFAULT)
- 2 tables créées (`submission_replies`, `calendly_events`)
- 3 enums créés (`submission_reply_status`, `calendly_event_status`, `calendly_event_source`)
- 2 FK + 11 index

**Conv parallèles détectées** :

- Manon (`contact@axion-ia.com`) a committé `2b84b72a` directement sur main avant le sprint (WIP `/appel` hero compact). Préservé dans ma branche, pas de conflit anticipé au merge.

---

> **Auditeur** : Claude Opus 4.7 (1M context) — mode autopilot strict, 9 sub-agents Explore parallèles
> **Durée audit** : ~10 min de wall-clock (sub-agents en parallèle)
> **Fichier source** : `axionia/_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/AUDIT-PROMPT.md`
