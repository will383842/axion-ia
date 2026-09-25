// @vitest-environment node
//
// La demande du guide et la lettre (lot L2, amendement de Will du 24/09).
//
//   · adresse PROFESSIONNELLE ⇒ inscrite (intérêt légitime), preuve
//     « information » écrite avec la version de la mention ;
//   · adresse PERSONNELLE + case cochée ⇒ inscrite (consentement), preuve
//     « optin » avec la version du texte de la case ;
//   · adresse PERSONNELLE sans la case ⇒ AUCUNE ligne d'abonné ;
//   · 🔴 un désabonné n'est JAMAIS réinscrit par une demande (un tiers peut
//     saisir son adresse) : seul un jeton est posé, et l'e-mail propose ;
//   · la nature se décide CÔTÉ SERVEUR : une case cochée sur une adresse pro
//     ne change rien, une adresse perso sans case n'est jamais inscrite ;
//   · Telegram ne voit jamais une adresse en clair (ADR 0010).

import { describe, it, expect, vi, beforeEach } from "vitest";

const guideFindUnique = vi.fn();
const guideFindUniqueOrThrow = vi.fn();
const guideCreate = vi.fn();
const guideUpdate = vi.fn();
const abonneFindUnique = vi.fn();
const abonneCreate = vi.fn();
const abonneUpdate = vi.fn();
const abonneUpdateMany = vi.fn();
const mettreEnFileGuide = vi.fn();
const notify = vi.fn();
const recordConsentEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: (...a: unknown[]) => guideFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => guideFindUniqueOrThrow(...a),
      create: (...a: unknown[]) => guideCreate(...a),
      update: (...a: unknown[]) => guideUpdate(...a),
    },
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => abonneFindUnique(...a),
      create: (...a: unknown[]) => abonneCreate(...a),
      update: (...a: unknown[]) => abonneUpdate(...a),
      updateMany: (...a: unknown[]) => abonneUpdateMany(...a),
    },
  },
}));
vi.mock("../envoi", () => ({
  mettreEnFileGuide: (...a: unknown[]) => mettreEnFileGuide(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
vi.mock("@/lib/consents", () => ({
  recordConsentEvent: (...a: unknown[]) => recordConsentEvent(...a),
}));

// Aucune adresse de webmail réelle dans un test (dépôt public) : la nature est
// simulée d'après la partie locale. La liste elle-même est testée, par
// domaine seulement, dans `lib/email/__tests__/nature-adresse.spec.ts`.
vi.mock("@/lib/email/nature-adresse", () => ({
  natureAdresse: (email: string) => (email.startsWith("perso.") ? "perso" : "pro"),
}));

import { enregistrerDemandeGuide } from "../demande";
import { inscrireALaLettre, lettreDansLEmail } from "../lettre";

const PRO = "jeanne@example.invalid";
const PERSO = "perso.paul@example.invalid";
const BASE = {
  locale: "fr" as const,
  source: "guide-ia",
  variante: "guide" as const,
  ipHash: "empreinte",
  ip: "192.0.2.1",
  userAgent: "navigateur-de-test",
};

/** Ligne d'abonné telle que la relit `lettreDansLEmail`, après l'inscription. */
function abonneApres(ligne: Record<string, unknown> | null) {
  // 1er appel : `inscrireALaLettre` ; 2e : `lettreDansLEmail`.
  abonneFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(ligne);
}

beforeEach(() => {
  guideFindUnique.mockReset().mockResolvedValue(null);
  guideFindUniqueOrThrow.mockReset();
  guideCreate.mockReset().mockResolvedValue({ id: "demande-1", downloadToken: "a".repeat(64) });
  guideUpdate.mockReset().mockResolvedValue({ id: "demande-1" });
  abonneFindUnique.mockReset().mockResolvedValue(null);
  abonneCreate.mockReset().mockResolvedValue({ id: "abonne-1" });
  abonneUpdate.mockReset().mockResolvedValue({ id: "abonne-1" });
  abonneUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mettreEnFileGuide.mockReset().mockResolvedValue("en-file");
  notify.mockReset().mockResolvedValue({ ok: true });
  recordConsentEvent.mockReset().mockResolvedValue(true);
});

describe("enregistrerDemandeGuide — la nature de l'adresse décide, côté serveur", () => {
  it("🔴 adresse PERSO sans la case : le guide part, AUCUN abonné, aucune preuve", async () => {
    const r = await enregistrerDemandeGuide({ ...BASE, email: PERSO, caseLettre: false });
    expect(r).toMatchObject({ nature: "perso", lettre: "non-demandee" });
    expect(abonneCreate).not.toHaveBeenCalled();
    expect(abonneUpdateMany).not.toHaveBeenCalled();
    expect(recordConsentEvent).not.toHaveBeenCalled();
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toEqual({
      confirmToken: null,
      unsubscribeToken: null,
    });
    // La demande porte la version de la mention PERSO.
    const data = (guideCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["version"]).toBe("guide-mention-perso-v1-2026-09-24");
  });

  it("adresse PERSO + case cochée : inscrite, preuve « optin » avec le texte de la CASE", async () => {
    abonneApres({ status: "confirmed", unsubscribeToken: "u".repeat(64), confirmToken: null });
    const r = await enregistrerDemandeGuide({ ...BASE, email: PERSO, caseLettre: true });
    expect(r.lettre).toBe("inscrite");
    const creation = (abonneCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(creation).toMatchObject({
      status: "confirmed",
      consentFormRef: "newsletter-guide-ia",
      consentVersion: "lettre-guide-v3-2026-09-24",
    });
    expect(creation["confirmedAt"]).toBeInstanceOf(Date);
    expect(recordConsentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: PERSO,
        action: "optin",
        formRef: "newsletter-guide-ia",
        consentVersion: "lettre-guide-v3-2026-09-24",
        ip: "192.0.2.1",
        userAgent: "navigateur-de-test",
      }),
    );
  });

  it("adresse PRO, sans case : inscrite, preuve « information » avec la version de la MENTION", async () => {
    abonneApres({ status: "confirmed", unsubscribeToken: "u".repeat(64), confirmToken: null });
    const r = await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    expect(r).toMatchObject({ nature: "pro", lettre: "inscrite" });
    expect(recordConsentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "information",
        consentVersion: "guide-mention-pro-v1-2026-09-24",
      }),
    );
    // L'e-mail porte le lien de désinscription (et l'en-tête One-Click).
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toEqual({
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
  });

  it("adresse PRO avec une case « cochée » (envoyée par le navigateur) : même traitement, sans effet nuisible", async () => {
    abonneApres({ status: "confirmed", unsubscribeToken: "u".repeat(64), confirmToken: null });
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: true });
    expect(recordConsentEvent.mock.calls[0]?.[0]).toMatchObject({ action: "information" });
  });

  it("crée la demande avec sa provenance et un jeton aléatoire", async () => {
    await enregistrerDemandeGuide({ ...BASE, email: PERSO, caseLettre: false });
    const data = (guideCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      email: PERSO,
      aimant: "guide-ia",
      origine: "formulaire",
      source: "guide-ia",
    });
    expect(data["downloadToken"]).toMatch(/^[0-9a-f]{64}$/);
    expect(data["emailKey"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("une redemande REPASSE sur la même ligne : même lien personnel", async () => {
    guideFindUnique.mockResolvedValue({ id: "demande-1", downloadToken: "b".repeat(64) });
    await enregistrerDemandeGuide({ ...BASE, email: PERSO, caseLettre: false });
    expect(guideCreate).not.toHaveBeenCalled();
    expect(mettreEnFileGuide.mock.calls[0]?.[0]).toMatchObject({ downloadToken: "b".repeat(64) });
  });

  it("🔴 une ligne née d'un envoi console redevient celle du FORMULAIRE (sinon le rattrapage l'ignore)", async () => {
    guideFindUnique.mockResolvedValue({
      id: "demande-1",
      downloadToken: "b".repeat(64),
      origine: "admin",
    });
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    const data = (guideUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ origine: "formulaire", source: "guide-ia" });
  });

  it("une ligne déjà du formulaire garde sa PREMIÈRE provenance", async () => {
    guideFindUnique.mockResolvedValue({
      id: "demande-1",
      downloadToken: "b".repeat(64),
      origine: "formulaire",
    });
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false, source: "autre" });
    const data = (guideUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("origine");
    expect(data).not.toHaveProperty("source");
    expect(data).toMatchObject({ locale: "fr" });
  });

  it("désabonné : l'e-mail PROPOSE la réinscription, et confirm_sent_at suit la mise en file", async () => {
    abonneFindUnique
      .mockResolvedValueOnce({
        id: "abonne-1",
        status: "unsubscribed",
        unsubscribeToken: "u".repeat(64),
        confirmToken: null,
      })
      .mockResolvedValueOnce({
        status: "unsubscribed",
        unsubscribeToken: "u".repeat(64),
        confirmToken: "c".repeat(64),
      });
    const r = await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    expect(r.lettre).toBe("reinscription-proposee");
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toEqual({
      confirmToken: "c".repeat(64),
      unsubscribeToken: null,
    });
    expect(abonneUpdateMany).toHaveBeenLastCalledWith({
      where: { email: PRO, confirmToken: "c".repeat(64) },
      data: { confirmSentAt: expect.any(Date) },
    });
  });

  it("🔴 guide NON mis en file : confirm_sent_at n'est PAS posé", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "unsubscribed",
      unsubscribeToken: "u",
      confirmToken: "c".repeat(64),
    });
    mettreEnFileGuide.mockResolvedValue("plafond");
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    const poses = abonneUpdateMany.mock.calls.filter(
      (c) => "confirmSentAt" in ((c[0] as { data: object }).data ?? {}),
    );
    expect(poses).toEqual([]);
  });

  it("🔴 Telegram : adresse MASQUÉE, jamais en clair (ADR 0010)", async () => {
    abonneApres({ status: "confirmed", unsubscribeToken: "u", confirmToken: null });
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    expect(notify).toHaveBeenCalled();
    for (const appel of notify.mock.calls) {
      expect(JSON.stringify(appel[0])).not.toContain(PRO);
    }
    expect(notify.mock.calls[0]?.[0]).toMatchObject({
      category: "GUIDE_REQUESTED",
      payload: { lettre: "inscrite" },
    });
  });

  it("aucune écriture d'IP en clair sur la ligne : seule l'empreinte", async () => {
    abonneApres(null);
    await enregistrerDemandeGuide({ ...BASE, email: PRO, caseLettre: false });
    const creation = (abonneCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(creation).not.toHaveProperty("ipAddress");
    expect(creation["ipHash"]).toBe("empreinte");
  });
});

describe("inscrireALaLettre", () => {
  const ENTREE = {
    email: PRO,
    locale: "fr" as const,
    source: "guide-ia",
    base: "interet-legitime" as const,
    formRef: "newsletter-guide-ia",
    version: "guide-mention-pro-v1-2026-09-24",
    ipHash: null,
  };

  it("🔴 DÉSABONNÉ : statut et date de désabonnement INTACTS, un jeton est seulement posé", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "unsubscribed",
      unsubscribeToken: "u".repeat(64),
      confirmToken: null,
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r.etat).toBe("reinscription-proposee");
    expect(abonneUpdate).not.toHaveBeenCalled();
    const appel = abonneUpdateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(appel.where).toMatchObject({ status: "unsubscribed", confirmToken: null });
    expect(appel.data).not.toHaveProperty("status");
    expect(appel.data).not.toHaveProperty("unsubscribedAt");
    expect(appel.data).not.toHaveProperty("unsubscribeToken");
    expect(appel.data["confirmToken"]).toMatch(/^[0-9a-f]{64}$/);
    expect(appel.data["consentVersion"]).toBe("lettre-reinscription-email-v1-2026-09-24");
    // Aucune preuve : rien n'a été accepté.
    expect(recordConsentEvent).not.toHaveBeenCalled();
  });

  it("🔴 désabonné qui a DÉJÀ un jeton : rien n'est réécrit (le lien reçu reste valable)", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "unsubscribed",
      unsubscribeToken: "u",
      confirmToken: "c".repeat(64),
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r.etat).toBe("reinscription-proposee");
    expect(abonneUpdateMany).not.toHaveBeenCalled();
  });

  it("rebond dur : rien ne change", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "bounced",
      unsubscribeToken: "u",
      confirmToken: null,
    });
    expect((await inscrireALaLettre(ENTREE)).etat).toBe("opposition-maintenue");
    expect(abonneUpdateMany).not.toHaveBeenCalled();
    expect(recordConsentEvent).not.toHaveBeenCalled();
  });

  it("déjà confirmée : rien ne change, aucune preuve de plus", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "confirmed",
      unsubscribeToken: "u",
      confirmToken: null,
    });
    expect((await inscrireALaLettre(ENTREE)).etat).toBe("deja-abonnee");
    expect(abonneUpdate).not.toHaveBeenCalled();
    expect(abonneUpdateMany).not.toHaveBeenCalled();
    expect(abonneCreate).not.toHaveBeenCalled();
    expect(recordConsentEvent).not.toHaveBeenCalled();
  });

  it("ancienne inscription `pending` : inscrite maintenant, sur la nouvelle base, preuve écrite", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "pending",
      unsubscribeToken: "u",
      confirmToken: "c".repeat(64),
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r).toEqual({ etat: "inscrite", id: "abonne-1", nouvelle: false });
    const appel = abonneUpdateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(appel.where).toMatchObject({ status: "pending" });
    expect(appel.data).toMatchObject({ status: "confirmed", confirmToken: null });
    expect(recordConsentEvent.mock.calls[0]?.[0]).toMatchObject({ action: "information" });
  });

  it("deux demandes simultanées : la seconde relit la ligne créée par la première", async () => {
    abonneCreate.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    abonneFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "abonne-1",
      status: "confirmed",
      unsubscribeToken: "u",
      confirmToken: null,
    });
    expect((await inscrireALaLettre(ENTREE)).etat).toBe("deja-abonnee");
  });
});

describe("lettreDansLEmail", () => {
  it("abonnée → lien de désinscription ; désabonnée avec jeton → réinscription ; sinon rien", async () => {
    abonneFindUnique.mockResolvedValueOnce({
      status: "confirmed",
      unsubscribeToken: "u",
      confirmToken: null,
    });
    expect(await lettreDansLEmail(PRO)).toEqual({ unsubscribeToken: "u" });
    abonneFindUnique.mockResolvedValueOnce({
      status: "unsubscribed",
      unsubscribeToken: "u",
      confirmToken: "c",
    });
    expect(await lettreDansLEmail(PRO)).toEqual({ confirmToken: "c" });
    abonneFindUnique.mockResolvedValueOnce({
      status: "bounced",
      unsubscribeToken: "u",
      confirmToken: "c",
    });
    expect(await lettreDansLEmail(PRO)).toEqual({});
    abonneFindUnique.mockResolvedValueOnce(null);
    expect(await lettreDansLEmail(PRO)).toEqual({});
  });
});
