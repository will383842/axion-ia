# FIX CLS — Audit Web Vitals 2026-05-15 AGENT 1

> Statut : commit `23b9ccf` push origin/main, deploy Coolify en cours.
> Mode : fix code + commit (Will a levé AUDIT-ONLY).

---

## TL;DR

**Bug** : CLS = **0.479** mesuré Lighthouse mobile sur `/tarifs` → redirige `/fr/tarifs` (route inexistante, rendu en `LocaleNotFound` mais HTTP 200).

**Cause racine** : `[locale]/loading.tsx` global rend un skeleton sous-dimensionné (~160 px) pendant le SSR streaming, puis Next hydrate le contenu réel (~800 px sur la 404 LocaleNotFound). Footer poussé de ~700 px → 1 unique shift score = **0.479** (cause à 100 %).

**Fix** : `[locale]/loading.tsx` réécrit pour matcher la structure typique d'une page éditoriale (Section halo-warm titleAs="h1" + 1 section secondaire). Hauteur skeleton ≈ 800-900 px mobile, alignée avec LocaleNotFound, FeatureGrid, ProcessSteps.

**Cible doctrine** (`AGENTS.md`) : CLS = 0 strict. Cible Google « good » = 0.1.

---

## 1. Reproduction

```
lighthouse https://axion-ia.com/tarifs \
  --output=json \
  --output-path=_AUDIT/CONTENT-GEN-PERF-2026-05-15/lh-tarifs-cls-before.json \
  --chrome-flags="--headless --no-sandbox" \
  --form-factor=mobile \
  --throttling-method=simulate \
  --quiet --only-categories=performance
```

**Résultat (before)** : `lh-tarifs-cls-before.json`

| Métrique          | Valeur   | Verdict                       |
| ----------------- | -------- | ----------------------------- |
| FCP               | 1.85 s   | OK                            |
| LCP               | 6.24 s   | ROUGE                         |
| **CLS**           | **0.48** | **ROUGE** (cible interne = 0) |
| TBT               | 2 030 ms | ROUGE                         |
| Performance score | 27 / 100 | ROUGE                         |

`audits["layout-shifts"].details.items[0]` :

- selector = `body.bg-bg > footer.bg-mocha-rich`
- score = 0.479584
- nodeLabel = "Axion-IA\n\nLe cabinet IA qui vous fait gagner.\n\nSERVICES\nEssentielle · 390 €\nInt…"
- boundingRect final : top=987, bottom=2246, height=1260

**Un seul élément shift** : le footer. 100 % du CLS.

---

## 2. Diagnostic

### 2.1 Pourquoi le footer shift ?

`/fr/tarifs` n'existe pas en tant que route (le pricing est sur `/interventions`). Next.js déclenche `notFound()` → rendu `LocaleNotFound` sous `<main>` MAIS avec HTTP 200 OK (bug SEO secondaire, voir §5).

Cinématique du shift :

1. SSR streaming envoie le **skeleton** de `[locale]/loading.tsx` :

   ```tsx
   <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-12">
     <div className="bg-border h-4 w-32 animate-pulse rounded-xs" />
     <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" />
     <div className="bg-border mt-6 h-4 w-1/2 animate-pulse rounded-xs" />
     <span className="sr-only">Loading…</span>
   </div>
   ```

   Hauteur ≈ padding 128 px + 4 + 16 + 12 + 4 + 24 + 4 = **~190 px**.

2. Footer rendu juste sous → footer top ≈ headerHeight (90 px) + 190 = **~280 px** (bien visible mobile viewport 823 px).

3. Hydration → React render le vrai `LocaleNotFound` :
   - `Section titleAs="h1" tone halo-warm` (default pageHero padding ≈ 128 px + halo)
   - eyebrow + h1 + description (≈ 200 px)
   - 2 CTAs (≈ 48 px + mt-?)
   - grid 4 cards `sm:grid-cols-2` (≈ 280 px mobile)
   - Total ≈ **800-900 px**.

4. Footer push de ~700 px → score CLS = `distance_fraction × impact_fraction` ≈ `(700/823) × 0.56` ≈ **0.479**. Cohérent avec mesure.

### 2.2 Pourquoi `/fr` directe = CLS 0 ?

Mesure parallèle sur `/fr` (home) : CLS = 0. Différence :

- `/fr` est full SSG/ISR cacheable (page « home » contenu marketing), pas de Suspense boundary 404
- `/fr/tarifs` = route inexistante → rendu dynamique avec `loading.tsx` boundary
- Les pages dont `page.tsx` ne déclenche pas de fetch dynamique ne stream PAS le skeleton

Le bug CLS impacte donc **toutes les routes sans loading.tsx granulaire** dont le rendu déclenche le Suspense (404, blog, articles dynamiques, etc.).

### 2.3 Pourquoi les autres `loading.tsx` ne sont pas affectés

Les routes `/audit`, `/contact`, `/reserver`, `/implantations/[region]/[ville]` ont des `loading.tsx` granulaires (P-101 à P-104) déjà dimensionnés. Ils restent prioritaires sur leurs sous-arbres. Le fix touche uniquement le **fallback global** `[locale]/loading.tsx`.

---

## 3. Patch

Fichier : `src/app/[locale]/loading.tsx` (replace).

Avant (10 lignes utiles) :

```tsx
export default function LocaleLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-12">
      <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
      <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
      <div className="bg-border mt-6 h-4 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
```

Après (skeleton dimensionné Section pageHero + section secondaire) :

- `<section bg-halo-warm pt-12 pb-20 …>` matche `Section.tsx` ligne 86 (pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32)
- eyebrow `h-4 w-32` + h1 `h-16 sm:h-20 lg:h-24 w-3/4` + description 1-2 lignes
- CTAs row `gap-4` 2 boutons `h-12 rounded-full` (matche `Cta size="lg"`)
- Grid 4 cards `mt-14 sm:grid-cols-2 lg:grid-cols-4` × `h-20 rounded-xl border`
- Section secondaire `bg-paper py-16 sm:py-20 lg:py-24` × `h-60 sm:h-64`

Hauteur totale ≈ 800-900 px mobile, 950-1050 px desktop. Matche LocaleNotFound, ainsi que la moyenne des pages éditoriales (`/glossaire`, `/cookies`, blog articles, etc.).

`prefers-reduced-motion` natif Tailwind respecté (animate-pulse skip si reduce).

---

## 4. Validation

### 4.1 Pré-commit local

| Check                     | Résultat                        |
| ------------------------- | ------------------------------- |
| `pnpm typecheck`          | OK (tsc --noEmit)               |
| `pnpm anti-hex:check`     | OK — 0 hardcoded hex            |
| `pnpm anti-siren:check`   | OK — 0 occurrence SIREN         |
| `pnpm use-client:check`   | OK — every directive justified  |
| `pnpm test --run loading` | aucun test loading.tsx (normal) |

### 4.2 Commits & deploy

Deux commits liés à ce fix :

| SHA       | Auteur trail                                                                   | Contenu réel                                              | Note                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `23b9ccf` | "fix(content-gen): wire CONTENT_TYPES_ALL …"                                   | **diff réel = `src/app/[locale]/loading.tsx` UNIQUEMENT** | Bug d'attribution message git suite à concurrence avec un commit local content-gen de Manon. Le diff réel est le **fix CLS loading.tsx**.                                                                                                                        |
| `0bfa6f5` | "fix(build): wire CONTENT_TYPES_ALL → policies-constants (unblock prod build)" | `policies.ts` + `batches/page.tsx`                        | Débloque le build prod cassé sur `23b9ccf` (le commit `2d5ab9d` de Manon avait créé `policies-constants.ts` mais oublié de wire `policies.ts` et `batches/page.tsx`, fail Next 16 strict "use server"). Sans ce commit, mon fix CLS ne pouvait pas être déployé. |

Push : origin/main ✓
Coolify deploy 25911324882 (commit `23b9ccf` seul) : **failed** sur `pnpm build` à cause du bug Next 16 "use server" hérité.
Coolify deploy 25912001469 (commit `0bfa6f5` débloque le build) : `in_progress` au moment de la rédaction.

CI Gates A+B (Prettier) : failed sur 3 fichiers Manon (`cas-concrets/page.tsx`, `cas-concrets/CaseStudiesFilteredGrid.tsx`, `FIX-CAS-CONCRETS-CACHE.md`) — hors scope CLS. Le gate Coolify deploy est séparé et tente quand même.

### 4.3 Mesure post-deploy — BLOQUÉE par l'instabilité Coolify

À l'issue de cette session, **le deploy Coolify est cassé** et plusieurs runs successifs ont échoué :

| CI run      | Commit               | Statut  | Cause                                                                      |
| ----------- | -------------------- | ------- | -------------------------------------------------------------------------- |
| 25911324882 | `23b9ccf` (CLS fix)  | failure | Build fail Next 16 "use server" CONTENT_TYPES_ALL — débloqué par `0bfa6f5` |
| 25911533986 | `3a6d0fb` (Manon)    | failure | (même cause préalable)                                                     |
| 25912001469 | `0bfa6f5` (wire fix) | failure | Build freeze à `exporting layers`, cancelled-by-user après ~40min          |
| 25912866131 | `48514e7` (Manon)    | failure | Pipeline encore stuck                                                      |
| 25913173902 | `b14c5d0` (Manon)    | failure | (queue Coolify cassée)                                                     |
| 25913700948 | `b8eba13` (Manon)    | failure | Deployment cancelled-by-user (queue zombie)                                |

Coolify lui-même répond 500 sur `POST /api/v1/deploy` au moment du wrap-up. Le container hébergeur (axion-ia.com production) **continue de servir l'ancien code** — confirmé par `curl --resolve axion-ia.com:443:178.105.55.15` qui retourne encore l'ancien skeleton SSR `mt-4 / mt-6 / px-4 py-16`.

**Mon fix CLS loading.tsx est sur main mais pas encore en prod.** Action Will :

1. Investiguer pourquoi Coolify est instable (disque saturé ? jobs zombies ? Horizon worker bloqué ?)
2. Relancer un deploy clean quand Coolify est stable (`POST /api/v1/deploy?uuid=$COOLIFY_APP_UUID&force=true`)
3. Vérifier le HTML SSR (`curl --resolve axion-ia.com:443:178.105.55.15 'https://axion-ia.com/fr/tarifs' | grep '<main'`) — doit contenir `bg-halo-warm pt-12 pb-20` au lieu de `px-4 py-16` quand mon code est déployé
4. Purger le cache Cloudflare (`POST /zones/$ZONE/purge_cache` pour `/fr/tarifs`)
5. Lancer la commande Lighthouse :

```
lighthouse https://axion-ia.com/tarifs \
  --output=json \
  --output-path=_AUDIT/CONTENT-GEN-PERF-2026-05-15/lh-tarifs-cls-after.json \
  --chrome-flags="--headless --no-sandbox" \
  --form-factor=mobile --throttling-method=simulate \
  --quiet --only-categories=performance
```

Cible : CLS ≤ 0.05 (idéal 0). Si > 0.1, ne pas masquer — noter et investiguer (autre source).

---

## 5. Bug SEO orthogonal détecté (hors scope CLS)

`curl -sIL https://axion-ia.com/tarifs` retourne **HTTP 200** sur les pages 404 (`/fr/tarifs`, `/fr/route-qui-n-existe-pas-123`). Next 16 par défaut renvoie 200 OK sur les Server Components qui appellent `notFound()` quand on est dans un layout segment qui n'a pas configuré `not-found.tsx` au bon niveau.

**Impact SEO** : Google crawler indexe ces URLs comme valides → soft 404 dans Search Console → dilution autorité domaine. À fixer dans un commit dédié hors scope CLS.

Pistes :

- Vérifier le placement de `not-found.tsx` (actuel `src/app/[locale]/not-found.tsx` + `src/app/not-found.tsx`)
- Selon Next 16 doctrine, `notFound()` dans un Server Component déclenche le rendu de `not-found.tsx` ET la response HTTP 404. À vérifier dans `node_modules/next/dist/docs/02-app/01-routing/06-not-found.mdx`.
- Curl headers actuels suggèrent que la réponse passe par `_not-found` segment mais sans set status code.

---

## 6. Travail résiduel

1. **Mesurer CLS post-deploy** (lh-tarifs-cls-after.json + diff before/after) — bloqué sur Coolify deploy finished
2. **Re-mesurer sur d'autres pages 404-like et SSG sans loading.tsx dédié** (échantillon : `/fr/blog/n-importe-quoi`, `/fr/glossaire`)
3. **Fix SEO 404 → HTTP 404** (hors scope CLS)
4. **Re-mesurer Web Vitals globaux** (LCP 6.24s + TBT 2030 ms restent ROUGES — Sentry slim batch 2 déjà commit `df5b9ed` devrait aider mais c'est une autre piste de travail)

---

## 7. Artefacts produits

| Fichier                                                        | Description                                            |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `_AUDIT/CONTENT-GEN-PERF-2026-05-15/lh-tarifs-cls-before.json` | Lighthouse mobile /tarifs AVANT fix (CLS 0.479)        |
| `_AUDIT/CONTENT-GEN-PERF-2026-05-15/lh-home-cls-before.json`   | Lighthouse mobile /fr (home — CLS 0, contrôle négatif) |
| `_AUDIT/CONTENT-GEN-PERF-2026-05-15/lh-tarifs-cls-after.json`  | à générer post-deploy                                  |
| `_AUDIT/CONTENT-GEN-PERF-2026-05-15/FIX-CLS-HOME.md`           | ce rapport                                             |

---

## 8. Notes auditeur

- Le titre de la mission parle de « CLS Home » mais la mesure source provenait de `/tarifs`. La home `/fr` directe = CLS 0. Le réel bug = le **loading.tsx global** qui impacte toute route 404 ou dynamique sans loading granulaire. Le fix est donc plus large que « home » — il résout potentiellement le CLS de plusieurs dizaines de pages.
- Aucune migration `adjustFontFallback` n'a été nécessaire : `next/font/google` (Manrope, Fraunces, Inconsolata) active ce flag par défaut depuis Next 13. Pas de font CLS détecté.
- Aucune image hero sans dimensions trouvée sur les pages testées.
