// Le verdict d'envoi, extrait dans un module PUR — 2026-09-19.
//
// Ce qui est gardé ici :
//   - la table de vérité de `estSollicitationSoumiseAOpposition` : les deux
//     gabarits de sollicitation, et le kit du dossier commencé (même gabarit que
//     l'accusé, distingué par sa variante) ;
//   - la constante locale de variante reste ÉGALE à celle du kit, sans que le
//     module l'importe (le kit tire des chemins de page que le worker n'a pas à
//     charger) ;
//   - le module ne tire QUE la base et l'empreinte : c'est ce qui permet au
//     worker d'e-mails de l'importer sans charger `next-auth` ni `next/headers`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const oppositionFindUnique = vi.fn();
const abonneFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: (...a: unknown[]) => findFirst(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => abonneFindUnique(...a) },
    emailOpposition: { findUnique: (...a: unknown[]) => oppositionFindUnique(...a) },
  },
}));

import { VARIANTE_DOSSIER_COMMENCE } from "@/lib/commercial-application/kit-apporteur";
import {
  estSollicitationSoumiseAOpposition,
  verdictAvantEnvoi,
  VARIANTE_KIT_DIFFERE,
  GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION,
} from "./verdict-envoi";

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  oppositionFindUnique.mockReset().mockResolvedValue(null);
  abonneFindUnique.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("estSollicitationSoumiseAOpposition — table de vérité", () => {
  it.each<[string, Record<string, unknown> | null | undefined, boolean]>([
    ["lead-apporteur-relance", {}, true],
    ["lead-apporteur-relance", undefined, true],
    ["apporteur-invitation-appel", { calendlyUrl: "https://calendly.com/x/y" }, true],
    ["lead-apporteur-recu", { variante: "dossier-commence" }, true],
    // L'accusé immédiat d'une démarche n'est PAS une sollicitation.
    ["lead-apporteur-recu", {}, false],
    ["lead-apporteur-recu", { variante: "autre-chose" }, false],
    ["lead-apporteur-recu", null, false],
    ["lead-apporteur-recu", undefined, false],
    // La variante ne vaut que pour CE gabarit.
    ["candidature-commercial-confirmee", { variante: "dossier-commence" }, false],
    ["qualiopi-convocation", {}, false],
  ])("%s %j → %s", (gabarit, payload, attendu) => {
    expect(estSollicitationSoumiseAOpposition(gabarit, payload)).toBe(attendu);
  });

  it("la variante locale est celle du kit — sans que le module importe le kit", () => {
    expect(VARIANTE_KIT_DIFFERE).toBe(VARIANTE_DOSSIER_COMMENCE);
  });

  it("l'ensemble des sollicitations n'a pas bougé", () => {
    expect([...GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION].sort()).toEqual([
      "apporteur-invitation-appel",
      "lead-apporteur-relance",
    ]);
  });
});

describe("verdictAvantEnvoi — drapeau `sollicitation` explicite", () => {
  it("🔴 un gabarit hors ensemble, marqué sollicitation, honore l'opposition", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-recu",
      marketing: false,
      sollicitation: true,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });

  it("sans le drapeau, l'accusé d'une démarche n'est pas retenu par l'opposition", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-recu",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
    expect(oppositionFindUnique).not.toHaveBeenCalled();
  });

  it("`sollicitation: false` explicite l'emporte sur l'ensemble", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-relance",
      marketing: false,
      sollicitation: false,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("en l'absence du drapeau, l'ensemble décide (appelants existants inchangés)", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-relance",
      marketing: false,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });
});

describe("module pur — seuls la base et l'empreinte", () => {
  it("n'importe que `@/lib/prisma` et `@/lib/security/email-hash`", () => {
    const source = readFileSync(join(__dirname, "verdict-envoi.ts"), "utf8");
    const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const specs = [
      ...sansCommentaires.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...sansCommentaires.matchAll(/\bimport\s+["']([^"']+)["']/g),
      ...sansCommentaires.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    expect([...new Set(specs)].sort()).toEqual(["@/lib/prisma", "@/lib/security/email-hash"]);
  });
});
