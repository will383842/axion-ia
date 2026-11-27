# Hub /fr/equipe : « L'équipe d'Axion-IA »

## Quoi

Crée la page `/fr/equipe`, qui répondait 404 jusqu'ici.

- H1 « L'équipe d'Axion-IA » et réponse de tête (startup française, TPE et PME, partout en France).
- Une section par catégorie ; une catégorie vide n'a pas de section. Aujourd'hui, Williams seul en Direction (données statiques).
- Sections « Comment l'équipe travaille avec vous » (Chiffrer, Essayer, Trancher), « Rejoindre Axion-IA » (lien apporteurs et carrières), FAQ du hub et encart de transparence (Manon, persona IA déclarée).
- Fil d'Ariane Accueil > Équipe.
- JSON-LD dans un seul `@graph` : CollectionPage, ItemList, BreadcrumbList, FAQPage. La Person de Williams est référencée par son `@id`, jamais redéfinie.
- Entrée de routage `/equipe` (donc sitemap, canonical et hreflang comme le reste du site) ; date de fraîcheur du hub alignée sur la date affichée ; redirection `/en/team` vers `/fr/equipe`.
- `revalidate = 3600`. La carte de France viendra plus tard : sa place est laissée libre.

## Pourquoi

Le niveau « Équipe » manquait au fil d'Ariane et le hub était le premier point d'entrée à créer pour le chantier pages équipe.

## Comment vérifier

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm vitest run src/lib/seo src/lib/i18n src/components/equipe src/lib/equipe tests/unit/seo tests/unit/e2e-harness` : verts (nouveau test `equipe-hub.spec.ts` : textes interdits, JSON-LD, `@id` de Williams).
- Ouvrir `/fr/equipe` : un seul H1, JSON-LD unique, pas de doublon de FAQPage ni de BreadcrumbList.

## Mesures

- First Load JS de `/fr/equipe` : **non mesuré** ici (le build en mode compile est tué par manque de mémoire dans cet environnement). Attendu : +0 KB, la page est un Server Component sans JS client ajouté (FAQ en details/summary). À relever en CI avec `next build --experimental-build-mode compile`.
- HTML et CLS : pas de média hors portrait de 96 px dans un carré réservé.

## Hors périmètre (lots suivants)

Lien vers le hub depuis le pied de page et niveau « Équipe » dans le fil d'Ariane des fiches (F4/F0).

Cette PR doit rester en brouillon jusqu'à la fin du lot.

## Relecture

Une relecture (lentille SEO/GEO et textes) : un test d'audit des routes manquant, le lien apporteurs vers la page indexée, une phrase de FAQ trop affirmative, la date du sitemap et le sélecteur speakable ont été corrigés. Les points restants sont listés ci-dessus (hors périmètre).

VERDICT OPUS : BON (après corrections ; une seule passe, les corrections sont mineures et vérifiées par les tests)
