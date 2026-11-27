Module pur des liens reçus : normalisation, CSV Search Console, statuts, score, brouillons (S10-1)

## Ce que fait cette branche

Première fiche de `docs/pilotage-seo-geo/S10-LIENS.md` (S10-1). Du code pur : aucune base, aucune migration, aucun réseau, aucune route, aucun envoi. Rien n'est branché nulle part : ce sont des briques pour les fiches suivantes. Tout est donc éteint par défaut.

Dans `src/server/seo-pilotage/liens/` :

- `normaliser.ts` : domaine (minuscules, sans `www.`), page source, chemin cible (via `normaliserChemin`), ancre tronquée à 200, plafond de 2 000 caractères. Une adresse e-mail n'est jamais prise pour un lien.
- `csv-gsc.ts` : reconnaissance du type d'export du rapport « Liens » par ses en-têtes (français et anglais) et lecture. Un fichier inconnu est refusé, jamais deviné.
- `rel.ts` : lecture de `rel` (`suivi`, `nofollow`, `ugc`, `sponsored`, listes triées, `inconnu`).
- `score.ts` : pertinence × portée × probabilité / effort, nul en cas d'opposition.
- `statuts.ts` : transitions autorisées, seul un humain fait avancer, 45 jours avant « sans réponse », relance après 30 jours et une seule, 10 brouillons prêts au plus, aucun statut « envoyé ».
- `brouillon.ts` : contrôle du texte (mêmes motifs que le chargé de liens, une seule URL, mention d'information pour une adresse nominative).
- Test « aucun envoi » : le dossier n'importe aucun module d'envoi, de file ni de réseau.

## À savoir

- Les en-têtes CSV sont des suppositions raisonnables : la fixture d'un export réel (fournie par Will) reste à ajouter pour les valider. Le fichier le dit en tête.
- Le texte de la mention d'information (RGPD) est provisoire, à valider par Will.
- Dates au format américain (`11/03/2026`) lues comme jour/mois : à trancher avec l'export réel.
- Fiches suivantes non faites : S10-2 exige une migration (tables nouvelles) ; S10-3, S10-4, S10-5, S10-6 et S10-7 en dépendent ou attendent P4/P5/une fixture. Je me suis donc arrêté après S10-1, comme demandé.

## Vérifications

`pnpm typecheck`, `vitest` ciblé (102 tests) et `prettier --check` passent.

Relecture par un sous-agent opus : trois tours. Le dernier tour a relevé des défauts (domaines sans schéma dans les brouillons, plafond du chemin cible, e-mail dans la requête, imports relatifs du verrou) que j'ai corrigés ensuite ; ces corrections n'ont pas été relues.

VERDICT OPUS : À CORRIGER

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGeXF9Sc8jf4e41EFHM
