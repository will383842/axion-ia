Chaîne éditoriale C4 : codes de refus fermés et contrat avec la porte qualité

## Quoi

Module pur (aucune entrée-sortie, aucune migration, rien de branché) dans `src/server/content-gen/chaine/` :

- `codes-refus.ts` : la liste FERMÉE des codes de raison de refus (les 22 du § 7.1 de la conception de la chaîne, plus quatre nouveaux : `intention_non_respectee`, `structure_titres`, `longueur_hors_fourchette`, `reponse_directe_absente`), les libellés en français simple, la correspondance B01 à B17 → code (avec précisions permises), et `codePourCritere`, `criteresPourCode`, `estReport`.
- `contrat-porte.ts` : le contrat TypeScript entre la chaîne et la porte (entrée, sortie, résultat d'un critère, classes dur / corrigeable / dérogeable / report), `publicationAutorisee` (échec fermé), `refusDepuisVerdict` (lignes prêtes pour `ContenuRefus`) et `actionApresVerdict` (réécriture ciblée, abandon, report, mise en attente, relecture humaine, dérogation ou fusion).
- Tests exhaustifs (68) dont un test de pureté du module.

## Choix à connaître

- Quand la chaîne (§ 8) et la porte (§ 5.1) se contredisent, la chaîne prime : B04 → `fait_non_source` (pas de code `reglementation`), B05 → `intention_couverte`, B06 → `doublon_semantique`, B07 → `apport_absent`, B16 → `generique` (`non_actionnable` reste propre au rôle R5). Le § 5.1 de la porte est à mettre à jour.
- Écart assumé : B08 prend par défaut `reponse_directe_absente` (code demandé pour C4), alors que le § 8 de la chaîne dit `style`. À mettre à jour dans le § 8. B11 reste `style` par défaut, avec `longueur_hors_fourchette` et `structure_titres` en précision.
- B17 est un report, jamais un refus. Un critère absent de la sortie de la porte vaut « non évalué » (échec fermé). Un « non évalué » n'est pas un refus : le contenu est mis en attente (B04 seul avec une bonne note : relecture humaine, comme le prévoit la porte).
- Un seul compteur de réécritures (`reecrituresFaites`), plafonds 2 réécritures et 3 $.

## Comment vérifier

`pnpm vitest run src/server/content-gen/chaine`, `pnpm typecheck` (aucune erreur dans ce dossier), `pnpm exec prettier --check src/server/content-gen/chaine`.

## Points connus, non traités

- Un seul résultat par critère (pas par section) et pas de validation à l'exécution de la sortie de la porte : à prévoir au branchement (C5 et suivantes).
- La dernière relecture Opus (3e tour) a relevé 3 défauts bloquants, corrigés ensuite ; le code final n'a pas été relu une 4e fois (limite de 3 tours).

VERDICT OPUS : À CORRIGER
