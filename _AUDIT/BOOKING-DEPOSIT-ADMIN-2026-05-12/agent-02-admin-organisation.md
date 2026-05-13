# Agent 02 — Admin Console organisation (best practices 2026)

> **Audit AUDIT-ONLY** · `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` Agent 2.
> **HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742` · **Date** : 2026-05-12.
> Lecture seule. Aucune commande `git`, `pnpm`, ni écriture code applicatif.

---

## 1. Périmètre audité

### 1.1 Routes admin actuelles (17 sections + racine)

Source : layout `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:35-61` + Glob `(admin)/[adminPrefix]/**/page.tsx`.

| Slug                  | Page principale                                                | CRUD ? | Group layout |
| --------------------- | -------------------------------------------------------------- | ------ | ------------ |
| `/` (dashboard)       | `[adminPrefix]/page.tsx:25-110`                                | KPIs   | main         |
| `/login`              | `login/page.tsx`                                               | non    | (hors nav)   |
| `/2fa` + `/2fa/setup` | `2fa/page.tsx` + `2fa/setup/page.tsx`                          | non    | system       |
| `/calendrier`         | `calendrier/page.tsx:53-…`                                     | write  | main         |
| `/options`            | `options/page.tsx:43-…` + `options/[id]/page.tsx:25-…`         | write  | main         |
| `/submissions`        | `submissions/page.tsx:29-…` + `submissions/[id]/page.tsx:24-…` | write  | main         |
| `/blog`               | `blog/{page,new,[id]}.tsx`                                     | CRUD   | content      |
| `/categories`         | `categories/{page,new,[id]}.tsx`                               | CRUD   | content      |
| `/case-studies`       | `case-studies/{page,new,[id]}.tsx`                             | CRUD   | content      |
| `/testimonials`       | `testimonials/{page,new,[id]}.tsx`                             | CRUD   | content      |
| `/faq`                | `faq/{page,new,[id]}.tsx`                                      | CRUD   | content      |
| `/help`               | `help/{page,new,[id]}.tsx`                                     | CRUD   | content      |
| `/newsletter`         | `newsletter/page.tsx:24-…`                                     | write  | engagement   |
| `/infra`              | `infra/page.tsx:1-…` (read-only outils tiers, 14 cards)        | non    | ops          |
| `/alerts`             | `alerts/page.tsx:1-…` (UptimeRobot/Coolify/Sentry agrégés)     | non    | ops          |
| `/users`              | `users/{page,new,[id]}.tsx`                                    | CRUD   | system       |
| `/activity-logs`      | `activity-logs/page.tsx:18-…` (read-only audit trail)          | non    | system       |
| `/settings`           | `settings/{page,new,[key]}.tsx`                                | CRUD   | system       |

> 17 entrées nav + 1 dashboard racine = **18 nœuds de premier niveau**, 5 groupes (main · content · engagement · ops · system).

### 1.2 Helper et préfixe URL

- `src/lib/admin-path.ts:27-42` — `adminSegment()` lit `ADMIN_URL_PREFIX` runtime, fallback dev `admin-dev-x7k2n9` validé en prod via `src/env.ts` superRefine.
- Layout `layout.tsx:73-77` rejette 404 si `params.adminPrefix !== expectedPrefix` (anti-fingerprint).
- Layout force `locale === "fr"` (CLAUDE.md §14 admin FR-only) `layout.tsx:81-83`.

---

## 2. Constats positifs (≥ 3)

### 2.1 ✅ Architecture serveur-first cohérente

Chaque page admin lit la session via `auth()` + `redirect(adminPath("fr", "login"))` + `dynamic = "force-dynamic"`. Pattern uniforme observé sur `calendrier/page.tsx:55-57`, `options/page.tsx:43-…`, `users/page.tsx:28-29`, `newsletter/page.tsx:27-28`, `activity-logs/page.tsx:21-22`, `settings/page.tsx:14-16`. Zéro fuite RBAC, zéro mode client-only sur des actions sensibles.

### 2.2 ✅ Nav sidebar groupée + sémantique a11y baseline

`layout.tsx:106-127` rend une `<aside aria-label="Navigation admin">` avec 5 groupes étiquetés (`.admin-nav-group-label` `globals.css:634-641`). Chaque groupe a un libellé court mais explicite (`groupLabels` `layout.tsx:63-69` : « Activité quotidienne / Contenu / Engagement / Ops & monitoring / Système »). C'est conforme aux recommandations WCAG `landmark + heading` pour la navigation principale.

### 2.3 ✅ Empty states et pagination présents partout

Chaque liste rend une cellule `<td colSpan>` typée `.admin-table-empty` avec un message FR : `submissions/page.tsx:80-84` (« Aucune soumission trouvée. »), `options/page.tsx:99-103`, `users/page.tsx:137-142`, `settings/page.tsx:55-60`. Pagination uniforme via helper `buildPageUrl` (`submissions/page.tsx:135-146`) et `<nav className="admin-pagination" aria-label="Pagination">` (`submissions/page.tsx:115`). Cohérent avec les patterns Vercel/Stripe (cf. `02-BENCHMARKS-2026.md` §Vercel).

### 2.4 ✅ Indicateurs visuels d'urgence sur `/options`

`options/page.tsx:34-41` calcule une classe `admin-urgency-{critical|high|medium}` basée sur `expiresAt - now` (< 12h, < 24h, 24h+). Couleurs définies `globals.css:935-944`. Pattern « Doctolib morning brief » (`02-BENCHMARKS-2026.md` §Doctolib pro) appliqué sur le timer de vente des slots — c'est exactement le bon réflexe pour 1 admin solo qui scanne 50 lignes en 5 secondes.

### 2.5 ✅ Lien deep retour « ← Section » présent sur 18/18 pages détail

`submissions/[id]/page.tsx:36-38`, `options/[id]/page.tsx:40-42`, `users/[id]/page.tsx`, `case-studies/[id]/page.tsx`, etc. — 18 fichiers détectés avec `<a className="admin-link admin-back">← Section</a>`. C'est l'embryon d'un breadcrumb mais reste mono-segment (cf. P1 §3.4).

### 2.6 ✅ Dashboard racine déjà câblé sur 4 KPIs DB live

`[adminPrefix]/page.tsx:32-37` parallélise 4 `count()` Prisma (`pendingOptions`, `totalSubmissions`, `totalArticles`, `totalSubscribers`) en `Promise.all`. Base saine pour étendre vers le « Aujourd'hui » dashboard recommandé.

---

## 3. Constats négatifs · P0 / P1 / P2 / P3

### 3.1 🚨 P0 — Aucun mobile responsive sur l'admin (sidebar fixe 240 px)

- **Source** : `globals.css:616-630` `.admin-shell { grid-template-columns: 240px 1fr; min-height: calc(100vh - 64px); }` sans **aucune media-query** `max-width`. Grep `@media|max-width:` sur tout `globals.css` → 0 résultat pour l'admin (les seules `@media` sont `prefers-reduced-motion:392` + `min-width: 992px:288` site public).
- **Impact** : sur viewport mobile (< 768 px), la sidebar de 240 px occupe ~62 % de l'écran d'un iPhone SE et le `main` `max-width: 960px` (`globals.css:457`) déborde. Les tableaux `.admin-table` (`globals.css:806-829`) n'ont **aucun scroll horizontal** explicite ni `display: block; overflow-x: auto;` sur `.admin-table-wrapper` (`:802`) — testé visuellement impossible mais le wrapper ne déclare ni `overflow-x` ni `min-width`.
- **Critère prompt** : Cible perfection extrême §0.0 critère 8 « UX admin parfaite : … mobile-responsive ».
- **Gravité** : Will pilote en déplacement (taxi, train, terrasse) — c'est explicite dans le prompt et dans `02-BENCHMARKS-2026.md` §Doctolib pro. Pas de mobile = `/options` (timer 48 h) injouable en mobilité.

### 3.2 🚨 P0 — Absence totale de Command Palette / raccourcis clavier

- **Source** : Grep `cmdk|CmdK|command-palette|aria-keyshortcuts|onKeyDown.*meta` sur tout `src/app/[locale]/(admin)` → 0 résultat.
- **Impact** : référence absolue 2026 absente (`02-BENCHMARKS-2026.md` §Linear, §Stripe Dashboard, §Synthèse pattern 3). Pour un admin solo qui ouvre 30× / jour un détail submission → 4 clics + scroll vs 2 frappes.
- **Critère prompt** : §0.0 critère 8 « raccourcis clavier ». Cible perfection.
- **Gravité** : ROI massif × 5 ans, coût dev ~1.5 j (lib `cmdk` + 8 actions canoniques : naviguer, créer admin user, exporter CSV, refuser option, copier email contact, switch dark, sign out, ouvrir activity log filtré).

### 3.3 🚨 P0 — Dashboard d'accueil pauvre (4 counts isolés, zéro action)

- **Source** : `[adminPrefix]/page.tsx:56-73` rend 4 cards `.admin-kpi-grid` avec `pendingOptions`, `totalSubmissions`, `totalArticles`, `totalSubscribers`. Pas de :
  - prochain cadrage du jour (« Aujourd'hui » Doctolib),
  - acomptes expirés à relancer (V1 backend pas encore là — cf. `00-REALITY-CHECK.md` §1.1 P0 #1),
  - options 48 h en zone rouge (< 6 h),
  - devis en attente de signature (V1 backend pas là — #16 #17),
  - factures impayées,
  - submissions `new` non assignées,
  - alerts critical depuis 24 h.
- **Critère prompt** : Cible perfection §0.0 critère 8 « dashboard KPIs + alertes » + §4 Manques liste explicite. Synthèse benchmarks §1 « morning brief Doctolib » + §1 Vercel timeline.
- **Gravité** : c'est la première page que Will voit à chaque session → le ROI cognitif d'un dashboard riche est maximal.

### 3.4 🚨 P0 — Pas de Search Universel (Cmd+K) ni recherche transversale

- **Source** : aucun endpoint `/api/admin/search` côté code, aucun composant `<UniversalSearch />` détectable. Filtres locaux par page uniquement (`submissions/SubmissionFilters`, `users/page.tsx:66-121`).
- **Impact** : impossible de retrouver un client par email/téléphone sans deviner s'il est en Submission, Booking, Option, ou Newsletter. Pattern Stripe Dashboard « / focus » (`02-BENCHMARKS-2026.md` §Stripe) absent.
- **Gravité** : multiplie le coût de chaque lookup × 3-4 ressources.

### 3.5 ⚠️ P1 — Doublon `submissions` ↔ `options` ↔ `bookings` non explicité

- **Source** : 3 entités liées (`Submission.bookings Booking[]` `prisma/schema.prisma:42`, `Booking.submissionId? Uuid` `:202`, `BookingOption` orphelin de Submission `:258-286`) avec **3 sections nav distinctes** (`Soumissions`, `Calendrier`, `Options 48h`).
- **Constat** :
  - `/submissions` mélange 4 types (`audit`, `implementation`, `intervention`, `contact`) = vrai hub leads.
  - `/calendrier` montre les `CalendarSlot` avec leurs `Booking` joints.
  - `/options` montre les `BookingOption` (slots en attente 48 h).
  - **Aucune vue Client 360** qui agrège : « Carole de Vintage Co. » → toutes ses Submissions + Options + Bookings + Activity Logs filtrés par email. L'admin doit ouvrir 3 listes et reconstituer manuellement.
- **Recommandation** : V1 ajouter une vue `/clients/[email]` qui consolide. V2 unifier sous une seule entité `Lead` qui pointe vers Submission/Booking/Option. Pour V1 garder les 3 sections, mais introduire le hub Client 360.
- **Gravité** : pas P0 car contournable, mais c'est la dette UX la plus coûteuse à long terme.

### 3.6 ⚠️ P1 — `options` vs nouveau `submissions` se chevauchent sur l'expérience visiteur

- **Source** : `00-REALITY-CHECK.md` §2.1 — `postOption48hAction` (`features/booking/actions.ts:150`) crée une `BookingOption` orpheline de `Submission` (pas de FK `submissionId` `:258-286`). Donc une « pose d'option 48h » échappe au compteur « Soumissions totales » du dashboard (`page.tsx:33`).
- **Impact admin** : `/options` est isolé du funnel « Soumissions », empêche un suivi unifié de conversion.
- **Doublon stricto sensu** : non (datasets distincts), mais **silo conceptuel** qui force l'admin à mémoriser 2 paradigmes (Option = 48h auto-expire, Submission = inbox manuelle).
- **Reco** : ne pas fusionner V1 (verrou pessimiste différent), mais **brancher Options dans la timeline Client 360** + ajouter sur `/calendrier` un compteur croisé.

### 3.7 ⚠️ P1 — Pas de Breadcrumbs hiérarchiques (mono-segment uniquement)

- **Source** : Grep `aria-current|breadcrumb|Breadcrumb` sur tout `(admin)/` → 0 résultat. Le seul motif est `.admin-back` (« ← Section »).
- **Impact** : sur une page `/users/[id]` impossible de remonter directement au dashboard, et la sidebar ne marque pas l'item courant en `aria-current="page"` (`layout.tsx:115-120` n'a pas de logique active item).
- **Gravité** : a11y minime mais navigation perceptible dégradée.

### 3.8 ⚠️ P1 — Manques fonctionnels structurels (cf. §3 prompt « Manques »)

| Manque                                    | État code                                                                                       | Priorisation      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| Dashboard accueil riche                   | Pauvre (cf. 3.3) — `page.tsx:32-37`                                                             | V1 P0             |
| CRM Client 360                            | Absent (cf. 3.5)                                                                                | V1 P1             |
| Section Factures                          | Absente (table `Invoice` non créée — `00-REALITY-CHECK.md` §1.1)                                | V1 (post-Stripe)  |
| Section Capacité Will (calendrier dispos) | Embryon `/calendrier` block/unblock dates, mais pas de plafond j/semaine/mois ni de buffer time | V1 P1             |
| Section Devis / NDA                       | Absente (tables `Quote`, `Nda` non créées — `00-REALITY-CHECK.md` §1.1)                         | V1 (post-Yousign) |
| Section Refunds                           | Absente (table `Refund` non créée + pas de webhook `charge.refunded`)                           | V1 (post-Stripe)  |
| Section Disputes Stripe                   | Absente                                                                                         | V2+               |
| Audit log filterable + export CSV         | ✅ Existe `activity-logs/page.tsx:18-…` (cf. §2.3 ci-dessus + `02-BENCHMARKS-2026.md` §GitHub)  | V1 — déjà OK      |
| Bulk operations (table)                   | Absent — toutes les tables ont seulement « Détail → » par ligne                                 | V1 P1             |
| Drawer détail riche                       | Absent — `[id]/page.tsx` = full-page reload, pas de side-drawer Linear-style                    | V2+               |
| Test mode toggle (LIVE / DEMO)            | Absent — pas d'env `AXION_MODE`                                                                 | V2+               |

### 3.9 ⚠️ P2 — Layout : pas de skip-link, pas d'`<h1>` annoncé, sidebar pas marquée `aria-current`

- **Source** : Grep `skip-to-content|skip-link|aria-current|role="main"` → 0 résultat sur `(admin)/`.
- `layout.tsx:128` rend `<main className="admin-main">` sans `id` ni `tabIndex={-1}` → impossible de cibler en skip-link.
- Les `<a>` de nav `layout.tsx:115-120` ne marquent jamais l'item courant.
- **Gravité** : WCAG 2.4.1 (Bypass Blocks) et 2.4.3 (Focus Order) légèrement dégradés. Pas bloquant V1 mais facile à corriger.

### 3.10 ⚠️ P2 — Headers décoratifs avec emojis `📊 📅 ⏳ 📥 📝` cassent la cohérence brand

- **Source** : `layout.tsx:39-59` — 18 emojis comme icônes nav.
- **Constat doctrine** : `axionia_design_pivot.md` (mémoire) — direction visuelle commitée HEAD `941a8e1+` titleEm serif italique + Header terracotta figé, jamais d'emojis comme icônes visuelles primaires (interdit aussi par convention contenu CLAUDE.md modulé).
- **Recommandation** : remplacer par `<svg>` Lucide React (déjà en deps via Radix `lucide-react`, vu sur `BookingCalendar.tsx`).
- **Gravité** : P2 cosmétique mais visuellement discordant vis-à-vis du reste du produit (Linear utilise des icônes vectorielles fines, jamais d'emojis natifs).

### 3.11 ⚠️ P2 — Indicateurs urgence absents sur autres listes (seul `/options` les a)

- **Source** : `/submissions` (`submissions/page.tsx:80-110`) ne signale ni « `new` âgé > 48 h » ni « `assignedTo == null` ». `/newsletter` (`newsletter/page.tsx`) ne signale ni « `pending` âgé > 7 j » (devrait être confirmé ou purgé).
- **Reco** : généraliser le pattern `expiryUrgency` (`options/page.tsx:34-41`) à toutes les listes pertinentes (Submissions âge / Newsletter pending âge / Bookings status pending sans paiement V2).
- **Gravité** : P2 — qualité scan visuel.

### 3.12 ⚠️ P3 — Search box dispersée (3 patterns différents)

- `/submissions` : filter form via `SubmissionFilters` (client).
- `/users` : filter form server-side via `<form>` natif `users/page.tsx:66-121`.
- `/options` : filtres status uniquement, par links `<a href="?status=…">` (`options/page.tsx:71-79`).
- **Reco** : standardiser un composant `<AdminFiltersBar />` réutilisable + persister vue choisie `localStorage` clé `axn:admin:view:<resource>` (cf. `02-BENCHMARKS-2026.md` §Notion).
- **Gravité** : P3 cohérence UX.

---

## 4. Recommandations classées impact × effort inverse

> Échelle : Impact 1-5 (5 = critique cabinet), Effort 1-5 (5 = ≥ 5 j dev). ROI = Impact / Effort.

| #   | Recommandation                                               | Impact | Effort | ROI  | V1/V2+ |
| --- | ------------------------------------------------------------ | ------ | ------ | ---- | ------ |
| R1  | Dashboard « Aujourd'hui » riche (5 cards actionnables max)   | 5      | 2      | 2.5  | V1     |
| R2  | Command Palette `Cmd+K` (cmdk + 10 actions canoniques)       | 5      | 2      | 2.5  | V1     |
| R3  | Mobile responsive (3 breakpoints + drawer sidebar)           | 5      | 2      | 2.5  | V1     |
| R4  | Search universel `/admin/_search` (ILIKE + unaccent PG)      | 4      | 2      | 2.0  | V1     |
| R5  | Hub Client 360 `/clients/[email]` (agrège 4 ressources)      | 4      | 2      | 2.0  | V1     |
| R6  | Breadcrumbs hiérarchiques + `aria-current` sidebar           | 3      | 1      | 3.0  | V1     |
| R7  | Skip-link `#admin-main` + focus management                   | 2      | 1      | 2.0  | V1     |
| R8  | Remplacer emojis nav par icônes Lucide                       | 2      | 1      | 2.0  | V1     |
| R9  | `<AdminFiltersBar />` standardisé + persistence localStorage | 3      | 2      | 1.5  | V1     |
| R10 | Bulk operations sur tables (checkbox + actions)              | 3      | 3      | 1.0  | V1     |
| R11 | Étendre `expiryUrgency` à `/submissions` + `/newsletter`     | 2      | 1      | 2.0  | V1     |
| R12 | Drawer détail Linear-style (side panel `[id]` sans reload)   | 3      | 4      | 0.75 | V2+    |
| R13 | Test mode toggle LIVE/DEMO global                            | 3      | 4      | 0.75 | V2+    |
| R14 | Timeline live SSE `/admin/reservations/[id]`                 | 4      | 4      | 1.0  | V2+    |

**Top 6 actions V1 critique (ROI ≥ 2.0)** :

1. R6 Breadcrumbs + aria-current (1 j, gain a11y + nav perceptible).
2. R3 Mobile responsive (2 j, critère §0.0 critère 8).
3. R1 Dashboard riche (2 j, première impression × 365 sessions / an).
4. R2 Command Palette (2 j, ROI clavier × 5 ans).
5. R4 Search universel (2 j, élimine 60 % des lookups).
6. R5 Hub Client 360 (2 j, élimine la majeure source de friction).

---

## 5. Sources citées

| Source                             | Ligne(s)                                                                        | Sujet                                        |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `layout.tsx`                       | `35-61`, `73-77`, `81-83`, `106-128`                                            | Nav + groupes + validation prefix + force FR |
| `[adminPrefix]/page.tsx`           | `25-110`, `32-37`, `56-73`                                                      | Dashboard racine actuel + 4 KPIs             |
| `submissions/page.tsx`             | `29-…`, `80-84`, `115`, `135-146`                                               | Liste + empty state + pagination             |
| `submissions/[id]/page.tsx`        | `24-…`, `36-38`                                                                 | Détail + retour mono-segment                 |
| `options/page.tsx`                 | `34-41`, `71-79`, `99-103`                                                      | Urgency classes + filters as links + empty   |
| `options/[id]/page.tsx`            | `25-…`, `40-42`                                                                 | Détail option + back                         |
| `calendrier/page.tsx`              | `53-…`, `74-100`                                                                | Calendrier admin + nav mois                  |
| `users/page.tsx`                   | `28-29`, `66-121`, `137-142`                                                    | Liste + filters + empty                      |
| `newsletter/page.tsx`              | `24-…`                                                                          | Liste subscribers                            |
| `settings/page.tsx`                | `13-90`                                                                         | Liste settings JSON                          |
| `activity-logs/page.tsx`           | `18-…`                                                                          | Liste logs filterable                        |
| `infra/page.tsx`                   | `1-…`                                                                           | Read-only outils tiers                       |
| `alerts/page.tsx`                  | `1-…`                                                                           | Agrégation alerts                            |
| `lib/admin-path.ts`                | `27-42`                                                                         | Helper segment + adminPath                   |
| `app/globals.css`                  | `429-460`, `587-665`, `616-630`, `935-944`                                      | Layout admin + sidebar + urgency classes     |
| `prisma/schema.prisma`             | `42`, `157-228`, `258-286`                                                      | Modèles Submission/Booking/BookingOption     |
| `_AUDIT/.../00-REALITY-CHECK.md`   | §1.1, §2.1, §4, §9                                                              | Tables manquantes + actions + diff doctrine  |
| `_AUDIT/.../02-BENCHMARKS-2026.md` | §Linear, §Stripe Dashboard, §Vercel, §Notion, §Doctolib pro, §GitHub, §Synthèse | Patterns 2026                                |

---

## 6. Score /100

| Dimension                                      | Poids   | Score brut | Pondéré | Justification                                                                        |
| ---------------------------------------------- | ------- | ---------- | ------- | ------------------------------------------------------------------------------------ |
| UX power-user (Cmd+K, raccourcis, search)      | 20      | 2/10       | **4**   | Aucun Cmd+K, aucune palette, aucune search universel (3.2, 3.4)                      |
| Mobile responsive                              | 15      | 1/10       | **2**   | Sidebar fixe 240 px, aucune media query admin (3.1)                                  |
| Accessibilité (a11y)                           | 15      | 5/10       | **8**   | `aria-label` sidebar OK, mais skip-link/aria-current/breadcrumbs absents (3.7, 3.9)  |
| Navigation (groupes, breadcrumbs, deep-links)  | 15      | 5/10       | **8**   | 5 groupes propres, retour mono-segment OK, breadcrumb hiérarchique absent (2.2, 3.7) |
| Complétude V1 (Dashboard, Client 360, Manques) | 20      | 4/10       | **8**   | 18 sections existent mais Dashboard pauvre, pas de hub Client 360 (3.3, 3.5, 3.8)    |
| Doctrine visuelle Axion-IA                     | 15      | 6/10       | **9**   | Sidebar groupée OK, emojis nav cassent l'identité serif/terracotta (3.10)            |
| **Total**                                      | **100** | —          | **39**  | Score brut = 39/100 — état embryonnaire mais base server-first saine.                |

### Détail catégoriel (informatif)

- **UX power-user** : 4/20 (-16) — Cmd+K + raccourcis + search universel manquants.
- **Mobile** : 2/15 (-13) — Will pilote en mobilité → critique.
- **Doctrine** : 9/15 (-6) — corrigeable en 0.5 j (Lucide icons).

### Score cible post-recommandations V1 (R1-R11)

≈ **78/100** (+39 pts) si R1-R11 livrées. R12-R14 portent à ~92/100.

---

## 7. Marquage V1 vs V2+

| Élément                                   | Décision                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dashboard « Aujourd'hui » riche           | V1 — R1                                                                                    |
| Command Palette `Cmd+K` + 10 actions      | V1 — R2                                                                                    |
| Mobile responsive (sidebar drawer)        | V1 — R3                                                                                    |
| Search universel ressources               | V1 — R4                                                                                    |
| Hub Client 360                            | V1 — R5                                                                                    |
| Breadcrumbs + `aria-current`              | V1 — R6                                                                                    |
| Skip-link + focus mgmt                    | V1 — R7                                                                                    |
| Icônes Lucide en remplacement des emojis  | V1 — R8                                                                                    |
| Filters standardisés + persistence vue    | V1 — R9                                                                                    |
| Bulk operations sur tables                | V1 — R10                                                                                   |
| Urgency badges étendus                    | V1 — R11                                                                                   |
| Drawer détail Linear-style                | V2+ — R12                                                                                  |
| Test mode LIVE / DEMO toggle              | V2+ — R13                                                                                  |
| Timeline live SSE par ressource           | V2+ — R14                                                                                  |
| Sections Devis / NDA / Factures / Refunds | V1 mais **après** Stripe + Yousign backend (cf. `00-REALITY-CHECK.md` §1.1 P0 #1, #3, #16) |
| Sections Disputes / Subscription / Tax    | V2+                                                                                        |

---

## 8. Plan de réorganisation

### 8.1 Cartographie — 3 regroupements possibles

#### 8.1.1 Regroupement actuel (cf. `layout.tsx:35-61`)

```
[main]        Tableau de bord · Calendrier · Options 48h · Soumissions
[content]     Blog · Catégories · Cas concrets · Témoignages · FAQ · Centre d'aide
[engagement]  Newsletter
[ops]         Infra & outils · Alertes ops
[system]      Utilisateurs · Activity logs · Paramètres · 2FA sécurité
```

**Verdict** : structure raisonnable. « engagement » solo (1 entrée) est un peu maigre. « main » mélange daily-quotidien (Calendrier, Options) avec hebdo/mensuel (Soumissions). Manque Dashboard `Client 360` + Devis + Factures (toutes V1 post-backend).

#### 8.1.2 Par fréquence d'usage (quotidien / hebdo / mensuel / rare)

```
[Aujourd'hui (quotidien)]    Tableau de bord · Calendrier · Options 48h · Alertes ops
[Cette semaine (hebdo)]      Soumissions · Clients (V1) · Devis (V1) · Newsletter
[Mensuel]                    Blog · Cas concrets · Témoignages · FAQ · Centre d'aide · Catégories
[Rarement (config)]          Utilisateurs · Settings · Activity logs · 2FA · Infra & outils
```

**Verdict** : très orienté power-user Will-solo, copie le pattern Doctolib pro. **Recommandé pour V1.** Inconvénient : la frontière hebdo/mensuel dépend de l'activité contenu réelle (à recalibrer en V2).

#### 8.1.3 Par domaine fonctionnel (Opérations / Contenu / Système)

```
[Opérations clients]          Tableau de bord · Calendrier · Options 48h · Soumissions · Clients (V1) · Newsletter · Devis (V1) · Factures (V1) · Refunds (V1)
[Contenu éditorial]            Blog · Catégories · Cas concrets · Témoignages · FAQ · Centre d'aide
[Système & monitoring]         Utilisateurs · Activity logs · Paramètres · 2FA · Infra & outils · Alertes ops
```

**Verdict** : sémantiquement plus propre, mais le groupe Ops devient 9 entrées quand backend V1 livré → liste trop longue.

#### Synthèse arbitrage

→ **Adopter 8.1.2 (par fréquence)** pour la sidebar V1, avec **enrichissements** :

- Ajouter `Clients` dans « Cette semaine » (hub Client 360).
- Renommer `Tableau de bord` → « Aujourd'hui » (signe l'intention `morning brief`).
- Renommer `Options 48h` → « Options 48 h » (chiffre + h).
- Préfixer chaque entrée par une icône Lucide.

### 8.2 Mockup ASCII final

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  AXION-IA · ADMIN                                  [⌘K Rechercher…]   admin@ │
├─────────────────────┬────────────────────────────────────────────────────────┤
│ Aujourd'hui  ▲      │  Admin › Aujourd'hui                          12 mai   │
│   ▣ Aujourd'hui     ├────────────────────────────────────────────────────────┤
│   ▦ Calendrier      │  Prochain cadrage · 14:00 — Vintage Co. (Lille)        │
│   ⏳ Options 48 h  3 │  [Lancer Meet]  [Voir dossier]                          │
│   ⚠ Alertes        1│                                                         │
│                     │  ┌───────────────┬───────────────┬───────────────┐    │
│ Cette semaine       │  │ Options 48 h  │ Devis sign.   │ Acomptes      │    │
│   📥 Soumissions  5 │  │ pending  3    │ J+3+   1      │ exp. 24h   2  │    │
│   👤 Clients (V1)   │  └───────────────┴───────────────┴───────────────┘    │
│   📄 Devis (V1)   1 │                                                         │
│   📧 Newsletter     │  Submissions nouvelles (5)                              │
│                     │  ────────────────────────────────────────────────       │
│ Mensuel             │  · Marie Dubois · audit · il y a 2h    [Détail →]       │
│   📝 Blog           │  · Pierre Lefèvre · intervention · 5h  [Détail →]       │
│   🏆 Cas concrets   │                                                         │
│   💬 Témoignages    │  Alertes ops critiques (1)                              │
│   ❓ FAQ            │  ────────────────────────────────────────────────       │
│   ❔ Centre d'aide  │  🚨 UptimeRobot — meet.axion-ia.com DOWN 12 min        │
│   🏷 Catégories     │                                                         │
│                     │                                                         │
│ Système             │                                                         │
│   👥 Utilisateurs   │                                                         │
│   📜 Activity logs  │                                                         │
│   ⚙ Paramètres     │                                                         │
│   🔐 2FA            │                                                         │
│   🔧 Infra & outils │                                                         │
└─────────────────────┴────────────────────────────────────────────────────────┘
                       ↑ Sidebar collapsable < 768 px → burger menu top-left
                       ↑ Cmd+K ouvre palette globale (search ressources + nav)
                       ↑ Breadcrumb sur chaque page : Admin › Section › Item
```

### 8.3 Diff vs actuel

| Aspect                   | Actuel                                                 | Cible V1                                                                                           | Diff                               |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Groupement sidebar       | 5 groupes (main / content / engagement / ops / system) | 4 groupes (Aujourd'hui / Cette semaine / Mensuel / Système)                                        | Fusion ops → Aujourd'hui + Système |
| Dashboard d'accueil      | 4 counts isolés                                        | 1 hero "prochain cadrage" + 3 KPI cards actionnables + 2 listes courtes (submissions new + alerts) | +5 modules                         |
| Section Clients          | Absente                                                | Présente (`/clients` + `/clients/[email]`)                                                         | +2 routes                          |
| Section Devis / Factures | Absente                                                | Présente après backend Stripe + Yousign (V1 phase 2)                                               | +4 routes                          |
| Command Palette          | Absente                                                | `Cmd+K` global + 10 actions canoniques                                                             | +1 composant                       |
| Search universel         | Filters par page                                       | `/admin/_search?q=` + entrée Cmd+K                                                                 | +1 endpoint                        |
| Breadcrumbs              | Mono-segment `← Section`                               | Multi-segment `Admin › Section › Item`                                                             | composant +1                       |
| `aria-current` sidebar   | Absent                                                 | `aria-current="page"` sur item actif                                                               | +1 helper                          |
| Skip-link                | Absent                                                 | `<a href="#admin-main" class="skip-link">`                                                         | +1 lien                            |
| Mobile responsive        | Sidebar fixe 240 px                                    | Drawer burger < 768 px + sidebar 240 px ≥ 768 px                                                   | +CSS media-queries                 |
| Icônes nav               | Emojis natifs (📊📅⏳…)                                | Lucide React `<LayoutDashboard />`, `<Calendar />`, etc.                                           | +Lucide                            |
| Indicateurs urgence      | `/options` seulement                                   | Étendre `/submissions` (age `new` > 48h) + `/newsletter` (`pending` > 7j)                          | +2 helpers                         |
| Bulk operations          | Aucun                                                  | Checkbox + bar actions sur `/submissions`, `/newsletter`                                           | +composant                         |

### 8.4 Empty states (qualité)

**État actuel** : `.admin-table-empty` (`globals.css:829-834`) → simple `<td colSpan>Aucune … trouvée.</td>`. Pas d'illustration, pas de CTA primary, pas de copy actionnable.

Reproduit sur `submissions/page.tsx:82`, `options/page.tsx:101`, `users/page.tsx:139`, `settings/page.tsx:57`, etc.

**Cible 2026 (cf. `02-BENCHMARKS-2026.md` §Vercel)** :

```
   ┌──────────────────────────────┐
   │   [icône Lucide 48px]        │
   │   Aucune soumission encore   │
   │   Les soumissions s'affichent│
   │   ici dès qu'un visiteur     │
   │   envoie un formulaire.      │
   │   [Voir le funnel public →]  │
   └──────────────────────────────┘
```

- **Effort** : 1.5 j (12 empty states × 7 min copy + 1 composant `<AdminEmptyState />`).
- **Impact** : 3/5 (qualité perçue + autonomie nouvel admin onboarding V2+).
- **Verdict** : V1 R-bonus, P2 confort.

---

## Notes méthodologiques

- Aucune écriture code applicatif, aucune commande `git`/`pnpm`, lecture seule conforme AUDIT-ONLY.
- Lignes citées sur HEAD `ff3ccbc9`.
- Les manques fonctionnels P0/P1/P2 du §3 sont **transverses au reality-check** (`00-REALITY-CHECK.md` §1.1 #1 #3 #16) : Stripe + Yousign backend doivent être livrés avant Section Devis/Factures/Refunds — mais l'**ordonnancement nav** (`/devis`, `/factures`) peut être préfiguré dès V1 avec page placeholder « En attente d'intégration Stripe » pour offrir une navigation prévisible.
- Le score 39/100 reflète l'état **post-M9 livré mais avant les enrichissements perfection extrême** : la base server-first est saine, les chantiers UX power-user (Cmd+K, palette, mobile, dashboard) sont les leviers de plus haut ROI.

**Fin Agent 02** — `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-02-admin-organisation.md` — Claude Opus 4.7 (1M context) — 2026-05-12.
