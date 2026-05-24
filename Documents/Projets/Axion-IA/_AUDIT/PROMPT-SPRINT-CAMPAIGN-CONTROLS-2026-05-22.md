# SPRINT CAMPAIGN CONTROLS — Pilotage avancé des campagnes
## AxionIA Content-Gen — Extension `CoverageCampaign` (durée + ordre villes + schedule)

**Date création** : 2026-05-22
**Phase parent** : Sprint follow-up post-pipeline content-gen perfection 2026
**Type** : Sprint fonctionnel autonome (non-correctif)
**Score cible** : N/A (sprint additif, pas de gap audit à combler)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 12-15h autopilot
**Verdict P5 console admin requis** : pas obligatoire (sprint touche modèle + workers + 2 pages admin V2)

---

## 0. MISSION

Étendre le modèle `CoverageCampaign` avec **4 nouvelles capabilities** demandées explicitement par Will 2026-05-22 :

1. **`cityProcessingMode`** : `"parallel" | "sequential"` → toggle ordre traitement villes
2. **`startDate`** : `DateTime?` nullable → date démarrage planifiée
3. **`endDate`** : `DateTime?` nullable → deadline auto-stop. **`null` = durée illimitée**
4. **`recurringSchedule`** : `String?` nullable → cron expression. **`null` = one-shot**

Aucune capability ne casse les campagnes existantes (tous nullables, défauts cohérents avec comportement actuel).

---

## 1. CONTEXTE — À LIRE AVANT TOUT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main au lancement** : à découvrir (`git log origin/main -1 --oneline`)
- **HEAD origin/main référence** : `e0b1973` ou supérieur

### Fichiers à lire
1. `prisma/schema.prisma` — modèle actuel `CoverageCampaign` (à étendre, pas réécrire)
2. `src/server/content-gen/admin/coverage.ts` — Server Actions création/update/list campagnes
3. `src/server/queue/workers/content-gen-orchestrator-worker.ts` (ou équivalent) — orchestrateur qui consomme `anchorVilleSlugs[]`
4. `src/server/queue/workers/content-gen-worker.ts` — worker principal
5. `src/components/admin/content-gen/CoverageNewV2.tsx` (wizard nouvelle campagne)
6. `src/components/admin/content-gen/CoverageDetailV2.tsx` (page détail campagne)
7. Mémoire `axionia_decisions_will_final_2026-05-21.md` (D7 société FR, exclusions)
8. Mémoire `axionia_p5_decisions_canoniques_2026-05-21.md` (6 presets CampaignTemplate)

### Mode IMPLEMENTATION
- ✅ Modifications `prisma/schema.prisma`, `src/server/`, `src/components/`
- ✅ Migration Prisma additive (nullable fields)
- ✅ Commits Conventional + Co-Authored-By + push
- ❌ JAMAIS `--no-verify` git
- ❌ JAMAIS modifier `villes/copy/*` (Manon)
- ❌ JAMAIS modifier `image-bank/seed-images.ts` (Manon)
- ❌ JAMAIS modifier composants SEO (P3 territory)
- ❌ JAMAIS modifier `llm-judge.ts` ou KB (P4 territory)
- ❌ Aucune décision Will à demander (toutes pré-validées dans ce prompt)

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck   # 0 erreur (baseline P1.5)
pnpm lint        # 0 erreur (warnings hors scope OK)
pnpm test        # vitest ≥ 1376/1383 + nouveaux tests sprint
pnpm content-gen:isolation-check
pnpm prisma migrate diff
pnpm prisma validate
```

### Gates obligatoires AVANT chaque push
```powershell
git pull --rebase origin main  # convergence
```

### Format commits
```
feat(content-gen): campaign controls — <description>

<corps>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. SPEC DÉTAILLÉE DES 4 CAPABILITIES

### Capability 1 — `cityProcessingMode`

**Schema Prisma** :
```prisma
enum CityProcessingMode {
  parallel    // défaut : tous les villes traitées simultanément (comportement actuel)
  sequential  // ville par ville dans l'ordre du tableau anchorVilleSlugs[]
}

model CoverageCampaign {
  // ... champs existants ...
  cityProcessingMode CityProcessingMode @default(parallel)
}
```

**Logic worker** :
- Si `cityProcessingMode = "parallel"` : comportement actuel inchangé (BullMQ concurrency=3, ordre indifférent)
- Si `cityProcessingMode = "sequential"` :
  - Orchestrator crée les jobs ville par ville dans l'ordre `anchorVilleSlugs[]`
  - **NE PAS lancer ville N+1 tant que toutes les jobs de ville N ne sont pas dans status `published | failed | quarantined`**
  - Implémentation : champ `currentCityIndex` dans `CoverageCampaign` qui tracke où on en est. Worker `content-gen-orchestrator-worker` lit ce champ, ne crée les jobs ville `currentCityIndex` que si toutes les jobs villes < `currentCityIndex` sont terminées.

**Sequential — pseudocode orchestrator** :
```typescript
async function orchestrateSequentialCampaign(campaignId: string) {
  const campaign = await prisma.coverageCampaign.findUnique({ where: { id: campaignId } });
  if (campaign.cityProcessingMode !== 'sequential') return;

  const currentCityIdx = campaign.currentCityIndex ?? 0;
  if (currentCityIdx >= campaign.anchorVilleSlugs.length) return; // terminé

  const currentCitySlug = campaign.anchorVilleSlugs[currentCityIdx];

  // Vérifier si toutes les jobs de la ville actuelle sont terminées
  const pendingJobsCurrentCity = await prisma.contentGenJob.count({
    where: {
      campaignId,
      anchorVilleSlug: currentCitySlug,
      status: { in: ['queued', 'running', 'awaiting_review'] }
    }
  });

  if (pendingJobsCurrentCity === 0) {
    // Passer à la ville suivante
    await prisma.coverageCampaign.update({
      where: { id: campaignId },
      data: { currentCityIndex: currentCityIdx + 1 }
    });
    // Créer jobs ville suivante
    await createJobsForCity(campaign.anchorVilleSlugs[currentCityIdx + 1]);
  }
  // Sinon : attendre, ne rien créer pour le moment
}
```

**Migration Prisma** : `20260522100000_add_campaign_controls`
```sql
-- Migration additive, 0 risque pour campagnes existantes
ALTER TABLE coverage_campaigns
  ADD COLUMN city_processing_mode TEXT NOT NULL DEFAULT 'parallel',
  ADD COLUMN current_city_index INTEGER;

-- Enum CityProcessingMode géré côté Prisma (mappé sur TEXT en DB pour flexibilité)
```

### Capability 2 — `startDate` (nullable)

**Schema Prisma** :
```prisma
model CoverageCampaign {
  startDate DateTime? // null = démarre dès création
}
```

**Logic** :
- Si `startDate = null` : campagne démarre immédiatement au moment de `prisma.coverageCampaign.create()` (comportement actuel)
- Si `startDate` est dans le futur :
  - Campagne créée avec `status = "scheduled"` (nouveau status à ajouter à `CoverageStatus` enum)
  - Cron worker (existant ou nouveau `content-gen-scheduler-worker.ts`) tourne toutes les 5 min, scanne `WHERE status='scheduled' AND startDate <= NOW()` → passe en `running` et déclenche orchestrator
- Si `startDate` est dans le passé : même comportement que `null` (démarrage immédiat) + warning log

**Migration** : ajout colonne nullable + ajout valeur enum `scheduled` à `CoverageStatus`.

### Capability 3 — `endDate` (nullable = durée illimitée)

**Schema Prisma** :
```prisma
model CoverageCampaign {
  endDate DateTime? // null = durée illimitée
}
```

**Logic** :
- Si `endDate = null` : campagne tourne tant que :
  - Mode one-shot (`recurringSchedule = null`) : jusqu'à completion (= comportement actuel)
  - Mode récurrent (`recurringSchedule != null`) : pour toujours, jusqu'à pause manuelle Will
- Si `endDate` défini :
  - Cron daily worker `content-gen-deadline-checker.ts` tourne 1×/jour à 00:05 UTC
  - Scanne `WHERE endDate IS NOT NULL AND endDate <= NOW() AND status IN ('running', 'scheduled')`
  - Pour chaque campagne expirée :
    - Set `status = "completed_by_deadline"` (nouveau status, ou `completed` simple avec champ `completedReason: "deadline_reached"`)
    - Purger les jobs BullMQ en queue restants (réutiliser logique `pauseCampaign()` existante)
    - Logger l'événement SOC2 audit `CAMPAIGN_AUTO_STOPPED_DEADLINE`

**Migration** : ajout colonne nullable + ajout valeur enum `completed_by_deadline` (optionnel, ou utiliser `completed` standard).

### Capability 4 — `recurringSchedule` (cron, nullable)

**Schema Prisma** :
```prisma
model CoverageCampaign {
  recurringSchedule String? // null = one-shot (comportement actuel)
                            // ex: "0 9 * * 1" = tous les lundis 9h CET
                            // ex: "0 7 * * *" = quotidien 7h CET
                            // ex: "0 9 1 * *" = 1er du mois 9h CET
}
```

**Logic** :
- Si `recurringSchedule = null` : one-shot (comportement actuel, jobs créés une fois, campagne complete quand tous traités)
- Si `recurringSchedule` défini :
  - Au démarrage de la campagne, enregistrer un **BullMQ Repeatable Job** :
    ```typescript
    await queue.add(
      `campaign-${campaign.id}-recurring`,
      { campaignId: campaign.id },
      {
        repeat: { pattern: campaign.recurringSchedule, tz: 'Europe/Paris' }
      }
    );
    ```
  - À chaque tick du cron :
    - Vérifier que campagne `status != "paused"` et `endDate ?? Infinity > NOW()`
    - Si OK : créer un nouveau batch de jobs (selon `typeDistribution` + `audienceMix` + villes)
    - Si pas OK : skip ce tick (mais le repeatable job continue)
- Si `endDate` atteint : déclencheur du daily-checker (Capability 3) supprime le repeatable job via `queue.removeRepeatable()`

**Validation cron** : utiliser `cron-parser` (npm package, à ajouter aux deps) pour valider le cron string côté serveur avant `prisma.coverageCampaign.create()`. Refuser si invalide.

**Migration** : ajout colonne nullable.

---

## 3. PHASE A — SCHEMA + MIGRATION (~2h)

### Tâches
1. Lire `prisma/schema.prisma` complet pour ne rien casser
2. Ajouter les 4 champs à `CoverageCampaign` :
   - `cityProcessingMode CityProcessingMode @default(parallel)`
   - `currentCityIndex Int?`
   - `startDate DateTime?`
   - `endDate DateTime?`
   - `recurringSchedule String?`
   - `completedReason String?` (optionnel : "deadline_reached" | "target_reached" | "paused_will" — utile pour audit)
3. Ajouter enum `CityProcessingMode { parallel sequential }`
4. Ajouter valeur enum `scheduled` à `CoverageStatus` (si elle n'existe pas déjà)
5. Créer migration `20260522100000_add_campaign_controls` :
   ```bash
   pnpm prisma migrate dev --name add_campaign_controls --create-only
   ```
6. Vérifier que la migration ne casse PAS les campagnes existantes (tous nullables, défauts cohérents)
7. Lancer migration localement : `pnpm prisma migrate dev`
8. Vérifier : `pnpm prisma validate` + `pnpm typecheck`

### Commit
```
feat(content-gen): campaign controls — Prisma schema (4 capabilities)

- Add cityProcessingMode (parallel|sequential) + currentCityIndex
- Add startDate (nullable, scheduled status)
- Add endDate (nullable = durée illimitée)
- Add recurringSchedule (cron expression, nullable = one-shot)
- Add completedReason (optional audit field)
- Migration 20260522100000 additive, no impact on existing campaigns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. PHASE B — SERVER ACTIONS (~3h)

### Tâches
1. Étendre `src/server/content-gen/admin/coverage.ts` :
   - `createCampaign(input)` accepte les 4 nouveaux champs
   - Validation Zod côté serveur :
     - `cityProcessingMode` : enum strict
     - `startDate` : date valide, si dans le passé → null OK avec warning, sinon respecté
     - `endDate` : date valide, si défini, doit être > `startDate ?? NOW()`. Si défini et dans le passé : refuser.
     - `recurringSchedule` : valider avec `cron-parser` (ajout dep), refuser si invalide
   - Si `startDate` futur : `status = "scheduled"`
   - Si `recurringSchedule` défini : enregistrer BullMQ Repeatable Job
2. `updateCampaign(id, input)` : permettre modification des 4 champs sur campagne `draft | scheduled` (pas sur `running` sauf `endDate` qui peut être étendu/raccourci à chaud)
3. `pauseCampaign(id)` existant : ajouter cleanup repeatable job si `recurringSchedule` défini
4. Nouvelles Server Actions :
   - `scheduleCampaign(id, startDate)` : passer une campagne `draft` à `scheduled`
   - `extendCampaignDeadline(id, newEndDate)` : étendre `endDate` (audit SOC2 obligatoire)

### Tests Vitest
- `coverage.test.ts` : 12 tests minimum couvrant les 4 capabilities + combinaisons (cf. tableau §0 du prompt)

### Commit
```
feat(content-gen): campaign controls — Server Actions + validation Zod

- createCampaign/updateCampaign accept 4 new fields with Zod validation
- cron-parser dependency added for recurringSchedule validation
- scheduleCampaign + extendCampaignDeadline new actions
- pauseCampaign cleans up repeatable jobs
- 12 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. PHASE C — WORKERS LOGIC (~5h)

### Tâche 5.1 — Sequential mode (Capability 1)
- Modifier `src/server/queue/workers/content-gen-orchestrator-worker.ts` (ou créer si absent) :
  - Au démarrage campagne, lire `cityProcessingMode`
  - Si `sequential` : implémenter logic ville par ville (pseudocode §2 Capability 1)
  - Si `parallel` : comportement actuel inchangé
- Champ `currentCityIndex` mis à jour atomiquement (`prisma.coverageCampaign.update({ where: { id, currentCityIndex: expectedIdx } })`)

### Tâche 5.2 — Scheduler worker (Capability 2)
- Créer `src/server/queue/workers/content-gen-scheduler-worker.ts` :
  - Cron BullMQ : every 5 minutes
  - Query : `WHERE status='scheduled' AND startDate <= NOW()`
  - Pour chaque campagne : passe `status = 'running'` + déclenche orchestrator
- Registrer le worker dans `src/server/queue/index.ts` (ou équivalent)

### Tâche 5.3 — Deadline checker worker (Capability 3)
- Créer `src/server/queue/workers/content-gen-deadline-checker.ts` :
  - Cron BullMQ : daily 00:05 UTC
  - Query : `WHERE endDate IS NOT NULL AND endDate <= NOW() AND status IN ('running', 'scheduled')`
  - Pour chaque campagne expirée :
    - Set `status = 'completed'` + `completedReason = 'deadline_reached'` + `completedAt = NOW()`
    - Purger jobs BullMQ en queue (réutiliser `pauseCampaign()` logic interne)
    - Si `recurringSchedule` défini : `queue.removeRepeatable()` pour stopper le cron
    - Audit log SOC2 `CAMPAIGN_AUTO_STOPPED_DEADLINE`
- Registrer le worker

### Tâche 5.4 — Repeatable jobs (Capability 4)
- Modifier orchestrateur pour enregistrer le BullMQ Repeatable Job au démarrage campagne récurrente
- À chaque tick :
  - Lire campagne, vérifier `status = 'running'` et `endDate ?? Infinity > NOW()`
  - Si OK : créer batch jobs selon `typeDistribution` + `audienceMix`
  - Si KO : skip (mais repeatable job continue, sera nettoyé par deadline-checker ou pauseCampaign)

### Tests Vitest
- `orchestrator-sequential.test.ts` : 6 tests (mode sequential vs parallel, currentCityIndex avance correctement, ville bloquée si jobs pending)
- `scheduler-worker.test.ts` : 4 tests (passage scheduled→running)
- `deadline-checker.test.ts` : 5 tests (auto-stop, cleanup repeatable, audit log)
- `recurring-schedule.test.ts` : 5 tests (cron tick, skip si paused, cleanup endDate)

### Commits (incrémentaux par tâche)
```
feat(content-gen): campaign controls — sequential city processing
feat(content-gen): campaign controls — scheduler worker (startDate)
feat(content-gen): campaign controls — deadline checker worker (endDate auto-stop)
feat(content-gen): campaign controls — recurring schedule (BullMQ repeatable jobs)
```

---

## 6. PHASE D — UI ADMIN (~4h)

### Tâche 6.1 — Wizard `CoverageNewV2.tsx`
Étendre le formulaire avec :

```
┌─ Section "Planification" ─────────────────────────────────┐
│                                                            │
│ Date de démarrage (optionnel)                             │
│ [📅 ____________]  ☑ Démarrer immédiatement              │
│                                                            │
│ Date de fin (optionnel)                                   │
│ [📅 ____________]  ☑ Durée illimitée                     │
│                                                            │
│ Récurrence (optionnel)                                    │
│ [ ] One-shot (par défaut)                                 │
│ [ ] Tous les jours à __h__                                │
│ [ ] Toutes les semaines, jour: __ , à __h__               │
│ [ ] Tous les mois, jour: __ , à __h__                     │
│ [ ] Cron personnalisé : [_______________]                 │
│                                                            │
│ Mode traitement villes                                    │
│ ◉ Parallèle (toutes les villes en même temps)            │
│ ○ Séquentiel (ville par ville dans l'ordre ci-dessous)   │
│                                                            │
│ Si séquentiel, ordre des villes :                         │
│   [≡ Paris]                                               │
│   [≡ Lyon]                                                │
│   [≡ Marseille]                                           │
│   (drag-and-drop pour réordonner)                         │
└────────────────────────────────────────────────────────────┘
```

- Validation côté client (Zod) : startDate ≤ endDate, cron valide (preview "prochain tick : <date>")
- Cron presets dropdown (quotidien/hebdo/mensuel) + champ texte avancé

### Tâche 6.2 — `CoverageDetailV2.tsx`
Afficher pour chaque campagne :
- Si `startDate` futur : badge "📅 Programmée pour <date>"
- Si `endDate` défini : badge "⏰ Auto-stop le <date>" + countdown
- Si `recurringSchedule` : badge "🔄 Récurrente : <description humaine du cron>" (ex: "tous les lundis 9h")
- Si `cityProcessingMode = sequential` : afficher liste villes avec progression :
  ```
  ✅ Paris (50/50 publiés)
  🔄 Lyon (12/50 en cours)
  ⏸️ Marseille (en attente)
  ⏸️ Toulouse (en attente)
  ```

### Tâche 6.3 — Helpers
- `src/lib/cron-to-human.ts` : convertir cron string → texte FR ("tous les lundis 9h" depuis "0 9 * * 1"). Utiliser `cronstrue` (npm) avec locale FR.

### Tests
- Tests React Testing Library pour wizard + detail
- Tests E2E Playwright optionnels (skip si pas configuré)

### Commit
```
feat(content-gen-admin): campaign controls — wizard + detail UI

- Wizard etend section "Planification" (4 nouveaux champs)
- CoverageDetailV2 affiche badges startDate/endDate/recurring + progression sequential
- cronstrue dependency for FR human-readable cron
- React Testing Library tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. PHASE E — DOCS + EXEMPLES (~1h)

### Tâche 7.1 — Mettre à jour les 6 presets CampaignTemplate
Le seed `seed-campaign-templates.ts` doit être enrichi pour montrer chaque capability :
- `pme-audits` : `cityProcessingMode: "sequential"` (PME stratégique, on prend ville par ville)
- `interventions-weekly` : `recurringSchedule: "0 9 * * 1"` (déjà prévu, ajouter explicitement)
- `tpe-burst` : `endDate` = NOW + 30 jours (burst limité)
- `eti-pilier` : `cityProcessingMode: "parallel"` (volume)
- `cities-paris` : `cityProcessingMode: "sequential"` (Paris first, ville par ville si extension)
- `rss-daily` : `recurringSchedule: "0 7 * * *"` (déjà prévu)

### Tâche 7.2 — Documentation interne
Créer `_AUDIT/CAMPAIGN-CONTROLS-DOC-2026-05-22.md` :
- Tableau combinaisons startDate/endDate/recurringSchedule (cf. §0 du prompt)
- Exemples cron usuels (quotidien, hebdo, mensuel, trimestriel)
- Comportements limites (campagne récurrente avec endDate → quand stop ?)
- Migration : aucun impact sur campagnes existantes (tous nullables + défauts)

### Commit
```
feat(content-gen): campaign controls — presets enrichis + doc interne

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. ZONES INTERDITES

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ `src/server/content-gen/generators/*.ts` (P4)
- ❌ `src/components/seo/*.tsx` (P3)
- ❌ `src/server/content-gen/reviewer/llm-judge.ts` (P4)
- ❌ `src/server/content-gen/kb/**` (P4)
- ❌ Modèle Prisma `ArticleFeedback` (P5)
- ❌ Modèle Prisma `CampaignTemplate` (P5, juste enrichir le seed)
- ❌ Ne PAS toucher au comportement publication auto/manuel (Will a explicitement renoncé à ce toggle 2026-05-22)
- ❌ Ne PAS toucher au `MAX_PUBLISH_PER_DAY` (D-P5-5)

---

## 9. LIVRABLES & FORMAT

### Verdict sprint
`_AUDIT/CAMPAIGN-CONTROLS-2026-05-22/VERDICT-SPRINT-CAMPAIGN-CONTROLS.md`

Format :
```markdown
# VERDICT SPRINT CAMPAIGN CONTROLS
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA court>
## Effort réel : XXh (vs estimé 12-15h)

## Capabilities livrées
| # | Capability | Statut | Commit |
|---|---|---|---|
| 1 | cityProcessingMode | ✅/⚠️/❌ | abc1234 |
| 2 | startDate | ✅/⚠️/❌ | def5678 |
| 3 | endDate (nullable = illimité) | ✅/⚠️/❌ | ... |
| 4 | recurringSchedule (cron) | ✅/⚠️/❌ | ... |

## Migration Prisma
- 20260522100000_add_campaign_controls appliquée ✅
- 6 nouveaux champs sur CoverageCampaign (tous nullables ou avec défauts)
- 0 impact campagnes existantes

## Workers créés
- content-gen-scheduler-worker.ts (cron 5 min)
- content-gen-deadline-checker.ts (cron daily 00:05 UTC)
- content-gen-orchestrator-worker.ts étendu (sequential mode)

## UI livrée
- CoverageNewV2 : wizard étendu section "Planification"
- CoverageDetailV2 : badges + progression sequential

## Dependencies ajoutées
- cron-parser (validation côté serveur)
- cronstrue (FR human-readable cron côté UI)

## Tests Vitest
- coverage.test.ts : 12 tests
- orchestrator-sequential.test.ts : 6 tests
- scheduler-worker.test.ts : 4 tests
- deadline-checker.test.ts : 5 tests
- recurring-schedule.test.ts : 5 tests
- TOTAL : 32 nouveaux tests, 0 régression

## Gates anti-régression
- typecheck : ✅
- lint : ✅
- vitest : 1408/1415 (vs baseline 1376/1383)
- isolation-check : ✅
- prisma migrate status : ✅

## Presets enrichis
- 6 presets CampaignTemplate démontrent les capabilities

## Actions Will post-sprint
- Aucune obligatoire
- Tester un cycle complet : créer campagne récurrente "Test daily 2 villes Paris+Lyon sequential" → observer 3 jours

## UNKNOWNs résiduels
- ...
```

### Mémoire
Slug : `axionia_sprint_campaign_controls_livre_2026-05-22`
Type : project
Body : 4 capabilities livrées, comportements possibles, presets enrichis, actions Will optionnelles.

### MEMORY.md
```
- [🟢 AxionIA Sprint Campaign Controls LIVRÉ 2026-05-22 — 4 capabilities](axionia_sprint_campaign_controls_livre_2026-05-22.md) — cityProcessingMode (parallel/sequential) + startDate + endDate (null=illimité) + recurringSchedule (cron). 32 tests + 6 presets enrichis. 0 régression.
```

---

## 10. STOP & ASK FINAL

```
✅ Sprint Campaign Controls livré.
- HEAD : <sha>
- 4 capabilities pleinement opérationnelles
- 32 nouveaux tests vitest
- 0 régression baseline
- 6 presets CampaignTemplate enrichis
- Migration Prisma additive (campagnes existantes intactes)

🎯 Comportements possibles désormais :
- One-shot illimité (status quo)
- Planifié (startDate futur)
- Auto-stop (endDate)
- Récurrent illimité (cron + endDate=null)
- Récurrent borné (cron + endDate)
- Ville par ville (sequential)

🚀 Suite proposée :
[A] Tester un cycle complet en prod (créer campagne récurrente test)
[B] Continuer pipeline content-gen perfection 2026 (P6 verdict global + méta-audit)
[C] Lancer un autre sprint follow-up
```

---

## 11. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le sprint décrit dans `_AUDIT/PROMPT-SPRINT-CAMPAIGN-CONTROLS-2026-05-22.md`. Mode IMPLEMENTATION (commits incrémentaux + push autorisés). Décisions Will validées dans le prompt (4 capabilities exactes, endDate nullable=illimité, pas de toggle auto/manuel publication). Phase A schema Prisma → Phase B Server Actions → Phase C workers (sequential + scheduler + deadline-checker + recurring) → Phase D UI wizard + detail → Phase E presets enrichis + doc. Convergence Manon (git pull --rebase avant chaque push). Gates verts obligatoires (typecheck 0, lint 0, vitest ≥ 1376+, isolation-check, prisma validate). Zones interdites strictes (villes/copy, image-bank seed, generators, seo components, llm-judge, kb, ArticleFeedback, CampaignTemplate, MAX_PUBLISH). 32 nouveaux tests vitest obligatoires. cron-parser + cronstrue deps ajoutées. Termine par VERDICT-SPRINT-CAMPAIGN-CONTROLS.md + mémoire axionia_sprint_campaign_controls_livre_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale. Go.
```

---

*Sprint Campaign Controls — 12-15h autopilot — IMPLEMENTATION — Extension pilotage campagnes Will 2026-05-22*
