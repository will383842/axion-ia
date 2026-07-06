import { describe, it, expect } from "vitest";
import {
  reviewSubmissionSchema,
  deriveLastInitial,
  REVIEW_COMMENT_MIN,
} from "@/lib/schemas/review-submission-schema";
import { slugifyToken, buildReviewSlugBase, buildReviewSlug } from "@/lib/reviews/slug";
import { hashSeed, avatarStyle } from "@/lib/reviews/avatar";
import {
  SERVICE_LINES,
  SERVICE_LINE_VALUES,
  getServiceLine,
  isServiceLine,
  serviceLineLabel,
} from "@/lib/reviews/service-lines";
import { AGGREGATE_MIN_COUNT, FACET_MIN_COUNT, RATING_BEST } from "@/lib/reviews/config";

const validInput = {
  firstName: "Marie",
  lastName: "Dupont",
  email: "marie@example.com",
  rating: "5",
  comment: "x".repeat(REVIEW_COMMENT_MIN),
  photoKind: "portrait",
};

describe("review-submission-schema", () => {
  it("accepte un avis valide", () => {
    const r = reviewSubmissionSchema.safeParse(validInput);
    expect(r.success).toBe(true);
  });

  it("refuse un commentaire trop court (anti-thin)", () => {
    const r = reviewSubmissionSchema.safeParse({ ...validInput, comment: "trop court" });
    expect(r.success).toBe(false);
  });

  it("refuse une note hors [1,5]", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, rating: "0" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...validInput, rating: "6" }).success).toBe(false);
  });

  it("refuse un email invalide", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, email: "nope" }).success).toBe(false);
  });

  it("refuse un serviceLine inconnu mais accepte un valide", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, serviceLine: "audits" }).success).toBe(
      true,
    );
    expect(
      reviewSubmissionSchema.safeParse({ ...validInput, serviceLine: "inexistant" }).success,
    ).toBe(false);
  });

  it("normalise photoKind vers portrait par défaut", () => {
    const r = reviewSubmissionSchema.parse({ ...validInput, photoKind: "" });
    expect(r.photoKind).toBe("portrait");
    expect(reviewSubmissionSchema.parse({ ...validInput, photoKind: "logo" }).photoKind).toBe(
      "logo",
    );
  });
});

describe("deriveLastInitial", () => {
  it("dérive l'initiale majuscule + point", () => {
    expect(deriveLastInitial("Dupont")).toBe("D.");
    expect(deriveLastInitial("  martin ")).toBe("M.");
  });
});

describe("slug", () => {
  it("slugifie en ASCII kebab (accents retirés)", () => {
    expect(slugifyToken("Éléonore Château")).toBe("eleonore-chateau");
    expect(slugifyToken("A/B & C!")).toBe("a-b-c");
  });

  it("construit une base déterministe", () => {
    const base = buildReviewSlugBase({
      firstName: "Marie",
      lastInitial: "D.",
      company: "Cabinet Dupont",
      city: "Lyon",
    });
    expect(base).toBe("marie-d-cabinet-dupont-lyon");
  });

  it("retombe sur 'avis' si tout est vide", () => {
    expect(buildReviewSlugBase({ firstName: "", lastInitial: "" })).toBe("avis");
  });

  it("assemble base + suffixe et borne à 200 car.", () => {
    expect(buildReviewSlug("marie-d", "a1b2c3")).toBe("marie-d-a1b2c3");
    expect(buildReviewSlug("x".repeat(250), "abc").length).toBeLessThanOrEqual(200);
  });
});

describe("avatar", () => {
  it("hashSeed est déterministe et stable", () => {
    expect(hashSeed("Cabinet Dupont")).toBe(hashSeed("Cabinet Dupont"));
    expect(hashSeed("A")).not.toBe(hashSeed("B"));
  });

  it("avatarStyle renvoie des couleurs de marque + rotation bornée", () => {
    const s = avatarStyle("Cabinet Dupont");
    expect(s.from).toMatch(/^#[0-9a-f]{6}$/i);
    expect(s.rotation).toBeGreaterThanOrEqual(0);
    expect(s.rotation).toBeLessThan(360);
    // déterministe
    expect(avatarStyle("Cabinet Dupont")).toEqual(s);
  });
});

describe("service-lines SSOT", () => {
  it("expose les 5 services", () => {
    expect(SERVICE_LINES).toHaveLength(5);
    expect(SERVICE_LINE_VALUES).toContain("audits");
  });

  it("Course/Product pour les services éligibles aux étoiles Google", () => {
    expect(getServiceLine("interventions_formations")?.itemType).toBe("Course");
    expect(getServiceLine("sites_web_augmentes")?.itemType).toBe("Product");
  });

  it("isServiceLine + label", () => {
    expect(isServiceLine("audits")).toBe(true);
    expect(isServiceLine("nope")).toBe(false);
    expect(serviceLineLabel("audits")).toBe("Audit IA");
  });
});

describe("config seuils", () => {
  it("seuils cohérents", () => {
    expect(AGGREGATE_MIN_COUNT).toBe(5);
    expect(FACET_MIN_COUNT).toBeGreaterThanOrEqual(1);
    expect(RATING_BEST).toBe(5);
  });
});
