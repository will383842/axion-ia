// Retirer du réseau / Remettre / Supprimer définitivement (2026-10-07).
//
// Ce qui est figé :
//   · RETIRER n'efface rien et désactive le lien (versionLien + 1) ; un signé est averti ;
//   · REMETTRE crée un nouveau lien (versionLien + 1), sans rien envoyer ;
//   · SUPPRIMER n'est permis que pour un dossier jamais signé, sans commission, sans
//     présentation ni filleul ; les contrôles sont refaits dans la transaction ; la fiche
//     candidat reste ; le journal garde une ligne ;
//   · avant la migration, la table absente se lit comme « personne n'est retiré ».
import { beforeEach, describe, expect, it, vi } from "vitest";

const p = vi.hoisted(() => ({
  retraitFindMany: vi.fn(),
  retraitFindUnique: vi.fn(),
  retraitCreate: vi.fn(),
  retraitDeleteMany: vi.fn(),
  apporteurFindUnique: vi.fn(),
  apporteurUpdate: vi.fn(),
  apporteurDelete: vi.fn(),
  apporteurDeleteMany: vi.fn(),
  pieceDeleteMany: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionEcriture: vi.fn(),
  verrou: vi.fn(),
  ordre: [] as string[],
  journal: vi.fn(),
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => {
  const client = {
    apporteurReseauRetrait: {
      findMany: p.retraitFindMany,
      findUnique: p.retraitFindUnique,
      create: p.retraitCreate,
      deleteMany: p.retraitDeleteMany,
    },
    apporteurReseau: {
      findUnique: (...a: unknown[]) => {
        p.ordre.push("lecture");
        return p.apporteurFindUnique(...a);
      },
      update: p.apporteurUpdate,
      delete: p.apporteurDelete,
      deleteMany: p.apporteurDeleteMany,
    },
    pieceApporteur: { deleteMany: p.pieceDeleteMany },
    // 🔴 La fiche CANDIDAT ne doit JAMAIS être écrite : toute écriture lève dans ce test.
    submission: {
      findFirst: p.submissionFindFirst,
      delete: p.submissionEcriture,
      deleteMany: p.submissionEcriture,
      update: p.submissionEcriture,
      updateMany: p.submissionEcriture,
    },
    activityLog: { create: p.journal },
    $queryRaw: (...a: unknown[]) => {
      p.ordre.push("verrou");
      return p.verrou(...a);
    },
    $transaction: (f: (tx: unknown) => unknown) => f(client),
  };
  return { prisma: client };
});

import {
  idsRetires,
  refusSuppression,
  remettreDansLeReseau,
  retirerDuReseau,
  supprimerDefinitivement,
  type EtatSuppression,
} from "../retrait";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VIERGE: EtatSuppression = {
  statut: "dossier_en_cours",
  signeParApporteurAt: null,
  signeParSocieteAt: null,
  commissions: 0,
  presentations: 0,
  filleuls: 0,
  ficheCandidat: true,
};

function dossier(over: Partial<EtatSuppression> & { pieces?: number } = {}) {
  const e = { ...VIERGE, ...over };
  return {
    id: ID,
    statut: e.statut,
    prenom: "Claire",
    nom: "Durand",
    emailHash: "h-claire",
    submissionId: "sub-1",
    signeParApporteurAt: e.signeParApporteurAt,
    signeParSocieteAt: e.signeParSocieteAt,
    _count: {
      commissions: e.commissions,
      presentations: e.presentations,
      filleuls: e.filleuls,
      pieces: over.pieces ?? 2,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.ordre.length = 0;
  p.apporteurUpdate.mockResolvedValue({ id: ID });
  p.apporteurDeleteMany.mockResolvedValue({ count: 1 });
  p.submissionFindFirst.mockResolvedValue({ id: "sub-1" });
  p.submissionEcriture.mockRejectedValue(new Error("ÉCRITURE INTERDITE sur la fiche candidat"));
  p.verrou.mockResolvedValue([]);
});

describe("refusSuppression", () => {
  it("un dossier vierge peut être supprimé", () => {
    expect(refusSuppression(VIERGE)).toBeNull();
  });
  it.each([
    ["signé par l'apporteur", { signeParApporteurAt: new Date() }],
    ["contresigné", { signeParSocieteAt: new Date() }],
    ["à vérifier (signé)", { statut: "a_verifier" }],
    ["résilié", { statut: "resilie" }],
    ["avec une commission", { commissions: 1 }],
    ["avec une entreprise présentée", { presentations: 1 }],
    ["parrain d'un filleul", { filleuls: 1 }],
    ["SANS fiche candidat (le contact serait perdu)", { ficheCandidat: false }],
  ])("%s : refusé, avec une phrase qui renvoie à « Retirer du réseau »", (_c, over) => {
    expect(refusSuppression({ ...VIERGE, ...over })).toMatch(/Retirer du réseau/);
  });
});

describe("retirer du réseau", () => {
  it("crée la ligne de retrait, désactive le lien, journalise — et n'efface rien", async () => {
    p.apporteurFindUnique.mockResolvedValue({ id: ID, statut: "dossier_en_cours" });
    p.retraitFindUnique.mockResolvedValue(null);
    const r = await retirerDuReseau(ID, "adm-1");
    expect(r.ok).toBe(true);
    expect(p.retraitCreate).toHaveBeenCalledWith({ data: { apporteurId: ID, retirePar: "adm-1" } });
    expect(p.apporteurUpdate.mock.calls[0]![0].data).toEqual({ versionLien: { increment: 1 } });
    expect(p.journal.mock.calls[0]![0].data).toMatchObject({
      adminUserId: "adm-1",
      action: "apporteur.retire_du_reseau",
      targetId: ID,
    });
    expect(p.apporteurDelete).not.toHaveBeenCalled();
    expect(p.pieceDeleteMany).not.toHaveBeenCalled();
  });

  it("contrat SIGNÉ : le message dit que le contrat n'est pas résilié (préavis, art. 11.1)", async () => {
    p.apporteurFindUnique.mockResolvedValue({ id: ID, statut: "signe" });
    p.retraitFindUnique.mockResolvedValue(null);
    const r = await retirerDuReseau(ID, "adm-1");
    expect(r.message).toMatch(/N'EST PAS résilié/);
    expect(r.message).toMatch(/11\.1/);
    expect(r.message).toMatch(/commissions dues restent dues/);
  });

  it("déjà retirée : refus, rien ne bouge", async () => {
    p.apporteurFindUnique.mockResolvedValue({ id: ID, statut: "signe" });
    p.retraitFindUnique.mockResolvedValue({ apporteurId: ID });
    expect((await retirerDuReseau(ID, "adm-1")).ok).toBe(false);
    expect(p.apporteurUpdate).not.toHaveBeenCalled();
  });
});

describe("remettre dans le réseau", () => {
  it("retire la ligne et crée un NOUVEAU lien (versionLien + 1), sans envoi", async () => {
    p.retraitDeleteMany.mockResolvedValue({ count: 1 });
    const r = await remettreDansLeReseau(ID, "adm-1");
    expect(r).toMatchObject({ ok: true });
    expect(r.message).toMatch(/n'a pas été envoyé/);
    expect(p.apporteurUpdate.mock.calls[0]![0].data).toEqual({ versionLien: { increment: 1 } });
    expect(p.journal.mock.calls[0]![0].data.action).toBe("apporteur.remis_dans_le_reseau");
  });

  it("fiche non retirée : refus", async () => {
    p.retraitDeleteMany.mockResolvedValue({ count: 0 });
    expect((await remettreDansLeReseau(ID, "adm-1")).ok).toBe(false);
    expect(p.apporteurUpdate).not.toHaveBeenCalled();
  });
});

describe("supprimer définitivement", () => {
  it("dossier vierge, nom retapé : dossier et pièces supprimés, fiche candidat INTACTE, journal", async () => {
    p.apporteurFindUnique.mockResolvedValue(dossier());
    const r = await supprimerDefinitivement(ID, "adm-1", "  claire DURAND ");
    expect(r.ok).toBe(true);
    expect(p.pieceDeleteMany).toHaveBeenCalledWith({ where: { apporteurId: ID } });
    // La suppression est CONDITIONNÉE à l'absence de signature.
    expect(p.apporteurDeleteMany.mock.calls[0]![0].where).toMatchObject({
      id: ID,
      signeParApporteurAt: null,
      signeParSocieteAt: null,
    });
    // Toute écriture sur la fiche candidat aurait levé (voir le mock) : r.ok le prouve.
    expect(p.submissionEcriture).not.toHaveBeenCalled();
    const j = p.journal.mock.calls[0]![0].data;
    expect(j).toMatchObject({ action: "apporteur.dossier_supprime_definitivement", targetId: ID });
    expect(JSON.stringify(j.changes)).not.toMatch(/Claire|Durand/);
    expect(j.changes).toMatchObject({ submissionId: "sub-1", piecesSupprimees: 2 });
  });

  it("🔴 la ligne est VERROUILLÉE (FOR UPDATE) AVANT d'être relue et contrôlée", async () => {
    p.apporteurFindUnique.mockResolvedValue(dossier());
    await supprimerDefinitivement(ID, "adm-1", "Claire Durand");
    expect(p.ordre.slice(0, 2)).toEqual(["verrou", "lecture"]);
    expect(String((p.verrou.mock.calls[0]![0] as string[]).join("?"))).toMatch(/FOR UPDATE/);
  });

  it("🔴 signé ENTRE le contrôle et l'effacement : la suppression conditionnée ne touche rien → refus, pas de journal", async () => {
    p.apporteurFindUnique.mockResolvedValue(dossier());
    p.apporteurDeleteMany.mockResolvedValue({ count: 0 });
    const r = await supprimerDefinitivement(ID, "adm-1", "Claire Durand");
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/vient de changer/);
    expect(p.journal).not.toHaveBeenCalled();
  });

  it("🔴 SANS fiche candidat (dossier créé par « Nouvel apporteur ») : refus, rien n'est effacé", async () => {
    p.apporteurFindUnique.mockResolvedValue({ ...dossier(), submissionId: null });
    const r = await supprimerDefinitivement(ID, "adm-1", "Claire Durand");
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/perdre/);
    expect(p.pieceDeleteMany).not.toHaveBeenCalled();
    expect(p.apporteurDeleteMany).not.toHaveBeenCalled();
  });

  it("fiche candidat EFFACÉE (art. 17) : traitée comme absente, refus", async () => {
    p.apporteurFindUnique.mockResolvedValue(dossier());
    p.submissionFindFirst.mockResolvedValue(null);
    expect((await supprimerDefinitivement(ID, "adm-1", "Claire Durand")).ok).toBe(false);
    expect(p.submissionFindFirst.mock.calls[0]![0].where).toEqual({ id: "sub-1", deletedAt: null });
    expect(p.apporteurDeleteMany).not.toHaveBeenCalled();
  });

  it.each([
    { commissions: 1 },
    { presentations: 1 },
    { filleuls: 1 },
    { signeParApporteurAt: new Date() },
  ])("%o : refusé, rien n'est supprimé", async (over) => {
    p.apporteurFindUnique.mockResolvedValue(dossier(over));
    expect((await supprimerDefinitivement(ID, "adm-1", "Claire Durand")).ok).toBe(false);
    expect(p.apporteurDeleteMany).not.toHaveBeenCalled();
    expect(p.pieceDeleteMany).not.toHaveBeenCalled();
  });

  it("nom mal retapé : rien n'est supprimé", async () => {
    p.apporteurFindUnique.mockResolvedValue(dossier());
    const r = await supprimerDefinitivement(ID, "adm-1", "Claire");
    expect(r).toMatchObject({ ok: false });
    expect(p.apporteurDeleteMany).not.toHaveBeenCalled();
  });
});

describe("avant la migration", () => {
  it("table absente (P2021) : personne n'est retiré, rien ne lève", async () => {
    p.retraitFindMany.mockRejectedValue(Object.assign(new Error("absente"), { code: "P2021" }));
    expect((await idsRetires()).size).toBe(0);
  });
  it("toute autre erreur remonte", async () => {
    p.retraitFindMany.mockRejectedValue(new Error("base injoignable"));
    await expect(idsRetires()).rejects.toThrow("base injoignable");
  });
});
