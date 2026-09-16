-- Besoin d'aménagement déclaré SANS situation de handicap (indicateur 10, dette D2/D4).
--
-- Une colonne NULLABLE, sans DEFAULT et sans backfill : PostgreSQL pose l'attribut dans
-- le catalogue sans réécrire une seule ligne de `enrollments`, et aucune donnée
-- existante n'est modifiée. L'index est créé sur une colonne entièrement NULL.
--
-- ⚠️ Fenêtre app/worker : l'entrypoint de l'APP joue `prisma migrate deploy`, et le
-- worker atterrit ~50 min plus tôt. Le code qui lit cette colonne le fait à travers
-- `adaptation/colonne-declaration.ts`, qui vérifie sa présence avant de la demander :
-- pendant la fenêtre, la troisième branche est simplement absente du filtre.
ALTER TABLE "enrollments" ADD COLUMN "besoin_adaptation_declare_at" TIMESTAMP(3);

CREATE INDEX "enrollments_besoin_adaptation_declare_at_idx"
  ON "enrollments" ("besoin_adaptation_declare_at");
