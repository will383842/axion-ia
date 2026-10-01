// @vitest-environment node

/**
 * R6 (suite) — L'ACTION VÉRIFIE LA TAILLE ANNONCÉE AVANT DE LIRE LE FICHIER.
 *
 * Un fichier de 23 Mo ne doit pas être chargé en mémoire pour apprendre qu'il
 * est trop gros : `ajouterDocumentFormAction` lit `File.size` d'abord, et ne
 * touche `arrayBuffer()` que sous la limite. Ici `arrayBuffer()` LÈVE : s'il est
 * appelé, le message n'est plus celui de la taille.
 *
 * Mutation qui rougit : lire les octets avant `verifierTailleAnnoncee`.
 * Contre-témoin : sous la limite, le fichier est bien lu.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ lus: 0 }));

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "33333333-3333-4333-8333-333333333333", role: "admin" } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error("base non lue dans ce test");
      },
    },
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets: async () => ({ issue: "sain" }) }));

import { ajouterDocumentFormAction } from "../actions";

const MO = 1024 * 1024;

function formulaire(taille: number): FormData {
  const fichier = {
    name: "gros.pdf",
    size: taille,
    arrayBuffer: async () => {
      etat.lus += 1;
      throw new Error("octets lus");
    },
  };
  const champs: Record<string, unknown> = {
    clientId: "11111111-1111-4111-8111-111111111111",
    projetId: "22222222-2222-4222-8222-222222222222",
    cote: "interne",
    nature: "deviner",
    titre: "",
    envoyeLe: "",
    lien: "",
    fichier,
  };
  return { get: (cle: string) => champs[cle] ?? null } as unknown as FormData;
}

async function messageDeRetour(fd: FormData): Promise<string> {
  const e = await ajouterDocumentFormAction(fd).catch((x: unknown) => x);
  const url = e instanceof Error ? e.message : "";
  expect(url).toMatch(/^redirect:/);
  return decodeURIComponent(url);
}

describe("l'action vérifie la taille avant de lire le fichier", () => {
  beforeEach(() => {
    etat.lus = 0;
  });

  it("23 Mo : refusé par sa taille, sans que les octets soient lus", async () => {
    const retour = await messageDeRetour(formulaire(23 * MO));
    expect(retour).toContain("Ce fichier pèse 23 Mo : la limite est de 15 Mo.");
    expect(etat.lus).toBe(0);
  }, 60_000);

  it("contre-témoin : sous la limite, les octets sont lus", async () => {
    const retour = await messageDeRetour(formulaire(2 * MO));
    expect(etat.lus).toBe(1);
    expect(retour).not.toContain("la limite est de 15 Mo");
  }, 60_000);
});
