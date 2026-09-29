// Décision Will du 2026-09-28 : toute candidature d'apporteur, et toute
// candidature à une offre COMMERCIALE, reçoit l'invitation du tunnel 15 minutes
// après sa réception. Ce qui compte ici : la fenêtre (ni avant 15 minutes, ni
// les anciennes), le périmètre (jamais la saisie manuelle), et qu'une fiche ne
// soit invitée qu'une fois — sauf échec passager, repris au passage suivant.

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  jobFindMany: vi.fn(),
  subFindMany: vi.fn(),
  subFindUnique: vi.fn(),
  subUpdate: vi.fn(),
  subUpdateMany: vi.fn(),
  envoyer: vi.fn(),
  creer: vi.fn(),
  consigner: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { findMany: (...a: unknown[]) => d.jobFindMany(...a) },
    submission: {
      findMany: (...a: unknown[]) => d.subFindMany(...a),
      findUnique: (...a: unknown[]) => d.subFindUnique(...a),
      update: (...a: unknown[]) => d.subUpdate(...a),
      updateMany: (...a: unknown[]) => d.subUpdateMany(...a),
    },
  },
}));
vi.mock("../invitation-apporteur", () => ({
  envoyerInvitationApporteur: (...a: unknown[]) => d.envoyer(...a),
}));
vi.mock("@/features/admin-job-applications/fiche-apporteur-depuis-candidature", () => ({
  creerFicheApporteurDepuisCandidature: (...a: unknown[]) => d.creer(...a),
}));
vi.mock("@/features/admin-job-applications/journal", () => ({
  consignerEvenement: (...a: unknown[]) => d.consigner(...a),
}));

import {
  DEBUT_INVITATION_AUTO,
  DELAI_INVITATION_AUTO_MS,
  ficheEligible,
  passerInvitationsAuto,
} from "../invitation-auto";

const MAINTENANT = new Date("2026-10-01T10:00:00Z");
const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["CALENDLY_APPORTEUR_URL"] =
    "https://calendly.com/axion-ia/echange-apporteur-affaires";
  d.jobFindMany.mockResolvedValue([]);
  d.subFindMany.mockResolvedValue([]);
  d.subFindUnique.mockResolvedValue({ details: APPORTEUR });
  d.subUpdate.mockResolvedValue({});
  d.envoyer.mockResolvedValue({ ok: true });
  d.consigner.mockResolvedValue("evt");
});

describe("ficheEligible — le périmètre", () => {
  it("une candidature du site est invitée", () => {
    expect(ficheEligible({ ...APPORTEUR, etape: "lead" })).toBe(true);
  });
  it("jamais la saisie manuelle : Will garde sa case", () => {
    expect(ficheEligible({ ...APPORTEUR, origine: "saisie-manuelle" })).toBe(false);
  });
  it("une fiche « Proposer le réseau » faite à la main n'est pas reprise ; la création automatique, si", () => {
    expect(ficheEligible({ ...APPORTEUR, origine: "candidature-offre-emploi" })).toBe(false);
    expect(
      ficheEligible({
        ...APPORTEUR,
        origine: "candidature-offre-emploi",
        creationAutomatique: true,
      }),
    ).toBe(true);
  });
  it("une fiche déjà traitée par le passage ne l'est jamais deux fois", () => {
    expect(ficheEligible({ ...APPORTEUR, invitationAuto: { issue: "envoyee" } })).toBe(false);
  });
});

describe("passerInvitationsAuto", () => {
  it("ne cherche que ce qui a été reçu il y a 15 minutes ou plus, et depuis la mise en service", async () => {
    await passerInvitationsAuto(MAINTENANT);
    const where = d.subFindMany.mock.calls[0]?.[0]?.where;
    expect(where.submittedAt.lte.getTime()).toBe(MAINTENANT.getTime() - DELAI_INVITATION_AUTO_MS);
    expect(where.submittedAt.gte.getTime()).toBeGreaterThanOrEqual(DEBUT_INVITATION_AUTO.getTime());
    expect(where.status).toEqual({ in: ["new", "in_progress"] });
    const whereOffres = d.jobFindMany.mock.calls[0]?.[0]?.where;
    expect(whereOffres.offer).toEqual({ category: "commercial" });
    expect(whereOffres.submittedAt.lte.getTime()).toBe(
      MAINTENANT.getTime() - DELAI_INVITATION_AUTO_MS,
    );
  });

  it("invite une fiche du site, sans administrateur, et la marque", async () => {
    d.subFindMany.mockResolvedValue([{ id: "f1", details: APPORTEUR }]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "f1", adminId: null }),
    );
    expect(r.envoyees).toBe(1);
    const data = d.subUpdate.mock.calls[0]?.[0]?.data;
    expect(data.details.invitationAuto.issue).toBe("envoyee");
  });

  it("une saisie manuelle n'est jamais envoyée", async () => {
    d.subFindMany.mockResolvedValue([
      { id: "m1", details: { ...APPORTEUR, origine: "saisie-manuelle" } },
    ]);
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("un refus définitif (déjà invitée) est marqué : la fiche n'est plus reprise", async () => {
    d.subFindMany.mockResolvedValue([{ id: "f2", details: APPORTEUR }]);
    d.envoyer.mockResolvedValue({ ok: false, erreur: "deja-invitee", message: "x" });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.ecartees["deja-invitee"]).toBe(1);
    expect(d.subUpdate).toHaveBeenCalledTimes(1);
  });

  it("🔴 une fiche « déjà invitée » (le dossier après la capture) est RANGÉE si encore nouvelle — pas de bruit", async () => {
    d.subFindMany.mockResolvedValue([{ id: "dossier-1", details: APPORTEUR }]);
    d.envoyer.mockResolvedValue({ ok: false, erreur: "deja-invitee", message: "x" });
    await passerInvitationsAuto(MAINTENANT);
    expect(d.subUpdateMany).toHaveBeenCalledWith({
      where: { id: "dossier-1", status: "new", archivedAt: null },
      data: { status: "processed", needsAttention: false },
    });
  });

  it("une invitation envoyée ne passe pas par ce rangement (déjà fait par l'envoi)", async () => {
    d.subFindMany.mockResolvedValue([{ id: "fiche-1", details: APPORTEUR }]);
    await passerInvitationsAuto(MAINTENANT);
    expect(d.subUpdateMany).not.toHaveBeenCalled();
  });

  it("un échec PASSAGER n'est pas marqué : le passage suivant réessaie", async () => {
    d.subFindMany.mockResolvedValue([{ id: "f3", details: APPORTEUR }]);
    d.envoyer.mockResolvedValue({ ok: false, erreur: "file-indisponible", message: "x" });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.aReessayer).toBe(1);
    expect(d.subUpdate).not.toHaveBeenCalled();
  });

  it("une candidature à une offre commerciale devient une fiche, invitée, et la candidature le dit", async () => {
    d.jobFindMany.mockResolvedValue([{ id: "ja1" }]);
    d.creer.mockResolvedValue({ ok: true, submissionId: "s-auto" });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.creer).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "ja1", acteurId: null, automatique: true }),
    );
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "s-auto", adminId: null }),
    );
    expect(r.fichesCreees).toBe(1);
    expect(r.envoyees).toBe(1);
    expect(d.consigner).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "ja1", authorId: null }),
    );
  });

  it("une candidature dont la personne est déjà dans le tunnel n'envoie rien", async () => {
    d.jobFindMany.mockResolvedValue([{ id: "ja2" }]);
    d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "exist" });
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("sans lien Calendly configuré, rien ne part", async () => {
    delete process.env["CALENDLY_APPORTEUR_URL"];
    d.subFindMany.mockResolvedValue([{ id: "f4", details: APPORTEUR }]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.suspendu).toBe("lien-absent");
    expect(d.envoyer).not.toHaveBeenCalled();
  });
});
