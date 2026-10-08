// « Nouvel apporteur » (07/10, demande de Will) : recherche parmi les fiches de candidats,
// dossier relié à la fiche choisie, et AUCUN doublon quand l'adresse a déjà un dossier.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  ouvrirDossierManuel: vi.fn(),
  etatDuDossier: vi.fn(),
  fiches: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/auth", () => ({ auth: () => h.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findMany: vi.fn(async () => h.fiches) } },
}));
vi.mock("../verification", () => ({
  apercuDecision: vi.fn(),
  appliquerDecision: vi.fn(),
  envoyerLien: vi.fn(),
  preparerLien: vi.fn(),
  jugerPiece: vi.fn(),
  renvoyerContratSigne: vi.fn(),
  ouvrirDossierManuel: (...a: unknown[]) => h.ouvrirDossierManuel(...a),
  etatDuDossier: (...a: unknown[]) => h.etatDuDossier(...a),
}));

import {
  ouvrirDossierManuelAction,
  rechercherCandidatsApporteursAction,
} from "../actions-apporteurs";

const SUB = "22222222-2222-4222-8222-222222222222";
const APP = "33333333-3333-4333-8333-333333333333";
const apporteur = { unifiedType: "recrutement", subType: "candidature-commerciale" };

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  h.fiches = [
    {
      id: SUB,
      details: apporteur,
      contactName: "Kraft Bastine",
      contactEmail: "kraft.bastine@exemple.fr",
      contactPhone: "06 11 22 33 44",
      submittedAt: new Date("2026-10-07T13:00:00Z"),
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      details: { unifiedType: "contact" },
      contactName: "Kraft Client",
      contactEmail: "client@x.fr",
      contactPhone: null,
      submittedAt: new Date("2026-10-01T13:00:00Z"),
    },
  ];
});

describe("recherche parmi les fiches de candidats apporteurs", () => {
  it("par nom, sans accents ni casse ; seules les fiches APPORTEUR sortent", async () => {
    const r = await rechercherCandidatsApporteursAction("kraft");
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.candidats).toHaveLength(1);
    expect(r.candidats[0]).toMatchObject({
      submissionId: SUB,
      prenom: "Kraft",
      nom: "Bastine",
      email: "kraft.bastine@exemple.fr",
      telephone: "06 11 22 33 44",
    });
  });

  it("par téléphone (espaces ignorés) et par adresse", async () => {
    const t = await rechercherCandidatsApporteursAction("0611");
    const e = await rechercherCandidatsApporteursAction("kraft.bastine");
    expect(t.ok && t.candidats.length).toBe(1);
    expect(e.ok && e.candidats.length).toBe(1);
  });

  it("par téléphone saisi à l'international (+33) : retrouve « 06 11 22 33 44 »", async () => {
    const r = await rechercherCandidatsApporteursAction("+33 6 11 22");
    expect(r.ok && r.candidats.map((c) => c.submissionId)).toEqual([SUB]);
  });

  it("au-delà de 600 fiches : la recherche lit les paquets suivants (relecture de a1, 08/10)", async () => {
    const { prisma } = await import("@/lib/prisma");
    const autre = (i: number) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      details: apporteur,
      contactName: `Personne ${i}`,
      contactEmail: `p${i}@exemple.fr`,
      contactPhone: null,
      submittedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const paquet1 = Array.from({ length: 500 }, (_, i) => autre(i));
    const paquet2 = Array.from({ length: 500 }, (_, i) => autre(500 + i));
    vi.mocked(prisma.submission.findMany)
      .mockResolvedValueOnce(paquet1 as never)
      .mockResolvedValueOnce(paquet2 as never)
      .mockResolvedValueOnce([h.fiches[0]] as never);
    const r = await rechercherCandidatsApporteursAction("kraft");
    expect(r.ok && r.candidats.map((c) => c.submissionId)).toEqual([SUB]);
    expect(prisma.submission.findMany).toHaveBeenCalledTimes(3);
  });

  it("une recherche d'un caractère ne lit rien", async () => {
    expect(await rechercherCandidatsApporteursAction("k")).toEqual({ ok: true, candidats: [] });
  });
});

describe("ouverture du dossier", () => {
  const saisie = {
    prenom: "Kraft",
    nom: "Bastine",
    email: "kraft.bastine@exemple.fr",
    telephone: null,
  };

  it("la fiche choisie est transmise pour y relier le dossier", async () => {
    h.ouvrirDossierManuel.mockResolvedValue({ ok: true, apporteurId: APP });
    expect(await ouvrirDossierManuelAction({ ...saisie, submissionId: SUB })).toEqual({
      ok: true,
      apporteurId: APP,
    });
    expect(h.ouvrirDossierManuel).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: SUB }),
    );
  });

  it("adresse déjà connue : pas de doublon, statut et dernier lien dits, fiche proposée", async () => {
    h.ouvrirDossierManuel.mockResolvedValue({ ok: true, apporteurId: APP, existait: true });
    h.etatDuDossier.mockResolvedValue({ statut: "Dossier en cours", dernierLienLe: "6 octobre" });
    const r = await ouvrirDossierManuelAction(saisie);
    expect(r).toMatchObject({
      ok: false,
      existant: { apporteurId: APP, statut: "Dossier en cours", dernierLienLe: "6 octobre" },
    });
    expect((r as { message: string }).message).toContain("dernier lien envoyé le 6 octobre");
  });
});
