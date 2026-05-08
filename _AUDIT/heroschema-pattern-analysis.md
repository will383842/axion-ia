# HeroSchema Pattern Analysis (Agent A · Visual Rhythm 2026)

**Date** : 2026-05-07 · HEAD `941a8e1`+
**Sources** : 5 fichiers `src/components/sections/*HeroSchema*.tsx`
**Doctrine** : Editorial Premium Light v3.1 — palette terracotta/mocha/sage/paper/sand/primary

---

## 1. Spécification complète du pattern

### 1.1 Props API canonique

Trois familles d'API identifiées :

**Famille A — Orbital nodes (5 ou 6 ou 8 satellites)** — `InterventionsHeroSchema`, `StackHeroSchema`, `ImplementationHeroSchema` :

```ts
export interface OrbitalHeroSchemaProps {
  /** Label central (ex "Votre entreprise"). Premier mot serif italique terracotta. */
  centerLabel: string;
  /** Caption optionnel sous le label central. UPPERCASE letterSpacing 0.08em. */
  centerCaption?: string;
  /** Satellites — ordre = sens horaire depuis le haut-gauche. */
  nodes: ReadonlyArray<{
    label: string; // Court (≤22 chars)
    benefit: string; // 1 ligne (≤30 chars)
    accent: "terracotta" | "primary" | "sage" | "mocha";
  }>;
  /** Texte alternatif pour lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}
```

**Famille B — Flow narratif vertical** — `AuditHeroSchema` :

```ts
export interface FlowHeroSchemaProps {
  isFr: boolean; // Locale switch (les actes sont écrits en dur)
  ariaLabel: string;
  className?: string;
}
// Le contenu (steps[], outcomes[]) est inline dans le composant —
// pas exposé en props (volontairement narratif, pas listing).
```

**Famille C — Stack de mini-cards** — `CaseStudiesHeroSchema` :

```ts
export interface StackHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}
// Le contenu (3 cas exemples) est inline dans le composant.
```

> **Constat** : famille A est la seule réutilisable directement (props data-driven). Familles B et C sont des composants narratifs dédiés à 1 page chacune. **Pour étendre le pattern à 8 nouveaux HeroSchema (cf. visual-inventory.md §1.5), favoriser la famille A** quand la donnée est listable.

### 1.2 Structure SVG canonique (orbital)

```
<svg viewBox="0 0 W H" preserveAspectRatio="xMidYMid meet" overflow="visible">
  <defs>
    <radialGradient id="{prefix}-halo-tc">  <!-- 0%/0.25 → 60%/0.06 → 100%/0 -->
    <radialGradient id="{prefix}-halo-pr">  <!-- 0%/0.14-0.16 → 100%/0 -->
    <radialGradient id="{prefix}-halo-sg">  <!-- 0%/0.18-0.20 → 100%/0 -->
    <pattern id="{prefix}-grid" 48×48>      <!-- lines border-strong opacity 0.18 -->
    <radialGradient id="{prefix}-grid-mask">  <!-- 0%/0.55 → 100%/0 white -->
    <mask id="{prefix}-vignette-mask">
      <rect width="100%" height="100%" fill="url(#{prefix}-grid-mask)" />
    </mask>
  </defs>

  <!-- 1. Background grille fade vignette -->
  <rect width={W} height={H} fill="url(#{prefix}-grid)" mask="url(#{prefix}-vignette-mask)" />

  <!-- 2. Halos diffus (3) -->
  <circle cx={cx} cy={cy} r={360-380} fill="url(#{prefix}-halo-tc)" />
  <circle cx={W-70} cy={120} r={160-180} fill="url(#{prefix}-halo-pr)" />
  <circle cx={70} cy={H-110} r={150-170} fill="url(#{prefix}-halo-sg)" />

  <!-- 3. Anneaux concentriques (3 ellipses centrées) -->
  <ellipse rx={rx+40-50} ry={ry+40-50} stroke="border-strong" opacity="0.18-0.20" dasharray="2 8" />
  <ellipse rx={rx} ry={ry} stroke="terracotta" opacity="0.30-0.32" dasharray="3 6" />
  <ellipse rx={rx-50} ry={ry-75} stroke="border-strong" opacity="0.28-0.30" />

  <!-- 4. Liaisons centre → satellites (1 par node) -->
  {nodes.map(node => (
    <line stroke={accentColor[node.accent]} strokeOpacity="0.40" strokeWidth="1.25" strokeDasharray="3 6" />
  ))}

  <!-- 5. Satellites (1 group par node) -->
  {nodes.map(node => (
    <g>
      <circle r={30-32} fill={accent} fillOpacity="0.10" />     <!-- halo extérieur -->
      <circle r={20-22} fill={accent} fillOpacity="0.20" />     <!-- halo intermédiaire -->
      <circle r={10-11} fill={accent} stroke="bg" strokeWidth="3" />  <!-- dot -->
      <text fontFamily="manrope" fontSize="15" fontWeight="700" fill="fg">{label}</text>
      <text fontFamily="manrope" fontSize="12.5" fontWeight="500" fill="fg-soft">{benefit}</text>
    </g>
  ))}

  <!-- 6. Centre (anneau diffus + cercle papier + label serif italique) -->
  <circle r={78-108} fill="none" stroke="terracotta" strokeOpacity="0.16-0.20" strokeWidth="14" />
  <circle r={78-108} fill="paper" stroke="terracotta" strokeWidth="2.5" />
  <text fontFamily="serif" fontStyle="italic" fontSize="22-25" fontWeight="500" fill="terracotta">
    {centerHead}
  </text>
  <text fontFamily="manrope" fontSize="13-14" fontWeight="600" fill="fg">{centerTail}</text>
  {centerCaption && <text fontSize="10.5" letterSpacing="0.08em" fill="fg-muted">UPPERCASE</text>}

  <!-- 7. Particules décoratives (signature obligatoire) -->
  <circle cx={50} cy={90} r={2.5} fill="terracotta" opacity="0.55" />
  <circle cx={W-50} cy={H-90} r={2.5} fill="sage" opacity="0.5" />
  <circle cx={W-70} cy={70} r={2} fill="primary" opacity="0.55" />
  <circle cx={60} cy={H-60} r={2} fill="terracotta" opacity="0.5" />
  <path d="..." fill="terracotta" opacity="0.55" />  <!-- étoile 4-pointes -->
  <path d="..." fill="sage" opacity="0.5" />          <!-- étoile 4-pointes -->
</svg>
```

### 1.3 Constantes de dimensionnement

| Variable                 | InterventionsHeroSchema   | StackHeroSchema                 | ImplementationHeroSchema                   |
| ------------------------ | ------------------------- | ------------------------------- | ------------------------------------------ |
| W                        | 560                       | 560                             | 720                                        |
| H                        | 760                       | 760                             | 700                                        |
| Format                   | portrait                  | portrait                        | paysage                                    |
| rx (orbite)              | 170                       | 160                             | 250                                        |
| ry (orbite)              | 270                       | 280                             | 230                                        |
| centre r                 | 78                        | 108                             | 84                                         |
| satellites count         | 5                         | 6                               | 8                                          |
| angles                   | `[-110, -65, 0, 65, 130]` | `[-115, -70, -25, 25, 70, 115]` | `[-90, -45, 0, 45, 90, 135, 180, -135]`    |
| `labelLayout()` requis ? | non                       | non                             | oui (8 satellites = collisions au top/bot) |

### 1.4 Helpers fonctionnels

```ts
// Position d'un satellite sur orbite elliptique. Convention :
// angleDeg = 0 → droite, -90 → haut, 90 → bas.
function ellipsePos(angleDeg: number, rx: number, ry: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * rx, y: cy + Math.sin(rad) * ry };
}

// (ImplementationHeroSchema only) Layout label adaptatif selon angle.
function labelLayout(angle: number): {
  anchor: "start" | "middle" | "end";
  dx: number;
  dyTitle: number;
  dyBenefit: number;
} {
  if (angle === -90) return { anchor: "middle", dx: 0, dyTitle: -34, dyBenefit: -16 };
  if (angle === 90) return { anchor: "middle", dx: 0, dyTitle: 32, dyBenefit: 50 };
  if (angle > -90 && angle < 90) return { anchor: "start", dx: 22, dyTitle: -3, dyBenefit: 16 };
  return { anchor: "end", dx: -22, dyTitle: -3, dyBenefit: 16 };
}
```

### 1.5 Tokens couleur utilisés (palette v3.1 stricte)

| Token                        | Usage                                             | Valeur (réf) |
| ---------------------------- | ------------------------------------------------- | ------------ |
| `var(--color-terracotta)`    | accent principal, anneau centre, satellites       | `#c24a1b`    |
| `var(--color-primary)`       | accent secondaire (analytique), satellites        | `#1a4dd9`    |
| `var(--color-sage)`          | accent module Cas concrets, satellites            | `#5e6c54`    |
| `var(--color-mocha)`         | accent neutre (1 satellite max)                   | `#2a2520`    |
| `var(--color-paper)`         | fill cercle centre                                | `#ffffff`    |
| `var(--color-bg)`            | stroke des dots (séparation)                      | `#faf8f3`    |
| `var(--color-fg)`            | label satellite (texte 700)                       | `#1a1815`    |
| `var(--color-fg-soft)`       | sous-label satellite (texte 500)                  | `#524b41`    |
| `var(--color-fg-muted)`      | caption centre UPPERCASE                          | `#6b6155`    |
| `var(--color-border-strong)` | grille fond + anneau outer/inner                  | `#c8bda0`    |
| `var(--font-serif)`          | premier mot label centre + label Stack satellites | Fraunces     |
| `var(--font-manrope)`        | tous les autres textes SVG                        | Manrope      |

### 1.6 Animation et accessibilité

- **Aucune animation SVG** — tous les fichiers sont 100% static, SSR-friendly. Convention `// Pas d'animation ; SSR-friendly` dans le commentaire d'en-tête.
- **`role="img"` + `aria-label`** au niveau du wrapper `<div>` (pas du `<svg>`). Le SVG est ainsi traité comme une image unique pour les lecteurs d'écran, pas exploré nœud par nœud.
- **`pointer-events-none`** sur le wrapper par défaut — le schéma n'est pas interactif (pas de clic accidentel sur dot).
- **Pas de `<title>` ni `<desc>` à l'intérieur du SVG** — l'accessibilité est portée par `aria-label` du parent.
- **`overflow="visible"` + `overflow-visible` Tailwind** — autorise les labels et halos à dépasser légèrement le viewBox sans être croppés.

### 1.7 Performance

- Server Component pur → 0 JS côté client.
- Pas de `<filter>` sauf `soft-glow` dans hero `/` (pénalité GPU sur low-end).
- Halos en `<radialGradient>` natifs SVG (rapide).
- Recommandation : éviter `<filter>` dans les nouveaux HeroSchema sauf nécessité narrative.

---

## 2. Code skeleton TypeScript prêt à dupliquer

Skeleton à copier dans `src/components/sections/{NewName}HeroSchema.tsx`. Reprend les invariants `InterventionsHeroSchema`. Adapter ensuite W/H, satellites count, angles selon le besoin.

```tsx
// Server Component — schéma visuel du hero /{route}.
// Format {portrait|paysage} ({W} × {H}), orbite elliptique pour
// {N} satellites. Reprend la grammaire HeroSchema gold standard
// (anneaux + halos terracotta/primary/sage + particules).
//
// Pas d'animation ; SSR-friendly ; `aria-label` au niveau du wrapper.

import type { ReactNode } from "react";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface {NewName}HeroSchemaProps {
  /** Label central (ex « Votre entreprise »). Premier mot serif italique terracotta. */
  centerLabel: string;
  /** Caption sous le label central — optionnel. UPPERCASE letterSpacing 0.08em. */
  centerCaption?: string;
  /** Satellites — ordre = sens horaire depuis le haut-gauche. */
  nodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: Accent;
  }>;
  /** Texte alternatif pour lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const accentColor: Record<Accent, string> = {
  terracotta: "var(--color-terracotta)",
  primary: "var(--color-primary)",
  sage: "var(--color-sage)",
  mocha: "var(--color-mocha)",
};

function ellipsePos(
  angleDeg: number,
  rx: number,
  ry: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * rx, y: cy + Math.sin(rad) * ry };
}

export function {NewName}HeroSchema({
  centerLabel,
  centerCaption,
  nodes,
  ariaLabel,
  className,
}: {NewName}HeroSchemaProps): ReactNode {
  // TODO : adapter W/H au besoin. Portrait 560×760 si ≤6 satellites,
  // paysage 720×700 si ≥7.
  const W = 560;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;
  const rx = 170;
  const ry = 270;

  // TODO : adapter angles. Convention sens horaire depuis haut-gauche.
  // Éviter 0° et 180° pile (collisions labels) sauf si labelLayout() en place.
  const angles = nodes.length === 5
    ? [-110, -65, 0, 65, 130]
    : nodes.length === 6
      ? [-115, -70, -25, 25, 70, 115]
      : [-90, -45, 0, 45, 90, 135, 180, -135]; // 8 satellites

  // Premier mot serif italique terracotta, suite sans-serif fg.
  const centerWords = centerLabel.split(" ");
  const centerHead = centerWords[0] ?? centerLabel;
  const centerTail = centerWords.slice(1).join(" ");

  // TODO : préfixe id unique pour éviter collision si plusieurs schémas
  // sur la même page (rare mais possible).
  const P = "{prefix}"; // ex: "iv" / "sk" / "im" — 2 chars

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className ?? "pointer-events-none mx-auto w-full max-w-md"}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <defs>
          <radialGradient id={`${P}-halo-tc`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.25" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${P}-halo-pr`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${P}-halo-sg`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>
          <pattern id={`${P}-grid`} width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.18"
            />
          </pattern>
          <radialGradient id={`${P}-grid-mask`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id={`${P}-vignette-mask`}>
            <rect width="100%" height="100%" fill={`url(#${P}-grid-mask)`} />
          </mask>
        </defs>

        {/* 1. Grille texturée vignette */}
        <rect width={W} height={H} fill={`url(#${P}-grid)`} mask={`url(#${P}-vignette-mask)`} />

        {/* 2. Halos diffus */}
        <circle cx={cx} cy={cy} r={360} fill={`url(#${P}-halo-tc)`} />
        <circle cx={W - 70} cy={120} r={160} fill={`url(#${P}-halo-pr)`} />
        <circle cx={70} cy={H - 110} r={150} fill={`url(#${P}-halo-sg)`} />

        {/* 3. Anneaux concentriques */}
        <ellipse cx={cx} cy={cy} rx={rx + 40} ry={ry + 40}
          stroke="var(--color-border-strong)" strokeOpacity="0.20" strokeDasharray="2 8" fill="none" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          stroke="var(--color-terracotta)" strokeOpacity="0.30" strokeDasharray="3 6" fill="none" />
        <ellipse cx={cx} cy={cy} rx={rx - 50} ry={ry - 75}
          stroke="var(--color-border-strong)" strokeOpacity="0.30" fill="none" />

        {/* 4. Liaisons centre → satellites */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          return (
            <line key={`l-${idx}`} x1={cx} y1={cy} x2={pos.x} y2={pos.y}
              stroke={accentColor[node.accent]} strokeOpacity="0.40"
              strokeWidth="1.25" strokeDasharray="3 6" />
          );
        })}

        {/* 5. Satellites */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const isRight = pos.x > cx;
          const tx = isRight ? pos.x + 22 : pos.x - 22;
          const anchor = isRight ? "start" : "end";
          return (
            <g key={`n-${idx}`}>
              <circle cx={pos.x} cy={pos.y} r={32}
                fill={accentColor[node.accent]} fillOpacity="0.10" />
              <circle cx={pos.x} cy={pos.y} r={22}
                fill={accentColor[node.accent]} fillOpacity="0.20" />
              <circle cx={pos.x} cy={pos.y} r={11}
                fill={accentColor[node.accent]} stroke="var(--color-bg)" strokeWidth="3" />
              <text x={tx} y={pos.y - 3} textAnchor={anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="15" fontWeight="700" fill="var(--color-fg)">
                {node.label}
              </text>
              <text x={tx} y={pos.y + 16} textAnchor={anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="12.5" fontWeight="500" fill="var(--color-fg-soft)">
                {node.benefit}
              </text>
            </g>
          );
        })}

        {/* 6. Centre */}
        <circle cx={cx} cy={cy} r={78} fill="none"
          stroke="var(--color-terracotta)" strokeOpacity="0.20" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={78} fill="var(--color-paper)"
          stroke="var(--color-terracotta)" strokeWidth="2.5" />
        <text x={cx} y={cy - 4} textAnchor="middle"
          fontFamily="var(--font-serif), serif" fontStyle="italic"
          fontSize="24" fontWeight="500" fill="var(--color-terracotta)">
          {centerHead}
        </text>
        {centerTail ? (
          <text x={cx} y={cy + 22} textAnchor="middle"
            fontFamily="var(--font-manrope), system-ui, sans-serif"
            fontSize="14" fontWeight="600" fill="var(--color-fg)">
            {centerTail}
          </text>
        ) : null}
        {centerCaption ? (
          <text x={cx} y={cy + 44} textAnchor="middle"
            fontFamily="var(--font-manrope), system-ui, sans-serif"
            fontSize="10.5" fontWeight="500" fill="var(--color-fg-muted)"
            letterSpacing="0.08em">
            {centerCaption.toUpperCase()}
          </text>
        ) : null}

        {/* 7. Particules décoratives (signature obligatoire) */}
        <circle cx={50} cy={90} r={2.5} fill="var(--color-terracotta)" opacity="0.55" />
        <circle cx={W - 50} cy={H - 90} r={2.5} fill="var(--color-sage)" opacity="0.5" />
        <circle cx={W - 70} cy={70} r={2} fill="var(--color-primary)" opacity="0.55" />
        <circle cx={60} cy={H - 60} r={2} fill="var(--color-terracotta)" opacity="0.5" />
        <path
          d={`M ${W - 40} ${H / 2 - 80} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
          fill="var(--color-terracotta)" opacity="0.55" />
        <path
          d={`M 40 ${H / 2 + 80} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-sage)" opacity="0.5" />
      </svg>
    </div>
  );
}
```

**Notes d'implémentation pour l'agent qui dupliquera** :

1. Toujours commencer par dupliquer `InterventionsHeroSchema.tsx` (le plus minimal et le plus pur).
2. Renommer `iv-*` IDs SVG en `{prefix}-*` pour éviter collisions cross-instances.
3. Tester systématiquement avec 5 / 6 / 8 nodes (les 3 cas) pour valider que les angles n'overflow pas le canvas.
4. Si labels longs (>22 chars) → soit raccourcir (recommandé) soit augmenter rx pour décaler les satellites plus loin du centre.
5. Garder les particules décoratives **sans modification** — c'est la signature visuelle qui homogénéise toute la collection.

---

## 3. Table : page → besoin HeroSchema

| Page                        | HeroSchema actuel                     | Besoin nouveau ?            | Nom proposé                                | Type                                                        | Satellites               | Accents recommandés                                              |
| --------------------------- | ------------------------------------- | --------------------------- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `/` (Home)                  | ✅ SVG inline `app/[locale]/page.tsx` | À extraire                  | `HomeHeroSchema`                           | Orbital 600×680 paysage existant                            | 3 services               | terracotta (intervenir) · primary (auditer) · sage (implémenter) |
| `/interventions`            | ✅ `InterventionsHeroSchema`          | non                         | —                                          | —                                                           | 5                        | terracotta · primary · sage · mocha · terracotta                 |
| `/audit`                    | ✅ `AuditHeroSchema` (flow)           | non                         | —                                          | —                                                           | 4 steps + 6 outcomes     | terracotta dominant                                              |
| `/stack-ia`                 | ✅ `StackHeroSchema`                  | non                         | —                                          | —                                                           | 6 + cluster 11           | terracotta · primary · sage · mocha mix                          |
| `/methodologie`             | ❌                                    | OUI · **priorité critique** | `MethodologyHeroSchema`                    | Flow horizontal 4 étapes (variante audit horizontale)       | 4                        | terracotta → primary → sage → mocha                              |
| `/implementation`           | ✅ `ImplementationHeroSchema`         | non                         | —                                          | —                                                           | 8                        | terracotta · primary · sage · mocha mix                          |
| `/cas-concrets`             | ✅ `CaseStudiesHeroSchema` (stack)    | non                         | —                                          | —                                                           | 3 cards                  | sage                                                             |
| `/comparaisons`             | ❌                                    | OUI · **important**         | `ComparisonsHeroSchema`                    | Triangle 3 pôles (vous au centre, 2 alternatives en orbite) | 3 (vous + 2 concurrents) | terracotta (vous) · primary · mocha (alternatives)               |
| `/blog`                     | ❌                                    | OUI · important             | `BlogHeroSchema`                           | Stack 3 mini-articles dynamiques (date+tag+title)           | 3                        | terracotta                                                       |
| `/centre-aide`              | ❌                                    | OUI · important             | `HelpHeroSchema`                           | Constellation 6 thématiques                                 | 6                        | mocha dominant + terracotta accents                              |
| `/interventions/dirigeants` | ❌ (`ProductPageTemplate`)            | OUI · template              | `InterventionDetailHeroSchema`             | Timeline daily horizontale (matin / midi / aprem)           | 3-4                      | accent module (primary)                                          |
| `/interventions/equipes`    | ❌ (`ProductPageTemplate`)            | idem                        | `InterventionDetailHeroSchema` (réutilisé) | idem                                                        | idem                     | accent module (primary)                                          |
| `/audit/strategique-pme`    | ❌ (`ProductPageTemplate`)            | OUI · template              | `AuditDetailHeroSchema`                    | 3 livrables empilés (variante stack)                        | 3                        | accent niveau (sage pour PME)                                    |
| `/guide-ia`                 | ❌                                    | optionnel                   | `GuideIAHeroSchema`                        | Mockup PDF cover + sommaire 6 chapitres                     | 6 chapitres              | terracotta                                                       |
| `/a-propos`                 | ❌                                    | OUI · important             | `AboutHeroSchema`                          | Timeline verticale `ABOUT_TIMELINE`                         | 4-6 events               | terracotta                                                       |
| `/contact`                  | ❌                                    | non                         | —                                          | —                                                           | —                        | —                                                                |
| `/presse`                   | ❌                                    | OUI · important             | `PressHeroSchema`                          | Stack 3 facts clés (`PRESS_FACTS`)                          | 3                        | terracotta + mocha                                               |
| `/roi`                      | ❌                                    | optionnel                   | `RoiHeroSchema`                            | 2 sliders teaser miniatures avant simulator                 | 2                        | primary · sage                                                   |
| `/reserver`                 | ❌                                    | non                         | —                                          | —                                                           | —                        | —                                                                |
| `/faq`                      | ❌                                    | non                         | —                                          | —                                                           | —                        | —                                                                |

**Total nouveaux HeroSchema à créer** : 8 (priorité critique 1 + important 5 + template 2). Optionnels : 2.

---

## 4. Convention de nommage et localisation

- **Fichier** : `src/components/sections/{Page}HeroSchema.tsx`. Utiliser le PascalCase avec suffixe `HeroSchema`.
- **Export nommé** : `export function {Page}HeroSchema({ ... }: {Page}HeroSchemaProps)` — pas de default export.
- **Props typées** : interface exposée à côté du composant `export interface {Page}HeroSchemaProps`.
- **Commentaire d'en-tête** : 4-6 lignes décrivant le format (portrait/paysage), le nombre de satellites, la doctrine respectée. Inclure date + signature `Will, 2026-MM-DD.` si modifié.
- **Préfixes IDs SVG** : 2 chars uniques (`iv` interventions, `sk` stack, `im` implementation, `me` methodology, `cp` comparisons, etc.). Évite les collisions si 2 schémas sur la même page.

---

## 5. Risques et gardes-fous

1. **Risque homogénéité visuelle** : si chaque agent qui crée un nouveau HeroSchema bouge un paramètre (ex. r centre 90 au lieu de 78-108), la collection diverge. **Garde-fou** : Design.md doit lister les 7 invariants stricts (cf. §1.2) en checklist.
2. **Risque labels qui débordent** : si un label dépasse 22 chars, il colle le label voisin. **Garde-fou** : valider visuellement à chaque ajout de node, ou ajouter une assertion runtime `if (label.length > 22) console.warn(...)` en dev.
3. **Risque overflow viewBox** : sur 5-6 satellites portrait, les labels gauche/droite débordent du viewBox normal mais sont sauvés par `overflow-visible`. **Garde-fou** : ne JAMAIS mettre `overflow-hidden` sur le wrapper section parent du HeroSchema (mais OK sur la grille de fond).
4. **Risque accents mal alloués** : doctrine v6 + ADR 0002 attribuent un accent par module (terracotta=Module 1, primary=audit-listing, sage=Module 3 + Cas concrets). **Garde-fou** : check croisé avec `Design.md` avant chaque nouveau HeroSchema.
5. **Risque accumulation de SVG poids** : chaque HeroSchema ajoute ~6-8 KB de SSR HTML. Sur Top 20, +120-160 KB total. Acceptable car SSG. **Garde-fou** : ne pas dupliquer les `<defs>` entre instances de la même page (rare cas).

---

**Fin du document — heroschema-pattern-analysis.md** (Agent A · 2026-05-07)
