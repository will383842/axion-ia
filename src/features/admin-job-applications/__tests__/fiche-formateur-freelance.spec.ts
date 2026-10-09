// U6 — chantier « formateurs freelance » : le bouton « Créer la fiche
// formateur » depuis une candidature.
//
// Ce que ces tests protègent :
//   · une candidature FREELANCE crée une fiche de SOUS-TRAITANT, sans attendre
//     « Recrutée », et l'action n'écrit AUCUN statut de recrutement ;
//   · la fiche d'un sous-traitant naît INACTIVE (refus de `actif: true`) et SANS
//     `cvUrl` : le CV de candidature n'est pas une pièce vérifiée (ind. 21) ;
//   · quand rien ne dit le statut, l'action REFUSE et demande le choix ;
//   · le geste est réservé à la direction (`contresigner`) ;
//   · une adresse déjà connue est RATTACHÉE, jamais dupliquée.

import { describe, it, expect, vi, beforeEach } from "vitest";

const APP_ID = "33333333-3333-4333-8333-333333333333";
const TRAINER_ID = "44444444-4444-4444-8444-444444444444";
const EXISTANT_ID = "55555555-5555-4555-8555-555555555555";

let candidature: Record<string, unknown> | null;
let session: { user?: { id?: string; role?: string; name?: string } } | null;
let formateurExistant: { id: string } | null;

const lireCandidature = vi.fn(async (_a: unknown) => candidature as unknown);
const lier = vi.fn(async (_a: unknown) => ({ count: 1 }));
const majCandidature = vi.fn(async (_a: unknown) => ({}));
const lireFormateur = vi.fn(async (_a: unknown) => formateurExistant);
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
      update: (a: unknown) => majCandidature(a),
    },
    trainer: { findUnique: (a: unknown) => lireFormateur(a) },
    jobApplicationEvent: { create: (a: unknown) => evenement(a) },
    activityLog: { create: (a: unknown) => journalConsole(a) },
  },
}));
vi.mock("@/server/actions/qualiopi/trainers", () => ({
  createTrainerAction: (a: unknown) => creerFormateur(a),
}));

const { creerFicheFormateurDepuisCandidatureAction } = await import("../fiche-formateur-actions");

beforeEach(() => {
  vi.clearAllMocks();
  formateurExistant = null;
  // Spontanée, pas encore recrutée : le freelance n'attend pas « Recrutée ».
  candidature = {
    id: APP_ID,
    status: "interview",
    trainerId: null,
    offerTitleSnap: "Formateur IA indépendant",
    offer: null,
    firstName: "chiffre(Alex)",
    lastName: "chiffre(Exemple)",
    email: "chiffre(alex@example.com)",
    phone: "chiffre(0600000000)",
    cvStoragePath: "cv/xyz.pdf",
  };
  session = { user: { id: "admin-1", role: "admin", name: "Direction" } };
  creerFormateur.mockResolvedValue({ data: { id: TRAINER_ID } });
});

function argumentsCreation(): Record<string, unknown> {
  return creerFormateur.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("fiche formateur depuis une candidature FREELANCE", () => {
  it("crée un sous-traitant inactif, sans cvUrl, sans attendre « Recrutée »", async () => {
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: true, trainerId: TRAINER_ID });
    const a = argumentsCreation();
    expect(a).toMatchObject({ statut: "sous_traitant", actif: false });
    expect(a["cvUrl"] ?? "").toBe("");
  });

  it("n'écrit AUCUN statut de recrutement : seul trainerId est posé", async () => {
    await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(majCandidature).not.toHaveBeenCalled();
    expect(lier).toHaveBeenCalledWith({
      where: { id: APP_ID, trainerId: null },
      data: { trainerId: TRAINER_ID },
    });
  });

  it("offre FULL_TIME étiquetée freelance → sous_traitant", async () => {
    candidature = {
      ...candidature,
      offerTitleSnap: "Formateur IA freelance (F/H)",
      offer: {
        slug: "formateur-ia-freelance",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      },
    };
    await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(argumentsCreation()).toMatchObject({ statut: "sous_traitant", actif: false });
  });

  it("refuse `actif: true` pour un sous-traitant", async () => {
    const r = await creerFicheFormateurDepuisCandidatureAction({
      applicationId: APP_ID,
      actif: true,
    });
    expect(r).toMatchObject({ ok: false, erreur: "champs-invalides" });
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("la mention dit « à confirmer dans le dossier », jamais « le formulaire ne le demande pas »", async () => {
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    if (!r.ok) throw new Error("création attendue");
    expect(r.mention).toBe("Numéro de déclaration d'activité à confirmer dans le dossier");
  });
});

describe("statut indéterminé : on ne devine pas", () => {
  it("spontanée « Formateur IA » sans indice → refus, choix demandé", async () => {
    candidature = { ...candidature, status: "hired", offerTitleSnap: "Formateur IA" };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: false, erreur: "statut-a-choisir" });
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("avec le choix explicite de l'administrateur, la fiche se crée", async () => {
    candidature = { ...candidature, status: "hired", offerTitleSnap: "Formateur IA" };
    const r = await creerFicheFormateurDepuisCandidatureAction({
      applicationId: APP_ID,
      statut: "salarie",
    });
    expect(r).toMatchObject({ ok: true });
    expect(argumentsCreation()).toMatchObject({ statut: "salarie", actif: false });
  });
});

describe("garde et anti-doublon", () => {
  it("un `editor` est refusé, sans lecture ni écriture", async () => {
    session = { user: { id: "u2", role: "editor", name: "Ed" } };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: false, erreur: "non-autorise" });
    expect(lireCandidature).not.toHaveBeenCalled();
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("un rôle qui ne contresigne pas (secrétariat) est refusé", async () => {
    session = { user: { id: "u3", role: "secretaire", name: "S" } };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: false, erreur: "non-autorise" });
    expect(creerFormateur).not.toHaveBeenCalled();
  });

  it("adresse déjà connue : la candidature est RATTACHÉE, aucune seconde fiche", async () => {
    formateurExistant = { id: EXISTANT_ID };
    const r = await creerFicheFormateurDepuisCandidatureAction({ applicationId: APP_ID });
    expect(r).toMatchObject({ ok: true, trainerId: EXISTANT_ID, rattachee: true });
    expect(creerFormateur).not.toHaveBeenCalled();
    expect(lier).toHaveBeenCalledWith({
      where: { id: APP_ID, trainerId: null },
      data: { trainerId: EXISTANT_ID },
    });
    expect(majCandidature).not.toHaveBeenCalled();
  });
});
