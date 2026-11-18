/**
 * envoyerDevisEmailAction — RENVOI d'un devis « envoye » (lot B2, PR 4).
 *
 * Mode « validation » : AUCUN jeton à l'envoi ; la ligne garée porte un marqueur `devis-renvoi`
 * et l'ancien lien reste valable jusqu'au départ réel (le nouveau naît à l'approbation, voir
 * `lien-a-l-envoi.spec.ts`). Mode « auto » : chemin d'origine, inchangé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  docFindUnique: vi.fn(),
  outboxFindFirst: vi.fn(),
  creerToken: vi.fn(),
  revoquerJeton: vi.fn(),
  revoquerTousTokens: vi.fn(),
  enqueueEmail: vi.fn(),
  resoudreMode: vi.fn(),
  log: vi.fn(),
  rendre: vi.fn(),
  verrous: new Set<string>(),
  ordre: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: d.findUnique },
    documentGenere: { findUnique: d.docFindUnique },
    emailOutbox: { findFirst: (...a: unknown[]) => d.outboxFindFirst(...a) },
    // Verrou consultatif « xact » simulé : pris une fois par clé, relâché à la fin de la transaction.
    $transaction: async (f: (t: unknown) => unknown) => {
      const acquis: string[] = [];
      const tx = {
        $queryRaw: async (_s: unknown, cle: string) => {
          d.ordre.push("verrou");
          if (d.verrous.has(cle)) return [{ locked: false }];
          d.verrous.add(cle);
          acquis.push(cle);
          return [{ locked: true }];
        },
        emailOutbox: {
          findFirst: (...a: unknown[]) => {
            d.ordre.push("garde");
            return d.outboxFindFirst(...a);
          },
        },
      };
      try {
        return await f(tx);
      } finally {
        for (const c of acquis) d.verrous.delete(c);
      }
    },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/qualiopi/documents/signature/lien-precedent")
  >()),
  rendreLienPrecedent: (...a: unknown[]) => d.rendre(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueueEmail(...a),
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: (...a: unknown[]) => d.resoudreMode(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "adm-1" }),
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => d.creerToken(...a),
  revoquerJetonPrecis: (...a: unknown[]) => d.revoquerJeton(...a),
  revoquerTokensDocument: (...a: unknown[]) => d.revoquerTousTokens(...a),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));

import { envoyerDevisEmailAction } from "./facturation-emails";

const ID = "11111111-1111-4111-8111-111111111111";
const PIECE = "22222222-2222-4222-8222-222222222222";
const ADRESSE = "client@example.test";
const JETON = "JETON-SECRET-XYZ";

function devis(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "envoye",
    offre: null,
    documentGenereId: PIECE,
    documentGenere: { annuleeAt: null, signatures: [] },
    fichierPdfUrl: "documents/2026/devis/AXI-DOC-001.pdf",
    montantTotalHtCents: 1000,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      raisonSociale: "Client SA",
      contactEmail: ADRESSE,
      contactNom: "Camille",
      contactFonction: null,
    },
    ...over,
  };
}

const payloadEnfile = () =>
  (d.enqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;
const optionsEnfile = () =>
  (d.enqueueEmail.mock.calls[0] as unknown[])[4] as Record<string, unknown>;

let espions: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  d.verrous.clear();
  d.ordre.length = 0;
  d.rendre.mockResolvedValue(true);
  d.revoquerJeton.mockReset();
  d.revoquerTousTokens.mockReset();
  d.findUnique.mockResolvedValue(devis());
  d.docFindUnique.mockResolvedValue({ metadata: null });
  d.outboxFindFirst.mockResolvedValue(null);
  d.creerToken.mockResolvedValue({ token: JETON, tokenId: "t-1" });
  d.resoudreMode.mockResolvedValue("validation");
  d.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o-1" });
  espions = (["log", "warn", "error", "info"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});
afterEach(() => espions.forEach((e) => e.mockRestore()));

describe("renvoi en mode « validation »", () => {
  it("résout le mode avec le gabarit et le client du devis", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.resoudreMode).toHaveBeenCalledWith("devis-envoi", "c1");
  });

  it("aucun jeton créé, aucun lien dans le payload ; ancien lien intact (rien n'est révoqué)", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.revoquerJeton).not.toHaveBeenCalled();
    expect(payloadEnfile()).not.toHaveProperty("signatureUrl");
    expect(JSON.stringify(payloadEnfile())).not.toContain("/portail/signer/");
  });

  it("marqueur `devis-renvoi` sans identité ni URL, exigerValidation, entité et client posés", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    expect(payloadEnfile()["lienSignatureALEnvoi"]).toEqual({
      v: 1,
      nature: "devis-renvoi",
      documentGenereId: PIECE,
      partie: "client",
      devisId: ID,
    });
    expect(optionsEnfile()).toMatchObject({
      exigerValidation: true,
      entityType: "Devis",
      entityId: ID,
      clientId: "c1",
    });
  });

  it("le destinataire de l'enfilage est celui de la ligne (ici `to` explicite)", async () => {
    await envoyerDevisEmailAction({ devisId: ID, to: "autre@example.test" });
    expect((d.enqueueEmail.mock.calls[0] as unknown[])[1]).toBe("autre@example.test");
  });

  it("le retour dit que l'ancien lien reste valable et que le nouveau naît à l'approbation", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    if (!("data" in r)) throw new Error("succès attendu");
    expect(r.data.garePourValidation).toBe(true);
    expect(r.data.note).toMatch(/lien actuel reste valable/i);
  });

  it("file indisponible (ni enfilé ni garé) : erreur, comme avant", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    expect(await envoyerDevisEmailAction({ devisId: ID })).toEqual({
      error: "File d'envoi indisponible — réessayer.",
    });
  });
});

describe("garde « déjà garé » (réutilise email-devis-en-attente)", () => {
  it("une ligne `devis-envoi` à valider ou approuvée récemment : refus clair, rien n'est enfilé", async () => {
    d.outboxFindFirst.mockResolvedValue({ id: "o-0" });
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({
      error:
        "Un e-mail de ce devis attend déjà dans Emails → À valider : validez-le ou refusez-le avant de renvoyer.",
    });
    expect(d.enqueueEmail).not.toHaveBeenCalled();
    expect(d.creerToken).not.toHaveBeenCalled();
  });

  it("la question posée à la base est celle de `emailDevisEnAttente` (gabarit, type, id, a_valider / approuve)", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    const arg = (d.outboxFindFirst.mock.calls[0] as [Record<string, unknown>])[0];
    expect(JSON.stringify(arg)).toContain('"template":"devis-envoi"');
    expect(JSON.stringify(arg)).toContain('"entityType":"Devis"');
    expect(JSON.stringify(arg)).toContain(`"entityId":"${ID}"`);
    expect(JSON.stringify(arg)).toContain("a_valider");
    expect(JSON.stringify(arg)).toContain("approuve");
  });

  it("aussi en mode auto : pas de second e-mail pendant qu'un autre attend", async () => {
    d.resoudreMode.mockResolvedValue("auto");
    d.outboxFindFirst.mockResolvedValue({ id: "o-0" });
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
  });
});

describe("mode « auto » : chemin actuel inchangé", () => {
  beforeEach(() => {
    d.resoudreMode.mockResolvedValue("auto");
    d.enqueueEmail.mockResolvedValue({ enqueued: true });
  });

  it("jeton créé à l'envoi, lien dans le payload, ni marqueur ni exigerValidation", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.creerToken).toHaveBeenCalledTimes(1);
    expect(payloadEnfile()["signatureUrl"]).toBe(`https://exemple.test/fr/portail/signer/${JETON}`);
    expect(payloadEnfile()).not.toHaveProperty("lienSignatureALEnvoi");
    expect(optionsEnfile()).not.toHaveProperty("exigerValidation");
  });
});

describe("repli souple conservé : sans pièce", () => {
  it("devis sans pièce (brouillon) : e-mail sans bouton et sans marqueur, aucun jeton", async () => {
    d.findUnique.mockResolvedValue(devis({ statut: "brouillon", documentGenereId: null }));
    d.resoudreMode.mockResolvedValue("validation");
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(payloadEnfile()).not.toHaveProperty("signatureUrl");
    expect(payloadEnfile()).not.toHaveProperty("lienSignatureALEnvoi");
    expect(optionsEnfile()).not.toHaveProperty("exigerValidation");
  });
});

describe("aucune fuite", () => {
  it("ni URL, ni jeton, ni adresse dans le journal d'activité ni dans la console (validation et auto)", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    d.resoudreMode.mockResolvedValue("auto");
    d.enqueueEmail.mockResolvedValue({ enqueued: true });
    await envoyerDevisEmailAction({ devisId: ID });
    d.creerToken.mockRejectedValue(new Error(`${JETON} /portail/signer/${JETON}`));
    await envoyerDevisEmailAction({ devisId: ID });
    const s = JSON.stringify([d.log.mock.calls, espions.flatMap((e) => e.mock.calls)]);
    expect(s).not.toContain(ADRESSE);
    expect(s).not.toContain(JETON);
    expect(s).not.toContain("/portail/signer/");
  });

  it("validation : lienSignatureReemis est faux au journal (aucun lien n'a été émis)", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    const changes = (d.log.mock.calls[0] as [{ changes: Record<string, unknown> }])[0].changes;
    expect(changes["lienSignatureReemis"]).toBe(false);
  });
});

describe("verrou du devis à la mise en attente (suites d'audit)", () => {
  const CLE = `devis.envoi:${ID}`;

  it("le verrou est pris AVANT la garde « déjà garé » et AVANT l'enfilage", async () => {
    d.enqueueEmail.mockImplementation(async () => {
      d.ordre.push("enfilage");
      return { enqueued: false, garePourValidation: true, outboxId: "o-1" };
    });
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.ordre).toEqual(["verrou", "garde", "enfilage"]);
  });

  it("verrou occupé : message clair, ni garde, ni jeton, ni enfilage", async () => {
    d.verrous.add(CLE);
    expect(await envoyerDevisEmailAction({ devisId: ID })).toEqual({
      error: "Un envoi de ce devis est déjà en cours, réessayez dans un instant.",
    });
    expect(d.outboxFindFirst).not.toHaveBeenCalled();
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("deux clics en parallèle (deux onglets) : une seule ligne garée, l'autre est refusée", async () => {
    let lignes = 0;
    d.outboxFindFirst.mockImplementation(async () => (lignes > 0 ? { id: "o-0" } : null));
    d.enqueueEmail.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      lignes += 1;
      return { enqueued: false, garePourValidation: true, outboxId: "o-1" };
    });
    const [a, b] = await Promise.all([
      envoyerDevisEmailAction({ devisId: ID }),
      envoyerDevisEmailAction({ devisId: ID }),
    ]);
    expect(d.enqueueEmail).toHaveBeenCalledTimes(1);
    expect([a, b].filter((r) => "data" in r)).toHaveLength(1);
    expect([a, b].filter((r) => "error" in r)).toHaveLength(1);
  });

  it("le verrou est relâché après l'envoi : un clic ultérieur n'est pas bloqué par lui", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.verrous.size).toBe(0);
  });
});

describe("mode « auto » : lien perdu sans e-mail (suites d'audit)", () => {
  beforeEach(() => d.resoudreMode.mockResolvedValue("auto"));

  it("jeton créé au clic puis file indisponible : l'ancien lien est rendu (revoquer, URL du jeton neuf)", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({ error: "File d'envoi indisponible — réessayer." });
    expect(d.rendre).toHaveBeenCalledTimes(1);
    expect(d.rendre).toHaveBeenCalledWith(
      `https://exemple.test/fr/portail/signer/${JETON}`,
      "revoquer",
    );
  });

  it("e-mail enfilé : l'ancien lien n'est pas rendu", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: true });
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.rendre).not.toHaveBeenCalled();
  });

  it("aucun jeton créé (émission en échec) : rien à rendre", async () => {
    d.creerToken.mockRejectedValue(new Error("x"));
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.rendre).not.toHaveBeenCalled();
  });

  it("le rendu qui lève ne remonte pas, et rien de sensible n'est écrit", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    d.rendre.mockRejectedValue(new Error(`${JETON} ${ADRESSE}`));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({ error: "File d'envoi indisponible — réessayer." });
    const s = JSON.stringify(espions.flatMap((e) => e.mock.calls));
    expect(s).not.toContain(JETON);
    expect(s).not.toContain(ADRESSE);
  });
});

describe("mode « auto » : un seul lien vivant quoi qu'il arrive (M1, M2)", () => {
  beforeEach(() => d.resoudreMode.mockResolvedValue("auto"));

  it("M1 — l'ancien lien ne peut être rendu (false) : le jeton neuf est révoqué par son identifiant", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    d.rendre.mockResolvedValue(false);
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({ error: "File d'envoi indisponible — réessayer." });
    expect(d.revoquerJeton).toHaveBeenCalledTimes(1);
    expect(d.revoquerJeton).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(d.revoquerTousTokens).not.toHaveBeenCalled();
  });

  it("M1 — le rendu lève : le jeton neuf est révoqué aussi, sans fuite", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    d.rendre.mockRejectedValue(new Error(`${JETON} ${ADRESSE}`));
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.revoquerJeton).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(d.revoquerTousTokens).not.toHaveBeenCalled();
    const s = JSON.stringify(espions.flatMap((e) => e.mock.calls));
    expect(s).not.toContain(JETON);
    expect(s).not.toContain(ADRESSE);
  });

  it("M1 — l'ancien lien est rendu : le jeton neuf n'est pas révoqué à part", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    d.rendre.mockResolvedValue(true);
    d.revoquerJeton.mockReset();
    d.revoquerTousTokens.mockReset();
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.revoquerJeton).not.toHaveBeenCalled();
    expect(d.revoquerTousTokens).not.toHaveBeenCalled();
  });

  it("M2 — enqueueEmail lève : état cohérent (ancien lien rendu), message clair, journal sans adresse", async () => {
    d.enqueueEmail.mockRejectedValue(new Error(`${ADRESSE} ${JETON}`));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({
      error:
        "L'enfilage de l'e-mail a échoué : rien n'est parti, le lien de signature précédent a été conservé ou rendu. Réessayer.",
    });
    expect(d.rendre).toHaveBeenCalledWith(
      `https://exemple.test/fr/portail/signer/${JETON}`,
      "revoquer",
    );
    expect(d.log).not.toHaveBeenCalled();
    const s = JSON.stringify(espions.flatMap((e) => e.mock.calls));
    expect(s).not.toContain(ADRESSE);
    expect(s).not.toContain(JETON);
    expect(d.verrous.size).toBe(0);
  });

  it("M2 — enqueueEmail lève ET l'ancien lien n'est pas rendu : le jeton neuf est révoqué (aucun lien vivant en double)", async () => {
    d.enqueueEmail.mockRejectedValue(new Error("redis"));
    d.rendre.mockResolvedValue(false);
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({
      error:
        "L'e-mail n'a pas pu être mis en file et le client n'a plus de lien de signature valable : renvoyez le devis.",
    });
    expect(d.revoquerJeton).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(d.revoquerTousTokens).not.toHaveBeenCalled();
  });

  it("M1 — la révocation du jeton neuf lève : erreur prévue, rien ne fuit dans la console", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    d.rendre.mockResolvedValue(false);
    d.revoquerJeton.mockRejectedValue(new Error(`${JETON} ${ADRESSE}`));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({ error: "File d'envoi indisponible — réessayer." });
    expect(d.revoquerJeton).toHaveBeenCalledTimes(1);
    expect(d.revoquerTousTokens).not.toHaveBeenCalled();
    const s = JSON.stringify(espions.flatMap((e) => e.mock.calls));
    expect(s).not.toContain(JETON);
    expect(s).not.toContain(ADRESSE);
  });

  it("M2 — mode validation : enqueueEmail lève, aucun jeton à défaire, message clair", async () => {
    d.resoudreMode.mockResolvedValue("validation");
    d.enqueueEmail.mockRejectedValue(new Error("redis"));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.rendre).not.toHaveBeenCalled();
    expect(d.revoquerJeton).not.toHaveBeenCalled();
  });
});

describe("renvoi en validation d'un devis à formules : formules, drapeau et marqueur ensemble", () => {
  it("les trois arrivent dans le même payload enfilé, sans jeton ni lien", async () => {
    const formules = { formules: [{ titre: "Essentielle" }, { titre: "Complète" }] };
    d.findUnique.mockResolvedValue(devis({ offre: { choix: "x" } }));
    d.docFindUnique.mockResolvedValue({ metadata: { renderData: { data: { formules } } } });
    await envoyerDevisEmailAction({ devisId: ID });
    const p = payloadEnfile();
    // Les formules figées : décrites, et AUCUN montant unique annoncé.
    expect(p["nbFormules"]).toBe(2);
    expect(p["libellesFormules"]).toEqual(["Essentielle", "Complète"]);
    expect(p).not.toHaveProperty("montantLabel");
    expect(p["lienSignatureALEnvoi"]).toMatchObject({ nature: "devis-renvoi", devisId: ID });
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(p).not.toHaveProperty("signatureUrl");
    expect(optionsEnfile()).toMatchObject({ exigerValidation: true });
  });
});
