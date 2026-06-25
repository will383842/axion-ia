# 06 — AUDIT PUBLICATION & MISE EN LIGNE

> Du job validé à l'URL indexable : `content-publish-worker.ts` → `Article` + `ArticleTranslation` → ISR → sitemap → IndexNow.

## 6.1 — Workflow de publication

- ✅ **Auto-publish PRÉSENT et par défaut** (contradiction d'agents tranchée par lecture directe) : `content-gen-worker.ts:923-929` — `fullAutoPublishEnabled = policies.factoryAutoPublishAllBlogTypes !== false` (= **TRUE par défaut**). `fullAutoPublishRequested = enabled && !blockingFail && score >= qualityThreshold` → `nextStatus="approved"` → enqueue publish → article LIVE **sans intervention humaine**.
- ✅ **Sous-seuil / score===0 / blockingFail** → `needs_review` (file de revue admin). RSS a son **propre plancher** (`rssAutoPublishMinScore=75`, plus strict que le seuil global descendu à 70).
- ✅ Transition de statut : `draft→generated→(approved|needs_review)→published→(archived|tombstoned)`. Slug-history sur changement de slug ; tombstone sur archivage.

```
[MAJEUR] | content-gen-worker.ts:923-929 + policies | L'auto-publish full-auto est ON par défaut (`!== false`) ET le seuil global est passé à 70 (seed). Combiné à la gate data-quality OFF par défaut (cf. 03.1), un article structurellement pauvre (ex. 185 mots / 2 H2, cf. 02) peut s'auto-publier dès score≥70. | Publication de contenu thin sans œil humain → risque HCU / qualité SERP. Reco : soit remonter le plancher pour les types courts, soit activer la gate data-quality.
[MINEUR] | policies (factoryAutoPublishAllBlogTypes) | Le défaut « tout auto-publier » est implicite (`!== false`) plutôt qu'un opt-in explicite. | Sémantique fail-open : une config absente publie. Reco : défaut explicite + libellé console clair.
```

## 6.2 — Cadence, drip & idempotence

- ✅ **Cap quotidien** : rampe progressive (`dailyPublishCap`, 30 → 500) pour ne pas inonder l'index d'un coup.
- ✅ **Fenêtre drip** : publications étalées **08h–22h CET** (pas de rafale nocturne, signal de fraîcheur naturel).
- ✅ **Idempotence** : `idempotencyKey` SHA256 anti-doublon à l'enqueue + slug `@@unique([locale, slug])` (collision → suffixe). Verrou mot-clé relâché au publish.

```
[MINEUR] | drip / cap | Fenêtre 08h-22h CET codée ; pas de modulation week-end / jours fériés. | Cadence éditoriale non « humaine » le week-end (signal faible).
```

## 6.3 — Slug & redirections

- ✅ **Slug déterministe & unique** (`slugify` SSOT, vérifié Étape 6). Collision gérée. `ArticleSlugHistory` → 301 de l'ancien slug vers le nouveau (`blog/[slug]` lit l'historique avant le soft-404).

```
[MAJEUR] | refresh-worker / slug-history | Lors d'un REFRESH d'article qui régénère le slug, l'ancien slug n'est pas TOUJOURS écrit dans ArticleSlugHistory (chemin refresh ≠ chemin edit manuel). À VÉRIFIER selon le type de refresh. | URL indexée → 404 (au lieu de 301) si le slug change au refresh → perte de jus SEO. Reco : centraliser l'écriture slug-history dans un seul helper appelé par TOUS les chemins de mutation de slug.
```

> NB : la note d'un agent qualifiant la validation de slug de « CRITIQUE » est **surévaluée** — le slug EST déterministe et unique (contrainte DB + slugify). Le vrai risque résiduel est le chemin refresh ci-dessus (MAJEUR), pas l'unicité.

## 6.4 — Cache, ISR & sitemap

- ✅ **ISR** `revalidate=3600` (article) ; sitemaps `revalidate≈86400`. Revalidation à la demande via `/api/internal/revalidate` (HMAC).
- ✅ **Sitemaps** segmentés (`app/sitemap.ts` + sub-sitemaps), `lastmod` réel, `tier_2/3` exclus, EN désactivé → URLs FR seules servies.
- ✅ **IndexNow** émis systématiquement au publish ; **Google Indexing API** gated (flag) — émission de ping moteur au passage live.

```
[MAJEUR] | sitemap (build stub.invalid) | Les sub-sitemaps DB-dependent (knowledge-*, ressources) sont rendus VIDES au build (stub Proxy ADR 0026) et repeuplés par l'ISR sous 1h. La page d'index ne liste un sub-sitemap QUE si count>0 (correctif 2026-06-18). | Fenêtre courte (< 1h après deploy) où des URLs valides ne sont pas encore dans le sitemap. Connu/atténué (ISR). Surveiller la resoumission GSC.
[MINEUR] | /api/internal/revalidate | Pas de rate-limit (recoupe 03.2) + revalidation manuelle non journalisée. | Abus possible si secret fuit ; pas d'audit de qui a revalidé.
```

## 6.5 — robots / noindex / cohérence d'indexation

- ✅ `robots` dérivé du **tier** (tier_1 → index,follow ; tier_2 → noindex,follow ; tier_3 → noindex,nofollow), cohérent entre `<meta robots>`, `X-Robots-Tag` et l'exclusion sitemap. `/reserver` noindex (calendrier). ai.txt / llms.txt présents (blocage training).

```
[MAJEUR] | tier demotion (intent gate) + sitemap | Un article rétrogradé tier_3 par `validateIntentAlignment` (cf. 01/03) sort de l'index mais l'URL peut rester connue (liens internes). | Contenu généré « invisible » sans alerte ; recoupe le garde-fou intent (Étape contexte #16). Reco : compteur admin des rétrogradations.
```

### Bilan Étape 6

**0 CRITIQUE.** MAJEURS = auto-publish fail-open + gate data-quality off (contenu thin auto-publiable), slug-history au refresh, fenêtre sitemap post-deploy, rétrogradations tier silencieuses. La **mécanique de publication est solide** (idempotence, drip, ISR, IndexNow, slug-history) ; les risques sont à la **jonction qualité↔auto-publish**, pas dans la plomberie.
