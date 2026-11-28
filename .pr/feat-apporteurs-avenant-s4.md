## feat(apporteurs): avenant 2.8 S4 — gabarits d'e-mails (worker)

Lot S4 de #2512. Trois gabarits livrés au worker, **sans émetteur** (l'émission vient au lot S3) :

- `apporteur-avenant-propose` : une mise à jour du contrat est proposée (version signée → 2.8), lien personnel, rien d'autre à faire, on peut garder sa version sans conséquence.
- `apporteur-avenant-relance` : même contenu, une seule fois, présenté comme un simple rappel.
- `apporteur-avenant-enregistre` : acceptation enregistrée, date d'effet, avenant + contrat 2.8 + preuve, à retrouver dans « Mes documents ».

Expéditeur : contact@ (expéditeur transactionnel par défaut). Aucun prix, aucune pression, aucune mention de la règle du rendez-vous ni de la bascule des présentations.

`gabaritRepli` : constante `GABARIT_REPLI_AVENANT` (`apporteur-lien-espace`, déjà en ligne). L'émetteur (S3) doit poser `gabaritRepli`, `origine: "console"` et `lien` (lien de l'espace).

Inscrits comme les autres gabarits d'apporteur : registre, file, politique d'outbox, catalogue d'aperçu, `envois.ts`, cliquets G7 (dettes, comme les gabarits voisins). Pas dans `GABARITS_ARGENT`.

Tests : rendu des trois gabarits (données fictives), lien hors liste blanche non rendu, repli sûr, nom inconnu non connu, et garde qui échoue si un gabarit ou un texte parle de bascule des présentations ou de la règle du rendez-vous.

Migration : aucune.

À mettre en ligne AVANT l'app qui émet.

Lien : #2512

🤖 Generated with [Claude Code](https://claude.com/claude-code)
