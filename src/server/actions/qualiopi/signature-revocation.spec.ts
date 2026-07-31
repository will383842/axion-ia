/**
 * Tests — revoquerSignatureAction.
 *
 * C'est une MUTATION sur une preuve légale, déclenchée depuis un écran d'audit.
 * Quatre invariants, et les rater ne se voit pas en revue de diff :
 *
 *  1. **Un rôle insuffisant ne révoque pas.** Retirer une preuve du dossier
 *     engage l'organisme autant que l'y verser.
 *  2. **Un motif vide n'atteint jamais le service.** Sans motif, le registre ne
 *     dit rien à l'auditeur — et le CHECK de la base le refuserait de toute
 *     façon, mais par une violation de contrainte illisible.
 *  3. **La redirection ne suit jamais une valeur non validée.** Un `retour`
 *     arbitraire venu du formulaire est une redirection ouverte.
 *  4. **Aucun message libre ne transite par l'URL** — seulement un code.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_guards", () => ({ requireAdminWrite: vi.fn(), logQualiopiActivity: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  revoquerSignatureDocument: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  // `redirect` LÈVE en vrai : on reproduit ce contrat, sinon le code
  // continuerait après un refus et les tests passeraient à tort.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
// ⚠️ Ajoutés pour la famille AFEST : l'action mesure désormais l'impact en
// HEURES, ce qui la fait lire `coachingSeanceSignature` et `coachingSession`.
// Les tests de la famille DOCUMENT ci-dessous n'y touchent pas.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    coachingSeanceSignature: { findUnique: vi.fn() },
    coachingSession: { findUnique: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/coaching-afest/signature/signature-afest-service", () => ({
  revoquerSignatureSeance: vi.fn(),
}));

import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { revoquerSignatureDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { prisma } from "@/lib/prisma";
import { revoquerSignatureSeance } from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";
import {
  revoquerSignatureAction,
  revoquerSignatureSeanceAfestAction,
} from "./signature-revocation";

type Mock = ReturnType<typeof vi.fn>;
const mockAdmin = requireAdminWrite as unknown as Mock;
const mockRevoquer = revoquerSignatureDocument as unknown as Mock;
const mockLog = logQualiopiActivity as unknown as Mock;
const mockPrismaAfest = prisma as unknown as {
  coachingSeanceSignature: { findUnique: Mock };
  coachingSession: { findUnique: Mock };
};
const mockRevoquerSeance = revoquerSignatureSeance as unknown as Mock;

const SIGNATURE = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const RETOUR = "/fr/admin/qualiopi/mode-auditeur/signatures";

function formulaire(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("signatureId", SIGNATURE);
  fd.set("motif", "signée à tort");
  fd.set("retour", RETOUR);
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

/** URL de redirection réellement empruntée. */
async function urlDeRedirection(fd: FormData): Promise<string> {
  try {
    await revoquerSignatureAction(fd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("REDIRECT:")) return msg.slice("REDIRECT:".length);
    throw err;
  }
  throw new Error("aucune redirection — l'action doit toujours rediriger");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdmin.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  mockRevoquer.mockResolvedValue({ ok: true });
  mockLog.mockResolvedValue(undefined);
});

describe("🔴 habilitation", () => {
  it("un `editor` ne révoque PAS", async () => {
    // `requireAdminWrite` l'admet ; révoquer engage l'organisme, donc pas ici.
    mockAdmin.mockResolvedValue({ userId: ADMIN, role: "editor" });
    const url = await urlDeRedirection(formulaire());
    expect(url).toBe(`${RETOUR}?revocation=role_insuffisant`);
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("un `admin` révoque", async () => {
    mockAdmin.mockResolvedValue({ userId: ADMIN, role: "admin" });
    const url = await urlDeRedirection(formulaire());
    expect(url).toBe(`${RETOUR}?revocation=ok`);
    expect(mockRevoquer).toHaveBeenCalledOnce();
  });
});

describe("🔴 le motif n'est pas facultatif", () => {
  it("refuse un motif vide sans jamais atteindre le service", async () => {
    const url = await urlDeRedirection(formulaire({ motif: "   " }));
    expect(url).toBe(`${RETOUR}?revocation=demande_invalide`);
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const url = await urlDeRedirection(formulaire({ signatureId: "pas-un-uuid" }));
    expect(url).toBe(`${RETOUR}?revocation=demande_invalide`);
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("transmet le motif au service, sans le tronquer en amont", async () => {
    await urlDeRedirection(formulaire({ motif: "  partie erronée  " }));
    expect(mockRevoquer).toHaveBeenCalledWith(
      expect.objectContaining({ motif: "partie erronée", parAdminId: ADMIN }),
    );
  });
});

describe("🔴 la redirection ne suit pas une valeur arbitraire", () => {
  it("ignore un `retour` absolu externe — c'est une redirection ouverte", async () => {
    // Sans cette garde, le formulaire choisit où le navigateur atterrit.
    const url = await urlDeRedirection(formulaire({ retour: "https://exemple.test/piege" }));
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toContain("exemple.test");
  });

  it("ignore un `retour` qui ne commence pas par `/`", async () => {
    const url = await urlDeRedirection(formulaire({ retour: "javascript:alert(1)" }));
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toContain("javascript");
  });
});

describe("🔴 un refus du service remonte comme un CODE, jamais comme un message", () => {
  it("relaie la raison typée sans recopier le message", async () => {
    // Un texte libre repris dans l'URL puis réaffiché est une injection en
    // puissance : la page traduit un code, elle ne recopie pas une phrase.
    mockRevoquer.mockResolvedValue({
      ok: false,
      raison: "revocation_maillon_interne_interdite",
      message: "<script>alert(1)</script>",
    });
    const url = await urlDeRedirection(formulaire());
    expect(url).toBe(
      `${RETOUR}?revocation=refus_service&raison=revocation_maillon_interne_interdite`,
    );
    expect(url).not.toContain("script");
  });

  it("ne journalise PAS une révocation qui n'a pas eu lieu", async () => {
    mockRevoquer.mockResolvedValue({ ok: false, raison: "deja_revoquee", message: "déjà" });
    await urlDeRedirection(formulaire());
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("journalise une révocation effective", async () => {
    await urlDeRedirection(formulaire());
    expect(mockLog).toHaveBeenCalledOnce();
    const arg = mockLog.mock.calls[0]?.[0] as { targetId: string; action: string };
    expect(arg.targetId).toBe(SIGNATURE);
    expect(arg.action).toBe("qualiopi.signature.revocation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Famille AFEST — l'impact en HEURES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Le document de reprise exigeait que l'impact d'une révocation de séance
 * soit « chiffré avant/après et journalisé ». Sans test, cette exigence se perd
 * au premier refactor — et ce qui se perdrait, c'est la seule trace disant
 * qu'une facture, un BPF, un certificat ou une attestation vient de devenir
 * inexact.
 *
 * ⚠️ Impact réel en production au 2026-07-30 : `coaching_seance_signatures` = 0,
 * `coaching_sessions` = 0. Le garde-fou est construit pour le jour où il y en
 * aura.
 */
const COACHING = "33333333-3333-4333-8333-333333333333";

/** Deux séances de 2 h ; seule la seconde est signée → 2 h en `signature_reelle`. */
function parcoursAfest(signee: boolean) {
  return {
    regimePreuve: "signature_reelle",
    comptesRendus: [
      {
        dureeMinutes: 120,
        statut: "realisee",
        presenceSigneeAt: null,
        beneficiairePresent: true,
        signatures: [],
      },
      {
        dureeMinutes: 120,
        statut: "realisee",
        presenceSigneeAt: null,
        beneficiairePresent: true,
        signatures: signee ? [{ id: "s1" }] : [],
      },
    ],
  };
}

describe("🔴 révocation AFEST — l'impact en heures est chiffré et journalisé", () => {
  beforeEach(() => {
    mockPrismaAfest.coachingSeanceSignature.findUnique.mockResolvedValue({
      coachingId: COACHING,
      role: "beneficiaire",
    });
    // 🔴 `mockReset` d'abord : `clearAllMocks` efface les APPELS, pas la file des
    // `mockResolvedValueOnce`. Sans reset, les valeurs d'un test précédent sont
    // servies d'abord — piège déjà documenté sur ce dépôt.
    mockPrismaAfest.coachingSession.findUnique.mockReset();
    mockPrismaAfest.coachingSession.findUnique
      .mockResolvedValueOnce(parcoursAfest(true))
      .mockResolvedValueOnce(parcoursAfest(false));
    mockRevoquerSeance.mockResolvedValue({ ok: true });
  });

  it("journalise heuresAvant, heuresApres et l'écart", async () => {
    await urlDeRedirectionAfest(formulaire());
    const changes = mockLog.mock.calls[0]?.[0]?.changes as Record<string, unknown>;
    expect(changes["heuresAvant"]).toBe(2);
    expect(changes["heuresApres"]).toBe(0);
    expect(changes["deltaHeures"]).toBe(-2);
    expect(changes["coachingId"]).toBe(COACHING);
  });

  it("⚠️ mesure APRÈS en RELISANT, jamais en déduisant la durée de la séance", async () => {
    // Déduire « la séance faisait 120 min, donc -2 h » supposerait connaître le
    // régime, la neutralisation et l'absence actée — trois règles qui vivent
    // dans `heures.ts` et doivent y rester. DEUX lectures, donc deux appels.
    await urlDeRedirectionAfest(formulaire());
    expect(mockPrismaAfest.coachingSession.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rend un écart NUL quand la séance n'était pas comptée", async () => {
    // Séance déjà non signée en régime `signature_reelle` : la révocation ne
    // change rien au comptage. Le dire évite une alerte pour rien.
    mockPrismaAfest.coachingSession.findUnique.mockReset();
    mockPrismaAfest.coachingSession.findUnique
      .mockResolvedValueOnce(parcoursAfest(true))
      .mockResolvedValueOnce(parcoursAfest(true));
    await urlDeRedirectionAfest(formulaire());
    const changes = mockLog.mock.calls[0]?.[0]?.changes as Record<string, unknown>;
    expect(changes["deltaHeures"]).toBe(0);
  });

  it("ne journalise RIEN quand le service refuse", async () => {
    mockRevoquerSeance.mockResolvedValue({
      ok: false,
      raison: "revocation_maillon_interne_interdite",
    });
    const url = await urlDeRedirectionAfest(formulaire());
    expect(url).toContain("revocation=refus_service");
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("refuse un rôle insuffisant sans rien mesurer", async () => {
    mockAdmin.mockResolvedValue({ userId: ADMIN, role: "editor" });
    const url = await urlDeRedirectionAfest(formulaire());
    expect(url).toContain("revocation=role_insuffisant");
    expect(mockRevoquerSeance).not.toHaveBeenCalled();
  });
});

/** Même contrat que `urlDeRedirection`, pour l'action AFEST. */
async function urlDeRedirectionAfest(fd: FormData): Promise<string> {
  try {
    await revoquerSignatureSeanceAfestAction(fd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("REDIRECT:")) return msg.slice("REDIRECT:".length);
    throw err;
  }
  throw new Error("aucune redirection — l'action doit toujours rediriger");
}
