# ✒️ PROMPT TYPOGRAPHY AUDIT 2026 — AxionIA · Lisibilité & échelle éditoriale

> **Version 1.0 · 2026-05-07**
> ⚠️ **STATUT 2026-05-07 (post-exécution)** : audit livré, scénario B retenu, **patch appliqué via ADR 0004** (`docs/adr/0004-typography-baseline-upgrade-v3-1.md`). Baseline corps actuel = **18 px** (`--text-base: 1.125rem`, `--text-sm: 0.9375rem`, `--text-body: 1.125rem`). Ce prompt reste utile pour ré-auditer après changements futurs ; les chiffres « actuel 16/14 » ci-dessous sont historiques pré-patch.
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`.
> Sortie : `_AUDIT/AUDIT-TYPOGRAPHY-2026.md` + `typography-deltas.json` + **patch proposé** (diff `globals.css` non commité).
> Durée estimée : 50-75 min (3 agents parallèles + agent principal).
> **Empile** sur la séquence existante (post FRONTEND-DEEP-CHECK, avant Sprint 15).

---

## 🎯 OBJECTIF

Will a observé **2026-05-07** que le site donne l'impression que « tout est écrit en tout petit, sauf le hero », sur **toutes les pages**. Diagnostic préliminaire : `text-base` Tailwind = 16 px, `text-sm` = 14 px (utilisés massivement sur cards/captions/FAQ), tandis que le hero utilise `display-editorial` (clamp 3rem→7rem, jusqu'à ~112 px). Le delta perceptif est trop violent et le baseline corps est sous le standard éditorial 2026 (Anthropic, Stripe Press, Linear, Vercel, OpenAI sont à 17-19 px corps).

**Mission** : auditer l'intégralité du système typographique (tokens + usage réel + benchmark externe) et **proposer un patch chiffré** (token-level + cas page-level) pour atteindre le niveau « perfection 2026 » sans casser les layouts existants. Pas de patch ici — diagnostic + proposition uniquement, validation Will avant d'écrire la moindre ligne de CSS.

---

## 🧠 RÔLE & POSTURE

Tu es **directeur typographique éditorial**. Tu connais à froid les choix typo des sites de référence 2026 : Anthropic (corps Tiempos ~18 px / line-height 1.65), Stripe Press (Söhne ~19 px / 1.7), Linear (Inter ~16 px mais avec `text-rendering: geometricPrecision` + `font-feature-settings`), Vercel (Geist ~17 px), OpenAI (Söhne ~17 px / 1.6), Mistral (corps généreux ~18 px latin).

Tu sais que **le baseline ne fait pas tout** : la perception « petit » naît aussi de :

- ratio insuffisant entre H2 et corps (manque de contraste hiérarchique),
- `text-sm` (14 px) abusé en card / KPI / témoignage où `text-base` serait plus juste,
- mesure de ligne trop large (max-w-2xl + text-base = lecture lente),
- line-height trop serré (1.5 sur 16 px = compact froid).

**Posture** : exigeant sur lisibilité (priorité 2026 = corps confortable + mesure 60-75ch), pragmatique sur effort (1 commit token = ROI maximal vs refactor par page). **Lecture seule strict** — aucune modif code dans cet audit, le patch sera un **diff proposé en annexe** que Will applique manuellement après validation.

---

## 📚 SOURCES DE VÉRITÉ

### Référence interne (gold standard tokens)

1. `axionia/src/app/globals.css` — `@theme` block (lignes ~13-139) : tokens typo, échelle, line-heights.
2. `axionia/src/app/[locale]/layout.tsx` — chargement Manrope / Fraunces / Inconsolata via `next/font`.
3. `axionia/Design.md` — doctrine v3 Editorial Premium Light typographie.

### Pages à auditer (échantillon représentatif 15 pages)

#### A. Pillar / hero-driven (3)

- `/` (home, page.tsx).
- `/interventions` (référence qualité parity).
- `/audit`.

#### B. Listings denses (3)

- `/implementation`.
- `/cas-concrets`.
- `/blog`.

#### C. Pages produit individuelles (2)

- `/interventions/essentielle`.
- `/audit/strategique-pme` (pyramide 4 niveaux 2026-05-07 : flash · process · strategique-pme · strategique-eti · demande).

#### D. Pages éditoriales transversales (3)

- `/a-propos`.
- `/contact`.
- `/faq`.

#### E. Pages utilitaires denses (2)

- `/roi` (RoiSimulator dense en chiffres).
- `/reserver` (BookingFlow form).

#### F. Pages textuelles longues (2)

- `/methodologie`.
- `/mentions-legales` (pour vérifier que le legalese ne souffre pas).

### Benchmarks externes 2026 (WebFetch en lecture, screenshots optionnels)

1. https://www.anthropic.com — corps Tiempos / Söhne, line-height généreux.
2. https://press.stripe.com — corps éditorial premium, mesure 60-65ch stricte.
3. https://linear.app — corps tech compact mais lisible.
4. https://vercel.com — corps Geist, équilibre marketing.
5. https://openai.com — corps Söhne éditorial.
6. https://mistral.ai — corps latin, échelle proche AxionIA.

Pour chaque benchmark, extraire (DOM inspect via `WebFetch` + analyse CSS) :

- `font-size` body (en px effectifs).
- `line-height` body.
- `font-size` H1 hero / H2 section / H3 card.
- `letter-spacing` (tracking) sur display vs body.
- Mesure de ligne effective (ch ou px max-width).

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. STOP & ASK final uniquement.
2. **Lecture seule strict** — aucune modif code. Outils : `git`, `Read`, `Grep`, `Glob`, `WebFetch`.
3. **Citations obligatoires** : `file_path:line_number` pour chaque écart interne, URL pour chaque référence externe.
4. **Chiffrer en px effectifs**, pas en rem abstraits. Convertir tous les `text-*` en px sur baseline 16 ET sur baseline proposée (17 / 18) pour comparer.
5. **Priorisation** :
   - **P0** — corps illisible / hiérarchie cassée / contraste insuffisant.
   - **P1** — sous le standard 2026 mais lisible (le cas du baseline 16 px actuel).
   - **P2** — polish (line-height, tracking, smallcaps).
   - **P3** — cosmétique.
6. **Ne pas modifier la doctrine v3** : Manrope + Fraunces + Inconsolata sont **fixes**. Italique terracotta éditorial = **fixe**. L'audit porte sur **tailles, line-heights, line-lengths, tracking**, pas sur les familles ni la palette.
7. **Le hero (`display-editorial` clamp 3rem→7rem) reste hors scope du patch** — il est validé doctrinalement. Ne pas proposer de le toucher.

---

## 🤖 DISPATCH MULTI-AGENTS (3 agents en parallèle)

| Agent          | Subagent                              | Mission                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGT-TOKENS** | Explore                               | Inventaire complet des tokens typo dans `globals.css` (font-sizes, line-heights, letter-spacings) + détecter les `--text-*` utilisés vs définis-mais-non-utilisés + Tailwind defaults non overridés (`text-base`, `text-sm`, etc.).                                                                                                                                               |
| **AGT-USAGE**  | Explore                               | Sur les 15 pages échantillon : grep `text-(xs\|sm\|base\|body\|lg\|xl\|2xl\|3xl)` + classes typo custom. Compter les occurrences par taille, identifier les **abus de text-sm** (cards, KPI, témoignages, FAQ items) et les **manques de text-base** (paragraphes inheriting le default body). Lister les `max-w-*` accolés à des paragraphes pour mesurer ligne effective en ch. |
| **AGT-BENCH**  | general-purpose (autorisé `WebFetch`) | Aspirer les 6 benchmarks externes (Anthropic, Stripe Press, Linear, Vercel, OpenAI, Mistral). Extraire body / H1 / H2 / H3 / line-height / tracking / line-length. Produire tableau comparatif vs AxionIA actuel.                                                                                                                                                                 |

L'agent principal pendant ce temps :

- Construit la **matrice 10 dimensions × scope** (tokens + 15 pages).
- Calcule le **delta px proposé** sur 3 scénarios (mesuré 17/15, premium 18/15, généreux 18/16).
- Prépare le **diff `globals.css` proposé** pour chacun des 3 scénarios.

---

## 📐 10 DIMENSIONS À ÉVALUER

Pour chaque dimension, scorer **état actuel** et **état cible 2026** sur 0-3 (0 = absent/cassé, 3 = niveau Anthropic/Stripe Press).

### Dim 1 — Baseline corps (px effectifs)

- Actuel : 16 px (Tailwind default `text-base`, `--text-body: 1rem`).
- Standard 2026 : 17-19 px.
- Mesurer : combien de paragraphes utilisent `text-base` (16 px) vs `text-lg` (18 px) vs absence de classe (inherit body = 16 px) ?

### Dim 2 — Baseline secondaire (`text-sm`)

- Actuel : 14 px (Tailwind default).
- Standard 2026 : 15-16 px sur cards/KPI premium.
- Identifier les zones où `text-sm` produit l'effet « tout petit » (témoignages, FAQ, captions, badges, footer).

### Dim 3 — Type scale (ratio entre niveaux)

- Calculer le ratio entre `--text-display` / `--text-section` / `--text-sub` / `--text-feature` / `--text-lead` / `--text-body`.
- Objectif 2026 : ratio **modular scale 1.25-1.333** (Major Third / Perfect Fourth).
- Identifier les sauts trop grands (display 7rem → section 4rem = 1.75x, OK) ou trop petits (lead 1.375 → body 1 = 1.375, OK mais à confirmer perceptuellement).

### Dim 4 — Line-height (densité verticale)

- Body actuel : 1.65. Lead : 1.5. Section : 1.04. Sub : 1.2.
- Standard 2026 : body 1.6-1.7 / display 0.95-1.05 / sub 1.15-1.25 → **conforme**.
- Vérifier qu'aucune classe Tailwind `leading-*` n'écrase ces valeurs en plus serré sur les 15 pages.

### Dim 5 — Letter-spacing (tracking)

- Display : -0.04em (correct, signature serif italique).
- Body : -0.005em (tight, OK pour Manrope).
- Label-up : 0.16em (uppercase eyebrow, conforme 2026).
- Vérifier la cohérence sur les 15 pages.

### Dim 6 — Mesure de ligne (line-length effective)

- Cible 2026 : **60-75 ch** pour le corps confort.
- Mesurer chaque paragraphe : `max-w-2xl` (672 px) à `text-base` (16 px) ≈ 84 ch → **trop large**. À `text-lg` (18 px) ≈ 75 ch → OK.
- Lister les paragraphes où le couple (`max-w-*` + taille) sort de la fourchette 60-75 ch.

### Dim 7 — Hiérarchie visuelle

- Contraste H2 / H3 / H4 / body suffisant ?
- Test : un utilisateur scannant en 3 sec voit-il les sections ?
- Vérifier sur `/audit`, `/implementation`, `/blog` (pages denses).

### Dim 8 — Numerals (tabular-nums + lining)

- Prix, métriques, KPI : utilisent-ils `tabular-nums` (alignement vertical des chiffres) ?
- Manrope supporte `font-feature-settings: "tnum" 1`.
- Identifier les zones où ce serait pertinent (RoiSimulator, pricing cards, KPIs).

### Dim 9 — Italique éditorial signature

- `em.editorial` + `.italic-editorial` (Fraunces italic terracotta) — utilisés sur 1-2 mots/titre, jamais en bloc.
- Compter les usages corrects vs abusifs (italique sur 5+ mots = anti-pattern éditorial).

### Dim 10 — Lisibilité sur sections sombres (mocha)

- `--color-mocha-fg: #f7f3ea` sur `--color-mocha: #2a2520`.
- Contraste WCAG AA validé ? (devrait être ≈ 12:1).
- Le baseline 16 px sur fond mocha est-il suffisamment contrasté pour la lecture rapide ?

---

## 📊 MATRICE DE SORTIE — `_AUDIT/AUDIT-TYPOGRAPHY-2026.md`

```markdown
# AUDIT TYPOGRAPHY 2026 — AxionIA

- Date : 2026-05-07
- Doctrine de référence : v3 Editorial Premium Light (ADR 0002)
- Baseline actuel : 16 px corps / 14 px sm
- Auditeur : Claude Opus 4.7 + 3 agents
- Pages échantillon : 15
- Benchmarks externes : 6

## 1. Verdict global typographique

- [ ] PARFAIT 2026 ✅ (≥ 85 % conforme standard 2026)
- [ ] BON ⚠️ (60-85 %) — patch token recommandé
- [ ] INSUFFISANT ❌ (< 60 %) — patch token + revues page-level

## 2. Score par dimension

| Dim | État actuel /3 | Cible 2026 /3 | Gap | Priorité |
| --- | -------------- | ------------- | --- | -------- |

## 3. Tableau benchmark externe vs AxionIA

| Site             | Body px | LH body | H1 px   | H2 px | Tracking display | Line-length |
| ---------------- | ------- | ------- | ------- | ----- | ---------------- | ----------- |
| AxionIA actuel   | 16      | 1.65    | ~80-112 | 64    | -0.04em          | 84 ch       |
| Anthropic        | ?       | ?       | ?       | ?     | ?                | ?           |
| Stripe Press     | ?       | ?       | ?       | ?     | ?                | ?           |
| Linear           | ?       | ?       | ?       | ?     | ?                | ?           |
| Vercel           | ?       | ?       | ?       | ?     | ?                | ?           |
| OpenAI           | ?       | ?       | ?       | ?     | ?                | ?           |
| Mistral          | ?       | ?       | ?       | ?     | ?                | ?           |
| **Médiane 2026** | ?       | ?       | ?       | ?     | ?                | ?           |

## 4. Top P0 / P1

| Finding | Page(s) | Citation | Px actuel → cible | Priorité | Effort |
| ------- | ------- | -------- | ----------------- | -------- | ------ |

## 5. 3 scénarios de patch token (proposés, non appliqués)

### Scénario A — Mesuré (recommandé si verdict BON)

Diff `globals.css` :
\`\`\`css
@theme {
--text-base: 1.0625rem; /_ 17 px (était 16 implicite) _/
--text-body: 1.0625rem; /_ 17 px (était 1rem) _/
--text-sm: 0.9375rem; /_ 15 px (était 14 implicite) _/
--text-body--line-height: 1.65; /_ inchangé _/
}
\`\`\`
Impact : +6.25 % corps, +7 % sm. ~0 layout shift attendu.

### Scénario B — Premium

\`\`\`css
@theme {
--text-base: 1.125rem; /_ 18 px _/
--text-body: 1.125rem;
--text-sm: 0.9375rem; /_ 15 px _/
--text-body--line-height: 1.7;
}
\`\`\`
Impact : +12.5 % corps. Effet « editorial » marqué. Risque : 1-2 cards à re-équilibrer (RoiSimulator, FAQ).

### Scénario C — Généreux Stripe Press

\`\`\`css
@theme {
--text-base: 1.1875rem; /_ 19 px _/
--text-body: 1.1875rem;
--text-sm: 1rem; /_ 16 px _/
--text-body--line-height: 1.7;
}
\`\`\`
Impact : +18.75 % corps. Effet maximaliste. Risque : layouts Webflow-inspired (audit, ROI) à retravailler.

## 6. Patches page-level recommandés (en complément du token)

- [Page X] paragraphe avec `max-w-2xl text-base` → passer à `max-w-prose` ou `text-lg` pour rester sous 75 ch.
- [Page Y] cards avec `text-sm` sur titre + body → titre passe à `text-base`, body reste `text-sm` (15 px après token).
- [...]

## 7. Pages déjà au niveau 2026 (à conserver telles quelles)

[Liste]

## 8. JSON deltas

`typography-deltas.json` machine-readable.

## 9. Question fermée pour Will

- **OUI scénario A** (mesuré 17/15) — patch token + 0-3 patchs page-level. Sprint 14.7 typo.
- **CONTINUE scénario B** (premium 18/15) — patch token + revue 5-10 pages.
- **STRETCH scénario C** (généreux 19/16) — refonte typo majeure, sprint dédié.
- **STOP** — laisser tel quel, passer à Sprint 15.
```

Annexe machine-readable `_AUDIT/typography-deltas.json` :

```json
{
  "currentBaseline": { "bodyPx": 16, "smPx": 14, "lineHeightBody": 1.65 },
  "scenarios": {
    "A_measured": { "bodyPx": 17, "smPx": 15, "lineHeightBody": 1.65 },
    "B_premium": { "bodyPx": 18, "smPx": 15, "lineHeightBody": 1.7 },
    "C_generous": { "bodyPx": 19, "smPx": 16, "lineHeightBody": 1.7 }
  },
  "benchmarks": {
    "anthropic": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    },
    "stripePress": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    },
    "linear": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    },
    "vercel": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    },
    "openai": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    },
    "mistral": {
      "bodyPx": null,
      "lineHeight": null,
      "h1Px": null,
      "h2Px": null,
      "trackingDisplay": null,
      "lineLengthCh": null
    }
  },
  "verdict": null,
  "scoreByDimension": {},
  "p0Findings": [],
  "p1Findings": [],
  "pagesAlreadyOk": []
}
```

---

## ▶️ DÉMARRAGE

Confirme en 5 lignes. Charge :

1. `axionia/src/app/globals.css` `@theme` block.
2. `axionia/Design.md` chap. typographie.
3. Liste des 15 pages échantillon (catégories A→F).
4. Liste des 6 benchmarks externes.

Lance les **3 agents en parallèle** (AGT-TOKENS / AGT-USAGE / AGT-BENCH).

Pendant ce temps, agent principal :

- Calcule la matrice 10 dimensions × scope.
- Prépare les 3 scénarios de patch (`globals.css` diff).
- Pré-remplit le tableau benchmark.

À la fin, **renvoie à Will (≤ 250 mots)** :

- Verdict typo globale (PARFAIT / BON / INSUFFISANT).
- Top 3 findings P0/P1 chiffrés en px effectifs.
- Recommandation entre scénarios A/B/C avec une raison concrète (« votre /audit a 14 paragraphes en text-sm dans des cards larges → scénario B donnerait le meilleur ROI »).
- Liste explicite des 0-10 patchs page-level requis en plus du patch token.
- Question fermée : « **OUI A mesuré** / **CONTINUE B premium** / **STRETCH C généreux** / **STOP** ».
