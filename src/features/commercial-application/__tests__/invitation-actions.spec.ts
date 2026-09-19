/**
 * Le bouton « Envoyer l'invitation » de la fiche — une personne à la fois
 * (2026-09-19).
 *
 * Le formulaire ne porte qu'un `submissionId`. Un formulaire forgé (ou un futur
 * écran de sélection multiple) qui en porterait plusieurs ne doit RIEN envoyer :
 * `formData.get` ne lit que le premier, et l'administrateur croirait avoir
 * invité tout le monde. Refus AVANT toute lecture.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const envoyer = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: true }));
const auth = vi.fn(async () => ({ user: { id: "admin-1", role: "admin" } }));

class Redirection extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirection(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("../invitation-apporteur", () => ({
  envoyerInvitationApporteur: (...a: unknown[]) => envoyer(...a),
}));

import { envoyerInvitationDepuisFicheAction } from "../invitation-actions";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const LIEN = "https://calendly.com/axion-ia/echange-apporteur";

async function redirectionDe(f: FormData): Promise<string> {
  try {
    await envoyerInvitationDepuisFicheAction(f);
  } catch (e) {
    if (e instanceof Redirection) return e.url;
    throw e;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  envoyer.mockResolvedValue({ ok: true });
});

describe("envoyerInvitationDepuisFicheAction", () => {
  it("🔴 deux submissionId → une-seule-personne, sans rien envoyer ni lire", async () => {
    const f = new FormData();
    f.append("submissionId", ID);
    f.append("submissionId", ID2);
    f.set("calendlyUrl", LIEN);
    const url = await redirectionDe(f);
    expect(url).toContain("invitation=une-seule-personne");
    expect(envoyer).not.toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
  });

  it("transmet « Renvoyer quand même » et l'accord de la personne", async () => {
    const f = new FormData();
    f.set("submissionId", ID);
    f.set("calendlyUrl", LIEN);
    f.set("renvoyer", "on");
    f.set("accordContact", "on");
    const url = await redirectionDe(f);
    expect(url).toContain("invitation=envoyee");
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: ID, renvoyer: true, accordContact: true }),
    );
  });

  it("cases non cochées → ni renvoi forcé ni accord", async () => {
    const f = new FormData();
    f.set("submissionId", ID);
    f.set("calendlyUrl", LIEN);
    await redirectionDe(f);
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ renvoyer: false, accordContact: false }),
    );
  });

  it("une invitation garée pour validation revient avec son propre bandeau", async () => {
    envoyer.mockResolvedValue({ ok: true, enValidation: true, message: "…" });
    const f = new FormData();
    f.set("submissionId", ID);
    f.set("calendlyUrl", LIEN);
    expect(await redirectionDe(f)).toContain("invitation=en-validation");
  });

  it("un refus « déjà invitée » est rapporté tel quel", async () => {
    envoyer.mockResolvedValue({ ok: false, erreur: "deja-invitee", message: "…" });
    const f = new FormData();
    f.set("submissionId", ID);
    f.set("calendlyUrl", LIEN);
    expect(await redirectionDe(f)).toContain("invitation=deja-invitee");
  });
});
