-- Corbeille récupérable pour les messages (Submission) — 2026-07-10.
-- Soft-delete : deleted_at NULL = actif ; non-null = dans la corbeille
-- (restaurable OU purgeable via effacement RGPD). Additif, rétro-compatible.
ALTER TABLE "submissions" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Index pour masquer les soft-deleted par défaut + alimenter l'onglet Corbeille.
CREATE INDEX "submissions_deleted_at_idx" ON "submissions"("deleted_at");
