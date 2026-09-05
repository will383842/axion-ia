-- La boucle contractuelle se referme : l'exemplaire signé a désormais une trace.
--
-- Défaut vécu EN PRODUCTION le 2026-09-04. La convention AXI-DOC-2026-039 a été
-- envoyée à la cliente à 20:47 UTC, signée par elle, contresignée par
-- l'organisme à 21:33 UTC — et rien n'est parti. La cliente n'a jamais reçu
-- l'exemplaire intégralement signé, alors que l'écran de retour du portail le
-- lui promet mot pour mot : « … vous adressera l'exemplaire contresigné ».
--
-- Ce qui rendait le défaut INOBSERVABLE, et pas seulement présent :
--
--   · `DocumentSignature` n'a aucune colonne d'envoi ;
--   · `DocumentGenere.envoye_at` marque l'envoi de la pièce À SIGNER, pas de
--     l'exemplaire signé — le réutiliser aurait écrasé une date qui sert déjà ;
--   · une pièce passée `signee` SORT de `pieces_en_attente` et n'a plus aucun
--     bouton (`relance-partie.ts` : « `signee` n'a personne à relancer »).
--
-- Autrement dit : une fois la pièce complète, plus rien au monde ne pouvait
-- dire qu'elle n'avait pas été transmise. Un rattrapage n'avait nulle part où
-- s'écrire. C'est ce que ces deux colonnes réparent d'abord ; l'idempotence de
-- l'envoi n'en est que le second usage.
--
-- Les deux ajouts sont ADDITIFS et nullables. Aucun backfill : toutes les
-- pièces déjà signées passent donc pour non transmises — ce qui est
-- exactement vrai, et ce que l'alerte `exemplaire_signe_non_transmis` doit
-- faire remonter. Les antidater silencieusement effacerait le défaut au lieu
-- de le réparer.

ALTER TABLE "documents_generes"
  ADD COLUMN IF NOT EXISTS "exemplaire_signe_envoye_at" TIMESTAMP(3);

ALTER TABLE "documents_generes"
  ADD COLUMN IF NOT EXISTS "exemplaire_signe_key" TEXT;

-- L'alerte et la reprise balaient toutes deux
-- `statut_signature = 'signee' AND exemplaire_signe_envoye_at IS NULL`.
-- L'index existant `(statut_signature, annulee_at)` ne sert pas ce prédicat :
-- sa seconde colonne est ailleurs, et le balayage retomberait sur la table
-- entière à chaque tour de cron.
CREATE INDEX IF NOT EXISTS "documents_generes_statut_sig_exemplaire_envoye_idx"
  ON "documents_generes" ("statut_signature", "exemplaire_signe_envoye_at");
