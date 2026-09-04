-- off.30 « multi-parties » : rattacher l'AUTEUR d'une appreciation de formateur.
--
-- L'enumeration `AppreciationSource` accepte `formateur` depuis l'origine, mais
-- aucune colonne ne portait cet auteur. L'indicateur identifie les personnes par
-- leur ADRESSE E-MAIL, resolue depuis `trainee` (qualite `stagiaire`) ou depuis
-- le contact du client (`client_id`). Une appreciation de formateur n'avait donc
-- ni l'un ni l'autre : elle etait saisie, affichee, puis comptee « auteur non
-- etabli » et ignoree. Le formulaire proposait une qualite que le moteur ne
-- savait pas lire.
--
-- La colonne est NULLABLE et sans valeur par defaut : les lignes existantes
-- restent valides, et l'ancienne version de l'application — qui tourne encore
-- pendant ~50 min apres la fusion, cf. AGENTS.md « DEUX conteneurs, DEUX
-- vitesses » — continue d'ecrire sans elle.
--
-- `ON DELETE SET NULL` et non CASCADE : supprimer un formateur ne doit pas
-- effacer les appreciations recueillies. Elles redeviennent « auteur non
-- etabli », ce qui est le comportement honnete — la voix a existe, on ne sait
-- plus la rattacher.
ALTER TABLE "appreciations" ADD COLUMN "trainer_id" UUID;

ALTER TABLE "appreciations"
  ADD CONSTRAINT "appreciations_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index : le moteur de conformite lit ces lignes a chaque calcul d'indicateur.
CREATE INDEX "appreciations_trainer_id_idx" ON "appreciations"("trainer_id");
