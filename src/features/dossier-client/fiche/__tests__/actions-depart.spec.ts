// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exiger: vi.fn(),
  noter: vi.fn(async () => ({ issue: "fait", contactFacturation: false })),
  annuler: vi.fn(async () => "fait"),
}));
vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: h.exiger }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "?"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../depart-personne", () => ({ noterDepart: h.noter, annulerDepart: h.annuler }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw Object.assign(new Error("REDIRECT"), { url: u });
  },
}));

import { annulerDepartFormAction, noterDepartFormAction } from "../actions-depart";

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
  h.noter.mockClear();
  h.annuler.mockClear();
});

describe("actions de départ", () => {
  it("un rôle sans accès est refusé avant toute écriture", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const u = await url(
      noterDepartFormAction(form({ clientId: ID, contactId: ID, partiLe: "2026-10-15" })),
    );
    expect(h.noter).not.toHaveBeenCalled();
    expect(u).toContain("erreur=");
  });

  it("un rôle autorisé note le départ puis revient à l'onglet Personnes", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    const u = await url(
      noterDepartFormAction(form({ clientId: ID, contactId: ID, partiLe: "2026-10-15" })),
    );
    expect(h.noter).toHaveBeenCalledTimes(1);
    expect(u).toContain("onglet=personnes");
    expect(u).toContain("message=");
  });

  it("contact de facturation : le message ne promet pas l'arrêt des factures", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    h.noter.mockResolvedValueOnce({ issue: "fait", contactFacturation: true });
    const u = decodeURIComponent(
      await url(
        noterDepartFormAction(form({ clientId: ID, contactId: ID, partiLe: "2026-10-15" })),
      ),
    ).replace(/\+/g, " ");
    expect(u).toContain("les factures partent encore à son adresse");
    expect(u).not.toContain("plus aucun envoi");
  });

  it("déjà noté / déjà active : message dédié", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    h.noter.mockResolvedValueOnce({ issue: "deja", contactFacturation: false });
    h.annuler.mockResolvedValueOnce("deja");
    const a = decodeURIComponent(
      await url(
        noterDepartFormAction(form({ clientId: ID, contactId: ID, partiLe: "2026-10-15" })),
      ),
    ).replace(/\+/g, " ");
    const b = decodeURIComponent(
      await url(annulerDepartFormAction(form({ clientId: ID, contactId: ID }))),
    ).replace(/\+/g, " ");
    expect(a).toContain("Départ déjà noté");
    expect(b).toContain("Personne déjà active");
  });

  it("annuler : rôle revérifié aussi", async () => {
    h.exiger.mockRejectedValue(new Error("non"));
    await url(annulerDepartFormAction(form({ clientId: ID, contactId: ID })));
    expect(h.annuler).not.toHaveBeenCalled();
  });

  it("identifiants invalides : rien n'est écrit", async () => {
    h.exiger.mockResolvedValue({ userId: "u", role: "super_admin" });
    await url(
      noterDepartFormAction(form({ clientId: "x", contactId: "y", partiLe: "2026-10-15" })),
    );
    expect(h.noter).not.toHaveBeenCalled();
  });
});
