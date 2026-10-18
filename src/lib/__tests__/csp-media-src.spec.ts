import { describe, expect, it } from "vitest";
import { buildCspHeader } from "../csp";

/**
 * `media-src 'self'` EXPLICITE (lot W1 des vidéos du site, plan §1).
 *
 * Sans cette directive, les médias retombent sur `default-src 'self'` : les
 * vidéos de `/medias/` passent déjà. Mais « passe par défaut » est fragile — un
 * `default-src` plus large ouvrirait les médias à tous les domaines, un plus
 * strict les casserait en silence. On l'écrit, on la verrouille, et on interdit
 * tout schéma générique.
 */
describe("CSP — media-src", () => {
  const nonce = "test-nonce";
  const directiveMedia = (csp: string) =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("media-src"));

  it.each([
    ["publique (soft)", { strict: false }],
    ["stricte (admin)", { strict: true }],
    ["embed", { strict: false, embed: true }],
  ])("CSP %s : exactement `media-src 'self'`", (_nom, options) => {
    expect(directiveMedia(buildCspHeader({ nonce, ...options }))).toBe("media-src 'self'");
  });

  it("aucun schéma générique (https:, http:, data:, blob:, *) dans media-src", () => {
    const d = directiveMedia(buildCspHeader({ nonce, strict: false }));
    expect(d).not.toMatch(/https?:|data:|blob:|\*/);
  });
});
