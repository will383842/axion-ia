# A1 — Robots & politiques IA

- **Date** : 2026-08-14, mesures live 17:49–17:51 UTC (curl GET/HEAD only)
- **Périmètre couvert** : `src/app/robots.ts` (+ `robots.spec.ts`), `src/app/ai.txt/route.ts`, `src/app/.well-known/ai-policy.json/route.ts`, `src/app/.well-known/security.txt/route.ts`, cohérence croisée avec `src/app/llms.txt/route.ts` (surface A5, consultée pour cohérence uniquement), exclusions middleware `src/proxy.ts`, diff code vs prod sur les 4 fichiers.
- **Contexte deploy** : run GH Actions parti 17:33 UTC, non atterri au moment des mesures → les mesures reflètent le deploy stable de ~14:57 UTC. Les 4 fichiers sont 100 % code-driven (aucune DB), donc AUCUNE fenêtre ISR ne peut fausser ces mesures.

## Résumé exécutif

Les 4 fichiers de politique répondent 200 en prod et sont **byte-identiques au code** (diff = 0). La doctrine « bloquer training / garder citation » (décision actée n°2) est correctement implémentée dans robots.txt, verrouillée par 8 tests (`robots.spec.ts`), et les invariants `/api/og`, `/api/markdown/`, `/logos/clients/` sont intacts code + live. Le middleware exclut bien `.txt` et `.well-known/` (pas de 301 locale parasite). **Trois vraies failles de cohérence** subsistent : (1) `ai.txt` contient `Allow: /` qui, au sens du standard Spawning qu'il cite lui-même en en-tête, **opt-IN le site entier au training** — l'inverse exact de la doctrine ; (2) `ai-policy.json` déclare `license: CC-BY-4.0` au niveau site entier, ce qui contredit juridiquement `training.allowed: false` ; (3) robots.txt bloque `/api/observatoire/export-csv` pourtant annoncé « données ouvertes » dans llms.txt — récidive de la classe de bug `/api/markdown` corrigée en 2026-07-20. Aucun P0 : rien ne casse la visibilité aujourd'hui.

## Findings

### [P1] ai.txt : `Allow: /` = opt-IN au training au sens du standard Spawning cité par le fichier lui-même

- **Symptôme** : le bloc global d'`ai.txt` publie `User-Agent: *` + `Allow: /`, puis tente d'annuler cette permission avec une directive non standard `ai-training: disallow`.
- **Preuve code** : `src/app/ai.txt/route.ts:33-34` (`User-Agent: *` / `Allow: /`) ; l'en-tête `route.ts:28` revendique « Standard: Spawning.ai / IAB AI Preferences (draft 2025) ».
- **Preuve live** : curl `https://axion-ia.com/ai.txt` 2026-08-14 17:49:57 UTC → 200, mêmes lignes `User-Agent: *` / `Allow: /` / `ai-training: disallow`.
- **Root-cause** : dans le format Spawning (« mirroring robots.txt » ; « By default all content is opted out… selecting allow for any content type will let data miners know that they may use content on your website of that media type » — doc Spawning consultée 2026-08-14 via recherche web, la page generator étant JS-only), `Allow`/`Disallow` portent la permission de **training/dataset**, pas la permission de crawl. Un parseur conforme Spawning lit donc « tout le site autorisé au training » et **ignore** les lignes `ai-training:` qui n'existent pas dans ce format. Le fichier mélange deux grammaires et c'est la permissive qui gagne.
- **Patch prescrit** : dans le bloc global, remplacer `Allow: /` par `Disallow: /` (sémantique training Spawning = refus par défaut), ou supprimer purement la paire Allow et laisser le refus par défaut + les directives `ai-training:` commentées comme informatives. Ajouter un commentaire expliquant que la permission de CRAWL/citation vit dans robots.txt, pas ici. ⚠️ Avant patch, re-vérifier la grammaire Spawning sur un ai.txt généré réel (limite ci-dessous).
- **Effort** : S (1 ligne + commentaire).
- **Impact GEO/AEO** : moyen — ne touche pas la visibilité citation (les bots de citation lisent robots.txt, pas ai.txt) mais c'est la moitié « bloquer training » de la doctrine qui est publiée à l'envers dans un des 4 canaux.
- **Risque de régression** : quasi nul — ai.txt n'est consulté par aucun bot de search/citation. **Do-not-touch** : `src/app/robots.ts` (rien à y changer), `robots.spec.ts`, llms.txt.

### [P1] ai-policy.json : `license: CC-BY-4.0` site entier contredit `training.allowed: false`

- **Symptôme** : le fichier machine-readable destiné aux opérateurs IA déclare simultanément une licence CC BY 4.0 au niveau publisher (grant irrévocable de reproduction/adaptation, y compris commerciale, contre simple attribution) ET une interdiction de training « without a written agreement ».
- **Preuve code** : `src/app/.well-known/ai-policy.json/route.ts:12` (`license: "CC-BY-4.0"`) vs `route.ts:18-21` (`training.allowed: false`) ; cf. aussi `src/app/ai.txt/route.ts:92-96` (`commercial-reuse-license` = accord écrit exigé).
- **Preuve live** : curl `https://axion-ia.com/.well-known/ai-policy.json` 2026-08-14 17:49:57 UTC → 200, JSON identique au code.
- **Root-cause** : la licence CC BY 4.0 est réelle mais **scopée** à deux surfaces seulement — la banque d'images (`/fr/galerie`, décision produit) et l'export Observatoire (« Données ouvertes CC BY 4.0 », `src/app/llms.txt/route.ts:104,132`). Elle a été remontée par erreur au champ `license` racine, qui se lit comme la licence de TOUT le contenu du site. Un opérateur IA (ou son juriste) peut s'appuyer sur ce grant déclaré pour ingérer/entraîner : une licence effective prime sur une note d'interdiction contradictoire dans le même document.
- **Patch prescrit** : `license: "Proprietary — see https://axion-ia.com/fr/mentions-legales"` au niveau racine, + un tableau scopé, p. ex. `licenses: [{ "scope": "https://axion-ia.com/fr/galerie", "license": "CC-BY-4.0" }, { "scope": "https://axion-ia.com/api/observatoire/export-csv", "license": "CC-BY-4.0" }]`.
- **Effort** : S.
- **Impact GEO/AEO** : moyen (protection du contenu + cohérence du signal ; aucune perte de citation).
- **Risque de régression** : nul — fichier purement déclaratif, aucun code ne le parse en interne. **Do-not-touch** : la licence CC BY 4.0 de la banque d'images elle-même et de l'export Observatoire (décisions produit, elles restent CC BY 4.0).

### [P1] robots.txt bloque `/api/observatoire/export-csv` pourtant publié « données ouvertes » dans llms.txt

- **Symptôme** : llms.txt invite les moteurs IA à ingérer l'export CSV de l'Observatoire (« Données ouvertes CC BY 4.0, export CSV : …/api/observatoire/export-csv »), mais `Disallow: /api/` s'applique à cette URL dans les 12 blocs user-agent — aucun `Allow` ne la couvre. Récidive exacte de la classe de bug `/api/markdown/` (verrou n°2 de l'audit 2026-07-20, corrigé — cf. commentaire `robots.ts:80-104`).
- **Preuve code** : `src/app/robots.ts:105-112` (COMMON_ALLOW = `/`, `/api/og`, `/api/avis/photo`, `/api/markdown/`, `/_next/image`, `/_next/static` — pas d'observatoire) ; annonce dans `src/app/llms.txt/route.ts:104` ; route publique réelle `src/app/api/observatoire/export-csv/route.ts:1-15` (`force-dynamic`, agrégats publics CC BY 4.0).
- **Preuve live** : robots.txt prod 17:49:51 UTC sans aucun `Allow` observatoire ; `GET /api/observatoire/export-csv` 17:50:11 UTC → **200 `text/csv` 10 375 B** (la route fonctionne, mais tout crawler respectueux a interdiction de la lire).
- **Root-cause** : l'ajout de l'annonce Observatoire dans llms.txt n'a pas été accompagné de l'exception robots, exactement comme `/api/markdown/` en son temps ; aucun test ne lie « URL annoncée dans llms.txt » ↔ « URL autorisée dans robots ».
- **Patch prescrit** : ajouter `"/api/observatoire/export-csv"` (et `"/api/observatoire/export-json"` si on choisit de l'annoncer aussi) à `COMMON_ALLOW` dans `robots.ts`, + verrou dans `robots.spec.ts` (même motif que le test `/api/markdown/`, `robots.spec.ts:76-86`). Idéalement : un test qui extrait les URLs `/api/*` du corps de llms.txt et vérifie qu'elles sont couvertes par un `Allow`.
- **Effort** : S (patch) / M (avec le test générique llms↔robots).
- **Impact GEO/AEO** : moyen — dataset propriétaire citable (stats françaises IA 2026 = aimant à citations LLM) rendu illisible pour les bots de citation.
- **Risque de régression** : faible — le longest-match n'ouvre que cette URL ; le test `robots.spec.ts:101-108` garantit déjà que les bots de training ne reçoivent AUCUN allow. **Do-not-touch** : blocs `AI_BOTS_TRAINING_DISALLOWED`/`AI_BOTS_DISALLOWED` (`robots.ts:140-153`), ne pas élargir à `/api/observatoire/` entier sans vérifier les autres routes du dossier.

### [P2] Listes de bots divergentes entre robots.txt, ai.txt et ai-policy.json

- **Symptôme** : les 3 fichiers censés porter la même doctrine ne listent pas les mêmes agents. (a) `ai.txt` omet `anthropic-ai` de son bloc training-refusé (`ai.txt/route.ts:65-76`) alors que robots (`robots.ts:143`) et ai-policy (`route.ts:25`) le bloquent. (b) `ai.txt` n'a que 5 blocs citation (OAI-SearchBot, Claude-Web, Claude-SearchBot, PerplexityBot, Bingbot — `route.ts:45-63`) : manquent ChatGPT-User, Perplexity-User, Mistral-User, Meta-ExternalAgent présents dans robots (`robots.ts:114-135`) et ai-policy (`route.ts:32-42`). (c) `ai-policy.json` omet YandexBot et Googlebot-Image de `bots_explicitly_allowed` alors que robots les déclare explicitement.
- **Preuve live** : les 3 curls 17:49:51–17:49:57 UTC confirment les mêmes divergences en prod.
- **Root-cause** : trois listes maintenues à la main dans trois fichiers, sans source commune.
- **Patch prescrit** : extraire les constantes `AI_BOTS_ALLOWED` / `AI_BOTS_TRAINING_DISALLOWED` / `AI_BOTS_DISALLOWED` de `robots.ts` vers un module partagé (p. ex. `src/lib/seo/ai-bots.ts`) importé par les 3 routes ; couvert par le spec existant. Effort M ; impact faible (le filet réel est robots.txt, cohérent) ; risque faible — **do-not-touch** : la composition des règles dans `robots()` (`robots.ts:166-193`) et les invariants du spec.

### [P2] security.txt : champ `Policy` pointe la politique RGPD, pas une politique de divulgation

- **Symptôme** : `Policy: https://axion-ia.com/fr/politique-confidentialite` — RFC 9116 §2.5.18 attend un lien vers la **vulnerability disclosure policy** (règles de signalement, safe harbor), pas la politique de confidentialité.
- **Preuve code** : `src/app/.well-known/security.txt/route.ts:12`. **Preuve live** : curl 17:49:57 UTC, identique.
- **Patch** : retirer la ligne `Policy:` (champ optionnel) tant qu'aucune page de divulgation n'existe, ou créer une section dédiée. Effort S ; impact GEO nul (signal de maturité uniquement) ; risque nul.

### [P2] `Expires: 2027-05-16` figé en dur dans security.txt et ai-policy.json

- **Symptôme** : les deux fichiers expirent silencieusement le 2027-05-16 (`security.txt/route.ts:9`, `ai-policy.json/route.ts:60`) ; aucun rappel ni génération dynamique. Un security.txt expiré est traité comme invalide par les scanners RFC 9116.
- **Preuve live** : curls 17:49:57 UTC. **Patch** : générer `Expires` dynamiquement (now + 11 mois) ou poser un rappel calendrier ; attention `dynamic = "force-static"` fige la valeur au build — un build mensuel suffit (déploiements fréquents). Effort S ; impact faible ; risque nul.

### [P2] `/security.txt` racine → 404 (fallback legacy absent)

- **Symptôme** : seul `/.well-known/security.txt` répond ; la racine historique 404. RFC 9116 fait du well-known l'emplacement canonique mais recommande une redirection racine pour compatibilité scanners.
- **Preuve live** : `GET https://axion-ia.com/security.txt` → **404** à 17:50:11 UTC. Preuve code : aucune route `src/app/security.txt/` (listing `src/app/` 2026-08-14).
- **Patch** : redirect 301 `/security.txt` → `/.well-known/security.txt` (petite route ou règle proxy — attention : le matcher `proxy.ts:461` exclut `.*\.txt$`, donc il faut une route App Router, pas le middleware). Effort S ; impact GEO nul ; risque faible.

### [P2] llms.txt « Excluded » : `/api/* (sauf /api/og)` contredit les exceptions réelles — renvoi A5

- **Symptôme** : la section Excluded de llms.txt (`llms.txt/route.ts:165`) dit « `/api/*` (sauf `/api/og`) » alors que robots autorise aussi `/api/avis/photo` et `/api/markdown/` — et que llms.txt lui-même annonce `/api/markdown/actualites/{slug}` (l.99) et `/api/observatoire/export-csv` (l.104) plus haut. Incohérence purement documentaire mais lisible par les LLM. **Surface principale = A5** ; signalé ici pour la cohérence robots↔llms. Patch S : aligner la parenthèse sur la liste réelle des exceptions.

## Non-findings vérifiés (anti-faux-positifs pour la synthèse)

| Point de mission | État | Preuve |
|---|---|---|
| `Allow: /api/og` intact | ✅ conforme | `robots.ts:107` + robots.txt prod 17:49:51Z + `GET /api/og?title=test` → 200 image/png 17:50:11Z ; verrou `robots.spec.ts:88-91` |
| `Allow: /api/markdown/` intact | ✅ conforme | `robots.ts:109` + prod + `GET /api/markdown/actualites/echec-openai-seisme-industrie-ia` → 200 text/markdown 2 907 B 17:50:11Z ; verrou `robots.spec.ts:76-86` |
| `Disallow: /logos/clients/` présent | ✅ conforme | `robots.ts:43` + prod 17:49:51Z ; fichiers toujours servis aux visiteurs (`/logos/clients/ad-auto.svg` → 200, 17:50:27Z) |
| `Disallow: /en/` | ✅ **absent VOLONTAIREMENT** | Invariant A-03 audit GSC 2026-06-05 : bloquer /en/ empêcherait Googlebot de suivre les 301→FR et figerait les URLs EN en index. `robots.ts:156-164`, verrouillé par `robots.spec.ts:133-137`. L'item de mission est satisfait par cette absence — tout agent qui proposerait de l'ajouter produirait un faux positif. |
| Doctrine training/citation (décision actée 2) | ✅ conforme | GPTBot, ClaudeBot, anthropic-ai, Google-Extended, Applebot-Extended, CCBot, Bytespider, omgili, Diffbot → `Disallow: /` sans aucun Allow (`robots.ts:140-153,189-192` + prod) ; Google-Extended reste bloqué (ne pas rouvrir). |
| Diff code vs prod | ✅ zéro écart | Les 4 fichiers prod (17:49:44–57Z) sont identiques au code de `main` (déploiement 17:33 UTC pas encore atterri = image stable ~14:57 UTC ; fichiers non-DB → aucun effet ISR possible). |
| Middleware n'avale pas les fichiers racine | ✅ conforme | `proxy.ts:445-453,461` : exclusions `.*\.txt$` et `\.well-known/` documentées (couvre aussi la clé IndexNow — non re-diagnostiquée, décision actée 11). |
| Sitemap + Host déclarés | ✅ conforme | `robots.ts:200-201` + prod (`Sitemap: https://axion-ia.com/sitemap-index.xml`) ; verrou `robots.spec.ts:141-144`. |
| Crawl-delay Bingbot 1 s | ✅ conforme | `robots.ts:178-183` + prod. |

## Mesures brutes

Toutes les mesures : 2026-08-14, GET/HEAD curl depuis la machine locale.

| URL | Heure UTC | Status | Content-Type | Taille | Temps | Cache-Control (live) | CF |
|---|---|---|---|---|---|---|---|
| /robots.txt | 17:49:44 | 200 | text/plain | 5 952 B | 0,19 s | public, max-age=86400, must-revalidate | HIT |
| /ai.txt | 17:49:44 | 200 | text/plain; utf-8 | 2 563 B | 1,21 s | 86400 + SWR 604800 | DYNAMIC |
| /.well-known/ai-policy.json | 17:49:46 | 200 | application/json | 1 647 B | 0,13 s | 86400, immutable | DYNAMIC |
| /.well-known/security.txt | 17:49:46 | 200 | text/plain; utf-8 | 214 B | 0,20 s | 86400, immutable | DYNAMIC |
| /llms.txt | 17:49:47 | 200 | text/plain; utf-8 | 10 499 B | 0,74 s | 3600 + SWR 86400 | — |
| /llms-full.txt | 17:50:11 | 200 | text/plain | 136 905 B | — | — | — |
| /api/markdown/actualites/echec-openai-seisme-industrie-ia | 17:50:11 | 200 | text/markdown | 2 907 B | — | — | — |
| /api/og?title=test | 17:50:11 | 200 | image/png | 192 802 B | — | — | — |
| /api/observatoire/export-csv | 17:50:11 | 200 | text/csv | 10 375 B | — | — | — |
| /security.txt (racine) | 17:50:11 | **404** | — | — | — | — | — |
| /logos/clients/ad-auto.svg | 17:50:27 | 200 | — | — | — | — | — |

Contenus intégraux fetched : robots.txt (17:49:51Z), ai.txt / ai-policy.json / security.txt (17:49:57Z) — diff vs code = 0 sur les 4.

Structure robots.txt prod : 12 blocs « autorisés » (`*`, Bingbot+crawl-delay, OAI-SearchBot, ChatGPT-User, Claude-Web, Claude-SearchBot, PerplexityBot, Perplexity-User, Mistral-User, Meta-ExternalAgent, YandexBot, Googlebot-Image) × (5 Allow spécifiques + `Allow: /` + 15 Disallow) ; 9 blocs `Disallow: /` (5 training + 4 scrapers) ; Host + Sitemap.

## Limites

- **Sémantique Spawning ai.txt (P1 n°1)** : la page generator `site.spawning.ai/spawning-ai-txt` est JS-only (contenu non fetchable) ; la sémantique « Allow = permission de training, opt-out par défaut » est établie par sources secondaires concordantes (résumé doc Spawning via recherche web 2026-08-14 ; draft IETF `draft-car-ai-txt-wellknown-00`). Recommandé : régénérer un ai.txt témoin sur le site Spawning avant d'appliquer le patch. Le finding reste solide car même en cas de doute, un `Allow: /` ambigu dans un fichier dont l'unique raison d'être est de refuser le training est indéfendable.
- **Comportement réel des bots non mesuré** : pas d'accès aux logs Caddy/Cloudflare dans ce périmètre (A1 n'est pas dans la liste DB/SSH) — impossible de vérifier si GPTBot/CCBot RESPECTENT effectivement le Disallow. Les fichiers sont des déclarations, pas des pare-feux.
- **IAB AI Preferences draft** non vérifié en détail (second standard cité par ai.txt).
- **Google robots.txt tester / GSC non consultés** (aucune soumission autorisée en audit-only) — la lecture longest-match des `Allow` par Googlebot est déduite de la spec REP + du précédent `/api/og` (débloqué en GSC après le même patch, audit 2026-05-18), pas re-testée dans l'outil.
- **Déploiement en vol** : mesures prises avant l'atterrissage du run 17:33 UTC ; si ce run modifiait un des 4 fichiers (aucun indice en ce sens sur `main`), re-curl après 19:00 UTC.
