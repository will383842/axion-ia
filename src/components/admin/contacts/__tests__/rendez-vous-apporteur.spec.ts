// Fiche apporteur — le bloc « Échange réservé » (2026-09-19).
//
// Régime FILTRE de `admin-calendly/acces.ts` : un rôle qui ne voit pas les
// appels ne rend rien ET ne déclenche même pas la lecture de `calendly_events`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const suiviFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) },
    rendezVousSuivi: { findMany: (...a: unknown[]) => suiviFindMany(...a) },
  },
}));
// Le formulaire d'issue est un composant client : ses actions serveur ne se
// chargent pas ici.
vi.mock("@/features/admin-rendezvous/issue-apporteur-actions", () => ({
  apercuIssueApporteurAction: vi.fn(),
  enregistrerIssueApporteurAction: vi.fn(),
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { RendezVousApporteur } from "../RendezVousApporteur";
import { IssueEchangeApporteurForm } from "../IssueEchangeApporteurForm";

beforeEach(() => {
  vi.clearAllMocks();
  suiviFindMany.mockResolvedValue([]);
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

/** Les éléments de l'arbre dont le type est `composant`, sans DOM. */
function trouver(n: unknown, composant: unknown): Array<{ props: Record<string, unknown> }> {
  if (n === null || n === undefined || typeof n !== "object") return [];
  if (Array.isArray(n)) return n.flatMap((x) => trouver(x, composant));
  const el = n as { type?: unknown; props?: { children?: unknown } };
  const ici = el.type === composant ? [el as { props: Record<string, unknown> }] : [];
  return [...ici, ...(el.props ? trouver(el.props.children, composant) : [])];
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

  it("2026-09-28 : un échange passé porte les boutons d'issue, et l'issue déjà donnée se lit", async () => {
    suiviFindMany.mockResolvedValue([
      {
        calendlyEventId: "evt_1",
        issue: "eu_lieu",
        decision: "retenu",
        noteSur20: 16,
        note: "Réseau solide dans le BTP.",
        suiteLe: null,
        renseigneLe: new Date("2026-09-22T10:00:00Z"),
      },
    ]);
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "admin" });
    const texte = rendreEnTexte(rendu);
    expect(texte).toContain("On poursuit (22/09)");
    expect(texte).toContain("16/20");

    const formulaires = trouver(rendu, IssueEchangeApporteurForm);
    expect(formulaires).toHaveLength(1);
    expect(formulaires[0]?.props).toMatchObject({
      calendlyEventId: "evt_1",
      initial: { issue: "retenu", noteSur20: 16, justification: "Réseau solide dans le BTP." },
    });
  });

  it("un échange ANNULÉ ne propose aucune issue", async () => {
    findMany.mockResolvedValue([
      {
        id: "evt_2",
        eventTypeName: "Échange apporteur (15 min)",
        status: "canceled",
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
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "admin" });
    expect(trouver(rendu, IssueEchangeApporteurForm)).toHaveLength(0);
  });
});
