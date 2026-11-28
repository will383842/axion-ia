# Pages équipe D5 : hub, carte et sitemap alimentés par la base

## Quoi

- Le hub `/fr/equipe` liste, par catégorie, Williams (statique, en tête de « Direction », toujours présent même sur la base de build) puis les collaborateurs publiés. Manon reste dans son encart de transparence, jamais comptée ni placée sur la carte.
- Le JSON-LD (CollectionPage / ItemList) ne cite que Williams et les fiches indexables, par `@id` (aucun nom ni e-mail).
- La carte de France reçoit les points de `listMapPoints()` : un point par collaborateur publié avec « afficher sur la carte » et un département, de la couleur de sa catégorie ; clic = sa fiche. La liste texte équivalente suit les mêmes données. Williams n'a pas de point, sauf ligne facultative « williams » qui ne porte que le lieu (option `avecDirigeant`).
- Le sitemap ajoute seulement les fiches publiées ET indexables (`evaluerIndexabilite`). `questionnaire`, `retrait`, `carte`, Williams et Manon n'y passent pas par ce chemin.
- Nouveau module pur `src/lib/equipe/hub.ts` (composition testable sans base).

## Pourquoi

Le hub n'affichait que Williams ; la carte et le sitemap n'étaient pas branchés sur les données.

## Comment vérifier

- `pnpm vitest run src/lib/equipe src/components/equipe tests/unit/seo/sitemap-hygiene.spec.ts` : hub en stub (Williams seul), points filtrés, sitemap filtré.
- `npx tsc --noEmit`, eslint et prettier propres sur les fichiers touchés.
- Aucune migration, aucun job, aucun enum.

## Risques / restes

- Les points sont placés par département (chef-lieu) ; la ville seule, sans département, ne donne pas de point.
- First Load JS du hub : NON mesuré ici (pas de build complet dans le temps imparti) ; la carte est un composant serveur sans JS client, donc aucun JS ajouté attendu. `pnpm bundle:check` non lancé : à confirmer en CI.
- `pnpm typecheck` plante en mémoire avec le tas par défaut du runner ; passé avec `--max-old-space-size=12000`.

## Relecture Opus (SEO / données / accessibilité)

Corrigé après relecture : le sitemap écarte maintenant une fiche dont le slug serait réécrit ou refusé (même garde que le hub et la fiche) ; le titre de la carte n'est rendu que si un point est réellement placé ; l'échec de lecture du sitemap est journalisé.
Reste (non bloquant) : le hub n'a pas de repli si la base échoue au runtime (l'ISR limite le risque).

VERDICT OPUS : BON
