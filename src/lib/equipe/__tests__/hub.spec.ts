import { describe, expect, it } from "vitest";
import { fichesSitemapEquipe, fichesCarteDepuisPoints, construireHubEquipe } from "../hub";
import type { MembrePublic } from "../depuis-membre";
import type { PointCarteMembre } from "../collaborateurs";

const membre = (p: Partial<MembrePublic> & { slug: string }): MembrePublic => ({
  category: "developpeur",
  firstName: p.slug.charAt(0).toUpperCase() + p.slug.slice(1),
  organizationName: null,
  jobTitle: "Développeuse",
  headline: "Elle construit des outils pour les TPE.",
  bioMd: null,
  skills: [],
  languages: [],
  categoryAnswers: null,
  questionnaireVersion: null,
  linkedinUrl: null,
  websiteUrl: null,
  citySlug: null,
  departmentCode: null,
  locationLabel: null,
  latitude: null,
  longitude: null,
  showOnMap: false,
  photoKind: "avatar",
  photoUrl256: null,
  photoUrl1024: null,
  photoAlt: null,
  photoConsentAt: null,
  linkedinConsentAt: null,
  publishedAt: new Date("2026-11-01"),
  updatedAt: new Date("2026-11-02"),
  ...p,
});

const point = (p: Partial<PointCarteMembre> & { slug: string }): PointCarteMembre => ({
  firstName: p.slug.charAt(0).toUpperCase() + p.slug.slice(1),
  category: "developpeur",
  locationLabel: "Lyon",
  departmentCode: "69",
  latitude: 45.7,
  longitude: 4.8,
  ...p,
});

describe("hub en stub (aucun collaborateur)", () => {
  it("Williams seul, en tête de Direction, sans point", () => {
    const h = construireHubEquipe([], []);
    expect(h.sections.map((s) => s.categorie.id)).toEqual(["direction"]);
    expect(h.sections[0]?.fiches.map((f) => f.slug)).toEqual(["williams"]);
    expect(h.fichesCarte).toEqual([]);
    expect(h.indexables.map((i) => i.slug)).toEqual(["williams"]);
  });
});

describe("hub avec collaborateurs", () => {
  it("Williams d'abord dans Direction ; catégorie vide absente ; prénom seul", () => {
    const h = construireHubEquipe(
      [
        membre({ slug: "camille" }),
        membre({ slug: "lea", category: "direction" }),
        membre({ slug: "noe", category: "apporteur" }),
      ],
      [],
    );
    expect(h.sections.map((s) => s.categorie.id)).toEqual([
      "direction",
      "developpeur",
      "apporteur",
    ]);
    expect(h.sections[0]?.fiches.map((f) => f.slug)).toEqual(["williams", "lea"]);
    expect(h.total).toBe(4);
  });

  it("une fiche noindex est visible sur le hub mais absente du JSON-LD", () => {
    const h = construireHubEquipe([membre({ slug: "camille" })], []);
    expect(h.sections.flatMap((s) => s.fiches).map((f) => f.slug)).toContain("camille");
    expect(h.indexables.map((i) => i.slug)).toEqual(["williams"]);
  });
});

describe("points de carte", () => {
  it("sans lieu : écarté ; avec département : placé dans la couleur de sa catégorie", () => {
    const f = fichesCarteDepuisPoints([
      point({ slug: "camille" }),
      point({ slug: "paul", departmentCode: null, locationLabel: null }),
      point({
        slug: "ines",
        category: "specialiste_ia",
        departmentCode: "31",
        locationLabel: "Toulouse",
      }),
    ]);
    expect(f.map((x) => x.slug)).toEqual(["camille", "ines"]);
    expect(f.map((x) => x.categorie)).toEqual(["developpeur", "specialiste-ia"]);
    expect(f.every((x) => x.afficherSurCarte)).toBe(true);
  });

  it("la ligne facultative « williams » ne porte que le lieu", () => {
    const f = fichesCarteDepuisPoints([
      point({ slug: "williams", category: "direction", firstName: "Intrus" }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.estDirigeantPrincipal).toBe(true);
    expect(f[0]?.departement).toBe("69");
    expect(f[0]?.nom).toBe("Williams Jullin");
    expect(JSON.stringify(f[0])).not.toMatch(/Intrus/);
  });
});

describe("sitemap", () => {
  it("seules les fiches publiées ET indexables entrent ; jamais questionnaire ni retrait", () => {
    const riche = membre({
      slug: "riche",
      photoKind: "reelle",
      photoConsentAt: new Date("2026-10-01"),
      photoUrl256: "https://x/256.avif",
      photoUrl1024: "https://x/1024.avif",
      bioMd: "x".repeat(320),
      skills: ["a", "b", "c"],
      websiteUrl: "https://exemple.fr",
    });
    const pauvre = membre({ slug: "pauvre" });
    const slugRefuse = membre({ ...riche, slug: "Slug Invalide" });
    const reserves = [
      membre({ slug: "questionnaire", photoKind: "reelle" }),
      membre({ slug: "retrait" }),
    ];
    const s = fichesSitemapEquipe([riche, pauvre, slugRefuse, ...reserves]);
    expect(s.map((x) => x.slug)).toEqual(["riche"]);
  });
});
