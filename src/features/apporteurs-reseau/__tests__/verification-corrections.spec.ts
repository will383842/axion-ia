import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Vérification d'un dossier signé : refus définitif (pièces purgées), renvoi du contrat
// signé, lien du dossier dans l'e-mail de contresignature. Tout le serveur est remplacé.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  lireDossier: vi.fn(),
  purgerContenuPieces: vi.fn(),
  appUpdate: vi.fn(),
  // Contresignature : réservation conditionnelle (07/10). `count` 1 = réservé, 0 = déjà fait.
  appUpdateMany: vi.fn(async (_a?: unknown) => ({ count: 1 })),
  appFindUnique: vi.fn(),
  registre: vi.fn(),
}));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => h.registre(...a),
}));

vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  apercu: vi.fn(),
  avecTexteLibre: (payload: Record<string, unknown>, texte?: string) =>
    texte ? { ...payload, texteLibre: texte } : payload,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: (...a: unknown[]) => h.purgerContenuPieces(...a),
}));
const pdf = vi.hoisted(() => ({
  texteDuContrat: vi.fn(),
  rendreContratPdf: vi.fn(),
}));
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: (...a: unknown[]) => pdf.texteDuContrat(...a),
    empreinte: (t: string) => createHash("sha256").update(t).digest("hex"),
    rendreContratPdf: (...a: unknown[]) => pdf.rendreContratPdf(...a),
  };
});
const r2 = vi.hoisted(() => ({ deleteFromR2: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: (...a: unknown[]) => r2.deleteFromR2(...a),
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: (...a: unknown[]) => r2.upload(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => {
  const tx = { apporteurReseau: { update: (...a: unknown[]) => h.appUpdate(...a) } };
  return {
    prisma: {
      apporteurReseau: {
        findUnique: (...a: unknown[]) => h.appFindUnique(...a),
        update: (...a: unknown[]) => h.appUpdate(...a),
        updateMany: (...a: unknown[]) => h.appUpdateMany(...a),
      },
      pieceApporteur: { update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
    },
  };
});

import { appliquerDecision, preparerDecision, renvoyerContratSigne } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function dossier(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    statut: "a_verifier",
    versionLien: 2,
    prenom: "Claire",
    email: "claire@exemple.fr",
    siren: "732829320",
    pieces: [{ type: "identite", statut: "conforme" }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.envoyer.mockResolvedValue("envoye");
  h.lireDossier.mockResolvedValue(dossier());
  h.purgerContenuPieces.mockResolvedValue(2);
  h.registre.mockResolvedValue({ ok: true, entreprise: { siren: "732829320", active: true } });
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
});

describe("07/10 (ordre de Will) : aucune contresignature sans SIREN valide et ACTIF", () => {
  it.each([
    [null, "absent ou invalide"],
    ["123456789", "absent ou invalide"],
  ])("SIREN %s : refus, sans même interroger le registre", async (siren, motif) => {
    h.lireDossier.mockResolvedValue(dossier({ siren }));
    const r = await preparerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain(`SIREN à vérifier : ${motif}`);
    expect(h.registre).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, raison: "indisponible" }, "ne répond pas"],
    [{ ok: false, raison: "introuvable" }, "introuvable"],
    [{ ok: true, entreprise: { siren: "732829320", active: false } }, "cessée"],
  ])("registre %j : refus avec un message clair, aucun envoi", async (rep, motif) => {
    h.registre.mockResolvedValue(rep);
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("SIREN à vérifier");
    expect((r as { message: string }).message).toContain(motif);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("registre qui répond « actif » : la contresignature reste possible", async () => {
    const r = await preparerDecision(ID, "contresigner", null);
    expect(r.ok).toBe(true);
    expect(h.registre).toHaveBeenCalledWith("732829320");
  });
});

describe("refus définitif : identité ET RIB purgés", () => {
  it("purge les deux types dans la même transaction que le changement de statut", async () => {
    const r = await appliquerDecision(ID, "refuser", "Hors périmètre");
    expect(r).toMatchObject({ ok: true });
    const maj = h.appUpdate.mock.calls[0]![0];
    expect(maj.data).toMatchObject({ statut: "refuse", versionLien: { increment: 1 } });
    // L'IBAN (chiffré) est vidé avec les pièces.
    expect(maj.data.iban).toBeNull();
    expect(h.purgerContenuPieces).toHaveBeenCalledTimes(1);
    const [, filtre] = h.purgerContenuPieces.mock.calls[0]!;
    expect(filtre).toEqual({ apporteurId: ID, types: ["identite", "rib"] });
    // L'ordre : d'abord le statut, puis la purge (même transaction).
    expect(h.appUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      h.purgerContenuPieces.mock.invocationCallOrder[0]!,
    );
  });

  it("ne purge rien quand on demande seulement un complément", async () => {
    h.lireDossier.mockResolvedValue(dossier());
    await appliquerDecision(ID, "a_completer", "Photo floue");
    expect(h.purgerContenuPieces).not.toHaveBeenCalled();
  });
});

describe("D5 : l'e-mail de contresignature porte le lien du dossier", () => {
  it("le payload contient `dossierUrl` (bouton « Déclarer une entreprise »)", async () => {
    const r = await preparerDecision(ID, "contresigner", null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envoi.gabarit).toBe("apporteur-contrat-signe");
    const url = String(r.envoi.payload.dossierUrl);
    expect(url).toContain(`/apporteur/dossier/${ID}/`);
    expect(r.envoi.payload.contactName).toBe("Claire");
  });

  it("sans secret en production, l'e-mail part sans bouton plutôt que de ne pas partir", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const r = await preparerDecision(ID, "contresigner", null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.envoi.payload).not.toHaveProperty("dossierUrl");
  });
});

describe("D4 : renvoyer le contrat signé", () => {
  const cle = `apporteurs/${ID}/contrat-v2-signe-abcdef01.pdf`;

  it("rejoue l'e-mail avec la pièce jointe, sans toucher au statut ni à la signature", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: cle });
    const r = await renvoyerContratSigne(ID, new Date("2026-10-05T12:00:00Z"));
    expect(r).toEqual({ ok: true, message: "Contrat signé renvoyé." });
    const e = h.envoyer.mock.calls[0]![0];
    expect(e).toMatchObject({
      gabarit: "apporteur-contrat-signe",
      destinataire: "claire@exemple.fr",
      entityId: ID,
      attachments: [{ r2Key: cle, contentType: "application/pdf" }],
    });
    expect(e.payload.dossierUrl).toContain(ID);
    expect(h.appUpdate).not.toHaveBeenCalled();
  });

  it("chaque renvoi a un jobId distinct, et distinct de l'envoi d'origine", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: cle });
    await renvoyerContratSigne(ID, new Date("2026-10-05T12:00:00Z"));
    await renvoyerContratSigne(ID, new Date("2026-10-05T12:00:01Z"));
    const [a, b] = h.envoyer.mock.calls.map((c) => (c[0] as { jobId: string }).jobId);
    expect(a).not.toBe(b);
    for (const j of [a, b]) {
      expect(j).not.toBe(`apporteur-contrat-signe-${ID}`);
      expect(j).toContain("renvoi");
    }
  });

  it("refuse si le contrat n'est pas contresigné ou si la pièce est introuvable", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "a_verifier" }));
    expect(await renvoyerContratSigne(ID)).toMatchObject({ ok: false });
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: null });
    expect(await renvoyerContratSigne(ID)).toMatchObject({ ok: false });
    h.lireDossier.mockResolvedValue(null);
    expect(await renvoyerContratSigne(ID)).toMatchObject({ ok: false });
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("dit la vérité quand la file retient l'e-mail", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: cle });
    h.envoyer.mockResolvedValue("retenu");
    const r = await renvoyerContratSigne(ID);
    expect(r).toMatchObject({ ok: true });
    expect((r as { message: string }).message).toContain("retenu");
  });
});

describe("B3 : la contresignature fabrique le PDF depuis le texte archivé à la signature", () => {
  const sha = (t: string) => createHash("sha256").update(t).digest("hex");
  const TEXTE_SIGNE = "CONTRAT version du jour de la signature";
  const signature = (over: Record<string, unknown> = {}) => ({
    nomTape: "Claire Martin",
    signeAt: "2026-10-05T10:00:00.000Z",
    ipHash: null,
    navigateur: "Chrome sur Android",
    acceptations: [],
    declarations: [],
    texteSha256: sha(TEXTE_SIGNE),
    valeurs: { identite: "Claire MARTIN" },
    ...over,
  });

  beforeEach(() => {
    pdf.rendreContratPdf.mockResolvedValue(Buffer.from("%PDF"));
  });

  it("texte du contrat modifié depuis la signature : contresignature OK depuis l'archive", async () => {
    pdf.texteDuContrat.mockReturnValue("CONTRAT version modifiée après coup");
    h.appFindUnique.mockResolvedValue({
      signatureApporteur: signature({ texte: TEXTE_SIGNE }),
      contratSha256: sha(TEXTE_SIGNE),
    });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(pdf.rendreContratPdf.mock.calls[0]![0].texte).toBe(TEXTE_SIGNE);
    expect(pdf.texteDuContrat).not.toHaveBeenCalled();
  });

  it("archive altérée (empreinte différente) : refus, aucun PDF", async () => {
    h.appFindUnique.mockResolvedValue({
      signatureApporteur: signature({ texte: TEXTE_SIGNE + " altéré" }),
      contratSha256: sha(TEXTE_SIGNE),
    });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("signer à nouveau");
    expect(pdf.rendreContratPdf).not.toHaveBeenCalled();
  });

  it("ancien dossier sans archive, contrat inchangé : reconstruction + comparaison, OK", async () => {
    pdf.texteDuContrat.mockReturnValue(TEXTE_SIGNE);
    h.appFindUnique.mockResolvedValue({
      signatureApporteur: signature(),
      contratSha256: sha(TEXTE_SIGNE),
    });
    expect(await appliquerDecision(ID, "contresigner", null)).toMatchObject({ ok: true });
    expect(pdf.texteDuContrat).toHaveBeenCalledTimes(1);
  });

  it("ancien dossier sans archive, contrat modifié : « signer à nouveau »", async () => {
    pdf.texteDuContrat.mockReturnValue("CONTRAT autre texte");
    h.appFindUnique.mockResolvedValue({
      signatureApporteur: signature(),
      contratSha256: sha(TEXTE_SIGNE),
    });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("signer à nouveau");
    expect(pdf.rendreContratPdf).not.toHaveBeenCalled();
  });
});

describe("07/10 : la contresignature est réservée avant le PDF (double clic)", () => {
  beforeEach(() => {
    pdf.rendreContratPdf.mockResolvedValue(Buffer.from("%PDF"));
    pdf.texteDuContrat.mockReturnValue("CONTRAT");
    h.appFindUnique.mockResolvedValue({
      signatureApporteur: {
        nomTape: "Claire Martin",
        signeAt: "2026-10-07T10:00:00.000Z",
        texteSha256: createHash("sha256").update("CONTRAT").digest("hex"),
        valeurs: { identite: "Claire MARTIN" },
        version: "2.1",
      },
    });
  });

  it("second clic : « déjà contresigné », aucun PDF ni e-mail", async () => {
    h.appUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("déjà contresigné");
    expect(pdf.rendreContratPdf).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("la réservation est conditionnée au statut « à vérifier », et le PDF porte la version signée", async () => {
    expect(await appliquerDecision(ID, "contresigner", null)).toMatchObject({ ok: true });
    // Réservation DÉDIÉE et reprenable une fois expirée ; `signeParSocieteAt` n'y est pas posé.
    const reservation = h.appUpdateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(reservation.where).toMatchObject({
      id: ID,
      statut: "a_verifier",
      signeParSocieteAt: null,
    });
    expect(JSON.stringify(reservation.where.OR)).toContain("contresignatureReserveeJusqua");
    expect(reservation.data).not.toHaveProperty("signeParSocieteAt");
    expect(reservation.data.contresignatureReserveeJusqua).toBeInstanceOf(Date);
    expect(pdf.rendreContratPdf.mock.calls[0]![0].version).toBe("2.1");
  });

  it("le PDF échoue : la réservation est levée, on pourra recliquer", async () => {
    pdf.rendreContratPdf.mockRejectedValueOnce(new Error("rendu impossible"));
    await expect(appliquerDecision(ID, "contresigner", null)).rejects.toThrow();
    const levee = h.appUpdateMany.mock.calls.find(
      (c) =>
        (c[0] as { data: Record<string, unknown> }).data.contresignatureReserveeJusqua === null,
    );
    expect(levee).toBeTruthy();
  });

  it("écriture finale qui ne trouve rien : PDF orphelin retiré de R2, AUCUN e-mail", async () => {
    h.appUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // réservation
      .mockResolvedValueOnce({ count: 0 }); // écriture finale
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect(r2.deleteFromR2).toHaveBeenCalledTimes(1);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("cas A : l'écriture a réussi mais la réponse s'est perdue → on relit, rien n'est effacé", async () => {
    h.appUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("connexion coupée après validation"));
    const signatureLue = await h.appFindUnique();
    h.appFindUnique
      .mockResolvedValueOnce(signatureLue) // signature de l'apporteur
      .mockImplementationOnce(async () => ({ contratSigneCle: r2.upload.mock.calls[0]![0] }));
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(r2.deleteFromR2).not.toHaveBeenCalled();
  });

  it("cas B : chaque tentative a sa propre clé R2 (aucune n'efface celle d'une autre)", async () => {
    await appliquerDecision(ID, "contresigner", null);
    await appliquerDecision(ID, "contresigner", null);
    const cles = r2.upload.mock.calls.map((c) => c[0] as string);
    expect(cles).toHaveLength(2);
    expect(new Set(cles).size).toBe(2);
  });

  it("écriture finale qui lève : même chose, rien n'est envoyé", async () => {
    h.appUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("base coupée"));
    expect(await appliquerDecision(ID, "contresigner", null)).toMatchObject({ ok: false });
    expect(r2.deleteFromR2).toHaveBeenCalledTimes(1);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("l'effacement RGPD ne conserve qu'un contrat VRAIMENT contresigné (PDF référencé)", () => {
    const src = readFileSync(resolve(__dirname, "../../../lib/rgpd-erase.ts"), "utf8");
    expect(src).toContain("(a.signeParSocieteAt !== null && a.contratSigneCle !== null)");
  });
});
