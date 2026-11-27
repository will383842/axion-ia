import { beforeEach, describe, expect, it, vi } from "vitest";

// Annonces à l'apporteur après l'avoir du client (art. 4.5) : réduction ou annulation avant
// facturation, part du parrain, reprise d'une ligne versée. Un envoi par état atteint, jamais deux.
// Dépôt public : aucun montant en euros écrit en dur, les centimes passent par euros().

interface F {
  id: string;
  devisId: string | null;
  statut: string;
  montantHtCents: number;
  avoirDeId: string | null;
  emiseAt: Date | null;
  createdAt: Date | null;
  /** Le devis de la commande (base de signature), lu par `findUnique`. */
  devis?: { montantTotalHtCents: number } | null;
}

const d = vi.hoisted(() => ({
  factures: [] as F[],
  lignes: [] as Array<Record<string, unknown>>,
  reprisesDeja: [] as Array<{ montantCents: number; palier?: string; statut?: string }>,
  filleulHorsGroupe: null as null | Record<string, unknown>,
  annuler: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  reduire: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
    ok: true,
    montantCents: 70,
  })),
  retenir: vi.fn(async (..._a: unknown[]) => ({
    ok: true,
    numero: "AXI-APP-2026-0002",
    avoir: { r2Key: "k", filename: "AXI-APP-2026-0002.pdf" },
  })),
  reprise: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
    ok: true,
    message: "",
    repriseId: "r1",
  })),
  envoyer: vi.fn(async (...a: unknown[]) => {
    const jobId = (a[0] as { jobId?: string }).jobId;
    if (jobId) d.envoyes.add(jobId);
    return "envoye";
  }),
  envoyes: new Set<string>(),
  maj: vi.fn(async () => ({ count: 1 })),
  cree: vi.fn(async () => ({ id: "nouvelle" })),
  litige: true,
}));

type Where = Record<string, unknown>;
const correspond = (f: F, w: Where): boolean => {
  const idw = w.id as string | { in: string[] } | undefined;
  if (typeof idw === "string" && f.id !== idw) return false;
  if (idw && typeof idw === "object" && !idw.in.includes(f.id)) return false;
  if (w.avoirDeId === null && f.avoirDeId !== null) return false;
  const a = w.avoirDeId as { not?: null; in?: string[] } | undefined;
  if (a && typeof a === "object" && "not" in a && f.avoirDeId === null) return false;
  if (a && typeof a === "object" && a.in && !a.in.includes(f.avoirDeId ?? "")) return false;
  const dv = w.devisId as string | { in: string[] } | undefined;
  if (typeof dv === "string" && f.devisId !== dv) return false;
  if (dv && typeof dv === "object" && !dv.in.includes(f.devisId ?? "")) return false;
  return true;
};

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    factureFormation: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        d.factures.filter((f) => correspond(f, where)),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          d.factures.find((f) => f.id === where.id) ?? null,
      ),
    },
    commissionApporteur: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        "palier" in where
          ? d.reprisesDeja
          : d.lignes.filter((l) => {
              const f = where.factureId as { in?: string[] } | undefined;
              return !f?.in || f.in.includes(l.factureId as string);
            }),
      ),
      updateMany: (...a: unknown[]) => d.maj(...(a as [])),
      create: (...a: unknown[]) => d.cree(...(a as [])),
      findFirst: vi.fn(async () => d.filleulHorsGroupe),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    apporteurReseau: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        prenom: "Essai",
        email: `${where.id}@exemple.fr`,
      })),
    },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});
vi.mock("../litige", () => ({ litigeDisponible: async () => d.litige }));
// Tour 2/2 (défaut 7) : le complément passe par la vigilance comme toute commission neuve.
vi.mock("../commissions", () => ({
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
  dejaEnvoye: vi.fn(async (jobId: string) => d.envoyes.has(jobId)),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => d.envoyer(...(a as [])) }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../manquement", () => ({ retenir: (...a: unknown[]) => d.retenir(...(a as [])) }));
vi.mock("../resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise:",
  enregistrerReprise: (...a: unknown[]) => d.reprise(...(a as [])),
}));
vi.mock("../ajustement", async (orig) => {
  const vrai = await orig<typeof import("../ajustement")>();
  return {
    commissionPourPrixConserve: vrai.commissionPourPrixConserve,
    partDuParrain: vrai.partDuParrain,
    annulerCommission: (...a: unknown[]) => d.annuler(...(a as [])),
    reduireCommission: (...a: unknown[]) => d.reduire(...(a as [])),
  };
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderEmailTemplate } from "@/lib/email/templates";

import { euros } from "../regles";
import { reprendreApresAvoirsClients } from "../avoir-client";

const LE = new Date("2026-10-09T11:10:00Z");
const DATE_AVOIR = new Date("2026-03-02T08:00:00Z");
const ligne = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  apporteurId: "a1",
  factureId: "F1",
  parrainage: false,
  statut: "due",
  activite: "audit",
  palier: null,
  prixPublicHtCents: null,
  factureHtCents: 334,
  montantCents: 100,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  verseeAt: null,
  // Ligne créée avant les avoirs des jeux d'essai (qui la réduisent donc tous).
  creeAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});
const facture: F = {
  id: "F1",
  devisId: null,
  statut: "payee",
  montantHtCents: 334,
  avoirDeId: null,
  emiseAt: LE,
  createdAt: LE,
};
const avoir = (montant: number, over: Partial<F> = {}): F => ({
  id: "A1",
  devisId: null,
  statut: "emise",
  montantHtCents: montant,
  avoirDeId: "F1",
  emiseAt: DATE_AVOIR,
  createdAt: DATE_AVOIR,
  ...over,
});

type Envoi = {
  gabarit: string;
  destinataire: string;
  payload: Record<string, unknown>;
  entityId: string;
  jobId: string;
  attachments?: unknown[];
};
const envois = (): Envoi[] => d.envoyer.mock.calls.map((c) => (c as unknown as [Envoi])[0]);

beforeEach(() => {
  vi.clearAllMocks();
  d.factures = [facture, avoir(-334)];
  d.lignes = [ligne()];
  d.reprisesDeja = [];
  d.filleulHorsGroupe = null;
  d.litige = true;
  d.envoyes.clear();
  d.maj.mockImplementation(async () => ({ count: 1 }));
  d.reduire.mockImplementation(async () => ({ ok: true, montantCents: 70 }));
  d.reprise.mockImplementation(async () => ({ ok: true, message: "", repriseId: "r1" }));
});

const versee = { statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE };

describe("part du parrain ajustée avec le filleul non facturé (relecture du 27/11, point 1)", () => {
  it("avoir total, filleul et parrain « due » non facturés : le parrain reçoit SON e-mail (clé par ligne)", async () => {
    d.lignes = [
      ligne({ id: "f1", apporteurId: "a1" }),
      ligne({ id: "p1", apporteurId: "parrain1", parrainage: true, montantCents: 10 }),
    ];
    // Le vrai ajustement.ts annonce la part du parrain par le rappel qu'on lui passe.
    d.annuler.mockImplementationOnce(async (...a: unknown[]) => {
      const rappel = a[3] as (e: Record<string, unknown>) => Promise<void>;
      await rappel({ type: "annulee", apporteurId: "parrain1", ligneId: "p1", avantCents: 10 });
      return { ok: true };
    });
    await reprendreApresAvoirsClients(LE);
    const e = envois();
    const parrain = e.find((x) => x.entityId === "parrain1");
    expect(parrain).toMatchObject({
      destinataire: "parrain1@exemple.fr",
      jobId: "apporteur-commission-annulee-p1",
    });
    expect(parrain!.payload).toMatchObject({
      variante: "annulee",
      avant: euros(10),
      annulationLe: "2 mars 2026",
    });
    expect(e.find((x) => x.entityId === "a1")?.jobId).toBe("apporteur-commission-annulee-f1");
  });
});

describe("réduite avant facturation", () => {
  it("avoir partiel → un envoi « reduite », clé par ligne et par montant atteint", async () => {
    d.factures = [facture, avoir(-100)];
    await reprendreApresAvoirsClients(LE);
    const e = envois();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      gabarit: "apporteur-commission-avoir-client",
      destinataire: "a1@exemple.fr",
      entityId: "a1",
      jobId: "apporteur-commission-reduite-c1-70",
    });
    expect(e[0]!.payload).toEqual({
      contactName: "Essai",
      variante: "reduite",
      avant: euros(100),
      apres: euros(70),
      annulationLe: "2 mars 2026",
    });
    expect(e[0]!.attachments).toBeUndefined();
  });

  it("second passage sur le même état : rien ; passage horaire puis quotidien : un seul envoi", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne({ factureHtCents: 234, montantCents: 70 })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).not.toHaveBeenCalled();
    expect(envois()).toHaveLength(0);

    d.lignes = [ligne()];
    await reprendreApresAvoirsClients(LE); // passage horaire
    await reprendreApresAvoirsClients(new Date("2026-10-10T03:00:00Z")); // passage quotidien
    expect(envois()).toHaveLength(1);
  });

  it("un second avoir partiel plus tard : nouvelle clé, un envoi de plus", async () => {
    d.factures = [facture, avoir(-100)];
    await reprendreApresAvoirsClients(LE);
    d.factures = [facture, avoir(-100), avoir(-34, { id: "A2" })];
    d.lignes = [ligne({ factureHtCents: 234, montantCents: 70 })];
    d.reduire.mockImplementationOnce(async () => ({ ok: true, montantCents: 60 }));
    await reprendreApresAvoirsClients(LE);
    expect(envois().map((e) => e.jobId)).toEqual([
      "apporteur-commission-reduite-c1-70",
      "apporteur-commission-reduite-c1-60",
    ]);
  });

  it("réduction refusée (ok:false) : aucun envoi", async () => {
    d.factures = [facture, avoir(-100)];
    d.reduire.mockImplementationOnce(async () => ({ ok: false, message: "changé" }));
    await reprendreApresAvoirsClients(LE);
    expect(envois()).toHaveLength(0);
  });
});

describe("annulée avant facturation", () => {
  it("avoir total → un envoi « annulee », sans montant « apres »", async () => {
    await reprendreApresAvoirsClients(LE);
    await reprendreApresAvoirsClients(LE);
    const e = envois();
    expect(e).toHaveLength(1);
    expect(e[0]!.jobId).toBe("apporteur-commission-annulee-c1");
    expect(e[0]!.payload).toEqual({
      contactName: "Essai",
      variante: "annulee",
      avant: euros(100),
      annulationLe: "2 mars 2026",
    });
  });
});

describe("part du parrain", () => {
  it("part annulée par écriture conditionnelle : l'e-mail part au PARRAIN", async () => {
    d.lignes = [
      ligne({ id: "filleul", autofactureNumero: "AXI-APP-2026-0001" }),
      ligne({ id: "parrain", parrainage: true, apporteurId: "p1", montantCents: 10 }),
    ];
    await reprendreApresAvoirsClients(LE);
    const vers = envois().filter((e) => e.entityId === "p1");
    expect(vers).toHaveLength(1);
    expect(vers[0]).toMatchObject({
      destinataire: "p1@exemple.fr",
      jobId: "apporteur-commission-annulee-parrain",
    });
    expect(vers[0]!.payload).toMatchObject({ variante: "annulee", avant: euros(10) });
  });

  it("part réduite (avoir partiel) : variante « reduite » avec la cible", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [
      ligne({ id: "filleul", autofactureNumero: "AXI-APP-2026-0001" }),
      ligne({ id: "parrain", parrainage: true, apporteurId: "p1", montantCents: 10 }),
    ];
    await reprendreApresAvoirsClients(LE);
    const vers = envois().filter((e) => e.entityId === "p1");
    expect(vers).toHaveLength(1);
    expect(vers[0]!.payload).toMatchObject({ variante: "reduite", avant: euros(10) });
    expect(vers[0]!.payload.apres).toEqual(expect.any(String));
  });

  it("écriture perdue (count 0) : aucun envoi", async () => {
    d.lignes = [
      ligne({ id: "filleul", autofactureNumero: "AXI-APP-2026-0001" }),
      ligne({ id: "parrain", parrainage: true, apporteurId: "p1", montantCents: 10 }),
    ];
    d.maj.mockImplementation(async (...a: unknown[]) => {
      const w = (a[0] as { where: { id: string } }).where;
      return { count: w.id === "parrain" ? 0 : 1 };
    });
    await reprendreApresAvoirsClients(LE);
    expect(envois().filter((e) => e.entityId === "p1")).toHaveLength(0);
  });
});

describe("reprise sur une ligne versée", () => {
  it("avoir partiel → une reprise, un envoi portant l'identifiant de la reprise", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne(versee)];
    await reprendreApresAvoirsClients(LE);
    await reprendreApresAvoirsClients(LE);
    const e = envois();
    expect(e).toHaveLength(1);
    expect(e[0]!.jobId).toBe("apporteur-commission-reprise-r1");
    expect(e[0]!.payload).toEqual({
      contactName: "Essai",
      variante: "reprise",
      avant: euros(100),
      repris: euros(30),
      annulationLe: "2 mars 2026",
    });
  });

  it("deux passages concurrents : le second refusé (ok:false) → une reprise, un envoi", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne(versee)];
    d.reprise
      .mockImplementationOnce(async () => ({ ok: true, message: "", repriseId: "r1" }))
      .mockImplementationOnce(async () => ({ ok: false, message: "Plafond dépassé." }));
    await Promise.all([reprendreApresAvoirsClients(LE), reprendreApresAvoirsClients(LE)]);
    expect(envois()).toHaveLength(1);
  });

  it("reprise sans identifiant : pas d'envoi, erreur signalée", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne(versee)];
    d.reprise.mockImplementationOnce(async () => ({ ok: true, message: "" }));
    const { signalerErreurReseau } = await import("../signaler");
    await reprendreApresAvoirsClients(LE);
    expect(envois()).toHaveLength(0);
    expect(signalerErreurReseau).toHaveBeenCalled();
  });
});

describe("ce qui ne change pas", () => {
  it("retenue existante → prevenirRetenue seul : pièce jointe, clé inchangée, payload sans variante", async () => {
    d.lignes = [ligne({ autofactureNumero: "AXI-APP-2026-0001" })];
    await reprendreApresAvoirsClients(LE);
    const e = envois();
    expect(e).toHaveLength(1);
    expect(e[0]!.jobId).toBe("apporteur-commission-avoir-client-AXI-APP-2026-0002");
    expect(e[0]!.attachments).toEqual([
      expect.objectContaining({ filename: "AXI-APP-2026-0002.pdf" }),
    ]);
    expect(e[0]!.payload).toEqual({ contactName: "Essai" });
  });

  it("bon d'achat exceptionnel (aucun avoir de facture) : aucune écriture, aucun envoi", async () => {
    d.factures = [facture];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b).toMatchObject({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.reduire).not.toHaveBeenCalled();
    expect(d.reprise).not.toHaveBeenCalled();
    expect(d.maj).not.toHaveBeenCalled();
    expect(envois()).toHaveLength(0);
  });

  it("apporteur retiré : le gabarit est dans GABARITS_ARGENT, l'e-mail part encore", async () => {
    const { GABARITS_ARGENT } = await vi.importActual<typeof import("../retrait")>("../retrait");
    expect(GABARITS_ARGENT.has("apporteur-commission-avoir-client")).toBe(true);
  });
});

describe("rendu des variantes", () => {
  const norm = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, " ");
  const rendu = async (payload: Record<string, unknown>) =>
    renderEmailTemplate("apporteur-commission-avoir-client" as never, "fr", {
      contactName: "Claire",
      ...payload,
    });
  const base = {
    avant: euros(60_000),
    apres: euros(30_000),
    repris: euros(12_345),
    annulationLe: "2 mars 2026",
  };

  it("reduite : les montants et la date viennent du payload", async () => {
    const r = await rendu({ variante: "reduite", ...base });
    const t = norm(r.text);
    expect(r.subject).toBe("Votre commission est réduite");
    expect(t).toContain(`elle passe de ${norm(euros(60_000))} à ${norm(euros(30_000))} hors taxes`);
    expect(t).toContain("avoir le 2 mars 2026");
    expect(t).toContain("aucune somme ne vous est demandée");
    expect(t).toContain("écrivez-nous depuis votre espace");
    expect(t).not.toMatch(/répondez à cet e-mail/i);
  });

  it("annulee", async () => {
    const r = await rendu({ variante: "annulee", ...base });
    expect(r.subject).toBe("Votre commission est annulée");
    expect(norm(r.text)).toContain(`(${norm(euros(60_000))} hors taxes) est annulée`);
  });

  it("reprise : somme reprise, prochain virement, avoir d'autofacture", async () => {
    const r = await rendu({ variante: "reprise", ...base });
    const t = norm(r.text);
    expect(r.subject).toBe("Reprise sur une commission déjà versée");
    expect(t).toContain(`${norm(euros(12_345))} hors taxes sont repris`);
    // Relecture du 27/11 (point 2) : la reprise suit l'art. 4.5 (« commissions suivantes ») et
    // l'art. 12.4 (remboursement possible sans commissions à venir) : aucune promesse de gratuité.
    expect(t).toContain(
      "déduite de vos prochaines commissions, et l'avoir d'autofacture correspondant vous sera envoyé à ce moment-là (articles 4.5 et 12.4)",
    );
    expect(t).not.toMatch(/rien à payer/i);
    expect(t).not.toContain("prochain virement");
    expect(t).not.toContain("ne change rien");
    expect(norm(r.html)).not.toContain("prochain virement");
  });

  it("sans variante ou variante inconnue : le texte actuel, à l'identique", async () => {
    const sans = await rendu({});
    const inconnue = await rendu({ variante: "autre", ...base });
    expect(sans.subject).toBe("Commission annulée : avoir joint");
    expect(inconnue.subject).toBe(sans.subject);
    expect(inconnue.text).toBe(sans.text);
    expect(norm(sans.text)).toContain("vous trouverez ci-joint l'avoir d'autofacture");
  });

  it("le gabarit ne contient aucun montant en euros écrit en dur (sections de cet e-mail)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/email/templates/apporteur-demarrage.tsx"),
      "utf-8",
    );
    // Le fichier porte d'autres gabarits, dont le seuil de vigilance écrit en clair : on ne lit que
    // le texte de CET e-mail (bloc de textes, puis composant).
    const textes = src.slice(
      src.indexOf("  commissionAvoirClient: {"),
      src.indexOf("  dossierRecu: {"),
    );
    const composant = src.slice(
      src.indexOf("// ── Commission annulée après l'avoir du client"),
      src.indexOf("// ── Dossier bien reçu"),
    );
    expect(textes.length).toBeGreaterThan(500);
    expect(composant.length).toBeGreaterThan(500);
    for (const morceau of [textes, composant]) {
      expect(morceau).not.toMatch(/\d[\d\s]*(,\d+)?\s*€/);
    }
  });
});
