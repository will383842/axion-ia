// @vitest-environment node
// Lot I0b-3, second tour (constat A) : le `matcher` du proxy ne doit laisser passer, hors
// de sa couverture, aucun chemin dont le premier segment est une locale connue.
import { describe, expect, it, vi } from "vitest";
import { config } from "../../proxy";
vi.mock("next-auth", () => ({ default: () => ({ auth: (h: unknown) => h }) }));
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));
import { routing } from "@/i18n/routing";

const UUID = "11111111-1111-4111-8111-111111111111";
const motif = new RegExp(`^${config.matcher[0]}$`);
const couvert = (chemin: string): boolean => motif.test(chemin);

describe("matcher du proxy et lecture plein écran", () => {
  it("(a) /fr|en/<préfixe>/emails/lecture/… est couvert", () => {
    for (const l of routing.locales) {
      expect(couvert(`/${l}/pfx-factice/emails/lecture/envoye/${UUID}`)).toBe(true);
      expect(couvert(`/${l}/pfx-factice/emails/lecture/gabarit/submission-reply`)).toBe(true);
    }
  });

  it("(a2) un id portant une extension (.json, .txt, .html) reste couvert par le proxy", () => {
    for (const l of routing.locales)
      for (const ext of ["json", "txt", "html"])
        expect(couvert(`/${l}/pfx-factice/emails/lecture/gabarit/x.${ext}`)).toBe(true);
  });

  it("(b) tout chemin non couvert de la forme /x/y/emails/lecture/a/b a un premier segment qui n'est pas une locale", () => {
    const premiers = [
      ...routing.locales,
      "api",
      "widget",
      "qr",
      "videos",
      "medias",
      "questionnaire",
      "guide-reseau",
      "document",
      "apporteur",
      "formateur",
      "maintenance",
      "sitemap",
      "favicon.ico",
      "opengraph-image",
      "twitter-image",
      "manifest.webmanifest",
      ".well-known",
      "_next",
      "icon",
      "apple-icon",
    ];
    const noncouverts = premiers.filter(
      (x) => !couvert(`/${x}/pfx-factice/emails/lecture/envoye/${UUID}`),
    );
    expect(noncouverts.length).toBeGreaterThan(5);
    for (const x of noncouverts) {
      expect(routing.locales as readonly string[]).not.toContain(x);
    }
  });
});
