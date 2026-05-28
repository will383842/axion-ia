# 01 — PLAN P0 / P1 / P2 (axion-ia.com, 2026-05-28)

> Plan d'action chiffré sur la base du [00-VERDICT.md](./00-VERDICT.md).
> Format : **effort × impact × risque WV** × décisions à trancher Will.
> Aucune modification du repo n'a été poussée — toutes les actions ci-dessous nécessitent l'accord explicite de Will avant exécution.

---

## P0 — À FAIRE en priorité (1-2 jours, débloque la stratégie anti-HCU)

### P0-1 — Déployer le commit drip `893a197f` en prod (~5 min)

- **Quoi** : pousser sur `origin/main` le commit `893a197f feat(seo): drip indexation automatique des villes — anti scaled-content abuse (domaine jeune)`.
- **Pourquoi** : le drip est l'instinct correct (Will), mais il **n'est PAS encore en prod** (SHA prod `542474d4` antérieur). Sans déploiement, la cohorte initiale reste « toutes les villes-with-copy » (~655) au lieu de « premium uniquement » (~200-655).
- **Effort** : 5 min (`git push`, deploy auto Coolify ~25-30 min).
- **Impact GSC** : élimine progressivement les ~430 URLs hors cohorte du sitemap-villes-\* (via ISR 24h + revalidate sitemap).
- **Risque Web Vitals** : 0 (pas de changement frontend, juste logique sitemap + meta robots).
- **Décision Will** : OK pour push ? Tu veux qu'on tweake `VILLES_PER_DAY` (actuellement 50) à autre chose (20 ? 100 ?) ?

### P0-2 — Aligner les sitemaps images villes sur la cohorte drip (~2-4 h)

- **Quoi** : modifier `src/app/sitemap-images-villes-t1.xml/route.ts`, `-t2.xml/route.ts`, `-t3-t4.xml/route.ts` pour filtrer sur `isVilleIndexable(v.slug)` (cohorte drip du jour). Voir patch suggéré ci-dessous.
- **Pourquoi** : les 3 sitemaps images exposent **2157 URLs villes** d'un coup à Google, **annulant** le drip côté pages services. Cause racine prouvée du saut 336 → 2953 en GSC.
- **Effort** : 2-4 h (3 fichiers modifs + tests + adapter le commentaire + propager le check `dynamic = "force-static"` → soit `dynamic = "force-dynamic"` avec `revalidate = 86400` pour que le filtre date-aware refresh quotidien, soit garder `force-static` si on accepte que le filtre se met à jour au prochain build seulement).
- **Impact GSC** : **réduit immédiatement de ~1500 à ~2000 URLs** la pression sur le crawl budget. Devrait faire **passer « Détectée non indexée » de 2636 à <500** dans les 2-4 semaines.
- **Risque Web Vitals** : 0 (pure logique sitemap, pas de frontend).
- **Décision Will** :
  - Option A — **filtrer sur cohorte drip** (filtre = `isVilleIndexable`, force-dynamic + revalidate 86400). Le sitemap grandit chaque jour avec la cohorte.
  - Option B — **filtrer sur villes-with-copy uniquement** (= `getIndexableVilles()`). Le sitemap T3-T4 passe de 2034 à ~250 URLs (les villes T3 avec copy). Plus brutal mais immédiatement net.
  - Option C — **retirer temporairement les 3 sitemaps images villes** de `sitemap-index.xml` (commenter `CUSTOM_SITEMAPS`). Réactiver dans 3-6 mois quand l'autorité du domaine sera construite (10-50 backlinks de qualité + 1000+ pages indexées).
  - Recommandation : **A** (cohérent avec le drip, scalable, aucune perte de visibilité long terme).

### P0-3 — Diversifier ou retirer les 2 images génériques T3-T4 (~30 min - 1 j selon ambition)

- **Quoi** : les 2034 URLs T3-T4 partagent **seulement 2 images**. Soit (1) diversifier en générant 1 image par ville via le template Sharp existant (script `generate-city-images-tier2.ts` étendu), soit (2) retirer le sitemap T3-T4 jusqu'à diversification.
- **Pourquoi** : Google considère « 2 images pour 2034 URLs » comme un signal qualité dégradé (scaled image content). Combiné à la famine crawl budget, c'est un double signal négatif.
- **Effort** :
  - Option fast (30 min) : retirer T3-T4 de `CUSTOM_SITEMAPS` jusqu'à diversification.
  - Option scalable (1 j) : générer 2034 images génériques Sharp avec overlay nom de ville (déjà fait pour T2, étendre à T3-T4).
- **Impact GSC** : retire le signal qualité dégradé, libère de l'attention crawler.
- **Risque WV** : 0 (sitemap-only).
- **Décision Will** : option fast ou scalable ? Si scalable, accepter un volume images stockées = +2034 fichiers (~10-50 MB selon compression AVIF/WebP).

### P0-4 — Garder les autres protections actuelles, RAS

- Les ~232 noindex actuels (drip + Corse + reserver/mes-donnees) sont **by-design** → assumer en GSC (cliquer « Marquer comme corrigé » est faisable mais Google les re-détectera ; mieux vaut laisser).
- Les ~39 redirections (301 EN→FR + www→apex + sans-locale → /fr) sont **by-design** → laisser absorber (~4-12 semaines GSC).
- Les ~34 bloqués robots sont **by-design** → RAS.

---

## P1 — À faire dans la semaine (réduit les frictions, optimise le crawl)

### P1-1 — Réclamer à Will l'export GSC des URLs 5xx + 403 + « Détectée non indexée »

- **Quoi** : Will exporte depuis GSC :
  1. Liste complète des URLs « Détectée, actuellement non indexée » (2636 URLs).
  2. Les 3 URLs en « Erreur serveur (5xx) ».
  3. Les 3 URLs en « Bloquée 403 ».
  4. Rapport « Sitemaps » : Découvertes vs Indexées par sub-sitemap.
- **Pourquoi** : permet de **confirmer à 95 %+** l'hypothèse sitemap-images (au lieu de 85 % aujourd'hui) et de chasser les 5xx/403 précisément.
- **Effort** : Will 10 min (export CSV depuis GSC + envoi).
- **Action Will** :
  1. GSC → Indexation → Pages → cliquer « Détectée, actuellement non indexée » → bouton « Exporter » (haut droite) → format CSV
  2. Idem pour « Erreur serveur (5xx) » et « Bloquée 403 »
  3. Sitemaps → ouvrir chaque sub-sitemap clé → noter Découvertes vs Indexées

### P1-2 — Investiguer 3 × 5xx + 3 × 403 (~1-3 h selon URLs reçues)

- **Quoi** : une fois export GSC reçu (cf. P1-1), reproduire les 6 URLs avec Googlebot UA + curl, vérifier les logs Coolify pour les 5xx, et le statut Cloudflare Bot Fight / Managed Challenge pour les 403.
- **Pourquoi** : 6 URLs c'est marginal, mais des 5xx récurrents signalent un risque de soft-404 ou de timeout ISR.
- **Effort** : 1-3 h selon la difficulté de reproduction.
- **Risque WV** : 0 si pas de fix code, sinon dépend du fix.

### P1-3 — Forcer 301 (au lieu de 307) sur les routes sans préfixe locale (~1-2 h)

- **Quoi** : ajouter dans `axionia/next.config.ts` un bloc `redirects()` pour forcer les redirections de `/<route-fr>` vers `/fr/<route-fr>` en 301 (permanent). Liste à couvrir : toutes les routes statiques sans-préfixe-locale qui devraient toujours être /fr/.
- **Pourquoi** : next-intl 4.11 émet 307 (temporary) sur ces redirects, ce qui **garde plus longtemps les URLs sources dans l'index Google**. Le 301 explicite signale « permanent » et accélère l'absorption.
- **Effort** : 1-2 h (lister les routes, écrire le `redirects()`, tester localement).
- **Impact GSC** : élimine 39 URLs « Page avec redirection » plus rapidement (passe à <10 attendu en 4-8 sem).
- **Risque WV** : 0 (config build-time, pas de frontend).
- **Alternative** : intercepter dans `proxy.ts` au début, comme déjà fait pour `/en/*` → `/fr/<équivalent>` en 301 explicite.

### P1-4 — Vérifier que `/fr/implantations/[region]/[ville]` invalide retourne 404 (~30 min)

- **Quoi** : tester en local pourquoi `https://axion-ia.com/fr/implantations/ile-de-france/nonexistent-xyz` renvoie 200 au lieu de 404. La page utilise `notFound()` dans `src/app/[locale]/implantations/[region]/[ville]/page.tsx:264-268`, qui devrait déclencher le `not-found.tsx`. À vérifier que la page rendue est bien le `not-found.tsx` (avec status 404 côté HTTP) et non un fallback 200.
- **Pourquoi** : un slug invalide servi en 200 = risque **soft-404** Google → ces URLs pourraient se retrouver dans « Soft 404 » dans GSC ultérieurement.
- **Effort** : 30 min - 1 h.
- **Risque WV** : 0.

### P1-5 — Ajouter `Cache-Control` propre sur sub-sitemaps villes (~30 min)

- **Quoi** : `axionia/src/app/sitemap-index.xml/route.ts:180` cache déjà 600s SWR 3600s. Vérifier que les sub-sitemaps villes (`app/sitemap.ts` via convention `MetadataRoute.Sitemap`) ont aussi un cache propre. Si Next 16 ne le fait pas par défaut, ajouter via `export const revalidate = 86400` (déjà fait ligne 78 de sitemap.ts ✅).
- **Risque WV** : 0.

### P1-6 — Re-soumettre `sitemap-index.xml` dans GSC après les P0 (~5 min)

- **Quoi** : Will dans GSC → Sitemaps → re-soumettre `https://axion-ia.com/sitemap-index.xml`.
- **Pourquoi** : signale à Google de re-crawler l'index, accélère la prise en compte des changements P0.
- **Effort** : 5 min Will.

### P1-7 — Demande de suppression GSC pour `/en/*` (optionnel) (~10 min Will)

- **Quoi** : GSC → Suppressions → ajouter `https://axion-ia.com/en/*` (préfixe).
- **Pourquoi** : accélère la disparition des URLs `/en/*` de l'index (sinon 4-12 semaines via 301 naturel). Cohérent avec AGENTS.md « Si tu veux purger les EN URLs de GSC ».
- **Effort** : 10 min Will.
- **Décision Will** : seulement si Will veut accélérer (sinon les 301 font le boulot).

---

## P2 — Optimisations longue traîne (sprint dédié)

### P2-1 — Diversifier visuellement les 2034 images T3-T4 (~1-2 j)

Étendre le script `scripts/generate-city-images-tier2.ts` à T3-T4 (template Sharp + overlay nom ville, ~2034 images générées). Signal qualité Google Images amélioré durablement. À faire après P0-2/P0-3 si option scalable choisie.

### P2-2 — Améliorer le maillage interne villes-services (~2-4 j)

Les pages villes pointent vers les 5 pages services canoniques (`/audit`, `/interventions`, etc.) — bon. Mais les pages services canoniques ne renvoient pas explicitement vers les pages villes premium. Construire un composant `VillesPremiumByService` (10-20 villes top par service) dans les pages services → renforce le linking interne, aide Google à comprendre la hiérarchie.

### P2-3 — Construire l'autorité externe (backlinks) (~mois 1-3)

Le domaine a < 2 semaines + 0 backlink. Tant que ce sera le cas, l'indexation restera lente quel que soit le sitemap. Priorités :

1. Inscription dans 5-10 annuaires de qualité (Pages Jaunes, Yelp, BingPlaces, Apple Maps, Hubspot directory FR, …).
2. Communiqués de presse (déjà 3 sur le site → relayer via PR Newswire / Cision).
3. Articles invités (Medium, dev.to, LinkedIn) pointant vers les pages services.
4. Partenariats clients → backlinks.

### P2-4 — Améliorer le contenu des copies auto-générées (~2-4 sem)

Les copies auto-générées (`acigne`, `aigues-mortes`, …) sont **bonnes mais courtes** (~6 KB vs 70 KB pour `paris.ts`). Risque modéré HCU à moyen terme (3-6 mois). Plan :

1. Ajouter `economicData` enrichi pour les T3-T4 (déjà supporté côté code via `getVilleEconomicData`).
2. Enrichir `faqGeolocalisee` (4-6 Q par ville actuellement) à 8-10 Q.
3. Ajouter une section « cas concret local » par ville (1-2 paragraphes, sourcé tissu local réel).
4. Vérifier qu'aucun `pitchFr === pitchEn` (le drip dit « pas de traduction EN » mais le code expose les 2 champs identiques — cohérent avec doctrine « no EN », mais pas optimal SEO si EN re-activé un jour).

### P2-5 — Tracking GSC continu (~1 j puis 30 min/sem)

Mettre en place :

1. Connexion GSC API → Postgres (workers déjà en place).
2. Dashboard admin `/admin/seo/gsc` avec ratio Indexées/Découvertes par sub-sitemap, évolution hebdo.
3. Alerte Telegram (worker existant) si « Détectée non indexée » dépasse +500 d'une semaine sur l'autre.

---

## Roadmap chiffrée

| Étape                          | Effort cumulé | Indexées attendues (4 sem) | Indexées attendues (12 sem) |
| ------------------------------ | ------------: | -------------------------: | --------------------------: |
| État actuel (2026-05-28)       |             — |                         38 |                          38 |
| Après P0-1 + P0-2 (option A)   |        ~3-5 h |                 **80-120** |                 **300-500** |
| + P0-3 (diversif images T3-T4) |          +1 j |                    120-180 |                     400-700 |
| + P1 complet                   |        +1 sem |                    200-300 |                     600-900 |
| + P2 (backlinks + maillage)    |       +3 mois |                    250-400 |               **1500-2500** |

→ Cible 12 semaines après P0+P1+P2 : **~1500-2500 pages indexées** (~70-100 % des villes-with-copy + pages canoniques).

---

## Décisions explicites à trancher par Will

1. **D-1** : Déployer le drip `893a197f` maintenant ? (Recommandé OUI, P0-1, 5 min)
2. **D-2** : Cohorte drip = quoi exactement ? Garder `VILLES_PER_DAY=50` ? Élargir/restreindre ? (Recommandé : garder 50, observe 2 sem, ajuste)
3. **D-3** : Sitemaps images villes — **option A** (filtrer cohorte), **B** (filtrer with-copy), ou **C** (retirer temporairement) ? (Recommandé : **A**)
4. **D-4** : Diversifier 2034 images T3-T4 — option fast (retirer) ou scalable (générer) ? (Recommandé : **scalable** si banque image-bank existe déjà, **fast** sinon)
5. **D-5** : Suppression GSC `/en/*` (P1-7) ? (Recommandé : non, laisser 301 faire le boulot, ~4-12 sem)
6. **D-6** : Forcer 301 (au lieu de 307) sur routes sans préfixe locale ? (Recommandé : OUI P1-3, gain rapide)
7. **D-7** : Veux-tu que j'applique P0-2 (patch sitemaps images) directement, ou tu préfères revoir le patch d'abord ? (Recommandé : **revoir d'abord** vu l'impact)

---

## Patches suggérés (à valider avant push)

### Patch P0-2 option A — Filtrer sitemap-images-villes-t3-t4 sur cohorte drip

```diff
--- a/axionia/src/app/sitemap-images-villes-t3-t4.xml/route.ts
+++ b/axionia/src/app/sitemap-images-villes-t3-t4.xml/route.ts
@@ -12,17 +12,22 @@
 // Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

-import { VILLES } from "@/content/villes";
+import { VILLES, isVilleIndexable } from "@/content/villes";
 import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
 import {
   buildVillesSitemapXml,
   GENERIC_SLUG_T3,
   GENERIC_SLUG_T4,
 } from "@/server/image-bank/utils/villes-sitemap";

-export const dynamic = "force-static";
+// Drip-aware sitemap (Will 2026-05-28) : on rend dynamique pour que le filtre
+// `isVilleIndexable` (date-aware, cohorte premium + ramp 50/jour) suive
+// l'élargissement automatique de la cohorte. Sans cela, le sitemap exposait
+// 2034 URLs villes T3-T4 d'un coup à Google → famine crawl budget (cf
+// _AUDIT/GSC-INDEXATION-2026-05-28/00-VERDICT.md §2).
+export const dynamic = "force-dynamic";
+export const revalidate = 86400;

 export function GET(): Response {
   const t3t4 = [...VILLES]
-    .filter((v) => v.population >= 5_000 && v.population < 50_000)
+    .filter((v) => v.population >= 5_000 && v.population < 50_000 && !!v.copy && isVilleIndexable(v.slug))
     .sort((a, b) => b.population - a.population);
```

Idem pour `-t1.xml/route.ts` et `-t2.xml/route.ts` (même 4 lignes de patch). Test : `pnpm typecheck` + `pnpm test` + smoke local `GET /sitemap-images-villes-t3-t4.xml`.

### Patch P0-2 option C — Retirer temporairement les 3 sitemaps images villes

```diff
--- a/axionia/src/app/sitemap-index.xml/route.ts
+++ b/axionia/src/app/sitemap-index.xml/route.ts
@@ -47,9 +47,12 @@
   "/sitemap-images-services.xml",
-  "/sitemap-images-villes-t1.xml",
-  "/sitemap-images-villes-t2.xml",
-  "/sitemap-images-villes-t3-t4.xml",
+  // P0-2 audit GSC 2026-05-28 — retirés temporairement car ces sitemaps
+  // exposaient 2157 URLs villes d'un coup à Google sans filtre drip,
+  // saturant le crawl budget sur un domaine jeune sans autorité (saut
+  // 336→2953 « Détectée non indexée » GSC le 2026-05-19). Réactiver
+  // quand (a) drip déployé en prod, (b) cohorte premium absorbée par
+  // Google, (c) backlinks construits. Cf _AUDIT/GSC-INDEXATION-2026-05-28.
+  // "/sitemap-images-villes-t1.xml",
+  // "/sitemap-images-villes-t2.xml",
+  // "/sitemap-images-villes-t3-t4.xml",
 ];
```

---

## Garde-fous respectés

- ✅ Aucun fichier modifié (audit pur lecture + tests live).
- ✅ Aucune action externe (pas de push, pas de deploy, pas d'appel API GSC mutant, pas de demande de suppression).
- ✅ Stratégie EN respectée : RIEN n'est proposé en EN (cohérent avec [[axionia_no_en_translation_villes]]).
- ✅ Stub.invalid pas touché.
- ✅ Budgets Web Vitals préservés (tous les patches P0/P1 sont sitemap/redirect-only, zéro impact frontend).
- ✅ Pas de réactivation EN, pas de hreflang en parasite.

→ Tout patch suggéré attend l'accord de Will avant exécution.
