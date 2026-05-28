# PROMPT — Diagnostic & résolution complète Google Search Console (Axion-IA)

> Best practices SEO / AEO / GEO 2026. Domaine JEUNE, 0 backlink, FR canonique, EN **interdit d'indexation**.
> Copier-coller le bloc « PROMPT À EXÉCUTER » dans une session Claude Code fraîche à la racine du repo.
> Rédigé le 2026-05-28 après vérification du code réel (sitemap.ts, robots.ts, proxy.ts, seo-noindex-routes.ts, villes/index.ts, page hub ville, routes images, sitemap-index.xml) + lecture du rapport GSC Performance fourni par Will.

---

## 0. Ce qui a DÉJÀ été vérifié dans le code (faits, à re-confirmer en live, ne pas re-découvrir de zéro)

### Symptôme — données Couverture RÉELLES (export GSC 2026-05-28)

La perception « le nombre de pages baisse » est partiellement trompeuse. Données réelles du rapport **Indexation → Pages** :

| Date       | Non indexées | Dans l'index | Impressions |
| ---------- | ------------ | ------------ | ----------- |
| 2026-05-15 | 456          | 20           | 5           |
| 2026-05-16 | 336          | 33           | 4           |
| 2026-05-17 | 336          | 33           | 11          |
| 2026-05-18 | 336          | 33           | 9           |
| 2026-05-19 | **2953**     | 38           | 9           |
| 2026-05-22 | 2953         | 38           | 4           |

- **« Dans l'index » MONTE** (20 → 33 → 38) — pas de désindexation nette. Pour un domaine de 2 semaines sans backlink, c'est normal et sain.
- **« Non indexées » EXPLOSE** : 336 → **2953 le 2026-05-19**. C'EST le vrai problème.

Répartition des 2953 non indexées (`Problèmes critiques.csv`) :

| Raison                                 | Pages    | Lecture                                                                                                             |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| **Détectée, actuellement non indexée** | **2636** | Google a découvert via sitemaps mais REFUSE de crawler/indexer → famine de crawl budget (domaine jeune, 0 autorité) |
| Exclue par balise « noindex »          | 232      | Drip villes hors cohorte + noindex volontaires → **attendu/by-design**                                              |
| Page avec redirection                  | 39       | 301 EN→FR + www + sans-locale → **attendu**                                                                         |
| Bloquée par robots.txt                 | 34       | /en/, /admin, /reserver → **attendu**                                                                               |
| Autre page avec canonique correcte     | 4        | doublons canonicalisés → ok                                                                                         |
| **Erreur serveur (5xx)**               | **3**    | À CHASSER — probables timeouts ISR on-demand villes T3/T4 (generateStaticParams limité pop≥100k)                    |
| **Bloquée 403**                        | **3**    | À investiguer                                                                                                       |
| Explorée, actuellement non indexée     | 2        | crawlées, jugées insuffisantes                                                                                      |

### Cause racine RÉELLE (révisée avec les données)

1. **2636 « Détectée non indexée » = famine de crawl budget**, AGGRAVÉE par les **sitemaps d'images villes** (`sitemap-images-villes-t1/t2/t3-t4.xml`, `force-static`, AUCUN filtre drip) qui exposent ~2000+ URLs de pages villes que le sitemap principal exclut volontairement via le drip. **Les sitemaps d'images SABOTENT la stratégie drip** : Google découvre 2600+ URLs d'un coup (saut 336→2953 le 19/05 = ces URLs ajoutées), les parque en « Détectée non indexée », gaspille le crawl budget et reçoit un signal « site à milliers de pages thin ». → Le drip côté sitemap principal est annulé par les sitemaps images.
2. **232 « noindex »** = le drip qui fait son travail (attendu, à assumer).
3. **3 × 5xx** = bug à corriger (rendu ISR on-demand des villes T3/T4 qui échoue au 1er hit Googlebot ?).
4. La désindexation que Will craignait n'a PAS lieu (indexé monte) ; le problème est l'INVERSE : trop d'URLs exposées trop tôt sur un domaine sans autorité.

→ Verdict provisoire : **ne PAS soumettre des milliers d'URLs sur un domaine jeune**. Aligner les sitemaps d'images sur la cohorte drip (ou les retirer jusqu'à ce que les pages soient indexables), réduire le bruit, concentrer le crawl budget sur la cohorte + pages stratégiques, construire de l'autorité. Le drip est le bon instinct — il faut juste arrêter de le contredire ailleurs.

### Cohérence indexabilité ville — 3 couches (à auditer)

1. **Header Edge `X-Robots-Tag`** — `src/lib/seo-noindex-routes.ts` → `isNoindexStubRoute()` sur whitelist hardcodée `INDEXABLE_VILLE_SLUGS` (~2157 slugs), synchronisée à `getIndexableVilles()` = **ensemble COMPLET** (pas le drip), via `seo-noindex-routes.test.ts`.
2. **Meta HTML `<meta robots>`** — `generateMetadata()` de `src/app/[locale]/implantations/[region]/[ville]/page.tsx`, ligne ~197 : `if (!isPilot || !isVilleIndexable(ville.slug)) return { robots: { index:false, follow:true } }` → utilise le **drip**.
3. **Inclusion sitemap** — `buildVillesByRegionSitemap()` dans `src/app/sitemap.ts` → utilise le **drip** (`isVilleIndexable`).
   → Couches 2 & 3 cohérentes (drip). Couche 1 (Edge) reste sur l'ensemble complet : pas un bug de correctness (le `<meta noindex>` HTML l'emporte) mais l'optimisation crawl-budget du header Edge ne s'applique plus aux villes hors cohorte (Google doit rendre le HTML pour voir le noindex). Vérifier qu'il n'y a aucun cas où Edge force `noindex` sur une page que le drip veut `index` (faux positif = CRITIQUE).

### Autres problèmes RÉELS repérés dans le rapport GSC (à confirmer/corriger)

- **Duplication www / non-www** : le rapport liste `https://www.axion-ia.com/fr/implantations/...` ET `https://axion-ia.com/...`, `https://www.axion-ia.com/a-propos`. Google indexe les DEUX hôtes → autorité scindée (grave sur domaine jeune). Vérifier la redirection 301 `www → apex` (Cloudflare ou `next.config.ts`) et le `host` de `robots.ts` (= `SITE_URL`).
- **EN encore indexé** : `/en` (24 impressions !), `/en/actualites`, `/en/implementation/documents` apparaissent. EN désactivé depuis 2026-05-16 (`proxy.ts` 301 `/en/*` → FR, `robots.ts` Disallow `/en/`). Probablement propagation 301 lente (12 j) MAIS vérifier que le 301 part bien en live sur chaque URL, et envisager une demande de suppression GSC. **Règle absolue : rien en EN ne doit être indexé, jamais réactiver/traduire EN.**
- **URLs sans préfixe locale indexées** : `/galerie/...`, `/connaissances`, `/a-propos`, `/politique-deplacement` (sans `/fr/`). Vérifier qu'elles 301 vers `/fr/...` (sinon doublon de contenu apex sans locale).
- **Sitemaps d'images = milliers d'URLs** (confirmé). `sitemap-index.xml` (`CUSTOM_SITEMAPS`) référence 6 sitemaps images :
  - `/sitemaps/images-fr.xml` (DB image-bank, FR)
  - `/sitemaps/images-en.xml` → **retourne un urlset VIDE quand `EN_LOCALE_ENABLED!=true`** (OK aujourd'hui, mais reste référencé → fetch inutile ; envisager de le retirer de l'index tant qu'EN off).
  - `/sitemap-images-services.xml` (73 images marketing)
  - `/sitemap-images-villes-t1.xml`, `-t2.xml`, `-t3-t4.xml` → **`-t3-t4` émet 2034 URLs villes (pop 5k-50k) pointant vers SEULEMENT 2 images génériques** (`force-static`, AUCUN filtre drip ni noindex). Donc : (a) images en double massif (2 images × 2034 → signal qualité faible / scaled image content), (b) `<loc>` = page ville souvent `noindex` aujourd'hui (drip) → crawl gaspillé. À aligner sur la cohorte indexable + diversifier ou réduire.
- **hreflang `en` sur pages FR** : `page.tsx` ville déclare `alternates.en = /locations/...` (ligne ~187) même EN désactivé. Vérifier si `buildProductMetadata`/`src/lib/seo.ts` filtre l'alternate `en` quand `EN_LOCALE_ENABLED!=true` (le sitemap le fait via `filterEnIfDisabled`, mais le `<head>` des pages peut encore émettre `hreflang en` → 301 = incohérence). Si non filtré → corriger (FR-only : pas de `hreflang en`, `x-default` → FR).
- **`generateStaticParams` limité à pop ≥ 100k** (commit `ba15f22e`, ~40 villes T1+T2) : T3/T4 rendues en ISR on-demand (1er hit ~500ms). Indexables quand même (sitemap + meta OK), mais 1er crawl Googlebot = TTFB élevé → vérifier que ça ne génère pas de timeouts/soft-404 côté Googlebot.

### Contexte stack (lire `AGENTS.md` racine + `axionia/AGENTS.md` AVANT toute modif)

Next.js 16.2 App Router + next-intl v4.11 + Postgres/Prisma + Coolify via image GHCR (build externalisé GH Actions). Contrat build `stub.invalid` (DB/Redis stubés au build → pages DB-dependent vides au build, repeuplées par ISR `revalidate=3600` sous 1h — NE PAS casser). Budgets Web Vitals stricts (LCP ≤1800ms, INP ≤100ms, CLS=0, First Load JS ≤75KB gz) — aucun fix SEO ne doit les dégrader.

---

## PROMPT À EXÉCUTER

```
Tu es ingénieur SEO technique senior. Mission : trouver et PROUVER la cause racine de la baisse du nombre de pages indexées sur axion-ia.com (domaine jeune, 0 backlink, FR canonique, EN INTERDIT d'indexation), corriger tous les problèmes Google Search Console, et sécuriser l'indexation selon les best practices SEO/AEO/GEO 2026. Tu raisonnes root-cause, tu vérifies tout sur le code RÉEL + les URLs prod live (curl/WebFetch), jamais sur des suppositions. Lis AGENTS.md (racine + axionia/) avant toute modif.

RÈGLES ABSOLUES
- EN : rien ne doit être indexé en EN ; ne JAMAIS réactiver/traduire EN. Tout hreflang/alternate/sitemap/URL EN pointant vers du contenu = à neutraliser (FR-only, x-default → FR).
- Ne casse pas le contrat build "stub.invalid" (cf AGENTS.md). Ne dégrade aucun budget Web Vitals. Actions irréversibles/externes (push, deploy, API GSC mutante, demandes de suppression) = STOP & ASK Will.
- Distingue toujours "baisse attendue" (301 EN, ramp drip volontaire) de "fuite d'indexation à corriger".

INPUTS — données Couverture DÉJÀ fournies (voir tableaux § Symptôme ci-dessus). Indexées 38 (en hausse), Non indexées 2953 dont 2636 "Détectée non indexée", 232 noindex, 39 redirections, 34 robots, 3×5xx, 3×403.
Réclamer en complément à Will si possible :
1. L'export des URLs (liste) de la catégorie "Détectée, actuellement non indexée" (pour identifier QUELLES URLs — confirmer l'hypothèse sitemaps images villes).
2. La liste des 3 URLs en 5xx et des 3 en 403.
3. Rapport Sitemaps : "découvertes vs indexées" par sitemap (surtout les sitemap-images-villes-*).

PHASE 1 — Cause RÉELLE (priorité absolue) : "Détectée non indexée" = 2636
- L'indexé MONTE (20→38) : pas de désindexation. Le problème = 2636 URLs découvertes non indexées (famine crawl budget) + saut 336→2953 le 2026-05-19.
- HYPOTHÈSE FORTE à prouver : les sitemaps d'images villes (src/app/sitemap-images-villes-t1.xml, -t2.xml, -t3-t4.xml — force-static, AUCUN filtre drip) exposent ~2000+ URLs de pages villes hors cohorte que le sitemap principal exclut. Lis ces routes + src/server/image-bank/utils/villes-sitemap.ts. Compte les URLs émises, vérifie en live combien pointent vers des pages noindex (hors drip). Corrèle le volume avec le saut du 19/05.
- Confirme que le drip côté sitemap principal (buildVillesByRegionSitemap + isVilleIndexable) est cohérent, MAIS contredit par les sitemaps images. Conclus : la stratégie drip est sabotée par les sitemaps images.
- Chasse les 3 erreurs 5xx : teste en live le 1er hit Googlebot d'une ville T3/T4 (non pré-rendue, generateStaticParams limité pop≥100k, ISR on-demand) → timeout/erreur ? Reproduis et corrige la cause.
- Investigue les 3 × 403.
- Conclus quelle part est "by-design" (232 noindex drip, 39 redirections EN/www, 34 robots) vs "à corriger" (image sitemaps, 5xx, 403, sur-soumission).

PHASE 2 — Cohérence indexabilité (3 couches villes)
- Compare ligne à ligne : whitelist Edge seo-noindex-routes.ts (INDEXABLE_VILLE_SLUGS, isNoindexStubRoute) vs drip isVilleIndexable vs inclusion sitemap (buildVillesByRegionSitemap) vs meta page (generateMetadata page.tsx ~l.197).
- Pour 12+ villes (premium dans cohorte / avec copy hors cohorte / sans copy), prouve en live : `curl -sI <url>` (status + X-Robots-Tag) ET le `<meta name="robots">` du HTML ET la présence dans le bon sub-sitemap. Documente chaque divergence.
- CRITIQUE : repère tout cas où le header Edge force noindex sur une page que le drip veut index (faux positif).

PHASE 3 — Sitemaps (100 %)
- Fetch https://axion-ia.com/sitemap-index.xml puis CHAQUE sub-sitemap : pages, blog, faq, help, cas-concrets, comparaisons, guides, glossaire, presse, implementation, implantations, services-villes-{audit,interventions,implementation,un-a-un}, stack-ia-tools, villes-<region>(-<n>), knowledge-<n>, sitemap-news.xml, ET les 6 images : /sitemaps/images-fr.xml, /sitemaps/images-en.xml, /sitemap-images-services.xml, /sitemap-images-villes-t1.xml, -t2.xml, -t3-t4.xml.
- Pour chacun : 200 sur échantillon, self-canonical, non-noindex, non-301, aucune URL /en/*, pas de doublon inter-sitemaps, lastmod stable, nb d'URLs cohérent avec la cohorte du jour.
- Images : vérifie que /sitemaps/images-en.xml est bien VIDE (EN off). Vérifie sitemap-images-villes-t3-t4 (2034 URLs, 2 images génériques, AUCUN filtre drip/noindex) : signale (a) duplication d'images, (b) <loc> pointant vers pages noindex. Recommande : filtrer sur la cohorte indexable + diversifier/limiter, ou sortir ces images de l'index tant que les pages sont noindex. Envisage de retirer images-en.xml de l'index tant qu'EN off.

PHASE 4 — Canonicalisation hôte & locale
- Prouve en live la redirection 301 : http→https, www→apex (le rapport GSC montre www.axion-ia.com ET axion-ia.com indexés → fuite d'autorité). Vérifie SITE_URL, le `host` de robots.ts, et la conf Cloudflare/next.config.ts.
- Prouve que les URLs sans préfixe locale (/galerie/..., /connaissances, /a-propos, /politique-deplacement) 301 vers /fr/...
- Vérifie le 301 EN→FR en live sur /en, /en/actualites, /en/implementation/documents (proxy.ts mapEnToFr). Recommande la suite GSC (laisser les 301 désindexer, ou demande de suppression après ≥4 sem).

PHASE 5 — hreflang / canonical pages
- Vérifie src/lib/seo.ts (buildProductMetadata, alternates, hreflang) : en mode EN off, AUCUNE page ne doit émettre hreflang `en` (qui pointerait vers une URL 301). Self-canonical FR correct, x-default → FR. La page ville déclare alternates.en=/locations/... (page.tsx ~l.187) → confirmer que c'est filtré au rendu, sinon corriger.

PHASE 6 — Crawl budget & stratégie jeune domaine
- ~17 500 routes SSG soumises sans autorité → risque "Détectée non indexée" massif. Recommande priorisation (pages stratégiques + cohorte villes maîtrisée), maillage interne, IndexNow (src/app/api/indexnow), et un calendrier réaliste. Évalue l'impact du generateStaticParams limité à pop≥100k (T3/T4 ISR on-demand) sur le 1er crawl Googlebot (TTFB/soft-404).

PHASE 7 — Qualité / anti scaled-content (HCU 2024)
- Échantillonne 15-20 src/content/villes/copy/*.ts : longueur, unicité, valeur locale réelle. Évalue le risque "scaled content abuse" (cohérent avec le but du drip). Recommande des seuils qualité minimaux avant mise en index.

PHASE 8 — AEO / GEO 2026
- Structured data (Speakable, FAQPage, LocalBusiness/Service, BreadcrumbList, Article, ImageObject), llms.txt, robots AI-bots (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended…), cohérence citations.

LIVRABLES
1. _AUDIT/GSC-INDEXATION-2026-05-28/00-VERDICT.md : cause(s) racine PROUVÉES (avec preuves curl/meta/sitemap), part de chaque facteur dans la baisse, verdict "voulu vs bug".
2. Plan d'action P0/P1/P2 (effort × impact × risque WV), décisions à trancher par Will explicitées (garder le drip tel quel / l'accélérer / aligner les 3 couches ; sort des images génériques villes ; retrait images-en.xml de l'index ; suppression GSC des /en).
3. Si fixes P0 sûrs et non régressifs (cohérence couches, hreflang EN-off, canonical, www→apex côté code, images alignées drip) : applique-les après accord, en respectant AGENTS.md, avec `pnpm typecheck` + `pnpm test` verts + smoke runtime des headers/meta/sitemaps.

GARDE-FOUS
- Vérifie chaque fait/hypothèse contre le code ACTUEL (fonctions renommées/supprimées possibles).
- Ne touche pas au contrat stub.invalid, ne réactive/traduis pas EN, ne dégrade aucun budget Web Vitals.
- Tout patch frontend dégradant les WV ou toute action irréversible/externe = STOP & ASK Will + ADR.
```

---

## Contexte additionnel fourni par Will — À COMPLÉTER

> ⚠️ Le « Pasted text #1 (+132 lignes) » n'est pas parvenu dans le contexte de génération de ce prompt.
> Recoller son contenu ici, puis l'intégrer dans les phases ci-dessus (cause racine / fixes / contraintes).

```
(coller ici le texte de Will)
```
