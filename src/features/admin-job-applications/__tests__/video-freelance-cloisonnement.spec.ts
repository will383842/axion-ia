// Vue « Monteurs & vidéastes » : les tarifs sont des informations sur la
// personne. Un rôle qui n'ouvre pas le dossier de candidat voit les lignes (le
// compte est juste) mais ni le nom, ni la ville, ni les réponses.

import { beforeEach, describe, expect, it, vi } from "vitest";

const offerFindManyMock = vi.fn();
const appFindManyMock = vi.fn();
const countMock = vi.fn();
const activityCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findMany: (...a: unknown[]) => offerFindManyMock(...a) },
    jobApplication: {
      findMany: (...a: unknown[]) => appFindManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityCreateMock(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair:${v}` }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { ROLES_ADMIN, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import {
  VIDEO_EDITOR_OFFER_SLUG,
  VIDEO_SHOOTING_OFFER_SLUG,
} from "@/lib/careers/video-editor-offer";

import { listerCandidaturesVideoFreelance } from "../video-freelance";

const OFFRES = [
  {
    id: "o-montage",
    slug: VIDEO_EDITOR_OFFER_SLUG,
    titleFr: "Monteur vidéo freelance",
    screeningQuestions: [{ id: "prix_vertical", labelFr: "Ton prix", required: true }],
  },
  {
    id: "o-tournage",
    slug: VIDEO_SHOOTING_OFFER_SLUG,
    titleFr: "Vidéaste freelance tournage",
    screeningQuestions: [{ id: "tarifs", labelFr: "Tes prix", required: true }],
  },
];

const LIGNE = {
  id: "a1",
  firstName: "Jean",
  lastName: "Témoin",
  city: "Lyon",
  status: "new" as const,
  submittedAt: new Date("2026-09-26T10:00:00Z"),
  answers: { tarifs: "250 € la demi-journée", prix_vertical: "40 €" },
};

beforeEach(() => {
  vi.clearAllMocks();
  offerFindManyMock.mockResolvedValue(OFFRES);
  countMock.mockResolvedValue(1);
  appFindManyMock.mockResolvedValue([LIGNE]);
  activityCreateMock.mockResolvedValue({});
});

describe("listerCandidaturesVideoFreelance", () => {
  it("rend le tournage d'abord, le montage ensuite, avec leurs questions", async () => {
    const res = await listerCandidaturesVideoFreelance({ role: "super_admin", acteurId: "u1" });
    expect(res.map((o) => o.slug)).toEqual([VIDEO_SHOOTING_OFFER_SLUG, VIDEO_EDITOR_OFFER_SLUG]);
    expect(res[0]?.questions.map((q) => q.id)).toEqual(["tarifs"]);
  });

  it("nom, ville et tarifs EXACTEMENT pour les rôles que le prédicat commun admet", async () => {
    let admis = 0;
    let refuses = 0;
    for (const role of ROLES_ADMIN) {
      const res = await listerCandidaturesVideoFreelance({ role, acteurId: "u1" });
      const c = res[0]?.candidats[0];
      // La ligne est toujours là : le compte ne ment pas.
      expect(res[0]?.total, role).toBe(1);
      expect(c?.id, role).toBe("a1");
      if (peutOuvrirDossierCandidat(role)) {
        admis += 1;
        expect(c?.nom, role).toBe("clair:Jean clair:Témoin");
        expect(c?.ville, role).toBe("Lyon");
        expect(c?.reponses.tarifs, role).toBe("250 € la demi-journée");
      } else {
        refuses += 1;
        expect(c?.nom, role).toBeNull();
        expect(c?.ville, role).toBeNull();
        expect(c?.reponses, role).toEqual({});
      }
    }
    // Les deux branches ont réellement été parcourues.
    expect(admis).toBeGreaterThan(0);
    expect(refuses).toBeGreaterThan(0);
  });

  it("un rôle inconnu ou absent ne voit rien de la personne, et rien n'est journalisé", async () => {
    const res = await listerCandidaturesVideoFreelance({ role: null, acteurId: "u1" });
    expect(res[0]?.candidats[0]?.nom).toBeNull();
    expect(res[0]?.candidats[0]?.reponses).toEqual({});
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("une consultation qui sort des identités est journalisée", async () => {
    await listerCandidaturesVideoFreelance({ role: "super_admin", acteurId: "u1" });
    expect(activityCreateMock).toHaveBeenCalledTimes(1);
  });
});
