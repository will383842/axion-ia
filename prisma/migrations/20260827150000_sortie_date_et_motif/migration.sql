-- Sortie du dispositif : une DATE et un MOTIF (2026-08-27)
--
-- `statut = abandon | exclu` existait et etait correctement cable partout, mais
-- l'action n'ecrivait que le statut. Sans date, on ne peut pas dire combien
-- d'heures ont ete suivies ; sans motif, l'indicateur `m4_taux_abandon` rend un
-- chiffre que personne ne peut analyser.
--
-- Le champ couvre `abandon` ET `exclu` : `STATUTS_SORTIS` les traite deja
-- ensemble, et n'en dater qu'un seul recreerait le « jumeau oublie ».

ALTER TABLE "enrollments" ADD COLUMN "sortie_at" TIMESTAMP(3);
ALTER TABLE "enrollments" ADD COLUMN "sortie_motif" VARCHAR(500);

-- ── Reprise de l'existant, AVANT de poser la contrainte ─────────────────────
--
-- ⚠️ Sans ce backfill, la contrainte CHECK ci-dessous echouerait sur toute base
-- portant deja des sorties (la base de dev en compte ~3 000). On ne peut pas
-- inventer la vraie date : `updated_at` est le meilleur temoin disponible, et
-- le motif DIT explicitement qu'il vient d'une reprise — plutot qu'un texte
-- neutre qu'on lirait comme une saisie humaine.
UPDATE "enrollments"
   SET "sortie_at"    = COALESCE("sortie_at", "updated_at"),
       "sortie_motif" = COALESCE("sortie_motif", 'Motif non renseigne (sortie anterieure au 2026-08-27)')
 WHERE "statut" IN ('abandon', 'exclu');

-- Symetrie : une inscription ACTIVE ne doit porter ni date ni motif de sortie.
UPDATE "enrollments"
   SET "sortie_at" = NULL, "sortie_motif" = NULL
 WHERE "statut" NOT IN ('abandon', 'exclu');

-- ── La contrainte ───────────────────────────────────────────────────────────
--
-- Elle dit les DEUX sens, et c'est volontaire :
--   · une sortie SANS date ni motif est refusee (le defaut corrige ici) ;
--   · une inscription active AVEC une date de sortie est refusee aussi — sinon
--     un retour en arriere laisserait une date fantome que les rapports
--     liraient comme une sortie.
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_sortie_coherente_check"
  CHECK (
    ("statut" IN ('abandon', 'exclu')
       AND "sortie_at" IS NOT NULL
       AND "sortie_motif" IS NOT NULL
       AND length(btrim("sortie_motif")) > 0)
    OR
    ("statut" NOT IN ('abandon', 'exclu')
       AND "sortie_at" IS NULL
       AND "sortie_motif" IS NULL)
  );

-- Les rapports filtrent sur la periode de sortie.
CREATE INDEX "enrollments_sortie_at_idx" ON "enrollments"("sortie_at");
