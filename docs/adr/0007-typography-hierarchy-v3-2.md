# ADR 0007 — Typography hierarchy v3.2 (modular scale + hero cap)

- **Statut** : Accepté
- **Date** : 2026-05-08
- **Auteur** : Will + Claude (Opus 4.7)
- **Référence** : delta v3.2 de l'ADR 0002 « Design pivot Editorial Premium v3 », successeur de l'ADR 0004 (qui n'avait corrigé que le baseline corps).
- **Audit source** : `_AUDIT/AUDIT-TYPOGRAPHY-2026.md` § 0ter.

---

## Contexte

L'ADR 0004 (v3.1) a bumpé le baseline corps 16→18 px et `text-sm` 14→15 px. Cela a corrigé la lisibilité du body mais a **aggravé** la hiérarchie : avec body=18, le ratio H3/body est tombé à **1.0×** (text-lg=18) ou 1.11× (text-xl=20), bien sous la cible doctrine 2026 ≥ 1.5×. Will a re-signalé le 2026-05-08 :

> « Est-ce normal qu'il y ait autant d'écart entre les h1, h2, h3, h4, h5, h6 et les textes ? »

Trois faits :

1. **Hero trop dominant** : `display-editorial` clampait à 7rem (112 px). Ratio hero/body = 6.2× vs médiane 2026 = 4.4×. Stripe Press, qui est la borne haute du marché éditorial, plafonne à 88 px.
2. **Niveaux intermédiaires écrasés** : text-2xl (24) ≈ text-lead (23) — saut de 1.04× quasi-invisible. text-xl (20) ≈ text-base (18) — saut de 1.11×, illisible comme heading.
3. **Tailwind v4 defaults bruts** : seuls `text-base` et `text-sm` étaient overridés dans `@theme`. Les 9 autres niveaux (`text-lg` à `text-7xl`) utilisaient les valeurs Tailwind par défaut, conçues pour un body 16 px — pas 18 px.

## Décision

Adopter une **modular scale Major Third (1.25)** anchored body 18 px, en overridant tous les niveaux Tailwind dans `@theme` :

### Échelle Tailwind v3.2

| Classe      | Avant (Tailwind default) | v3.2 (override) | Delta         |
| ----------- | ------------------------ | --------------- | ------------- |
| `text-base` | 16 (puis 18 v3.1)        | **18 px**       | inchangé v3.1 |
| `text-sm`   | 14 (puis 15 v3.1)        | **15 px**       | inchangé v3.1 |
| `text-lg`   | 18                       | **20 px**       | +2            |
| `text-xl`   | 20                       | **22 px**       | +2            |
| `text-2xl`  | 24                       | **26 px**       | +2            |
| `text-3xl`  | 30                       | **32 px**       | +2            |
| `text-4xl`  | 36                       | **40 px**       | +4            |
| `text-5xl`  | 48                       | **52 px**       | +4            |
| `text-6xl`  | 60                       | **64 px**       | +4            |
| `text-7xl`  | 72                       | **80 px**       | +8            |

### Cap hero

| Token / utility            | Avant         | v3.2                | Effet                   |
| -------------------------- | ------------- | ------------------- | ----------------------- |
| `--text-display`           | 7 rem (112)   | **5.5 rem (88)**    | -21 %                   |
| `.display-editorial` clamp | 3-7rem, 9vw   | **3-5.5rem, 7.5vw** | cap aligné Stripe Press |
| `--text-section`           | 4 rem (64)    | **3 rem (48)**      | sync avec text-4xl band |
| `--text-sub`               | 2.25 rem (36) | **2 rem (32)**      | sync avec text-3xl      |
| `--text-feature`           | 1.5 rem (24)  | **1.625 rem (26)**  | sync avec text-2xl      |

### Letter-spacing

Cohérence verticale : tracking décroissant à mesure que la taille croît.

| Classe                  | Tracking |
| ----------------------- | -------- |
| `text-base` à `text-lg` | -0.005em |
| `text-xl`               | -0.01em  |
| `text-2xl`              | -0.015em |
| `text-3xl`              | -0.02em  |
| `text-4xl`              | -0.025em |
| `text-5xl`              | -0.03em  |
| `text-6xl`              | -0.035em |
| `text-7xl` / display    | -0.04em  |

## Ratios résultants (anchored body 18 px)

| Niveau         | Px  | Ratio body | Cible 2026 | Verdict  |
| -------------- | --- | ---------- | ---------- | -------- |
| Hero display   | 88  | **4.89×**  | ~4.4×      | ✓ aligné |
| H1 (text-6xl)  | 64  | 3.56×      | 3.5-4×     | ✓        |
| H1 small (5xl) | 52  | 2.89×      | 2.5-3×     | ✓        |
| H2 (text-4xl)  | 40  | **2.22×**  | ≥2×        | ✓        |
| H3 (text-3xl)  | 32  | **1.78×**  | ≥1.5×      | ✓        |
| H4 (text-2xl)  | 26  | 1.44×      | ≥1.4×      | ✓        |
| H5 (text-xl)   | 22  | **1.22×**  | ≥1.2×      | ✓        |
| H6 (text-lg)   | 20  | 1.11×      | ≥1.1×      | ✓        |
| Lead           | 23  | 1.28×      | 1.2-1.4×   | ✓        |

**Avant v3.2** : 5/9 niveaux sous cible. **Après v3.2** : 9/9 dans cible.

## Pourquoi Major Third (1.25) et non Perfect Fourth (1.333)

- 1.25 cité par Linear, Vercel, Mistral (audit 2026-05-07). 1.333 plus typique des sites livre relié type Stripe Press qui auraient besoin de gradients plus marqués.
- Manrope x-height 0.515 (vs Inter 0.546) : à ratio identique, Manrope paraît plus serré qu'Inter. 1.25 donne assez d'espace perceptif sans creuser de trous.
- Le hero étant capped à 5.5rem (88 px), une scale plus agressive aurait poussé H1 hors-cap. 1.25 garde text-7xl=80 sous le hero display=88.

## Pourquoi pas migrer le code vers les tokens custom

Les tokens custom `--text-display`, `--text-section`, etc. restent définis (pour `Section titleAs="h1"` et fallback) mais sont toujours **DEAD CODE côté composants**. La migration des 60+ pages vers `text-display`/`text-section` reste optionnelle (Sprint dédié). L'override `@theme` rend la migration cosmétique : code et tokens consomment la même échelle.

## Patches code requis

**Aucun**. C'est un patch purement token. Les 60+ pages utilisent déjà `text-3xl md:text-4xl lg:text-5xl` etc. — ces classes pointent maintenant sur les nouvelles valeurs sans modification de fichier.

## Conséquences

### Positives

- **Hiérarchie restaurée** : 9/9 niveaux respectent les cibles ratio 2026.
- **Hero proportionné** : ratio hero/body 6.2× → 4.89× (médiane 2026 = 4.4×).
- **Centralisé** : 1 fichier modifié (`globals.css`), 0 page-level patch.
- **Cohérence Tailwind ↔ tokens custom** : les bands matchent (text-4xl=40 ↔ section=48 ↔ text-5xl=52, smooth).

### À surveiller

- **Layouts denses** (RoiSimulator, BookingFlow, FAQ, navigation header) : bumps +2 à +8 px sur H4-H7 peuvent demander un padding/gap revu sur 2-3 cards. Vérifier en preview après déploiement.
- **`max-w-3xl` + text-3xl** : line-length à 32 px = ~70 ch (OK). Pas de patch line-length requis.
- **Pages héro avec `text-7xl`** : passent de 72→80 px. Reste sous le cap display 88 px, donc pas de collision.
- **201 `text-[arbitrary]`** restants : non touchés, sprint dédié futur.

### Rollback

Revert ce commit suffit — 1 fichier `globals.css` + 1 fichier `Design.md` + ce ADR.

## Liens

- Audit : `_AUDIT/AUDIT-TYPOGRAPHY-2026.md` § 0ter
- ADR parents : `0002-design-pivot-editorial-v3.md`, `0004-typography-baseline-upgrade-v3-1.md`
- Doctrine : `axionia/Design.md` chapitre 3.2 (mise à jour 2026-05-08)
