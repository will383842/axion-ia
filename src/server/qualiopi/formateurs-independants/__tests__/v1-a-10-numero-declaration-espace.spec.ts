/**
 * V1-A-10 (vérification n° 1) — F21 dit « transmettez votre numéro depuis votre espace »,
 * mais aucun écran de l'espace ne le permettait. « Mon dossier » le reçoit : l'écriture
 * est conditionnelle (fiche « en cours » seulement), et elle arrête F21, dont la campagne
 * ne lit que les fiches dont le numéro dit encore « en cours ».
 *
 * Relecture (#1539) — un numéro tapé par le formateur n'est pas vérifié : l'écriture remet
 * le contrôle du registre à zéro, la garde de mission refuse (motif `registre`) jusqu'à la
 * revérification en console, et la fiche console le signale.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  logFindFirst: vi.fn(),
  journaliser: vi.fn(),
  allume: true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { updateMany: h.updateMany, findFirst: h.findFirst },
    activityLog: { findFirst: h.logFindFirst },
  },
}));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journaliser }));
vi.mock("../interrupteurs-envoi", () => ({ envoiAllume: async () => h.allume }));

import { MANQUES_MISSION, peutRecevoirMission, type FaitsGardeMission } from "../garde-mission";
import {
  ACTION_NDA_TRANSMIS,
  numeroDeclarationAttendu,
  numeroRecuAVerifier,
  transmettreNumeroDeclaration,
} from "../numero-declaration-espace";
import { ndaEstEnCours } from "../relances-missions";

const TRAINER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  h.allume = true;
  h.updateMany.mockResolvedValue({ count: 1 });
  h.journaliser.mockResolvedValue(true);
});

describe("V1-A-10 — le numéro de déclaration transmis depuis l'espace", () => {
  it("un numéro lisible est écrit sur la fiche « en cours », et journalisé sans le numéro", async () => {
    expect(await transmettreNumeroDeclaration(TRAINER, " 846 912 345 69 ")).toBe("nda_recu");
    const appel = h.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: { sousTraitantNda: string; sousTraitantVerifieAt: Date | null };
    };
    expect(appel.data).toEqual({ sousTraitantNda: "84691234569", sousTraitantVerifieAt: null });
    expect(appel.where).toMatchObject({
      id: TRAINER,
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      finCollaborationAt: null,
      sousTraitantNda: { contains: "cours", mode: "insensitive" },
    });
    // F21 ne lit que les fiches « en cours » : le numéro écrit l'arrête.
    expect(ndaEstEnCours(appel.data.sousTraitantNda)).toBe(false);
    const entree = h.journaliser.mock.calls[0]?.[1] as { action: string; changes: unknown };
    expect(entree.action).toBe(ACTION_NDA_TRANSMIS);
    expect(JSON.stringify(entree)).not.toContain("84691234569");
  });

  it("après la transmission, aucune mission tant que la console n'a pas revérifié (motif registre)", async () => {
    const MAINTENANT = new Date("2026-10-15T10:00:00Z");
    // Fiche vérifiée en console il y a 5 jours, numéro « en cours » : refusée pour le seul numéro.
    const avant = {
      statut: "sous_traitant",
      actif: true,
      finCollaborationAt: null,
      activationValideeSource: "controle",
      sousTraitantVerifieAt: new Date("2026-10-10T10:00:00Z"),
      sousTraitantNda: "en cours",
      sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
      contratCadreVersion: 3,
      siret: "12345678900011",
      contratCadreSiret: "12345678900011",
      pieces: [],
      cumulHonorairesHtCents: 0,
    } as unknown as FaitsGardeMission;
    expect(peutRecevoirMission(avant, 3, MAINTENANT)).toEqual({
      ok: false,
      manques: [MANQUES_MISSION.ndaEnCours],
    });

    expect(await transmettreNumeroDeclaration(TRAINER, "84691234569")).toBe("nda_recu");
    const { data } = h.updateMany.mock.calls[0]?.[0] as { data: Partial<FaitsGardeMission> };
    const apres = { ...avant, ...data } as FaitsGardeMission;
    expect(peutRecevoirMission(apres, 3, MAINTENANT)).toEqual({
      ok: false,
      manques: [MANQUES_MISSION.registre],
    });
    // La console revérifie : la mission s'ouvre.
    expect(
      peutRecevoirMission({ ...apres, sousTraitantVerifieAt: MAINTENANT }, 3, MAINTENANT),
    ).toEqual({ ok: true });
  });

  it("la console voit « numéro reçu, à vérifier » tant que le registre n'est pas revérifié", async () => {
    const LE = new Date("2026-10-15T08:00:00Z");
    h.findFirst.mockResolvedValueOnce({ sousTraitantNda: "84691234569" });
    h.logFindFirst.mockResolvedValueOnce({ createdAt: LE });
    expect(await numeroRecuAVerifier(TRAINER)).toEqual(LE);
    const lecture = h.findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(lecture.where).toMatchObject({ id: TRAINER, sousTraitantVerifieAt: null });
    const trace = h.logFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(trace.where).toMatchObject({ action: ACTION_NDA_TRANSMIS, targetId: TRAINER });

    // Revérifiée (la lecture ne trouve plus de fiche non vérifiée) : plus de mention.
    h.findFirst.mockResolvedValueOnce(null);
    expect(await numeroRecuAVerifier(TRAINER)).toBeNull();
    // Encore « en cours » : rien de reçu.
    h.findFirst.mockResolvedValueOnce({ sousTraitantNda: "en cours" });
    expect(await numeroRecuAVerifier(TRAINER)).toBeNull();
    // Coupé : aucune lecture.
    h.allume = false;
    vi.clearAllMocks();
    expect(await numeroRecuAVerifier(TRAINER)).toBeNull();
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("la fiche console porte la mention", () => {
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/page.tsx",
      ),
      "utf8",
    );
    expect(page).toContain("numeroRecuAVerifier(trainer.id)");
    expect(page).toContain("à vérifier : aucune mission");
  });

  it("un numéro illisible n'écrit rien", async () => {
    expect(await transmettreNumeroDeclaration(TRAINER, "1234")).toBe("nda_invalide");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("un numéro déjà connu ne se remplace pas d'ici", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    expect(await transmettreNumeroDeclaration(TRAINER, "84691234569")).toBe("nda_deja_connu");
    expect(h.journaliser).not.toHaveBeenCalled();
  });

  it("interrupteur coupé : rien n'est lu ni écrit", async () => {
    h.allume = false;
    expect(await transmettreNumeroDeclaration(TRAINER, "84691234569")).toBe("nda_indisponible");
    expect(await numeroDeclarationAttendu(TRAINER)).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("la saisie n'est proposée qu'à une fiche dont le numéro est « en cours »", async () => {
    h.findFirst.mockResolvedValueOnce({ sousTraitantNda: "en cours" });
    expect(await numeroDeclarationAttendu(TRAINER)).toBe(true);
    h.findFirst.mockResolvedValueOnce({ sousTraitantNda: "84691234569" });
    expect(await numeroDeclarationAttendu(TRAINER)).toBe(false);
    h.findFirst.mockResolvedValueOnce(null);
    expect(await numeroDeclarationAttendu(TRAINER)).toBe(false);
  });

  it("l'écran « Mon dossier » porte la saisie, sans JavaScript client", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/espace-formateur/dossier/page.tsx"),
      "utf8",
    );
    expect(page).toContain("action={transmettreMonNumeroAction}");
    expect(page).toContain('name="nda"');
    expect(page).not.toContain('"use client"');
  });
});
