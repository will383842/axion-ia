/**
 * Vérification 1, lot 2 — V1-D-1 : le lien de réponse à une proposition de mission
 * porte l'EMPREINTE de l'adresse de la fiche, contrôlée à la lecture comme l'espace
 * formateur le fait pour sa session (lot C4). Avant la correction, après un
 * changement d'adresse en console, le lien envoyé à l'ANCIENNE adresse ouvrait encore
 * la mission : on pouvait l'accepter ou la refuser.
 *
 * Un lien périmé reçoit la réponse NEUTRE d'un lien inconnu. Les liens signés AVANT la
 * correction (sans empreinte) tombent dès qu'un changement d'adresse est enregistré
 * sur la fiche. Salariés et dirigeants : inchangé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-v1-lot2-0123456789abcdef";
});

const db = vi.hoisted(() => ({ missionFormateur: { findUnique: vi.fn() } }));
const creerOuDedup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ creerOuDedup }));

import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";
import { empreinteSessionFormateur } from "@/server/qualiopi/formateurs-independants/version-session";
import { ecrireApresDelai } from "@/server/qualiopi/trainers/message-apres-delai";
import {
  lireMissionParJeton,
  signerJetonMission,
} from "@/server/qualiopi/trainers/mission-formateur";

const MISSION = "5b6c7d8e-9f01-4a2b-8c3d-4e5f6a7b8c9d";
const ANCIENNE = "ancienne@example.test";
const NOUVELLE = "nouvelle@example.test";

interface Fiche {
  statut?: string;
  email?: string;
  emailRemplaceAt?: Date | null;
}

const mission = (f: Fiche = {}, statut = "en_attente") => ({
  id: MISSION,
  statut,
  role: "principal",
  echeanceReponseAt: null,
  trainer: {
    id: "t",
    prenom: "Camille",
    nom: "Martin",
    statut: f.statut ?? "sous_traitant",
    email: f.email ?? ANCIENNE,
    emailRemplaceAt: f.emailRemplaceAt ?? null,
    finCollaborationAt: null,
  },
  session: {
    id: "8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a",
    numero: "S-1",
    titreSession: "Formation",
    dateDebut: new Date("2026-11-02T08:00:00Z"),
    dateFin: new Date("2026-11-03T16:00:00Z"),
    modalite: "presentiel",
    nbParticipantsPrevus: 6,
    lieuType: null,
    lieuIntitule: null,
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    lieuSalle: null,
    lieuVisioUrl: null,
    _count: { enrollments: 4 },
  },
});

const jetonEmis = () =>
  signerJetonMission({
    missionId: MISSION,
    ttlMs: 7 * 86_400_000,
    trainer: { email: ANCIENNE, finCollaborationAt: null },
  });

const jetonAvantCorrection = () =>
  signMagicToken({ scope: "formateur_mission", resourceId: MISSION, version: 0 });

beforeEach(() => vi.clearAllMocks());

describe("V1-D-1 — le lien de mission porte l'empreinte de l'adresse", () => {
  it("le jeton émis porte l'empreinte de l'adresse, jamais l'adresse", async () => {
    const t = await jetonEmis();
    const v = await verifyMagicToken(t, { scope: "formateur_mission" });
    expect(v.ok && v.empreinte).toBe(empreinteSessionFormateur(ANCIENNE));
    const charge = Buffer.from(t.split(".")[0]!, "base64url").toString();
    expect(charge).not.toContain("ancienne");
  });

  it("même adresse (casse comprise) : le lien vaut", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(mission({ email: "Ancienne@Example.test" }));
    expect((await lireMissionParJeton(await jetonEmis()))?.id).toBe(MISSION);
  });

  it("🔴 adresse changée depuis l'envoi : le lien ne désigne plus rien", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(
      mission({ email: NOUVELLE, emailRemplaceAt: new Date() }),
    );
    expect(await lireMissionParJeton(await jetonEmis())).toBeNull();
  });

  it("🔴 message après le délai : même réponse neutre qu'un lien inconnu, aucune alerte", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(
      mission({ email: NOUVELLE, emailRemplaceAt: new Date() }, "expiree"),
    );
    const perime = await ecrireApresDelai({ token: await jetonEmis(), message: "Disponible." });
    const inconnu = await ecrireApresDelai({ token: "abc.def", message: "Disponible." });
    expect(perime).toEqual(inconnu);
    expect(perime.ok).toBe(false);
    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("salarié dont l'adresse a changé : inchangé, le lien vaut", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(
      mission({ statut: "salarie", email: NOUVELLE, emailRemplaceAt: new Date() }),
    );
    expect((await lireMissionParJeton(await jetonEmis()))?.id).toBe(MISSION);
  });
});

describe("V1-D-1 — liens émis AVANT la correction (sans empreinte)", () => {
  it("aucun changement d'adresse enregistré : le lien vaut encore", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(mission());
    expect((await lireMissionParJeton(await jetonAvantCorrection()))?.id).toBe(MISSION);
  });

  it("🔴 un changement d'adresse est enregistré sur la fiche : le lien tombe", async () => {
    db.missionFormateur.findUnique.mockResolvedValue(
      mission({ email: NOUVELLE, emailRemplaceAt: new Date() }),
    );
    expect(await lireMissionParJeton(await jetonAvantCorrection())).toBeNull();
  });
});
