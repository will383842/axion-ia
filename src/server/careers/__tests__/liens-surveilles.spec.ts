import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { etat: string; mortDepuis: Date | null; httpStatus: number | null };
const table = new Map<string, Ligne>();
let tableAbsente = false;
const candidatures: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationLink: {
      count: async () => {
        if (tableAbsente) throw Object.assign(new Error("absente"), { code: "P2021" });
        return table.size;
      },
      findUnique: async (a: { where: { applicationId_url: { url: string } } }) =>
        table.get(a.where.applicationId_url.url) ?? null,
      upsert: async (a: {
        where: { applicationId_url: { url: string } };
        create: Ligne;
        update: Partial<Ligne>;
      }) => {
        const k = a.where.applicationId_url.url;
        const avant = table.get(k);
        table.set(k, avant ? { ...avant, ...a.update } : a.create);
      },
    },
    jobApplication: { findMany: async () => candidatures },
  },
}));

import { etatDepuisStatut, urlOembed } from "@/lib/careers/liens-video";
import { etatDuLien, surveillerLiens } from "../liens-surveilles";

const LUNDI = new Date("2026-10-05T05:45:00Z");
const SEMAINE_SUIVANTE = new Date("2026-10-12T05:45:00Z");
const candidat = (texte: string) => ({
  id: "app-1",
  answers: { exemples_vertical: texte },
  motivation: null,
  linkedinUrl: null,
  events: [],
});

beforeEach(() => {
  table.clear();
  tableAbsente = false;
  candidatures.length = 0;
});

describe("règle d'état — jamais « mort » sur une panne", () => {
  it.each([
    [200, false, "vivant"],
    [301, false, "vivant"],
    [404, false, "mort"],
    [410, false, "mort"],
    [400, true, "mort"],
    [400, false, "inverifiable"],
    [401, true, "inverifiable"],
    [403, false, "inverifiable"],
    [429, false, "inverifiable"],
    [503, false, "inverifiable"],
    [null, false, "inverifiable"],
  ] as const)("statut %s (oEmbed %s) → %s", (statut, oembed, attendu) => {
    expect(etatDepuisStatut(statut, oembed)).toBe(attendu);
  });

  it("YouTube passe par l'oEmbed : une page YouTube répond 200 même vidéo retirée", () => {
    expect(urlOembed("https://youtu.be/abc")).toMatch(/^https:\/\/www\.youtube\.com\/oembed/);
    expect(urlOembed("https://drive.google.com/x")).toBeNull();
  });

  it("Instagram n'est jamais appelé : derrière une connexion, on ne sait pas", async () => {
    const appeler = vi.fn(async () => 200);
    expect(await etatDuLien("https://www.instagram.com/reel/x", appeler)).toEqual({
      etat: "inverifiable",
      statut: null,
    });
    expect(appeler).not.toHaveBeenCalled();
  });
});

describe("passage du lundi", () => {
  it("🔴 table absente (fenêtre app/worker) : il s'abstient, sans lever", async () => {
    tableAbsente = true;
    expect(await surveillerLiens(LUNDI, async () => 200)).toMatchObject({ abstenu: true });
  });

  it("un lien mort garde sa PREMIÈRE date de mort ; il revit → la date s'efface", async () => {
    candidatures.push(candidat("https://drive.google.com/drive/folders/X"));
    await surveillerLiens(LUNDI, async () => 404);
    await surveillerLiens(SEMAINE_SUIVANTE, async () => 404);
    expect(table.get("https://drive.google.com/drive/folders/X")).toMatchObject({
      etat: "mort",
      mortDepuis: LUNDI,
    });
    await surveillerLiens(new Date("2026-10-19T05:45:00Z"), async () => 200);
    expect(table.get("https://drive.google.com/drive/folders/X")).toMatchObject({
      etat: "vivant",
      mortDepuis: null,
    });
  });

  it("🔴 une panne après une mort constatée ne l'efface pas", async () => {
    candidatures.push(candidat("https://moi.framer.app"));
    await surveillerLiens(LUNDI, async () => 404);
    await surveillerLiens(SEMAINE_SUIVANTE, async () => null);
    expect(table.get("https://moi.framer.app")).toMatchObject({ etat: "mort", mortDepuis: LUNDI });
  });
});
