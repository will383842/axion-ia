Conception de la chaîne éditoriale IA (qualité à la source)

## Ce que fait cette PR

Elle modifie un seul document : `docs/pilotage-seo-geo/CONCEPTION-CHAINE-EDITORIALE-IA.md`. **Aucun code, aucune migration.** C'est un plan.

## Ce que dit le plan

- **Pourquoi les contenus actuels sont faibles** (preuves dans le code) : un seul passage par gpt-4o, aucun fait sourcé, même plan pour tous, questions inventées, aucun expert, sujets en rotation, aucun retour des résultats.
- **La chaîne cible, en huit rôles** : chercheur de besoins, brief (angle unique), faits sourcés et datés, rédacteur, expert dirigeant de PME, vérificateur de faits, éditeur, porte qualité (dernier filet). Un contenu refusé est réécrit sur la partie en cause, 2 fois au plus, puis **abandonné** : jamais publié faible.
- **Modèles** : Opus pour le brief, la rédaction et l'expert ; Sonnet ailleurs ; jamais Fable.
- **Coût** (estimation à mesurer) : environ 1,1 à 1,7 $ par passage complet, 3,5 à 6 $ par contenu publié.
- **Aucun quota** : le rythme découle de ce qui passe la qualité ; on n'accélère que si Google et les IA suivent, sur décision de Will.
- **Boucle d'amélioration** : chaque refus et sa raison sont enregistrés ; une analyse hebdomadaire propose des changements, appliqués seulement après relecture de Will.

## Corrections de cette révision (décisions de Will du 27/11/2026)

- « **Partout en France** » est une formule voulue et autorisée ; seul « Grenoble » est interdit (sauf mentions légales). La question a été retirée des décisions.
- Le § 8 est **aligné sur la conception de la porte** (branche `docs/porte-qualite-contenus`) : critères B01 à B17, verdicts `publiable` / `a_corriger` / `bloque`, mêmes codes de raison, enregistrement des refus dans un seul module partagé, la porte est le dernier filet.
- Règles rappelées : pas de faux témoignage, pas de prix barré, aucun frais de déplacement, pas de réservation directe (lien vers la page contact), aucun avocat, jamais Fable. Jamais « relu » sans relecture réelle.
- § 14 : chaque décision restante (10) a une recommandation par défaut en français simple, avec un exemple.

## À savoir

- Écarts à aligner côté porte (pas dans ce document) : sa ligne 287 dit encore que la chaîne interdit « partout en France » ; la forme du nom du relecteur diffère.
- Les pages `developers.google.com` n'ont pas pu être lues en texte intégral ; le document sépare faits sourcés, hypothèses et non vérifié.
- `prettier --check` passe (sans le plugin Tailwind, absent de l'environnement).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGeVedw3p677U9hzSTv

VERDICT OPUS : BON
