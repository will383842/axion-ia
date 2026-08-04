-- Relances de questionnaires + enquête ENTREPRISE.
--
-- 🔴 Constaté sur le premier dossier réel (04/08/2026) : les questionnaires
-- partaient automatiquement (crons J+1 / J+30)… puis PLUS RIEN. Aucune relance,
-- aucun écran ne montrait qui n'avait pas répondu. Et l'avis de l'ENTREPRISE
-- cliente (2ᵉ source exigée par l'indicateur 30) n'avait aucun canal : il se
-- tapait à la main dans la console.
--
-- 1. RELANCES — deux colonnes de trace. Le compteur n'est pas un confort :
--    devant l'auditeur, la TRACE des relances est la preuve que le processus
--    de recueil existe. Une non-réponse d'un tiers n'est pas une faute de
--    l'organisme ; l'absence de tentative tracée, si.
--
-- 2. ENQUÊTE ENTREPRISE — nouveau type de questionnaire, envoyé au CONTACT
--    CLIENT (pas au stagiaire), répondu par une page publique à jeton, et
--    versé automatiquement au registre des appréciations en source
--    « entreprise » à la réponse.

ALTER TYPE "QuestionnaireType" ADD VALUE IF NOT EXISTS 'satisfaction_entreprise';

ALTER TABLE "questionnaires"
  ADD COLUMN "relance_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "derniere_relance_at" TIMESTAMP(3);
