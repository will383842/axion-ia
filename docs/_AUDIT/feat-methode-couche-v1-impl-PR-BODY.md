## Couche « Méthode » v1 : collection séparée, point d'entrée unique, interrupteur éteint

Décision : ADR 0076 (`docs/adr/0076-couche-methode-collection-separee.md`). Mode d'emploi :
`docs/knowledge/COUCHE-METHODE.md`.

> ⚠️ La branche `feat/methode-couche-v1` (commit `2dea98f0`) porte un autre ADR 0076,
> écrit en parallèle par une autre session : n'en fusionner qu'une.

### Ce que fait la PR

- **Aucune migration, aucune table** : réutilise `KnowledgeEntry`, `KnowledgeTranslation`,
  `KnowledgeCollection(Item)`, `KnowledgeTag`, et la colonne `search_vector` existante.
- `src/server/methode/decoupage.ts` (pur) : découpe les fiches du dépôt de marque
  (`methode/`) en fiches `methode/<fichier>/<section>` ; étiquettes `livre:*`, `type:*`,
  `chiffres-exercice` (+ avertissement en tête), `secteur:sante`, `doctrine:a-revoir`.
- `scripts/methode/importer-methode.ts` : **essai à blanc par défaut**, écriture seulement
  avec `--ecrire` ; idempotent sur le slug, jamais de suppression, jamais de publication
  (`approved` / `team` / `internal`).
- `src/server/methode/index.ts` : `obtenirContexteMethode({ sujet, secteur?, max? })` →
  `{ noyau, extraits[] }`. Santé seulement si `secteur = "sante"` ; fiches
  `doctrine:a-revoir` jamais servies.
- Interrupteur `METHODE_ACTIVE` (défaut éteint) dans `src/env.ts` et `.env.example` :
  éteint, contexte vide, base jamais lue.
- MCP : outil en lecture `axionia.methode.contexte` (registre, symboles autorisés,
  jeu maximal, manifeste régénéré).
- content-gen : `blocMethodePourPromptSysteme(nature)` pour `mail` / `offre` / `script`
  uniquement. Aucun générateur SEO public n'est branché. Chatbot public non touché.

### Cloisonnement

Trois verrous indépendants empêchent une fiche de sortir par la recherche publique
(`searchKnowledge` exige `published`/`deprecated`, `confidentiality = public`, audience
demandée `public`). Rien dans le sitemap ni les pages.

### Vérifications

Voir `docs/_AUDIT/feat-methode-couche-v1-impl-VERIFS.md` : vitest ciblé 69/69 (+ 219/219
voisins), `tsc --noEmit` vert, ESLint et Prettier verts sur les fichiers touchés, essai à
blanc de l'import (356 fiches).

### Après fusion (décisions de Williams)

1. Import réel : `pnpm tsx scripts/methode/importer-methode.ts <methode/> --ecrire`.
2. Allumer `METHODE_ACTIVE=true` (Coolify, portée RUN).
3. Réécrire dans la source les 18 fiches `doctrine:a-revoir` (surtout des mises en
   situation situées dans une ville nommée), puis réimporter.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Qdj3f5MPxa4bJFY8mRWweN
