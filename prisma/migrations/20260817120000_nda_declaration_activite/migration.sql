-- NDA 84381100438 — récépissé de déclaration d'activité du 17 août 2026
-- (préfet de la région Auvergne-Rhône-Alpes, art. R.6351-6 C. trav.).
--
-- Le numéro lui-même vit dans le CODE : `QUALIOPI_CONFIG_REGISTRY.nda_numero`
-- porte désormais « 84381100438 » comme défaut, ce qui le rend disponible au
-- build SSG (base stub) comme au runtime. Cette migration n'écrit donc AUCUNE
-- valeur — elle se contente de retirer ce qui EMPÊCHERAIT le défaut de sortir.
--
-- Pourquoi c'est nécessaire : `getQualiopiConfig` ne retombe sur le défaut du
-- registre que si la ligne est ABSENTE (ou si sa valeur échoue à la validation
-- Zod). Une ligne `qualiopi.nda_numero` enregistrée avec une chaîne vide — cas
-- parfaitement plausible, l'écran de configuration écrit clé par clé et le champ
-- existait bien avant l'attribution du numéro — passe la validation
-- `z.string().trim()` et gagne contre le défaut. Le site et les onze gabarits
-- PDF continueraient alors d'afficher « Déclaration d'activité non encore
-- enregistrée » avec le récépissé sur le bureau.
--
-- Portée VOLONTAIREMENT étroite : on ne supprime que la ligne vide (ou d'un type
-- JSON qui n'est pas une chaîne, donc invalide de toute façon). Une valeur
-- réellement saisie en console — y compris différente de celle du code — est
-- CONSERVÉE : c'est une décision d'administration, pas un accident.
--
-- Idempotente par construction : l'entrypoint rejoue `prisma migrate deploy` à
-- chaque démarrage, et un DELETE sur un prédicat qui ne matche plus ne fait rien.

DELETE FROM "site_settings"
WHERE "key" = 'qualiopi.nda_numero'
  AND (
    jsonb_typeof("value") <> 'string'
    OR btrim("value" #>> '{}') = ''
  );
