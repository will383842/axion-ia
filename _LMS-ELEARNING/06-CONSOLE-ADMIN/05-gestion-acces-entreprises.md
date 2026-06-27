# Console admin — Gestion des accès entreprises

> Comment, **depuis la console admin Axion-IA**, on **commande pour une équipe**, on **attribue N sièges à une entreprise (`Client`)**, on **importe une liste de bénéficiaires (CSV)**, et on **suit la progression par entreprise**. Plus : la trajectoire **V2** (admin entreprise délégué + reporting par organisation), conçue dès maintenant (ADR-LMS-0002) mais livrée plus tard.
>
> **Cadre figé** : ADR-LMS-0002 (multi-tenant conçu maintenant / **livré V2** ; MVP = octroi en masse côté Axion-IA), ADR-LMS-0004 (Stripe éteint, MVP = virement + octroi manuel), ADR-LMS-0007 (cloisonnement code sous `src/...elearning/...`), ADR-LMS-0008 (migrations additives).
>
> **Réutilisation centrale** : le **CRM `Client`** existant (`prisma/schema.prisma:4890`, table `clients`, SIRET / NAF→OPCO / contact). On **n'introduit aucun nouveau modèle d'entreprise** : `Client` EST l'entreprise. On lui rattache les commandes/sièges/adhésions e-learning via des FK additives.

---

## 0. TL;DR pour un dev senior

- **L'entreprise = `Client` (CRM existant)**. Pas de table « organisation » neuve. Le « pack entreprise » est un `ElearningOrder` avec `clientId` renseigné (doc `03-DATA-MODEL/05`).
- **Trois objets-clés, déjà modélisés ailleurs**, que cette page **orchestre** (elle ne les redéfinit pas) :
  1. `ElearningOrder` + `ElearningOrderItem` (commande + lignes × quantité de sièges) — doc `03-DATA-MODEL/05`.
  2. `ElearningSeat` (le **siège** : place achetée, attribuable, **réaffectable**) — doc `03-DATA-MODEL/05`.
  3. `ElearningEnrollment` (l'**accès** matérialisé quand un siège est attribué) — doc `03-DATA-MODEL/02`.
  - - `ElearningOrgMembership` (adhésion `Trainee × Client`, rôle + statut du siège, **socle multi-tenant V2**) — doc `03-DATA-MODEL/04`.
- **MVP = Axion-IA provisionne.** L'admin crée la commande, encaisse (virement), **ouvre les accès** (octroi manuel 1-clic) ou **importe un CSV** (doc `04-BACKEND/06`). L'entreprise **ne se gère pas elle-même** au MVP.
- **V2 = l'entreprise se gère elle-même** : `org_admin` délégué, espace cloisonné, reporting par organisation, branding. Le data model (`ElearningOrgMembership.role`, `Trainee.primaryOrganisationClientId`) est **déjà posé** → zéro refonte.
- **UI 100 % console admin existante** : `AdminPageShell` / `AdminTable` / `AdminBadge` / `AdminStatCard` (`src/components/admin/ui/**`), nav via `src/lib/admin-nav.ts` (groupe `elearning`), RBAC `requireAdminRead/Write/Delete`. Sidebar réellement montée = `AdminSidebarNav.tsx`.
- **Cloisonnement** : tout le neuf vit sous `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/components/admin/elearning/**`.

---

## 1. Périmètre — ce que fait CE document

Ce doc est la **couche console admin** de la gestion entreprise. Il **consomme** les briques définies ailleurs et décrit **les écrans, les parcours et les server actions** propres au cas entreprise :

| Capacité                                       | MVP (ce doc)                                  | V2 (ce doc, section 11)      |
| ---------------------------------------------- | --------------------------------------------- | ---------------------------- |
| Commander pour une équipe (pack N sièges)      | ✅ admin crée `ElearningOrder` (clientId)     | —                            |
| Attribuer N sièges à un `Client`               | ✅ pool de sièges + attribution/réaffectation | délégué à `org_admin`        |
| Import liste CSV (bénéficiaires)               | ✅ wizard (détail doc `04-BACKEND/06`)        | délégué à l'entreprise       |
| Suivi par entreprise (progression, complétion) | ✅ dashboard read-only côté admin             | espace cloisonné entreprise  |
| Admin entreprise délégué                       | ❌ (data prêt)                                | ✅ rôle `org_admin` + espace |
| Reporting par organisation (exports)           | ⚠️ exports admin Axion-IA                     | ✅ self-service entreprise   |
| Branding par client                            | ❌                                            | ✅                           |

**Hors périmètre** (renvois) : modèle de données commandes/sièges/coupons → doc `03-DATA-MODEL/05` ; modèle d'octroi/progression → doc `03-DATA-MODEL/02` ; identité/auth/adhésion apprenant → doc `03-DATA-MODEL/04` + `04-BACKEND/05` ; pipeline d'import CSV (parse/dry-run/idempotence) → doc `04-BACKEND/06` ; facturation/TVA FOAD → doc `03-DATA-MODEL/05` §7 & §12.

---

## 2. EXISTANT réutilisé vs NEUF

### 2.1 Réutilisé tel quel (vérifié dans le code)

| Brique                                      | Emplacement réel                                                                                                                                                                      | Rôle dans la gestion entreprise                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 `Client` (CRM B2B)                       | `prisma/schema.prisma:4890` (`clients`)                                                                                                                                               | **L'entreprise.** `raisonSociale`, `siret`, `nafCode`, `opcoIdentifie`, `contactNom/Email`, `taille`, agrégats `nbStagiaires`/`caCents`. **Acheteur** (`ElearningOrder.clientId`) + **tenant** (`ElearningOrgMembership.clientId`). |
| 🟢 `ClientType { entreprise, particulier }` | `schema.prisma:4873`                                                                                                                                                                  | Filtrer la vue « entreprises » (`type = entreprise`). Un particulier reste géré par la page Apprenants (doc `06-CONSOLE-ADMIN/04`).                                                                                                 |
| 🟢 `Trainee`                                | `schema.prisma:5274` (`trainees`)                                                                                                                                                     | Le bénéficiaire d'un siège (jamais dupliqué ; clé `email` citext). Étendu (auth/appartenance) par doc `03-DATA-MODEL/04`.                                                                                                           |
| 🟢 `Enrollment` (présentiel/live)           | `schema.prisma:5310`                                                                                                                                                                  | **Inchangé.** Déjà porteur de `clientId` (inter-entreprises). L'octroi e-learning a sa propre table `ElearningEnrollment`.                                                                                                          |
| 🟢 `PortailAcces` + `creerAcces()`          | `src/server/qualiopi/portail/portail-service.ts:110`                                                                                                                                  | Token magic-link 64 hex / 90 j envoyé à chaque bénéficiaire à l'attribution d'un siège.                                                                                                                                             |
| 🟢 Console UI                               | `src/components/admin/ui/**` (`AdminPageShell`, `AdminTable`, `AdminBadge`, `AdminStatCard`, `AdminTabs`, `AdminToolbar`, `AdminPagination`, `AdminEmptyState`, `AdminConfirmDialog`) | Toutes les pages entreprise. Pas de nouveau design system.                                                                                                                                                                          |
| 🟢 Navigation                               | `src/lib/admin-nav.ts` (SSOT) + `AdminSidebarNav.tsx` (monté)                                                                                                                         | Ajout du groupe `elearning` (§4).                                                                                                                                                                                                   |
| 🟢 RBAC                                     | `requireAdminRead/Write/Delete` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin`/`admin`/`editor`/`reader`)                                                            | Garde de toutes les actions + lecture reporting.                                                                                                                                                                                    |
| 🟢 R2                                       | `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`)                                                                                                      | Archive CSV d'import + exports reporting (PDF/CSV) par entreprise.                                                                                                                                                                  |
| 🟢 Email + BullMQ                           | `src/lib/email/**`, `enqueueEmail()` (`src/server/queue/queues.ts`), Nodemailer                                                                                                       | Mails d'octroi / invitation siège / relance (templates neufs).                                                                                                                                                                      |
| 🟢 Facturation                              | `Invoice`/`Payment`/`Refund` (`schema.prisma` ~1695/1644/1761), numérotation `AXION-2026-NNNN`                                                                                        | Facture du pack entreprise (via `ElearningOrder`, doc 05 §7).                                                                                                                                                                       |
| 🟢 `DocumentGenere` + QR                    | `schema.prisma:5507`                                                                                                                                                                  | Certificats de réalisation par bénéficiaire (preuve OPCO).                                                                                                                                                                          |
| 🟢 `pricing.ts`                             | `src/content/pricing.ts`                                                                                                                                                              | SSOT des prix snapshotés dans `ElearningOrderItem`. Aucun prix en dur dans l'UI.                                                                                                                                                    |
| 🟢 `logQualiopiActivity`                    | audit admin existant                                                                                                                                                                  | Journalisation des octrois/révocations (preuve + RGPD).                                                                                                                                                                             |

### 2.2 Neuf à construire (cloisonné ADR-LMS-0007)

| Élément                                                                   | Type                   | Emplacement cible                                                                                           |
| ------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Service « accès entreprise » (vue agrégée Client, pool de sièges, octroi) | code                   | `src/server/elearning/access/enterprise-access-service.ts`                                                  |
| Service octroi/attribution de sièges                                      | code                   | `src/server/elearning/orders/grant-access.ts` (réutilisé) + `seat-service.ts`                               |
| Server actions admin entreprise                                           | code                   | `src/server/actions/elearning/enterprise.ts`                                                                |
| Service reporting par entreprise                                          | code                   | `src/server/elearning/reporting/enterprise-report-service.ts`                                               |
| Pages admin (liste + fiche entreprise + onglets)                          | route handlers + pages | `src/app/[locale]/(admin)/[adminPrefix]/elearning/entreprises/**`                                           |
| Composants admin entreprise                                               | UI                     | `src/components/admin/elearning/enterprise/**`                                                              |
| Groupe nav `elearning`                                                    | config                 | `src/lib/admin-nav.ts` (additif)                                                                            |
| Worker d'octroi/invitation de sièges en masse                             | worker                 | `src/server/queue/workers/elearning-grant-worker.ts`                                                        |
| Email « accès siège entreprise »                                          | template               | `src/lib/email/templates/elearning-acces-octroye.tsx` (partagé avec doc 06)                                 |
| Modèles data (rappel — définis ailleurs, migration additive)              | Prisma                 | `ElearningOrder/Item/Seat` (doc 05), `ElearningOrgMembership` (doc 04), `ElearningImportBatch/Row` (doc 06) |

---

## 3. Modèle mental (qui pointe vers quoi)

```
Client (entreprise CRM, EXISTANT)
  │
  ├── ElearningOrder (clientId)  ── pack acheté ──┐
  │      └── ElearningOrderItem (courseId, quantite = nb sièges)
  │             └── ElearningSeat[]  (1 par place : disponible → invite → attribue → revoque)
  │                      │  beneficiaireEmail / beneficiaireTraineeId
  │                      └── ElearningEnrollment (l'ACCÈS, créé à l'attribution) ── doc 02
  │
  ├── ElearningOrgMembership (Trainee × Client, role + statut)   ── adhésion / socle V2 ── doc 04
  │
  ├── ElearningImportBatch / Row (provisioning CSV en masse)     ── doc 06
  │
  └── Invoice / Payment (via ElearningOrder)                     ── doc 05 §7
```

**Trois questions, trois objets** :

- _« Combien l'entreprise a payé / commandé ? »_ → `ElearningOrder` + `ElearningOrderItem.quantite` (sièges payés = vérité de comptage).
- _« Qui occupe une place et est-elle réaffectable ? »_ → `ElearningSeat` (statut + bénéficiaire ; révoquer libère une place pour un autre salarié, **sans re-facturer**).
- _« La personne a-t-elle réellement accès et où en est-elle ? »_ → `ElearningEnrollment` + `CourseProgress` (doc 02).

> **Pourquoi le siège n'est PAS l'enrollment.** Le turnover salarié exige de **réaffecter** une place sans recréer la commande. `ElearningSeat` est la place payée (stable, comptable) ; `ElearningEnrollment` est l'accès d'une personne (révocable). Une place peut traverser plusieurs personnes ; chaque révocation conserve la trace (preuve FOAD/OPCO).

---

## 4. Navigation admin (`src/lib/admin-nav.ts` — additif)

Ajouter `"elearning"` à l'union `AdminNavGroup` (`admin-nav.ts:25`), à `ADMIN_NAV_GROUP_LABELS` (« E-learning ») et à `ADMIN_NAV_GROUP_ORDER` (après `coaching-1to1`, avant `image-bank`). Items du groupe (les autres pages e-learning sont décrites dans les docs `06-CONSOLE-ADMIN/01..08`) :

```ts
// dans src/lib/admin-nav.ts — items group: "elearning"
{ href: `${base}/elearning`,                  label: "Tableau de bord",        icon: "🎓", group: "elearning" },
{ href: `${base}/elearning/cours`,            label: "Cours (outil auteur)",   icon: "📚", group: "elearning" },
{ href: `${base}/elearning/apprenants`,       label: "Apprenants",             icon: "🧑‍🎓", group: "elearning" },
{ href: `${base}/elearning/entreprises`,      label: "Entreprises & équipes",  icon: "🏢", group: "elearning" },   // ← CE DOC
{ href: `${base}/elearning/commandes`,        label: "Commandes & sièges",     icon: "🧾", group: "elearning" },
{ href: `${base}/elearning/acces/import`,     label: "Import en masse (CSV)",  icon: "📥", group: "elearning" },
{ href: `${base}/elearning/certificats`,      label: "Certificats",            icon: "📜", group: "elearning" },
{ href: `${base}/elearning/reporting`,        label: "Reporting",              icon: "📈", group: "elearning" },
```

> ⚠️ **Mémoire projet (2026-06-27)** : il existe deux composants sidebar ; seul `AdminSidebarNav.tsx` est monté par le layout. Déclarer le groupe dans `admin-nav.ts` (SSOT) **et vérifier son rendu** dans `AdminSidebarNav.tsx`. Les pages de détail (`/entreprises/[clientId]`, `/commandes/[orderId]`) ne sont **pas** rendues dans la sidebar : elles sont atteignables par lien/breadcrumb (renseigner `parent` si besoin de résolution `AdminBreadcrumbs`).

---

## 5. Écrans & routes (cartographie)

Toutes les pages : `src/app/[locale]/(admin)/[adminPrefix]/elearning/entreprises/**`, **Server Components** (data fetché serveur via les services), `export const dynamic = "force-dynamic"` (derrière auth admin ; jamais exécutées au build `stub.invalid`). Interactivité minimale en client (budget INP/JS admin — pas soumis aux budgets des 15 pages publiques mais on reste sobre).

| Route                                         | Fichier                           | Rôle                                                                                                                            |
| --------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/elearning/entreprises`                      | `entreprises/page.tsx`            | **Liste des entreprises** ayant (ou éligibles à) de l'e-learning. Vue `Client` filtrée `type=entreprise` + agrégats e-learning. |
| `/elearning/entreprises/[clientId]`           | `entreprises/[clientId]/page.tsx` | **Fiche entreprise** (onglets, §5.2).                                                                                           |
| `/elearning/entreprises/[clientId]/commander` | `.../commander/page.tsx`          | **Commander pour une équipe** (créer un pack `ElearningOrder`, §6).                                                             |
| `/elearning/entreprises/[clientId]/sieges`    | `.../sieges/page.tsx`             | **Pool de sièges** (attribuer / réaffecter / révoquer, §7).                                                                     |
| `/elearning/entreprises/[clientId]/import`    | `.../import/page.tsx`             | **Import CSV** ciblé sur cette entreprise (wizard, détail doc `04-BACKEND/06`).                                                 |
| `/elearning/entreprises/[clientId]/suivi`     | `.../suivi/page.tsx`              | **Suivi de progression** par entreprise (read-only, §8).                                                                        |
| `/elearning/entreprises/[clientId]/export`    | `.../export/route.ts`             | Route handler **export** CSV/PDF (URL signée R2 ou génération à la volée).                                                      |

### 5.1 Liste des entreprises (`/elearning/entreprises`)

- **Source** : `Client` où `type = entreprise` **et** (`a au moins un ElearningOrder` **ou** `≥1 ElearningOrgMembership` **ou** `≥1 ElearningEnrollment.clientId`). Un onglet « Toutes les entreprises CRM » permet d'en ajouter une qui n'a pas encore d'e-learning.
- **Composant** : `AdminTable` (tri/pagination via `AdminPagination`), `AdminToolbar` (recherche `raisonSociale`/`siret`, filtre OPCO, filtre « sièges disponibles > 0 »).
- **Colonnes** : Entreprise (`raisonSociale` + `siret`), OPCO (`opcoIdentifie`), Sièges (achetés / attribués / **disponibles**), Apprenants actifs, Complétion moyenne (%), Dernière activité, statut commande (badge).
- **Header** : `AdminPageHeader` + `AdminStatCard` ×4 (entreprises actives, sièges vendus, sièges libres, complétion globale).
- **Actions de ligne** : « Ouvrir la fiche », « Commander », « Importer une liste ».

### 5.2 Fiche entreprise (`/elearning/entreprises/[clientId]`)

`AdminTabs` (5 onglets). En-tête = bandeau d'identité réutilisant la fiche `Client` CRM (raison sociale, SIRET, OPCO, contact) **sans la dupliquer** (lien « Voir la fiche CRM complète »).

1. **Vue d'ensemble** — `AdminStatCard` (sièges achetés/attribués/libres, apprenants actifs, complétion moyenne, certificats émis) + dernières activités.
2. **Commandes & sièges** — `AdminTable` des `ElearningOrder` du client (référence, statut, montant, sièges, paiement) ; clic → détail commande (`/elearning/commandes/[orderId]`). Bouton « Commander pour cette équipe ».
3. **Apprenants** — `AdminTable` des `Trainee` rattachés via `ElearningOrgMembership` (clientId) **ou** `ElearningEnrollment.clientId` : nom, email, rôle org (`membre`/`manager`/`org_admin`), statut compte (`LearnerAccountStatut`), cours suivis, complétion, dernière connexion, certificat. Actions : suspendre/réactiver siège, renvoyer le lien d'accès, révoquer.
4. **Suivi (progression)** — synthèse + lien onglet `/suivi` (§8).
5. **Conformité & preuves** — état des preuves FOAD par bénéficiaire (entrée effective `premiereConnexionAt`, évaluations, certificat) + bouton export « dossier OPCO » (§9, §12).

---

## 6. Commander pour une équipe (créer un pack)

**Route** : `/elearning/entreprises/[clientId]/commander`. **Composant** : `src/components/admin/elearning/enterprise/CommanderPackForm.tsx` (formulaire serveur + minimal client pour le récap dynamique).

**Parcours admin (MVP, virement) :**

1. **Choisir le cours** (`ElearningCourse` `statut = publie`, `vendableSeul = true`) + **nombre de sièges** (`quantite`). Plusieurs lignes possibles (`ElearningOrderItem[]`, cours différents).
2. **Prix** : lu depuis `pricing.ts` (SSOT) → snapshot `unitPriceHtCents`/`lineHtCents`. Remise éventuelle via coupon (`ElearningCoupon`, doc 05 §8). TVA = exonération FOAD `261-4-4° CGI` par défaut (`vatRate = 0`, `vatMention` dans le `legalSnapshot` de l'`Invoice`).
3. **Mode de règlement** : `paymentMode` ∈ `{ virement (défaut), opco, gratuit, octroi_manuel }` (Stripe = `stripe` **gated** `STRIPE_ENABLED`, hors MVP). Si `opco` → saisir `opcoDossierRef`.
4. **Confirmer** → `ElearningOrder` passe `brouillon → en_attente_paiement`, **génère l'`Invoice`** (numérotation atomique `AXION-2026-NNNN`), `paymentDueAt = +14 j`.
5. **Matérialiser les sièges** : à la confirmation, créer `quantite` lignes `ElearningSeat` en `statut = disponible` (réutilise `grant-access.ts` / `seat-service.ts`). Le pool est alors prêt à être rempli (attribution unitaire §7 ou import CSV §6 bis).

> **Octroi ≠ paiement.** Les `ElearningEnrollment` ne sont créés qu'à l'**attribution** d'un siège (pas à la commande). Une commande `gratuit`/`octroi_manuel` (totalTtcCents = 0) saute la facture et peut aller direct en `octroyee`.

**6 bis — Remplir le pool par import CSV.** Depuis la commande/fiche entreprise, bouton « Importer une liste » → wizard 4 étapes (Cibler / Déposer / Vérifier dry-run / Octroyer) **entièrement spécifié dans `04-BACKEND/06-import-masse-provisioning.md`**. Particularités entreprise : `baseLegale = contrat` par défaut (formation pro B2B → consentement individuel non requis, information art. 14 RGPD assurée par l'email), rattachement automatique `clientId` + `orderId`, **garde-fou sièges** : nb de lignes valides à octroyer ≤ sièges disponibles (`order.quantite − sièges attribués`) — dépassement = lignes excédentaires `INVALID` (jamais d'octroi partiel silencieux).

---

## 7. Pool de sièges — attribution / réaffectation / révocation

**Route** : `/elearning/entreprises/[clientId]/sieges`. **Composant** : `src/components/admin/elearning/enterprise/SeatPoolTable.tsx`.

Vue de tous les `ElearningSeat` de l'entreprise (toutes commandes), regroupés par cours, avec compteur **disponibles / invités / attribués / révoqués** (`AdminBadge` couleur par `ElearningSeatStatut`).

### 7.1 Machine à états d'un siège (`ElearningSeatStatut`, doc 05 §3)

```
disponible ──(saisir bénéficiaire + envoyer accès)──► invite ──(1re connexion)──► attribue
     ▲                                                                              │
     └──────────────────── revoque ◄──(révoquer)── attribue/invite ◄───────────────┘
                              │
                      (réaffectable : repasse disponible quand on retire le bénéficiaire)
```

| Action admin                     | Effet data                                                                                                                                                                                                                                                                                                                                                    | Effets de bord                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Attribuer** (saisir email/nom) | `ElearningSeat` → `invite` ; `beneficiaireEmail/Nom` ; upsert `Trainee` (clé email citext) ; upsert `ElearningOrgMembership` (role `membre`, statut `active`) ; set `Trainee.primaryOrganisationClientId` si vide ; crée `ElearningEnrollment` (source `octroi_manuel`/`achat`, `clientId`, `expiresAt = now + accessDurationDays`) ; lie `seat.enrollmentId` | `creerAcces()` (magic-link 90 j) + `enqueueEmail("elearning-acces-octroye")` |
| **Marquer attribué** (auto)      | `invite → attribue` à la 1re connexion (`ElearningEnrollment.premiereConnexionAt`)                                                                                                                                                                                                                                                                            | — (audit)                                                                    |
| **Renvoyer le lien**             | inchangé                                                                                                                                                                                                                                                                                                                                                      | nouveau `creerAcces()` + email (anti double-envoi `jobId`)                   |
| **Suspendre**                    | `ElearningEnrollment.statut → suspendu` (`suspenduRaison`) ; `ElearningOrgMembership.statut → suspended`                                                                                                                                                                                                                                                      | accès bloqué (guard apprenant) ; preuve conservée                            |
| **Révoquer / libérer**           | `ElearningSeat → revoque` + (option « libérer ») retirer bénéficiaire → repasse `disponible` ; `ElearningEnrollment → revoque` ; `ElearningOrgMembership → revoked`                                                                                                                                                                                           | place réaffectable **sans re-facturer** ; trace conservée (FOAD/OPCO)        |

### 7.2 Règles métier

- **Unicité** : `ElearningSeat @@unique([orderId, courseId, beneficiaireEmail])` + `ElearningEnrollment @@unique([traineeId, courseId])` → **idempotence** (double-clic, re-import) garantie en base.
- **Pas de sur-attribution** : on ne peut attribuer que des sièges `disponible` ; le compteur disponible est recalculé serveur (jamais de confiance au client).
- **Réaffectation = trace** : on ne **supprime jamais** un enrollment révoqué (preuve). La place repasse `disponible` par retrait du bénéficiaire, pas par delete.
- **Octroi en masse** : si > `IMPORT_SYNC_MAX_ROWS` (50) bénéficiaires d'un coup → délégué au worker `elearning-grant-worker.ts` (progress + reprise), même pattern que `image-bank-import-worker.ts`.

---

## 8. Suivi par entreprise (read-only)

**Route** : `/elearning/entreprises/[clientId]/suivi`. **Service** : `enterprise-report-service.ts`. **Composant** : `EnterpriseProgressDashboard.tsx`.

Agrège, **scopé `clientId`**, les `ElearningEnrollment` + `CourseProgress` (doc 02) des bénéficiaires :

- **KPIs** (`AdminStatCard`) : bénéficiaires actifs / invités non connectés, **taux de complétion moyen**, temps moyen passé, score moyen aux quiz bloquants, certificats émis, sièges libres.
- **Tableau par apprenant** (`AdminTable`) : nom, email, cours, **% complétion** (barre), dernière activité (`dernierAccesAt`), entrée effective (`premiereConnexionAt` — preuve FOAD), statut quiz/gating, certificat (lien `DocumentGenere`).
- **Anti-décrochage (Qualiopi Ind.12)** : surlignage des « invités jamais connectés J+7 » et « inactifs > N jours » ; bouton « Relancer » (réutilise template email + cron, doc `04-BACKEND/10`).
- **Filtres** : par cours, par cohorte (`metadata.cohorteTag` de l'import), par statut.

> **Performance** : toutes les agrégations passent par des `count`/`groupBy` Prisma scopés `clientId` (index `ElearningEnrollment @@index([clientId])`, `@@index([statut])`). Pas de N+1 ; pagination serveur. Lecture = `requireAdminRead` (rôle `reader` suffit).

---

## 9. Exports & dossier OPCO par entreprise

**Route** : `/elearning/entreprises/[clientId]/export` (route handler, `force-dynamic`, `requireAdminRead`).

- **Export CSV** « suivi équipe » : une ligne par bénéficiaire (identité, cours, complétion, heures réalisées, dates, certificat). Généré serveur, archivé R2 (`exports/elearning/<clientId>/<ts>.csv`), URL signée `getSignedUrlR2`.
- **Dossier OPCO / preuve de réalisation** : regroupe par bénéficiaire les **certificats de réalisation** (`DocumentGenere`, modèle officiel heures réalisées, obligatoire depuis 01/06/2020) + le **faisceau de preuves FOAD** (logs LMS, évaluations, traces d'assistance — doc `08-CONFORMITE/06`). Ce que l'OPCO **exige pour payer** (facture + relevé de dépenses + certificat de réalisation) est produit ; ce qu'il peut **réclamer en contrôle** (pièces FOAD) est conservé. Voir doc `08-CONFORMITE/02` & `05`.

---

## 10. Server actions (`src/server/actions/elearning/enterprise.ts`)

```ts
"use server";
// Toutes : requireAdminWrite (sauf lecture = requireAdminRead) + audit logQualiopiActivity.
// Validation Zod (src/lib/schemas/elearning/*). stub-aware. exactOptionalPropertyTypes.
// ActionResult<T> = { data: T } | { error: string } (pattern repo).

// — Vue & lecture —
export async function getEntreprisesElearningAction(input: {
  q?: string;
  opco?: string;
  avecSiegesLibres?: boolean;
  page?: number;
}): Promise<ActionResult<EntrepriseListItem[]>>; // requireAdminRead

export async function getFicheEntrepriseAction(input: {
  clientId: string;
}): Promise<ActionResult<FicheEntreprise>>; // requireAdminRead (onglets agrégés)

export async function getSuiviEntrepriseAction(input: {
  clientId: string;
  courseId?: string;
  cohorte?: string;
}): Promise<ActionResult<EnterpriseProgress>>; // requireAdminRead

// — Commander (pack) —
export async function creerCommandePackAction(input: {
  clientId: string;
  lignes: { courseId: string; quantite: number; accessDurationDays?: number }[];
  paymentMode: "virement" | "opco" | "gratuit" | "octroi_manuel";
  couponCode?: string;
  opcoDossierRef?: string;
  internalNotes?: string;
}): Promise<ActionResult<{ orderId: string; reference: string }>>; // requireAdminWrite

export async function confirmerCommandePackAction(input: {
  orderId: string;
}): Promise<ActionResult<{ invoiceId?: string; seatsCrees: number }>>; // requireAdminWrite (génère Invoice + sièges)

// — Sièges —
export async function attribuerSiegeAction(input: {
  seatId: string;
  beneficiaireEmail: string;
  beneficiaireNom?: string;
}): Promise<ActionResult<{ enrollmentId: string }>>; // requireAdminWrite

export async function attribuerSiegesEnMasseAction(input: {
  orderId: string;
  beneficiaires: { email: string; nom?: string }[];
}): Promise<ActionResult<{ mode: "sync" | "async"; attribues?: number; batchId?: string }>>; // requireAdminWrite

export async function renvoyerLienSiegeAction(input: {
  seatId: string;
}): Promise<ActionResult<null>>; // requireAdminWrite

export async function suspendreSiegeAction(input: {
  seatId: string;
  raison: string;
}): Promise<ActionResult<null>>; // requireAdminWrite

export async function revoquerSiegeAction(input: {
  seatId: string;
  libererPlace: boolean;
}): Promise<ActionResult<null>>; // requireAdminWrite

// — Exports —
export async function exporterSuiviEntrepriseAction(input: {
  clientId: string;
  format: "csv" | "dossier_opco";
}): Promise<ActionResult<{ url: string }>>; // requireAdminRead
```

**Garde-fous transverses** : `requireAdminWrite`/`requireAdminRead` (`knowledge/_guards.ts`) ; jamais d'exposition de `passwordHash`/PII handicap (select explicite) ; messages d'erreur non-énumérants ; toute mutation tracée (`logQualiopiActivity` : `entreprise.commande.creer`, `entreprise.siege.attribuer`, `entreprise.siege.revoquer`, …) ; recalcul serveur des compteurs de sièges (anti-survente).

---

## 11. V2 — admin entreprise délégué & reporting par organisation (multi-tenant)

> **Conçu maintenant, livré V2 (ADR-LMS-0002).** Le data model est **déjà posé** : `ElearningOrgMembership.role { membre, manager, org_admin }`, `ElearningOrgMembership.statut`, `Trainee.primaryOrganisationClientId`. Passer en V2 = **brancher de l'UI et un scoping**, **pas** une refonte.

### 11.1 Rôles délégués

- **`org_admin`** (entreprise) : gère les sièges/accès de son organisation (attribuer, réaffecter, révoquer dans la **limite de son pool**), invite des membres, voit le reporting de **son** organisation, gère le branding. **Ne voit jamais** les autres clients.
- **`manager`** : voit la progression de **son** équipe (sous-ensemble), relance les décrocheurs, mais n'attribue pas de siège.
- **`membre`** : apprenant standard.

### 11.2 Cloisonnement (le vrai multi-tenant)

- **Espace entreprise** sous `src/app/[locale]/entreprise/**` (distinct de l'admin Axion-IA), authentifié via le **monde apprenant** (cookie `portail_session` + `requireLearner`, doc `04-BACKEND/05`) **avec contrôle de rôle** `org_admin`/`manager` (nouveau guard `requireOrgAdmin(clientId)` dérivé de `ElearningOrgMembership`).
- **Scoping systématique** : **toute** requête de l'espace entreprise filtrée `WHERE client_id = :tenant` (résolu depuis le membership du porteur de session). Au MVP le scoping existe déjà sur les agrégats admin (`clientId`) → la V2 réutilise les mêmes services en injectant le tenant.
- **Anti-fuite** : tests d'isolation obligatoires (un `org_admin` du client A ne peut lire aucune donnée du client B) — cf. doc `09-QUALITE/02`.

### 11.3 Reporting par organisation (self-service)

- Tableau de bord entreprise : complétion par cours/équipe/cohorte, courbes d'engagement, export « bilan de formation » PDF (réutilise `DocumentGenere` + R2). Mêmes agrégations que §8, mais **rendues à l'entreprise** (scopées tenant).
- **SSO/SCIM**, **branding par client** (logo/couleurs sur l'espace + emails) : V2+, derrière flags ; le `Client` porte déjà l'identité, on ajoutera des colonnes additives (`brandingJson`) le moment venu (ADR-0008).

### 11.4 Ce qui ne change pas en V2

`Client`, `ElearningOrder`, `ElearningSeat`, `ElearningEnrollment`, `ElearningOrgMembership` restent **identiques**. La V2 n'ajoute **aucun DROP** : juste un espace front cloisonné + des guards de rôle + (optionnel) `Client.brandingJson`. C'est la promesse d'ADR-LMS-0002.

---

## 12. Conformité (Qualiopi / OPCO / RGPD) — vue entreprise

- **Base légale d'un provisioning employeur = `contrat`** (formation pro B2B) : le consentement individuel n'est pas la base ; **information** des bénéficiaires assurée par l'email d'octroi (responsable de traitement Axion-IA, finalité, droits — art. 14 RGPD). Consentement **email marketing** distinct, opt-in (jamais présumé). Détail doc `04-BACKEND/06` §8.
- **FOAD finançable (Art. D.6313-3-1)** : assistance technique+pédagogique accessible (tutorat, Qualiopi Ind.19) ; information activités+durée moyenne (durée cours affichée) ; **évaluations qui jalonnent** (Ind.11 — quiz bloquants, doc `03-DATA-MODEL/03`). Ces preuves sont **agrégées par entreprise** dans l'onglet Conformité (§5.2.5) et l'export OPCO (§9).
- **Preuve de réalisation** (R.6313-3, preuve libre) : faisceau **logs LMS + évaluations + traces d'accompagnement + certificat**, jamais le relevé de connexion seul. Conservé 3–5 ans (L.6362-6). Voir doc `08-CONFORMITE/06`.
- **Conservation** : factures/commandes (`Invoice` via `ElearningOrder`) 6–10 ans ; preuves de réalisation 3–5 ans ; CSV source/`rawJson` ≤ 1 an puis purge (cron rétention) ; logs techniques 6–12 mois (CNIL). `ElearningSeat`/`ElearningOrgMembership` révoqués **conservés** (statut `revoke`/`revoked`, pas delete) pour l'audit. Doc `08-CONFORMITE/05`.
- **CPF/EDOF** : **hors périmètre entreprise** (ADR-LMS-0003) — pas de CPF sans certification RNCP/RS ; le financement entreprise passe par virement direct ou OPCO, jamais par CPF tant que `EDOF_ENABLED=false`.
- **RBAC & audit** : mutations entreprise = `requireAdminWrite` ; suppression d'un lot/PII = `requireAdminDelete` (super_admin) ; tout tracé `logQualiopiActivity`.

---

## 13. Contraintes plateforme respectées

- **Build `stub.invalid` (ADR 0026)** : toutes les pages/routes entreprise sont derrière auth admin + `force-dynamic` → **jamais** exécutées au SSG. Les services répliquent le garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid"))` (lecture → `[]`/`null`, mutation → throw) comme `portail-service.ts`.
- **Migrations additives (ADR-0008)** : ce doc n'introduit **aucune** table/colonne propre (il orchestre celles des docs 02/04/05/06). Les FK vers `Client`/`Trainee`/`Invoice` portent `@db.Uuid` (alignement type PK existant) ; les FK internes e-learning suivent l'arbitrage `06-strategie-migrations.md`.
- **Web Vitals** : pages **admin** (hors 15 pages publiques stratégiques) → pas de gate lhci, mais on reste sobre (Server Components, client islands minimales, pas de gros bundle dans la sidebar). L'espace entreprise V2 (`/entreprise/**`) sera, lui, soumis aux budgets s'il devient public-facing → INP du dashboard à surveiller.
- **Pas de service emailing tiers** : Nodemailer + React Email + BullMQ existants.
- **FR canonique** (EN désactivé) : libellés FR ; pas de mapping `pathnames` FR≠EN sur ces routes admin.

---

## 14. Checklist d'implémentation (MVP)

- [ ] Prérequis data (autres docs) : `ElearningOrder/Item/Seat` (05), `ElearningOrgMembership` (04), `ElearningEnrollment` (02), `ElearningImportBatch/Row` (06) — **migration additive unique**.
- [ ] Ajouter le groupe `elearning` à `admin-nav.ts` (union + labels + order) **et** vérifier le rendu dans `AdminSidebarNav.tsx`.
- [ ] `src/server/elearning/access/enterprise-access-service.ts` (vue agrégée Client + pool de sièges) — stub-aware.
- [ ] `src/server/elearning/orders/seat-service.ts` (attribuer/réaffecter/révoquer, idempotent) réutilisant `grant-access.ts` + `creerAcces`.
- [ ] `src/server/elearning/reporting/enterprise-report-service.ts` (agrégats scopés `clientId`, exports R2).
- [ ] Server actions `src/server/actions/elearning/enterprise.ts` (§10) + Zod + `logQualiopiActivity`.
- [ ] Pages `src/app/[locale]/(admin)/[adminPrefix]/elearning/entreprises/**` (liste, fiche+onglets, commander, sièges, suivi, export) — `force-dynamic`.
- [ ] Composants `src/components/admin/elearning/enterprise/**` (`CommanderPackForm`, `SeatPoolTable`, `EnterpriseProgressDashboard`) sur `AdminPageShell`/`AdminTable`/`AdminBadge`/`AdminStatCard`.
- [ ] Worker `elearning-grant-worker.ts` (octroi/invitation en masse > 50) + enregistrement `queues.ts`/`worker.ts` (gardé `BULLMQ_DISABLED`/stub).
- [ ] Email `elearning-acces-octroye.tsx` (partagé doc 06) + `EmailJobName` additif.
- [ ] Tests Vitest : idempotence attribution/réaffectation, garde-fou sièges (pas de sur-attribution), scoping `clientId`, anti-fuite (préparer V2), stub-aware. PrismaClient mock.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0002 (multi-tenant V2), 0004 (Stripe éteint), 0007 (cloisonnement), 0008 (additif).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (l'accès), `CourseProgress` (suivi), `premiereConnexionAt` (entrée effective).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningOrgMembership` (adhésion entreprise + rôles), `Trainee.primaryOrganisationClientId`, identité/auth apprenant.
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder`/`Item`/`Seat`, réutilisation `Invoice`/`Payment`, machine à états commande, TVA FOAD.
- `04-BACKEND/06-import-masse-provisioning.md` — pipeline CSV (parse, dry-run, idempotence, RGPD) — le wizard d'import référencé ici.
- `04-BACKEND/05-authentification-apprenant.md` — magic-link `PortailAcces` + mot de passe optionnel (comptes entreprise), guard `requireLearner` (base du `requireOrgAdmin` V2).
- `04-BACKEND/10-emails-notifications.md` — emails d'octroi + relances anti-décrochage (Ind.12).
- `06-CONSOLE-ADMIN/04-gestion-apprenants.md` — apprenants individuels (B2C) ; complémentaire de cette page entreprise.
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — reporting global (cette page = vue scopée entreprise).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md`, `05-rgpd-conservation-preuves.md`, `06-tracabilite-preuves-realisation.md` — preuves FOAD/OPCO par entreprise, conservation.
- `02-ARCHITECTURE/multi-tenant-strategie.md` — exploitation V2 de `ElearningOrgMembership` (espace cloisonné, scoping tenant).
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — MVP (octroi en masse Axion-IA) → V1 (pack entreprise outillé) → V2 (auto-gestion entreprise).
