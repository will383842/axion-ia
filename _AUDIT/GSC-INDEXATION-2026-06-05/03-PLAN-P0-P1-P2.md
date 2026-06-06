# 03 — PLAN DE REMÉDIATION P0 / P1 / P2 (2026-06-05)

> Chaque action : **Quoi · Pourquoi · Fichiers · Impact (nb pages réindexables) · Effort · Risque/Analyse d'impact · Vérification · Rollback.**
> ⚠️ **Audit only** : rien n'est implémenté ici. Implémentation = session séparée validée par Will. **Chaque push = deploy prod** (working tree partagé multi-sessions → `git fetch` + vérifier `ahead` avant tout push).
> Tous les correctifs P0/P1 sont **sitemap / robots / redirect / edge-only → 0 impact frontend Web Vitals** (à confirmer `pnpm lhci`).

---

## P0 — Débloquer le crawl (jours 1-3)

### P0-1 — Sitemap de cohorte : geler l'élargissement, n'exposer que Tier 0 + déjà-indexé

- **Quoi** : remplacer le drip **calendaire** (`VILLES_PER_DAY=50` automatique) par un **drip piloté par l'indexation** (gelé à la cohorte actuelle tant que le taux d'indexation du Tier 0 < seuil). Concrètement, court terme : **plafonner `cohortSize`** à la cohorte premium (ne plus ajouter +50/jour) jusqu'à validation. Détail mécanique dans `03b-STRATEGIE-RAMP-UP.md` (Volet A + B).
- **Pourquoi** : A-01 (cause racine). Sur domaine sans autorité, +50 villes/jour **ajoutent de la dette** plus vite que Google n'indexe (~1-2/j). Il faut **concentrer** le crawl.
- **Fichiers** : `src/content/villes/index.ts` (`INDEXATION_START`, `VILLES_PER_DAY`, `cohortSize`) ; sous-sitemaps villes consomment déjà `isVilleIndexable`.
- **Impact** : libère le crawl pour le Tier 0 → **+70 à +150 pages indexées sous 4-6 sem** (pages stratégiques + hubs aujourd'hui JC).
- **Effort** : 1-2 h (changer la formule de cohorte + 1 flag de gel).
- **Risque / impact** : ⚠️ touche `isVilleIndexable` → vérifier que **sitemaps villes + meta robots villes + images-villes-t*** restent cohérents (tous lisent la même fonction → cohérence garantie). Aucune ville déjà indexée ne doit basculer noindex (figer la cohorte au **max(actuelle, premium)**). 0 impact WV.
- **Vérification** : `pnpm typecheck` + `pnpm test` + inspecter `GET /sitemap/villes-*.xml` (compte d'URLs en baisse/stable) + `GET /fr/implantations/<ville-cohorte>` garde `index`.
- **Rollback** : restaurer la formule calendaire (1 commit revert).

### P0-2 — Fixer `/opengraph-image` (502 live)

- **Quoi** : corriger le render edge de `src/app/opengraph-image.tsx` (A-02). Aligner sur `src/app/api/og/route.tsx` (qui répond 200) **ou** `runtime="nodejs"`.
- **Pourquoi** : OG image par défaut cassée = previews sociales + Discover KO. Bug **fonctionnel**, pas SEO-only.
- **Fichiers** : `src/app/opengraph-image.tsx`.
- **Impact** : restaure l'éligibilité Discover/preview de l'accueil et de toute page sans OG explicite.
- **Effort** : 1-3 h (reproduire localement `next build && next start`, lire les logs Coolify du 502).
- **Risque / impact** : si passage `nodejs`, vérifier le temps de génération (cache CDN). 0 impact WV (asset hors page). Tester que `/api/og` reste 200.
- **Vérification** : `curl -I /opengraph-image` → 200 image/png en prod après deploy ; validator OG (LinkedIn Post Inspector).
- **Rollback** : revert ; l'accueil retombe sur le 502 (état actuel, pas de régression nette).

### P0-3 — EN : mécanisme unique = 301 1-hop (Invariant #1)

- **Quoi** : retirer `"/en/"` du `dynamicDisallow` (`robots.ts:95`) **quand EN est désactivé**, pour que Google **crawle et voie le 301**. Conditionner la **fuite hreflang en** (A-04) au flag dans `images-fr.xml` (+ vérifier `sitemap-images-services.xml`, `-villes-t*.xml`, `knowledge-sitemap.ts`).
- **Pourquoi** : A-03 + A-04. Aujourd'hui le Disallow **bloque la découverte du 301** → EN restent en index « bloqué robots ». Le 301 seul purge proprement + consolide vers FR.
- **Fichiers** : `src/app/robots.ts:95` ; `src/app/sitemaps/images-fr.xml/route.ts:122-124,138-141` ; (audit) `sitemap-images-services.xml/route.ts`, `sitemap-images-villes-t*.xml/route.ts`, `knowledge-sitemap.ts`.
- **Impact** : retire ~40 « bloquée robots » + accélère l'absorption des ~38 redirections EN ; supprime ~150 fuites hreflang en.
- **Effort** : 1-2 h.
- **Risque / impact** : ⚠️ **Invariant #2** — tout doit rester **togglable `EN_LOCALE_ENABLED`** (quand =true, ré-émettre hreflang en + retirer le 301). Coût crawl du retrait Disallow = **trivial** (EN hors sitemap, ~40-80 URLs one-time). Vérifier qu'aucune page FR n'émet hreflang en après patch.
- **Vérification** : `curl /robots.txt` (plus de `Disallow: /en/`) ; `curl -I /en/about` → 301 1-hop ; `curl /sitemaps/images-fr.xml | grep 'hreflang="en'` → vide ; `curl /fr/galerie` HTML `<head>` sans alternate en.
- **Rollback** : remettre le Disallow (1 ligne).

### P0-4 — Forcer le crawl du Tier 0 (maillage + IndexNow + URL Inspection)

- **Quoi** : (a) garantir que les ~120 URLs Tier 0 (`03b`) sont à **≤2 clics** (accueil/header/footer) ; (b) **IndexNow ping** du Tier 0 (la stack image-bank ping déjà Bing/Yandex — étendre aux pages Tier 0) ; (c) Will lance **GSC URL Inspection → Demander l'indexation** sur ~10-20 URLs Tier 0/jour.
- **Pourquoi** : convertit le crawl rare en indexation **ciblée** sur le noyau commercial.
- **Fichiers** : composants nav (`Header.tsx`, `Footer.tsx`, accueil) pour ajouter galerie/methodologie/comparaisons ; module IndexNow (`src/server/image-bank/**` ping) à étendre.
- **Impact** : +30 à +80 indexées Tier 0 sous 2-4 sem (accélération directe).
- **Effort** : 2-4 h (liens) + 0,5 j (IndexNow Tier 0) + Will 10 min/j (URL Inspection).
- **Risque / impact** : ajouts de liens = vérifier budgets WV (liens texte = négligeable). IndexNow : ne pinger que des URLs **200 index** (pas de noindex).
- **Vérification** : `pnpm lhci` (Tier 0) ; logs IndexNow ; suivi GSC hebdo.
- **Rollback** : retirer les liens / arrêter le ping.

---

## P1 — Réduire frictions & optimiser le crawl (semaine 1-2)

### P1-1 — Galerie dans le Tier 0 + maillage accueil/header

- **Quoi** : lier `/fr/galerie` depuis l'accueil + header (pas footer-only), inclure dans le ramp-up, IndexNow sur publication d'images. (A-09)
- **Impact** : débloque l'indexation des ~150 images + 58 pages galerie (objectif « images visibles » de Will).
- **Effort** : 1-2 h. **Risque** : WV négligeable. **Rollback** : retirer le lien.

### P1-2 — `lastmod` réels pour les villes (ou statu quo honnête)

- **Quoi** : exposer une date de modif réelle de copy par ville → `lastmod` honnête ; sinon garder `BUILD_TIME` (ne jamais falsifier). (A-10)
- **Impact** : réactive le signal lastmod (crawl priorisé sur le frais).
- **Effort** : 2-4 h. **Risque** : 0 WV. **Rollback** : revert.

### P1-3 — Câbler `X-Robots-Tag: noindex` Edge pour villes hors cohorte

- **Quoi** : appeler `isNoindexStubRoute()` dans `proxy.ts` pour émettre le noindex en **en-tête** (économise le rendu HTML). (A-11)
- **Impact** : moins de crawl gaspillé sur les ~1 100 villes noindex.
- **Effort** : 1-2 h. **Risque** : ⚠️ vérifier qu'aucune ville **de la cohorte** ne reçoit le noindex Edge (faux positif) → tester sur villes cohorte + hors-cohorte. **Rollback** : retirer l'appel.

### P1-4 — Gate qualité automatique en entrée de sitemap (régime permanent)

- **Quoi** : critère programmatique décidant `index` vs `noindex/hors-sitemap` à la génération (seuils mots/unicité/duplication/maillage). Détail dans `03b` Volet B. Étend `UNIQUE_VILLE_SLUGS` + `isVilleIndexable` et s'applique au contenu généré (blog programmatique, knowledge).
- **Impact** : empêche le flux 100+/jour de re-noyer Google (régime permanent).
- **Effort** : 0,5-1 j. **Risque** : 0 WV (logique sitemap). **Rollback** : revert le gate.

### P1-5 — Re-soumettre le sitemap + purger les stale en GSC

- **Quoi** : Will re-soumet `sitemap-index.xml` ; marque résolus `/api/og`, 5xx audit/demande, impl/documents (A-07, A-08).
- **Effort** : Will 15 min. **Risque** : 0.

---

## P2 — Long terme (sprint dédié)

- **P2-1 — Backlinks / PR** (relie au blueprint relations-presse) : 5-10 liens de qualité = **le** levier d'autorité qui augmente durablement le débit de crawl. Le facteur n°1 au-delà de la technique.
- **P2-2 — Diversifier les 2 images génériques T3-T4** (signal qualité Google Images) — après réduction de volume.
- **P2-3 — Enrichir les copies villes thin** (sortir du gate doorway au mérite, vrai contenu unique) → élargit la cohorte indexable légitimement. ⚠️ **run LLM facturable** = déclenchement explicite Will uniquement.
- **P2-4 — Dashboard GSC continu + alerte** si « Détectée non indexée » repart à la hausse (signal d'arrêt du flux) — cf. `03b` Volet B.
- **P2-5 — Optionnel** : 301 `/fr/ia-*` legacy ; 410 sur `/audit/*` (A-05, A-06).

---

## Roadmap chiffrée

| Étape | Effort cumulé | Index 4 sem | Index 8 sem | Index 3-6 mois |
|---|---:|---:|---:|---:|
| État 2026-06-05 | — | 47 | 47 | 47 |
| + P0 (sitemap cohorte + og-image + EN) | ~1 j | **90-140** | 150-280 | 400-800 |
| + P0-4 + P1 (maillage + IndexNow + URL Insp + gate) | +1 sem | **120-200** | 250-450 | 700-1200 |
| + P2 (backlinks PR + copies uniques) | +1-3 mois | 150-250 | 400-700 | **1500-2500** |

---

## Décisions à trancher par Will

1. **D-1** — Geler le drip villes maintenant (P0-1) ? (Recommandé **OUI** : c'est le levier racine.)
2. **D-2** — Composition exacte du Tier 0 (cf. `03b`) — valider la liste ?
3. **D-3** — EN : appliquer le 301-unique (retirer Disallow /en/ + fuite hreflang) ? (Recommandé **OUI**, Invariant #1.)
4. **D-4** — Fix `/opengraph-image` en `nodejs` ou alignement `api/og` ? (Recommandé : alignement `api/og` d'abord.)
5. **D-5** — Lancer les copies uniques villes (P2-3, **facturable**) ? (Recommandé : **plus tard**, après absorption Tier 0.)
6. **D-6** — Cadence URL Inspection manuelle Will (10-20/j sur Tier 0) ?
