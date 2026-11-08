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

// V8-P0 : le consentement de captation ne se rend que « allumé » ; on l'allume pour son cas.
vi.mock("@/server/qualiopi/documents/signature/interrupteur-captation", () => ({
  allumageExemplaireCaptation: async () => new Date(0),
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
  // INT-T65-A (04/10/2026) — la v4 des deux conventions est archivée par le
  // passage en v5 (clause de condition suspensive OPCO). Empreintes relevées
  // par ce même test sur la tête de `opco/int-t65-a-condition-suspensive` À JOUR
  // DE MAIN et AVANT la retouche des gabarits, la v4 étant alors courante.
  {
    type: "convention",
    data: DATA_CONVENTION,
    parties: ["client", "axionia"],
    versionSignee: 4,
    empreinteAvant: "37bd68dbd4f920038afbabe497a85f072467c4e4911313829cb83b6c1180788c",
  },
  {
    type: "convention_tripartite",
    data: DATA_TRIPARTITE,
    parties: ["client", "financeur", "axionia"],
    versionSignee: 4,
    empreinteAvant: "7407ec141571e9f5aa39898f219718ce5691a28350ef7a9cb2f814f293464404",
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
    expect(versionGabaritCourante("convention")).toBe(6);
    expect(versionGabaritCourante("convention_tripartite")).toBe(6);
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

// ════════════════════════════════════════════════════════════════════════════
// V8-P0 (2026-11-08) — GEL DE LA CHARTE À LA SOURCE : octets relevés AVANT.
//
// Relevés sur l'état de `brand-2027` AVANT tout changement de code (`brand-tokens.ts`
// n'avait pas encore été repointé vers la copie gelée), horloge figée. Un cas par type de
// pièce signable et par version. ⛔ Rouge = annuler le changement, jamais « mettre à jour ».
// ════════════════════════════════════════════════════════════════════════════

const LIGNES_DEVIS = [
  { designation: "Formation IA appliquée — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
];
const DATA_DEVIS = {
  numero: "AXI-DEV-2026-001",
  dateEmission: "06/06/2026",
  dateValidite: "06/07/2026",
  refClient: "BC-2026-042",
  identite: IDENTITE,
  client: {
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: "10 avenue des Champs, 75008 Paris",
  },
  lignes: LIGNES_DEVIS,
  regimeTva: "assujetti",
};
const LIGNE_F = {
  designation: "Agent IA sur mesure",
  quantite: 1,
  prixUnitaireHtCents: 500000,
  tauxTvaPercent: 20,
  totalHtCents: 500000,
};
const FORMULES = {
  formules: [
    {
      formule: "achat",
      titre: "Formule A · Achat",
      lignes: [LIGNE_F],
      options: [],
      totalHtCents: 500000,
      totalTvaCents: 100000,
      totalTtcCents: 600000,
      phases: [
        {
          rang: 1,
          libelle: "Acompte",
          pourcentage: 30,
          declencheur: "À la signature",
          montantHtCents: 150000,
        },
      ],
      abonnement: null,
      maintenance: null,
      hebergementMensuelHtCents: null,
    },
    {
      formule: "abonnement",
      titre: "Formule B · Mise en place + abonnement",
      lignes: [{ ...LIGNE_F, totalHtCents: 200000, prixUnitaireHtCents: 200000 }],
      options: [],
      totalHtCents: 200000,
      totalTvaCents: 40000,
      totalTtcCents: 240000,
      phases: [],
      abonnement: {
        mensuelCatalogueHtCents: 30000,
        tauxTvaPercent: 20,
        terme: "a_echoir",
        modeAvance: "mensuel",
        periodes: [
          { mois: 12, remisePercent: 0, mensuelNetHtCents: 30000, prixPeriodeHtCents: 360000 },
        ],
        engagementMois: 12,
        reconduction: "tacite",
        preavisMois: 1,
        indemniteSortieMaxHtCents: null,
        indemniteSortieTauxPercent: 0,
      },
      maintenance: null,
      hebergementMensuelHtCents: null,
    },
  ],
  servicesTiers: [],
  plafondAConfirmer: null,
  garantieJours: 30,
  textes: ["Prérequis : accès aux outils du client."],
};
const DATA_SOUS_TRAITANCE = {
  numero: "AXI-DOC-2026-071",
  sousTraitant: { nom: "Externe Formation SARL", siret: "98765432100011" },
  missions: ["Animer les modules IA générative"],
  dateDebut: "01/09/2026",
  remuneration: "850 € HT par journée",
  dateContrat: "02/08/2026",
};
const DATA_TRAVAIL = {
  numero: "AXI-DOC-2026-080",
  salarie: {
    nom: "Durand",
    prenom: "Camille",
    dateNaissance: "01/02/1990",
    lieuNaissance: "Lyon",
    adresse: "3 rue des Lilas, 42000 Saint-Étienne",
  },
  type: "cdi",
  dateEmbauche: "01/10/2026",
  poste: "Formatrice",
  classification: "Niveau 3",
  dureeHebdoHeures: "35",
  lieuTravail: "Saint-Étienne",
  periodeEssai: null,
  remunerationMensuelle: "2 400 €",
  variableActive: false,
  representant: "Camille Martin",
  conventionCollective: "Organismes de formation",
  conventionIdcc: "1516",
  dateContrat: "20/09/2026",
};
const DATA_LETTRE = {
  numero: "AXI-DOC-2026-070",
  formateur: {
    nomPrenom: "Paul Externe",
    email: "paul@exemple.fr",
    specialite: "IA générative",
    statut: "sous_traitant",
  },
  objetMission: "Animation de formations.",
  formations: [
    {
      intitule: "IA pour l'immobilier",
      dateDebut: "31/07/2026",
      dateFin: "31/07/2026",
      lieuOuModalite: "Saint-Étienne / Présentiel",
      dureeHeures: 7,
    },
  ],
  tarifJourHt: 850,
  dateMission: "02/08/2026",
};
const DATA_MANDAT = {
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
    stagiaires: ["Camille Durand"],
    numeroConvention: "AXI-DOC-2026-119",
  },
  dateMandat: "04/10/2026",
};
const DATA_CAPTATION = {
  numero: "AXI-DOC-2026-130",
  personne: { nomPrenom: "Camille Durand", qualite: "Stagiaire" },
  intitule: "IA pour l'immobilier",
  dateAction: "15/09/2026",
  lieu: "Saint-Étienne",
  dateEdition: "10/09/2026",
  finalites: ["Illustrer le site de l'organisme"],
  supports: ["Site web"],
  dureeAnnees: 2,
};
const DATA_CADRE = {
  numero: "AXI-DOC-2026-900",
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
const DATA_LETTRE_V2 = {
  numero: "AXI-DOC-2026-901",
  partie: {
    forme: "independant",
    nomPrenom: "Alex Durand",
    siret: "98765432100017",
    nda: "84000000000",
  },
  contratCadre: { version: 3, signeLe: "12/10/2026" },
  accordLe: "13/10/2026",
  formation: {
    intitule: "IA pour l'immobilier",
    reference: "REF-1",
    client: "SCI Invest Sun",
    stagiaires: 2,
  },
  jours: [{ date: "04/11/2026", horaires: "09:00-17:00", demiJournees: 2, lieu: "Saint-Étienne" }],
  journees: 1,
  demiJournees: 0,
  tarifJourneeHtCents: 85000,
  honorairesHtCents: 85000,
  deplacement: null,
  totalHtCents: 85000,
  mentionTva: "TVA non applicable",
  echeancePaiement: "30 jours",
  autofacturation: true,
  financeurEnAttente: false,
  mentionExpresse: null,
  dateMission: "13/10/2026",
};

const P2 = ["client", "axionia"];
const P3 = ["client", "financeur", "axionia"];
const PF = ["formateur", "axionia"];
// Pièces dont la version signée figure dans `AVANT_CORRECTION` (conv. v4 incluse) : non répétées ici.
const GEL_CHARTE_V8: ReadonlyArray<
  readonly [string, Record<string, unknown>, readonly string[], number | undefined, string]
> = [
  ["devis", DATA_DEVIS, P2, 1, "c45bef9b9718b8d694f23533cd312f267cbdde6247ef0b0c3e0e9a212672dc8b"],
  ["devis", DATA_DEVIS, P2, 2, "6f74ae37ac03fa7291156e32cfc5a3877d0d1580d85888b03d15725b3a4eb0c5"],
  ["devis", DATA_DEVIS, P2, 3, "6f74ae37ac03fa7291156e32cfc5a3877d0d1580d85888b03d15725b3a4eb0c5"],
  [
    "devis",
    { ...DATA_DEVIS, formules: FORMULES },
    P2,
    3,
    "7b3034a88cc8b09a11b55e108282767ef59925c8ef87a295d5c8197d99d91c64",
  ],
  [
    "convention",
    DATA_CONVENTION,
    P2,
    3,
    "11fcdbf9d56f384aad6257daa0a78bb84dd1f87d770abe5532659fc40b7a1a70",
  ],
  [
    "convention",
    DATA_CONVENTION,
    P2,
    5,
    "37bd68dbd4f920038afbabe497a85f072467c4e4911313829cb83b6c1180788c",
  ],
  [
    "convention",
    DATA_CONVENTION,
    P2,
    6,
    "d36aa1f2d9b52fcc4b17ac7f4865a5302abb6fac9ff9bd95cda1ad81c9f5dd94",
  ],
  [
    "convention_tripartite",
    DATA_TRIPARTITE,
    P3,
    3,
    "fc0c5d0be179d7ff05488d4c6562c97ca28f5cc96e91b3d7789196abf6d1de32",
  ],
  [
    "convention_tripartite",
    DATA_TRIPARTITE,
    P3,
    5,
    "7407ec141571e9f5aa39898f219718ce5691a28350ef7a9cb2f814f293464404",
  ],
  [
    "convention_tripartite",
    DATA_TRIPARTITE,
    P3,
    6,
    "61db0c0bc6c1cd88e46db405ca21096a4f896b8bc16e19c8d15fff7664089d27",
  ],
  [
    "contrat",
    DATA_CONTRAT,
    ["beneficiaire", "axionia"],
    2,
    "20407cc51cd1a9b473148f08ffb877aebd66c05e1fc15e57cf753cb0ed51b21a",
  ],
  [
    "releve_connexion",
    DATA_RELEVE,
    ["formateur", "responsable_pedagogique"],
    2,
    "115fcf2509b90377dd70727bb4d41d6b59430e15b928c52f9d52d00de7742006",
  ],
  [
    "contrat_sous_traitance",
    DATA_SOUS_TRAITANCE,
    PF,
    2,
    "3b9b34dec2de1b42944a600cfe7f2b5ec72c034ada5b597cecfe6e32bcf437bf",
  ],
  [
    "contrat_travail",
    DATA_TRAVAIL,
    ["salarie", "axionia"],
    2,
    "0ceaabadf5c7e155abd8a2e19cd1c935ca72d1063c09ecfad0cdb760e65bde50",
  ],
  [
    "lettre_mission",
    DATA_LETTRE,
    PF,
    1,
    "cae4d1482739218415df9729e79d113fce537efa097296dfe5f252156827bf29",
  ],
  [
    "mandat_opco",
    DATA_MANDAT,
    ["entreprise", "axionia"],
    1,
    "206a1290bfd6a0dada8439121ee0c178b8ed61aeefe532ccaf10a9a9d42bd05a",
  ],
  [
    "autorisation_captation",
    DATA_CAPTATION,
    ["beneficiaire"],
    1,
    "d662e4c06aa34713e84606ad98173338a2388cd86b7b5a935559f59b36e0a749",
  ],
  [
    "contrat_sous_traitance",
    DATA_CADRE,
    PF,
    3,
    "eb7dac000f1a6e0864c7a721db8bf71742e0b283e00cd966e8f8285d5e2813ca",
  ],
  [
    "contrat_sous_traitance",
    DATA_CADRE,
    PF,
    4,
    "a71f8506b7e40f0548352ce339dab8e9d57552000b723f790ba9efcf4ea66f05",
  ],
  [
    "lettre_mission",
    DATA_LETTRE_V2,
    PF,
    2,
    "7c8e2da73f71e5feb2674946a6f0fc901430ed70676f92ff1b5b23d46a40406e",
  ],
  [
    "lettre_mission",
    DATA_LETTRE_V2,
    PF,
    3,
    "b3e5c91219bf12d4199c75ba2edfa1f640d136b724ca4bd3dc0b93089d85a283",
  ],
];

describe("🔴 V8-P0 — gel de la charte : chaque type de pièce signable garde ses octets", () => {
  for (const [type, data, parties, version, empreinte] of GEL_CHARTE_V8) {
    const formules = "formules" in data ? " avec formules" : "";
    it(`${type} v${version}${formules} — octet pour octet`, async () => {
      const r = await exemplaire({ type, data, parties }, version);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      const sha = createHash("sha256").update(r.buffer).digest("hex");
      expect(sha).toBe(empreinte);
    }, 60_000);
  }
});
