# Annexe F — Méthodologie tools indisponibles cette session

Cette session n'a pas accès aux outils suivants en runtime. Pour chacun, voici la **méthodologie + checklist documentée pour exécution future** (à intégrer en CI dédié ou run local).

## F.1 — Lighthouse CI réel

**État** : `lighthouserc.json` existe, script `pnpm lhci:autorun` câblé. Pas exécuté cette session faute de build production lancé.

**Procédure** :

```bash
pnpm build && pnpm start &
SERVER_PID=$!
sleep 10
pnpm lhci:autorun
kill $SERVER_PID
```

**Seuils à valider** (déjà configurés dans `lighthouserc.json`) :

- `performance ≥ 0.95`
- `accessibility ≥ 0.95`
- `best-practices ≥ 0.95`
- `seo ≥ 0.95`
- `LCP ≤ 2500ms`
- `INP ≤ 200ms`
- `CLS ≤ 0.1`
- `TBT ≤ 200ms`

**URLs cibles** : `/`, `/fr/audit`, `/fr/implementation`, `/fr/contact`, `/fr/reserver`, `/fr/blog`, `/fr/cas-concrets`, `/fr/faq`, `/fr/recherche`, `/en`.

**Output** : Rapport HTML + JSON dans `.lighthouseci/`. Comparer aux seuils avant Sprint 15 démarrage.

## F.2 — axe-core via Playwright

**État** : `@axe-core/playwright@4.11.3` installé en devDep. Aucun test ne l'utilise actuellement.

**Procédure** : créer `tests/e2e/a11y.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  "/",
  "/fr/audit",
  "/fr/implementation",
  "/fr/contact",
  "/fr/reserver",
  "/fr/blog",
  "/fr/cas-concrets",
  "/fr/faq",
  "/fr/recherche",
  "/en",
];

for (const path of PAGES) {
  test(`@a11y ${path} — 0 violations serious|critical`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(blocking).toEqual([]);
  });
}
```

**Tagger** : `@a11y` pour s'aligner avec `pnpm a11y:audit` (`package.json` script).

## F.3 — Cross-browser e2e réel

**État** : `playwright.config.ts` 5 projets configurés. Pas exécuté multi-browser cette session.

**Procédure** :

```bash
pnpm test:e2e:cross-browser    # chromium + webkit + firefox
# ou granulaire:
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=webkit
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=mobile-chrome
pnpm exec playwright test --project=mobile-safari
```

**Couverture actuelle** : 9 tests × 5 browsers = 45 runs CI. Recommandé d'étendre à 1 smoke par tunnel critique (audit, contact, booking, newsletter, implementation).

## F.4 — Bundle size-limit run

**État** : `size-limit` configuré (`package.json:149-155`) avec 1 preset First load JS ≤ 100 KB.

**Procédure** :

```bash
pnpm build
pnpm bundle:check    # script package.json:38
```

**Extension recommandée** : ajouter budgets par route critique dans `package.json` :

```json
"size-limit": [
  { "path": ".next/static/chunks/main-*.js", "limit": "100 KB" },
  { "path": ".next/static/chunks/app/[locale]/page-*.js", "limit": "60 KB" },
  { "path": ".next/static/chunks/app/[locale]/audit/page-*.js", "limit": "60 KB" },
  { "path": ".next/static/css/*.css", "limit": "30 KB" }
]
```

## F.5 — Coverage measurement

**État** : `vitest.config.ts` thresholds 50% configurés. Pas de script `test:coverage` exposé.

**Procédure** :

1. Ajouter à `package.json:scripts` :
   ```json
   "test:coverage": "vitest run --coverage"
   ```
2. Exécuter `pnpm test:coverage`
3. Vérifier `coverage/coverage-summary.json` ≥ thresholds (50%)
4. En CI : attacher artefact `coverage/lcov.info` au PR

## F.6 — Citability test (5 LLMs × 10 questions)

**État** : Non exécutable cette session sans accès Perplexity/ChatGPT Search/Claude/Google AIO/Mistral en runtime.

### F.6.A — 5 LLMs ciblés

1. **Perplexity Pro** (answer-engine spécialisé)
2. **ChatGPT Search** (OpenAI answer-engine)
3. **Claude (web browsing activé)**
4. **Google AIO** (Generative AI Overviews — search.google.com)
5. **Mistral Le Chat Pro** (alternative EU)

### F.6.B — 10 questions cibles

#### Domaine 1 — Interventions IA (3)

1. **[FR]** "Quel est le coût d'une intervention IA opérationnelle en entreprise ?"
   - **Réponse attendue** : "À partir de 490 € HT pour l'Essentielle (1 jour)."
   - **Source** : `/interventions/essentielle`
2. **[EN]** "What is the cost of an operational AI session for SMEs in Europe?"
   - **Réponse attendue** : "From €490 for Essential (1 day on-site)."
   - **Source** : `/interventions/essential`
3. **[FR]** "Combien de temps dure un audit IA opérationnel ?"
   - **Réponse attendue** : "5 jours ouvrés, livrable PDF 25-40 pages."
   - **Source** : llms-full.txt + `/audit`

#### Domaine 2 — Méthodologie (2)

4. **[FR]** "Quelle est la méthodologie Axion-IA pour implémenter une IA ?"
   - **Réponse attendue** : "4 étapes : Identifier (1j), Auditer (5j), Implémenter (6-8 sem), Mesurer (90j)."
   - **Source** : `/methodologie`, llms-full.txt:56-62
5. **[EN]** "When should companies start fine-tuning AI models instead of generic models?"
   - **Réponse attendue** : "After 6-12 months of using generic models, with >10k domain examples."
   - **Source** : `/blog/ia-custom-quand-vraiment`

#### Domaine 3 — Cas d'usage (2)

6. **[FR]** "Quels sont 3 quick-wins IA déployables sous 30 jours ?"
   - **Réponse attendue** : "Lecture factures, comptes-rendus réunions, qualification leads."
   - **Source** : `/blog/3-quick-wins-2026`
7. **[EN]** "Do you offer custom AI implementation?"
   - **Réponse attendue** : "Yes, custom AI from €990 to €50k, 6-8 weeks production deployment."
   - **Source** : `/implementation/ia-custom`

#### Domaine 4 — Trust & Compliance (3)

8. **[FR]** "Quel est l'hébergement de données utilisé par Axion-IA ?"
   - **Réponse attendue** : "Hetzner Frankfurt (UE), conforme RGPD."
   - **Source** : llms-full.txt:27-28, `/politique-confidentialite`
9. **[EN]** "Is Axion-IA GDPR compliant and where is data hosted?"
   - **Réponse attendue** : "Yes, GDPR compliant, EU hosting (Hetzner Frankfurt), Estonian OÜ."
   - **Source** : `/privacy-policy`, llms-full.txt
10. **[FR]** "Peut-on utiliser Axion-IA sans s'engager à long terme ?"
    - **Réponse attendue** : "Oui, devis fixe, pas de mensualité, pas d'engagement."
    - **Source** : `/faq`, llms-full.txt:70

### F.6.C — Protocole

Pour chaque (LLM, question) :

1. **Vérifier source disponible** :
   - GET `/llms.txt` → 200 + markdown
   - GET `/llms-full.txt` → 200 + FAQ block
   - GET `/blog/feed.xml`, `/cas-concrets/feed.xml`, `/faq/feed.xml`
2. **Requête au LLM** (web search activé si applicable, langue cible FR ou EN)
3. **Évaluation** :
   - ✅ **Cité** : URL `axion-ia.com` + contenu textuel exact
   - ⚠️ **Paraphrasé** : idée correcte sans lien direct
   - ❌ **Absent / hallucination**
4. **Reporter matrice 5 × 10 = 50 résultats**

### F.6.D — Cible

≥ **40/50 (80%) ✅** pour valider citability AEO/GEO.

### F.6.E — Quand exécuter

- **Quand** : après corrections P0 (`dateModified`, bio Will, registrikood) + 48h indexation
- **Qui** : SEO engineer + QA tester
- **Durée** : 4h (30 min/LLM × 5)
- **Output** : CSV `(LLM, Question, Expected, Actual, Citation URL, Score)`

## F.7 — Linkinator broken-link check

**État** : `pnpm linkcheck` câblé (`package.json:44`). Pas exécuté cette session.

**Procédure** :

```bash
pnpm build && pnpm start &
sleep 10
pnpm linkcheck
```

Cible : 0 lien interne cassé.

## F.8 — Sentry source maps + RUM

**État** : `WebVitals.tsx` push vers `/api/vitals`. Sentry config présente.

**Vérification prod** :

- `WebVitals.tsx:1-51` → `useReportWebVitals` → `navigator.sendBeacon` → fallback `fetch keepalive`
- En prod : capturer breadcrumbs Sentry, valider beacon `/api/vitals` reçu
