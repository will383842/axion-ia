// @vitest-environment node
/**
 * CLS = 0 sur /fr/videos/[slug] : les chapitres sont dans le HTML SERVEUR. Une île chargée
 * avec `ssr: false` s'insère après l'hydratation, au-dessus du résumé, et décale la page
 * d'une hauteur qu'aucune place réservée ne peut deviner (marges fusionnées, titres sur
 * plusieurs lignes).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tracking", () => ({ trackFunnel: vi.fn() }));
// En production, l'App Router sert `next/dynamic` par la variante « app » (rendu serveur
// attendu par Suspense) ; vitest résout la variante « pages ». On rejoue celle de la prod.
vi.mock("next/dynamic", async () => {
  const m = await import("next/dist/shared/lib/app-dynamic");
  return { default: m.default };
});

import { ChapitresVideoDiffere } from "../ChapitresVideoDiffere";

const CHAPITRES = [
  { titre: "Pourquoi relancer", debutSecondes: 0 },
  { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
];

function htmlServeur(): Promise<string> {
  return new Promise((ok, ko) => {
    const flux = new PassThrough();
    let html = "";
    flux.on("data", (c) => (html += c.toString()));
    flux.on("end", () => ok(html));
    const { pipe } = renderToPipeableStream(
      <ChapitresVideoDiffere
        videoId="lecteur"
        videoSlug="x"
        dureeSecondes={184}
        chapitres={CHAPITRES}
      />,
      { onAllReady: () => pipe(flux), onError: ko },
    );
  });
}

describe("ChapitresVideoDiffere — rendu serveur", () => {
  it("le HTML serveur contient déjà les boutons de chapitres", async () => {
    const html = await htmlServeur();
    expect(html).toContain("Pourquoi relancer");
    expect(html).toContain("Automatiser sans perdre le ton");
  });

  it("l'import dynamique ne désactive pas le rendu serveur", () => {
    const src = readFileSync(resolve(__dirname, "../ChapitresVideoDiffere.tsx"), "utf8");
    expect(src).not.toMatch(/ssr:\s*false/);
  });
});
