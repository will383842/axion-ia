/**
 * Lot E (M14), relecture — le message « après le délai » (lien de mission) est refusé
 * côté serveur une fois la collaboration close, comme toute autre écriture du formateur.
 *
 * 🔴 Avant le correctif, `ecrireApresDelai` vérifiait la signature du jeton puis lisait
 * la mission, sans jamais comparer la version signée ni lire `finCollaborationAt` : un
 * lien reçu avant la clôture levait encore une alerte interne avec le texte libre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-lot-e-0123456789abcdef";
});

const db = vi.hoisted(() => ({ missionFormateur: { findUnique: vi.fn() } }));
const creerOuDedup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ creerOuDedup }));

import { signMagicToken } from "@/lib/magic-token";
import { ecrireApresDelai } from "@/server/qualiopi/trainers/message-apres-delai";

const MISSION = "5b6c7d8e-9f01-4a2b-8c3d-4e5f6a7b8c9d";

const mission = (finCollaborationAt: Date | null) => ({
  id: MISSION,
  statut: "retiree",
  trainer: { prenom: "Camille", nom: "Martin", email: "c@example.test", finCollaborationAt },
  session: {
    id: "8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a",
    numero: "S-1",
    titreSession: "Formation",
    dateDebut: new Date("2026-11-02T08:00:00Z"),
  },
});

const MESSAGE = "Je suis disponible finalement.";

beforeEach(() => vi.clearAllMocks());

describe("message après le délai et fin de collaboration", () => {
  it("🔴 jeton version 0, collaboration close depuis : refusé, aucune alerte", async () => {
    const token = await signMagicToken({
      scope: "formateur_mission",
      resourceId: MISSION,
      version: 0,
    });
    db.missionFormateur.findUnique.mockResolvedValue(mission(new Date("2026-10-01T00:00:00Z")));
    const r = await ecrireApresDelai({ token, message: MESSAGE });
    expect(r.ok).toBe(false);
    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("🔴 jeton sans version (avant ce lot), collaboration close : refusé, aucune alerte", async () => {
    const token = await signMagicToken({ scope: "formateur_mission", resourceId: MISSION });
    db.missionFormateur.findUnique.mockResolvedValue(mission(new Date("2026-10-01T00:00:00Z")));
    const r = await ecrireApresDelai({ token, message: MESSAGE });
    expect(r.ok).toBe(false);
    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("collaboration en cours : le message part en alerte, comme avant", async () => {
    const token = await signMagicToken({
      scope: "formateur_mission",
      resourceId: MISSION,
      version: 0,
    });
    db.missionFormateur.findUnique.mockResolvedValue(mission(null));
    const r = await ecrireApresDelai({ token, message: MESSAGE });
    expect(r.ok).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledTimes(1);
  });
});
