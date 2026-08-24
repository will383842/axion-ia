-- Partenariat : trace de l'échange (off.26 ⭐).
--
-- Le registre ne portait que `objet`, du texte libre écrit par l'organisme
-- lui-même. Une déclaration, jamais une preuve. Ces trois colonnes portent les
-- trois questions que pose l'auditeur : QUI, QUAND, et OÙ EST LA PIÈCE.
--
-- Migration ADDITIVE : quatre colonnes nullables, aucune valeur par défaut,
-- aucune réécriture de ligne. Les fiches existantes restent valides et
-- inchangées ; elles apparaîtront simplement comme « sans trace d'échange »,
-- ce qui est exactement leur état réel.
ALTER TABLE "partenariats"
  ADD COLUMN "interlocuteur_nom"   VARCHAR(200),
  ADD COLUMN "interlocuteur_email" VARCHAR(320),
  ADD COLUMN "dernier_echange_at"  TIMESTAMP(3),
  ADD COLUMN "preuve_url"          TEXT;
