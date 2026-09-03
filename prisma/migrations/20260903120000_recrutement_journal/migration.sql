-- Lot 1 — LE JOURNAL DU CANDIDAT ET LES RÉPONSES DEPUIS LA CONSOLE (2026-09-03)
--
-- Le défaut fermé : écrire à un candidat imposait de sortir sur une boîte mail,
-- et il ne restait AUCUNE trace côté produit de ce qui avait été dit, quand, ni
-- par qui. `job_applications.internal_notes` n'y suppléait pas — une zone de
-- texte unique, écrasée à chaque enregistrement. Un post-it, pas un journal.
--
-- Le mécanisme existait déjà pour les MESSAGES (`submission_replies`). Il est
-- repris ici avec UN ÉCART, sur `to_email` : voir le commentaire de colonne.
--
-- Additif : aucune ligne existante n'est touchée, aucune colonne n'est modifiée.

CREATE TYPE "job_application_event_type" AS ENUM (
  'statut_change',
  'email_envoye',
  'email_recu',
  'appel',
  'note',
  'entretien_planifie',
  'entretien_tenu',
  'piece_recue',
  'vivier_info',
  'vivier_opposition',
  'decision'
);

CREATE TYPE "job_application_reply_status" AS ENUM ('pending', 'sent', 'failed', 'bounced');

-- ── Le journal ──────────────────────────────────────────────────────────────

CREATE TABLE "job_application_events" (
  "id"             UUID                        NOT NULL,
  "application_id" UUID                        NOT NULL,
  "type"           "job_application_event_type" NOT NULL,
  "author_id"      UUID,
  "author_name"    VARCHAR(255)                NOT NULL,
  "occurred_at"    TIMESTAMP(3)                NOT NULL,
  "created_at"     TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary"        VARCHAR(300)                NOT NULL,
  "body"           TEXT,
  "reply_id"       TEXT,
  "interview_id"   UUID,
  "meta"           JSONB,

  CONSTRAINT "job_application_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_application_events_application_id_occurred_at_idx"
  ON "job_application_events" ("application_id", "occurred_at");

CREATE INDEX "job_application_events_type_occurred_at_idx"
  ON "job_application_events" ("type", "occurred_at");

ALTER TABLE "job_application_events"
  ADD CONSTRAINT "job_application_events_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_application_events"
  ADD CONSTRAINT "job_application_events_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "job_application_events" IS
  'Journal d''une candidature — EN AJOUT SEUL. Aucune action du produit ne doit modifier ni supprimer une ligne d''ici, hors cascade d''effacement : un journal qu''on peut réécrire ne prouve pas qui a écrit quoi à un candidat.';

COMMENT ON COLUMN "job_application_events"."occurred_at" IS
  'Quand le FAIT a eu lieu, distinct de created_at qui dit quand on l''a écrit. Un appel passé lundi et consigné mardi se lit à lundi — sinon la frise raconte l''ordre de la saisie, pas celui des faits.';

COMMENT ON COLUMN "job_application_events"."author_name" IS
  'Instantané du nom au moment du geste. N''est PAS dérivable de author_id : le compte peut être supprimé (la FK passe à NULL) et le journal doit continuer de dire QUI a agi.';

COMMENT ON COLUMN "job_application_events"."reply_id" IS
  'Référence, JAMAIS une clé étrangère : un événement doit survivre à la suppression de ce qu''il mentionne, sinon le journal se troue au premier nettoyage.';

-- ── Les réponses ────────────────────────────────────────────────────────────

CREATE TABLE "job_application_replies" (
  "id"                  TEXT                          NOT NULL,
  "application_id"      UUID                          NOT NULL,
  "replied_by_user_id"  UUID,
  "replied_by_name"     VARCHAR(255)                  NOT NULL,
  "replied_at"          TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "to_email"            TEXT                          NOT NULL,
  "subject"             VARCHAR(500)                  NOT NULL,
  "body_html"           TEXT                          NOT NULL,
  "body_text"           TEXT                          NOT NULL,
  "delivery_status"     "job_application_reply_status" NOT NULL DEFAULT 'pending',
  "provider_message_id" VARCHAR(500),
  "sent_at"             TIMESTAMP(3),
  "failed_at"           TIMESTAMP(3),
  "error_msg"           TEXT,
  "retry_count"         INTEGER                       NOT NULL DEFAULT 0,
  "modele_utilise"      VARCHAR(40),
  "internal_note"       TEXT,

  CONSTRAINT "job_application_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_application_replies_application_id_replied_at_idx"
  ON "job_application_replies" ("application_id", "replied_at");

CREATE INDEX "job_application_replies_delivery_status_idx"
  ON "job_application_replies" ("delivery_status");

ALTER TABLE "job_application_replies"
  ADD CONSTRAINT "job_application_replies_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_application_replies"
  ADD CONSTRAINT "job_application_replies_replied_by_user_id_fkey"
  FOREIGN KEY ("replied_by_user_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 🔴 L'ÉCART AVEC LE MODÈLE DONT CETTE TABLE EST LA COPIE.
--
-- `submission_replies.to_email` est un CITEXT EN CLAIR. Le recopier tel quel
-- déchiffrerait par la bande l'adresse du candidat, que `job_applications.email`
-- protège justement au repos : on aurait chiffré la porte et laissé la fenêtre
-- ouverte — exactement le défaut déjà corrigé sur l'ouverture des dossiers.
--
-- D'où le type TEXT (un ciphertext n'est pas une adresse) et l'impossibilité
-- assumée de toute égalité SQL dessus : la recherche passe par
-- `job_applications.email_hash`, comme partout ailleurs dans ce dépôt.
COMMENT ON COLUMN "job_application_replies"."to_email" IS
  'CHIFFRÉ (encryptPii), contrairement à submission_replies.to_email qui est en clair. Aucune égalité SQL possible : chercher par adresse passe par job_applications.email_hash.';

COMMENT ON TABLE "job_application_replies" IS
  'Réponses écrites À LA MAIN depuis la console, et leur sort à l''envoi. En cascade sur la candidature : un effacement RGPD doit emporter le corps des e-mails déjà rendus, qui portent le nom de la personne.';
