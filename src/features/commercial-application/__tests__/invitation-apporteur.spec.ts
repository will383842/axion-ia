/**
 * L'invitation à l'échange de 15 minutes (2026-09-19) — le seul envoi qui porte
 * le lien de réservation, et il part à la main.
 *
 * Invariants :
 *   1. un lien qui n'est pas https://calendly.com/… ne part JAMAIS ;
 *   2. seule une fiche du réseau d'apporteurs, non effacée, peut être invitée ;
 *   3. le lien du dossier n'est joint que si le dossier n'est pas arrivé ;
 *   4. une adresse RETENUE (désinscription, rebond) n'est jamais dite « envoyée » ;
 *   5. l'envoi retire les rappels devenus redondants et journalise le geste.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const trouver = vi.fn();
const lister = vi.fn();
const journaliser = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: (...a: unknown[]) => trouver(...a),
      findMany: (...a: unknown[]) => lister(...a),
    },
    activityLog: { create: (...a: unknown[]) => journaliser(...a) },
    emailLog: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));

const enfiler = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
  enqueued: true,
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
}));
const annuler = vi.fn(async (..._a: unknown[]) => 2);
vi.mock("../relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annuler(...a),
}));

import { envoyerInvitationApporteur, GABARIT_INVITATION_APPORTEUR } from "../invitation-apporteur";

const LIEN = "https://calendly.com/axion-ia/echange-apporteur";

function fiche(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    locale: "fr",
    contactName: "Nadia Ben",
    contactEmail: "nadia@example.com",
    contactEmailHash: "h-nadia",
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      etape: "premier-contact",
    },
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trouver.mockResolvedValue(fiche());
  lister.mockResolvedValue([{ details: fiche().details }]);
  enfiler.mockResolvedValue({ enqueued: true });
});

const envoyer = (calendlyUrl = LIEN) =>
  envoyerInvitationApporteur({ submissionId: fiche().id, calendlyUrl, adminId: "admin-1" });

describe("envoyerInvitationApporteur", () => {
  it.each([
    "",
    "http://calendly.com/x",
    "https://calendIy.com/x",
    "https://exemple.fr/calendly.com/x",
    "https://calendly.com/",
  ])("refuse le lien « %s » — rien ne part", async (lien) => {
    const r = await envoyer(lien);
    expect(r).toMatchObject({ ok: false, erreur: "lien-invalide" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("envoie l'invitation, avec le lien Calendly et le lien du dossier s'il n'est pas arrivé", async () => {
    const r = await envoyer();
    expect(r).toEqual({ ok: true });
    const [gabarit, dest, locale, payload, options] = enfiler.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe(GABARIT_INVITATION_APPORTEUR);
    expect(dest).toBe("nadia@example.com");
    expect(locale).toBe("fr");
    expect(payload["calendlyUrl"]).toBe(LIEN);
    expect(payload["dossierUrl"]).toBe("https://axion-ia.com/fr/devenir-commercial-ia/candidature");
    // L'historique de la fiche se lit par cette entité — sans elle, « déjà invitée » serait muet.
    expect(options).toMatchObject({ entityType: "Submission", entityId: fiche().id });
  });

  it("ne joint PAS le lien du dossier quand le dossier complet est arrivé (autre ligne de la personne)", async () => {
    lister.mockResolvedValue([
      { details: fiche().details },
      { details: { unifiedType: "recrutement", subType: "candidature-commerciale" } },
    ]);
    await envoyer();
    const payload = enfiler.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("dossierUrl");
  });

  it("refuse une fiche qui n'est pas du réseau d'apporteurs", async () => {
    trouver.mockResolvedValue(fiche({ details: { unifiedType: "contact" } }));
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "pas-un-apporteur" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("refuse une fiche effacée (art. 17) — aucune écriture à une adresse synthétique", async () => {
    trouver.mockResolvedValue(
      fiche({ contactName: "[erased-rgpd-art17]", contactEmail: "erased:abc@erased.local" }),
    );
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "efface" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("une adresse RETENUE n'est jamais dite envoyée — et rien d'autre ne bouge", async () => {
    enfiler.mockResolvedValue({ enqueued: false, retenu: "desinscrit" });
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "retenu" });
    expect(annuler).not.toHaveBeenCalled();
    expect(journaliser).not.toHaveBeenCalled();
  });

  it("une file absente est dite, pas maquillée en succès", async () => {
    enfiler.mockResolvedValue({ enqueued: false });
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "file-indisponible" });
  });

  it("après l'envoi : retire les rappels redondants et journalise le geste, sans l'adresse en clair", async () => {
    await envoyer();
    expect(annuler).toHaveBeenCalledWith("nadia@example.com", expect.stringMatching(/invitation/i));
    expect(journaliser).toHaveBeenCalledTimes(1);
    const data = (journaliser.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["action"]).toBe("submission.invitation_apporteur");
    expect(JSON.stringify(data)).not.toContain("nadia@");
  });
});
