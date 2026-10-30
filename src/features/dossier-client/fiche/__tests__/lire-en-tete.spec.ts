import { beforeEach, describe, expect, it, vi } from "vitest";

const fil = vi.hoisted(() => ({ valeur: { fil: [], sourcesEnPanne: 0 } as unknown }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clientTache: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    emailOutbox: { count: vi.fn().mockResolvedValue(0) },
    projetSuivi: { findMany: vi.fn().mockResolvedValue([]) },
    clientContact: { count: vi.fn().mockResolvedValue(0) },
    devis: { count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock("@/features/dossier-client/fil-des-echanges", () => ({
  lireFilDesEchanges: vi.fn(async () => fil.valeur),
}));
vi.mock("@/features/dossier-client/queries", () => ({
  lireRencontresDuClient: vi.fn().mockResolvedValue([]),
  lireProjetsDuClient: vi.fn().mockResolvedValue([{ id: "p1" }]),
}));
const suivis = vi.hoisted(() => ({ valeur: [] as unknown }));
vi.mock("@/features/dossier-client/suivi-prestations", () => ({
  lireSuivisDesProjets: vi.fn(async () => suivis.valeur),
  assemblerPrestations: vi.fn(() => []),
}));
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({ calculerEncoursDuCents: () => 0 }));

import { lireProjetsDuClient, lireRencontresDuClient } from "@/features/dossier-client/queries";

import {
  dernierEchange,
  dernierEmailParti,
  lireEnTete,
  nbFacturesEnRetard,
  plusProcheEcheance,
  prochainRendezVous,
  type ContexteEnTete,
} from "../lire-en-tete";

const MAINTENANT = new Date("2026-10-29T12:00:00Z");
const AUJOURDHUI = new Date("2026-10-29T00:00:00Z");
const client = { statut: "client_actif", facturesFormation: [] } as never;
const ctx = (): ContexteEnTete => ({
  clientId: "c1",
  adminPrefix: "x",
  voitEchanges: true,
  maintenant: MAINTENANT,
});

describe("lireEnTete — santé", () => {
  beforeEach(() => {
    fil.valeur = { fil: [], sourcesEnPanne: 0 };
    suivis.valeur = [];
  });
  it("une source du fil en panne : « Lecture impossible », pas « aucun échange »", async () => {
    fil.valeur = { fil: [], sourcesEnPanne: 1 };
    const e = await lireEnTete(ctx(), async () => client);
    expect(e!.sante).toEqual({ ok: false });
  });
  it("fil complet et vide : à surveiller, aucun échange", async () => {
    const e = await lireEnTete(ctx(), async () => client);
    expect(e!.sante).toEqual({
      ok: true,
      valeur: { niveau: "a_surveiller", raisons: ["aucun échange"] },
    });
  });
  it("la panne de projet_suivis touche le pipeline, pas le compteur Prestations", async () => {
    suivis.valeur = null;
    const e = await lireEnTete(ctx(), async () => client);
    expect(e!.pipeline).toEqual({ ok: false });
    expect(e!.nbPrestations).toEqual({ ok: true, valeur: 1 });
  });
});

describe("dernierEchange / prochain rendez-vous / dernier e-mail", () => {
  const rdv = (o: object) => ({
    statut: "tenu",
    debutPrevu: new Date("2026-10-20T10:00:00Z"),
    titre: "R",
    estTestInterne: false,
    ...o,
  });
  it("ignore un rendez-vous tenu marqué test interne", () => {
    expect(dernierEchange([rdv({ estTestInterne: true })], [], MAINTENANT)).toBeNull();
    expect(dernierEchange([rdv({})], [], MAINTENANT)).toEqual(new Date("2026-10-20T10:00:00Z"));
  });
  it("prochain rendez-vous : le plus proche, planifié, hors test", () => {
    const p = prochainRendezVous(
      [
        rdv({ statut: "planifie", debutPrevu: new Date("2026-11-10T10:00:00Z"), titre: "B" }),
        rdv({ statut: "planifie", debutPrevu: new Date("2026-11-03T10:00:00Z"), titre: "A" }),
        rdv({
          statut: "planifie",
          debutPrevu: new Date("2026-10-30T10:00:00Z"),
          estTestInterne: true,
        }),
        rdv({ statut: "annule", debutPrevu: new Date("2026-10-30T10:00:00Z") }),
      ],
      MAINTENANT,
    );
    expect(p).toEqual({ debutPrevu: new Date("2026-11-03T10:00:00Z"), titre: "A" });
    expect(prochainRendezVous([], MAINTENANT)).toBeNull();
  });
  it("dernier e-mail : le plus récent parti, jamais un e-mail non parti", () => {
    const f = [
      { genre: "email", statutEmail: "failed", date: new Date("2026-10-28T10:00:00Z") },
      { genre: "email", statutEmail: "sent", date: new Date("2026-10-10T10:00:00Z") },
      { genre: "email", statutEmail: "sent", date: new Date("2026-10-15T10:00:00Z") },
    ];
    expect(dernierEmailParti(f, MAINTENANT)).toEqual(new Date("2026-10-15T10:00:00Z"));
    expect(dernierEmailParti([], MAINTENANT)).toBeNull();
  });
});

describe("factures", () => {
  const f = (statut: string, echeanceAt: string | null, avoirDeId: string | null = null) => ({
    statut,
    avoirDeId,
    echeanceAt: echeanceAt === null ? null : new Date(echeanceAt),
  });
  it("compte le statut en_retard ET une facture ouverte échue (jour de Paris)", () => {
    expect(
      nbFacturesEnRetard(
        [
          f("en_retard", null),
          f("emise", "2026-10-28T22:30:00Z"), // 28/10 23 h 30 à Paris : échue
          f("emise", "2026-10-29T10:00:00Z"), // aujourd'hui : pas encore en retard
          f("payee", "2026-09-01T10:00:00Z"),
          f("emise", "2026-09-01T10:00:00Z", "avoir"),
        ],
        AUJOURDHUI,
      ),
    ).toBe(2);
  });
  it("plus proche échéance : factures ouvertes seulement", () => {
    expect(
      plusProcheEcheance([f("payee", "2026-01-01T00:00:00Z"), f("emise", "2026-11-01T00:00:00Z")]),
    ).toEqual(new Date("2026-11-01T00:00:00Z"));
  });
});

describe("lireEnTete — lectures partagées", () => {
  beforeEach(() => {
    fil.valeur = { fil: [], sourcesEnPanne: 0 };
    suivis.valeur = [];
    vi.mocked(lireProjetsDuClient).mockClear();
  });
  it("nbRendezVous exclut les rendez-vous de test interne", async () => {
    vi.mocked(lireRencontresDuClient).mockResolvedValueOnce([
      { statut: "tenu", debutPrevu: null, titre: "A", estTestInterne: false },
      { statut: "tenu", debutPrevu: null, titre: "B", estTestInterne: true },
    ] as never);
    const e = await lireEnTete(ctx(), async () => client);
    expect(e!.nbRendezVous).toEqual({ ok: true, valeur: 1 });
  });
  it("lit les projets une seule fois pour le compteur et le pipeline", async () => {
    await lireEnTete(ctx(), async () => client);
    expect(lireProjetsDuClient).toHaveBeenCalledTimes(1);
  });
  it("projets illisibles : compteur et pipeline en panne", async () => {
    vi.mocked(lireProjetsDuClient).mockRejectedValueOnce(new Error("panne"));
    const e = await lireEnTete(ctx(), async () => client);
    expect(e!.nbPrestations).toEqual({ ok: false });
    expect(e!.pipeline).toEqual({ ok: false });
  });
});
