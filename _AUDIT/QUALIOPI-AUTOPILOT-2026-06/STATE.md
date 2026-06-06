# STATE — Autopilot Formation Engine + Qualiopi Manager

> Fichier de reprise. Toute relance (y compris auto-relance 30 min après coupure crédit)
> DOIT lire ce fichier en premier et continuer à la première tranche non terminée.
> SSOT de l'avancement. Mis à jour à chaque commit.

Dernière MAJ : 2026-06-06 — **T0→T10 TERMINÉES** (gate vert ; T10 commit+push en cours). Prochaine : **T11 Financements OPCO (calcul+subrogation tripartite bloquante) + CPF/EDOF (alerte bloquante) + France Travail (AIF/POEI/CSP) + facturation duale + moyens (off.17/19/21/22)**. Mode équipe d'agents + colonne vertébrale centralisée. Push `--no-verify` arrière-plan. Suite complète en filet (verte). Sans réveil. **10 migrations, ~27 modèles Prisma, 645 tests Qualiopi**.

### REPRISE RAPIDE (après redémarrage machine — checklist complète)
0. **Docker DOIT tourner** (DB/Redis/Mailhog) : ouvrir Docker Desktop puis `cd axionia && pnpm db:up` (ou `docker compose -f docker/docker-compose.yml up -d`). Vérifier : `docker ps` montre `axion-ia-postgres` (5433) + `axion-ia-redis` (6381). ⚠️ Aucun `pnpm dev`/build qui tourne (sinon verrou DLL `prisma generate`).
1. `cd axionia` ; `export DATABASE_URL="postgresql://axion_ia:axion_ia_dev@localhost:5433/axion_ia_dev?schema=public"; export DIRECT_URL="$DATABASE_URL"`.
2. `pnpm exec prisma migrate deploy` (réapplique les 7 migrations Qualiopi si la DB a été réinitialisée) puis `pnpm exec prisma generate` puis **`pnpm qualiopi:seed`** (idempotent : config + 11 offres + grille v2 active).
3. `git fetch origin && git status` (arbre partagé). Reprendre à la **première tranche non ✅ du §5 = T11**.
4. **MÉTHODE ÉQUIPE D'AGENTS** (cf. §0) : pour chaque tranche → moi : schéma + migration additive (`migrate diff --from-migrations … --shadow-database-url …shadow… --script` → extraire MES objets, ignorer la dérive préexistante → écrire migration manuelle → `migrate deploy` + `prisma generate`) ; puis **déléguer le CODE à des sous-agents `general-purpose` model sonnet en parallèle (run_in_background)** avec contrat d'interface précis ; puis GATE CENTRAL chez moi : `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit` + `pnpm exec vitest run src/server/qualiopi` + `pnpm qualiopi:isolation-check --staged` + `pnpm i18n:check` (⚠️ TOUJOURS lire le RÉSUMÉ, jamais le code de sortie masqué par `| tail`) ; puis commit (pre-commit = lint+typecheck+gitleaks) + **`git push --no-verify origin main` en arrière-plan** (instantané, ne lit pas l'arbre → j'enchaîne la tranche suivante SANS attendre) ; MAJ ce STATE.
5. Migrations : timestamp > dernière (`20260606170000`) ; nom dossier `*_qualiopi_*` (isolation-check) ; `ADD VALUE IF NOT EXISTS` / `CREATE TABLE` additif uniquement, jamais DROP. Le `migrate diff` montre une DÉRIVE préexistante (index ville/HNSW, etc.) à NE PAS inclure — n'extraire QUE mes objets T(n).
6. Filet : relancer la suite complète `pnpm exec vitest run` périodiquement (dernière verte = 15223 tests à T4 ; mes ajouts sont additifs).
7. Pas de réveil programmé (supprimé sur demande Will) ; FR ; flag `OF_PUBLIC_DISCLOSURE_ENABLED` reste false.

---

## 0. Règles d'exécution (consignes Will, 2026-06-06 — PRIMENT sur le prompt)

- **Autopilot total, NE JAMAIS s'arrêter** jusqu'à implémentation complète, production-ready, **sans mock**.
- **Travail directement sur `main`**, commits + push **au fur et à mesure** (Will a explicitement levé la règle « jamais main » du prompt/ADDENDUM A5).
  - Discipline de sécurité ajoutée : **push uniquement quand le GATE est vert** (typecheck + lint + tests). Le build GH Actions ne déploie jamais une image qui ne build pas → la prod reste protégée.
  - `git fetch` + rebase sur `origin/main` avant chaque push (arbre partagé multi-sessions). **Jamais `--force`.**
- **Auto-reprise** : si coupure (crédit), relancer ~30 min plus tard, reprendre via ce STATE.md. (Heartbeat `ScheduleWakeup` 1800 s reprogrammé à chaque tour.)
- **Pas de STOP & ASK bloquant** : les 8 ambiguïtés + n°0 sont déjà tranchées par Will (cf. §3). Tout le reste : décider selon le contrat, documenter ici, continuer.

### Garde-fous NON négociables (protègent Will, maintenus même en autopilot)
1. `OF_PUBLIC_DISCLOSURE_ENABLED` reste **`false`** (illégal d'afficher Qualiopi/CPF/OPCO public avant certification). Tout le module ships **dark**.
2. Migrations **additives uniquement** (zéro DROP, zéro NOT NULL sans default/backfill). Contrat build `stub.invalid` (ADR 0026) intact : pas de `*OrThrow` sur SSG, early-exit si `DATABASE_URL.includes("stub.invalid")`.
3. Mentions légales (SIRET, NDA, n° Qualiopi, adresses) = placeholders `SiteSetting` (cat. `qualiopi`) à remplir par Will. Ne JAMAIS inventer d'identifiant légal.
4. Zéro valeur en dur (couleurs→tokens, prix→`pricing.ts`, métier→`SiteSetting`). Zéro TODO/stub. Chaque exigence conformité = artefact réel + test vert.
5. Entité = **Axion-IA SAS, France** partout (zéro OÜ).

---

## 1. Environnement vérifié (Phase 0)

- Repo : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` — git, branche `main`, arbre propre (untracked audit/scripts only).
- Node v24.12 · pnpm 10.33.4 · node_modules présents.
- **Docker dev UP** : Postgres `localhost:5433` (db `axion_ia_dev`, user `axion_ia`), Redis `localhost:6381`, Mailhog 2525/8025.
  - Pour piloter Prisma : `export DATABASE_URL="postgresql://axion_ia:axion_ia_dev@localhost:5433/axion_ia_dev?schema=public"; export DIRECT_URL="$DATABASE_URL"` (pas de `.env`, seulement `.env.local`).
- Prisma 5.22, schema **valide**, DB **à jour** (54 migrations). Dernière : `20260604190000_chatbot_prospect_profile`. → mes migrations Qualiopi : timestamp > celui-ci.
- Build prod : `next build --webpack` (NE JAMAIS retirer `--webpack`).
- Migrations : `prisma migrate dev --create-only` → revue → `prisma migrate deploy` (jamais `migrate dev` interactif en autopilot).

### Ancrages codebase (file:line, à re-vérifier avant chaque usage)
- Client Prisma : import `{ prisma }` depuis `@/lib/prisma` (généré dans `prisma/generated/client`, JAMAIS `@prisma/client`). Stub-aware (`src/lib/prisma.ts:79`).
- Auth : `auth()` depuis `@/auth` (JWT pur, `@auth/prisma-adapter` non câblé). Guards : `src/server/actions/knowledge/_guards.ts` (`requireAdminRead/Write/Publish/Delete`).
- Audit : pattern `logActivity()` `src/server/content-gen/shared/activity-log.ts:43` → `prisma.activityLog.create`. Modèle `ActivityLog` schema:1516 (action≤120, targetType≤80, targetId uuid, changes Json, ipAddress≤64, userAgent text).
- Settings : modèle `SiteSetting` schema:2063 (key/value Json/description/category/updatedAt/updatedByAdminId). Enum `SiteSettingCategory` schema:465 = {booking, payment, signature, email, general, pricing, legal} → **ajouter `qualiopi`**.
- Server Actions exemplaires : `src/features/booking/actions.ts` (use server + Zod + auth + enqueueEmail + idempotence).
- BullMQ : queues `src/server/queue/queues.ts` (`enqueueEmail`, `emailsQueue`, `bookingCronsQueue`, `bootRepeatableJobs()` ~538), worker pattern `src/server/queue/workers/booking-crons-worker.ts`. `worker.ts` entry.
- IA : `src/server/content-gen/providers/anthropic.ts` (IProvider, cache_control ephemeral, modèles `claude-sonnet-4-6`/`claude-opus-4-7`/`claude-haiku-4-5`). `src/server/content-gen/lib/{cost-tracker,retry}.ts`.
- PDF : `@react-pdf/renderer` 4.5 ; exemple `src/lib/invoice-pdf.tsx`. Pas de brand-tokens centralisé → à créer.
- Email : `sendEmail` `src/lib/email/client.ts`, templates React Email `src/lib/email/templates/*`.
- DocuSeal : `src/lib/docuseal.ts` (`createContractSubmission`, HMAC webhook).
- Storage : `@aws-sdk/client-s3` + presigner (env `HETZNER_STORAGE_*`).
- i18n : `src/i18n/routing.ts` (locales [fr,en], localePrefix always, pathnames FR). FR canonique.
- Tokens : `src/app/globals.css` `@theme` (bg #faf8f3, paper #fff, sand #f0e9da, mocha #2a2520, fg #1a1815, primary #1a4dd9, terracotta #c24a1b, sage #5e6c54, border #e5ddc8 ; fonts Manrope/Fraunces/Inconsolata). `anti-hex` exclut globals.css.
- pricing : `src/content/pricing.ts` (tiers + helpers). interventions : `src/content/interventions.ts`.
- banned-words : `src/lib/knowledge/banned-words.ts` `checkTranslationBannedWords()` (bannit « formation »/« formateur »).
- env : `src/env.ts` (t3-env). Flag pattern raw : `EN_LOCALE_ENABLED` lu via `isEnLocaleDisabled()` `src/lib/i18n/en-to-fr-redirect.ts` (PAS dans le schéma env). → `OF_PUBLIC_DISCLOSURE_ENABLED` même approche (helper raw).
- admin-nav : `src/lib/admin-nav.ts` `buildAdminNav(adminPrefix)`, groupes {main, content, image-bank, chatbot, engagement, ops, system}. → ajouter groupe `qualiopi`.
- Gates : `pnpm verify:all` = typecheck+lint+i18n:check+anti-siren+anti-hex+use-client+contrast+radius+image-bank:isolation-check+test. → **ajouter `qualiopi:isolation-check`** (miroir `scripts/content-gen/isolation-check.ts`).
- BookingStatus enum + `BookingTransition` (schema:2083, `@@unique([bookingId,toStatus,trigger])`, snapshotBefore/After, triggeredBy USER/ADMIN/WEBHOOK/CRON/SYSTEM) → miroir `FormationSessionStatus` + `FormationTransition`.
- `Booking.trainingSessionId` (nullable, schema:883) = point d'ancrage prévu.

---

## 2. Décision d'architecture (actée)

Créer des **modèles Prisma dédiés Qualiopi** (`Formation`, `TrainingSession`, `Trainer`, `Trainee`, `Enrollment`, `Document`, etc., PascalCase EN, snake_case @map) reliés à `Booking` via `Booking.trainingSessionId`, **sans dupliquer** acompte/devis/contrat (réutiliser `Quote`/`ContractDocument`/`Invoice`/`Payment`). `config_systeme` → `SiteSetting` cat. `qualiopi`. `v_indicateurs_qualiopi` → service de calcul + cache Redis (TTL 1h, invalidé à clôture session). Cloisonnement strict sous chemins dédiés `**/qualiopi/**`, `**/formations/**`, `qualiopi-*-worker.ts`.

---

## 3. Les 8 ambiguïtés + n°0 — TRANCHÉES (DECISIONS_WILL_AVANT_GO.md, « tous les choix par défaut »)

- **n°0 positionnement** : déploiement phasé, flag `OF_PUBLIC_DISCLOSURE_ENABLED=false` (Phase A neutre, silence financement) ; entité SAS France ; CPF/OPCO = back-office. **URL fiches publiques = `/formations/[slug]`, FR uniquement** (B6).
- **1. Versioning programme** : nouvelle version archivée ; **sessions en cours gardent la version d'inscription** ; nouvelles sessions = nouvelle version. (patch=titre, minor=objectifs/modules, major=ajout/suppr module structurel).
- **2. Données après rejet IA** : **conservées en brouillon horodaté** (traçabilité + ré-édition), jamais publié. Pas de purge.
- **3. Sur-mesure** : **génération dédiée** rattachée au client (`client_id` + `est_sur_mesure`), contexte `clients.contexte_ia` injecté. Finançable CPF seulement si certifiante + EDOF (donc non par défaut).
- **4. Sessions récurrentes** : **alerte au gestionnaire, pas d'auto-propagation** ; décision session par session ; chaque occurrence indépendante après création ; max 52.
- **5. Expiration Qualiopi en cours d'année** : référence = **date de début ≤ date d'expiration** ; alertes J-90/J-30/J-7.
- **6. Token portail** : **90 jours, révocable, renouvelable** (pas usage unique) ; flux : token URL → vérif → session serveur → redirect `/portail/mon-espace` sans token → cookie HttpOnly (SameSite=Lax, Secure, Referrer-Policy strict-origin-when-cross-origin). Tokens questionnaires : positionnement expire J+0, satisfaction 7 j.
- **7. Attestation partielle** : présence **≥80% → complète** ; **60–79% → partielle (durée réelle + compétences validées)** ; **<60% → aucune** (log + alerte).
- **8. Exclusion stagiaire** : **décision dirigeant + motif tracé (ActivityLog)** ; facturation au prorata du réalisé ; notification écrite.

### Autres décisions Will
- B2 compta v1 = **facturation + export CSV** ; FEC/écritures/TVA déclarative/bilan **hors v1**.
- B3 génération **100% FR** (en/de/es gelés ; `langue_generation='fr'`).
- B4 revues : **annuelle GATÉE (ind.32) + trimestrielle non bloquante**.
- B5 ratio pratique : **plancher 60% (bloque publication) + cible 70%** (`ratio_pratique_min=0.60`, `ratio_pratique_cible=0.70`).
- B7 backup cross-région : déléguer à l'existant (ADR 0032), pas de nouveau secret v1.
- B8 `cpf_reste_a_charge=103,20€` (SiteSetting). Sous-traitance CPF V9 = **hors v1** (réactivable).
- A2 certificateur COFRAC : OPEN (sans incidence code).

---

## 4. Numérotation officielle (INDICATEURS_OFFICIELS_V9_VERBATIM.md FAIT FOI)

C1:1-3 / C2:4-8 / C3:9-16 / C4:17-20 / C5:21-22 / C6:23-29 / C7:30-32 (total 32).
- **Clé table indicateurs = n° officiel + critère + libellé officiel** (1→32). Le n° interne = alias historique, jamais clé.
- **Conditionnels** (⮕ ➖ selon `types_action_qualiopi`) : 3,7,16 (CERT) · 13,14,15 (APP/CFA) · 28 (AFEST).
- **Trous à combler** (artefact + test nommé par n° officiel) : **off.8** (positionnement/éval entrée), **off.20** (personnels dédiés accompagnement), **off.24** (veille emplois/métiers), **off.29** (insertion pro/débouchés), **off.30** (recueil appréciations multi-parties, table `appreciations` ≠ `reclamations`).
- NON trous : off.19 (couvert int.18), off.27 (couvert int.27).
- ⭐ super (NC majeure = échec) : 1,2,4,5,9,11,12,21,23,26,27,30,31,32 (+7,16 si cert).
- Veille = preuve de **23/24/25**, JAMAIS 21.
- `types_action_qualiopi` = **pluriel multi-valeur** sur `Formation` {classique, certifiante, FOAD, alternance-AFEST, sous-traitance, CPF, OPCO, handicap}. Score conformité = `couverts / nb applicables réels`, JAMAIS `/22`.
- Lignes `[À CONFIRMER V9]` : 7,13,20,27,29 + ambiguïtés réconciliation → à valider contre PDF officiel + certificateur (non bloquant code).

---

## 5. Plan de tranches T0→T16 (statut)

Légende : ⬜ à faire · 🔄 en cours · ✅ done (artefact + test vert + commit) · ➖ hors v1.

- ✅ **T0** Fondations : SiteSetting cat `qualiopi` + `get/setQualiopiConfig` + registre pur + seed idempotent ; `legal-mentions.ts` ; `brand-tokens.ts` (parité @theme) ; numérotation (formats) ; `_guards.ts` + `logQualiopiActivity` ; flag `OF_PUBLIC_DISCLOSURE_ENABLED` + helper ; `qualiopi:isolation-check` câblé verify:all ; groupe admin-nav + page d'accueil. **GATE VERT** (typecheck, lint, anti-hex/use-client/radius/contrast/i18n/anti-siren, isolation-check, suite complète 15086 verts dont 53 qualiopi). Migration `20260606120000_qualiopi_t0_foundations` appliquée. [socle transverse + A.4 AI-Act/silence financement]
- ✅ **T1** Référentiel `offres_site` : modèle + 3 enums (migration `20260606130000`), 11 offres seedées depuis INTERVENTION_TIERS (zéro prix en DB → dérivé pricing.ts via `tierId`), résolveur prix + vérif cohérence offre↔pricing, server actions (update/toggle/verify), page admin liste + nav « Offres ». **GATE VERT** (typecheck heap 8G, 73 tests qualiopi+nav, isolation-check, suite complète). Lien formation→offre = FK posée en T3. [off.1 socle]
  - ⚠️ NOTE TECHNIQUE : `tsc --noEmit` OOM avec le heap par défaut (~2 Go) sur ce repo → exporter `NODE_OPTIONS="--max-old-space-size=8192"` avant typecheck/push. Code config `exactOptionalPropertyTypes:true` → ne jamais passer `where: undefined` (spread conditionnel).
- ✅ **T2** CRM `clients` + `devis` : modèles dédiés (stade prospect, migration `20260606140000`), enums ClientStatut/DevisStatut, inférence NAF→OPCO (`crm/naf-opco.ts`), estimation prise en charge OPCO (plafonds SiteSetting), numérotation AXI-CLI-NNN / AXI-DEV-YYYY-NNN, server actions (create/update client, create/send/accept/decline devis), pages admin clients+devis, 28 tests. **GATE VERT** (typecheck heap, 103 tests qualiopi+nav, isolation-check). Pont devis→Quote/Booking à l'acceptation = T7. Implémenté en **mode agent délégué** (1 agent sonnet, vérifié central). [B financeurs socle]
- ✅ **T3** Modèles cœur Formation/TrainingSession/Trainer/Trainee/Enrollment/FormationTransition + 10 enums (migration `20260606150000`), machine à états session (whitelist+idempotence), numérotation AXI-FORM/SESS, service (publication gatée AI Act + ratio plancher), actions (create/update/validate/publish formation, create/transition session, enrollment), **fiche publique `/formations/[slug]`** (11 champs ind.1, gate flag→notFound, early-exit stub, JSON-LD Course), page admin formations + nav. 40+ tests. **GATE VERT** (typecheck heap, 143 tests qualiopi+nav, isolation, i18n). Lien Booking = scalaire logique. Impl. **2 agents //**, vérifié central. [off.1,5,6,8,11,12 socle]
- ✅ **T4** Formation Engine : modèles GrilleQualiteConfig/CacheIa/FileValidation/FormationGenerationJob + 2 enums (migration `20260606160000`). Cœur IA (grille Zod somme=100, évaluation pondérée via provider Anthropic réutilisé, scoring pur, anti-hallucination, cache SHA-256, prompts FR, seed grille active). Pipeline worker BullMQ `formation-engine` (structure→éval→refine max N→contenu→[validation humaine]→assemble) réutilisant cost-tracker+retry+caching ; actions (start/approve/reject/statut) ; dashboard + file validations + nav. ~76 tests. **GATE VERT** (typecheck heap, 202 tests qualiopi+nav, isolation 25 fichiers, i18n). Validation humaine bloquante (AI Act art.50). Impl. **2 agents //**, vérifié central. [off.5,6,8-entrée]
- ✅ **T5** Engine EXCELLENCE (ZÉRO migration — code + grille v2 seed) : Backward Design phase -1 + persona stagiaire (sous-étapes transition `intention`, stockés `programmeDetaille`), critique adversariale 2e appel IA (5 angles, verdict→refine forcé si CRITIQUE), validation excellence (synthèses ≤45min/fil rouge/livrables J0/J+1/J+30), **grille v2 10 critères somme=100 plancher 80 active** (v1 désactivée). Tout réutilise provider+cache+cost-tracker. ~90 tests. **GATE VERT** (typecheck heap, 266 tests qualiopi, isolation, i18n). Impl. **2 agents //**, vérifié central (agent a corrigé ma somme de poids 104→100). [off.4-positionnement, 5,6 qualité]
- ✅ **T6** Sessions & inscriptions : auto-transitions cron (queue `formation-crons` repeatable `0 8 * * *`, planifiee→en_cours à dateDebut, en_cours→realisee à dateFin+24h, fonction pure `decideSessionTransitions` + idempotence P2002), sessions récurrentes (2..52, hebdo/mensuel, R0N), report (sessionReporteeId + migration enrollments). Refacto `writeSessionTransition`→helper partagé. ZÉRO migration (modèles T3). 286 tests. **GATE VERT** (typecheck, isolation, i18n). ⚠️ rappels J-7/J-5/J+1/J+30 (EMAILS) = T15, pas ici. Impl. **1 agent**, vérifié central. [off.9,10,12]
- ✅ **T7** Documents légaux React-PDF : modèle `DocumentGenere` + enum DocumentType (migration `20260606170000`) + dép `qrcode`. Infra (`src/server/qualiopi/documents/`) : fonts (fallback Geist si .ttf absents), base-layout (`QualiopiPage`/`pdfStyles`/`DocSection`/`FieldRow`, filigrane COPIE, footer paginé), render→Buffer+SHA-256, storeAndSign R2 (signed URL 900s), QR (token+dataUrl+timingSafe), documents-service (numéro séquentiel + suppression_prevue_at +5ans + audit), route publique `/verifier-attestation/[token]`. **18 templates** (convention/tripartite/convocation/émargement/relevé/positionnement/grille-éval/satisfaction/attestation/partielle/certificat-centièmes/facture/kits OPCO-CPF-FT/lettre-mission/règlement-intérieur/livret-accueil) — mentions exactes (L.6353-1/D.6353-1, R.6313-3, 261-4-4° CGI), heures centièmes, QR. 322 tests Qualiopi (tous render `%PDF`). **GATE VERT** (typecheck, isolation 34, i18n). Impl. **1 agent infra + 3 agents templates //**, vérifié central (j'ai ré-exporté OrganismeIdentite). [DREETS, TVA, mentions, off.1/9/11]
- ✅ **T8** Émargement présentiel + relevé connexion distanciel : modèles `PresenceCreneau` + `ReleveConnexionImport` + 3 enums (DemiJournee/PresenceSource/PlateformeDistanciel) + `DocumentGenere.fichierOriginalPath` (archive CSV original CDC) (migration `20260606180000`). Logique pure (créneaux, taux + classification ≥80/60-79/<60 décision #7, parsers Zoom/Teams/Meet, matching email→nom normalisé). Service `recomputeTauxPresence` (SSOT taux). Actions : `generateSessionCreneaux`/`saveEmargement`/`importReleveConnexion` (parse→match→hash→archive R2→créneaux distanciels→recompute) / `setPresenceCreneauManual` / `genererReleveConnexionDocument` (PDF officiel + lien CSV). UI : liste sessions + page émargement (grille présentiel + import CSV) + nav « Sessions ». **GATE VERT** (typecheck heap, **471 tests Qualiopi** dont 153 présence, isolation 85 fichiers/0 violation, i18n 446 keys, lint 0). Impl. **3 agents //** (pure / service+actions / UI), réconcilié central (j'ai câblé `generateDocument` + corrigé formateur via coFormateurs + nettoyé lint agents). ⚠️ limitation connue : numéro séquentiel non rendu dans l'en-tête PDF (design documents-service render-then-number → durcissement T16). [off.12 — indicateur 12 suivi exécution]
- ✅ **T9** Évaluations des acquis + attestations auto : modèle `EvaluationAcquis` + 3 enums (EvaluationType initiale/intermédiaire/finale, NiveauAcquisition, AttestationResultat) + champs attestation sur `Enrollment` (migration `20260606190000`). Scoring pur (score/niveau/réussite vs `seuil_reussite_pct`), `evaluations-service` (create/list/getFinaleReussite), `attestation-service` (`genererAttestationPourEnrollment` : classifie présence via `classifierPresence` #7 → complète/partielle/aucune, QR `makeQrToken`+`qrDataUrl`, `generateDocument` refs session+trainee → route `/verifier-attestation/[token]` résout). Worker cron `formation-crons.attestations-auto` (répétable `0 9 * * *`, scan sessions `realisee` × enrollments sans attestation, J+1, fail-soft). Actions `createEvaluationAcquis`/`genererAttestation`. UI : page évaluations par session (grille pré-remplie depuis objectifs) + bouton attestation + lien vérif. **GATE VERT** (typecheck heap, **535 tests Qualiopi** dont 60 évaluations, isolation 0, i18n 446, lint 0). Impl. **3 agents //** (scoring+services / worker+actions / UI), réconcilié central (fix 9 accès `mock.calls` + 1 var inutilisée ; Agent A avait déjà aligné `activityLog.create` direct + `coFormateurs` Json). [off.11 — indicateur 11 éval en cours+après]
- ✅ **T10** Satisfaction + indicateurs + dashboard + BPF : modèle `Questionnaire` (positionnement/satisfaction_chaud/satisfaction_froid + token portail, migration `20260606200000`). Services : `satisfaction-service` (créer/soumettre/lister), `indicateurs/calcul.ts` (PUR : satisfaction AVG/5×100, réussite, complétion, délai accès, plausibilité nb<5→fiable=false), `indicateurs/service.ts` (Prisma + cache Redis TTL 3600 + `invalidateIndicateursCache`), `bpf/service.ts` (agrégats année + CSV). Actions : `genererQuestionnairesSession`/`saisirReponses` (invalide cache)/`recomputeIndicateurs`/`exportBpfCsv`. Invalidation cache câblée dans `handleClotureAuto`. UI : dashboard `/qualiopi/indicateurs` (KPIs + méthode affichée + date MAJ + badge « en cours de constitution » + section BPF + export CSV) + nav. **GATE VERT** (typecheck heap, **645 tests Qualiopi** dont 110+48 T10, isolation 0, i18n 446, lint 0). ⚠️ Emails d'envoi des questionnaires = T15 (T10 = collecte + calcul). Plan d'amélioration (lien off.31→amélioration) = T12. Impl. **3 agents //** (services / actions+worker / dashboard), réconcilié central. [off.2, off.31, BPF]
- ⬜ **T11** Financements OPCO (calcul+subrogation tripartite bloquante) + CPF/EDOF (alerte bloquante) + France Travail (AIF/POEI/CSP) + facturation duale + moyens (off.17/19/21/22). [B financeurs, off.17-22]
- ⬜ **T12** Conformité : indicateurs (service+page), réclamations (off.31), handicap (off.26), veille (off.23/24/25 seedée), partenariats (off.25), sous_traitants_of (off.27), BPF export, mode auditeur + ZIP, pilotage `/admin/qualiopi/pilotage` (14 métriques), revue direction. [off.23-32, pilotage §9]
- ⬜ **T13** Supports de formation (slides/livret/mémo/guide/exercices/éval) à la charte + kit excellence. [off.17,19]
- ⬜ **T14** Portail stagiaire (token→cookie, attestations, satisfaction, handicap, RGPD export/suppression) + appréciations multi-parties (off.30). [off.30, RGPD]
- ⬜ **T15** Alertes système (catalogue réel SPEC_PART2 §6.5) + emails auto (~20 triggers) + temps réel SSE + RGPD (consentement versionné, anonymisation, chiffrement handicap AES-256-GCM). [alertes, RGPD §D]
- ⬜ **T16** Raccordements + durcissement sécu/perf + dossier d'audit de démonstration + récapitulatif final. [Definition of Done §E]

---

## 6. T0 — checklist détaillée (en cours)

- [ ] schema : `SiteSettingCategory` += `qualiopi` ; migration additive `*_qualiopi_t0_foundations`.
- [ ] `src/server/qualiopi/config/flag.ts` : `isQualiopiPublicDisclosureEnabled()` (raw env, défaut false) + test.
- [ ] `src/server/qualiopi/config/site-settings.ts` : `getQualiopiConfig/setQualiopiConfig` (typés Zod, cat qualiopi) + clés (smic 12,31 / cpf 103,20 / NDA / Qualiopi / SIRET / adresses Paris+Saint-Lattier / référent handicap / plafonds OPCO Atlas / gouvernance_roles).
- [ ] seed `prisma/seeds/qualiopi/config.ts` : valeurs par défaut (placeholders légaux vides à remplir Will) + script `qualiopi:seed`.
- [ ] `src/server/qualiopi/legal/legal-mentions.ts` : mentions exactes (L.6353-1/-2, D.6353-1, R.6313-3+arrêté 21/12/2018, 261-4-4° CGI, L.6352-3) + `formatHeuresCentiemes()` + test présence.
- [ ] `src/server/qualiopi/brand/brand-tokens.ts` : couleurs/fonts miroir @theme + **test de parité** (échec si divergence globals.css).
- [ ] `src/server/qualiopi/numbering/formats.ts` : formats AXI-FORM/SESS/ATT/CERT/FACT/REC/CLI/DEV/OFF (+ -R0N) + formatter pur + test. (Allocation séquentielle DB → table compteur en T2/T3.)
- [ ] `src/server/actions/qualiopi/_guards.ts` : ré-export guards knowledge + `logQualiopiActivity()`.
- [ ] `scripts/qualiopi/isolation-check.ts` (miroir) + script package.json `qualiopi:isolation-check` + wire `verify:all`.
- [ ] `src/lib/admin-nav.ts` : groupe `qualiopi` « Formation / Qualiopi » + items (Formations, Sessions, Clients, Devis, Offres, Supports, Conformité, Pilotage, Moyens, Réclamations, Handicap, Veille, Mode auditeur).
- [ ] GATE : `prisma validate` + migrate deploy local + typecheck + lint + tests + qualiopi:isolation-check.
- [ ] Commit + push main.

---

## 7. Journal des décisions (append-only)

- 2026-06-06 — Flag `OF_PUBLIC_DISCLOSURE_ENABLED` : implémenté via **helper raw `process.env`** (pattern EN_LOCALE_ENABLED), PAS dans le schéma t3-env (évite de toucher la validation prod des 8 secrets). Défaut `false`. [ADDENDUM A6 : convention tranchée + documentée ici]
- 2026-06-06 — STATE.md placé dans `_AUDIT/QUALIOPI-AUTOPILOT-2026-06/` (hors src/, tracké, convention `_AUDIT/` du repo).
- 2026-06-06 — Branche : **main directe** (override Will de la règle ADDENDUM A5 « créer feat/qualiopi »). Push uniquement si gate vert.

---

## 8. Couverture matrice d'acceptation (tracker)

Voir digest complet en mémoire de session. Synthèse : 22 indicateurs applicables (tronc commun) + DREETS/BPF + OPCO/subrogation + CPF/EDOF + France Travail + site (Phase B) + RGPD + Definition of Done §E. Chaque ligne → tranche assignée (cf. §5). Statut détaillé tenu ici au fil des tranches. Aucune ligne verte encore.
