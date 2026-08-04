-- Annulation d'une pièce au registre + trace du remplacement côté pièce REMPLACÉE.
--
-- 🔴 Audit pré-visite Qualiopi 2026-08-04.
--
-- 1. ANNULATION. `AXI-DOC-2026-007` (lettre de mission) qualifie le dirigeant de
--    « mandataire sous-traitant » de sa propre société — vestige antérieur au
--    garde-fou `lettre-mission-statut`. La pièce est SIGNÉE : la supprimer
--    effacerait une signature réelle et laisserait un trou dans la série
--    documentaire (CGI, art. 242 nonies A ann. II). Une contradiction interne
--    est exactement ce qu'un auditeur relève ; une pièce annulée AVEC SON MOTIF
--    est au contraire une démonstration de maîtrise du processus.
--
-- 2. REMPLACEMENT. Le mécanisme de rectification introduit le 03/08 écrivait
--    `metadata.rectifie` sur la NOUVELLE pièce, et le commentaire du service
--    affirmait que « l'ancienne dit par quoi elle est remplacée » — ce qui
--    n'était écrit NULLE PART. Sans cette contre-trace, l'auditeur qui ouvre la
--    pièce périmée n'a aucun moyen de savoir qu'elle ne fait plus foi : il faut
--    déjà connaître la nouvelle pour apprendre que l'ancienne est morte.
--    La colonne ferme la boucle : chaque pièce dit son sort.

ALTER TABLE "documents_generes"
  ADD COLUMN "annulee_at" TIMESTAMP(3),
  ADD COLUMN "annulee_motif" TEXT,
  ADD COLUMN "annulee_par" TEXT,
  ADD COLUMN "remplacee_par_numero" VARCHAR(40);

-- Un motif est OBLIGATOIRE dès qu'une pièce est annulée : une annulation sans
-- raison écrite ne vaut pas mieux que la contradiction qu'elle est censée
-- lever. La contrainte porte sur le couple, pas sur chaque colonne, pour que
-- les lignes existantes (toutes NULL) restent valides.
ALTER TABLE "documents_generes"
  ADD CONSTRAINT "documents_generes_annulation_motif_check"
  CHECK (
    ("annulee_at" IS NULL AND "annulee_motif" IS NULL)
    OR ("annulee_at" IS NOT NULL AND "annulee_motif" IS NOT NULL AND length(btrim("annulee_motif")) >= 10)
  );

-- Le registre et le mode auditeur filtrent sur « pièces vivantes ».
-- ⚠️ Index PLEIN et non partiel, bien qu'un partiel serait plus économe :
-- `schema.prisma` ne sait pas exprimer un index partiel, et la divergence
-- ferait rougir le contrôle de dérive à chaque `prisma migrate diff`.
CREATE INDEX "documents_generes_annulee_at_idx" ON "documents_generes" ("annulee_at");
