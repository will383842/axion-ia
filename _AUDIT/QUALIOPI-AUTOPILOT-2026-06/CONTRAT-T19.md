# CONTRAT — T19 : Raccordement complet de la console admin (génération documentaire + cycle de vie)

Objectif : rendre le back-office Qualiopi **100% pilotable depuis l'UI**. Le BACKEND existe et est testé (actions, services, templates) ; T19 = surtout créer les **pages/composants/boutons** qui les déclenchent, + actions de génération documentaire manquantes.

## Règles communes (NON négociables)
- Prisma `@/lib/prisma`, types `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes` (spread conditionnel). Français. Tokens admin (ZÉRO hex — sinon contrast/radius check rouge). `"use client"` + commentaire `// use-client:` pour tout composant client. Apostrophes JSX échappées (`&apos;`). force-dynamic + noindex sur pages admin. Server Components = auth+redirect. Prettier sur fichiers touchés. Tests co-localisés réels. NE touche QUE les fichiers de ton cluster. Réutilise les actions existantes (ne PAS réécrire la logique backend).

## Référence actions backend existantes (à câbler — NE PAS recréer)
- Engine : `startGenerationAction`, `getGenerationStatusAction` (`engine.ts`).
- Formation : `createFormationAction`, `updateFormationAction`, `validateFormationAction`, `publishFormationAction`, `publierIndicateursAction`, `setCertificationAction` (`formations.ts`).
- Session : `createSessionAction`, `transitionSessionAction` (`sessions.ts`), `createRecurringSessionsAction`, `reportSessionAction` (`sessions-recurrentes.ts`).
- Inscription : `enrollTraineeAction`, `updateEnrollmentPresenceAction`, `setEnrollmentStatutAction` (`enrollments.ts`).
- Satisfaction : `genererQuestionnairesSessionAction`, `saisirReponsesQuestionnaireAction` (`satisfaction.ts`).
- Portail : `genererPortailAccesAction`, `revoquerPortailAccesAction` (`portail.ts`) + composant existant `GenererPortailAccesButton` (à MONTER).
- Devis : `createDevisAction`, `sendDevisAction`, `acceptDevisAction`, `declineDevisAction` (`devis.ts`).
- RGPD : `traiterDemandeRgpdAction` (`appreciations.ts`).
- Offres : `updateOffreAction`, `toggleOffreActifAction`, `verifyAllOffresCoherenceAction` (`offres.ts`).
- Registres : `updateVeilleAction`/`supprimerVeilleAction`, `updatePartenariatAction`, `updateRevueDirectionAction`, `marquerToutLuAction` (alertes).
- Documents : `generateDocument({type, buildElement, refs, fichierOriginalPath?})` (`documents/documents-service.ts`) + templates `documents/templates/*.tsx` (les 18). Pattern de génération = `genererFactureFormationAction` (`financements.ts`) / `attestation-service.ts`.

## VAGUE 1

### Cluster D — Actions de génération documentaire (backend, 14 types)
Fichier : `src/server/actions/qualiopi/documents.ts` (NEW) + specs. Créer une action `generer<X>Action({ sessionId | enrollmentId | clientId selon le doc })` pour chaque type non encore généré : `convention`, `convention_tripartite`, `convocation`, `emargement`, `positionnement`, `grille_evaluation`, `satisfaction`, `certificat_realisation`, `kit_opco`, `kit_cpf`, `kit_france_travail`, `lettre_mission`, `reglement_interieur`, `livret_accueil`. Chacune : requireAdminWrite + charge les données nécessaires + `generateDocument({ type, buildElement:(numero)=>React.createElement(<X>Pdf,{data:{...,numero}}), refs })` + audit + retourne `{documentId, numero}`. Lire chaque template pour connaître la shape `data` attendue. `certificat_realisation` (R.6313-3, heures en centièmes) = priorité réglementaire.

### Cluster L1 — Cycle de vie formation
Fichiers : `formations/new/page.tsx` (NEW) + `formations/[id]/page.tsx` (NEW, détail/édition) + composants `FormationForm.tsx`, `FormationLifecycleButtons.tsx` (valider/publier/publier indicateurs/lancer génération IA) + lien depuis `formations/page.tsx`. Câble create/update/validate/publish/publierIndicateurs/startGeneration. Affiche statutGeneration + statut + score.

### Cluster L2 — Hub session + cycle de vie session
Fichiers : `sessions/[id]/page.tsx` (NEW = hub avec liens vers émargement/évaluations/financement + sections à venir Vague 2) + `sessions/new/page.tsx` (NEW) + `SessionForm.tsx` + `SessionLifecycleButtons.tsx` (transition selon machine à états, report, sessions récurrentes) + liens depuis `sessions/page.tsx`. Câble create/transition/report/recurring. **Le hub `sessions/[id]/page.tsx` doit exposer des points d'ancrage (sections) que la Vague 2 remplira — coordonne en laissant des sections claires.**

## VAGUE 2 (après Vague 1 — le hub session existe)

### Cluster E1 — Inscriptions + accès portail (section du hub session)
`EnrollmentsSection.tsx` (lister/inscrire/changer statut stagiaires) + MONTER `GenererPortailAccesButton` (+ bouton révoquer) par stagiaire. Câble enroll/updateStatut/genererPortailAcces/revoquer.

### Cluster E2 — Section Documents (boutons des 14 docs, hub session + formation/client)
`DocumentsSection.tsx` : boutons appelant les `generer<X>Action` du Cluster D, regroupés (session / pédagogie / financeurs). Affiche les `DocumentGenere` existants + lien de téléchargement.

### Cluster E3 — Questionnaires (section du hub session)
`QuestionnairesSection.tsx` : générer (genererQuestionnairesSession) + saisir réponses (saisirReponses).

### Cluster E4 — Devis + RGPD + registres + offres
Pages/contrôles : `devis/new` + `devis/[id]` (create/send/accept/decline) ; page `rgpd/page.tsx` (file des demandes + traiterDemandeRgpd) ; toggles offres (toggleActif/verifyCoherence) ; édition registres (veille/partenariat/revue) ; bouton « tout marquer lu ». + items nav (`admin-nav.ts`).

## Definition of Done T19
Chaque action backend listée ci-dessus est déclenchable depuis l'UI ; les 18 DocumentType sont générables ; aucune action morte UI (re-audit nav) ; GATE : typecheck 0, lint repo 0, prettier OK, isolation ×3, suite qualiopi + actions verte. Démo : un parcours complet (créer formation → générer → session → inscrire → documents → attestation) faisable à la souris.
