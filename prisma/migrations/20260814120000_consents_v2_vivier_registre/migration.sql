-- Lot L4 (2026-08-14) — CONSENTEMENTS v2, mécanique VIVIER et REGISTRE DE PREUVE.
--
-- MIGRATION PUREMENT ADDITIVE : quatre colonnes NULLABLES sur une table
-- existante (aucune réécriture de table : `ADD COLUMN ... NULL` sans DEFAULT
-- est une opération de catalogue en PostgreSQL 11+, instantanée même sur les
-- 71 lignes de `job_applications` — et le resterait à 100 000) et une table
-- neuve. Aucune donnée existante n'est lue, modifiée ni supprimée.
--
-- ── Pourquoi `consent_vivier_at` ne peut PAS se déduire de l'existant ────────
-- `job_applications.consent_version` atteste du consentement à l'ÉTUDE de la
-- candidature — obligatoire, donc présent sur les 71 fiches du stock. L'accord
-- de CONSERVATION EN VIVIER est une finalité DISTINCTE (doctrine CNIL
-- « CVthèque ») que personne n'a encore donné : la colonne naît donc à NULL
-- partout, et c'est la vérité juridique, pas une lacune à combler.
-- ⚠️ Ne JAMAIS « backfiller » cette colonne depuis `consent_version` : ce
-- serait fabriquer un consentement qui n'a jamais été recueilli.
--
-- ── Les trois horodatages du stock ──────────────────────────────────────────
-- Ils portent trois FAITS distincts, et aucun ne se déduit d'un autre :
--   · `vivier_info_sent_at` : l'email d'information est parti (départ de
--     l'horloge d'opposition de 30 jours) ;
--   · `vivier_opposed_at`   : la personne s'est opposée (un clic, sans login) ;
--   · `vivier_synced_at`    : la fiche a été intégrée au vivier CRM — c'est ce
--     marqueur qui rend le job quotidien IDEMPOTENT (rejouable sans doublon).
--
-- INERTIE : tant que `VIVIER_STOCK_ENABLED` et `CRM_SYNC_CANDIDATES_ENABLED`
-- ne sont pas à "true", ces quatre colonnes restent NULL partout — aucun chemin
-- de code ne les écrit. L'inertie est donc vérifiable en base.

ALTER TABLE "job_applications"
    ADD COLUMN "consent_vivier_at"   TIMESTAMP(3),
    ADD COLUMN "vivier_info_sent_at" TIMESTAMP(3),
    ADD COLUMN "vivier_opposed_at"   TIMESTAMP(3),
    ADD COLUMN "vivier_synced_at"    TIMESTAMP(3);

-- L'index qui porte le job quotidien J+30 (« informées, non opposées, pas
-- encore intégrées »). Sans lui, le passage quotidien ferait un balayage
-- complet de la table.
CREATE INDEX "job_applications_vivier_info_sent_at_vivier_opposed_at_vivi_idx"
    ON "job_applications"("vivier_info_sent_at", "vivier_opposed_at", "vivier_synced_at");

-- ── REGISTRE DE PREUVE DES CONSENTEMENTS (plan §2.8.1) ──────────────────────
--
-- Avant cette table, la preuve était éclatée (`details.consentVersion` en JSON,
-- colonnes diverses) et carrément ABSENTE pour la newsletter. Elle est ici
-- APPEND-ONLY : un retrait n'efface pas l'accord, il ajoute une ligne `optout`.
-- L'historique EST la preuve — le réécrire la détruirait.
--
-- Elle ne porte AUCUNE adresse en clair, seulement `person_key`
-- (= `hashEmailForLookup(email)`) : un registre de preuve RGPD qui serait
-- lui-même un annuaire d'emails serait une régression, pas une garantie.

CREATE TABLE "consent_events" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "person_key"      VARCHAR(64)  NOT NULL,
    -- Point de capture : sans lui, deux consentements de finalités
    -- différentes seraient indiscernables.
    "form_ref"        VARCHAR(64)  NOT NULL,
    -- Version EXACTE du texte affiché — c'est elle qui permet de reconstituer
    -- ce que la personne a réellement lu.
    "consent_version" VARCHAR(64)  NOT NULL,
    -- 'optin' | 'optout'
    "action"          VARCHAR(16)  NOT NULL,
    -- Quand le consentement a été DONNÉ (≠ `created_at`, quand la ligne a été
    -- écrite) : un enregistrement différé ne doit pas décaler la preuve.
    "occurred_at"     TIMESTAMP(3) NOT NULL,
    "ip_hash"         VARCHAR(64),
    "user_agent"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- « Tout l'historique de consentement de cette personne, du plus récent au plus
-- ancien » : la requête de l'art. 15 et celle d'un contrôle CNIL.
CREATE INDEX "consent_events_person_key_occurred_at_idx"
    ON "consent_events"("person_key", "occurred_at" DESC);
