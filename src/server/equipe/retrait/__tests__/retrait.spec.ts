/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tm: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  ev: { create: vi.fn(), deleteMany: vi.fn() },
  ce: { createMany: vi.fn(), deleteMany: vi.fn() },
  inv: { findMany: vi.fn(), deleteMany: vi.fn() },
  sub: { findMany: vi.fn(), deleteMany: vi.fn() },
  rate: vi.fn(),
  turnstile: vi.fn(),
  retirerPhoto: vi.fn(),
  purger: vi.fn(),
  notify: vi.fn(),
  revalider: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamMember: m.tm,
    teamMemberEvent: m.ev,
    consentEvent: m.ce,
    teamQuestionnaireInvite: m.inv,
    teamQuestionnaireSubmission: m.sub,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: m.turnstile }));
vi.mock("@/server/notifications", () => ({ notify: m.notify }));
vi.mock("@/lib/equipe/revalider", () => ({ revaliderFicheEquipe: m.revalider }));
vi.mock("@/lib/email/client", () => ({ sendEmail: m.sendEmail }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (s: string) => s.replace("enc:", "") }));
vi.mock("../../photo-collaborateur", () => ({
  retirerPhotoCollaborateur: m.retirerPhoto,
  purgerFichiers: m.purger,
}));

import { genererJetonQuestionnaire, hacherJetonQuestionnaire } from "../../questionnaire/jeton";
import {
  clePersonneInvitation,
  effacerDefinitivement,
  lireLienRetrait,
  remettreLienRetrait,
  retirerParLien,
  retirerUnConsentement,
} from "../retrait";

const JETON = genererJetonQuestionnaire();
const HASH = hacherJetonQuestionnaire(JETON);
const ID = "11111111-1111-4111-8111-111111111111";
const INVITE = "22222222-2222-4222-8222-222222222222";

const fiche = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "manon-lyon",
  firstName: "Manon",
  status: "publie",
  erasureRequestedAt: null,
  photoKind: "reelle",
  photoConsentAt: new Date(),
  photoUrl256: "/api/equipe/photo/" + "a".repeat(32) + "/256",
  photoUrl1024: null,
  photoStoragePath: "/prive/x/original.jpg",
  linkedinConsentAt: new Date(),
  linkedinUrl: "https://www.linkedin.com/in/x",
  contactEmailHash: "h".repeat(64),
  withdrawTokenHash: HASH,
  updatedAt: new Date(),
  ...over,
});

const entree = (over: Record<string, unknown> = {}) => ({
  jeton: JETON,
  portee: "total",
  turnstile: "ok",
  ip: "203.0.113.9",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ allowed: true });
  m.turnstile.mockResolvedValue(true);
  m.tm.findUnique.mockResolvedValue(fiche());
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.retirerPhoto.mockResolvedValue({ ok: true, slug: "manon-lyon" });
  m.purger.mockResolvedValue(0);
  m.ev.create.mockResolvedValue({});
  m.ev.deleteMany.mockResolvedValue({ count: 0 });
  m.ce.createMany.mockResolvedValue({ count: 1 });
  m.ce.deleteMany.mockResolvedValue({ count: 0 });
  m.sub.deleteMany.mockResolvedValue({ count: 0 });
  m.inv.deleteMany.mockResolvedValue({ count: 0 });
  m.tm.update.mockResolvedValue({});
  m.tm.delete.mockResolvedValue({});
  m.sendEmail.mockResolvedValue(undefined);
  m.notify.mockResolvedValue({ ok: true });
  m.inv.findMany.mockResolvedValue([{ id: INVITE, emailHash: null }]);
  m.sub.findMany.mockResolvedValue([{ photoStoragePath: "/prive/y/original.png" }]);
});

describe("lien de retrait : jeton", () => {
  it("un jeton mal formé ne touche pas la base", async () => {
    expect(await lireLienRetrait("court")).toEqual({ etat: "neutre" });
    expect(await retirerParLien(entree({ jeton: "court" }))).toEqual({
      ok: false,
      motif: "neutre",
    });
    expect(m.tm.findUnique).not.toHaveBeenCalled();
  });

  it("la fiche est trouvée par l'empreinte du jeton, jamais par le jeton en clair", async () => {
    await lireLienRetrait(JETON);
    expect(m.tm.findUnique).toHaveBeenCalledWith({ where: { withdrawTokenHash: HASH } });
  });

  it.each([
    ["inconnu", null],
    ["déjà retirée", fiche({ status: "retire" })],
    ["effacement en cours", fiche({ erasureRequestedAt: new Date() })],
  ])("jeton %s : même message neutre, rien n'est écrit", async (_n, ligne) => {
    m.tm.findUnique.mockResolvedValue(ligne);
    expect(await lireLienRetrait(JETON)).toEqual({ etat: "neutre" });
    expect(await retirerParLien(entree())).toEqual({ ok: false, motif: "neutre" });
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });

  it("Turnstile et limites sont exigés avant toute lecture", async () => {
    m.turnstile.mockResolvedValue(false);
    expect(await retirerParLien(entree())).toEqual({ ok: false, motif: "turnstile" });
    m.turnstile.mockResolvedValue(true);
    m.rate.mockResolvedValue({ allowed: false });
    expect(await retirerParLien(entree())).toEqual({ ok: false, motif: "limite" });
    expect(m.tm.findUnique).not.toHaveBeenCalled();
  });

  it("une portée inconnue est refusée", async () => {
    expect(await retirerParLien(entree({ portee: "tout" }))).toEqual({
      ok: false,
      motif: "invalide",
    });
  });
});

describe("retrait TOTAL par lien", () => {
  it("retire la fiche, l'accord, la carte ; consomme le jeton ; revalide ; alerte", async () => {
    expect(await retirerParLien(entree())).toEqual({ ok: true, portee: "total" });
    const appel = m.tm.updateMany.mock.calls[0]![0];
    expect(appel.where).toMatchObject({ id: ID, withdrawTokenHash: HASH });
    expect(appel.data).toMatchObject({
      status: "retire",
      withdrawnBy: "personne",
      publicationConsentAt: null,
      showOnMap: false,
      withdrawTokenHash: null,
    });
    expect(m.revalider).toHaveBeenCalledWith("manon-lyon");
    expect(m.notify).toHaveBeenCalledTimes(1);
    expect(m.ce.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      action: "optout",
      formRef: "team-profile-publication",
    });
    // Le journal ne porte que la portée.
    expect(m.ev.create.mock.calls[0]![0].data.details).toEqual({ portee: "total" });
  });

  it("un second usage du même lien (course) est neutre", async () => {
    m.tm.updateMany.mockResolvedValue({ count: 0 });
    expect(await retirerParLien(entree())).toEqual({ ok: false, motif: "neutre" });
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("une panne de l'alerte ne défait pas le retrait", async () => {
    m.notify.mockRejectedValue(new Error("telegram"));
    expect(await retirerParLien(entree())).toEqual({ ok: true, portee: "total" });
  });
});

describe("retrait PARTIEL par lien", () => {
  it("photo seule : passe par le retrait de photo (avatar), la fiche reste publiée", async () => {
    expect(await retirerParLien(entree({ portee: "photo" }))).toEqual({
      ok: true,
      portee: "photo",
    });
    expect(m.retirerPhoto).toHaveBeenCalledWith({ memberId: ID, acteur: "personne" });
    expect(m.tm.updateMany).not.toHaveBeenCalled();
    expect(m.revalider).toHaveBeenCalledWith("manon-lyon");
  });

  it("LinkedIn seul : lien et accord effacés, statut intact, jeton conservé", async () => {
    expect(await retirerParLien(entree({ portee: "linkedin" }))).toEqual({
      ok: true,
      portee: "linkedin",
    });
    const data = m.tm.updateMany.mock.calls[0]![0].data;
    expect(data).toEqual({
      linkedinUrl: null,
      linkedinConsentAt: null,
      linkedinConsentVersion: null,
    });
  });
});

describe("remise du lien à la publication", () => {
  it("pose l'empreinte (jamais le jeton) et envoie le lien à l'adresse de la fiche", async () => {
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      firstName: "Manon",
      contactEmailEnc: "enc:manon@example.org",
    });
    expect(await remettreLienRetrait(ID)).toEqual({ ok: true });
    const hash = m.tm.update.mock.calls[0]![0].data.withdrawTokenHash as string;
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const mail = m.sendEmail.mock.calls[0]![0];
    expect(mail.to).toBe("manon@example.org");
    const jeton = /retrait\/([A-Za-z0-9_-]{43})/.exec(mail.text)![1]!;
    expect(hacherJetonQuestionnaire(jeton)).toBe(hash);
  });

  it("sans adresse : rien n'est posé", async () => {
    m.tm.findUnique.mockResolvedValue({ id: ID, firstName: "Manon", contactEmailEnc: null });
    expect(await remettreLienRetrait(ID)).toEqual({ ok: false, raison: "sans_email" });
    expect(m.tm.update).not.toHaveBeenCalled();
  });

  it("e-mail non parti : l'empreinte est retirée", async () => {
    m.tm.findUnique.mockResolvedValue({
      id: ID,
      firstName: "Manon",
      contactEmailEnc: "enc:manon@example.org",
    });
    m.sendEmail.mockRejectedValue(new Error("smtp"));
    expect(await remettreLienRetrait(ID)).toEqual({ ok: false, raison: "envoi" });
    expect(m.tm.updateMany.mock.calls[0]![0].data).toEqual({ withdrawTokenHash: null });
  });
});

describe("retrait d'un seul consentement (console)", () => {
  it("« total » = retrait + accord de publication retiré : republier exige un NOUVEL accord", async () => {
    const r = await retirerUnConsentement({ memberId: ID, consentement: "total", acteur: "adm" });
    expect(r).toEqual({ ok: true, slug: "manon-lyon" });
    expect(m.tm.updateMany.mock.calls[0]![0].data).toMatchObject({
      status: "retire",
      withdrawnBy: "admin",
      publicationConsentAt: null,
    });
  });

  it("une fiche en cours d'effacement est refusée", async () => {
    m.tm.findUnique.mockResolvedValue(fiche({ erasureRequestedAt: new Date() }));
    const r = await retirerUnConsentement({ memberId: ID, consentement: "photo", acteur: "adm" });
    expect(r.ok).toBe(false);
  });
});

describe("effacement RÉEL", () => {
  const demande = (over: Record<string, unknown> = {}) => ({
    memberId: ID,
    confirmation: "EFFACER",
    acteur: "adm",
    ...over,
  });

  it("exige la confirmation explicite, avant toute lecture", async () => {
    const r = await effacerDefinitivement(demande({ confirmation: "oui" }));
    expect(r.ok).toBe(false);
    expect(m.tm.findUnique).not.toHaveBeenCalled();
  });

  it("supprime fiche, réponses, invitations, journal, preuves et fichiers", async () => {
    const r = await effacerDefinitivement(demande({ demandeLe: "2026-11-01T08:00:00.000Z" }));
    expect(r).toEqual({ ok: true });
    // originaux privés + variantes publiques de la fiche, et photo de chaque réponse
    expect(m.purger).toHaveBeenCalledTimes(2);
    expect(m.sub.deleteMany).toHaveBeenCalledWith({ where: { memberId: ID } });
    expect(m.inv.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [INVITE] } } });
    expect(m.ev.deleteMany).toHaveBeenCalledWith({ where: { memberId: ID } });
    expect(m.tm.delete).toHaveBeenCalledWith({ where: { id: ID } });
    const cles = m.ce.deleteMany.mock.calls[0]![0].where.personKey.in as string[];
    expect(cles).toContain("h".repeat(64));
    expect(cles).toContain(clePersonneInvitation(INVITE));
    expect(m.ce.deleteMany.mock.calls[0]![0].where.formRef).toEqual({
      startsWith: "team-profile-",
    });
    expect(m.revalider).toHaveBeenCalledWith("manon-lyon");
  });

  it("ne garde qu'une trace minimale : deux dates, aucun prénom, slug, e-mail ni identifiant", async () => {
    await effacerDefinitivement(demande({ demandeLe: "2026-11-01T08:00:00.000Z" }));
    const trace = m.ev.create.mock.calls[0]![0].data;
    expect(trace).toMatchObject({ memberId: null, action: "effacement", actor: "adm" });
    expect(Object.keys(trace.details).sort()).toEqual(["demandeLe", "traiteLe"]);
    const brut = JSON.stringify(trace);
    expect(brut).not.toMatch(/Manon|manon|lyon|@|h{10}/);
    expect(brut).not.toContain(ID);
    expect(trace.details.demandeLe).toBe("2026-11-01T08:00:00.000Z");
  });

  it("un fichier qui résiste : RIEN n'est supprimé en base", async () => {
    m.purger.mockResolvedValueOnce(1);
    const r = await effacerDefinitivement(demande());
    expect(r.ok).toBe(false);
    expect(m.tm.delete).not.toHaveBeenCalled();
    expect(m.sub.deleteMany).not.toHaveBeenCalled();
    expect(m.ce.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse une date de demande dans le futur", async () => {
    const r = await effacerDefinitivement(demande({ demandeLe: "2999-01-01" }));
    expect(r.ok).toBe(false);
    expect(m.tm.delete).not.toHaveBeenCalled();
  });

  it("fiche inconnue : rien n'est supprimé", async () => {
    m.tm.findUnique.mockResolvedValue(null);
    expect((await effacerDefinitivement(demande())).ok).toBe(false);
    expect(m.tm.delete).not.toHaveBeenCalled();
  });
});
