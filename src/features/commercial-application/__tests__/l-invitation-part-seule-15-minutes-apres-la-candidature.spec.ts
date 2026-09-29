// Décision Will du 2026-09-28 : toute candidature d'apporteur, et toute
// candidature à une offre COMMERCIALE, reçoit l'invitation du tunnel 15 minutes
// après sa réception. Ce qui compte ici : la fenêtre (ni avant 15 minutes, ni
// les anciennes), le périmètre (jamais la saisie manuelle), et qu'une fiche ne
// soit invitée qu'une fois — sauf échec passager, repris au passage suivant.
//
// Resserré le 2026-09-29 (décision Will) : côté site, SEUL le dossier complet
// est invité. Le premier contact du formulaire court et le contact capturé à
// l'écran 1 gardent leur kit et leurs rappels, sans invitation automatique.

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
// Les trois entrées du site, telles que leurs producteurs les écrivent.
/** `actions.ts` — le dossier complet (neuf écrans). */
const DOSSIER_COMPLET = { ...APPORTEUR, source: "/devenir-commercial-ia/candidature" };
/** `lead-actions.ts` — le formulaire court de /apporteur-affaires. */
const PREMIER_CONTACT = { ...APPORTEUR, etape: "premier-contact", source: "/apporteur-affaires" };
/** `capture-actions.ts` — l'écran 1 du dossier, dossier pas terminé. */
const ECRAN_1 = { ...APPORTEUR, etape: "premier-contact", origine: "ecran-1-du-dossier" };
/** `fiche-apporteur-depuis-candidature.ts` — passage automatique d'une offre commerciale. */
const OFFRE_AUTO = {
  ...APPORTEUR,
  etape: "premier-contact",
  origine: "candidature-offre-emploi",
  creationAutomatique: true,
};

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
  it("le dossier complet est invité", () => {
    expect(ficheEligible(DOSSIER_COMPLET)).toBe(true);
  });
  it("le premier contact du formulaire court n'est PAS invité (29/09)", () => {
    expect(ficheEligible(PREMIER_CONTACT)).toBe(false);
  });
  it("le contact capturé à l'écran 1 n'est PAS invité (29/09)", () => {
    expect(ficheEligible(ECRAN_1)).toBe(false);
  });
  it("une fiche sans source de dossier (import de CV, ancienne forme) n'est pas invitée", () => {
    expect(ficheEligible(APPORTEUR)).toBe(false);
    expect(ficheEligible({ ...APPORTEUR, sourceConnaissance: "indeed" })).toBe(false);
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
    expect(ficheEligible(OFFRE_AUTO)).toBe(true);
  });
  it("une fiche déjà traitée par le passage ne l'est jamais deux fois", () => {
    expect(ficheEligible({ ...DOSSIER_COMPLET, invitationAuto: { issue: "envoyee" } })).toBe(false);
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
    d.subFindMany.mockResolvedValue([{ id: "f1", details: DOSSIER_COMPLET }]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "f1", adminId: null }),
    );
    expect(r.envoyees).toBe(1);
    const data = d.subUpdate.mock.calls[0]?.[0]?.data;
    expect(data.details.invitationAuto.issue).toBe("envoyee");
  });

  it("ne lit en base que les dossiers complets et les fiches d'offre automatiques", async () => {
    await passerInvitationsAuto(MAINTENANT);
    const and = d.subFindMany.mock.calls[0]?.[0]?.where.AND;
    expect(and).toContainEqual({
      OR: [
        { details: { path: ["source"], equals: "/devenir-commercial-ia/candidature" } },
        { details: { path: ["creationAutomatique"], equals: true } },
      ],
    });
  });

  it("premier contact et écran 1 reçus il y a 20 minutes : aucune invitation", async () => {
    d.subFindMany.mockResolvedValue([
      { id: "lead", details: PREMIER_CONTACT },
      { id: "e1", details: ECRAN_1 },
    ]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
    expect(d.subUpdate).not.toHaveBeenCalled();
    expect(r.envoyees).toBe(0);
  });

  it("le dossier complet d'une personne venue par le formulaire court est invité, une fois", async () => {
    // Le dossier est une NOUVELLE ligne : son `submittedAt` est l'heure du
    // dossier, même si le premier contact date d'un mois (hors fenêtre).
    d.subFindMany.mockResolvedValue([
      { id: "lead", details: PREMIER_CONTACT },
      { id: "dossier", details: DOSSIER_COMPLET },
    ]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledTimes(1);
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "dossier", adminId: null }),
    );
    expect(r.envoyees).toBe(1);
  });

  it("une fiche d'offre commerciale à reprendre (échec passager) est toujours invitée", async () => {
    d.subFindMany.mockResolvedValue([{ id: "offre", details: OFFRE_AUTO }]);
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledWith(expect.objectContaining({ submissionId: "offre" }));
  });

  it("une saisie manuelle n'est jamais envoyée", async () => {
    d.subFindMany.mockResolvedValue([
      { id: "m1", details: { ...APPORTEUR, origine: "saisie-manuelle" } },
    ]);
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("un refus définitif (déjà invitée) est marqué : la fiche n'est plus reprise", async () => {
    d.subFindMany.mockResolvedValue([{ id: "f2", details: DOSSIER_COMPLET }]);
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
    d.subFindMany.mockResolvedValue([{ id: "f3", details: DOSSIER_COMPLET }]);
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

  describe("offre commerciale d'une personne qui a DÉJÀ une fiche (29/09)", () => {
    const FICHE_VIVANTE = { deletedAt: null, archivedAt: null, status: "new" };

    it("un premier contact antérieur n'empêche plus l'invitation : sa fiche est invitée", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja2" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "lead" });
      d.subFindUnique.mockResolvedValue({ ...FICHE_VIVANTE, details: PREMIER_CONTACT });
      const r = await passerInvitationsAuto(MAINTENANT);
      expect(d.envoyer).toHaveBeenCalledTimes(1);
      expect(d.envoyer).toHaveBeenCalledWith(
        expect.objectContaining({ submissionId: "lead", adminId: null }),
      );
      expect(r.envoyees).toBe(1);
      expect(r.fichesCreees).toBe(0);
      // Marquée : le passage suivant ne la reprend pas.
      const data = d.subUpdate.mock.calls[0]?.[0]?.data;
      expect(data.details.invitationAuto.issue).toBe("envoyee");
      expect(d.consigner).toHaveBeenCalledWith(expect.objectContaining({ applicationId: "ja2" }));
    });

    it("même chose pour un contact capturé à l'écran 1", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja3" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "e1" });
      d.subFindUnique.mockResolvedValue({ ...FICHE_VIVANTE, details: ECRAN_1 });
      await passerInvitationsAuto(MAINTENANT);
      expect(d.envoyer).toHaveBeenCalledWith(expect.objectContaining({ submissionId: "e1" }));
    });

    it("une fiche déjà passée par l'invitation automatique n'est pas reprise à chaque passage", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja4" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "lead" });
      d.subFindUnique.mockResolvedValue({
        ...FICHE_VIVANTE,
        details: { ...PREMIER_CONTACT, invitationAuto: { issue: "envoyee" } },
      });
      await passerInvitationsAuto(MAINTENANT);
      expect(d.envoyer).not.toHaveBeenCalled();
      expect(d.subUpdate).not.toHaveBeenCalled();
    });

    it("une fiche archivée, effacée ou rangée par Will n'est pas invitée", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja5" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "lead" });
      for (const etat of [
        { ...FICHE_VIVANTE, archivedAt: new Date() },
        { ...FICHE_VIVANTE, deletedAt: new Date() },
        { ...FICHE_VIVANTE, status: "archived" },
      ]) {
        d.subFindUnique.mockResolvedValue({ ...etat, details: PREMIER_CONTACT });
        await passerInvitationsAuto(MAINTENANT);
      }
      expect(d.envoyer).not.toHaveBeenCalled();
    });

    it("la personne déjà invitée n'en reçoit pas une seconde : le refus est marqué", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja6" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "doublon", submissionId: "lead" });
      d.subFindUnique.mockResolvedValue({ ...FICHE_VIVANTE, details: PREMIER_CONTACT });
      d.envoyer.mockResolvedValue({ ok: false, erreur: "deja-invitee", message: "x" });
      const r = await passerInvitationsAuto(MAINTENANT);
      expect(r.envoyees).toBe(0);
      expect(r.ecartees["deja-invitee"]).toBe(1);
      expect(d.subUpdate).toHaveBeenCalledTimes(1);
    });

    it("un autre refus de création (candidature illisible) n'envoie rien", async () => {
      d.jobFindMany.mockResolvedValue([{ id: "ja7" }]);
      d.creer.mockResolvedValue({ ok: false, erreur: "illisible" });
      const r = await passerInvitationsAuto(MAINTENANT);
      expect(d.envoyer).not.toHaveBeenCalled();
      expect(r.ecartees["candidature-illisible"]).toBe(1);
    });
  });

  it("sans lien Calendly configuré, rien ne part", async () => {
    delete process.env["CALENDLY_APPORTEUR_URL"];
    d.subFindMany.mockResolvedValue([{ id: "f4", details: DOSSIER_COMPLET }]);
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.suspendu).toBe("lien-absent");
    expect(d.envoyer).not.toHaveBeenCalled();
  });
});
