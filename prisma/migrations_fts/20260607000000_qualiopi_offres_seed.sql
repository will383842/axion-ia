-- Qualiopi — Seed RUNTIME des offres_site (audit E2E, fix seed prod 2026-06-07).
--
-- POURQUOI ICI : le seed tsx (`pnpm qualiopi:seed`) ne tourne pas dans le runtime
-- standalone (pas de tsx + imports src/ absents) → les offres n'étaient PAS créées
-- (offreSite=0 constaté en prod). On applique donc les offres par le mécanisme
-- boot prouvé (docker-entrypoint.sh boucle prisma/migrations_fts/*.sql via
-- `prisma db execute`), exactement comme la grille qualité.
--
-- SSOT : OffreSite NE stocke PAS les prix (seul tier_id lie à pricing.ts). Ce SQL
-- ne duplique donc aucun prix — uniquement les métadonnées catalogue. Doit rester
-- aligné sur OFFRES_SEED (prisma/seeds/qualiopi/offres.ts) — vérifié par
-- offres-seed-sql.spec.ts (anti-drift).
--
-- IDEMPOTENT : ON CONFLICT (tier_id) DO NOTHING (préserve toute édition admin).
-- Les littéraux texte sont coercés vers les enums OffreFormatPedagogique/
-- OffreTarifType/OffreCategorie ; modalites = littéral text[].

INSERT INTO "offres_site" (
  "id","code","tier_id","titre_fr","slug","categorie","format_pedagogique",
  "public_vise_fr","duree_heures_min","duree_heures_max","modalites","tarif_type",
  "promesse_principale_fr","nb_modules_min","nb_modules_max","angle_pedagogique_fr",
  "created_at","updated_at"
)
VALUES
  (uuid_generate_v4(),'AXI-OFF-001','intervention-4h',$o$Formation 4 heures$o$,'demarrage-ia-express','intervention','collectif_4h',$o$TPE/PME et équipes souhaitant découvrir l'IA ou cadrer un cas d'usage métier précis.$o$,4,4,'{presentiel,distanciel}','fixe',$o$Découvrir l'IA opérationnelle ou cadrer un cas d'usage métier en une demi-journée.$o$,2,3,$o$decouverte_pratique$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-002','intervention-essentielle',$o$Essentielle$o$,'essentielle','intervention','collectif_1jour',$o$Équipes de 2 à 30 personnes découvrant l'IA opérationnelle.$o$,6,8,'{presentiel,distanciel,hybride}','a_partir_de',$o$Maîtriser les usages IA opérationnels en une journée sur site.$o$,3,5,$o$pratique_immersive$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-003','intervention-temps',$o$Gagner du temps$o$,'gagner-du-temps','intervention','collectif_1jour',$o$Équipes opérationnelles souhaitant automatiser leurs tâches récurrentes.$o$,6,8,'{presentiel,distanciel,hybride}','a_partir_de',$o$Automatiser les tâches récurrentes et intégrer l'IA au flux de travail quotidien.$o$,3,5,$o$productivite_metier$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-004','intervention-approfondie',$o$Approfondie$o$,'approfondie','intervention','collectif_2jours',$o$Équipes de 2 à 30 personnes visant un ancrage durable des pratiques IA.$o$,12,14,'{presentiel,distanciel,hybride}','a_partir_de',$o$Deux journées pour ancrer durablement les pratiques IA dans les métiers.$o$,4,6,$o$approfondissement$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-005','intervention-conference',$o$Conférence$o$,'conference','intervention','conference',$o$Grands effectifs (séminaires, kick-off annuels).$o$,6,8,'{presentiel}','sur_devis',$o$Embarquer un grand collectif autour de l'IA en une journée plénière.$o$,2,4,$o$sensibilisation$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-006','intervention-dirigeants',$o$Dirigeants$o$,'dirigeants','intervention','dirigeant_1to1',$o$Dirigeant en accompagnement individuel (1-to-1).$o$,6,8,'{presentiel,distanciel}','fixe',$o$Structurer l'entreprise et chiffrer les gains d'implémentation IA.$o$,2,4,$o$strategique_executif$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-007','intervention-membre-equipe',$o$Membre d'équipe$o$,'membre-equipe','intervention','individuel',$o$Collaborateur clé en accompagnement individuel (1-to-1).$o$,6,8,'{presentiel,distanciel}','fixe',$o$Monter en compétence IA sur ses propres cas métier.$o$,2,4,$o$montee_competence$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-008','intervention-claude',$o$Intervention Claude$o$,'intervention-claude','intervention','collectif_1jour',$o$Équipes de 2 à 30 personnes outillées sur Claude (Anthropic).$o$,6,8,'{presentiel,distanciel,hybride}','a_partir_de',$o$Une journée 100 % dédiée à Claude (Anthropic) : Chat, Cowork, Code.$o$,3,5,$o$outil_claude$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-009','intervention-dirigeant-vision',$o$Vision IA stratégique$o$,'vision-ia-strategique','intervention','dirigeant_1to1',$o$Dirigeant en accompagnement individuel (1-to-1).$o$,6,8,'{presentiel,distanciel}','fixe',$o$Ouvrir les opportunités IA du secteur du dirigeant et bâtir sa feuille de route.$o$,2,4,$o$vision_strategique$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-010','intervention-claude-dirigeant',$o$Intervention Claude · Dirigeant$o$,'intervention-claude-dirigeant','intervention','dirigeant_1to1',$o$Dirigeant en accompagnement individuel (1-to-1), 100 % Claude.$o$,6,8,'{presentiel,distanciel}','fixe',$o$Journée 1-to-1 dirigeant 100 % dédiée à Claude (Anthropic).$o$,2,4,$o$outil_claude_executif$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (uuid_generate_v4(),'AXI-OFF-011','intervention-sur-demande',$o$Sur demande$o$,'sur-demande','intervention','sur_devis',$o$Configurations hors-cadre : multi-sites, multi-jours, offsite, contenus spécifiques.$o$,4,21,'{presentiel,distanciel,hybride}','sur_devis',$o$Cadrage et programme sur mesure pour les besoins hors standard.$o$,2,6,$o$sur_mesure$o$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("tier_id") DO NOTHING;
