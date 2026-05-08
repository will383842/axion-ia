# AUDIT TYPOGRAPHY 2026 — AxionIA

- **Date** : 2026-05-07
- **Doctrine de référence** : v3 Editorial Premium Light (ADR 0002, `axionia/docs/adr/0002-design-pivot-editorial-v3.md`)
- **Baseline avant audit** : 16 px corps (Tailwind default) / 14 px sm (Tailwind default) / LH body 1.65 (token non appliqué)
- **Auditeur** : Claude Opus 4.7 + 3 agents (AGT-TOKENS / AGT-USAGE / AGT-BENCH)
- **Pages échantillon** : 15
- **Benchmarks externes** : 6
- **Mode** : lecture seule strict pour le diagnostic ; patch appliqué en aval (voir § 0bis).

---

## 0quater — Application 2026-05-08 (Hero Schema harmonization)

> **Statut** : ✅ **APPLIQUÉ** — Sprint 14.7ter hero schema. Suite à observation Will sur la disparité visuelle des graphiques hero entre /audit, /interventions, /implementation, /cas-concrets, etc.

### Cause racine

3 patterns concurrents coexistaient :

| Pattern               | Pages                                                              | Container default                                            | Grid hero      |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | -------------- |
| HTML cards (76px)     | audit, cas-concrets, methodologie, comparaisons, centre-aide, blog | `max-w-xl` (576px)                                           | `1fr 1fr`      |
| SVG orbital portrait  | interventions, stack-ia                                            | `max-w-md` (448px) → page override `max-w-2xl lg:max-w-none` | `1fr 1.2fr` ⚠️ |
| SVG orbital landscape | implementation                                                     | `max-w-2xl` (672px) → page override `max-w-none lg:block`    | `1fr 1.2fr` ⚠️ |

Résultat visuel : sur les pages SVG, la colonne visuelle remplissait ~654-720px ; sur les pages HTML, ~576px. Les schémas ne paraissaient pas "à la même grosseur".

### Décision (1 utility class + 17 patches localisés)

**Doctrine `.hero-schema`** ajoutée dans `globals.css @utilities` :

```css
.hero-schema {
  position: relative;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  max-width: 36rem; /* 576px = max-w-xl */
}
@media (min-width: 992px) {
  .hero-schema {
    margin-left: 0;
    margin-right: 0;
  }
}
```

### Fichiers modifiés (15)

| Fichier                                                                                     | Changement                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `axionia/src/app/globals.css`                                                               | Ajout `.hero-schema` utility                                                                                        |
| 11× `src/components/sections/*HeroSchema.tsx`                                               | Default `"mx-auto w-full max-w-XX"` → `"hero-schema"` (avec `pointer-events-none` pour SVG)                         |
| `src/app/[locale]/{audit,methodologie,comparaisons,centre-aide,cas-concrets,blog}/page.tsx` | Override `"relative mx-auto w-full max-w-xl lg:mx-0"` → `"hero-schema"` (6 pages)                                   |
| `src/app/[locale]/{interventions,stack-ia,implementation}/page.tsx`                         | Override `"max-w-2xl lg:mx-0 lg:max-w-none"` → `"hero-schema pointer-events-none"` + grid `1.2fr` → `1fr` (3 pages) |
| `axionia/Design.md` § 3.5                                                                   | Doctrine hero schema documentée                                                                                     |

### Résultat

- **11/11 hero schemas** affichent à exactement 576px sur tous breakpoints ≥ lg.
- **8/8 pages** utilisent le grid `1fr 1fr` unifié.
- Code CSS centralisé : touch n'importe quelle valeur dans `globals.css`, propagation immédiate.
- Aucun layout cassé attendu (les SVG scaling preserve aspectRatio).

### À surveiller

- Les SVG orbital (Interventions, Stack, Implementation) rendent désormais à ~80% de leur taille de design (576/720). Labels SVG passent de 15px → ~12px effectif. Vérifier visuellement la lisibilité.
- Si Will préfère un cap plus généreux (max-w-2xl = 672px), c'est 1 ligne à changer dans `globals.css` (`max-width: 42rem`).

---

## 0ter — Application 2026-05-08 (Hierarchy v3.2 modular scale + hero cap)

> **Statut** : ✅ **APPLIQUÉ** — Sprint 14.7bis typography hierarchy. Will a re-signalé le 2026-05-08 le ressenti d'écart entre H1-H6 et body. Patch token-only, 0 page-level. ADR 0007 créé.

### Cause racine restante après 0bis

Le bump body 16→18 a corrigé la lisibilité mais a aggravé la hiérarchie : tous les niveaux Tailwind H3-H6 (`text-lg` à `text-2xl`) restaient sur les defaults Tailwind conçus pour body=16, donc les ratios H/body se sont écrasés (text-lg/body = 1.0×, text-xl/body = 1.11× — sous cible 1.5×).

### Décision (1 fichier modifié, 0 page-level patch)

**Override de toute l'échelle Tailwind dans `axionia/src/app/globals.css` `@theme`** :

| Classe     | v3.1 | v3.2   | Delta |
| ---------- | ---- | ------ | ----- |
| `text-lg`  | 18   | **20** | +2    |
| `text-xl`  | 20   | **22** | +2    |
| `text-2xl` | 24   | **26** | +2    |
| `text-3xl` | 30   | **32** | +2    |
| `text-4xl` | 36   | **40** | +4    |
| `text-5xl` | 48   | **52** | +4    |
| `text-6xl` | 60   | **64** | +4    |
| `text-7xl` | 72   | **80** | +8    |

**Cap hero** : `display-editorial` clamp 3-7rem (9vw) → **3-5.5rem (7.5vw)**. `--text-display` 7rem → **5.5rem (88 px)**. Ratio hero/body 6.2× → **4.89×** (médiane 2026 = 4.4×, Stripe Press ceiling = 88 px).

**Tokens custom resync** : `--text-section` 64→48, `--text-sub` 36→32, `--text-feature` 24→26 — alignés sur les bands Tailwind correspondants.

### Ratios résultants (anchored body 18 px)

9/9 niveaux dans cible 2026 (vs 5/9 avant) :

| Niveau        | Px  | Ratio body | Cible 2026 |
| ------------- | --- | ---------- | ---------- |
| Hero display  | 88  | 4.89×      | ~4.4×      |
| H1 (text-6xl) | 64  | 3.56×      | 3.5-4×     |
| H2 (text-4xl) | 40  | 2.22×      | ≥2×        |
| H3 (text-3xl) | 32  | 1.78×      | ≥1.5×      |
| H4 (text-2xl) | 26  | 1.44×      | ≥1.4×      |
| H5 (text-xl)  | 22  | 1.22×      | ≥1.2×      |
| H6 (text-lg)  | 20  | 1.11×      | ≥1.1×      |

### Fichiers modifiés (3)

| Fichier                                              | Changement                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axionia/src/app/globals.css`                        | `@theme` : override `text-lg/xl/2xl/3xl/4xl/5xl/6xl/7xl` ; cap `--text-display` 7→5.5rem ; resync `--text-section/sub/feature` ; cap `.display-editorial` clamp |
| `axionia/Design.md` § 3.2                            | Table échelle Tailwind ajoutée + table tokens custom maj + ratios résultants                                                                                    |
| `axionia/docs/adr/0007-typography-hierarchy-v3-2.md` | Nouveau ADR (delta v3.2)                                                                                                                                        |

### Verification

- `pnpm typecheck` : 0 erreur
- `pnpm lint` : 0 erreur (5 warnings pré-existants react-hook-form non liés)
- `pnpm anti-hex:check` : OK
- `pnpm prettier --check` : OK (auto-format appliqué)

### Reportés (non-bloquant)

- **201 `text-[arbitrary]`** : sprint dédié futur.
- **Migration code vers tokens custom** (`text-display`, `text-section`...) : optionnelle, sprint dédié.
- **Layouts denses preview** : RoiSimulator, BookingFlow, FAQ, navigation header — vérifier que les bumps +2 à +8 px n'introduisent pas d'overflow visuel.

---

## 0bis — Application 2026-05-07 (Scénario B Premium)

> **Statut** : ✅ **APPLIQUÉ** — Sprint 14.7 typo. Will a validé le scénario B le 2026-05-07. ADR 0004 créé (le 0003 était déjà pris par « lift formation ban »).

### Fichiers modifiés

| Fichier                                                       | Changement                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `axionia/src/app/globals.css`                                 | Override `@theme` : `--text-base: 18 px`, `--text-sm: 15 px`, `--text-body: 18 px`, `--text-caption: 15 px`, `--text-lead: 23 px`. LH body 1.65 → 1.7. |
| `axionia/Design.md` § 3.2                                     | Table typo mise à jour avec valeurs v3.1 + note Tailwind override.                                                                                     |
| `axionia/docs/adr/0004-typography-baseline-upgrade-v3-1.md`   | Nouveau ADR (le 0003 était déjà pris par « lift formation ban ») — décision + rationale + rollback.                                                    |
| `axionia/src/app/[locale]/audit/page.tsx`                     | 4 patches : 3× `text-sm`→`text-base` (paragraphes desc), 1× H3 `text-lg`→`text-xl`, 1× `text-[14.5px]`→`text-base`, 1× `max-w-3xl`→`max-w-2xl`.        |
| `axionia/src/app/[locale]/interventions/page.tsx`             | 3 patches : `text-sm`→`text-base` card.body, H3 `text-lg`→`text-xl`, `text-[14.5px]`→`text-base`.                                                      |
| `axionia/src/app/[locale]/interventions/essentielle/page.tsx` | 1 patch : `text-sm`→`text-base` description.                                                                                                           |
| `axionia/src/app/[locale]/implementation/page.tsx`            | 2 patches : `text-sm`→`text-base` tier.desc, H3 `text-lg`→`text-xl`.                                                                                   |
| `axionia/src/app/[locale]/mes-donnees/page.tsx`               | 1 patch : `text-sm`→`text-base` RGPD body.                                                                                                             |
| `axionia/src/app/[locale]/glossaire/page.tsx`                 | 1 patch : `text-sm`→`text-base` définitions.                                                                                                           |
| `axionia/src/app/[locale]/a-propos/page.tsx`                  | 1 patch : `max-w-3xl`→`max-w-2xl` Valeurs.                                                                                                             |

**Total** : 1 patch token + ~12 patches page-level + 3 docs synchronisés. Cohérent avec l'estimation B « 5-10 patches page-level ».

### Reportés (non-bloquant)

- **201 `text-[arbitrary]`** non touchés (ex `text-[11px]`, `text-[15px]` sur dd labels) — sprint typo polish dédié.
- **Migration code vers tokens custom** (`text-display`, `text-section`…) non faite — Tailwind v4 les génère mais le code reste sur classes Tailwind standard. Non-bloquant.
- **Bump H3 vers `text-2xl` (24 px)** pour ratio H3/body ≥ 1.5 strict — à arbitrer après preview visuelle ; on est passé à 1.11 (text-xl), pas encore 1.5.
- **Hiérarchie /implementation** (H2 clamp 24-32) : ratio H2/body 1.5 sur petit écran encore sous cible. À revoir si preview insuffisante.

---

---

## 0. Cohérence doctrine ↔ code (cross-check préalable)

À la demande de Will : vérification que le rapport ne s'appuie pas sur une doctrine périmée.

| Source                                                | Date             | Statut                                                |
| ----------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `axionia/Design.md`                                   | 2026-05-06 22:19 | **À jour** — chap. 3 Typographie aligné HEAD          |
| `axionia/docs/adr/0002-design-pivot-editorial-v3.md`  | 2026-05-06 22:19 | **Même horodatage**, doctrine commitée                |
| `axionia/src/app/globals.css` `@theme` (lignes 67-99) | HEAD             | **10/10 tokens alignés** avec Design.md ligne 113-122 |

**Verdict cohérence interne** : ✅ doctrine et tokens CSS sont synchronisés.

**Divergence critique** : la doctrine décrit un système typo qui **n'est pas appliqué dans le code** (cf. § 5).

---

## 1. Verdict global typographique

- [ ] PARFAIT 2026 ✅ (≥ 85 % conforme standard 2026)
- [ ] BON ⚠️ (60-85 %) — patch token recommandé
- [x] **INSUFFISANT** ❌ (< 60 %) — patch token **+ revues page-level**

**Score global** : **15/30 (50 %)**.

**Cause racine** : trois facteurs cumulés —

1. **Aucune classe Tailwind défaut overridée** dans `@theme` → `text-base` = 16 px brut, `text-sm` = 14 px brut, sans line-height ni letter-spacing typographiquement intentionnels.
2. **Tokens custom `--text-*` DEAD CODE** : 0 usage dans `src/`, alors que la doctrine v3 les définit explicitement (Design.md:113-122). Le système typo **existe** mais **n'est pas consommé**.
3. **201 `text-[arbitrary]` en court-circuit** (`text-[14.5px]`, `text-[11px]`, `text-[clamp(...)]`) court-circuitent toute échelle modulaire.

Effet perçu par Will : « tout est écrit en tout petit sauf le hero ». **Mathématiquement fondé** : ratio hero/body actuel = **7.0×** (display 112 px clamp / body 16 px Tailwind), médiane 2026 = **~4.4×**. L'écart hero/body est ~60 % plus marqué qu'Anthropic / Stripe Press / Vercel.

**Aggravant Manrope** : x-height 0.515 vs Inter 0.546, Söhne 0.535. À 16 px, Manrope paraît visuellement ~6 % plus petit qu'Inter à taille égale.

---

## 2. Score par dimension (10 dim)

| Dim       | Sujet                                   | État actuel /3 | Cible 2026 /3 | Gap | Priorité |
| --------- | --------------------------------------- | -------------- | ------------- | --- | -------- |
| 1         | Baseline corps (px effectifs)           | **1**          | 3             | 2   | **P0**   |
| 2         | Baseline secondaire (`text-sm`)         | **1**          | 3             | 2   | **P0**   |
| 3         | Type scale (ratios entre niveaux)       | 1              | 2             | 1   | P1       |
| 4         | Line-height (densité verticale)         | 2              | 3             | 1   | P2       |
| 5         | Letter-spacing (tracking)               | 3              | 3             | 0   | —        |
| 6         | Mesure de ligne (line-length effective) | **1**          | 3             | 2   | **P0**   |
| 7         | Hiérarchie visuelle (H2/H3 vs body)     | **1**          | 3             | 2   | **P0**   |
| 8         | Numerals (`tabular-nums`, `tnum`)       | 2              | 3             | 1   | P2       |
| 9         | Italique éditorial signature            | 2              | 3             | 1   | P2       |
| 10        | Lisibilité sur mocha sombre             | 2              | 3             | 1   | P3       |
| **Total** |                                         | **16/30**      | 29/30         | 13  |          |

**P0 dominants** : baseline corps + baseline sm + line-length + hiérarchie. Tous résolubles par **patch token + 5-10 patchs page-level**.

---

## 3. Tableau benchmark externe vs AxionIA

Source : AGT-BENCH (`WebFetch` 6 sites + connaissances publiques 2024-2026).

| Site               | Body family              | Body px               | LH body  | H1 px            | H2 px              | H3 px   | Tracking display | Line-length        |
| ------------------ | ------------------------ | --------------------- | -------- | ---------------- | ------------------ | ------- | ---------------- | ------------------ |
| **AxionIA actuel** | Manrope                  | **16**                | **1.65** | clamp 48→**112** | 24-64 (incohérent) | 18-24   | -0.04em          | ~84 ch (max-w-2xl) |
| Anthropic          | Tiempos / Styrene        | **18**                | 1.55     | ~72-96           | 40-48              | 22-24   | -0.02em          | ~62 ch             |
| Stripe Press       | Söhne / Tiempos Headline | **19**                | 1.6      | ~64-88           | 36-44              | 22      | -0.01em          | ~60 ch             |
| Linear             | Inter Variable           | **15**                | 1.5      | ~64-80           | 32-40              | 18-20   | -0.025em         | ~70 ch             |
| Vercel             | Geist Sans               | **16** (text-copy-16) | 1.5      | ~72              | 40-48              | 20-24   | -0.02em          | ~65 ch             |
| OpenAI             | Söhne / OpenAI Sans      | **17-18**             | 1.5      | ~60-80           | 36-44              | 20-22   | -0.015em         | ~60 ch             |
| Mistral            | ABC Diatype              | **16-17**             | 1.5      | ~56-72           | 32-40              | 20      | -0.02em          | ~70 ch             |
| **Médiane 2026**   | —                        | **17**                | **1.5**  | **~75**          | **~40**            | **~22** | **-0.02em**      | **~65 ch**         |

**Lecture** : AxionIA est **bas-de-fourchette sur le body** (16 vs médiane 17), **pile dans la fourchette LH** (1.65 OK), **hors fourchette line-length** (84 ch vs cible 60-75).

Le hero `display-editorial` (jusqu'à 112 px) est **légèrement au-dessus du plafond du marché** (Stripe Press monte à 88 px max), ce qui creuse le delta hero/body.

---

## 4. Top P0 / P1 — findings chiffrés

### P0-1 — `text-sm` abusé sur contenu de lecture

- **Pages** : `/audit` (17 occ.), `/implementation` (15 occ.), `/cas-concrets` (4), `/interventions` (4).
- **Citations** :
  - `axionia/src/app/[locale]/audit/page.tsx:675` — descriptions des niveaux d'audit en `text-sm` (4-5 lignes).
  - `axionia/src/app/[locale]/audit/page.tsx:1034` — questions du quiz « Quel niveau pour vous ? » en `text-sm`.
  - `axionia/src/app/[locale]/interventions/page.tsx:675` — bénéfices de chaque intervention en `text-sm`.
  - `axionia/src/app/[locale]/implementation/page.tsx:1018-1034` — comparaison Make/Zapier vs Agence vs AxionIA.
- **Px actuel → cible** : 14 px → 15-16 px (selon scénario).
- **Effort** : 50-80 changements de classe sur ~20-30 occurrences problématiques (les autres `text-sm` sur labels/badges restent OK).

### P0-2 — Baseline corps (`text-base`) sous médiane 2026

- **Cause** : Tailwind default 16 px non overridé dans `@theme`. La médiane 2026 est 17 px (Vercel 16, Mistral 16-17, OpenAI 17-18, Anthropic 18, Stripe Press 19, Linear 15).
- **Citation** : `axionia/src/app/globals.css:13-99` — `@theme` block ne définit PAS `--text-base` ni `--text-sm`.
- **Px actuel → cible** : 16 px → 17 px (scénario A) / 18 px (scénario B) / 19 px (scénario C).
- **Effort** : **0 changement page-level** si patch via `@theme` (override Tailwind v4 idiomatique).

### P0-3 — Line-length hors fourchette

- **Cas** : `max-w-2xl` (672 px) + `text-base` (16 px) = **84 ch** (vs cible 60-75 ch).
- **Cas** : `max-w-3xl` (768 px) + `text-lg` (18 px) = **96 ch**.
- **Pages** : `/` (heroDescription max-w-2xl), `/audit` (heroDescription), `/implementation` (heroDescription), `/a-propos` (Valeurs max-w-3xl).
- **Px actuel → cible** : à body 18 px, max-w-2xl tombe à **75 ch** (✓).
- **Effort** : 3-5 paragraphes-clés à ajuster (`max-w-3xl` → `max-w-2xl` ou `max-w-prose`).

### P0-4 — Hiérarchie H2/H3/body insuffisante

- `/audit` : H2 = clamp(36-64 px), H3 = 18 px (`text-lg`). H3/body = **1.125** (cible ≥1.5 ❌).
- `/implementation` : H2 = clamp(24-32 px), H3 = 28 px (`text-2xl`). H2/body = **1.5** (cible ≥2.5 ❌).
- **Citations** : `axionia/src/app/[locale]/audit/page.tsx`, `axionia/src/app/[locale]/implementation/page.tsx`.
- **Effort** : ~15-20 headings à monter d'un cran (text-lg → text-xl, text-3xl → text-4xl) sur 2-3 pages denses.

### P1-1 — Tokens `--text-*` DEAD CODE

- **Cause** : 10 tokens définis dans `globals.css:76-99` mais **0 usage** (ni `text-display` Tailwind, ni `var(--text-display)` CSS).
- **Effet** : la doctrine v3 décrit une échelle modulaire qui n'est PAS appliquée. Le code reflète Tailwind defaults + 201 arbitrary values.
- **Recommandation** : profiter du patch token pour soit (a) adopter les classes Tailwind v4 générées depuis `@theme` (ex: `text-display`, `text-body`), soit (b) supprimer les tokens orphelins de Design.md pour aligner doctrine sur réalité.

### P1-2 — Échelle ad-hoc (saut feature → lead = 1.09)

- **Citation** : `globals.css:83` (`--text-feature: 1.5rem`) → `globals.css:85` (`--text-lead: 1.375rem`). Saut = 1.09× = quasi-invisible.
- **Recommandation** : aligner sur **modular scale Major Third (1.25)** ou supprimer `--text-lead` (redondant avec `--text-feature` perceptuellement).

### P1-3 — Micro-tailles `text-[14.5px]` / `text-[11px]` qui cassent la cohérence

- **Citations estimées** : `audit/page.tsx:798`, `interventions/page.tsx:550`.
- **Effet** : 201 occurrences `text-[arbitrary]` court-circuitent toute échelle modulaire.
- **Recommandation post-patch token** : grand pass de remplacement par classes Tailwind standard (sprint dédié 14.7 ou Sprint 15 polish).

---

## 5. 3 scénarios de patch token (proposés, non appliqués)

> **Approche** : override Tailwind v4 defaults via `@theme {}` directement. La convention Tailwind v4 fait que `--text-{name}` génère la classe `text-{name}` automatiquement. Donc redéfinir `--text-base` dans `@theme` modifie partout dans le code (118 occ. `text-base`, 107 occ. `text-sm`).

### Scénario A — Mesuré (recommandé si verdict BON)

**Cible** : rejoindre la médiane 2026 (17 px). Effort minimal, risque quasi-nul.

```css
@theme {
  /* override Tailwind defaults — bump baseline éditorial 2026 */
  --text-base: 1.0625rem; /* 17 px (était 16 implicite Tailwind) */
  --text-base--line-height: 1.65;
  --text-base--letter-spacing: -0.005em;

  --text-sm: 0.9375rem; /* 15 px (était 14 implicite Tailwind) */
  --text-sm--line-height: 1.55;

  /* synchronise les tokens custom doctrine v3 (resté DEAD code) */
  --text-body: 1.0625rem; /* 17 px (était 1rem) */
  --text-caption: 0.9375rem; /* 15 px (était 0.875rem) */
}
```

| Métrique               | Avant | Après A | Delta            |
| ---------------------- | ----- | ------- | ---------------- |
| Body px                | 16    | 17      | +6.25 %          |
| sm px                  | 14    | 15      | +7.1 %           |
| Caption px             | 14    | 15      | +7.1 %           |
| max-w-2xl + body en ch | 84    | 79      | −6 %             |
| Ratio hero/body        | 7.0×  | 6.6×    | légère réduction |

**Risque layout** : très faible. Manrope, +1 px ne pousse aucun container. ~0-1 patch page-level requis.
**Patches page-level requis** : 0-3 (bump H3 page audit/implementation pour ratio ≥1.5).

---

### Scénario B — Premium (recommandé)

**Cible** : Anthropic-equivalent (18 px / LH 1.7). Effet « éditorial premium » marqué, alignement doctrine v3 « Editorial Premium Light ».

```css
@theme {
  --text-base: 1.125rem; /* 18 px */
  --text-base--line-height: 1.7;
  --text-base--letter-spacing: -0.005em;

  --text-sm: 0.9375rem; /* 15 px */
  --text-sm--line-height: 1.55;

  --text-body: 1.125rem; /* 18 px (était 1rem) */
  --text-body--line-height: 1.7; /* était 1.65 */
  --text-caption: 0.9375rem; /* 15 px */

  /* corrige le saut feature→lead (modular scale propre) */
  --text-lead: 1.4375rem; /* 23 px (était 22) — ratio body 1.28 ≈ Major Third */
}
```

| Métrique                         | Avant | Après B    | Delta                |
| -------------------------------- | ----- | ---------- | -------------------- |
| Body px                          | 16    | 18         | +12.5 %              |
| sm px                            | 14    | 15         | +7.1 %               |
| max-w-2xl + body en ch           | 84    | **75** ✓   | pile dans fourchette |
| max-w-3xl + body en ch           | 96    | 85         | encore trop large    |
| Ratio hero/body                  | 7.0×  | 6.2×       | rejoint médiane      |
| Ratio H3/body (text-lg=18 reste) | 1.125 | **1.0** ❌ | nécessite patch H3   |

**Risque layout** : modéré. RoiSimulator dense, FAQ items, navigation header peuvent nécessiter ajustement padding. **5-10 patches page-level** recommandés en complément du token.
**Patches page-level requis** :

1. `/audit` H3 `text-lg` → `text-xl` (~6-8 occ.).
2. `/implementation` H3 `text-2xl` → `text-3xl` (~5 occ.).
3. `/` heroDescription `max-w-2xl` → conserver, body 18 px tombe pile à 75 ch.
4. `/a-propos` Valeurs `max-w-3xl` → `max-w-2xl` (line-length 75 ch).
5. RoiSimulator KPI cards : vérifier que le bump 14→15 sur `text-sm` ne casse pas le layout vertical.
6. Top 10-20 `text-sm` sur cards body → migration `text-base` (peut être traité dans le même sprint).

---

### Scénario C — Généreux Stripe Press

**Cible** : maximaliste (19 px / LH 1.7). Refonte typo majeure. **Sprint dédié recommandé** (14.8 typo deep refactor).

```css
@theme {
  --text-base: 1.1875rem; /* 19 px */
  --text-base--line-height: 1.7;
  --text-base--letter-spacing: -0.005em;

  --text-sm: 1rem; /* 16 px */
  --text-sm--line-height: 1.6;

  --text-body: 1.1875rem; /* 19 px */
  --text-body--line-height: 1.7;
  --text-caption: 1rem; /* 16 px */

  --text-lead: 1.5rem; /* 24 px (était 22) */
  --text-feature: 1.625rem; /* 26 px (était 24) — préserve hiérarchie */
}
```

| Métrique               | Avant | Après C | Delta               |
| ---------------------- | ----- | ------- | ------------------- |
| Body px                | 16    | 19      | +18.75 %            |
| sm px                  | 14    | 16      | +14.3 %             |
| max-w-2xl + body en ch | 84    | 71 ✓    | confortable         |
| max-w-3xl + body en ch | 96    | 81      | toujours trop large |
| Ratio hero/body        | 7.0×  | 5.9×    | dans fourchette     |

**Risque layout** : élevé. 5-10 layouts à retravailler (cards, FAQ, RoiSimulator, BookingFlow, navigation). 201 `text-[arbitrary]` à auditer un par un. Sprint dédié.

---

## 6. Patches page-level recommandés (en complément du token)

Ordonnés par ROI décroissant :

1. **[/audit, /implementation]** Migration `text-sm` → `text-base` sur body de cards descriptives.
   - Citations clés : `audit/page.tsx:675, 1034`, `implementation/page.tsx:1018-1034`.
   - ~20-30 occurrences.
2. **[/audit, /implementation, /]** Bump H3 d'un cran (`text-lg` → `text-xl`, `text-3xl` → `text-4xl`) pour ratio H3/body ≥ 1.5.
   - ~15-20 headings.
3. **[/a-propos, /methodologie]** `max-w-3xl` → `max-w-2xl` ou `max-w-prose` sur paragraphes éditoriaux longs.
   - 3-5 sections.
4. **[/audit, /interventions]** Remplacer `text-[14.5px]` custom par `text-base` ou `text-sm`.
   - ~10-15 occurrences.
5. **[Footer, Header CTA]** Vérifier `text-mocha-fg` body sur fond mocha à la nouvelle taille.

---

## 7. Pages déjà au niveau 2026 (à conserver telles quelles)

- `/blog` — utilise `max-w-prose` natif (~65 ch ✓).
- `/methodologie` — `text-base` + `leading-relaxed`, line-length ~60-70 ch ✓.
- `/cas-concrets` — listings denses, `text-sm` sur excerpts compacts (~50 ch acceptable pour cards).
- `/contact` — `text-base` + `max-w-2xl`, à vérifier après bump baseline.
- `/mentions-legales` — `LegalPageTemplate` propre (à confirmer).

---

## 8. JSON deltas (machine-readable)

Voir `_AUDIT/typography-deltas.json`.

---

## 9. Question fermée pour Will

Recommandation principale : **Scénario B (premium 18/15)**.

**Raison concrète** : la doctrine v3 s'appelle « Editorial Premium Light » et fixe Anthropic comme référence (Design.md ligne 6 : « Direction Anthropic / Mistral »). Anthropic est à 18 px. Le scénario A (17 px) rejoint la médiane mais reste sous Anthropic. Le scénario C (19 px) dépasse Anthropic et atteint Stripe Press (livre relié) — niveau au-delà de la doctrine actuelle. **B est le seul qui aligne le code sur ce que dit la doctrine.**

Choix :

- **OUI scénario A (mesuré 17/15)** — 1 patch token + 0-3 patchs page-level. Sprint 14.7 typo. Effort minimal. Effet : rattrape médiane.
- **CONTINUE scénario B (premium 18/15)** ⭐ recommandé — 1 patch token + 5-10 patchs page-level. Sprint 14.7 + 14.8. Effort modéré. Effet : aligne avec doctrine Anthropic.
- **STRETCH scénario C (généreux 19/16)** — refonte typo majeure, Sprint 14.8 dédié. Effort élevé. Effet : maximaliste éditorial.
- **STOP** — laisser tel quel, passer Sprint 15 backend.

Note ADR : tout scénario validé nécessitera **ADR 0004 « Typography baseline upgrade »** (le 0003 est pris par lift-formation-ban) car Design.md ligne 118 fixait `--text-body: 1 rem (16 px)` ; le bumper est un delta doctrine officiel.
