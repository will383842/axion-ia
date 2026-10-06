// E-mail « contrat signé » : il oriente vers le lien du dossier (formulaire de déclaration)
// et non plus vers « écrivez-nous par e-mail » ; le bouton « Renvoyer » est réservé à l'admin.

import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const renvoyerContratSigne = vi.fn();
vi.mock("../verification", () => ({
  apercuDecision: vi.fn(),
  appliquerDecision: vi.fn(),
  envoyerLien: vi.fn(),
  preparerLien: vi.fn(),
  jugerPiece: vi.fn(),
  ouvrirDossierManuel: vi.fn(),
  renvoyerContratSigne: (...a: unknown[]) => renvoyerContratSigne(...a),
}));

import {
  ApporteurContratSigneEmail,
  COPY_DEMARRAGE,
  texteParDefaut,
} from "@/lib/email/templates/apporteur-demarrage";

import { renvoyerContratSigneAction } from "../actions-apporteurs";

const URL_DOSSIER =
  "https://axion-ia.com/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/jeton";

async function html(payload: Record<string, unknown>): Promise<string> {
  return render(<ApporteurContratSigneEmail locale="fr" payload={payload} />);
}

describe("e-mail « contrat signé » (D5)", () => {
  it("avec le lien du dossier : bouton « Déclarer une entreprise » vers ce lien", async () => {
    const h = await html({ contactName: "Claire", dossierUrl: URL_DOSSIER });
    expect(h).toContain(URL_DOSSIER);
    expect(h).toContain(COPY_DEMARRAGE.contratSigne.cta);
  });

  it("ne dit plus d'écrire par e-mail pour présenter une entreprise", async () => {
    for (const h of [
      await html({ contactName: "Claire", dossierUrl: URL_DOSSIER }),
      await html({ contactName: "Claire" }),
    ]) {
      expect(h).not.toMatch(/Répondez simplement à cet e-mail, ou écrivez-nous/);
      expect(h).not.toMatch(/date de votre e-mail/);
      expect(h).not.toMatch(/Nouvelle entreprise/);
      expect(h).toContain("lien personnel");
    }
  });

  it("liste TOUTES les commissions du contrat : formation, audit, intégration, 1-to-1 et parrainage", async () => {
    const h = await html({ contactName: "Claire", dossierUrl: URL_DOSSIER });
    const t = texteParDefaut("apporteur-contrat-signe", { contactName: "Claire" })!;
    for (const x of [h, t]) {
      expect(x).toMatch(/Formation : 500/);
      expect(x).toContain("Audit : 30 % du montant HT");
      expect(x).toContain("Intégration : 15 % du montant HT");
      expect(x).toContain("1-to-1) : 30 % du montant HT");
      expect(x).toContain(
        "Parrainage : si vous présentez une personne qui devient elle-même apporteur",
      );
      expect(x).toContain("10 % de ses commissions pendant 6 mois");
    }
  });

  it("le texte par défaut (« Modifier le texte ») dit la même chose que le gabarit", () => {
    const t = texteParDefaut("apporteur-contrat-signe", { contactName: "Claire" })!;
    expect(t).toContain("lien personnel");
    expect(t).not.toMatch(/Répondez simplement|Nouvelle entreprise|écrivez-nous/i);
    expect(t).toContain("Votre contrat signé des deux parties est en pièce jointe.");
  });

  it("le bouton reste présent quand Will réécrit le texte", async () => {
    const h = await html({
      contactName: "Claire",
      dossierUrl: URL_DOSSIER,
      texteLibre: "Un texte à moi.",
    });
    expect(h).toContain("Un texte à moi.");
    expect(h).toContain(URL_DOSSIER);
  });
});

describe("Server Action « Renvoyer le contrat signé »", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    renvoyerContratSigne.mockResolvedValue({ ok: true, message: "Contrat signé renvoyé." });
  });

  it("réservée aux administrateurs", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    expect(await renvoyerContratSigneAction({ apporteurId: ID })).toMatchObject({ ok: false });
    authMock.mockResolvedValue(null);
    expect(await renvoyerContratSigneAction({ apporteurId: ID })).toMatchObject({ ok: false });
    expect(renvoyerContratSigne).not.toHaveBeenCalled();
  });

  it("identifiant invalide : refusé avant tout", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    expect(await renvoyerContratSigneAction({ apporteurId: "pas-un-uuid" })).toMatchObject({
      ok: false,
    });
    expect(renvoyerContratSigne).not.toHaveBeenCalled();
  });

  it("administrateur : le renvoi est lancé", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    expect(await renvoyerContratSigneAction({ apporteurId: ID })).toEqual({
      ok: true,
      message: "Contrat signé renvoyé.",
    });
    expect(renvoyerContratSigne).toHaveBeenCalledWith(ID);
  });

  it("une panne est rendue en message, jamais en exception", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    renvoyerContratSigne.mockRejectedValue(new Error("boom"));
    expect(await renvoyerContratSigneAction({ apporteurId: ID })).toMatchObject({ ok: false });
  });
});
