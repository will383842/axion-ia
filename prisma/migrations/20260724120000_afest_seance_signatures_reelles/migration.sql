-- QUALIOPI AFEST 1-to-1 — Signature électronique RÉELLE par séance.
--
-- ## Ce que cette migration remplace
--
-- L'émargement AFEST 1-to-1 était un FAUX POSITIF : `signerSeance1to1Action`
-- posait des booléens (`beneficiaireSigneAt` / `formateurSigneAt` /
-- `tuteurSigneAt` / `presenceSigneeAt`) sur simple clic admin, sans acte
-- signataire, sans image, sans empreinte et sans chaînage. Une « signature »
-- juridiquement anonyme : l'art. 1367 C. civ. n'identifie aucun signataire.
--
-- ## Table DÉDIÉE, et pas une extension d'`emargement_signatures`
--
-- Trois motifs, aucun cosmétique :
--
--   1. GUARDRAIL « AUCUN DROP ». Étendre `emargement_signatures` imposerait de
--      DROP/recréer l'index `emargement_signature_coaching_active` ET le CHECK
--      `ck_emargement_signature_contexte`, tous deux PARTAGÉS avec le chemin
--      collectif vivant en production. Cette migration est 100 % ADDITIVE.
--   2. MISMATCH DE GRAIN. Le collectif = 1 signataire / créneau. L'AFEST =
--      3 rôles (bénéficiaire, formateur, tuteur externe) × N séances, avec une
--      chaîne PAR RÔLE. Précédent maison exact : la contresignature a reçu sa
--      propre table pour ce motif (« loger la contresignature avec les
--      signatures stagiaires était l'erreur de conception v2 »).
--   3. ZÉRO DUPLICATION DE VÉRIFICATION. `verifierChaine` (hash.ts) est
--      générique sur `MaillonChaine` : la table dédiée le réutilise TEL QUEL.
--      Seule la sérialisation du tuple est isolée par contexte.
--
-- Vestiges assumés, NON supprimés et documentés supersédés : la valeur d'enum
-- `EmargementContexte.afest_1to1`, la FK `emargement_signatures.coaching_id` et
-- l'index `emargement_signature_coaching_active`. Aucune ligne AFEST réelle n'y
-- existe : rien à migrer DANS CETTE TABLE.
--
-- ## Doctrine reprise du collectif, sans exception
--
-- · SNAPSHOT : `seance_date`, `heure_debut`, `heure_fin`, `formation_intitule`,
--   `modules_snapshot`, `formateur_nom`, `signataire_nom` ne sont PAS de la
--   dénormalisation de confort. Elles sont la condition pour que `self_hash`
--   soit RECALCULABLE. Les reconstruire par jointure serait pire que de ne rien
--   avoir : renommer une intervention invaliderait rétroactivement, et en
--   silence, toutes les empreintes déjà émises.
-- · APPEND-ONLY : aucun `updated_at`. Une correction passe par révocation puis
--   nouvelle signature. Les index uniques sont PARTIELS (`WHERE revoked_at IS
--   NULL`) précisément pour rendre cette correction possible.
-- · `ON DELETE RESTRICT` partout, explicitement : une preuve légale ne
--   disparaît jamais en cascade.
--
-- ⚠️ CONSÉQUENCE ASSUMÉE du RESTRICT sur la FK composite : `coaching_sessions →
-- coaching_comptes_rendus` est en CASCADE. Un parcours portant au moins une
-- signature devient donc NON SUPPRIMABLE (la cascade bute sur le RESTRICT).
-- C'est voulu : supprimer un parcours ne doit pas effacer des émargements
-- opposables. La suppression suppose de révoquer, puis d'archiver.
--
-- ## Régime de preuve PAR PARCOURS (et non flag global)
--
-- `afest_perimetre_certifie` est un SiteSetting GLOBAL : le basculer
-- appliquerait le nouveau filtre d'heures à TOUS les parcours, y compris ceux
-- déjà attestés — une régression rétroactive sur des montants OPCO/France
-- Travail déjà déclarés. D'où `coaching_sessions.regime_preuve`, par parcours,
-- avec `legacy_boolean` par DÉFAUT : à l'issue de cette migration, le
-- comportement de production est INCHANGÉ pour l'intégralité de l'existant.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums NEUFS (`CREATE TYPE`) — la règle « ADD VALUE dans une migration
-- séparée » ne s'applique donc pas.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "coaching_signataire_role" AS ENUM ('beneficiaire', 'formateur', 'tuteur');

-- CreateEnum
-- Distinct d'`EmargementMethode` : le contexte AFEST a son propre cycle de vie
-- de preuve, et coupler les deux énumérations ferait qu'une évolution du
-- collectif toucherait des tuples AFEST déjà scellés. `trace` = tracé au doigt
-- ou à la souris ; `confirmation_accessible` = chemin CLAVIER + lecteur d'écran
-- (O10, ind. 26) ; `papier_scanne` = repli de continuité sur site sans réseau.
-- Les TROIS valent présence probante — voir `heuresReellesSignees`.
CREATE TYPE "coaching_signature_methode" AS ENUM ('trace', 'papier_scanne', 'confirmation_accessible');

-- CreateEnum
-- Statut d'une séance. Sans lui, une absence légitime (séance annulée, arrêt
-- maladie) bloquait l'attestation À VIE : le gate exige `every(cr → présence
-- signée)`, et une séance jamais tenue n'est jamais signée.
CREATE TYPE "coaching_seance_statut" AS ENUM ('planifiee', 'realisee', 'annulee', 'absence_justifiee');

-- CreateEnum
CREATE TYPE "coaching_regime_preuve" AS ENUM ('legacy_boolean', 'signature_reelle');

-- ─────────────────────────────────────────────────────────────────────────────
-- Prérequis de cohérence — ANTI-RÉATTRIBUTION DE CHAÎNE
--
-- `coaching_seance_signatures` porte `compte_rendu_seance_id` (le vrai grain)
-- ET `coaching_id` (dénormalisé, portée de la chaîne). Sans garantie AU NIVEAU
-- DB que `CompteRenduSeance.coaching_session_id = coaching_id`, un `coaching_id`
-- erroné placerait la chaîne d'un parcours sur un autre, SILENCIEUSEMENT :
-- aucun `self_hash` ne bouge, et `verifierChaine` déclarerait les deux chaînes
-- valides. C'est exactement l'attaque que `hash.ts` documente pour
-- `enrollmentId`.
--
-- `coaching_comptes_rendus` n'a aucune clé candidate sur (id, coaching_session_id)
-- (PK + index NON uniques). On la crée : la divergence devient structurellement
-- impossible, plutôt que « interdite par convention ».
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateIndex
ALTER TABLE "coaching_comptes_rendus"
  ADD CONSTRAINT "coaching_comptes_rendus_id_session_key"
  UNIQUE ("id", "coaching_session_id");

-- AlterTable
-- Défaut `realisee` : l'existant garde exactement son comportement actuel.
ALTER TABLE "coaching_comptes_rendus"
  ADD COLUMN "statut" "coaching_seance_statut" NOT NULL DEFAULT 'realisee';

-- ─────────────────────────────────────────────────────────────────────────────
-- Régime de preuve + heures figées à la CLÔTURE
--
-- ⚠️ `coaching_snapshot` est un snapshot ON-FIRST-EMIT, et le premier document
-- d'un parcours AFEST est le PROTOCOLE EX-ANTE (cadrage D.6313-3-1), émis AVANT
-- toute séance. Y figer des heures scellerait 0 h pour l'éternité, et
-- l'attestation finale relirait 0 → « aucune » sur tous les parcours. Les heures
-- signées se figent donc ICI, à la clôture, dans une colonne distincte.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "coaching_sessions"
  ADD COLUMN "regime_preuve" "coaching_regime_preuve" NOT NULL DEFAULT 'legacy_boolean',
  ADD COLUMN "heures_signees_cloture" DECIMAL(6,2),
  ADD COLUMN "heures_signees_cloture_at" TIMESTAMP(3);

-- ─────────────────────────────────────────────────────────────────────────────
-- Jetons — rôle du destinataire + binding e-mail RÉEL
--
-- 🔴 `verifyMagicToken` NE LIE PAS le porteur à un destinataire : son `expected`
-- ne contrôle que `scope` + `resourceId`, et l'e-mail du payload n'est
-- sanity-checké que pour un « @ ». Un lien tuteur transféré signait donc au nom
-- du tuteur sans que rien ne s'y oppose. On stocke le SHA-256 de l'adresse
-- destinataire à l'émission, et le service le compare au moment de signer.
-- Jamais l'adresse en clair : la colonne survit cinq ans.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "emargement_tokens"
  ADD COLUMN "coaching_role" "coaching_signataire_role",
  ADD COLUMN "destinataire_email_sha256" VARCHAR(64);

-- Cohérence contexte ↔ rôle. Le CHECK collectif `ck_emargement_token_contexte`
-- ignore la nouvelle colonne : sans celui-ci, un jeton `collectif` pourrait
-- porter un rôle AFEST, et un jeton AFEST n'en porter aucun — auquel cas la
-- garde d'autorisation porteur↔rôle n'aurait aucune source fiable.
ALTER TABLE "emargement_tokens"
  ADD CONSTRAINT "ck_emargement_token_coaching_role"
  CHECK (
       ("contexte_type" = 'afest_1to1' AND "coaching_role" IS NOT NULL)
    OR ("contexte_type" <> 'afest_1to1' AND "coaching_role" IS NULL)
  );

-- Un seul lien vivant PAR (parcours, rôle) — et non par parcours. Deux liens
-- distincts doivent pouvoir coexister : le bénéficiaire à distance et le tuteur
-- entreprise. `coaching_role` étant NOT NULL en contexte AFEST (CHECK
-- ci-dessus), `NULLS NOT DISTINCT` est inutile ici.
CREATE UNIQUE INDEX "emargement_token_coaching_role_actif"
  ON "emargement_tokens" ("coaching_id", "coaching_role")
  WHERE "revoked_at" IS NULL AND "coaching_id" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- La table
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "coaching_seance_signatures" (
    "id" UUID NOT NULL,
    -- Grain réel de la preuve : UNE séance.
    "compte_rendu_seance_id" UUID NOT NULL,
    -- Portée de la CHAÎNE, dénormalisée. Cohérence garantie par la FK composite.
    "coaching_id" UUID NOT NULL,
    "role" "coaching_signataire_role" NOT NULL,

    -- ── SNAPSHOT — ce qui a été signé, figé au moment de la signature ──
    -- Jour civil PARIS de la séance. `@db.Date`, écrit exclusivement via
    -- `new Date(\`${jourParis}T00:00:00.000Z\`)` : Prisma rend une colonne DATE
    -- à minuit UTC, et `seance-reconstruction.ts` REFUSE toute date non alignée.
    "seance_date" DATE NOT NULL,
    -- Affichage uniquement — volontairement HORS du tuple haché : elle est
    -- redondante avec (heure_debut, heure_fin) et une contradiction figée entre
    -- les deux serait indétectable.
    "duree_minutes" INTEGER NOT NULL,
    -- Horaires RÉELS `HH:MM`, dérivés de `date_seance` + `duree_minutes` en
    -- heure de Paris. NOT NULL : sans horaires, la feuille est insuffisamment
    -- probante (CAA Nantes 20/04/2021). Le service REFUSE de signer une séance
    -- sans durée plutôt que d'inventer un « 09h00–17h00 ».
    "heure_debut" VARCHAR(5) NOT NULL,
    "heure_fin" VARCHAR(5) NOT NULL,
    "formation_intitule" VARCHAR(300) NOT NULL,
    -- ⚠️ PAS de `@default` : colonne hachée. Un défaut transformerait un oubli
    -- d'insertion en `[]` silencieux, et `self_hash` ne correspondrait plus à
    -- son contenu — sur une table append-only, donc non corrigeable.
    "modules_snapshot" JSONB NOT NULL,
    -- Nom du formateur FIGÉ (CAA Nantes 19NT01974 : son absence de la feuille
    -- est à elle seule un motif de redressement).
    "formateur_nom" VARCHAR(200) NOT NULL,

    -- ── Signataire, figé : un UUID n'identifie personne devant un juge ──
    "signataire_nom" VARCHAR(200) NOT NULL,
    -- Nullable : le tuteur entreprise est un tiers externe, sans compte.
    "signataire_email" VARCHAR(255),

    -- ── Attestation du recueil ──
    -- Méthode A : le signataire signe sur le poste du formateur, et c'est le
    -- formateur qui porte l'identification — comme une feuille papier qu'il
    -- fait circuler. Une ligne qui ne dirait pas QUI atteste ne prouverait rien.
    "recueilli_par_trainer_id" UUID,
    -- Méthode B : lien propre, à distance.
    "token_id" UUID,
    "methode" "coaching_signature_methode" NOT NULL,

    -- ── Image ──
    "signature_key" TEXT,
    -- SHA-256 de l'IMAGE, jamais de sa clé R2 : un objet de stockage est
    -- remplaçable sans que la base bouge.
    "signature_sha256" VARCHAR(64),
    "mime_type" VARCHAR(60),
    "size_bytes" INTEGER,

    -- ── Horodatage ──
    "signe_at" TIMESTAMP(3) NOT NULL,
    -- ⚠️ DISTINCT de `signe_at` : l'écart entre les deux révèle une insertion
    -- tardive. Les confondre priverait du seul signal disponible. C'est aussi
    -- `created_at` qui ORDONNE la chaîne — jamais `signe_at`.
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ── Preuve de requête. NON scellées (hors tuple) : effaçables au titre de
    -- l'art. 17 RGPD sans invalider une seule empreinte. ──
    "ip_hash" VARCHAR(64),
    "user_agent_sha256" VARCHAR(64),

    -- ── Crypto ──
    "prev_hash" VARCHAR(64),
    "self_hash" VARCHAR(64) NOT NULL,
    -- Version DU TUPLE AFEST (`HASH_VERSION_SEANCE`), indépendante de celle du
    -- collectif : un bump ici ne doit pas toucher les empreintes collectives.
    "hash_version" INTEGER NOT NULL DEFAULT 1,
    -- Version du texte présenté au signataire (`MENTION_VERSION_AFEST`).
    -- SCELLÉE : prouver qu'une personne a signé suppose de dire CE QU'ELLE A
    -- SIGNÉ — point juridique central pour le tuteur, tiers non contractant.
    "mention_version" VARCHAR(20) NOT NULL,

    -- ── RGPD : seule l'IMAGE se détruit. La ligne de preuve survit. ──
    "suppression_prevue_at" TIMESTAMP(3),
    "image_purgee_at" TIMESTAMP(3),

    -- ── Révocation (append-only : on ne corrige jamais en écrasant) ──
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" UUID,
    "revoked_motif" TEXT,

    CONSTRAINT "coaching_seance_signatures_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
-- 🔴 FK COMPOSITE DE COHÉRENCE : le compte-rendu DOIT appartenir au parcours
-- scellé. C'est ce qui rend l'anti-réattribution de chaîne structurel.
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "css_cr_coaching_coherent_fkey"
  FOREIGN KEY ("compte_rendu_seance_id", "coaching_id")
  REFERENCES "coaching_comptes_rendus" ("id", "coaching_session_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "coaching_seance_signatures_recueilli_par_trainer_id_fkey"
  FOREIGN KEY ("recueilli_par_trainer_id") REFERENCES "trainers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "coaching_seance_signatures_token_id_fkey"
  FOREIGN KEY ("token_id") REFERENCES "emargement_tokens"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contraintes NON exprimables dans `schema.prisma`
-- ─────────────────────────────────────────────────────────────────────────────

-- Horaires RÉELS au format HH:MM.
-- ⚠️ La borne est EXPLICITE : le motif `[0-2][0-9]` du premier jet acceptait
-- « 25:30 » et « 29:00 ». Ces chaînes finissent sur une pièce probante, et sont
-- SCELLÉES dans `self_hash` : une seule passée en base y reste pour cinq ans.
-- La comparaison lexicographique sur du HH:MM zéro-paddé EST l'ordre chronologique.
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "ck_coaching_seance_signature_horaires"
  CHECK (
    "heure_debut" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "heure_fin" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "heure_fin" > "heure_debut"
  );

-- Une image sans son empreinte est indétectablement substituable sur R2 : le
-- hash porte sur l'IMAGE, pas sur la clé de stockage. `confirmation_accessible`
-- n'a pas d'image du tout, d'où la branche NULL.
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "ck_coaching_seance_signature_image_hashee"
  CHECK ("signature_key" IS NULL OR "signature_sha256" IS NOT NULL);

-- `modules_snapshot` est un tableau d'intitulés, jamais un objet ni un scalaire :
-- le tuple canonique et le PDF itèrent dessus sans vérifier.
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "ck_coaching_seance_signature_modules_tableau"
  CHECK (jsonb_typeof("modules_snapshot") = 'array');

-- Une durée nulle ou négative ne produit aucun horaire de fin exploitable, et
-- la signature n'attesterait alors la présence à rien.
ALTER TABLE "coaching_seance_signatures"
  ADD CONSTRAINT "ck_coaching_seance_signature_duree_positive"
  CHECK ("duree_minutes" > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index UNIQUE PARTIELS — l'unicité ne vaut que sur les lignes NON révoquées.
-- C'est ce qui rend une correction possible : révoquer, puis re-signer.
-- ─────────────────────────────────────────────────────────────────────────────

-- Une seule signature active par (séance, rôle). 3 rôles × N séances.
CREATE UNIQUE INDEX "coaching_seance_signature_active"
  ON "coaching_seance_signatures" ("compte_rendu_seance_id", "role")
  WHERE "revoked_at" IS NULL;

-- 🔴 GARDE-FOU ANTI-FORK DE CHAÎNE.
--
-- Le chaînage ne détecte une insertion ou une suppression que si la chaîne est
-- LINÉAIRE. Deux signatures concurrentes du MÊME rôle sur le MÊME parcours qui
-- liraient le même `prev_hash` avant que l'autre n'ait commité produiraient
-- deux successeurs du même maillon : la chaîne fourche, et une branche entière
-- devient supprimable sans que la vérification n'y voie rien.
--
-- `NULLS NOT DISTINCT` est INDISPENSABLE (PG >= 15 ; prod 16.13) : sans lui,
-- deux « premières » signatures d'un même (parcours, rôle) — toutes deux à
-- `prev_hash IS NULL` — passeraient, PostgreSQL considérant par défaut deux
-- NULL comme distincts. C'est précisément le trou que l'index collectif
-- `emargement_signature_chaine_lineaire` ne couvre pas ici, étant restreint à
-- `WHERE enrollment_id IS NOT NULL`.
CREATE UNIQUE INDEX "coaching_seance_signature_chaine_lineaire"
  ON "coaching_seance_signatures" ("coaching_id", "role", "prev_hash") NULLS NOT DISTINCT
  WHERE "revoked_at" IS NULL;

-- Relecture d'une chaîne : toutes les signatures d'un (parcours, rôle) dans
-- l'ordre d'INSERTION. ⚠️ `created_at`, jamais `signe_at` — ce dernier est figé
-- AVANT l'écriture de l'image sur R2, et deux signatures peuvent donc commiter
-- dans l'ordre inverse de leurs `signe_at`. Trier dessus produirait un verdict
-- « chaîne corrompue » faux et définitif, la table étant append-only.
CREATE INDEX "coaching_seance_signatures_coaching_id_role_created_at_idx"
  ON "coaching_seance_signatures" ("coaching_id", "role", "created_at");

-- CreateIndex
CREATE INDEX "coaching_seance_signatures_compte_rendu_seance_id_idx"
  ON "coaching_seance_signatures" ("compte_rendu_seance_id");

-- CreateIndex
CREATE INDEX "coaching_seance_signatures_token_id_idx"
  ON "coaching_seance_signatures" ("token_id");

-- CreateIndex
CREATE INDEX "coaching_seance_signatures_recueilli_par_trainer_id_idx"
  ON "coaching_seance_signatures" ("recueilli_par_trainer_id");
