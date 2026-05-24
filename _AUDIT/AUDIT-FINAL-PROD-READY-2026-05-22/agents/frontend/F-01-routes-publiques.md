# F-01 Routes publiques

## Score : 22/25 — 🟢

## Findings (preuves)

1. **Inventaire pages publiques** : 124 fichiers `page.tsx` sous `src/app/[locale]/` (hors admin) + 1 `maintenance/page.tsx` racine + 1 `not-found.tsx` racine et locale-scoped. Couverture complète des 5 verticales annoncées (`interventions`, `audit`, `un-a-un`, `implementation`, `codage-developpement`/`sites-web-augmentes`) — voir liste enumérée via `Get-ChildItem`.

2. **Layout root locale** (`src/app/[locale]/layout.tsx:91-138`) : `generateMetadata()` émet titre/description i18n + `metadataBase = SITE_URL` + `alternates.languages` (fr / en / x-default) + OG + twitter + robots index/follow + verification GSC/Bing conditionnelle. Viewport SSOT v16 séparée (`viewport` export ligne 79).

3. **Pages canoniques majeures présentes** : `/page.tsx` (home), `/a-propos`, `/audit` + 6 sous-pages (`/cible`, `/demande`, `/flash`, `/par-ville/[ville]`, `/strategique-eti`, `/strategique-pme`), `/blog` + 7 facettes (`auteur/[slug]`, `categorie/[slug]`, `secteur/[slug]`, `service/[slug]`, `tag/[slug]`, `taille/[slug]`, `[slug]`), `/cas-concrets` + `secteur/[slug]` + `[slug]`, `/centre-aide` + `categorie/[slug]` + `[slug]`, `/contact`, `/galerie` + 4 sub, `/glossaire/[slug]`, `/guide-ia`, `/guides/[slug]`, `/implantations/[region]/[ville]`, `/implementation/*` (12 sous-routes), `/interventions/*` (21 sous-routes incl. mega-menu), `/presse/[slug]`, `/reserver`, `/recherche`, `/rgpd`, `/stack-ia/[tool]`, `/un-a-un/par-ville/[ville]`, `/transparence`.

4. **Pages légales toutes présentes** : `/mentions-legales`, `/conditions-generales` (CGV), `/politique-confidentialite`, `/rgpd`, `/cookies`, `/preferences-cookies`, `/sous-processeurs`, `/accessibilite`, `/desabonnement`, `/mes-donnees` (+ `/export`), `/charte-editoriale`, `/corrections`, `/politique-deplacement`.

5. **Home (`src/app/[locale]/page.tsx:36-51`)** : `generateMetadata` appelle `buildProductMetadata` avec titre FR « Formation IA · Audit · Coaching & Implémentation · Axion-IA » + description multilingue dérivée du SSOT `pricing.ts`. JSON-LD FAQ Speakable émis ligne 215 + 1309.

6. **Pages dynamiques avec `generateStaticParams` + ISR `revalidate=3600`** : ex. `src/app/[locale]/blog/[slug]/page.tsx:34-46` + tombstone/redirect 410 management ligne 53-62.

7. **`/[...catchall]/page.tsx`** : route catch-all présente (anti-404 silencieux).

## P0 bloquants prod

- **Aucun** route majeure ne manque.

## P1 importants

- `internal-link-catalog.ts:20-83` référence 4 URLs **inexistantes** (`/audits` au lieu de `/audit`, `/interventions-formations` au lieu de `/interventions`, `/implementations` au lieu de `/implementation`, `/tarifs` n’existe pas). Risque 404 dans les articles content-gen → voir F-07.
- `src/app/[locale]/components/page.tsx` + `/design` + `/sections` exposés mais protégés par `EXCLUDED_FROM_INDEX` dans sitemap + Disallow robots.

## P2 polish

- Pas de `generateStaticParams` détecté pour `/centre-aide/[slug]` à vérifier au build.

## Verdict

Couverture URL exhaustive et bien structurée. Les 5 verticales sont toutes présentes avec déclinaisons pSEO villes/régions. Pages légales complètes (D7 société FR). Le SSOT `pricing.ts` + `buildProductMetadata` garantit cohérence metadata. Le bug du catalog de liens internes est tracé dans F-07 — pas bloquant pour l’indexation routes publiques elles-mêmes mais risque réel d’émettre des `<a href="/audits">` cassés dans 100 % des articles content-gen. Score 22/25 ; -3 pour le catalog interne cassé et l’absence de vérification SSG des slugs centre-aide.
