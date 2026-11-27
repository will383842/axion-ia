// @vitest-environment node
/**
 * F1 — /guides/[slug] n'émet qu'UN SEUL BreadcrumbList.
 *
 * Avant : la page posait son propre `JsonLd` (sans « Accueil ») ET le composant
 * `<Breadcrumbs>` émettait le sien (avec « Accueil »), au même `@id` `#breadcrumb`.
 * Reste le seul émetteur : `<Breadcrumbs>` (émission par défaut).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildBreadcrumbJsonLd } from "@/lib/seo";

const PAGE = readFileSync(join(process.cwd(), "src/app/[locale]/guides/[slug]/page.tsx"), "utf8");

describe("/guides/[slug] — un seul BreadcrumbList", () => {
  it("la page n'appelle plus buildBreadcrumbJsonLd (pas d'émetteur en double)", () => {
    expect(PAGE).not.toMatch(/buildBreadcrumbJsonLd/);
    expect(PAGE).not.toMatch(/jsonld-breadcrumb-guide/);
  });

  it("<Breadcrumbs> reste rendu, sans emitJsonLd={false} (seul émetteur)", () => {
    const m = PAGE.match(/<Breadcrumbs\b[^>]*>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/emitJsonLd/);
  });

  it("le nœud émis par <Breadcrumbs> commence par Accueil et porte #breadcrumb", () => {
    const n = buildBreadcrumbJsonLd({
      locale: "fr",
      items: [
        { name: "Accueil", href: "/" },
        { name: "Guides", href: "/guides" },
        { name: "Titre", href: "/guides/x" },
      ],
    });
    expect(n["@id"]).toMatch(/#breadcrumb$/);
    expect(n.itemListElement[0]?.name).toBe("Accueil");
  });
});
