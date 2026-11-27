import { beforeEach, describe, expect, it, vi } from "vitest";

// Fiche des commissions, livret et guide partent dès l'e-mail qui porte le lien du contrat à
// signer (et ses rappels, et « Retenu »). Facultatives : jamais d'erreur, liste vide si R2 tombe.

const h = vi.hoisted(() => ({ entete: vi.fn(), televerser: vi.fn(), configure: true }));

vi.mock("@/lib/r2-storage", () => ({
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  isR2Configured: () => h.configure,
  uploadToR2: (...a: unknown[]) => h.televerser(...a),
}));
vi.mock("../guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../guide-demarrage")>()),
  lireGuideDemarrage: async () => null,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { DOCUMENTS_ANNEXES, annexesDeLEnvoiDuLien } from "../documents-joints";
import {
  ID_ANNEXE_PAR_NOM_FICHIER,
  payloadSansAnnexesOmises,
  phrasePiecesJointes,
} from "@/lib/email/templates/_annexes-jointes";
import { renderEmailTemplate } from "@/lib/email/templates";

const URL_DOSSIER = "https://axion-ia.com/apporteur/dossier/x/y";

beforeEach(() => {
  vi.clearAllMocks();
  h.configure = true;
  h.televerser.mockResolvedValue({});
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("annexesDeLEnvoiDuLien", () => {
  it("joint les trois annexes présentes, facultatives, sans contrat signé", async () => {
    h.entete.mockResolvedValue({ taille: 1000, etag: "e" });
    const { attachments, payload } = await annexesDeLEnvoiDuLien();
    expect(attachments.map((a) => a.r2Key)).toEqual(DOCUMENTS_ANNEXES.map((d) => d.cleR2));
    expect(attachments.every((a) => a.facultative === true)).toBe(true);
    expect(payload).toEqual({ annexesJointes: ["fiche-commissions", "livret", "guide-demarrage"] });
  });

  it("liste vide et payload sans champ si R2 est en panne, sans lever", async () => {
    h.entete.mockRejectedValue(new Error("R2 en panne"));
    await expect(annexesDeLEnvoiDuLien()).resolves.toEqual({ attachments: [], payload: {} });
  });

  it("ne joint que ce qui existe", async () => {
    // Le guide a une copie dans l'image, déposée sur R2 si l'objet manque : ici le dépôt échoue,
    // il n'est donc pas joint (le test ne dépend pas de la copie embarquée de la machine).
    h.televerser.mockRejectedValue(new Error("dépôt impossible"));
    h.entete.mockImplementation(async (cle: string) =>
      cle === DOCUMENTS_ANNEXES[1].cleR2 ? { taille: 500, etag: "e" } : null,
    );
    const { attachments, payload } = await annexesDeLEnvoiDuLien();
    expect(attachments).toHaveLength(1);
    expect(payload).toEqual({ annexesJointes: ["livret"] });
  });
});

describe("phrase des pièces jointes", () => {
  it("construite à partir des pièces réellement jointes", () => {
    expect(phrasePiecesJointes(["fiche-commissions", "livret", "guide-demarrage"])).toBe(
      "Vous trouverez en pièces jointes la fiche des commissions, le livret et le guide de démarrage, pour en prendre connaissance avant de signer.",
    );
    expect(phrasePiecesJointes(["livret"])).toContain("en pièce jointe le livret,");
  });
  it("absente sans pièce ou sur un champ invalide", () => {
    expect(phrasePiecesJointes(undefined)).toBeNull();
    expect(phrasePiecesJointes([])).toBeNull();
    expect(phrasePiecesJointes(["inconnu"])).toBeNull();
    expect(phrasePiecesJointes("livret")).toBeNull();
  });

  it.each(["apporteur-dossier-lien", "apporteur-issue-retenu"])(
    "%s : la phrase est dans l'e-mail avec les pièces, absente sans",
    async (g) => {
      const base = { contactName: "Claire Martin", dossierUrl: URL_DOSSIER };
      const avec = await renderEmailTemplate(g as never, "fr", {
        ...base,
        annexesJointes: ["fiche-commissions", "livret", "guide-demarrage"],
      });
      expect(avec.text.replace(/\s+/g, " ")).toContain(
        "Vous trouverez en pièces jointes la fiche des commissions, le livret et le guide de démarrage, pour en prendre connaissance avant de signer.",
      );
      const sans = await renderEmailTemplate(g as never, "fr", base);
      expect(sans.text).not.toContain("pièces jointes");
      expect(sans.text).not.toContain("pièce jointe");
    },
  );
});

describe("correspondance nom de fichier vers identifiant (copie sans dépendance serveur)", () => {
  it("reste identique à DOCUMENTS_ANNEXES", () => {
    expect(ID_ANNEXE_PAR_NOM_FICHIER).toEqual(
      Object.fromEntries(DOCUMENTS_ANNEXES.map((d) => [d.nomFichier, d.id])),
    );
  });
});

describe("payloadSansAnnexesOmises", () => {
  const p = {
    contactName: "C",
    annexesJointes: ["fiche-commissions", "livret", "guide-demarrage"],
  };
  it("retire les annexes omises, sans modifier l'entrée", () => {
    const r = payloadSansAnnexesOmises(p, [DOCUMENTS_ANNEXES[2].nomFichier]);
    expect(r).toEqual({ contactName: "C", annexesJointes: ["fiche-commissions", "livret"] });
    expect(p.annexesJointes).toHaveLength(3);
  });
  it("retire le champ quand plus rien ne reste", () => {
    const r = payloadSansAnnexesOmises(
      p,
      DOCUMENTS_ANNEXES.map((d) => d.nomFichier),
    );
    expect(r).toEqual({ contactName: "C" });
  });
  it("sans omission, sur un nom inconnu ou sans champ : rendu tel quel", () => {
    expect(payloadSansAnnexesOmises(p, [])).toBe(p);
    expect(payloadSansAnnexesOmises(p, ["autre.pdf"])).toBe(p);
    const sans = { contactName: "C" };
    expect(payloadSansAnnexesOmises(sans, [DOCUMENTS_ANNEXES[0].nomFichier])).toBe(sans);
  });
});
