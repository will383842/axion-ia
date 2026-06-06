# CONTRAT D'INTERFACE — T9 Évaluations des acquis + attestations auto

Schéma + migration **déjà faits** (migration `20260606190000_qualiopi_t9_evaluations_attestations` appliquée, `prisma generate` fait). Disponible :
- enums Prisma `EvaluationType` (`initiale|intermediaire|finale`), `NiveauAcquisition` (`non_acquis|partiellement_acquis|acquis`), `AttestationResultat` (`complete|partielle|aucune`).
- modèle `EvaluationAcquis` (enrollmentId, type, dateEvaluation, scoreObtenu, scoreMax, scorePct, niveauGlobal, reussite, competences Json, recommandations, evalueParId, documentId, timestamps).
- `Enrollment` +`evaluations EvaluationAcquis[]`, +`attestationResultat AttestationResultat?`, +`attestationDocumentId String?` (FK→DocumentGenere, relation `EnrollmentAttestation`), +`attestationGenereeAt DateTime?`.

## Règles NON négociables
- Prisma : `import { prisma } from "@/lib/prisma"` ; types Prisma via `../../../../prisma/generated/client`.
- Stub-aware sur tout ce qui mute en chemin build-possible (services de génération de doc/worker) : `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return …`.
- `exactOptionalPropertyTypes: true` → spread conditionnel, jamais `x: undefined`.
- Zéro valeur en dur : seuils via `getQualiopiConfig` (`seuil_reussite_pct` défaut 70 pour la réussite éval ; `seuil_presence_pct` défaut 80 pour l'éligibilité attestation). Couleurs → tokens admin. Français partout.
- Tests Vitest co-localisés `*.spec.ts`, aucun mock de prod, fixtures réalistes.
- Cloisonnement : fichiers UNIQUEMENT sous `src/server/qualiopi/evaluations/**`, `src/server/actions/qualiopi/evaluations.ts`, modif additive `src/server/queue/workers/qualiopi-formation-crons-worker.ts` + `src/server/queue/queues.ts`, UI sous `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/evaluations/**` + `src/components/admin/qualiopi/**`.

## Décision Will #7 (attestation — basée sur l'ASSIDUITÉ, pas le score)
- présence ≥ 80 % → **complète** ; 60–79 % → **partielle** (durée réelle + compétences partiellement validées) ; < 60 % → **aucune** (log + alerte, pas de doc).
- Réutiliser `classifierPresence(tauxPct, seuilCompletePct)` de `src/server/qualiopi/presence/taux.ts` (retourne `"complete"|"partielle"|"aucune"`).

## Réutilisables (lire avant de coder)
- Templates PDF T7 : `src/server/qualiopi/documents/templates/attestation.tsx` (`AttestationData`), `attestation-partielle.tsx` (`AttestationPartielleData`), `grille-evaluation.tsx` (`GrilleEvaluationData`, `CompetenceItem`, `EvaluationType` template = `"initiale"|"en-cours"|"finale"`).
- `generateDocument(input)` `src/server/qualiopi/documents/documents-service.ts` (supporte `qrToken`, `refs`, `fichierOriginalPath`).
- QR : `makeQrToken()`, `qrDataUrl(text)`, `verifyQrToken(a,b)` `src/server/qualiopi/documents/qr.ts`.
- Identité : `getOrganismeIdentite()` `src/server/qualiopi/documents/organisme.ts`.
- Route publique vérif (déjà OK) : `/[locale]/verifier-attestation/[token]` résout `DocumentGenere.qrToken` (+ session + trainee). → l'attestation DOIT être générée avec `qrToken` + `refs.sessionId` + `refs.traineeId`.
- Formation objectifs : `Formation.objectifsPedagogiques` (Json array). Base des compétences de la grille.
- Cron T6 : `src/server/queue/workers/qualiopi-formation-crons-worker.ts` (dispatcher `formationCronsHandler`, `FormationCronJobType`, `HANDLERS`) + `queues.ts` (`formationCronsQueue`, `bootRepeatableJobs` → `formationCronSchedule`).
- Action exemplaire : `src/server/actions/qualiopi/enrollments.ts`.

## AGENT A — logique pure + services `src/server/qualiopi/evaluations/`
- `scoring.ts` (pur) :
  - `computeEvaluationScore(competences: Array<{ note?: 1 | 2 | 3 }>): { scoreObtenu: number; scoreMax: number; scorePct: number }` (scoreMax = nb compétences × 3 ; ignore les notes absentes pour scoreObtenu mais scoreMax compte toutes les compétences notées ; scorePct = round(obtenu/max*100), 0 si max=0).
  - `niveauFromScore(scorePct: number): "non_acquis" | "partiellement_acquis" | "acquis"` (<50 non_acquis ; 50–80 partiellement_acquis ; >80 acquis).
  - `reussiteFromScore(scorePct: number, seuilReussitePct: number): boolean`.
  - `+ scoring.spec.ts`.
- `evaluations-service.ts` :
  - `createEvaluation(input): Promise<{ id: string }>` (calcule score+niveau+reussite via scoring + `getQualiopiConfig("seuil_reussite_pct")`, insère EvaluationAcquis). Stub-aware.
  - `listEvaluationsForEnrollment(enrollmentId): Promise<EvaluationAcquis[]>`.
  - `getFinaleReussite(enrollmentId): Promise<boolean | null>` (finale la plus récente).
  - `+ evaluations-service.spec.ts`.
- `attestation-service.ts` :
  - `genererAttestationPourEnrollment(enrollmentId: string, opts?: { force?: boolean }): Promise<{ resultat: "complete" | "partielle" | "aucune"; documentId: string | null }>` :
    1. lit enrollment (statut, tauxPresencePct, attestationGenereeAt) + session (dates, modalite, coFormateurs) + formation (titre, objectifs, dureeHeures) + trainee (nom/prenom/entreprise/fonction).
    2. idempotence : si `attestationGenereeAt` déjà set et pas `force` → retourne l'existant.
    3. `resultat = classifierPresence(tauxPresencePct ?? 0, seuil_presence_pct)`.
    4. si `aucune` → update Enrollment.attestationResultat=aucune ; log activity `qualiopi.attestation.aucune` ; retourne `{ resultat: "aucune", documentId: null }` (PAS de doc).
    5. sinon construit `AttestationData` (complete) ou `AttestationPartielleData` (partielle) : identité via getOrganismeIdentite, formateur via 1er coFormateur (lookup Trainer), résultats (heuresSuivies = round(tauxPresence×dureeHeures/100), heuresTotales = dureeHeures, evaluationObtenue depuis finale eval si présente, competencesAcquises/competencesPartiellesValidees = synthèse objectifs), `qrToken = makeQrToken()`, `qrDataUrl = await qrDataUrl(url verifier-attestation)`.
    6. `generateDocument({ type: "attestation"|"attestation_partielle", element, refs:{sessionId, traineeId}, qrToken })`.
    7. update Enrollment : attestationResultat, attestationDocumentId, attestationGenereeAt=now.
    8. log activity. Retourne `{ resultat, documentId }`.
  - `+ attestation-service.spec.ts` (mock prisma/generateDocument/organisme/qr/config).

## AGENT B — worker J+1 + server actions (importe AGENT A)
- modif `qualiopi-formation-crons-worker.ts` :
  - ajoute type `"formation-crons.attestations-auto"` à `FormationCronJobType` + `HANDLERS`.
  - `handleAttestationsAuto()` : scan sessions `realisee` ayant des enrollments (statut ∈ {planifiee, presente}, `attestationGenereeAt: null`) ; pour chaque enrollment, `genererAttestationPourEnrollment(id)` en fail-soft par enrollment ; log compteur. (J+1 garanti car `realisee` n'arrive qu'à dateFin+24h via cloture-auto.)
- modif `queues.ts` `bootRepeatableJobs` : ajoute au `formationCronSchedule` `{ type: "formation-crons.attestations-auto", pattern: "0 9 * * *", jobId: "formation-crons-attestations-auto-cron" }`.
- `src/server/actions/qualiopi/evaluations.ts` (`"use server"`, pattern enrollments.ts) :
  - `createEvaluationAcquisAction(input: { enrollmentId; type: "initiale"|"intermediaire"|"finale"; dateEvaluation: string; competences: Array<{ libelle: string; note?: 1|2|3; observations?: string; objectifRef?: string }>; recommandations?: string })` → createEvaluation + audit.
  - `genererAttestationAction(input: { enrollmentId: string; force?: boolean })` → genererAttestationPourEnrollment + audit ; retourne resultat+documentId.
  - `+ specs` (sous `src/server/qualiopi/evaluations/` : `evaluations-actions.spec.ts`).

## AGENT C — UI admin (importe actions AGENT B)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/evaluations/page.tsx` (Server Component, pattern formations/page.tsx : auth redirect, AdminPageShell/Header, force-dynamic, noindex). Charge session+enrollments+evaluations+formation.objectifs. Affiche par stagiaire : ses évaluations (type/score/niveau/réussite), formulaire d'ajout, et bloc attestation (résultat + bouton générer + lien vérif si générée).
- `src/components/admin/qualiopi/EvaluationForm.tsx` (`"use client"` + commentaire `// use-client: …`) : grille compétences (pré-remplie depuis objectifs de la formation passés en props) avec note 1/2/3 + observations + type + date + recommandations → `createEvaluationAcquisAction`.
- `src/components/admin/qualiopi/GenererAttestationButton.tsx` (`"use client"` + `// use-client: …`) : bouton → `genererAttestationAction`, affiche résultat (complète/partielle/aucune).
- lien « Évaluations » depuis la page émargement (`sessions/[id]/emargement`) OU la liste sessions vers `sessions/[id]/evaluations` (modif additive minime).
- Tokens admin uniquement (zéro hex), français, Web Vitals (client léger). Lecture DB serveur uniquement.

## Definition of Done T9 (GATE central orchestrateur)
typecheck heap 8G + `vitest run src/server/qualiopi` vert + `qualiopi:isolation-check --staged` + `i18n:check` + lint 0 + indicateur 11 couvert (éval initiale/intermédiaire/finale + grille par objectif) + attestation auto complète/partielle/aucune + QR public résolvable.
