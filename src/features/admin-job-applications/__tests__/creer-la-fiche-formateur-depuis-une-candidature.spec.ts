// L10 — « Retenue → fiche formateur » (chantier « candidatures unifiées »,
// paquet 4a).
//
// Ce que ces tests protègent :
//   · la fiche est créée par l'action EXISTANTE `createTrainerAction` (aucune
//     seconde écriture de `Trainer` ailleurs), pré-remplie : nom, prénom,
//     e-mail, téléphone, CV ;
//   · sans numéro de déclaration d'activité, la fiche naît INACTIVE, et la
//     mention « numéro de déclaration à demander » se lit ;
//   · `JobApplication.trainerId` est rempli ; un second clic ne crée rien et
//     renvoie vers la fiche existante ;
//   · seule une candidature RECRUTÉE à une offre de FORMATEUR SALARIÉ ouvre la
//     passerelle (le freelance : cf. `fiche-formateur-freelance.spec.ts`) ;
//   · un rôle qui n'ouvre pas le dossier candidat n'écrit rien ;
//
// U6 (chantier « formateurs freelance ») a changé quatre règles que ce fichier
// figeait : geste réservé à la direction (la session est `admin`), aucun
// `cvUrl` pour un sous-traitant, mention « à confirmer dans le dossier », et
// un freelance n'attend plus « Recrutée ».
//   · le geste est tracé au journal d'activité et dans la frise.

import { describe, it, expect, vi, beforeEach } from "vitest";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const TRAINER_ID = "22222222-2222-4222-8222-222222222222";

let candidature: Record<string, unknown> | null;
let session: { user?: { id?: string; role?: string; name?: string } } | null;

const lireCandidature = vi.fn(async (_a: unknown) => candidature as unknown);
const lier = vi.fn(async (_a: unknown) => ({ count: 1 }));
const evenement = vi.fn(async (_a: unknown) => ({ id: "evt" }));
const journalConsole = vi.fn(async (_a: unknown) => ({ id: "log" }));
const creerFormateur = vi.fn(
  async (_a: unknown) =>
    ({ data: { id: TRAINER_ID } }) as { data: { id: string } } | { error: string },
);

vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "https://axion-ia.com" } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `chiffre(${v})`,
  decryptPii: (v: string) => String(v).replace(/^chiffre\(|\)$/g, ""),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: (a: unknown) => lireCandidature(a),
      updateMany: (a: unknown) => lier(a),
    },
    jobApplicationEvent: { create: (a: unknown) => evenement(a) },
    activityLog: { create: (a: unknown) => journalConsole(a) },
    trainer: { findUnique: async () => null },
  },
}));
vi.mock("@/server/actions/qualiopi/trainers", () => ({
  createTrainerAction: (a: unknown) => creerFormateur(a),
}));

const { creerFicheFormateurDepuisCandidatureAction } = await import("../fiche-formateur-actions");
const { mentionActivationFormateur, peutCreerFicheFormateur, estOffreFormateur } =
  await import("@/lib/careers/fiche-formateur");

beforeEach(() => {
  vi.clearAllMocks();
  candidature = {
    id: APP_ID,
    status: "hired",
    trainerId: null,
    offerTitleSnap: "Formateur / Intervenant IA en entreprise (F/H)",
    offer: {
      slug: "formateur-ia-itinerant",
      employmentType: "CONTRACTOR",
      secondaryEmploymentType: null,
    },
    firstName: "chiffre(Caroline)",
    lastName: "chiffre(Cochard)",
    email: "chiffre(caroline.cochard@example.com)",
    phone: "chiffre(06 12 34 56 78)",
    cvStoragePath: "cv/abc.pdf",
  };
  session = { user: { id: "admin-1", role: "admin", name: "Sophie" } };
  creerFormateur.mockResolvedValue({ data: { id: TRAINER_ID } });
});

function argumentsCreation(): Record<string, unknown> {
  return creerFormateur.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("creerFicheFormateurDepuisCandidatureAction", () => {
  it("crée la fiche par l'action existante, pré-remplie, INACTIVE faute de numéro de déclaration", async () => {
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: true, trainerId: TRAINER_ID });
    if (r.ok) {
      expect(r.lien).toMatch(new RegExp(`/qualiopi/formateurs/${TRAINER_ID}$`));
      expect(r.mention).toBe("Numéro de déclaration d'activité à confirmer dans le dossier");
    }
    expect(creerFormateur).toHaveBeenCalledTimes(1);
    const a = argumentsCreation();
    expect(a).toMatchObject({
      prenom: "Caroline",
      nom: "Cochard",
      email: "caroline.cochard@example.com",
      telephone: "06 12 34 56 78",
      statut: "sous_traitant",
      actif: false,
    });
    // Sous-traitant : le CV de candidature n'est pas une pièce vérifiée (ind. 21).
    expect(a).not.toHaveProperty("cvUrl");
    expect(a).not.toHaveProperty("sousTraitantNda");
  });

  it("remplit trainerId sans écraser un lien posé entre-temps", async () => {
    await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(lier).toHaveBeenCalledWith({
      where: { id: APP_ID, trainerId: null },
      data: { trainerId: TRAINER_ID },
    });
  });

  it("trace le geste : frise de la candidature ET journal d'activité, sans donnée personnelle", async () => {
    await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    const e = evenement.mock.calls[0]?.[0] as { data: { type: string; summary: string } };
    expect(e.data.type).toBe("note");
    expect(e.data.summary).toMatch(/^Fiche formateur créée le \d{2}\/\d{2} — inactive/);
    const log = journalConsole.mock.calls[0]?.[0] as {
      data: { action: string; targetType: string; targetId: string; changes: object };
    };
    expect(log.data).toMatchObject({
      action: "careers.candidature.fiche_formateur_creee",
      targetType: "JobApplication",
      targetId: APP_ID,
      changes: { trainerId: TRAINER_ID, actif: false },
    });
    expect(JSON.stringify(log.data)).not.toMatch(/Caroline|Cochard|example\.com/);
  });

  it("un second clic ne crée PAS de doublon : il renvoie la fiche existante", async () => {
    candidature = { ...candidature, trainerId: TRAINER_ID };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: true, deja: true, trainerId: TRAINER_ID });
    expect(creerFormateur).not.toHaveBeenCalled();
    expect(lier).not.toHaveBeenCalled();
  });

  it("refuse une candidature non recrutée, ou à une offre qui n'est pas de formateur", async () => {
    candidature = {
      ...candidature,
      status: "interview",
      offer: {
        slug: "formateur-ia-sedentaire",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      },
    };
    const r1 = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r1).toMatchObject({ ok: false, erreur: "non-eligible" });

    candidature = {
      ...candidature,
      status: "hired",
      offerTitleSnap: "Développeur web",
      offer: {
        slug: "developpeur-web",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      },
    };
    const r2 = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r2).toMatchObject({ ok: false, erreur: "non-eligible" });
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("un rôle qui n'ouvre pas le dossier candidat n'écrit rien", async () => {
    session = { user: { id: "u2", role: "editor", name: "Ed" } };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: false, erreur: "non-autorise" });
    expect(lireCandidature).not.toHaveBeenCalled();
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("e-mail déjà porté par un formateur : rien n'est lié, le message le dit", async () => {
    creerFormateur.mockResolvedValue({ error: "Un formateur avec cet email existe déjà." });
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: false, erreur: "echec" });
    if (!r.ok) expect(r.message).toMatch(/existe déjà/);
    expect(lier).not.toHaveBeenCalled();
  });

  it("offre salariée : statut salarié, mais toujours inactive sans numéro", async () => {
    candidature = {
      ...candidature,
      offer: {
        slug: "formateur-ia-sedentaire",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      },
      cvStoragePath: null,
    };
    await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    const a = argumentsCreation();
    expect(a).toMatchObject({ statut: "salarie", actif: false });
    expect(a).not.toHaveProperty("cvUrl");
  });
});

describe("règles pures de la passerelle", () => {
  it("une offre de formateur se reconnaît au slug ou au titre figé", () => {
    expect(estOffreFormateur("formateur-ia-itinerant", "x")).toBe(true);
    expect(estOffreFormateur(null, "Formatrice IA (F/H)")).toBe(true);
    expect(estOffreFormateur("developpeur-web", "Développeur web")).toBe(false);
  });

  it("seule une candidature recrutée ouvre la passerelle", () => {
    const base = { offerTitleSnap: "Formateur IA", offer: { slug: "formateur-ia-itinerant" } };
    expect(peutCreerFicheFormateur({ ...base, status: "hired" })).toBe(true);
    for (const s of ["new", "offer", "rejected", "archived"] as const) {
      expect(peutCreerFicheFormateur({ ...base, status: s })).toBe(false);
    }
  });

  it("la mention se lit tant que la fiche est inactive et sans numéro", () => {
    expect(mentionActivationFormateur({ actif: false, sousTraitantNda: null })).toBe(
      "Numéro de déclaration d'activité à confirmer dans le dossier",
    );
    expect(mentionActivationFormateur({ actif: false, sousTraitantNda: "84380000000" })).toBeNull();
    expect(mentionActivationFormateur({ actif: true, sousTraitantNda: null })).toBeNull();
  });
});
