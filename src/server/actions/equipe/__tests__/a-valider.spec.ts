/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  tm: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  ev: { create: vi.fn() },
  sub: { updateMany: vi.fn() },
  city: { findUnique: vi.fn(), findMany: vi.fn() },
  ap: { findUnique: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamMember: m.tm,
    teamMemberEvent: m.ev,
    teamQuestionnaireSubmission: m.sub,
    city: m.city,
    authorProfile: m.ap,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { enregistrerEnBrouillon, refuserFiche, validerEtPublier } from "../a-valider";

const ID = "11111111-1111-4111-8111-111111111111";
const VERSION = "2026-11-01T00:00:00.000Z";
const CONSENT = new Date("2026-11-20T10:00:00.000Z");

const membre = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "julie",
  status: "a_valider",
  category: "developpeur",
  firstName: "Julie",
  organizationName: null,
  jobTitle: "Développeuse",
  headline: null,
  bioMd: null,
  skills: [],
  languages: [],
  websiteUrl: null,
  linkedinUrl: null,
  citySlug: null,
  departmentCode: null,
  showOnMap: false,
  sortOrder: 100,
  publishedAt: null,
  withdrawnAt: null,
  publicationConsentAt: CONSENT,
  linkedinConsentAt: null,
  photoConsentAt: null,
  photoKind: "avatar",
  consentSource: "questionnaire",
  consentNote: null,
  erasureRequestedAt: null,
  updatedAt: new Date(VERSION),
  ...over,
});

const fiche = (over: Record<string, unknown> = {}) => ({
  category: "developpeur",
  firstName: "Julie",
  jobTitle: "Développeuse",
  skills: ["TypeScript"],
  languages: ["français"],
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  m.tm.findUnique.mockResolvedValue(membre());
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.ev.create.mockResolvedValue({});
  m.sub.updateMany.mockResolvedValue({ count: 1 });
});

describe("rôle revérifié dans chaque action, avant toute lecture", () => {
  for (const [nom, appel] of [
    ["brouillon", () => enregistrerEnBrouillon(ID, fiche(), VERSION)],
    ["publication", () => validerEtPublier(ID, fiche(), VERSION)],
    ["refus", () => refuserFiche(ID, "Photo inadaptée, à refaire", VERSION)],
  ] as const) {
    it(`${nom} : refusé sans session, pour un éditeur et pour un secrétaire`, async () => {
      for (const session of [
        null,
        { user: { id: "u", role: "editor" } },
        { user: { id: "u", role: "secretaire" } },
      ]) {
        m.auth.mockResolvedValue(session);
        const r = await appel();
        expect(r.ok).toBe(false);
      }
      expect(m.tm.findUnique).not.toHaveBeenCalled();
      expect(m.tm.updateMany).not.toHaveBeenCalled();
    });
  }
});

describe("seules les fiches « à valider » passent par cet écran", () => {
  it.each(["publie", "brouillon", "retire"])("refuse une fiche au statut %s", async (statut) => {
    m.tm.findUnique.mockResolvedValue(membre({ status: statut }));
    expect((await enregistrerEnBrouillon(ID, fiche(), VERSION)).ok).toBe(false);
    expect((await validerEtPublier(ID, fiche(), VERSION)).ok).toBe(false);
    expect((await refuserFiche(ID, "Note de refus claire", VERSION)).ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await refuserFiche("../../etc", "Note de refus claire", VERSION);
    expect(r.ok).toBe(false);
    expect(m.tm.findUnique).not.toHaveBeenCalled();
  });
});

describe("publication", () => {
  it("refuse sans consentement de publication, sans rien écrire", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ publicationConsentAt: null }));
    const r = await validerEtPublier(ID, fiche(), VERSION);
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse une photo réelle sans consentement photo", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ photoKind: "reelle", photoConsentAt: null }));
    const r = await validerEtPublier(ID, fiche(), VERSION);
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("refuse un lien LinkedIn sans consentement LinkedIn", async () => {
    const r = await validerEtPublier(
      ID,
      fiche({ linkedinUrl: "https://www.linkedin.com/in/julie-d" }),
      VERSION,
    );
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("ne laisse pas le formulaire accorder un consentement", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ publicationConsentAt: null }));
    const r = await validerEtPublier(
      ID,
      fiche({ consentPublication: true, consentNote: "Accord reçu de vive voix" }),
      VERSION,
    );
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("publie, journalise, revalide la fiche, le hub et le plan du site", async () => {
    const r = await validerEtPublier(ID, fiche(), VERSION);
    expect(r).toEqual({ ok: true, slug: "julie" });
    const actions = m.ev.create.mock.calls.map((c) => c[0].data.action);
    expect(actions).toContain("publication");
    const statuts = m.tm.updateMany.mock.calls.map((c) => c[0].data.status).filter(Boolean);
    expect(statuts).toContain("publie");
    const chemins = m.revalidatePath.mock.calls.map((c) => c[0]);
    expect(chemins).toEqual(
      expect.arrayContaining(["/fr/equipe/julie", "/fr/equipe", "/sitemap.xml"]),
    );
    expect(m.sub.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "validee" }) }),
    );
  });
});

describe("brouillon", () => {
  it("passe la fiche en brouillon et journalise", async () => {
    const r = await enregistrerEnBrouillon(ID, fiche(), VERSION);
    expect(r.ok).toBe(true);
    const ecritures = m.tm.updateMany.mock.calls.map((c) => c[0]);
    expect(
      ecritures.some((e) => e.data.status === "brouillon" && e.where.status === "a_valider"),
    ).toBe(true);
    expect(m.ev.create.mock.calls.map((c) => c[0].data.action)).toContain("mise_en_brouillon");
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("refus", () => {
  it("exige une note", async () => {
    for (const note of ["", "   ", "court", 12, null]) {
      expect((await refuserFiche(ID, note, VERSION)).ok).toBe(false);
    }
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("renvoie la fiche en brouillon, garde la note et journalise, sans publier", async () => {
    const r = await refuserFiche(ID, "Photo floue, merci de la refaire", VERSION);
    expect(r.ok).toBe(true);
    const e = m.tm.updateMany.mock.calls[0]![0];
    expect(e.where).toMatchObject({ id: ID, status: "a_valider" });
    expect(e.data.status).toBe("brouillon");
    expect(m.ev.create.mock.calls[0]![0].data.action).toBe("refus");
    expect(m.sub.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "refusee",
          reviewNote: "Photo floue, merci de la refaire",
        }),
      }),
    );
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse si la fiche a changé depuis l'affichage", async () => {
    const r = await refuserFiche(
      ID,
      "Photo floue, merci de la refaire",
      "2026-10-01T00:00:00.000Z",
    );
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });
});
