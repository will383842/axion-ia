import { beforeEach, describe, expect, it, vi } from "vitest";

// Les dépendances serveur de `signature.ts` sont remplacées : on teste les règles et
// l'enchaînement, pas Prisma, R2 ni le rendu PDF.
const lireDossierParLien = vi.fn();
const enregistrerDeclarations = vi.fn();
const envoyer = vi.fn();
const uploadToR2 = vi.fn();
const updateMany = vi.fn();
const rendreContratPdf = vi.fn();

vi.mock("../donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => lireDossierParLien(...a),
  enregistrerDeclarations: (...a: unknown[]) => enregistrerDeclarations(...a),
}));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
vi.mock("@/lib/r2-storage", () => ({ uploadToR2: (...a: unknown[]) => uploadToR2(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { updateMany: (...a: unknown[]) => updateMany(...a) } },
}));
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: (v: Record<string, string>) => `CONTRAT ${JSON.stringify(v)}`,
    empreinte: (t: string) => createHash("sha256").update(t, "utf8").digest("hex"),
    rendreContratPdf: (...a: unknown[]) => rendreContratPdf(...a),
  };
});

import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
  casesCompletes,
  cleContratApporteur,
  etatDeLaPage,
  manquesDuDossier,
  nomTapeCorrespond,
  piecesDeposables,
  resumerNavigateur,
  signerContrat,
  typesDeposes,
  valeursDuContrat,
  verifierAvantSignature,
  type SignatureApporteurJson,
} from "../signature";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

function dossierComplet(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    statut: "dossier_en_cours",
    prenom: "Éloïse",
    nom: "Lefèvre",
    email: "e@exemple.fr",
    siren: "732829320",
    adresse: "1 rue des Alpes 38000 Grenoble",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    numeroTva: null,
    ibanSaisi: true,
    pieces: [
      { type: "identite", statut: "deposee" },
      { type: "rib", statut: "conforme" },
    ],
    ...over,
  };
}

describe("dossier en ligne — nom tapé", () => {
  it("accepte le prénom et le nom sans accents ni casse, dans un ordre ou l'autre", () => {
    expect(nomTapeCorrespond("eloise lefevre", "Éloïse", "Lefèvre")).toBe(true);
    expect(nomTapeCorrespond("  LEFEVRE   Éloïse ", "Éloïse", "Lefèvre")).toBe(true);
    expect(nomTapeCorrespond("Jean-Marc D'Arc", "Jean Marc", "d’Arc")).toBe(true);
  });

  it("refuse un autre nom, un nom partiel ou vide", () => {
    expect(nomTapeCorrespond("Éloïse", "Éloïse", "Lefèvre")).toBe(false);
    expect(nomTapeCorrespond("Éloïse Martin", "Éloïse", "Lefèvre")).toBe(false);
    expect(nomTapeCorrespond("", "Éloïse", "Lefèvre")).toBe(false);
    expect(nomTapeCorrespond("Éloïse", "Éloïse", "")).toBe(false);
  });
});

describe("dossier en ligne — cases obligatoires", () => {
  it("4 déclarations et 6 acceptations, toutes exigées", () => {
    expect(CLES_DECLARATIONS).toHaveLength(4);
    expect(CLES_ACCEPTATIONS).toHaveLength(6);
    expect(casesCompletes(CLES_DECLARATIONS, CLES_ACCEPTATIONS)).toBe(true);
    expect(casesCompletes(CLES_DECLARATIONS.slice(1), CLES_ACCEPTATIONS)).toBe(false);
    expect(casesCompletes(CLES_DECLARATIONS, CLES_ACCEPTATIONS.slice(0, 5))).toBe(false);
  });

  it("une clé inconnue ou un doublon ne remplacent pas une case manquante", () => {
    const presque = [...CLES_ACCEPTATIONS.slice(0, 5), CLES_ACCEPTATIONS[0]!, "inventee"];
    expect(casesCompletes(CLES_DECLARATIONS, presque)).toBe(false);
  });
});

describe("dossier en ligne — règles d'état", () => {
  it("chaque statut donne son écran", () => {
    expect(etatDeLaPage("dossier_en_cours")).toBe("modifiable");
    expect(etatDeLaPage("a_completer")).toBe("modifiable");
    expect(etatDeLaPage("a_verifier")).toBe("a_verifier");
    expect(etatDeLaPage("signe")).toBe("signe");
    expect(etatDeLaPage("refuse")).toBe("neutre");
    expect(etatDeLaPage("resilie")).toBe("neutre");
  });

  it("pièces déposables : celles du dossier avant signature, la vigilance après", () => {
    expect(piecesDeposables("modifiable")).toEqual(["identite", "rib", "rc_pro"]);
    expect(piecesDeposables("signe")).toEqual(["vigilance", "immatriculation"]);
    expect(piecesDeposables("a_verifier")).toEqual([]);
    expect(piecesDeposables("neutre")).toEqual([]);
  });

  it("une pièce à retransmettre ne compte pas comme déposée", () => {
    expect(
      typesDeposes([
        { type: "identite", statut: "a_retransmettre" },
        { type: "rib", statut: "deposee" },
      ]),
    ).toEqual(["rib"]);
    const d = dossierComplet({
      pieces: [
        { type: "identite", statut: "a_retransmettre" },
        { type: "rib", statut: "deposee" },
      ],
    });
    expect(manquesDuDossier(d as never)).toEqual(["pièce d'identité"]);
  });

  it("contrôle complet : statut, manques, cases, nom — dans cet ordre", () => {
    const base = {
      statut: "dossier_en_cours" as const,
      manques: [] as string[],
      declarations: CLES_DECLARATIONS,
      acceptations: CLES_ACCEPTATIONS,
      nomTape: "Éloïse Lefèvre",
      prenom: "Éloïse",
      nom: "Lefèvre",
    };
    expect(verifierAvantSignature(base)).toEqual({ ok: true });
    expect(verifierAvantSignature({ ...base, statut: "a_completer" })).toEqual({ ok: true });
    expect(verifierAvantSignature({ ...base, statut: "a_verifier" })).toEqual({
      ok: false,
      refus: "non_modifiable",
    });
    expect(verifierAvantSignature({ ...base, statut: "signe" })).toEqual({
      ok: false,
      refus: "non_modifiable",
    });
    expect(verifierAvantSignature({ ...base, manques: ["votre IBAN"] })).toEqual({
      ok: false,
      refus: "incomplet",
    });
    expect(verifierAvantSignature({ ...base, acceptations: [] })).toEqual({
      ok: false,
      refus: "cases",
    });
    expect(verifierAvantSignature({ ...base, nomTape: "Quelqu'un" })).toEqual({
      ok: false,
      refus: "nom",
    });
  });
});

describe("dossier en ligne — valeurs du contrat", () => {
  it("identité = prénom + NOM, siège = adresse, qualité selon le statut, date en français", () => {
    const v = valeursDuContrat(dossierComplet() as never, new Date("2026-10-05T10:00:00Z"));
    expect(v).toEqual({
      identite: "Éloïse LEFÈVRE",
      statutJuridique: "micro_entrepreneur",
      siren: "732829320",
      siege: "1 rue des Alpes 38000 Grenoble",
      qualite: "entrepreneur individuel",
      grilleDate: "5 octobre 2026",
    });
    expect(
      valeursDuContrat(dossierComplet({ statutJuridique: "sas" }) as never, new Date()).qualite,
    ).toBe("société commerciale");
  });

  it("clé R2 et navigateur résumé", () => {
    expect(cleContratApporteur(ID, "abcdef0123456789")).toBe(
      `apporteurs/${ID}/contrat-v2-apporteur-abcdef01.pdf`,
    );
    expect(
      resumerNavigateur(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome sur Android");
    expect(resumerNavigateur(null)).toBeNull();
  });
});

describe("dossier en ligne — signerContrat", () => {
  const entree = {
    apporteurId: ID,
    jeton: JETON,
    nomTape: "eloise lefevre",
    declarations: [...CLES_DECLARATIONS],
    acceptations: [...CLES_ACCEPTATIONS],
    ipHash: "0123456789abcdef",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1",
    maintenant: new Date("2026-10-05T12:34:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rendreContratPdf.mockResolvedValue(Buffer.from("%PDF"));
    uploadToR2.mockResolvedValue({ key: "k", etag: null, sizeBytes: 4 });
    updateMany.mockResolvedValue({ count: 1 });
    envoyer.mockResolvedValue("envoye");
  });

  it("refuse un lien invalide sans rien écrire", async () => {
    lireDossierParLien.mockResolvedValue(null);
    const r = await signerContrat(entree);
    expect(r).toMatchObject({ ok: false, raison: "introuvable" });
    expect(uploadToR2).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("refuse un dossier déjà à vérifier, une case manquante ou un mauvais nom", async () => {
    lireDossierParLien.mockResolvedValue(dossierComplet({ statut: "a_verifier" }));
    expect(await signerContrat(entree)).toMatchObject({ ok: false, raison: "refus" });
    lireDossierParLien.mockResolvedValue(dossierComplet());
    expect(
      await signerContrat({ ...entree, acceptations: CLES_ACCEPTATIONS.slice(1) }),
    ).toMatchObject({ ok: false });
    expect(await signerContrat({ ...entree, nomTape: "Autre Personne" })).toMatchObject({
      ok: false,
    });
    lireDossierParLien.mockResolvedValue(dossierComplet({ ibanSaisi: false }));
    expect(await signerContrat(entree)).toMatchObject({ ok: false });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("signe : PDF sur R2, écriture conditionnée au statut, valeurs gardées, alerte interne", async () => {
    lireDossierParLien.mockResolvedValue(dossierComplet());
    const r = await signerContrat(entree);
    expect(r.ok).toBe(true);
    const sha = r.ok ? r.sha256 : "";

    expect(rendreContratPdf.mock.calls[0]![0]).toMatchObject({
      societe: null,
      apporteur: {
        nomTape: "eloise lefevre",
        navigateur: "Safari sur iPhone",
        ipHash: "0123456789abcdef",
      },
    });
    expect(uploadToR2.mock.calls[0]![0]).toBe(
      `apporteurs/${ID}/contrat-v2-apporteur-${sha.slice(0, 8)}.pdf`,
    );

    const arg = updateMany.mock.calls[0]![0] as {
      where: { statut: { in: string[] } };
      data: { statut: string; contratSha256: string; signatureApporteur: SignatureApporteurJson };
    };
    expect(arg.where.statut.in).toEqual(["dossier_en_cours", "a_completer"]);
    expect(arg.data.statut).toBe("a_verifier");
    expect(arg.data.contratSha256).toBe(sha);
    const s = arg.data.signatureApporteur;
    expect(s.texteSha256).toBe(sha);
    expect(s.signeAt).toBe("2026-10-05T12:34:00.000Z");
    expect(s.valeurs.identite).toBe("Éloïse LEFÈVRE");
    expect(s.declarations).toEqual([...CLES_DECLARATIONS]);
    expect(s.acceptations).toEqual([...CLES_ACCEPTATIONS]);

    expect(enregistrerDeclarations).toHaveBeenCalledWith(ID, [...CLES_DECLARATIONS]);
    expect(envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "apporteur-dossier-a-verifier",
      jobId: `apporteur-dossier-a-verifier-${ID}-${sha.slice(0, 8)}`,
      payload: { contactName: "Éloïse Lefèvre" },
    });
  });

  it("deux signatures simultanées : la seconde ne réécrit rien et n'alerte pas", async () => {
    lireDossierParLien.mockResolvedValue(dossierComplet());
    updateMany.mockResolvedValue({ count: 0 });
    expect(await signerContrat(entree)).toMatchObject({ ok: false, raison: "refus" });
    expect(enregistrerDeclarations).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});
