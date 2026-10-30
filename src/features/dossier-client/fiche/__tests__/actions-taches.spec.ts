// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exiger: vi.fn(),
  creer: vi.fn(async () => ({ id: "t" })),
  faire: vi.fn(async () => "fait"),
  rouvrir: vi.fn(async () => "fait"),
}));
vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: h.exiger }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "?"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../taches", () => ({ creerTache: h.creer, marquerFaite: h.faire, rouvrir: h.rouvrir }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw Object.assign(new Error("REDIRECT"), { url: u });
  },
}));

import {
  ajouterTacheFormAction,
  marquerFaiteFormAction,
  rouvrirTacheFormAction,
} from "../actions-taches";

const ID = "11111111-1111-4111-8111-111111111111";
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const url = async (p: Promise<void>): Promise<string> =>
  p.then(
    () => "",
    (e: { url?: string }) => e.url ?? "",
  );

beforeEach(() => {
  h.exiger.mockReset();
  h.creer.mockClear();
  h.faire.mockClear();
  h.rouvrir.mockClear();
});

describe("actions des tâches", () => {
  it("un lecteur est refusé avant toute écriture (les trois actions)", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const a = await url(
      ajouterTacheFormAction(form({ clientId: ID, intitule: "x", avantLe: "2026-11-01" })),
    );
    const b = await url(marquerFaiteFormAction(form({ clientId: ID, tacheId: ID })));
    const c = await url(rouvrirTacheFormAction(form({ clientId: ID, tacheId: ID })));
    expect(h.creer).not.toHaveBeenCalled();
    expect(h.faire).not.toHaveBeenCalled();
    expect(h.rouvrir).not.toHaveBeenCalled();
    for (const u of [a, b, c]) expect(u).toContain("erreur=");
  });

  it("un rôle autorisé ajoute : retour au Résumé avec un message scellé", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    const u = await url(
      ajouterTacheFormAction(
        form({ clientId: ID, intitule: "Appeler", avantLe: "2026-11-01", responsable: "" }),
      ),
    );
    expect(h.creer).toHaveBeenCalledTimes(1);
    expect(u).toContain("onglet=resume");
    expect(u).toMatch(/message=.+&sceau=/);
  });

  it("marquer faite et rouvrir passent par le service", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    await url(marquerFaiteFormAction(form({ clientId: ID, tacheId: ID })));
    await url(rouvrirTacheFormAction(form({ clientId: ID, tacheId: ID })));
    expect(h.faire).toHaveBeenCalledTimes(1);
    expect(h.rouvrir).toHaveBeenCalledTimes(1);
  });

  it("une fiche mal formée renvoie à la liste sans lire le rôle", async () => {
    const u = await url(marquerFaiteFormAction(form({ clientId: "pas-un-uuid", tacheId: ID })));
    expect(h.exiger).not.toHaveBeenCalled();
    expect(u).toContain("/qualiopi/clients");
  });
});
