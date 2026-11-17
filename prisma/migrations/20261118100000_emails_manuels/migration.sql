-- I4 : e-mails écrits à la main depuis une fiche (emails_manuels) et leurs pièces jointes.
-- ADDITIVE : deux tables neuves. Aucune colonne existante modifiée ni supprimée,
-- aucun UPDATE / DELETE / INSERT. Les clés étrangères pointent VERS des tables
-- existantes (clients, client_contacts, admin_users) sans les modifier.
-- Le worker ne lit ces tables qu'à réception d'un job « email-manuel », que seule
-- l'application à jour émet, derrière EMAIL_MANUEL_ACTIF.
-- Retour arrière : rollback.sql (mise de côté dans le schéma "retrait", AUCUN DROP).
CREATE TABLE "emails_manuels" (
    "id" UUID NOT NULL,
    "cle_idempotence" VARCHAR(64) NOT NULL,
    "entite_type" VARCHAR(30) NOT NULL,
    "entite_id" VARCHAR(64) NOT NULL,
    "client_id" UUID,
    "contact_id" UUID,
    "destinataire_chiffre" TEXT NOT NULL,
    "destinataire_hash" VARCHAR(64) NOT NULL,
    "destinataire_nom" VARCHAR(200),
    "expediteur_nom" VARCHAR(80) NOT NULL,
    "objet" VARCHAR(500) NOT NULL,
    "corps_source" TEXT NOT NULL,
    "corps_html" TEXT,
    "corps_texte" TEXT,
    "tutoiement" BOOLEAN NOT NULL DEFAULT false,
    "premier_contact" BOOLEAN NOT NULL DEFAULT false,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "motif" TEXT,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "message_id" VARCHAR(300),
    "id_relais" VARCHAR(500),
    "in_reply_to" VARCHAR(300),
    "references_entete" TEXT,
    "ecrit_par_id" UUID,
    "ecrit_par_nom" VARCHAR(255) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mis_en_file_le" TIMESTAMPTZ(3),
    "envoye_le" TIMESTAMPTZ(3),
    "echec_le" TIMESTAMPTZ(3),
    "rebondi_le" TIMESTAMPTZ(3),
    "rebond_type" VARCHAR(10),
    CONSTRAINT "emails_manuels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "emails_manuels_entite_type_valeur" CHECK ("entite_type" IN
      ('Client','ClientContact','CalendlyEvent','ApporteurReseau','Trainer','Trainee')),
    CONSTRAINT "emails_manuels_statut_valeur" CHECK ("statut" IN
      ('brouillon','en_file','envoye','echec','retenu','rebondi')),
    CONSTRAINT "emails_manuels_hash_forme" CHECK ("destinataire_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "emails_manuels_rebond_type_valeur" CHECK ("rebond_type" IS NULL OR "rebond_type" IN ('hard','soft')),
    CONSTRAINT "emails_manuels_rendu_si_parti" CHECK ("statut" = 'brouillon' OR "corps_html" IS NOT NULL)
);
CREATE UNIQUE INDEX "emails_manuels_cle_idempotence_key" ON "emails_manuels"("cle_idempotence");
CREATE UNIQUE INDEX "emails_manuels_message_id_key" ON "emails_manuels"("message_id");
CREATE INDEX "emails_manuels_entite_idx" ON "emails_manuels"("entite_type", "entite_id", "cree_le" DESC);
CREATE INDEX "emails_manuels_client_idx" ON "emails_manuels"("client_id", "cree_le" DESC);
CREATE INDEX "emails_manuels_destinataire_hash_idx" ON "emails_manuels"("destinataire_hash");
CREATE INDEX "emails_manuels_statut_idx" ON "emails_manuels"("statut");
ALTER TABLE "emails_manuels" ADD CONSTRAINT "emails_manuels_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emails_manuels" ADD CONSTRAINT "emails_manuels_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "client_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emails_manuels" ADD CONSTRAINT "emails_manuels_ecrit_par_id_fkey"
  FOREIGN KEY ("ecrit_par_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "emails_manuels_pieces_jointes" (
    "id" UUID NOT NULL,
    "email_manuel_id" UUID NOT NULL,
    "nom_fichier" VARCHAR(160) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "cle_stockage" VARCHAR(300) NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'attendue',
    "motif_refus" VARCHAR(20),
    "sha256" CHAR(64),
    "antivirus" VARCHAR(20),
    "jeton_hash" CHAR(64),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emails_manuels_pieces_jointes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "emails_manuels_pj_taille_bornes" CHECK ("taille_octets" > 0 AND "taille_octets" <= 10485760),
    CONSTRAINT "emails_manuels_pj_statut_valeur" CHECK ("statut" IN
      ('attendue','controle','acceptee','refusee','non_recue'))
);
CREATE UNIQUE INDEX "emails_manuels_pieces_jointes_cle_stockage_key" ON "emails_manuels_pieces_jointes"("cle_stockage");
CREATE INDEX "emails_manuels_pieces_jointes_email_idx" ON "emails_manuels_pieces_jointes"("email_manuel_id");
ALTER TABLE "emails_manuels_pieces_jointes" ADD CONSTRAINT "emails_manuels_pieces_jointes_email_manuel_id_fkey"
  FOREIGN KEY ("email_manuel_id") REFERENCES "emails_manuels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
