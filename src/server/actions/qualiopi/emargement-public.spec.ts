/**
 * Tests — emargement-public.ts
 *
 * ⚠️ C'est la SEULE action non authentifiée du domaine, et elle n'avait aucun
 * test. Le jeton est l'unique barrière : tout ce qui est garanti ailleurs par
 * l'authentification doit l'être ici explicitement, et donc être vérifié ici.
 *
 * Quatre propriétés, dans l'ordre où elles comptent :
 *
 *  1. **L'ordre des gardes.** Le rate-limit passe AVANT le décodage d'image :
 *     sinon un envoi massif fait travailler `sharp` pour rien et met le
 *     conteneur à genoux, privant de signature toute une salle.
 *  2. **La clé de limite ne fuit pas.** Ni le jeton en clair (Redis persiste, et
 *     `MONITOR` l'exposerait), ni une clé IP seule — quinze stagiaires derrière
 *     le NAT du client partagent une adresse, et quatorze seraient bloqués.
 *  3. **Les entrées sont validées.** `methode` entre dans le tuple HACHÉ : une
 *     valeur forgée y serait scellée définitivement.
 *  4. **Un refus reste un refus.** Un échec de stockage ne doit jamais devenir
 *     une signature silencieusement absente.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn() }));
vi.mock("@/server/qualiopi/emargement/token-service", () => ({ verifierToken: vi.fn() }));
vi.mock("@/server/qualiopi/emargement/signature-service", () => ({ signerCreneau: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { hashIp } from "@/lib/security/ip-hash";
import { verifierToken } from "@/server/qualiopi/emargement/token-service";
import { signerCreneau } from "@/server/qualiopi/emargement/signature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { signerDepuisPortailAction } from "./emargement-public";

const mockLimite = checkRateLimit as unknown as ReturnType<typeof vi.fn>;
const mockHeaders = headers as unknown as ReturnType<typeof vi.fn>;
const mockHashIp = hashIp as unknown as ReturnType<typeof vi.fn>;
const mockVerifierToken = verifierToken as unknown as ReturnType<typeof vi.fn>;
const mockSigner = signerCreneau as unknown as ReturnType<typeof vi.fn>;

const TOKEN = "eyJlIjoiZW5yLTEifQ.c2lnbmF0dXJlLWZhY3RpY2U";
const CRENEAU = "11111111-1111-4111-8111-111111111111";
const IMAGE = "data:image/png;base64,AAAA";

/** Entrée nominale. */
function entree(over: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    creneauId: CRENEAU,
    methode: "canvas" as const,
    imageDataUrl: IMAGE,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : sans ce
  // repositionnement, un `undefined` ferait échouer des tests sans rapport.
  mockLimite.mockResolvedValue({ allowed: true });
  mockHeaders.mockResolvedValue(
    new Map([
      ["cf-connecting-ip", "203.0.113.7"],
      ["user-agent", "Mozilla/5.0"],
    ]) as unknown as Headers,
  );
  mockHashIp.mockReturnValue("iphash");
  mockVerifierToken.mockResolvedValue({ ok: true, enrollmentId: "enr-1", tokenId: "tok-1" });
  mockSigner.mockResolvedValue({ ok: true, signatureId: "sig-1" });
});

describe("signerDepuisPortailAction — ordre des gardes", () => {
  it("🔴 refuse sur la limite PAR JETON, avant même de vérifier le jeton", async () => {
    // C'est l'ordre qui protège : vérifier le jeton d'abord ferait un aller-retour
    // base par requête, et décoder l'image ferait travailler `sharp`.
    //
    // ⚠️ Seule la limite PAR JETON refuse ici. Couper les deux d'un coup ne
    // discriminerait rien : la garde IP, qui vient juste après, rattraperait le
    // cas et le test passerait même si la garde par jeton était retirée —
    // mutation vérifiée.
    mockLimite.mockImplementation(async (cle: string) => ({
      allowed: !cle.startsWith("emargement:sig:"),
    }));

    const r = await signerDepuisPortailAction(entree());

    expect(r).toMatchObject({ ok: false, raison: "trop_de_tentatives" });
    expect(mockVerifierToken).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse aussi sur la limite PAR IP seule", async () => {
    mockLimite.mockImplementation(async (cle: string) => ({
      allowed: !cle.startsWith("emargement:ip:"),
    }));

    const r = await signerDepuisPortailAction(entree());

    expect(r).toMatchObject({ ok: false, raison: "trop_de_tentatives" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 la clé de limite porte le HASH du jeton, jamais le jeton en clair", async () => {
    // Redis persiste, et `MONITOR` exposerait la clé. Un jeton en clair dans une
    // clé Redis est un jeton rejouable pendant 48 h.
    await signerDepuisPortailAction(entree());

    const cles = mockLimite.mock.calls.map((c) => String(c[0]));
    expect(cles.some((k) => k.includes(TOKEN))).toBe(false);
    expect(cles.some((k) => /^emargement:sig:[0-9a-f]{64}$/.test(k))).toBe(true);
  });

  it("limite AUSSI par IP, mais avec un plafond dimensionné pour une salle entière", async () => {
    // Le catalogue contient un séminaire « jusqu'à 50 participants » : un plafond
    // confortable bloquerait la salle au lieu d'un balayage extérieur.
    await signerDepuisPortailAction(entree());

    const appelIp = mockLimite.mock.calls.find((c) => String(c[0]).startsWith("emargement:ip:"));
    expect(appelIp).toBeDefined();
    expect((appelIp![1] as { limit: number }).limit).toBeGreaterThanOrEqual(600);
  });

  it("ne bloque pas quand l'IP est indisponible", async () => {
    // Sans IP exploitable, la limite par jeton reste la vraie barrière.
    mockHashIp.mockReturnValue(null);
    const r = await signerDepuisPortailAction(entree());
    expect(r.ok).toBe(true);
  });
});

describe("signerDepuisPortailAction — validation des entrées", () => {
  it("🔴 REFUSE une méthode que la page publique ne sait pas produire", async () => {
    // `papier_scanne` est le mode dégradé du formateur, sur un poste qu'il tient.
    // Forgé depuis le portail, il scellerait dans le tuple HACHÉ « photo de
    // feuille papier » pour une signature au doigt — un fait faux, définitif,
    // et que l'empreinte déclarerait intact.
    const r = await signerDepuisPortailAction(entree({ methode: "papier_scanne" }));

    expect(r.ok).toBe(false);
    expect(mockSigner).not.toHaveBeenCalled();
    expect(mockVerifierToken).not.toHaveBeenCalled();
  });

  it("REFUSE un identifiant de créneau qui n'est pas un UUID", async () => {
    const r = await signerDepuisPortailAction(entree({ creneauId: "' OR 1=1 --" }));
    expect(r.ok).toBe(false);
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE une image démesurée AVANT tout décodage", async () => {
    // `bodySizeLimit` laisse passer 10 Mo : sans borne ici, la mémoire est déjà
    // consommée quand le plafond du décodeur s'applique.
    const r = await signerDepuisPortailAction({
      ...entree(),
      imageDataUrl: `data:image/png;base64,${"A".repeat(4_000_000)}`,
    });
    expect(r.ok).toBe(false);
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("ne détaille PAS ce qui est invalide", async () => {
    // Détailler renseignerait un appelant forgé sur la forme attendue.
    const r = await signerDepuisPortailAction(entree({ creneauId: "pas-un-uuid" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).not.toContain("uuid");
      expect(r.message).not.toContain("creneauId");
    }
  });
});

describe("signerDepuisPortailAction — jeton", () => {
  it("refuse un jeton invalide avec un message UNIQUE", async () => {
    // Distinguer « expiré » de « révoqué » est utile sur la PAGE, où le motif est
    // déjà connu — pas ici, où l'appel peut venir de n'importe où.
    mockVerifierToken.mockResolvedValue({ ok: false, raison: "expire" });
    const r = await signerDepuisPortailAction(entree());
    expect(r).toMatchObject({ ok: false, raison: "lien_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse un jeton sans inscription rattachée", async () => {
    mockVerifierToken.mockResolvedValue({ ok: true, enrollmentId: null, tokenId: "tok-1" });
    const r = await signerDepuisPortailAction(entree());
    expect(r).toMatchObject({ ok: false, raison: "lien_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 le porteur transmis vient du JETON, jamais de l'appelant", async () => {
    // Si l'inscription venait de l'entrée, n'importe qui signerait pour n'importe
    // qui : c'est la garde d'autorisation, et elle se joue ici.
    mockVerifierToken.mockResolvedValue({ ok: true, enrollmentId: "enr-VRAI", tokenId: "tok-9" });

    await signerDepuisPortailAction({
      ...entree(),
      // Champ inconnu du schéma : il ne doit avoir aucun effet.
      enrollmentId: "enr-USURPE",
    } as never);

    expect(mockSigner.mock.calls[0]![0].porteur).toEqual({
      type: "stagiaire",
      enrollmentId: "enr-VRAI",
      tokenId: "tok-9",
    });
  });

  it("HACHE le user-agent plutôt que de le sceller en clair", async () => {
    // Il entre dans le tuple immuable : une donnée personnelle en clair y serait
    // hors d'atteinte de tout effacement.
    await signerDepuisPortailAction(entree());
    const arg = mockSigner.mock.calls[0]![0] as { userAgentSha256: string | null };
    expect(arg.userAgentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(arg.userAgentSha256).not.toContain("Mozilla");
  });
});

describe("signerDepuisPortailAction — échecs de stockage", () => {
  it("🔴 traduit un échec de stockage en REFUS explicite, jamais en 500 muet", async () => {
    // La signature ne doit pas être simulée : le stagiaire doit savoir qu'il
    // devra recommencer, sinon il quitte la salle en croyant avoir signé.
    // ⚠️ Le constructeur est `(motif, message)`, et `imputableAuClient` est
    // DÉRIVÉ du motif. Ma première version passait `(message, false)` : le test
    // passait par accident, sur un motif inexistant.
    mockSigner.mockRejectedValue(
      new SignatureStockageError("upload_echoue", "Écriture R2 impossible"),
    );

    const r = await signerDepuisPortailAction(entree());

    expect(r).toMatchObject({ ok: false, raison: "stockage" });
    if (!r.ok) expect(r.message).toContain("formateur");
  });

  it("répercute tel quel le message d'un échec imputable au client", async () => {
    mockSigner.mockRejectedValue(
      new SignatureStockageError("image_illisible", "Le tracé est illisible."),
    );
    const r = await signerDepuisPortailAction(entree());
    if (!r.ok) expect(r.message).toBe("Le tracé est illisible.");
  });

  it("laisse remonter une erreur INATTENDUE plutôt que de la maquiller", async () => {
    // Un refus fabriqué sur une panne inconnue masquerait l'incident.
    mockSigner.mockRejectedValue(new Error("panne réseau"));
    await expect(signerDepuisPortailAction(entree())).rejects.toThrow("panne réseau");
  });

  it("répercute un refus métier sans le réécrire", async () => {
    mockSigner.mockResolvedValue({
      ok: false,
      raison: "porteur_non_autorise",
      message: "Ce lien ne correspond pas à cette feuille.",
    });
    const r = await signerDepuisPortailAction(entree());
    expect(r).toMatchObject({ ok: false, raison: "porteur_non_autorise" });
  });
});
