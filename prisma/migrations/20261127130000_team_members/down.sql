-- Retour arrière de 20261127130000_team_members. À n'utiliser QUE tant que les quatre tables sont vides.
-- Dès qu'une fiche existe, on revient par le code (revert) et les tables restent : additives, sans effet.
-- Le script s'arrête (exception) si l'une des tables contient une ligne.
-- Après exécution, supprimer aussi la ligne correspondante de `_prisma_migrations` pour pouvoir rejouer migrate deploy.

DO $$
BEGIN
  IF (SELECT count(*) FROM "team_member_events") > 0
     OR (SELECT count(*) FROM "team_questionnaire_submissions") > 0
     OR (SELECT count(*) FROM "team_questionnaire_invites") > 0
     OR (SELECT count(*) FROM "team_members") > 0 THEN
    RAISE EXCEPTION 'down.sql interrompu : les tables team_* ne sont pas vides';
  END IF;
  -- Le contrôle et les suppressions sont dans le même bloc : rien n'est supprimé si le contrôle échoue,
  -- même exécuté sans ON_ERROR_STOP.
  DROP TABLE "team_member_events";
  DROP TABLE "team_questionnaire_submissions";
  DROP TABLE "team_questionnaire_invites";
  DROP TABLE "team_members";
END $$;
