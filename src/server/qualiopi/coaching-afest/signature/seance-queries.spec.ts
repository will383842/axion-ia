/**
 * Tests — seance-queries.ts
 *
 * Ce module ne calcule rien de neuf : il assemble. Ce qu'il doit garantir, et
 * qui se casserait sans bruit :
 *
 *  1. **Rien n'est affiché « signé » sans nom, horodatage et empreinte.** C'est
 *     le défaut exact que ce chantier vient de retirer côté AFEST.
 *  2. **Aucune adresse électronique ne sort d'ici.** Le tuteur est un tiers ;
 *     son adresse sert au binding, pas à l'affichage.
 *  3. **La signabilité vient de `etatSeance`**, jamais d'une règle réécrite : un
 *     bouton proposé puis refusé se lit comme une panne.
 *  4. **Les mentions viennent de `mentionCompleteAfest`** et portent le plafond
 *     probant du canal « poste du formateur ».
 *  5. **La garde de propriété est dans le `where`**, pas après la lecture.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { coachingSession: { findFirst: vi.fn() } },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({ raisonSociale: "Axion-IA" })),
}));

import { prisma } from "@/lib/prisma";
import { lireEtatSignaturesAfest } from "./seance-queries";
import { MENTION_RECUEIL_ATTESTE_PAR_OF, MENTION_VALEUR_JURIDIQUE_AFEST } from "./mentions-afest";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { coachingSession: { findFirst: Mock } };

const COACHING = "11111111-1111-4111-8111-111111111111";
const SEANCE = "22222222-2222-4222-8222-222222222222";
const TRAINER = "33333333-3333-4333-8333-333333333333";

/** 10 juin 2026, 09:00 Paris = 07:00 UTC (heure d'été). Séance de 2 h 30. */
const DEBUT = new Date("2026-06-10T07:00:00.000Z");
/** Pendant la séance : signable pour les trois rôles. */
const PENDANT = new Date("2026-06-10T08:00:00.000Z");

type Signature = {
  role: string;
  signataireNom: string;
  signeAt: Date;
  selfHash: string;
  methode: string;
  recueilliParTrainerId: string | null;
};

function parcours(over: Record<string, unknown> = {}, signatures: Signature[] = []) {
  return {
    id: COACHING,
    estAfest: true,
    coachingSnapshot: null,
    interventionSlug: "audit-ia",
    objectifsPedagogiques: [{ libelle: "Cadrer un cas d'usage" }],
    heuresPrevuesConvention: 14,
    certificationType: null,
    codeRncp: null,
    codeRs: null,
    numeroEnregistrementFc: null,
    beneficiaireNom: "Claire Martin",
    tuteurEntrepriseNom: "Paul Dubois",
    tuteurEntrepriseEmail: "paul@entreprise.test",
    trainer: { nom: "Jullin", prenom: "Williams" },
    trainee: null,
    comptesRendus: [
      {
        id: SEANCE,
        dateSeance: DEBUT,
        dureeMinutes: 150,
        statut: "realisee",
        signatures,
      },
    ],
    ...over,
  };
}

/** Raccourci : l'état du rôle demandé sur la première (et unique) séance. */
function role(etat: Awaited<ReturnType<typeof lireEtatSignaturesAfest>>, r: string) {
  const seance = etat?.seances[0];
  return seance?.roles.find((x) => x.role === r);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.coachingSession.findFirst.mockResolvedValue(parcours());
});

describe("🔴 portée et garde de propriété", () => {
  it("filtre sur le trainerId DANS le `where`, pas après la lecture", async () => {
    await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const args = mockPrisma.coachingSession.findFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where).toStrictEqual({ id: COACHING, trainerId: TRAINER });
  });

  it("rend `null` quand le parcours n'existe pas ou n'est pas le sien", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(null);
    expect(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT)).toBeNull();
  });

  it("🔴 rend `null` sur un parcours NON cadré en AFEST", async () => {
    // L'émargement par séance ne s'y applique pas : afficher un bloc vide
    // laisserait croire à des signatures manquantes.
    mockPrisma.coachingSession.findFirst.mockResolvedValue(parcours({ estAfest: false }));
    expect(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT)).toBeNull();
  });

  it("🔴 ne sélectionne JAMAIS l'adresse du signataire", async () => {
    // `signataireEmail` est scellé en base pour le recalcul de l'empreinte et le
    // binding du canal par lien. Le faire transiter vers le navigateur serait
    // une fuite, et sur le TUTEUR c'est l'adresse d'un tiers.
    await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const args = mockPrisma.coachingSession.findFirst.mock.calls[0]?.[0];
    expect(JSON.stringify(args)).not.toContain("signataireEmail");
  });
});

describe("🔴 ce qu'une signature affichée doit porter", () => {
  it("nomme le signataire, l'horodate en heure de PARIS et donne l'empreinte", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({}, [
        {
          role: "beneficiaire",
          signataireNom: "Claire Martin",
          // 09:05 heure de Paris.
          signeAt: new Date("2026-06-10T07:05:00.000Z"),
          selfHash: "d".repeat(64),
          methode: "trace",
          recueilliParTrainerId: TRAINER,
        },
      ]),
    );
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const b = role(etat, "beneficiaire");
    expect(b?.signee).toBe(true);
    expect(b?.signataireNom).toBe("Claire Martin");
    expect(b?.empreinte).toBe("d".repeat(64));
    expect(b?.signeAtLisible).toMatch(/09:05/);
    expect(b?.signeAtLisible).toMatch(/10 juin 2026/);
    expect(b?.methodeLisible).toBe("signature tracée");
    // Le plafond probant est visible ligne à ligne, pas seulement en tête.
    expect(b?.recueilliSurPosteFormateur).toBe(true);
    // Une signature posée ne se re-propose pas, et n'affiche pas de blocage :
    // la preuve elle-même est l'information.
    expect(b?.peutSigner).toBe(false);
    expect(b?.blocage).toBeNull();
  });

  it("un rôle non signé n'annonce ni nom figé ni empreinte", async () => {
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const f = role(etat, "formateur");
    expect(f?.signee).toBe(false);
    expect(f?.signataireNom).toBeNull();
    expect(f?.empreinte).toBeNull();
    expect(f?.signeAtLisible).toBeNull();
  });

  it("ignore les signatures révoquées — le filtre est dans la requête", async () => {
    await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    expect(JSON.stringify(mockPrisma.coachingSession.findFirst.mock.calls[0]?.[0])).toContain(
      '"revokedAt":null',
    );
  });
});

describe("🔴 signabilité — dite AVANT le clic", () => {
  it("propose les trois rôles pendant la séance", async () => {
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    expect(etat?.seances[0]?.roles.map((r) => r.peutSigner)).toStrictEqual([true, true, true]);
    expect(etat?.seances[0]?.blocageSeance).toBeNull();
    expect(etat?.seances[0]?.horaires).toBe("09:00–11:30");
  });

  it("refuse une séance NON COMMENCÉE, et le dit", async () => {
    const avant = new Date("2026-06-10T06:00:00.000Z");
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, avant);
    expect(etat?.seances[0]?.blocageSeance).toMatch(/à venir/i);
    expect(etat?.seances[0]?.roles.every((r) => !r.peutSigner)).toBe(true);
  });

  it("🔴 refuse une séance TROP ANCIENNE — le cas des douze séances back-signées", async () => {
    // C'était l'état réel avant `seances-signables` : la seule borne était
    // l'expiration du jeton, sur un parcours de 6 à 24 mois.
    const troisJoursApres = new Date("2026-06-13T12:00:00.000Z");
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, troisJoursApres);
    expect(etat?.seances[0]?.blocageSeance).toMatch(/délai de signature dépassé/i);
    expect(etat?.seances[0]?.roles.every((r) => !r.peutSigner)).toBe(true);
  });

  it("refuse une séance NEUTRALISÉE (annulée ou non tenue)", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({
        comptesRendus: [
          { id: SEANCE, dateSeance: DEBUT, dureeMinutes: 150, statut: "annulee", signatures: [] },
        ],
      }),
    );
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    expect(etat?.seances[0]?.blocageSeance).toMatch(/annulée/i);
    expect(etat?.seances[0]?.roles.every((r) => !r.peutSigner)).toBe(true);
  });

  it("🔴 refuse une séance SANS DURÉE — les horaires réels sont indéterminables", async () => {
    // Le « 09h00–17h00 » par défaut est exactement ce que ce chantier supprime :
    // sans horaires réels, la feuille est insuffisamment probante.
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({
        comptesRendus: [
          { id: SEANCE, dateSeance: DEBUT, dureeMinutes: null, statut: "realisee", signatures: [] },
        ],
      }),
    );
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    expect(etat?.seances[0]?.horaires).toBeNull();
    expect(etat?.seances[0]?.blocageSeance).toMatch(/durée de la séance non renseignée/i);
    expect(etat?.seances[0]?.roles.every((r) => r.mentions.length === 0)).toBe(true);
  });
});

describe("🔴 identités manquantes — refuser tôt plutôt que sceller un anonyme", () => {
  it("bloque le bénéficiaire quand son nom n'est pas renseigné", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({ beneficiaireNom: null, trainee: null }),
    );
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const b = role(etat, "beneficiaire");
    expect(b?.peutSigner).toBe(false);
    expect(b?.blocage).toMatch(/nom du bénéficiaire/i);
    // Le formateur, lui, reste signable : les rôles ne se bloquent pas entre eux.
    expect(role(etat, "formateur")?.peutSigner).toBe(true);
  });

  it("🔴 bloque AUSSI le tuteur quand le nom du bénéficiaire manque", async () => {
    // Sa co-attestation cite nommément le bénéficiaire : sans ce nom, la mention
    // serait creuse — et elle est SCELLÉE dans l'empreinte.
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({ beneficiaireNom: null, trainee: null }),
    );
    const t = role(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT), "tuteur");
    expect(t?.peutSigner).toBe(false);
    expect(t?.blocage).toMatch(/cite nommément/i);
  });

  it("bloque le tuteur quand son adresse électronique manque", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({ tuteurEntrepriseEmail: null }),
    );
    const t = role(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT), "tuteur");
    expect(t?.peutSigner).toBe(false);
    expect(t?.blocage).toMatch(/adresse électronique/i);
  });

  it("préfère l'identité du compte bénéficiaire au nom libre du parcours", async () => {
    mockPrisma.coachingSession.findFirst.mockResolvedValue(
      parcours({ trainee: { nom: "Durand", prenom: "Léa" } }),
    );
    const b = role(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT), "beneficiaire");
    expect(b?.signataireAttenduNom).toBe("Léa Durand");
  });
});

describe("🔴 mentions et plafond probant", () => {
  it("construit la mention par `mentionCompleteAfest`, jamais un texte local", async () => {
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    const b = role(etat, "beneficiaire");
    expect(b?.mentions[0]).toContain("J'atteste avoir suivi la séance du");
    expect(b?.mentions[0]).toContain("(09:00–11:30)");
    expect(b?.mentions[0]).toContain("Axion-IA");
    expect(b?.mentions).toContain(MENTION_VALEUR_JURIDIQUE_AFEST);
  });

  it("🔴 porte le plafond probant du canal « poste du formateur »", async () => {
    // Quand les trois rôles signent sur le même appareil, la chaîne prouve
    // l'INTÉGRITÉ, pas l'INDÉPENDANCE. Le taire laisserait croire à une garantie
    // qu'on n'apporte pas.
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT);
    expect(etat?.plafondProbant).toBe(MENTION_RECUEIL_ATTESTE_PAR_OF);
    expect(role(etat, "beneficiaire")?.mentions).toContain(MENTION_RECUEIL_ATTESTE_PAR_OF);
  });

  it("donne au tuteur le texte du TIERS, pas celui du stagiaire", async () => {
    const t = role(await lireEtatSignaturesAfest(COACHING, TRAINER, PENDANT), "tuteur");
    expect(t?.mentions[0]).toContain("En qualité de tuteur en entreprise");
    expect(t?.mentions[0]).toContain("Claire Martin");
    expect(t?.mentions[0]).not.toContain("J'atteste avoir suivi");
  });

  it("ne construit aucune mention pour un rôle qui ne peut pas signer", async () => {
    const avant = new Date("2026-06-10T06:00:00.000Z");
    const etat = await lireEtatSignaturesAfest(COACHING, TRAINER, avant);
    expect(etat?.seances[0]?.roles.every((r) => r.mentions.length === 0)).toBe(true);
  });
});
