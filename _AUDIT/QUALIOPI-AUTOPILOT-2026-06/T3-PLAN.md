# T3 — Modèles cœur (plan d'implémentation corrigé)

> Issu de l'agent recherche + corrections (ne PAS appliquer la spec brute telle quelle).
> Tranche : Formation, TrainingSession, Trainer, Trainee, Enrollment, FormationTransition
> + relations inverses sur OffreSite/Client/Devis + fiche publique `/formations/[slug]`.

## Corrections vs spec agent (IMPORTANT)
- **PII handicap** : utiliser `src/lib/pii-crypto.ts` + secret **`PII_ENCRYPTION_KEY`** (existant, env.ts) — PAS de `HANDICAP_ENCRYPTION_KEY` inventé. Champ `handicapDetailsChiffre String?` (format pii-crypto). `accessibleHandicap`/`situationHandicap` en clair (booléen non sensible).
- **`TypeActionQualiopi`** : RESTREINDRE au périmètre v1 = `classique, certifiante, foad, alternance_afest, sous_traitance, cpf, opco, france_travail, handicap`. (PAS bilan_competences/vae/apprentissage/cfa = hors v1.)
- **`SupportFormation`** : NE PAS créer en T3 → c'est **T13**. Ne pas ajouter `supports` sur Formation maintenant.
- **Relations inverses additives** : ajouter `formations Formation[]` sur OffreSite et Client ; `sessions TrainingSession[]` sur Client ; `sessionsGenerees TrainingSession[]` sur Devis ; relation inverse `bookings Booking[]` via le `Booking.trainingSessionId` existant (⚠️ vérifier si Booking a déjà la relation nommée ou juste le scalaire — adapter, ne pas dupliquer).
- **`buildCourseJsonLd`** : vérifier sa présence réelle (`grep -r buildCourseJsonLd src/lib`) avant de l'utiliser dans la fiche.
- **AdminUser relation** pour `FormationTransition.triggeredByAdmin` : vérifier le nom de relation libre (miroir `BookingTransition` "BookingTransitionActor" → "FormationTransitionActor"). AdminUser doit recevoir la relation inverse.
- **TransitionTriggeredBy** : réutiliser l'enum existant (USER/ADMIN/WEBHOOK/CRON/SYSTEM) — vérifier les valeurs exactes dans schema.

## Enums à créer
- `FormationStatutGeneration` : intention, structure_generee, contenu_evalue, structure_validee, contenu_genere, contenu_valide, assemble, publie, archive
- `FormationStatut` : actif, publie, archive
- `TrainingSessionStatut` : planifiee, en_cours, realisee, annulee, reportee
- `EnrollmentStatut` : planifiee, presente, abandon, exclu
- `TypeActionQualiopi` : (cf. correction ci-dessus)
- `TrainerStatut` : salarie, sous_traitant
- `ModaliteFormation` : presentiel, distanciel, hybride (⚠️ vérifier collision avec un enum Modalite existant ; sinon préfixer)
- `CertificationType` : aucune, rs, rncp
- `FinancementType` : direct, opco, cpf, france_travail, mixte
- `OpcoStatut` : non_demande, demande_en_cours, accord_recu, refuse, paiement_recu

## Modèles (champs détaillés dans la spec agent — appliquer avec corrections)
- **Formation** : titre, slug @unique, numero @unique (AXI-FORM-YYYY-NNN), offreSiteId FK (Restrict, OBLIGATOIRE), clientId? FK (SetNull), estSurMesure, dureeHeures, modalite, objectifsPedagogiques Json, programmeDetaille Json, methodesPedagogiques Text, seuilReussitePct default 70, ratioPratiquePct?, accessibleHandicap, certificationType, codeCpf?, edofVerifieAt?, statutGeneration, statut, versionProgramme "1.0", versionHistorique Json, langueGeneration "fr", aiGenerated/aiModel/aiPromptVersion/validatedBy/validatedAt, typesActionQualiopi[], tarifHtCents?, timestamps. Index offreSiteId/clientId/statut/statutGeneration.
- **TrainingSession** : numero @unique (AXI-SESS-YYYY-NNN[-R0N]), titreSession, formationId FK Restrict, dateDebut/dateFin (UTC), dureeReelleHeures?, modalite, icalUid?, clientId?/devisId? FK SetNull, financementType?, montantHtCents, opcoStatut, opcoSubrogation, conventionTripartiteSigneeAt?, edofVerifieAt?, ft* (POEI/AIF), nbParticipantsPrevus/Reels?, coFormateurs Json, sessionParentId? self (récurrentes, max 52), sessionReporteeId? self, statut, timestamps. Relations enrollments/transitions/bookings.
- **Trainer** : nom, prenom, email @unique citext, telephone?, statut, cvUrl?, cvUploadedAt? (alerte >12 mois), domainesCompetences Json, formationsHabilitees String[], tarifJourneeHtCents? (sous-traitant), actif default true, timestamps. (Sous-traitant NDA/Qualiopi vérif data.gouv → table `sous_traitants_of` distincte en T12, pas ici.)
- **Trainee** : nom, prenom, email @unique citext, telephone?, entreprise?, fonction?, situationHandicap default false, handicapDetailsChiffre? (pii-crypto), handicapVerifieAt?/Par?, consentement* + consentementAt?, deletedAt? (soft delete RGPD), timestamps.
- **Enrollment** : sessionId FK Cascade, traineeId FK Cascade, statut, tauxPresencePct?, emargementSigneAt?, adaptationsRealisees? Text, @@unique([sessionId, traineeId]), timestamps.
- **FormationTransition** : miroir BookingTransition sur sessionId (fromStatus/toStatus TrainingSessionStatut, trigger, triggeredBy, triggeredById? AdminUser, reason?, snapshotBefore/After, @@unique([sessionId,toStatus,trigger])).

## Logique (service `src/server/qualiopi/formations/`)
- `canCreateSessionFor(formation)` : statutGeneration==='publie' && statut==='actif'.
- validation durée session ∈ [offre.dureeHeuresMin, max] ; ratio ≥ plancher (getQualiopiConfig).
- machine à états : TRANSITIONS_ALLOWED map + writeTransition (idempotent).
- numérotation atomique : compteur via count+1 dans transaction (guard @unique → retry).
- fuseau : stockage UTC, affichage Europe/Paris (helper `src/lib/intl` ou date-fns-tz si présent — vérifier).

## Fiche publique `/formations/[slug]` (indicateur 1)
- gate `isQualiopiPublicDisclosureEnabled()` false → `notFound()` + `generateStaticParams` vide.
- early-exit `stub.invalid`. findFirst formation publie+actif via offre.slug. 11 champs. JSON-LD Course (builder existant). Server Component, setRequestLocale.

## Découpage agents (mode équipe)
- Moi : enums + 6 modèles dans schema + relations inverses + migration (shadow diff) + generate.
- Agent A : service formations (canCreateSession, transitions, numérotation, validation) + tests.
- Agent B : server actions (createFormation, transitions session, create session, enrollment) + tests.
- Agent C : fiche publique `/formations/[slug]` + page admin liste formations + nav.
- Moi : nav, gate complet, commit, push.
