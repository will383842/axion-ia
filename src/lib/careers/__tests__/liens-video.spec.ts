import { describe, expect, it } from "vitest";

import {
  estPageDeProfil,
  extraireLiensVideo,
  montreDuTravail,
  plateformeDe,
  urlOembed,
} from "../liens-video";

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

describe("chaînes et profils — jamais vérifiés par l'oEmbed (faux « morts » du 29/09)", () => {
  it.each([
    "https://www.youtube.com/@nicolas/playlists",
    "https://youtube.com/@vizeo?si=8AyhBB8xgqFyb_yC",
    "https://www.youtube.com/channel/UC123",
    "https://tiktok.com/@ketchup.lab",
    "https://vimeo.com/monstudio",
  ])("%s est une page de profil : appel direct, pas d'oEmbed", (url) => {
    expect(estPageDeProfil(url)).toBe(true);
    expect(urlOembed(url)).toBeNull();
  });

  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://www.youtube.com/shorts/abc",
    "https://www.tiktok.com/@moi/video/7412345",
    "https://vimeo.com/123456",
  ])("%s est une vidéo : oEmbed", (url) => {
    expect(estPageDeProfil(url)).toBe(false);
    expect(urlOembed(url)).not.toBeNull();
  });
});
