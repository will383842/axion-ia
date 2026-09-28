import { describe, expect, it } from "vitest";

import { extraireLiensVideo, montreDuTravail, plateformeDe } from "../liens-video";

describe("« Ses vidéos » — les liens vers le travail d'un candidat", () => {
  it("rassemble toutes les sources, sans doublon, sous la PREMIÈRE source", () => {
    const l = extraireLiensVideo([
      {
        source: "formulaire",
        texte: "https://youtu.be/abc\nhttps://drive.google.com/drive/folders/X",
      },
      { source: "petit mot", texte: "Voir https://youtu.be/abc. Et https://www.tiktok.com/@moi !" },
      { source: "e-mail", texte: "https://share.icloud.com/photos/Z" },
    ]);
    expect(l.map((x) => [x.plateforme, x.source])).toEqual([
      ["YouTube", "formulaire"],
      ["Google Drive", "formulaire"],
      ["TikTok", "petit mot"],
      ["iCloud", "e-mail"],
    ]);
    expect(l[2]!.url).toBe("https://www.tiktok.com/@moi");
  });

  it("écarte nos liens, les agendas et les cartes de signature", () => {
    expect(
      extraireLiensVideo([
        {
          source: "e-mail",
          texte:
            "https://axion-ia.com/fr/completer-ma-candidature?jeton=x https://calendly.com/a https://www.google.com/maps/search/11+Avenue",
        },
      ]),
    ).toEqual([]);
  });

  it("un profil (LinkedIn, IMDb) n'est pas du travail montré ; un portfolio l'est", () => {
    const [li, imdb, site] = extraireLiensVideo([
      {
        source: "p",
        texte: "https://www.linkedin.com/in/x https://www.imdb.com/name/nm1 https://moi.framer.app",
      },
    ]);
    expect([li, imdb, site].map((x) => montreDuTravail(x!))).toEqual([false, false, true]);
    expect(plateformeDe("https://moi.framer.app")).toBe("Site / portfolio");
  });

  it("rien, ou une URL illisible, ne plante pas", () => {
    expect(
      extraireLiensVideo([
        { source: "x", texte: null },
        { source: "y", texte: "http://" },
      ]),
    ).toEqual([]);
  });
});
