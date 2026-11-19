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
  bg: "#faf9f5", // canvas ivoire chaud
  paper: "#ffffff",
  sand: "#e8e6dc",
  mocha: "#141413",
  // Encre — surface des pages d'atterrissage publicitaires (`.bg-vsl`).
  ink: "#141413",
  // Foreground
  fg: "#141413",
  fgSoft: "#5e5d59",
  fgMuted: "#5e5d59", // resynchronisé 2026-07-26 (X5) — globals.css porte #5e5d59
  mochaFg: "#faf9f5",
  mochaFgMuted: "#b0aea5", // texte secondaire sur mocha (espaces connectés)
  mochaSoft: "#141413",
  // Accents
  primary: "#b23f16",
  primaryFg: "#ffffff",
  primarySoft: "#e8e6dc",
  terracotta: "#b23f16", // resynchronisé 2026-07-26 (X5) — assombri pour AA le 26/07
  terracottaSoft: "#e8e6dc",
  terracottaDeep: "#8f3412",
  // Terracotta éclairci pour surface SOMBRE (barre latérale des espaces
  // connectés). Le terracotta de marque n'y donne que 2,61:1.
  terracottaOnMocha: "#d97757",
  sage: "#5e7050",
  sageSoft: "#eef1eb",
  // Compat v1 (legacy bg-accent-* tokens still emitted by Badge etc.)
  accentOrange: "#d97757",
  accentPurple: "#b23f16",
  accentGreen: "#5e7050",
  accentYellow: "#e8e6dc",
  accentRed: "#b8341c",
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
  { fg: palette.sage, bg: palette.sageSoft, label: "sage on sage-soft" },
  { fg: palette.sage, bg: palette.sand, label: "sage on sand", largeOnly: true }, // 4,29:1 : texte normal interdit
  { fg: palette.accentGreen, bg: palette.sageSoft, label: "success on sage-soft" },
  // Text on sand (intermissions)
  { fg: palette.fg, bg: palette.sand, label: "fg on sand" },
  { fg: palette.fgSoft, bg: palette.sand, label: "fg-soft on sand" },
  { fg: palette.fgMuted, bg: palette.sand, label: "fg-muted on sand" },
  { fg: palette.primary, bg: palette.sand, label: "primary on sand" },
  { fg: palette.terracottaDeep, bg: palette.sand, label: "terracotta-deep on sand" },
  // Text on mocha (deep brown — alternative au noir)
  { fg: palette.mochaFg, bg: palette.mocha, label: "mocha-fg on mocha" },

  // Encre — page d'atterrissage publicitaire (`.bg-vsl`). Surface la plus
  // sombre de la charte : ces trois paires sont TOUT ce qui s'y affiche.
  { fg: palette.mochaFg, bg: palette.ink, label: "mocha-fg on ink (VSL + héro tunnel apporteurs)" },
  {
    fg: palette.mochaFgMuted,
    bg: palette.ink,
    label: "mocha-fg-muted on ink (VSL + héro tunnel apporteurs)",
  },
  {
    fg: palette.terracottaOnMocha,
    bg: palette.ink,
    label: "terracotta-on-mocha on ink (VSL + héro tunnel apporteurs)",
  },
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
  // ── Espaces connectés : barre latérale SOMBRE (2026-08-04) ──────────────
  // Ces paires existent parce que le terracotta de MARQUE ne donne que 2,61:1
  // sur mocha — il est calibré comme fond sous texte ivoire, pas comme texte
  // sur fond sombre. Sans ces lignes, rien ne surveillerait les couleurs de la
  // latérale : le gate serait passé par vacuité.
  {
    fg: palette.mochaFgMuted,
    bg: palette.mocha,
    label: "mocha-fg-muted on mocha (nav inactive)",
  },
  {
    fg: palette.mochaFgMuted,
    bg: palette.mochaSoft,
    label: "mocha-fg-muted on mocha-soft (nav survolée)",
  },
  {
    fg: palette.terracottaOnMocha,
    bg: palette.mocha,
    label: "terracotta-on-mocha on mocha (accent latérale)",
  },
  {
    fg: palette.terracottaOnMocha,
    bg: palette.mochaSoft,
    label: "terracotta-on-mocha on mocha-soft (icône active)",
  },
  {
    fg: palette.mocha,
    bg: palette.terracottaOnMocha,
    label: "mocha on terracotta-on-mocha (initiales avatar)",
  },
  {
    fg: palette.mochaFg,
    bg: palette.mochaSoft,
    label: "mocha-fg on mocha-soft (nav active)",
  },
  // CTA buttons
  { fg: palette.primaryFg, bg: palette.primary, label: "primaryFg on primary (CTA)" },
  {
    fg: palette.primaryFg,
    bg: palette.terracotta,
    label: "primaryFg on terracotta (CTA terracotta)",
  },
  // ── En-tête public : barre TERRACOTTA (correctif du 2026-11-11, après la PR 1916) ──
  // Williams veut l'en-tête orange, pas blanc. Tout texte posé SUR la barre est
  // listé ici ; le voile `supports-[backdrop-filter]:bg-terracotta/95` laisse
  // transparaître la page, on vérifie donc aussi le pire cas (page blanche).
  {
    fg: palette.mochaFg,
    bg: palette.terracotta,
    label: "mocha-fg on terracotta (onglets en-tête)",
  },
  {
    fg: palette.mochaFg,
    bg: blend(palette.terracotta, palette.paper, 0.95),
    label: "mocha-fg on terracotta/95 sur page blanche (onglets en-tête, voile)",
  },
  {
    fg: palette.mochaFg,
    bg: blend(palette.terracotta, palette.bg, 0.95),
    label: "mocha-fg on terracotta/95 sur page ivoire (onglets en-tête, voile)",
  },
  {
    fg: palette.mochaFg,
    bg: palette.terracottaDeep,
    label: "mocha-fg on terracotta-deep (bouton ☰ survolé)",
  },
  { fg: palette.mochaFg, bg: palette.mocha, label: "mocha-fg on mocha (pastille La Journée IA)" },
  {
    fg: palette.mochaFg,
    bg: palette.mochaSoft,
    label: "mocha-fg on mocha-soft (pastille La Journée IA survolée)",
  },
  {
    fg: palette.terracotta,
    bg: palette.paper,
    label: "terracotta on paper (loupe et « Nous écrire » de l'en-tête)",
  },
  { fg: palette.fgMuted, bg: palette.paper, label: "fg-muted on paper (tagline du badge logo)" },
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
  // V4-02 : accent-green = #5e7050 (palette définitive) → texte blanc (5,1:1), plus noir (3,4:1).
  { fg: palette.primaryFg, bg: palette.accentGreen, label: "primaryFg on accent-green" },
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
  ink: "ink",
  fg: "fg",
  fgSoft: "fg-soft",
  fgMuted: "fg-muted",
  mochaFg: "mocha-fg",
  mochaFgMuted: "mocha-fg-muted",
  mochaSoft: "mocha-soft",
  primary: "primary",
  primaryFg: "primary-fg",
  primarySoft: "primary-soft",
  terracotta: "terracotta",
  terracottaSoft: "terracotta-soft",
  terracottaDeep: "terracotta-deep",
  terracottaOnMocha: "terracotta-on-mocha",
  sage: "sage",
  sageSoft: "sage-soft",
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
