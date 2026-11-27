Alerte « indexation stagnante » réparée : vrais chiffres Search Console, une alerte par article tous les 30 jours, une veille par semaine

## Pourquoi l'ancienne alerte ne marchait pas (preuves dans le code d'origine)

1. `alertIndexationStagnant(s.slug, 0, daysSince, 0)` : CTR et impressions **codés en dur à 0**. Chaque message disait « CTR 0,00 % sur 0 impression », jamais un chiffre réel.
2. Le critère était « aucune ligne `KeywordTracking` pour l'article », pas une mesure Search Console.
3. Cron horaire (`15 * * * *`) sans anti-répétition : même article, même message, toutes les heures. Elle a donc été coupée le 11/07/2026.

## Ce que fait la PR

- Nouveau module `content-gen/monitoring/indexation-stagnante.ts` : lit `GscPageJour` (fenêtre de 28 jours) pour les articles tier-1 publiés depuis 30 jours ou plus. Stagnant = moins de 10 impressions, ou au moins 100 impressions avec un CTR sous 1 %. Le message porte les vrais chiffres.
- Anti-répétition : réservation Redis `SET NX EX` de 30 jours par slug, prise avant l'envoi. Redis en panne ou lecture en échec : aucune alerte, et l'échec remonte au journal et à Sentry (le moniteur ne se tait plus en silence).
- Source insuffisante (moins de 24 jours distincts de données sur 28 (signalé par un avertissement au journal) dans la fenêtre, robot P4 éteint) : aucune alerte, jamais de zéros fabriqués.
- Au plus 5 alertes par passage. Chemin de l'article construit par `buildArticlePath` puis normalisé comme le robot P4.
- Cron : la veille quitte le tick horaire et a son passage hebdomadaire (lundi 08 h 40 UTC, même file, déclencheur `cron-weekly-indexation`).
- Reste éteinte tant que `INDEXATION_STAGNANT_ALERT_ENABLED` n'est pas à `true` : la mise en service reste une décision de Will, une fois `GscPageJour` alimentée par P4.
- Aucune migration, aucun changement de schéma.

## Base

`main` (ouverte après la fusion de P4). La branche part de `feat/seo-pilotage-p4-robot` ; `GscPageJour` vient de P2/P4.

## Tests

`src/server/content-gen/monitoring/__tests__/indexation-stagnante.spec.ts` (rouge avant le correctif : module absent) : chiffres réels transmis, CTR calculé, pas de seconde alerte avant 30 jours, Redis en panne, plafond de 5, source indisponible (table absente, trop peu de jours, lecture en échec), et garde-fous de câblage (plus de zéros codés en dur, cron hebdomadaire dédié, plus dans le tick horaire).
Contrôles : typecheck, vitest ciblé (98 fichiers, 1029 tests), content-gen:isolation-check, image-bank:isolation-check, eslint, prettier : verts.

Deux relectures Opus, 2 tours. Tour 1 : erreurs avalées, fenêtre partielle, lecture limitée à 200 articles, fenêtre de 27 jours, message ambigu, tests de seuils : corrigés. Tour 2 : correctifs confirmés ; restent des remarques faibles (échec Telegram qui consomme la réservation de 30 jours, adaptateurs testés par lecture du source), assumées.

Échecs préexistants hors périmètre : `kb-ingest/url-extractor.spec.ts` (4 tests, rouges aussi sans cette PR).

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGbRqrtPaQk4X1fMArs
