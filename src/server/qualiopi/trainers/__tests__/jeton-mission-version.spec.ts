/**
 * Lot E (M14) — le jeton de MISSION porte la version de session de la fiche
 * (`versionSessionFormateur`, tirée de la date de fin close) : après une fin de
 * collaboration, un lien de proposition reçu avant ne vaut plus rien. Un jeton signé
 * avant ce lot (sans version) garde son comportement.
 *
 * 🔴 Ce n'est PAS `accesVersion` : ce compteur révoque les liens du dossier et bouge à
 * chaque envoi ou renvoi du dossier — il éteindrait les propositions d'un formateur
 * actif.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-lot-e-0123456789abcdef";
});

const db = vi.hoisted(() => ({ missionFormateur: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";
import { lireMissionParJeton } from "@/server/qualiopi/trainers/mission-formateur";

const MISSION = "5b6c7d8e-9f01-4a2b-8c3d-4e5f6a7b8c9d";

const mission = (finCollaborationAt: Date | null, accesVersion = 3) => ({
  id: MISSION,
  statut: "en_attente",
  role: "principal",
  echeanceReponseAt: null,
  trainer: { id: "t", prenom: "Camille", nom: "Martin", accesVersion, finCollaborationAt },
  session: {
    id: "s",
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

beforeEach(() => vi.clearAllMocks());

describe("jeton de mission et version d'accès", () => {
  it("la version signée est rendue à la vérification", async () => {
    const t = await signMagicToken({
      scope: "formateur_mission",
      resourceId: MISSION,
      version: 4,
    });
    const v = await verifyMagicToken(t, { scope: "formateur_mission" });
    expect(v.ok && v.version).toBe(4);
  });

  it("collaboration close depuis l'envoi : le lien ne désigne plus rien", async () => {
    const t = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION, version: 0 });
    db.missionFormateur.findUnique.mockResolvedValue(mission(new Date("2026-10-01T00:00:00Z")));
    expect(await lireMissionParJeton(t)).toBeNull();
  });

  it("même version : le lien vaut", async () => {
    const t = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION, version: 0 });
    db.missionFormateur.findUnique.mockResolvedValue(mission(null));
    expect((await lireMissionParJeton(t))?.id).toBe(MISSION);
  });

  it("🔴 l'envoi du dossier incrémente `accesVersion` : la proposition reste valable", async () => {
    const t = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION, version: 0 });
    db.missionFormateur.findUnique.mockResolvedValue(mission(null, 4));
    expect((await lireMissionParJeton(t))?.id).toBe(MISSION);
  });

  it("jeton d'avant ce lot (sans version) : comportement inchangé", async () => {
    const t = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION });
    db.missionFormateur.findUnique.mockResolvedValue(mission(null, 7));
    expect((await lireMissionParJeton(t))?.id).toBe(MISSION);
  });

  it("🔴 jeton sans version (lien d'avant ce lot) et collaboration close : refusé", async () => {
    const t = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION });
    db.missionFormateur.findUnique.mockResolvedValue(mission(new Date("2026-10-01T00:00:00Z")));
    expect(await lireMissionParJeton(t)).toBeNull();
  });
});
