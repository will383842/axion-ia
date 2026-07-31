-- QUALIOPI — Socle de preuve de SIGNATURE au grain DOCUMENT.
--
-- ## Le problème que cette migration ferme
--
-- Le dépôt porte aujourd'hui TROIS registres de preuve qui s'ignorent :
--
--   · `emargement_signatures` + `emargement_contresignatures` — chaîne de
--     hachage complète, mais rattachées à `enrollment_id` : elles ne savent
--     répondre que pour l'émargement collectif ;
--   · `contract_documents` — `provider` / `status` / `signed_at`, mais rattaché
--     à `booking_id`, PAS à la pièce numérotée ;
--   · `documents_generes` — les 26 types Qualiopi, numéro immuable, empreinte,
--     rétention 5 ans, et AUCUNE colonne de signature.
--
-- Conséquence : à la question « cette convention est-elle signée, par qui, et où
-- est l'exemplaire ? », aucun des trois ne sait répondre seul. Trois registres
-- de preuve concurrents, c'est exactement ce qu'un auditeur Qualiopi relève.
--
-- ## Deux tables, UNE doctrine — et pourquoi pas une seule table
--
-- `document_signatures` est au grain DOCUMENT (une pièce, N parties).
-- `coaching_seance_signatures` est au grain SÉANCE × RÔLE (N séances, 3 rôles,
-- une chaîne par rôle courant sur tout le parcours). Les loger ensemble
-- reproduirait une erreur que ce dépôt a DÉJÀ commise : la contresignature a
-- reçu sa propre table précisément pour ce motif (« loger la contresignature
-- avec les signatures stagiaires était l'erreur de conception v2 »).
--
-- Les trois familles partagent le même CŒUR CRYPTO, réutilisé sans
-- modification : `canonicalJson`, `verifierChaine` + `MaillonChaine`,
-- `storage.ts`. Chacune a SON tuple, SA `hash_version` et SA `mention_version`.
--
-- 🔴 INTERDIT ABSOLU, et un test de non-régression échoue si on y touche :
-- muter `versCanonicalV1` ou bumper `MENTION_VERSION` — elles sont PARTAGÉES et
-- consommées par le flux collectif vivant en production.
--
-- ## Migration 100 % ADDITIVE — aucun DROP
--
-- Rien n'est supprimé, rien n'est recréé. `contract_documents` reste en place et
-- continue de fonctionner : sa reprise éventuelle est une décision produit, pas
-- une conséquence mécanique de cette migration.
--
-- ## Doctrine reprise à l'identique du collectif
--
-- · SNAPSHOT — `document_numero`, `document_type`, `document_hash_sha256`,
--   `signataire_nom/email/qualite` ne sont PAS de la dénormalisation de confort.
--   Elles sont la condition pour que `self_hash` reste RECALCULABLE. Les
--   reconstruire par jointure serait pire que de ne rien avoir : renuméroter ou
--   régénérer une pièce invaliderait rétroactivement, et EN SILENCE, toutes les
--   empreintes déjà émises.
-- · APPEND-ONLY — aucun `updated_at`. Une correction passe par révocation puis
--   nouvelle signature. Les index uniques sont PARTIELS (`WHERE revoked_at IS
--   NULL`) précisément pour rendre cette correction possible.
-- · `ON DELETE RESTRICT` explicite : une preuve légale ne disparaît jamais en
--   cascade. ⚠️ Conséquence assumée — un `documents_generes` portant une
--   signature non révoquée devient NON SUPPRIMABLE. C'est voulu.
-- · AUCUN `DEFAULT` sur une colonne HACHÉE. Un défaut transforme un oubli
--   d'insertion en valeur silencieuse, et le `self_hash` cesse de correspondre.
--   Seule `statut_signature`, qui est un statut DÉRIVÉ et n'entre dans aucun
--   tuple, porte un défaut.
--
-- ## Ce qui reste INERTE à la livraison
--
-- `documents_generes.statut_signature` naît à `non_requise` sur l'intégralité de
-- l'existant : aucune pièce n'exige de signature pour suivre son cours actuel.
-- Cette migration ne change strictement aucun comportement de production.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

-- ⚠️ PIÈGE POSTGRES, et il a déjà coûté des migrations ailleurs : une valeur
-- ajoutée par `ALTER TYPE ... ADD VALUE` n'est PAS utilisable dans la MÊME
-- transaction que son ajout. Cette migration ne l'utilise donc nulle part —
-- ni en `DEFAULT`, ni en `INSERT`, ni dans un `CHECK`. La colonne `provider`
-- ci-dessous est délibérément SANS défaut : elle est toujours écrite
-- explicitement, ce qui est de toute façon exigé (colonne hachée).
ALTER TYPE "SignatureProvider" ADD VALUE IF NOT EXISTS 'interne';

-- Statut DÉRIVÉ porté par la pièce. `partielle` existe parce que la convention
-- tripartite et le protocole AFEST ont trois signataires : sans lui, un dossier
-- à 2 signatures sur 3 serait indiscernable d'un dossier non signé.
CREATE TYPE "DocumentStatutSignature" AS ENUM (
  'non_requise',
  'en_attente',
  'partielle',
  'signee',
  'refusee',
  'expiree'
);

-- Modalité de RECUEIL de la signature.
--
-- 🔴 Ajoutée après coup, et le motif mérite d'être écrit : la première forme de
-- cette table n'en avait pas, et l'écriture du service a montré que sans elle,
-- rien ne distingue une confirmation accessible d'un tracé manuscrit. Or le plan
-- (II.2bis) pose les trois modes comme ÉGAUX en valeur probante, et le papier
-- comme un chemin de plein droit — pas un repli honteux.
--
-- HACHÉE, pour la raison exacte qui l'a fait hacher côté AFEST : sans elle, un
-- `UPDATE methode = 'trace'` transformerait après coup une confirmation
-- accessible en signature manuscrite. C'est une falsification de la NATURE de la
-- preuve, et elle serait indétectable.
--
-- ⚠️ Enum PROPRE, comme `EmargementMethode` et `coaching_signature_methode` le
-- sont l'une de l'autre. Partager un enum entre deux familles de preuve, c'est
-- s'interdire de faire évoluer l'une sans toucher à l'autre.
CREATE TYPE "DocumentSignatureMethode" AS ENUM (
  'trace',
  'papier_scanne',
  'confirmation_accessible'
);

-- La PARTIE qui signe, pas son identité. `axionia` est une partie comme une
-- autre : une convention non contresignée par l'organisme n'est pas conclue.
CREATE TYPE "DocumentPartieSignataire" AS ENUM (
  'client',
  'financeur',
  'formateur',
  'beneficiaire',
  'tuteur',
  'sous_traitant',
  'responsable_pedagogique',
  'axionia'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Statut dérivé sur la pièce
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "documents_generes"
  ADD COLUMN "statut_signature" "DocumentStatutSignature" NOT NULL DEFAULT 'non_requise';

COMMENT ON COLUMN "documents_generes"."statut_signature" IS
  'Statut DÉRIVÉ des lignes document_signatures. Cache de lecture : la source de vérité reste la table de signatures, jamais cette colonne.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registre de preuve
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "document_signatures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Rattachement à la pièce NUMÉROTÉE — c'est tout l'objet de cette table.
  "document_genere_id" UUID NOT NULL,

  "provider" "SignatureProvider" NOT NULL,
  -- NULL en canal maison ; identifiant de submission côté fournisseur sinon.
  "provider_submission_id" VARCHAR(120),

  "partie" "DocumentPartieSignataire" NOT NULL,

  -- Identité FIGÉE au moment de la signature. Le contact peut être renommé,
  -- réaffecté ou anonymisé ensuite : la preuve, elle, ne bouge plus.
  "signataire_nom" VARCHAR(200) NOT NULL,
  "signataire_email" VARCHAR(320),
  "signataire_qualite" VARCHAR(200),

  -- ── Modalité de recueil et exemplaire du tracé ──
  --
  -- Sans ces colonnes, le canal maison (phase 2, le tout prochain consommateur)
  -- n'a nulle part où ranger la signature qu'il vient de faire tracer, et la
  -- `SignatureZone` du PDF n'a rien à rendre. Les deux registres de présence
  -- existants les portent tous les deux ; ce registre-ci les avait perdues.
  --
  -- ⚠️ AUCUN `DEFAULT` sur `methode` : elle entre dans le tuple haché.
  "methode" "DocumentSignatureMethode" NOT NULL,
  -- Clé R2 de l'image rasterisée. NULL pour `confirmation_accessible` (pas
  -- d'image par construction), pour le papier non reversé, et APRÈS purge RGPD.
  -- HORS tuple : elle doit rester effaçable.
  "signature_key" TEXT,
  -- 🔴 SHA-256 de l'IMAGE elle-même, pas de sa clé. Seul moyen de détecter la
  -- substitution d'un objet de stockage sans toucher à la base. HACHÉ — et il
  -- SURVIT à la purge de l'image, sinon l'effacement RGPD rendrait
  -- `empreinte_invalide` sur des pièces intactes (le bug que le collectif a dû
  -- corriger, et que l'AFEST a refusé de reproduire).
  "signature_sha256" CHAR(64),
  "mime_type" VARCHAR(60),
  "size_bytes" INTEGER,
  -- Date de purge effective de l'IMAGE. La ligne de preuve, elle, survit.
  "image_purgee_at" TIMESTAMP(3),

  -- 🔴 L'empreinte du PDF EXACT qui a été signé.
  --
  -- C'est la colonne qui distingue « une signature existe » de « cette
  -- signature-ci porte sur CETTE pièce-là ». Sans elle, régénérer le PDF après
  -- coup — ce que `generateDocument` sait faire — produirait un document que
  -- plus rien ne relie à l'acte de signature.
  "document_hash_sha256" CHAR(64) NOT NULL,

  -- Chaînage. Même mécanique que l'émargement, tuple et version DÉDIÉS.
  "prev_hash" CHAR(64),
  "self_hash" CHAR(64) NOT NULL,
  "hash_version" INTEGER NOT NULL,

  -- Ce qui a été AFFICHÉ au signataire, et ce qu'il a accepté. Deux versions
  -- distinctes : le texte de la mention peut évoluer sans que le contenu du
  -- consentement change, et l'inverse.
  "mention_version" VARCHAR(20) NOT NULL,
  "consentement_version" VARCHAR(20) NOT NULL,

  -- 🔴 `signe_at` et `created_at` sont DISTINCTS, et c'est délibéré : l'écart
  -- entre les deux révèle une insertion tardive. Les confondre effacerait la
  -- seule trace d'une signature antidatée.
  "signe_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Jamais en clair. Hors du tuple haché, donc effaçables sur demande RGPD
  -- sans casser la preuve.
  "ip_hash" VARCHAR(64),
  "user_agent_sha256" CHAR(64),

  -- 🔴 QUI, dans l'organisme, a versé cette preuve au dossier.
  --
  -- Renseignée sur les canaux où l'organisme ATTESTE l'identité du signataire —
  -- le reversement d'une pièce signée à la main, notamment. NULL quand la
  -- personne a signé elle-même depuis son propre accès, ou quand un fournisseur
  -- tiers a certifié la signature.
  --
  -- Sans cette colonne, un reversement papier est ANONYME : « qui atteste que
  -- cette signature manuscrite est bien celle de M. Durand ? » n'aurait pas de
  -- réponse. C'est exactement l'objection que ce chantier oppose aux booléens
  -- posés au clic — la reproduire ici serait absurde. Les deux registres de
  -- présence portent déjà l'équivalent (`recueilli_par_trainer_id`).
  --
  -- HORS tuple : c'est de la provenance, pas le contenu de l'engagement.
  "recueilli_par_admin_id" UUID,

  -- Révocation, jamais suppression.
  "revoked_at" TIMESTAMP(3),
  "revoked_motif" VARCHAR(500),
  -- Qui a révoqué. Une révocation non imputée est une preuve retirée par
  -- personne — et le registre perdrait précisément ce que l'auditeur cherche.
  "revoked_by_id" UUID,

  -- Alignée sur `documents_generes.suppression_prevue_at` (rétention 5 ans).
  -- La LIGNE DE PREUVE survit à la purge de l'exemplaire, comme côté émargement.
  "suppression_prevue_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- Une preuve légale ne disparaît pas en cascade.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_document_genere_id_fkey"
  FOREIGN KEY ("document_genere_id") REFERENCES "documents_generes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RESTRICT sur les deux : supprimer un compte d'administration ne doit pas
-- effacer la trace de qui a versé ou retiré une preuve. Un compte se SUSPEND.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_recueilli_par_admin_id_fkey"
  FOREIGN KEY ("recueilli_par_admin_id") REFERENCES "admin_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_revoked_by_id_fkey"
  FOREIGN KEY ("revoked_by_id") REFERENCES "admin_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un motif de révocation vide est un motif absent : il ne dit rien à l'auditeur.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "ck_document_signature_revocation_motivee"
  CHECK ("revoked_at" IS NULL OR length(btrim("revoked_motif")) > 0);

-- Une identité vide produirait une signature anonyme — exactement le défaut que
-- ce chantier corrige côté AFEST. Le refus est structurel, pas applicatif.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "ck_document_signature_signataire_nomme"
  CHECK (length(btrim("signataire_nom")) > 0);

-- Le canal maison n'a pas de submission externe ; les canaux tiers en ont une.
-- Sans ce CHECK, une ligne `interne` portant un `provider_submission_id` laisse
-- croire à un certificat opposable qui n'existe pas.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "ck_document_signature_submission_par_canal"
  CHECK (
    ("provider" = 'docuseal' AND "provider_submission_id" IS NOT NULL)
    OR ("provider" <> 'docuseal' AND "provider_submission_id" IS NULL)
  );

-- 🔴 La modalité doit correspondre à ce qui existe RÉELLEMENT.
--
-- · `trace` sans image, c'est affirmer qu'une personne a tracé une signature que
--   personne ne pourra jamais produire ;
-- · `papier_scanne` sans image, c'est affirmer l'existence d'un scan qui n'a pas
--   été versé ;
-- · `confirmation_accessible` AVEC image, c'est présenter un tracé là où la
--   personne a précisément déclaré ne pas pouvoir en produire.
--
-- ⚠️ Conséquence ASSUMÉE : « signé sur papier, rangé dans un classeur, jamais
-- photographié » n'est PAS enregistrable. C'est voulu. Une ligne de preuve sans
-- image, sans certificat de tiers et sans confirmation nominative n'est adossée
-- à rien — c'est exactement la catégorie de signature que ce chantier retire.
-- Photographier la feuille (`papier_scanne`) coûte dix secondes.
--
-- ⚠️ Le CHECK porte sur `signature_sha256`, JAMAIS sur `signature_key` : la purge
-- RGPD met la clé à NULL, et un CHECK sur la clé transformerait un effacement
-- légitime en violation de contrainte.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "ck_document_signature_image_par_methode"
  CHECK (
    ("methode" = 'confirmation_accessible' AND "signature_sha256" IS NULL)
    OR ("methode" <> 'confirmation_accessible' AND "signature_sha256" IS NOT NULL)
  );

-- Une image purgée laisse forcément une trace de sa purge, et réciproquement :
-- sans cela, une clé effacée « par mégarde » serait indiscernable d'une purge
-- RGPD régulière, et le registre ne saurait plus dire ce qu'il a détruit.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "ck_document_signature_purge_tracee"
  CHECK ("image_purgee_at" IS NULL OR "signature_key" IS NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index
-- ─────────────────────────────────────────────────────────────────────────────

-- Une partie ne signe qu'UNE fois une pièce donnée. Partiel : après révocation,
-- elle doit pouvoir re-signer.
CREATE UNIQUE INDEX "document_signature_partie_active"
  ON "document_signatures" ("document_genere_id", "partie")
  WHERE "revoked_at" IS NULL;

-- 🔴 ANTI-FORK, et `NULLS NOT DISTINCT` n'est PAS un détail.
--
-- Deux signatures concurrentes sur une pièce vierge portent toutes deux
-- `prev_hash IS NULL`. Avec la sémantique SQL par défaut, deux NULL sont
-- DISTINCTS : l'index les accepterait toutes les deux, et la chaîne
-- FORKERAIT EN SILENCE — deux « premières » signatures, aucune erreur, une
-- vérification qui ne rendra jamais la vraie histoire du document.
CREATE UNIQUE INDEX "document_signature_chaine_anti_fork"
  ON "document_signatures" ("document_genere_id", "prev_hash")
  NULLS NOT DISTINCT
  WHERE "revoked_at" IS NULL;

-- Relecture de chaîne : tri sur `created_at` + `id`, JAMAIS sur `signe_at`.
-- `signe_at` peut être fourni par un tiers et n'est pas monotone ; l'ordre de la
-- chaîne est l'ordre d'INSERTION, seul ordre que le `prev_hash` reflète.
CREATE INDEX "document_signature_chaine_ordre"
  ON "document_signatures" ("document_genere_id", "created_at", "id");

-- Reprise du webhook : retrouver la ligne à partir de l'identifiant fournisseur.
CREATE INDEX "document_signature_provider_submission"
  ON "document_signatures" ("provider", "provider_submission_id")
  WHERE "provider_submission_id" IS NOT NULL;

-- Purge de rétention.
CREATE INDEX "document_signature_suppression_prevue"
  ON "document_signatures" ("suppression_prevue_at");

-- Registre / mode auditeur : lister les pièces par statut.
CREATE INDEX "documents_generes_statut_signature"
  ON "documents_generes" ("statut_signature")
  WHERE "statut_signature" <> 'non_requise';

COMMENT ON TABLE "document_signatures" IS
  'Registre de preuve de signature au grain DOCUMENT (canal maison ET tiers). Append-only, chaîné, révocable mais jamais supprimable. La preuve de PRÉSENCE vit dans emargement_signatures (collectif) et coaching_seance_signatures (AFEST).';
