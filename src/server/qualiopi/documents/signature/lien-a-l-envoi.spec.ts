/**
 * Lien de signature créé À L'ENVOI (lot B2, PR 1 : module NON BRANCHÉ).
 * Mocks Prisma comme les specs voisines ; aucun fichier existant n'est modifié.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txDevisFindUnique: vi.fn(),
  txDocFindUnique: vi.fn(),
  txDevisFindFirst: vi.fn(),
  commitEchec: { v: false },
  verrou: { pris: false },
  devisFindUnique: vi.fn(),
  devisCount: vi.fn(),
  txDevisCount: vi.fn(),
  txOptions: vi.fn(),
  ordre: [] as string[],
  txRecu: [] as unknown[],
  creerToken: vi.fn(),
  revoquerPrecis: vi.fn(),
  rendrePrecedent: vi.fn(),
  marquer: vi.fn(),
  formules: vi.fn(),
  bloque: vi.fn(),
  log: vi.fn(),
  sentryExc: vi.fn(),
  sentryMsg: vi.fn(),
  telegram: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => h.devisFindUnique(...a),
      count: (...a: unknown[]) => h.devisCount(...a),
    },
    $transaction: async (f: (t: unknown) => unknown, options?: unknown) => {
      h.txOptions(options);
      let r: unknown;
      try {
        r = await f(tx);
      } finally {
        // Un verrou consultatif « xact » tombe à la fin de la transaction.
        h.verrou.pris = false;
      }
      if (h.commitEchec.v) throw new Error(`commit échoué ${ADRESSE} /portail/signer/${TOKEN}`);
      return r;
    },
  },
}));
const tx = {
  $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
  devis: {
    findUnique: (...a: unknown[]) => h.txDevisFindUnique(...a),
    findFirst: (...a: unknown[]) => h.txDevisFindFirst(...a),
    count: (...a: unknown[]) => h.txDevisCount(...a),
  },
  documentGenere: { findUnique: (...a: unknown[]) => h.txDocFindUnique(...a) },
};

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentryExc(...a),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
  revoquerJetonPrecis: (...a: unknown[]) => h.revoquerPrecis(...a),
  TokenDocumentError: class TokenDocumentError extends Error {
    motif = "signataire_non_identifie";
  },
}));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  rendreLienPrecedent: (...a: unknown[]) => h.rendrePrecedent(...a),
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({
  marquerDevisEnvoye: (...a: unknown[]) => h.marquer(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => h.formules(),
}));
vi.mock("@/server/qualiopi/devis/version-remplacee", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/devis/version-remplacee")>()),
  versionRemplaceeBloqueEmission: async (...a: unknown[]) => h.bloque(...a),
}));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));

import { VersionRemplaceeSigneeEntreTempsError } from "@/server/qualiopi/devis/version-remplacee";
import {
  envoyerAvecLienALEnvoi,
  EnvoiNonParti,
  EnvoiOccupe,
  lireMarqueur,
  payloadPourEnvoi,
} from "./lien-a-l-envoi";

const TOKEN = "JETON-SECRET-XYZ";
const DEVIS_ID = "11111111-1111-4111-8111-111111111111";
const NUMERO_PIECE = "AXI-DOC-001";
const PIECE_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED = new Date("2026-11-01T10:00:00.000Z");
const ADRESSE = "dest@client.test";

const LIGNE = {
  id: "o-1",
  template: "devis-envoi",
  recipient: ADRESSE,
  entityType: "Devis",
  entityId: DEVIS_ID,
};
const ACTEUR = { session: { userId: "adm-1", role: "super_admin" } } as never;

const marqueurPremier = (over: Record<string, unknown> = {}) => ({
  v: 1,
  nature: "devis-premier-envoi",
  documentGenereId: PIECE_ID,
  partie: "client",
  devisId: DEVIS_ID,
  devisUpdatedAt: UPDATED.toISOString(),
  pdfCle: "documents/2026/devis/AXI-DOC-001.pdf",
  ...over,
});
const marqueurRenvoi = (over: Record<string, unknown> = {}) => ({
  v: 1,
  nature: "devis-renvoi",
  documentGenereId: PIECE_ID,
  partie: "client",
  devisId: DEVIS_ID,
  ...over,
});
const payloadAvec = (m: unknown) => ({ numero: "AXI-1", lienSignatureALEnvoi: m });

function devisRelu(over: Record<string, unknown> = {}) {
  return {
    id: DEVIS_ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c-1",
    statut: "brouillon",
    updatedAt: UPDATED,
    offre: null,
    replacesDevisId: null,
    replacesDevis: null,
    dateValidite: new Date("2026-12-15T00:00:00Z"),
    documentGenereId: PIECE_ID,
    client: { raisonSociale: "ACME", contactNom: "Contact", contactFonction: "Gérant" },
    ...over,
  };
}

function pieceLue(over: Record<string, unknown> = {}) {
  return { id: PIECE_ID, clientId: "c-1", type: "devis", numero: NUMERO_PIECE, ...over };
}

const enfileOk = async () => ({ enqueued: true });

const toutSerialise = () =>
  JSON.stringify([
    h.log.mock.calls,
    h.sentryExc.mock.calls,
    h.sentryMsg.mock.calls,
    h.telegram.mock.calls,
    consoleEspions.flatMap((e) => e.mock.calls),
  ]);
let consoleEspions: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  h.ordre.length = 0;
  h.commitEchec.v = false;
  h.verrou.pris = false;
  h.queryRaw.mockImplementation(async () => {
    h.ordre.push("verrou");
    return [{ locked: true }];
  });
  h.txDevisFindUnique.mockImplementation(async () => {
    h.ordre.push("relu");
    return devisRelu();
  });
  h.txDocFindUnique.mockImplementation(async () => {
    h.ordre.push("piece");
    return pieceLue();
  });
  h.txDevisFindFirst.mockImplementation(async () => {
    h.ordre.push("unicite");
    return null;
  });
  h.devisFindUnique.mockResolvedValue(devisRelu({ statut: "envoye" }));
  h.devisCount.mockResolvedValue(1);
  h.txDevisCount.mockResolvedValue(1);
  h.formules.mockResolvedValue(true);
  h.bloque.mockImplementation(async () => {
    h.ordre.push("gardes");
    return false;
  });
  h.creerToken.mockImplementation(async () => {
    h.ordre.push("jeton");
    return { token: TOKEN, tokenId: "t-1", expiresAt: new Date() };
  });
  h.revoquerPrecis.mockResolvedValue(1);
  h.rendrePrecedent.mockResolvedValue(true);
  h.marquer.mockImplementation(async () => void h.ordre.push("marquer"));
  consoleEspions = (["log", "warn", "error", "info"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});

describe("lireMarqueur / payloadPourEnvoi", () => {
  it("absent → null ; bien formé → marqueur ; mal formé → { invalide: true }", () => {
    expect(lireMarqueur({ numero: "x" })).toBeNull();
    expect(lireMarqueur(null)).toBeNull();
    expect(lireMarqueur(payloadAvec(marqueurPremier()))).toMatchObject({ v: 1 });
    expect(lireMarqueur(payloadAvec({ ...marqueurPremier(), v: 2 }))).toEqual({ invalide: true });
    expect(lireMarqueur(payloadAvec({ ...marqueurPremier(), extra: 1 }))).toEqual({
      invalide: true,
    });
    expect(lireMarqueur(payloadAvec("texte"))).toEqual({ invalide: true });
    expect(lireMarqueur(payloadAvec(marqueurPremier({ pdfCle: undefined })))).toEqual({
      invalide: true,
    });
  });

  it("retire la clé du marqueur et pose signatureUrl (ou lien)", () => {
    const p = payloadAvec(marqueurPremier());
    expect(payloadPourEnvoi(p, "https://x/y", "signatureUrl")).toEqual({
      numero: "AXI-1",
      signatureUrl: "https://x/y",
    });
    expect(payloadPourEnvoi(p, "https://x/y", "lien")).toEqual({
      numero: "AXI-1",
      lien: "https://x/y",
    });
    expect(p).toHaveProperty("lienSignatureALEnvoi");
  });
});

describe("sans marqueur / marqueur invalide / incohérence", () => {
  it("sans marqueur : enfiler reçoit le payload intact, aucun jeton", async () => {
    const enfiler = vi.fn(enfileOk);
    const payload = { numero: "AXI-1", signatureUrl: "https://ancien" };
    const r = await envoyerAvecLienALEnvoi({ ligne: LIGNE, payload, acteur: ACTEUR, enfiler });
    expect(r).toEqual({ type: "envoi", res: { enqueued: true } });
    expect(enfiler).toHaveBeenCalledWith(payload, ADRESSE);
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.txOptions).not.toHaveBeenCalled();
  });

  it.each([
    ["marqueur mal formé", { ...LIGNE }, payloadAvec({ v: 9 })],
    [
      "gabarit incompatible",
      { ...LIGNE, template: "facture-envoi" },
      payloadAvec(marqueurPremier()),
    ],
    ["entityId différent", { ...LIGNE, entityId: "autre" }, payloadAvec(marqueurPremier())],
    [
      "entityType autre que Devis (premier envoi)",
      { ...LIGNE, entityType: "Facture" },
      payloadAvec(marqueurPremier()),
    ],
    [
      "entityType autre que Devis (renvoi)",
      { ...LIGNE, entityType: "Facture" },
      payloadAvec(marqueurRenvoi()),
    ],
  ])("%s : refus, enfiler jamais appelé", async (_n, ligne, payload) => {
    const enfiler = vi.fn(enfileOk);
    const r = await envoyerAvecLienALEnvoi({ ligne, payload, acteur: ACTEUR, enfiler });
    expect(r).toEqual({
      type: "refus",
      motif: "E-mail incohérent : refusez-le et renvoyez depuis le devis.",
    });
    expect(enfiler).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
  });
});

describe("devis-premier-envoi", () => {
  const lancer = (enfiler: (p: Record<string, unknown>) => Promise<never>) =>
    envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: payloadAvec(marqueurPremier()),
      acteur: ACTEUR,
      enfiler: enfiler as never,
    });

  it("jeton créé APRÈS les gardes et AVANT enfiler ; payload sans marqueur avec signatureUrl ; même tx", async () => {
    const enfiler = vi.fn(async () => {
      h.ordre.push("enfiler");
      return { enqueued: true };
    });
    const r = await lancer(enfiler as never);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true } });
    // Verrou → relecture → gardes → pièce → unicité de la pièce → jeton → enfilage → écritures.
    expect(h.ordre).toEqual([
      "verrou",
      "relu",
      "gardes",
      "piece",
      "unicite",
      "jeton",
      "enfiler",
      "marquer",
    ]);
    // m3 : l'adresse de la ligne lue en base est passée à `enfiler`.
    expect((enfiler.mock.calls[0] as unknown[])[1]).toBe(ADRESSE);
    const payload = (enfiler.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload["signatureUrl"]).toBe(`https://exemple.test/fr/portail/signer/${TOKEN}`);
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(h.marquer.mock.calls[0]?.[0]).toBe(tx);
    expect(h.txOptions).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }));
    expect(h.creerToken).toHaveBeenCalledWith({
      documentGenereId: PIECE_ID,
      partie: "client",
      signataireNom: "Contact",
      signataireEmail: ADRESSE,
      signataireQualite: "Gérant",
      borneMetier: devisRelu().dateValidite,
    });
    // verrou : même clé que l'envoi et la remise en main propre
    expect(JSON.stringify(h.queryRaw.mock.calls[0])).toContain("devis.envoi:" + DEVIS_ID);
  });

  it("nom = raison sociale à défaut de contactNom", async () => {
    h.txDevisFindUnique.mockResolvedValue(
      devisRelu({ client: { raisonSociale: "ACME", contactNom: null, contactFonction: null } }),
    );
    await lancer(vi.fn(enfileOk) as never);
    expect(h.creerToken.mock.calls[0]?.[0]).toMatchObject({ signataireNom: "ACME" });
  });

  it("journalise qualiopi.devis.send sans URL, sans jeton, sans adresse", async () => {
    await lancer(vi.fn(enfileOk) as never);
    const appel = h.log.mock.calls[0]?.[0] as { action: string; changes: Record<string, unknown> };
    expect(appel.action).toBe("qualiopi.devis.send");
    expect(appel.changes).toMatchObject({
      statut: "envoye",
      lienSignatureEmis: true,
      documentGenereId: PIECE_ID,
    });
    const s = toutSerialise();
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(ADRESSE);
  });

  it.each([
    [
      "devis modifié",
      () => h.txDevisFindUnique.mockResolvedValue(devisRelu({ updatedAt: new Date("2026-11-02") })),
      /modifié depuis/,
    ],
    [
      "devis refusé",
      () => h.txDevisFindUnique.mockResolvedValue(devisRelu({ statut: "refuse" })),
      /brouillon|envoy/i,
    ],
    [
      "passé envoyé (main propre)",
      () => h.txDevisFindUnique.mockResolvedValue(devisRelu({ statut: "envoye" })),
      /brouillon|envoy/i,
    ],
    ["introuvable", () => h.txDevisFindUnique.mockResolvedValue(null), /introuvable/i],
    ["version remplacée signée", () => h.bloque.mockResolvedValue(true), /précédente/i],
    [
      "formules éteintes",
      () => {
        h.txDevisFindUnique.mockResolvedValue(devisRelu({ offre: { x: 1 } }));
        h.formules.mockResolvedValue(false);
      },
      /formules/i,
    ],
    ["pièce absente", () => h.txDocFindUnique.mockResolvedValue(null), /pièce/i],
    [
      "pièce d'un autre client",
      () => h.txDocFindUnique.mockResolvedValue(pieceLue({ clientId: "c-2" })),
      /pièce/i,
    ],
    [
      "pièce d'un autre type",
      () => h.txDocFindUnique.mockResolvedValue(pieceLue({ type: "facture" })),
      /pièce/i,
    ],
    [
      "un AUTRE devis désigne déjà la pièce",
      () => h.txDevisFindFirst.mockResolvedValue({ id: "autre-devis" }),
      /incohérent/i,
    ],
    ["clé PDF d'une autre pièce", () => undefined, /incohérent/i, "documents/2026/devis/AUTRE.pdf"],
    [
      "clé PDF d'un autre type",
      () => undefined,
      /incohérent/i,
      "documents/2026/facture/AXI-DOC-001.pdf",
    ],
    [
      "clé PDF à année courte",
      () => undefined,
      /incohérent/i,
      "documents/26/devis/AXI-DOC-001.pdf",
    ],
    [
      "clé PDF hors dossier documents",
      () => undefined,
      /incohérent/i,
      "x/documents/2026/devis/AXI-DOC-001.pdf",
    ],
    [
      "clé PDF avec suffixe",
      () => undefined,
      /incohérent/i,
      "documents/2026/devis/AXI-DOC-001.pdf?x=1",
    ],
    [
      "clé PDF : URL signée",
      () => undefined,
      /incohérent/i,
      "https://r2.test/documents/2026/devis/AXI-DOC-001.pdf",
    ],
    [
      "clé PDF avec remontée de dossier",
      () => undefined,
      /incohérent/i,
      "documents/2026/devis/../devis/AXI-DOC-001.pdf",
    ],
  ] as [string, () => unknown, RegExp, string?][])(
    "%s : refus, AUCUN jeton, enfiler jamais appelé",
    async (_n, preparer, motif, pdfCle) => {
      preparer();
      const enfiler = vi.fn(enfileOk);
      const r = await (pdfCle === undefined
        ? lancer(enfiler as never)
        : envoyerAvecLienALEnvoi({
            ligne: LIGNE,
            payload: payloadAvec(marqueurPremier({ pdfCle })),
            acteur: ACTEUR,
            enfiler: enfiler as never,
          }));
      expect(r.type).toBe("refus");
      expect((r as { motif: string }).motif).toMatch(motif);
      expect(h.creerToken).not.toHaveBeenCalled();
      expect(enfiler).not.toHaveBeenCalled();
      expect(h.marquer).not.toHaveBeenCalled();
    },
  );

  it("M2(a) : l'unicité de la pièce se lit dans le tx, hors ce devis", async () => {
    await lancer(vi.fn(enfileOk) as never);
    expect(h.txDevisFindFirst).toHaveBeenCalledWith({
      where: { documentGenereId: PIECE_ID, NOT: { id: DEVIS_ID } },
      select: { id: true },
    });
  });

  it("TokenDocumentError : refus avec son message, enfiler jamais appelé", async () => {
    const { TokenDocumentError } =
      await import("@/server/qualiopi/documents/signature/token-document");
    h.creerToken.mockRejectedValue(
      new (TokenDocumentError as never as new (m: string) => Error)("Aucun nom de signataire"),
    );
    const enfiler = vi.fn(enfileOk);
    const r = await lancer(enfiler as never);
    expect(r).toEqual({ type: "refus", motif: "Aucun nom de signataire" });
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("verrou pris : EnvoiOccupe, aucun jeton", async () => {
    h.queryRaw.mockResolvedValue([{ locked: false }]);
    await expect(lancer(vi.fn(enfileOk) as never)).rejects.toBeInstanceOf(EnvoiOccupe);
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("enfiler lève : jeton précis révoqué, erreur NEUTRE relancée (m1), rien d'écrit", async () => {
    h.rendrePrecedent.mockResolvedValue(false); // aucun ancien lien à rendre
    const erreur = new Error(`boom ${TOKEN} ${ADRESSE}`);
    const levee = await lancer(
      vi.fn(async () => {
        throw erreur;
      }) as never,
    ).catch((e: unknown) => e);
    expect(levee).toBeInstanceOf(EnvoiNonParti);
    expect(levee).not.toBe(erreur);
    expect((levee as Error).message).toBe("envoi non parti");
    expect((levee as Error).cause).toBe("Error");
    expect(JSON.stringify(levee)).not.toContain(TOKEN);
    expect(String((levee as Error).stack)).not.toContain(TOKEN);
    expect(h.revoquerPrecis).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(h.marquer).not.toHaveBeenCalled();
    expect(toutSerialise()).not.toContain(TOKEN);
  });

  it.each([
    ["retenu", { enqueued: false, retenu: "desabonne" }],
    ["essai bloqué", { enqueued: false, essaiBloque: true }],
    ["file absente", { enqueued: false }],
    ["corbeille indisponible", { enqueued: false, corbeilleIndisponible: true }],
    ["garé pour validation (m2)", { enqueued: false, garePourValidation: true, outboxId: "o-2" }],
  ])("%s : jeton révoqué, verdict rendu tel quel, rien d'écrit", async (_n, verdict) => {
    h.rendrePrecedent.mockResolvedValue(false); // aucun ancien lien à rendre
    const r = await lancer(vi.fn(async () => verdict) as never);
    expect(r).toEqual({ type: "envoi", res: verdict });
    expect(h.revoquerPrecis).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(h.marquer).not.toHaveBeenCalled();
  });

  it("point 3 : enfilage non parti → l'ancien lien est rendu (revoquer, URL du jeton neuf), pas de révocation en plus", async () => {
    const v = { enqueued: false, retenu: "oppose" };
    const r = await lancer(vi.fn(async () => v) as never);
    expect(r).toEqual({ type: "envoi", res: v });
    expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
    expect(h.rendrePrecedent.mock.calls[0]?.[0]).toBe(
      `https://exemple.test/fr/portail/signer/${TOKEN}`,
    );
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
  });

  it("point 3 : enfiler lève → l'ancien lien est rendu, erreur neutre relancée", async () => {
    const levee = await lancer(
      vi.fn(async () => {
        throw new Error(`boom ${TOKEN}`);
      }) as never,
    ).catch((e: unknown) => e);
    expect(levee).toBeInstanceOf(EnvoiNonParti);
    expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
  });

  it("point 3 : rien à rendre (false) → jeton neuf révoqué par son identifiant, et signalement", async () => {
    h.rendrePrecedent.mockResolvedValue(false);
    const v = { enqueued: false };
    await expect(lancer(vi.fn(async () => v) as never)).resolves.toEqual({
      type: "envoi",
      res: v,
    });
    expect(h.revoquerPrecis).toHaveBeenCalledWith({
      tokenId: "t-1",
      motif: "Envoi annulé : rien n'est parti",
    });
    expect(h.sentryExc).toHaveBeenCalledTimes(1);
  });

  it("point 3 : le rendu lève ET la révocation échoue → rien ne remonte au verdict", async () => {
    h.rendrePrecedent.mockRejectedValue(new Error(`${TOKEN} ${ADRESSE}`));
    h.revoquerPrecis.mockRejectedValue(new Error("b"));
    const v = { enqueued: false, garePourValidation: true };
    await expect(lancer(vi.fn(async () => v) as never)).resolves.toEqual({
      type: "envoi",
      res: v,
    });
    expect(toutSerialise()).not.toContain(TOKEN);
  });

  it("m4 : écritures en échec après enfilage → trace send_refuse/apres_courriel, sans fuite", async () => {
    h.marquer.mockRejectedValue(new Error(`${ADRESSE} /portail/signer/${TOKEN}`));
    await lancer(vi.fn(enfileOk) as never);
    expect(h.log).toHaveBeenCalledTimes(1);
    expect(h.log).toHaveBeenCalledWith({
      action: "qualiopi.devis.send_refuse",
      targetType: "Devis",
      targetId: DEVIS_ID,
      changes: { motif: "apres_courriel" },
      session: (ACTEUR as { session: unknown }).session,
    });
    expect(toutSerialise()).not.toContain(TOKEN);
    expect(toutSerialise()).not.toContain(ADRESSE);
    expect(toutSerialise()).not.toContain("/portail/signer/");
  });

  it("m4 : la trace de journal qui échoue ne fait jamais remonter d'erreur", async () => {
    h.marquer.mockRejectedValue(new Error("x"));
    h.log.mockRejectedValue(new Error(`${ADRESSE} ${TOKEN}`));
    const r = await lancer(vi.fn(enfileOk) as never);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true } });
    expect(toutSerialise()).not.toContain(TOKEN);
    expect(toutSerialise()).not.toContain(ADRESSE);
  });

  it("m4 : version précédente signée entre-temps → « Cause » ajoutée aux deux alertes", async () => {
    h.marquer.mockRejectedValue(new VersionRemplaceeSigneeEntreTempsError());
    await lancer(vi.fn(enfileOk) as never);
    const cause = "Cause : version précédente signée entre-temps.";
    expect(String(h.sentryMsg.mock.calls[0]?.[0])).toContain(cause);
    expect(JSON.stringify(h.telegram.mock.calls[0])).toContain(cause);
  });

  it("m4 : sans cette erreur, pas de « Cause » dans l'alerte", async () => {
    h.marquer.mockRejectedValue(new Error("autre"));
    await lancer(vi.fn(enfileOk) as never);
    expect(String(h.sentryMsg.mock.calls[0]?.[0])).not.toContain("Cause :");
  });

  it("écritures en échec APRÈS enfilage : aucune exception, alerte, aucune révocation", async () => {
    h.marquer.mockRejectedValue(
      new Error(`échec sur ${ADRESSE} https://exemple.test/fr/portail/signer/${TOKEN}`),
    );
    const r = await lancer(vi.fn(enfileOk) as never);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true } });
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
    expect(h.sentryMsg).toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalled();
    const s = toutSerialise();
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(ADRESSE);
  });
});

describe("devis-renvoi", () => {
  beforeEach(() => {
    h.txDevisFindUnique.mockImplementation(async () => {
      h.ordre.push("relu");
      return devisRelu({ statut: "envoye" });
    });
  });

  const lancer = (enfiler: (p: Record<string, unknown>) => Promise<never>) =>
    envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: payloadAvec(marqueurRenvoi()),
      acteur: ACTEUR,
      enfiler: enfiler as never,
    });

  it("succès : jeton créé avant enfiler, rien d'autre (ni révocation, ni retour de lien)", async () => {
    const enfiler = vi.fn(enfileOk);
    const r = await lancer(enfiler as never);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true } });
    expect(h.creerToken).toHaveBeenCalledTimes(1);
    expect(h.rendrePrecedent).not.toHaveBeenCalled();
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
    expect(h.marquer).not.toHaveBeenCalled();
    const payload = (enfiler.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload["signatureUrl"]).toContain(TOKEN);
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
  });

  it.each([
    [
      "statut non envoyé",
      () => h.txDevisFindUnique.mockResolvedValue(devisRelu({ statut: "brouillon" })),
    ],
    [
      "autre pièce",
      () =>
        h.txDevisFindUnique.mockResolvedValue(
          devisRelu({ statut: "envoye", documentGenereId: "autre" }),
        ),
    ],
    ["déjà signé par le client", () => h.txDevisCount.mockResolvedValue(0)],
    [
      "formules éteintes",
      () => {
        h.txDevisFindUnique.mockResolvedValue(devisRelu({ statut: "envoye", offre: { x: 1 } }));
        h.formules.mockResolvedValue(false);
      },
    ],
  ])("%s : refus, aucun jeton créé (l'ancien lien reste vivant)", async (_n, preparer) => {
    preparer();
    const enfiler = vi.fn(enfileOk);
    const r = await lancer(enfiler as never);
    expect(r.type).toBe("refus");
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
  });

  it("enfilage en échec (exception) : lien précédent rendu en mode « revoquer », erreur neutre relancée", async () => {
    const erreur = new Error(`boom ${TOKEN} ${ADRESSE}`);
    const levee = await lancer(
      vi.fn(async () => {
        throw erreur;
      }) as never,
    ).catch((e: unknown) => e);
    expect(levee).toBeInstanceOf(EnvoiNonParti);
    expect((levee as Error).cause).toBe("Error");
    expect(JSON.stringify(levee)).not.toContain(TOKEN);
    expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
    // M1 : l'ancien lien est rendu (true) : le jeton neuf n'est PAS révoqué en plus.
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
    expect(h.rendrePrecedent.mock.calls.every((c) => c[1] !== "supprimer")).toBe(true);
  });

  it("non enfilé (retenu) : lien précédent rendu en mode « revoquer », verdict tel quel", async () => {
    const v = { enqueued: false, retenu: "oppose" };
    const r = await lancer(vi.fn(async () => v) as never);
    expect(r).toEqual({ type: "envoi", res: v });
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
    expect(h.revoquerPrecis).not.toHaveBeenCalled();
  });

  it("garé pour validation (m2) : traité comme non parti, ancien lien rendu", async () => {
    const v = { enqueued: false, garePourValidation: true, outboxId: "o-2" };
    const r = await lancer(vi.fn(async () => v) as never);
    expect(r).toEqual({ type: "envoi", res: v });
    expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
  });

  it("m3 : enfiler reçoit l'adresse de la ligne", async () => {
    const enfiler = vi.fn(enfileOk);
    await lancer(enfiler as never);
    expect((enfiler.mock.calls[0] as unknown[])[1]).toBe(ADRESSE);
  });

  it("M1 : rendrePrecedent reçoit l'URL du jeton NEUF", async () => {
    await lancer(vi.fn(async () => ({ enqueued: false, retenu: "oppose" })) as never);
    expect(h.rendrePrecedent.mock.calls[0]?.[0]).toBe(
      `https://exemple.test/fr/portail/signer/${TOKEN}`,
    );
  });

  it.each([
    [
      "enfilage qui lève",
      async () => {
        throw new Error("x");
      },
    ],
    ["enfilage retenu", async () => ({ enqueued: false, retenu: "oppose" })],
  ])(
    "M1 : %s et rien à rendre (false) → jeton neuf révoqué par son tokenId",
    async (_n, enfiler) => {
      h.rendrePrecedent.mockResolvedValue(false);
      await lancer(enfiler as never).catch(() => undefined);
      expect(h.revoquerPrecis).toHaveBeenCalledTimes(1);
      expect(h.revoquerPrecis).toHaveBeenCalledWith({
        tokenId: "t-1",
        motif: "Envoi annulé : rien n'est parti",
      });
    },
  );

  it("point 2 : rendrePrecedent rend false → signalement à nom fixe, sans donnée", async () => {
    h.rendrePrecedent.mockResolvedValue(false);
    await lancer(vi.fn(async () => ({ enqueued: false, retenu: "oppose" })) as never);
    expect(h.sentryExc).toHaveBeenCalledTimes(1);
    const [err, opts] = h.sentryExc.mock.calls[0] as [Error, { tags: Record<string, string> }];
    expect(err.message).toBe("lien-a-l-envoi : lienALEnvoi.ancien_lien_non_rendu");
    expect(opts.tags.action).toBe("lienALEnvoi.ancien_lien_non_rendu");
    expect(toutSerialise()).not.toContain(TOKEN);
    expect(toutSerialise()).not.toContain(ADRESSE);
  });

  it("point 2 : rendrePrecedent rend true → aucun signalement", async () => {
    await lancer(vi.fn(async () => ({ enqueued: false, retenu: "oppose" })) as never);
    expect(h.sentryExc).not.toHaveBeenCalled();
  });

  it("M1 : rendrePrecedent lève → jeton neuf révoqué, aucune erreur ne remonte, alerte", async () => {
    h.rendrePrecedent.mockRejectedValue(new Error(`${TOKEN} ${ADRESSE}`));
    const v = { enqueued: false, retenu: "oppose" };
    const r = await lancer(vi.fn(async () => v) as never);
    expect(r).toEqual({ type: "envoi", res: v });
    expect(h.revoquerPrecis).toHaveBeenCalledWith({
      tokenId: "t-1",
      motif: "Envoi annulé : rien n'est parti",
    });
    expect(h.sentryExc).toHaveBeenCalled();
    expect(toutSerialise()).not.toContain(TOKEN);
  });

  it("M1 : rendrePrecedent lève ET la révocation échoue → rien ne remonte", async () => {
    h.rendrePrecedent.mockRejectedValue(new Error("a"));
    h.revoquerPrecis.mockRejectedValue(new Error("b"));
    const v = { enqueued: false };
    await expect(lancer(vi.fn(async () => v) as never)).resolves.toEqual({
      type: "envoi",
      res: v,
    });
  });

  describe("B2 PR 4 : verrou du devis et relecture dans la transaction", () => {
    beforeEach(() => {
      h.txDevisFindUnique.mockImplementation(async () => {
        h.ordre.push("relu");
        return devisRelu({ statut: "envoye" });
      });
    });

    it("le verrou `devis.envoi:<id>` est pris AVANT la relecture, AVANT le jeton, AVANT l'enfilage", async () => {
      const enfiler = vi.fn(async () => {
        h.ordre.push("enfiler");
        return { enqueued: true };
      });
      await lancer(enfiler as never);
      expect(h.ordre.indexOf("verrou")).toBe(0);
      expect(h.ordre.indexOf("verrou")).toBeLessThan(h.ordre.indexOf("relu"));
      expect(h.ordre.indexOf("relu")).toBeLessThan(h.ordre.indexOf("jeton"));
      expect(h.ordre.indexOf("jeton")).toBeLessThan(h.ordre.indexOf("enfiler"));
      // Même clé que le premier envoi.
      const appel = h.queryRaw.mock.calls[0] as unknown[];
      expect(JSON.stringify(appel)).toContain(`devis.envoi:${DEVIS_ID}`);
    });

    it("verrou déjà pris : EnvoiOccupe, aucun jeton, aucun enfilage", async () => {
      h.queryRaw.mockImplementation(async () => [{ locked: false }]);
      const enfiler = vi.fn(enfileOk);
      await expect(lancer(enfiler as never)).rejects.toBeInstanceOf(EnvoiOccupe);
      expect(h.creerToken).not.toHaveBeenCalled();
      expect(enfiler).not.toHaveBeenCalled();
    });

    it("deux approbations de renvoi SIMULTANÉES du même devis : un seul jeton, un seul e-mail", async () => {
      h.queryRaw.mockImplementation(async () => {
        h.ordre.push("verrou");
        if (h.verrou.pris) return [{ locked: false }];
        h.verrou.pris = true;
        return [{ locked: true }];
      });
      const enfiler = vi.fn(async () => {
        // Laisse la seconde approbation tenter son verrou pendant que la première travaille.
        await new Promise((r) => setTimeout(r, 5));
        return { enqueued: true };
      });
      const [a, b] = await Promise.allSettled([lancer(enfiler as never), lancer(enfiler as never)]);
      expect(h.creerToken).toHaveBeenCalledTimes(1);
      expect(enfiler).toHaveBeenCalledTimes(1);
      const issues = [a, b].map((x) => x.status);
      expect(issues.sort()).toEqual(["fulfilled", "rejected"]);
      const rejet = [a, b].find((x) => x.status === "rejected") as PromiseRejectedResult;
      expect(rejet.reason).toBeInstanceOf(EnvoiOccupe);
    });

    it("le devis n'est plus « envoye » dans le tx (changé pendant l'attente du verrou) : refus, aucun jeton", async () => {
      h.txDevisFindUnique.mockImplementation(async () => devisRelu({ statut: "accepte" }));
      const r = await lancer(vi.fn(enfileOk) as never);
      expect(r.type).toBe("refus");
      expect(h.creerToken).not.toHaveBeenCalled();
    });

    it("la lecture et le contrôle « déjà signé » se font dans le tx, pas hors verrou", async () => {
      await lancer(vi.fn(enfileOk) as never);
      expect(h.devisFindUnique).not.toHaveBeenCalled();
      expect(h.devisCount).not.toHaveBeenCalled();
      expect(h.txDevisCount).toHaveBeenCalledTimes(1);
    });

    it("échec d'enfilage : verrou relâché, ancien lien rendu, erreur neutre", async () => {
      const levee = await lancer(
        vi.fn(async () => {
          throw new Error(`${TOKEN} ${ADRESSE}`);
        }) as never,
      ).catch((e: unknown) => e);
      expect(levee).toBeInstanceOf(EnvoiNonParti);
      expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
      expect(h.verrou.pris).toBe(false);
    });

    it("commit en échec APRÈS l'enfilage : rien ne remonte, aucune révocation, alerte sans fuite", async () => {
      h.commitEchec.v = true;
      const v = { enqueued: true };
      await expect(lancer(vi.fn(async () => v) as never)).resolves.toEqual({
        type: "envoi",
        res: v,
      });
      expect(h.rendrePrecedent).not.toHaveBeenCalled();
      expect(h.revoquerPrecis).not.toHaveBeenCalled();
      expect(h.sentryExc).toHaveBeenCalled();
      const s = toutSerialise();
      expect(s).not.toContain(TOKEN);
      expect(s).not.toContain("/portail/signer/");
      expect(s).not.toContain(ADRESSE);
    });
  });
});

describe("aucune fuite, dans tous les cas", () => {
  it("rien de sensible dans console, Sentry, Telegram ni journal (échec de rendu du lien précédent compris)", async () => {
    h.rendrePrecedent.mockRejectedValue(
      new Error(`https://exemple.test/fr/portail/signer/${TOKEN} ${ADRESSE}`),
    );
    h.revoquerPrecis.mockRejectedValue(new Error(`${TOKEN} ${ADRESSE}`));
    const refus = { enqueued: false, retenu: "oppose" };
    await envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: payloadAvec(marqueurRenvoi()),
      acteur: ACTEUR,
      enfiler: (async () => refus) as never,
    });
    await envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: payloadAvec(marqueurPremier()),
      acteur: ACTEUR,
      enfiler: (async () => refus) as never,
    });
    await envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: payloadAvec(marqueurPremier()),
      acteur: ACTEUR,
      enfiler: (async () => {
        throw new Error(`${TOKEN} ${ADRESSE} /portail/signer/`);
      }) as never,
    }).catch(() => undefined);
    const s = toutSerialise();
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(ADRESSE);
  });

  it("m1 : exception à l'enfilage au RENVOI, erreur de jeton non typée, échec du commit", async () => {
    const secret = `${TOKEN} ${ADRESSE} https://exemple.test/fr/portail/signer/${TOKEN}`;
    // Le devis relu dans le tx : « envoye » pour un renvoi, « brouillon » pour un premier envoi.
    const lancerCas = (m: unknown, enfiler: unknown) => {
      const statut = (m as { nature: string }).nature === "devis-renvoi" ? "envoye" : "brouillon";
      h.txDevisFindUnique.mockImplementation(async () => devisRelu({ statut }));
      return envoyerAvecLienALEnvoi({
        ligne: LIGNE,
        payload: payloadAvec(m),
        acteur: ACTEUR,
        enfiler: enfiler as never,
      }).catch((e: unknown) => e);
    };
    const erreurs: unknown[] = [];
    // renvoi : exception à l'enfilage
    erreurs.push(
      await lancerCas(marqueurRenvoi(), async () => {
        throw new Error(secret);
      }),
    );
    // jeton : erreur non typée, aux deux natures
    h.creerToken.mockRejectedValue(new Error(secret));
    erreurs.push(await lancerCas(marqueurPremier(), enfileOk));
    erreurs.push(await lancerCas(marqueurRenvoi(), enfileOk));
    h.creerToken.mockImplementation(async () => ({
      token: TOKEN,
      tokenId: "t-1",
      expiresAt: new Date(),
    }));
    // commit échoué après un travail réussi (enfilé : alerte ; non enfilé : erreur neutre)
    h.commitEchec.v = true;
    erreurs.push(await lancerCas(marqueurPremier(), enfileOk));
    erreurs.push(await lancerCas(marqueurPremier(), async () => ({ enqueued: false })));
    const s =
      toutSerialise() + JSON.stringify(erreurs.map((e) => [String(e), (e as Error)?.cause]));
    expect(s).not.toContain(TOKEN);
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(ADRESSE);
    expect(erreurs[0]).toBeInstanceOf(EnvoiNonParti);
  });
});
