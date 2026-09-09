-- Rattrapage des lignes laissées en attente par une annulation.
--
-- On ne devine pas : on nomme. Les seules lignes concernées sont les relances
-- apporteur encore `pending` dont le job a disparu de la file — c'est-à-dire
-- celles dont l'annulation a réussi sans que le journal soit refermé.
--
-- Le critère est l'ÉCHÉANCE DÉPASSÉE : une relance dont la date est passée et
-- qui n'est toujours pas partie n'a plus de job derrière elle. Une relance à
-- venir, elle, est encore en file et ne doit pas être touchée. C'est le même
-- raisonnement que la surveillance, appliqué une fois, à la main.
--
-- Vérifié en production avant écriture : 4 lignes `pending`, 2 jobs vivants
-- dans `bull:emails:delayed` (les deux échéances futures). Les 2 restantes,
-- échues, n'avaient plus de job.

UPDATE "email_logs"
   SET "status" = 'cancelled',
       "error"  = 'Relance annulée : le dossier complet est arrivé avant l''échéance. Job retiré de la file ; ligne refermée par la migration 20260909170000.'
 WHERE "status" = 'pending'
   AND "template" = 'lead-apporteur-relance'
   AND "due_at" IS NOT NULL
   AND "due_at" < now();
