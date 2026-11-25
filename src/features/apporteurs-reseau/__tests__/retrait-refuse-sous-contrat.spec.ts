// L2 (plan apporteurs-sept-points-salariat) : « Retirer du réseau » ne peut plus écarter un
// apporteur sous contrat. Le geste devient « Classer le dossier (non signé) », avec un motif
// obligatoire, écrit dans la ligne de retrait et dans le journal.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const p = vi.hoisted(() => ({
  retraitFindUnique: vi.fn(),
  retraitCreate: vi.fn(),
  apporteurFindUnique: vi.fn(),
  apporteurUpdate: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => {
  const client = {
    apporteurReseauRetrait: { findUnique: p.retraitFindUnique, create: p.retraitCreate },
    apporteurReseau: { findUnique: p.apporteurFindUnique, update: p.apporteurUpdate },
    activityLog: { create: p.journal },
    $transaction: (f: (tx: unknown) => unknown) => f(client),
  };
  return { prisma: client };
});

import { refusSuppression, retirerDuReseau } from "../retrait";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MOTIF = "Dossier jamais signé, sans suite depuis trois mois.";

beforeEach(() => {
  vi.clearAllMocks();
  p.retraitFindUnique.mockResolvedValue(null);
  p.apporteurUpdate.mockResolvedValue({ id: ID });
});

function statut(s: string) {
  p.apporteurFindUnique.mockResolvedValue({ id: ID, statut: s });
}

describe("classer un dossier : refus sous contrat", () => {
  it.each(["signe", "a_verifier"])("dossier %s : refusé, rien n'est écrit", async (s) => {
    statut(s);
    const r = await retirerDuReseau(ID, "adm-1", MOTIF);
    expect(r.ok).toBe(false);
    expect(p.retraitCreate).not.toHaveBeenCalled();
    expect(p.apporteurUpdate).not.toHaveBeenCalled(); // versionLien inchangé
    expect(p.journal).not.toHaveBeenCalled();
  });

  it("le message d'un dossier signé renvoie à « Résilier le contrat »", async () => {
    statut("signe");
    const r = await retirerDuReseau(ID, "adm-1", MOTIF);
    expect(r.message).toContain("Résilier le contrat");
  });

  it("le message d'un dossier à vérifier parle de contresignature", async () => {
    statut("a_verifier");
    const r = await retirerDuReseau(ID, "adm-1", MOTIF);
    expect(r.message).toContain("contresignature");
  });
});

describe("classer un dossier : motif obligatoire", () => {
  it.each([
    ["", "vide"],
    ["  ", "blanc"],
    ["ab", "trop court"],
    ["x".repeat(501), "trop long"],
  ])("motif %#  (%s) : refusé", async (motif) => {
    statut("dossier_en_cours");
    const r = await retirerDuReseau(ID, "adm-1", motif);
    expect(r.ok).toBe(false);
    expect(p.retraitCreate).not.toHaveBeenCalled();
    expect(p.journal).not.toHaveBeenCalled();
  });

  it("motif absent (undefined) : refusé", async () => {
    statut("dossier_en_cours");
    const r = await (retirerDuReseau as (...a: unknown[]) => Promise<{ ok: boolean }>)(ID, "adm-1");
    expect(r.ok).toBe(false);
    expect(p.retraitCreate).not.toHaveBeenCalled();
  });

  it("dossier non signé avec motif : classé, motif dans la ligne, journal sans le texte", async () => {
    statut("dossier_en_cours");
    const r = await retirerDuReseau(ID, "adm-1", `  ${MOTIF}  `);
    expect(r.ok).toBe(true);
    expect(p.retraitCreate).toHaveBeenCalledWith({
      data: { apporteurId: ID, retirePar: "adm-1", motif: MOTIF },
    });
    expect(p.apporteurUpdate).toHaveBeenCalled();
    const j = p.journal.mock.calls[0]![0].data;
    expect(j.adminUserId).toBe("adm-1");
    // Le texte libre ne va PAS au journal (conservé, jamais effacé) : seule la colonne le porte.
    expect(j.changes.motif).toBeUndefined();
    expect(j.changes.motifSaisi).toBe(true);
  });

  it("motif avec téléphone, e-mail et IBAN : masqué en colonne, absent du journal", async () => {
    statut("dossier_en_cours");
    const brut =
      "Ne répond plus, joint au 06 12 34 56 78 / jean.dupont@gmail.com / FR76 3000 6000 0112 3456 7890 189";
    const r = await retirerDuReseau(ID, "adm-1", brut);
    expect(r.ok).toBe(true);
    const col: string = p.retraitCreate.mock.calls[0]![0].data.motif;
    expect(col).not.toMatch(/\d{4}|@|jean\.dupont|06 12/);
    expect(col).toContain("[téléphone masqué]");
    expect(col).toContain("[e-mail masqué]");
    expect(col).toContain("[IBAN masqué]");
    expect(col).toContain("Ne répond plus");
    const changes = JSON.stringify(p.journal.mock.calls[0]![0].data.changes);
    expect(changes).not.toMatch(/\d{4}|@|jean|Ne répond/);
  });

  it("le refus sous contrat dit « classement », pas « retrait »", async () => {
    statut("signe");
    const r = await retirerDuReseau(ID, "adm-1", MOTIF);
    expect(r.message).toContain("le classement n'est pas possible");
    expect(r.message).not.toContain("le retrait");
  });

  it("dossier résilié : classable", async () => {
    statut("resilie");
    expect((await retirerDuReseau(ID, "adm-1", MOTIF)).ok).toBe(true);
  });
});

describe("refusSuppression : la bonne voie", () => {
  const base = {
    statut: "dossier_en_cours",
    signeParApporteurAt: null,
    signeParSocieteAt: null,
    commissions: 0,
    presentations: 0,
    filleuls: 0,
    ficheCandidat: true,
  };
  it("dossier signé : renvoie à « Résilier le contrat »", () => {
    expect(refusSuppression({ ...base, statut: "signe" })).toContain("Résilier le contrat");
  });
  it("dossier non signé : renvoie à « Classer le dossier »", () => {
    const m = refusSuppression({ ...base, commissions: 2 });
    expect(m).toContain("Classer le dossier");
    expect(m).not.toContain("Retirer du réseau");
  });
});

describe("verrou de source", () => {
  it("RetraitDuReseau.tsx ne contient plus le libellé « Retirer du réseau »", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/admin/apporteurs/fiche/RetraitDuReseau.tsx"),
      "utf8",
    );
    expect(src).not.toContain("Retirer du réseau");
    expect(src).toContain("Classer le dossier (non signé)");
    expect(src).toContain("Sans nom, adresse, téléphone ni coordonnées bancaires");
  });
});
