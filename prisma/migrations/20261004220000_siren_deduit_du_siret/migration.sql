-- Lot A9 — SIREN déduit du SIRET pour les fiches existantes.
--
-- Migration de DONNÉES seulement (aucun DDL, aucun DROP). Idempotente : seules
-- les fiches SANS SIREN sont écrites ; une seconde passe ne trouve plus rien.
-- Un SIREN déjà présent, même s'il contredit le SIRET, n'est jamais écrasé (la
-- fiche l'affiche avec un avertissement).
--
-- 🔴 Le SIRET est RECONTRÔLÉ ici, exactement comme `checkSiretFormat` +
-- `sirenDuClient` (src/lib/siret.ts) : la lecture fait confiance à la colonne
-- `siren`, donc tout ce que cette migration écrit passe ensuite pour un « SIREN
-- saisi valide ». Sans ces contrôles, `00000000000000` (valeur réellement
-- trouvée en production, AXI-CLI-002) donnait le SIREN `000000000`, et un SIRET
-- à clé fausse le SIREN d'une autre entreprise, interrogé ensuite à l'INSEE.
-- Même règle que `scripts/visio/deriver-siren.ts`.
--   1. 14 chiffres ;
--   2. pas un chiffre répété (valeur de remplissage) ;
--   3. clé de Luhn du SIRET (positions impaires doublées, depuis la gauche),
--      OU exception La Poste : préfixe 356000000 et somme des chiffres
--      multiple de 5 ;
--   4. clé de Luhn des 9 premiers chiffres (positions paires doublées).
UPDATE "clients" c
SET "siren" = left(c."siret", 9)
WHERE c."siren" IS NULL
  AND c."siret" ~ '^[0-9]{14}$'
  AND c."siret" !~ '^([0-9])\1{13}$'
  AND (
    (
      SELECT sum(CASE WHEN p % 2 = 1
                      THEN (substr(c."siret", p, 1)::int * 2) - CASE WHEN substr(c."siret", p, 1)::int * 2 > 9 THEN 9 ELSE 0 END
                      ELSE substr(c."siret", p, 1)::int END)
      FROM generate_series(1, 14) AS p
    ) % 10 = 0
    OR (
      left(c."siret", 9) = '356000000'
      AND (SELECT sum(substr(c."siret", p, 1)::int) FROM generate_series(1, 14) AS p) % 5 = 0
    )
  )
  AND (
    SELECT sum(CASE WHEN p % 2 = 0
                    THEN (substr(c."siret", p, 1)::int * 2) - CASE WHEN substr(c."siret", p, 1)::int * 2 > 9 THEN 9 ELSE 0 END
                    ELSE substr(c."siret", p, 1)::int END)
    FROM generate_series(1, 9) AS p
  ) % 10 = 0;
