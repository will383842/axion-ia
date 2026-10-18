// Les pages hôtes portent l'encart « En vidéo » avec le bon thème (W4.2, W4.3) — vérifié sur
// le code source : le rendu de ces pages complètes n'est pas montable en test unitaire.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_SLUGS } from "@/content/videos/themes";

const code = (f: string) =>
  readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const SERVICES: Array<[string, string]> = [
  ["src/app/[locale]/audit/page.tsx", "audit-ia"],
  ["src/app/[locale]/implementation/page.tsx", "automatisation"],
  ["src/app/[locale]/sites-web-augmentes/page.tsx", "sites-web-ia"],
  ["src/app/[locale]/un-a-un/page.tsx", "coaching-ia"],
  ["src/app/[locale]/formations/page.tsx", "formations-ia"],
];

describe("services (W4.2)", () => {
  it.each(SERVICES)("%s porte <EncartEnVideo theme=%s />", (f, theme) => {
    const src = code(f);
    expect(src).toMatch(/import \{ EncartEnVideo \} from "@\/components\/videos\/EncartEnVideo"/);
    expect(src).toContain(`<EncartEnVideo theme="${theme}" />`);
    expect(THEME_SLUGS).toContain(theme);
  });
});

describe("articles (W4.2)", () => {
  const src = code("src/app/[locale]/blog/[slug]/page.tsx");
  it("le thème vient de la catégorie de l'article, et sans thème il n'y a pas d'encart", () => {
    expect(src).toContain("themeDeCategorieBlog(view.categorySlug)");
    expect(src).toMatch(/themeEncart \? <EncartEnVideo theme=\{themeEncart\} \/> : null/);
  });
});

describe("formations (W4.3) — soumises au drapeau OF", () => {
  const src = code("src/app/[locale]/formations/[slug]/page.tsx");
  it("l'encart passe par videoPourFormation(), qui rend null sans divulgation OF", () => {
    expect(src).toContain("videoPourFormation()");
    expect(src).toMatch(/<EncartEnVideo theme="formations-ia" video=\{videoEncart\} \/>/);
  });
});

describe("villes (W4.3) — jamais une requête par page", () => {
  const src = code("src/app/[locale]/implantations/[region]/[ville]/page.tsx");
  it("thème générique, via le composant (lecture mise en cache par processus)", () => {
    expect(src).toContain("<EncartEnVideo theme={THEME_GENERIQUE_VILLES} />");
    expect(src).not.toMatch(/prisma\.siteVideo|videosPubliees\(/);
  });
});
