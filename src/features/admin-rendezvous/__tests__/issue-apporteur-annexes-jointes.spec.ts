// Relecture de la PR #2392 (🟡 2) : « Retenu » joint la fiche, le livret et le guide quand le lien
// du dossier est à SIGNER ; rien pour un dossier déjà signé ou à vérifier, ni pour « Absent » et
// « Non retenu ». `envoyerIssue` passe les pièces à `enqueueEmail` sans toucher au jobId.
// R2 en panne : l'e-mail est préparé quand même, sans pièce.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  entete: vi.fn(),
  dossier: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/rgpd-erase", () => ({ ERASED_PLACEHOLDER: "[effacé]" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte-1" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: async () => ({
        id: "evt_1",
        eventTypeName: "Échange apporteur d'affaires (15 min)",
        startTime: new Date("2026-11-20T09:00:00Z"),
        inviteeEmail: "claire@exemple.fr",
        linkedSubmissionId: "sub_1",
      }),
    },
    submission: {
      findUnique: async () => ({
        id: "sub_1",
        locale: "fr",
        contactName: "Claire Martin",
        contactEmail: "claire@exemple.fr",
        contactEmailHash: "empreinte-1",
        details: {},
        deletedAt: null,
      }),
      findMany: async () => [{ id: "sub_1" }],
    },
    rendezVousSuivi: { count: async () => 0 },
    emailLog: { findFirst: async () => null },
    emailOutbox: { findFirst: async () => null },
    apporteurReseau: { findUnique: async () => null },
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/features/commercial-application/relances-invitation-apporteur", () => ({
  lienReservation: () => "https://calendly.com/axion/apporteur",
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  ouvrirDossierDepuisCandidature: (...a: unknown[]) => h.dossier(...a),
}));
vi.mock("@/features/apporteurs-reseau/retrait", () => ({ retraitDe: async () => null }));
vi.mock("@/features/apporteurs-reseau/jeton", () => ({
  urlDossier: (id: string) => `https://axion-ia.com/apporteur/dossier/${id}/jeton`,
  urlDossierExemple: () => "https://axion-ia.com/apporteur/dossier/exemple/jeton",
}));
vi.mock("@/features/apporteurs-reseau/signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/lib/r2-storage", () => ({
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("@/features/apporteurs-reseau/guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/apporteurs-reseau/guide-demarrage")>()),
  lireGuideDemarrage: async () => null,
}));

import { DOCUMENTS_ANNEXES } from "@/features/apporteurs-reseau/documents-joints";
import { envoyerIssue, preparerIssueApporteur } from "../issue-apporteur-envoi";

const IDS = ["fiche-commissions", "livret", "guide-demarrage"];

function dossierOuvert(statut: string) {
  h.dossier.mockResolvedValue({
    ok: true,
    apporteurId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    versionLien: 1,
    statut,
  });
}

async function preparer(issue: "retenu" | "absent" | "non_retenu") {
  const r = await preparerIssueApporteur({ calendlyEventId: "evt_1", issue });
  if (!r.ok) throw new Error(`préparation refusée : ${r.message}`);
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.entete.mockResolvedValue({ taille: 1000, etag: "e" });
  h.enqueue.mockResolvedValue({ enqueued: true });
  dossierOuvert("dossier_en_cours");
});

describe("preparerIssueApporteur : pièces jointes de « Retenu »", () => {
  it("« Retenu » avec dossier à signer : les trois annexes facultatives et leur liste", async () => {
    const r = await preparer("retenu");
    expect(r.envoi?.gabarit).toBe("apporteur-issue-retenu");
    expect(r.envoi?.attachments?.map((a) => a.r2Key)).toEqual(
      DOCUMENTS_ANNEXES.map((d) => d.cleR2),
    );
    expect(r.envoi?.attachments?.every((a) => a.facultative === true)).toBe(true);
    expect(r.envoi?.payload["annexesJointes"]).toEqual(IDS);
  });

  it("🔴 R2 en panne : « Retenu » est préparé quand même, sans pièce ni champ annexesJointes", async () => {
    h.entete.mockRejectedValue(new Error("R2 en panne"));
    const r = await preparer("retenu");
    expect(r.envoi?.gabarit).toBe("apporteur-issue-retenu");
    expect(r.envoi).not.toHaveProperty("attachments");
    expect(r.envoi?.payload).not.toHaveProperty("annexesJointes");
    expect(r.envoi?.payload["dossierUrl"]).toEqual(expect.stringContaining("/apporteur/dossier/"));
  });

  it.each(["a_verifier", "signe"])(
    "dossier %s : aucune pièce (la contresignature les envoie), aucune lecture de R2",
    async (statut) => {
      dossierOuvert(statut);
      const r = await preparer("retenu");
      expect(r.envoi?.payload["dossierSigne"]).toBe(true);
      expect(r.envoi).not.toHaveProperty("attachments");
      expect(r.envoi?.payload).not.toHaveProperty("annexesJointes");
      expect(h.entete).not.toHaveBeenCalled();
    },
  );

  it("« Absent » : aucune pièce, aucune lecture de R2", async () => {
    const r = await preparer("absent");
    expect(r.envoi?.gabarit).toBe("apporteur-issue-absent");
    expect(r.envoi).not.toHaveProperty("attachments");
    expect(r.envoi?.payload).not.toHaveProperty("annexesJointes");
    expect(h.entete).not.toHaveBeenCalled();
  });

  it("« Non retenu » : aucune pièce, aucune lecture de R2", async () => {
    const r = await preparer("non_retenu");
    expect(r.envoi?.gabarit).toBe("apporteur-issue-non-retenu");
    expect(r.envoi).not.toHaveProperty("attachments");
    expect(r.envoi?.payload).not.toHaveProperty("annexesJointes");
    expect(h.entete).not.toHaveBeenCalled();
  });
});

describe("envoyerIssue : les pièces vont à la file, le jobId ne change pas", () => {
  it("« Retenu » : enqueueEmail reçoit les pièces ; jobId = gabarit + empreinte", async () => {
    const prep = await preparer("retenu");
    await expect(envoyerIssue(prep)).resolves.toEqual({ statut: "envoye" });
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, , , payload, options] = h.enqueue.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("apporteur-issue-retenu");
    expect(payload["annexesJointes"]).toEqual(IDS);
    expect(options["jobId"]).toBe("apporteur-issue-retenu-empreinte-1");
    expect((options["attachments"] as { r2Key: string }[]).map((a) => a.r2Key)).toEqual(
      DOCUMENTS_ANNEXES.map((d) => d.cleR2),
    );
  });

  it("R2 en panne : l'e-mail est quand même mis en file, sans option attachments", async () => {
    h.entete.mockRejectedValue(new Error("R2 en panne"));
    const prep = await preparer("retenu");
    await expect(envoyerIssue(prep)).resolves.toEqual({ statut: "envoye" });
    const options = h.enqueue.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(options).not.toHaveProperty("attachments");
    expect(options["jobId"]).toBe("apporteur-issue-retenu-empreinte-1");
  });

  it("« Non retenu » : mis en file sans pièce", async () => {
    const prep = await preparer("non_retenu");
    await envoyerIssue(prep);
    expect(h.enqueue.mock.calls[0]?.[4]).not.toHaveProperty("attachments");
  });
});
