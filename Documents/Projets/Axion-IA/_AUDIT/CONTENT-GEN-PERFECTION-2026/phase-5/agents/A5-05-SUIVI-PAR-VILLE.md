# A5-05 — Suivi par Ville — Score 28/100

> Audit AUDIT-ONLY — zéro modification fichier source. Date : 2026-05-21.

---

## Fichiers inspectés

| Fichier | Rôle |
|---|---|
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/_v2/GeoCockpitV2.tsx` | Cockpit principal géographique — agrégats par région |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/history/_v2/GeoHistoryV2.tsx` | Historique campagnes (scope région/dépt/multi) |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/[villeSlug]/generate/_v2/GeoVilleGenerateV2.tsx` | Vue par ville — 10 derniers jobs |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/batches/_v2/GeoBatchesV2.tsx` | Liste batches géographiques |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/city-coverage/_v2/CityCoverageV2.tsx` | Dashboard couverture FOND (data INSEE/secteurs) — 39 villes pilote |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/_v2/JobsListV2.tsx` | Liste jobs avec filtre `anchorVilleSlug` |
| `src/server/actions/content-gen/city-coverage.ts` | Server action calcul couverture FOND — 8 dimensions × 18 critères |
| `src/server/actions/content-gen/geo.ts` | Server actions stats geo : `listRegionGeoStats` + `getGlobalGeoStats` |
| `src/server/actions/content-gen/dashboard.ts` | KPIs dashboard dont `avgQualityScore7d` (global, pas par ville) |
| `src/server/actions/content-gen/jobs.ts` | `listJobs` + filtre `anchorVilleSlug` (interface + query) |

---

## État actuel

### Ce qui existe

**1. CityCoverageV2 (FOND uniquement)**
- Tableau détaillé 39 villes pilote avec 8 dimensions × 18 critères data (INSEE, NAF, pôles, transport, KB)
- Score global `%` par ville + badges vert/jaune/rouge par critère
- KPIs de synthèse : villes indexables, score moyen data, villes parfaitement sourcées
- Mesure la MATIERE disponible pour ContentGen — pas les articles générés

**2. GeoCockpitV2 (régions, pas villes)**
- Tableau par **région** (13 régions métropole) : publié / en cours / failed / review
- 6 KPIs globaux : régions actives, publiés total, en cours, failed, en revue, vélocité 7 j
- Section "Carte interactive" = placeholder explicite : _"react-simple-maps arrive Sprint 4"_
- Aucune granularité ville dans ce cockpit

**3. GeoVilleGenerateV2 (par ville, très limité)**
- Route `/geo/[villeSlug]/generate` : 10 derniers jobs pour la ville avec date/type/statut/qualityScore
- Pas de compteur par verticale, pas de score agrégé
- Pas de lien depuis un tableau de toutes les villes — il faut connaître le slug

**4. JobsListV2 (filtre ville disponible)**
- Filtre `anchorVilleSlug` (champ texte libre) sur la liste générale jobs
- Affiche colonne "Ville" et "Score" (qualityScore individuel)
- Pas d'agrégation ni de tableau croisé ville × verticale

**5. GeoHistoryV2 (campagnes, pas villes)**
- Historique 50 dernières `CoverageCampaign` : scope / cible / gen/pub/fail / statut
- Pas de breakdown par ville ni par verticale

### Ce qui n'existe pas

- Aucune heatmap géographique France (mentionnée comme TODO Sprint 4 dans GeoCockpitV2)
- Aucun tableau croisé ville × 5 verticales (interventions / audits / implementations / 1-to-1 / web)
- Aucune agrégation `groupBy anchorVilleSlug` dans les server actions (geo.ts, dashboard.ts, jobs.ts)
- Aucun score qualité moyen agrégé **par ville** (le `avgQualityScore7d` est global, sans dimension ville)
- Aucun indicateur "progression 39 → 120 villes" avec liste villes non activées ni bouton Activer
- La vue `/geo/[villeSlug]/generate` est accessible uniquement si on connaît le slug — pas de navigation depuis un tableau exhaustif des 39 villes pilote

---

## Gaps identifiés

### P0 (bloquant — pilotage impossible sans)

**P0-1 : Zéro agrégation articles par ville**
La table `ContentGenJob` possède `anchorVilleSlug` mais aucune server action n'effectue un `groupBy anchorVilleSlug` pour compter les articles publiés/failed/en cours par ville. `listRegionGeoStats` agrège par région uniquement. Le cockpit geo ne permet pas de répondre à "combien d'articles publiés sur Lyon ?".

**P0-2 : Zéro tableau croisé ville × verticale**
`getSectorBreakdownToday` agrège par `serviceSector` (5 verticales) mais sans dimension ville. Il n'existe aucune requête `groupBy [anchorVilleSlug, serviceSector, status]`. Un opérateur ne peut pas voir "Lyon : Audits 12 publiés / Implementations 3 failed".

**P0-3 : Zéro score qualité par ville**
`avgQualityScore7d` (dashboard.ts) est une agrégation globale sans filtre `anchorVilleSlug`. La vue `/geo/[villeSlug]/generate` affiche les scores individuels (10 derniers jobs) mais sans moyenne ni classement des villes les moins performantes.

### P1 (important — pilotage dégradé)

**P1-1 : Navigation vers la vue ville inexistante depuis le cockpit**
Le `GeoCockpitV2` ne contient aucun lien vers `/geo/[villeSlug]/generate`. Il n'y a pas de liste cliquable des 39 villes pilote. La route ville existe mais est orpheline du cockpit.

**P1-2 : Progression 39 → 120 villes = indicateur absent**
`CityCoverageV2` affiche 39 villes pilote mais ne montre pas le delta vers la cible 120 villes, ni la liste des villes manquantes, ni un CTA "Ajouter une ville". `totalCitiesInBase` (= total INSEE) est affiché mais la cible opérationnelle 120 ne l'est pas.

**P1-3 : Placeholder carte non daté**
GeoCockpitV2 mentionne "Sprint 4" pour la carte interactive mais le commentaire code indique "ADR 0028 § PR 7" livré en mai 2026. Le Sprint 4 est passé sans que la carte ait été livrée — la dette est non tracée.

**P1-4 : GeoHistoryV2 sans lien articles**
L'historique campagnes affiche gen/pub/fail mais sans lien vers les articles produits ni drill-down par ville.

### P2 (nice-to-have)

**P2-1 : Pas de colonne "score qualité moyen" dans CityCoverageV2**
Le dashboard FOND affiche le score data (critères INSEE/NAF) mais pas le score qualité des articles déjà générés pour chaque ville.

**P2-2 : Filtre ville dans JobsListV2 = champ texte libre sans autocomplete**
L'utilisateur doit saisir le slug exact (`anchorVilleSlug`). Une `<select>` sur `PILOT_CITY_SLUGS` améliorerait l'UX.

**P2-3 : Pas d'export CSV ville × articles**
Aucun endpoint d'export filtré par ville pour reporting externe.

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 Visualisation géographique | 30 | 8 | Liste simple par région (pas par ville) dans GeoCockpitV2 + vue `/geo/[villeSlug]/generate` affiche 10 derniers jobs par ville (accessible seulement si slug connu). Heatmap = placeholder explicite "Sprint 4". Pas de tableau ville complet ni paginé/searchable. Score entre "liste simple" (10 pts) et "absent" (0 pts) : partiel car la liste est par région, pas ville, avec navigation inexistante vers les villes. |
| C2 Progression 39→120 villes | 25 | 5 | CityCoverageV2 affiche `totalCitiesInBase` (total INSEE) comme info statique mais pas la cible 120, pas de liste villes non activées, pas de bouton Activer. Niveau "info statique documentation" à peine atteint. |
| C3 Articles par ville par verticale | 25 | 0 | Aucune agrégation `groupBy [anchorVilleSlug, serviceSector]`. Le filtre `anchorVilleSlug` dans JobsListV2 permet un filtrage manuel mais pas un tableau croisé. Critère "filtrage par ville dans liste articles générale" (8 pts) non retenu car le champ est texte libre, sans navigation depuis cockpit. |
| C4 Score qualité par ville | 20 | 15 | La vue `/geo/[villeSlug]/generate` affiche le `qualityScore` des 10 derniers jobs par ville (colonne dédiée). C'est un accès indirect mais réel au score individuel par ville. Pas de moyenne agrégée ni classement des villes les moins bonnes. Score > "compteur rejetés" (5 pts) mais < "score moyen agrégé" (20 pts). |
| **TOTAL** | **100** | **28** | |

---

## Recommandations P0 urgentes

### R-P0-1 : Ajouter `listCityGeoStats()` dans `geo.ts`

```ts
export async function listCityGeoStats(): Promise<ReadonlyArray<CityGeoStat>> {
  await requireAdmin();
  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug", "status"],
    _count: { _all: true },
    _avg: { qualityScore: true },
    where: { anchorVilleSlug: { not: null } },
  });
  // ... joindre avec PILOT_CITY_SLUGS pour afficher aussi les villes à 0
}
```

Débloque C1 (tableau ville complet), C3 (compteur articles), C4 (score moyen ville).

### R-P0-2 : Ajouter tableau ville × verticale dans GeoCockpitV2

Requête `groupBy [anchorVilleSlug, serviceSector, status]` + tableau croisé. Débloque C3 (25 pts).

### R-P0-3 : Ajouter indicateur progression 39 → 120 villes

Dans CityCoverageV2 : afficher la cible 120 (à définir dans une constante `TARGET_CITY_COUNT`), lister les `PILOT_CITY_SLUGS` non encore "indexables" avec CTA. Débloque C2 (15-25 pts).

### R-P0-4 : Lier GeoCockpitV2 vers la vue par ville

Ajouter dans le tableau régions une colonne "Villes" avec lien vers `/geo/[villeSlug]/generate` pour chaque ville de la région, ou créer une table des 39 villes pilote dans le cockpit avec liens directs.

---

**Estimation effort R-P0-1 à R-P0-4 : ~6-8h** (server actions ~2h + UI tableau croisé ~3h + indicateur progression ~1h + liens navigation ~1h).

**Score potentiel après corrections P0 : ~75-80/100.**
