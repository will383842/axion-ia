// @vitest-environment node
//
// La demande du guide et la case « lettre » (lot L2, 2026-09-24).
//
//   · case DÉCOCHÉE ⇒ aucune ligne d'abonné : le guide n'est pas un abonnement ;
//   · case cochée ⇒ `pending`, et la confirmation voyage dans l'e-mail du guide ;
//   · un désabonné qui revient peut se RÉINSCRIRE (c'était impossible) ;
//   · Telegram ne voit jamais une adresse en clair (ADR 0010).

import { describe, it, expect, vi, beforeEach } from "vitest";

const guideFindUnique = vi.fn();
const guideFindUniqueOrThrow = vi.fn();
const guideCreate = vi.fn();
const guideUpdate = vi.fn();
const abonneFindUnique = vi.fn();
const abonneCreate = vi.fn();
const abonneUpdate = vi.fn();
const mettreEnFileGuide = vi.fn();
const notify = vi.fn();

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
    },
  },
}));
vi.mock("../envoi", () => ({
  mettreEnFileGuide: (...a: unknown[]) => mettreEnFileGuide(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));

import { enregistrerDemandeGuide } from "../demande";
import { inscrireALaLettre } from "../lettre";

const EMAIL = "jeanne@example.invalid";
const BASE = {
  email: EMAIL,
  locale: "fr" as const,
  source: "guide-ia",
  versionMention: "guide-mention-v1-2026-09-24",
  ipHash: "empreinte",
};
const LETTRE = { formRef: "newsletter-guide-ia", version: "lettre-guide-v2-2026-09-24" };

beforeEach(() => {
  guideFindUnique.mockReset().mockResolvedValue(null);
  guideFindUniqueOrThrow.mockReset();
  guideCreate.mockReset().mockResolvedValue({ id: "demande-1", downloadToken: "a".repeat(64) });
  guideUpdate.mockReset().mockResolvedValue({ id: "demande-1" });
  abonneFindUnique.mockReset().mockResolvedValue(null);
  abonneCreate.mockReset().mockResolvedValue({ id: "abonne-1" });
  abonneUpdate.mockReset().mockResolvedValue({ id: "abonne-1" });
  mettreEnFileGuide.mockReset().mockResolvedValue("en-file");
  notify.mockReset().mockResolvedValue({ ok: true });
});

describe("enregistrerDemandeGuide", () => {
  it("🔴 case DÉCOCHÉE : le guide part, et AUCUN abonné n'est créé", async () => {
    const r = await enregistrerDemandeGuide({ ...BASE, lettre: null });
    expect(r.lettre).toBe("non-demandee");
    expect(abonneFindUnique).not.toHaveBeenCalled();
    expect(abonneCreate).not.toHaveBeenCalled();
    expect(abonneUpdate).not.toHaveBeenCalled();
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toEqual({ confirmToken: null });
  });

  it("crée la demande avec sa provenance, sa version de mention et un jeton aléatoire", async () => {
    await enregistrerDemandeGuide({ ...BASE, lettre: null });
    const data = (guideCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      email: EMAIL,
      aimant: "guide-ia",
      origine: "formulaire",
      source: "guide-ia",
      version: "guide-mention-v1-2026-09-24",
    });
    expect(data["downloadToken"]).toMatch(/^[0-9a-f]{64}$/);
    expect(data["emailKey"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("une redemande REPASSE sur la même ligne : même lien personnel", async () => {
    guideFindUnique.mockResolvedValue({ id: "demande-1", downloadToken: "b".repeat(64) });
    await enregistrerDemandeGuide({ ...BASE, lettre: null });
    expect(guideCreate).not.toHaveBeenCalled();
    expect(mettreEnFileGuide.mock.calls[0]?.[0]).toMatchObject({ downloadToken: "b".repeat(64) });
  });

  it("case cochée : abonné `pending`, confirmation dans l'e-mail du guide, confirm_sent_at APRÈS la mise en file", async () => {
    const r = await enregistrerDemandeGuide({ ...BASE, lettre: LETTRE });
    expect(r.lettre).toBe("a-confirmer");
    const creation = (abonneCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(creation).toMatchObject({
      status: "pending",
      consentFormRef: "newsletter-guide-ia",
      consentVersion: "lettre-guide-v2-2026-09-24",
    });
    const jeton = creation["confirmToken"];
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toEqual({ confirmToken: jeton });
    expect(abonneUpdate).toHaveBeenCalledWith({
      where: { id: "abonne-1" },
      data: { confirmSentAt: expect.any(Date) },
    });
  });

  it("🔴 guide NON mis en file : confirm_sent_at n'est PAS posé", async () => {
    mettreEnFileGuide.mockResolvedValue("plafond");
    await enregistrerDemandeGuide({ ...BASE, lettre: LETTRE });
    expect(abonneUpdate).not.toHaveBeenCalled();
  });

  it("🔴 Telegram : adresse MASQUÉE, jamais en clair (ADR 0010)", async () => {
    await enregistrerDemandeGuide({ ...BASE, lettre: LETTRE });
    expect(notify).toHaveBeenCalled();
    for (const appel of notify.mock.calls) {
      expect(JSON.stringify(appel[0])).not.toContain(EMAIL);
    }
    expect(notify.mock.calls[0]?.[0]).toMatchObject({
      category: "GUIDE_REQUESTED",
      payload: { email: "j****@example.invalid" },
    });
  });

  it("aucune écriture d'IP en clair : seule l'empreinte voyage", async () => {
    await enregistrerDemandeGuide({ ...BASE, lettre: LETTRE });
    const creation = (abonneCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(creation).not.toHaveProperty("ipAddress");
    expect(creation["ipHash"]).toBe("empreinte");
  });
});

describe("inscrireALaLettre", () => {
  const ENTREE = {
    email: EMAIL,
    locale: "fr" as const,
    source: "guide-ia",
    ipHash: null,
    ...LETTRE,
  };

  it("🔴 RÉINSCRIPTION d'un désabonné : retour à `pending`, nouveau jeton, désinscription effacée", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "unsubscribed",
      unsubscribeToken: "u".repeat(64),
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r.etat).toBe("a-confirmer");
    const data = (abonneUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      status: "pending",
      unsubscribedAt: null,
      confirmedAt: null,
      confirmSentAt: null,
      consentVersion: LETTRE.version,
    });
    expect(data["confirmToken"]).toMatch(/^[0-9a-f]{64}$/);
    // Les anciens liens « se désabonner » doivent continuer de fonctionner.
    expect(data).not.toHaveProperty("unsubscribeToken");
  });

  it("déjà confirmé : rien ne change, aucun bouton de confirmation", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "confirmed",
      unsubscribeToken: "u",
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r.etat).toBe("deja-abonnee");
    expect(abonneUpdate).not.toHaveBeenCalled();
    expect(abonneCreate).not.toHaveBeenCalled();
  });

  it("toujours `pending` : le jeton est renouvelé", async () => {
    abonneFindUnique.mockResolvedValue({
      id: "abonne-1",
      status: "pending",
      unsubscribeToken: "u",
    });
    const r = await inscrireALaLettre(ENTREE);
    expect(r.etat).toBe("a-confirmer");
    expect(r.etat === "a-confirmer" && r.nouvelle).toBe(false);
  });

  it("le consentement n'est PAS écrit à la demande : il ne vaut qu'à la confirmation", async () => {
    // Aucun appel au registre de preuve n'est possible ici : le module ne
    // l'importe pas. On le vérifie sur la source, pour que ça le reste.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/server/guide-ia/lettre.ts"), "utf8");
    expect(src).not.toMatch(/recordConsentEvent\(/);
  });
});
