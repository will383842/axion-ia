import { describe, expect, it } from "vitest";

import { lire, sourcesExigeesSous } from "./sources-du-circuit-visio";

/**
 * ⛔ SEUL `src/server/videos/reception.ts` ÉCRIT `SiteVideo` (lot W1, ADR 0070).
 *
 * Toutes les règles du contrat (version, slug immuable, rejeu, retrait) vivent
 * dans la réception ; un second écrivain les contournerait en silence — publier
 * une vidéo que le contrat aurait refusée, ou la retirer sans passer par le
 * retrait unique qui purge toutes les surfaces (W4).
 */
const RECEPTION = "src/server/videos/reception.ts";
const DOSSIERS = ["src", "scripts", "prisma"] as const;

const MOTIFS: ReadonlyArray<RegExp> = [
  /\.siteVideo\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
  /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?site_videos"?[\s(]/i,
];

function ecritUneVideo(source: string): boolean {
  return MOTIFS.some((m) => m.test(source));
}

describe("⛔ aucun écrivain de SiteVideo hors de la réception", () => {
  const ecrivains = sourcesExigeesSous(DOSSIERS)
    .filter((f) => ecritUneVideo(lire(f)))
    .sort();

  it("le balayage trouve la réception elle-même — sinon il ne garde rien", () => {
    expect(ecrivains).toContain(RECEPTION);
  });

  it("aucun autre fichier n'écrit une vidéo du site", () => {
    expect(
      ecrivains.filter((f) => f !== RECEPTION),
      "ces fichiers écrivent SiteVideo sans passer par src/server/videos/reception.ts",
    ).toEqual([]);
  });

  it("le motif détecte bien un écrivain (témoin)", () => {
    expect(ecritUneVideo("await prisma.siteVideo.update({ where: {}, data: {} })")).toBe(true);
    expect(ecritUneVideo("await tx.siteVideo.create({ data })")).toBe(true);
    expect(ecritUneVideo('UPDATE "site_videos" SET statut = 1')).toBe(true);
    expect(ecritUneVideo("await prisma.siteVideo.findMany()")).toBe(false);
    expect(ecritUneVideo("await tx.siteVideoReception.create({ data })")).toBe(false);
  });
});
