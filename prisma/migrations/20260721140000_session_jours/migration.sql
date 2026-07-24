-- QUALIOPI — Journées RÉELLEMENT animées d'une session (décision D14).
--
-- POURQUOI. « Les journées d'une formation se suivent-elles toujours ? » —
-- « c'est possible que ça se suive ou pas ». Les deux cas existent. Donc
-- `date_debut..date_fin` ne décrit PAS les jours d'une session, et toute
-- déduction à partir de cette plage est fausse dès qu'un parcours est étalé.
--
-- Mesuré : un parcours de 4 journées réparties sur 3 mois fait retenir 66 jours
-- ouvrés au lieu de 4 — dénominateur du taux de présence multiplié par 16, taux
-- à ≈ 3 %, et attestation refusée à un stagiaire pourtant assidu.
--
-- Une seule table pour trois problèmes distincts :
--   1. le dénominateur du taux (jours réels, non déduits) ;
--   2. l'import distanciel multi-jours, aujourd'hui faux (un seul créneau posé,
--      d'où 100 % pour un stagiaire venu 1 jour sur 2) ;
--   3. les horaires RÉELS de la feuille d'émargement et de la convocation,
--      aujourd'hui codés en dur en « 09h00-17h00 ». C'est une exigence
--      jurisprudentielle (CAA Nantes 20/04/2021, qui sanctionne notamment les
--      feuilles sans horaires exacts), donc un prérequis du tuple signé de
--      l'émargement électronique ET du PDF de l'étape D.
--
-- Indicateurs visés : 10 et 12 (suivi de la mise en oeuvre et de l'assiduité).
--
-- RÉTROCOMPATIBLE : une session sans journée déclarée retombe sur
-- `date_debut..date_fin`, comportement actuel inchangé. Aucun backfill : la
-- production ne compte qu'une session et zéro créneau.
--
-- `ON DELETE CASCADE` — contrairement aux tables d'émargement qui sont en
-- RESTRICT : une journée déclarée est une donnée de PLANIFICATION, pas une
-- preuve. La preuve, ce sont les créneaux et les signatures, qui survivent.
--
-- Migration ADDITIVE : aucun DROP, aucune colonne ajoutée à une table existante.

-- AddForeignKey
-- CreateTable
CREATE TABLE "session_jours" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "heure_debut" VARCHAR(5) NOT NULL,
    "heure_fin" VARCHAR(5) NOT NULL,
    "trainer_id" UUID,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "horaires_confirmes" BOOLEAN NOT NULL DEFAULT false,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_jours_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
-- CreateIndex
CREATE UNIQUE INDEX "session_jour_unique" ON "session_jours"("session_id", "date");

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "session_jours" ADD CONSTRAINT "session_jours_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "session_jours" ADD CONSTRAINT "session_jours_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contraintes NON exprimables dans `schema.prisma`
-- ─────────────────────────────────────────────────────────────────────────────

-- Horaires RÉELS au format HH:MM, et une fin strictement après le début.
-- Ces deux chaînes finiront sur une pièce à valeur probante : la contrainte
-- interdit d'y glisser un « 9h » approximatif ou une plage inversée.
-- Même forme que `ck_emargement_contresignature_horaires`.
ALTER TABLE "session_jours" ADD CONSTRAINT "ck_session_jour_horaires"
  CHECK (
    -- `[0-2][0-9]` accepterait « 25:30 » et « 29:00 ». Ces chaînes finissent sur
    -- une pièce à valeur probante : la borne est explicite.
    "heure_debut" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "heure_fin" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    -- Comparaison lexicographique sur du HH:MM zéro-paddé = ordre chronologique.
    AND "heure_fin" > "heure_debut"
  );

-- `modules` est un tableau d'intitulés, jamais un objet ni un scalaire : le PDF
-- d'émargement itère dessus sans vérifier.
ALTER TABLE "session_jours" ADD CONSTRAINT "ck_session_jour_modules_tableau"
  CHECK (jsonb_typeof("modules") = 'array');
