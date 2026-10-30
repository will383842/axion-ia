// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exiger: vi.fn(),
  archiver: vi.fn(async () => "fait"),
  desarchiver: vi.fn(async () => "fait"),
  responsable: vi.fn(async () => {}),
  ajouter: vi.fn(async () => {}),
  retirer: vi.fn(async () => true),
}));
vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: h.exiger }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "?"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../profil", () => ({
  ErreurProfil: class extends Error {},
  archiver: h.archiver,
  desarchiver: h.desarchiver,
  definirResponsable: h.responsable,
}));
vi.mock("../etiquettes", () => ({ ajouterEtiquette: h.ajouter, retirerEtiquette: h.retirer }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw Object.assign(new Error("REDIRECT"), { url: u });
  },
}));

import {
  ajouterEtiquetteAction,
  archiverAction,
  definirResponsableAction,
  desarchiverAction,
  retirerEtiquetteAction,
  sortirDesArchivesFormAction,
} from "../actions-profil";

const ID = "11111111-1111-4111-8111-111111111111";
const ETAT = { message: null, erreur: null };
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  h.exiger.mockReset();
  h.archiver.mockClear();
  h.desarchiver.mockClear();
  h.responsable.mockClear();
  h.ajouter.mockClear();
  h.retirer.mockClear();
});

describe("actions du profil", () => {
  it("un rôle sans accès est refusé avant toute écriture", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const r = await archiverAction(ETAT, form({ clientId: ID }));
    expect(r.erreur).toBe("Accès refusé");
    expect(h.archiver).not.toHaveBeenCalled();
  });

  it("l'archivage est refusé à un administrateur, avant d'appeler la couche données", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    expect((await archiverAction(ETAT, form({ clientId: ID }))).erreur).toMatch(
      /super-administrateur/,
    );
    expect((await desarchiverAction(ETAT, form({ clientId: ID }))).erreur).toMatch(
      /super-administrateur/,
    );
    expect(h.archiver).not.toHaveBeenCalled();
    expect(h.desarchiver).not.toHaveBeenCalled();
  });

  it("le super-administrateur archive", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    const r = await archiverAction(ETAT, form({ clientId: ID, motif: "fin" }));
    expect(r).toEqual({ message: "Client archivé.", erreur: null });
  });

  it("le responsable est ouvert à un administrateur", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    const r = await definirResponsableAction(ETAT, form({ clientId: ID, responsable: "Camille" }));
    expect(r.message).toBe("Responsable enregistré.");
    expect(h.responsable).toHaveBeenCalledTimes(1);
  });

  it("« Sortir des archives » depuis la fiche refuse un administrateur", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    const u = await sortirDesArchivesFormAction(form({ clientId: ID })).catch(
      (e: { url: string }) => e.url,
    );
    expect(u).toContain("erreur=");
    expect(h.desarchiver).not.toHaveBeenCalled();
  });

  it("« Sortir des archives » depuis la fiche, super-administrateur", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    const u = await sortirDesArchivesFormAction(form({ clientId: ID })).catch(
      (e: { url: string }) => e.url,
    );
    expect(u).toContain("message=");
    expect(h.desarchiver).toHaveBeenCalledTimes(1);
  });

  it("ajouter une étiquette sans accès est refusé avant toute écriture", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const r = await ajouterEtiquetteAction(ETAT, form({ clientId: ID, libelle: "VIP" }));
    expect(r.erreur).toBe("Accès refusé");
    expect(h.ajouter).not.toHaveBeenCalled();
  });

  it("ajouter une étiquette : un clientId qui n'est pas un UUID est refusé, la couche données n'est pas appelée", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    const r = await ajouterEtiquetteAction(ETAT, form({ clientId: "pas-un-uuid", libelle: "VIP" }));
    expect(r.erreur).not.toBeNull();
    expect(h.ajouter).not.toHaveBeenCalled();
  });

  it("retirer une étiquette sans accès est refusé", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const r = await retirerEtiquetteAction(ETAT, form({ clientId: ID, etiquetteId: ID }));
    expect(r.erreur).toBe("Accès refusé");
    expect(h.retirer).not.toHaveBeenCalled();
  });

  it("un clientId qui n'est pas un UUID est refusé, la couche données n'est pas appelée", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    const r = await retirerEtiquetteAction(
      ETAT,
      form({ clientId: "pas-un-uuid", etiquetteId: ID }),
    );
    expect(r.erreur).not.toBeNull();
    expect(h.retirer).not.toHaveBeenCalled();
  });

  it("un etiquetteId qui n'est pas un UUID est refusé, la couche données n'est pas appelée", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "admin" });
    const r = await retirerEtiquetteAction(ETAT, form({ clientId: ID, etiquetteId: "x" }));
    expect(r.erreur).toBe("Étiquette inconnue.");
    expect(h.retirer).not.toHaveBeenCalled();
  });
});
