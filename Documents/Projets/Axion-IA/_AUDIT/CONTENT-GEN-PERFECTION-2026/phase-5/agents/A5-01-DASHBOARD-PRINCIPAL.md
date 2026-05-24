# A5-01 — Dashboard Principal — Score 23/120

## Fichiers inspectés

1. `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\[locale]\(admin)\[adminPrefix]\content-gen\page.tsx`
2. `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\[locale]\(admin)\[adminPrefix]\content-gen\_v2\ContentGenDashboardV2.tsx`
3. `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\actions\content-gen\dashboard.ts`
4. `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\[locale]\(admin)\[adminPrefix]\content-gen\publications-status\_v2\PublicationsStatusV2.tsx`
5. `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\api\content-gen\export\route.ts`

---

## État actuel (ce qui existe)

### Architecture générale

Le dashboard principal (`page.tsx`) est un **Server Component pur** avec `export const dynamic = "force-dynamic"`. Il délègue intégralement à `ContentGenDashboardV2`. Aucun polling, aucun SSE, aucun composant client. Chaque visite de page déclenche un refetch complet depuis la DB.

### Métriques exposées

**8 AdminStatCards 7 jours glissants** (section KPIs) :
- Jobs lancés (`jobsRun7d`)
- Publiés (`published7d`)
- Failed (`failed7d`)
- En revue (`pendingReview`)
- Coût 7j en USD (`costSpent7dUsd`)
- Score qualité moyen (`avgQualityScore7d`)
- Plagiat bloqués (`plagiarismBlocks7d`)
- KB entries (`kbHealth.chunks`)

**7 cartes secteur "aujourd'hui"** (section Rollup) — fenêtre depuis minuit UTC :
- 5 secteurs éditoriaux (interventions_formations, audits, implementations, un_a_un, sites_web_augmentes)
- 2 pipelines indépendants (landing_ville, blog_from_rss)
- Chaque carte affiche : `publishedToday / generatedToday`, `failedToday`, `campaignsActive`

**Queue BullMQ** (section "Queue temps réel") :
- running / waiting / failed (lus via `prisma.contentGenJob.count` par status, pas via BullMQ direct)
- Lien "Inspecter BullMQ" vers `/queue`

**Kill-switch** : affiché dans le subtitle de la page header si actif.

### Actions disponibles depuis le dashboard

- 6 formulaires QuickGen (génération unitaire inline Server Action → redirect `/jobs/{id}`)
- 12 liens "Pilotage rapide" (coverage, geo, jobs, review-queue, publications-status, templates, rss, similarity-monitor, orchestrator, costs, author/manon, kb-readonly)
- 10 liens "Réglages" (providers, batches, policies, coverage-distribution, audience-mix, search-intent-distribution, quality-loop, qa-policies, banned-phrases, llms-txt)

### Publications-status (sous-page liée)

Kanban 5 colonnes (brouillon/revue/approuvé/publié/refusé), `take: 30` items par colonne, capped à 12 affichés. Bouton "Export CSV jobs" vers `GET /api/content-gen/export?type=jobs`.

### Route export `/api/content-gen/export`

Existe et est fonctionnelle. Accepte `type=jobs` ou `type=articles`. Filtres disponibles :
- Pour `jobs` : `?status=` + `?contentType=`
- Pour `articles` : `?status=` + `?tier=`
- Limite : 10 000 lignes, BOM UTF-8, nom de fichier daté.

L'export n'est **pas accessible depuis le dashboard principal** — uniquement depuis la page `publications-status`.

---

## Gaps identifiés

### P0 (bloquant)

**P0-1 — Aucune mise à jour automatique des métriques**
Le dashboard est `force-dynamic` mais ne se rafraîchit pas sans action utilisateur. Un opérateur qui laisse la page ouverte voit des compteurs figés. Pour un pilotage opérationnel (jobs running, queue), c'est bloquant : le compteur "En cours" peut passer de 0 à 5 sans que l'opérateur le voie.

**P0-2 — Pas d'indicateur cap journalier MAX_PUBLISH_PER_DAY**
`getDashboardKpis()` ne retourne ni `publishedToday` global ni `maxPublishPerDay`. La section Rollup donne `publishedToday` par secteur mais aucune agrégation globale vs cap. Impossible de savoir en un coup d'œil si on approche ou dépasse le plafond légal.

**P0-3 — Absence de timestamp "dernière mise à jour"**
Aucun timestamp affiché pour indiquer quand les données ont été chargées. L'utilisateur ne sait pas si les chiffres datent de 30 secondes ou 30 minutes.

### P1 (important)

**P1-1 — Pas de filtres sur le dashboard principal**
Les filtres combinables (ville, type, état, campagne, période) vivent uniquement sur les sous-pages `/jobs` et `/geo`. Le dashboard principal n'offre aucun filtre.

**P1-2 — Pas de tableau croisé ville × type × état**
Le rollup ne couvre que la dimension "secteur". Aucun axe géographique, aucun axe "intention de recherche", aucune vue croisée.

**P1-3 — Export CSV inaccessible depuis le dashboard principal**
Le bouton Export CSV est sur `/publications-status`, pas sur le dashboard. L'opérateur doit naviguer vers une sous-page pour exporter.

**P1-4 — Vue multi-campagnes absente**
Le dashboard montre `campaignsActive` (entier) par secteur, mais sans nom de campagne, progression, ETA ni lien direct vers chaque campagne. Un clic sur la card redirige vers `/jobs?serviceSector=X`, pas vers la liste des campagnes actives.

**P1-5 — `kbHealth.lastIngestAgoDays` toujours null**
Dans `getDashboardKpis()`, ce champ est fixé à `null` (TODO non implémenté). La card KB entries n'affiche pas l'ancienneté du dernier ingestion — information critique pour détecter une KB stale.

**P1-6 — Queue BullMQ lue via Prisma, pas via BullMQ API**
Les compteurs running/waiting/failed sont calculés par `prisma.contentGenJob.count`, pas via l'API BullMQ. Des jobs bloqués dans Redis sans record DB ou dans l'état `delayed` ne sont pas comptabilisés.

### P2 (nice-to-have)

**P2-1 — Barre de progression cap journalier absente**
Même si `publishedToday` global était calculé, aucune barre de progression visuelle `N / CAP` n'est prévue.

**P2-2 — Breakdown états incomplet dans le Rollup**
`SectorTodayCard` expose `failedToday` mais pas `redundant` (doublons détectés par SimHash) ni `rejected` (refusés par review). Le breakdown complet (généré/publié/refusé/redondant) est absent.

**P2-3 — Export articles non exposé dans l'UI**
La route `/api/content-gen/export?type=articles` existe mais aucun bouton dans l'UI ne l'utilise.

**P2-4 — Kill-switch status sans mise en évidence visuelle forte**
L'état kill-switch actif s'affiche uniquement dans la description de `AdminPageHeader`. Sans bandeau rouge ou alerte flottante, un opérateur distrait peut le manquer.

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---------|-----|-------|---------------|
| C1 Métriques temps réel | 30 | 10 | Server Component `force-dynamic` : refetch à chaque navigation manuelle, zéro polling/SSE. Compteurs présents (8 KPIs 7j + 7 rollup secteur + queue), mais statiques. Timestamp dernière mise à jour absent. Cap journalier absent. `lastIngestAgoDays` toujours null. Breakdown états (refusé/redondant) absent. Score = palier "Compteurs statiques (page refresh manuel)". |
| C2 Filtres et tri | 25 | 0 | Zéro filtre sur le dashboard principal. Pas de filtre ville, type, état, campagne, période. Les filtres existent sur les sous-pages `/jobs` et `/geo` mais sont inaccessibles depuis le dashboard principal. |
| C3 Tableau croisé | 30 | 0 | Aucun tableau croisé ville × type × état. Le rollup secteur est une liste plate de 7 cards (1 dimension : secteur). Aucune dimension géographique, aucune sous-colonne état. |
| C4 Export CSV | 15 | 8 | La route `/api/content-gen/export` existe et fonctionne (jobs + articles, filtres status/contentType/tier, BOM UTF-8, nom fichier daté, 10K lignes max). Bouton présent sur `/publications-status`. Absent du dashboard principal audité. Score = "Export CSV complet non filtré depuis dashboard" (fonctionnalité implémentée mais non exposée sur la page principale). |
| C5 Vue multi-campagnes | 20 | 5 | Le dashboard affiche `campaignsActive` (entier) par secteur dans les AdminStatCards, ce qui correspond strictement à "lien vers liste" (clic card → `/jobs?serviceSector=X`). Pas de section dédiée avec nom, progression, ETA, statut granulaire. |
| **TOTAL** | **120** | **23** | |

---

## Recommandations P0 urgentes

### REC-01 — Polling client sur les compteurs queue (C1 +10 pts potentiels)

Extraire la section "Queue temps réel" dans un Client Component (`"use client"`) avec `setInterval` de 15-30s appelant un endpoint `GET /api/content-gen/queue-stats` retournant `{ running, waiting, failed }`. Cela transformerait les compteurs queue de statiques à semi-live sans changer l'architecture SSR du reste du dashboard.

Effort estimé : 2-3h.

### REC-02 — Compteur `publishedToday` global + cap dans `getDashboardKpis()` (C1 +5 pts potentiels)

Ajouter dans l'interface `DashboardKpis` :
- `publishedToday: number` — `prisma.contentGenJob.count({ where: { status: "published", completedAt: { gte: startOfDay } } })`
- `maxPublishPerDay: number` — lu depuis config/env `MAX_PUBLISH_PER_DAY`
- Afficher une barre de progression `publishedToday / maxPublishPerDay` dans le header du dashboard.

Effort estimé : 1h.

### REC-03 — Timestamp "données au HH:MM:SS UTC" (C1 +3 pts potentiels)

Passer `new Date().toISOString()` depuis le Server Component au composant pour afficher l'heure de chargement. Coût quasi nul.

Effort estimé : 30 min.

### REC-04 — Exposer le bouton Export CSV depuis le dashboard principal (C4 +7 pts potentiels)

Ajouter dans les actions du `AdminPageHeader` ou dans la section "Pilotage rapide" :

```tsx
<a href="/api/content-gen/export?type=jobs" className="admin-button-ghost">
  Export CSV jobs
</a>
```

Effort estimé : 15 min.

### REC-05 — Section "Campagnes actives" dédiée (C5 +15 pts potentiels)

Ajouter une requête `prisma.coverageCampaign.findMany({ where: { status: "running" }, include: { _count: { select: { jobs: true } } } })` et afficher un tableau avec colonnes : Nom, Secteur, Jobs total, Jobs publiés, % avancement. Lien direct vers `/coverage/{id}`.

Effort estimé : 4-6h.

---

**SCORE A5-01: 23/120**
