/**
 * QNC NC6, lot présence 2/3 — la page de réponse. Un antivirus de messagerie ouvre les
 * liens des e-mails : le GET n'écrit JAMAIS. La réponse n'est enregistrée que par le POST
 * d'un bouton (action serveur), jamais par le rendu.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ derniere: null as string | null }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(async () => ({ value: { etat: "actif" } })) },
    enrollment: {
      findFirst: vi.fn(async () => ({
        id: "11111111-1111-4111-8111-111111111111",
        sessionId: "ses-1",
        session: {
          statut: "planifiee",
          estTestInterne: false,
          titreSession: "Piloter son activité avec l'IA",
          dateDebut: new Date("2026-10-26T00:00:00Z"),
          jours: [
            { date: new Date("2026-10-26T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" },
          ],
        },
        remisesRetours: [
          {
            id: "d1",
            nature: "remise",
            objet: "presence_confirmation",
            survenuLe: new Date("2026-10-23T08:00:00Z"),
          },
          ...(h.derniere === null
            ? []
            : [
                {
                  id: "r1",
                  nature: "reponse",
                  objet: `presence_confirmation:${h.derniere}`,
                  survenuLe: new Date("2026-10-23T09:00:00Z"),
                },
              ]),
        ],
      })),
    },
    remiseRetour: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    relanceJournal: { create: vi.fn() },
  },
}));
vi.mock("@/server/actions/qualiopi/presence-public", () => ({ repondrePresenceAction: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { emettreJetonPresence } from "@/server/qualiopi/confirmation-presence/jeton";
import Page, { dynamic, metadata } from "./page";

const db = prisma as unknown as {
  remiseRetour: Record<string, ReturnType<typeof vi.fn>>;
  relanceJournal: { create: ReturnType<typeof vi.fn> };
};

async function rendu(token: string, e?: string): Promise<string> {
  const el = await Page({
    params: Promise.resolve({ locale: "fr", token }),
    ...(e !== undefined ? { searchParams: Promise.resolve({ e }) } : {}),
  });
  return renderToStaticMarkup(el);
}

describe("page de confirmation de présence", () => {
  let jeton: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
    process.env["AUTH_SECRET"] = "secret-de-test-presence";
    delete process.env["DATABASE_URL"];
    h.derniere = null;
    jeton = await emettreJetonPresence(
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-10-26T08:00:00Z"),
    );
  });

  it("le GET montre le titre, la date et deux boutons — et n'écrit RIEN", async () => {
    const html = await rendu(jeton);
    expect(html).toContain("Piloter son activité avec l&#x27;IA");
    expect(html).toContain("lundi 26 octobre 2026");
    expect(html).toContain("Je serai présent(e)");
    expect(html).toContain("Je ne pourrai pas venir");
    expect(html).toMatch(/<form/);
    for (const fn of Object.values(db.remiseRetour)) expect(fn).not.toHaveBeenCalled();
    expect(db.relanceJournal.create).not.toHaveBeenCalled();
  });

  it("aucun champ libre : ni textarea ni saisie de texte", async () => {
    const html = await rendu(jeton);
    expect(html).not.toMatch(/<textarea/i);
    expect(html).not.toMatch(/type="text"/i);
  });

  it("montre la dernière réponse enregistrée", async () => {
    h.derniere = "non";
    const html = await rendu(jeton);
    expect(html).toMatch(/pas venir|ne pourrez pas/i);
  });

  it("?e=aucune_demande : un message clair (la demande n'est pas retrouvée), boutons conservés", async () => {
    const html = await rendu(jeton, "aucune_demande");
    expect(html).toMatch(/role="alert"/);
    expect(html).toMatch(/demande de confirmation/i);
    expect(html).toContain("Je serai présent(e)");
  });

  it("sans ?e= : aucun message d'erreur", async () => {
    expect(await rendu(jeton)).not.toMatch(/role="alert"/);
  });

  it("jeton invalide : un message, aucun bouton, aucune écriture", async () => {
    const html = await rendu("forge");
    expect(html).not.toContain("Je serai présent(e)");
    for (const fn of Object.values(db.remiseRetour)) expect(fn).not.toHaveBeenCalled();
  });

  it("ne s'indexe pas et n'est jamais mise en cache", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
