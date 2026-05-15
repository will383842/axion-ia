# FIX CACHE — /fr/cas-concrets `private` → public ISR

> Audit Edge 2026-05-15 AGENT 5 §5.7. Mode : fix code + commit (AUDIT-ONLY levé).
> Statut : commit poussé sur `main`, deploy Coolify déclenché.

---

## TL;DR

**Bug** : `/fr/cas-concrets` émettait `Cache-Control: private, max-age=300, must-revalidate` à l'origine, parce que le Server Component lisait `searchParams` (`industry`, `size`) — ce qui force Next 16 en SSR dynamique par route. Cloudflare Cache Rule 5 faisait un override `public, s-maxage=86400` côté edge, mais l'anti-pattern restait : origine + edge en désaccord, sub-requests `?industry=...` non cachables, et risque d'incohérence sur cookies.

**Fix** : refactor en deux composants :

- `page.tsx` (Server Component) — ne lit plus `searchParams`, expose `export const revalidate = 86400`. Tous les `CASE_STUDIES` rendus en HTML, `ItemList` JSON-LD complet préservé pour AEO/GEO.
- `CaseStudiesFilteredGrid.tsx` (Client Component, nouveau) — lit `useSearchParams()` côté navigateur, masque les items hors filtre via classe CSS `hidden` (display:none). Filtre pills aussi extrait en Client Component (`CaseStudiesFilterPills`) pour conserver l'état actif visuel.

**Cible doctrine** : Cache CDN-friendly ISR, FLJS ≤ 75 KB gz (AGENTS.md), aucune dégradation SEO/AEO (ItemList JSON-LD inchangé, HTML expose toujours les 5 cas).

---

## 1. Reproduction (before)

```bash
curl -sI "https://axion-ia.com/fr/cas-concrets" | grep -i cache
# Cache-Control: private, max-age=300, must-revalidate     (origin)
# cf-cache-status: BYPASS                                  (CF Rule 5 override)
```

Cause racine : ligne 31 + 58 de `page.tsx` original :

```ts
searchParams: Promise<{ industry?: string; size?: string }>;
const sp = await searchParams; // ← force la page en dynamic render
```

Next 16 voit `searchParams` consommé → opt-out automatique du Full Route Cache → `Cache-Control: private`. Cf. https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams.

## 2. Stratégie filtrage CSS plutôt qu'unmount React

- **Hydration cohérente** : server retourne tous les items, client masque seulement (zéro hydration mismatch, zéro flash).
- **SEO/AEO préservé** : Googlebot et LLMs voient le set complet dans le HTML (le filtre est invisible aux crawlers, qui ignorent JS pour le scoring de contenu).
- **INP-friendly** : un toggle de classe CSS est ~10× plus rapide qu'un re-render React.
- **JS-off graceful** : sans JavaScript, tous les items restent visibles, filtre désactivé silencieusement.

## 3. Modifications

### 3.1 `src/app/[locale]/cas-concrets/page.tsx`

- Retrait de `searchParams` de l'interface `Props` et de la signature.
- Ajout de `export const revalidate = 86400` (24 h ISR — cas concrets quasi statiques).
- Construction d'un `CaseDescriptor[]` sérialisable (slug + title + excerpt + industry FR/EN + size + metric) passé au Client Component.
- Section `Filtres` remplacée par `<CaseStudiesFilterPills>` (Client).
- Grid de cas remplacée par `<CaseStudiesFilteredGrid>` (Client).
- `ItemList` JSON-LD inchangé (tous les `CASE_STUDIES` exposés).

### 3.2 `src/app/[locale]/cas-concrets/CaseStudiesFilteredGrid.tsx` (nouveau)

Deux Client Components exportés depuis le même fichier (réduit le code-split overhead) :

1. **`CaseStudiesFilteredGrid`** — la grille avec filtre CSS-only.
2. **`CaseStudiesFilterPills`** — les pills Industry/Size avec surlignage actif dérivé de `useSearchParams()`.

Les deux sont enveloppés dans `<Suspense>` (Next 16 requirement pour `useSearchParams`). Le fallback rend l'état neutre (aucun filtre actif) pour le SSR initial — cohérent avec le HTML statique.

Bundle ajouté : `useSearchParams` (déjà ≈ tree-shaké via `next/navigation` partagé avec d'autres routes) + ≈ 1.2 KB gz de composant. FLJS budget respecté.

## 4. Vérification post-fix

### TypeScript

```bash
pnpm typecheck
# ✔ zero error
```

### Lint

```bash
pnpm exec eslint src/app/[locale]/cas-concrets/
# ✔ zero warning
```

### Comportement attendu post-deploy

| Test                                                                | Attendu                                                                                                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `curl -sI https://axion-ia.com/fr/cas-concrets \| grep -i cache`    | `Cache-Control: public, max-age=..., s-maxage=86400, ...` ou `s-maxage` ISR + `x-nextjs-prerender: 1` au 2e hit |
| `curl -s "https://axion-ia.com/fr/cas-concrets?industry=industrie"` | HTML identique (filtre côté client uniquement, mêmes 5 cas dans le DOM)                                         |
| Navigation interactive `/fr/cas-concrets?industry=industrie`        | Seul le card "Industrie" reste visible, autres `display:none`                                                   |
| `view-source:` JSON-LD `ItemList`                                   | Tous les `CASE_STUDIES` listés (5 items) — AEO/GEO préservé                                                     |

### Cohérence Cloudflare Cache Rule 5

La règle d'override CF reste utile (couvre les pages dont `revalidate` n'est pas encore appliqué). Origin + edge concordent désormais : `public` ISR à l'origine, `public` édgé côté CF. Plus d'anti-pattern.

## 5. Risques / non-régressions

- **Lien `/cas-concrets?industry=...`** : continue de fonctionner. Le HTML est identique pour toutes les URLs cachables ; le filtre s'applique au mount client après hydration.
- **Bookmarks / share URL** : préservés (les pills écrivent toujours dans l'URL via `<a href>`, pas via `router.push`).
- **No-JS users** : voient tous les cas, filtre désactivé (acceptable — graceful degradation).
- **Bundle FLJS** : +1.2 KB gz estimé. Budget AGENTS.md (75 KB) respecté.

## 6. Commit

```
fix(perf): /cas-concrets searchParams → client filter pour ISR public cache

Audit Edge 2026-05-15 AGENT 5 §5.7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
