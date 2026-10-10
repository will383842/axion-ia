/**
 * L6b — ENVOI GROUPÉ AUX FUTURS APPORTEURS, AVEC DE VRAIES PII CHIFFRÉES.
 *
 * `contactName` et `contactEmail` sont chiffrés au repos. Le premier test de
 * cette action remplaçait le déchiffrement par l'identité : il ne pouvait pas
 * voir qu'un nom découpé ENCORE CHIFFRÉ rend un prénom vide, et que le modèle
 * (« Bonjour {prenom}, ») écartait alors chaque destinataire. Ici, rien n'est
 * simulé côté chiffrement : clé de test, vrai `encryptPii`, vrai `decryptPii`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", role: "admin", name: "Will" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
const ecrire = vi.fn();
vi.mock("../envoyer-reponse", () => ({
  ecrireEtEnfilerReponseSubmission: (...a: unknown[]) => ecrire(...a),
}));
const opposees = new Set<string>();
vi.mock("@/server/email/opposition", () => ({ estOpposee: async (e: string) => opposees.has(e) }));
const preparer = vi.fn();
vi.mock("@/server/partages/attacher-a-une-reponse", () => ({
  preparerLienFichiers: (...a: unknown[]) => preparer(...a),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  lireSuiviInvitationListe: async () => new Map(),
}));

import { encryptPii } from "@/lib/pii-crypto";
import { repondreEnMasseApporteursAction } from "../actions-reponse-en-masse-apporteurs";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

function fiche(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `0000000${i}-0000-4000-8000-000000000000`,
    contactEmail: encryptPii(`p${i}@exemple.fr`),
    contactName: encryptPii(`Prenom${i} Nom${i}`),
    locale: "fr",
    status: "new",
    deletedAt: null,
    details: APPORTEUR,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  opposees.clear();
  process.env["PII_ENCRYPTION_KEY"] = "a1".repeat(32);
  ecrire.mockResolvedValue({ ecrit: true, enfile: true, replyId: "r" });
});

describe("repondreEnMasseApporteursAction — noms chiffrés", () => {
  it("le nom est déchiffré avant d'être découpé : le message part, prénom compris", async () => {
    const f = fiche(1);
    expect(f.contactName.startsWith("enc:v1:")).toBe(true);
    findMany.mockResolvedValueOnce([f]);
    const r = await repondreEnMasseApporteursAction({ ids: [f.id], modele: "presentation-reseau" });
    expect(r.ok && r.envoyees).toBe(1);
    expect(r.ok && r.details).toEqual([]);
    const contenu = ecrire.mock.calls[0]![2] as { bodyMarkdown: string };
    expect(contenu.bodyMarkdown).toMatch(/^Bonjour Prenom1,/);
  });

  it("les exclus sont nommés en clair, jamais par leur valeur chiffrée", async () => {
    const lignes = [fiche(1), fiche(2, { details: { ...APPORTEUR, sansSuiteAt: "2026-09-30" } })];
    opposees.add("p1@exemple.fr");
    findMany.mockResolvedValueOnce(lignes);
    const r = await repondreEnMasseApporteursAction({
      ids: lignes.map((l) => l.id),
      modele: "presentation-reseau",
    });
    expect(r.ok && r.envoyees).toBe(0);
    expect(r.ok && r.details).toEqual([
      expect.objectContaining({ id: lignes[0]!.id, motif: "opposee", nom: "Prenom1 N." }),
      expect.objectContaining({ id: lignes[1]!.id, motif: "sans_suite", nom: "Prenom2 N." }),
    ]);
    expect(JSON.stringify(r)).not.toContain("enc:v1:");
  });
});
