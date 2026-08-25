/**
 * La charte couleur téléchargeable ne peut pas contredire la page.
 *
 * Défaut fermé ici : la page presse affichait sept pastilles de couleur et un
 * bouton « télécharger la charte » qui ne pouvait jamais apparaître — aucun
 * asset `color_charter` n'existait. Le fichier est désormais généré depuis la
 * MÊME constante que les pastilles.
 */

import { describe, it, expect } from "vitest";

import { GET } from "./route";
import { BRAND_PALETTE, PRESS_KIT_ASSETS } from "@/content/press";

async function corps(): Promise<string> {
  return await GET().text();
}

describe("GET /api/presse/charte-couleur", () => {
  it("🔴 sert EXACTEMENT les couleurs affichées sur la page, aucune recopie", async () => {
    const txt = await corps();
    // Contre-témoin : la palette n'est pas vide, sinon la boucle ne vérifie rien.
    expect(BRAND_PALETTE.length).toBeGreaterThanOrEqual(7);
    for (const c of BRAND_PALETTE) {
      expect(txt, `${c.name} absente de la charte`).toContain(c.name);
      expect(txt, `${c.hex} absent de la charte`).toContain(c.hex.toUpperCase());
    }
  });

  it("dérive le RGB du HEX plutôt que de le saisir à côté", async () => {
    const txt = await corps();
    // hex-ok: charte presse — Terracotta #C24A1B → 194, 74, 27. Si le RGB était recopié à la main, il
    // pourrait diverger du HEX sans que rien ne le signale.
    expect(txt).toContain("rgb(194, 74, 27)");
  });

  it("🔴 ne publie AUCUNE valeur CMJN inventée", async () => {
    const txt = await corps();
    // Une conversion sRGB→CMJN sans profil ICC produit des nombres qui ont l'air
    // officiels et trompent l'imprimeur. On renvoie explicitement au prépresse.
    expect(txt).not.toMatch(/C\s*:?\s*\d+\s*M\s*:?\s*\d+/i);
    expect(txt).toContain("prépresse");
  });

  it("se télécharge sous un nom de fichier stable", () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-disposition")).toContain(
      'filename="axion-ia-charte-couleur.txt"',
    );
  });

  it("🔴 la fixture du kit pointe vers la route, jamais vers un fichier figé", () => {
    const charte = PRESS_KIT_ASSETS.find((a) => a.kind === "color-charter");
    expect(charte, "aucune fixture de charte couleur : le bouton reste invisible").toBeDefined();
    expect(charte!.fileUrl).toBe("/api/presse/charte-couleur");
  });
});
