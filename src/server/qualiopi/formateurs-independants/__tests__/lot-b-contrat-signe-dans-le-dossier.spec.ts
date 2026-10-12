/**
 * Lot B, M3 (et M4, côté code) — le contrat-cadre se crée et se signe DANS le dossier.
 *
 *   · `contrat_auto` est réellement lu : coupé (ou aucune version arrêtée), l'étape 4
 *     garde son comportement d'avant (pas de contrat, dossier envoyé sans signature) ;
 *   · « Recevoir mon code » : le registre est relu EN DIRECT sur le SIRET de la fiche
 *     avant la création (registre muet = refus, rien n'est créé), le contrat est créé
 *     par `preparerContratCadre` (parcours « dossier »), l'objection du contrat-cadre
 *     est relue sur le SIRET porté par le contrat, puis F17 part ;
 *   · « Signer mon contrat » : objection relue à la signature, AVANT de consommer le
 *     code ; lien émis par `emettreLienSignature` (acteur système), signature par le
 *     moteur commun avec le consentement « code » ;
 *   · F10 porte la copie de la signature (pièce jointe), sur la fiche.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const h = vi.hoisted(() => ({
  ordre: [] as string[],
  etats: vi.fn(),
  version: vi.fn(),
  preparer: vi.fn(),
  lire: vi.fn(),
  controle: vi.fn(),
  objection: vi.fn(),
  envoyerCode: vi.fn(),
  emettre: vi.fn(),
  verifierToken: vi.fn(),
  verifierCode: vi.fn(),
  signer: vi.fn(),
  apres: vi.fn(),
  archiver: vi.fn(),
  copieRepli: vi.fn(),
  etatsSignature: vi.fn(),
  envoyer: vi.fn(),
  p: {
    documentGenere: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    trainer: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("../interrupteurs-etat", () => ({ lireEtatsInterrupteurs: () => h.etats() }));
vi.mock("../contrat-cadre-emission", () => ({
  versionContratAEmettre: () => h.version(),
  preparerContratCadre: (...a: unknown[]) => {
    h.ordre.push("preparer");
    return h.preparer(...a);
  },
}));
vi.mock("@/server/registre-entreprises/annuaire", () => ({
  lireEtablissementParSiret: (...a: unknown[]) => {
    h.ordre.push("registre");
    return h.lire(...a);
  },
}));
vi.mock("../controle", () => ({
  controlerRegistreFormateur: (...a: unknown[]) => {
    h.ordre.push("controle");
    return h.controle(...a);
  },
}));
vi.mock("../source-registre", () => ({ sourceRegistreCommune: () => ({}) }));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", async (orig) => ({
  ...(await orig<object>()),
  objectionContratCadre: (...a: unknown[]) => {
    h.ordre.push("objection");
    return h.objection(...a);
  },
}));
vi.mock("../code-signature-envoi", () => ({
  envoyerCodeSignature: (...a: unknown[]) => {
    h.ordre.push("code");
    return h.envoyerCode(...a);
  },
}));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", () => ({
  emettreLienSignature: (...a: unknown[]) => {
    h.ordre.push("emettre");
    return h.emettre(...a);
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => h.verifierToken(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  verifierCodeSignature: (...a: unknown[]) => {
    h.ordre.push("verifierCode");
    return h.verifierCode(...a);
  },
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: (...a: unknown[]) => {
    h.ordre.push("signer");
    return h.signer(...a);
  },
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: (...a: unknown[]) => h.apres(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: async () => ({ ipHash: null, userAgent: null }),
}));
vi.mock("@/server/qualiopi/documents/signature/transmission-exemplaire", () => ({
  archiverCopiePartielle: (...a: unknown[]) => h.archiver(...a),
  transmettreCopiePartielle: (...a: unknown[]) => h.copieRepli(...a),
}));
vi.mock("../interrupteurs-lecture", () => ({ lireEtatsSignature: () => h.etatsSignature() }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => h.envoyer(...a) }));

import { envoyerAccuseDossier } from "../accuse-dossier";
import { etatsParDefaut } from "../interrupteurs";
import {
  demanderCodeDuDossier,
  MESSAGES_CONTRAT_DOSSIER,
  modeContratDossier,
  signerContratDuDossier,
} from "../contrat-dans-le-dossier";

const T = "6f1b8a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const DOC = "33333333-3333-4333-8333-333333333333";
const SIRET = "12345678900011";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");
const D = { id: T, siret: SIRET, email: "camille.martin@exemple.fr", prenom: "Camille" };

const metadataV3 = (siret = SIRET) => ({
  renderData: { gabaritVersion: 3, data: { cocontractant: { siret } } },
});
const REGISTRE_OK = {
  ok: true,
  entreprise: { siret: SIRET, active: true, adresse: "1 rue de la Paix 75002 Paris" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.ordre.length = 0;
  h.etats.mockResolvedValue({ ...etatsParDefaut(), contrat_auto: true });
  h.version.mockReturnValue(3);
  h.p.documentGenere.findMany.mockResolvedValue([]);
  h.p.documentGenere.findUnique.mockResolvedValue({
    id: DOC,
    type: "contrat_sous_traitance",
    numero: "AXI-DOC-2026-1",
    metadata: metadataV3(),
  });
  h.p.documentGenere.updateMany.mockResolvedValue({ count: 0 });
  h.p.trainer.findUnique.mockResolvedValue({ adresseProfessionnelle: null });
  h.p.trainer.updateMany.mockResolvedValue({ count: 1 });
  h.lire.mockResolvedValue(REGISTRE_OK);
  h.controle.mockResolvedValue({ ok: true });
  h.preparer.mockResolvedValue({
    ok: true,
    documentId: DOC,
    numero: "N",
    version: 3,
    remplaces: 0,
  });
  h.objection.mockResolvedValue(null);
  h.envoyerCode.mockResolvedValue({ ok: true });
  h.emettre.mockResolvedValue({
    data: { url: "https://axion-ia.com/fr/portail/signer/JETON.abc", expiresAt: MAINTENANT },
  });
  h.verifierToken.mockResolvedValue({
    ok: true,
    documentGenereId: DOC,
    tokenId: "tok-1",
    partie: "sous_traitant",
  });
  h.verifierCode.mockResolvedValue({ ok: true });
  h.signer.mockResolvedValue({ ok: true, signatureId: "sig-1", statutSignature: "partielle" });
  h.apres.mockResolvedValue(undefined);
  h.archiver.mockResolvedValue({ ok: true, r2Key: "copies/x.pdf", nomFichier: "contrat.pdf" });
  h.envoyer.mockResolvedValue("envoye");
  h.copieRepli.mockResolvedValue({ ok: true });
  h.etatsSignature.mockResolvedValue({ copie_partielle: true });
});

describe("modeContratDossier — `contrat_auto` réellement lu", () => {
  it("coupé : sans contrat (comportement d'avant)", async () => {
    h.etats.mockResolvedValue(etatsParDefaut());
    expect(await modeContratDossier()).toEqual({ mode: "sans_contrat" });
  });
  it("allumé sans version arrêtée : sans contrat", async () => {
    h.version.mockReturnValue(null);
    expect(await modeContratDossier()).toEqual({ mode: "sans_contrat" });
  });
  it("allumé avec la version 3 arrêtée : à signer", async () => {
    expect(await modeContratDossier()).toEqual({ mode: "a_signer", version: 3 });
  });
});

describe("demanderCodeDuDossier", () => {
  it("contrat_auto coupé : refus, rien n'est lu ni créé ni envoyé", async () => {
    h.etats.mockResolvedValue(etatsParDefaut());
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.ordre).toEqual([]);
  });

  it("registre muet avant la création : refus, aucun contrat créé, aucun code", async () => {
    h.lire.mockResolvedValue({ ok: false, raison: "indisponible" });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.preparer).not.toHaveBeenCalled();
    expect(h.envoyerCode).not.toHaveBeenCalled();
  });

  it("entreprise inactive au registre : refus, aucun contrat créé", async () => {
    h.lire.mockResolvedValue({ ok: true, entreprise: { siret: SIRET, active: false } });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.preparer).not.toHaveBeenCalled();
  });

  it("crée le contrat (registre lu en direct sur le SIRET), relit l'objection, puis F17", async () => {
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r).toEqual({ ok: true, destinataireMasque: "c***@e***.fr" });
    expect(h.ordre).toEqual(["registre", "controle", "preparer", "objection", "code"]);
    expect(h.lire.mock.calls[0]![0]).toBe(SIRET);
    // La préparation réutilise la lecture EN DIRECT qui vient d'être faite.
    const prep = h.preparer.mock.calls[0]![0];
    expect(prep).toMatchObject({ trainerId: T, parcours: "dossier" });
    expect(await prep.lire(SIRET)).toBe(REGISTRE_OK);
    // L'adresse du contrat vient du registre, sans écraser une adresse déjà saisie.
    expect(h.p.trainer.updateMany).toHaveBeenCalledWith({
      where: { id: T, adresseProfessionnelle: null },
      data: { adresseProfessionnelle: "1 rue de la Paix 75002 Paris" },
    });
    expect(h.objection.mock.calls[0]![0]).toMatchObject({
      documentGenereId: DOC,
      partie: "sous_traitant",
      metadata: metadataV3(),
    });
    expect(h.envoyerCode).toHaveBeenCalledWith({ documentGenereId: DOC, maintenant: MAINTENANT });
  });

  it("préparation refusée : un message neutre, aucun code", async () => {
    h.preparer.mockResolvedValue({ ok: false, refus: ["Le registre public n'a pas répondu"] });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.envoyerCode).not.toHaveBeenCalled();
  });

  it("objection du contrat-cadre (SIRET du contrat) : aucun code", async () => {
    h.objection.mockResolvedValue({ message: "Le registre public ne confirme pas…" });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r).toEqual({ ok: false, message: "Le registre public ne confirme pas…" });
    expect(h.envoyerCode).not.toHaveBeenCalled();
  });

  it("contrat déjà créé pour ce SIRET : il est repris, rien n'est recréé", async () => {
    h.p.documentGenere.findMany.mockResolvedValue([
      { id: DOC, metadata: metadataV3(), statutSignature: "en_attente", signatures: [] },
    ]);
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(true);
    expect(h.preparer).not.toHaveBeenCalled();
    // Contrat repris : le registre est quand même relu EN DIRECT avant l'envoi du code.
    expect(h.ordre).toEqual(["registre", "objection", "code"]);
    expect(h.lire.mock.calls[0]![0]).toBe(SIRET);
  });

  it("contrat repris, registre muet avant l'envoi du code : refus, aucun code", async () => {
    h.p.documentGenere.findMany.mockResolvedValue([
      { id: DOC, metadata: metadataV3(), statutSignature: "en_attente", signatures: [] },
    ]);
    h.lire.mockResolvedValue({ ok: false, raison: "indisponible" });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.envoyerCode).not.toHaveBeenCalled();
  });

  it("SIRET changé dans le dossier depuis la création : l'ancien contrat non signé est annulé (jamais effacé), un nouveau est créé", async () => {
    h.p.documentGenere.findMany.mockResolvedValue([
      {
        id: "ancien",
        metadata: metadataV3("98765432100019"),
        statutSignature: "en_attente",
        signatures: [],
      },
    ]);
    h.p.documentGenere.updateMany.mockResolvedValue({ count: 1 });
    const r = await demanderCodeDuDossier(D, MAINTENANT);
    expect(r.ok).toBe(true);
    const annule = h.p.documentGenere.updateMany.mock.calls[0]![0];
    expect(annule.where).toMatchObject({ id: "ancien", annuleeAt: null });
    expect(annule.data).toMatchObject({ annuleeAt: MAINTENANT, annuleePar: "system" });
    expect(h.preparer).toHaveBeenCalled();
  });
});

describe("signerContratDuDossier", () => {
  beforeEach(() => {
    h.p.documentGenere.findMany.mockResolvedValue([
      { id: DOC, metadata: metadataV3(), statutSignature: "en_attente", signatures: [] },
    ]);
  });

  it("objection à la signature : refus AVANT de consommer le code", async () => {
    h.objection.mockResolvedValue({ message: "Le registre public ne répond pas…" });
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.verifierCode).not.toHaveBeenCalled();
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("registre relu EN DIRECT à la signature, sur le SIRET porté par le contrat", async () => {
    // La fiche porte un autre SIRET : seul celui du contrat compte pour la relecture.
    await signerContratDuDossier({ ...D, siret: "98765432100019" }, "123456", MAINTENANT);
    expect(h.lire.mock.calls[0]![0]).toBe(SIRET);
  });

  it("registre muet à la signature : refus, le code n'est pas consommé", async () => {
    h.lire.mockRejectedValue(new Error("timeout"));
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CONTRAT_DOSSIER.muet });
    expect(h.verifierCode).not.toHaveBeenCalled();
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("entreprise inactive à la signature : refus, rien n'est signé", async () => {
    h.lire.mockResolvedValue({ ok: true, entreprise: { siret: SIRET, active: false } });
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CONTRAT_DOSSIER.inactive });
    expect(h.verifierCode).not.toHaveBeenCalled();
  });

  it("le code saisi n'apparaît dans aucun appel à Sentry", async () => {
    const Sentry = await import("@sentry/nextjs");
    h.signer.mockResolvedValue({ ok: false, raison: "x" });
    await signerContratDuDossier(D, "482917", MAINTENANT);
    h.verifierCode.mockRejectedValue(new Error("panne"));
    await signerContratDuDossier(D, "482917", MAINTENANT).catch(() => undefined);
    const tout = JSON.stringify([
      vi.mocked(Sentry.captureException).mock.calls,
      vi.mocked(Sentry.captureMessage).mock.calls,
    ]);
    expect(tout).not.toContain("482917");
  });

  it("code refusé : rien n'est signé", async () => {
    h.verifierCode.mockResolvedValue({ ok: false, message: "Ce code ne correspond pas." });
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r).toEqual({ ok: false, message: "Ce code ne correspond pas." });
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("code refusé : aucun lien émis (aucune ligne de journal, aucun lien d'administrateur révoqué)", async () => {
    h.verifierCode.mockResolvedValue({ ok: false, message: "Ce code ne correspond pas." });
    await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(h.emettre).not.toHaveBeenCalled();
  });

  it("signature échouée APRÈS la consommation du code : le message dit de redemander un code", async () => {
    h.signer.mockResolvedValue({ ok: false, raison: "deja_signe", message: "x" });
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toMatch(/nouveau code/);
  });

  it("signe par le moteur commun : lien émis par le système, code vérifié, consentement « code »", async () => {
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r).toEqual({ ok: true, documentId: DOC });
    // Le code d'abord : un code faux n'émet aucun lien (relecture du lot B).
    expect(h.ordre).toEqual(["registre", "objection", "verifierCode", "emettre", "signer"]);
    expect(h.emettre.mock.calls[0]![0]).toMatchObject({
      documentGenereId: DOC,
      partie: "sous_traitant",
      acteur: { systeme: "dossier_formateur" },
    });
    expect(h.verifierToken).toHaveBeenCalledWith("JETON.abc");
    expect(h.signer.mock.calls[0]![0]).toMatchObject({
      documentGenereId: DOC,
      porteur: { type: "signataire_jeton", tokenId: "tok-1", partie: "sous_traitant" },
      methode: "confirmation_accessible",
      consentementVersion: "doc-consent-code-v1",
    });
    expect(h.apres.mock.calls[0]![0]).toMatchObject({
      documentGenereId: DOC,
      partie: "sous_traitant",
      acteur: { type: "signataire" },
      sansCopiePartielle: true,
    });
  });

  it("contrat déjà signé par le formateur : rien n'est re-signé (l'envoi du dossier peut reprendre)", async () => {
    h.p.documentGenere.findMany.mockResolvedValue([
      {
        id: DOC,
        metadata: metadataV3(),
        statutSignature: "partielle",
        signatures: [{ partie: "sous_traitant" }],
      },
    ]);
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r).toEqual({ ok: true, documentId: DOC });
    expect(h.signer).not.toHaveBeenCalled();
    expect(h.verifierCode).not.toHaveBeenCalled();
  });

  it("aucun contrat à signer : refus, « recevez d'abord votre code »", async () => {
    h.p.documentGenere.findMany.mockResolvedValue([]);
    const r = await signerContratDuDossier(D, "123456", MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.signer).not.toHaveBeenCalled();
  });
});

describe("envoyerAccuseDossier — F10 avec la copie de la signature", () => {
  it("joint la copie archivée, sur la fiche, une fois par contrat", async () => {
    const r = await envoyerAccuseDossier(D, DOC);
    expect(r).toBe("envoye");
    expect(h.archiver).toHaveBeenCalledWith(DOC, "sous_traitant");
    expect(h.envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-dossier-recu",
      destinataire: D.email,
      entityType: "Trainer",
      entityId: T,
      jobId: `fi-dossier-recu-${T}-${DOC}`,
      attachments: [
        { filename: "contrat.pdf", r2Key: "copies/x.pdf", contentType: "application/pdf" },
      ],
      payload: { prenom: "Camille" },
    });
  });

  it("copie non archivée : F10 ne part pas (il annonce une pièce jointe)", async () => {
    h.archiver.mockResolvedValue({ ok: false, motif: "rendu_impossible" });
    const r = await envoyerAccuseDossier(D, DOC);
    expect(r).toBe("indisponible");
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("F10 parti : aucune copie de repli (pas de second e-mail)", async () => {
    await envoyerAccuseDossier(D, DOC);
    expect(h.copieRepli).not.toHaveBeenCalled();
  });

  it.each(["texte-non-valide", "indisponible", "valeurs-manquantes", "retenu"])(
    "F10 ne part pas (%s) : la copie du moteur commun part en repli",
    async (raison) => {
      h.envoyer.mockResolvedValue(raison);
      const r = await envoyerAccuseDossier(D, DOC);
      expect(r).toBe(raison);
      expect(h.copieRepli).toHaveBeenCalledWith(DOC, "sous_traitant");
    },
  );

  it("copie non archivée : la copie du moteur commun part en repli", async () => {
    h.archiver.mockResolvedValue({ ok: false, motif: "rendu_impossible" });
    await envoyerAccuseDossier(D, DOC);
    expect(h.copieRepli).toHaveBeenCalledWith(DOC, "sous_traitant");
  });

  it("interrupteur `copie_partielle` coupé : pas de repli (comportement du moteur commun)", async () => {
    h.envoyer.mockResolvedValue("texte-non-valide");
    h.etatsSignature.mockResolvedValue({ copie_partielle: false });
    await envoyerAccuseDossier(D, DOC);
    expect(h.copieRepli).not.toHaveBeenCalled();
  });
});
