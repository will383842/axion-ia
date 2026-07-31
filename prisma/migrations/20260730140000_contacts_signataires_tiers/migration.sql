-- QUALIOPI — Contacts des SIGNATAIRES TIERS : sous-traitant et financeur.
--
-- ## Le blocage que cette migration lève
--
-- Le canal A (migration 20260730090000, ADR 0037) fait signer une pièce par lien
-- nominatif. Émettre ce lien exige une adresse électronique, et l'identité doit
-- être résolue depuis la BASE — jamais saisie librement, sans quoi on scellerait
-- « ce que l'organisme a bien voulu déclarer ».
--
-- Or deux des huit circuits n'avaient personne à qui écrire :
--
--   · `contrat_sous_traitance` — `sous_traitants_of` ne portait que `nom`,
--     `siret`, `nda` et `objet_prestation`. Aucun contact, aucune adresse.
--   · `convention_tripartite` — le financeur n'existe QUE comme la chaîne
--     `dossiers_financement.financeur_nom` (« OPCO Atlas », « France Travail »).
--     Aucun contact.
--
-- Résultat : `emettreLienSignatureAction` refusait explicitement ces deux
-- parties. Le refus était juste — il disait ce qui manquait au lieu d'échouer
-- plus loin — mais il fermait la signature en ligne à un contrat que
-- l'indicateur 27 du RNQ exige signé.
--
-- ## 🔴 Pourquoi PAS une table `Financeur`
--
-- Le financeur est déjà nommé à DEUX endroits : `dossiers_financement.
-- financeur_nom`, et `clients.opco_identifie` (inféré depuis l'IDCC ou le NAF).
-- Créer une troisième représentation en ferait trois à tenir synchronisées, et
-- la divergence serait SILENCIEUSE : une convention tripartite pourrait nommer
-- un OPCO et faire signer le contact d'un autre.
--
-- Le contact est donc ajouté LÀ OÙ LE FINANCEUR VIT DÉJÀ, au grain du DOSSIER.
-- Et c'est le bon grain : la personne qui signe une tripartite est celle qui
-- instruit CE dossier-là, pas un contact générique d'OPCO valable à vie.
--
-- ## Le rattachement manquant de la pièce au sous-traitant
--
-- 🔴 `genererContratSousTraitanceAction` ne passait AUCUN `refs` à
-- `generateDocument` : la pièce produite n'était reliée au sous-traitant par
-- rien. Impossible, depuis un `documents_generes.id`, de savoir à qui envoyer le
-- lien. La colonne ci-dessous ferme ce trou — sans elle, les contacts ajoutés
-- seraient inatteignables.
--
-- Migration 100 % ADDITIVE — aucun DROP, aucune colonne rendue obligatoire.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Contact du SOUS-TRAITANT
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "sous_traitants_of"
  ADD COLUMN "contact_nom" VARCHAR(200),
  ADD COLUMN "contact_email" VARCHAR(320),
  ADD COLUMN "contact_fonction" VARCHAR(200);

COMMENT ON COLUMN "sous_traitants_of"."contact_nom" IS
  'Personne physique qui signe pour le sous-traitant. Distincte de `nom`, qui est la raison sociale.';
COMMENT ON COLUMN "sous_traitants_of"."contact_email" IS
  'Adresse à laquelle le lien de signature est envoyé. Sans elle, aucun lien ne peut être émis.';
COMMENT ON COLUMN "sous_traitants_of"."contact_fonction" IS
  'Qualité figée au moment de la signature — porte l''opposabilité du pouvoir de signer.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Contact du FINANCEUR, au grain du dossier
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "dossiers_financement"
  ADD COLUMN "financeur_contact_nom" VARCHAR(200),
  ADD COLUMN "financeur_contact_email" VARCHAR(320),
  ADD COLUMN "financeur_contact_fonction" VARCHAR(200);

COMMENT ON COLUMN "dossiers_financement"."financeur_contact_nom" IS
  'Personne physique qui signe pour le financeur sur CE dossier. Le grain est volontairement le dossier, pas l''OPCO : le gestionnaire change d''un dossier à l''autre.';
COMMENT ON COLUMN "dossiers_financement"."financeur_contact_email" IS
  'Adresse à laquelle le lien de signature de la convention tripartite est envoyé.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. La pièce est enfin reliée à son sous-traitant
-- ─────────────────────────────────────────────────────────────────────────────

-- `ON DELETE SET NULL` : un sous-traitant peut être retiré du référentiel ; la
-- pièce émise, elle, est immuable et doit survivre. Ses données de rendu sont de
-- toute façon figées dans `metadata.renderData`.
ALTER TABLE "documents_generes"
  ADD COLUMN "sous_traitant_id" UUID;

ALTER TABLE "documents_generes"
  ADD CONSTRAINT "documents_generes_sous_traitant_id_fkey"
  FOREIGN KEY ("sous_traitant_id") REFERENCES "sous_traitants_of"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "documents_generes_sous_traitant_id_idx"
  ON "documents_generes"("sous_traitant_id");

COMMENT ON COLUMN "documents_generes"."sous_traitant_id" IS
  'Sous-traitant partie au contrat. Alimenté à la génération : sans lui, impossible de savoir à qui adresser le lien de signature.';
