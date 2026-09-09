-- Échéance d'envoi sur le journal d'e-mails.
--
-- ## Le défaut fermé
--
-- `verifierSanteEmails()` comptait comme « bloqué en file » toute ligne
-- `pending` créée il y a plus de 15 minutes (`AGE_BLOCAGE_MIN`). Un envoi
-- VOLONTAIREMENT différé — les relances apporteur à J+2 et J+7 — satisfait
-- cette condition dès la 16e minute, alors que rien n'est bloqué.
--
-- Le fichier portait déjà l'avertissement : « Les envois différés
-- volontairement au-delà de cette fenêtre déclencheraient un faux positif.
-- Aucun appelant n'en pose aujourd'hui de plus long ; si cela change, il
-- faudra porter la date d'échéance sur la ligne. » Les relances sont arrivées
-- ensuite ; la date n'a pas été portée. Elle l'est ici.
--
-- Conséquence observée le 2026-09-09 : une alerte CRITIQUE ouverte depuis le
-- 07/09, annonçant « AUCUN e-mail ne part — convocations comprises », alors
-- que 137 e-mails étaient partis sur 30 jours sans un seul échec.

ALTER TABLE "email_logs" ADD COLUMN "due_at" TIMESTAMP(3);

-- Rattrapage des lignes antérieures au champ.
--
-- On ne devine pas une échéance : on la RECONSTRUIT depuis la seule source qui
-- la porte encore, l'identifiant de job, dont la forme est fixée par
-- `jobIdRelance()` (`lead-apporteur-relance-{etape}-{hash}`) et les délais par
-- `RELANCES_LEAD_APPORTEUR` (j2 = 2 jours, j7 = 7 jours).
--
-- Restreint aux lignes ENCORE en attente : une ligne déjà close n'est plus lue
-- par la surveillance, la réécrire n'apporterait rien et toucherait de
-- l'historique.
UPDATE "email_logs"
   SET "due_at" = "created_at" + INTERVAL '2 days'
 WHERE "status" = 'pending'
   AND "job_id" LIKE 'lead-apporteur-relance-j2-%';

UPDATE "email_logs"
   SET "due_at" = "created_at" + INTERVAL '7 days'
 WHERE "status" = 'pending'
   AND "job_id" LIKE 'lead-apporteur-relance-j7-%';

-- La surveillance lit `status = 'pending'` puis borne sur l'échéance. L'index
-- existant sur `status` seul ramène déjà un ensemble minuscule (les lignes en
-- attente se comptent sur les doigts) ; on n'ajoute pas d'index composite pour
-- une table dont ce n'est pas le chemin chaud.
