# CONTRAT D'INTERFACE — T10 Satisfaction + indicateurs + dashboard KPIs + BPF

Schéma + migration **déjà faits** (`20260606200000_qualiopi_t10_questionnaires` appliquée, `prisma generate` fait). Disponible :
- enum `QuestionnaireType` (`positionnement|satisfaction_chaud|satisfaction_froid`).
- modèle `Questionnaire` (enrollmentId, type, token unique, reponses Json, noteGlobale Int? 1-5, envoyeAt, reponduAt). `@@unique [enrollmentId, type]`. `Enrollment.questionnaires`.
- **Indicateurs Qualiopi = CALCULÉS (aucune table)** + cache Redis.

## Règles NON négociables
- Prisma via `@/lib/prisma`, types via `../../../../prisma/generated/client`. **PAS de SQL brut** (les formules SQL des specs → traduire en requêtes/agrégations Prisma + calcul TS).
- Redis via `import { redis } from "@/lib/redis"` : `await redis.get(key)`, `await redis.set(key, val, "EX", ttlSec)`, `await redis.del(key)`. Stub-aware : `redis` est déjà no-op au build stub ; en plus, garder les services purs testables (calcul séparé des I/O).
- `exactOptionalPropertyTypes: true` (spread conditionnel). Zéro valeur en dur (seuils via `getQualiopiConfig` : `seuil_presence_pct`, `seuil_reussite_pct`). Français partout. Tokens admin pour l'UI.
- Tests Vitest co-localisés, aucun mock de prod, fixtures réalistes.
- Cloisonnement : fichiers UNIQUEMENT sous `src/server/qualiopi/{satisfaction,indicateurs,bpf}/**`, `src/server/actions/qualiopi/satisfaction.ts`, UI sous `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/indicateurs/**`, `src/components/admin/qualiopi/**`, + modif additive `src/lib/admin-nav.ts` et `src/server/queue/workers/qualiopi-formation-crons-worker.ts` (invalidation cache à la clôture).

## Formules officielles (specs §6.3, à traduire en Prisma)
- **Taux satisfaction** = `round(AVG(noteGlobale)/5*100, 1)` sur Questionnaire type `satisfaction_chaud`, reponduAt non null, noteGlobale non null, année session. Méthode à afficher : « Calculé sur la note globale (1 à 5) de tous les questionnaires de satisfaction remplis à l'issue de chaque session, rapportée à 100. (N évaluations du [début] au [fin]). »
- **Taux réussite** = `round(count(niveauGlobal='acquis')/count(*)*100,1)` sur EvaluationAcquis type `finale` (join enrollment→session, année).
- **Taux complétion (présence)** = `round(count(tauxPresencePct>=seuil)/count(*)*100,1)` sur Enrollment de sessions `realisee`, statut ∉ {abandon,exclu}.
- **Délai d'accès moyen (jours)** = `AVG(session.dateDebut - enrollment.createdAt)` sur sessions `realisee`.
- **Plausibilité** : si nb < 5, marquer `fiable=false` + libellé « en cours de constitution ».

## BPF (specs §5.2 — agrégats année N)
nb_sessions (realisee), nb_stagiaires_distincts (DISTINCT traineeId), nb_heures_stagiaires (Σ dureeReelleHeures×nbParticipantsReels), ca_total_ht (Σ montantHtCents), ca par financeur (opco/cpf/france_travail/direct/mixte), nb_formateurs_internes (Trainer salarie), nb_formateurs_externes (sous_traitant). Export CSV. Identité via `getOrganismeIdentite()`.

## AGENT A — services calcul (aucune UI)
- `src/server/qualiopi/satisfaction/satisfaction-service.ts` :
  - `creerQuestionnaire(input: { enrollmentId: string; type: QuestionnaireType }): Promise<{ id: string; token: string }>` (token via `makeQrToken()` de `@/server/qualiopi/documents/qr`, upsert idempotent sur [enrollmentId,type]). Stub-aware.
  - `soumettreReponses(input: { token: string; reponses: Record<string, unknown>; noteGlobale?: number }): Promise<{ id: string } | null>` (set reponses+noteGlobale+reponduAt ; noteGlobale validé 1..5).
  - `listQuestionnairesSession(sessionId: string)` (lecture).
  - `+ satisfaction-service.spec.ts`.
- `src/server/qualiopi/indicateurs/calcul.ts` (PUR — aucune I/O) :
  - `computeTauxSatisfaction(notes: number[]): { tauxPct: number; nb: number; fiable: boolean }`
  - `computeTauxReussite(niveaux: Array<"non_acquis"|"partiellement_acquis"|"acquis">): { tauxPct: number; nb: number; nbValides: number; fiable: boolean }`
  - `computeTauxCompletion(tauxPresences: Array<number | null>, seuilPct: number): { tauxPct: number; nb: number; fiable: boolean }`
  - `computeDelaiAccesMoyen(paires: Array<{ dateDebut: Date; createdAt: Date }>): { jours: number; nb: number }`
  - `+ calcul.spec.ts`.
- `src/server/qualiopi/indicateurs/service.ts` :
  - `getIndicateurs(annee: number, formationId?: string): Promise<IndicateursResult>` — Prisma queries → calcul.ts → `{ annee, tauxSatisfaction, tauxReussite, tauxCompletion, delaiAccesMoyen, methodes: {...}, calculeAt }`. Cache Redis clé `qualiopi:indicateurs:${annee}:${formationId ?? "all"}` TTL 3600 (lire avant calcul, écrire après). Stub-aware (si build, ne pas dépendre du cache).
  - `invalidateIndicateursCache(annee?: number): Promise<void>` (del clé(s)).
  - `+ service.spec.ts` (mock prisma + redis).
- `src/server/qualiopi/bpf/service.ts` :
  - `computeBpf(annee: number): Promise<BpfResult>` (agrégats ci-dessus via Prisma).
  - `bpfToCsv(bpf: BpfResult): string` (pur, CSV `;`-séparé, en-têtes FR).
  - `+ bpf-service.spec.ts`.

## AGENT B — server actions + invalidation cache (importe AGENT A)
- `src/server/actions/qualiopi/satisfaction.ts` (`"use server"`, pattern enrollments.ts) :
  - `genererQuestionnairesSessionAction({ sessionId, types? })` : crée les questionnaires (défaut: positionnement + satisfaction_chaud + satisfaction_froid) pour chaque enrollment actif via `creerQuestionnaire`. Idempotent. Audit.
  - `saisirReponsesQuestionnaireAction({ token, reponses, noteGlobale? })` : `soumettreReponses` + invalidateIndicateursCache(année) + audit.
  - `recomputeIndicateursAction({ annee, formationId? })` : invalidate + getIndicateurs. Audit.
  - `exportBpfCsvAction({ annee })` : `computeBpf` + `bpfToCsv` → `{ csv, filename }`. Audit.
- modif additive `src/server/queue/workers/qualiopi-formation-crons-worker.ts` : dans `handleClotureAuto` (après transition realisee), appeler `invalidateIndicateursCache(annee de la session)` (best-effort, après la boucle, fail-soft). Import depuis `@/server/qualiopi/indicateurs/service`.
- `+ specs` sous `src/server/qualiopi/satisfaction/satisfaction-actions.spec.ts`.

## AGENT C — UI dashboard (importe actions AGENT B)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/indicateurs/page.tsx` (Server Component, pattern formations/page.tsx) : sélecteur année (searchParam `?annee=`), AdminStatCard pour chaque indicateur (satisfaction, réussite, complétion, délai accès) avec la **méthode de calcul affichée** + date de mise à jour + badge « en cours de constitution » si non fiable. Section BPF (aperçu agrégats) + bouton export CSV (`BpfExportButton`). Lecture via `getIndicateurs`/`computeBpf` côté serveur.
- `src/components/admin/qualiopi/BpfExportButton.tsx` (`"use client"` + `// use-client: …`) : bouton → `exportBpfCsvAction` → déclenche un download du CSV (Blob côté client).
- `src/components/admin/qualiopi/RecomputeIndicateursButton.tsx` (`"use client"` + `// use-client: …`) : bouton → `recomputeIndicateursAction` + `router.refresh()`.
- modif additive `src/lib/admin-nav.ts` : item « Indicateurs / BPF » groupe `qualiopi`.
- Tokens admin uniquement, français, force-dynamic + noindex.

## Definition of Done T10 (GATE central)
typecheck heap 8G + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + indicateurs calculés avec méthode affichée + cache Redis + BPF export + satisfaction (chaud/froid/positionnement) collectable. [off.2, off.31, BPF]
