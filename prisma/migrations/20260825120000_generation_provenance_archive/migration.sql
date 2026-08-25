-- D6-4 (2026-08-25) — l'effacement RGPD art. 17 echouait sur ce qu'il existe
-- pour effacer.
--
-- `DELETE /api/admin/articles/[id]/forget` se declare, dans son propre en-tete,
-- « Suppression RGPD art. 17 d'un article genere par l'IA », et annonce
-- « GenerationProvenance -> CASCADE Prisma ». Le schema dit l'inverse :
-- `generation_provenance.article_id` est en ON DELETE RESTRICT.
--
-- Or TOUT article genere par l'IA porte au moins une ligne de provenance —
-- c'est la definition meme de la table (AI Act art. 50 : un enregistrement par
-- appel LLM). Le DELETE violait donc la cle etrangere, la transaction etait
-- annulee, et la route rendait HTTP 500 « Delete failed ». L'endpoint du droit
-- a l'effacement echouait precisement sur la classe d'articles pour laquelle il
-- a ete ecrit — et son journal d'audit RGPD DECLARAIT une cascade que Postgres
-- interdit, c'est-a-dire affirmait un effacement qui n'avait pas eu lieu.
--
-- Le RESTRICT n'est pas l'erreur : il a ete pose EXPRES par
-- `20260521150000_fix_provenance_cascade`, dont l'en-tete ecrit la consigne —
-- « la suppression doit passer par une procedure admin dediee qui ARCHIVE les
-- lignes provenance avant de supprimer l'article ». Cette procedure n'avait
-- jamais ete ecrite. Le seul contournement existant
-- (`scripts/delete-landing-ville-articles.ts:109`) SUPPRIME les lignes, donc
-- fait exactement ce que le RESTRICT interdisait.
--
-- Cette table est cette procedure.
--
-- POURQUOI SANS CLE ETRANGERE : une archive qui garderait la FK vers l'article
-- serait detruite par la meme suppression qu'elle est censee survivre.
-- `article_id` est un UUID NU — il conserve le rattachement pour un audit, sans
-- contrainte.
--
-- POURQUOI L'ARCHIVAGE SATISFAIT LES DEUX DROITS : cette table ne porte AUCUNE
-- donnee personnelle (fournisseur, modele, empreintes, comptes de jetons, cout,
-- horodatage). L'article est bien efface (art. 17) ; la preuve qu'il a ete
-- genere par une IA, et comment, est conservee (AI Act art. 50). Un cliquet
-- verifie cette premisse et rougira si une colonne personnelle apparait un jour
-- dans `generation_provenance` :
-- `src/app/api/admin/articles/[id]/forget/effacement-art17.spec.ts`.
--
-- Additive : aucune table existante n'est modifiee, aucune contrainte n'est
-- levee. Le RESTRICT reste en place et continue de proteger les traces.

CREATE TABLE IF NOT EXISTS "generation_provenance_archive" (
    "id" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "article_slug_snapshot" VARCHAR(255),
    "step" VARCHAR(80) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(40),
    "prompt_hash" VARCHAR(64) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL,
    "regulation_version" VARCHAR(40) NOT NULL DEFAULT 'AI-Act-2024/1689',
    "previous_hash" VARCHAR(64),
    "hash" VARCHAR(64) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_provenance_archive_pkey" PRIMARY KEY ("id")
);

-- Index sans CONCURRENTLY : interdit dans une migration Prisma, qui s'execute
-- dans une transaction (P3018 / E25001). La table est vide a la creation.
CREATE INDEX IF NOT EXISTS "generation_provenance_archive_article_id_idx"
    ON "generation_provenance_archive" ("article_id");

CREATE INDEX IF NOT EXISTS "generation_provenance_archive_archived_at_idx"
    ON "generation_provenance_archive" ("archived_at");
