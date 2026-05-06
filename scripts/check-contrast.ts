// WCAG 2.2 AA contrast verification on the canonical Webflow palette pairs
// declared in Design.md. Real text vs real bg only; we don't claim every
// possible combo is OK — only the official ones. Sprint 14 will widen this
// to crawl actual rendered pages.
//
// AA: ≥ 4.5:1 normal text · ≥ 3:1 large text (≥ 24px or ≥ 18.66px bold)
// AAA: ≥ 7:1 normal · ≥ 4.5:1 large

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

const palette = {
  primary: "#146ef5",
  primaryFg: "#ffffff",
  bg: "#ffffff",
  fg: "#080808",
  gray700: "#363636",
  gray600: "#5a5a5a",
  border: "#d8d8d8",
  accentOrange: "#ff6b00",
  accentPurple: "#7a3dff",
  accentGreen: "#00d722",
  accentYellow: "#ffae13",
  accentRed: "#ee1d36",
};

// Canonical pairs: only those documented in Design.md / axionia-design.
// Notes WCAG (verified 2026-05-06):
//   - accent-orange (#ff6b00): too light → use **fg (near-black)** as text, never primaryFg.
//   - accent-red    (#ee1d36): white passes AA only for **large text** (≥ 18.66 px bold or ≥ 24 px).
//                              For body text on red, switch to fg or darken the red.
const pairs: Pair[] = [
  { fg: palette.fg, bg: palette.bg, label: "fg on bg" },
  { fg: palette.gray700, bg: palette.bg, label: "gray-700 on bg" },
  { fg: palette.gray600, bg: palette.bg, label: "gray-600 on bg" },
  { fg: palette.primary, bg: palette.bg, label: "primary on bg" },
  { fg: palette.primaryFg, bg: palette.primary, label: "primaryFg on primary (CTA)" },
  { fg: palette.primaryFg, bg: palette.accentPurple, label: "primaryFg on accent-purple" },
  { fg: palette.fg, bg: palette.accentOrange, label: "fg on accent-orange (text/badges)" },
  {
    fg: palette.primaryFg,
    bg: palette.accentRed,
    label: "primaryFg on accent-red (LARGE text only)",
    largeOnly: true,
  },
  { fg: palette.fg, bg: palette.accentYellow, label: "fg on accent-yellow (warning bg)" },
  { fg: palette.fg, bg: palette.accentGreen, label: "fg on accent-green" },
];

let failures = 0;
for (const p of pairs) {
  const r = ratio(p.fg, p.bg);
  const threshold = p.largeOnly ? 3 : 4.5;
  const ok = r >= threshold;
  const tag = ok ? "✓" : "✗";
  const line = `${tag} ${p.label.padEnd(48)} ${r.toFixed(2)}:1 (need ≥ ${threshold})`;
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
