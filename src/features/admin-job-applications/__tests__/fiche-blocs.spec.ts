/** L8c — la fiche « emploi » en blocs : rang des prix, prochain geste, bloc vidéos. */
import { describe, expect, it } from "vitest";

import { libelleRang, montrerBlocVideos, prochainGeste, rangDuPrix } from "../fiche-blocs";
import { entetesCv, estPdf } from "@/lib/careers/cv-en-ligne";

describe("rangDuPrix", () => {
  it("« 3ᵉ moins cher sur 29 »", () => {
    const autres = [1000, 2000, 2600, ...Array.from({ length: 25 }, () => 9000)];
    expect(rangDuPrix(2500, autres)).toEqual({ rang: 3, total: 29 });
    expect(libelleRang({ rang: 3, total: 29 })).toBe("3ᵉ moins cher sur 29");
    expect(libelleRang({ rang: 1, total: 29 })).toBe("le moins cher sur 29");
    expect(libelleRang({ rang: 1, total: 1 })).toBeNull();
  });
  it("à prix égal, même rang", () => {
    expect(rangDuPrix(1000, [1000, 500])).toEqual({ rang: 2, total: 3 });
  });
});

describe("prochainGeste", () => {
  it("un geste par étape ouverte, rien sur une étape close", () => {
    expect(prochainGeste("new", false)).toBe("Répondre");
    expect(prochainGeste("new", true)).toMatch(/Décider/);
    expect(prochainGeste("interview", true)).toMatch(/échange/);
    expect(prochainGeste("rejected", true)).toBeNull();
  });
});

describe("montrerBlocVideos", () => {
  it("seulement si l'offre en demande ou s'il y en a", () => {
    expect(montrerBlocVideos({ offreVideo: false, videos: 0, liens: 0 })).toBe(false);
    expect(montrerBlocVideos({ offreVideo: true, videos: 0, liens: 0 })).toBe(true);
    expect(montrerBlocVideos({ offreVideo: false, videos: 0, liens: 2 })).toBe(true);
  });
});

describe("CV lisible sur place", () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const html = Buffer.from("<html><script>");
  it("un vrai PDF s'ouvre dans le navigateur, sans être deviné", () => {
    expect(estPdf(pdf)).toBe(true);
    expect(entetesCv("cv.pdf", true, pdf)).toMatchObject({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="cv.pdf"',
      "X-Content-Type-Options": "nosniff",
    });
  });
  it("tout autre fichier reste en téléchargement neutre", () => {
    expect(entetesCv("cv.pdf", true, html)["Content-Disposition"]).toMatch(/^attachment/);
    expect(entetesCv("cv.pdf", true, html)["Content-Type"]).toBe("application/octet-stream");
    expect(entetesCv("cv.pdf", false, pdf)["Content-Disposition"]).toMatch(/^attachment/);
  });
});
