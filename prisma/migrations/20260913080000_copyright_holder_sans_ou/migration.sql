-- L'entité est une SAS française. La base, elle, servait encore l'Estonie.
--
-- ## L'écart, et pourquoi personne ne l'a vu
--
-- `schema.prisma` déclare `copyrightHolder String @default("Axion-IA")`. La
-- migration d'origine (`20260516142017_add_image_bank_tables`) avait posé
-- `DEFAULT 'Axion-IA OÜ'` — modélisation estonienne historique. Le défaut
-- déclaré a été corrigé ensuite ; AUCUNE migration n'a suivi pour aligner la
-- colonne.
--
-- Mesuré en production le 2026-09-13 :
--
--   column_default                     'Axion-IA OÜ'::character varying
--   image_assets.copyright_holder      Axion-IA      215 lignes
--                                      Axion-IA OÜ    73 lignes
--
-- 🔑 CE QUI L'A RENDU INVISIBLE : `resolveCopyrightHolder()`
-- (`src/server/image-bank/constants.ts`) retire « OÜ » À LA LECTURE. Rien ne
-- s'affiche jamais de faux — donc rien ne rougit jamais. Le nettoyage protégeait
-- l'écran et masquait la base. Un export brut, une reprise de données ou un
-- lecteur qui ignore ce nettoyage auraient servi l'ancienne entité.
--
-- L'identité réelle est saisie et centralisée depuis longtemps
-- (`site_settings.legal_overrides` : AXION IA SAS, RCS Grenoble). Ce n'est pas
-- une décision à prendre, c'est un reste à effacer.

-- 1. La colonne cesse de fabriquer de nouvelles lignes fautives.
ALTER TABLE "image_assets" ALTER COLUMN "copyright_holder" SET DEFAULT 'Axion-IA';

-- 2. Les lignes déjà écrites. On ne remplace pas aveuglément : on retire le
--    suffixe, pour ne pas écraser un titulaire de droits TIERS (photographe
--    externe, banque d'images sous licence) qui n'a jamais été « Axion-IA ».
--    `regexp_replace` borné à la fin de chaîne, insensible à la casse.
UPDATE "image_assets"
   SET "copyright_holder" = regexp_replace("copyright_holder", '\s*OÜ\s*$', '', 'i')
 WHERE "copyright_holder" ~* 'OÜ\s*$';
