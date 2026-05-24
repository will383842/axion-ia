# A21 — Cleanup §5 verification

## Statut : ⚠️ Leftover JSDoc only

Tous les artefacts code-actifs annoncés comme supprimés sont effectivement absents de `axionia/src/`. Les seuls résidus sont des références textuelles dans des blocs JSDoc / commentaires d'historique de refactor (traçabilité), ce qui correspond à la sémantique « 0 leftover sauf JSDoc/\_AUDIT/ » du brief §5.

## Table grep

Périmètre : `axionia/src/**` (exclusions implicites : `_AUDIT/`, `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`, `coverage/`).

| Pattern                           | Count total | Code-actif                     | JSDoc only | Sample paths                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ----------- | ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CoverageNewV2`                   | 0           | 0                              | 0          | (aucun)                                                                                                                                                                                                                                                                                                                                               |
| `CoverageWizardClient`            | 2           | 0                              | 2          | `axionia/src/server/actions/content-gen/city-equity.ts:23`, `axionia/src/server/actions/content-gen/city-equity.ts:136`                                                                                                                                                                                                                               |
| `BatchesV2.tsx`                   | 0           | 0                              | 0          | (aucun)                                                                                                                                                                                                                                                                                                                                               |
| `landing-ville-templates.ts`      | 7           | 0                              | 7          | `axionia/src/server/content-gen/generators/landing-ville.ts:5`, `:31`, `:44` ; `landing-ville-shared.ts:4` ; `landing-ville-by-vertical-interventions.ts:8` ; `landing-ville-by-vertical-implementations.ts:8` ; `landing-ville-by-vertical-audits.ts:8` ; `landing-ville-by-vertical-un-a-un.ts:10` ; `landing-ville-by-vertical-sites-web-ia.ts:10` |
| `dailyBatchSize`                  | 0           | 0                              | 0          | (aucun)                                                                                                                                                                                                                                                                                                                                               |
| `landing-variants` (dir / chemin) | 3           | 1 (LandingVariantsV2 légitime) | 2          | JSDoc : `axionia/src/server/actions/content-gen/_settings.ts:27`, `axionia/src/server/content-gen/generators/landing-ville.ts:31`. Code-actif légitime : `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/landing-variants/_v2/LandingVariantsV2.tsx:55` (href interne)                                                                    |

### Détails leftovers JSDoc (échantillon textuel)

- `city-equity.ts:23` : `/** Alias de citySlug — compatibilité CoverageWizardClient. */`
- `city-equity.ts:136` : `* Version simplifiée utilisée par CoverageWizardClient pour afficher`
- `landing-ville.ts:5` : `* variants dans \`landing-ville-templates.ts\` (4 variants tactiques).`
- `landing-ville.ts:31` : `* (tests, admin /content-gen/landing-variants, dispatch ad-hoc Session 6).`
- `landing-ville.ts:44` : `* \`templateVariant\` provient de l'ancien \`landing-ville-templates.ts\`.`
- `landing-ville-shared.ts:4` : `* Refactor \`landing-ville-templates.ts\` (4 variants tactiques) → 5 generators`
- `landing-ville-by-vertical-*.ts` (5 fichiers) : `* Migration depuis \`landing-ville-templates.ts\` variant \`focus\_\*\``
- `_settings.ts:27` : `* onboarding, rss, landing-variants) sont déjà protégées par le middleware`

### Fichiers physiques

- `CoverageNewV2*` : 0 fichier (Glob vide).
- `BatchesV2*` : 0 fichier (Glob vide).
- `landing-ville-templates*` : 0 fichier (Glob vide).
- `CoverageWizard*` : 0 fichier (Glob vide).
- `landing-variants/` directory : présent et conforme — contient uniquement `page.tsx`, `[variant]/page.tsx`, `_v2/LandingVariantsV2.tsx`, `[variant]/_v2/LandingVariantDetailV2.tsx`.

## Verdict / écarts trouvés

- 🟢 `CoverageNewV2` : 0 leftover. Phase 3 cleanup respectée.
- 🟢 `CoverageWizardClient` : 0 code-actif. 2 mentions purement JSDoc dans `city-equity.ts` (alias backward-compat documenté). Acceptable §5.
- 🟢 `BatchesV2.tsx` : 0 leftover total.
- 🟢 `landing-ville-templates.ts` : 0 fichier, 0 import. 7 mentions textuelles dans les en-têtes JSDoc des 7 generators issus du refactor Phase 5 c1 — c'est la trace d'historique attendue.
- 🟢 `dailyBatchSize` : 0 leftover. Retrait Phase 3 confirmé.
- 🟢 `landing-variants/` directory : aucune occurrence code-actif suspecte. Le seul `href` actif pointe vers la route admin légitime via `LandingVariantsV2.tsx`.
- ✅ Décision « LandingVariantsV2.tsx PRÉSERVÉ » respectée : **oui** — fichier présent à `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/landing-variants/_v2/LandingVariantsV2.tsx`, et son pendant détail `LandingVariantDetailV2.tsx` également présent.
- Aucun écart code-actif détecté. Aucune action corrective requise.
