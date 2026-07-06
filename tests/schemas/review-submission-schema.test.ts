// Tests Zod du formulaire de dépôt d'avis (/avis/deposer).
// Emplacement imposé par `pnpm zod:check` (tests/schemas/<schema>.test.ts).

import { describe, it, expect } from "vitest";
import {
  reviewSubmissionSchema,
  deriveLastInitial,
  REVIEW_COMMENT_MIN,
} from "@/lib/schemas/review-submission-schema";

const validInput = {
  firstName: "Marie",
  lastName: "Dupont",
  email: "marie@example.com",
  rating: "5",
  comment: "x".repeat(REVIEW_COMMENT_MIN),
  photoKind: "portrait",
};

describe("reviewSubmissionSchema", () => {
  it("accepte un avis valide", () => {
    expect(reviewSubmissionSchema.safeParse(validInput).success).toBe(true);
  });

  it("refuse un commentaire trop court (anti-thin)", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, comment: "trop court" }).success).toBe(
      false,
    );
  });

  it("refuse une note hors [1,5]", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, rating: "0" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...validInput, rating: "6" }).success).toBe(false);
  });

  it("refuse un email invalide", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, email: "nope" }).success).toBe(false);
  });

  it("refuse un serviceLine inconnu, accepte un valide", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validInput, serviceLine: "audits" }).success).toBe(
      true,
    );
    expect(
      reviewSubmissionSchema.safeParse({ ...validInput, serviceLine: "inexistant" }).success,
    ).toBe(false);
  });

  it("normalise photoKind (défaut portrait)", () => {
    expect(reviewSubmissionSchema.parse({ ...validInput, photoKind: "" }).photoKind).toBe(
      "portrait",
    );
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
