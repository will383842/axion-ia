-- Audit Qualiopi E2E du 2026-08-19 — constats `D66-01` et `D66-05`.
--
-- `D66-01` : le bucket applicatif R2 — pièces légales (`documents/`), supports
-- pédagogiques (`supports/`) et images de signature (`emargement/`) — n'était
-- couvert par AUCUN composant de sauvegarde. Le bucket R2 est la DESTINATION des
-- sauvegardes, et il n'était lui-même sauvegardé par rien.
--
-- Le point décisif n'est pas l'absence du script : c'est que **rien ne pouvait
-- le signaler**. `src/server/backups/queries.ts` calcule le retard PAR
-- COMPOSANT ; un composant absent de l'énumération n'a ni run, ni retard, ni
-- alerte. Le tableau de bord était vert parce qu'il ne savait pas qu'il devait
-- regarder. D'où l'ordre du correctif : la valeur d'énumération d'ABORD, le
-- script ensuite — dès cette migration, l'absence de sauvegarde devient visible.
--
-- `D66-05` : `scripts/vps/run-files-backup.sh` rapportait sous
-- `files_image_bank` alors qu'il sauvegarde les CV candidats, `console-docs` et
-- `reviews-media`. Deux crons sous un même composant : la détection de retard
-- raisonnant sur le dernier run, le cron survivant masquait le cron mort — un
-- témoin positif qui masque un témoin négatif.
--
-- Postgres `ALTER TYPE ... ADD VALUE` — non transactionnel mais sûr : l'ajout
-- d'une valeur d'énumération est instantané, sans verrou long ni migration de
-- données. Même patron que `20260512100000_audit_flash_onsite_enum`.

ALTER TYPE "backup_component" ADD VALUE IF NOT EXISTS 'files_documents';
ALTER TYPE "backup_component" ADD VALUE IF NOT EXISTS 'files_utilisateurs';
