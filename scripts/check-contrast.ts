// WCAG 2.2 AA contrast verification on the canonical v3 palette pairs
// declared in `globals.css` v3 (Editorial Premium Light, ADR 0002).
//
// AA: ≥ 4.5:1 normal text · ≥ 3:1 large text (≥ 24px or ≥ 18.66px bold)
// AAA: ≥ 7:1 normal · ≥ 4.5:1 large
//
// Alpha-channel pairs (e.g. `text-mocha-fg/70`) are pre-mixed with their
// effective base color so the assertion is on the actually-rendered colour.

import { readFileSync } from "node:fs";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix `fg` with `bg` according to alpha (0..1). Returns the effective rendered colour. */
function blend(fgHex: string, bgHex: string, alpha: number): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  return rgbToHex({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  });
}

function relLuminance({ r, g, b }: Rgb): number {
  const adj = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b);
}

function ratio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

interface Pair {
  fg: string;
  bg: string;
  label: string;
  largeOnly?: boolean;
}

// v3 palette mirror — must match globals.css.
const palette = {
  // Surfaces
  bg: "#faf8f3", // canvas ivoire chaud
  paper: "#ffffff",
  sand: "#f0e9da",
  mocha: "#2a2520",
  // Foreground
  fg: "#1a1815",
  fgSoft: "#524b41",
  fgMuted: "#5a4f44", // resynchronisé 2026-07-26 (X5) — globals.css porte #5a4f44
  mochaFg: "#f7f3ea",
  // Accents
  primary: "#1a4dd9",
  primaryFg: "#ffffff",
  primarySoft: "#e8efff",
  terracotta: "#b23f16", // resynchronisé 2026-07-26 (X5) — assombri pour AA le 26/07
  terracottaSoft: "#f5e3d8",
  terracottaDeep: "#8c3010",
  sage: "#5e6c54",
  // Compat v1 (legacy bg-accent-* tokens still emitted by Badge etc.)
  accentOrange: "#ff6b00",
  accentPurple: "#7a3dff",
  accentGreen: "#00d722",
  accentYellow: "#ffae13",
  accentRed: "#ee1d36",
};

const pairs: Pair[] = [
  // Text on canvas (bg ivoire)
  { fg: palette.fg, bg: palette.bg, label: "fg on bg (canvas)" },
  { fg: palette.fgSoft, bg: palette.bg, label: "fg-soft on bg" },
  { fg: palette.fgMuted, bg: palette.bg, label: "fg-muted on bg" },
  { fg: palette.primary, bg: palette.bg, label: "primary on bg" },
  { fg: palette.terracotta, bg: palette.bg, label: "terracotta on bg" },
  // Text on paper (white)
  { fg: palette.fg, bg: palette.paper, label: "fg on paper" },
  { fg: palette.fgSoft, bg: palette.paper, label: "fg-soft on paper" },
  { fg: palette.fgMuted, bg: palette.paper, label: "fg-muted on paper" },
  { fg: palette.primary, bg: palette.paper, label: "primary on paper" },
  { fg: palette.terracotta, bg: palette.paper, label: "terracotta on paper" },
  { fg: palette.sage, bg: palette.paper, label: "sage on paper" },
  // Text on sand (intermissions)
  { fg: palette.fg, bg: palette.sand, label: "fg on sand" },
  { fg: palette.fgSoft, bg: palette.sand, label: "fg-soft on sand" },
  { fg: palette.fgMuted, bg: palette.sand, label: "fg-muted on sand" },
  { fg: palette.primary, bg: palette.sand, label: "primary on sand" },
  { fg: palette.terracottaDeep, bg: palette.sand, label: "terracotta-deep on sand" },
  // Text on mocha (deep brown — alternative au noir)
  { fg: palette.mochaFg, bg: palette.mocha, label: "mocha-fg on mocha" },
  {
    fg: blend(palette.mochaFg, palette.mocha, 0.85),
    bg: palette.mocha,
    label: "mocha-fg/85 on mocha",
  },
  {
    fg: blend(palette.mochaFg, palette.mocha, 0.7),
    bg: palette.mocha,
    label: "mocha-fg/70 on mocha",
  },
  {
    fg: blend(palette.mochaFg, palette.mocha, 0.6),
    bg: palette.mocha,
    label: "mocha-fg/60 on mocha (legal cols header)",
  },
  { fg: palette.terracottaSoft, bg: palette.mocha, label: "terracotta-soft on mocha" },
  // CTA buttons
  { fg: palette.primaryFg, bg: palette.primary, label: "primaryFg on primary (CTA)" },
  {
    fg: palette.primaryFg,
    bg: palette.terracotta,
    label: "primaryFg on terracotta (CTA terracotta)",
  },
  // Badges (sand + terracotta-soft chips on cards)
  { fg: palette.fgSoft, bg: palette.sand, label: "fg-soft on sand (industry badge)" },
  {
    fg: palette.terracottaDeep,
    bg: palette.terracottaSoft,
    label: "terracotta-deep on terracotta-soft (metric badge)",
  },
  // Compat v1 (Badge variants, accent backgrounds — still used in product pages)
  { fg: palette.fg, bg: palette.accentOrange, label: "fg on accent-orange" },
  { fg: palette.fg, bg: palette.accentYellow, label: "fg on accent-yellow" },
  { fg: palette.fg, bg: palette.accentGreen, label: "fg on accent-green" },
  { fg: palette.primaryFg, bg: palette.accentPurple, label: "primaryFg on accent-purple" },
  {
    fg: palette.primaryFg,
    bg: palette.accentRed,
    label: "primaryFg on accent-red (LARGE text only)",
    largeOnly: true,
  },
];

// ── Garde-fou de parité : le miroir ne peut plus mentir ──────────────────────
// 🔴 Audit certification 2026-07-26 (X5). Ce miroir avait dérivé SANS BRUIT : il
// déclarait encore l'ancien terracotta et l'ancien fg-muted alors que globals.css
// portait déjà les valeurs durcies. Le gate était donc VERT en mesurant des
// couleurs mortes — le même défaut que le job nocturne « vs prod » qui n'atteignait
// jamais la prod. Un miroir tenu à la main finit toujours par diverger ; on le
// garde (il reste lisible d'un coup d'œil) mais on le confronte à sa source.
const CSS_PATH = "src/app/globals.css"; // relatif à la racine (cf. scripts/check-radius.ts)
const CSS_TOKENS = new Map<string, string>();
for (const m of readFileSync(CSS_PATH, "utf8").matchAll(
  /--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi,
)) {
  const nom = m[1];
  const hex = m[2];
  if (nom && hex) CSS_TOKENS.set(nom.toLowerCase(), hex.toLowerCase());
}

// Clé du miroir → nom du jeton CSS. Le type `Record<keyof typeof palette, string>`
// force l'exhaustivité : ajouter une couleur au miroir sans la rattacher à un jeton
// ne compile pas. Une couleur que personne ne rattache est une couleur que personne
// ne maintient.
const MIRROR_TO_CSS: Record<keyof typeof palette, string> = {
  bg: "bg",
  paper: "paper",
  sand: "sand",
  mocha: "mocha",
  fg: "fg",
  fgSoft: "fg-soft",
  fgMuted: "fg-muted",
  mochaFg: "mocha-fg",
  primary: "primary",
  primaryFg: "primary-fg",
  primarySoft: "primary-soft",
  terracotta: "terracotta",
  terracottaSoft: "terracotta-soft",
  terracottaDeep: "terracotta-deep",
  sage: "sage",
  accentOrange: "accent-orange",
  accentPurple: "accent-purple",
  accentGreen: "accent-green",
  accentYellow: "accent-yellow",
  accentRed: "accent-red",
};

let drift = 0;
for (const cle of Object.keys(MIRROR_TO_CSS) as Array<keyof typeof palette>) {
  const tokenCss = MIRROR_TO_CSS[cle];
  const attendu = CSS_TOKENS.get(tokenCss);
  const declare = palette[cle].toLowerCase();
  if (attendu === undefined) {
    console.error(`✗ --color-${tokenCss} absent de globals.css (miroir : ${cle})`);
    drift++;
  } else if (attendu !== declare) {
    console.error(`✗ dérive ${cle} : globals.css=${attendu}, check-contrast=${declare}`);
    drift++;
  }
}
if (drift > 0) {
  console.error(
    `\n[contrast:check] ${drift} dérive(s) miroir ↔ globals.css. Corriger AVANT de lire ` +
      `les ratios ci-dessous : ils portent sur des couleurs qui n'existent plus.`,
  );
  process.exit(1);
}

let failures = 0;
for (const p of pairs) {
  const r = ratio(p.fg, p.bg);
  const threshold = p.largeOnly ? 3 : 4.5;
  const ok = r >= threshold;
  const tag = ok ? "✓" : "✗";
  const line = `${tag} ${p.label.padEnd(52)} ${r.toFixed(2)}:1 (need ≥ ${threshold})`;
  if (ok) {
    console.warn(line);
  } else {
    console.error(line);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n[contrast:check] ${failures} pair(s) below WCAG threshold`);
  process.exit(1);
}
console.warn(`\n[contrast:check] OK — ${pairs.length} pairs ≥ AA`);
