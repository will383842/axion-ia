# Vérifs — fix/garantie-constante-rapport

Changement : `GARANTIE` (src/content/journee-ia-commun.ts) est composée de `RAPPORT_COMPLET` (« Sous 3 jours ouvrés… », même source que `offre.ts`) + `GARANTIE_PHRASE`. Plus de « À la fin de la journée ». Usages de `GARANTIE` : landing journee-ia/contenu.ts et tests ; la garantie ×3 n'est pas touchée.

- `pnpm exec vitest run src/content/__tests__ "src/app/[locale]/journee-ia" "src/app/[locale]/__tests__/accueil-journee-ia.spec.ts"` : 917 tests verts ; 3 fichiers en échec identiques à main (client Prisma non généré, install `--ignore-scripts`).
- `pnpm exec tsc --noEmit` : aucune erreur sur les fichiers touchés.
- `eslint` + `prettier --check` sur les 3 fichiers : propres.
