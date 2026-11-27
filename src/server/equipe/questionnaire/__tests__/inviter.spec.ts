/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  send: vi.fn(),
  inv: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  tm: { findFirst: vi.fn() },
  ev: { create: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/client", () => ({ sendEmail: m.send }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamQuestionnaireInvite: m.inv,
    teamMember: m.tm,
    teamMemberEvent: m.ev,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { inviterCollaborateur, renvoyerInvitation, revoquerInvitation } from "../inviter";
import { hacherJetonQuestionnaire } from "../jeton";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
  m.inv.updateMany.mockResolvedValue({ count: 0 });
  m.inv.create.mockResolvedValue({ id: "inv-1" });
  m.inv.update.mockResolvedValue({});
  m.tm.findFirst.mockResolvedValue(null);
  m.send.mockResolvedValue({ messageId: "x" });
});

describe("inviterCollaborateur", () => {
  it("envoie l'e-mail une seule fois, avec le lien personnel", async () => {
    const r = await inviterCollaborateur({
      categorie: "developpeur",
      email: "Julie@Example.com",
      prenom: "Julie",
      source: "console",
      acteur: "adm-1",
    });
    expect(r).toEqual({ ok: true, inviteId: "inv-1", remplacees: 0 });
    expect(m.send).toHaveBeenCalledTimes(1);
    const mail = m.send.mock.calls[0]![0] as { to: string; text: string; html: string };
    expect(mail.to).toBe("julie@example.com");
    expect(mail.text).toMatch(/https:\/\/axion-ia\.com\/fr\/equipe\/questionnaire\/[\w-]{43}/);
    expect(mail.text).not.toMatch(/€|euro|commission/i);
  });

  it("ne stocke jamais le jeton en clair ni l'adresse en clair dans la ligne", async () => {
    await inviterCollaborateur({ categorie: "apporteur", email: "a@b.fr", source: "console" });
    const data = m.inv.create.mock.calls[0]![0].data as Record<string, unknown>;
    const lien = (m.send.mock.calls[0]![0] as { text: string }).text.match(
      /questionnaire\/([\w-]{43})/,
    )![1]!;
    expect(data.tokenHash).toBe(hacherJetonQuestionnaire(lien));
    expect(JSON.stringify(data)).not.toContain(lien);
    expect(data.emailHash).toMatch(/^[0-9a-f]{64}$/);
    const expire = (data.expiresAt as Date).getTime() - Date.now();
    expect(expire).toBeGreaterThan(13.9 * 86400000);
    expect(expire).toBeLessThan(14.1 * 86400000);
    expect(data.questionnaireVersion).toBe("v1");
  });

  it("révoque l'invitation active du même e-mail et de la même catégorie (idempotence)", async () => {
    m.inv.updateMany.mockResolvedValue({ count: 1 });
    const r = await inviterCollaborateur({
      categorie: "partenaire",
      email: "p@q.fr",
      source: "console",
    });
    expect(r).toMatchObject({ ok: true, remplacees: 1 });
    const w = m.inv.updateMany.mock.calls[0]![0].where;
    expect(w).toMatchObject({ category: "partenaire", usedAt: null, revokedAt: null });
    expect(w.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.inv.updateMany.mock.calls[0]![0].data.revokedAt).toBeInstanceOf(Date);
  });

  it("refuse une adresse ou une catégorie invalide sans rien écrire ni envoyer", async () => {
    expect(
      await inviterCollaborateur({
        categorie: "developpeur",
        email: "pas-un-mail",
        source: "console",
      }),
    ).toEqual({ ok: false, raison: "email" });
    expect(
      await inviterCollaborateur({
        categorie: "inconnue" as never,
        email: "a@b.fr",
        source: "console",
      }),
    ).toEqual({ ok: false, raison: "categorie" });
    expect(m.inv.create).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("si l'envoi échoue, l'invitation est révoquée", async () => {
    m.send.mockRejectedValue(new Error("smtp"));
    const r = await inviterCollaborateur({
      categorie: "direction",
      email: "d@e.fr",
      source: "console",
    });
    expect(r).toEqual({ ok: false, raison: "envoi" });
    expect(m.inv.update.mock.calls[0]![0].data.revokedAt).toBeInstanceOf(Date);
  });

  it("journalise un événement quand l'adresse correspond à une fiche", async () => {
    m.tm.findFirst.mockResolvedValue({ id: "mem-1" });
    await inviterCollaborateur({
      categorie: "developpeur",
      email: "a@b.fr",
      source: "console",
      acteur: "adm",
    });
    const ev = m.ev.create.mock.calls[0]![0].data;
    expect(ev).toMatchObject({ memberId: "mem-1", action: "invitation_envoyee", actor: "adm" });
    expect(JSON.stringify(ev)).not.toContain("a@b.fr");
  });
});

describe("revoquer / renvoyer", () => {
  it("revoquerInvitation ne touche que les invitations actives", async () => {
    m.inv.updateMany.mockResolvedValue({ count: 1 });
    expect(await revoquerInvitation("i")).toBe(true);
    expect(m.inv.updateMany.mock.calls[0]![0].where).toMatchObject({
      id: "i",
      usedAt: null,
      revokedAt: null,
    });
  });

  it("renvoyer refuse une invitation déjà remplie", async () => {
    m.inv.findUnique.mockResolvedValue({
      category: "developpeur",
      contactEmailEnc: "x",
      firstName: null,
      usedAt: new Date(),
      source: "console",
    });
    expect(await renvoyerInvitation("i", "adm")).toMatchObject({ ok: false });
    expect(m.send).not.toHaveBeenCalled();
  });

  it("renvoyer émet un lien neuf à la même adresse", async () => {
    m.inv.findUnique.mockResolvedValue({
      category: "developpeur",
      contactEmailEnc: "j@k.fr",
      firstName: "Jo",
      usedAt: null,
      source: "console",
    });
    expect(await renvoyerInvitation("i", "adm")).toMatchObject({ ok: true });
    expect((m.send.mock.calls[0]![0] as { to: string }).to).toBe("j@k.fr");
  });
});
