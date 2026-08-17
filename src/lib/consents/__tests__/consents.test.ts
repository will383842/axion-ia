import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * REGISTRE DE PREUVE DES CONSENTEMENTS (lot L4).
 *
 * Deux propriétés y sont non négociables, et sont testées ici :
 *  1. il n'écrit JAMAIS d'adresse en clair — seulement une empreinte ;
 *  2. il ne fait JAMAIS échouer une capture de lead, quoi qu'il arrive.
 */

const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { consentEvent: { create: (...args: unknown[]) => createMock(...args) } },
}));

// ⚠️ Le faux hachage doit être un VRAI condensat (hex), pas `hash-<email>` :
// avec un préfixe qui embarque l'adresse, l'assertion « aucune adresse en
// clair » ci-dessous échouerait sur un artefact de test — ou pire, passerait
// pour une fuite là où il n'y en a pas. Le double de la fonction doit
// ressembler à la fonction.
vi.mock("@/lib/security/email-hash", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  hashEmailForLookup: (email: string | null | undefined) => {
    if (!email) return null;
    return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  },
}));

vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null) => {
    if (ip === "boom") throw new Error("IP_HASH_SALT manquant");
    return ip ? `iphash-${ip}` : null;
  },
}));

import { CONSENT_FORM_REFS, recordConsentEvent } from "../index";

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

describe("registre de preuve", () => {
  it("écrit une empreinte, JAMAIS l'adresse en clair", async () => {
    const ok = await recordConsentEvent({
      email: "Jean.Test@Example.Invalid",
      formRef: CONSENT_FORM_REFS.jobApplication,
      consentVersion: "careers-v2-2026-08-13",
      action: "optin",
      ip: "203.0.113.4",
      userAgent: "vitest",
    });

    expect(ok).toBe(true);

    const data = createMock.mock.calls[0]?.[0]?.data;
    // La casse et les espaces sont normalisés AVANT hachage : sans cela, la
    // même personne aurait deux clés selon la façon dont elle a tapé son
    // adresse, et son historique de consentement serait coupé en deux.
    expect(data.personKey).toBe(
      createHash("sha256").update("jean.test@example.invalid").digest("hex"),
    );
    expect(data.action).toBe("optin");
    expect(data.consentVersion).toBe("careers-v2-2026-08-13");

    // La garantie qui compte : l'adresse n'apparaît NULLE PART dans la ligne.
    // Un registre de preuve RGPD qui serait un annuaire d'emails serait une
    // régression, pas une garantie.
    expect(JSON.stringify(data)).not.toContain("Jean.Test");
    expect(JSON.stringify(data)).not.toContain("jean.test@example.invalid");
  });

  it("ne lève pas et n'empêche rien quand la base tombe", async () => {
    createMock.mockRejectedValueOnce(new Error("base indisponible"));

    await expect(
      recordConsentEvent({
        email: "x@example.invalid",
        formRef: CONSENT_FORM_REFS.newsletter,
        consentVersion: "newsletter-v1-2026-08-13",
        action: "optin",
      }),
    ).resolves.toBe(false);
  });

  it("consigne quand même la preuve si le hachage de l'IP échoue", async () => {
    // L'adresse IP n'est qu'un élément de contexte : son absence ne doit
    // jamais empêcher d'enregistrer le consentement lui-même.
    const ok = await recordConsentEvent({
      email: "x@example.invalid",
      formRef: CONSENT_FORM_REFS.unifiedContact,
      consentVersion: "v1-2026-05-24",
      action: "optin",
      ip: "boom",
    });

    expect(ok).toBe(true);
    expect(createMock.mock.calls[0]?.[0]?.data.ipHash).toBeNull();
  });

  it("le retrait s'AJOUTE, il n'efface pas l'accord", async () => {
    await recordConsentEvent({
      email: "x@example.invalid",
      formRef: CONSENT_FORM_REFS.newsletter,
      consentVersion: "newsletter-v1-2026-08-13",
      action: "optout",
    });

    // Une création, jamais une suppression ni une mise à jour : l'historique
    // EST la preuve, le réécrire la détruirait.
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]?.data.action).toBe("optout");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTIÈRE DU CONTRAT — versions v2
// ─────────────────────────────────────────────────────────────────────────────

describe("versions de consentement v2", () => {
  it("pinne les valeurs FERMES attendues par le CRM", async () => {
    // 🔴 Le CRM REJETTE en 422 toute fiche candidat dont la version n'est pas
    // exactement l'une de celles-ci. Changer une de ces chaînes sans la porter
    // DANS LE MÊME LOT côté CRM ferait perdre toutes les candidatures.
    const { COMMERCIAL_APPLICATION_CONSENT_VERSION } =
      await import("@/lib/commercial-application/model");

    expect(COMMERCIAL_APPLICATION_CONSENT_VERSION).toBe("memo-v2-2026-08-13");
    // La version carrières vit dans une constante privée de sa Server Action :
    // elle est pinnée par le test d'intégration du formulaire. On vérifie ici
    // ce qui est importable sans monter tout le module serveur.
    expect(COMMERCIAL_APPLICATION_CONSENT_VERSION.length).toBeLessThanOrEqual(40);
  });

  it("les références de formulaire distinguent les DEUX finalités", () => {
    // Étudier une candidature et la conserver 2 ans en vivier sont deux
    // finalités distinctes : si elles partageaient la même référence, on ne
    // pourrait plus prouver laquelle a été acceptée.
    expect(CONSENT_FORM_REFS.jobApplication).not.toBe(CONSENT_FORM_REFS.jobApplicationVivier);
    expect(CONSENT_FORM_REFS.commercialApplication).not.toBe(
      CONSENT_FORM_REFS.commercialApplicationVivier,
    );
  });
});
