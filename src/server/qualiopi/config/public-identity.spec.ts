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
});

describe("computeQualiopiPublicIdentity — gate Phase A/B", () => {
  it("Phase A (flag absent) → null, et AUCUN accès DB", async () => {
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    seedConfig({ "qualiopi.qualiopi_numero": "CERT-001" });

    const res = await computeQualiopiPublicIdentity();

    expect(res).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("Phase B sans certificat → identité affichée (n° optionnel, jamais public)", async () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    seedConfig({ "qualiopi.nda_numero": "11380490538" }); // pas de qualiopi_numero

    const res = await computeQualiopiPublicIdentity();

    // Nouveau contrat : le flag Phase B suffit (attestation délibérée). On affiche
    // la version texte conforme même sans n° — le numéro n'est jamais public.
    expect(res).not.toBeNull();
    expect(res?.qualiopiNumero).toBe("");
    expect(res?.categoriesCertifiees).toBe("Actions de formation");
  });

  it("Phase B + certificat renseigné → identité complète", async () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
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
