/**
 * Lien de signature créé À L'ENVOI (lot B2, PR 1 : module NON BRANCHÉ).
 * Mocks Prisma comme les specs voisines ; aucun fichier existant n'est modifié.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txDevisFindUnique: vi.fn(),
  txDocFindUnique: vi.fn(),
  devisFindUnique: vi.fn(),
  devisCount: vi.fn(),
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
      return f(tx);
    },
  },
}));
const tx = {
  $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
  devis: { findUnique: (...a: unknown[]) => h.txDevisFindUnique(...a) },
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

import {
  envoyerAvecLienALEnvoi,
  EnvoiOccupe,
  lireMarqueur,
  payloadPourEnvoi,
} from "./lien-a-l-envoi";

const TOKEN = "JETON-SECRET-XYZ";
const DEVIS_ID = "11111111-1111-4111-8111-111111111111";
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
  pdfCle: "documents/2026/devis/X.pdf",
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
  h.queryRaw.mockResolvedValue([{ locked: true }]);
  h.txDevisFindUnique.mockResolvedValue(devisRelu());
  h.txDocFindUnique.mockResolvedValue({ id: PIECE_ID, clientId: "c-1", type: "devis" });
  h.devisFindUnique.mockResolvedValue(devisRelu({ statut: "envoye" }));
  h.devisCount.mockResolvedValue(1);
  h.formules.mockResolvedValue(true);
  h.bloque.mockResolvedValue(false);
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
    expect(enfiler).toHaveBeenCalledWith(payload);
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
    expect(h.ordre).toEqual(["jeton", "enfiler", "marquer"]);
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
      () => h.txDocFindUnique.mockResolvedValue({ id: PIECE_ID, clientId: "c-2", type: "devis" }),
      /pièce/i,
    ],
    [
      "pièce d'un autre type",
      () => h.txDocFindUnique.mockResolvedValue({ id: PIECE_ID, clientId: "c-1", type: "facture" }),
      /pièce/i,
    ],
  ])("%s : refus, AUCUN jeton, enfiler jamais appelé", async (_n, preparer, motif) => {
    preparer();
    const enfiler = vi.fn(enfileOk);
    const r = await lancer(enfiler as never);
    expect(r.type).toBe("refus");
    expect((r as { motif: string }).motif).toMatch(motif);
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(enfiler).not.toHaveBeenCalled();
    expect(h.marquer).not.toHaveBeenCalled();
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

  it("enfiler lève : jeton précis révoqué, erreur relancée, rien d'écrit", async () => {
    const erreur = new Error("boom");
    await expect(
      lancer(
        vi.fn(async () => {
          throw erreur;
        }) as never,
      ),
    ).rejects.toBe(erreur);
    expect(h.revoquerPrecis).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(h.marquer).not.toHaveBeenCalled();
    expect(toutSerialise()).not.toContain(TOKEN);
  });

  it.each([
    ["retenu", { enqueued: false, retenu: "desabonne" }],
    ["essai bloqué", { enqueued: false, essaiBloque: true }],
    ["file absente", { enqueued: false }],
    ["corbeille indisponible", { enqueued: false, corbeilleIndisponible: true }],
  ])("%s : jeton révoqué, verdict rendu tel quel, rien d'écrit", async (_n, verdict) => {
    const r = await lancer(vi.fn(async () => verdict) as never);
    expect(r).toEqual({ type: "envoi", res: verdict });
    expect(h.revoquerPrecis).toHaveBeenCalledWith(expect.objectContaining({ tokenId: "t-1" }));
    expect(h.marquer).not.toHaveBeenCalled();
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
      () => h.devisFindUnique.mockResolvedValue(devisRelu({ statut: "brouillon" })),
    ],
    [
      "autre pièce",
      () =>
        h.devisFindUnique.mockResolvedValue(
          devisRelu({ statut: "envoye", documentGenereId: "autre" }),
        ),
    ],
    ["déjà signé par le client", () => h.devisCount.mockResolvedValue(0)],
    [
      "formules éteintes",
      () => {
        h.devisFindUnique.mockResolvedValue(devisRelu({ statut: "envoye", offre: { x: 1 } }));
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

  it("enfilage en échec (exception) : lien précédent rendu en mode « revoquer », erreur relancée", async () => {
    const erreur = new Error("boom");
    await expect(
      lancer(
        vi.fn(async () => {
          throw erreur;
        }) as never,
      ),
    ).rejects.toBe(erreur);
    expect(h.rendrePrecedent).toHaveBeenCalledTimes(1);
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
    expect(h.rendrePrecedent.mock.calls.every((c) => c[1] !== "supprimer")).toBe(true);
  });

  it("non enfilé (retenu) : lien précédent rendu en mode « revoquer », verdict tel quel", async () => {
    const v = { enqueued: false, retenu: "oppose" };
    const r = await lancer(vi.fn(async () => v) as never);
    expect(r).toEqual({ type: "envoi", res: v });
    expect(h.rendrePrecedent.mock.calls[0]?.[1]).toBe("revoquer");
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
});
