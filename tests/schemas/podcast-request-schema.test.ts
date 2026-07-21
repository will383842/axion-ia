// Tests Zod du formulaire de demande de tournage podcast (/podcast).
// Emplacement imposé par `pnpm zod:check` (tests/schemas/<schema>.test.ts).

import { describe, it, expect } from "vitest";
import {
  podcastRequestSchema,
  PODCAST_ACTIVITY_MIN,
  PODCAST_ACTIVITY_MAX,
} from "@/lib/schemas/podcast-request-schema";

const validInput = {
  companyName: "Boulangerie Martin",
  leaderName: "Claire Martin",
  email: "claire@boulangerie-martin.fr",
  phone: "06 12 34 56 78",
  city: "Grenoble",
  postalCode: "38000",
  activity: "Boulangerie artisanale, 12 salariés, deux points de vente en centre-ville.",
};

describe("podcastRequestSchema", () => {
  it("accepte une demande valide", () => {
    expect(podcastRequestSchema.safeParse(validInput).success).toBe(true);
  });

  it("trim les champs texte", () => {
    const parsed = podcastRequestSchema.parse({ ...validInput, city: "  Lyon  " });
    expect(parsed.city).toBe("Lyon");
  });

  it("refuse un email invalide", () => {
    expect(podcastRequestSchema.safeParse({ ...validInput, email: "nope" }).success).toBe(false);
  });

  it("refuse un téléphone non numérique", () => {
    expect(podcastRequestSchema.safeParse({ ...validInput, phone: "appelez-moi" }).success).toBe(
      false,
    );
  });

  it("accepte les formats de téléphone usuels (international, séparateurs)", () => {
    for (const phone of ["+33 6 12 34 56 78", "0612345678", "04.76.00.00.00", "(0) 612345678"]) {
      expect(podcastRequestSchema.safeParse({ ...validInput, phone }).success).toBe(true);
    }
  });

  it("exige ville ET code postal (on se déplace sur site)", () => {
    expect(podcastRequestSchema.safeParse({ ...validInput, city: "" }).success).toBe(false);
    expect(podcastRequestSchema.safeParse({ ...validInput, postalCode: "" }).success).toBe(false);
  });

  it("refuse un code postal fantaisiste", () => {
    expect(podcastRequestSchema.safeParse({ ...validInput, postalCode: "!!" }).success).toBe(false);
  });

  it("borne la description d'activité", () => {
    expect(
      podcastRequestSchema.safeParse({
        ...validInput,
        activity: "x".repeat(PODCAST_ACTIVITY_MIN - 1),
      }).success,
    ).toBe(false);
    expect(
      podcastRequestSchema.safeParse({
        ...validInput,
        activity: "x".repeat(PODCAST_ACTIVITY_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("refuse une raison sociale vide", () => {
    expect(podcastRequestSchema.safeParse({ ...validInput, companyName: "" }).success).toBe(false);
  });
});
