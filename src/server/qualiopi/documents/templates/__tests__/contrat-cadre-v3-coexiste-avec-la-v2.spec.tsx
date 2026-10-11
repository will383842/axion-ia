// @vitest-environment node

/**
 * Lot L7a — la v3 du contrat-cadre est ARRÊTÉE sans rien changer à ce qui part.
 *
 *  · la version émise par défaut reste la v2 : les organismes reçoivent
 *    exactement ce qu'ils recevaient (livré ÉTEINT) ;
 *  · une pièce v2 déjà signée se rejoue avec la v2, une pièce v3 avec la v3 ;
 *  · une version ni courante, ni archivée, ni arrêtée reste refusée, à
 *    l'émission comme à la remise de l'exemplaire ;
 *  · le texte d'une version arrêtée ne change jamais en place.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import {
  composantGabarit,
  rendreExemplaireSigne,
} from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { ContratCadrePdf } from "@/server/qualiopi/documents/templates/contrat-cadre";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";
import {
  VERSIONS_ARRETEES,
  derniereVersionArretee,
  verifierVersionDuComposant,
  versionArretee,
  versionGabaritAEcrire,
} from "@/server/qualiopi/documents/templates/versions-arretees";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84000000000",
  qualiopi: "",
  siret: "12345678900011",
  adresseSiege: "1 rue de la Formation, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Formation, 42000 Saint-Étienne",
  email: "contact@exemple.fr",
  telephone: "",
  site: "https://www.exemple.fr",
  representantLegalNom: "Camille Martin",
  representantLegalQualite: "Présidente",
  capitalSocial: "1 000 €",
  rcsVille: "Saint-Étienne",
  siren: "123456789",
};

const DATA_V2 = {
  numero: "AXI-DOC-2026-901",
  sousTraitant: { nom: "Formations Leroy", siret: "11122233300014" },
  missions: ["Animer les modules IA générative"],
  dateDebut: "01/11/2026",
  remuneration: "350 € HT par journée",
  dateContrat: "12/10/2026",
};

const DATA_V3 = {
  numero: "AXI-DOC-2026-902",
  nature: "independant",
  cocontractant: {
    prenomNom: "Alex Durand",
    siret: "98765432100017",
    adresse: "5 chemin des Tilleuls, 69001 Lyon",
    numeroDeclaration: null,
    tvaIntracom: null,
    email: "alex@exemple.fr",
  },
  mandatAutofacturation: true,
  axion: { regionDeclaration: "Auvergne-Rhône-Alpes", adresseFormateurs: "formateurs@exemple.fr" },
  dateContrat: "12/10/2026",
};

function exemplaire(data: Record<string, unknown>, version: number) {
  findUnique.mockResolvedValueOnce({
    numero: data["numero"],
    type: "contrat_sous_traitance",
    metadata: {
      renderData: JSON.parse(
        JSON.stringify({ data, identite: IDENTITE, gabaritVersion: version }),
      ) as unknown,
    },
    client: null,
    session: null,
  });
  findMany.mockResolvedValueOnce(
    ["sous_traitant", "axionia"].map((partie, i) => ({
      partie,
      signataireNom: `Signataire ${partie}`,
      signataireQualite: null,
      signeAt: new Date(Date.UTC(2026, 9, 12, 9, i)),
      selfHash: String(i).repeat(64),
      methode: "trace",
      signatureKey: null,
      imagePurgeeAt: null,
    })),
  );
  return rendreExemplaireSigne("doc-id");
}

beforeAll(() => {
  registerPdfTestFontsFallback();
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-12T09:30:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("L7a — la v3 est arrêtée, la v2 reste émise par défaut", () => {
  it("la v3 du contrat-cadre est arrêtée au 10/10/2026", () => {
    expect(versionArretee("contrat_sous_traitance", 3)).toBe(true);
    expect(VERSIONS_ARRETEES.contrat_sous_traitance?.[3]?.arreteeLe).toBe("2026-10-10");
    expect(derniereVersionArretee("contrat_sous_traitance")).toBe(3);
  });

  it("🔴 livré ÉTEINT : la version émise par défaut reste la v2", () => {
    expect(versionGabaritCourante("contrat_sous_traitance")).toBe(2);
    expect(versionGabaritAEcrire("contrat_sous_traitance")).toBe(2);
    expect(versionGabaritAEcrire("convention")).toBe(versionGabaritCourante("convention"));
  });

  it("l'émetteur peut demander la v3, et seulement une version courante ou arrêtée", () => {
    expect(versionGabaritAEcrire("contrat_sous_traitance", 3)).toBe(3);
    expect(versionGabaritAEcrire("contrat_sous_traitance", 2)).toBe(2);
    expect(() => versionGabaritAEcrire("contrat_sous_traitance", 4)).toThrow(/émission refusée/);
    expect(() => versionGabaritAEcrire("contrat_sous_traitance", 1)).toThrow(/émission refusée/);
    expect(() => versionGabaritAEcrire("convention", 3)).toThrow(/émission refusée/);
    expect(versionGabaritAEcrire("attestation", 3)).toBeNull();
  });

  it("la lettre de mission n'a encore aucune version arrêtée (lot de la lettre)", () => {
    expect(derniereVersionArretee("lettre_mission")).toBeNull();
  });

  it("documents-service inscrit la version demandée, validée avant le numéro", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "documents", "documents-service.ts"),
      "utf8",
    );
    const validation = source.indexOf(
      "const gabaritVersion = versionGabaritAEcrire(input.type, input.gabaritVersion);",
    );
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(source.indexOf("await nextNumero("));
    expect(source).not.toContain("versionGabaritCourante(");
  });
});

describe("L7a — chaque exemplaire signé se rejoue avec SA version", () => {
  it("v2 → composant v2 ; v3 → composant v3 ; v4 et v1 → aucun", () => {
    expect(composantGabarit("contrat_sous_traitance", 2)).toBe(ContratSousTraitancePdf);
    expect(composantGabarit("contrat_sous_traitance", 3)).toBe(ContratCadrePdf);
    expect(composantGabarit("contrat_sous_traitance", 4)).toBeNull();
    expect(composantGabarit("contrat_sous_traitance", 1)).toBeNull();
  });

  it("un contrat v2 signé se rend toujours, avec son texte", async () => {
    const r = await exemplaire(DATA_V2, 2);
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
  }, 60_000);

  it("un contrat v3 signé se rend avec le texte v3", async () => {
    const r = await exemplaire(DATA_V3, 3);
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
  }, 60_000);

  it("une version inconnue est refusée, jamais rendue approchée", async () => {
    const r = await exemplaire(DATA_V3, 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe("gabarit_modifie");
  }, 60_000);
});

/**
 * ⛔ Le texte d'une version ARRÊTÉE ne change jamais en place : une retouche est
 * une nouvelle version, arrêtée à son tour. Mêmes règles de mesure que
 * `gabarit-empreinte.spec.ts` (commentaires retirés, espaces normalisés).
 */
const EMPREINTES_ARRETEES: Readonly<Record<string, string>> = {
  "contrat-cadre.tsx": "4b20c6f75447e7b8dccaaaf78be0db0c95aad7d7d275a0e6edde5ed119db76d0",
};

function texteMesurable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("⛔ le texte d'une version arrêtée ne change pas", () => {
  it("chaque version arrêtée a son empreinte figée, et réciproquement", () => {
    const inscrits = Object.values(VERSIONS_ARRETEES).flatMap((parVersion) =>
      Object.values(parVersion ?? {}).map((v) => v.fichier),
    );
    expect(inscrits.sort()).toEqual(Object.keys(EMPREINTES_ARRETEES).sort());
  });

  it("aucun fichier arrêté n'a changé", () => {
    for (const [fichier, sha] of Object.entries(EMPREINTES_ARRETEES)) {
      const source = readFileSync(
        join(process.cwd(), "src", "server", "qualiopi", "documents", "templates", fichier),
        "utf8",
      );
      const mesure = createHash("sha256").update(texteMesurable(source), "utf8").digest("hex");
      expect(mesure, `${fichier} a changé : une retouche est une NOUVELLE version`).toBe(sha);
    }
  });

  it("une version arrêtée est toujours AU-DESSUS de la version émise par défaut", () => {
    for (const [type, parVersion] of Object.entries(VERSIONS_ARRETEES)) {
      for (const v of Object.keys(parVersion ?? {}).map(Number)) {
        expect(v, type).toBeGreaterThan(versionGabaritCourante(type) ?? Infinity);
      }
    }
  });
});

describe("L7a — la version inscrite suit le composant rendu", () => {
  it("composant v3 + version 3 : accepté ; composant v2 + version 2 : accepté", () => {
    expect(() =>
      verifierVersionDuComposant("contrat_sous_traitance", ContratCadrePdf, 3),
    ).not.toThrow();
    expect(() =>
      verifierVersionDuComposant("contrat_sous_traitance", ContratSousTraitancePdf, 2),
    ).not.toThrow();
  });

  it("🔴 composant v3 inscrit en v2, ou v3 inscrite sur le composant v2 : refusé", () => {
    expect(() => verifierVersionDuComposant("contrat_sous_traitance", ContratCadrePdf, 2)).toThrow(
      /émission refusée/,
    );
    expect(() =>
      verifierVersionDuComposant("contrat_sous_traitance", ContratSousTraitancePdf, 3),
    ).toThrow(/émission refusée/);
  });

  it("les autres types ne sont pas concernés", () => {
    expect(() => verifierVersionDuComposant("convention", ContratCadrePdf, 5)).not.toThrow();
    expect(() => verifierVersionDuComposant("attestation", ContratCadrePdf, null)).not.toThrow();
  });

  it("documents-service vérifie avant le rendu", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "documents", "documents-service.ts"),
      "utf8",
    );
    const verif = source.indexOf(
      "verifierVersionDuComposant(input.type, elementToRender.type, gabaritVersion);",
    );
    expect(verif).toBeGreaterThan(-1);
    expect(verif).toBeLessThan(source.indexOf("await renderPdfToBuffer(elementToRender)"));
  });
});
