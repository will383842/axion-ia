-- Lot OPCO, INT-T66-A — le mandat de l'entreprise pour agir auprès de son OPCO.
-- AJOUT SEUL, et seul dans son fichier : une valeur d'énumération ajoutée ne
-- peut pas être utilisée dans la même transaction (PG ≥ 12), et rien d'autre
-- n'a à l'accompagner.
--
-- Contrat app/worker (AGENTS.md) : le worker tourne du code plus récent que
-- l'app pendant ~50 min après chaque fusion, et c'est l'entrypoint de l'APP qui
-- joue cette migration. Aucun code n'émet encore `mandat_opco` : la valeur est
-- posée AVANT son premier usage, et `IF NOT EXISTS` rend le rejeu inoffensif.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'mandat_opco';
