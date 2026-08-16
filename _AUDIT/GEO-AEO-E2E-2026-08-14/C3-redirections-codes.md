# C3 — Redirections & codes HTTP

- **Date** : 2026-08-14, mesures live 18:05:24 → 18:07:29 UTC (toutes AVANT l'atterrissage estimé du deploy en vol 18:30–19:00 — les codes de redirection/statuts ne dépendent pas de l'ISR, mesures valides).
- **Périmètre couvert** : `src/proxy.ts` (pipeline complet + matcher), `src/lib/legacy-redirects.ts`, `src/lib/i18n/en-to-fr-redirect.ts`, 63 règles `next.config.ts > redirects()` + `headers()`, `[locale]/[...catchall]/page.tsx`, tombstone soft-410 (`src/server/content-gen/tombstone.ts` + consommateurs blog/actualites), 410 dur `/ia-*`, `src/lib/seo-noindex-routes.ts` + X-Robots-Tag, les DEUX slug-history (`src/server/content-gen/slug-history.ts` Article, `src/lib/knowledge/slug-history.ts` KB). Live : 47 URLs testées (legacy, EN, stubs, supprimées, trailing slash, casse, `?page=`, UTM).

## Résumé exécutif

La surface redirections est **globalement saine et soignée** : `/` → 301 `/fr`, catchall = vrai 404 HTTP, 410 dur `/ia-*` caché par CF (HIT), X-Robots-Tag `noindex, follow` servi sur les stubs pSEO et absent des pages indexables, strip Set-Cookie opérationnel (`cf-cache-status: HIT` sur `/fr`), aplatissement 1 saut effectif pour les entrées mappées, portail en 307 `private, no-store`. **Aucun P0.** Deux P1 : (1) `/en/book-a-call` (ancienne URL EN canonique de la page conversion `/appel`) finit en **404** via une collision de préfixe dans `mapEnToFr` ; (2) l'historique de slugs KB est **écrit pour tous les types mais consommé uniquement par `/guides`** — un rename de glossaire/cas-concret/centre-aide/FAQ produit un 404 sec au lieu d'un 308. En P2 : chaînes à 2 sauts (miroir legacy incomplet + ordre next.config-avant-proxy sur `/en/*`), `?page=` ré-appendu à la destination + regex qui rate `page=10..19`, mapping `help-center` incohérent, casse d'URL finissant en 404.

## Findings

### [P1] `/en/book-a-call` → 301 `/fr/appel-a-call` → 404 (collision de préfixe `mapEnToFr`)

- **Symptôme** : l'ancienne URL EN canonique de la page de réservation d'appel (`/appel` ↔ EN `/book-a-call`, cf. `src/i18n/routing.ts:277`) redirige vers une URL inexistante. Pire : la règle next.config `/en/book` → `/en/book-a-call` (censée « couvrir le cas EN réactivé ») **alimente** la chaîne cassée : `/en/book` → 308 → `/en/book-a-call` → 301 → `/fr/appel-a-call` → **404**.
- **Preuve code** : `src/lib/i18n/en-to-fr-redirect.ts:96` — entrée `["/en/book", "/fr/appel"]` ; `mapEnToFr` (lignes 135-143) matche par `pathname.startsWith(enPrefix)` sans frontière de segment → `/en/book-a-call` matche `/en/book` et devient `/fr/appel` + `-a-call`. La règle amont : `next.config.ts:293-297`.
- **Preuve live** (18:05:24 UTC) : `/en/book` → 308 `https://axion-ia.com/en/book-a-call` ; `/en/book-a-call` → 301 `https://axion-ia.com/fr/appel-a-call` ; `/fr/appel-a-call` → 404.
- **Root-cause** : matching par préfixe non borné dans `mapEnToFr` + un sibling (`book-a-call`) qui partage le préfixe d'une entrée sans slash final. Au passage : l'entrée `["/en/book", "/fr/appel"]` est du **code mort** tant que EN est désactivé — next.config (qui s'exécute AVANT le middleware) 308 `/en/book` avant que le proxy ne le voie.
- **Patch prescrit** : (a) ajouter `["/en/book-a-call", "/fr/appel"]` **avant** `["/en/book", "/fr/appel"]` dans `EN_TO_FR_PREFIXES` (règle maison « match le plus long d'abord » déjà documentée en tête de fichier) ; (b) optionnel durcissement : borner le match (`pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/")`) — vérifié : aucune entrée existante ne dépend du comportement non borné (les enfants de `help`, `case-studies`, `blog/category`, `comparisons`, `glossary`… sont couverts par leur variante avec slash ou par le slice de segment complet).
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (page de conversion historiquement indexée EN + backlinks → 404 terminal ; les 301 EN→FR sont censés porter 100 % du jus).
- **Risque de régression** : très faible pour (a) ; faible pour (b) (couvert par les tests de `en-to-fr-redirect`). **Do-not-touch** : ne pas retirer la règle next.config `/en/book` → `/en/book-a-call` (utile au re-enable EN, décision AGENTS.md) ; ne pas toucher `routing.ts` ni rouvrir la question EN (décision 1 du prompt maître).

### [P1] Historique de slugs KB écrit pour TOUS les types mais consommé uniquement par `/guides` — rename = 404 sec ailleurs

- **Symptôme** : renommer le slug d'un terme de glossaire, d'un cas concret, d'un article centre-aide ou d'une FAQ via la console écrit bien une ligne `KnowledgeSlugHistory`… que personne ne lit : l'ancienne URL sert un 404 (perte totale du jus accumulé), exactement le bug qu'on a corrigé pour les Articles en 2026-05-15 (P0-5).
- **Preuve code** : écriture pour tout type — `src/server/actions/knowledge/update-entry.ts:91-100` (`tx.knowledgeSlugHistory.create` sur tout rename, `oldType: existing.type`). Consommation : grep `findRedirectFromHistory` = **un seul** consumer public, `src/app/[locale]/guides/[slug]/page.tsx:92-99`. Les pages `[slug]` de `glossaire`, `cas-concrets`, `centre-aide`, `faq`, `comparaisons`, `connaissances` : 0 occurrence (grep 18:04 UTC). Le helper lui-même prévoyait l'extension « page-par-page selon besoin » (`src/lib/knowledge/slug-history.ts:8-10`).
- **Preuve live** : non mesurable sans connaître un slug réellement renommé — **[À CONFIRMER]** côté volumétrie (C3 n'a pas l'accès DB ; un `SELECT oldType, count(*) FROM "KnowledgeSlugHistory" GROUP BY 1` par un agent autorisé, ex. A3/D5, dira si des renames non-guide existent déjà en prod).
- **Root-cause** : câblage « strangler » jamais terminé après le wire V-10 de 2026-05-22 (guides seulement).
- **Patch prescrit** : répliquer le bloc de `guides/[slug]/page.tsx:89-101` (lookup `findRedirectFromHistory` + `permanentRedirect(hit.currentPath)`) dans le chemin `notFound()` des pages `glossaire/[slug]`, `cas-concrets/[slug]`, `centre-aide/[slug]`, `faq/[slug]` avec le `oldType` correspondant (`glossary_term`, `case_study`, `help_article`, `faq`). Corriger d'abord le P2 `help-center` ci-dessous (sinon le redirect centre-aide EN pointerait vers un 404 — dormant EN off, mais autant câbler juste).
- **Effort** : M (4 pages + tests). **Impact GEO/AEO** : moyen (préserve le jus des renames futurs sur des surfaces AEO majeures — glossaire/FAQ sont des aimants de citation LLM).
- **Risque de régression** : faible — lookup uniquement dans la branche `!view` (aucun coût sur le chemin nominal) ; attention au contrat stub : `findRedirectFromHistory` passe par le Proxy stub au build (retourne null) → aucun blocage SSG. **Do-not-touch** : `src/lib/knowledge/slug-history.ts` (logique de lookup OK), `update-entry.ts` (écriture OK).

### [P2] Chaînes à 2 sauts : miroir legacy incomplet + ordre next.config-avant-proxy sur `/en/*`

- **Symptôme** : le contrat « un seul 301 » (aplatissement 0a-bis, audit 2026-06-17) n'est tenu que pour les ~30 entrées de `STATIC_LEGACY_REDIRECTS`. Tout le reste des 63 règles next.config fait 2 sauts quand l'URL arrive sans préfixe locale ; et côté `/en/*`, next.config s'exécute AVANT le proxy → 2 sauts aussi.
- **Preuve code** : `src/lib/legacy-redirects.ts:21-58` se présente comme « MIROIR des redirections de next.config » mais ne couvre PAS : `/reserver` (`next.config.ts:286`), les 17+17 renames formations (`next.config.ts:302-352`), les 10 renames blog (`next.config.ts:432-488`), `/formations/duree/*` (`:357`), les taxonomies blog supprimées (`:261`), `/blog/glossaire/formation-ia-colombes` (`:486`). Ordre d'exécution Next : redirects next.config AVANT middleware (vérifié live ci-dessous).
- **Preuve live** (18:05-18:07 UTC) :
  - `/reserver` → 301 `/fr/reserver` → 308 `/fr/appel` (2 sauts) ;
  - `/formations/ia-express` → 301 `/fr/formations/ia-express` → 308 `/fr/formations/ia-pour-bien-commencer` (2 sauts) ;
  - `/blog/tag/ia` → 301 `/fr/blog/tag/ia` → 308 `/fr/blog` (2 sauts) ;
  - `/en/faq/tools` → 308 `/en/faq/outils-ia` → 301 `/fr/faq/outils-ia` (2 sauts — preuve que next.config passe avant le proxy) ;
  - `/en/interventions/claude-dirigeant` → 308 `/en/interventions/dirigeant-vision-strategique` → 301 `/fr/...` (2 sauts).
  - Contre-exemples 1 saut (entrées mappées) : `/interventions` → 301 `/fr/formations` ; `/faq/tools` → 301 `/fr/faq/outils-ia` ; `/interventions/par-ville/lyon` → 301 `/fr/formations/par-ville/lyon` ; `/codage-developpement` → 301 `/fr/sites-web-augmentes`.
- **Root-cause** : la carte legacy n'a pas suivi les vagues de renames de juillet (formations 2026-07-19, blog 2026-08) ; et l'aplatissement EN n'a jamais existé (le proxy ne voit `/en/x` qu'après le rewrite next.config).
- **Patch prescrit** : compléter `STATIC_LEGACY_REDIRECTS` avec `/reserver→/appel`, les 34 slugs formations, les 10 slugs blog, `/formations/duree/*` (pattern), les taxonomies blog (pattern `^/blog/(tag|secteur|service|taille|auteur)/` → `/blog`) — et étendre `legacy-redirects.test.ts`. Pour les chaînes `/en/*` : optionnel, ajouter les slugs EN legacy (ex. `faq/tools` sous `/en`) dans `EN_TO_FR_PREFIXES` ne suffit PAS (next.config passe avant) ; la seule vraie sortie serait de restreindre les sources next.config à `/:locale(fr)` — **à ne faire que sur les règles sans enjeu re-enable EN**, sinon laisser (2 sauts 308→301 restent absorbés par Google).
- **Effort** : M. **Impact GEO/AEO** : faible-moyen (Google suit jusqu'à ~10 sauts et transmet le jus ; coût = latence + budget de crawl sur les vieux backlinks non préfixés).
- **Risque de régression** : faible si chaque ajout est verrouillé par `legacy-redirects.test.ts` ; moyen si on touche aux sources `(fr|en)` de next.config (re-enable EN). **Do-not-touch** : `next.config.ts` règles EN (`/en/book`), `proxy.ts` blocs 0/0a (ordre critique), matcher.

### [P2] Pagination blog : `?page=N` ré-appendu à la destination + regex qui rate `page=10..19`

- **Symptôme** : (1) `/fr/blog?page=2` → 308 `/fr/blog/page/2?page=2` — le commentaire du code affirme que « la capture nommée `num` CONSOMME le query param » ; live, il est ré-appendu → variante d'URL avec query (fragmentation cache CDN, entrée « duplicate » GSC potentielle). (2) La regex `[2-9]\d*` matche 2-9 et 20+ mais **pas 10-19** : `/fr/blog?page=12` → 200 (page 1 servie).
- **Preuve code** : `next.config.ts:274-279` — `value: "(?<num>[2-9]\\d*)"`.
- **Preuve live** (18:05:39 + 18:07:29 UTC) : `/fr/blog?page=2` → 308 `/fr/blog/page/2?page=2` ; `/fr/blog?page=3` → 308 `/fr/blog/page/3?page=3` ; `/fr/blog?page=12` → 200 ; atténuation vérifiée : `GET /fr/blog/page/2?page=2` → 200 avec `<link rel="canonical" href="https://axion-ia.com/fr/blog/page/2"/>` (18:06:42 UTC) — Google consolidera.
- **Root-cause** : comportement Next réel ≠ commentaire (le query non consommé est repassé même quand la capture est référencée) ; regex quantifiée à tort (`[2-9]\d*` ≠ « N ≥ 2 »).
- **Patch prescrit** : `value: "(?<num>[2-9]|[1-9]\\d+)"` (couvre 2-9 et 10+) ; pour la query résiduelle, soit l'accepter (canonical propre, zéro risque), soit normaliser dans `proxy.ts` (301 vers l'URL nue) — la boucle est impossible (la source `/:locale/blog` est exacte, `/blog/page/N` ne rematche pas).
- **Effort** : S. **Impact GEO/AEO** : faible (canonical déjà correct). **Risque de régression** : très faible ; **do-not-touch** : ne pas ajouter de règle pour `?page=1` (boucle de 301 documentée `next.config.ts:270-273`).

### [P2] `kbTypeToPublicPath` : `help_article` EN → `/help-center/` alors que la route déclarée est `/help/[slug]`

- **Symptôme** : le chemin public calculé pour un article centre-aide EN est `/en/help-center/<slug>`, qui n'existe pas — la route déclarée est `/en/help/[slug]`. Dormant (EN désactivé + site FR-only, décision 1), mais deviendrait un « 308 vers 404 » le jour où le P1 slug-history est câblé sur centre-aide.
- **Preuve code** : `src/lib/knowledge/slug-history.ts:42` (`/help-center/`) vs `src/i18n/routing.ts:267-268` (`en: "/help"`, `en: "/help/[slug]"`).
- **Preuve live** : non applicable (aucun consumer en prod — code dormant). **[À CONFIRMER]** sans objet côté live.
- **Root-cause** : convention répliquée à la main en 2026-05-22, désynchronisée du routing.
- **Patch prescrit** : `"/help/"` au lieu de `"/help-center/"` (et vérifier les autres branches EN de la fonction contre `routing.ts` au passage). **Effort** : S. **Impact** : faible (préventif). **Risque** : nul. **Do-not-touch** : `routing.ts`.

### [P2] Casse d'URL : `/FR/audit` → chaîne 301 finissant en 404

- **Symptôme** : un préfixe locale en majuscules produit `/FR/audit` → 301 `/fr/FR/audit` → 404 : la règle 0bis préfixe `/fr` sans reconnaître `FR` comme locale, fabriquant une chaîne qui atterrit en 404 (au lieu d'un 404 direct ou d'une normalisation).
- **Preuve code** : `src/proxy.ts:133-139` — `firstSeg === "fr" || firstSeg === "en"` (sensible à la casse).
- **Preuve live** (18:05:39 + 18:06:04 UTC) : `/FR/audit` → 301 `https://axion-ia.com/fr/FR/audit` → 404. Par ailleurs `/fr/Audit` → 404 direct (comportement standard Next, OK).
- **Root-cause** : pas de normalisation de casse du segment locale avant 0bis.
- **Patch prescrit** : dans 0bis, comparer `firstSeg.toLowerCase()` et, si `FR`/`EN` détecté en casse non canonique, 301 vers le chemin en locale minuscule (le reste du path inchangé). Alternative : ne rien faire (surface quasi nulle — aucun signal GSC connu sur ce motif).
- **Effort** : S. **Impact GEO/AEO** : faible. **Risque** : faible (bien tester `/FRactice` etc. — ne matcher que le segment exact). **Do-not-touch** : la casse du RESTE du chemin (les slugs sont légitimement sensibles à la casse).

### [P2] Tombstone = soft-410 (HTTP 200 + noindex), pas un vrai 410 — compromis V1 documenté, à garder en tête

- **Symptôme** : un article archivé/rollback sert un 200 avec `<meta robots noindex,nofollow>` + page « ressource retirée » — pas un statut 410. Seule la famille fantôme `/ia-*` a un vrai 410.
- **Preuve code** : `src/server/content-gen/tombstone.ts:14-24` (compromis explicitement documenté : App Router n'a pas d'équivalent natif de `notFound()` pour 410 ; V2 = middleware + lookup edge) ; consumers : `blog/[slug]/page.tsx:272-278`, `actualites/[slug]/page.tsx:240`. Vrai 410 : `proxy.ts:85-96`.
- **Preuve live** (18:06:42 UTC) : `/fr/ia-paris` → 410 `Cache-Control: public, max-age=86400, s-maxage=604800`, `cf-cache-status: HIT` (l'origin n'est plus tapée — conforme au design). Soft-410 article : **[À CONFIRMER]** — impossible de tester sans connaître un slug archivé (pas d'accès DB pour C3).
- **Root-cause** : limitation framework, choix assumé (IndexNow `URL_DELETED` couvre Bing/Perplexity en parallèle).
- **Patch prescrit** : aucun patch urgent — c'est un compromis acté et fonctionnel (noindex ≈ 410 pour Google d'après le fichier). Si un jour V2 : liste de slugs tombstone poussée vers un KV edge + réponse 410 dans `proxy.ts` (pattern identique au bloc `/ia-*`). **Effort** V2 : M. **Impact** : faible. **Risque** : nul (aucun changement).

## Ce qui est SAIN (vérifié, ne pas re-signaler)

| Contrôle | Preuve live (UTC) | Verdict |
|---|---|---|
| `/` → 301 `/fr` (pas 307) | 18:05:24 | ✅ conforme audit 2026-06-17 |
| Catchall vrai 404 | `/fr/page-bidon-xyz` → 404 (18:05:39) | ✅ pas de soft-404 |
| 410 `/ia-*` (préfixé, nu, cache CF) | `/fr/ia-paris` 410 HIT, `/ia-caen` 410 (18:05:39, 18:06:42) | ✅ |
| X-Robots-Tag stubs pSEO | `tourcoing` (audit) + `bassens-73` = `noindex, follow` ; `paris` = absent (18:06:04) | ✅ header servi, pas de faux positif |
| Strip Set-Cookie pages publiques | GET `/fr` : 0 Set-Cookie, `cf-cache-status: HIT` (18:06:42) | ✅ cache CDN débloqué |
| Cookie UTM | `/fr/tarifs?utm_source=…` → `Set-Cookie: axion_utm` (18:06:42) | ✅ conforme 3ter |
| Portail | `/fr/portail/mon-espace` → 307 + `Cache-Control: private, no-store` (18:06:42) | ✅ |
| Trailing slash | `/fr/audit/` → 308 `/fr/audit`, 1 saut (18:05:39) | ✅ |
| Query préservée sur redirect | `/interventions?utm_source=x` → 301 `/fr/formations?utm_source=x` (18:07:29) | ✅ |
| `sitemap.xml` | → 308 `/sitemap-index.xml`, 1 saut (18:05:39) | ✅ |
| Mappings EN profonds | `/en/audit/strategic-pme`, `/en/case-studies/industry/sante`, `/en/one-to-one`, `/en/audit/by-city/lyon`, `/en/help`, `/en/glossary` → 301 direct vers la canonique FR (18:06-18:07) | ✅ 1 saut |
| Slug encodé | `/fr/audit/cibl%C3%A9` → 308 `/fr/audit/cible` (18:06:04) | ✅ |
| `/devenir-commercial-ia/<ville>` | → 301 page France (18:06:04) | ✅ |

## Mesures brutes (47 URLs, 2026-08-14 18:05:24 → 18:07:29 UTC, curl sans -L, 1 saut affiché par ligne)

| URL testée | Code | Location |
|---|---|---|
| `/` | 301 | `/fr` |
| `/fr` | 200 | — |
| `/en/about` | 301 | `/fr/a-propos` |
| `/en/blog` | 301 | `/fr/blog` |
| `/en/book` | 308 | `/en/book-a-call` ⚠️ |
| `/en/book-a-call` | 301 | `/fr/appel-a-call` ⚠️ |
| `/fr/appel-a-call` | 404 | — ⚠️ |
| `/a-propos` | 301 | `/fr/a-propos` |
| `/interventions` | 301 | `/fr/formations` |
| `/faq/tools` | 301 | `/fr/faq/outils-ia` |
| `/reserver` | 301 | `/fr/reserver` (chaîne) |
| `/fr/reserver` | 308 | `/fr/appel` |
| `/formations/ia-express` | 301 | `/fr/formations/ia-express` (chaîne) |
| `/fr/formations/ia-express` | 308 | `/fr/formations/ia-pour-bien-commencer` |
| `/blog/tag/ia` | 301 | `/fr/blog/tag/ia` (chaîne) |
| `/fr/blog/tag/ia` | 308 | `/fr/blog` |
| `/fr/blog?page=2` | 308 | `/fr/blog/page/2?page=2` ⚠️ query |
| `/fr/blog?page=3` | 308 | `/fr/blog/page/3?page=3` ⚠️ query |
| `/fr/blog?page=12` | 200 | — ⚠️ regex 10-19 |
| `/fr/blog?page=1` | 200 | — (voulu) |
| `/fr/blog/page/2?page=2` | 200 | canonical `/fr/blog/page/2` ✅ |
| `/fr/ia-paris` | 410 | — (CF HIT) |
| `/ia-caen` | 410 | — |
| `/en/ia-paris` | 301 | `/fr/ia-paris` (2 sauts vers 410, URLs poubelle — acceptable) |
| `/fr/page-bidon-xyz` | 404 | — |
| `/fr/audit/` | 308 | `/fr/audit` |
| `/FR/audit` | 301 | `/fr/FR/audit` (chaîne → 404) ⚠️ |
| `/fr/FR/audit` | 404 | — |
| `/fr/Audit` | 404 | — |
| `/sitemap.xml` | 308 | `/sitemap-index.xml` |
| `/fr/devenir-commercial-ia/lyon` | 301 | `/fr/devenir-commercial-ia` |
| `/fr/interventions/par-ville/lyon` | 308 | `/fr/formations/par-ville/lyon` |
| `/interventions/par-ville/lyon` | 301 | `/fr/formations/par-ville/lyon` (aplati ✅) |
| `/en/audit/strategic-pme` | 301 | `/fr/audit/strategique-pme` |
| `/fr/audit/cibl%C3%A9` | 308 | `/fr/audit/cible` |
| `/en/help` | 301 | `/fr/centre-aide` |
| `/fr/portail/mon-espace` | 307 | `/fr/portail/demander-acces` (`private, no-store`) |
| `/implantations/auvergne-rhone-alpes/grenoble/audits` | 301 | `/fr/audit` (aplati ✅) |
| `/fr/audit/par-ville/tourcoing` | 200 | `x-robots-tag: noindex, follow` ✅ |
| `/fr/audit/par-ville/paris` | 200 | pas de x-robots-tag ✅ |
| `/fr/implantations/auvergne-rhone-alpes/bassens-73` | 200 | `x-robots-tag: noindex, follow` ✅ |
| `/fr/tarifs?utm_source=test&utm_medium=aud` | 200 | `Set-Cookie: axion_utm` (BYPASS voulu) |
| `/en/faq/tools` | 308 | `/en/faq/outils-ia` (chaîne 2 sauts) ⚠️ |
| `/en/glossary` | 301 | `/fr/glossaire` |
| `/en/one-to-one` | 301 | `/fr/un-a-un` |
| `/en/case-studies/industry/sante` | 301 | `/fr/cas-concrets/secteur/sante` |
| `/interventions/claude-dirigeant` | 301 | `/fr/interventions/dirigeant-vision-strategique` (aplati ✅) |
| `/codage-developpement` | 301 | `/fr/sites-web-augmentes` (aplati ✅) |
| `/en/interventions/claude-dirigeant` | 308 | `/en/interventions/dirigeant-vision-strategique` (chaîne 2 sauts) |
| `/fr/interventions/claude-dirigeant` | 308 | `/fr/interventions/dirigeant-vision-strategique` |
| `/interventions?utm_source=x` | 301 | `/fr/formations?utm_source=x` (query préservée ✅) |
| `/en/audit/by-city/lyon` | 301 | `/fr/audit/par-ville/lyon` |
| GET `/fr` | 200 | 0 Set-Cookie, `cf-cache-status: HIT` ✅ |
| HEAD `/fr` | 200 | `cf-cache-status: HIT` ✅ |

Volumes code : 63 règles `permanent: true` dans `next.config.ts` (comptées 18:04 UTC) ; ~30 entrées + 2 patterns dans `legacy-redirects.ts` ; 96 lignes de mappings `EN_TO_FR_PREFIXES`.

## Limites

- **Pas d'accès DB** (C3 hors liste des agents autorisés) : impossible de mesurer les volumes réels `ArticleSlugHistory` / `KnowledgeSlugHistory` (le P1 slug-history KB est prouvé côté code, la volumétrie prod reste [À CONFIRMER] par A3/D5) ni de tester le soft-410 sur un slug d'article réellement archivé.
- **EN_LOCALE_ENABLED=true non testable** (aucune écriture env prod autorisée) : les règles « cas EN réactivé » de next.config sont auditées sur code seul.
- Les chaînes ont été suivies manuellement saut par saut (pas de `-L`) sur un échantillon représentatif de chaque famille de règles — pas sur les 63 règles exhaustivement (les familles formations/blog partagent le même générateur `.map()`, une mesure par famille suffit).
- Déploiement GH Actions en vol pendant l'audit (parti 17:33 UTC) : toutes les mesures datent de 18:05-18:07 UTC, avant l'atterrissage estimé — les comportements testés (proxy/next.config) sont identiques entre l'image en prod et `main` (aucun diff sur ces fichiers dans la branche locale).
