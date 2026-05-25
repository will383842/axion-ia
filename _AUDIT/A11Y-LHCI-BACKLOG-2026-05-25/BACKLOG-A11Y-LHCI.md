# Backlog A11y + LHCI Gate — 2026-05-25

**Source** : Lighthouse CI post-deploy gate du workflow GH Actions `26418502016` (commit `1a788014`)
**Status** : ❌ Workflow `failure` global (LHCI gate exit 1) malgré Build/Push/Deploy ✅ success
**Audit en prod** : https://axion-ia.com — 5 URLs testées (desktop + mobile = 10 runs × 3 = 30 audits)
**Config** : `lighthouserc.json` racine repo

---

## 1. Failures stricts à fixer (❌ exit code 1)

Ces issues font échouer le gate global. Priorité P1.

### `/fr` — page d'accueil (3 failures)

| Audit                   | Sévérité | Doc Lighthouse                                                  | Cause probable                                                                                                                                                        |
| ----------------------- | -------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-allowed-role`     | ❌       | https://dequeuniversity.com/rules/axe/4.10/aria-allowed-role    | Un `role="..."` est utilisé sur un élément qui n'autorise pas ce role (ex: `role="button"` sur un `<div>` qui devrait être natif `<button>`).                         |
| `aria-prohibited-attr`  | ❌       | https://dequeuniversity.com/rules/axe/4.10/aria-prohibited-attr | Un attribut ARIA est interdit sur le rôle implicite de l'élément (ex: `aria-label` sur un élément non-interactif comme `<p>`).                                        |
| `lcp-discovery-insight` | ❌       | https://web.dev/articles/lcp-discovery                          | L'élément LCP (Largest Contentful Paint) n'est pas découvert assez tôt par le préchargeur. Souvent : image LCP sans `priority`, ou cachée derrière une font-face/CSS. |

**Action** : ouvrir la home dans Chrome DevTools → Lighthouse → Accessibility tab, copier les sélecteurs CSS des éléments fautifs, corriger composant par composant.

---

### `/fr/audit` — hub audit (1 failure CWV — **À PROFILER EN LOCAL**)

| Audit                           | Seuil                          | Mesure prod | Doc                          |
| ------------------------------- | ------------------------------ | ----------- | ---------------------------- |
| `cumulative-layout-shift` (CLS) | ≤ 0.05 (cible interne stricte) | > 0.05      | https://web.dev/articles/cls |

**Investigation Sprint A11y Phase 1 (2026-05-25)** :

- ❌ `AuditHubToggle` (Client `useState`) — analysé, default state `"by-size"` correspond au SSR → pas de re-render mismatch post-hydration. Non coupable.
- ❌ `FadeInOnView` — initial opacity 1, transform appliqué via IntersectionObserver après visible → pas de CLS au load initial.
- ❌ `Illustration` — width/height définis explicitement via `ratioToWidthHeight` map → réserve la place, pas de CLS.
- ⚠️ Font `Fraunces` `display: "optional"` (commit P-105 layout.tsx ligne 68-72) — supposé éviter le swap CLS, mais en cas de cache miss, le fallback `Iowan Old Style` a un cap-height différent → metrics override `adjustFontFallback` censé compenser. À vérifier en mesure live.
- 🟡 Suspect résiduel : `LocalCoverageSection` ou `LocalGeoFaqSection` qui peuvent charger des FAQ ville dynamiquement.

**Action manuelle requise (~30 min)** :

```bash
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
pnpm build && pnpm start  # mode prod local

# Puis dans Chrome :
# 1. Ouvrir http://localhost:3000/fr/audit
# 2. F12 > Performance tab > Reload page > Stop after 5s
# 3. Chercher les barres "Layout Shift" dans la timeline
# 4. Cliquer sur chaque pour voir le DOM responsable
# 5. Mesurer en mobile preset (DevTools > Toggle device toolbar > Pixel 7)
```

Fix attendu typique :

- `min-height` ou `aspect-ratio` sur les sections qui chargent async
- `width`/`height` explicites sur tous les `<Image>` (déjà fait via Illustration normalement)
- Suppression de tout `display: contents` qui peut breaker la mesure CLS

---

### `/fr/implantations/ile-de-france/paris` — hub ville (2 failures)

| Audit             | Doc                                                        | Cause                                                                                                    |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `definition-list` | https://dequeuniversity.com/rules/axe/4.10/definition-list | Un `<dl>` contient autre chose que `<dt>` + `<dd>` (probablement un `<div>` wrapper non-autorisé).       |
| `dlitem`          | https://dequeuniversity.com/rules/axe/4.10/dlitem          | Un `<dt>` ou `<dd>` n'est pas dans un `<dl>` parent (probablement détaché par un wrapper intermédiaire). |

**Cause probable** : composant `VilleTissuEconomique` ou `VilleEcosystemeLocal` utilise `<dl>` pour les paires clé/valeur (industries / chiffres) avec un wrapper `<div>` non-conforme. Sprint A — refactor DRY 2026-05-25.

**Action** : grep `<dl>` dans `src/components/ville/**` + restructurer pour respecter le pattern `<dl><dt>...</dt><dd>...</dd></dl>` strict, OU remplacer par `<ul role="list">` si la sémantique de définition n'est pas requise.

---

## 2bis. État Phase 2 — investigations + skips documentés (2026-05-26)

### ✅ Fixés Phase 2

- **`list` / `listitem` warning sur `/fr`** — 5 patterns `<ul><FadeInOnView><li>...</li></FadeInOnView></ul>` corrigés en `<ul><li><FadeInOnView>...</FadeInOnView></li></ul>` dans `src/app/[locale]/page.tsx` (sections valuePropositions, différenciateurs, cas concrets, audienceSegments, testimonials reviewedCases). axe-core règle `list` exige que les enfants directs de `<ul>` soient `<li>`.

### ⏸️ Skipped Phase 2 — nécessitent profiling live (Will, ~3-4h)

- **`color-contrast`** — Grep des classes `text-X/85` / `text-X/75` a remonté 14 occurrences (`Footer`, `Section`, `LocaleSwitcher`, `CtaBlock`, `PressContact`, `FeatureGrid`, `ProcessSteps`, `InterventionsFamiliesGrid`, `IllustrationPlaceholder`, `StickyMobileCta`, `ImageLightbox`). Sans Chrome DevTools axe scan live, impossible de mesurer le ratio exact par paire (text/background). Fix aveugle (passer tout à `/100`) risque de dégrader le design. **Procédure** : Chrome DevTools axe DevTools extension → run sur chaque URL prod → fix composant par composant en respectant la palette.

- **`errors-in-console`** — Nécessite ouvrir https://axion-ia.com/fr en prod + onglet Console F12 → identifier les erreurs runtime exactes. Probablement Sentry/Plausible/Clarity init order ou hydration warning. **Procédure** : `pnpm build && pnpm start` local → Chrome F12 Console → reproduire en mode prod + reporter sur prod (différences CSP). Peut être source d'une dizaine de warnings indépendants.

- **`deprecations`** — `navigator.userAgent` utilisé dans `src/components/analytics/WebVitals.tsx` (5×). C'est legacy mais pas formellement deprecated par W3C, et `navigator.userAgentData.brands` (User-Agent Client Hints) n'est PAS supporté par Safari → fallback obligatoire. **Action** : aucune (faux positif Lighthouse) OU passer ce warning OFF dans `lighthouserc.json` avec doctrine explicite.

- **`label-content-name-mismatch` sur `/fr/reserver`** — Source identifiée : boutons calendar `<button aria-label="15 — disponible">15<span>Réserver →</span></button>` dans `BookingCalendar.tsx` (l. 1153-1244). Le `<span>Réserver →</span>` reste dans le DOM (opacity-0 par défaut, visible on hover), donc axe lit "15Réserver →" en contenu vs "15 — disponible" en aria-label = mismatch. **Fix correct** : utiliser `aria-describedby` au lieu de `aria-label` pour ajouter "disponible/réservé/passé" en complément du contenu visible. Refactor non-trivial (~1-2h). Pour les cells réservées, idem : "📍 Paris · Conseil · 10-49" visible vs aria-label "15 — réservé" → utiliser `aria-describedby` ou wrap les détails dans `aria-hidden="true"` + accepter que les lecteurs d'écran perdent ces infos (compromis UX).

## 2. Warnings non-bloquants (⚠️ déjà documentés comme P1 Sprint A11y)

Ces warnings sont **déjà gérés comme follow-up assumé** dans le `_assert_doctrine` du `lighthouserc.json` (lignes 76-80). Ils ne bloquent pas le gate mais accumulent de la dette qualité.

| Warning                              | URLs touchées  | Origine documentée                                                                                                                                             |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-contrast`                     | les 5 URLs     | À fixer Sprint A11y dédié — accumulation depuis Sprint S+1                                                                                                     |
| `deprecations`                       | les 5 URLs     | APIs web dépréciées utilisées (`navigator.userAgent` ? `webkitURL` ?) — à investiguer                                                                          |
| `errors-in-console`                  | les 5 URLs     | Erreurs JS runtime en console — probablement Plausible/Clarity quand CSP bloque, ou Sentry init avant DOMContentLoaded                                         |
| `interaction-to-next-paint` (INP)    | les 5 URLs     | `auditRan = 0` → Lighthouse 12 n'arrive pas à simuler une interaction sur ces pages SSG sans handlers visibles. Field metric CrUX prod = source vérité finale. |
| `best-practices` (catégorie globale) | les 5 URLs     | Score 0.74 < 0.9 — dégradé par les warnings ci-dessus                                                                                                          |
| `list` / `listitem`                  | `/fr`          | `<ul>` ou `<ol>` avec enfants non-`<li>`, ou `<li>` orphelins.                                                                                                 |
| `label-content-name-mismatch`        | `/fr/reserver` | Label visible ≠ accessible name (ex: `<button>OK</button>` avec `aria-label="Valider"`).                                                                       |

---

## 3. Priorisation Sprint A11y proposé (~12-16h)

### Phase 1 — Failures stricts (~4h)

1. **`/fr` aria-allowed-role + aria-prohibited-attr** (~1h) : Chrome DevTools axe scan + fix composants
2. **`/fr` lcp-discovery-insight** (~1h) : ajouter `priority` + `fetchPriority="high"` sur l'image LCP (hero), preload font-face
3. **`/fr/audit` CLS regression** (~1h) : profiler le layout shift, fixer dimension fixe (width/height/aspect-ratio)
4. **`/fr/implantations/.../paris` `<dl>` structure** (~1h) : refactorer `VilleTissuEconomique`/`VilleEcosystemeLocal`

### Phase 2 — Warnings prioritaires (~6h)

5. **color-contrast** : audit complet via axe DevTools, fixer toutes les paires text/bg < 4.5:1
6. **errors-in-console** : identifier les sources (Sentry, Plausible, Clarity, hydration warnings)
7. **deprecations** : remplacer APIs dépréciées détectées
8. **`<ul><li>` consistency** : grep `<ul>` / `<ol>` + valider tous les enfants sont `<li>` ou commentaires

### Phase 3 — Polish (~4h)

9. **label-content-name-mismatch** `/fr/reserver` : aligner visible vs aria-label
10. **Re-run LHCI local** + iterate jusqu'à 0 failure
11. **Documentation** : `_AUDIT/A11Y-LHCI-FIXES-2026-XX-XX/` rapport de fix
12. **Re-tune `_assert_doctrine`** : retirer les warnings devenus failures pour ratchet

---

## 4. Reproduction locale du LHCI

```bash
# Depuis C:\Users\willi\Documents\Projets\Axion-IA\axionia\

# Build prod (obligatoire — pas de mode dev pour LHCI)
pnpm build

# Run le gate complet (~10-15 min : 18 URLs × 3 runs × 2 presets desktop/mobile)
pnpm lhci

# Ou via Chrome DevTools direct (1 URL, 5 sec, plus rapide pour itérer)
# Chrome > F12 > Lighthouse tab > Generate report > "Mode: Navigation" "Categories: tout"
```

Les rapports HTML détaillés sont écrits dans `./lhci/` (ignoré par git via `.gitignore`).

---

## 5. Quand re-tighter le gate

Une fois Sprint A11y livré (Phase 1 + 2 minimum) :

1. Re-run LHCI prod : `gh run rerun 26419734853` (ou attendre le prochain push main)
2. Vérifier 0 failure
3. Promouvoir les WARN devenus stables en ERROR dans `lighthouserc.json` :
   - `color-contrast` : WARN → ERROR
   - `aria-*` : déjà ERROR ✓
   - `list` / `listitem` : WARN → ERROR
4. Commit `chore(lhci): tighten gates after Sprint A11y completion`

---

## Références

- Lighthouse audits doc : https://github.com/GoogleChrome/lighthouse/tree/main/docs
- Deque axe rules : https://dequeuniversity.com/rules/axe/4.10/
- Web Vitals 2026 budgets internes : `AGENTS.md` § "Performance budget"
- Run failed : https://github.com/will383842/axion-ia/actions/runs/26418502016/job/77768012399
