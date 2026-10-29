// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { tourDemande: { findUnique: m.findUnique } } }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
  encryptPii: (v: string) => `enc:${v}`,
}));

import { creerJeton, verifierJeton } from "@/features/commercial-application/jeton-lead";
import { jetonVslValide } from "@/features/commercial-application/identite-reservation-vsl";
import type { QuestionEventType } from "@/server/calendly/questions";
import { creerJetonDemande } from "../jeton-demande";
import { champVilleDuTour, identiteDuJetonTour } from "../identite-visio";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f";
const demande = (extra: Record<string, unknown> = {}) => ({
  nom: "enc:Claire Martin",
  email: "enc:claire@exemple.fr",
  telephone: "enc:06 12 34 56 78",
  villeSaisie: "lyon 3",
  villeNom: "Lyon",
  statut: "recue",
  ...extra,
});

beforeEach(() => {
  m.findUnique.mockReset();
});

describe("préremplir la visio du Tour", () => {
  it("un jeton du Tour valide rend nom, e-mail, téléphone et ville", async () => {
    m.findUnique.mockResolvedValue(demande());
    expect(await identiteDuJetonTour(creerJetonDemande(ID))).toEqual({
      nom: "Claire Martin",
      email: "claire@exemple.fr",
      telephone: "06 12 34 56 78",
      ville: "Lyon",
    });
    expect(m.findUnique.mock.calls[0]?.[0]).toMatchObject({ where: { id: ID } });
  });

  it("hors référentiel : la ville est celle que la personne a tapée", async () => {
    m.findUnique.mockResolvedValue(demande({ villeNom: null, villeSaisie: "Annecy" }));
    expect((await identiteDuJetonTour(creerJetonDemande(ID)))?.ville).toBe("Annecy");
  });

  it("un jeton de la page vidéo (apporteurs) ne se lit pas ici : formulaire vide", async () => {
    const vsl = creerJeton({ lead: ID });
    expect(await identiteDuJetonTour(vsl)).toBeNull();
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it("un jeton du Tour ne se lit pas sur le parcours apporteur", () => {
    const tour = creerJetonDemande(ID);
    expect(verifierJeton(tour)).toBeNull();
    expect(jetonVslValide(tour)).toBeNull();
  });

  it.each([undefined, "", "n'importe quoi", ["a", "b"], 42])(
    "jeton absent ou faux (%j) : null, jamais d'erreur",
    async (j) => {
      expect(await identiteDuJetonTour(j)).toBeNull();
    },
  );

  it("jeton expiré : null", async () => {
    expect(
      await identiteDuJetonTour(creerJetonDemande(ID, Date.now() - 31 * 60 * 1000)),
    ).toBeNull();
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it("demande effacée, introuvable, ou base en panne : null", async () => {
    m.findUnique.mockResolvedValueOnce(demande({ statut: "effacee_rgpd" }));
    expect(await identiteDuJetonTour(creerJetonDemande(ID))).toBeNull();
    m.findUnique.mockResolvedValueOnce(null);
    expect(await identiteDuJetonTour(creerJetonDemande(ID))).toBeNull();
    m.findUnique.mockRejectedValueOnce(new Error("base injoignable"));
    expect(await identiteDuJetonTour(creerJetonDemande(ID))).toBeNull();
  });

  it("une valeur illisible n'est jamais proposée", async () => {
    m.findUnique.mockResolvedValue(demande({ telephone: "illisible" }));
    expect((await identiteDuJetonTour(creerJetonDemande(ID)))?.telephone).toBe("");
  });
});

describe("la question « ville » de la visio", () => {
  const q = (libelle: string, position: number, type: QuestionEventType["type"] = "string") =>
    ({
      libelle,
      type,
      position,
      requise: true,
      choix: [],
      autreAutorise: false,
      champ: `q${position}`,
    }) as QuestionEventType;

  it("repère « Ville de votre entreprise » et ignore les autres", () => {
    expect(
      champVilleDuTour([q("Votre besoin", 0, "text"), q("Ville de votre entreprise", 1)]),
    ).toBe("q1");
    expect(champVilleDuTour([q("Votre besoin", 0)])).toBeNull();
    expect(champVilleDuTour([q("Ville", 0, "single_select")])).toBeNull();
  });
});

describe("le câblage des pages", () => {
  const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it("le formulaire ne lit le jeton du Tour que pour le choix tour", () => {
    const page = lire("src/app/[locale]/appel/reserver/page.tsx");
    expect(page).toMatch(/choix === "tour" \? await identiteDuJetonTour\(/);
    expect(page).toContain("champVilleDuTour(et.questions)");
  });

  it("le calendrier ne recopie le jeton du Tour que pour le choix tour", () => {
    const page = lire("src/app/[locale]/appel/page.tsx");
    expect(page).toMatch(/choix === "tour" && lireJetonDemande\(/);
    expect(page).toContain("jetonApporteur ?? jetonFormateur ?? jetonTour");
  });
});
