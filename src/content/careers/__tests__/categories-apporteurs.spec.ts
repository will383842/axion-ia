import { describe, expect, it } from "vitest";

import { CAREER_CATEGORIES } from "../categories";

describe("catégories carrières — réseau d'apporteurs", () => {
  it("le service lié à la catégorie parle d'apporteurs d'affaires, pas de réseau commercial", () => {
    const cat = CAREER_CATEGORIES.find((c) => c.service?.href === "/devenir-commercial-ia");
    expect(cat?.service?.fr).toBe("Réseau d'apporteurs d'affaires");
  });
});
