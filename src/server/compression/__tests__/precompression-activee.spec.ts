import { describe, expect, it } from "vitest";

import { precompressionActivee } from "../precompression-activee";

// 2026-10-08 : la précompression coûtait 21,6 min par mise en ligne pour des fichiers que rien
// ne sert en production. Elle est désactivée par défaut et ne se rallume que sur demande explicite.
describe("précompression au build", () => {
  it("désactivée par défaut", () => {
    expect(precompressionActivee({})).toBe(false);
    expect(precompressionActivee({ PRECOMPRESS_STATIC: "false" })).toBe(false);
    expect(precompressionActivee({ PRECOMPRESS_STATIC: "1" })).toBe(false);
  });

  it("se rallume seulement avec PRECOMPRESS_STATIC=true", () => {
    expect(precompressionActivee({ PRECOMPRESS_STATIC: "true" })).toBe(true);
  });
});
