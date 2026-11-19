// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-storage", () => ({ uploadToR2: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/cgv-pdf", () => ({ rendreCgvPdf: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));

import {
  envoyerConfirmationCommande,
  cleCgvAcceptees,
  type DependancesConfirmation,
} from "./confirmation-commande";
import { CGV_VERSION } from "@/content/cgv-version";

import { offreFictive } from "./offre-fixtures.spec-util";
import { choixCanonique, sha256Offre } from "./offre-calculs";

const OFFRE = {
  v: 1,
};

const CLE_EXEMPLAIRE = "documents/2026/devis/AXI-DEV-1-signe.pdf";
const BASE = {
  id: "dv1",
  numero: "AXI-DEV-1",
  statut: "accepte",
  clientId: "cl1",
  formuleRetenue: null,
  choixRetenu: null,
  exemplaireSigneKey: CLE_EXEMPLAIRE,
  documentGenereId: "dg1",
};

/** Devis à formules accepté, choix lu sur `choixRetenu`. */
function devisFormules(
  over: Record<string, unknown> = {},
  formule: "achat" | "abonnement" = "abonnement",
) {
  const offre = offreFictive();
  const choix = choixCanonique({
    devisNumero: "AXI-DEV-1",
    offreSha256: sha256Offre(offre),
    formule,
    automatisationsRetenues: ["auto1"],
    maintenanceRetenue: false,
    periodiciteMois: formule === "abonnement" ? 1 : null,
  });
  return {
    ...BASE,
    lignes: [],
    offre,
    formuleRetenue: formule,
    choixRetenu: choix,
    client: { raisonSociale: "Acme", contactEmail: "a@acme.fr" },
    ...over,
  };
}

function deps(over: Partial<DependancesConfirmation> & { devis?: unknown } = {}) {
  const enfiler = vi.fn(async () => ({ enqueued: true }));
  const deposer = vi.fn(async () => undefined);
  const d: DependancesConfirmation = {
    lireDevis: async () =>
      (over.devis as never) ?? {
        ...BASE,
        lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 100_000 }],
        offre: null,
        client: { raisonSociale: "Acme", contactEmail: "a@acme.fr" },
      },
    formulesActives: async () => false,
    regimeEtTaux: async () => ({ regime: "assujetti", taux: 20 }),
    versionCgvAcceptee: async () => CGV_VERSION,
    cgvExiste: async () => false,
    pdfCgv: async () => Buffer.from("pdf"),
    deposer,
    dejaEnvoyee: async () => false,
    enfiler: enfiler as never,
    sousVerrou: (_id, corps) => corps(),
    ...over,
  };
  return { d, enfiler, deposer };
}

const DEMANDE = {
  declencheur: "contresignature_axion_explicite" as const,
  devisId: "dv1",
};

describe("envoyerConfirmationCommande", () => {
  it("devis classique : e-mail avec montants HT/TVA/TTC, CGV et devis signé en PJ", async () => {
    const { d, enfiler, deposer } = deps();
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(r).toEqual({
      envoye: true,
      garePourValidation: false,
      cgvJointes: true,
      cgvVersionAcceptee: CGV_VERSION,
    });
    expect(deposer).toHaveBeenCalledWith(cleCgvAcceptees(), expect.any(Buffer));
    const [tpl, to, , payload, opts] = enfiler.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, string>,
      { attachments: { r2Key: string }[] },
    ];
    expect(tpl).toBe("devis-commande-confirmation");
    expect(to).toBe("a@acme.fr");
    expect(payload["montantHtLabel"]).toMatch(/1\s?000,00/);
    expect(payload["montantTtcLabel"]).toMatch(/1\s?200,00/);
    expect(opts.attachments.map((a) => a.r2Key)).toEqual([
      CLE_EXEMPLAIRE,
      `documents/cgv/CGV-${CGV_VERSION}.pdf`,
    ]);
  });
  it("CGV déjà déposées pour la version acceptée : réutilisées, clé non réécrite", async () => {
    const { d, enfiler, deposer } = deps({ cgvExiste: async () => true });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(deposer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ envoye: true, cgvJointes: true });
    const opts = (
      enfiler.mock.calls[0] as unknown as [string, string, string, unknown, never]
    )[4] as {
      attachments: { r2Key: string }[];
    };
    expect(opts.attachments[1]?.r2Key).toBe(cleCgvAcceptees(CGV_VERSION));
  });
  it("version ANTÉRIEURE acceptée et archivée : c'est elle qui est jointe et citée, pas la version en vigueur", async () => {
    const { d, enfiler, deposer } = deps({
      versionCgvAcceptee: async () => "2026-05-01",
      cgvExiste: async (k) => k === cleCgvAcceptees("2026-05-01"),
    });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(deposer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ envoye: true, cgvJointes: true, cgvVersionAcceptee: "2026-05-01" });
    const [, , , payload, opts] = enfiler.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, string>,
      { attachments: { r2Key: string; filename: string }[] },
    ];
    expect(opts.attachments.map((a) => a.r2Key)).toEqual([
      CLE_EXEMPLAIRE,
      "documents/cgv/CGV-2026-05-01.pdf",
    ]);
    expect(payload["cgvVersionLabel"]).toBe("1 mai 2026");
    expect(JSON.stringify(opts)).not.toContain(CGV_VERSION);
  });
  it("version antérieure NON archivée : CGV non jointes, le retour le dit, rien n'est déposé", async () => {
    const { d, enfiler, deposer } = deps({ versionCgvAcceptee: async () => "2026-05-01" });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(deposer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ envoye: true, cgvJointes: false, cgvVersionAcceptee: "2026-05-01" });
    const opts = (
      enfiler.mock.calls[0] as unknown as [string, string, string, unknown, never]
    )[4] as {
      attachments: { r2Key: string }[];
    };
    expect(opts.attachments.map((a) => a.r2Key)).toEqual([CLE_EXEMPLAIRE]);
  });
  it("aucune version enregistrée : rien joint, aucune version citée", async () => {
    const { d, enfiler, deposer } = deps({ versionCgvAcceptee: async () => null });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(deposer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ envoye: true, cgvJointes: false, cgvVersionAcceptee: null });
    const payload = (
      enfiler.mock.calls[0] as unknown as [string, string, string, Record<string, unknown>]
    )[3];
    expect(payload).not.toHaveProperty("cgvVersionLabel");
  });
  it("INERTE si l'interrupteur formules est éteint et que le devis porte une offre", async () => {
    const { d, enfiler } = deps({
      devis: {
        ...BASE,
        numero: "N",
        lignes: [],
        offre: OFFRE,
        client: { raisonSociale: "A", contactEmail: "a@a.fr" },
      },
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "formules_eteintes",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("formules allumées mais devis sans choix retenu : rien ne part (non_accepte)", async () => {
    const { d, enfiler } = deps({
      formulesActives: async () => true,
      devis: {
        ...BASE,
        numero: "N",
        lignes: [],
        offre: OFFRE,
        client: { raisonSociale: "A", contactEmail: "a@a.fr" },
      },
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "non_accepte",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("sans adresse ou devis introuvable : rien ne part", async () => {
    const a = deps({
      devis: {
        ...BASE,
        numero: "N",
        lignes: [],
        offre: null,
        client: { raisonSociale: "A", contactEmail: " " },
      },
    });
    expect((await envoyerConfirmationCommande(DEMANDE, a.d)).envoye).toBe(false);
    const b = deps({ lireDevis: async () => null });
    expect(await envoyerConfirmationCommande(DEMANDE, b.d)).toEqual({
      envoye: false,
      raison: "devis_introuvable",
    });
    expect(a.enfiler).not.toHaveBeenCalled();
  });
  it("file indisponible : résultat typé, pas d'exception", async () => {
    const { d } = deps({ enfiler: vi.fn(async () => ({ enqueued: false })) as never });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "file_indisponible",
    });
  });
  it("garée en corbeille : exigerValidation et clientId sont passés, sujet lisible", async () => {
    const { d, enfiler } = deps();
    await envoyerConfirmationCommande(DEMANDE, d);
    const opts = (
      enfiler.mock.calls[0] as unknown as [string, string, string, unknown, never]
    )[4] as {
      exigerValidation: boolean;
      clientId: string;
      sujet: string;
      jobId: string;
    };
    expect(opts.exigerValidation).toBe(true);
    expect(opts.clientId).toBe("cl1");
    expect(opts.sujet).toContain("AXI-DEV-1");
    expect(opts.jobId).toBe("devis-commande-confirmation-dv1");
  });
  it("devis à formules : le choix se lit sur choixRetenu, payload récurrent et automatisations facultatifs", async () => {
    const { d, enfiler } = deps({ formulesActives: async () => true, devis: devisFormules() });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(r).toMatchObject({ envoye: true });
    const payload = (
      enfiler.mock.calls[0] as unknown as [string, string, string, Record<string, unknown>]
    )[3];
    expect(payload["formuleRetenue"]).toBe("Abonnement");
    expect(payload["automatisationsRetenues"]).toEqual(expect.any(Array));
    expect(payload["recurrent"]).toEqual([expect.stringContaining("Abonnement")]);
  });
  it("devis à formules au statut envoyé : refus non_accepte, rien ne part", async () => {
    const { d, enfiler } = deps({
      formulesActives: async () => true,
      devis: devisFormules({ statut: "envoye" }),
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "non_accepte",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("exemplaire signé absent : refus exemplaire_absent", async () => {
    const { d, enfiler } = deps({
      devis: {
        ...BASE,
        exemplaireSigneKey: null,
        lignes: [],
        offre: null,
        client: { raisonSociale: "A", contactEmail: "a@a.fr" },
      },
    });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "exemplaire_absent",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("job déjà gardé ou journalisé : refus deja_envoyee", async () => {
    const { d, enfiler } = deps({ dejaEnvoyee: async () => true });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "deja_envoyee",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("base muette : refus etat_inconnu, aucun envoi", async () => {
    const { d, enfiler } = deps({ dejaEnvoyee: async () => null });
    expect(await envoyerConfirmationCommande(DEMANDE, d)).toEqual({
      envoye: false,
      raison: "etat_inconnu",
    });
    expect(enfiler).not.toHaveBeenCalled();
  });
  it("jamais déclenchée hors de l'action explicite : aucun cron/webhook/worker ne l'importe", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync(
      "grep -rln 'confirmation-commande' src --include=*.ts --include=*.tsx || true",
      { encoding: "utf8" },
    );
    const importeurs = out
      .split("\n")
      .filter(
        (f) =>
          f &&
          !f.endsWith("confirmation-commande.ts") &&
          !f.endsWith("confirmation-commande.spec.ts") &&
          !f.includes("catalogue.ts"),
      );
    expect(importeurs.filter((f) => /webhook|cron|worker|queue/i.test(f))).toEqual([]);
  });
});

describe("envoyerConfirmationCommande — appels concurrents (verrou par devis)", () => {
  /** Corbeille simulée : lit/écrit des lignes avec une latence, comme une vraie base. */
  function corbeilleSimulee(verrouille: boolean) {
    const lignes = new Set<string>();
    let queue: Promise<unknown> = Promise.resolve();
    const attendre = () => new Promise((r) => setTimeout(r, 5));
    const sousVerrou: DependancesConfirmation["sousVerrou"] = verrouille
      ? (_id, corps) => {
          const suite = queue.then(corps, corps);
          queue = suite.catch(() => undefined);
          return suite;
        }
      : (_id, corps) => corps();
    const enfiler = vi.fn(async (_t: string, _to: string, _l: string, _p: unknown, o: unknown) => {
      await attendre();
      lignes.add((o as { jobId: string }).jobId);
      return { enqueued: false, garePourValidation: true };
    });
    const dejaEnvoyee = async (jobId: string) => {
      await attendre();
      return lignes.has(jobId);
    };
    return { lignes, enfiler, d: deps({ sousVerrou, dejaEnvoyee, enfiler: enfiler as never }).d };
  }

  it("deux appels simultanés : une seule ligne garée, l'autre reçoit deja_envoyee", async () => {
    const { d, enfiler, lignes } = corbeilleSimulee(true);
    const [a, b] = await Promise.all([
      envoyerConfirmationCommande(DEMANDE, d),
      envoyerConfirmationCommande(DEMANDE, d),
    ]);
    expect(enfiler).toHaveBeenCalledTimes(1);
    expect(lignes.size).toBe(1);
    expect([a.envoye, b.envoye].sort()).toEqual([false, true]);
    const refus = [a, b].find((r) => !r.envoye);
    expect(refus).toEqual({ envoye: false, raison: "deja_envoyee" });
  });

  it("témoin : sans verrou, la même course gare DEUX lignes (le test rougit sans le correctif)", async () => {
    const { d, enfiler } = corbeilleSimulee(false);
    await Promise.all([
      envoyerConfirmationCommande(DEMANDE, d),
      envoyerConfirmationCommande(DEMANDE, d),
    ]);
    expect(enfiler).toHaveBeenCalledTimes(2);
  });

  it("le contrôle est refait SOUS le verrou : une base muette sous verrou refuse (etat_inconnu)", async () => {
    let appels = 0;
    const { d, enfiler } = deps({
      dejaEnvoyee: async () => (++appels === 1 ? false : null),
    });
    const r = await envoyerConfirmationCommande(DEMANDE, d);
    expect(r).toEqual({ envoye: false, raison: "etat_inconnu" });
    expect(enfiler).not.toHaveBeenCalled();
  });
});
