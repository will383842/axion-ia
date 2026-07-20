/**
 * Tests — gardes d'accès de l'espace formateur.
 *
 * Zone jusqu'ici SANS AUCUN test : seule la crypto de session
 * (`formateur-session.test.ts`) était couverte, jamais les gardes qui décident
 * qui voit quoi.
 *
 * L'enjeu monte d'un cran avec les formations collectives : l'espace n'exposera
 * plus seulement les séances 1-to-1 du formateur connecté, mais des données de
 * stagiaires tiers. Une garde qui laisse passer devient alors une fuite de
 * données personnelles, pas un simple défaut d'affichage.
 *
 * Chaque test correspond à une porte d'entrée réelle : pas de cookie, cookie
 * falsifié, mauvaise audience, formateur supprimé, formateur DÉSACTIVÉ.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/formateur-session", () => ({
  verifyFormateurSession: vi.fn(),
}));

vi.mock("./cookie", () => ({
  getFormateurToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // `redirect()` lève en réalité : on reproduit ce contrat, sinon un test
  // « rejette » passerait alors que le code continuerait son exécution.
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { prisma } from "@/lib/prisma";
import { verifyFormateurSession } from "@/lib/formateur-session";
import { getFormateurToken } from "./cookie";
import { redirect } from "next/navigation";
import { getFormateurSession, requireFormateur, requireFormateurAction } from "./guard";

const mockFindUnique = (prisma as unknown as { trainer: { findUnique: ReturnType<typeof vi.fn> } })
  .trainer.findUnique;
const mockVerify = verifyFormateurSession as unknown as ReturnType<typeof vi.fn>;
const mockGetToken = getFormateurToken as unknown as ReturnType<typeof vi.fn>;
const mockRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

const TRAINER_ACTIF = {
  id: "trainer-1",
  nom: "Jullin",
  prenom: "Williams",
  email: "contact@axion-ia.com",
  actif: true,
};

/** Chemin nominal : cookie présent, signature valide, formateur actif. */
function setupSessionValide(): void {
  mockGetToken.mockResolvedValue("token-valide");
  mockVerify.mockResolvedValue({ ok: true, trainerId: "trainer-1" });
  mockFindUnique.mockResolvedValue(TRAINER_ACTIF);
}

describe("getFormateurSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la session quand tout est valide", async () => {
    setupSessionValide();
    const s = await getFormateurSession();
    expect(s).not.toBeNull();
    expect(s?.trainerId).toBe("trainer-1");
    expect(s?.email).toBe("contact@axion-ia.com");
  });

  it("refuse sans cookie — et n'interroge PAS la base", async () => {
    mockGetToken.mockResolvedValue(null);
    expect(await getFormateurSession()).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("refuse un cookie dont la signature est invalide", async () => {
    mockGetToken.mockResolvedValue("token-falsifie");
    mockVerify.mockResolvedValue({ ok: false, reason: "invalid_signature" });
    expect(await getFormateurSession()).toBeNull();
    // Une signature invalide ne doit JAMAIS atteindre la base.
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("refuse un cookie expiré", async () => {
    mockGetToken.mockResolvedValue("token-expire");
    mockVerify.mockResolvedValue({ ok: false, reason: "expired" });
    expect(await getFormateurSession()).toBeNull();
  });

  it("refuse un cookie d'une AUTRE audience (espace ressources)", async () => {
    mockGetToken.mockResolvedValue("token-ressources");
    mockVerify.mockResolvedValue({ ok: false, reason: "wrong_audience" });
    expect(await getFormateurSession()).toBeNull();
    // Le cloisonnement formateur/ressources repose entièrement sur ce claim :
    // les deux espaces partagent le même AUTH_SECRET.
    expect(mockVerify).toHaveBeenCalledWith("token-ressources", "formateur");
  });

  it("refuse si le formateur n'existe plus en base", async () => {
    mockGetToken.mockResolvedValue("token-valide");
    mockVerify.mockResolvedValue({ ok: true, trainerId: "trainer-supprime" });
    mockFindUnique.mockResolvedValue(null);
    expect(await getFormateurSession()).toBeNull();
  });

  it("🔴 refuse un formateur DÉSACTIVÉ, même avec un cookie parfaitement valide", async () => {
    mockGetToken.mockResolvedValue("token-valide");
    mockVerify.mockResolvedValue({ ok: true, trainerId: "trainer-1" });
    mockFindUnique.mockResolvedValue({ ...TRAINER_ACTIF, actif: false });

    // C'est LE test qui compte : le cookie vit 30 jours et la garde Edge ne
    // vérifie que la signature. La révocation d'un formateur écarté ne tient
    // qu'à ce relookup en base, sans cache — le retirer rouvrirait l'accès
    // pendant un mois à quelqu'un qu'on vient de sortir.
    expect(await getFormateurSession()).toBeNull();
  });

  it("interroge la base avec l'identifiant issu du token, jamais d'ailleurs", async () => {
    setupSessionValide();
    await getFormateurSession();
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "trainer-1" } }),
    );
  });
});

describe("requireFormateur (Server Components)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la session sans rediriger quand elle est valide", async () => {
    setupSessionValide();
    const s = await requireFormateur();
    expect(s.trainerId).toBe("trainer-1");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirige vers la connexion quand la session est absente", async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(requireFormateur()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/fr/espace-formateur/connexion");
  });

  it("redirige aussi pour un formateur désactivé", async () => {
    mockGetToken.mockResolvedValue("token-valide");
    mockVerify.mockResolvedValue({ ok: true, trainerId: "trainer-1" });
    mockFindUnique.mockResolvedValue({ ...TRAINER_ACTIF, actif: false });
    await expect(requireFormateur()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("requireFormateurAction (Server Actions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne la session quand elle est valide", async () => {
    setupSessionValide();
    const s = await requireFormateurAction();
    expect(s.trainerId).toBe("trainer-1");
  });

  it("LÈVE au lieu de rediriger — un redirect dans une action serait avalé", async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(requireFormateurAction()).rejects.toThrow("unauthorized");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("lève aussi pour un formateur désactivé", async () => {
    mockGetToken.mockResolvedValue("token-valide");
    mockVerify.mockResolvedValue({ ok: true, trainerId: "trainer-1" });
    mockFindUnique.mockResolvedValue({ ...TRAINER_ACTIF, actif: false });
    await expect(requireFormateurAction()).rejects.toThrow("unauthorized");
  });
});
