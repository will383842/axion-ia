/**
 * Aperçu RECONSTITUÉ d'une invitation apporteur partie avant la conservation
 * des copies (2026-09-27).
 *
 * Gardé ici :
 *   · (le bandeau « Reconstitué — ce n'est pas la copie d'origine » est gardé
 *     côté écran : `emails-envoyes/[id]/__tests__/l-apercu-reconstitue-est-bande-a-l-ecran`) ;
 *   · 🔴 la signature suit la DATE : les 31 premières invitations du 27/09,
 *     parties avant ~18:15 UTC, n'en portaient pas — l'aperçu non plus ;
 *   · avant le déploiement de « ta candidature est retenue » (15:31 UTC), on
 *     ne reconstitue rien : le gabarit était trop différent ;
 *   · le prénom vient de la fiche, l'objet suit `varianteObjet`, le lien du
 *     dossier suit la règle de l'envoi, et le lien d'opposition est masqué.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  fiche: null as unknown,
  lignes: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: async () => d.fiche,
      findMany: async () => d.lignes,
    },
    // Bandeau de confiance du châssis : sans avis, il se tait.
    customerReview: { aggregate: async () => ({ _avg: { rating: null }, _count: { _all: 0 } }) },
  },
}));

import {
  CHARNIERE_CANDIDATURE,
  CHARNIERE_SIGNATURE,
  reconstituerInvitation,
  reglesDeRenduInvitation,
} from "../reconstitution-invitation";
import { varianteObjet } from "@/features/commercial-application/invitation-apporteur";
import { renderEmailTemplate } from "@/lib/email/templates";
import type { DetailEmail } from "../detail";

const SUB = "9d7c6b5a-4e3f-4a2b-9c1d-0e1f2a3b4c5d";

function ligne(sentAt: Date): DetailEmail {
  return {
    id: "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b",
    template: "apporteur-invitation-appel",
    recipient: "camille.dupont@example.invalid",
    locale: "fr",
    marketing: false,
    status: "sent",
    attempts: 1,
    error: null,
    bounceType: null,
    bounceReason: null,
    bouncedAt: null,
    sentAt,
    failedAt: null,
    dueAt: null,
    createdAt: sentAt,
    entityType: "Submission",
    entityId: SUB,
    providerMessageId: null,
    copie: null,
  };
}

const AVANT_SIGNATURE = new Date("2026-09-27T17:40:00Z"); // 19:40 à Paris
const APRES_SIGNATURE = new Date("2026-09-27T19:30:00Z");

beforeEach(() => {
  process.env["CALENDLY_APPORTEUR_URL"] = "https://calendly.com/axion-ia/echange-apporteur-15-min";
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
  d.fiche = {
    id: SUB,
    contactName: "Camille Dupont",
    contactEmailHash: "empreinte",
    // Candidature venue du formulaire (pas une saisie manuelle), au stade du
    // premier contact : le dossier complet n'est pas encore arrivé.
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      etape: "premier-contact",
    },
    deletedAt: null,
  };
  d.lignes = [];
});

describe("les dates charnières (règle pure)", () => {
  it("avant 15:31 UTC : pas de reconstitution ; entre les deux : sans signature ; après : signée", () => {
    expect(reglesDeRenduInvitation(new Date("2026-09-27T12:00:00Z")).reconstituable).toBe(false);
    const entre = reglesDeRenduInvitation(AVANT_SIGNATURE);
    expect(entre).toEqual({ reconstituable: true, signature: false, incertain: false });
    const apres = reglesDeRenduInvitation(APRES_SIGNATURE);
    expect(apres).toEqual({ reconstituable: true, signature: true, incertain: false });
  });

  it("un envoi à moins de 20 minutes d'une charnière est dit incertain", () => {
    expect(
      reglesDeRenduInvitation(new Date(CHARNIERE_SIGNATURE.getTime() - 5 * 60_000)).incertain,
    ).toBe(true);
    expect(
      reglesDeRenduInvitation(new Date(CHARNIERE_CANDIDATURE.getTime() + 5 * 60_000)).incertain,
    ).toBe(true);
  });
});

describe("🔴 la signature suit la date d'envoi", () => {
  it("témoin : le gabarit d'aujourd'hui SIGNE l'invitation d'un candidat", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      contactName: "Camille",
      calendlyUrl: "https://calendly.com/axion-ia/x",
      candidature: true,
    });
    expect(r.html).toContain("Williams Jullin");
  });

  it("partie AVANT 18:15 UTC : l'aperçu n'est pas signé", async () => {
    const a = await reconstituerInvitation(ligne(AVANT_SIGNATURE));
    if (!a.ok) throw new Error(a.motif);
    expect(a.regles.signature).toBe(false);
    expect(a.html).not.toContain("Williams Jullin");
    // …mais c'est bien l'invitation « candidature » de ce jour-là.
    expect(a.html).toMatch(/est retenue pour l(?:&#x27;|')étape suivante/);
  });

  it("partie APRÈS : l'aperçu est signé", async () => {
    const a = await reconstituerInvitation(ligne(APRES_SIGNATURE));
    if (!a.ok) throw new Error(a.motif);
    expect(a.html).toContain("Williams Jullin");
  });

  it("partie avant « ta candidature est retenue » : aucune reconstitution, et c'est dit", async () => {
    const a = await reconstituerInvitation(ligne(new Date("2026-09-25T10:00:00Z")));
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.motif).toMatch(/gabarit a changé/);
  });
});

describe("les données de l'aperçu suivent la règle de l'envoi", () => {
  it("prénom de la fiche, objet de `varianteObjet`, lien du dossier, opposition masquée", async () => {
    const a = await reconstituerInvitation(ligne(APRES_SIGNATURE));
    if (!a.ok) throw new Error(a.motif);
    expect(a.html).toContain("Bonjour Camille,");
    const attendu = (
      await renderEmailTemplate("apporteur-invitation-appel", "fr", {
        contactName: "Camille",
        calendlyUrl: "https://calendly.com/axion-ia/x",
        candidature: true,
        variante: varianteObjet(SUB),
      })
    ).subject;
    expect(a.subject).toBe(attendu);
    // Dossier pas encore arrivé (la seule ligne est un premier contact) : le lien y est.
    expect(a.html).toContain("/devenir-commercial-ia/candidature");
    // Le lien de réservation public reste lisible, le jeton d'opposition non.
    expect(a.html).toContain("https://calendly.com/axion-ia/echange-apporteur-15-min");
    expect(a.html).toContain("api/unsubscribe?token=[masqué]");
  });

  it("2026-09-28 — une fiche née d'une candidature à une OFFRE D'EMPLOI se reconstitue en variante « offre »", async () => {
    d.fiche = {
      ...(d.fiche as object),
      details: {
        unifiedType: "recrutement",
        subType: "candidature-commerciale",
        etape: "premier-contact",
        origine: "candidature-offre-emploi",
        offreTitre: "Business Developer B2B",
      },
    };
    const a = await reconstituerInvitation(ligne(APRES_SIGNATURE));
    if (!a.ok) throw new Error(a.motif);
    expect(a.subject).toBe("Ta candidature chez Axion-IA : une autre proposition");
    expect(a.html).toContain("Business Developer B2B");
    expect(a.html).not.toMatch(/candidature apporteur d(?:&#x27;|')affaires/i);
    expect(a.html).not.toMatch(/est retenue/);
    expect(a.html).toContain("Williams Jullin");
  });

  it("une fiche effacée (art. 17) n'est pas reconstituée", async () => {
    d.fiche = { ...(d.fiche as object), contactName: "[erased-rgpd-art17]" };
    const a = await reconstituerInvitation(ligne(APRES_SIGNATURE));
    expect(a.ok).toBe(false);
  });
});
