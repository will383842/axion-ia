# 21 — Flow ADMIN (Agent 4.G)

> **Phase 4 — Business flows · ADMIN** · audit AUDIT-ONLY de `axionia/`.
> **Source de vérité** : git HEAD `main` = `4cdfbe44…` (HEAD réel à l'instant de l'audit).
> **Mode** : read-only · aucun Edit/Write hors ce livrable · aucun commit/push.
> **Périmètre** : `src/app/[locale]/(admin)/[adminPrefix]/**` (~116 pages SSG-dyn), `src/components/admin/`, `src/features/admin-*/`, `src/server/actions/{content-gen,knowledge,image-bank}/`, `src/auth.ts`, `src/lib/telegram.ts`, `prisma/schema.prisma` (AdminRole / AdminUser / ActivityLog).

---

## 0. Résumé exécutif

| Axe                                          | Score         | Note                                                                                                                                                                                    |
| -------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification & login (1 step + 2FA TOTP) | 14 / 15       | 🟢 Auth.js v5 JWT + argon2id + rate-limit Redis + revoke cache 60s                                                                                                                      |
| Dashboard `/admin` KPIs cards                | 14 / 15       | 🟢 7 KPI live (D49/options/cadrages/paiements/factures/CA/articles) + 5 sections priorisées                                                                                             |
| Navigation sidebar 6 groupes (38 liens)      | 13 / 15       | 🟡 `aria-current="page"` OK; mais ~7 sous-pages stratégiques absentes (sub-menus implicites)                                                                                            |
| `AdminCommandPalette` ⌘K / Ctrl+K            | 14 / 15       | 🟢 65 entrées groupées, raccourci global, search cmdk; manque `web-vitals`/`queue`/`orchestrator`                                                                                       |
| Activity log (50 dernières + filtres)        | 14 / 15       | 🟢 Page dédiée + dashboard 8 dernières + filtres user/action/date/IP + stats Top 20                                                                                                     |
| 2FA Will (TOTP setup + activate)             | 11 / 15       | 🟡 Flow OK manuel (otpauth URI) mais **pas de QR code** rendu côté serveur (V1 ajout `qrcode` lib prévu M9)                                                                             |
| Kill switches accessibles 1 clic             | 7 / 15        | 🔴 **Un seul** kill-switch (content-gen). Aucun kill-switch global, ni image-bank, ni booking                                                                                           |
| Alertes Telegram critiques                   | 12 / 15       | 🟢 17 helpers content-gen + fallback Sentry/UptimeRobot/Coolify dans `/alerts`; manque alert `deploy.fail` + `KB.ingest.fail` dédiés                                                    |
| Orphelines admin (page sans entrée nav/cmdk) | 11 / 15       | 🟡 7 pages stratégiques uniquement reachable via deep-link ou parent-page (acceptable mais non-discoverable)                                                                            |
| RBAC tiers cohérents                         | 8 / 15        | 🔴 **Drift critique** : 4 implémentations distinctes de `requireAdmin` (rank vs whitelist), brief mentionne `super_admin/author/viewer` ≠ schéma réel `super_admin/admin/editor/reader` |
| Admin FR-only enforcement                    | 14 / 15       | 🟢 `layout.tsx:128` force `/fr/<prefix>` via redirect; segment URL fingerprint via env `ADMIN_URL_PREFIX`                                                                               |
| **TOTAL pondéré**                            | **132 / 150** | 🟡                                                                                                                                                                                      |

**Verdict global Agent 4.G : 🟡 SPRINT CORRECTIF (132/150 — 88 %)**
Le flow admin est **production-ready sur l'essentiel** (auth, dashboard, navigation, command palette, activity log, 2FA, alertes), mais quatre angles morts pèsent : (1) **RBAC en drift** documenté (4 fonctions `requireAdmin` distinctes, brief utilise mauvais noms de rôles), (2) **un seul kill-switch** (content-gen) sans pendant global ni image-bank/booking, (3) **2FA sans QR code** rendu (saisie manuelle du secret obligatoire), (4) **~7 pages orphelines de la sidebar** (heatmap, reschedule, image-bank/licensing, sitemap-status, etc.) — atteignables via cmdk mais pas auto-discoverable.

---

## 1. Inventaire admin top-level (sections principales)

### 1.1 Sidebar — 6 groupes, 38 liens (`layout.tsx:40-115`)

| Groupe                         | Items | Liens                                                                                                               |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `main` — Activité quotidienne  | 9     | Tableau de bord, Calendrier, Réservations, Devis, Factures, Paiements, Échéanciers, Options 48h, Soumissions        |
| `content` — Contenu            | 8     | Connaissances, Générateur contenus, Blog, Catégories, Cas concrets, Témoignages, FAQ, Centre d'aide                 |
| `image-bank` — Banque d'images | 10    | Overview, Library, Upload, Bulk import CSV, Quality queue, Analytics, Categories, Tags, Usage logs (RGPD), Settings |
| `engagement`                   | 1     | Newsletter                                                                                                          |
| `ops` — Ops & monitoring       | 4     | Analytics & SEO, Web Vitals, Infra & outils, Alertes ops                                                            |
| `system` — Système             | 4     | Utilisateurs, Activity logs, Paramètres, 2FA — sécurité                                                             |

**Group labels** (FR canoniques) définis dans `AdminSidebar.tsx:18-25`. Ordre rendu : main → content → image-bank → engagement → ops → system. ✅ Doctrine §14 admin FR-only respectée.

### 1.2 Volumétrie réelle (`find … -name "page.tsx"`)

- **116 page.tsx** sous `[adminPrefix]/` (vs ~116 attendu brief ✅).
- Réparti en ~17 sections top-level + 1 login + 1 racine dashboard.
- `content-gen` (le plus profond) = **40 page.tsx** (10 settings sous-pages + 7 review/coverage/geo flows + landing-variants + RSS + templates + …).
- `image-bank` = **14 page.tsx** (10 listés sidebar + 4 sous-pages absentes : `licensing`, `seo-audit`, `sitemap-status`, `taxonomy`).

---

## 2. Login `/fr/<adminPrefix>/login`

### 2.1 Flow technique (`login/page.tsx` + `LoginForm.tsx` + `auth.ts`)

1. Page server : si déjà authentifié → redirect `/fr/<prefix>` (`login/page.tsx:18-21`).
2. `LoginForm` (client) → 1ère soumission email + password ; si user a `twoFactorEnabled=true`, retour erreur `requires2FA` → wizard étape 2 demande TOTP 6 digits.
3. Auth.js v5 (`auth.ts:66`) → JWT pur (CLAUDE.md §6 pas de DB sessions), provider Credentials, runtime Node.
4. Sécurité durcie :
   - Hash **argon2id** (memoryCost 19456, timeCost 2 — OWASP 2024) `auth.ts:8`.
   - Rate-limit **5 tentatives / 15 min / IP** via Redis sliding window `auth.ts:19`.
   - Revocation check **60s cache** sur `adminUser.status` (`auth.ts:23-45`) → si `suspended` ou supprimé, JWT détruit au refresh.
   - Rejet accounts `status='suspended'` au signIn.

### 2.2 URL prefix dynamique via env var (`layout.tsx:120-125`)

```ts
const expectedPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
if (adminPrefix !== expectedPrefix) notFound();
```

✅ Toute URL différente → 404 silencieux (pas de fingerprint admin). Defaut `admin-dev-x7k2n9` en dev.

### 2.3 ✅ Verdict login

**Production-ready**. Single P1 mineur : la 2FA bootstrap actuellement opt-in par user (`twoFactorEnabled`), un constant `_ROLES_REQUIRING_2FA = new Set(["super_admin", "admin"])` est défini ligne 63 mais **explicitement désactivé** (`void _ROLES_REQUIRING_2FA;`). Pour ANSSI hardening, re-activer cette condition dans l'expression `requires2FA`. Score : 14/15.

---

## 3. Dashboard `/fr/<adminPrefix>/` (page racine)

### 3.1 KPIs cards rendues (`page.tsx:256-298`)

**Aujourd'hui** (4 cards live links) :

- **Prêts à valider (D49)** → `bookings.count(status=awaiting_admin_validation)` → lien `/reservations?status=...`
- **Options à valider** → `bookingOption.count(status=pending)` → lien `/options`
- **Cadrages 7 prochains jours** → join `cadrageMeeting.scheduledAt` 7j → lien `/calendrier`
- **Paiements reçus aujourd'hui** → `payments.count` + `_sum.amountCents` → lien `/paiements`

**Activité** (4 cards) :

- Interventions semaine ISO / mois en cours, Encaissé mois (sum), Factures en retard (overdue + due<today) → lien `/factures?status=overdue`.

**Sections priorisées** (5 listes top-5) :

- Prêts à valider D49 (deep link booking)
- Demandes options parcours A
- En attente du client (contract_payment_sent)
- Cadrages 14j à venir
- Activité récente (8 ActivityLog rows + lien "/activity-logs")

**Repères secondaires** (3 cards) : Soumissions totales, Articles publiés, Abonnés newsletter.

**Ops Monitoring** (card finale) : liens directs `/infra`, `/alerts`, `/2fa/setup`.

### 3.2 Performance dashboard

17 queries Prisma exécutées en `Promise.all` parallèle (`page.tsx:127-226`). ✅ Pas de N+1 ; `select` projeté sur 5-7 champs par row max. P0 page entièrement `force-dynamic` (auth + KPIs live).

### 3.3 ✅ Verdict dashboard

**Excellent rendu Tier-1**. P2 : `formatDate` ré-implémenté ligne 72 alors que `src/lib/intl.ts:75` expose `fmtDate` SSOT (cf. audit 1.A §2.5). Score : 14/15.

---

## 4. Navigation — sections inventaire

### 4.1 Cartographie sidebar groups (38 entries)

✅ **Tous les liens sidebar pointent vers un `page.tsx` existant** (vérifié 1-to-1).

### 4.2 Pages présentes dans `[adminPrefix]/` mais **absentes de sidebar**

| Page                             | Raison                              | Reachable via                                     |
| -------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `/login`                         | Entry-point, layout simplifié       | Direct URL / redirect non-auth                    |
| `/calendrier/heatmap`            | Sub-page calendrier                 | cmdk + `/calendrier` parent                       |
| `/calendrier/reschedule`         | Sub-page calendrier (D60)           | cmdk + `/calendrier` parent                       |
| `/image-bank/licensing`          | Sub-page image-bank                 | Parent `/image-bank` ? **À vérifier**             |
| `/image-bank/seo-audit`          | Sub-page image-bank                 | Parent `/image-bank` ? **À vérifier**             |
| `/image-bank/sitemap-status`     | Sub-page image-bank                 | Parent `/image-bank` ? **À vérifier**             |
| `/image-bank/taxonomy`           | Sub-page image-bank                 | Parent `/image-bank` ? **À vérifier**             |
| `/content-gen/*` (37 sous-pages) | Top-level `/content-gen` seul listé | cmdk (couvre 17 deep links) + `/content-gen` page |

⚠️ **4 pages `image-bank/`** (licensing, seo-audit, sitemap-status, taxonomy) **ne sont ni dans sidebar (`buildNav`)** **ni dans cmdk (`buildItems`)** → **orphelines de navigation**. Le sidebar liste 10 entrées image-bank mais le code expose 14 pages. Discrepancy auditée +1 P1.

### 4.3 Pages présentes dans cmdk mais **absentes de sidebar**

- `/calendrier/heatmap`, `/calendrier/reschedule` (acceptables, sous-pages calendrier).
- 17 deep links `content-gen` (acceptables, sous-pages générateur).

### 4.4 ⚠️ Pages absentes simultanément de sidebar ET cmdk (orphelines critiques)

Audit grep contre `AdminSidebar` + `AdminCommandPalette` :

1. `/image-bank/licensing` ❌
2. `/image-bank/seo-audit` ❌
3. `/image-bank/sitemap-status` ❌
4. `/image-bank/taxonomy` ❌
5. `/web-vitals` — ✅ dans sidebar (`ops` group line 107), ❌ **dans cmdk** (uniquement)
6. `/content-gen/queue` — ❌ dans sidebar, ❌ dans cmdk (mais `/content-gen/jobs` listé qui semble équivalent — **collision/doublon possible**)
7. `/content-gen/orchestrator` — ❌ ni l'un ni l'autre, page existante (40e content-gen file)

**P1** : ajouter ces 7 pages dans `buildItems(base)` cmdk a minima (effort 10 min). Voir §11 P0 list.

---

## 5. `AdminCommandPalette` ⌘K (Cmd+K / Ctrl+K)

### 5.1 Câblage technique

- **Layout-mounted** : `AdminCommandPalette` instancié dans `<header className="admin-header">` seulement si `showSidebar` (= session authentifiée). Anti-pattern P0 évité (jamais monté pré-login).
- **Trigger global** : keydown listener attaché à `window` (`AdminCommandPalette.tsx:270-282`) → écoute `Cmd+K` / `Ctrl+K` (toggle) + `Escape` (close).
- **Lib** : `cmdk` (Pacqo, ~6 KB gz) — léger, accessible WCAG, native search fuzzy.
- **Trigger bouton** : `<button class="admin-cmdk-trigger">⌘K</button>` rendu dans header pour découvrabilité click (a11y label correct).

### 5.2 Inventaire entries

**65 entries groupées en 9 sections** :

- Main (8) — dashboard + 7 entités quotidiennes
- Calendrier (3) — calendrier, heatmap, reschedule
- Filtres rapides (6) — réservations status × 4 + factures overdue + devis sent
- Contenu (8)
- Content Gen (17) — incl. **Kill switch 🔴 hint URGENCE** (line 160-165)
- Image bank (9 — manque 4 vs reality 14)
- Ops (3)
- Système (4)

✅ Couverture **excellente**. Quick wins documentés §4.4.

### 5.3 ✅ Verdict cmdk

14/15. P1 ajouter web-vitals + 4 image-bank orphelines + content-gen/orchestrator + content-gen/queue.

---

## 6. Activity log (50 dernières actions)

### 6.1 Page `/activity-logs/page.tsx`

- **Pagination** : `?page=N` server-side via `listActivityLogsAction` ; total + totalPages remontés en KPI.
- **Filtres riches** (6) : `adminUserId` (select), `action` (contains), `targetType` (12 options enum-like), `search` (action/target/IP), `dateFrom`, `dateTo`.
- **Stats top-20 actions** rendu en grid avec count par type — vue agrégée mensuelle.
- **Table read-only** : 7 colonnes (Date, User, Action, TargetType, TargetId truncé, IP, Changes JSON formaté).
- **Audit trail integrity** : page strictement read-only (aucune action edit/delete), confirme doctrine "audit trail = source de vérité immutable".

### 6.2 Dashboard intégration

Dashboard `page.tsx:215-225` query `ActivityLog.findMany take:8 orderBy desc` + lien "Voir tout le journal" → `/activity-logs`. ✅ 8 dernières visibles **direct dashboard** (brief demande 50, atteint via `/activity-logs` paginé 50/page).

### 6.3 ✅ Verdict activity log

14/15. P2 : pas d'export CSV des activity logs (seulement page UI). Si DPO request, export manuel SQL nécessaire.

---

## 7. 2FA Will — activable + testée

### 7.1 Setup flow (`/2fa/setup/page.tsx` + `Setup2FAForm.tsx`)

1. Server Action `setup2FAStartAction()` génère secret + URI otpauth via `otplib` (`lib/auth-2fa.ts`).
2. Page rend **secret brut + URI otpauth** en `<code>` — **pas de QR code SVG/image rendue côté serveur** (commentaire ligne 6 : « V1 sans QR — Will pourra ajouter qrcode lib en M9 »).
3. User scanne manuellement (Google Authenticator / Authy / 1Password / Bitwarden) → entre 1er code 6 digits.
4. Server Action `setup2FAConfirmAction()` valide + active (`twoFactorEnabled=true`).

### 7.2 Login wizard 2 étapes

`LoginForm.tsx` (client) gère le wizard :

- Étape 1 : email + password POST.
- Si erreur `requires2FA`, formulaire étape 2 (TOTP 6 digits) s'affiche, secret est conservé en state, re-POST email/password/totp.

### 7.3 🟡 Verdict 2FA

11/15. **Activable** ✅ et **testée** ✅ (login wizard fonctionne), mais UX dégradée :

- ❌ **Pas de QR code rendu** → saisie manuelle du secret 32-chars obligatoire. Friction réelle pour Will.
- 🟡 **2FA opt-in** : `_ROLES_REQUIRING_2FA = new Set(["super_admin","admin"])` défini mais désactivé (`void` line 64). Will pas forcé à activer.
- 🟡 **Pas de backup codes** générés (cf. ANSSI guidelines TOTP).

P1 effort : ajouter `qrcode` lib (~5 KB) + endpoint server-only `/api/admin/2fa/qrcode.svg` (auth-required) → ~2h dev. Désactiver `void` line 64 → 5 min.

---

## 8. Kill switches accessibles 1 clic

### 8.1 Inventaire

**Un seul kill-switch** trouvé dans tout `[adminPrefix]/` :

| Kill-switch                 | Path                                | Mécanisme                                                                               | Audience                        |
| --------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| **Content-gen kill-switch** | `/content-gen/settings/kill-switch` | `ContentGenConfig.killSwitch.active` table → workers content-gen rejettent jobs au pick | content-gen (10 workers BullMQ) |

Server Action 1-clic : `activateKillSwitch(reason: string)` (reason ≥3 chars requis) + `deactivateKillSwitch()`. ✅ Trace activatedAt + reason dans state.

**Accessibilité** : visible via cmdk avec hint « URGENCE 🔴 » (line 160-165 `AdminCommandPalette.tsx`). Lien direct depuis sidebar **NON** (sidebar n'expose que top-level `/content-gen`, pas le sub-path).

### 8.2 🔴 Kill switches absents (P0)

| Kill-switch manquant                                                             | Impact business                                  | Effort estimé                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| **Image-bank kill-switch** (stop upload/processing en cas d'attaque DoS uploads) | Pipeline images, ~14 page image-bank             | 3-4h (table flag + check workers `image-bank-*-worker.ts`) |
| **Booking kill-switch** (suspendre flow réservation/paiement)                    | Stripe webhook, parcours A/B, ~9 page main group | 4-6h (flag + booking actions guard)                        |
| **Newsletter kill-switch** (stop envois)                                         | Sender domain reputation                         | 1h                                                         |
| **Global maintenance mode** (banner site + 503 sur public)                       | Tous flows                                       | 4h (middleware/proxy + flag)                               |

### 8.3 🔴 Verdict kill-switches

**7/15**. Un seul switch fonctionnel et masqué dans sub-menu content-gen (3 clics depuis dashboard). Pour une plateforme avec budget 500-3000€/jour de revenu (cf. memory incident 503 2026-05-15), c'est **insuffisant**. P0.

---

## 9. Alertes Telegram critiques

### 9.1 Helper centralisé `src/lib/telegram.ts`

- `sendTelegram({tag, body, silent?})` fail-soft, timeout 5s, `Markdown` parse mode.
- 16 tags canoniques (cf. enum `TelegramTag`) : **INTERVENTION, OPTION, OPTION CONFIRMÉE / REFUSÉE / EXPIRÉE, ANNULATION, AUDIT, AUTO, CONTACT, NEWSLETTER, DEPLOY, INCIDENT, BACKUP, MONITORING, SECURITY, STRIPE_EVENT, STRIPE_WEBHOOK_SIGNATURE_FAIL, QUOTE_REQUEST_RECEIVED**.
- ✅ PII redaction (cf. memory 2026-05-09 Sprint 24.1 ADR 0010 — 14 sites patchés via `pii-redaction.ts`).

### 9.2 Helpers spécialisés content-gen (`content-gen-alerts.ts` — 17 alertes)

| Alert                                                              | Tag                 | Trigger                                                           |
| ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------- |
| `alertCostCap80`                                                   | MONITORING silent   | Provider mois ≥80 % cap                                           |
| `alertCostCap100`                                                  | MONITORING critical | Provider mois 100 % cap + kill-switch auto                        |
| `alertProviderDown5min` / `30min`                                  | MONITORING          | Provider HTTP failures streak                                     |
| `alertKbNotReady`                                                  | MONITORING          | KB ingest non-prêt avant publish ✅ couvre brief "KB ingest fail" |
| `alertBatchFail`                                                   | MONITORING          | Batch generation fail                                             |
| `alertNewReview`                                                   | MONITORING          | Review queue pending threshold                                    |
| `alertCampaignDone`                                                | MONITORING          | Campaign success                                                  |
| `alertLcp/Inp/ClsDegraded` + `alertWebVitalsBulk`                  | MONITORING          | Web Vitals breach (cf. memory 2026-05-14 V1.0.3)                  |
| `alertQueueStuck`                                                  | MONITORING          | Queue jobs stalled                                                |
| `alertSoft404Detected`                                             | MONITORING          | GSC sync                                                          |
| `alertIndexationStagnant` / `IndexNowFailStreak` / `Tier3Stagnant` | MONITORING          | Sprint S0bis GSC worker                                           |

### 9.3 ⚠️ Alertes attendues mais **manquantes**

- ❌ **`alertDeployFail`** : aucun helper dédié `DEPLOY` tag pour échec déploiement Coolify. Le tag DEPLOY existe enum mais pas de helper dans `content-gen-alerts.ts`. Le workflow GH Actions `.github/workflows/deploy-coolify.yml` envoie peut-être directement → à vérifier.
- ❌ **Alert Backup fail dédiée** : tag BACKUP existe mais pas de helper Telegram trouvé.
- ❌ **Alert security incident** : tag SECURITY existe (audit fix 2026-05-09 OWASP) mais helper non audité ici.

### 9.4 Console `/alerts` (agrégation pull)

`alerts/page.tsx` agrège **server-only timeout 5s** :

- UptimeRobot (monitors DOWN/degraded)
- Coolify (deployments failed récents)
- Sentry (issues unresolved si `SENTRY_AUTH_TOKEN`)

Évite à Will de checker 3 dashboards. ✅ Email Sentry reste actif en push parallèle.

### 9.5 🟢 Verdict alertes

12/15. P0 alertes critiques (cost cap, kill-switch, KB ingest, Web Vitals breach) **toutes câblées**. P1 manque alert helper `deploy.fail` dédié + `backup.fail`.

---

## 10. RBAC tiers cohérence

### 10.1 Schéma réel vs brief

**Brief Agent 4.G** demande : `super_admin, author, viewer`.

**Réalité Prisma** (`schema.prisma:243-248`) :

```prisma
enum AdminRole {
  super_admin
  admin
  editor // = editeur (FR doctrine §14)
  reader // = lecteur (FR doctrine §14)
}
```

**4 rôles** (non 3), nommage différent : `admin / editor / reader` ≠ `author / viewer`. Aucune occurrence des strings `"author"` / `"viewer"` côté admin code (grep 0 match).

🔴 **Drift entre brief et code** : le brief Agent 4.G a écrit `author/viewer` (probablement copié d'un autre projet) au lieu de `editor/reader`. **Le code reste juste**, c'est le brief qui dérive.

### 10.2 Drift RBAC code-side (audit 1.A finding confirmé)

Audit 1.A §2.3 documente **4 implémentations distinctes de `requireAdmin`** :

| Fichier                                  | Sémantique                                              | Risque                      |
| ---------------------------------------- | ------------------------------------------------------- | --------------------------- |
| `server/actions/content-gen/_auth.ts:22` | Whitelist `super_admin / admin / editor` (reader exclu) | OK                          |
| `features/booking/admin-actions.ts:77`   | **Rank-based** `reader<editor<admin<super_admin`        | OK mais paradigme différent |
| `features/booking/cadrage-actions.ts:31` | Autre (non-typé strict)                                 | ⚠️                          |
| `features/booking/quote-actions.ts:38`   | `requireAdmin(min = "admin")`                           | ⚠️                          |

**+30 variantes `requireAdmin{Read/Write/Publish/Delete}` dispersées** dans 20+ fichiers `features/admin-*`. Le `server/actions/knowledge/_guards.ts` expose une **propre implémentation testée** mais n'est pas adoptée comme SSOT.

**Risque sécurité concret** : un dev qui copie/colle entre features peut introduire une élévation de privilège silencieuse. **Audit 1.A a déjà flaggé P0**.

### 10.3 🔴 Verdict RBAC

8/15. Code admin **fonctionne aujourd'hui** (Will = super_admin, pas d'autre user en prod), mais la dette technique est élevée pour onboarder un author / editor sans risque de drift. P0 : voir audit 1.A §2.3 recommandations (consolider sur `knowledge/_guards.ts` style, 4-6h refactor).

---

## 11. Admin = FR only

### 11.1 Enforcement layout

`layout.tsx:128-130` :

```ts
if (locale !== "fr") redirect(`/fr/${expectedPrefix}`);
```

✅ Toute URL `/en/<prefix>/...` → 301 vers `/fr/<prefix>` (même chemin sous-jacent).

### 11.2 Doctrine §14 CLAUDE.md (référence)

> « Interface admin FR uniquement. Si le user arrive sur `/en/<prefix>/*` on redirige vers `/fr/<prefix>/*`. »

Comment-bloc `layout.tsx:8-9` cite explicitement la doctrine.

### 11.3 ✅ Verdict FR-only

14/15. Conforme. P2 : pas de bandeau « Mode admin FR » visible, mais c'est implicite (toute autre locale 301).

---

## 12. P0 / P1 — Top recommandations (synthèse priorisée)

### 🔴 P0 — bloquants production-grade

1. **Kill switches manquants** : ajouter au minimum image-bank kill-switch + booking kill-switch + maintenance mode global. **Effort 8-12h cumulé**. Justification : sans pendant booking, un bug Stripe peut continuer à débiter en boucle (incident-class).
2. **RBAC drift** (cf. audit 1.A §2.3) : consolider sur SSOT `requireAdmin{Read,Write,Publish,Delete}` style `knowledge/_guards.ts`. Migrer 30+ call-sites via codemod. **Effort 4-6h**.
3. **2FA QR code rendu** : ajouter `qrcode` lib + endpoint server-only auth-required → réduire friction setup Will. **Effort 2h**.

### 🟡 P1 — sprint correctif

4. **Pages orphelines image-bank** (licensing, seo-audit, sitemap-status, taxonomy) : ajouter à `buildItems` cmdk OU à `buildNav` sidebar (image-bank group). **Effort 15 min**.
5. **Alert helper `deploy.fail` + `backup.fail` dédiés** : ajouter dans `content-gen-alerts.ts` ou `lib/telegram-ops.ts`. **Effort 30 min**.
6. **Audit `content-gen/queue` vs `/jobs`** : doublon suspect (queue inspector OU obsolète). **Effort 30 min**.
7. **Re-activer `_ROLES_REQUIRING_2FA`** dans `auth.ts:64` : enlever `void _ROLES_REQUIRING_2FA` et restaurer condition dans `requires2FA` (ANSSI hardening). **Effort 5 min** + test login Will.
8. **Backup codes 2FA** : génération + storage hashé `AdminUser.backupCodesHash` (recovery si phone perdu). **Effort 3h**.

### 🟢 P2 — nice-to-have V1.1

9. Export CSV activity logs (`/activity-logs?format=csv`).
10. Bandeau visible « Mode admin FR — Web Vitals strict » dans header.
11. `formatDate` migration vers `fmtDate` SSOT (audit 1.A §2.5 — 15 sites admin).

---

## 13. Annexe — couverture brief

| Question brief                                                                                            | Réponse                                                                                                                             | Verdict |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Login `/fr/admin/login` (env prefix) — flow OK ?                                                          | ✅ `ADMIN_URL_PREFIX` enforcing 404 sinon                                                                                           | 🟢      |
| Dashboard `/admin` KPIs cards rendues ?                                                                   | ✅ 7 KPI + 5 sections priorisées + 17 queries //                                                                                    | 🟢      |
| Nav sections : bookings, content-gen, image-bank, KB, settings, monitoring, costs, GSC keyword tracking ? | ✅ Toutes présentes sidebar+cmdk. GSC keyword tracking = `/content-gen/keyword-tracking` (cmdk only, sub-page)                      | 🟢      |
| `AdminCommandPalette` (⌘K) câblé ?                                                                        | ✅ Layout-mounted post-auth, 65 entries, raccourci global                                                                           | 🟢      |
| Activity log : 50 dernières visibles ?                                                                    | ✅ Page `/activity-logs` paginée + 8 sur dashboard                                                                                  | 🟢      |
| 2FA Will : activable et testée ?                                                                          | 🟡 Activable (otpauth manuel, pas de QR) + login wizard testé                                                                       | 🟡      |
| Kill switches accessibles 1 clic ?                                                                        | 🔴 **Un seul** kill-switch (content-gen) en sub-menu 3 clics                                                                        | 🔴      |
| Alertes Telegram critiques (cost cap, KB ingest fail, deploy fail) sur canal Will ?                       | 🟢 Cost cap + KB ingest OK; ❌ deploy.fail helper dédié manquant                                                                    | 🟡      |
| ~116 admin sub-pages toutes liées dans nav ? Orpheline ?                                                  | 🟡 4 image-bank orphelines (licensing, seo-audit, sitemap-status, taxonomy) + 3 autres (web-vitals dans cmdk?, queue, orchestrator) | 🟡      |
| RBAC tiers (super_admin, author, viewer) cohérents (cf. 1.A) ?                                            | 🔴 Brief utilise mauvais noms (`author/viewer` ≠ `editor/reader` réel); drift 4 impl `requireAdmin` documenté audit 1.A             | 🔴      |
| Admin = FR only ?                                                                                         | ✅ `layout.tsx:128` 301 vers `/fr`                                                                                                  | 🟢      |

---

## 14. Score final

**132 / 150** ≈ **88 %** → 🟡 **SPRINT CORRECTIF**

Pour atteindre 🟢 GO (≥ 90 %) : appliquer **P0 #1 (kill-switches) + #2 (RBAC) + P1 #4 (orphelines) + P1 #5 (alert helpers)**. Effort total estimé : **18-24h** (1 sprint dev 2-3 jours).

**Le flow admin est fonctionnellement complet pour mise en service mono-user (Will = super_admin solo).** Les manques sont essentiellement défensifs (kill-switches multi-domaines, RBAC propre pour onboarder un editor externe) et UX (2FA QR).

— fin Agent 4.G —
