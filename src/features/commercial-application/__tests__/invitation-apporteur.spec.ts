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
const mettreAJour = vi.fn(async (..._a: unknown[]) => ({}));
const journaliser = vi.fn(async (..._a: unknown[]) => ({}));
const journalEnvois = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const corbeille = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: (...a: unknown[]) => trouver(...a),
      findMany: (...a: unknown[]) => lister(...a),
      update: (...a: unknown[]) => mettreAJour(...a),
    },
    activityLog: { create: (...a: unknown[]) => journaliser(...a) },
    emailLog: { findMany: (...a: unknown[]) => journalEnvois(...a) },
    emailOutbox: { findMany: (...a: unknown[]) => corbeille(...a) },
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
  lister.mockResolvedValue([{ id: fiche().id, details: fiche().details }]);
  enfiler.mockResolvedValue({ enqueued: true });
  journalEnvois.mockResolvedValue([]);
  corbeille.mockResolvedValue([]);
});

const envoyer = (
  calendlyUrl = LIEN,
  options: { renvoyer?: boolean; accordContact?: boolean } = {},
) =>
  envoyerInvitationApporteur({
    submissionId: fiche().id,
    calendlyUrl,
    adminId: "admin-1",
    ...options,
  });

/** Une fiche saisie à la main dans la console, avec son origine. */
function ficheSaisie(origineSaisie: string, extra: Record<string, unknown> = {}) {
  return fiche({
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      etape: "premier-contact",
      origine: "saisie-manuelle",
      origineSaisie,
      ...extra,
    },
  });
}

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
      { id: fiche().id, details: fiche().details },
      {
        id: "22222222-2222-4222-8222-222222222222",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
      },
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

describe("🔴 jamais deux invitations — lecture PAR PERSONNE (2026-09-19)", () => {
  const AUTRE_LIGNE = "22222222-2222-4222-8222-222222222222";

  it("deux lignes de la même personne, l'autre déjà invitée → deja-invitee, rien ne part", async () => {
    lister.mockResolvedValue([
      { id: fiche().id, details: fiche().details },
      { id: AUTRE_LIGNE, details: fiche().details },
    ]);
    journalEnvois.mockResolvedValue([
      { createdAt: new Date("2026-09-12T10:00:00Z"), status: "sent" },
    ]);
    const r = await envoyer();
    expect(r).toMatchObject({ ok: false, erreur: "deja-invitee" });
    if (!r.ok) {
      expect(r.message).toContain("12/09");
      expect(r.message).toContain("Renvoyer quand même");
    }
    expect(enfiler).not.toHaveBeenCalled();
    // Le journal est lu sur TOUTES les lignes de la personne, non effacées.
    const ou = (journalEnvois.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(ou).toMatchObject({
      template: GABARIT_INVITATION_APPORTEUR,
      entityType: "Submission",
      entityId: { in: [fiche().id, AUTRE_LIGNE] },
      status: { in: ["pending", "sent"] },
    });
    const lignes = lister.mock.calls
      .map((c) => (c[0] as { where: Record<string, unknown> }).where)
      .find((w) => "contactEmailHash" in w);
    expect(lignes).toMatchObject({ contactEmailHash: "h-nadia", deletedAt: null });
  });

  it("une invitation qui ATTEND validation dans la corbeille compte aussi → deja-invitee", async () => {
    corbeille.mockResolvedValue([{ createdAt: new Date("2026-09-18T08:00:00Z") }]);
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "deja-invitee" });
    const ou = (corbeille.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(ou).toMatchObject({
      template: GABARIT_INVITATION_APPORTEUR,
      entityType: "Submission",
      statut: "a_valider",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("« Renvoyer quand même » → l'invitation part", async () => {
    journalEnvois.mockResolvedValue([{ createdAt: new Date(), status: "sent" }]);
    expect(await envoyer(LIEN, { renvoyer: true })).toEqual({ ok: true });
    expect(enfiler).toHaveBeenCalledTimes(1);
  });

  it("garée pour validation : dite « en attente de validation », pas « file indisponible »", async () => {
    enfiler.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o-1" });
    const r = await envoyer();
    expect(r).toMatchObject({ ok: true, enValidation: true });
    expect(JSON.stringify(r)).toMatch(/en attente de validation/i);
  });
});

describe("🔴 art. 14 — origine de l'adresse et accord (2026-09-19)", () => {
  it("adresse relevée sur l'annonce d'un tiers → origine-interdite, rien ne part", async () => {
    trouver.mockResolvedValue(ficheSaisie("site-annonces"));
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "origine-interdite" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("recommandation sans accord → accord-manquant, rien ne part", async () => {
    trouver.mockResolvedValue(ficheSaisie("recommandation"));
    expect(await envoyer()).toMatchObject({ ok: false, erreur: "accord-manquant" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("recommandation AVEC accord coché → part, provenance indirecte, accord daté sur la fiche", async () => {
    trouver.mockResolvedValue(ficheSaisie("recommandation"));
    expect(await envoyer(LIEN, { accordContact: true })).toEqual({ ok: true });
    const payload = enfiler.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["provenance"]).toMatchObject({ mode: "indirecte" });
    const maj = mettreAJour.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { details: Record<string, unknown> };
    };
    expect(maj.where.id).toBe(fiche().id);
    expect(typeof maj.data.details["accordContactAt"]).toBe("string");
    // Le reste de la fiche est conservé.
    expect(maj.data.details["origineSaisie"]).toBe("recommandation");
  });

  it("accord déjà enregistré à la saisie → part, sans réécrire la fiche", async () => {
    trouver.mockResolvedValue(
      ficheSaisie("autre", { accordContactAt: "2026-09-19T08:00:00.000Z" }),
    );
    expect(await envoyer()).toEqual({ ok: true });
    expect(mettreAJour).not.toHaveBeenCalled();
    const payload = enfiler.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["provenance"]).toMatchObject({ mode: "indirecte" });
  });

  it("a écrit par e-mail → provenance directe", async () => {
    trouver.mockResolvedValue(ficheSaisie("email-direct"));
    expect(await envoyer()).toEqual({ ok: true });
    const payload = enfiler.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["provenance"]).toMatchObject({ mode: "directe" });
    expect(String((payload["provenance"] as { libelle: string }).libelle)).toMatch(/e-mail/);
  });

  it("une fiche venue d'un formulaire du site ne porte pas de provenance (texte inchangé)", async () => {
    await envoyer();
    const payload = enfiler.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("provenance");
  });
});
