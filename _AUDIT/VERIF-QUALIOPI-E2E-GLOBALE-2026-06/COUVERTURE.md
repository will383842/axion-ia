# COUVERTURE — Registre maître exhaustif (Phase 0.5)

## Couverture : 275/275 (100 % requis) ✅

> Inventaire **extrait du code**. Chaque ligne a un statut final.
> ✅ OK (RUNTIME/E2E) · ☑️ TESTÉ/CODE (spec verte + revue `fichier:ligne`) · 🔴/🟠/🟡/🔵 finding (cf. PLAN-REMEDIATION) · ➖ N/A justifié
> Server actions : ☑️ par défaut = revue exhaustive (5 agents) + suite vitest verte ; l'auth `requireAdminWrite` empêche l'appel direct par probe, gardes pures prouvées RUNTIME (probe04).

## A. Server actions (106) — toutes ☑️ sauf notes

- ☑️ `accederPortailAction`
- ☑️ `acceptDevisAction`
- ☑️ `ajouterBpfDepenseAction`
- ☑️ `approveFileValidationAction`
- ☑️ CODE garde habilitation bloquante — `assignTrainerToSessionAction`
- ☑️ `createClientAction`
- ☑️ `createDevisAction`
- ☑️ `createEvaluationAcquisAction`
- ☑️ `createFormationAction`
- ☑️ `createRecurringSessionsAction`
- ☑️ `createSessionAction`
- ☑️ `createTraineeAction`
- ☑️ `createTrainerAction`
- ☑️ `creerAppreciationAction`
- ☑️ `creerPartenariatAction`
- ☑️ `creerReclamationAction`
- ☑️ `creerRevueDirectionAction`
- ☑️ `creerSousTraitantAction`
- ☑️ `creerVeilleAction`
- ☑️ `declarerHandicapAction`
- ☑️ `declineDevisAction`
- ☑️ `demanderExportRgpdAction`
- ✅ C5 révocation portail à l'anonymisation — `demanderSuppressionRgpdAction`
- ☑️ `enrollTraineeAction`
- ☑️ `exportBpfCsvAction`
- ☑️ `exportComptaCsvAction`
- ☑️ `exporterDossierZipAction`
- ☑️ `exporterManifesteAuditAction`
- ☑️ `generateSessionCreneauxAction`
- ☑️ `genererAttestationAction`
- ✅ C4 refus abandon/exclu (R.6313-3) +2 specs — `genererCertificatRealisationAction`
- ☑️ `genererConventionAction`
- ☑️ `genererConventionTripartiteAction`
- ☑️ `genererConvocationAction`
- ☑️ `genererEmargementAction`
- ✅ C3 numérotation atomique (withNumberRetry) + TVA 261-4-4° — `genererFactureFormationAction`
- ☑️ inter-entreprises (withNumberRetry déjà présent) — `genererFactureParInscriptionAction`
- ☑️ `genererFacturePdfAction`
- ☑️ `genererGrilleEvaluationAction`
- ☑️ `genererKitCpfAction`
- ☑️ `genererKitFranceTravailAction`
- ☑️ `genererKitOpcoAction`
- ☑️ `genererLettreMissionAction`
- ☑️ `genererLivretAccueilAction`
- ☑️ `genererPortailAccesAction`
- ☑️ `genererPositionnementAction`
- ☑️ `genererQuestionnairesSessionAction`
- ☑️ `genererReglementInterieurAction`
- ☑️ `genererReleveConnexionDocumentAction`
- ☑️ `genererSatisfactionAction`
- ☑️ `genererSupportAction`
- ☑️ `getGenerationStatusAction`
- ☑️ `importReleveConnexionAction`
- ☑️ `marquerLuAction`
- ☑️ `marquerToutLuAction`
- ☑️ `publierIndicateursAction`
- ☑️ `publishFormationAction`
- ☑️ `quitterPortailAction`
- ☑️ `recomputeIndicateursAction`
- ☑️ `regenererSupportAction`
- ☑️ `rejectFileValidationAction`
- ☑️ `repondreReclamationAction`
- ☑️ `reportSessionAction`
- ✅ RUNTIME — chemin seed corrigé (C1 advisory lock) probe01/03 — `reseedReferenceDataAction`
- ☑️ `resoudreAlerteAction`
- ☑️ `revoquerPortailAccesAction`
- ☑️ `saisirReponsesQuestionnaireAction`
- ☑️ `saveEmargementAction`
- ☑️ `sendDevisAction`
- ☑️ `setCertificationAction`
- ☑️ `setEnrollmentFinancementAction`
- ☑️ `setEnrollmentStatutAction`
- ☑️ POEI 3 champs UI+zod (R3) + barème non inventé — `setFinancementSessionAction`
- ☑️ `setMoyensFormationAction`
- ☑️ `setPresenceCreneauManualAction`
- ☑️ `setPriseEnChargeAction`
- ☑️ `setQualiopiConfigAction`
- ☑️ `setSessionInterEntreprisesAction`
- ☑️ `setStatutReclamationAction`
- ☑️ `setTrainerActifAction`
- ☑️ `setTrainerHabilitationsAction`
- ☑️ `soumettreSatisfactionPortailAction`
- ☑️ `startGenerationAction`
- ☑️ `supprimerBpfDepenseAction`
- ☑️ `supprimerSupportAction`
- ☑️ `supprimerVeilleAction`
- ☑️ `synchroniserAlertesAction`
- ☑️ `toggleOffreActifAction`
- ✅ C5 anonymisation+révocation portail — `traiterDemandeRgpdAction`
- ☑️ pose transforme_convention, garde accepté (R11 feature) — `transformDevisToConventionAction`
- ✅ RUNTIME gardes financement+émargement (probe04) + state machine — `transitionSessionAction`
- ☑️ `updateClientAction`
- ☑️ `updateEnrollmentPresenceAction`
- ☑️ `updateFormationAction`
- ☑️ `updateOffreAction`
- ☑️ `updatePartenariatAction`
- ☑️ `updateRevueDirectionAction`
- ☑️ `updateTraineeAction`
- ☑️ `updateTrainerAction`
- ☑️ `updateVeilleAction`
- ☑️ `validateFormationAction`
- ✅ RUNTIME garde accord OPCO (probe04) — `validerAccordOpcoAction`
- ☑️ `verifierSousTraitantAction`
- ☑️ `verifierSousTraitantOfAction`
- ☑️ `verifyAllOffresCoherenceAction`
- ☑️ `verifyTrainerSousTraitantAction`

## B. Pages admin (40) + SSE — ✅ null-safe + RBAC (revue exhaustive 40/40)

- ✅ /(accueil)
- ✅ /alertes
- ✅ /appreciations
- ✅ /clients
- ✅ /clients/new
- ✅ /config
- ✅ /conformite
- ✅ /devis
- ✅ /devis/[id]
- ✅ /devis/new
- ✅ /financements
- ✅ /formateurs
- ✅ /formateurs/[id]
- ✅ /formateurs/new
- ✅ /formation-engine
- ✅ /formation-engine/validations
- ✅ /formations
- ✅ /formations/[id]
- ✅ /formations/[id]/certification
- ✅ /formations/[id]/supports
- ✅ /formations/new
- ✅ /indicateurs
- ✅ /mode-auditeur
- ✅ /offres
- ✅ /partenariats
- ✅ /pilotage
- ✅ /reclamations
- ✅ /revue-direction
- ✅ /rgpd
- ✅ /sessions
- ✅ /sessions/[id]
- ✅ /sessions/[id]/emargement
- ✅ /sessions/[id]/evaluations
- ✅ /sessions/[id]/financement
- ✅ /sessions/new
- ✅ /sous-traitants
- ✅ /stagiaires
- ✅ /stagiaires/[id]
- ✅ /stagiaires/new
- ✅ /veille
- ✅ API /api/qualiopi/alertes/stream (auth+rôle+rate-limit 30/60s)

## C. Routes/écrans publics (5)
- ✅ portail/mon-espace (token+expiration+révocation)
- ✅ portail/acces-invalide (non-distinguable)
- ✅ portail/acces/[token] (CSPRNG 256b, cookie HttpOnly, rate-limit 10/60s)
- ☑️ formations/[slug] (flag OF_PUBLIC_DISCLOSURE_ENABLED, 404 si off)
- ✅ verifier-attestation/[token] (non-énumérable, notFound générique)

## D. Templates PDF (19) — ✅ RUNTIME %PDF (38 tests render)

- ✅ PDF attestation
- ✅ PDF attestation-partielle
- ✅ PDF certificat-realisation
- ✅ PDF convention
- ✅ PDF convention-tripartite
- ✅ PDF convocation
- ✅ PDF emargement
- ✅ PDF facture
- ✅ PDF grille-evaluation
- ✅ PDF kit-cpf
- ✅ PDF kit-france-travail
- ✅ PDF kit-opco
- ✅ PDF lettre-mission
- ✅ PDF livret-accueil
- ✅ PDF positionnement
- ✅ PDF reglement-interieur
- ✅ PDF releve-connexion
- ✅ PDF satisfaction
- ✅ PDF supports/support-pdf (7 types)

## E. Templates email (6) — ☑️ TESTÉ (qualiopi-templates.spec) ; contrat « jamais de financement public » au stagiaire

- ☑️ EMAIL qualiopi-alerte-interne
- ☑️ EMAIL qualiopi-attestation-disponible
- ☑️ EMAIL qualiopi-convocation
- ☑️ EMAIL qualiopi-rappel-j7
- ☑️ EMAIL qualiopi-satisfaction-j1
- ☑️ EMAIL qualiopi-suivi-j30

## F. Domaines services (25) — ☑️ revue exhaustive par agents

- ☑️ DOM alertes
- ☑️ DOM bpf
- ☑️ DOM brand
- ☑️ DOM config
- ☑️ DOM conformite
- ☑️ DOM crm
- ☑️ DOM documents
- ☑️ DOM engine
- ☑️ DOM evaluations
- ☑️ DOM financements
- ☑️ DOM formations
- ☑️ DOM indicateurs
- ☑️ DOM legal
- ☑️ DOM notifications
- ☑️ DOM numbering
- ☑️ DOM offres
- ☑️ DOM portail
- ☑️ DOM presence
- ☑️ DOM registres
- ☑️ DOM rgpd
- ☑️ DOM satisfaction
- ☑️ DOM seed
- ☑️ DOM supports
- ☑️ DOM trainees
- ☑️ DOM trainers

## G. Workers & crons
- ☑️ WORKER qualiopi-formation-engine-worker (fail-loud grille — RUNTIME via seed probe)
- ✅ WORKER qualiopi-formation-crons-worker (garde émargement C2, +3 specs)
- ✅ CRONS formations/crons.ts (pure, transitions auto)

## H. Machines à états — ✅ RUNTIME (probe04) + specs
- ✅ SM formation.statutGeneration
- ✅ SM session (5 autorisées + 5 interdites prouvées)
- ☑️ SM enrollment (planifiee→presente/abandon/exclu)
- ☑️ SM devis (brouillon→envoye→accepte/refuse/expire/transforme_convention)

## I. Indicateurs RNQ (32) — cf. MATRICE-INDICATEURS.md
- ☑️ off.1,4,8,10,11,21,23,24,25,26,27,30,31 = RÉELLES
- 🟡 off.2,3,5,6,7,9,12,16,17,18,19,20,22 = PROXY (décision-Will)
- 🟡 off.29 = PROXY FAUX (décision-Will applicabilité)
- ✅ off.32 = gaté sur statut=validee (correct)
- ➖ off.13,14,15 (APP) / off.28 (AFEST) = NON COUVERT conditionnel → non_applicable

## J. Dispositifs financement × types client
- ✅ FIN OPCO (subrogation+tripartite bloquants, probe04)
- ✅ FIN CPF/EDOF (EDOF bloquant probe04, RAC anti-0)
- ☑️ FIN France Travail AIF (prescription bloquante)
- ✅ FIN France Travail POEI (3 preuves bloquantes probe04)
- ☑️ FIN France Travail CSP
- ☑️ FIN Autofinancement / plan entreprise
- ☑️ CLIENT B2C particulier (destinataire stagiaire)
- ☑️ CLIENT intra-entreprise (facture session-level, C3 atomique)
- ☑️ CLIENT inter-entreprises (facture par inscription)

## K. Gardes de conformité (14)
- 🟡 GARDE engine score<80 → décision-Will (validation humaine = garde actuelle)
- ✅ GARDE getActiveGrille null → throw fail-loud (RUNTIME via seed)
- 🟡 GARDE anti-hallucination warn-only → décision F1
- ✅ GARDE session en_cours sans accord financement (probe04, critique)
- ✅ GARDE session realisee sans émargement (manuel + cron C2)
- ✅ GARDE OPCO subrogation sans n° dossier (probe04)
- ✅ GARDE OPCO tripartite avant démarrage (probe04, L.6353-2)
- ✅ GARDE CPF sans EDOF (probe04)
- ✅ GARDE POEI 3 preuves (probe04)
- ✅ GARDE attestation refusée abandon/exclu + certificat (C4)
- ☑️ GARDE formateur non habilité → assignation bloquée
- ✅ GARDE numérotation atomique (C3 facture + autres déjà OK)
- ✅ GARDE revue direction off.32 (statut=validee)
- ☑️ GARDE publishFormation exige validatedBy

## L. Flags & config
- ☑️ FLAG OF_PUBLIC_DISCLOSURE_ENABLED (fiche publique 404 si off)
- ✅ FLAG QUALIOPI_AUTO_SEED (kill-switch boot)
- ✅ FLAG stub.invalid no-op seed (probe02)
- ✅ CONFIG SiteSetting registry (30 clés ; 33 en dev = 3 legacy hors registre, non bloquant)

## M. Seed & démarrage — ✅ RUNTIME (corrigé C1)
- ✅ SEED instrumentation.ts (boot auto, fail-soft)
- ✅ SEED reference-data.ts (advisory lock corrigé)
- ✅ SEED reseedReferenceDataAction (bouton admin, même chemin corrigé)
- ✅ SEED migrations_fts/20260606300000_qualiopi_grille_seed.sql (grille v1 au boot)
- ✅ SEED entrypoint docker-entrypoint.sh (migrate deploy + FTS)
- ☑️ SEED prisma/seeds/qualiopi/** (CLI, non requis au boot)
