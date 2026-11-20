/**
 * Lot B2, PR 2 — l'approbation de la corbeille crée le lien de signature À L'ENVOI.
 * Le vrai module `lien-a-l-envoi` tourne ; seuls Prisma, la file et les jetons sont simulés
 * (registre de jetons vivants, ligne de corbeille à état réel).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADRESSE = "destinataire-secret@exemple.test";
const ID = "00000000-0000-4000-8000-000000000001";

const h = vi.hoisted(() => ({
  /** OUT-1 : résultat de la sonde « envoi déjà fait ? » (sous le verrou du devis, avant tout jeton). */
  sonde: {
    v: "a_faire" as "a_faire" | "deja_fait",
    url: null as string | null,
    // Le lien que porte la tâche en file : vivant (cette pièce, partie client) ou non.
    vivant: true,
  },
  ligne: { v: null as null | Record<string, unknown> },
  etat: { statut: "a_valider" as string, refuseMotif: null as string | null },
  vivants: new Set<string>(),
  nbJetons: { v: 0 },
  nbTransactions: { v: 0 },
  findUniqueLigne: vi.fn(),
  enqueue: vi.fn(),
  log: vi.fn(),
  sentryExc: vi.fn(),
  sentryMsg: vi.fn(),
  reval: vi.fn(),
  queryRaw: vi.fn(),
  devisFindUnique: vi.fn(),
  devisCount: vi.fn(),
  avantEcritureRefus: { v: null as null | (() => void) },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentryExc(...a),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => h.reval(...a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueue(...a),
  sonderEnvoiOutboxAvecLien: async () => ({
    dejaFait: h.sonde.v === "deja_fait",
    urlEnFile: h.sonde.url,
  }),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({ marquerDevisEnvoye: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: async () =>
    h.sonde.vivant
      ? {
          id: "lien-en-file",
          documentGenereId: "piece-1",
          partie: "client",
          createdAt: new Date(),
          revokedAt: null,
        }
      : null,
  // L'ancien lien est rendu : le jeton neuf ne vit plus.
  rendreLienPrecedent: async (url: string) => {
    h.vivants.delete(url.split("/").pop() as string);
    return true;
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  TokenDocumentError: class extends Error {},
  creerTokenDocument: async () => {
    h.nbJetons.v += 1;
    const token = `JETON-NEUF-${h.nbJetons.v}`;
    h.vivants.add(token);
    return { token, tokenId: `id-${h.nbJetons.v}` };
  },
  revoquerJetonPrecis: async ({ tokenId }: { tokenId: string }) => {
    h.vivants.delete(`JETON-NEUF-${tokenId.replace("id-", "")}`);
    return 1;
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: (...a: unknown[]) => h.findUniqueLigne(...a),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        h.etat.statut = data["statut"] as string;
        return {};
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { statut: string };
        data: Record<string, unknown>;
      }) => {
        if (data["statut"] === "refuse") h.avantEcritureRefus.v?.();
        if (h.etat.statut !== where.statut) return { count: 0 };
        h.etat.statut = data["statut"] as string;
        if (data["refuseMotif"] !== undefined) h.etat.refuseMotif = data["refuseMotif"] as string;
        return { count: 1 };
      },
    },
    devis: {
      findUnique: (...a: unknown[]) => h.devisFindUnique(...a),
      count: (...a: unknown[]) => h.devisCount(...a),
    },
    $transaction: async (f: (t: unknown) => unknown) => {
      h.nbTransactions.v += 1;
      return f({
        $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
        // B2 PR 4 : le renvoi relit le devis DANS la transaction, après le verrou.
        devis: {
          findUnique: (...a: unknown[]) => h.devisFindUnique(...a),
          count: (...a: unknown[]) => h.devisCount(...a),
        },
      });
    },
  },
}));

import { approuverEmailAction } from "@/server/actions/qualiopi/email-outbox";
import { GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL } from "@/server/qualiopi/financements/sommeil";

const MARQUEUR_RENVOI = {
  v: 1,
  nature: "devis-renvoi",
  documentGenereId: "piece-1",
  partie: "client",
  devisId: "devis-1",
};

const ligne = (over: Record<string, unknown> = {}) => ({
  id: ID,
  template: "devis-envoi",
  recipient: ADRESSE,
  locale: "fr",
  payload: { numero: "D-1", lienSignatureALEnvoi: MARQUEUR_RENVOI },
  sujet: "s",
  statut: "a_valider",
  clientId: null,
  entityType: "Devis",
  entityId: "devis-1",
  attachments: null,
  ...over,
});

const devisEnvoye = {
  id: "devis-1",
  statut: "envoye",
  offre: null,
  documentGenereId: "piece-1",
  dateValidite: null,
  client: { raisonSociale: "ACME", contactNom: null, contactFonction: null },
};

/** Tout ce qui sort vers les journaux, Sentry, Telegram et revalidation. */
const sorties = () =>
  JSON.stringify([h.log.mock.calls, h.sentryExc.mock.calls, h.sentryMsg.mock.calls]);

beforeEach(() => {
  h.sonde.v = "a_faire";
  h.sonde.url = null;
  h.sonde.vivant = true;
  vi.clearAllMocks();
  h.etat.statut = "a_valider";
  h.etat.refuseMotif = null;
  h.vivants.clear();
  h.nbJetons.v = 0;
  h.nbTransactions.v = 0;
  h.avantEcritureRefus.v = null;
  h.ligne.v = ligne();
  h.findUniqueLigne.mockImplementation(async () => h.ligne.v);
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.devisFindUnique.mockResolvedValue(devisEnvoye);
  h.devisCount.mockResolvedValue(1);
  h.queryRaw.mockResolvedValue([{ locked: true }]);
});

describe("ligne à marqueur approuvée", () => {
  it("l'e-mail part UNE fois avec le lien, un seul jeton vit, la ligne est envoyée", async () => {
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    const [tpl, to, loc, payload, opts] = h.enqueue.mock.calls[0] as unknown[];
    expect([tpl, to, loc]).toEqual(["devis-envoi", ADRESSE, "fr"]);
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect((payload as Record<string, string>)["signatureUrl"]).toBe(
      "https://exemple.test/fr/portail/signer/JETON-NEUF-1",
    );
    expect(opts).toMatchObject({
      bypassValidation: true,
      entityType: "Devis",
      entityId: "devis-1",
    });
    expect(h.nbJetons.v).toBe(1);
    expect(h.vivants.size).toBe(1);
    expect(h.etat.statut).toBe("envoye");
  });

  it("deux approbations simultanées : un seul jeton, un seul enfilage", async () => {
    const [a, b] = await Promise.all([
      approuverEmailAction({ id: ID }),
      approuverEmailAction({ id: ID }),
    ]);
    const erreurs = [a, b].filter((r) => "error" in r);
    expect(erreurs).toHaveLength(1);
    expect(h.nbJetons.v).toBe(1);
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.etat.statut).toBe("envoye");
  });
});

describe("refus automatique (l'e-mail ne peut plus partir)", () => {
  it("devis plus « envoyé » : ligne refusée avec motif, aucun jeton, journal sobre", async () => {
    h.devisFindUnique.mockResolvedValue({ ...devisEnvoye, statut: "annule" });
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(h.etat.statut).toBe("refuse");
    expect(h.etat.refuseMotif).toBe((r as { error: string }).error);
    expect(h.etat.refuseMotif).not.toBe("");
    expect(h.nbJetons.v).toBe(0);
    expect(h.vivants.size).toBe(0);
    expect(h.enqueue).not.toHaveBeenCalled();
    const entree = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "email.outbox.refus_auto",
    );
    expect(entree?.[0]).toMatchObject({
      targetType: "EmailOutbox",
      targetId: ID,
      changes: { template: "devis-envoi", motif: h.etat.refuseMotif },
    });
    expect(Object.keys((entree?.[0] as { changes: object }).changes).sort()).toEqual([
      "motif",
      "template",
    ]);
    expect(h.reval).toHaveBeenCalled();
  });

  it("journal du refus qui lève : ligne refusée, motif rendu, revalidation faite, Sentry sans donnée", async () => {
    h.devisFindUnique.mockResolvedValue({ ...devisEnvoye, statut: "annule" });
    h.log.mockRejectedValueOnce(
      new Error(`panne ${ADRESSE} https://exemple.test/portail/signer/X`),
    );
    const r = await approuverEmailAction({ id: ID });
    expect(h.etat.statut).toBe("refuse");
    expect(h.etat.refuseMotif).not.toBeNull();
    expect(r).toEqual({ error: h.etat.refuseMotif });
    expect((r as { error: string }).error).not.toContain("retourné dans la corbeille");
    expect(h.reval).toHaveBeenCalled();
    expect(h.sentryExc).toHaveBeenCalledTimes(1);
    const s = JSON.stringify(h.sentryExc.mock.calls);
    expect(s).toContain("devis-envoi");
    expect(s).not.toContain(ADRESSE);
    expect(s).not.toContain("portail/signer");
    expect(s).not.toContain("http");
  });

  it.each(["envoye", "refuse"])(
    "ligne déjà passée à %s entre-temps : jamais écrasée",
    async (autre) => {
      h.devisFindUnique.mockImplementation(async () => {
        h.etat.statut = autre; // un autre acteur a tranché pendant les gardes
        return { ...devisEnvoye, statut: "signe" };
      });
      const r = await approuverEmailAction({ id: ID });
      expect("error" in r).toBe(true);
      expect(h.etat.statut).toBe(autre);
      expect(h.etat.refuseMotif).toBeNull();
      expect(h.vivants.size).toBe(0);
      expect(
        h.log.mock.calls.some(
          (c) => (c[0] as { action: string }).action === "email.outbox.refus_auto",
        ),
      ).toBe(false);
    },
  );
});

describe("échec d'enfilage", () => {
  it("la ligne revient à valider, le jeton neuf est révoqué, rien de sensible ne sort", async () => {
    h.enqueue.mockRejectedValue(new Error(`redis ${ADRESSE} JETON-NEUF-1`));
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error: "L'envoi a échoué : l'email est retourné dans la corbeille, réessayez.",
    });
    expect(h.etat.statut).toBe("a_valider");
    expect(h.vivants.size).toBe(0);
    expect(sorties()).not.toContain("JETON-NEUF");
    expect(sorties()).not.toContain(ADRESSE);
  });
});

describe("envoi déjà en cours sur ce devis", () => {
  it("message d'attente, aucun jeton, aucun refus, ligne remise à valider (jamais bloquée)", async () => {
    h.ligne.v = ligne({
      payload: {
        lienSignatureALEnvoi: {
          ...MARQUEUR_RENVOI,
          nature: "devis-premier-envoi",
          devisUpdatedAt: "2026-01-01T00:00:00.000Z",
          pdfCle: "documents/2026/devis/D-1.pdf",
        },
      },
    });
    h.queryRaw.mockResolvedValue([{ locked: false }]);
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error: "Cet e-mail est déjà en cours d'envoi. Réessayez dans un instant.",
    });
    expect(h.nbJetons.v).toBe(0);
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.etat.statut).toBe("a_valider");
    expect(h.etat.refuseMotif).toBeNull();
  });
});

describe("garde de sommeil", () => {
  it("e-mail en sommeil avec marqueur : aucun jeton, aucun refus, ligne intacte", async () => {
    h.ligne.v = ligne({ template: GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL[0] });
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    const r = await approuverEmailAction({ id: ID });
    vi.unstubAllEnvs();
    expect("error" in r).toBe(true);
    expect(h.nbJetons.v).toBe(0);
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.etat.statut).toBe("a_valider");
    expect(h.etat.refuseMotif).toBeNull();
  });
});

describe("lignes anciennes et autres gabarits : inchangé", () => {
  it("ligne ancienne avec signatureUrl : mêmes arguments, aucun jeton créé", async () => {
    const lien = "https://exemple.test/portail/signer/ANCIEN";
    h.ligne.v = ligne({ payload: { numero: "D-1", signatureUrl: lien } });
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.nbJetons.v).toBe(0);
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue.mock.calls[0]).toEqual([
      "devis-envoi",
      ADRESSE,
      "fr",
      { numero: "D-1", signatureUrl: lien },
      {
        bypassValidation: true,
        cleOutbox: `outbox-${ID}`,
        entityType: "Devis",
        entityId: "devis-1",
      },
    ]);
  });

  it("e-mail qui n'est pas un devis : comportement actuel", async () => {
    h.ligne.v = ligne({ template: "facture-envoi", payload: { numero: "F-1" } });
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.nbJetons.v).toBe(0);
  });
});

describe("ligne ANCIENNE (sans marqueur) : non-régression", () => {
  const lien = "https://exemple.test/portail/signer/ANCIEN";
  const pj = [{ filename: "d.pdf", r2Key: "k/d.pdf", contentType: "application/pdf" }];
  const ancienne = (over: Record<string, unknown> = {}) =>
    ligne({ payload: { numero: "D-1", signatureUrl: lien }, ...over });

  it("(a) sujet forcé et pièces jointes : mêmes arguments et options qu'avant", async () => {
    h.ligne.v = ancienne({ attachments: pj });
    const r = await approuverEmailAction({
      id: ID,
      sujet: "Nouvel objet",
      messagePersonnalise: "Bonjour",
    });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue.mock.calls[0]).toEqual([
      "devis-envoi",
      ADRESSE,
      "fr",
      { numero: "D-1", signatureUrl: lien, messagePersonnalise: "Bonjour" },
      {
        bypassValidation: true,
        cleOutbox: `outbox-${ID}`,
        sujetForce: "Nouvel objet",
        entityType: "Devis",
        entityId: "devis-1",
        attachments: pj,
      },
    ]);
  });

  it("(b) résultat « retenu » : ligne refusée avec le motif, aucun jeton, aucune transaction", async () => {
    h.enqueue.mockResolvedValue({ enqueued: false, retenu: "rebond_dur" });
    h.ligne.v = ancienne();
    const r = await approuverEmailAction({ id: ID });
    expect(h.etat.statut).toBe("refuse");
    expect(r).toEqual({ error: h.etat.refuseMotif });
    expect((r as { error: string }).error).toContain("rebondi définitivement");
    expect(h.nbJetons.v).toBe(0);
    expect(h.nbTransactions.v).toBe(0);
    const actions = h.log.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toEqual(["email.outbox.retenu"]);
    expect(h.reval).not.toHaveBeenCalled();
  });

  it("(c) exception d'enfilage : retour à valider, message actuel, aucun jeton créé ni révoqué", async () => {
    h.enqueue.mockRejectedValue(new Error("redis"));
    h.ligne.v = ancienne();
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error: "L'envoi a échoué : l'email est retourné dans la corbeille, réessayez.",
    });
    expect(h.etat.statut).toBe("a_valider");
    expect(h.nbJetons.v).toBe(0);
    expect(h.vivants.size).toBe(0);
    expect(h.nbTransactions.v).toBe(0);
  });

  it("(d) journal email.outbox.approuver : jamais d'adresse, même sans marqueur", async () => {
    h.ligne.v = ancienne();
    await approuverEmailAction({ id: ID, sujet: "Autre" });
    expect(h.log).toHaveBeenCalledTimes(1);
    const changes = (h.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> }).changes;
    expect("destinataire" in changes).toBe(false);
    expect(JSON.stringify(changes)).not.toContain(ADRESSE);
    expect(h.log.mock.calls[0]?.[0]).toEqual({
      action: "email.outbox.approuver",
      targetType: "EmailOutbox",
      targetId: ID,
      changes: {
        template: "devis-envoi",
        sujetModifie: true,
        messageAjoute: false,
        envoye: true,
      },
      session: { userId: "u-1", role: "super_admin" },
    });
  });

  it("(e) aucune transaction ni verrou ouvert pour une ligne sans marqueur", async () => {
    h.ligne.v = ancienne();
    await approuverEmailAction({ id: ID });
    expect(h.nbTransactions.v).toBe(0);
    expect(h.queryRaw).not.toHaveBeenCalled();
  });
});

describe("journaux", () => {
  it("aucun journal ne contient d'URL, de jeton ni d'adresse (succès, refus, échec)", async () => {
    await approuverEmailAction({ id: ID });
    h.etat.statut = "a_valider";
    h.devisFindUnique.mockResolvedValue({ ...devisEnvoye, statut: "annule" });
    await approuverEmailAction({ id: ID });
    h.etat.statut = "a_valider";
    h.devisFindUnique.mockResolvedValue(devisEnvoye);
    h.enqueue.mockRejectedValue(new Error("boom"));
    await approuverEmailAction({ id: ID });
    const s = sorties();
    expect(s).not.toContain(ADRESSE);
    expect(s).not.toContain("JETON-NEUF");
    expect(s).not.toContain("portail/signer");
    expect(s).not.toContain("http");
  });
  it("RENVOI : verrou pris → même message d'attente, aucun jeton, aucun refus, ligne remise à valider", async () => {
    h.queryRaw.mockResolvedValue([{ locked: false }]);
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error: "Cet e-mail est déjà en cours d'envoi. Réessayez dans un instant.",
    });
    expect(h.nbJetons.v).toBe(0);
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.etat.statut).toBe("a_valider");
    expect(h.etat.refuseMotif).toBeNull();
  });
});
