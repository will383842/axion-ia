# Console admin — Reporting & Analytics e-learning

> Spécification **implémentable** du pôle « Reporting & Analytics » de la console admin LMS : tableaux de bord et rapports de **complétion / temps / scores / chiffre d'affaires**, agrégés **par apprenant, par cours, par entreprise** ; **exports CSV / XLSX / PDF** ; **rapports planifiés** (envoi récurrent par email) ; **export du faisceau de preuves FOAD** prêt pour un contrôle **OPCO / DREETS** ; **tableaux filtrés par rôle** (RBAC).
>
> **Principe directeur (non négociable) : on ne stocke aucune nouvelle métrique brute.** Le reporting **agrège et restitue** des données déjà produites par les autres briques LMS (`CourseProgress`, `QuizAttempt`, `ElearningOrder`, `ElearningXapiStatement`, `DocumentGenere`, `ElearningAccompagnementLog`, `ElearningPreuveRealisationSnapshot`). Il réutilise l'infra d'export, de PDF, de R2, de queues et de RBAC **existante**. Le neuf = une **couche de requêtes agrégées + exporteurs + rapports planifiés + UI**.
>
> Source de vérité des modèles/champs cités : `03-DATA-MODEL/01..05`. Source des arbitrages : `00-INDEX/DECISIONS-ARBITRAGES.md` (ADR-0001 → 0008). Conventions : code sous `src/server/elearning/**` (ADR-0007), migrations **additives** (ADR-0008), FR canonique, `force-dynamic` derrière auth admin (contrat build `stub.invalid`).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR — ce qui est livré

| #   | Livrable                                                      | MVP/V1 | Réutilise                                          | Neuf                                 |
| --- | ------------------------------------------------------------- | :----: | -------------------------------------------------- | ------------------------------------ |
| 1   | Tableaux de bord reporting (complétion, temps, scores, CA)    | MVP→V1 | `AdminPageShell`/`StatCard`/`AdminTable`           | `reporting-service.ts`, pages        |
| 2   | Rapports **par apprenant / par cours / par entreprise**       |  MVP   | agrégats `CourseProgress`/`QuizAttempt`            | query builders                       |
| 3   | Rapport **financier / CA** (commandes, encaissé, OPCO)        |   V1   | `ElearningOrder`/`Invoice`/`Payment`               | `revenue-report.ts`                  |
| 4   | Exports **CSV**                                               |  MVP   | pattern `csvField` + BOM (observatoire/BPF)        | `csv-export.ts`                      |
| 5   | Exports **XLSX** (multi-onglets)                              |   V1   | — (ajout dép. `exceljs`, serveur/worker only)      | `xlsx-export.ts`                     |
| 6   | Exports **PDF** (rapport mis en page)                         |   V1   | `@react-pdf/renderer` + `QualiopiPage`/`pdfStyles` | templates `reports/*`                |
| 7   | **Export preuves FOAD** (bundle ZIP OPCO/DREETS)              |  MVP   | `evidence-export.ts` (archi §3), R2                | `foad-evidence-bundle.ts`            |
| 8   | **Rapports planifiés** (cron → email récurrent)               |   V1   | queue `emails` + crons `elearning-crons`           | `ElearningScheduledReport` + handler |
| 9   | **Tableaux par rôle** (RBAC + scoping)                        |  MVP   | `_guards.ts` `requireAdmin*`                       | matrice §10 + `report-access.ts`     |
| 10  | **Journal d'export** (RGPD : qui a exporté quelle PII, quand) |  MVP   | `ActivityLog` existant                             | usage dédié                          |

---

## 1. Périmètre & objectifs

Le pôle reporting répond à **quatre questions métier** et à **une obligation réglementaire** :

1. **Pédagogie / engagement** — « Qui avance, qui décroche, quels cours marchent ? » → complétion, temps réel d'activité, scores, taux de réussite, abandon (Qualiopi Ind.12).
2. **Pilotage produit** — « Quels cours sont efficaces, où sont les points de friction ? » → complétion par module/leçon, scores par quiz/question, durée moyenne réelle vs annoncée.
3. **Commercial / financier** — « Combien on vend, combien on encaisse, par entreprise / OPCO ? » → CA commandé, encaissé, restant dû, par `Client`, par mode de paiement.
4. **Comptes entreprise** — « Où en sont les salariés de l'entreprise X ? » → reporting agrégé par `Client` (MVP : côté admin Axion-IA ; V2 : exposé à l'admin entreprise délégué, ADR-0002).
5. **Conformité FOAD (DUR)** — « Prouver la réalisation à l'OPCO / DREETS » → faisceau de preuves R.6313-3 exportable (assiduité, évaluations, travaux, assistance, certificat). C'est la **raison d'être prioritaire** : sans preuve exportable, le financement OPCO et la certification Qualiopi V8 (Ind.11 majeur) sont en risque.

**Hors périmètre de ce document** (couverts ailleurs) : le détail des modèles de progression (`03-DATA-MODEL/02`), le moteur de quiz (`03`), l'e-commerce (`05`), le dashboard de pilotage opérationnel temps réel (`06-CONSOLE-ADMIN/02`, qui consomme les mêmes services), la génération du certificat lui-même (`05-FRONTEND-APPRENANT/06`).

---

## 2. EXISTANT réutilisé vs NEUF

### 2.1 EXISTANT (réutilisé, **zéro duplication**)

| Brique                                                                                                                                            | Emplacement réel                                                                                                                                                       | Réutilisation reporting                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pattern **export CSV** (anti-injection formule `csvField`, BOM UTF-8 FR, Server Action `→ { csv, filename }` + déclenchement Blob client)         | `src/app/api/observatoire/export-csv/route.ts`, `src/components/admin/qualiopi/BpfExportButton.tsx`, `exportBpfCsvAction` (`src/server/actions/qualiopi/satisfaction`) | Base du `csv-export.ts` e-learning (même `csvField`, même BOM, même handler de download).                                                        |
| **Route handler de download** (`text/csv`, `Content-Disposition: attachment`, `cache-control: no-store`, `force-dynamic`, `runtime nodejs`)       | `src/app/api/admin/submissions/export/route.ts`                                                                                                                        | Modèle exact des routes `/api/admin/elearning/reports/*/export`.                                                                                 |
| Export comptable + BPF (Bilan Pédagogique et Financier)                                                                                           | `src/components/admin/qualiopi/ExportComptaButton.tsx`, `BpfExportButton.tsx`                                                                                          | **Référence métier** : le reporting e-learning **alimente** le BPF Qualiopi existant (heures/stagiaires FOAD) au lieu de le réécrire. Voir §8.5. |
| `@react-pdf/renderer` + `QualiopiPage`/`DocSection`/`FieldRow`/`pdfStyles` + `formatHeuresCentiemes` + `LEGAL_MENTIONS`                           | `src/server/qualiopi/documents/templates/*`, `legal-mentions.ts`                                                                                                       | Templates PDF de rapport (mise en page identique aux documents Qualiopi → cohérence visuelle).                                                   |
| `generateDocument()` (numéro séquentiel, hash, R2, audit log, stub-aware)                                                                         | `src/server/qualiopi/documents/documents-service.ts`                                                                                                                   | Si un export PDF doit être **archivé/horodaté** comme pièce officielle (ex. bundle FOAD signé).                                                  |
| R2 (`uploadToR2`, `getSignedUrlR2`, `getObjectBufferR2`, `existsInR2`)                                                                            | `src/lib/r2-storage.ts`                                                                                                                                                | Stockage des **gros exports** (XLSX volumineux, ZIP preuves FOAD) → URL signée courte plutôt qu'un transfert via Server Action.                  |
| Infra BullMQ (`queues.ts`, `worker.ts`, `bootRepeatableJobs`, `enqueueEmail`)                                                                     | `src/server/queue/*`                                                                                                                                                   | **Rapports planifiés** + génération asynchrone des **gros exports** (queue `elearning-crons`, voir `04-BACKEND/03` §4).                          |
| `ElearningPreuveRealisationSnapshot` (snapshot quotidien du faisceau de preuves)                                                                  | doc `04-BACKEND/03` §4.6 (NEUF additif déjà prévu)                                                                                                                     | **Cache de reporting** : la plupart des chiffres de conformité se lisent depuis ce snapshot (pas de recompute lourd).                            |
| `ElearningAccompagnementLog` (trace d'assistance Ind.19)                                                                                          | doc `04-BACKEND/03` §4.4                                                                                                                                               | Colonne « nb relances / réponses tuteur » des rapports + preuve FOAD.                                                                            |
| Agrégats matérialisés `CourseProgress` / `ModuleProgress` / `LessonProgress`                                                                      | doc `03-DATA-MODEL/02`                                                                                                                                                 | **Source n°1** des rapports complétion/temps/scores (déjà des caches → lectures rapides).                                                        |
| `QuizAttempt` / `QuizAttemptAnswer` / `EvaluationAcquis`                                                                                          | doc `03-DATA-MODEL/03`                                                                                                                                                 | Scores, taux de réussite, analyse par question, preuve d'acquisition Qualiopi (Ind.11).                                                          |
| `ElearningOrder` / `ElearningOrderItem` / `ElearningSeat` / `Invoice` / `Payment`                                                                 | doc `03-DATA-MODEL/05`                                                                                                                                                 | Rapport **CA / financier**.                                                                                                                      |
| `DocumentGenere` (+ `qrToken`)                                                                                                                    | `schema.prisma:5507`                                                                                                                                                   | Liste des certificats émis, dates, vérifiabilité.                                                                                                |
| `ActivityLog` (audit existant)                                                                                                                    | utilisé par `generateDocument`                                                                                                                                         | **Journal d'export** (qui a exporté de la PII, quand) — RGPD.                                                                                    |
| RBAC `requireAdminRead/Write/Publish/Delete` (`super_admin/admin/editor/reader`)                                                                  | `src/server/actions/knowledge/_guards.ts`                                                                                                                              | Gardes des actions de reporting + matrice par rôle (§10).                                                                                        |
| Console admin `AdminPageShell`/`AdminPageHeader`/`StatCard`/`AdminTable`/`AdminBadge` + nav `admin-nav.ts` (montée par **`AdminSidebarNav.tsx`**) | `src/components/admin/ui/*`, `src/lib/admin-nav.ts`                                                                                                                    | UI des pages reporting.                                                                                                                          |
| Page admin `analytics` existante (Web Vitals/usage)                                                                                               | `src/app/[locale]/(admin)/[adminPrefix]/analytics/page.tsx`                                                                                                            | **Voisinage** (ne pas confondre : analytics ≠ reporting LMS ; le LMS a son propre pôle).                                                         |

### 2.2 NEUF (ce document)

- **Couche de requêtes agrégées** : `src/server/elearning/reporting/**` (services purs, stub-aware, sans `'use server'`).
- **Exporteurs** : `csv-export.ts`, `xlsx-export.ts` (dép. `exceljs`), templates PDF `reports/*`.
- **Bundle preuves FOAD** : `foad-evidence-bundle.ts` (ZIP OPCO/DREETS).
- **Rapports planifiés** : modèle `ElearningScheduledReport` (+ `ElearningReportRun`) + handler cron + dispatch email.
- **Journal d'export** typé (usage de `ActivityLog`, pas de nouvelle table) + `report-access.ts` (scoping par rôle/entreprise).
- **Pages console** : `(admin)/[adminPrefix]/elearning/reporting/**` + composants `src/components/admin/elearning/reporting/**`.
- **Dictionnaire de métriques** (§5) = contrat partagé entre tous les rapports.

---

## 3. Sources de données — mapping métrique → champ (contrat)

Toute métrique du reporting **doit** se résoudre à un champ existant. Aucune métrique « inventée ». Tableau de traçabilité (le query builder ne lit **que** ces colonnes) :

| Métrique reporting                           | Champ source (modèle)                                                           | Doc              |
| -------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| % complétion cours                           | `CourseProgress.percentComplet`                                                 | 02 §6            |
| Statut d'avancement                          | `CourseProgress.statut` (`non_commence/en_cours/termine/echoue`)                | 02 §2            |
| Modules / leçons terminés                    | `CourseProgress.modulesTermines/Total`, `lecconsTerminees/Total`                | 02 §6            |
| **Temps réel d'activité** (preuve assiduité) | `CourseProgress.tempsTotalSec` = Σ `LessonProgress.tempsPasseSec`               | 02 §4/§6         |
| Nb de vues / ouvertures                      | `LessonProgress.nbVues` (agrégé)                                                | 02 §4            |
| **Score global** de réussite                 | `CourseProgress.scoreGlobalPct`                                                 | 02 §6            |
| Réussite (oui/non)                           | `CourseProgress.reussite` vs `ElearningCourse.seuilReussitePct`                 | 02 §6 / 01 §3    |
| Score par quiz / tentatives                  | `QuizAttempt.scorePct`, `numeroTentative`, `statut`, `reussite`                 | 03 §8            |
| Score par question (analyse item)            | `QuizAttemptAnswer.pointsObtenus/pointsMax`, `correcte`                         | 03 §8.2          |
| Preuve d'acquisition (Qualiopi Ind.11)       | `EvaluationAcquis` (`scorePct`, `niveauGlobal`, `type=finale`)                  | 03 §10           |
| Entrée effective (FOAD/EDOF)                 | `ElearningEnrollment.premiereConnexionAt`                                       | 02 §3            |
| Dernière activité (décrochage)               | `ElearningEnrollment.dernierAccesAt`                                            | 02 §3            |
| Octroi / source d'accès                      | `ElearningEnrollment.accordeAt`, `source`, `clientId`                           | 02 §3            |
| Certificat émis                              | `ElearningEnrollment.certificatEmisAt` + `DocumentGenere` (`numero`, `qrToken`) | 02 §3 / 05-FE/06 |
| Assistance (relances, réponses tuteur)       | `ElearningAccompagnementLog` (`type`, `canal`, `createdAt`)                     | 04-BE/03 §4.4    |
| Journal d'événements (logs LMS)              | `ElearningXapiStatement` (`verb`, `objectType`, `occurredAt`)                   | 02 §7            |
| Snapshot quotidien preuves                   | `ElearningPreuveRealisationSnapshot`                                            | 04-BE/03 §4.6    |
| Badges obtenus                               | `ElearningBadgeAward`                                                           | 05-FE/06 §4.3    |
| **CA commandé**                              | `ElearningOrder.totalHtCents/totalTtcCents`, `statut`, `paymentMode`            | 05 §4            |
| **CA encaissé**                              | `Payment.amountCents` (via `orderId`), `status`                                 | 05 §7.2          |
| Restant dû / impayés                         | `Invoice.amountTtcCents` − Σ `Payment` (via `orderId`)                          | 05 §7            |
| Sièges entreprise (vendus / attribués)       | `ElearningSeat.statut` (`disponible/invite/attribue/revoque`)                   | 05 §6            |
| Coupons / remises                            | `ElearningCouponRedemption.discountCents`                                       | 05 §9            |

> **Règle d'or temps vs durée légale** (rappelée de `05-FE/06` §5) : pour un **rapport pédagogique/engagement**, on affiche le **temps réel** (`tempsTotalSec`). Pour une **pièce de financement** (certificat, BPF, bundle OPCO), la **durée de l'action** est `ElearningCourse.dureeEstimeeMinutes` (durée moyenne annoncée, D.6313-3-1 §2), le temps réel servant de **preuve d'assiduité** en annexe. Les rapports distinguent **toujours** les deux colonnes (`duree_action_h` vs `temps_reel_actif_h`) pour ne pas induire l'OPCO en erreur.

---

## 4. Catalogue de rapports

Cinq familles. Chaque rapport = (1) un **query builder** dans `reporting/queries/`, (2) un **schéma de colonnes** typé (réutilisé par CSV/XLSX/PDF), (3) une **page console**, (4) des **filtres** communs (période `accordeAt`/`occurredAt`, cours, entreprise, statut, source).

### 4.1 Rapports « par apprenant »

| Rapport                                                     | Lignes                                   | Colonnes clés                                                                        | Usage                     |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| **Fiche apprenant** (`learner-detail`)                      | 1 apprenant × N cours                    | cours, statut, %, temps réel, score, réussite, entrée effective, certif, badges      | suivi individuel, support |
| **Liste apprenants d'un cours** (`learner-by-course`)       | N apprenants                             | apprenant (Prénom + initiale par défaut), %, temps, dernière activité, score, certif | pilotage cohorte          |
| **Apprenants à risque** (`at-risk`)                         | apprenants inactifs > N j, non complétés | jours d'inactivité, %, dernière relance                                              | Ind.12 anti-décrochage    |
| **Relevé de réalisation apprenant** (`learner-realisation`) | 1 apprenant × 1 cours                    | détail leçon par leçon + quiz + assistance + dates                                   | **pièce FOAD** (cf. §8)   |

### 4.2 Rapports « par cours »

| Rapport                                               | Lignes                     | Colonnes clés                                                                               | Usage                                    |
| ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Performance des cours** (`course-overview`)         | N cours                    | inscrits, actifs, % complétion moyen, taux de réussite, temps moyen réel, certifs émis      | pilotage catalogue                       |
| **Entonnoir module/leçon** (`course-funnel`)          | modules → leçons d'1 cours | inscrits atteints, complétés, % abandon par étape                                           | détecter les points de friction          |
| **Analyse des quiz** (`quiz-analysis`)                | quiz → questions d'1 cours | nb tentatives, score moyen, taux de réussite, **questions les plus ratées** (item analysis) | qualité pédagogique des quiz             |
| **Couverture conformité cours** (`course-compliance`) | N cours FOAD               | a ≥1 quiz `evaluation`/`final_certificatif` ? assistance configurée ? durée annoncée ?      | garde-fou Qualiopi Ind.11/19 avant vente |

### 4.3 Rapports « par entreprise » (`Client`)

| Rapport                                          | Lignes                       | Colonnes clés                                                                   | Usage                  |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| **Synthèse entreprise** (`company-summary`)      | 1 `Client`                   | sièges achetés/attribués/restants, salariés actifs, % complétion moyen, certifs | reporting compte B2B   |
| **Détail salariés** (`company-learners`)         | N bénéficiaires d'1 `Client` | salarié, cours, %, temps, score, certif                                         | livrable client / OPCO |
| **Avancement par commande** (`company-by-order`) | commandes d'1 `Client`       | référence, cours, sièges, % moyen, statut paiement                              | suivi contrat          |

> **Scoping multi-tenant (ADR-0002).** En MVP, ces rapports sont **filtrés par `clientId`** côté admin Axion-IA (filtre, pas cloisonnement). En **V2**, le même query builder est réutilisé tel quel mais **forcé** au `clientId` du tenant connecté (admin entreprise délégué) via `report-access.ts` → aucune réécriture, juste un prédicat de scoping obligatoire.

### 4.4 Rapport financier / CA (`revenue`) — V1

| Vue                            | Agrégation                                         | Colonnes                                       | Source                                        |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| **CA par période**             | par mois                                           | commandé HT/TTC, encaissé, restant dû, remises | `ElearningOrder` + `Payment`                  |
| **CA par cours**               | par `ElearningOrderItem.courseId`                  | unités vendues (sièges), CA HT                 | `ElearningOrderItem`                          |
| **CA par entreprise**          | par `clientId`                                     | commandes, CA, impayés                         | `ElearningOrder`/`Invoice`                    |
| **CA par mode de financement** | par `paymentMode` (`virement/opco/gratuit/stripe`) | CA, nb dossiers OPCO                           | `ElearningOrder.paymentMode`/`opcoDossierRef` |

> **Montants en centimes entiers** (cohérent doc 05) ; conversion EUR à l'affichage uniquement. **Exonération TVA FOAD** (261-4-4° CGI) → `vatCents` souvent 0 ; le rapport affiche HT et TTC distincts. **CB éteinte** (ADR-0004) : `paymentMode=stripe` reste à 0 tant que `STRIPE_ENABLED=false` — le rapport le gère sans cas particulier.

### 4.5 Rapports de conformité FOAD (`foad-evidence`) — MVP, prioritaire

Voir §8 (export du faisceau de preuves). Vues console associées :

| Vue                                                     | Contenu                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tableau de bord conformité** (`compliance-dashboard`) | par session/cours : nb apprenants, % avec entrée effective, % avec évaluation finale (Ind.11), % avec assistance tracée (Ind.19), % certifiés |
| **Préparation contrôle** (`audit-prep`)                 | sélection (cours/période/entreprise) → génération du bundle ZIP (§8.3)                                                                        |

---

## 5. Dictionnaire des métriques (KPI) — contrat partagé

Définitions **figées** réutilisées par tous les rapports (`reporting/metrics.ts`), pour qu'un même mot dise la même chose partout (anti-divergence — leçon des audits content-gen).

| Clé                    | Définition exacte                                         | Formule / source                                                 |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `completion_pct`       | % de complétion du cours                                  | `CourseProgress.percentComplet`                                  |
| `is_completed`         | 100 % des leçons **obligatoires** terminées               | `CourseProgress.completedAt != null`                             |
| `is_passed`            | réussite (score ≥ seuil cours)                            | `CourseProgress.reussite`                                        |
| `time_active_sec`      | temps réel d'activité (preuve assiduité)                  | `CourseProgress.tempsTotalSec`                                   |
| `duree_action_h`       | durée **annoncée** de l'action (pièce légale)             | `ElearningCourse.dureeEstimeeMinutes / 60`                       |
| `score_global_pct`     | score global de réussite                                  | `CourseProgress.scoreGlobalPct`                                  |
| `taux_reussite`        | part d'apprenants `is_passed` sur inscrits actifs         | COUNT(reussite) / COUNT(actifs)                                  |
| `taux_abandon`         | inscrits jamais complétés et inactifs > 30 j              | règle `at-risk`                                                  |
| `effective_entry_rate` | % d'octrois avec `premiereConnexionAt` non nul            | EDOF / entrée effective                                          |
| `ind11_ok`             | a une `EvaluationAcquis type=finale` (jalon majeur)       | `CourseProgress.evaluationFinaleFaite`                           |
| `ind19_ok`             | ≥1 `ElearningAccompagnementLog` OU canal tuteur configuré | présence de trace d'assistance                                   |
| `ca_commande_ht_cents` | CA HT des commandes confirmées                            | Σ `ElearningOrder.totalHtCents` (statut ≥ `en_attente_paiement`) |
| `ca_encaisse_cents`    | encaissé                                                  | Σ `Payment.amountCents` (`status=succeeded`)                     |
| `restant_du_cents`     | dû non payé                                               | Σ `Invoice.amountTtcCents` − `ca_encaisse_cents`                 |

> **Fenêtres temporelles** : un filtre période s'applique à `accordeAt` (octroi) pour les rapports d'inscription, à `completedAt` pour la réalisation, à `occurredAt`/`createdAt` pour l'activité, à `paidAt`/`issuedAt` pour le financier. Le query builder **explicite** quelle colonne pilote la période (jamais ambigu).

---

## 6. Architecture technique de la couche reporting

### 6.1 Arborescence (NEUF, `src/server/elearning/reporting/`)

```
src/server/elearning/reporting/
  metrics.ts                 # dictionnaire §5 (clés + calculs purs)
  report-types.ts            # types: ReportId, ReportColumn, ReportRow, ReportFilters, ReportResult
  report-access.ts           # scoping par rôle/entreprise (RBAC + multi-tenant V2)
  reporting-service.ts       # façade: runReport(reportId, filters, ctx) → ReportResult (paginé)
  queries/
    learner-queries.ts       # 4.1
    course-queries.ts        # 4.2
    company-queries.ts       # 4.3
    revenue-queries.ts       # 4.4 (V1)
    compliance-queries.ts    # 4.5
  exporters/
    csv-export.ts            # ReportResult → CSV (csvField + BOM)
    xlsx-export.ts           # ReportResult[] → XLSX multi-onglets (exceljs, V1)
    pdf/
      report-pdf.tsx         # template générique React-PDF (QualiopiPage)
      foad-bundle-cover.tsx  # page de garde du bundle FOAD
  foad/
    foad-evidence.ts         # agrège le faisceau par enrollment (réutilise snapshot)
    foad-evidence-bundle.ts  # construit le ZIP (PDF + CSV + pièces R2)
  scheduled/
    scheduled-report-service.ts  # CRUD + résolution du prochain run
    run-scheduled-report.ts      # exécution (appelé par cron)
```

### 6.2 Contrat `ReportResult` (typé, partagé exports + UI)

```ts
// report-types.ts
export interface ReportColumn {
  key: string; // ex. "completion_pct"
  label: string; // ex. "Complétion (%)"
  type: "string" | "number" | "percent" | "duration_sec" | "money_cents" | "date" | "bool";
  pii?: boolean; // marque une colonne contenant de la PII (gating export, §11)
}
export interface ReportResult {
  reportId: string;
  generatedAt: string;
  filters: ReportFilters;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
  totals?: Record<string, number>; // pied de tableau (Σ temps, Σ CA…)
  page?: { offset: number; limit: number; total: number };
}
```

> **Un seul format intermédiaire** (`ReportResult`) alimente l'écran ET les trois exporteurs → aucune logique de calcul dupliquée par format. La PII est **déchiffrée au dernier moment** (champ `pii: true` + `pii-crypto.ts`), jamais stockée dans un cache.

### 6.3 Stratégie de performance des agrégations

1. **Lire les caches d'abord.** La majorité des chiffres viennent d'agrégats déjà matérialisés (`CourseProgress`, `ModuleProgress`, `ElearningPreuveRealisationSnapshot`). On **évite** les `GROUP BY` sur `ElearningXapiStatement` (table append-only volumineuse) sauf rapport « journal détaillé ».
2. **Pagination serveur obligatoire** (`offset/limit`) sur les tableaux liste ; les totaux (`totals`) sont calculés par une requête d'agrégat séparée, pas en chargeant toutes les lignes.
3. **Index exploités** : `CourseProgress @@index([courseId])`/`([statut])`, `ElearningEnrollment @@index([clientId])`/`([dernierAccesAt])`/`([source])`, `QuizAttempt @@index([quizId])`/`([enrollmentId])`, `ElearningOrder @@index([clientId])`/`([statut])`. Tout filtre du reporting tombe sur un index existant (vérifié docs 02/03/05).
4. **Gros exports → worker.** Au-delà d'un seuil (ex. 5 000 lignes ou export XLSX/ZIP), on **enqueue** un job (queue `elearning-crons` type `export-async`), on écrit le fichier sur **R2**, et on notifie par email avec une **URL signée courte** — au lieu de bloquer une Server Action (timeout / mémoire). Petits exports (< seuil) = synchrones (Server Action → Blob).
5. **Snapshots de reporting (option V1).** Pour les dashboards très consultés (`course-overview`, `compliance-dashboard`), le cron `preuves-foad` (déjà nocturne, `04-BE/03` §4.6) peut **étendre** son snapshot pour pré-agréger par cours → lecture O(1) le jour. Pas de table neuve si on enrichit `ElearningPreuveRealisationSnapshot` ; sinon `ElearningReportSnapshot` (§9.3) additif.
6. **Web Vitals** : pages reporting = admin, `force-dynamic`, **hors** des 15 pages stratégiques, mais on garde les bonnes pratiques : tableaux rendus **serveur**, graphiques (s'il y en a) en **client component `dynamic()`** lazy, pas de lib de charting lourde dans le bundle global (budget `size-limit`). Pas d'appel DB au build (`stub.invalid` : toutes ces pages sont derrière auth + `force-dynamic`).

### 6.4 Stub-aware

Tous les services reporting sont **stub-aware** : early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return EMPTY_REPORT;`. Les pages étant `force-dynamic` derrière auth, elles ne sont jamais rendues au SSG build → aucun risque, mais la garde reste posée par défense en profondeur (parité `portail-service.ts`).

---

## 7. Exports CSV / XLSX / PDF

### 7.1 CSV (MVP) — `exporters/csv-export.ts`

Réutilise **à l'identique** le pattern éprouvé (`observatoire/export-csv`, `BpfExportButton`) :

```ts
// csvField : anti-injection de formule Excel/Sheets (= + - @) + échappement.
function csvField(v: string | number | boolean | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise formule
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function reportToCsv(result: ReportResult): string {
  const header = result.columns.map((c) => csvField(c.label)).join(";"); // ';' = séparateur FR Excel
  const lines = result.rows.map((r) =>
    result.columns.map((c) => csvField(formatCell(r[c.key], c.type))).join(";"),
  );
  return "﻿" + [header, ...lines].join("\r\n"); // BOM UTF-8 + CRLF pour Excel FR
}
```

- **Séparateur `;`** (Excel FR ouvre directement ; le pattern observatoire public garde `,` car international — choix par export).
- **Formatage par type** (`formatCell`) : `percent` → `"86 %"`, `duration_sec` → `"6h41"`, `money_cents` → `"1 250,00"`, `date` → `"27/06/2026"`. Les exports **bruts** (option « données pour retraitement ») gardent les valeurs numériques non formatées + une 2ᵉ feuille (XLSX) ou un suffixe `_raw`.
- **Download** : Server Action `exportElearningReportCsvAction(reportId, filters)` → `{ csv, filename }` → composant `<ReportExportButton>` (calqué sur `BpfExportButton`, Blob + `URL.createObjectURL`). Pour les gros volumes → route handler `/api/admin/elearning/reports/[reportId]/export.csv` (stream, `force-dynamic`, `runtime nodejs`, parité `submissions/export`).

### 7.2 XLSX (V1) — `exporters/xlsx-export.ts`

- **Dépendance ajoutée : `exceljs`** (streaming writer). **Serveur/worker uniquement** (import dynamique côté Server Action / worker) → **zéro impact bundle client / Web Vitals**. Justification du choix vs CSV : multi-onglets, formats natifs (%, durée, monnaie), figeage d'en-tête, largeur de colonnes, et **un seul fichier pour un dossier OPCO** (synthèse + détail + preuves).
- **Multi-onglets** : un `ReportResult[]` → un classeur (ex. bundle entreprise = onglet `Synthèse`, `Salariés`, `Commandes`). Types de cellules mappés depuis `ReportColumn.type` (`numFmt` Excel : `0%`, `[h]:mm`, `# ##0,00 €`).
- **Gros classeurs → worker + R2** (§6.3 pt.4) : `exceljs` `WorkbookWriter` en stream vers un fichier temporaire → `uploadToR2('elearning/exports/<id>.xlsx')` → email URL signée.
- **Anti-injection** : `exceljs` écrit des cellules typées (pas de risque formule comme en CSV brut), mais on **force `cell.value` en string** pour les colonnes texte d'origine apprenant (nom, libre) afin d'éviter toute évaluation.

### 7.3 PDF (V1) — `exporters/pdf/report-pdf.tsx`

- Réutilise `@react-pdf/renderer` + `QualiopiPage`/`DocSection`/`FieldRow`/`pdfStyles` (cohérence visuelle avec les documents Qualiopi/factures).
- **Template générique** `ReportPdf({ result, titre, sousTitre, organisme })` : page de garde (logo OF via `getOrganismeIdentite`, période, filtres, date de génération, **n° de page**), tableau paginé, pied avec totaux + mention « Document de pilotage interne — non contractuel » (sauf bundle FOAD, §8, qui porte des mentions réglementaires).
- **PDF archivable** (optionnel) : pour une pièce officielle (bundle FOAD, rapport remis à un OPCO), passer par `generateDocument()` → numéro séquentiel + `hashSha256` + R2 + `qrToken` de vérification + rétention. Pour un simple PDF de confort (export écran), rendu à la volée sans archivage.
- **Budget** : génération PDF **serveur/worker** (jamais client). Gros rapports → worker.

### 7.4 Récapitulatif format ↔ usage

| Format | Usage type                                      | Sync/Async                                           | Stockage                        |
| ------ | ----------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| CSV    | retraitement, import compta, export rapide      | sync (petit) / async (gros)                          | éphémère (Blob) ou R2           |
| XLSX   | dossier multi-onglets, livrable entreprise/OPCO | async (worker) recommandé                            | R2 + URL signée                 |
| PDF    | rapport présentable, pièce remise, bundle FOAD  | sync (petit) / async + `generateDocument` (officiel) | éphémère ou R2/`DocumentGenere` |
| ZIP    | **bundle preuves FOAD** complet (§8)            | async (worker)                                       | R2 + URL signée                 |

---

## 8. Export des preuves FOAD (contrôle OPCO / DREETS) — prioritaire MVP

C'est la fonction **réglementairement critique**. Un contrôle OPCO/DREETS peut réclamer, par action et par stagiaire, le **faisceau de preuves de réalisation** (R.6313-3 : preuve **libre** mais le relevé de connexion **seul est insuffisant** ; faisceau = assiduité + évaluations + travaux + traces d'accompagnement + certificat).

### 8.1 Ce que prouve chaque pièce (mapping légal)

| Exigence                                                      | Pièce dans le bundle                            | Source                                                       |
| ------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Entrée effective (FOAD/EDOF)                                  | dates 1re connexion par apprenant               | `ElearningEnrollment.premiereConnexionAt`                    |
| Assiduité / activités réelles                                 | relevé temps + nb vues + leçons complétées      | `LessonProgress`/`CourseProgress` + `ElearningXapiStatement` |
| Durée moyenne de l'action (D.6313-3-1 §2)                     | durée annoncée                                  | `ElearningCourse.dureeEstimeeMinutes`                        |
| **Évaluations qui jalonnent/concluent (Ind.11 majeur)**       | relevés de quiz + `EvaluationAcquis` finale     | `QuizAttempt` + `EvaluationAcquis`                           |
| Travaux rendus                                                | fichiers devoirs (`type=devoir`)                | `LessonProgress.devoirR2Key` (R2)                            |
| **Assistance technique ET pédagogique (Ind.19)**              | journal des relances + réponses tuteur + délais | `ElearningAccompagnementLog`                                 |
| Certificat de réalisation (modèle officiel, heures centièmes) | PDF + vérifiabilité QR                          | `DocumentGenere` (via `certificatDocumentId`)                |
| Logs LMS horodatés                                            | extrait `xapi` (temps serveur, IP hachée)       | `ElearningXapiStatement`                                     |

### 8.2 `foad-evidence.ts` — agrégat par inscription

`buildFoadEvidence(enrollmentId)` lit en priorité le **snapshot** (`ElearningPreuveRealisationSnapshot`, cache nocturne) et complète au fil de l'eau (dernière activité du jour). Retourne un `FoadEvidence` typé : identité apprenant (déchiffrée serveur), entreprise (via `Client`), action (cours, modalité FOAD, durée annoncée), assiduité (temps réel, leçons, dates), évaluations (quiz + éval finale), travaux (clés R2), assistance (logs), certificat (réf + `qrToken`).

### 8.3 `foad-evidence-bundle.ts` — bundle ZIP (worker)

Pour une sélection (1 cours / 1 session / 1 entreprise / 1 période, ou 1 apprenant), génère un **ZIP** structuré, **toujours en worker** (volumineux) → R2 → email URL signée :

```
bundle-foad-<ref>-<date>.zip
├─ 00-synthese.pdf                  # page de garde + tableau récap (ReportPdf, mentions Ind.11/19)
├─ 01-attestations-assiduite.csv    # 1 ligne/apprenant : temps réel, leçons, dates, score
├─ 02-evaluations.csv               # 1 ligne/quiz/apprenant : score, réussite, type, date
├─ 03-assistance.csv                # ElearningAccompagnementLog (relances, réponses, délais)
├─ 04-logs-lms.csv                  # extrait xAPI horodaté (verbe/objet/temps serveur)
├─ certificats/                     # PDF certificats de réalisation (depuis DocumentGenere/R2)
│   └─ <apprenant>-certificat-<numero>.pdf
└─ travaux/                         # devoirs rendus (LessonProgress.devoirR2Key)
    └─ <apprenant>-<lecon>.<ext>
```

- **Pièces depuis R2** : récupérées via `getObjectBufferR2` (fail-soft : un fichier manquant n'avorte pas le ZIP, il est listé « absent » dans `00-synthese`).
- **PII** : noms complets autorisés **dans le bundle** (destiné au contrôle légal, base juridique = obligation légale OF) — mais **journalisé** (qui a généré le bundle, quand, pour quel périmètre → `ActivityLog`, §11). Les exports « écran » par défaut masquent (Prénom + initiale) ; le bundle FOAD est l'exception assumée et tracée.
- **Conservation** : le ZIP est éphémère (URL signée 7 j) ; les **sources** restent la vérité (rétention 3–5 ans preuves de réalisation, doc 02 §10). On ne stocke pas le ZIP en base.
- **Stub-aware** + **idempotence** (`jobId = el-foad-bundle-<scopeHash>`).

### 8.4 Alimentation du BPF / certificat de réalisation existants

Le reporting **ne réécrit pas** le BPF Qualiopi. Il **fournit les chiffres FOAD** (heures réalisées agrégées, nb stagiaires FOAD, par financeur) consommés par l'`exportBpfCsvAction` existant : on **étend** la source du BPF pour additionner les actions e-learning (durée annoncée × stagiaires ayant l'entrée effective) aux actions présentiel/live. De même, `computeHeuresRealisees` (worker certificat, `04-BE/03` §5) lit la même couche. **Un seul moteur de chiffres**, deux consommateurs (BPF + certificat).

---

## 9. Rapports planifiés

Permettre d'**envoyer automatiquement** un rapport (ex. « synthèse hebdo des cours », « avancement mensuel de l'entreprise X », « apprenants à risque chaque lundi ») par email, sans action manuelle.

### 9.1 Modèle `ElearningScheduledReport` (NEUF, additif)

```prisma
enum ElearningReportFormat { csv xlsx pdf }
enum ElearningReportFrequency { quotidien hebdomadaire mensuel }

model ElearningScheduledReport {
  id            String                  @id @default(uuid())
  libelle       String                  @db.VarChar(200)
  reportId      String                  @map("report_id") @db.VarChar(60)   // ex. "course-overview"
  /// Filtres figés du rapport (période relative, courseId, clientId…). JSON typé ReportFilters.
  filtresJson   Json                    @default("{}") @map("filtres_json")
  format        ElearningReportFormat   @default(xlsx)
  frequence     ElearningReportFrequency
  /// Heure d'envoi (UTC) + jour (hebdo: 1-7, mensuel: 1-28). Pilote le prochain run.
  heureUtc      Int                     @default(6) @map("heure_utc")
  jour          Int?                                                         // hebdo/mensuel
  /// Destinataires (emails). MVP : admin/référent. V2 : contact entreprise (scoping clientId).
  destinataires Json                    @default("[]")                       // string[]
  /// Entreprise concernée (scoping multi-tenant). Null = global Axion-IA.
  clientId      String?                 @map("client_id") @db.Uuid
  actif         Boolean                 @default(true)
  createdByAdminId String?              @map("created_by_admin_id") @db.Uuid
  prochainRunAt DateTime?               @map("prochain_run_at")
  dernierRunAt  DateTime?               @map("dernier_run_at")
  runs          ElearningReportRun[]
  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")
  @@index([actif, prochainRunAt])
  @@index([clientId])
  @@map("elearning_scheduled_reports")
}

model ElearningReportRun {
  id            String   @id @default(uuid())
  scheduledId   String   @map("scheduled_id")
  scheduled     ElearningScheduledReport @relation(fields: [scheduledId], references: [id], onDelete: Cascade)
  statut        String   @db.VarChar(20)     // succes | echec
  nbLignes      Int?     @map("nb_lignes")
  r2Key         String?  @map("r2_key")        // fichier généré (rétention courte)
  erreurMessage String?  @map("erreur_message")
  startedAt     DateTime @default(now()) @map("started_at")
  finishedAt    DateTime? @map("finished_at")
  @@index([scheduledId])
  @@map("elearning_report_runs")
}
```

### 9.2 Exécution (cron, réutilise `elearning-crons`)

- Nouveau type de job cron `elearning-crons.scheduled-reports` (pattern ex. `0 6 * * *`, ajouté dans `bootRepeatableJobs()` à côté des autres crons e-learning, `04-BE/03` §9.2). Le handler :
  1. `stub.invalid` → return ; sinon `findMany({ where: { actif: true, prochainRunAt: { lte: now } } })`.
  2. Pour chaque (fail-soft par entité) : résout les **filtres relatifs** (« 7 derniers jours »), `runReport()`, exporte au `format`, écrit sur R2, `enqueueEmail('elearning-rapport-planifie', destinataire, 'fr', { url, libelle })` (URL signée courte), crée `ElearningReportRun`, recalcule `prochainRunAt` (selon `frequence`), set `dernierRunAt`.
  3. Idempotence : `jobId` du run = `el-sched-<id>-<yyyymmdd>` → pas de double envoi si le cron rejoue.
- **Email** : nouveau `EmailJobName` `elearning-rapport-planifie` (transactionnel, expéditeur `noreply@`, footer identité OF). Pas de PJ lourde → lien R2 signé.
- **Scoping** : si `clientId` non nul, `report-access.ts` force le prédicat → un rapport entreprise n'expose que ses salariés (prépare V2).

### 9.3 (Option) `ElearningReportSnapshot` pour dashboards très consultés

Si l'on veut des dashboards instantanés sans recompute : table additive `ElearningReportSnapshot { id, reportId, scopeKey, payloadJson, computedAt }` peuplée par le cron nocturne. **Recommandation** : commencer **sans** (les agrégats `CourseProgress`/snapshot preuves suffisent) ; ajouter seulement si un dashboard dépasse le budget de latence. Décision à porter en `06-strategie-migrations.md`.

---

## 10. Tableaux par rôle (RBAC + scoping)

Les rôles existants (`_guards.ts`) : `super_admin`, `admin`, `editor`, `reader`. Le LMS introduit aussi un **référent pédagogique / tuteur** (destinataire des escalades Ind.12, `ELEARNING_REFERENT_PEDAGO_EMAIL`) et, en **V2**, l'**admin entreprise délégué** (multi-tenant). On **ne crée pas** de nouveau système d'autorisation : on **mappe** ces besoins sur les guards existants + un prédicat de **scoping** (`report-access.ts`).

### 10.1 Matrice d'accès

| Capacité                                               | reader | editor | admin | super_admin |  tuteur/référent¹   |   admin entreprise² (V2)   |
| ------------------------------------------------------ | :----: | :----: | :---: | :---------: | :-----------------: | :------------------------: |
| Voir dashboards pédagogiques (complétion/temps/scores) |   ✅   |   ✅   |  ✅   |     ✅      |   ✅ (ses cours)    |    ✅ (son entreprise)     |
| Voir « apprenants à risque » (Ind.12)                  |   ✅   |   ✅   |  ✅   |     ✅      |         ✅          |             ✅             |
| Voir rapport **financier / CA**                        |   ❌   |   ❌   |  ✅   |     ✅      |         ❌          | ❌ (ses commandes seules)³ |
| Exporter CSV/XLSX **sans PII** (agrégats)              |   ✅   |   ✅   |  ✅   |     ✅      |         ✅          |             ✅             |
| Exporter CSV/XLSX **avec PII** (noms complets)         |   ❌   |   ✅   |  ✅   |     ✅      | ✅ (ses apprenants) |     ✅ (ses salariés)      |
| Générer **bundle FOAD** (OPCO/DREETS)                  |   ❌   |   ✅   |  ✅   |     ✅      |         ✅          |             ❌             |
| Créer/modifier un **rapport planifié**                 |   ❌   |   ✅   |  ✅   |     ✅      |         ❌          |             ❌             |
| Supprimer un rapport planifié                          |   ❌   |   ❌   |  ✅   |     ✅      |         ❌          |             ❌             |

¹ Le **tuteur/référent** n'est pas un rôle NextAuth distinct au MVP : c'est un `editor`/`admin` dont la vue est **scopée à ses cours** via `report-access.ts` (paramètre de config). En attendant un vrai rôle, l'escalade Ind.12 lui parvient par **email** (worker), pas par une vue dédiée — la vue arrive en V1.
² L'**admin entreprise** est **V2** (ADR-0002) : authentifié hors NextAuth admin, scoping **forcé** `clientId`, accès **lecture seule** à ses salariés.
³ Le CA visible par une entreprise se limite à **ses** commandes/factures (jamais le CA global Axion-IA).

### 10.2 Mapping vers les guards

| Action de reporting                    | Guard                                        |
| -------------------------------------- | -------------------------------------------- |
| Lire un rapport (sans PII / agrégats)  | `requireAdminRead`                           |
| Exporter avec PII / bundle FOAD        | `requireAdminWrite` (+ journal d'export §11) |
| Voir / exporter le **financier CA**    | `requireAdminPublish` (admin/super_admin)    |
| CRUD rapport planifié (créer/modifier) | `requireAdminWrite`                          |
| Supprimer rapport planifié             | `requireAdminPublish`                        |

> **`report-access.ts`** reçoit `{ role, clientScope?, courseScope? }` et **injecte un prédicat Prisma obligatoire** (`where.clientId = ...`) que **toutes** les requêtes du rapport doivent appliquer. C'est le point unique qui rendra le multi-tenant V2 sûr sans réécriture (on passe le `clientId` du tenant au lieu du filtre admin).

---

## 11. Sécurité, RGPD & conservation

- **PII minimisée par défaut** : tout rapport affiche **Prénom + initiale** sauf si l'utilisateur a le droit « export PII » (matrice §10) et le coche explicitement. Le bundle FOAD (obligation légale) est l'exception, **tracée**.
- **Déchiffrement au dernier moment** : les colonnes `pii: true` passent par `pii-crypto.ts` côté serveur juste avant l'export ; **jamais** mises en cache ni en snapshot de reporting.
- **Journal d'export (RGPD)** : chaque export contenant de la PII écrit un `ActivityLog` `{ action: "elearning.report.export", userId, reportId, format, pii: true, scope (courseId/clientId/période), nbLignes }`. Permet de répondre « qui a sorti les données de M. X et quand ». Réutilise l'`ActivityLog` déjà alimenté par `generateDocument`.
- **Anti-injection CSV** : `csvField` neutralise les préfixes de formule (`= + - @`). XLSX : cellules typées + forçage string sur champs d'origine apprenant.
- **R2** : exports volumineux servis par **URL signée courte** (900 s pour un download écran ; 7 j pour un bundle FOAD envoyé par email), jamais d'URL publique. Récupération de pièces via `getObjectBufferR2` côté worker uniquement.
- **Conservation** :
  - Fichiers d'export générés (CSV/XLSX/PDF/ZIP sur R2) = **éphémères** (lifecycle R2 / purge ; pas de valeur de preuve propre, ce sont des dérivés).
  - Les **sources** suivent la rétention FOAD : preuves de réalisation **3–5 ans** (L.6362-6), comptable/financier **6 ans fiscal / 10 ans comptable** (L.102B LPF / L.123-22), logs techniques `ElearningXapiStatement` **6–12 mois** (CNIL 2021-122, purgés par `elearning-xapi-purge-worker`).
  - `ElearningReportRun.r2Key` pointant un fichier purgé → l'UI affiche « expiré, régénérer ».
- **Stub-aware** + `force-dynamic` : aucune fuite au build.

---

## 12. Console admin — routes, navigation, composants

### 12.1 Routes (sous `(admin)/[adminPrefix]/elearning/reporting/`)

| Route                                                                            | Rapport                                               | Guard                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| `…/elearning/reporting`                                                          | accueil reporting (cartes `StatCard` + accès rapides) | read                      |
| `…/elearning/reporting/apprenants`                                               | `learner-by-course` / `at-risk` (filtre cours)        | read                      |
| `…/elearning/reporting/apprenants/[traineeId]`                                   | `learner-detail` + relevé réalisation                 | read (export PII = write) |
| `…/elearning/reporting/cours`                                                    | `course-overview`                                     | read                      |
| `…/elearning/reporting/cours/[courseId]`                                         | `course-funnel` + `quiz-analysis`                     | read                      |
| `…/elearning/reporting/entreprises`                                              | `company-summary` (liste `Client`)                    | read                      |
| `…/elearning/reporting/entreprises/[clientId]`                                   | `company-learners` + `company-by-order`               | read                      |
| `…/elearning/reporting/financier`                                                | `revenue` (V1)                                        | **publish**               |
| `…/elearning/reporting/conformite`                                               | `compliance-dashboard` + `audit-prep` (bundle FOAD)   | read / write (bundle)     |
| `…/elearning/reporting/planifies`                                                | CRUD `ElearningScheduledReport` (V1)                  | write                     |
| Route handler `…/api/admin/elearning/reports/[reportId]/export.(csv\|xlsx\|pdf)` | download (gros volumes)                               | selon §10                 |

### 12.2 Navigation (`src/lib/admin-nav.ts`, monté par **`AdminSidebarNav.tsx`**)

Ajouter sous le pôle **e-learning** une entrée **« Reporting & conformité »** avec sous-entrées : _Apprenants_, _Cours_, _Entreprises_, _Financier_ (visible admin/super*admin), \_Conformité FOAD*, _Rapports planifiés_. (Cohérent avec les sous-entrées e-learning déjà prévues par les docs 03/05 : _Banque de questions_, _Quiz_, _Corrections en attente_, _Commandes_, _Coupons_, _Sièges entreprise_, _Certificats_.)

### 12.3 Composants (`src/components/admin/elearning/reporting/`)

- `<ReportTable>` — wrapper de `AdminTable` consommant un `ReportResult` (tri, pagination serveur, formatage par `ReportColumn.type`, badges `AdminBadge` pour statut/réussite).
- `<ReportFilters>` — barre de filtres commune (période, cours, entreprise, statut, source) → met à jour les `searchParams` (server-driven).
- `<ReportExportButton>` — bouton CSV/XLSX/PDF (calqué sur `BpfExportButton` : Server Action → Blob, ou redirection route handler pour gros volume).
- `<ReportKpiCards>` — `StatCard` (complétion moyenne, temps total, taux de réussite, CA…).
- `<FoadBundleDialog>` — sélection de périmètre + bouton « Générer le dossier de preuves » (enqueue worker, feedback async).
- `<ScheduledReportForm>` — CRUD rapport planifié.
- _(Graphiques optionnels V1)_ `<ReportChart>` — client component `dynamic()` lazy (entonnoir, courbe d'activité), hors bundle global.

---

## 13. Data model — récapitulatif additif (ADR-0008)

**Nouvelles tables** : `elearning_scheduled_reports`, `elearning_report_runs`. _(Optionnel V1 : `elearning_report_snapshots`.)_
**Nouveaux enums** : `ElearningReportFormat`, `ElearningReportFrequency`.
**Aucune colonne ajoutée à une table existante** par le reporting lui-même (il **lit** ce que les docs 02/03/05 ont déjà ajouté). L'extension du **snapshot de preuves** (si retenue) reste additive sur `ElearningPreuveRealisationSnapshot` (doc 04-BE/03).
**Nouveau `EmailJobName`** : `elearning-rapport-planifie` (queue `emails` existante).
**Nouveau type de cron** : `elearning-crons.scheduled-reports` (+ `elearning-crons.export-async` pour les gros exports) dans la queue `elearning-crons` existante.
**Dépendance** : `exceljs` (serveur/worker only, V1).
**Aucun DROP. Aucune donnée modifiée.**

---

## 14. Tests (Vitest, mock Prisma)

- `metrics.spec.ts` — chaque clé du dictionnaire §5 calcule la bonne valeur (cas limites : 0 inscrit → pas de division par zéro ; temps réel vs durée annoncée distincts).
- `csv-export.spec.ts` — `csvField` neutralise `=cmd`, `+1`, `-1`, `@x` ; échappement `"`/`;`/`\n` ; BOM présent ; séparateur FR.
- `xlsx-export.spec.ts` — multi-onglets, `numFmt` par type, champs apprenant forcés string.
- `report-access.spec.ts` — un `reader` ne voit pas le financier ; un scope `clientId` filtre bien (prépare V2) ; export PII refusé sans `requireAdminWrite`.
- `foad-evidence-bundle.spec.ts` — bundle contient les 5 CSV + certificats + travaux ; **fail-soft** sur pièce R2 manquante (listée « absente », ZIP non avorté) ; PII présente **et** `ActivityLog` écrit.
- `scheduled-report.spec.ts` — recalcul `prochainRunAt` (quotidien/hebdo/mensuel), idempotence du run (`jobId` daté), fail-soft par entité.
- **Stub-aware** — `DATABASE_URL=…stub.invalid` → services reporting return `EMPTY_REPORT`, 0 query.
- **Conformité wording** — réutilise l'esprit du garde-fou `banned-phrases` : un rapport « certificat de réalisation » n'emploie jamais « certification »/« RNCP »/« CPF éligible » (cohérent `05-FE/06`).

---

## 15. Phasage (aligné roadmap `11-ROADMAP/01`)

| Livrable                                                           | MVP |    V1    | V2  |
| ------------------------------------------------------------------ | :-: | :------: | :-: |
| Rapports apprenant / cours / entreprise (lecture + filtres)        | ✅  |          |     |
| Export **CSV**                                                     | ✅  |          |     |
| **Bundle preuves FOAD** (ZIP OPCO/DREETS) + dashboard conformité   | ✅  |          |     |
| Alimentation BPF/certificat avec chiffres FOAD                     | ✅  |          |     |
| Journal d'export RGPD (`ActivityLog`) + matrice RBAC               | ✅  |          |     |
| Export **XLSX** (multi-onglets) + **PDF** mis en page              |     |    ✅    |     |
| Rapport **financier / CA**                                         |     |    ✅    |     |
| **Rapports planifiés** (cron → email)                              |     |    ✅    |     |
| Vue dédiée tuteur/référent + graphiques                            |     |    ✅    |     |
| Reporting **par tenant** (admin entreprise délégué, scoping forcé) |     |          | ✅  |
| Snapshots de reporting pré-agrégés (si besoin perf)                |     | (option) | ✅  |

> **MVP minimal mais conforme** : sans rapports planifiés ni XLSX, on couvre déjà le **critère de sortie MVP** (« toutes les preuves FOAD sont produites et exportables ») via le bundle ZIP + CSV. XLSX/PDF/planifiés/CA = confort et industrialisation V1.

---

## 16. EXISTANT vs NEUF — récap

**Réutilisé (zéro duplication)** : pattern export CSV (`csvField`, BOM, route handler download) ; `@react-pdf/renderer` + `QualiopiPage`/`pdfStyles` + `generateDocument` ; R2 (`uploadToR2`/`getSignedUrlR2`/`getObjectBufferR2`) ; BullMQ (`queues.ts`/`worker.ts`/`bootRepeatableJobs`/`enqueueEmail`) ; agrégats `CourseProgress`/`ModuleProgress`/`ElearningPreuveRealisationSnapshot` ; `QuizAttempt`/`EvaluationAcquis` ; `ElearningOrder`/`Invoice`/`Payment` ; `DocumentGenere`(+QR) ; `ElearningAccompagnementLog` ; `ActivityLog` (journal d'export) ; RBAC `requireAdmin*` ; `AdminPageShell`/`StatCard`/`AdminTable`/`AdminBadge` + `admin-nav.ts` (monté par `AdminSidebarNav.tsx`) ; `exportBpfCsvAction`/`ExportComptaButton` (le reporting **alimente** le BPF, ne le réécrit pas).

**Neuf (ce document)** :

- Services : `reporting-service.ts`, `metrics.ts`, `report-types.ts`, `report-access.ts`, query builders (`learner/course/company/revenue/compliance-queries.ts`), exporteurs (`csv-export.ts`, `xlsx-export.ts`, `pdf/report-pdf.tsx`), FOAD (`foad-evidence.ts`, `foad-evidence-bundle.ts`), planifiés (`scheduled-report-service.ts`, `run-scheduled-report.ts`).
- Tables : `elearning_scheduled_reports`, `elearning_report_runs` (+ optionnel `elearning_report_snapshots`) ; enums `ElearningReportFormat`/`ElearningReportFrequency`.
- Crons/jobs : `elearning-crons.scheduled-reports`, `elearning-crons.export-async` ; `EmailJobName` `elearning-rapport-planifie`.
- UI : pages `(admin)/.../elearning/reporting/**` + composants `ReportTable`/`ReportFilters`/`ReportExportButton`/`ReportKpiCards`/`FoadBundleDialog`/`ScheduledReportForm` (+ `ReportChart` V1).
- Dépendance : `exceljs` (serveur/worker only).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0002 (multi-tenant V2 → scoping reporting), 0003 (CPF/EDOF gated → entrée effective dans les preuves), 0004 (Stripe éteint → CA `paymentMode`), 0007 (cloisonnement), 0008 (migrations additives).
- `02-ARCHITECTURE/architecture-globale.md` — couche `compliance/` (faisceau preuves, `evidence-export.ts`), reporting §11.
- `02-ARCHITECTURE/multi-tenant-strategie.md` — V2 : reporting par tenant (scoping forcé `clientId`).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (`seuilReussitePct`, `dureeEstimeeMinutes`, `estFoad`).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `CourseProgress`/`ModuleProgress`/`LessonProgress`, `ElearningEnrollment`, `ElearningXapiStatement` (**sources n°1** du reporting).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `QuizAttempt`/`QuizAttemptAnswer`/`EvaluationAcquis` (scores, item analysis, Ind.11).
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder`/`Invoice`/`Payment`/`ElearningSeat`/coupons (rapport CA).
- `03-DATA-MODEL/06-strategie-migrations.md` — placement des tables `scheduled_reports`/`report_runs` (+ snapshot optionnel) dans l'ordre des migrations additives.
- `04-BACKEND/03-workers-bullmq-crons.md` — queue `elearning-crons`, `ElearningPreuveRealisationSnapshot`, `ElearningAccompagnementLog`, cron `preuves-foad` (cache de reporting), `enqueueEmail`.
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — `DocumentGenere`/`qrToken`, durée action vs temps réel, `ElearningBadgeAward`, wording interdit (test conformité).
- `06-CONSOLE-ADMIN/02-pilotage-dashboard.md` — dashboard de pilotage (consomme `reporting-service`).
- `06-CONSOLE-ADMIN/04-gestion-apprenants.md` & `05-gestion-acces-entreprises.md` — points d'entrée vers les fiches/rapports détaillés.
- `06-CONSOLE-ADMIN/07-gestion-certificats.md` — liste des certificats émis (consommée par le reporting conformité).
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md` (Ind.11/12/19), `05-rgpd-conservation-preuves.md`, `06-tracabilite-preuves-realisation.md` — fondement légal du bundle FOAD et des rétentions.
- `09-QUALITE/03-web-vitals-performance.md` — budgets (charts lazy, `exceljs` serveur-only), `04-accessibilite-wcag22.md` — tableaux accessibles.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage reporting (MVP CSV+FOAD, V1 XLSX/PDF/CA/planifiés, V2 tenant).
