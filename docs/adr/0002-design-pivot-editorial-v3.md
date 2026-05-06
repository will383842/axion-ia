# ADR 0002 — Pivot doctrine visuelle v3 « Editorial Premium Light »

- **Statut** : accepted
- **Date** : 2026-05-06
- **Supersedes** : [ADR 0001 — Design direction Webflow-inspired](./0001-design-direction-webflow.md)
- **Auteur** : Will (validation visuelle) + Claude Opus 4.7 (formalisation)

## Contexte

ADR 0001 actait une direction « Webflow-inspired » avec Webflow Blue `#146ef5`, palette de 6 secondaires, Manrope unique police de titre, radius 4-8 px, shadows ton-froid. Cette doctrine a été implémentée Sprint 1 (commit `fe000c6`) puis appliquée jusqu'au Sprint 14 (commit `1135136`) plus 5 phases de polish (`01c5a59` → `f2ea1e6`).

L'ADR 0001 listait deux conséquences à surveiller :

> _« Tension positionnement « cabinet IA premium B2B » ↔ palette Webflow grand public — surveillé après Sprint 5. »_

Cette tension s'est confirmée pendant la phase polish post-Sprint 14. Will a constaté que :

1. La palette 6-couleurs « disciplined » donnait un rendu plus proche d'un SaaS B2C que d'un cabinet B2B.
2. Le contraste blanc-froid `#ffffff` + noir `#080808` donnait un ton clinique plutôt qu'éditorial.
3. La police Manrope seule sur titres ne portait pas le ton « cabinet ».
4. La référence visuelle attendue par le marché cible (DSI, dirigeants ETI/PME) est plutôt celle d'éditeurs IA premium type **Anthropic**, **Mistral**, **OpenAI**, où la signature éditoriale repose sur :
   - Surfaces ivoire chaud + sand + mocha (jamais noir pur).
   - Une police serif italique en signature.
   - Un accent terracotta brique pour les italiques éditoriaux.

## Décision

Pivot vers la doctrine **« Editorial Premium Light v3 »** :

### Surfaces (4 tons éditoriaux, sans noir)

- `--color-bg` `#faf8f3` — canvas ivoire chaud (était blanc froid `#ffffff`)
- `--color-paper` `#ffffff` — papier blanc pur — cards, sections de contraste
- `--color-sand` `#f0e9da` — sable — sections « intermissions »
- `--color-sand-deep` `#e6dcc4` — sable saturé — bordures, badges
- `--color-mocha` `#2a2520` — brun-aubergine — sections premium (PAS du noir)
- `--color-mocha-soft` `#3d362f` — mocha plus doux — gradients
- `--color-mocha-fg` `#f7f3ea` — texte sur mocha — ivoire

### Foreground (texte)

- `--color-fg` `#1a1815` — anthracite-brun (PAS du noir, était `#080808`)
- `--color-fg-soft` `#524b41` — gris-brun moyen
- `--color-fg-muted` `#80766a` — gris-sable

### Accent identitaire — Webflow Blue **conservé mais densifié**

- `--color-primary` `#1a4dd9` (était `#146ef5` — densifié pour rendu éditorial)
- `--color-primary-hover` `#0f3aae`
- `--color-primary-fg` `#ffffff`
- `--color-primary-soft` `#e8efff` — halo bleu très doux pour fonds d'icônes

### Accent éditorial — terracotta brique (NEW)

- `--color-terracotta` `#c24a1b` — accents éditoriaux, italiques
- `--color-terracotta-soft` `#f5e3d8` — halo terracotta doux
- `--color-terracotta-deep` `#8c3010` — terracotta foncé — hover

### Accent doux — vert sauge (NEW, pour proof/succès)

- `--color-sage` `#7a8870`
- `--color-sage-soft` `#e6ebe2`

### Borders & dividers

- `--color-border` `#e5ddc8` — sable doux pour bordures
- `--color-border-strong` `#c8bda0` — sable saturé pour focus rings
- `--color-border-on-mocha` `#4a4239`

### Typographie

- **Manrope** (sans, var `--font-sans`) — conservée pour body + UI.
- **Fraunces** (serif, var `--font-serif`, NEW) — utilisée pour les titres éditoriaux + signature italique `em.editorial`.
- **Inconsolata** (mono, var `--font-mono`) — conservée pour technique/code.

### Type scale v3 (display géant pour signature éditoriale)

| Token             | v1 Webflow                          | v3 Editorial                            |
| ----------------- | ----------------------------------- | --------------------------------------- |
| `--text-display`  | 5 rem (80 px)                       | **7 rem (112 px)**, lh 0.96             |
| `--text-section`  | 3.5 rem (56 px)                     | 4 rem (64 px), lh 1.04                  |
| `--text-sub`      | 2 rem (32 px)                       | 2.25 rem (36 px), lh 1.20               |
| `--text-feature`  | 1.5 rem (24 px)                     | 1.5 rem (24 px), lh 1.30                |
| `--text-lead`     | 1.25 rem (20 px)                    | 1.375 rem (22 px), lh 1.50              |
| `--text-body`     | 1 rem (16 px)                       | 1 rem (16 px), lh 1.65                  |
| `--text-label-up` | 0.9375 rem (15 px), tracking 0.10em | 0.8125 rem (13 px), tracking **0.16em** |
| `--text-caption`  | 0.875 rem (14 px)                   | 0.875 rem (14 px)                       |
| `--text-badge-up` | 0.8 rem (12.8 px)                   | 0.75 rem (12 px)                        |
| `--text-micro-up` | 0.625 rem (10 px)                   | 0.625 rem (10 px)                       |

### Radius — éditorial doux

| Token           | v1      | v3                                  |
| --------------- | ------- | ----------------------------------- |
| `--radius-xs`   | 2 px    | 2 px                                |
| `--radius-sm`   | 4 px    | 4 px                                |
| `--radius-md`   | 6 px    | **8 px**                            |
| `--radius-lg`   | 8 px    | **12 px**                           |
| `--radius-xl`   | —       | **20 px (NEW)** — cards éditoriales |
| `--radius-2xl`  | —       | **28 px (NEW)** — hero blocks       |
| `--radius-full` | 9999 px | 9999 px                             |

### Shadows — ton chaud (5 couches conservées)

Toutes les couches passent de `rgba(0,0,0,…)` à `rgba(42,37,32,…)`. Cascade 5-layer signature préservée. Ajout `--shadow-inset-soft: inset 0 1px 0 0 rgba(255,255,255,0.6)`.

### Animation signature — `translate-x-[6px]` conservée

Easing `cubic-bezier(0.16, 1, 0.3, 1)` (var `--ease-out-webflow`) conservé. Durations conservées. `prefers-reduced-motion: reduce` strict.

### Breakpoints — conservés

479 / 768 / 992 / 1280, max-w 1280 px sur Container.

### Halos signature (NEW)

- `.bg-halo-warm` — radial-gradient terracotta + bleu très doux (Hero, intro).
- `.bg-halo-cool` — radial-gradient blue + sage subtil (alternance sections sand).

### Signature éditoriale (NEW)

Classe utilitaire `em.editorial` :

- `font-family: var(--font-serif)` (Fraunces)
- `font-style: italic`
- `color: var(--color-terracotta)`
- `font-weight: 500`

Utilisée pour mettre en évidence un mot-clé dans un titre serif (ex : « L'IA _qui produit_ du ROI »).

### Selection — passage primary → terracotta

`::selection { background: var(--color-terracotta); color: var(--color-mocha-fg); }`.

### Module-color mapping (CONSERVÉ depuis ADR 0001)

- Module 1 Interventions = primary `#1a4dd9` (Editorial Blue densifié).
- Module 2 Audit = orange `#ff6b00` (accent secondaire).
- Module 3 Implémentation = purple `#7a3dff` (accent secondaire).
- Cas concrets = sage `#7a8870` (était green `#00d722`, repositionné en sage pour cohérence éditoriale).
- Blog = neutral.

## Conséquences

### Positives

- Positionnement « cabinet IA premium B2B » porté par la doctrine elle-même (plus besoin de surveiller la tension ADR 0001).
- Signature éditoriale (serif italique terracotta) immédiatement reconnaissable.
- Surfaces ivoire chaud + mocha = lisibilité confortable longue durée (pages éditoriales blog, cas, FAQ).
- Cohérence avec la référence visuelle attendue par les DSI/dirigeants (Anthropic, Mistral).

### Négatives / À surveiller

- **Sprints 0-14 livrés sous v1 Webflow** : commits `fe000c6` → `f2ea1e6`. Le pivot v3 a été appliqué en working copy le 2026-05-06 et fera l'objet d'un commit dédié `feat(design): pivot v3 editorial premium light` post-officialisation.
- Token `--color-primary-300` / `--color-primary-400` conservés en compat v1/v2 mais devront être progressivement remplacés par `--color-primary-soft`.
- Token `--color-success/warning/error/info` aliasés sur la palette v3 (sage, terracotta, brick, primary).
- Police Fraunces ajoutée → +20-30 KB woff2. Budget fonts ≤ 100 KB toujours respecté (Manrope ~35 KB + Inconsolata ~25 KB + Fraunces ~30 KB = ~90 KB).
- Tests visual regression Playwright doivent être rebaselinés post-pivot.

### Sprints/audits impactés

- `_AUDIT/PROMPT-CODAGE.md` Sprint 1 (tokens) — historique conservé, réécriture impossible. La DoD Sprint 1 reste celle du commit `fe000c6` ; la doctrine v3 fait référence dans le checkpoint final + audits frontend.
- `_AUDIT/PROMPT-FRONTEND-DEEP-CHECK.md` chapitre 4 « Doctrine » — réécrit en v3 (cf. v2.0 du prompt).
- `_AUDIT/PROMPT-VERIFICATION-FINALE.md` chapitre 3 « Doctrine » — réécrit en v3 (cf. v1.1 du prompt).
- `_AUDIT/PROMPT-SPRINT-AUDIT.md` T4 ADR — référence ADR 0002 ajoutée (cf. v1.1).
- `axionia/Design.md` racine — réécrit en v3 (cf. fichier joint).
- `axionia-package/docs/_DECISIONS-FINALES.md` — entrée à ajouter pointant ADR 0002 (hors scope de cet ADR).

## Alternatives écartées

1. **Garder v1 Webflow tel quel** — rejeté : tension positionnement ADR 0001 confirmée pendant polish phase.
2. **Doctrine 100 % Anthropic clone** — rejeté : Webflow Blue conservé densifié pour préserver l'identité primary CTA et le module-color mapping.
3. **Refondre le module-color mapping** — rejeté : 21 pages produits déjà livrées sous mapping orange/purple/blue/green ; on conserve, on repositionne juste le green en sage pour cohérence chaude.

## Liens

- `axionia/Design.md` — doctrine canon v3 détaillée.
- `axionia/src/app/globals.css` — implémentation tokens.
- `axionia/docs/adr/0001-design-direction-webflow.md` — superseded.
- `_AUDIT/CHANGELOG-DESIGN-v3.md` (à créer) — log du pivot avec captures avant/après.
