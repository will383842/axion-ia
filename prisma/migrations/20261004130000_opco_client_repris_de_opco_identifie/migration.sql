-- Lot OPCO A7a — reprise de données : l'OPCO typé (`clients.opco`, né vide au
-- lot A1) reçoit l'OPCO que l'ancien texte libre (`clients.opco_identifie`)
-- désigne déjà, quand ce texte est EXACTEMENT l'un des 11 identifiants de l'enum
-- `Opco` (c'est ce qu'écrit l'inférence IDCC/NAF depuis toujours).
--
-- Idempotente : ne touche que les fiches dont l'OPCO typé est encore vide ; un
-- second passage ne trouve plus rien. Une saisie de l'OPCO typé n'est jamais
-- écrasée. Aucun autre champ modifié, aucun texte libre non reconnu interprété :
-- ceux-là restent à la suggestion de la console (`opco-suggestion.ts`).
UPDATE "clients"
SET "opco" = "opco_identifie"::"Opco"
WHERE "opco" IS NULL
  AND "opco_identifie" IN (
    'atlas', 'opco_ep', 'akto', 'opco2i', 'mobilites', 'afdas',
    'uniformation', 'ocapiat', 'constructys', 'opcommerce', 'opco_sante'
  );
