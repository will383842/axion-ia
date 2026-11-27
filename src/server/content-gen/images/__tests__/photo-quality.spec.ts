import { describe, it, expect, afterEach } from "vitest";
import {
  buildTopic,
  imageQualityEnabled,
  isPhotoEligible,
  photoKeyFromUrl,
  photoKeysFromHtml,
  rankPhotos,
  relevanceScore,
  type CandidatePhoto,
} from "../photo-quality";

function photo(over: Partial<CandidatePhoto> & { id: string }): CandidatePhoto {
  return {
    width: 3000,
    height: 2000,
    likes: 10,
    alt_description: "a team of people in a business meeting",
    urls: { regular: `https://images.unsplash.com/photo-${over.id}-abc?ixid=1` },
    ...over,
  };
}

describe("interrupteur CONTENT_IMAGES_QUALITE", () => {
  const OLD = process.env["CONTENT_IMAGES_QUALITE"];
  afterEach(() => {
    if (OLD === undefined) delete process.env["CONTENT_IMAGES_QUALITE"];
    else process.env["CONTENT_IMAGES_QUALITE"] = OLD;
  });
  it('actif par défaut et pour toute valeur sauf "false"', () => {
    delete process.env["CONTENT_IMAGES_QUALITE"];
    expect(imageQualityEnabled()).toBe(true);
    for (const v of ["true", "FALSE", "0", "", "off"]) {
      process.env["CONTENT_IMAGES_QUALITE"] = v;
      expect(imageQualityEnabled()).toBe(true);
    }
  });
  it('seule la valeur exacte "false" le coupe', () => {
    process.env["CONTENT_IMAGES_QUALITE"] = "false";
    expect(imageQualityEnabled()).toBe(false);
  });
});

describe("clé de photo", () => {
  it("extrait photo-<ts>-<hash> d'une URL et du HTML", () => {
    expect(photoKeyFromUrl("https://images.unsplash.com/photo-1-ab?ixid=x")).toBe("photo-1-ab");
    expect(photoKeyFromUrl("https://images.unsplash.com/premium_photo-9-z?q=1")).toBe(
      "premium_photo-9-z",
    );
    expect(photoKeyFromUrl("/image-bank/x.webp")).toBeNull();
    const html =
      '<img src="https://images.unsplash.com/photo-1-ab?x"><img src="https://images.unsplash.com/photo-2-cd">';
    expect(photoKeysFromHtml(html)).toEqual(["photo-1-ab", "photo-2-cd"]);
  });
});

describe("termes multi-mots", () => {
  it("« immobilier » retrouve « real estate »", () => {
    const { terms } = buildTopic("immobilier");
    expect(relevanceScore(photo({ id: "r", alt_description: "a real estate agent" }), terms)).toBe(
      1,
    );
  });
});

describe("éligibilité", () => {
  it("accepte une grande photo paysage", () => {
    expect(isPhotoEligible(photo({ id: "a" }))).toBe(true);
  });
  it("écarte < 1600 px de large", () => {
    expect(isPhotoEligible(photo({ id: "a", width: 1599, height: 900 }))).toBe(false);
  });
  it("écarte portrait et quasi carré", () => {
    expect(isPhotoEligible(photo({ id: "a", width: 2000, height: 3000 }))).toBe(false);
    expect(isPhotoEligible(photo({ id: "a", width: 2000, height: 1900 }))).toBe(false);
  });
  it.each([
    "a screenshot of a website",
    "text on a white wall",
    "a company logo on a sign",
    "laptop mockup on a desk",
  ])("écarte capture / texte / logo / maquette : %s", (alt) => {
    expect(isPhotoEligible(photo({ id: "a", alt_description: alt }))).toBe(false);
  });
});

describe("pertinence", () => {
  const { terms } = buildTopic("formation ia juridique");
  it("traduit la requête en anglais", () => {
    expect(buildTopic("formation ia").query).toBe("training ai");
  });
  it("note haut une photo sur le sujet, bas une photo hors sujet", () => {
    const on = photo({ id: "a", alt_description: "lawyer in training with a robot" });
    const off = photo({ id: "b", alt_description: "a dog running on the beach" });
    expect(relevanceScore(on, terms)).toBeGreaterThan(0.5);
    expect(relevanceScore(off, terms)).toBe(0);
  });
  it("sans description → pertinence 0 (refus)", () => {
    expect(relevanceScore(photo({ id: "a", alt_description: null }), terms)).toBe(0);
  });
  it("rankPhotos : retire le hors sujet, à pertinence égale préfère les likes", () => {
    const a = photo({ id: "a", likes: 5, alt_description: "business meeting" });
    const b = photo({ id: "b", likes: 500, alt_description: "business meeting" });
    const c = photo({ id: "c", likes: 9999, alt_description: "dog on beach" });
    const ranked = rankPhotos([a, b, c], buildTopic("entreprise").terms);
    expect(ranked.map((r) => r.photo.id)).toEqual(["b", "a"]);
  });
});
