-- Invitations au questionnaire des collaborateurs : de quoi renvoyer et tracer l'envoi.
-- ADDITIVE : quatre colonnes nullables ou à valeur par défaut, aucune donnée touchée.
ALTER TABLE "team_questionnaire_invites" ADD COLUMN "contact_email_enc" TEXT;
ALTER TABLE "team_questionnaire_invites" ADD COLUMN "first_name" VARCHAR(80);
ALTER TABLE "team_questionnaire_invites" ADD COLUMN "source" VARCHAR(30);
ALTER TABLE "team_questionnaire_invites" ADD COLUMN "sent_at" TIMESTAMPTZ(3);
