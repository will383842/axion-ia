# A5-04 — Console Qualité — Score 28/100

Audit AUDIT-ONLY — 2026-05-21 — Agent A5-04
Repo : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
Zéro commit, zéro modification source.

---

## Fichiers inspectés

| Fichier | Statut |
|---|---|
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/_v2/QualityV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/_v2/ReviewQueueListV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/_v2/ReviewDetailV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/page.tsx` | Lu |
| `src/server/actions/content-gen/review.ts` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications-status/_v2/PublicationsStatusV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/[id]/_v2/JobDetailV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications/_v2/PublicationsV2.tsx` | Lu |
| `prisma/schema.prisma` (extraits lignes 2940–2984, 585, 2046, 2203–2215) | Lu |
| `src/server/actions/content-gen/**` (glob liste) | Lu |
| `src/server/queue/workers/content-quality-improver-worker.ts` (extraits grep) | Extrait grep |

---

## État actuel

### Quality dashboard (QualityV2.tsx)

Le dashboard principal `/content-gen/quality` affiche :
- 5 barres CSS (ScoreBar) de moyennes pondérées globales sur 30 jours : SEO, Quality, Readability, Fact-check, Editorial
- Un tableau jour par jour (30 lignes max) avec compteur + 5 moyennes journalières
- Source : `prisma.article.findMany({ status: "published", publishedAt >= J-30 })` agrégé côté serveur
- Granularité : agrégats par jour uniquement — aucune donnée par article individuel

Absence totale : histogramme de distribution, médiane, p10/p90, scores LLM-judge par article, feedback Will, compteur d'itérations.

### Review Queue (ReviewQueueListV2.tsx)

La liste affiche par item : date, type, ville, Quality (score numérique brut du job), SEO (score brut), statut, actions (Détail / Approuver / Rejeter).

Le rejet rapide depuis la liste passe `notes = "Rejet rapide via liste"` en dur — pas de saisie de raison textuelle depuis la liste (uniquement depuis le détail).

Filtrage par statut (pending / approved / rejected / needs_edits / promoted_t1), pagination 50/page.

### Review Detail (ReviewDetailV2.tsx)

Affiche : iframe aperçu signé 10 min + JSON brut debug + 4 actions :
- Approuver (tier-2) avec notes optionnelles
- Promouvoir tier-1 direct
- Demander des modifs (textarea guidance LLM, min 10 chars) → `requestEdits` → status `needs_edits` + job `quality_improving`
- Rejeter avec notes obligatoires (min 5 chars)

Les scores quality/SEO sont affichés dans le header via `description`. Pas de relance directe depuis le détail rejet (il faut passer par `requestEdits` qui re-prompt le LLM).

### Modèle Article / ContentGenJob

`ContentGenJob` expose : `qualityScore`, `seoScore`, `plagiarismScore`, `readabilityScore`, `doctrineCheckPassed`, `qualityImprovementAttempts` (DB).

`Article` expose : `qualityScore`, `seoScore`, `readabilityScore`, `factCheckScore`, `editorialScore`.

Modèles absents du schéma : `ArticleFeedback`, `QualityJudgment`.

### Worker quality-improver

`content-quality-improver-worker.ts` incrémente `qualityImprovementAttempts` à chaque tentative, log `attempt=N/maxAttemptsAuto` dans les GenerationLogs. Ce compteur n'est pas transmis à `ReviewDetailV2` (le `page.tsx` n'inclut pas ce champ dans le `ReviewData` passé au composant).

---

## Gaps identifiés

### P0 (bloquant)

**P0-1 — Aucun score LLM-judge par article dans l'UI**
`QualityV2` n'expose aucun score au niveau article individuel. La review-queue affiche uniquement les scores bruts du job (`qualityScore`, `seoScore`) sans détail des sous-critères (cohérence, doctrine, plagiat, readability séparés). La page `/jobs/[id]` affiche les 5 métriques individuelles mais n'est pas intégrée dans le flow qualité.

**P0-2 — Feedback Will thumbs up/down absent**
Le modèle `ArticleFeedback` n'existe pas dans `prisma/schema.prisma`. Aucun endpoint API `/api/admin/content-gen/articles/[id]/feedback/` n'existe. Aucune UI de feedback humain (pouces, étoiles, notation) n'est présente dans les composants inspectés. Gap total.

**P0-3 — `qualityImprovementAttempts` non affiché dans l'UI**
Le champ est incrémenté en DB par le worker et loggé dans les GenerationLogs, mais `ReviewDetailV2` reçoit un `ReviewData` qui n'inclut pas ce champ (cf. `page.tsx` ligne 28-42). Aucune page de la console qualité n'affiche le nombre d'itérations par article.

### P1 (important)

**P1-1 — Distribution des scores : pas de médiane ni p10/p90**
`QualityV2` calcule uniquement des moyennes pondérées (avg). Pas de tri pour médiane, pas de percentiles. Avec des pipelines à haut volume, la moyenne seule masque la longue traîne basse.

**P1-2 — Pas d'histogramme / courbe temporelle**
Données agrégées uniquement en tableau texte. Aucun rendu visuel des distributions de scores au fil du temps.

**P1-3 — Rejet depuis liste sans raison textuelle**
`ReviewQueueListV2` passe `notes = "Rejet rapide via liste"` en dur pour le rejet inline. La raison réelle de rejet n'est pas captée depuis la liste — seul le détail offre un textarea de raison.

**P1-4 — Pas de bouton "Relancer génération" depuis la liste des rejetés**
La liste filtrée sur `status=rejected` affiche les items rejetés avec leurs scores, mais n'offre pas de bouton "Re-générer" ou "Retry" depuis la liste. Il faut naviguer vers le détail puis utiliser `requestEdits` (qui demande une guidance LLM, ce n'est pas un simple retry).

**P1-5 — `qualityImprovementAttempts` absent du ReviewDetailV2**
Le `page.tsx` parent ne transmet pas `job.qualityImprovementAttempts` au composant `ReviewDetailV2`. Correction = 1 ligne dans l'interface + 1 ligne dans le `select`.

### P2 (nice-to-have)

**P2-1 — Pas de badge couleur sur les scores**
Les scores sont affichés en texte brut (ex: `74`). Un badge vert/orange/rouge selon seuils (ex: <50 = rouge, 50-74 = orange, ≥75 = vert) améliorerait la lisibilité.

**P2-2 — Pas de comparaison score avant/après itération**
Le worker log `verdict=PASS/FAIL globalScore=XX attempt=N` dans GenerationLogs mais aucune UI ne visualise l'évolution du score entre tentatives (delta +5 pts, etc.).

**P2-3 — Fenêtre fixe 30 jours dans QualityV2**
`WINDOW_DAYS = 30` est une constante. Pas de sélecteur de période (7j / 30j / 90j).

**P2-4 — Pas de stats globales (min, max, count par bucket)**
La table jour par jour donne des moyennes mais pas de min/max/count-below-threshold qui permettraient de détecter des runs de mauvaise qualité.

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 Score LLM-judge par article | 25 | 8 | Scores numériques (quality + SEO) visibles dans review-queue et job-detail, mais sans badge couleur ni détail des sous-critères par article dans le flow qualité. Correspond au niveau "label qualitatif" car il s'agit de scores agrégés job-level non exposés dans la console quality dédiée. |
| C2 Distribution des scores | 20 | 5 | Tableau jour par jour avec comptage articles + moyennes = bucket simple par jour. Pas de médiane, p10/p90, histogramme ou courbe. Correspond au niveau "compteur par bucket". |
| C3 Articles rejetés avec raison | 25 | 15 | Liste rejetés accessible (filtre `status=rejected` dans ReviewQueueListV2), raison textuelle obligatoire depuis le détail (min 5 chars), stockée en `reviewNotes`. Bulk-reject stocke une raison générique. Kanban "Refusé" visible dans PublicationsStatusV2. Pas de bouton relance génération depuis la liste des rejetés (nécessite passage par requestEdits). Score 15 (liste + raison sans relance directe). |
| C4 Feedback Will thumbs up/down | 20 | 0 | Modèle `ArticleFeedback` absent du schéma Prisma. Aucun endpoint feedback article. Aucune UI thumbs up/down dans les composants inspectés. |
| C5 Articles améliorés N itérations | 10 | 0 | `qualityImprovementAttempts` présent en DB (schéma + worker qui l'incrémente), mais non transmis à `ReviewDetailV2` ni affiché dans aucune page de la console qualité. Gap UI total. |
| **TOTAL** | **100** | **28** | |

---

## Recommandations P0 urgentes

### P0-A — Exposer `qualityImprovementAttempts` dans ReviewDetailV2 (effort ~30 min)

Dans `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/page.tsx`, ajouter `qualityImprovementAttempts` dans la query Prisma et le passer au composant. Dans `ReviewDetailV2.tsx`, ajouter un champ dans la section "Aperçu" : `{review.job.qualityImprovementAttempts ?? 0} tentative(s) d'amélioration`. Passe C5 de 0 à 5.

### P0-B — Créer modèle `ArticleFeedback` + endpoint + UI thumbs (effort ~4-6h)

Migration Prisma :
```prisma
model ArticleFeedback {
  id        String   @id @default(cuid())
  articleId String   @db.Uuid
  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  vote      Int      // +1 = up, -1 = down
  adminId   String
  comment   String?  @db.VarChar(500)
  createdAt DateTime @default(now())

  @@unique([articleId, adminId])
  @@index([articleId])
  @@map("article_feedback")
}
```

Route API : `POST /api/admin/content-gen/articles/[id]/feedback` (body : `{ vote: 1 | -1, comment? }`).

UI : Deux boutons `👍 / 👎` dans `ReviewDetailV2` + stats agrégées (% positif / negatif) dans `QualityV2`. Passe C4 de 0 à 20.

### P0-C — Score LLM-judge détaillé par article dans ReviewDetailV2 (effort ~2h)

Transmettre les 5 sous-scores (quality, SEO, readability, factCheck, editorial) depuis `page.tsx` au composant `ReviewDetailV2`. Afficher une grille de badges colorés (vert ≥75 / orange 50-74 / rouge <50) dans la carte "Aperçu". Passe C1 de 8 à 15.

### P0-D — Distribution des scores dans QualityV2 (effort ~2h)

Ajouter dans `loadDailyScores()` le calcul de médiane et p10/p90 en mémoire sur les tableaux `_qual[]` et `_seo[]` (sort + index). Ajouter une carte "Distribution" avec min / max / médiane / p10 / p90. Passe C2 de 5 à 12.

---

## Impact potentiel des corrections

| Correction | Effort | Gain pts |
|---|---|---|
| P0-C (scores détaillés par article) | 2h | +7 (C1 8→15) |
| P0-D (médiane + p10/p90) | 2h | +7 (C2 5→12) |
| P0-A (qualityImprovementAttempts UI) | 30 min | +5 (C5 0→5) |
| P1-4 (bouton relancer depuis liste rejetés) | 1h | +10 (C3 15→25) |
| P0-B (ArticleFeedback complet) | 5h | +20 (C4 0→20) |
| **Total si tout livré** | **~10h30** | **+49 → 77/100** |
