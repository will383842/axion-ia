-- Verrou du dossier de session et réouverture motivée (ADR 0060) — ADDITIF uniquement.
--
-- ## Ce que pose cette migration
--
--   1. deux énumérations : `TypeEvenementDossierSession` (reouverture,
--      reverrouillage) et `OrigineReponseQuestionnaire` (stagiaire, organisme) ;
--   2. la table `session_dossier_evenements`, journal APPEND-ONLY des gestes qui
--      rouvrent ou referment un dossier clos. Le verrou lui-même n'est pas
--      stocké : il est dérivé (`src/server/qualiopi/sessions/verrou-dossier.ts`) ;
--   3. la colonne nullable `questionnaires.origine_reponse` (indicateur 30 :
--      le stagiaire a-t-il répondu lui-même, ou l'organisme à sa place ?) ;
--   4. en SQL brut, invisible à `migrate diff` :
--        - CHECK `session_dossier_evenements_motif_reouverture` : une
--          réouverture porte un motif d'au moins 10 caractères (même seuil que
--          `annulee_motif`) ;
--        - trigger `session_dossier_evenements_ajout_seul` : UPDATE et DELETE
--          refusés, ligne par ligne ;
--        - trigger `session_dossier_evenements_pas_de_truncate` : TRUNCATE refusé ;
--      la liste de ces objets vit dans `verrou-dossier-objets-sql.ts`, que la
--      garde de dérive (Gate D) confronte à `pg_trigger` et `pg_constraint` ;
--   5. la reprise des données : `organisme` là où la console a persisté le
--      marqueur `saisie_admin: true` dans `reponses`. Partout ailleurs, NULL —
--      « origine non tracée », jamais « stagiaire » par défaut.
--
-- ## Fenêtre app/worker (~50 min)
--
-- Le worker (bâti en ~3 min) peut lire la table AVANT que l'entrypoint de
-- l'app ne la crée : `chargerEtatVerrou` attrape l'erreur « table inexistante »
-- et lit alors « aucun événement » (le verrou se calcule sur les pièces seules,
-- ce qui ferme plutôt qu'ouvre). L'application N-1 ignore la table et la
-- colonne : une réponse enregistrée pendant la fenêtre garde
-- `origine_reponse = NULL`, affichée « origine non tracée ».
--
-- ⚠️ Pas de `lock_timeout` ici, volontairement (même raisonnement que la
-- migration 20260930120000_numeros_emis_registre) : une migration inscrite
-- `failed` bloquerait toutes les suivantes (P3009) pendant que le déploiement
-- reste vert. `questionnaires` est petite ; la nouvelle table est vide.
--
-- ## Réversible
--
--   DROP TRIGGER IF EXISTS "session_dossier_evenements_pas_de_truncate" ON "session_dossier_evenements";
--   DROP TRIGGER IF EXISTS "session_dossier_evenements_ajout_seul" ON "session_dossier_evenements";
--   DROP FUNCTION IF EXISTS "session_dossier_evenements_ajout_seul"();
--   DROP TABLE IF EXISTS "session_dossier_evenements";
--   ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "origine_reponse";
--   DROP TYPE IF EXISTS "TypeEvenementDossierSession";
--   DROP TYPE IF EXISTS "OrigineReponseQuestionnaire";
-- (Le retrait détruit l'historique des réouvertures, qui est une pièce d'audit :
-- à ne jouer qu'en connaissance de cause.)

-- ═══ 1. Ce que Prisma exprime ════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "OrigineReponseQuestionnaire" AS ENUM ('stagiaire', 'organisme');

-- CreateEnum
CREATE TYPE "TypeEvenementDossierSession" AS ENUM ('reouverture', 'reverrouillage');

-- AlterTable
ALTER TABLE "questionnaires" ADD COLUMN     "origine_reponse" "OrigineReponseQuestionnaire";

-- CreateTable
CREATE TABLE "session_dossier_evenements" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "type" "TypeEvenementDossierSession" NOT NULL,
    "motif" TEXT,
    "auteur_id" UUID,
    "auteur_nom" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_dossier_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_dossier_evenements_session_id_created_at_idx" ON "session_dossier_evenements"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "session_dossier_evenements" ADD CONSTRAINT "session_dossier_evenements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ 2. SQL BRUT (déclaré dans verrou-dossier-objets-sql.ts) ═════════════════

-- Une réouverture sans motif lisible ne vaut rien devant un auditeur : c'est le
-- motif qu'il vient lire. `btrim` refuse un motif fait d'espaces.
ALTER TABLE "session_dossier_evenements" ADD CONSTRAINT "session_dossier_evenements_motif_reouverture" CHECK ("type" <> 'reouverture' OR char_length(btrim(coalesce("motif", ''))) >= 10);

-- Append-only : une réouverture effacée ou réécrite serait exactement la
-- rectification invisible que ce journal existe pour empêcher.
CREATE FUNCTION "session_dossier_evenements_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'session_dossier_evenements est en ajout seul : % refusé (ADR 0060)', TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "session_dossier_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "session_dossier_evenements"
  FOR EACH ROW EXECUTE FUNCTION "session_dossier_evenements_ajout_seul"();

CREATE TRIGGER "session_dossier_evenements_pas_de_truncate" BEFORE TRUNCATE ON "session_dossier_evenements"
  FOR EACH STATEMENT EXECUTE FUNCTION "session_dossier_evenements_ajout_seul"();

-- ═══ 3. Reprise des données ══════════════════════════════════════════════════

-- La console (`QuestionnairesSection`) persiste `saisie_admin: true` dans les
-- réponses qu'elle saisit à la place du stagiaire : c'est la seule origine
-- établie. Tout le reste reste NULL — « origine non tracée ».
UPDATE "questionnaires"
   SET "origine_reponse" = 'organisme'
 WHERE "origine_reponse" IS NULL
   AND "reponses" @> '{"saisie_admin": true}'::jsonb;
