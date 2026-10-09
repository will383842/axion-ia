/**
 * L8d — LA LISTE « FUTURS APPORTEURS » (maquette v2) : ses colonnes, son
 * bandeau, ses actions groupées, et AUCUN mot de recrutement ; le filtre
 * « Langue » a disparu, les onglets de la PR 1358 restent.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const J = (j: number) => new Date(Date.UTC(2026, 8, j, 10));
const LIGNE = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "contact",
  status: "in_progress",
  locale: "fr",
  companyName: "—",
  contactName: "Nadine Roux",
  contactEmail: "nadine@exemple.invalid",
  contactPhone: null,
  messageExtrait: null,
  sector: null,
  assignedTo: null,
  submittedAt: J(29),
  replyCount: 0,
  needsAttention: true,
  archivedAt: null,
  deletedAt: null,
  lastRepliedAt: null,
  lastReplyStatus: null,
  unifiedType: "recrutement",
  subType: "candidature-commerciale",
  origine: null,
  sansSuiteAt: null,
  pretASignerLe: null,
  lignesDeLaPersonne: 1,
  etape: null,
  zone: "Grenoble · Isère (38)",
  connuPar: "Facebook / Instagram",
};

vi.mock("@/features/admin-submissions/actions", () => ({
  listSubmissionsAction: async () => ({
    items: [LIGNE],
    total: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  }),
}));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  lireSuiviInvitationListe: async () =>
    new Map([
      [
        LIGNE.id,
        {
          invitation: J(30),
          relances: [],
          echange: "reserve",
          echangeLe: new Date(Date.UTC(2026, 11, 9, 8)),
          reponse: new Date(Date.UTC(2026, 9, 6, 8)),
        },
      ],
    ]),
}));
vi.mock("@/features/commercial-application/etape-apporteur-liste", () => ({
  lireDossiersApporteurListe: async () => new Map(),
  lireMotifsSansLien: async () => new Map(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findFirst: async () => ({ id: LIGNE.id, updatedAt: new Date(Date.now() - 3 * 86_400_000) }),
    },
  },
}));
vi.mock("@/server/partages/config", () => ({ partagesActifs: () => false }));
vi.mock("@/server/partages/suivi", () => ({ fichiersPourComposeur: async () => [] }));
vi.mock("@/components/admin/contacts/ArchiverSelectionApporteurs", () => ({
  ArchiverSelectionApporteurs: () => <button type="button">Archiver la sélection</button>,
}));
vi.mock("@/components/admin/contacts/ComposeurEnMasseApporteurs", () => ({
  ComposeurEnMasseApporteurs: () => <p>Écrire à la sélection</p>,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ListeFutursApporteurs } from "../ListeFutursApporteurs";
import { motsInterditsApporteur } from "@/lib/commercial-application/vocabulaire-apporteur";

async function rendre(sp: Record<string, string> = {}): Promise<string> {
  const el = (await ListeFutursApporteurs({ adminPrefix: "p", searchParams: sp })) as ReactElement;
  return renderToStaticMarkup(el);
}

describe("ListeFutursApporteurs", () => {
  it("les colonnes de la maquette et les faits de la ligne", async () => {
    const html = await rendre();
    for (const c of [
      "Date",
      "Nom",
      "Zone",
      "Dossier",
      "Étape",
      "Dernier échange",
      "Nous a connus par",
    ]) {
      expect(html).toContain(`>${c}<`);
    }
    expect(html).toContain("Nadine Roux");
    expect(html).toContain("Grenoble · Isère (38)");
    expect(html).toContain("Échange prévu");
    expect(html).toContain("↙ reçu le 06/10");
    expect(html).toContain("Facebook / Instagram");
  });

  it("bandeau « notre plus ancienne réponse », onglets de la PR 1358, actions groupées, sans « Langue »", async () => {
    const html = await rendre();
    expect(html).toContain("Notre plus ancienne réponse en attente");
    expect(html).toContain("3 j");
    for (const o of ["En cours", "Archivés", "Tous", "Corbeille"]) expect(html).toContain(o);
    expect(html).toContain("Archiver la sélection");
    expect(html).toContain("Écrire à la sélection");
    expect(html).not.toMatch(/>Langue</);
  });

  it("🔴 aucun mot de recrutement à l'écran", async () => {
    const texte = (await rendre()).replace(/<[^>]+>/g, " ");
    expect(motsInterditsApporteur(texte)).toEqual([]);
  });

  it("filtre dérivé « Étape » : appliqué, et dit", async () => {
    const html = await rendre({ etape: "Sans suite" });
    expect(html).toContain("Personne avec ces filtres.");
    expect(html).toContain("fiches les plus récentes");
  });
});
