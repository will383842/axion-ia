# perf(journee-ia) : First Load JS de /fr/journee-ia (B4)

## Résumé

**Mesure faite, aucune correction de code : la page n'est pas la cause du dépassement.**
`[locale]/journee-ia` pèse environ **294 KB gz** de JS (≈ 252 KB brotli), contre un budget de 75 KB gz.
Une page quasi vide du même dépôt (`mentions-legales`, `a-propos`) pèse la même chose à 2 KB près.
Le poids vient du socle chargé par toutes les routes (layout `[locale]`, framework, polyfills, providers),
pas de la page. Alléger la page ne peut pas ramener la route sous 75 KB.

## Méthode (et ses limites)

- Build : `pnpm exec next build --webpack --experimental-build-mode compile` avec les stubs `stub.invalid`,
  `SKIP_NEXT_TYPECHECK=true`, `NODE_OPTIONS=--max-old-space-size=8192`.
- ⚠️ La commande de la consigne (sans `--webpack`) bascule sur Turbopack et échoue sur
  `src/app/questionnaire/manrope_*.module.css` (« Selector not pure », 50 erreurs). Le script `build` du dépôt
  utilise `--webpack`. Sans la mémoire portée à 8 Go, le build webpack s'arrête en OOM (SIGABRT).
- Next 16.3 n'imprime plus de tableau « First Load JS ». Le chiffre est reconstitué : somme des fichiers JS
  listés dans `page_client-reference-manifest.js` de la route + `rootMainFiles` + `polyfillFiles` de
  `build-manifest.json`, compressés un à un en gzip / brotli. C'est une approximation (une borne haute :
  elle peut compter des chunks de la route non chargés au premier affichage), pas une mesure Lighthouse.

## Tableau avant/après (KB gz)

| Route                                   | Avant                    | Après                         |
| --------------------------------------- | ------------------------ | ----------------------------- |
| `[locale]/journee-ia`                   | ≈ 293,8 (brotli ≈ 252,3) | inchangé (aucun code modifié) |
| `[locale]/mentions-legales` (référence) | ≈ 292,1                  | —                             |
| `[locale]/a-propos` (référence)         | ≈ 292,7                  | —                             |
| `[locale]/contact` (référence)          | ≈ 327,2                  | —                             |

Plus gros chunks de la route (gz) : `59298-*.js` 74,9 · `ea82adf5-*.js` (framework) 62,0 ·
`polyfills-*.js` 38,7 · `72743-*.js` 12,9 · `35824-*.js` 11,9. Les chunks propres à la page sont petits ;
l'écart avec une page vide est d'environ 1,7 KB.

## Pourquoi je ne touche pas au code

La consigne dit de ne rien modifier si la route est déjà ≤ 75 KB, et sinon d'alléger la page. Ici la route est
très au-dessus, mais l'écart ne se joue pas dans `src/app/[locale]/journee-ia/` : passer `FaqAccordion`,
`StickyMobileCta` ou `CarteDesGains` en `next/dynamic` gagnerait au mieux quelques KB sur 219 KB d'excès.
Le gros du poids est partagé (`59298-*`, framework, polyfills) et relève du chantier « shell partagé » déjà
documenté dans `AGENTS.md` (dette ouverte, cliquet à 139 KB brotli), pas d'un lot par page.
Aucun texte, aucune fonction touchés.

## Fichiers modifiés

Aucun (hors ce fichier).

## Vérifications

- `next build --webpack --experimental-build-mode compile` : OK (exit 0).
- `pnpm typecheck`, `pnpm lint`, `vitest` : non lancés, aucun code modifié.

## Relecteur Opus

Non lancé : aucun diff de code à relire.

## Suite proposée

Chantier dédié sur le chunk `59298-*` (74,9 KB gz) et les polyfills (38,7 KB gz) : identifier ce qu'ils
contiennent (`@next/bundle-analyzer`) puis décider si le budget de 75 KB par route est atteignable pour
le shell `[locale]`. À valider par Will (ADR) avant tout changement du budget.

## Note

La branche est basée sur `0c4f02e54`, antérieur à la tête de `main` ; pas de rebase (consigne). `pnpm-lock.yaml`
n'a pas changé.
