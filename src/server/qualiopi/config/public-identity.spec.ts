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
import { computeQualiopiPublicIdentity } from "./public-identity";

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
