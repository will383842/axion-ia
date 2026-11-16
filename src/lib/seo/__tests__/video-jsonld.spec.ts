import { describe, expect, it } from "vitest";
import { buildVideoPageJsonLd, dureeIso8601, dateIsoParis } from "../video-jsonld";
import type { VideoPubliee } from "@/server/videos/lecture";

const SITE = "https://axion-ia.com";

function video(over: Partial<VideoPubliee> = {}): VideoPubliee {
  const base = "/medias/videos/ma-video/v3";
  return {
    slug: "ma-video",
    version: 3,
    theme: "automatisation",
    titre: "Automatiser ses relances clients en quelques minutes",
    description:
      "Une description de la vidéo qui fait plus de quatre-vingts caractères pour être honnête.",
    resume: "r".repeat(400),
    aRetenir: ["a", "b", "c"],
    questions: [],
    chapitres: [
      { titre: "Pourquoi relancer", debutSecondes: 0 },
      { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
    ],
    fichiers: {
      video: { chemin: `${base}/video-1080p.mp4`, type: "video/mp4", octets: 1 },
      affiche169: { chemin: `${base}/affiche-16x9.avif`, type: "image/avif", octets: 1 },
      vignette43: { chemin: `${base}/vignette-4x3.avif`, type: "image/avif", octets: 1 },
      vignette11: { chemin: `${base}/vignette-1x1.avif`, type: "image/avif", octets: 1 },
      sousTitres: { chemin: `${base}/sous-titres.fr.vtt`, type: "text/vtt", octets: 1 },
    },
    transcription: null,
    dureeSecondes: 184,
    serie: null,
    lien: { type: "service", chemin: "/fr/implementation" },
    iaVoixGeneree: false,
    iaDoubleNumerique: false,
    williamsALImage: false,
    publieeLe: new Date("2026-11-02T09:00:00Z"),
    modifieeLe: new Date("2026-11-05T09:00:00Z"),
    ...over,
  };
}

function objetVideo(v: VideoPubliee, options = {}) {
  const graph = buildVideoPageJsonLd(v, { siteUrl: SITE, ...options })["@graph"];
  return graph.find((n) => n["@type"] === "VideoObject") as Record<string, unknown>;
}

describe("VideoObject", () => {
  it("jamais d'embedUrl", () => {
    expect(objetVideo(video())).not.toHaveProperty("embedUrl");
  });

  it("thumbnailUrl : TABLEAU de 3 URL absolues /medias/ (16:9, 4:3, 1:1)", () => {
    expect(objetVideo(video()).thumbnailUrl).toEqual([
      `${SITE}/medias/videos/ma-video/v3/affiche-16x9.avif`,
      `${SITE}/medias/videos/ma-video/v3/vignette-4x3.avif`,
      `${SITE}/medias/videos/ma-video/v3/vignette-1x1.avif`,
    ]);
  });

  it("contentUrl sur notre domaine, inLanguage fr, publisher = #organization", () => {
    const o = objetVideo(video());
    expect(o.contentUrl).toBe(`${SITE}/medias/videos/ma-video/v3/video-1080p.mp4`);
    expect(o.inLanguage).toBe("fr");
    expect(o.publisher).toEqual({ "@id": `${SITE}/#organization` });
    expect(o.creator).toEqual({ "@id": `${SITE}/#organization` });
    expect(o["@id"]).toBe(`${SITE}/fr/videos/ma-video#video`);
  });

  it("creator = la Person de Williams seulement s'il est à l'image", () => {
    expect(objetVideo(video({ williamsALImage: true })).creator).toEqual({
      "@id": `${SITE}/fr/equipe/williams#person`,
    });
  });

  it("dates AVEC fuseau, durée ISO 8601", () => {
    const o = objetVideo(video());
    expect(o.uploadDate).toBe("2026-11-02T10:00:00+01:00");
    expect(o.dateModified).toBe("2026-11-05T10:00:00+01:00");
    expect(o.duration).toBe("PT3M4S");
  });

  it("hasPart : un Clip par chapitre, endOffset du dernier = durée, aucun début en double", () => {
    const parts = objetVideo(video()).hasPart as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => [p.startOffset, p.endOffset])).toEqual([
      [0, 42],
      [42, 184],
    ]);
    expect(new Set(parts.map((p) => p.startOffset)).size).toBe(parts.length);
    expect(parts[1]!.url).toBe(`${SITE}/fr/videos/ma-video?t=42`);
  });

  it("hasPart et SeekToAction ABSENTS sous 30 s", () => {
    const o = objetVideo(video({ dureeSecondes: 29, chapitres: [] }));
    expect(o).not.toHaveProperty("hasPart");
    expect(o).not.toHaveProperty("potentialAction");
  });

  it("hasPart absent aussi avec un seul chapitre (chapitres < 2)", () => {
    expect(
      objetVideo(video({ chapitres: [{ titre: "Seul", debutSecondes: 0 }] })),
    ).not.toHaveProperty("hasPart");
  });

  it("SeekToAction avec le modèle ?t={seek_to_second_number}", () => {
    expect(objetVideo(video()).potentialAction).toMatchObject({
      "@type": "SeekToAction",
      target: `${SITE}/fr/videos/ma-video?t={seek_to_second_number}`,
      "startOffset-input": "required name=seek_to_second_number",
    });
  });

  it("transcript présent seulement s'il existe", () => {
    expect(objetVideo(video())).not.toHaveProperty("transcript");
    expect(objetVideo(video({ transcription: "Bonjour." })).transcript).toBe("Bonjour.");
  });

  it("mention IA ajoutée à la description", () => {
    expect(String(objetVideo(video({ iaVoixGeneree: true })).description)).toMatch(
      /Voix de synthèse générée par IA\.$/,
    );
    expect(String(objetVideo(video()).description)).not.toMatch(/IA\./);
  });

  it("le ?t= n'apparaît QUE dans Clip.url et SeekToAction.target", () => {
    const texte = JSON.stringify(buildVideoPageJsonLd(video(), { siteUrl: SITE }));
    const sansClips = texte
      .replace(/"url":"[^"]*\?t=\d+"/g, "")
      .replace(/"target":"[^"]*\?t=\{seek_to_second_number\}"/, "");
    expect(sansClips).not.toContain("?t=");
  });
});

describe("BreadcrumbList", () => {
  it("Accueil › Vidéos › titre, avec le thème intercalé quand sa page existe", () => {
    const g = buildVideoPageJsonLd(video(), { siteUrl: SITE })["@graph"];
    const fil = g.find((n) => n["@type"] === "BreadcrumbList") as unknown as {
      itemListElement: Array<{ name: string; item: string; position: number }>;
    };
    expect(fil.itemListElement.map((i) => i.name)).toEqual([
      "Accueil",
      "Vidéos",
      "Automatiser ses relances clients en quelques minutes",
    ]);
    const g2 = buildVideoPageJsonLd(video(), {
      siteUrl: SITE,
      theme: { libelle: "Automatisation", href: "/videos/theme/automatisation" },
    })["@graph"];
    const fil2 = g2.find((n) => n["@type"] === "BreadcrumbList") as unknown as typeof fil;
    expect(fil2.itemListElement.map((i) => i.name)).toEqual([
      "Accueil",
      "Vidéos",
      "Automatisation",
      "Automatiser ses relances clients en quelques minutes",
    ]);
    expect(fil2.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4]);
  });
});

describe("aides", () => {
  it("dureeIso8601", () => {
    expect(dureeIso8601(31)).toBe("PT31S");
    expect(dureeIso8601(60)).toBe("PT1M");
    expect(dureeIso8601(3600)).toBe("PT1H");
    expect(dureeIso8601(3725)).toBe("PT1H2M5S");
  });
  it("dateIsoParis : heure d'été et d'hiver", () => {
    expect(dateIsoParis(new Date("2026-07-01T10:00:00Z"))).toBe("2026-07-01T12:00:00+02:00");
    expect(dateIsoParis(new Date("2026-12-01T10:00:00Z"))).toBe("2026-12-01T11:00:00+01:00");
  });
});

// ── SEO-05 : ImageObject et FAQPage dans le @graph ─────────────────────────────────────
type Noeud = Record<string, unknown> & { "@type": string };
const graphe = (v: VideoPubliee): Noeud[] =>
  buildVideoPageJsonLd(v, { siteUrl: SITE })["@graph"] as unknown as Noeud[];

const BASE = "/medias/videos/ma-video/v3";
const fichePage = {
  titre: "Gagnez du temps : automatisez vos relances clients",
  metaDescription: "m".repeat(150),
  h1: "Gagnez du temps en automatisant vos relances clients",
  resumeCitable: "r".repeat(250),
  gain: "g".repeat(100),
  limites: ["L’automatisation des relances ne remplace pas un appel."],
  questions: [1, 2, 3].map((n) => ({
    question: `Question ${n} ?`,
    reponse: `Réponse ${n} complète.`,
  })),
  auteur: "Équipe Axion-IA",
  carrousel: [
    {
      chemin: `${BASE}/carrousel-1.avif`,
      alt: "Première image du carrousel",
      largeur: 1080,
      hauteur: 1350,
    },
  ],
  infographie: {
    chemin: `${BASE}/infographie.avif`,
    alt: "Frise des étapes d’une relance",
    largeur: 1080,
    hauteur: 1920,
  },
};

describe("FAQPage", () => {
  it("présent avec les questions de la fiche, mot pour mot", () => {
    const faq = graphe(video({ fichePage })).find((n) => n["@type"] === "FAQPage") as unknown as {
      "@id": string;
      mainEntity: Array<{
        "@type": string;
        name: string;
        acceptedAnswer: { "@type": string; text: string };
      }>;
    };
    expect(faq["@id"]).toBe(`${SITE}/fr/videos/ma-video#faq`);
    expect(faq.mainEntity).toHaveLength(3);
    expect(faq.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Question 1 ?",
      acceptedAnswer: { "@type": "Answer", text: "Réponse 1 complète." },
    });
  });

  it("sans fiche : repli sur les questions de la vidéo ; aucune question → aucun FAQPage", () => {
    const avec = graphe(video({ questions: [{ question: "Q ?", reponse: "R." }] }));
    expect(avec.some((n) => n["@type"] === "FAQPage")).toBe(true);
    expect(graphe(video()).some((n) => n["@type"] === "FAQPage")).toBe(false);
  });
});

describe("ImageObject", () => {
  it("un par image du carrousel + l'infographie, URL absolues, légende = texte alternatif", () => {
    const images = graphe(video({ fichePage })).filter((n) => n["@type"] === "ImageObject");
    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({
      contentUrl: `${SITE}${BASE}/carrousel-1.avif`,
      caption: "Première image du carrousel",
      width: 1080,
      height: 1350,
    });
    expect(images[1]).toMatchObject({ contentUrl: `${SITE}${BASE}/infographie.avif` });
    for (const i of images)
      expect(i["@id"]).toMatch(new RegExp(`^${SITE}/fr/videos/ma-video#image-`));
  });

  it("sans fiche ou sans images : aucun ImageObject", () => {
    expect(graphe(video()).some((n) => n["@type"] === "ImageObject")).toBe(false);
    expect(
      graphe(
        video({ fichePage: { ...fichePage, carrousel: undefined, infographie: undefined } }),
      ).some((n) => n["@type"] === "ImageObject"),
    ).toBe(false);
  });
});

describe("graphe complet", () => {
  it("VideoObject, ImageObject, FAQPage et BreadcrumbList ; JSON sérialisable, identifiants uniques", () => {
    const g = graphe(video({ fichePage }));
    expect(new Set(g.map((n) => n["@type"]))).toEqual(
      new Set(["VideoObject", "ImageObject", "FAQPage", "BreadcrumbList"]),
    );
    const ids = g.map((n) => n["@id"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => JSON.parse(JSON.stringify(g))).not.toThrow();
    expect(JSON.stringify(g)).not.toContain("embedUrl");
  });
});
