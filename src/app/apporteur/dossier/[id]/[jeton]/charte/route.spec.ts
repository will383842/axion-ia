// La charte de marque n'est servie QU'À un apporteur sous contrat signé, par son lien
// personnel ; jamais indexée, jamais en cache partagé ; et elle n'existe plus dans `public/`.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ dossier: null as Record<string, unknown> | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { GET } from "./route";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const appel = (id = ID) =>
  GET(new Request("https://axion-ia.com/x"), {
    params: Promise.resolve({ id, jeton: "jeton-valide" }),
  });
const signe = { id: ID, prenom: "Marie", nom: "Dupont", restreint: false, statut: "signe" };

beforeEach(() => {
  h.dossier = { ...signe };
});

describe("la charte de marque est réservée aux apporteurs signés", () => {
  it("apporteur signé : la charte, en HTML, privée et non indexée", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.headers.get("cache-control")).toContain("no-store");
    const html = await r.text();
    expect(html).toContain("Charte");
    expect(html).toContain("Format carré");
    expect(html).not.toContain("Avatar");
  });

  it.each([
    ["lien invalide", { dossier: null }, ID],
    ["dossier pas encore signé", { dossier: { ...signe, statut: "a_verifier" } }, ID],
    ["fiche retirée", { dossier: { ...signe, restreint: true } }, ID],
    ["lien d'exemple", { dossier: { ...signe } }, ID_DOSSIER_EXEMPLE],
  ] as const)("%s : 404 neutre, rien de la charte", async (_c, etat, id) => {
    h.dossier = etat.dossier as Record<string, unknown> | null;
    const r = await appel(id);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("Charte");
  });

  it("aucune copie publique de la charte dans public/", () => {
    expect(existsSync(join(process.cwd(), "public/documents/apporteurs/charte-de-marque"))).toBe(false);
  });
});
