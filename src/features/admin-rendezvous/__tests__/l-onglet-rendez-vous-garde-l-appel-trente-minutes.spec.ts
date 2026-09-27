// Onglet « Rendez-vous » : qui, quand, et la carte reste 30 minutes après la
// fin (2026-09-27). La charge reprend la forme réelle du rendez-vous TELEOS.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

import { listRendezVousAVenir } from "../queries";
import { entrepriseEtBesoin, reponsesFormulaire } from "../a-venir";

const CHARGE = {
  invitee: {
    questions_and_answers: [
      {
        question:
          "Quel est votre besoin (formation, 1 to 1, audit, implémentation, plateforme web ou tout autre question) ?",
        answer: "Audit et implémentation",
      },
      { question: "Nom de l'entreprise", answer: "TELEOS" },
      { question: "Numéro de téléphone", answer: "+33 6 00 00 00 00" },
    ],
  },
  event: {
    location: { type: "google_conference", join_url: "https://calendly.com/events/x/google_meet" },
    event_memberships: [{ user_email: "organisateur@example.com" }],
    event_guests: [{ email: "collegue@example.com" }],
  },
};

function ligne(id: string, debutIso: string, finIso: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    eventTypeName: "Discutons de votre projet IA",
    status: "scheduled",
    startTime: new Date(debutIso),
    endTime: new Date(finIso),
    inviteeName: "Philippe Legrand",
    inviteeEmail: "client@example.com",
    inviteePhone: null,
    location: "https://calendly.com/events/x/google_meet",
    rawPayload: CHARGE,
    notes: null,
    capturedAt: new Date("2026-09-22T14:34:00Z"),
    ...extra,
  };
}

describe("ce que la carte lit dans le formulaire Calendly", () => {
  it("sépare l'entreprise du besoin, et écarte le téléphone", () => {
    const { entreprise, besoin } = entrepriseEtBesoin(reponsesFormulaire(CHARGE));
    expect(entreprise).toBe("TELEOS");
    expect(besoin.map((b) => b.reponse)).toEqual(["Audit et implémentation"]);
  });

  it("une charge sans formulaire ne casse rien", () => {
    expect(reponsesFormulaire({})).toEqual([]);
    expect(entrepriseEtBesoin([])).toEqual({ entreprise: null, besoin: [] });
  });
});

describe("listRendezVousAVenir", () => {
  beforeEach(() => vi.clearAllMocks());

  it("garde l'appel jusqu'à 30 minutes après sa fin, puis le retire", async () => {
    findMany.mockResolvedValue([ligne("evt_1", "2026-09-28T13:30:00Z", "2026-09-28T14:15:00Z")]);

    const pendant = await listRendezVousAVenir({ maintenant: new Date("2026-09-28T14:40:00Z") });
    expect(pendant).toHaveLength(1);
    expect(pendant[0]?.status).toBe("scheduled");
    expect(pendant[0]?.enCours).toBe(true);

    const apres = await listRendezVousAVenir({ maintenant: new Date("2026-09-28T14:46:00Z") });
    expect(apres).toHaveLength(0);
  });

  it("porte qui, l'entreprise, les autres invités et le bouton de visio", async () => {
    findMany.mockResolvedValue([ligne("evt_1", "2026-09-28T13:30:00Z", "2026-09-28T14:15:00Z")]);

    const [r] = await listRendezVousAVenir({ maintenant: new Date("2026-09-27T10:00:00Z") });

    expect(r?.contactName).toBe("Philippe Legrand");
    expect(r?.entreprise).toBe("TELEOS");
    expect(r?.autresInvites).toEqual(["collegue@example.com"]);
    expect(r?.lienVisio).toBe("/api/admin/appels/evt_1/visio");
    expect(r?.enCours).toBe(false);
  });

  it("ne demande à la base que les rendez-vous programmés", async () => {
    findMany.mockResolvedValue([]);

    await listRendezVousAVenir({ maintenant: new Date("2026-09-27T10:00:00Z") });

    const arg = findMany.mock.calls[0]?.[0] as { where: { status: string } };
    expect(arg.where.status).toBe("scheduled");
  });
});
