// Tests d'invariants du catalogue calendrier /reserver (SSOT).
//
// Objectif : VERROUILLER le contrat entre `booking-catalog` et le reste du
// système, pour qu'aucune évolution future ne casse silencieusement la
// réservation. On ne teste pas chaque libellé (ça bouge), mais les règles dures :
//   - tout format `bookable` a un slug réservable valide (∈ INTERVENTION_SLUGS,
//     donc accepté par le server action + l'enum Prisma) ;
//   - tout format « sur devis » a un lien (hrefFr/hrefEn) — sinon carte morte ;
//   - 3 catégories visibles, slugs uniques, prix non vides.

import { describe, expect, it } from "vitest";
import {
  BOOKING_CATALOG,
  BOOKABLE_FORMATS,
  findBookableBySlug,
  findCategoryOfSlug,
} from "./booking-catalog";
import { INTERVENTION_SLUGS } from "@/lib/intervention-type";

const ALL_FORMATS = BOOKING_CATALOG.flatMap((c) => c.formats);
const BOOKABLE_SLUGS = new Set<string>(INTERVENTION_SLUGS);

describe("booking-catalog — structure", () => {
  it("expose exactement 3 catégories : formation / un-a-un / audit", () => {
    expect(BOOKING_CATALOG).toHaveLength(3);
    expect(BOOKING_CATALOG.map((c) => c.id)).toEqual(["formation", "un-a-un", "audit"]);
  });

  it("chaque catégorie a au moins un format", () => {
    for (const cat of BOOKING_CATALOG) {
      expect(cat.formats.length).toBeGreaterThan(0);
    }
  });

  it("tous les slugs de format sont uniques", () => {
    const slugs = ALL_FORMATS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("aucun libellé / prix vide", () => {
    for (const f of ALL_FORMATS) {
      expect(f.labelFr.length).toBeGreaterThan(0);
      expect(f.labelEn.length).toBeGreaterThan(0);
      expect(f.priceFr.length).toBeGreaterThan(0);
      expect(f.priceEn.length).toBeGreaterThan(0);
    }
  });
});

describe("booking-catalog — invariant réservabilité (anti-régression booking)", () => {
  it("tout format `bookable` a un slug ∈ INTERVENTION_SLUGS (accepté par le server action + enum Prisma)", () => {
    for (const f of BOOKABLE_FORMATS) {
      expect(
        BOOKABLE_SLUGS.has(f.slug),
        `Le format réservable "${f.slug}" doit exister dans INTERVENTION_SLUGS (sinon createBookingAction le rejette).`,
      ).toBe(true);
    }
  });

  it("tout format `bookable` a une durée 1 ou 2 jours", () => {
    for (const f of BOOKABLE_FORMATS) {
      expect([1, 2]).toContain(f.durationDays);
    }
  });

  it("tout format « sur devis » (non bookable) a un lien hrefFr + hrefEn", () => {
    const quoteFormats = ALL_FORMATS.filter((f) => !f.bookable);
    expect(quoteFormats.length).toBeGreaterThan(0);
    for (const f of quoteFormats) {
      expect(f.hrefFr, `"${f.slug}" sans hrefFr → carte sans destination`).toBeTruthy();
      expect(f.hrefEn, `"${f.slug}" sans hrefEn → carte sans destination`).toBeTruthy();
      expect(f.hrefFr!.startsWith("/")).toBe(true);
    }
  });

  it("BOOKABLE_FORMATS est non vide et ne contient que des formats bookable", () => {
    expect(BOOKABLE_FORMATS.length).toBeGreaterThan(0);
    expect(BOOKABLE_FORMATS.every((f) => f.bookable)).toBe(true);
  });
});

describe("booking-catalog — helpers", () => {
  it("findBookableBySlug retrouve un format réservable et ignore les `sur devis`", () => {
    // Refonte Formations V2 2026-06-11 — les 17 formations remplacent les anciens
    // collectifs. Une formation 1 jour est réservable ; une 3 jours est sur devis.
    expect(findBookableBySlug("ia-fondamentaux")?.slug).toBe("ia-fondamentaux");
    // `claude-architecte` (3 jours) existe mais n'est pas réservable (sur devis).
    expect(findBookableBySlug("claude-architecte")).toBeUndefined();
    // `dirigeant-vision-strategique` existe mais n'est pas réservable.
    expect(findBookableBySlug("dirigeant-vision-strategique")).toBeUndefined();
    expect(findBookableBySlug("inconnu-xyz")).toBeUndefined();
  });

  it("findCategoryOfSlug situe un slug (réservable ou non) dans sa catégorie", () => {
    expect(findCategoryOfSlug("ia-fondamentaux")).toBe("formation");
    expect(findCategoryOfSlug("claude-architecte")).toBe("formation");
    expect(findCategoryOfSlug("claude-dirigeant")).toBe("un-a-un");
    expect(findCategoryOfSlug("dirigeant-vision-strategique")).toBe("un-a-un");
    expect(findCategoryOfSlug("audit-flash-onsite")).toBe("audit");
    expect(findCategoryOfSlug("audit-cible")).toBe("audit");
    expect(findCategoryOfSlug("inconnu-xyz")).toBeUndefined();
  });
});
