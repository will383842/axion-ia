-- Chatbot — qualification non-intrusive (T-13, qualifier_prospect, ADR-CB-09).
--
-- Ajoute la colonne JSONB `prospect_profile` à `chat_conversations` pour stocker
-- le profil prospect capté par le tool qualifier_prospect (type_structure, secteur,
-- besoin, maturite_ia, urgence) sans interrogatoire.
--
-- Style hand-authored idempotent (IF NOT EXISTS) aligné sur 20260603220000_chatbot_core.
-- Migration ADDITIVE : nullable (défaut NULL) → aucune conversation historique
-- impactée.

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "prospect_profile" JSONB;
