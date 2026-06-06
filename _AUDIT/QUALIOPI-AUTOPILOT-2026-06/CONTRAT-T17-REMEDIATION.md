# CONTRAT — T17 Remédiation conformité (audit end-to-end T0→T16)

Schéma + migration `20260606260000` **déjà faits** (prisma generate fait). Nouveaux champs : `Formation.indicateursPublies` (Json), `Formation.methodeCalculIndicateurs` (Text), `Formation.indicateursPubliesAt` ; `SousTraitant.screenshotUrl`/`screenshotDate` ; modèle `BpfDepense` (annee, categorie, libelle, montantHtCents).

## Règles communes (tous clusters)
- Prisma `@/lib/prisma`, types `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes` (spread conditionnel). Français. Tokens admin (zéro hex, même en fallback). `"use client"` → `// use-client:`. Apostrophes JSX échappées (`&apos;`). Tests co-localisés, aucun mock de prod.
- **NE TOUCHE QUE LES FICHIERS DE TON CLUSTER** (périmètres disjoints — éviter les conflits). Mets à jour/complète les specs des fichiers que tu modifies pour rester vert.
- Gate final central par l'orchestrateur (verify:all complet + suite complète).

---

## CLUSTER 1 — Raccordement runtime (notifications + facture PDF + audit export)
Fichiers autorisés : `src/server/qualiopi/evaluations/attestation-service.ts`, `src/components/admin/qualiopi/GenererFactureButton.tsx`, `src/server/actions/qualiopi/financements.ts`, leurs specs.
1. `attestation-service.ts` `genererAttestationPourEnrollment` : après update enrollment (cas complète/partielle, PAS aucune), appeler `envoyerAttestationDisponible(enrollmentId)` de `@/server/qualiopi/notifications/notifications-service` en **fail-soft** (try/catch, ne casse pas la génération). Stub-aware.
2. `GenererFactureButton.tsx` : après succès de `genererFactureFormationAction`, enchaîner `genererFacturePdfAction({ factureId })` (importée de `@/server/actions/qualiopi/financements`) pour produire le PDF (documentId). Afficher le lien PDF si retourné. Fail-soft UI.
3. `financements.ts` `exportComptaCsvAction` : capturer la session de `requireAdminWrite()` et ajouter `logQualiopiActivity` (`qualiopi.compta.csv.export`).
Tests : adapter les specs touchés.

## CLUSTER 2 — Score de conformité + manifeste + config morte
Fichiers autorisés : `src/server/qualiopi/conformite/conformite-service.ts`, `src/server/qualiopi/conformite/audit-dossier.ts`, `src/server/qualiopi/config/registry.ts`, `src/server/qualiopi/registres/reclamations-service.ts`, leurs specs.
1. `conformite-service.ts` : 
   - **off.30** : compter `prisma.appreciation.count()` (multi-parties) au lieu de `questionnaire.count()`.
   - **off.26** : « couvert » SEULEMENT si `getQualiopiConfig("referent_handicap_nom")` non vide (en plus des partenariats).
   - **off.21** : « couvert » SEULEMENT s'il existe ≥1 Trainer avec `cvUrl != null` (pas juste `nbTrainers>0`).
2. `audit-dossier.ts` : enrichir le manifeste — pour off.23/24/25 remonter des preuves textuelles depuis `prisma.veille.count()` par type ; off.26 exposer le nom du référent (depuis config) ; off.30 compter `appreciation` ; off.21 exposer les formateurs avec CV. (Le manifeste ne doit pas afficher « 0 preuve » pour un indicateur réellement couvert par une table.)
3. `registry.ts` : ajouter la clé `seuil_reclamation_jours: { ...num(15), description: "Seuil J+15 alerte réclamation sans réponse." }`.
4. `reclamations-service.ts` : remplacer le cast générique fragile par `getQualiopiConfig("seuil_reclamation_jours")` typé (la clé existe désormais). 
5. `cpf_reste_a_charge` : si un builder de kit CPF calcule le reste à charge, le faire lire `getQualiopiConfig("cpf_reste_a_charge")` ; sinon laisser + commenter « référence légale, consommée à l'affichage kit ». (Ne PAS retirer la clé.)
Tests : compléter conformite-service.spec + reclamations.

## CLUSTER 3 — off.1/2 indicateurs publiés + off.9 convocation J-5 + POEI bloquant + breadcrumb public
Fichiers autorisés : `src/server/qualiopi/formations/formations.ts` (+ service), `src/server/actions/qualiopi/formations.ts`, `src/app/[locale]/formations/[slug]/page.tsx`, `src/server/queue/workers/qualiopi-formation-crons-worker.ts`, `src/server/queue/queues.ts`, `src/server/qualiopi/financements/validation-service.ts`, `src/components/admin/qualiopi/*` (un éventuel formulaire d'indicateurs publiés), `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/page.tsx` ou la fiche formation, leurs specs.
1. **off.2** : action `publierIndicateursAction({ formationId, indicateurs: [{libelle,valeur,unite,annee}], methodeCalcul })` → set `Formation.indicateursPublies/methodeCalculIndicateurs/indicateursPubliesAt`. + un composant client de saisie (admin). + audit.
2. **off.1/2 public** : `src/app/[locale]/formations/[slug]/page.tsx` doit AFFICHER `indicateursPublies` + `methodeCalculIndicateurs` (au lieu du « en cours de constitution » en dur) quand renseignés ; sinon fallback « en cours de constitution ». **Corriger aussi A4** : le breadcrumb ligne ~209 pointe vers `/${locale}/formations` (page inexistante) → retirer ce niveau de breadcrumb (ou le rendre non-cliquable).
3. **off.9 convocation J-5** : ajouter type `formation-crons.convocation-j5` + handler `handleConvocationJ5()` (scan sessions `planifiee` à J-5, pour chaque enrollment `envoyerConvocation(enrollmentId)` de notifications-service, idempotent fail-soft) dans le worker + entrée repeatable `0 8 * * *` dans `queues.ts`. (Le J-7 existant reste un rappel ; J-5 = convocation réglementaire.)
4. **POEI bloquant** : dans `validation-service.ts` `validateFranceTravail`, si dispositif POEI et une des 3 preuves (offre/accord/engagement) manque ET session non démarrée → gravité `critique` (bloquant), pas `warning`.
Tests : specs worker/validation/formations.

## CLUSTER 4 — Routes/portail/sécurité/RGPD
Fichiers autorisés : `src/app/[locale]/portail/acces-invalide/page.tsx` (NOUVEAU), `src/app/[locale]/verifier-attestation/[token]/page.tsx`, `src/app/api/qualiopi/alertes/stream/route.ts`, `src/server/actions/qualiopi/portail.ts`, `src/server/actions/qualiopi/_guards.ts`, `src/app/[locale]/portail/mon-espace/page.tsx`, leurs specs.
1. **A3** : créer `portail/acces-invalide/page.tsx` (Server Component sobre, FR, noindex, message « lien invalide ou expiré, contactez l'organisme »). 
2. **A6** : `verifier-attestation/[token]/page.tsx` → ajouter `export const metadata: Metadata = { robots: { index: false, follow: false } }`.
3. **A5** : aligner les rôles — la route SSE `stream/route.ts` doit autoriser EXACTEMENT `admin` + `super_admin` (retirer `editor`) pour matcher la page alertes.
4. **A-01 (IDOR, BLOQUANT SÉCU)** : `portail.ts` `soumettreSatisfactionPortailAction` — avant `soumettreReponses`, vérifier que le questionnaire (`token`) appartient bien au `traineeId` authentifié par cookie (`prisma.questionnaire.findUnique({where:{token}, select:{enrollment:{select:{traineeId:true}}}})` → refuser si ≠). 
5. **A-02 (RGPD)** : `_guards.ts` `logQualiopiActivity` — hacher l'IP via `hashIp` de `@/lib/security/ip-hash` avant stockage dans `ActivityLog.ipAddress` (aligner sur le reste du repo).
6. **A-06** : `mon-espace/page.tsx` — corriger `ENROLLMENT_STATUT_LABELS` pour les vraies valeurs enum (`planifiee`, `presente`, `abandon`, `exclu`).
Tests : spec portail-actions (IDOR), guards.

## CLUSTER 5 — BPF dépenses + dossier démo enrichi
Fichiers autorisés : `src/server/qualiopi/bpf/service.ts`, `src/server/actions/qualiopi/bpf.ts` (NOUVEAU), `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/indicateurs/page.tsx`, `src/components/admin/qualiopi/BpfDepenseForm.tsx` (NOUVEAU), `prisma/seeds/qualiopi/demo.ts`, leurs specs.
1. `bpf/service.ts` : inclure les `BpfDepense` de l'année dans `BpfResult` (total dépenses + par catégorie) + dans `bpfToCsv`. Helpers `listDepenses(annee)`/`ajouterDepense`.
2. action `bpf.ts` `ajouterBpfDepenseAction`/`supprimerBpfDepenseAction` (admin) + `BpfDepenseForm` + section dans la page indicateurs.
3. **démo** (`demo.ts`) : corriger les trous d'audit — (a) créer 1 `Trainer` salarié avec `cvUrl`+`cvUploadedAt`+`formationsHabilitees`=[formation démo], et le mettre en `coFormateurs` de la session ; (b) seeder le `SiteSetting referent_handicap_nom`/email/telephone (cat qualiopi) ; (c) renseigner `indicateursPublies`+`methodeCalculIndicateurs` sur la formation démo ; (d) ajouter 2 `Appreciation` supplémentaires (financeur + formateur) ; (e) renseigner `screenshotUrl`/`screenshotDate` sur le SousTraitant démo ; (f) ajouter 1 `BpfDepense`. Idempotent, marqué DEMO.
Tests : bpf-service.spec + demo.spec à compléter.

## Definition of Done T17 (GATE central orchestrateur)
`pnpm verify:all` COMPLET vert (typecheck + lint REPO + i18n + anti-siren + anti-hex + use-client + contrast + radius + isolation-checks + test) + suite complète `vitest run` verte + `qualiopi:seed-demo` rejoué OK + les anomalies bloquantes (IDOR, facture PDF, convocation, attestation notif, acces-invalide, off.30/26/21) corrigées.
