# Agent 6 — Locale Switcher Round-Trip Audit (FR ↔ EN)

**Mode**: AUDIT-ONLY STRICT (zéro fix, zéro commit)
**Date**: 2026-05-15
**Prod**: https://axion-ia.com
**Scope**: 34 FR pages + 10 EN pages (stratifié 7 sous-arbres)
**Score**: **42 / 80**

---

## TL;DR

Le composant `LocaleSwitcher.tsx` est **techniquement irréprochable** : il s'appuie sur `next-intl` + `routing.pathnames` pour traduire l'URL côté client, ce qui produit toujours le bon slug EN quand la route est correctement déclarée dans `src/i18n/routing.ts`. Sur les **6 paires FR↔EN où les deux côtés répondent 200**, le round-trip est **100 % OK** et `hreflang` matche le switcher.

MAIS l'audit révèle **3 catégories de problèmes graves** qui plombent le score :

1. **Outage massif origine** (Cloudflare BYPASS → 503 « no available server ») : 12 / 34 FR + 16 / 22 EN testées renvoient 503. Cohérent avec l'incident noté en mémoire (`/fr/guide-ia`, `/fr/stack-ia`, `/fr/comparaisons`). Le switcher n'y est pour rien, mais l'effet utilisateur final = round-trip cassé pour > 70 % des cibles EN.
2. **2 routes FR sans pendant dans `routing.ts` pathnames** (`/fr/actualites`, `/fr/connaissances`) → le switcher génère naïvement `/en/actualites` / `/en/connaissances` (qui n'existent pas) ET le `hreflang="en"` retombe en fallback sur `/en` (home générique). **P0 SEO + P0 UX**.
3. **Divergence switcher ↔ hreflang** sur les routes à slug traduit (ex `/fr/interventions/collectives`) : switcher correct via `routing.ts`, mais `hreflang` faux car la metadata helper `buildProductMetadata({ path })` réutilise le même slug FR pour l'URL EN. **P0 SEO international**.

---

## Score détaillé /80

| Critère                                | Pondération | Score  | Justification                                                                                                                                                                                       |
| -------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switcher présent + accessible          | 15          | 15     | `aria-label`, `data-testid`, focus visible. `nav` sémantique. Présent sur 22/22 pages FR rendues 200 et 10/10 EN                                                                                    |
| Switcher logique de traduction         | 15          | 13     | Logique `routing.pathnames` parfaite SAUF 2 routes absentes du registre (`/fr/actualites`, `/fr/connaissances`) → fallback naïf identique FR→EN sur 2/34 = 6 %                                      |
| Round-trip FR→EN→FR fonctionnel        | 20          | 12     | 6/22 paires testables (FR 200) ont une cible EN 200. Sur ces 6 → 100 % round-trip OK. Mais l'échantillon « usable » est petit à cause des 503. Pénalité origine 8 pts                               |
| Hreflang cohérence avec switcher       | 15          | 9      | 19/22 = 86 % match. 3 mismatches détectés (collectives, actualites, connaissances). Les 4 pages sub-services FR↔EN qui 503 ne sont pas testables côté EN mais ont hreflang correct du côté FR rendu |
| Cas spéciaux (404 / search / catchall) | 5           | 1      | 404 catchall renvoie 503 — non testable. `/fr/recherche` 503 — non testable                                                                                                                         |
| Documentation switcher + i18n          | 5           | 5      | `LocaleSwitcher.tsx` commenté, `routing.ts` exhaustif, `navigation.ts` SSOT                                                                                                                         |
| Performance / no-flash                 | 5           | 5      | `use-client` minimal, pas de loading state visible, transitions CSS pure                                                                                                                            |
| **TOTAL**                              | **80**      | **42** | NO-GO partiel — bloqué par origine 503 ET hreflang/registry bugs                                                                                                                                    |

---

## GATES

| Gate ROUGE                                        | État   | Détail                                                                                                                              |
| ------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Switcher absent sur page indexable                | 🟢 NON | Switcher présent sur 100 % des pages renvoyant 200                                                                                  |
| Switcher → home générique `/en` au lieu de miroir | 🟢 NON | Aucun cas (sauf `/fr` → `/en` par design)                                                                                           |
| > 10 % pages round-trip cassé                     | 🔴 OUI | Origine 503 sur 16/22 cibles EN = 73 % indisponibles. Mais si on exclut l'outage (P0 infra), round-trip switcher logique = 100 % OK |
| Divergence switcher vs hreflang                   | 🔴 OUI | 3/22 mismatches = 14 % (> 10 %)                                                                                                     |

**Verdict global : 🔴 NO-GO transitoire** — les 2 P0 codables (registry pathnames + alternates metadata) doivent être corrigés. Le P0 outage origine 503 est traité par autres agents/sprint infra.

---

## Top 5 findings

### 1. 🔴 P0 — Outage origine massif (Cloudflare BYPASS → 503)

- **Symptôme** : 12/34 FR pages testées renvoient HTTP 503 « no available server » direct origine (`cf-cache-status: BYPASS`).
- **Pages 503** : `/fr/interventions/individuel`, `/fr/interventions/dirigeants`, `/fr/interventions/conference`, `/fr/interventions/approfondie`, `/fr/interventions/gagner-du-temps`, `/fr/audit/cible`, `/fr/audit/strategique-pme`, `/fr/implementation/ia-custom`, `/fr/implementation/processus`, `/fr/guides`, `/fr/reserver`, `/fr/recherche`.
- **Cibles EN 503** : `/en/interventions/team-trainings`, `/en/interventions/essential`, `/en/audit/flash`, `/en/blog/[slug]`, `/en/case-studies`, `/en/help`, `/en/faq`, `/en/faq/[slug]`, `/en/comparisons`, `/en/locations`, `/en/locations/ile-de-france/paris`, `/en/about`, `/en/methodology`, `/en/ai-stack`, `/en/news`, `/en/book`, `/en/search`.
- **Pattern observé** : hub pages racines (`/fr`, `/fr/interventions`, `/fr/audit`, `/fr/implementation`, `/fr/blog`, `/fr/contact`) sont OK. Sous-pages / dynamiques / EN miroirs sont KO. Suspicion : prerender manifest partiel après dernier deploy ou worker Coolify saturé.
- **Recommandation** : audit Coolify logs + redeploy + smoke-test 100 routes top-trafic. Hors scope agent 6 (renvoyé à agent infra).

### 2. 🔴 P0 — `/fr/actualites` & `/fr/connaissances` absents de `routing.ts` pathnames

- **Symptôme** :
  - `/fr/actualites` 200 (page existe `[locale]/actualites/page.tsx`) → switcher génère `href="/en/actualites"` → 503 (pas de page EN équivalente).
  - `/fr/connaissances` 200 (mais en réalité fallback `[...catchall]` notfound) → switcher génère `/en/connaissances` → 503.
  - **Hreflang fallback en `/en` (home générique)** — révélateur que la metadata helper sait qu'il n'y a pas d'EN équivalent et ne triche pas, mais le switcher si, faute de routing.ts.
- **Conséquence SEO/AEO** : Google reçoit un `hreflang="en" href="/en"` pour des pages thématiques, perte du signal alternate par page → cannibalisation FR/EN sur home.
- **Recommandation** :
  - Soit ajouter `/actualites` dans `routing.ts` avec slug EN (e.g. `/en/news`) + créer la page miroir EN, soit retirer le rendu `/fr/actualites` (rediriger vers `/fr/blog` par exemple).
  - Idem `/fr/connaissances` : confirmer si la route doit exister ou supprimer les liens internes vers elle.

### 3. 🔴 P0 — `hreflang` MISMATCH sur routes à slug traduit (`/interventions/collectives` etc.)

- **Symptôme** : `/fr/interventions/collectives` → switcher href correct `/en/interventions/team-trainings` (via routing.ts) MAIS `<link rel="alternate" hrefLang="en" href="/en/interventions/collectives"/>` (faux — page n'existe pas en EN).
- **Cause racine** : `src/lib/seo.ts` ligne 65 `buildProductMetadata({ path })` — quand `alternates` arg non fourni, EN défaut au même `path`. Les pages avec slug FR ≠ slug EN doivent passer `alternates: { fr, en }` mais ne le font pas (cas `/interventions/collectives/page.tsx` ligne 47).
- **Pages probablement affectées** (à vérifier exhaustivement par grep) : toutes les routes avec slug traduit listées dans `routing.ts` (~40 paires). Échantillon vérifié : 1/22 confirmé bug (collectives). Probablement plus, masqués par origine 503.
- **Fix recommandé** :
  - Option A (rapide) : patcher `buildProductMetadata` pour récupérer le slug EN depuis `routing.pathnames[path].en` automatiquement.
  - Option B (correcte) : ajouter `alternates: { fr: "/interventions/collectives", en: "/interventions/team-trainings" }` explicite dans toutes les pages à slug traduit.
- **Impact SEO** : Google peut désindexer la version FR pour cause de signal hreflang faux, ou pire indexer une URL EN 503 → -10 à -30 % trafic organique EN sur ces pages.

### 4. 🟡 P1 — `/fr/guides` 503 mais routing.ts ne déclare que `/guides/[slug]`

- **Symptôme** : `/fr/guides` 503 origine. Investigation : `src/app/[locale]/guides/[slug]/page.tsx` existe mais **aucun `page.tsx` index** au niveau `/guides/`. Pas d'entrée `/guides` dans `routing.ts`.
- **Conséquence** : si un lien interne pointe vers `/fr/guides` (ex breadcrumb ou nav), 503 garanti. À crawler.
- **Fix** : soit créer la page index `/guides`, soit supprimer tous les liens vers `/fr/guides`.

### 5. 🟢 OK + 🟡 amélioration — hreflang absent sur 0 page, mais home FR↔EN canonical asymétrique

- **Constat positif** : 22/22 pages FR rendues 200 ont bien 3 `<link rel="alternate" hrefLang="...">` (fr, en, x-default).
- **Détail mineur** : home FR `hreflang="x-default" href="/fr/"` (trailing slash). Switcher utilise `/fr` (sans slash). Pas bloquant Google mais inconsistance cosmétique.

---

## Cas spéciaux

### Admin / 404 / Catchall

- Admin (`/[adminPrefix]/...`) : non bilingue, non testé (hors scope per prompt).
- 404 catchall (`/fr/page-inexistante-test`) : **503 origine** au lieu de 404 not-found page. À investiguer (probable lien avec outage P0 #1) — devrait servir `[...catchall]/page.tsx` qui existe pourtant.
- Recherche `/fr/recherche` : **503** (non testable round-trip).

### Round-trip EN → FR (10 pages EN sample)

| EN                   | EN 200 | FR roundtrip OK           | Hreflang |
| -------------------- | ------ | ------------------------- | -------- |
| `/en`                | ✅     | ✅ → `/fr`                | YES      |
| `/en/interventions`  | ✅     | ✅ → `/fr/interventions`  | YES      |
| `/en/audit`          | ✅     | ✅ → `/fr/audit`          | YES      |
| `/en/implementation` | ✅     | ✅ → `/fr/implementation` | YES      |
| `/en/blog`           | ✅     | ✅ → `/fr/blog`           | YES      |
| `/en/contact`        | ✅     | ✅ → `/fr/contact`        | YES      |
| `/en/about`          | 🔴 503 | —                         | —        |
| `/en/methodology`    | 🔴 503 | —                         | —        |
| `/en/news`           | 🔴 503 | —                         | —        |
| `/en/ai-stack`       | 🔴 503 | —                         | —        |

→ 6/6 testables = 100 % round-trip OK. Logique switcher EN→FR irréprochable.

---

## Recommandations prioritaires (hors scope fix, mais à transmettre)

1. **[INFRA — autre agent]** : résoudre l'outage origine 503 avant tout autre patch. Sans ça, l'audit est partiellement aveugle.
2. **[SEO — Sprint dédié 1-2 h]** : patcher `buildProductMetadata` ou auditer/patcher manuellement les ~40 pages à slug traduit pour passer `alternates: { fr, en }` explicite. Test : `curl /fr/interventions/collectives | grep hreflang.*en` doit retourner `/en/interventions/team-trainings`.
3. **[ROUTING — décision Will]** : statuer sur `/fr/actualites` et `/fr/connaissances` — créer page EN miroir + entrée routing.ts OU retirer routes et rediriger 301 vers `/fr/blog`.
4. **[ROUTING — petit]** : ajouter entrée `/guides` index dans `routing.ts` ou supprimer la route (404 propre).
5. **[CONSISTENCY — cosmétique]** : aligner trailing-slash entre `hreflang` et switcher href (decision globale).

---

## Métriques finales

| KPI                                     | Valeur                                   |
| --------------------------------------- | ---------------------------------------- |
| Total FR pages testées                  | 34                                       |
| FR rendues 200 (échantillon usable)     | 22 (64 %)                                |
| Cibles EN 200 (round-trip testable)     | 6 (27 % des cibles EN)                   |
| Round-trip OK / testable                | 6 / 6 = **100 %**                        |
| Round-trip OK / total                   | 6 / 34 = **18 %** ❌ (plombé par outage) |
| Round-trip OK / testable (logique pure) | **100 %** ✅                             |
| Hreflang match                          | 19 / 22 = **86 %**                       |
| Hreflang mismatch                       | 3 / 22 = **14 %** (> 10 % → GATE ROUGE)  |
| Routes hors routing.ts                  | 2 (actualites, connaissances)            |
| Pages avec switcher absent              | 0 / 22 ✅                                |

---

_Fin agent 6. Livré : `agent6-locale-roundtrip.tsv` + `agent6-en-roundtrip.tsv` + ce fichier._
