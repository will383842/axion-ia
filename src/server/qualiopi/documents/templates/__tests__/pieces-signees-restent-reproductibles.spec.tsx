// @vitest-environment node

/**
 * Une pièce DÉJÀ SIGNÉE se re-rend octet pour octet, même après correction du
 * texte de son gabarit.
 *
 * ## Pourquoi ce fichier existe (2026-09-30)
 *
 * L'audit des pièces réelles a relevé des citations juridiques fausses dans
 * quatre gabarits SIGNABLES — convention, convention tripartite, contrat de
 * formation, relevé de connexion (L.6353-2 abrogé depuis le 01/01/2019,
 * L.6353-5 cité pour ce que dit L.6353-6, L.6353-9 invoqué pour la
 * conservation, L.6353-1 pour l'attestation).
 *
 * Les corriger dans le composant courant ne suffisait pas, et aurait même fait
 * pire : `exemplaire-signe.ts` REFUSAIT (`gabarit_modifie`) toute pièce dont la
 * version d'instantané différait de la version courante. Incrémenter la
 * convention aurait rendu l'exemplaire signé de `AXI-DOC-2026-039` (session
 * `AXI-SESS-2026-001`, signée le 04/09) impossible à produire ; ne PAS
 * incrémenter l'aurait réécrit rétroactivement.
 *
 * ➡️ Les versions déjà utilisées sont désormais ARCHIVÉES (`templates/archives/`)
 * et l'exemplaire signé est rendu avec la version portée par la pièce.
 *
 * ## Ce que ce fichier prouve
 *
 *  1. Chaque pièce signée sous une ancienne version se re-rend avec EXACTEMENT
 *     les mêmes octets qu'avant la correction : les empreintes ci-dessous ont
 *     été relevées sur `origin/main` (9941a9673) AVANT toute modification, par
 *     ce même test, horloge figée (le PDF embarque sa date de création).
 *  2. Une pièce générée aujourd'hui porte les citations corrigées.
 *
 * ⛔ Si une empreinte `AVANT_CORRECTION` rougit, NE PAS la mettre à jour : c'est
 * précisément l'exemplaire d'une pièce signée qui vient de changer. Chercher ce
 * qui a bougé (archive, module partagé : `base-layout`, polices, react-pdf).
 */

import { createHash } from "node:crypto";

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
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";

const IDENTITE = {
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

/** Données au plus près de la convention réelle AXI-DOC-2026-039. */
const DATA_CONVENTION = {
  numero: "AXI-DOC-2026-039",
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    contact: "Gérante",
  },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien", "Automatiser des tâches"],
  publicVise: "Dirigeants et collaborateurs",
  dureeHeures: 7,
  dateDebut: "15/09/2026",
  dateFin: "15/09/2026",
  modalite: "Présentiel",
  lieu: "Saint-Étienne",
  effectif: 2,
  prixHt: 1400,
  acomptePercent: 30,
  dateConvention: "04/09/2026",
};

const DATA_TRIPARTITE = {
  ...DATA_CONVENTION,
  numero: "AXI-DOC-2026-040",
  opco: { nom: "OPCO Atlas", numeroPriseEnCharge: "ATLAS-123" },
  montantPrisEnCharge: 1000,
  resteAChargeClient: 400,
};

const DATA_CONTRAT = {
  numero: "AXI-DOC-2026-041",
  stagiaire: { nomPrenom: "Camille Durand", email: "camille@example.fr" },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien"],
  dureeHeures: 14,
  dateDebut: "01/10/2026",
  dateFin: "02/10/2026",
  modalite: "Distanciel",
  lieu: "Distanciel",
  prixNet: 1490,
  dateContrat: "04/09/2026",
};

const DATA_RELEVE = {
  numero: "AXI-DOC-2026-042",
  intituleFormation: "IA pour l'immobilier",
  plateforme: "Google Meet",
  idReunion: "abc-defg-hij",
  date: "15/09/2026",
  horairesSession: "09h00 – 17h00",
  nomFormateur: "Williams Jullin",
  dureeMinimaleRequisePercent: 80,
  participants: [
    {
      nomPrenom: "Camille Durand",
      heureConnexion: "09h02",
      heureDeconnexion: "17h01",
      dureeEffective: "7h59",
      presenceValidee: true,
    },
  ],
};

interface Cas {
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly parties: readonly string[];
  /** Version portée par la pièce signée ; `undefined` = instantané sans version. */
  readonly versionSignee: number | undefined;
  /** SHA-256 de l'exemplaire signé, relevé sur origin/main AVANT la correction. */
  readonly empreinteAvant: string;
}

/**
 * ⛔ Empreintes relevées AVANT la correction — ne jamais les « mettre à jour ».
 *
 * Le contrat de formation n'a jamais porté de version dans son instantané : la
 * table des versions le connaissait sous `contrat_formation` alors que la pièce
 * est de type `contrat` (cf. `gabarit-versions.ts`). Ses pièces signées sont
 * donc lues comme v1 — le texte qu'elles ont réellement sous leur signature.
 */
const AVANT_CORRECTION: readonly Cas[] = [
  {
    type: "convention",
    data: DATA_CONVENTION,
    parties: ["client", "axionia"],
    versionSignee: 2,
    empreinteAvant: "86be6141b2abbb1dd92bf5e009fea95abe5283b8d3bb719b3975967a78a126b0",
  },
  {
    type: "convention_tripartite",
    data: DATA_TRIPARTITE,
    parties: ["client", "financeur", "axionia"],
    versionSignee: 2,
    empreinteAvant: "a394041550b0d755251c209e32bb37a436e5f2162cc1bd2178e8a10b2dc85a8a",
  },
  {
    type: "contrat",
    data: DATA_CONTRAT,
    parties: ["beneficiaire", "axionia"],
    versionSignee: undefined,
    empreinteAvant: "186f4bfc8075141dc8f5acd0a2d4a1701290276b14fe3d46e2e26ac1cb3e2131",
  },
  {
    type: "releve_connexion",
    data: DATA_RELEVE,
    parties: ["formateur", "responsable_pedagogique"],
    versionSignee: 1,
    empreinteAvant: "b41856afd05cf4ef1ca04994e7af6b4e83483853ade63ebf2445f8d41f6d45bf",
  },
];

function lignesSignature(parties: readonly string[]) {
  return parties.map((partie, i) => ({
    partie,
    signataireNom: `Signataire ${partie}`,
    signataireQualite: "Représentant",
    signeAt: new Date(Date.UTC(2026, 8, 4, 21, 15 + i)),
    selfHash: String(i).repeat(64),
    methode: "trace",
    // Pas d'image : le test ne dépend pas de R2.
    signatureKey: null,
    imagePurgeeAt: null,
  }));
}

function metadata(data: Record<string, unknown>, version: number | null | undefined) {
  return {
    renderData: JSON.parse(
      JSON.stringify({
        data,
        identite: IDENTITE,
        ...(typeof version === "number" ? { gabaritVersion: version } : {}),
      }),
    ) as unknown,
  };
}

async function exemplaire(
  cas: Pick<Cas, "type" | "data" | "parties">,
  version: number | null | undefined,
) {
  findUnique.mockResolvedValueOnce({
    numero: cas.data["numero"],
    type: cas.type,
    metadata: metadata(cas.data, version),
    client: null,
    session: null,
  });
  findMany.mockResolvedValueOnce(lignesSignature(cas.parties));
  return rendreExemplaireSigne("doc-id");
}

beforeAll(() => {
  registerPdfTestFontsFallback();
  // Le PDF embarque sa date de création (et son /ID en dérive) : sans horloge
  // figée, deux rendus identiques n'ont jamais le même hash.
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-09-04T21:40:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("🔴 une pièce signée sous une ancienne version se re-rend à l'identique", () => {
  for (const cas of AVANT_CORRECTION) {
    it(`${cas.type} v${cas.versionSignee ?? "(sans version)"} — mêmes octets qu'avant la correction`, async () => {
      const r = await exemplaire(cas, cas.versionSignee);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      const sha = createHash("sha256").update(r.buffer).digest("hex");
      expect(sha).toBe(cas.empreinteAvant);
    }, 60_000);
  }
});

describe("une pièce générée AUJOURD'HUI porte les citations corrigées", () => {
  const CITATIONS_FAUSSES = [
    "L.6353-2",
    "L.6353-9",
    "Attestation de fin de formation (article L.6353-1)",
    "remise à l'issue de l'action (article L.6353-1)",
    "retenue ni exigée du stagiaire (article L.6353-5",
  ];

  const COURANTS: ReadonlyArray<{
    type: string;
    data: Record<string, unknown>;
    attendu: string[];
  }> = [
    {
      type: "convention",
      data: DATA_CONVENTION,
      attendu: [
        "Établie conformément aux articles L.6353-1 et D.6353-1 du Code du travail.",
        "dernier alinéa de l'article L.6313-7",
      ],
    },
    {
      type: "convention_tripartite",
      data: DATA_TRIPARTITE,
      attendu: [
        "Établie conformément aux articles L.6353-1 et D.6353-1 du Code du travail.",
        "dernier alinéa de l'article L.6313-7",
      ],
    },
    {
      type: "contrat",
      data: DATA_CONTRAT,
      attendu: [
        "dernier alinéa de l'article L.6313-7",
        "retenue ni exigée du stagiaire (article L.6353-6",
      ],
    },
    {
      type: "releve_connexion",
      data: DATA_RELEVE,
      attendu: ["Document à conserver 5 ans."],
    },
  ];

  for (const cas of COURANTS) {
    it(`${cas.type} — texte courant corrigé, et son exemplaire signé se rend`, async () => {
      const { collectPdfTextNormalized } =
        await import("@/server/qualiopi/documents/collect-pdf-text");
      const { composantGabarit } =
        await import("@/server/qualiopi/documents/signature/exemplaire-signe");
      const version = versionGabaritCourante(cas.type);
      expect(version, `${cas.type} doit être versionné`).not.toBeNull();
      const Composant = composantGabarit(cas.type, version as number);
      expect(Composant).not.toBeNull();
      const React = await import("react");
      const texte = collectPdfTextNormalized(
        React.createElement(Composant!, { data: cas.data as never, identite: IDENTITE as never }),
      );
      for (const a of cas.attendu) expect(texte).toContain(a);
      for (const f of CITATIONS_FAUSSES) expect(texte).not.toContain(f);

      // Comme `documents-service.ts` : la version courante dans l'instantané.
      const r = await exemplaire({ ...cas, parties: ["axionia"] }, version);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
    }, 60_000);
  }

  it("les pièces retouchées ont changé de version (sinon l'archive ne serait jamais lue)", () => {
    expect(versionGabaritCourante("convention")).toBe(3);
    expect(versionGabaritCourante("convention_tripartite")).toBe(3);
    expect(versionGabaritCourante("contrat_formation")).toBe(2);
    expect(versionGabaritCourante("releve_connexion")).toBe(2);
  });

  it("🔴 la pièce de type `contrat` (nom de l'énumération) est bien versionnée", () => {
    // La table la connaissait sous `contrat_formation` ; `documents-service.ts`
    // et `exemplaire-signe.ts` l'interrogent avec `contrat` → `null` : aucune
    // version écrite, aucune garde. Toute retouche du contrat réécrivait donc
    // en silence les exemplaires déjà signés.
    expect(versionGabaritCourante("contrat")).toBe(versionGabaritCourante("contrat_formation"));
  });

  it("une version ni courante ni archivée reste REFUSÉE — on ne reconstitue pas un texte perdu", async () => {
    // Convention v1 (d'avant le 16/08) : jamais archivée.
    const r = await exemplaire(
      { type: "convention", data: DATA_CONVENTION, parties: ["client"] },
      undefined,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe("gabarit_modifie");
  });
});
