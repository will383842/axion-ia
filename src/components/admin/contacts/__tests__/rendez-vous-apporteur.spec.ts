// Fiche apporteur — le bloc « Échange réservé » (2026-09-19).
//
// Régime FILTRE de `admin-calendly/acces.ts` : un rôle qui ne voit pas les
// appels ne rend rien ET ne déclenche même pas la lecture de `calendly_events`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { RendezVousApporteur } from "../RendezVousApporteur";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    {
      id: "evt_1",
      eventTypeName: "Échange apporteur (15 min)",
      status: "scheduled",
      startTime: new Date("2026-09-22T08:00:00Z"),
      endTime: new Date("2026-09-22T08:15:00Z"),
      inviteeName: "Léa",
      inviteeEmail: "lea@example.com",
      inviteePhone: null,
      location: null,
      rawPayload: {},
      notes: null,
      capturedAt: new Date("2026-09-19T08:00:00Z"),
    },
  ]);
});

/**
 * Le texte d'un arbre React, sans DOM.
 *
 * Ce composant est un composant SERVEUR asynchrone : `@testing-library` ne sait
 * pas le rendre (un enfant asynchrone non résolu ne rend rien du tout, et les
 * assertions passent alors sur du vide — le piège exact que cette PR a déjà
 * rencontré ailleurs). On parcourt donc l'arbre à la main.
 */
function rendreEnTexte(n: unknown): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(rendreEnTexte).join(" ");
  const el = n as { props?: { children?: unknown } };
  return el.props ? rendreEnTexte(el.props.children) : "";
}

describe("RendezVousApporteur", () => {
  it("un rôle qui ne voit pas les appels ne rend rien ET ne lit rien", async () => {
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "reader" });
    expect(rendu).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("un rôle habilité voit le bloc, AVEC ce qu'il promet dedans", async () => {
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "admin" });
    expect(rendu).not.toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);

    // 🔑 `not.toBeNull()` seul ne garde RIEN. Vider la boucle qui rend les
    // rendez-vous laisserait ce test vert : le bloc existerait toujours, la
    // requête partirait toujours, et l'écran n'afficherait plus rien. La
    // promesse du bloc — « on sait si la personne a réservé, et quand » — doit
    // se lire dans le rendu.
    const texte = rendreEnTexte(rendu);
    expect(texte).toContain("Échange apporteur");
    expect(texte).toContain("22"); // le jour du rendez-vous
  });
});
