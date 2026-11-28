/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  inv: { findUnique: vi.fn(), updateMany: vi.fn() },
  tm: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  sub: { create: vi.fn() },
  ev: { create: vi.fn() },
  ce: { createMany: vi.fn() },
  city: { findMany: vi.fn() },
  ap: { findUnique: vi.fn() },
  rate: vi.fn(),
  turnstile: vi.fn(),
  photo: vi.fn(),
  retirer: vi.fn(),
  traiter: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamQuestionnaireInvite: m.inv,
    teamMember: m.tm,
    teamQuestionnaireSubmission: m.sub,
    teamMemberEvent: m.ev,
    consentEvent: m.ce,
    city: m.city,
    authorProfile: m.ap,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: m.turnstile }));
vi.mock("../../photo-collaborateur", () => ({
  deposerPhotoCollaborateur: m.photo,
  retirerPhotoCollaborateur: m.retirer,
  traiterPhoto: m.traiter,
}));

import { genererJetonQuestionnaire, hacherJetonQuestionnaire } from "../jeton";
import { lireInvitation, soumettreQuestionnaire } from "../questionnaire";

const JETON = genererJetonQuestionnaire();
const HASH = hacherJetonQuestionnaire(JETON);
const INVITE_ID = "22222222-2222-4222-8222-222222222222";
const dans = (ms: number) => new Date(Date.now() + ms);

const invite = (over: Record<string, unknown> = {}) => ({
  id: INVITE_ID,
  memberId: null,
  category: "apporteur",
  questionnaireVersion: "v1",
  tokenHash: HASH,
  emailHash: null,
  expiresAt: dans(86_400_000),
  firstOpenedAt: null,
  usedAt: null,
  revokedAt: null,
  ...over,
});

const longue = "a".repeat(320);
function reponse(over: Record<string, unknown> = {}) {
  return {
    commun: {
      prenom: "Julie",
      lieu: "Annecy",
      intitule: "Je présente Axion IA aux dirigeants",
      presentation: longue,
      apport: "Je mets en relation les dirigeants.",
      langues: ["français"],
      souhaitCarte: true,
    },
    categorie: {
      metier_precedent: "Comptable pendant dix ans",
      entreprises_connues: "PME du bâtiment",
      pourquoi_axion: "Parce que c'est utile",
      premier_echange: "Un café, puis un appel",
      promesse: "Une mise en relation",
    },
    consentements: { publication: true, photo: false, linkedin: false },
    ...over,
  };
}
const entree = (over: Record<string, unknown> = {}) => ({
  jeton: JETON,
  reponse: reponse(),
  attestation: true,
  photo: null,
  turnstile: "ok",
  ip: "203.0.113.9",
  userAgent: "test",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.inv.findUnique.mockResolvedValue(invite());
  m.inv.updateMany.mockResolvedValue({ count: 1 });
  m.rate.mockResolvedValue({ allowed: true, count: 1, remaining: 4, resetAt: 0, panne: false });
  m.turnstile.mockResolvedValue(true);
  m.tm.findUnique.mockResolvedValue(null);
  m.tm.findFirst.mockResolvedValue(null);
  m.tm.create.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    slug: "julie-annecy",
  });
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.sub.create.mockResolvedValue({});
  m.ev.create.mockResolvedValue({});
  m.ce.createMany.mockResolvedValue({ count: 3 });
  m.ap.findUnique.mockResolvedValue(null);
  m.city.findMany.mockResolvedValue([]);
  m.traiter.mockResolvedValue({ ok: true });
  m.photo.mockResolvedValue({ ok: true, slug: "julie-annecy" });
  m.retirer.mockResolvedValue({ ok: true, slug: "julie" });
});

describe("lireInvitation : message neutre identique", () => {
  it("cherche par le hash du jeton, jamais par le jeton", async () => {
    const r = await lireInvitation(JETON);
    expect(r.etat).toBe("ok");
    expect(m.inv.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: HASH } }),
    );
  });
  it("note la première ouverture", async () => {
    await lireInvitation(JETON);
    expect(m.inv.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INVITE_ID, firstOpenedAt: null } }),
    );
  });
  it.each([
    ["inconnue", null],
    ["expirée", invite({ expiresAt: dans(-1000) })],
    ["révoquée", invite({ revokedAt: new Date() })],
    ["déjà utilisée", invite({ usedAt: new Date() })],
  ])("invitation %s : même réponse neutre", async (_n, valeur) => {
    m.inv.findUnique.mockResolvedValue(valeur);
    expect(await lireInvitation(JETON)).toEqual({ etat: "neutre" });
  });
  it("un jeton mal formé ne touche pas la base", async () => {
    expect(await lireInvitation("../../etc")).toEqual({ etat: "neutre" });
    expect(m.inv.findUnique).not.toHaveBeenCalled();
  });
});

describe("soumettreQuestionnaire", () => {
  it("crée la fiche À VALIDER, jamais publiée, avec soumission, consentements et attestation", async () => {
    const r = await soumettreQuestionnaire(entree());
    expect(r.ok).toBe(true);
    const data = m.tm.create.mock.calls[0]![0].data;
    expect(data.status).toBe("a_valider");
    expect(data.publishedAt).toBeUndefined();
    expect(data.showOnMap).toBeFalsy();
    expect(data.firstName).toBe("Julie");
    expect(data.publicationConsentVersion).toBe("team-publication-v1");
    expect(m.sub.create).toHaveBeenCalledTimes(1);
    const evenements = m.ce.createMany.mock.calls[0]![0].data as Array<{
      formRef: string;
      consentVersion: string;
    }>;
    expect(evenements.map((e) => e.formRef).sort()).toEqual([
      "team-profile-attestation",
      "team-profile-publication",
    ]);
    expect(evenements.find((e) => e.formRef === "team-profile-attestation")!.consentVersion).toBe(
      "team-attestation-v1",
    );
  });
  it("trace un consentement par case cochée (photo, LinkedIn)", async () => {
    await soumettreQuestionnaire(
      entree({
        reponse: reponse({
          commun: {
            ...reponse().commun,
            linkedin: "https://www.linkedin.com/in/julie-test",
          },
          consentements: { publication: true, photo: true, linkedin: true },
        }),
      }),
    );
    const refs = (m.ce.createMany.mock.calls[0]![0].data as Array<{ formRef: string }>).map(
      (e) => e.formRef,
    );
    expect(refs).toEqual(
      expect.arrayContaining([
        "team-profile-publication",
        "team-profile-photo",
        "team-profile-linkedin",
        "team-profile-attestation",
      ]),
    );
    expect(m.tm.create.mock.calls[0]![0].data.linkedinUrl).toBe(
      "https://www.linkedin.com/in/julie-test",
    );
  });
  it("sans l'attestation : refus, rien d'écrit", async () => {
    const r = await soumettreQuestionnaire(entree({ attestation: false }));
    expect(r).toMatchObject({ ok: false, motif: "invalide" });
    expect(m.inv.updateMany).not.toHaveBeenCalled();
    expect(m.tm.create).not.toHaveBeenCalled();
  });
  it("sans consentement de publication : refus côté serveur", async () => {
    const r = await soumettreQuestionnaire(
      entree({
        reponse: reponse({ consentements: { publication: false, photo: false, linkedin: false } }),
      }),
    );
    expect(r).toMatchObject({ ok: false, motif: "invalide" });
    expect(m.tm.create).not.toHaveBeenCalled();
  });
  it("refuse un nom de famille dans le prénom et un LinkedIn hors domaine", async () => {
    const a = await soumettreQuestionnaire(
      entree({ reponse: reponse({ commun: { ...reponse().commun, prenom: "Julie Martin" } }) }),
    );
    expect(a.ok).toBe(false);
    const b = await soumettreQuestionnaire(
      entree({
        reponse: reponse({
          commun: { ...reponse().commun, linkedin: "https://evil.example/in/x" },
          consentements: { publication: true, photo: false, linkedin: true },
        }),
      }),
    );
    expect(b.ok).toBe(false);
  });
  it("Turnstile refusé : rien d'écrit", async () => {
    m.turnstile.mockResolvedValue(false);
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "turnstile" });
    expect(m.tm.create).not.toHaveBeenCalled();
  });
  it("limite de débit dépassée : rien d'écrit", async () => {
    m.rate.mockResolvedValue({ allowed: false, count: 6, remaining: 0, resetAt: 0, panne: false });
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "limite" });
    expect(m.tm.create).not.toHaveBeenCalled();
  });
  it("usage unique : un double envoi simultané ne passe qu'une fois", async () => {
    m.inv.updateMany.mockResolvedValue({ count: 0 });
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "neutre" });
    expect(m.tm.create).not.toHaveBeenCalled();
    expect(m.sub.create).not.toHaveBeenCalled();
    expect(m.inv.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: INVITE_ID, usedAt: null, revokedAt: null }),
      }),
    );
  });
  it("invitation expirée ou inconnue : message neutre, aucun jeton limité", async () => {
    m.inv.findUnique.mockResolvedValue(null);
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "neutre" });
  });
  it("fiche DÉJÀ PUBLIÉE : conservée telle quelle, réponse gardée, jamais écrasée", async () => {
    m.inv.findUnique.mockResolvedValue(
      invite({ memberId: "44444444-4444-4444-8444-444444444444" }),
    );
    m.tm.findUnique.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      slug: "julie-annecy",
      status: "publie",
      category: "apporteur",
      erasureRequestedAt: null,
    });
    const r = await soumettreQuestionnaire(entree());
    expect(r.ok).toBe(true);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
    expect(m.tm.create).not.toHaveBeenCalled();
    expect(m.sub.create).toHaveBeenCalledTimes(1);
  });
  it("fiche existante non publiée : mise à jour en « a_valider »", async () => {
    m.inv.findUnique.mockResolvedValue(
      invite({ memberId: "44444444-4444-4444-8444-444444444444" }),
    );
    m.tm.findUnique.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      slug: "julie",
      status: "brouillon",
      category: "apporteur",
      erasureRequestedAt: null,
    });
    await soumettreQuestionnaire(entree());
    expect(m.tm.updateMany.mock.calls[0]![0].data.status).toBe("a_valider");
  });
  it("fiche en cours d'effacement : message neutre, rien d'écrit", async () => {
    m.inv.findUnique.mockResolvedValue(
      invite({ memberId: "44444444-4444-4444-8444-444444444444" }),
    );
    m.tm.findUnique.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      status: "brouillon",
      erasureRequestedAt: new Date(),
    });
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "neutre" });
    expect(m.sub.create).not.toHaveBeenCalled();
  });
  it("photo sans case « photo » cochée : refusée avant toute écriture", async () => {
    const r = await soumettreQuestionnaire(entree({ photo: Buffer.from("x") }));
    expect(r).toMatchObject({ ok: false, motif: "invalide" });
    expect(m.inv.updateMany).not.toHaveBeenCalled();
  });
  it("photo avec accord : déposée après la transaction par la fonction de la console", async () => {
    await soumettreQuestionnaire(
      entree({
        photo: Buffer.from("x"),
        reponse: reponse({ consentements: { publication: true, photo: true, linkedin: false } }),
      }),
    );
    expect(m.photo).toHaveBeenCalledWith(
      expect.objectContaining({ acteur: "questionnaire", memberId: expect.any(String) }),
    );
  });

  it("une case « photo » décochée retire l'accord et la photo antérieurs, et le trace", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    m.inv.findUnique.mockResolvedValue(invite({ memberId: id }));
    m.tm.findUnique.mockResolvedValue({
      id,
      slug: "julie",
      status: "brouillon",
      category: "apporteur",
      erasureRequestedAt: null,
      photoConsentAt: new Date(),
      linkedinConsentAt: null,
      photoKind: "reelle",
      photoStoragePath: "/p",
      contactEmailHash: null,
    });
    await soumettreQuestionnaire(entree());
    const data = m.tm.updateMany.mock.calls[0]![0].data;
    expect(data.photoConsentAt).toBeNull();
    expect(data.linkedinConsentAt).toBeNull();
    expect(m.retirer).toHaveBeenCalledWith(expect.objectContaining({ memberId: id }));
    const evts = m.ce.createMany.mock.calls[0]![0].data as Array<{
      formRef: string;
      action: string;
    }>;
    expect(evts.some((e) => e.formRef === "team-profile-photo" && e.action === "optout")).toBe(
      true,
    );
  });
  it("la mise à jour ne touche jamais une fiche devenue publiée entre-temps", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    m.inv.findUnique.mockResolvedValue(invite({ memberId: id }));
    m.tm.findUnique.mockResolvedValue({
      id,
      slug: "julie",
      status: "brouillon",
      category: "apporteur",
      erasureRequestedAt: null,
      photoConsentAt: null,
      linkedinConsentAt: null,
      photoKind: "avatar",
      photoStoragePath: null,
      contactEmailHash: null,
    });
    await soumettreQuestionnaire(entree());
    expect(m.tm.updateMany.mock.calls[0]![0].where).toMatchObject({ status: { not: "publie" } });
  });
  it("invitation et fiche de catégories différentes : message neutre", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    m.inv.findUnique.mockResolvedValue(invite({ memberId: id }));
    m.tm.findUnique.mockResolvedValue({
      id,
      slug: "julie",
      status: "brouillon",
      category: "developpeur",
      erasureRequestedAt: null,
    });
    expect(await soumettreQuestionnaire(entree())).toMatchObject({ ok: false, motif: "neutre" });
  });
});
