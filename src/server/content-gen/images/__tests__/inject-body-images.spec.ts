import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock du provider Unsplash (pas d'appel réseau réel en test).
const generateMock = vi.fn();
vi.mock("../../providers/unsplash", () => ({
  unsplashProvider: { generate: (...args: unknown[]) => generateMock(...args) },
}));

import { injectBodyImages, __testInternals } from "../inject-body-images";

const { h2ToQuery, h2Offsets, buildFigure } = __testInternals;

function fakePhoto(id: string) {
  return {
    photoId: id,
    width: 1600,
    height: 1067,
    alt: "Bureau lumineux",
    downloadUrl: `https://images.unsplash.com/${id}`,
    hotlinkUrl: `https://images.unsplash.com/${id}`,
    attribution: {
      source: "unsplash" as const,
      photoId: id,
      photographer: "Jane Doe",
      photographerUrl: "https://unsplash.com/@jane?utm_source=axion-ia&utm_medium=referral",
      photoUrl: `https://unsplash.com/photos/${id}?utm_source=axion-ia&utm_medium=referral`,
      photoCredit: "Photo de Jane Doe sur Unsplash",
      downloadTriggeredAt: "2026-06-22T00:00:00.000Z",
    },
  };
}

const BODY_3H2 =
  "<h2>Introduction</h2><p>Texte un.</p>" +
  "<h2>Pourquoi automatiser ses process</h2><p>Texte deux.</p>" +
  "<h2>Mettre en oeuvre la solution</h2><p>Texte trois.</p>" +
  "<h2>Conclusion pratique</h2><p>Texte quatre.</p>";

describe("inject-body-images", () => {
  const OLD = process.env.UNSPLASH_ACCESS_KEY;
  beforeEach(() => {
    generateMock.mockReset();
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
  });
  afterEach(() => {
    if (OLD === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
    else process.env.UNSPLASH_ACCESS_KEY = OLD;
  });

  it("retourne le corps inchangé sans clé Unsplash", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    const out = await injectBodyImages(BODY_3H2, { jobId: "j", contentType: "blog_article" });
    expect(out).toBe(BODY_3H2);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("retourne le corps inchangé si moins de 2 H2", async () => {
    const body = "<h2>Seul titre</h2><p>texte</p>";
    const out = await injectBodyImages(body, { jobId: "j", contentType: "blog_article" });
    expect(out).toBe(body);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("injecte des <figure> Unsplash avec attribution devant les sections (pas la 1re)", async () => {
    let n = 0;
    generateMock.mockImplementation(async () => ({ output: JSON.stringify(fakePhoto(`p${n++}`)) }));
    const out = await injectBodyImages(BODY_3H2, {
      jobId: "j",
      contentType: "blog_article",
      maxImages: 2,
    });
    expect(out).not.toBe(BODY_3H2);
    expect(out).toContain("<figure>");
    expect(out).toContain('loading="lazy"');
    expect(out).toContain("Photo de <a");
    expect(out).toContain('sur <a href="https://unsplash.com/?utm_source=axion-ia');
    // 2 images demandées, 2 photos distinctes mockées.
    expect((out.match(/<figure>/g) ?? []).length).toBe(2);
    // La 1re section (Introduction) n'est pas illustrée : la 1re figure suit le 1er <h2>.
    expect(out.indexOf("<figure>")).toBeGreaterThan(out.indexOf("<h2>Introduction</h2>"));
  });

  it("best-effort : aucune image si le provider échoue toujours", async () => {
    generateMock.mockRejectedValue(new Error("rate limited"));
    const out = await injectBodyImages(BODY_3H2, { jobId: "j", contentType: "blog_article" });
    expect(out).toBe(BODY_3H2);
  });

  it("ne duplique pas une même photo", async () => {
    generateMock.mockResolvedValue({ output: JSON.stringify(fakePhoto("same")) });
    const out = await injectBodyImages(BODY_3H2, {
      jobId: "j",
      contentType: "blog_article",
      maxImages: 2,
    });
    expect((out.match(/<figure>/g) ?? []).length).toBe(1);
  });

  it("h2ToQuery nettoie titre, accents et mots vides", () => {
    expect(h2ToQuery("Pourquoi l'IA pour les PME ?")).toBe("pourquoi ia");
    expect(h2ToQuery("<strong>Données</strong> sensibles")).toBe("donnees sensibles");
    expect(h2ToQuery("le", "intelligence artificielle")).toBe("intelligence artificielle");
  });

  it("h2Offsets compte les balises h2", () => {
    expect(h2Offsets(BODY_3H2)).toHaveLength(4);
  });

  it("buildFigure échappe le nom du photographe", () => {
    const fig = buildFigure({
      ...fakePhoto("x"),
      attribution: { ...fakePhoto("x").attribution, photographer: 'A<b>"&' },
    });
    expect(fig).toContain("A&lt;b&gt;&quot;&amp;");
    expect(fig).not.toContain('A<b>"&</a>');
  });
});
