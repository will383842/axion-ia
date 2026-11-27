# S3 — Transformations de contenu et accessibilité du corps (gabarits d'articles)

## But

Fournir, pour les futurs gabarits d'articles V2, des fonctions **pures, côté serveur**, à appliquer sur le HTML déjà passé par le sanitizer : tableaux défilants et nommés, h1 abaissé en h2, contrôle des sauts de titres, ancres stables sur les sous-titres, mention « nouvelle fenêtre » pour les lecteurs d'écran.

Ces fonctions ne sont **branchées nulle part** dans cette PR : aucun changement de rendu, quelle que soit la valeur de `BLOG_GABARITS_V2` (interrupteur éteint = balisage strictement identique). Aucun `"use client"`, aucun JS client, aucun cliquet `size-limit` touché. Le sanitizer n'est **pas** modifié (option « post-traitement après le sanitizer » retenue, donc pas de revue de sécurité de liste blanche nécessaire).

## Fichiers

- `src/server/content-gen/blog/transformations.ts` (nouveau) : `envelopperTableaux`, `abaisserH1`, `controlerTitres`, `ancrerSousTitres`, `marquerLiensExternes`, plus l'aide `idUniqueDepuis` (ids de questions de FAQ et d'étapes).
- `src/server/content-gen/blog/__tests__/transformations.spec.ts` (nouveau, 33 tests).
- `src/server/content-gen/guides/loader.ts` : `parseStepsFromBody` devient exportée (mot-clé `export` seul, comportement inchangé).
- `src/lib/knowledge/article-enrich.ts` : `slugifyHeading` devient exportée (idem) pour que les ids des sous-titres suivent exactement les règles de `buildToc`, qui reste gelé. **Seul point commun hors périmètre strict** ; S1 ne touche ni `page.tsx` ni l'aiguillage ici.

## Tests

- Entrées/sorties de chaque fonction : tableau sans caption, avec caption, plusieurs tableaux, `colspan`, tableaux imbriqués, `>` dans un attribut, `data-id`/`data-target`, attributs hors guillemets, casse mixte.
- Idempotence (double application), HTML malformé (laissé intact, sans exception), échappement des libellés.
- Les ids de `<h2>` produits par `buildToc` ne sont jamais modifiés ; unicité des ids d'étapes.
- Le module est pur (aucun DOM, `process.env`, Prisma, DOMPurify).
- `pnpm typecheck`, `eslint` sur les fichiers touchés et specs voisines : verts.

## Risques et limites connues

- `sanitizeContentGenHtml` retire déjà `<caption>` et `<h1>` : sur le blog actuel, la branche « caption existante » et `abaisserH1` n'agissent donc pas ; elles servent si la liste blanche évolue ou sur d'autres chemins. Le texte de caption laissé en vrac par le sanitizer est un défaut préexistant, non traité ici.
- Un h1 abaissé après `buildToc` reste hors sommaire et sans `data-speakable` (ordre documenté en tête du module).
- Tableaux imbriqués : seul le tableau externe est enveloppé.
- Mineur non traité : `idsPresents` utilise encore une regex large (ignore les ids sans guillemets) ; collision théorique seulement.
- Environnement : `node_modules` était absent ; installation faite avec `pnpm install --frozen-lockfile --ignore-scripts`, puis `pnpm prisma:generate` (rien de versionné).

## Relecture

Sous-agent Opus, 3 tours : tour 1 (HTML cassé avec `>` dans un attribut et tableaux imbriqués, faux positifs `data-id`/`data-target`) corrigé ; tour 2 (double encodage d'id, id/target lus dans la valeur d'un autre attribut) corrigé ; tour 3 : BON.

VERDICT OPUS : BON
