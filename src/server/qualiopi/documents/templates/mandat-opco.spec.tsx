/**
 * Tests — template PDF du mandat OPCO (INT-T66-A, REQ-JUR-061).
 *
 * Les témoins portent sur le TEXTE que lit l'entreprise, pas seulement sur le
 * « %PDF » du buffer : un mandat qui oublierait de se dire révocable, ou qui
 * laisserait croire à un pouvoir d'encaisser, passerait un test de magic bytes.
 */

import { createHash } from "node:crypto";
import React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => findUnique(...a) },
    documentSignature: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { MENTION_PLAFOND_CANAL_MAISON } from "@/server/qualiopi/documents/signature/mentions-document";
import {
  circuitPour,
  partiesRequisesPour,
} from "@/server/qualiopi/documents/signature/parties-requises";
import { libelleTypeDocument } from "@/server/qualiopi/documents/libelles-type-document";
import { versionGabaritCourante } from "./gabarit-versions";
import { MandatOpcoPdf, type MandatOpcoData } from "./mandat-opco";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "FR-2026-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const DATA: MandatOpcoData = {
  numero: "AXI-DOC-2026-120",
  entreprise: {
    raisonSociale: "Menuiserie Durand SARL",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    representant: "Claire Durand",
    qualiteRepresentant: "Gérante",
  },
  opco: { nom: "OPCO EP" },
  action: {
    intitule: "IA générative pour l'artisanat",
    dateDebut: "12/11/2026",
    dateFin: "13/11/2026",
    dureeHeures: 14,
    stagiaires: ["Camille Durand", "Lucas Martin"],
    numeroConvention: "AXI-DOC-2026-119",
  },
  dateMandat: "04/10/2026",
};

function texte(data: MandatOpcoData = DATA): string {
  return collectPdfTextNormalized(React.createElement(MandatOpcoPdf, { data, identite: IDENTITE }));
}

beforeAll(() => {
  registerPdfTestFontsFallback();
  // Le PDF embarque sa date de création (et son /ID en dérive) : sans horloge
  // figée, deux rendus identiques n'ont jamais les mêmes octets.
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("MandatOpcoPdf — le texte que lit l'entreprise", () => {
  it("rend un PDF valide (%PDF)", async () => {
    const { buffer } = await renderPdfToBuffer(<MandatOpcoPdf data={DATA} identite={IDENTITE} />);
    expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
  }, 30_000);

  it("se dit SPÉCIAL, LIMITÉ et RÉVOCABLE à tout moment par écrit", () => {
    const t = texte();
    expect(t).toContain("Mandat spécial");
    expect(t).toContain("mandat spécial d'accomplir");
    expect(t).toContain("Le mandat est limité à");
    expect(t).toContain("révocable");
    expect(t).toContain("peut révoquer le mandat à tout moment, sans motif, par écrit");
  });

  it("🔴 exclut TOUT pouvoir de recevoir des fonds, et ne vaut pas subrogation", () => {
    const t = texte();
    expect(t).toContain("ne confère aucun pouvoir de recevoir des fonds");
    expect(t).toContain("ni recevoir, ni encaisser, ni percevoir aucune somme");
    expect(t).toContain("ne vaut pas subrogation de paiement");
  });

  it("désigne l'action : formation, dates, stagiaires, OPCO", () => {
    const t = texte();
    expect(t).toContain("IA générative pour l'artisanat");
    expect(t).toContain("12/11/2026");
    expect(t).toContain("13/11/2026");
    expect(t).toContain("Camille Durand");
    expect(t).toContain("Lucas Martin");
    expect(t).toContain("OPCO EP");
    expect(t).toContain("n° AXI-DOC-2026-119");
  });

  it("n'engage l'organisme au-delà du dépôt : ni résultat, ni délai garantis", () => {
    const t = texte();
    expect(t).toContain(
      "ne garantit ni l'accord de l'OPCO, ni le montant pris en charge, ni le délai",
    );
    // Contre-témoins : aucune formule de promesse ne doit s'être glissée.
    expect(t).not.toMatch(/sous \d+ jours/);
    expect(t).not.toContain("garantit l'obtention");
  });

  it("interdit la substitution — un apporteur ne tient aucun pouvoir de cette pièce", () => {
    expect(texte()).toContain(
      "ne peut se substituer aucune autre personne, notamment un apporteur",
    );
  });

  it("porte une SignatureZone à deux parties et la mention du plafond du canal maison", () => {
    const t = texte();
    expect(t).toContain("Le mandant");
    expect(t).toContain("Le mandataire, pour acceptation");
    expect(t).toContain("Fait à");
    expect(t).toContain(MENTION_PLAFOND_CANAL_MAISON);
  });

  it("un stagiaire seul s'accorde au singulier", () => {
    const t = texte({ ...DATA, action: { ...DATA.action, stagiaires: ["Camille Durand"] } });
    expect(t).toContain("Stagiaire concerné :");
    expect(t).not.toContain("Stagiaires concernés :");
  });
});

describe("mandat OPCO — circuit, libellé, version", () => {
  it("le circuit du mandat est `maison`, client puis organisme", () => {
    expect(circuitPour("mandat_opco")?.canal).toBe("maison");
    expect(partiesRequisesPour("mandat_opco")).toStrictEqual(["client", "axionia"]);
  });

  it("le libellé du registre existe", () => {
    expect(libelleTypeDocument("mandat_opco")).toBe("Mandat OPCO");
  });

  it("le gabarit est versionné (v1)", () => {
    expect(versionGabaritCourante("mandat_opco")).toBe(1);
  });
});

describe("🔴 l'exemplaire signé du mandat se rejoue à l'octet", () => {
  function lignesSignature() {
    return (["client", "axionia"] as const).map((partie, i) => ({
      partie,
      signataireNom: partie === "client" ? "Claire Durand" : "Williams Jullin",
      signataireQualite: partie === "client" ? "Gérante" : "Président",
      signeAt: new Date(Date.UTC(2026, 9, 4, 9, 15 + i)),
      selfHash: String(i + 1).repeat(64),
      methode: "trace",
      // Pas d'image : le test ne dépend pas de R2.
      signatureKey: null,
      imagePurgeeAt: null,
    }));
  }

  async function exemplaire() {
    findUnique.mockResolvedValueOnce({
      numero: DATA.numero,
      type: "mandat_opco",
      metadata: {
        renderData: JSON.parse(
          JSON.stringify({ data: DATA, identite: IDENTITE, gabaritVersion: 1 }),
        ) as unknown,
      },
      client: { raisonSociale: DATA.entreprise.raisonSociale },
      session: null,
    });
    findMany.mockResolvedValueOnce(lignesSignature());
    return rendreExemplaireSigne("doc-id");
  }

  it("deux rejouements du même instantané rendent les mêmes octets", async () => {
    const a = await exemplaire();
    const b = await exemplaire();
    expect(a.ok, a.ok ? "" : a.message).toBe(true);
    expect(b.ok, b.ok ? "" : b.message).toBe(true);
    if (!a.ok || !b.ok) return;
    const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
    expect(sha(a.buffer)).toBe(sha(b.buffer));
    expect(a.buffer.subarray(0, 5).toString()).toContain("%PDF");
  }, 60_000);

  it("l'exemplaire signé porte les preuves des deux parties", () => {
    const t = collectPdfTextNormalized(
      React.createElement(MandatOpcoPdf, {
        data: {
          ...DATA,
          signatures: {
            client: {
              signataireNom: "Claire Durand",
              signataireQualite: "Gérante",
              signeAtLisible: "04/10/2026 11:15",
              empreinte: "1".repeat(64),
              methode: "trace",
              imageSrc: null,
            },
            axionia: {
              signataireNom: "Williams Jullin",
              signataireQualite: "Président",
              signeAtLisible: "04/10/2026 11:16",
              empreinte: "2".repeat(64),
              methode: "trace",
              imageSrc: null,
            },
          },
        },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("Signé le 04/10/2026 11:15");
    expect(t).toContain("Signé le 04/10/2026 11:16");
    expect(t).toContain(`Empreinte : ${"1".repeat(64)}`);
  });
});
