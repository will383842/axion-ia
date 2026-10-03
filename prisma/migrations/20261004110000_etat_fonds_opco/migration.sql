-- Lot OPCO A5 — état des fonds des OPCO (suspensions, dates limites de dépôt).
-- AJOUTS SEULS : un type, une table, un index, une contrainte, des données de
-- départ. Aucun DROP, aucun RENAME, aucun UPDATE, aucun DELETE.
-- Les données de départ sont IDEMPOTENTES (INSERT … SELECT … WHERE NOT EXISTS) :
-- rejouer la migration, ou la poser sur une base qui porte déjà ces relevés,
-- n'ajoute aucun doublon.

-- CreateEnum
CREATE TYPE "StatutFondsOpco" AS ENUM ('ouvert', 'reduit', 'suspendu');

-- CreateTable
CREATE TABLE "etats_fonds_opco" (
    "id" UUID NOT NULL,
    "opco" "Opco" NOT NULL,
    "idcc" CHAR(4),
    "statut" "StatutFondsOpco" NOT NULL,
    "perimetre" VARCHAR(200),
    "date_limite_depot" DATE,
    "source_url" TEXT NOT NULL,
    "releve_le" DATE NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etats_fonds_opco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "etats_fonds_opco_opco_idcc_releve_le_idx" ON "etats_fonds_opco"("opco", "idcc", "releve_le");

-- Un IDCC est un code à quatre chiffres (zéros de tête compris : 0573, 0158).
ALTER TABLE "etats_fonds_opco" ADD CONSTRAINT "etats_fonds_opco_idcc_check"
  CHECK ("idcc" IS NULL OR "idcc" ~ '^[0-9]{4}$');

-- Données de départ 1/2 — AKTO suspend le plan de développement des compétences
-- des moins de 50 salariés (brève akto.fr du 22/09/2026, relevée le 04/10/2026).
-- IDCC vérifiés sur les pages de règles d'akto.fr et dans la table SIRO de
-- France compétences. La branche « Exploitations forestières et scieries
-- agricoles » (conventions régionales) n'est volontairement PAS insérée.
INSERT INTO "etats_fonds_opco"
  ("id", "opco", "idcc", "statut", "perimetre", "date_limite_depot", "source_url", "releve_le", "note", "created_at", "updated_at")
SELECT gen_random_uuid(), 'akto'::"Opco", v.idcc, 'suspendu'::"StatutFondsOpco",
       v.branche || ' — entreprises de moins de 50 salariés', NULL,
       'https://www.akto.fr/breve/entreprises-moins-50-salaries-suspension-financement-formations-pdc/',
       DATE '2026-10-04',
       'Financement du plan de développement des compétences suspendu pour 2026, entreprises de moins de 50 salariés ; enveloppe intégralement engagée. Restent possibles : plan conventionnel, actions collectives d''Espace Formation, alternance.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('2149', 'Activités du déchet'),
  ('2583', 'Autoroutes'),
  ('0573', 'Commerces de gros'),
  ('3243', 'Commerces de quincaillerie'),
  ('3218', 'Enseignement privé non lucratif'),
  ('7520', 'Enseignement privé non lucratif'),
  ('2002', 'Entretien et location textile'),
  ('1516', 'Organismes de formation'),
  ('2147', 'Services d''eau et d''assainissement'),
  ('0158', 'Travail mécanique du bois')
) AS v(idcc, branche)
WHERE NOT EXISTS (
  SELECT 1 FROM "etats_fonds_opco" e
  WHERE e."opco" = 'akto'::"Opco" AND e."idcc" = v.idcc AND e."releve_le" = DATE '2026-10-04'
);

-- Données de départ 2/2 — dates limites de dépôt 2026, au niveau de l'OPCO entier
-- (idcc NULL, statut ouvert). Mêmes dates que le référentiel `OPCO_FICHES` (lot A2),
-- sauf Atlas : « la demande doit parvenir avant le 31/12 » → dernier jour utile le 30/12.
INSERT INTO "etats_fonds_opco"
  ("id", "opco", "idcc", "statut", "perimetre", "date_limite_depot", "source_url", "releve_le", "note", "created_at", "updated_at")
SELECT gen_random_uuid(), v.opco::"Opco", NULL, 'ouvert'::"StatutFondsOpco",
       'Plan de développement des compétences — tout l''OPCO', v.date_limite::date,
       v.source_url, DATE '2026-10-04', v.note, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('opcommerce', '2026-11-30',
   'https://www.lopcommerce.com/media/3pyfo421/cpc_entreprises-bureau_et_numerique.pdf',
   'Au-delà, dossiers traités selon les réabondements du conseil d''administration de décembre.'),
  ('atlas', '2026-12-30',
   'https://www.opco-atlas.fr/conditions-generales.html',
   'La demande doit parvenir avant le 31/12 de l''année N.'),
  ('mobilites', '2026-12-31',
   'https://www.opcomobilites.fr/dispositifs-formation/le-plan-de-developpement-des-competences/',
   '15/01/2027 si la formation débute entre le 15 et le 31/12/2026.')
) AS v(opco, date_limite, source_url, note)
WHERE NOT EXISTS (
  SELECT 1 FROM "etats_fonds_opco" e
  WHERE e."opco" = v.opco::"Opco" AND e."idcc" IS NULL AND e."releve_le" = DATE '2026-10-04'
);
