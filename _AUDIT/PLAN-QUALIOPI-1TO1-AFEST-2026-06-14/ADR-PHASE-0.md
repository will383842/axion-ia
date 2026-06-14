# ADR Phase 0 — Qualiopi 1-to-1 / AFEST

> Date : 2026-06-14 · Worktree `.claude/worktrees/qualiopi-1to1` @ `0fcda368` (origin/main).
> Statut : **décisions de cadrage validées par Will. EN ATTENTE de son GO explicite pour la Phase 1 (migration) + de la confirmation certificateur sur 3 points (§7).**
> Méthode : audit read-only 8 agents (Workflow `wf_2f888235-5be`) + relecture directe des fichiers pivots. Tous les `file:line` vérifiés sur ce HEAD.

## 1. Objectif
Rendre les prestations **1-to-1 (coaching individuel, cadrées AFEST)** Qualiopi-conformes et OPCO-finançables de bout en bout et **démontrables au certificateur**, en **réutilisant le Formation Engine** (ne RIEN dupliquer) et en **automatisant les indicateurs AFEST** (off.13/14/15/28).

## 2. Décision d'architecture — Option C1 (« pont fin, sans Enrollment fantôme ») — VALIDÉE
`CoachingSession` reste le **foyer pédagogique AFEST**. On branche le 1-to-1 sur la machinerie de **rendu / numérotation / calcul financier** du Formation Engine via un **adaptateur additif** sous `src/server/qualiopi/coaching-afest/**`, **sans** créer de `Formation`/`TrainingSession`/`Enrollment` factices et **sans** réutiliser le calcul d'heures basé sur la présence groupe (faux pour le 1-to-1).

Rejetées : **C2** (Enrollment « ombre » — pollution sémantique + garde le piège des heures), **B** (réécrit le coaching live PR #60), **A** (~duplique la moitié du moteur, 10-15 j).

## 3. Briques réutilisées (vérifiées)
- `generateDocument(input)` `src/server/qualiopi/documents/documents-service.ts:98` — alloue n° `AXI-…`, rend PDF, upload R2, crée `DocumentGenere`, audit. `input.refs = {formationId?,sessionId?,traineeId?,clientId?}` → **ajouter `coachingSessionId?`**.
- `QualiopiPage`/`pdfStyles` `documents/base-layout.tsx:183` · `renderPdfToBuffer`/`storeAndSignPdf` `documents/render.ts` · `makeQrToken`/`qrDataUrl`/`verifyQrToken` `documents/qr.ts` · `getOrganismeIdentite` `documents/organisme.ts` (lit `SiteSetting` cat. qualiopi) · numérotation `formations/numbering.ts`.
- Attestation `evaluations/attestation-service.ts:60` — **`heuresSuivies = Math.round((tauxPct × Formation.dureeHeures)/100)` (~ligne 185)** + `classifierPresence` 80/60/0 `presence/taux.ts:43`. ⚠️ NE PAS réutiliser tel quel : créer `coaching-afest/heures.ts` → `getHeuresReelles1to1(coachingSessionId)` = `Σ CompteRenduSeance.dureeMinutes / 60`.
- Évaluations `evaluations/evaluations-service.ts:50` (`createEvaluation`, `computeEvaluationScore` pur, `getFinaleReussite`) — réutilisables.
- Financement `financements/{facturation-service,opco-calcul,inter-entreprises,validation-service}.ts` + `bpf/service.ts` — calcul réutilisable.
- Conformité `conformite/conformite-service.ts:55` `evaluerConformite()` — **off.13/14/15 figés « à compléter manuellement » lignes ~278-285, off.28 ~354** ; `indicateurs-registre.ts:287` `indicateursApplicables()` (`ConditionnelType` cert/app/afest) ; mode auditeur `audit-dossier.ts:136` `genererManifesteAudit()` (`INDICATEUR_DOCUMENT_TYPES` 76-122).
- Coaching live (PR #60) : `CoachingSession` `schema.prisma:6469` · `CompteRenduSeance:6560` (`dureeMinutes` Int nullable, `misesEnSituation[]`, `phasesReflexives[]`) · `CartographieActivite:6501` · `OptimisationProposee:6518` · `PlanOptimisation:6541` · `JournalProgression:6582` · `coaching.actions.ts` · `getCoachingDashboard` `coaching-admin/queries.ts:65`.
- Contenu AFEST : `docs/kits/1-to-1-afest/` (9 trames + convention tripartite) · `intervention-documents-catalog.ts` `UN_A_UN_SLOTS:267-402`.

## 4. Le GAP
1. Pas de `protocole_afest` dans `DocumentType` (19 valeurs `schema.prisma:5370`) ni de template.
2. `DocumentGenere` sans FK `coachingSessionId` → docs 1-to-1 non rattachables/auditables.
3. Source d'heures : doit être `Σ CompteRenduSeance.dureeMinutes` (R.6313-3), pas `Formation.dureeHeures × taux`.
4. off.13/14/15/28 figés manuels → automatiser depuis le coaching.
5. Pas de tuteur entreprise / formateur AFEST désigné en base.
6. `CompteRenduSeance.dureeMinutes` nullable → fiabiliser au passage `realisee`.
7. Pas de `CoachingTransition` (piste d'audit d'état).
8. Récurrent `un-a-un-recurrent` sans modèle de contrat → **modélisé en V1 (décision Will)**.

## 5. Migration additive (esquisse — `migrate deploy`-safe, AUCUN DROP, aucune colonne NOT NULL sans default)
- `enum DocumentType` += `protocole_afest`. Convention AFEST = réutiliser `convention_tripartite` (variante de contenu) ; ajouter `convention_afest` seulement si la numérotation doit différer (à trancher P2).
- `DocumentGenere.coachingSessionId String? @db.Uuid` (FK SetNull, index) ; idem `EvaluationAcquis.coachingSessionId?` et lien facture via `CoachingContract`.
- `CoachingSession` (additif) : `coachingContractId?`, `estAfest Boolean @default(false)`, `interEntreprises Boolean @default(false)`, `conventionSigneeAt?`, `objectifsPedagogiques Json?`, `dureeReelleHeures Decimal? (cache)`, `tuteurEntrepriseNom?/Email?/SigneeAt?` (**optionnels — enforcement gated, cf. §7**), `formateurAfestHabiliteAt?` (optionnel).
- `CompteRenduSeance` : `dureeMinutes` reste nullable en schéma ; **enforcement `>0` au gate `realisee`** (Zod/action), pas de backfill NOT NULL.
- **`CoachingContract`** (nouveau) : `traineeId?`, `clientId?`, `bookingId?`, `montantHtCents`, `dateSigneeAt?`, `dureeContratMois?`, `nbSeancesMax?`, `financementType`, `opcoStatut`, `numeroDossierOpco?`, `subrogation Boolean`.
- **`CoachingTransition`** (miroir `FormationTransition`) : `coachingSessionId, fromStatus, toStatus, trigger, triggeredBy, snapshot*` + `@@unique([coachingSessionId, toStatus, trigger])`.

> ⚠️ Pré-vol migration (reference/04 §8) : coordonner la numérotation avec le chantier backup/DR (ADR 0032) non commité ; timestamp strictement croissant ; ne pas mélanger les chantiers dans un commit.

## 6. Phasage (chaque phase = Definition of Done : `pnpm typecheck` 0 · tests ciblés verts · anti-régression services partagés `documents/attestation/presence/facturation/conformite/indicateurs` · gates anti-hex/anti-siren/use-client + `qualiopi:isolation-check` · registre de couverture)
- **P1** Migration additive (incl. `CoachingContract`, `CoachingTransition`, FK `coachingSessionId`).
- **P2** Templates (fan-out 1 agent/doc) : **Protocole AFEST** (nouveau) + convention/positionnement/émargement/évaluation/attestation adaptés, via `generateDocument`.
- **P3** Présence/heures 1-to-1 : `getHeuresReelles1to1` = Σ `dureeMinutes` ; gate `realisee`.
- **P4** Attestation en heures (Σ séances, centièmes, seuils 80/60/0) + génération (cron clôture parcours).
- **P5** Financement : facture exonérée TVA + kit OPCO subrogation + BPF (au niveau `CoachingContract`).
- **P6** Automatiser off.13/14/15/28 dans `conformite-service` depuis les données coaching.
- **P7** UI : console coaching + espace-formateur + portail bénéficiaire (charte, Web Vitals).
- **P8** RGPD / audit log / rétention 5 ans pour les nouvelles entités.
- **P9** E2E « dossier AFEST complet » + mode auditeur + revue adversariale (réutiliser `engine/adversarial-critique.ts`) → 0 défaut bloquant. **STOP & ASK avant deploy.**

## 7. STOP & ASK encore ouverts (garde-fou #2 — à confirmer Will + certificateur)
1. **Périmètre** : l'AFEST / le 1-to-1 est-il dans le périmètre d'agrément Qualiopi visé ? (« finançable une fois l'agrément en périmètre »).
2. **Tuteur entreprise** : désigné + signataire **systématique** du protocole, ou « le cas échéant » ?
3. **Formateur/accompagnateur AFEST** : habilitation **tracée** exigée, ou formateur Axion-IA suffit ?

**Parti pris proposé pour ne pas bloquer** : modéliser ces champs en **optionnels non-enforced** (P1), l'enforcement (tuteur obligatoire / habilitation requise) étant piloté par un flag `SiteSetting` cat. qualiopi, activé après réponse certificateur. À valider par Will.

## 8. Garde-fous légaux (#3)
Placeholders `SiteSetting` cat. `qualiopi` (NDA, n° Qualiopi, SIRET) **renseignés par Will — aucun numéro inventé**. Entité « Axion-IA SAS », fondateur « Williams ». `OF_PUBLIC_DISCLOSURE_ENABLED` reste `false` (docs AFEST = back-office). Mention périmètre AFEST sur convention/attestation seulement après agrément confirmé.

## 9. Points de vérification reportés (non bloquants, à traiter en phase)
- Écart « 22 fichiers `templates/*.tsx` » (agent docs) vs « 19 valeurs `DocumentType` » : probablement des partials/variantes (attestation_partielle, etc.) — à confirmer en P2, sans impact archi.
- `@@unique([coachingSessionId, dateSeance])` sur `CompteRenduSeance` : à décider en P3 (risque si 2 séances/jour).
