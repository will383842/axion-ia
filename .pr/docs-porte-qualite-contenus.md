# docs : conception de la porte qualité des contenus (dernier filet de la chaîne éditoriale)

Aucun code n'est modifié. Un seul fichier de conception : `docs/pilotage-seo-geo/CONCEPTION-PORTE-QUALITE.md`.

## Ce qui a changé (décisions de Will du 27/11/2026)

- **« Partout en France » est autorisée.** Seul « Grenoble » est interdit (sauf pages légales). L'ancienne question D1 est supprimée, la porte ne refuse jamais cette formule, un test le verrouille.
- **Plus aucun quota.** Les huit paliers de 3 à 100 contenus par jour sont retirés. Le rythme découle de ce qui passe la qualité ; on accélère seulement si Google et les IA suivent (indexation, affichages, clics, citations IA), avec le coupe-circuit automatique et des indicateurs de montée en charge sans cible de volume. Les cibles de volume encore présentes dans le code sont recensées pour être neutralisées.
- **La porte est le dernier filet.** La qualité se construit en amont, par la chaîne éditoriale IA (document `CONCEPTION-CHAINE-EDITORIALE-IA.md`, branche `docs/chaine-editoriale-ia`). Un contenu refusé repart en réécriture ciblée (2 essais, même compteur que la chaîne), puis est abandonné, jamais publié faible.
- **Les refus sont enregistrés** avec leur raison (liste de codes de la chaîne reprise telle quelle ; codes manquants listés pour son module partagé ; verdicts `publiable` / `a_corriger` / `bloque`), visibles en console, et alimentent la boucle d'amélioration hebdomadaire.
- **Règles de marque** : pas de faux témoignage, pas de prix barré, aucun frais de déplacement, pas de réservation directe en ligne (l'appel à l'action pointe vers la page contact, jamais vers `/appel`), terracotta, aucun avocat.
- **Corrections issues de deux relectures Opus** (12 bloquants au total, tous traités ; trois passes) : Qualiopi et CPF ne sont plus présentés comme des contenus à écrire (le code les refuse) ; la FAQ et la citation d'expert ne sont plus exigées (risque de FAQ décorative et de faux expert) ; la liste des interdits est en lecture seule à l'écran ; contradictions internes et références corrigées.
- **Décisions restantes D2, D3, D5, D6**, chacune avec une recommandation par défaut en français simple (§ 17).

## À savoir

- Le document de la chaîne éditoriale est déjà corrigé sur « partout en France » (ff78ac7f). Reste à aligner chez lui : B17 est ici un report (jamais un abandon).
- Le générateur injecte aujourd'hui un lien de repli vers `/appel` (réservation en ligne) : la correction est prévue dans Q2, avant la mise en ombre.
- B17 (plafond du jour, coupe-circuit) n'abandonne jamais un bon contenu : il le met en attente.
- Prettier vérifié avec la configuration du dépôt, sans le plugin Tailwind (non installé ici).

La troisième passe n'a relevé qu'un bloquant (la PR Q10c manquante), corrigé ensuite selon la correction proposée, ainsi que ses points mineurs ; ces derniers ajustements n'ont pas été relus par une quatrième passe.

VERDICT OPUS : BON
