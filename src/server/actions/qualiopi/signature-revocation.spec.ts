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

import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { revoquerSignatureDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { revoquerSignatureAction } from "./signature-revocation";

type Mock = ReturnType<typeof vi.fn>;
const mockAdmin = requireAdminWrite as unknown as Mock;
const mockRevoquer = revoquerSignatureDocument as unknown as Mock;
const mockLog = logQualiopiActivity as unknown as Mock;

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
