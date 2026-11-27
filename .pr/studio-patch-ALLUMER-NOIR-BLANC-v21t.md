Rouge : rien de relevé. Aucune PR ouverte pour cette branche et aucun check-run sur 0889bc20 (l'API GitHub n'en renvoie aucun) ; la branche est déjà à jour de master.
Changé : rien. Le patch ne contient qu'un commit vide (--allow-empty), exigé par la consigne ; le code reste celui de la branche.
Tests : `vitest run tests/briques tests/moteurs` (4531 passés, 4 échecs) ; tests/briques/composition et motion/noir-blanc : 15 fichiers, tout vert. `tsc --noEmit` : erreurs seulement sur des modules `remotion` introuvables (docs/…/prototypes).
Rouges hérités non réparés : recollage.test.ts, controle-piece-neuve.test.ts, sequence-appel.test.ts, mesure-v3.test.ts. Les 4 échouent à l'identique sur origin/master (remotion absent). Le lockfile du dépôt Studio n'a pas changé.
