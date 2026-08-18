/**
 * Tests — config/public-identity.ts (identité publique Qualiopi, Phase A/B).
 *
 * Stratégie : mock `@/lib/prisma` (siteSetting.findUnique) + pilotage du flag
 * `OF_PUBLIC_DISCLOSURE_ENABLED` via process.env. On teste l'implémentation NON
 * mémoïsée `computeQualiopiPublicIdentity` (le wrapper `cache()` fausserait un
 * test multi-scénarios).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn() },
  },
}));

// `_guards` importe next-auth (crash en environnement vitest). On ne teste pas
// l'audit/écriture ici (lecture seule), donc on stube le module pour casser la
// chaîne d'import next-auth — même approche que les autres specs qualiopi.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { computeNdaPublic, computeQualiopiPublicIdentity } from "./public-identity";

const mockFindUnique = prisma.siteSetting.findUnique as unknown as ReturnType<typeof vi.fn>;

const ORIGINAL = process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
const ORIGINAL_CERT = process.env.QUALIOPI_CERTIFICATION_OBTENUE;

/** Branche un magasin clé→valeur sur le mock findUnique (clés préfixées `qualiopi.`). */
function seedConfig(store: Record<string, string>) {
  mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    if (Object.prototype.hasOwnProperty.call(store, where.key)) {
      return { value: store[where.key] };
    }
    return null;
  });
}

beforeEach(() => {
  mockFindUnique.mockReset();
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
  else process.env.OF_PUBLIC_DISCLOSURE_ENABLED = ORIGINAL;
  if (ORIGINAL_CERT === undefined) delete process.env.QUALIOPI_CERTIFICATION_OBTENUE;
  else process.env.QUALIOPI_CERTIFICATION_OBTENUE = ORIGINAL_CERT;
});

describe("computeQualiopiPublicIdentity — gate Phase A/B", () => {
  it("Phase A (flag absent) → null, et AUCUN accès DB", async () => {
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    seedConfig({ "qualiopi.qualiopi_numero": "CERT-001" });

    const res = await computeQualiopiPublicIdentity();

    expect(res).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("🚨 Phase B SANS certification obtenue → null (découplage F13)", async () => {
    // Audit de certification 2026-07-25. Jusqu'ici, basculer en Phase B valait
    // attestation que « NDA + Qualiopi » étaient obtenus. En production, le flag
    // était à true alors que la certification n'était pas obtenue : le site
    // affirmait « la certification qualité a été délivrée ». Les deux notions
    // sont désormais séparées — la visibilité des pages ne prouve rien.
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    delete process.env.QUALIOPI_CERTIFICATION_OBTENUE;
    seedConfig({ "qualiopi.nda_numero": "11380490538" });

    expect(await computeQualiopiPublicIdentity()).toBeNull();
  });

  it("🚨 QUALIOPI_CERTIFICATION_OBTENUE seul ne suffit pas non plus", async () => {
    // Symétrie : sans divulgation publique, rien ne sort, certifié ou non.
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    process.env.QUALIOPI_CERTIFICATION_OBTENUE = "true";
    seedConfig({ "qualiopi.qualiopi_numero": "CERT-001" });

    expect(await computeQualiopiPublicIdentity()).toBeNull();
  });

  it("Phase B + certification obtenue → identité complète", async () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    process.env.QUALIOPI_CERTIFICATION_OBTENUE = "true";
    seedConfig({
      "qualiopi.qualiopi_numero": "CERT-2026-001",
      "qualiopi.nda_numero": "11380490538",
      "qualiopi.qualiopi_organisme": "Certif'OF",
      "qualiopi.qualiopi_validite": "2031-06-30",
      "qualiopi.raison_sociale": "Axion-IA SAS",
    });

    const res = await computeQualiopiPublicIdentity();

    expect(res).not.toBeNull();
    expect(res?.qualiopiNumero).toBe("CERT-2026-001");
    expect(res?.nda).toBe("11380490538");
    expect(res?.qualiopiOrganisme).toBe("Certif'OF");
    expect(res?.qualiopiValidite).toBe("2031-06-30");
    // catégories non renseignées → défaut du registre
    expect(res?.categoriesCertifiees).toBe("Actions de formation");
  });
});

/**
 * 🔴 Découplage du 2026-08-17 — le NDA ne dépend PAS de la certification.
 *
 * L'enregistrement DREETS est un fait administratif que l'art. L.6352-12 impose
 * même de mentionner ; la certification Qualiopi est une attestation de qualité
 * délivrée après audit. Les enfermer dans la même garde avait rendu le récépissé
 * du 17 août 2026 invisible sur le site. Le premier test ci-dessous échoue sur
 * l'ancien code : c'est lui qui garde la séparation.
 */
describe("computeNdaPublic — enregistrement ≠ certification", () => {
  it("🚨 Phase B SANS certification → le NDA sort quand même", async () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    delete process.env.QUALIOPI_CERTIFICATION_OBTENUE;
    seedConfig({ "qualiopi.nda_numero": "84381100438" });

    expect(await computeNdaPublic()).toBe("84381100438");
    // Et la revendication Qualiopi, elle, reste bien éteinte.
    expect(await computeQualiopiPublicIdentity()).toBeNull();
  });

  it("Phase A → chaîne vide, et AUCUN accès DB", async () => {
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    seedConfig({ "qualiopi.nda_numero": "84381100438" });

    expect(await computeNdaPublic()).toBe("");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("clé absente en base → défaut du registre (le numéro réel, dispo au build stub)", async () => {
    // Le build SSG tourne sur `stub.invalid` : `findUnique` renvoie null. Sans
    // défaut de registre, la mention légale manquerait du HTML figé.
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    seedConfig({});

    expect(await computeNdaPublic()).toBe("84381100438");
  });

  it("ligne enregistrée VIDE → chaîne vide (le vide en base gagne sur le défaut)", async () => {
    // Comportement de `getQualiopiConfig`, documenté ici parce qu'il justifie la
    // migration `20260817120000_nda_declaration_activite`, qui supprime
    // précisément cette ligne-là.
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    seedConfig({ "qualiopi.nda_numero": "" });

    expect(await computeNdaPublic()).toBe("");
  });
});
