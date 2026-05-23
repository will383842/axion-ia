# PROMPT VÉRIFICATION SPRINT SITE EXPLORER ADMIN
## Audit du PROMPT-SPRINT-SITE-EXPLORER-ADMIN-2026-05-22

**Date création** : 2026-05-23
**Type** : Audit AUDIT-ONLY post-sprint (vérifie que le Site Explorer est correctement livré)
**Mode** : **AUDIT-ONLY strict** — zéro commit, zéro modif code
**Effort estimé** : 4-5h autopilot
**Modèle recommandé** : Sonnet 4.6 (suffit, audit fonctionnel)
**À lancer APRÈS** : `PROMPT-SPRINT-SITE-EXPLORER-ADMIN-2026-05-22.md` livré
**Demandé par Will** : 2026-05-23 — vérification complémentaire des 2 derniers prompts

---

## 0. MISSION

Vérifier que le Sprint Site Explorer Admin a été correctement livré sur **9 axes critiques** :

1. **Modèles Prisma** présents et migrations appliquées
2. **Script scan-site-routes** fonctionnel
3. **🚨 EXCLUSIONS STRICTES respectées** (0 row admin/API/auth en DB) — **CRITÈRE KILL ABSOLU**
4. **Worker inspection daily** actif
5. **Console admin /site-explorer** rendue + tree view + filtres
6. **Édition inline pages DB** opérationnelle
7. **Worker anomaly-detector** actif + détection 9 types
8. **Phase G Lighthouse** (si livré)
9. **Tests Vitest** count attendu

**Verdict tranché** : 🟢 SPRINT LIVRÉ PROPRE / 🟡 LIVRÉ AVEC RÉSERVES / 🔴 ÉCHECS CRITIQUES.

---

## 1. CONTEXTE PROJET

### Décisions Will canoniques FIGÉES
- D-W1-5, D-P5-1-6, D1-D5, D7 société française pure
- Exclusions Will : Wikidata, DPA, CF WAF, toggle auto/manuel publication

### 🚨 RÈGLE STRICTE OBJECTIVE du Site Explorer
**Catalogue UNIQUEMENT les URLs publiques visibles par les visiteurs**. EXCLUSIONS ABSOLUES :
- ❌ Routes admin (`(admin)`, `[adminPrefix]`)
- ❌ Routes API (`src/app/**/route.ts`)
- ❌ Server Actions
- ❌ Routes auth NextAuth
- ❌ Routes utilitaires (`_next`, `sitemap.xml`, `robots.txt`, `.well-known`)

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code
- ✅ Lecture code + queries DB lecture + observation UI dev server
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/VERIF-SPRINT-SITE-EXPLORER-2026-05-23/`

---

## 2. FICHIERS À LIRE EN PREMIER

### Output sprint à valider
1. `_AUDIT/SITE-EXPLORER-2026-05-22/VERDICT-SPRINT-SITE-EXPLORER.md` (verdict sprint)

### Spec source
2. `_AUDIT/PROMPT-SPRINT-SITE-EXPLORER-ADMIN-2026-05-22.md`

### Code source créé par le sprint
3. `prisma/schema.prisma` (modèle `SiteRoute` + `SiteRouteAnomaly`)
4. `prisma/migrations/20260522170000_add_site_routes_explorer/` (migration)
5. `src/scripts/scan-site-routes.ts` (script scanner)
6. `src/server/queue/workers/site-route-inspector-worker.ts`
7. `src/server/queue/workers/site-route-anomaly-detector.ts`
8. `src/server/queue/workers/site-route-lighthouse-worker.ts` (Phase G optionnelle)
9. `src/app/[locale]/(admin)/[adminPrefix]/site-explorer/page.tsx`
10. `src/app/[locale]/(admin)/[adminPrefix]/site-explorer/anomalies/page.tsx`
11. `src/components/admin/site-explorer/*.tsx` (7 composants)
12. `src/server/site-explorer/admin/site-routes.ts` (server actions)

### Mémoires
13. `axionia_sprint_site_explorer_admin_livre_2026-05-22.md`
14. `axionia_decisions_will_final_2026-05-21.md`

---

## 3. SPAWN 9 SOUS-AGENTS PARALLÈLES

### V-01 — Modèles Prisma + migrations (/100)
- `SiteRoute` model présent dans `schema.prisma` ?
- `SiteRouteAnomaly` model présent ?
- Enum `SiteRouteType` (static / dynamic_template / dynamic_db / dynamic_filesystem / api / server_action) ?
- Enum `SiteRouteStatus` (live / draft / preview / not_found / redirect / error / unknown) ?
- Enum `SiteRouteVisibility` avec **UNIQUEMENT 'public'** valeur (correction Will 2026-05-22)
- Migration `20260522170000_add_site_routes_explorer` appliquée ?
- `prisma migrate status` no drift ?
- `prisma validate` OK ?
- Score : 100 max

### V-02 — Script scan-site-routes (/100)
- `src/scripts/scan-site-routes.ts` existe ?
- Logique d'exclusions strictes présente (skip `(admin)`, `[adminPrefix]`, `(auth)`, `_next`, `sitemap.xml`, `robots.txt`, `.well-known`) ?
- Résolution DB UNIQUEMENT contenus publiés (WHERE published=true / publish_status IN ('published', 'tier_1', 'tier_2')) ?
- 🚫 PAS de scan API routes ni Server Actions ?
- Safety net AVANT upsert : reject pathPattern contenant `/admin`, `/api`, `_next`, `(admin)` ?
- Script `pnpm tsx src/scripts/scan-site-routes.ts` exécutable sans erreur ?
- Idempotent (re-run sans conflit) ?
- Score : 100 max

### V-03 — 🚨 EXCLUSIONS STRICTES 0 row admin/API en DB (/200)
**CRITÈRE KILL ABSOLU** — si > 0 row admin/api → 🔴 ÉCHEC CRITIQUE.

Queries de vérification :
```sql
-- Test 1 : aucune route admin
SELECT COUNT(*) FROM site_routes WHERE path_pattern LIKE '%(admin)%' OR path_pattern LIKE '%[adminPrefix]%';
-- Attendu : 0

-- Test 2 : aucune route API
SELECT COUNT(*) FROM site_routes WHERE path_pattern LIKE '%/api/%';
-- Attendu : 0

-- Test 3 : aucune route auth
SELECT COUNT(*) FROM site_routes WHERE path_pattern LIKE '%/(auth)/%' OR path_pattern LIKE '%/login%' OR path_pattern LIKE '%/logout%';
-- Attendu : 0

-- Test 4 : aucune route utilitaire
SELECT COUNT(*) FROM site_routes WHERE path_pattern LIKE '%_next%' OR path_pattern LIKE '%robots.txt%' OR path_pattern LIKE '%sitemap.xml%';
-- Attendu : 0

-- Test 5 : visibility est TOUJOURS 'public'
SELECT visibility, COUNT(*) FROM site_routes GROUP BY visibility;
-- Attendu : 1 ligne {visibility: 'public', count: X}

-- Test 6 : aucune route brouillon/draft archive
SELECT COUNT(*) FROM site_routes WHERE status='draft' OR status='preview';
-- Attendu idéalement : 0 (selon implémentation, possible exceptions)
```

Si UN seul de ces tests retourne valeur attendue ≠ : **CRITÈRE KILL → 🔴 ÉCHEC CRITIQUE** ; le sprint a violé la règle Will explicite.

Score : 200 max (les 6 tests doivent passer 100%)

### V-04 — Worker inspection daily (/80)
- `site-route-inspector-worker.ts` existe ?
- Cron schedule `0 2 * * *` (daily 2h UTC) configuré ?
- Logique HEAD + GET parse meta + H1 + word count + JSON-LD + liens + AiDisclaimer ?
- Rate limit 30/min ?
- `captureWorkerError` Sentry câblé ?
- Test fonctionnel : trigger manual du worker sur 1 SiteRoute → vérifier que `lastInspectedAt` updated + métadonnées populées
- Worker registré dans `src/server/queue/index.ts` ?
- Score : 80 max

### V-05 — Console admin /site-explorer (/150)
- Page `/[adminPrefix]/site-explorer/` rendue ?
- Tree view collapsible visible ?
- 4 server actions implémentées (listSiteRoutes, getSiteRouteDetail, triggerInspection, triggerScanAll) ?
- 7 composants admin créés (Layout, Filters, Stats, Tree, List, Row, Inspector) ?
- Filtres fonctionnels (Type, Section, Status, Verticale, Ville, recherche) ?
- **PAS de filtre "visibility"** dans l'UI (puisque tout est public — règle Will) ?
- Pagination 50 lignes/page ?
- Actions par ligne : Inspecter / Preview (nouvel onglet) / Éditer / Re-inspecter / Copier URL
- Sidebar admin entry "Site Explorer" dans section 📊 Suivi ?
- Mobile responsive ?
- Test UI : `pnpm dev` + visiter `/[adminPrefix]/site-explorer/` → screenshot
- Score : 150 max

### V-06 — Édition inline pages DB (/100)
- Editor `/[adminPrefix]/content-gen/articles/[id]/edit/` étendu ?
- Formulaire édition champs : title, metaTitle, metaDescription, bodyHtml, heroImageId, status, tags
- Validation Zod côté serveur ?
- Server Action `updateArticle(id, input)` avec audit trail SOC2 ?
- Regen JSON-LD post-edit ?
- IndexNow ping post-edit ?
- Preview avant submit ("Voir comme visiteur") ?
- Pour pages statiques : bouton "Éditer" désactivé + tooltip + lien GitHub source
- Test : éditer 1 article test, sauvegarder, vérifier DB updated + IndexNow ping logs
- Score : 100 max

### V-07 — Worker anomaly-detector (/100)
- `site-route-anomaly-detector.ts` existe ?
- Cron daily 3h UTC configuré ?
- 9 types anomalies détectables (404, metaTitle dup, metaDescription dup, H1 dup, orphan, thin content, no JSON-LD, no AiDisclaimer, no external links) ?
- Modèle `SiteRouteAnomaly` Prisma utilisé ?
- Page admin `/site-explorer/anomalies/` existe ?
- Filtres par type + sévérité ?
- Action "Résoudre" (marque resolvedAt) ?
- Badge sidebar si > 0 anomalies high severity ?
- Test : trigger worker manuel sur DB existante → vérifier rows `site_route_anomalies` créées
- Score : 100 max

### V-08 — Phase G Lighthouse (si livré, /50)
Phase G était optionnelle (skip si effort > 30h cumulés).

Si livré :
- `site-route-lighthouse-worker.ts` existe ?
- Cron weekly Sunday 4h UTC configuré ?
- Top 20 URLs ciblées (logique sélection : par trafic GSC ou wordCount) ?
- Scores stockés `SiteRoute.lighthousePerf/Seo/A11y/BP` ?
- Badge UI affiche scores ?
- Alerte Telegram si chute > 10 pts ?
- Score : 50 max (si Phase G skippée volontairement, attribuer 50/50 = OK)

### V-09 — Tests Vitest + gates anti-régression (/120)
- Tests Vitest count après sprint : vérifier ≥ baseline + 50-58 nouveaux tests attendus
- Tests spécifiques :
  - `site-route-model.test.ts` (6 tests)
  - `scan-site-routes.test.ts` (8 tests)
  - `site-route-inspector.test.ts` (8 tests)
  - `site-explorer-pages.test.tsx` (10 tests RTL)
  - `site-explorer-actions.test.ts` (8 tests)
  - `article-inline-edit.test.tsx` (8 tests)
  - `anomaly-detector.test.ts` (10 tests)
- **Test critique de non-régression admin/api** :
```typescript
test('scanner ne catalogue pas les routes admin', async () => {
  await runScanner();
  const adminRoutes = await prisma.siteRoute.findMany({
    where: {
      OR: [
        { pathPattern: { contains: '(admin)' } },
        { pathPattern: { contains: '[adminPrefix]' } },
        { pathPattern: { contains: '/api/' } },
        { pathPattern: { contains: '_next' } },
      ]
    }
  });
  expect(adminRoutes.length).toBe(0);
});
```
Ce test doit exister et passer.

Gates baseline :
- typecheck 0 erreur
- lint 0 erreur
- vitest tous passants
- prisma migrate status no drift
- isolation-check 0 violation

Score : 120 max

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents V-01 à V-09 : 0 contradiction
- Score global `/1000` honnête
- Top 5 forces sprint
- Top 5 P0 résiduels si présents
- Recommandation Will : verdict 🟢/🟡/🔴 + 3 options
- Score : 100 max

**TOTAL : 1000 pts**

---

## 4. CRITÈRES KILL AUTOMATIQUES → 🔴 ÉCHEC CRITIQUE

Le sprint est automatiquement déclaré **🔴 ÉCHEC CRITIQUE** si :

- ❌ **CRITIQUE WILL** : > 0 row admin/API/auth/utility dans `site_routes` table
- ❌ Modèle Prisma `SiteRoute` ou `SiteRouteAnomaly` absent
- ❌ Migration non appliquée (prisma migrate status = drift)
- ❌ Page `/site-explorer/` n'existe pas en console admin
- ❌ Worker inspection non registré
- ❌ Test "scanner ne catalogue pas admin" absent OU échoue
- ❌ Plus de 50% des tests Vitest sprint échouent

---

## 5. LIVRABLES

### Structure
```
_AUDIT/VERIF-SPRINT-SITE-EXPLORER-2026-05-23/
├── VERDICT-VERIF-SPRINT-SITE-EXPLORER.md  (livrable principal)
├── EXCLUSIONS-COMPLIANCE.md                ⭐ FICHIER CRITIQUE — preuves 0 admin/API
├── TESTS-FONCTIONNELS.md                   (tests UI + manual scan re-run)
└── agents/
    ├── V-01-modeles-prisma.md
    ├── V-02-script-scan.md
    ├── V-03-exclusions-strictes.md
    ├── V-04-worker-inspection.md
    ├── V-05-console-admin.md
    ├── V-06-edition-inline.md
    ├── V-07-anomaly-detector.md
    ├── V-08-lighthouse-phase-g.md
    └── V-09-tests-gates.md
```

### Format VERDICT-VERIF-SPRINT-SITE-EXPLORER.md

```markdown
# VERDICT VÉRIFICATION SPRINT SITE EXPLORER ADMIN
## Date : YYYY-MM-DD
## Score : XXX/1000 — 🟢 LIVRÉ PROPRE | 🟡 RÉSERVES | 🔴 ÉCHECS CRITIQUES

## ⚠️ CRITÈRES KILL
- 0 row admin/API en DB : ✅/❌
- Modèles Prisma présents : ✅/❌
- Migration appliquée : ✅/❌
- Page admin rendue : ✅/❌
- Worker inspection registré : ✅/❌
- Test non-régression existant + passant : ✅/❌

## Score par agent
| Agent | Score | Max |

## Top 5 forces
## Top 5 P0 résiduels
## Recommandation Will

## STOP & ASK
- Sprint Site Explorer utilisable production : OUI / CONDITIONNEL / NON
```

### Format EXCLUSIONS-COMPLIANCE.md (⭐ critique)

```markdown
# Exclusions compliance — Site Explorer

## Test 1 : aucune route admin
SQL : SELECT COUNT(*) FROM site_routes WHERE path_pattern LIKE '%(admin)%';
Résultat observé : X
Attendu : 0
Statut : ✅/❌

## Test 2 : aucune route API
...

## Test 3 : aucune route auth
...

## Test 4 : aucune route utilitaire
...

## Test 5 : visibility = 'public' partout
...

## Verdict EXCLUSIONS : ✅ 100% COMPLIANT | ❌ ÉCHECS DÉTECTÉS
```

### Mémoire
Slug : `axionia_verif_sprint_site_explorer_2026-05-23`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Vérif Sprint Site Explorer LIVRÉE 2026-05-23 — score XXX/1000](axionia_verif_sprint_site_explorer_2026-05-23.md) — 9 sous-agents. EXCLUSIONS-COMPLIANCE : 6/6 tests SQL OK (0 row admin/API/auth/utility). Modèles + script + workers + console admin + édition inline + anomaly + Lighthouse vérifiés.
```

---

## 6. STOP & ASK FINAL

```
✅ Vérification Sprint Site Explorer livrée.

📊 Score : XXX/1000 — 🟢 LIVRÉ PROPRE | 🟡 RÉSERVES | 🔴 ÉCHECS CRITIQUES

⚠️ CRITÈRES KILL :
- 0 row admin/API en DB : ✅/❌
- Modèles Prisma + migration : ✅/❌
- Workers + Console admin : ✅/❌
- Test non-régression : ✅/❌

🔍 Tests SQL exclusions (6) : X/6 passants

📋 Recommandation Will :
<Sprint Site Explorer utilisable production : OUI / CONDITIONNEL / NON>

🚀 Choix Will :
[A] Sprint validé → activer worker inspection + lancer scan initial
[B] Sprint avec réserves → corrections ciblées (~Xh)
[C] Échec critique → re-sprint corrective
```

---

## 7. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance la vérification décrite dans `_AUDIT/PROMPT-VERIF-SPRINT-SITE-EXPLORER-ADMIN-2026-05-23.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. RÈGLE STRICTE OBJECTIVE du Site Explorer : catalogue UNIQUEMENT URLs publiques visiteurs (PAS admin/API/auth/utility). Lire EN PREMIER VERDICT-SPRINT-SITE-EXPLORER.md + spec source + code créé (prisma/schema.prisma, src/scripts/scan-site-routes.ts, workers, console admin /site-explorer, 7 composants, server actions). Spawn 9 sous-agents parallèles V-01 à V-09 : modèles Prisma + migration, script scan-site-routes, 🚨 EXCLUSIONS STRICTES 6 tests SQL (0 row admin/API/auth/utility, visibility='public' partout) CRITÈRE KILL ABSOLU, worker inspection daily, console admin tree view + filtres + 4 server actions, édition inline pages DB articles avec regen JSON-LD + IndexNow, worker anomaly-detector 9 types, Phase G Lighthouse (si livré), tests Vitest count + test non-régression critique. Critères kill (> 0 row admin/API OU modèle Prisma absent OU migration non appliquée OU console admin absente OU test non-régression manquant → 🔴 ÉCHEC CRITIQUE). Self-troubleshoot toutes erreurs. Score `/1000` HONNÊTE pas gonflé. Produis VERDICT-VERIF-SPRINT-SITE-EXPLORER.md + EXCLUSIONS-COMPLIANCE.md (preuves SQL) + TESTS-FONCTIONNELS.md + 9 rapports agents dans `_AUDIT/VERIF-SPRINT-SITE-EXPLORER-2026-05-23/`. Mémoire axionia_verif_sprint_site_explorer_2026-05-23 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢/🟡/🔴 + 3 options [A/B/C]. Go.
```

---

*Vérification Sprint Site Explorer — 4-5h Sonnet 4.6 autopilot — AUDIT-ONLY*
