# Pages équipe D2 : la fiche d'un collaborateur lit la base

## Quoi

- Nouveaux lecteurs `src/lib/equipe/collaborateurs.ts` : `getPublishedMember`, `listPublishedMembers`, `listMapPoints`. Base stub : vide, sans appeler Prisma. Table absente (P2021) : vide. Aucun `$queryRaw`. Seuls les champs publics sont lus, statut « publie », hors demande d'effacement.
- `/[locale]/equipe/[slug]` résout dans cet ordre : « williams » statique, puis collaborateur publié, puis auteur actif (Manon, rendu inchangé), sinon 404.
- Un collaborateur est rendu avec le gabarit existant : prénom seul, photo réelle seulement avec consentement photo (sinon initiales), LinkedIn seulement avec consentement LinkedIn.
- Robots : règle `evaluerIndexabilite` (index, ou `noindex, follow`).
- JSON-LD : `givenName` seul, jamais `familyName` ni e-mail, `image` et `sameAs` seulement avec consentement.
- `revaliderFicheEquipe(slug)` (fiche, hub, sitemap) branché sur toutes les actions de la console.

## Vérifier

`pnpm vitest run src/lib/equipe "src/app/[locale]/equipe" src/lib/seo`, `pnpm typecheck`.

## Risques

- La catégorie « autres » n'a pas de couleur : elle est rendue comme « partenaire » (mocha).
- Une URL LinkedIn contient souvent le nom de famille ; elle n'est publiée qu'avec le consentement LinkedIn : le texte de consentement doit le dire.
- `bundle:check` non lancé ici (aucun build disponible) ; aucun JavaScript client ajouté.
- `format:check` global échoue sur un fichier non versionné (`.mcp.json`), hors lot.

VERDICT OPUS : EN COURS
