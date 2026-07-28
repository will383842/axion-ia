/**
 * Tests — signature-afest-service.ts
 *
 * C'est le seul endroit du dépôt qui écrit une signature AFEST. Quatre familles
 * d'invariants, et les violer ne se voit pas en revue de diff :
 *
 *  1. **Autorisation avant tout.** Un jeton `tuteur` ne doit pas pouvoir écrire
 *     une ligne `beneficiaire`, et un lien transféré ne doit pas signer au nom
 *     du destinataire initial (binding e-mail).
 *  2. **Aucune écriture sur un refus.** Ni objet R2, ni ligne.
 *  3. **L'identité vient du serveur.** Jamais du client, et jamais d'un repli
 *     littéral « Bénéficiaire » — qui produirait une signature anonyme.
 *  4. **Le chaînage est réel**, relu DANS la transaction, trié sur `createdAt`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    compteRenduSeance: { findUnique: vi.fn(), update: vi.fn() },
    coachingSeanceSignature: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    coachingSession: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage, supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import {
  signerSeanceAfest,
  revoquerSignatureSeance,
  empreinteEmail,
  type PorteurSignatureAfest,
} from "./signature-afest-service";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import {
  maillonSeanceDepuisLigne,
  HASH_VERSION_SEANCE,
  type LigneSeanceSignature,
} from "./seance-signature-hash";
import { MENTION_VERSION_AFEST } from "./mentions-afest";
import { Prisma } from "../../../../../prisma/generated/client";

const mockPrisma = prisma as unknown as {
  compteRenduSeance: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  coachingSeanceSignature: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  coachingSession: { update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockStore = storeSignatureImage as unknown as ReturnType<typeof vi.fn>;
const mockSupprimerImage = supprimerImageSignature as unknown as ReturnType<typeof vi.fn>;

const COACHING = "11111111-1111-4111-8111-111111111111";
const SEANCE = "22222222-2222-4222-8222-222222222222";
const TRAINER = "33333333-3333-4333-8333-333333333333";
const IMAGE = "data:image/png;base64,AAAA";

/** 10 juin 2026, 09:00 Paris = 07:00 UTC. Séance de 150 min → fin 11:30 Paris. */
const DEBUT_SEANCE = new Date("2026-06-10T07:00:00.000Z");
const MAINTENANT = new Date("2026-06-10T09:45:00.000Z"); // 11:45 Paris, séance finie

const EMAIL_BENEF = "camille.durand@example.test";
const EMAIL_TUTEUR = "tuteur@entreprise.test";

const PORTEUR_FORMATEUR_POSTE: PorteurSignatureAfest = {
  type: "poste_formateur",
  trainerId: TRAINER,
  role: "beneficiaire",
};

function lienTuteur(over: Partial<Extract<PorteurSignatureAfest, { type: "lien" }>> = {}) {
  return {
    type: "lien" as const,
    coachingId: COACHING,
    tokenId: "44444444-4444-4444-8444-444444444444",
    role: "tuteur" as const,
    destinataireEmailSha256: empreinteEmail(EMAIL_TUTEUR),
    ...over,
  };
}

function contexte(over: Record<string, unknown> = {}) {
  return {
    id: SEANCE,
    coachingSessionId: COACHING,
    dateSeance: DEBUT_SEANCE,
    dureeMinutes: 150,
    statut: "realisee",
    signatures: [] as Array<{ id: string }>,
    coachingSession: {
      id: COACHING,
      trainerId: TRAINER,
      estAfest: true,
      coachingSnapshot: {
        v: 1,
        intitule: "Accompagnement IA individuel",
        objectifsPedagogiques: [{ libelle: "Cartographier l'activité" }],
        heuresPrevuesConvention: 20,
        modalite: "AFEST",
        certificationType: null,
        codeRncp: null,
        codeRs: null,
        numeroEnregistrementFc: null,
        capturedAt: "2026-06-01T00:00:00.000Z",
      },
      interventionSlug: "un-a-un-recurrent",
      objectifsPedagogiques: [{ libelle: "Cartographier l'activité" }],
      heuresPrevuesConvention: 20,
      certificationType: "aucune",
      codeRncp: null,
      codeRs: null,
      numeroEnregistrementFc: null,
      beneficiaireNom: "Camille Durand",
      beneficiaireEmail: EMAIL_BENEF,
      tuteurEntrepriseNom: "Jean Tuteur",
      tuteurEntrepriseEmail: EMAIL_TUTEUR,
      trainer: { id: TRAINER, nom: "Jullin", prenom: "Williams", email: "w@axion.test" },
      trainee: null as { nom: string; prenom: string; email: string | null } | null,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour : on les
  // repose explicitement à chaque test.
  mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(contexte());
  mockPrisma.compteRenduSeance.update.mockResolvedValue({ id: SEANCE });
  mockPrisma.coachingSeanceSignature.findFirst.mockResolvedValue(null);
  mockPrisma.coachingSeanceSignature.count.mockResolvedValue(0);
  mockPrisma.coachingSeanceSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 1234,
  });
  mockSupprimerImage.mockResolvedValue(undefined);
});

/** Données réellement passées à `create`, pour inspecter ce qui a été scellé. */
function donneesCreees(): Record<string, unknown> {
  return mockPrisma.coachingSeanceSignature.create.mock.calls[0]?.[0]?.data as Record<
    string,
    unknown
  >;
}

describe("🔴 autorisation du porteur", () => {
  it("refuse un lien émis pour un AUTRE parcours", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur({ coachingId: "99999999-9999-4999-8999-999999999999" }),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res).toStrictEqual({
      ok: false,
      raison: "porteur_non_autorise",
      message: expect.any(String),
    });
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPrisma.coachingSeanceSignature.create).not.toHaveBeenCalled();
  });

  it("refuse un formateur qui n'anime PAS le parcours", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: {
        type: "poste_formateur",
        trainerId: "00000000-0000-4000-8000-000000000000",
        role: "formateur",
      },
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.raison).toBe("porteur_non_autorise");
  });

  it("🔴 un lien ne peut PAS servir au rôle formateur — il signe authentifié", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur({ role: "formateur" }),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("porteur_non_autorise");
    expect(mockPrisma.coachingSeanceSignature.create).not.toHaveBeenCalled();
  });

  it("ne divulgue pas l'état de signature avant d'avoir autorisé le porteur", async () => {
    // Séance déjà signée + porteur hors périmètre → c'est le REFUS
    // D'AUTORISATION qui doit sortir, sinon un porteur de lien valide apprend,
    // en devinant un identifiant, si un autre rôle a signé.
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({ signatures: [{ id: "deja" }] }),
    );
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur({ coachingId: "99999999-9999-4999-8999-999999999999" }),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("porteur_non_autorise");
  });
});

describe("🔴 binding e-mail du canal B", () => {
  it("accepte un lien dont le destinataire correspond au tuteur du parcours", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur(),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok).toBe(true);
  });

  it("refuse un lien TRANSFÉRÉ (empreinte d'une autre adresse)", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur({ destinataireEmailSha256: empreinteEmail("autre@ailleurs.test") }),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("email_binding_invalide");
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse un jeton SANS empreinte de destinataire — la tolérance serait le trou", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur({ destinataireEmailSha256: null }),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("email_binding_invalide");
  });

  it("normalise casse et espaces avant de comparer", () => {
    expect(empreinteEmail("  Tuteur@Entreprise.TEST ")).toBe(empreinteEmail(EMAIL_TUTEUR));
  });
});

describe("🔴 identité résolue côté serveur, jamais un repli anonyme", () => {
  it("refuse de signer un parcours sans nom de bénéficiaire", async () => {
    // 🔴 Sceller le littéral « Bénéficiaire » produirait une signature
    // juridiquement anonyme — le défaut exact que ce chantier corrige.
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({
        coachingSession: { ...contexte().coachingSession, beneficiaireNom: null, trainee: null },
      }),
    );
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("nom_beneficiaire_absent");
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse le rôle tuteur si le tuteur n'est pas renseigné — garde SYMÉTRIQUE", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({
        coachingSession: { ...contexte().coachingSession, tuteurEntrepriseNom: "" },
      }),
    );
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: { type: "poste_formateur", trainerId: TRAINER, role: "tuteur" },
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("tuteur_absent");
  });

  it("préfère le Trainee lié aux champs libres", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({
        coachingSession: {
          ...contexte().coachingSession,
          trainee: { nom: "Martin", prenom: "Léa", email: "lea@example.test" },
        },
      }),
    );
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["signataireNom"]).toBe("Léa Martin");
    expect(donneesCreees()["signataireEmail"]).toBe("lea@example.test");
  });

  it("scelle le nom du TUTEUR pour une ligne tuteur, pas celui du bénéficiaire", async () => {
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur(),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["signataireNom"]).toBe("Jean Tuteur");
    expect(donneesCreees()["role"]).toBe("tuteur");
  });
});

describe("gardes métier", () => {
  it("refuse une séance non commencée — aucune écriture", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-06-10T06:00:00.000Z"),
    });
    expect(res.ok === false && res.raison).toBe("seance_non_commencee");
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("🔴 refuse une séance vieille de trois mois", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-09-10T09:00:00.000Z"),
    });
    expect(res.ok === false && res.raison).toBe("seance_trop_ancienne");
  });

  it("refuse une durée absente plutôt que d'inventer des horaires", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(contexte({ dureeMinutes: null }));
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("horaires_indeterminables");
    expect(mockPrisma.coachingSeanceSignature.create).not.toHaveBeenCalled();
  });

  it("refuse une séance neutralisée (annulée / absence justifiée)", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(contexte({ statut: "annulee" }));
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("seance_neutralisee");
  });

  it("refuse un parcours non cadré AFEST", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({ coachingSession: { ...contexte().coachingSession, estAfest: false } }),
    );
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("parcours_non_afest");
  });

  it("refuse une seconde signature du MÊME rôle sur la même séance", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(
      contexte({ signatures: [{ id: "deja" }] }),
    );
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("deja_signe");
  });

  it("exige une image en méthode `trace`", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("image_requise");
  });

  it("exige un nom CONCORDANT en confirmation accessible", async () => {
    const sansNom = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "confirmation_accessible",
      maintenant: MAINTENANT,
    });
    expect(sansNom.ok === false && sansNom.raison).toBe("nom_requis");

    const mauvais = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "confirmation_accessible",
      nomConfirme: "Quelqu'un d'autre",
      maintenant: MAINTENANT,
    });
    expect(mauvais.ok === false && mauvais.raison).toBe("nom_non_concordant");
  });

  it("tolère casse et accents sur le nom confirmé", async () => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "confirmation_accessible",
      nomConfirme: "  camille  DURAND ",
      maintenant: MAINTENANT,
    });
    expect(res.ok).toBe(true);
    // Aucune image n'a d'existence pour cette modalité.
    expect(mockStore).not.toHaveBeenCalled();
    expect(donneesCreees()["signatureSha256"]).toBe(null);
  });
});

describe("les trois méthodes valent présence probante", () => {
  it.each(["trace", "papier_scanne"] as const)("écrit une ligne en méthode %s", async (methode) => {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode,
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok).toBe(true);
    expect(donneesCreees()["methode"]).toBe(methode);
    expect(donneesCreees()["signatureSha256"]).toBe("a".repeat(64));
  });
});

describe("ce qui est écrit", () => {
  beforeEach(async () => {
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      ipHash: "ip-hash",
      userAgentSha256: "ua-hash",
      maintenant: MAINTENANT,
    });
  });

  it("scelle les horaires RÉELS dérivés de la séance", () => {
    expect(donneesCreees()["heureDebut"]).toBe("09:00");
    expect(donneesCreees()["heureFin"]).toBe("11:30");
  });

  it("écrit `seanceDate` à MINUIT UTC du jour civil de Paris", () => {
    const d = donneesCreees()["seanceDate"] as Date;
    expect(d.toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("trace le formateur qui a RECUEILLI, et aucun jeton", () => {
    expect(donneesCreees()["recueilliParTrainerId"]).toBe(TRAINER);
    expect(donneesCreees()["tokenId"]).toBe(null);
  });

  it("utilise la version de mention AFEST, pas celle du collectif", () => {
    expect(donneesCreees()["mentionVersion"]).toBe(MENTION_VERSION_AFEST);
    expect(donneesCreees()["hashVersion"]).toBe(HASH_VERSION_SEANCE);
  });

  it("pose le cache d'affichage DANS la transaction, sans toucher aux heures", () => {
    expect(mockPrisma.compteRenduSeance.update).toHaveBeenCalledWith({
      where: { id: SEANCE },
      data: {
        beneficiairePresent: true,
        beneficiaireSigneAt: MAINTENANT,
        presenceSigneeAt: MAINTENANT,
      },
    });
    // 🔴 `dureeReelleHeures` a un écrivain UNIQUE : la clôture. Le poser ici le
    // ferait osciller selon l'ordre des opérations.
    expect(mockPrisma.coachingSession.update).not.toHaveBeenCalled();
  });

  it("fige le contenu pédagogique du parcours dans `modulesSnapshot`", () => {
    expect(donneesCreees()["modulesSnapshot"]).toStrictEqual(["Cartographier l'activité"]);
    expect(donneesCreees()["formationIntitule"]).toBe("Accompagnement IA individuel");
  });
});

describe("cache d'affichage par rôle", () => {
  it("le rôle formateur ne touche PAS `presenceSigneeAt`", async () => {
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: { type: "poste_formateur", trainerId: TRAINER, role: "formateur" },
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(mockPrisma.compteRenduSeance.update).toHaveBeenCalledWith({
      where: { id: SEANCE },
      data: { formateurSigneAt: MAINTENANT },
    });
  });

  it("le rôle tuteur écrit `tuteurSigneAt` seul", async () => {
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: lienTuteur(),
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(mockPrisma.compteRenduSeance.update).toHaveBeenCalledWith({
      where: { id: SEANCE },
      data: { tuteurSigneAt: MAINTENANT },
    });
  });
});

describe("chaînage", () => {
  it("relit l'empreinte précédente du MÊME (parcours, rôle), triée sur `createdAt`", async () => {
    mockPrisma.coachingSeanceSignature.findFirst.mockResolvedValue({ selfHash: "b".repeat(64) });
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(mockPrisma.coachingSeanceSignature.findFirst).toHaveBeenCalledWith({
      where: { coachingId: COACHING, role: "beneficiaire", revokedAt: null },
      // 🔴 `createdAt`, JAMAIS `signeAt` : ce dernier est figé avant l'écriture
      // R2, et deux signatures peuvent commiter dans l'ordre inverse.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { selfHash: true },
    });
    expect(donneesCreees()["prevHash"]).toBe("b".repeat(64));
  });

  it("produit une empreinte VÉRIFIABLE par le cœur collectif réutilisé tel quel", async () => {
    await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    const d = donneesCreees();
    const ligne: LigneSeanceSignature = {
      id: d["id"] as string,
      coachingId: d["coachingId"] as string,
      compteRenduSeanceId: d["compteRenduSeanceId"] as string,
      role: "beneficiaire",
      seanceDate: d["seanceDate"] as Date,
      heureDebut: d["heureDebut"] as string,
      heureFin: d["heureFin"] as string,
      formationIntitule: d["formationIntitule"] as string,
      modulesSnapshot: d["modulesSnapshot"],
      formateurNom: d["formateurNom"] as string,
      signataireNom: d["signataireNom"] as string,
      signataireEmail: d["signataireEmail"] as string | null,
      methode: "trace",
      mentionVersion: d["mentionVersion"] as string,
      signatureSha256: d["signatureSha256"] as string | null,
      signeAt: d["signeAt"] as Date,
      prevHash: d["prevHash"] as string | null,
      selfHash: d["selfHash"] as string,
      hashVersion: d["hashVersion"] as number,
    };
    expect(verifierChaine([maillonSeanceDepuisLigne(ligne)]).valide).toBe(true);
  });

  it("rejoue sur conflit de chaîne, puis abandonne proprement", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("conflit", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockPrisma.$transaction.mockRejectedValue(p2002);
    mockPrisma.coachingSeanceSignature.count.mockResolvedValue(0);

    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("conflit_concurrent");
    // L'image écrite ne doit pas rester orpheline sur R2 : la purge RGPD part
    // de `signature_key`, un objet sans ligne est ineffaçable.
    expect(mockSupprimerImage).toHaveBeenCalledWith("emargement/2026/signatures/x.png");
  });

  it("distingue une course d'une signature déjà posée", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("conflit", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockPrisma.$transaction.mockRejectedValue(p2002);
    // ⚠️ On interroge la BASE, jamais `err.meta.target` : sa forme pour un index
    // unique PARTIEL en SQL brut n'est garantie nulle part.
    mockPrisma.coachingSeanceSignature.count.mockResolvedValue(1);

    const res = await signerSeanceAfest({
      compteRenduSeanceId: SEANCE,
      porteur: PORTEUR_FORMATEUR_POSTE,
      methode: "trace",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(res.ok === false && res.raison).toBe("deja_signe");
  });
});

describe("🔴 révocation d'un maillon interne INTERDITE", () => {
  beforeEach(() => {
    mockPrisma.coachingSeanceSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      coachingId: COACHING,
      role: "beneficiaire",
      selfHash: "c".repeat(64),
      revokedAt: null,
    });
    mockPrisma.coachingSeanceSignature.update.mockResolvedValue({ id: "sig-1" });
  });

  it("révoque une signature TERMINALE", async () => {
    mockPrisma.coachingSeanceSignature.count.mockResolvedValue(0);
    const res = await revoquerSignatureSeance({ signatureId: "sig-1", motif: "erreur de saisie" });
    expect(res.ok).toBe(true);
    expect(mockPrisma.coachingSeanceSignature.update).toHaveBeenCalled();
  });

  it("REFUSE de révoquer un maillon qui a un successeur", async () => {
    // Le filtrer par `WHERE revoked_at IS NULL` ferait pointer le `prevHash` du
    // successeur dans le vide : `verifierChaine` rendrait `rupture_chainage`,
    // c'est-à-dire « une ligne a été supprimée après coup » — sur une
    // correction parfaitement légitime.
    mockPrisma.coachingSeanceSignature.count.mockResolvedValue(1);
    const res = await revoquerSignatureSeance({ signatureId: "sig-1", motif: "erreur" });
    expect(res.ok === false && res.raison).toBe("revocation_maillon_interne_interdite");
    expect(mockPrisma.coachingSeanceSignature.update).not.toHaveBeenCalled();
  });

  it("refuse une signature déjà révoquée", async () => {
    mockPrisma.coachingSeanceSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      coachingId: COACHING,
      role: "beneficiaire",
      selfHash: "c".repeat(64),
      revokedAt: new Date(),
    });
    const res = await revoquerSignatureSeance({ signatureId: "sig-1", motif: "erreur" });
    expect(res.ok === false && res.raison).toBe("deja_revoquee");
  });
});
