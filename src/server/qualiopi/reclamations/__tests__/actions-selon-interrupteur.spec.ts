/**
 * L09 — interrupteur ÉTEINT = registre INCHANGÉ ; allumé = cycle daté.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  actif: false,
  receptions: 1,
  deposer: vi.fn(async () => ({ id: "rec-1", numero: "AXI-REC-2026-001", accuse: "envoye" })),
  ajouterEtape: vi.fn(async () => ({ ok: true, email: null })),
  prisma: {
    reclamation: {
      create: vi.fn(async () => ({ id: "rec-1", numero: "AXI-REC-2026-001" })),
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => ({
        id: "rec-1",
        statut: "nouvelle",
        enrollmentId: null,
        _count: { etapes: h.receptions },
      })),
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-uuid", role: "admin" })),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/registres/auteur", () => ({
  auteurAdministrateur: vi.fn(async () => ({ id: "admin-uuid", nom: "Camille Exemple" })),
}));
vi.mock("@/server/qualiopi/reclamations/interrupteur", () => ({
  cycleActifPour: vi.fn(async (r: { aUneReception: boolean }) => h.actif && r.aUneReception),
}));
vi.mock("@/server/qualiopi/reclamations/cycle-service", () => ({
  CANAUX_DEPOT: [
    "formulaire_public",
    "espace_stagiaire",
    "console",
    "telephone",
    "courrier",
    "email",
  ],
  QUALITES_RECLAMANT: ["stagiaire", "entreprise", "formateur", "financeur", "autre"],
  deposerReclamation: h.deposer,
  ajouterEtapeReclamation: h.ajouterEtape,
}));

import {
  ajouterEtapeReclamationAction,
  creerReclamationAction,
  repondreReclamationAction,
  setStatutReclamationAction,
} from "@/server/actions/qualiopi/reclamations";

const ID = "550e8400-e29b-41d4-a716-446655440010";
const SAISIE = {
  source: "client" as const,
  reclamantNom: "Contact entreprise",
  objet: "Facture erronée",
  description: "Le nombre de stagiaires facturés ne correspond pas.",
  dateReception: new Date("2026-10-15T10:00:00.000Z"),
};

describe("interrupteur éteint — rien ne change", () => {
  beforeEach(() => {
    h.actif = false;
    vi.clearAllMocks();
  });

  it("creerReclamationAction écrit comme avant, sans étape ni accusé", async () => {
    const r = await creerReclamationAction(SAISIE);
    expect(r).toEqual({ data: { id: "rec-1", numero: "AXI-REC-2026-001" } });
    expect(h.prisma.reclamation.create).toHaveBeenCalledOnce();
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it("repondre et setStatut restent possibles", async () => {
    expect(await repondreReclamationAction({ id: ID, reponse: "Réponse" })).toEqual({
      data: { id: ID },
    });
    expect(await setStatutReclamationAction({ id: ID, statut: "cloturee" })).toEqual({
      data: { id: ID },
    });
  });

  it("le suivi daté est refusé", async () => {
    const r = await ajouterEtapeReclamationAction({
      id: ID,
      etape: "analyse",
      contenu: "Une analyse assez longue",
    });
    expect(r).toEqual({ error: expect.stringMatching(/n'est pas activé/) });
    expect(h.ajouterEtape).not.toHaveBeenCalled();
  });
});

describe("interrupteur allumé — le cycle daté", () => {
  beforeEach(() => {
    h.actif = true;
    h.receptions = 1;
    vi.clearAllMocks();
  });

  it("réclamation sans étape (antérieure au cycle), interrupteur actif : répondre et clore restent possibles", async () => {
    h.receptions = 0;
    expect(await repondreReclamationAction({ id: ID, reponse: "Réponse" })).toEqual({
      data: { id: ID },
    });
    expect(await setStatutReclamationAction({ id: ID, statut: "cloturee" })).toEqual({
      data: { id: ID },
    });
    expect(h.prisma.reclamation.update).toHaveBeenCalledTimes(2);
  });

  it("creerReclamationAction passe par le dépôt (réception + accusé), qualité déduite", async () => {
    const r = await creerReclamationAction(SAISIE);
    expect(r).toEqual({ data: { id: "rec-1", numero: "AXI-REC-2026-001" } });
    expect(h.prisma.reclamation.create).not.toHaveBeenCalled();
    expect(h.deposer).toHaveBeenCalledWith(
      expect.objectContaining({
        qualite: "entreprise",
        canal: "console",
        auteur: { id: "admin-uuid", nom: "Camille Exemple" },
      }),
    );
  });

  it("refuse une date de réception dans le futur", async () => {
    const r = await creerReclamationAction({
      ...SAISIE,
      canal: "telephone",
      dateReception: new Date(Date.now() + 3 * 86_400_000),
    });
    expect(r).toEqual({ error: expect.stringMatching(/futur/) });
  });

  it("canal console : la date de réception est celle du serveur, jamais antidatée", async () => {
    const avant = Date.now();
    await creerReclamationAction({ ...SAISIE, dateReception: new Date("2020-01-01T00:00:00Z") });
    const appels = h.deposer.mock.calls as unknown as Array<[{ dateReception: Date }]>;
    const dateReception = appels[0]![0].dateReception;
    expect(dateReception.getTime()).toBeGreaterThanOrEqual(avant);
  });

  it("canal téléphone : la date saisie est conservée", async () => {
    await creerReclamationAction({ ...SAISIE, canal: "telephone" });
    expect(h.deposer).toHaveBeenCalledWith(
      expect.objectContaining({ dateReception: SAISIE.dateReception }),
    );
  });

  it("les gestes libres sont refusés : le statut suit les étapes", async () => {
    expect(await repondreReclamationAction({ id: ID, reponse: "Réponse" })).toEqual({
      error: expect.stringMatching(/cycle daté/),
    });
    expect(await setStatutReclamationAction({ id: ID, statut: "cloturee" })).toEqual({
      error: expect.stringMatching(/cycle daté/),
    });
    expect(h.prisma.reclamation.update).not.toHaveBeenCalled();
  });

  it("une étape est inscrite au nom réel de la personne connectée", async () => {
    const r = await ajouterEtapeReclamationAction({
      id: ID,
      etape: "analyse",
      contenu: "Une analyse assez longue",
    });
    expect(r).toEqual({ data: { id: ID, email: null } });
    expect(h.ajouterEtape).toHaveBeenCalledWith(
      expect.objectContaining({
        etape: "analyse",
        auteur: { id: "admin-uuid", nom: "Camille Exemple" },
      }),
    );
  });
});
