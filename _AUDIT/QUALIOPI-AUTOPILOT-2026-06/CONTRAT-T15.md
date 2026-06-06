# CONTRAT D'INTERFACE — T15 Alertes système + emails auto + SSE + RGPD

Schéma + migration **déjà faits** (`20260606250000`, `prisma generate` fait). Modèle `AlerteSysteme` (code, niveau, titre, message, cibleType?, cibleId?, lu, resolue, resolueAt?, metadata) + enum `AlerteNiveau` (`info|important|critique`).

## Catalogue officiel des alertes (SPEC_PART2 §6.5 — FAIT FOI)
`C:\Users\willi\Documents\Projets\Axion-IA\AXION_IA_COMPLET_QUALIOPI\01_SPEC_FONCTIONNELLE\SPEC_PART2_OBLIGATIONS_REGLES_METIER.md` §6.5. Codes (niveau) : `referent_handicap_absent`(crit), `registre_reclamations_vide_jamais_verifie`(info), `emargement_manquant`(crit), `satisfaction_manquante`(important), `evaluation_acquis_manquante`(crit), `attestation_non_envoyee`(important), `satisfaction_sous_seuil`(important), `reclamation_sans_reponse_j15`(crit), `qualiopi_expire_j90`(important), `qualiopi_expire_j30`(crit), `qualiopi_expire`(crit), `bpf_a_deposer_j60`(info)/`_j30`(important)/`_j7`(crit)/`bpf_en_retard`(crit), `veille_inactive_j45`(important), `cv_formateur_perime`(important), `sous_traitant_qualiopi_expire_j60`(important)/`_expire`(crit), `opco_sans_accord`(important), `opco_formation_demarree_sans_accord`(crit), `convention_tripartite_manquante`(crit), `facture_impayee_j30`(important)/`_j60`(crit), `budget_ia_depasse`(important), `email_bounce`(important), `job_ia_echoue`(important), `suppression_rgpd_j30`(info). Mapping niveau spec→enum : CRITIQUE→`critique`, IMPORTANT→`important`, INFO→`info`. **Dé-duplication** : ne pas créer si une alerte (code, cibleId) non résolue existe déjà.

## Règles NON négociables
- Prisma `@/lib/prisma`, types `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`. Zéro valeur en dur (seuils via getQualiopiConfig). Français. Tokens admin UI. Tests co-localisés, aucun mock de prod.
- `"use client"` → `// use-client:`. anti-hex 0. SSE = Route Handler streaming (pas de lib).
- Cloisonnement : `src/server/qualiopi/alertes/**`, `src/server/qualiopi/notifications/**`, `src/server/actions/qualiopi/alertes.ts`, `src/lib/email/templates/qualiopi-*.tsx` (+ ajouts additifs `src/server/queue/types.ts` EmailJobName + `src/lib/email/templates/index.tsx` TEMPLATES), UI `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/alertes/**` + route SSE `src/app/api/qualiopi/alertes/stream/route.ts`, `src/components/admin/qualiopi/**`, modif additive `src/server/queue/workers/qualiopi-formation-crons-worker.ts` + `src/server/queue/queues.ts` + `src/lib/admin-nav.ts`.

## AGENT A — moteur d'alertes `src/server/qualiopi/alertes/`
- `catalogue.ts` (PUR) : `ALERTE_CATALOGUE: Record<string, { niveau: AlerteNiveau; titre: string; resolutionAuto: boolean }>` (les ~28 codes). + `niveauFromSpec(s): AlerteNiveau`.
- `evaluateur.ts` : `evaluerAlertes(): Promise<Array<{ code; niveau; titre; message; cibleType?; cibleId? }>>` — scanne la DB (sessions realisee sans émargement 48h, sans éval finale J+2, attestation non envoyée J+3, réclamations >15j, Qualiopi expire J-90/30/0 via config, BPF selon date, veille >45j, OPCO sans accord/démarré, convention tripartite, factures impayées J30/60, RGPD J+30…). Stub-aware. Réutilise getQualiopiConfig pour seuils/dates.
- `alertes-service.ts` : `creerOuDedup(input)` (skip si (code,cibleId) non résolue existe), `resoudreAlerte(id)`, `marquerLu(id)`, `marquerToutLu()`, `listAlertes(options?)`, `countNonLues()`, `synchroniserAlertes()` (= evaluerAlertes → creerOuDedup en masse + résolution auto des codes resolutionAuto dont la condition a disparu). Stub-aware.
- cron : modifie `qualiopi-formation-crons-worker.ts` → ajoute type `formation-crons.alertes` + handler `handleAlertes()` (= synchroniserAlertes, fail-soft) ; modifie `queues.ts` bootRepeatableJobs → `{ type: "formation-crons.alertes", pattern: "0 7 * * *", jobId: "formation-crons-alertes-cron" }`.
- specs (`catalogue.spec.ts`, `evaluateur.spec.ts`, `alertes-service.spec.ts`).

## AGENT B — emails auto `src/server/qualiopi/notifications/` + templates
- Ajout additif `src/server/queue/types.ts` EmailJobName : `"qualiopi-convocation"`, `"qualiopi-rappel-j7"`, `"qualiopi-satisfaction-j1"`, `"qualiopi-suivi-j30"`, `"qualiopi-attestation-disponible"`, `"qualiopi-alerte-interne"`.
- Composants React Email `src/lib/email/templates/qualiopi-{convocation,rappel-j7,satisfaction-j1,suivi-j30,attestation-disponible,alerte-interne}.tsx` (pattern d'un template existant, ex. `audit-confirmed.tsx`) + ajout additif des 6 entrées dans `TEMPLATES` de `src/lib/email/templates/index.tsx` (subject + component).
- `notifications-service.ts` : fonctions qui enqueuent via `enqueueEmail` (de `@/server/queue/queues`) : `envoyerConvocation(enrollmentId)`, `envoyerRappelJ7(sessionId)`, `envoyerSatisfactionJ1(enrollmentId)`, `envoyerSuiviJ30(enrollmentId)`, `envoyerAttestationDisponible(enrollmentId)`, `notifierAlerteInterne(alerteId)`. Idempotence (clé entité+type+date). Stub-aware.
- Wire lifecycle dans `qualiopi-formation-crons-worker.ts` (modif additive) : handlers `formation-crons.rappel-j7` (sessions planifiees J-7), `formation-crons.satisfaction-j1` (sessions realisee J+1), `formation-crons.suivi-j30` (sessions realisee J+30) + entrées repeatable dans `queues.ts`. Fail-soft.
- specs (notifications-service + un render test des 6 templates).
- ⚠️ NE PAS casser les emails existants : ajouts additifs uniquement dans types.ts/index.tsx.

## AGENT C — SSE + actions + consentement RGPD
- `src/app/api/qualiopi/alertes/stream/route.ts` : Route Handler GET, auth admin (`auth()`), `ReadableStream` SSE qui pousse le `countNonLues` + dernières alertes toutes les N s (text/event-stream). Stub-aware/fail-soft.
- `src/server/actions/qualiopi/alertes.ts` (`"use server"`) : `resoudreAlerteAction({ id })`, `marquerLuAction({ id })`, `marquerToutLuAction()`, `synchroniserAlertesAction()` (admin, lance evaluerAlertes/synchroniser). requireAdminWrite + audit.
- `src/server/qualiopi/rgpd/consentement-service.ts` : `enregistrerConsentement(traineeId, version, { formation?, email? })` (set consentementVersion/At + flags), `consentementAJour(traineeId, versionAttendue): Promise<boolean>`. (RGPD consentement versionné — chiffrement handicap déjà AES via pii-crypto T14.)
- specs (alertes-actions + consentement-service).

## AGENT D — UI alertes
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/alertes/page.tsx` (Server Component) : liste alertes groupées par niveau (critique/important/info), `listAlertes`, badges, boutons résoudre/marquer lu/synchroniser.
- `src/components/admin/qualiopi/{AlerteActions,AlertesLiveBadge}.tsx` (`"use client"` + `// use-client:`) : AlerteActions (résoudre/lu via actions) ; AlertesLiveBadge (consomme le SSE `/api/qualiopi/alertes/stream` via EventSource, affiche le compteur non-lues temps réel).
- modif additive `src/lib/admin-nav.ts` : item « Alertes ».
- Tokens admin, zéro hex, français, force-dynamic + noindex.

## Definition of Done T15 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + catalogue alertes complet + dé-dup + résolution auto + ~6 emails auto rendus + SSE fonctionnel + consentement versionné. Emails existants intacts. [alertes, RGPD §D]
