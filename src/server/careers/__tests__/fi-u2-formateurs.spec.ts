// @vitest-environment node

/**
 * LOT U2 — trois portes fermées aux candidatures de formateur :
 *  1. la réponse automatique « poste pourvu » (formateur FREELANCE, même spontanée) ;
 *  2. la proposition automatique du réseau d'apporteurs (TOUT formateur) ;
 *  3. l'alerte de dormance JOB_APPLICATIONS_STALE (formateur FREELANCE).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const reglage = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ value: { actif: true } }));
const lister = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const compter = vi.fn(async (..._a: unknown[]) => 0);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: async () => [],
    setting: { findUnique: (...a: unknown[]) => reglage(...a) },
    jobApplication: {
      findMany: (...a: unknown[]) => lister(...a),
      count: (...a: unknown[]) => compter(...a),
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
const repondre = vi.fn(async (..._a: unknown[]) => ({ ecrit: true, enfile: true, replyId: "r" }));
vi.mock("@/features/admin-job-applications/envoyer-reponse", () => ({
  ecrireEtEnfilerReponse: (...a: unknown[]) => repondre(...a),
}));
vi.mock("@/features/commercial-application/invitation-auto", () => ({
  lienReservationAuto: () => "https://calendly.com/axion/echange",
}));
const creer = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
  ok: true,
  submissionId: "fiche-1",
}));
vi.mock("@/features/admin-job-applications/fiche-apporteur-depuis-candidature", () => ({
  creerFicheApporteurDepuisCandidature: (...a: unknown[]) => creer(...a),
}));
const inviter = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  envoyerInvitationApporteur: (...a: unknown[]) => inviter(...a),
}));
vi.mock("@/features/admin-job-applications/journal", () => ({ consignerEvenement: vi.fn() }));
const notifie: unknown[] = [];
vi.mock("@/server/notifications", () => ({
  notify: vi.fn(async (e: unknown) => {
    notifie.push(e);
  }),
}));

const { critereEligible, passerReponsePostePourvu } = await import("../reponse-poste-pourvu");
const { preparerProposition } = await import("../proposer-reseau-auto");
const { listerDossiersEnSommeil, signalerDossiersEnSommeil } =
  await import("../dossiers-en-sommeil");

const JOUR = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  lister.mockResolvedValue([]);
  notifie.length = 0;
});

describe("1. « poste pourvu » — jamais pour un formateur freelance", () => {
  const MAINTENANT = new Date("2026-10-20T10:00:00Z");
  const spontanee = {
    id: "spont-1",
    email: "chiffre",
    locale: "fr",
    status: "new",
    offerTitleSnap: "Candidature spontanée — Formateur IA indépendant",
    firstName: "Prenom",
    submittedAt: new Date("2026-10-01T09:00:00Z"),
    offer: null,
  };

  it("🔴 le critère exclut aussi les intitulés « formatrice » et « indépendant »", () => {
    const texte = JSON.stringify(critereEligible(MAINTENANT));
    expect(texte).toContain("formateur-ia-freelance");
    expect(texte).toContain("formatrice");
    expect(texte).toContain("indépendant");
    expect(texte).toContain("CONTRACTOR");
  });

  it("🔴 une spontanée « Formateur IA indépendant » ne reçoit pas « poste pourvu »", async () => {
    lister.mockResolvedValue([spontanee]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(repondre).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("🔴 une candidature sur une COPIE de l'offre freelance non plus", async () => {
    lister.mockResolvedValue([
      {
        ...spontanee,
        id: "clone-1",
        offerTitleSnap: "Formateur IA",
        offer: {
          slug: "formateur-ia-freelance-2",
          titleFr: "Formateur IA",
          employmentType: "CONTRACTOR",
        },
      },
    ]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(repondre).not.toHaveBeenCalled();
  });

  it("contre-témoin : un rédacteur web la reçoit toujours", async () => {
    lister.mockResolvedValue([{ ...spontanee, offerTitleSnap: "Rédacteur web" }]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(repondre).toHaveBeenCalledTimes(1);
  });
});

describe("2. proposition apporteur — jamais pour un candidat formateur", () => {
  const candidature = (offerTitleSnap: string, offer: Record<string, unknown> | null = null) => [
    { id: "app-1", offerTitleSnap, offer },
  ];

  it("🔴 formateur SALARIÉ (offre itinérante) : pas de fiche apporteur", async () => {
    lister.mockResolvedValue(
      candidature("Formateur IA en entreprise (itinérant)", {
        slug: "formateur-ia-itinerant",
        titleFr: "Formateur IA en entreprise (itinérant)",
        employmentType: "FULL_TIME",
      }),
    );
    const r = await preparerProposition("app-1", "poste-pourvu");
    expect(r.fiche).toBe("impossible");
    expect(creer).not.toHaveBeenCalled();
  });

  it("🔴 spontanée « Formateur commercial » : pas de fiche apporteur", async () => {
    lister.mockResolvedValue(candidature("Candidature spontanée — Formateur commercial"));
    const r = await preparerProposition("app-1", "spontanee-commerciale");
    expect(r.fiche).toBe("impossible");
    expect(creer).not.toHaveBeenCalled();
  });

  it("🔴 formatrice freelance : pas de fiche apporteur", async () => {
    lister.mockResolvedValue(candidature("Candidature spontanée — Formatrice freelance"));
    expect((await preparerProposition("app-1", "poste-pourvu")).fiche).toBe("impossible");
  });

  it("contre-témoin : un commercial reçoit toujours la proposition", async () => {
    lister.mockResolvedValue(candidature("Candidature spontanée — Commercial terrain"));
    expect(await preparerProposition("app-1", "spontanee-commerciale")).toEqual({
      fiche: "creee",
      submissionId: "fiche-1",
    });
  });
});

describe("3. alerte de dormance — sans les formateurs freelance", () => {
  const MAINTENANT = new Date("2026-10-20T10:00:00Z");
  const ligne = (p: Record<string, unknown>) => ({
    id: "a1",
    offerTitleSnap: "Rédacteur web",
    status: "new",
    submittedAt: new Date(MAINTENANT.getTime() - 10 * JOUR),
    firstResponseAt: null,
    lastActivityAt: null,
    firstName: "Prenom",
    lastName: "Nom",
    offer: null,
    ...p,
  });

  it("🔴 une candidature freelance de 10 jours n'entre pas dans l'alerte", async () => {
    lister.mockResolvedValue([
      ligne({
        id: "freelance",
        offerTitleSnap: "Candidature spontanée — Formateur IA indépendant",
      }),
      ligne({
        id: "offre-freelance",
        offerTitleSnap: "Formateur IA",
        offer: {
          slug: "formateur-ia-freelance",
          titleFr: "Formateur IA",
          employmentType: "CONTRACTOR",
        },
      }),
    ]);
    const bilan = await signalerDossiersEnSommeil(MAINTENANT);
    expect(bilan.dossiers).toEqual([]);
    expect(notifie).toEqual([]);
  });

  it("contre-témoin : le formateur SALARIÉ et le rédacteur y restent", async () => {
    lister.mockResolvedValue([
      ligne({ id: "salarie", offerTitleSnap: "Formateur IA en entreprise (itinérant)" }),
      ligne({ id: "redacteur" }),
    ]);
    const bilan = await listerDossiersEnSommeil(MAINTENANT, "admin");
    expect(bilan.dossiers.map((d) => d.id).sort()).toEqual(["redacteur", "salarie"]);
  });
});
