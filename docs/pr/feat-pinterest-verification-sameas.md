## Contenu
- `layout.tsx` : meta `p:domain_verify` (valeur publique, constante, toujours émise) via `verification.other`, fusionnée avec `msvalidate.01` (Bing, conditionnel). Next rend `verification.other` en `<meta name=...>`.
- `seo.ts` : `https://www.pinterest.com/axion_ia/` dans `ORGANIZATION_SAME_AS` (reprise partout par le test d'entité unique).
- Analytics admin : carte « Pinterest » au statut ok.

## Racine
`src/proxy.ts` (l.184) : `/` répond en 301 vers `/fr`. La balise est donc sur `/fr`, pas sur la réponse de `/`. Pinterest suit en général les redirections ; sinon, passer par le fichier HTML de vérification.

## Tests
Non exécutés dans cet environnement : `node_modules` est en lecture seule (EROFS), `pnpm install` a échoué, donc ni `tsc --noEmit` ni vitest. Le correctif s'est appliqué proprement sur main (`git apply --3way`). À vérifier par la CI. `bundle:check` non lancé (demande un build).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
