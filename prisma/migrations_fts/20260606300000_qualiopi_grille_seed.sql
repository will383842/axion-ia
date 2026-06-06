-- Qualiopi — Seed RUNTIME de la grille qualité active (audit E2E 2026-06-06).
--
-- POURQUOI ICI (et pas dans un seed tsx) : le runtime standalone Docker ne
-- contient pas `tsx`, donc `pnpm qualiopi:seed` ne peut PAS tourner au boot.
-- `prisma migrate deploy` n'applique que le DDL (la table grille_qualite_configs
-- est créée VIDE par 20260606160000_qualiopi_t4_formation_engine). Sans grille
-- ACTIVE, getActiveGrille() renvoie null et le Formation Engine BLOQUE désormais
-- (fail-loud, cf. qualiopi-formation-engine-worker.ts) — donc aucune formation IA
-- ne peut être générée en prod tant que cette ligne n'existe pas.
--
-- Ce fichier est appliqué par scripts/docker-entrypoint.sh (boucle
-- prisma/migrations_fts/*.sql via `prisma db execute`), runtime, DB réelle,
-- NON-fatal et IDEMPOTENT (ON CONFLICT DO NOTHING). Même contrat que les setups
-- FTS : create au 1er boot, no-op rapide ensuite. Ne clobbe JAMAIS une grille
-- déjà présente (préserve une grille éditée par l'admin).
--
-- ⚠️ SSOT : le tableau `criteres` ci-dessous DOIT rester identique à
-- DEFAULT_GRILLE_CRITERES (src/server/qualiopi/engine/grille-schema.ts).
-- Le test grille-seed-sql.spec.ts vérifie mécaniquement cette parité (anti-drift).

INSERT INTO "grille_qualite_configs" (
  "id", "cle_unique", "criteres", "score_plancher", "nb_passes_max",
  "actif", "prompt_version", "created_at", "updated_at"
)
VALUES (
  uuid_generate_v4(),
  'grille_qualite_v1',
  $json$[{"id":"objectifs_mesurables","libelle":"Objectifs d'apprentissage mesurables","descriptif":"Les objectifs sont formulés avec des verbes d'action (taxonomie Bloom), quantifiables et vérifiables à l'issue de la formation.","poids":20,"scoreMin":60},{"id":"alignement_objectifs_contenu_eval","libelle":"Alignement objectifs-contenu-évaluation","descriptif":"Chaque objectif est couvert par au moins un module de contenu ET un exercice ou évaluation associé (backward design).","poids":20,"scoreMin":60},{"id":"progression_pedagogique","libelle":"Progression pédagogique cohérente","descriptif":"Le plan suit une progression logique du simple vers le complexe, respectant les prérequis déclarés et la charge cognitive.","poids":15,"scoreMin":60},{"id":"ratio_pratique","libelle":"Ratio activités pratiques suffisant","descriptif":"Les activités pratiques, mises en situation et exercices représentent au moins 60 % du temps total (indicateur 9 RNQ).","poids":15,"scoreMin":60},{"id":"clarte_structure","libelle":"Clarté et structure du support","descriptif":"Le plan est lisible, les titres explicites, le vocabulaire adapté au public cible, le support accessible (indicateur accessibilité).","poids":15,"scoreMin":60},{"id":"faisabilite_exercices","libelle":"Faisabilité des exercices dans le temps imparti","descriptif":"Les exercices proposés sont réalisables dans le temps alloué par module, avec des ressources accessibles aux apprenants.","poids":15,"scoreMin":60}]$json$::jsonb,
  80,
  3,
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("cle_unique") DO NOTHING;
