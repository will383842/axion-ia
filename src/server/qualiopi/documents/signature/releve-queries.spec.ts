/**
 * Tests — releve-queries.ts
 *
 * Cette lecture décide de ce que le formateur VOIT et de ce qu'il peut faire.
 * Trois invariants, et les rater ne se voit pas en revue de diff :
 *
 *  1. **On ne propose pas un bouton qui refusera à coup sûr.** Un SPÉCIMEN est
 *     rejeté par `signerDocument` ; l'écran doit le dire AVANT le clic, sinon
 *     le refus se lit comme une panne.
 *  2. **Le texte affiché vient du même module que la version scellée.** Prouver
 *     « ce qu'elle a signé » suppose que l'écran et l'empreinte concordent.
 *  3. **Aucune donnée personnelle au-delà du nom et de la qualité.**
 *     `signataireEmail` reste scellé en base, il ne sort pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findFirst: vi.fn() } },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { lireEtatSignatureReleve } from "./releve-queries";
import { MENTION_VERSION_DOCUMENT } from "./mentions-document";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { documentGenere: { findFirst: Mock } };
const mockIdentite = getOrganismeIdentite as unknown as Mock;

const SESSION = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";

function piece(over: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    numero: "AXI-RC-2026-0007",
    statutSignature: "en_attente",
    metadata: {},
    signatures: [] as Array<Record<string, unknown>>,
    session: { formateurPrincipalId: TRAINER, sessionFormateurs: [] },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.documentGenere.findFirst.mockResolvedValue(piece());
  mockIdentite.mockResolvedValue({ raisonSociale: "Axion-IA" });
});

describe("état de signature du relevé", () => {
  it("rend `null` quand aucun relevé n'existe — cas NORMAL, pas une erreur", async () => {
    // Une session présentielle n'a pas de relevé de connexion. L'appelant doit
    // pouvoir ne rien afficher plutôt que de montrer un bloc vide qui se lirait
    // comme une pièce manquante.
    mockPrisma.documentGenere.findFirst.mockResolvedValue(null);
    expect(await lireEtatSignatureReleve(SESSION, TRAINER)).toBeNull();
  });

  it("🔴 retient le relevé le PLUS RÉCENT quand il y a eu réémission", async () => {
    await lireEtatSignatureReleve(SESSION, TRAINER);
    const arg = mockPrisma.documentGenere.findFirst.mock.calls[0]?.[0] as {
      orderBy: unknown;
      where: Record<string, unknown>;
    };
    expect(arg.orderBy).toStrictEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(arg.where["type"]).toBe("releve_connexion");
  });

  it("ne lit que les signatures NON révoquées", async () => {
    // Une signature révoquée ne doit pas s'afficher comme valable : la
    // révocation est précisément le geste par lequel une preuve cesse de valoir.
    await lireEtatSignatureReleve(SESSION, TRAINER);
    const arg = mockPrisma.documentGenere.findFirst.mock.calls[0]?.[0] as {
      select: { signatures: { where: Record<string, unknown> } };
    };
    expect(arg.select.signatures.where["revokedAt"]).toBeNull();
  });

  it("expose les deux parties du circuit, dans l'ordre du SSOT", async () => {
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.parties.map((p) => p.partie)).toStrictEqual([
      "formateur",
      "responsable_pedagogique",
    ]);
  });
});

describe("🔴 ce que le formateur peut faire", () => {
  it("peut signer s'il est le principal et que rien n'est signé", async () => {
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(true);
  });

  it("peut signer s'il est rattaché par une ligne `SessionFormateur`", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({
        session: { formateurPrincipalId: null, sessionFormateurs: [{ trainerId: TRAINER }] },
      }),
    );
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(true);
  });

  it("ne peut PAS signer s'il n'est rattaché à rien", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({ session: { formateurPrincipalId: null, sessionFormateurs: [] } }),
    );
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(false);
  });

  it("🔴 ne peut PAS signer un SPÉCIMEN — et l'écran le sait AVANT le clic", async () => {
    // `signerDocument` refusera de toute façon. Proposer le bouton quand même
    // ferait passer un refus légitime pour une panne, et le formateur
    // réessaierait au lieu de faire corriger l'identité de l'organisme.
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({ metadata: { specimen: true, champsManquants: ["SIRET"] } }),
    );
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(false);
  });

  it("ne se laisse pas berner par un `metadata` qui n'est pas un objet", async () => {
    // Colonne `Json` : le type n'est PAS garanti côté application.
    mockPrisma.documentGenere.findFirst.mockResolvedValue(piece({ metadata: ["specimen"] }));
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(true);
  });

  it("ne peut plus signer une fois qu'il a signé", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({
        signatures: [
          {
            partie: "formateur",
            signataireNom: "Williams Jullin",
            signataireQualite: "Formateur",
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "a".repeat(64),
          },
        ],
      }),
    );
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.formateurPeutSigner).toBe(false);
  });
});

describe("🔴 ce qui est présenté au signataire", () => {
  it("rend le signataire, son horodatage en heure de PARIS, et son empreinte", async () => {
    // « Signé » tout court n'est pas une preuve, c'est une affirmation.
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({
        signatures: [
          {
            partie: "formateur",
            signataireNom: "Williams Jullin",
            signataireQualite: "Formateur",
            // 08:15 UTC = 10:15 à Paris en juin. Un affichage UTC ferait
            // constater au formateur une heure qui n'est pas la sienne.
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "a".repeat(64),
          },
        ],
      }),
    );
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    const formateur = etat?.parties.find((p) => p.partie === "formateur");
    expect(formateur?.signee).toBe(true);
    expect(formateur?.signataireNom).toBe("Williams Jullin");
    expect(formateur?.signeAtLisible).toContain("10:15");
    expect(formateur?.empreinte).toBe("a".repeat(64));
  });

  it("🔴 n'expose JAMAIS l'e-mail du signataire", async () => {
    // Il reste scellé en base — il sert au recalcul de l'empreinte, pas à
    // l'affichage. Le sortir ici le ferait fuiter vers le navigateur.
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(JSON.stringify(etat)).not.toContain("@");
    const select = (
      mockPrisma.documentGenere.findFirst.mock.calls[0]?.[0] as {
        select: { signatures: { select: Record<string, unknown> } };
      }
    ).select.signatures.select;
    expect(select["signataireEmail"]).toBeUndefined();
  });

  it("🔴 la mention affichée vient du module VERSIONNÉ, pas d'un texte local", async () => {
    // Si l'écran affichait un texte réécrit à la main, `MENTION_VERSION_DOCUMENT`
    // scellerait une version qui ne correspondrait à rien de ce qui a été lu.
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.mentions.length).toBeGreaterThan(3);
    expect(etat?.mentions.join(" ")).toContain("article 1366");
    expect(etat?.mentions.join(" ")).toContain("AXI-RC-2026-0007");
    // Le canal maison DOIT porter son plafond probant : la chaîne ne remet
    // aucun certificat au signataire, et le taire serait une survente.
    expect(etat?.mentions.join(" ")).toContain("certificat délivré par un prestataire");
    expect(MENTION_VERSION_DOCUMENT).toBe("doc-v1");
  });

  it("🔴 dit que les deux signatures ne sont pas un double contrôle indépendant", async () => {
    // Dans un organisme d'une personne, formateur et responsable pédagogique
    // sont le même humain. Le taire laisserait croire à un contrôle croisé.
    const etat = await lireEtatSignatureReleve(SESSION, TRAINER);
    expect(etat?.plafondProbant).toContain("deux qualités distinctes");
  });
});
