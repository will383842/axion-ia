import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Décision de Will (10/10) : un nom de contrat qui ne correspond à personne au registre ne
// BLOQUE pas la contresignature, mais l'aperçu l'affiche et l'envoi exige la case cochée
// (revérifiée au serveur), tracée au journal d'activité. Tout le serveur est remplacé.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  lireDossier: vi.fn(),
  registre: vi.fn(),
  appFindUnique: vi.fn(),
  appUpdateMany: vi.fn(async (_a?: unknown) => ({ count: 1 })),
  journal: vi.fn(),
}));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => h.registre(...a),
  lireRegistre: (...a: unknown[]) => h.registre(...a),
}));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  apercu: vi.fn(async () => ({ sujet: "s", html: "<p/>", destinataire: "x" })),
  avecTexteLibre: (payload: Record<string, unknown>) => payload,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: vi.fn(),
}));
const TEXTE = "CONTRAT signé";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: vi.fn(),
    empreinte: (t: string) => createHash("sha256").update(t).digest("hex"),
    rendreContratPdf: vi.fn(async () => Buffer.from("%PDF")),
  };
});
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: vi.fn(),
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: (...a: unknown[]) => h.appFindUnique(...a),
      updateMany: (...a: unknown[]) => h.appUpdateMany(...a),
    },
    pieceApporteur: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: { create: (...a: unknown[]) => h.journal(...a) },
  },
}));

import { apercuDecision, appliquerDecision, NOM_A_CONFIRMER } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ADMIN = "11111111-2222-4333-8444-555566667777";

const entreprise = (personnes: unknown[]) => ({
  ok: true,
  entreprise: { siren: "732829320", active: true, personnes, dirigeantsSocietes: 0 },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
  h.envoyer.mockResolvedValue("envoye");
  h.lireDossier.mockResolvedValue({
    id: ID,
    statut: "a_verifier",
    versionLien: 1,
    prenom: "Claire",
    nom: "Martin",
    email: "claire@exemple.fr",
    siren: "732829320",
    pieces: [{ type: "identite", statut: "conforme" }],
  });
  h.appFindUnique.mockResolvedValue({
    signatureApporteur: {
      nomTape: "Claire Martin",
      signeAt: "2026-10-05T10:00:00.000Z",
      texteSha256: sha(TEXTE),
      texte: TEXTE,
      valeurs: {},
    },
  });
});

describe("le nom ne correspond pas au registre", () => {
  beforeEach(() => {
    h.registre.mockResolvedValue(
      entreprise([{ nom: "DURAND", prenoms: "PAUL", qualite: "Gérant" }]),
    );
  });

  it("l'aperçu se prépare quand même, avec l'alerte en clair", async () => {
    const r = await apercuDecision(ID, "contresigner", null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.alerteNom).toBe(
      "Le nom du contrat (Claire Martin) ne correspond à personne dans le registre pour ce SIREN : personnes trouvées : PAUL DURAND, gérant. Vérifiez la pièce d'identité et le RIB avant de contresigner.",
    );
  });

  it("case non cochée : refus clair, rien n'est contresigné ni envoyé", async () => {
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toEqual({ ok: false, message: NOM_A_CONFIRMER });
    expect(h.appUpdateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("case cochée : contresigné, et la confirmation est tracée (sans aucun nom)", async () => {
    const r = await appliquerDecision(ID, "contresigner", null, undefined, {
      nomVerifie: true,
      acteurId: ADMIN,
    });
    expect(r).toMatchObject({ ok: true });
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(h.journal).toHaveBeenCalledWith({
      data: {
        adminUserId: ADMIN,
        action: "apporteur_reseau.nom_registre_confirme",
        targetType: "apporteur_reseau",
        targetId: ID,
        changes: { resultat: "ne_correspond_pas", confirme: true },
      },
    });
  });

  it("une trace qui échoue ne fait pas échouer la contresignature", async () => {
    h.journal.mockRejectedValue(new Error("base"));
    const r = await appliquerDecision(ID, "contresigner", null, undefined, { nomVerifie: true });
    expect(r).toMatchObject({ ok: true });
  });
});

describe("pas d'alerte : aucune case exigée, rien de tracé", () => {
  it.each([
    ["le nom correspond", [{ nom: "MARTIN", prenoms: "CLAIRE ANNE", qualite: null }]],
    ["aucun nom au registre (diffusion partielle)", []],
  ])("%s", async (_cas, personnes) => {
    h.registre.mockResolvedValue(entreprise(personnes));
    const a = await apercuDecision(ID, "contresigner", null);
    expect(a.ok && a.alerteNom).toBeFalsy();
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(h.journal).not.toHaveBeenCalled();
  });
});
