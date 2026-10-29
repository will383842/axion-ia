import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ lire: vi.fn(), outbox: vi.fn() }));
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: m.lire,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { emailOutbox: { findFirst: m.outbox } } }));
vi.mock("@/features/dossier-client/fiche/actions-relance-equipe", () => ({
  demanderAuDirigeantDeRelancerSonEquipeAction: async () => {},
}));

import type { ContexteFiche } from "../contexte";
import { questionnaireEnBref } from "../QuestionnaireEnBref";

const ligne = (nom: string, etat: string) => ({
  nom,
  etat,
  role: "collaborateur",
  sourceNom: "equipe",
});
const questionnaire = (collabs: ReturnType<typeof ligne>[], recus: number) => ({
  id: "q1",
  envoyeLe: new Date(),
  closLe: null,
  expireLe: new Date("2026-11-05T10:00:00Z"),
  parPersonne: {
    suivi: {
      dirigeant: { nom: "Anne Durand", etat: "recu", role: "dirigeant", sourceNom: "equipe" },
      collaborateurs: collabs,
      referents: [],
      total: { attendus: collabs.length + 1, recus },
    },
  },
});
const ctx = (role: string, voit = true): ContexteFiche =>
  ({
    clientId: "c1",
    qBase: "/fr/x/qualiopi",
    role,
    voitEchanges: voit,
  }) as unknown as ContexteFiche;

const rendre = async (c: ContexteFiche) => {
  const el = await questionnaireEnBref(c);
  return el === null ? "" : renderToStaticMarkup(el);
};

beforeEach(() => {
  vi.resetAllMocks();
  m.outbox.mockResolvedValue(null);
});

describe("QuestionnaireEnBref", () => {
  it("dit la réponse en une ligne, la date limite et propose la demande au dirigeant", async () => {
    m.lire.mockResolvedValue([
      questionnaire([ligne("Paul Martin", "pas_de_nouvelles"), ligne("Léa Roux", "recu")], 2),
    ]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("2 réponses sur 3. Il manque Paul.");
    expect(html).toContain("À rendre avant le 5 nov.");
    expect(html).toContain("J+2, J+5, J+10");
    expect(html).toContain("Demander à Anne de relancer son équipe");
    // Aucun bouton de relance d'un collaborateur, aucun envoi du questionnaire à un collaborateur.
    expect(html).not.toMatch(/Relancer Paul|Relancer Léa|Envoyer le questionnaire/);
    expect(html).not.toContain("admin-button-primary");
  });

  it("un message déjà prêt : lien pour le relire, pas de second bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    m.outbox.mockResolvedValue({ id: "o1" });
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Relire le message prêt");
    expect(html).not.toContain("de relancer son équipe");
  });

  it("complet : phrase de fin, aucun bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "recu")], 2)]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Toutes les réponses sont arrivées.");
    expect(html).not.toContain("<button");
  });

  it("un autre rôle voit la phrase mais pas le bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("admin"));
    expect(html).toContain("Il manque Paul");
    expect(html).not.toContain("<button");
  });

  it("sans droit sur les échanges : rien", async () => {
    expect(await rendre(ctx("admin", false))).toBe("");
    expect(m.lire).not.toHaveBeenCalled();
  });

  it("suivi en panne : « Lecture impossible », jamais « rien »", async () => {
    m.lire.mockResolvedValue([
      { ...questionnaire([], 0), parPersonne: null, parPersonneEnPanne: true },
    ]);
    expect(await rendre(ctx("super_admin"))).toContain("Lecture impossible");
  });
});
