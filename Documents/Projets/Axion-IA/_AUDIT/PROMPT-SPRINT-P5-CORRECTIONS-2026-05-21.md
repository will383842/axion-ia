# SPRINT CORRECTIF P5 — CONSOLE ADMIN & SUIVI OPS
## AxionIA Content-Gen Perfection 2026 — Phase 5 corrections

**Date création** : 2026-05-21
**Phase parent** : P5 (Console Admin & Suivi Ops) — score audit 315/1000 🔴 NO-GO
**Score cible post-sprint** : ≥ 637/1000 🟡 CONDITIONNEL
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 14-16h autopilot (Sprint immédiat <24h + Sprint court 72h)

---

## 0. CONTEXTE — À LIRE AVANT TOUT

### État du repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche cible** : `main`
- **HEAD origin/main au lancement** : `0906722` (Manon backfill embeddings — 2026-05-21 16:51)
- **Baseline P1.5 livrée + vérifiée** : commit `37ca0147` (P1.5 B.8 LLM-judge), audit 11 agents GO 192/200 (96%)
- **Sprint P2 déjà fait** : `17c53bc` (10 fixes audit P2)
- **BUG-5 déjà fait** : 4 stubs générateurs implémentés (75420e4 / 8b3f470 / 71f658f / 99fe423)

### Fichiers d'audit à lire avant de coder
1. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/PHASE-5-VERDICT.md` (verdict 315/1000 + roadmap corrections complète)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/CROSS-CUTTING.md`
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-01.md` à `A5-08.md` (8 fichiers, scoring détaillé par dimension)

### Décisions Will déjà validées (à respecter, ne PAS re-demander)
- **D-P5-1** : Presets CampaignTemplate → **Option A** (valider les 6 tels quels). Seed des 6 presets en DB : `PME audits`, `Interventions weekly`, `TPE burst`, `ETI pilier`, `Cities Paris`, `RSS daily`.
- **D-P5-2** : Seuil qualité → **Option B** (60/100, ~70% pass rate). Harmoniser `llm-judge.ts` (0-10 hardcodé) avec `QualityLoopV2` (0-100). Seuil par défaut DB = 60.
- **D-P5-3** : Reporting email → **Option A** (hebdomadaire lundi 8h00 CET). Destinataire `williamsjullin@gmail.com`. Contenu : KPIs articles publiés/refusés, score qualité moyen, coût semaine, villes couvertes, alertes, progression 120 villes.
- **D-P5-4** : Heatmap vs Tableau → **Option B** (tableau croisé dynamique ville × type × état, filtrable + triable + export CSV). PAS de heatmap SVG.
- **D-P5-5** : Rampe MAX_PUBLISH_PER_DAY → **Option A** (manuelle depuis UI). Champ input numérique global "Cap articles/jour" dans `BatchesV2` ou dashboard.
- **D-P5-6** : Ordre sprint → **Option A puis B**. Phase A quick wins UX 6h (P0) → Phase B CampaignTemplate 8-10h (P1).

### Mémoires Claude pertinentes
- `axionia_p5_decisions_canoniques_2026-05-21` (6 décisions ci-dessus)
- `axionia_content_gen_p1_5_livre_2026-05-21` (baseline 770-820/1000)
- `axionia_couleurs` (terracotta `#c24a1b` principale, bleu `#1a4dd9` pointes)
- `axionia_positionnement_4_verticales` (5 verticales : `interventions_formations` + `un_a_un` + `audits` + `implementations` + `sites_web_augmentes`)

---

## 1. MODE OPÉRATIONNEL

### Autorisations
- ✅ Création/modification de code source
- ✅ Création de migrations Prisma
- ✅ Commits Conventional + Co-Authored-By
- ✅ Push sur `main` (Will utilise pas de feature branch)
- ❌ JAMAIS `--no-verify` sur git commit/push
- ❌ JAMAIS amend de commits existants
- ❌ JAMAIS reset destructif

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck   # 0 erreur
pnpm lint        # 0 erreur (warnings hors scope OK)
pnpm test        # vitest 1376+/1383 passed
pnpm content-gen:isolation-check  # 0 violation scope mon travail
```

### Gates obligatoires AVANT chaque push
```powershell
git pull --rebase origin main  # convergence Manon parallèle
# Si conflit Prisma migration : renommer ma migration avec timestamp postérieur
pnpm prisma migrate diff       # vérifier cohérence schema vs DB
```

### Convergence Manon (sessions parallèles)
- Manon peut travailler en parallèle sur `villes/copy/<slug>.ts` ou `image-bank/seed-images.ts` → **NE PAS toucher ces zones**
- Avant chaque push : `git pull --rebase origin main`
- En cas de conflit Prisma migration : recréer ma migration avec timestamp > celui de Manon
- En cas de conflit code : résoudre manuellement, refaire les gates, push

### Format commits
```
feat(content-gen-admin): p5 sprint correctif — <description courte>

<corps détaillé : pourquoi, comment, quels P0 résolus>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. PHASE A — QUICK WINS UX (P0, ~6h)

### P0-1 — Boutons pause/resume dans la liste campagnes (~2h)
**Gain** : +20 pts A5-03

**Spec** :
- Fichier : `src/components/admin/content-gen/CoverageListV2.tsx` (ou équivalent V2)
- Pour chaque ligne campagne, ajouter 2 boutons à droite :
  - Si `status === "running"` → bouton "Pause" → `<form action={pauseCampaignAction}>`
  - Si `status === "paused"` → bouton "Resume" → `<form action={resumeCampaignAction}>`
  - Si `status === "completed"` ou `"failed"` → pas de bouton
- Server Actions existantes : `pauseCampaign` + `resumeCampaign` dans `src/server/content-gen/admin/coverage.ts`
- Style : boutons icon-only avec `lucide-react` `Pause` / `Play` + tooltip
- Couleur : neutral (gris foncé), terracotta uniquement pour CTAs primaires

**Test** : créer 1 campagne via wizard, vérifier que les 2 boutons apparaissent et fonctionnent (BullMQ jobs paused/resumed visible dans logs).

### P0-2 — CTA "Nouvelle campagne" terracotta persistant (~1h)
**Gain** : +15 pts A5-08

**Spec** :
- Couleur actuelle bouton "Nouvelle campagne" : bleue → changer en **terracotta `#c24a1b`** (Tailwind : créer classe utility ou utiliser `bg-[#c24a1b] hover:bg-[#a23d15]`)
- Localisation : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/layout.tsx` (ou layout V2 équivalent)
- Ajouter le bouton dans le header sticky du layout content-gen (visible sur toutes les sous-pages, pas seulement dashboard)
- Lien vers `/content-gen/coverage/new` (ou route V2 équivalente)

**Test** : naviguer entre `/content-gen/coverage`, `/content-gen/quality`, `/content-gen/geo`, `/content-gen/costs` → le bouton CTA terracotta doit être présent et visible sur les 4 pages.

### P0-3 — MAX_PUBLISH_PER_DAY champ UI (~2h)
**Gain** : +10 pts A5-06 + débloque D-P5-5

**Spec** :
- Ajouter un input numérique "Cap global articles/jour" dans `BatchesV2.tsx` ou le dashboard principal
- Range : 1 à 1000, step 10
- Stockage : `ContentGenConfig.key = "MAX_PUBLISH_PER_DAY"` via `writeContentGenConfig()` Server Action
- Le worker `content-publish-worker.ts` lit déjà depuis DB → pas de change worker side
- Afficher la valeur courante + bouton "Mettre à jour"
- Validation : refuser <1 ou >1000, afficher erreur inline
- Audit trail : déclencher event SOC2 `MAX_PUBLISH_CHANGED` (utilise `auditLog()` existant)

**Test** : changer la valeur en UI de 30 → 50 → vérifier en DB que `ContentGenConfig.key="MAX_PUBLISH_PER_DAY"` a `value="50"`.

### P0-4 — Exposer qualityImprovementAttempts dans ReviewDetailV2 (~30 min)
**Gain** : +5 pts A5-04

**Spec** :
- Fichier : `src/components/admin/content-gen/ReviewDetailV2.tsx` (ou équivalent)
- Query Prisma : ajouter `qualityImprovementAttempts` au select de l'article
- Affichage : "Itérations qualité : X/2" sous le score qualité, badge gris si X=0, jaune si X=1, rouge si X=2 (max atteint)

### P0-5 — Regroupement dashboard ≤7 liens niveau 1 (~2h)
**Gain** : +10 pts A5-08

**Spec** :
- Fichier : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx`
- Actuellement : ~22 liens flat → regrouper en 4 sections sémantiques :
  - **🎯 Pilotage** : Coverage, Costs, Quality, Geo
  - **🛠️ Sources** : RSS, Keywords seeds, KB, Image-bank
  - **📊 Suivi** : Jobs, Articles, Cities, Provenance
  - **⚙️ Réglages** : Providers, Templates, Workers, Settings
- Chaque section = card avec titre + icon `lucide-react` + 4-6 liens
- Layout grid responsive 1/2/4 colonnes selon viewport
- Ajouter compteur badge sur chaque lien (ex: "Coverage (3)" = 3 campagnes actives)

---

## 3. PHASE B — CAMPAIGNTEMPLATE + ARTICLEFEEDBACK (P1, ~8-10h)

### P1-1 — Modèle Prisma `CampaignTemplate` + migration + seed 6 presets (~4h)
**Gain** : +20 pts A5-02 + +20 pts A5-06 = +40 pts total

**Spec Prisma** :
```prisma
model CampaignTemplate {
  id          String   @id @default(cuid())
  slug        String   @unique // "pme-audits", "interventions-weekly", etc.
  name        String   // "PME audits"
  description String   @db.Text
  config      Json     // structure CoverageCampaign-like (verticals, types, distribution, batchSize, etc.)
  isSystem    Boolean  @default(true) // true = seed, false = user-created
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([isActive])
  @@map("campaign_templates")
}
```

**Migration** : `20260521150000_add_campaign_template_and_feedback.prisma` (combiner avec ArticleFeedback ci-dessous pour single migration)

**Seed des 6 presets** (`prisma/seeds/content-gen/seed-campaign-templates.ts`) :

| slug | name | config (résumé) |
|------|------|-----------------|
| `pme-audits` | PME audits | verticals: `["audits"]`, target: `["pme"]`, types: `["blog_pillar", "landing_ville"]`, batchSize: 20, dailyCap: 30 |
| `interventions-weekly` | Interventions weekly | verticals: `["interventions_formations"]`, target: `["pme", "eti"]`, types: `["blog_from_keywords", "qa_derived"]`, schedule: cron `0 9 * * 1` (lundi 9h), batchSize: 50 |
| `tpe-burst` | TPE burst | verticals: `["interventions_formations", "audits"]`, target: `["tpe"]`, types: `["blog_from_keywords"]`, batchSize: 100, dailyCap: 50 |
| `eti-pilier` | ETI pilier | verticals: `["implementations", "audits"]`, target: `["eti"]`, types: `["blog_pillar"]`, batchSize: 10, qualityThreshold: 75 |
| `cities-paris` | Cities Paris | verticals: tous, target: tous, types: `["landing_ville"]`, anchorVilleSlug: `"paris"`, batchSize: 20 |
| `rss-daily` | RSS daily | verticals: `["interventions_formations"]`, types: `["blog_from_rss"]`, schedule: cron `0 7 * * *` (quotidien 7h), batchSize: 10, qualityThreshold: 65 |

**Script seed** : ajouter `pnpm content-gen:seed-templates` dans `package.json` qui appelle `seed-campaign-templates.ts` avec `prisma.campaignTemplate.upsert({ where: { slug }, ... })`.

### P1-2 — UI presets `templates/preset/` (~3h)
**Spec** :
- Nouvelle route : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/templates/page.tsx`
- Server Component : `prisma.campaignTemplate.findMany({ where: { isActive: true } })`
- Layout : grid 1/2/3 colonnes responsive
- Chaque card preset :
  - Nom + description
  - Résumé config : verticales, types, batchSize, dailyCap
  - Bouton "Utiliser ce preset" → `/content-gen/coverage/new?preset=<slug>`
- Lien depuis le wizard "Nouvelle campagne" : ajouter section "Démarrer depuis un preset" en haut

### P1-3 — Formulaire création campagne : pré-remplissage depuis preset (~2h)
**Spec** :
- Fichier : `src/components/admin/content-gen/CoverageNewV2.tsx` (ou équivalent wizard)
- Lire query param `?preset=<slug>` côté Server Component
- Charger le preset : `prisma.campaignTemplate.findUnique({ where: { slug } })`
- Pré-remplir tous les champs depuis `preset.config`
- Afficher banner : "📋 Démarrage depuis preset : <name>. Vous pouvez modifier les champs ci-dessous."
- Bouton "Retirer le preset" → reset form

### P1-4 — Modèle `ArticleFeedback` + endpoint + UI (~3h)
**Gain** : +20 pts A5-04

**Spec Prisma** (à inclure dans la même migration que CampaignTemplate) :
```prisma
model ArticleFeedback {
  id        String   @id @default(cuid())
  articleId String
  userId    String   // pour multi-user futur
  type      String   // "up" | "down"
  comment   String?  @db.Text
  createdAt DateTime @default(now())

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId])
  @@index([userId])
  @@map("article_feedback")
}
```

Et dans `Article` :
```prisma
model Article {
  // ...
  feedback ArticleFeedback[]
}
```

**Endpoint** : `src/app/api/admin/content-gen/articles/[id]/feedback/route.ts`
- POST body : `{ type: "up" | "down", comment?: string }`
- Auth : vérifier session admin
- Crée `ArticleFeedback`, retourne 201

**UI** : dans `ReviewDetailV2.tsx`, ajouter 2 boutons thumbs `lucide-react` `ThumbsUp` / `ThumbsDown` + textarea comment optionnel.

---

## 4. PHASE C — TABLEAU CROISÉ + PROGRESS BARS (P1 sprint moyen, ~6h)

### P1-5 — Tableau croisé dynamique ville × type × état (~4h)
**Gain** : +25 pts A5-05 + résout D-P5-4

**Spec** :
- Server Action : `getJobsByVilleAndSector()` dans `src/server/content-gen/admin/geo.ts`
  - `prisma.article.groupBy({ by: ["anchorVilleSlug", "serviceSector", "publishStatus"], _count: true })`
  - Retourne tableau filtrable
- Nouvelle route : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/coverage-table/page.tsx`
- UI : tableau HTML avec colonnes triables (Ville, Verticale, État, Count, % vs target)
- Filtres : par ville, par verticale, par état (`published` | `draft` | `quarantined` | `failed`)
- Export CSV : bouton "Exporter CSV" → génère fichier client-side (utiliser `papaparse` si déjà dans deps, sinon export manuel)
- Pagination : 50 lignes/page

### P1-6 — Barre de progression 39/120 villes (~2h)
**Spec** :
- Comparer villes ayant ≥ 1 article publié vs liste 120 villes cibles (hardcoded ou via `cities_target.ts`)
- Composant : `<progress value={39} max={120}>` ou div CSS styled
- Localisation : dashboard principal + `CityCoverageV2.tsx`
- Afficher : "39 / 120 villes couvertes (32.5%)"
- Couleur progress : <33% rouge, 33-66% orange, >66% vert

---

## 5. PHASE D — ANOMALY DETECTION + DASHBOARD ACTIF (Sprint moyen 1 semaine, ~5h)

### P1-7 — Section campagnes actives sur dashboard (~3h)
**Gain** : +15 pts A5-01

**Spec** :
- Fichier : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx`
- Query : `prisma.coverageCampaign.findMany({ where: { status: "running" }, take: 5, orderBy: { createdAt: "desc" } })`
- Afficher 3-5 cartes :
  - Nom campagne
  - Progress bar (articles publiés / target)
  - Articles ce jour (`prisma.article.count({ where: { campaignId, createdAt: { gte: startOfDay } } })`)
  - ETA dynamique : `(target - published) / velocity`
  - Statut badge

### P1-8 — Anomaly detection batch (~2h)
**Gain** : +15 pts A5-07

**Spec** :
- Modifier `src/server/queue/workers/content-monitoring-worker.ts` (créer si absent)
- Ajouter 3 checks toutes les 15 min :
  - Chute score qualité moyen > 15% sur 1h (vs moyenne 24h)
  - Taux rejet > 50% sur 1h
  - 0 articles générés depuis 4h sur campagne `running`
- Si anomaly détectée : write `ContentGenConfig.key = "alert_count"` avec `value = X` (incrément)
- Badge rouge dans sidebar admin : `<span className="badge-alert">{alertCount}</span>` si > 0
- Optionnel : push Telegram via webhook existant `cost-tracker.ts`

---

## 6. ZONES INTERDITES (convergence Manon)

- ❌ `prisma/seeds/villes/copy/<slug>.ts` (Manon ville par ville)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon batch importation)
- ❌ `src/server/content-gen/generators/*.ts` (P4 territory)
- ❌ `src/components/seo/*.tsx` (P3 territory)
- ❌ `prisma/migrations/2026052[2-9]*` (timestamps réservés future)

---

## 7. LIVRAISON FINALE

### Verdict final à créer
`_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/VERDICT-SPRINT-P5-CORRECTIONS.md`

Format obligatoire :
```markdown
# VERDICT SPRINT P5 CORRECTIONS — Console Admin
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA court>
## Score avant → après : 315/1000 → XXX/1000 (+XXX pts)

## Items livrés
| Item | Statut | Commit | Gain pts |
|------|--------|--------|----------|
| P0-1 Pause/resume liste | ✅ | abc1234 | +20 |
| P0-2 CTA terracotta | ✅ | def5678 | +15 |
| ...

## Items skipped (avec raison)
| Item | Raison |
|------|--------|

## Gates anti-régression
- typecheck : 0 erreur ✅
- lint : 0 erreur ✅
- vitest : XXXX/XXXX passed ✅
- pre-commit hooks ×8 : ✅
- pre-push hooks : ✅

## Score détaillé par agent
| Agent | Avant | Après | Delta |
|-------|-------|-------|-------|
| A5-01 Dashboard | 23/120 | XX/120 | +XX |
| A5-02 Wizard | 28/120 | XX/120 | +XX |
| ...

## Migrations Prisma créées
- `20260521150000_add_campaign_template_and_feedback`

## Seeds exécutés
- `pnpm content-gen:seed-templates` (6 presets)

## Convergence Manon
- Conflits rencontrés : <list>
- Résolution : <description>

## Actions Will post-sprint
1. Vérifier prod : <description>
2. ...

## P2 résiduels (backlog)
- ...

## UNKNOWNs résiduels
- ...
```

### Mémoire à créer
Slug : `axionia_sprint_p5_corrections_livre_2026-05-21`
Type : project
Body : score 315 → XXX/1000, commits, gates, actions Will, suite recommandée (P6 roadmap).

### MEMORY.md à mettre à jour
Ajouter ligne :
```
- [🟢 AxionIA Sprint P5 corrections LIVRÉ 2026-05-21 — score 315→~637/1000](axionia_sprint_p5_corrections_livre_2026-05-21.md) — Console admin opérationnelle : 6 presets CampaignTemplate + ArticleFeedback + tableau croisé géo + anomaly detection + dashboard actif.
```

---

## 8. STOP & ASK FINAL (à Will, après livraison)

Format :
```
✅ Sprint P5 corrections livré.
- HEAD : <sha>
- Score 315 → XXX/1000 (+XXX pts)
- X commits pushés
- 1 migration Prisma (CampaignTemplate + ArticleFeedback)
- 6 presets seedés
- Gates ✅

⚠️ Items skipped / décisions différées :
- ...

🚀 Suite proposée :
[A] Lancer Sprint P3 corrections (10 QW SEO + Wikidata, ~8h)
[B] Lancer Sprint P4 corrections (P0-2 à P0-6, ~16-20h)
[C] Lancer P6 roadmap chiffrée + verdict global /5000
[D] Validation prod 24-48h avant suite (monitor logs)
```

---

## 9. PHRASE DE LANCEMENT (à coller dans nouvelle conversation Claude Code)

```
Lance le sprint correctif décrit dans `_AUDIT/PROMPT-SPRINT-P5-CORRECTIONS-2026-05-21.md`. Mode IMPLEMENTATION. Phase A puis B puis C puis D. Commits incrémentaux avec push après chaque phase. Convergence Manon obligatoire avant push (git pull --rebase). Gates verts obligatoires avant chaque commit (typecheck + lint + vitest + isolation-check + pre-commit hooks ×8 + pre-push hooks). Termine par VERDICT-SPRINT-P5-CORRECTIONS.md + mémoire update + STOP & ASK Will. Go.
```

---

*Sprint correctif P5 — 14-16h autopilot — Cible 315 → 637/1000*
