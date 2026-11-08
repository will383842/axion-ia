/** V6-01 — palette définitive des jetons `--color-admin-*` (couleurs-marque.json, 07/11/2026). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "admin.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const PALETTE_CONSOLE = new Set(
  [
    "#FAF9F5", // hex-ok: palette de référence du test
    "#E8E6DC", // hex-ok: palette de référence du test
    "#141413", // hex-ok: palette de référence du test
    "#FFFFFF", // hex-ok: palette de référence du test
    "#B23F16", // hex-ok: palette de référence du test
    "#8F3412", // hex-ok: palette de référence du test
    "#D97757", // hex-ok: palette de référence du test
    "#B0AEA5", // hex-ok: palette de référence du test
    "#5E5D59", // hex-ok: palette de référence du test
    "#5E7050", // hex-ok: palette de référence du test
    "#B8341C", // hex-ok: palette de référence du test
  ].map((h) => h.toLowerCase()),
);
const hexe = (v: string) => (v.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((h) => h.toLowerCase());
const decl = [...css.matchAll(/(--color-admin-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(
  (m) => [m[1] as string, (m[2] as string).trim()] as const,
);
const premierBloc = css.slice(
  css.indexOf("@layer admin-tokens"),
  css.indexOf("\n.admin-layout-v2,"),
);
const jetons = new Map(
  [...premierBloc.matchAll(/(--color-admin-[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)].map(
    (m) => [m[1] as string, (m[2] as string).toLowerCase()] as const,
  ),
);
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const j = (n: string) => jetons.get(`--color-admin-${n}`) as string;

/** Couleur de texte et fond déclarés par une règle `.classe { … }` (jetons `var(--color-admin-x)`). */
const regle = (sel: string) => {
  const corps = css.match(new RegExp(`${sel.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  const jeton = (prop: string) =>
    corps.match(new RegExp(`(?:^|[\\s;])${prop}\\s*:\\s*var\\(--color-admin-([a-z0-9-]+)\\)`))?.[1];
  return { texte: jeton("color"), fond: jeton("background-color") };
};

describe("jetons de la console : palette définitive", () => {
  it("l'analyse voit les jetons (83 ou plus) et les deux blocs", () => {
    expect(decl.length).toBeGreaterThanOrEqual(83);
    expect(css).toContain(".admin-ton-dossier {");
  });
  it("toute couleur littérale des jetons (deux blocs) est dans PALETTE_CONSOLE", () => {
    const hors = decl.flatMap(([n, v]) =>
      hexe(v)
        .filter((h) => !PALETTE_CONSOLE.has(h))
        .map((h) => `${n} ${h}`),
    );
    expect(hors).toEqual([]);
  });
  it("aucun bleu ni jaune (teinte 190-260° ou 40-70° au-delà de 15 % de saturation)", () => {
    const fautes = [...new Set(decl.flatMap(([, v]) => hexe(v)))].filter((h) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const mx = Math.max(r!, g!, b!),
        d = mx - Math.min(r!, g!, b!);
      if (!d || d / mx <= 0.15) return false;
      const t =
        mx === r ? ((g! - b!) / d + 6) % 6 : mx === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
      const deg = t * 60;
      return (deg >= 190 && deg <= 260) || (deg >= 40 && deg <= 70);
    });
    expect(fautes).toEqual([]);
    expect(css).not.toMatch(/#1a4dd9|#e8efff/i); // hex-ok: palette de référence du test
  });
  it("valeurs clés : fond, texte, bouton, erreur", () => {
    expect([j("bg"), j("fg"), j("terracotta"), j("destructive-fg"), j("destructive")]).toEqual([
      "#faf9f5", // hex-ok: palette de référence du test
      "#141413", // hex-ok: palette de référence du test
      "#b23f16", // hex-ok: palette de référence du test
      "#141413", // hex-ok: palette de référence du test
      "#b8341c", // hex-ok: palette de référence du test
    ]);
  });
  // prettier-ignore
  it("#D97757 n'apparaît que dans les jetons rail-*", () => { // hex-ok: palette de référence du test
    const hors = decl.filter(([n, v]) => !n.includes("-rail-") && /#d97757|217 119 87/i.test(v)); // hex-ok: motif du test
    expect(hors).toEqual([]);
  });
  it("contrastes WCAG AA calculés sur chaque paire utilisée", () => {
    const P: [string, string, number][] = [
      ["fg", "bg", 4.5],
      ["fg", "paper", 4.5],
      ["fg", "surface-hover", 4.5],
      ["fg-soft", "bg", 4.5],
      ["fg-muted", "paper", 4.5],
      ["fg-muted", "surface-hover", 4.5],
      ["accent-fg", "terracotta", 4.5],
      ["terracotta", "bg", 4.5],
      ["terracotta", "paper", 4.5],
      ["accent-strong", "bg", 4.5],
      ["success", "paper", 4.5],
      ["success-fg", "success-soft", 4.5],
      ["destructive", "paper", 4.5],
      ["destructive-fg", "destructive-soft", 4.5],
      ["warning", "bg", 4.5],
      ["warning-fg", "warning-soft", 4.5],
      ["info-fg", "info", 4.5],
      ["placeholder", "paper", 4.5],
      ["control-border", "paper", 3],
      ["rail-fg", "rail-bg", 4.5],
      ["rail-fg-soft", "rail-bg", 4.5],
      ["rail-fg-muted", "rail-bg", 4.5],
      ["rail-accent", "rail-bg", 4.5],
      ["rail-on-bright", "rail-avatar-bg", 4.5],
      ["rail-on-bright", "rail-badge-warn", 4.5],
      ["rail-fg", "rail-badge-danger", 4.5],
      ["accent-fg", "solid-success", 4.5],
      ["accent-fg", "solid-warning", 4.5],
      ["accent-fg", "solid-destructive", 4.5],
      ["accent-fg", "solid-info", 4.5],
      // Teinte d'identité « teal » (vert) : lisible en filet/icône sur les surfaces.
      ["id-teal", "paper", 4.5],
      ["id-teal", "bg", 4.5],
      // Texte noir posé sur le ton doux d'un badge ou d'une ligne d'agenda.
      ["fg", "success-soft", 4.5],
    ];
    for (const t of ["terracotta", "bleu", "vert", "ambre", "violet", "gris"])
      P.push([`bloc-${t}-title`, `bloc-${t}-bg`, 4.5], [`bloc-${t}-accent`, `bloc-${t}-bg`, 3]);
    const bas = P.filter(([a, b, s]) => ratio(j(a)!, j(b)!) < s).map(
      ([a, b, s]) => `${a}/${b} ${ratio(j(a)!, j(b)!).toFixed(2)} < ${s}`,
    );
    expect(bas).toEqual([]);
  });
  it("le badge actif : texte sur son fond >= 4,5 (AA)", () => {
    const { texte, fond } = regle(".admin-badge-active");
    expect(texte).toBe("success-fg");
    expect(fond).toBe("success-soft");
    expect(ratio(j(texte!), j(fond!))).toBeGreaterThanOrEqual(4.5);
  });
  it("les sources d'agenda « Réservations » (bleu) et « Personnel » (teal) sont distinctes", () => {
    expect(j("id-teal")).toBe("#5e7050"); // hex-ok: palette de référence du test
    expect(j("id-bleu")).toBe("#5e5d59"); // hex-ok: palette de référence du test
    expect(j("id-teal")).not.toBe(j("id-bleu"));
  });
});
